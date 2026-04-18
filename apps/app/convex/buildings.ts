import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { tryNormalizeParticipantId } from "./lib/identity";

export const getBuildings = query({
  args: { islandId: v.id("islands") },
  handler: async (ctx, { islandId }) =>
    ctx.db
      .query("buildings")
      .withIndex("by_island", (q) => q.eq("islandId", islandId))
      .collect(),
});

export const tickBuildProgress = mutation({
  args: { islandId: v.id("islands"), motivationFactor: v.number() },
  handler: async (ctx, { islandId, motivationFactor }) => {
    const INTERVAL_SECS = 5;
    const GAME_DAY_SECS = 120;
    const now = Date.now();
    const island = await ctx.db.get(islandId);
    if (!island) throw new Error("Island not found");

    // Prevent multi-tab clients from accelerating build progression.
    const minIntervalMs = INTERVAL_SECS * 1000 - 250;
    const lastTickAt = island.lastBuildTickAt ?? 0;
    if (now - lastTickAt < minIntervalMs) {
      return;
    }
    await ctx.db.patch(islandId, { lastBuildTickAt: now });

    const normalizedMotivation = Math.max(0, Math.min(1, motivationFactor));
    const buildings = await ctx.db
      .query("buildings")
      .withIndex("by_island", (q) => q.eq("islandId", islandId))
      .filter((q) => q.eq(q.field("state"), "constructing"))
      .collect();
    for (const b of buildings) {
      const rate = normalizedMotivation / (Math.max(1, b.buildTimeDays) * GAME_DAY_SECS);
      const newProgress = Math.min(1, b.buildProgress + rate * INTERVAL_SECS);
      const isComplete = newProgress >= 1;
      await ctx.db.patch(b._id, {
        buildProgress: newProgress,
        state: isComplete ? "complete" : b.state,
        ...(isComplete ? { completedAt: Date.now() } : {}),
      });
      if (isComplete) {
        await ctx.db.insert("events", {
          islandId,
          type: "build_complete",
          payload: { buildingId: b._id, type: b.type },
          timestamp: Date.now(),
        });
      }
    }
  },
});

export const placeBuilding = mutation({
  args: {
    islandId: v.id("islands"),
    type: v.string(),
    gridX: v.number(),
    gridY: v.number(),
    costPaid: v.number(),
    logCost: v.optional(v.number()),
    rockCost: v.optional(v.number()),
    placedBy: v.string(),
    buildTimeDays: v.number(),
  },
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.gridX) || !Number.isFinite(args.gridY)) {
      throw new Error("Invalid building coordinates");
    }
    if (!Number.isFinite(args.buildTimeDays) || args.buildTimeDays <= 0) {
      throw new Error("Invalid build time");
    }
    const island = await ctx.db.get(args.islandId);
    if (!island) throw new Error("Island not found");

    const logCost = Math.max(0, Math.round(args.logCost ?? 0));
    const rockCost = Math.max(0, Math.round(args.rockCost ?? 0));
    const availableLogs = island.logs ?? 0;
    const availableRocks = island.rocks ?? 0;

    if (logCost > 0 || rockCost > 0) {
      if (logCost > availableLogs) throw new Error("Not enough logs to place this structure");
      if (rockCost > availableRocks) throw new Error("Not enough rocks to place this structure");
    }

    // Legacy currency path (costPaid > 0 means old-style purchase)
    const costPaid = Math.max(0, Math.round(args.costPaid));

    const maxX = Math.max(1, Math.floor((island.gridSize?.width ?? 10) / 2));
    const maxY = Math.max(1, Math.floor((island.gridSize?.height ?? 10) / 2));
    if (Math.abs(args.gridX) > maxX || Math.abs(args.gridY) > maxY) {
      throw new Error("Building placement is outside island bounds");
    }

    const currentEra = island.era ?? 0;
    const occupied = await ctx.db
      .query("buildings")
      .withIndex("by_island", (q) => q.eq("islandId", args.islandId))
      .filter((q) =>
        q.and(
          q.eq(q.field("gridX"), args.gridX),
          q.eq(q.field("gridY"), args.gridY),
          q.eq(q.field("placedAtEra"), currentEra),
        )
      )
      .first();
    if (occupied) {
      throw new Error("Tile already occupied");
    }

    const normalizedPlacedBy = tryNormalizeParticipantId(args.placedBy);
    const placedBy = normalizedPlacedBy ?? (args.placedBy.trim() || "unknown");

    const id = await ctx.db.insert("buildings", {
      ...args,
      costPaid,
      placedBy,
      footprint: { width: 1, height: 1 },
      state: "constructing",
      buildProgress: 0,
      placedAt: Date.now(),
      placedAtEra: currentEra,
    });
    await ctx.db.patch(args.islandId, {
      ...(logCost > 0 ? { logs: availableLogs - logCost } : {}),
      ...(rockCost > 0 ? { rocks: availableRocks - rockCost } : {}),
    });
    return id;
  },
});
