import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { defaultActivity, defaultMovementState } from "./lib/agentState";
import { normalizeParticipantId, requireParticipantId } from "./lib/identity";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function utcDayStartMs(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return NaN;
  }
  return Date.UTC(y, m - 1, d);
}

function computeDayCount(createdAtMs: number, date: string): number {
  const targetDay = utcDayStartMs(date);
  if (!Number.isFinite(targetDay)) return 1;
  const created = new Date(createdAtMs);
  const createdDay = Date.UTC(
    created.getUTCFullYear(),
    created.getUTCMonth(),
    created.getUTCDate()
  );
  return Math.max(1, Math.floor((targetDay - createdDay) / ONE_DAY_MS) + 1);
}

function deriveStreakFromDates(dates: string[]): { streakDays: number; lastCheckInDate?: string } {
  if (!dates.length) return { streakDays: 0 };
  const uniqueDates = Array.from(new Set(dates)).sort((a, b) =>
    utcDayStartMs(b) - utcDayStartMs(a)
  );
  let streakDays = 1;
  let previous = utcDayStartMs(uniqueDates[0]);
  for (let i = 1; i < uniqueDates.length; i += 1) {
    const current = utcDayStartMs(uniqueDates[i]);
    if (!Number.isFinite(current) || !Number.isFinite(previous)) break;
    if (previous - current === ONE_DAY_MS) {
      streakDays += 1;
      previous = current;
      continue;
    }
    break;
  }
  return { streakDays, lastCheckInDate: uniqueDates[0] };
}

async function getIslandMotivationFactor(
  ctx: MutationCtx,
  islandId: Id<"islands">,
): Promise<number> {
  const agents = await ctx.db
    .query("agents")
    .withIndex("by_island", (q) => q.eq("islandId", islandId))
    .collect();
  if (!agents.length) return 0;
  const avgMood = agents.reduce((sum, agent) => sum + agent.motivation, 0) / agents.length;
  return clamp((avgMood - 20) / 80, 0, 1);
}

async function ensureAgentForMember(
  ctx: MutationCtx,
  islandId: Id<"islands">,
  participantId: string,
) {
  const existing = await ctx.db
    .query("agents")
    .withIndex("by_island_phone", (q) =>
      q.eq("islandId", islandId).eq("phoneNumber", participantId)
    )
    .collect();

  if (existing.length > 0) {
    const [keep, ...dupes] = [...existing].sort((a, b) => a.createdAt - b.createdAt);
    for (const duplicate of dupes) {
      await ctx.db.delete(duplicate._id);
    }
    await ctx.db.patch(keep._id, {
      currentActivity: keep.currentActivity ?? defaultActivity(),
      movementState: keep.movementState ?? defaultMovementState(`${islandId}:${participantId}`),
    });
    return keep._id;
  }

  return await ctx.db.insert("agents", {
    islandId,
    phoneNumber: participantId,
    personalityProfile: "",
    motivation: 100,
    reminderVariants: [],
    currentActivity: defaultActivity(),
    movementState: defaultMovementState(`${islandId}:${participantId}`),
    createdAt: Date.now(),
  });
}

async function advanceConstructingBuildingsByDays(
  ctx: MutationCtx,
  islandId: Id<"islands">,
  motivationFactor: number,
  days: number,
) {
  if (days <= 0 || motivationFactor <= 0) return;
  const buildings = await ctx.db
    .query("buildings")
    .withIndex("by_island", (q) => q.eq("islandId", islandId))
    .filter((q) => q.eq(q.field("state"), "constructing"))
    .collect();

  for (const building of buildings) {
    const dailyRate = motivationFactor / Math.max(1, building.buildTimeDays);
    const newProgress = clamp(building.buildProgress + dailyRate * days, 0, 1);
    const isComplete = newProgress >= 1 && building.buildProgress < 1;
    await ctx.db.patch(building._id, {
      buildProgress: newProgress,
      ...(isComplete ? { state: "complete", completedAt: Date.now() } : {}),
    });
    if (isComplete) {
      await ctx.db.insert("events", {
        islandId,
        type: "build_complete",
        payload: { buildingId: building._id, type: building.type },
        timestamp: Date.now(),
      });
    }
  }
}

// Add goals for a user on an island
export const addGoals = mutation({
  args: {
    islandId: v.id("islands"),
    phoneNumber: v.string(),
    goals: v.array(v.string()),
  },
  async handler(ctx, args) {
    const phoneNumber = await requireParticipantId(ctx, args.phoneNumber);
    const goalIds: string[] = [];
    const now = Date.now();
    await ensureAgentForMember(ctx, args.islandId, phoneNumber);

    const existingActive = await ctx.db
      .query("goals")
      .withIndex("by_island_phone_status", (q) =>
        q.eq("islandId", args.islandId).eq("phoneNumber", phoneNumber).eq("status", "active")
      )
      .collect();
    const normalizedExisting = new Set(
      existingActive.map((goal) => goal.text.trim().toLowerCase()).filter(Boolean)
    );

    for (const goalText of args.goals) {
      const normalizedGoal = goalText.trim();
      if (!normalizedGoal) continue;
      const dedupeKey = normalizedGoal.toLowerCase();
      if (normalizedExisting.has(dedupeKey)) continue;
      const goalId = await ctx.db.insert("goals", {
        islandId: args.islandId,
        phoneNumber,
        text: normalizedGoal,
        status: "active",
        createdAt: now,
      });
      goalIds.push(goalId);
      normalizedExisting.add(dedupeKey);
    }

    return goalIds;
  },
});

// Archive a goal (soft-delete). Used by iMessage /drop.
export const archiveGoal = mutation({
  args: { goalId: v.id("goals") },
  async handler(ctx, args) {
    const goal = await ctx.db.get(args.goalId);
    if (!goal) throw new Error("Goal not found");
    await ctx.db.patch(args.goalId, {
      status: "archived",
      archivedAt: Date.now(),
    });
    return true;
  },
});

// Edit a goal in place. Keeps the same _id, creation time, and any existing
// check-ins tied to this goal, so the numbered position in /goals is preserved.
export const editGoal = mutation({
  args: { goalId: v.id("goals"), newText: v.string() },
  async handler(ctx, args) {
    const goal = await ctx.db.get(args.goalId);
    if (!goal) throw new Error("Goal not found");
    if (goal.status !== "active") throw new Error("Cannot edit an archived goal");
    await ctx.db.patch(args.goalId, { text: args.newText });
    return await ctx.db.get(args.goalId);
  },
});

// Get all goals for a user on an island
export const getGoals = query({
  args: {
    islandId: v.id("islands"),
    phoneNumber: v.string(),
  },
  async handler(ctx, args) {
    const phoneNumber = await requireParticipantId(ctx, args.phoneNumber);
    const goals = await ctx.db
      .query("goals")
      .withIndex("by_island_phone", (q) =>
        q.eq("islandId", args.islandId).eq("phoneNumber", phoneNumber)
      )
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    return goals;
  },
});

// Get all goals for an island
export const getIslandGoals = query({
  args: {
    islandId: v.id("islands"),
  },
  async handler(ctx, args) {
    const goals = await ctx.db
      .query("goals")
      .withIndex("by_island", (q) => q.eq("islandId", args.islandId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    return goals;
  },
});

// Check in on a goal
export const checkIn = mutation({
  args: {
    goalId: v.id("goals"),
    islandId: v.id("islands"),
    phoneNumber: v.string(),
    date: v.string(), // YYYY-MM-DD
  },
  async handler(ctx, args) {
    const phoneNumber = await requireParticipantId(ctx, args.phoneNumber);
    const goal = await ctx.db.get(args.goalId);
    if (!goal) throw new Error("Goal not found");
    if (goal.islandId !== args.islandId) throw new Error("Goal does not belong to this island");
    if (goal.phoneNumber !== phoneNumber) throw new Error("Goal belongs to a different member");
    if (goal.status !== "active") throw new Error("Cannot check in an archived goal");

    // Check if already checked in today
    const existing = await ctx.db
      .query("checkIns")
      .withIndex("by_goal_phone_date", (q) =>
        q.eq("goalId", args.goalId).eq("phoneNumber", phoneNumber).eq("date", args.date)
      )
      .first();

    const getStats = async () => {
      const allCheckIns = await ctx.db
        .query("checkIns")
        .withIndex("by_island_date", (q) =>
          q.eq("islandId", args.islandId).eq("date", args.date)
        )
        .filter((q) => q.eq(q.field("phoneNumber"), phoneNumber))
        .collect();
      
      const allGoals = await ctx.db
        .query("goals")
        .withIndex("by_island_phone", (q) =>
          q.eq("islandId", args.islandId).eq("phoneNumber", phoneNumber)
        )
        .filter((q) => q.eq(q.field("status"), "active"))
        .collect();
        
      return {
        doneCount: allCheckIns.filter(c => c.completed).length,
        totalGoals: allGoals.length
      };
    };

    if (existing) {
      const stats = await getStats();
      return { checkIn: existing, alreadyDone: true, ...stats };
    }

    // Create check-in
    const checkInId = await ctx.db.insert("checkIns", {
      goalId: args.goalId,
      phoneNumber,
      islandId: args.islandId,
      date: args.date,
      completed: true,
      createdAt: Date.now(),
    });

    // Record check_in event for weekly summary tracking
    await ctx.db.insert("events", {
      islandId: args.islandId,
      type: "check_in",
      payload: { goalId: args.goalId, phoneNumber },
      timestamp: Date.now(),
    });

    // Update island XP and currency
    const island = await ctx.db.get(args.islandId);
    if (island) {
      const newXp = island.xp + 1;
      const islandPatch: {
        xp: number;
        currency: number;
        islandLevel: number;
        lastCheckInDate?: string;
        streakDays?: number;
        dayCount?: number;
      } = {
        xp: newXp,
        currency: island.currency + 10,
        islandLevel: Math.floor(newXp / 20),
      };

      const currentDayMs = utcDayStartMs(args.date);
      const lastDayMs = island.lastCheckInDate ? utcDayStartMs(island.lastCheckInDate) : NaN;
      let advancedDays = 0;
      if (
        Number.isFinite(currentDayMs) &&
        (!Number.isFinite(lastDayMs) || currentDayMs > lastDayMs)
      ) {
        advancedDays = Number.isFinite(lastDayMs)
          ? Math.max(1, Math.floor((currentDayMs - lastDayMs) / ONE_DAY_MS))
          : 1;
        islandPatch.lastCheckInDate = args.date;
        islandPatch.streakDays =
          Number.isFinite(lastDayMs) && currentDayMs - lastDayMs === ONE_DAY_MS
            ? (island.streakDays ?? 0) + 1
            : 1;
        islandPatch.dayCount = Math.max(
          island.dayCount ?? 1,
          computeDayCount(island.createdAt, args.date)
        );
      }

      await ctx.db.patch(args.islandId, islandPatch);
      const canAdvanceBuildings = advancedDays > 0 && island.lastBuildAdvanceDate !== args.date;
      if (canAdvanceBuildings) {
        const motivationFactor = await getIslandMotivationFactor(ctx, args.islandId);
        await advanceConstructingBuildingsByDays(
          ctx,
          args.islandId,
          motivationFactor,
          advancedDays,
        );
        await ctx.db.patch(args.islandId, {
          lastBuildAdvanceDate: args.date,
        });
      }
    }

    const agentRows = await ctx.db
      .query("agents")
      .withIndex("by_island_phone", (q) =>
        q.eq("islandId", args.islandId).eq("phoneNumber", phoneNumber)
      )
      .collect();
    if (agentRows.length > 0) {
      const [agent, ...dupes] = [...agentRows].sort((a, b) => a.createdAt - b.createdAt);
      for (const duplicate of dupes) {
        await ctx.db.delete(duplicate._id);
      }
      await ctx.db.patch(agent._id, {
        motivation: Math.min(100, agent.motivation + 1),
        currentActivity: "completed_goal",
        movementState: {
          ...(agent.movementState ?? defaultMovementState(`${args.islandId}:${phoneNumber}`)),
          mode: "work",
          updatedAt: Date.now(),
        },
      });
    }

    const stats = await getStats();
    return { checkIn: await ctx.db.get(checkInId), alreadyDone: false, ...stats };
  },
});

// Undo a check-in (reverse of checkIn). Used by iMessage /undo.
export const uncheckIn = mutation({
  args: {
    goalId: v.id("goals"),
    islandId: v.id("islands"),
    phoneNumber: v.string(),
    date: v.string(), // YYYY-MM-DD
  },
  async handler(ctx, args) {
    const phoneNumber = await requireParticipantId(ctx, args.phoneNumber);
    const goal = await ctx.db.get(args.goalId);
    if (!goal) throw new Error("Goal not found");
    if (goal.islandId !== args.islandId) throw new Error("Goal does not belong to this island");
    if (goal.phoneNumber !== phoneNumber) throw new Error("Goal belongs to a different member");
    if (goal.status !== "active") throw new Error("Cannot undo archived goal");

    // Find the existing check-in for this goal+phone+date
    const existing = await ctx.db
      .query("checkIns")
      .withIndex("by_goal_phone_date", (q) =>
        q.eq("goalId", args.goalId).eq("phoneNumber", phoneNumber).eq("date", args.date)
      )
      .first();

    if (!existing) {
      return null; // nothing to undo
    }

    // Delete the check-in record
    await ctx.db.delete(existing._id);

    // Reverse island XP and currency changes
    const island = await ctx.db.get(args.islandId);
    if (island) {
      const newXp = Math.max(0, island.xp - 1);
      const islandCheckIns = await ctx.db
        .query("checkIns")
        .withIndex("by_island_date", (q) => q.eq("islandId", args.islandId))
        .collect();
      const streak = deriveStreakFromDates(islandCheckIns.map((c) => c.date));
      const dayCount = streak.lastCheckInDate
        ? computeDayCount(island.createdAt, streak.lastCheckInDate)
        : island.dayCount ?? 1;
      await ctx.db.patch(args.islandId, {
        xp: newXp,
        currency: Math.max(0, island.currency - 10),
        islandLevel: Math.floor(newXp / 20),
        streakDays: streak.streakDays,
        dayCount,
        ...(streak.lastCheckInDate
          ? { lastCheckInDate: streak.lastCheckInDate }
          : { lastCheckInDate: undefined }),
      });
    }

    // Reverse agent motivation change
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_island_phone", (q) =>
        q.eq("islandId", args.islandId).eq("phoneNumber", phoneNumber)
      )
      .first();
    if (agent) {
      await ctx.db.patch(agent._id, {
        motivation: Math.max(0, agent.motivation - 1),
      });
    }

    return true;
  },
});

// Get today's check-ins for a user
export const getTodayCheckIns = query({
  args: {
    islandId: v.id("islands"),
    phoneNumber: v.string(),
    date: v.string(),
  },
  async handler(ctx, args) {
    const phoneNumber = await requireParticipantId(ctx, args.phoneNumber);
    const checkIns = await ctx.db
      .query("checkIns")
      .withIndex("by_island_date", (q) =>
        q.eq("islandId", args.islandId).eq("date", args.date)
      )
      .filter((q) => q.eq(q.field("phoneNumber"), phoneNumber))
      .collect();

    return checkIns;
  },
});

// Get all check-ins for an island on a given day.
export const getIslandCheckInsByDate = query({
  args: {
    islandId: v.id("islands"),
    date: v.string(),
  },
  async handler(ctx, args) {
    return await ctx.db
      .query("checkIns")
      .withIndex("by_island_date", (q) =>
        q.eq("islandId", args.islandId).eq("date", args.date)
      )
      .collect();
  },
});
