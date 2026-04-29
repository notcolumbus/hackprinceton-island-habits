import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const logAiMessage = mutation({
  args: {
    agentId: v.id("agents"),
    channel: v.union(v.literal("imessage_personal"), v.literal("imessage_group")),
    content: v.string(),
    context: v.optional(v.any()),
  },
  handler: async (ctx, { agentId, channel, content, context }) => {
    await ctx.db.insert("aiMessages", {
      agentId,
      channel,
      content,
      context,
      sentAt: Date.now(),
    });
  },
});

export const recordMiss = mutation({
  args: {
    goalId: v.id("goals"),
    phoneNumber: v.string(),
    islandId: v.id("islands"),
    agentId: v.id("agents"),
    newMotivation: v.number(),
    date: v.string(),
  },
  handler: async (ctx, { goalId, phoneNumber, islandId, agentId, newMotivation, date }) => {
    await ctx.db.insert("checkIns", {
      goalId,
      phoneNumber,
      islandId,
      date,
      completed: false,
      createdAt: Date.now(),
    });
    await ctx.db.insert("events", {
      islandId,
      type: "miss",
      payload: { goalId, phoneNumber },
      timestamp: Date.now(),
    });
    await ctx.db.patch(agentId, { motivation: newMotivation });
  },
});

export const damageConstructingBuilding = mutation({
  args: { islandId: v.id("islands"), phoneNumber: v.string() },
  handler: async (ctx, { islandId, phoneNumber }) => {
    const building = await ctx.db
      .query("buildings")
      .withIndex("by_island", (q) => q.eq("islandId", islandId))
      .filter((q) =>
        q.and(
          q.eq(q.field("state"), "constructing"),
          q.eq(q.field("placedBy"), phoneNumber)
        )
      )
      .first();
    if (!building) return;

    await ctx.db.patch(building._id, { state: "damaged" });
    await ctx.db.insert("events", {
      islandId,
      type: "damage",
      payload: { buildingId: building._id, phoneNumber },
      timestamp: Date.now(),
    });
  },
});

export const advanceBuildProgress = mutation({
  args: {
    buildingId: v.id("buildings"),
    newProgress: v.number(),
    isComplete: v.boolean(),
  },
  handler: async (ctx, { buildingId, newProgress, isComplete }) => {
    const building = await ctx.db.get(buildingId);
    if (!building) return;

    if (isComplete) {
      await ctx.db.patch(buildingId, {
        buildProgress: 1,
        state: "complete",
        completedAt: Date.now(),
      });
      await ctx.db.insert("events", {
        islandId: building.islandId,
        type: "build_complete",
        payload: { buildingId, type: building.type },
        timestamp: Date.now(),
      });
    } else {
      await ctx.db.patch(buildingId, { buildProgress: newProgress });
    }
  },
});

export const recordWeeklySummariesBatch = mutation({
  args: {
    summaries: v.array(v.object({
      islandId: v.id("islands"),
      agentId: v.optional(v.id("agents")),
      content: v.string(),
      stats: v.any(),
    }))
  },
  handler: async (ctx, { summaries }) => {
    for (const summary of summaries) {
      const { islandId, agentId, content, stats } = summary;
      await ctx.db.insert("events", {
        islandId,
        type: "weekly_summary",
        payload: { content, stats },
        timestamp: Date.now(),
      });
      if (agentId) {
        await ctx.db.insert("aiMessages", {
          agentId,
          channel: "imessage_group",
          content,
          context: { ...(stats ?? {}), islandId },
          sentAt: Date.now(),
        });
      }

      const island = await ctx.db.get(islandId);
      if (island) {
        await ctx.db.patch(islandId, {
          lastWeeklySummaryDayCount: island.dayCount ?? 0,
        });
      }
    }
  },
});

export const processEndOfDayMissesBatch = mutation({
  args: {
    misses: v.array(
      v.object({
        goalId: v.id("goals"),
        phoneNumber: v.string(),
        islandId: v.id("islands"),
        agentId: v.id("agents"),
        penalty: v.number(),
        date: v.string(),
      })
    ),
  },
  handler: async (ctx, { misses }) => {
    const crossedThreshold = [];

    for (const m of misses) {
      // Check if already missed
      const startOfDay = new Date(m.date + "T00:00:00Z").getTime();
      const events = await ctx.db
        .query("events")
        .withIndex("by_island", (q) => q.eq("islandId", m.islandId))
        .filter((q) =>
          q.and(
            q.eq(q.field("type"), "miss"),
            q.gte(q.field("timestamp"), startOfDay),
            q.lt(q.field("timestamp"), startOfDay + 86400000)
          )
        )
        .collect();
      const alreadyMissed = events.some(
        (e) => e.payload && (e.payload as { goalId: string }).goalId === m.goalId
      );
      if (alreadyMissed) continue;

      // Insert checkIn and event
      await ctx.db.insert("checkIns", {
        goalId: m.goalId,
        phoneNumber: m.phoneNumber,
        islandId: m.islandId,
        date: m.date,
        completed: false,
        createdAt: Date.now(),
      });
      await ctx.db.insert("events", {
        islandId: m.islandId,
        type: "miss",
        payload: { goalId: m.goalId, phoneNumber: m.phoneNumber },
        timestamp: Date.now(),
      });

      // Damage building
      const building = await ctx.db
        .query("buildings")
        .withIndex("by_island", (q) => q.eq("islandId", m.islandId))
        .filter((q) =>
          q.and(
            q.eq(q.field("state"), "constructing"),
            q.eq(q.field("placedBy"), m.phoneNumber)
          )
        )
        .first();
      if (building) {
        await ctx.db.patch(building._id, { state: "damaged" });
        await ctx.db.insert("events", {
          islandId: m.islandId,
          type: "damage",
          payload: { buildingId: building._id, phoneNumber: m.phoneNumber },
          timestamp: Date.now(),
        });
      }

      // Motivation logic
      const agent = await ctx.db.get(m.agentId);
      if (agent) {
        const prevMotivation = agent.motivation;
        const newMotivation = Math.max(0, prevMotivation - m.penalty);
        await ctx.db.patch(m.agentId, { motivation: newMotivation });
        
        if (newMotivation < 30 && prevMotivation >= 30) {
          crossedThreshold.push({
            islandId: m.islandId,
            agentId: m.agentId,
            phoneNumber: m.phoneNumber,
            newMotivation,
            personalityProfile: agent.personalityProfile,
          });
        }
      }
    }
    return crossedThreshold;
  }
});
