import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { defaultActivity, defaultMovementState } from "./lib/agentState";
import { normalizeParticipantId, requireParticipantId } from "./lib/identity";

// Look up an agent for a user on an island
export const getAgent = query({
  args: { islandId: v.id("islands"), phoneNumber: v.string() },
  handler: async (ctx, args) => {
    const phoneNumber = await requireParticipantId(ctx, args.phoneNumber);
    const matches = await ctx.db
      .query("agents")
      .withIndex("by_island_phone", (q) =>
        q.eq("islandId", args.islandId).eq("phoneNumber", phoneNumber)
      )
      .collect();
    return matches[0] ?? null;
  },
});

// Create agent personality for a user on an island
export const createAgent = mutation({
  args: {
    islandId: v.id("islands"),
    phoneNumber: v.string(),
    goals: v.array(v.string()),
    personalityProfile: v.optional(v.string()),
    reminderVariants: v.optional(v.array(v.string())),
  },
  async handler(ctx, args) {
    const phoneNumber = await requireParticipantId(ctx, args.phoneNumber);
    const now = Date.now();
    const trimmedGoals = args.goals.map((goal) => goal.trim()).filter(Boolean);
    const personality =
      args.personalityProfile ??
      `A helpful island companion committed to supporting your goals: ${trimmedGoals.join(", ") || "consistency"}`;

    const variants = args.reminderVariants ?? [
      "Good morning! Time to tackle your goals!",
      "Let's make today productive!",
      "You've got this! Get started on your goals.",
      "Rise and shine! Ready to make a difference?",
      "Another day, another chance to grow!",
    ];

    const existingRows = await ctx.db
      .query("agents")
      .withIndex("by_island_phone", (q) =>
        q.eq("islandId", args.islandId).eq("phoneNumber", phoneNumber)
      )
      .collect();

    if (existingRows.length > 0) {
      const [keep, ...dupes] = [...existingRows].sort((a, b) => a.createdAt - b.createdAt);
      for (const duplicate of dupes) {
        await ctx.db.delete(duplicate._id);
      }
      await ctx.db.patch(keep._id, {
        personalityProfile: keep.personalityProfile || personality,
        reminderVariants: keep.reminderVariants?.length ? keep.reminderVariants : variants,
        motivation: Math.max(0, Math.min(100, keep.motivation ?? 100)),
        currentActivity: keep.currentActivity || defaultActivity(),
        movementState: keep.movementState ?? defaultMovementState(`${args.islandId}:${phoneNumber}`, now),
      });
      return await ctx.db.get(keep._id);
    }

    const agentId = await ctx.db.insert("agents", {
      islandId: args.islandId,
      phoneNumber,
      personalityProfile: personality,
      motivation: 100,
      reminderVariants: variants,
      currentActivity: defaultActivity(),
      movementState: defaultMovementState(`${args.islandId}:${phoneNumber}`, now),
      createdAt: now,
    });

    return await ctx.db.get(agentId);
  },
});

// Directory of every island the user belongs to, with the full roster of
// characters (islandMembers) for each — enriched with the agents row and
// recent aiMessages when they exist. Drives the /agents dashboard.
//
// A character may have no agents row yet (the agent spawns on first goal).
// We still return the member so the UI can show the character and explain
// the missing state, matching how IslandPage renders members one-to-one.
export const getAgentDirectoryForUser = query({
  args: {
    phoneNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    messageLimit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const identities = [args.phoneNumber, args.email]
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .map((v) => normalizeParticipantId(v));
    if (identities.length === 0) return [];

    const islandIds = new Set<string>();
    for (const id of identities) {
      const rows = await ctx.db
        .query("islandMembers")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", id))
        .collect();
      for (const r of rows) islandIds.add(r.islandId as unknown as string);
    }
    if (islandIds.size === 0) return [];

    const limit = Math.max(1, Math.min(50, args.messageLimit ?? 10));
    const results = [];
    for (const islandId of islandIds) {
      const island = await ctx.db.get(islandId as any);
      if (!island) continue;

      const members = await ctx.db
        .query("islandMembers")
        .withIndex("by_island", (q) => q.eq("islandId", islandId as any))
        .collect();
      const agents = await ctx.db
        .query("agents")
        .withIndex("by_island", (q) => q.eq("islandId", islandId as any))
        .collect();

      const agentByPhone = new Map(agents.map((a) => [a.phoneNumber, a]));

      const nameByPhone = new Map<string, string>();
      for (const m of members) {
        if (!m.phoneNumber) continue;
        const userRow = await ctx.db
          .query("users")
          .withIndex("by_phone", (q) => q.eq("phoneNumber", m.phoneNumber))
          .first();
        if (userRow?.displayName) nameByPhone.set(m.phoneNumber, userRow.displayName);
      }

      const characters = [];
      for (const m of members) {
        const agent = agentByPhone.get(m.phoneNumber) ?? null;
        let messages: any[] = [];
        if (agent) {
          messages = await ctx.db
            .query("aiMessages")
            .withIndex("by_agent_sent", (q) => q.eq("agentId", agent._id))
            .order("desc")
            .take(limit);
        }
        const displayName = nameByPhone.get(m.phoneNumber) ?? null;
        characters.push({ member: { ...m, displayName }, agent, messages });
      }

      characters.sort((a, b) => {
        if (a.member.role !== b.member.role) return a.member.role === "creator" ? -1 : 1;
        return a.member.phoneNumber < b.member.phoneNumber ? -1 : 1;
      });

      results.push({ island, characters });
    }
    results.sort((a, b) => {
      const an = (a.island as any).name ?? "";
      const bn = (b.island as any).name ?? "";
      return an < bn ? -1 : an > bn ? 1 : 0;
    });
    return results;
  },
});

// Update agent motivation
export const updateMotivation = mutation({
  args: {
    agentId: v.id("agents"),
    delta: v.number(), // positive or negative
  },
  async handler(ctx, args) {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }

    const newMotivation = Math.max(0, Math.min(100, agent.motivation + args.delta));
    await ctx.db.patch(args.agentId, { motivation: newMotivation });
    return newMotivation;
  },
});

export const setAgentActivity = mutation({
  args: {
    islandId: v.id("islands"),
    phoneNumber: v.string(),
    activity: v.string(),
    movementMode: v.optional(
      v.union(
        v.literal("idle"),
        v.literal("wander"),
        v.literal("approach"),
        v.literal("chat"),
        v.literal("work"),
      )
    ),
    phase: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const phoneNumber = await requireParticipantId(ctx, args.phoneNumber);
    const rows = await ctx.db
      .query("agents")
      .withIndex("by_island_phone", (q) =>
        q.eq("islandId", args.islandId).eq("phoneNumber", phoneNumber)
      )
      .collect();
    if (rows.length === 0) {
      throw new Error("Agent not found");
    }
    const [keep, ...dupes] = [...rows].sort((a, b) => a.createdAt - b.createdAt);
    for (const duplicate of dupes) {
      await ctx.db.delete(duplicate._id);
    }
    const mode = args.movementMode ?? keep.movementState?.mode ?? "wander";
    const phase = args.phase ?? keep.movementState?.phase ?? 0;
    await ctx.db.patch(keep._id, {
      currentActivity: args.activity.trim() || defaultActivity(),
      movementState: {
        mode,
        seed: keep.movementState?.seed ?? defaultMovementState(`${args.islandId}:${phoneNumber}`).seed,
        phase,
        updatedAt: Date.now(),
      },
    });
    return await ctx.db.get(keep._id);
  },
});
