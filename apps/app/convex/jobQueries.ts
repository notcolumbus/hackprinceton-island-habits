import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";

// Returns all active island members with their agent, active goals, and island
export const getActiveMembersWithGoals = query({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db.query("islandMembers").collect();
    const results: {
      phoneNumber: string;
      agent: Doc<"agents">;
      goals: Doc<"goals">[];
      island: Doc<"islands">;
    }[] = [];
    const islandCache = new Map<Id<"islands">, Doc<"islands"> | null>();

    for (const member of members) {
      let island = islandCache.get(member.islandId);
      if (island === undefined) {
        island = await ctx.db.get(member.islandId);
        islandCache.set(member.islandId, island);
      }
      if (!island) continue;

      const agent = await ctx.db
        .query("agents")
        .withIndex("by_island_phone", (q) =>
          q.eq("islandId", member.islandId).eq("phoneNumber", member.phoneNumber)
        )
        .collect();
      const canonicalAgent = [...agent].sort((a, b) => a.createdAt - b.createdAt)[0];
      if (!canonicalAgent) continue;

      const goals = await ctx.db
        .query("goals")
        .withIndex("by_island_phone", (q) =>
          q.eq("islandId", member.islandId).eq("phoneNumber", member.phoneNumber)
        )
        .filter((q) => q.eq(q.field("status"), "active"))
        .collect();

      if (goals.length === 0) continue;

      results.push({ phoneNumber: member.phoneNumber, agent: canonicalAgent, goals, island });
    }

    return results;
  },
});

// Like getActiveMembersWithGoals, but includes members even when they have
// no agent record yet or no active goals. Morning reminder uses this so
// teammates who joined via the web (never /add'd a goal) still get a nudge.
// When agent is missing → null; when goals is empty → []. The job handler
// picks a generic message in those cases.
export const getAllMembersForReminder = query({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db.query("islandMembers").collect();
    const results: {
      phoneNumber: string;
      displayName: string | null;
      agent: Doc<"agents"> | null;
      goals: Doc<"goals">[];
      island: Doc<"islands">;
    }[] = [];
    const islandCache = new Map<Id<"islands">, Doc<"islands"> | null>();

    for (const member of members) {
      let island = islandCache.get(member.islandId);
      if (island === undefined) {
        island = await ctx.db.get(member.islandId);
        islandCache.set(member.islandId, island);
      }
      if (!island) continue;

      const agents = await ctx.db
        .query("agents")
        .withIndex("by_island_phone", (q) =>
          q.eq("islandId", member.islandId).eq("phoneNumber", member.phoneNumber)
        )
        .collect();
      const canonicalAgent = [...agents].sort((a, b) => a.createdAt - b.createdAt)[0] ?? null;

      const goals = await ctx.db
        .query("goals")
        .withIndex("by_island_phone", (q) =>
          q.eq("islandId", member.islandId).eq("phoneNumber", member.phoneNumber)
        )
        .filter((q) => q.eq(q.field("status"), "active"))
        .collect();

      // Look up a friendly name so the group message reads like a chat.
      const isEmail = member.phoneNumber.includes("@");
      const userRow = isEmail
        ? await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", member.phoneNumber.toLowerCase()))
            .first()
        : await ctx.db
            .query("users")
            .withIndex("by_phone", (q) => q.eq("phoneNumber", member.phoneNumber))
            .first();

      results.push({
        phoneNumber: member.phoneNumber,
        displayName: userRow?.displayName ?? null,
        agent: canonicalAgent,
        goals,
        island,
      });
    }
    return results;
  },
});

// Returns true if a personal reminder was already sent to this agent today
export const reminderSentToday = query({
  args: { agentId: v.id("agents"), today: v.string() },
  handler: async (ctx, { agentId, today }) => {
    const startOfDay = new Date(today + "T00:00:00Z").getTime();
    const msg = await ctx.db
      .query("aiMessages")
      .withIndex("by_agent_sent", (q) =>
        q.eq("agentId", agentId).gte("sentAt", startOfDay)
      )
      .filter((q) =>
        q.and(
          q.lt(q.field("sentAt"), startOfDay + 86400000),
          q.eq(q.field("channel"), "imessage_personal")
        )
      )
      .first();
    return msg !== null;
  },
});

// Count missed events for a phone number on an island in the last N days
export const recentMissCount = query({
  args: { islandId: v.id("islands"), phoneNumber: v.string(), days: v.number() },
  handler: async (ctx, { islandId, phoneNumber, days }) => {
    const since = Date.now() - days * 86400000;
    const events = await ctx.db
      .query("events")
      .withIndex("by_island", (q) => q.eq("islandId", islandId))
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "miss"),
          q.gte(q.field("timestamp"), since)
        )
      )
      .collect();
    return events.filter(
      (e) => e.payload && (e.payload as { phoneNumber: string }).phoneNumber === phoneNumber
    ).length;
  },
});

// Returns all active goals that have no checkIn for the given date
export const getUncheckedGoalsForDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const activeGoals = await ctx.db
      .query("goals")
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const results: {
      goal: Doc<"goals">;
      island: Doc<"islands">;
      phoneNumber: string;
      agent: Doc<"agents">;
    }[] = [];
    const islandCache = new Map<Id<"islands">, Doc<"islands"> | null>();

    for (const goal of activeGoals) {
      const checkIn = await ctx.db
        .query("checkIns")
        .withIndex("by_goal", (q) => q.eq("goalId", goal._id))
        .filter((q) => q.eq(q.field("date"), date))
        .first();
      if (checkIn) continue;

      let island = islandCache.get(goal.islandId);
      if (island === undefined) {
        island = await ctx.db.get(goal.islandId);
        islandCache.set(goal.islandId, island);
      }
      if (!island) continue;

      const agent = await ctx.db
        .query("agents")
        .withIndex("by_island_phone", (q) =>
          q.eq("islandId", goal.islandId).eq("phoneNumber", goal.phoneNumber)
        )
        .collect();
      const canonicalAgent = [...agent].sort((a, b) => a.createdAt - b.createdAt)[0];
      if (!canonicalAgent) continue;

      results.push({ goal, island, phoneNumber: goal.phoneNumber, agent: canonicalAgent });
    }
    return results;
  },
});

// Returns true if a miss event was already recorded for this goal on this date
export const missAlreadyRecorded = query({
  args: { goalId: v.id("goals"), date: v.string(), islandId: v.id("islands") },
  handler: async (ctx, { goalId, date, islandId }) => {
    const startOfDay = new Date(date + "T00:00:00Z").getTime();
    const events = await ctx.db
      .query("events")
      .withIndex("by_island", (q) => q.eq("islandId", islandId))
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "miss"),
          q.gte(q.field("timestamp"), startOfDay),
          q.lt(q.field("timestamp"), startOfDay + 86400000)
        )
      )
      .collect();
    return events.some(
      (e) => e.payload && (e.payload as { goalId: string }).goalId === goalId
    );
  },
});

// Returns all constructing buildings with their island's agents
export const getConstructingBuildings = query({
  args: {},
  handler: async (ctx) => {
    const buildings = await ctx.db
      .query("buildings")
      .filter((q) => q.eq(q.field("state"), "constructing"))
      .collect();

    const results: { building: Doc<"buildings">; agents: Doc<"agents">[] }[] = [];
    for (const building of buildings) {
      const agents = await ctx.db
        .query("agents")
        .withIndex("by_island", (q) => q.eq("islandId", building.islandId))
        .collect();
      results.push({ building, agents });
    }
    return results;
  },
});

// Returns all active islands with their member phone numbers and last 7 days of events
export const getIslandsForWeeklySummary = query({
  args: {},
  handler: async (ctx) => {
    const islands = await ctx.db
      .query("islands")
      .collect();

    const since = Date.now() - 7 * 86400000;
    const results: {
      island: Doc<"islands">;
      phones: string[];
      events: Doc<"events">[];
    }[] = [];

    for (const island of islands) {
      const members = await ctx.db
        .query("islandMembers")
        .withIndex("by_island", (q) => q.eq("islandId", island._id))
        .collect();

      const phones = members.map((m) => m.phoneNumber);

      const events = await ctx.db
        .query("events")
        .withIndex("by_island", (q) => q.eq("islandId", island._id))
        .filter((q) => q.gte(q.field("timestamp"), since))
        .collect();

      const checkInPhones = new Set(
        events
          .filter((event) => event.type === "check_in")
          .map((event) => (event.payload as { phoneNumber?: string })?.phoneNumber)
          .filter((value): value is string => Boolean(value))
      );
      const eligiblePhones = members
        .filter((member) => member.joinedAt <= since || checkInPhones.has(member.phoneNumber))
        .map((member) => member.phoneNumber);

      results.push({ island, phones: eligiblePhones.length ? eligiblePhones : phones, events });
    }

    return results;
  },
});

// Debug: returns raw counts to diagnose why getActiveMembersWithGoals returns empty
export const debugMemberPipeline = query({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db.query("islandMembers").collect();
    const agents = await ctx.db.query("agents").collect();
    const goals = await ctx.db.query("goals").collect();
    const islands = await ctx.db.query("islands").collect();
    return {
      memberCount: members.length,
      agentCount: agents.length,
      goalCount: goals.length,
      islandCount: islands.length,
      activeGoalCount: goals.filter((g) => g.status === "active").length,
      members: members.map((m) => ({ islandId: m.islandId, phoneNumber: m.phoneNumber })),
      agents: agents.map((a) => ({ islandId: a.islandId, phoneNumber: a.phoneNumber })),
      goals: goals.map((g) => ({ islandId: g.islandId, phoneNumber: g.phoneNumber, status: g.status })),
      islands: islands.map((i) => ({ id: i._id, status: i.status, name: i.name })),
    };
  },
});

// Get phone numbers for all members of an island
export const getIslandPhoneNumbers = query({
  args: { islandId: v.id("islands") },
  handler: async (ctx, { islandId }) => {
    const members = await ctx.db
      .query("islandMembers")
      .withIndex("by_island", (q) => q.eq("islandId", islandId))
      .collect();
    return members.map((m) => m.phoneNumber);
  },
});

// Resolve a phone/email identity to a friendly display name. Falls back to
// the last 4 digits of the phone (or local-part of an email) so UI never
// shows the raw identifier.
async function lookupDisplayName(
  ctx: QueryCtx,
  phoneNumber: string,
): Promise<string> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_phone", (q) => q.eq("phoneNumber", phoneNumber))
    .first();
  if (user?.displayName) return user.displayName;
  if (phoneNumber.includes("@")) {
    const local = phoneNumber.split("@")[0] ?? phoneNumber;
    return local;
  }
  const digits = phoneNumber.replace(/\D/g, "");
  return digits.length >= 4 ? `Player ${digits.slice(-4)}` : phoneNumber;
}

// Returns yesterday's check-in / miss counts for every member of an island.
// Used by the morning reminder so K2 can reference who completed vs missed
// when writing each user's personal text.
export const getYesterdayIslandStats = query({
  args: { islandId: v.id("islands"), date: v.string() },
  handler: async (ctx, { islandId, date }) => {
    const startOfDay = new Date(date + "T00:00:00Z").getTime();
    const endOfDay = startOfDay + 86400000;
    const events = await ctx.db
      .query("events")
      .withIndex("by_island", (q) => q.eq("islandId", islandId))
      .filter((q) =>
        q.and(
          q.gte(q.field("timestamp"), startOfDay),
          q.lt(q.field("timestamp"), endOfDay),
        ),
      )
      .collect();

    const completedByPhone = new Map<string, number>();
    const missedByPhone = new Map<string, number>();
    for (const e of events) {
      const phone = (e.payload as { phoneNumber?: string } | null)?.phoneNumber;
      if (!phone) continue;
      if (e.type === "check_in") {
        completedByPhone.set(phone, (completedByPhone.get(phone) ?? 0) + 1);
      } else if (e.type === "miss") {
        missedByPhone.set(phone, (missedByPhone.get(phone) ?? 0) + 1);
      }
    }

    const phones = new Set([
      ...completedByPhone.keys(),
      ...missedByPhone.keys(),
    ]);
    const rows = await Promise.all(
      Array.from(phones).map(async (phone) => ({
        phone,
        displayName: await lookupDisplayName(ctx, phone),
        completed: completedByPhone.get(phone) ?? 0,
        missed: missedByPhone.get(phone) ?? 0,
      })),
    );
    rows.sort((a, b) => b.completed - a.completed);

    const completed = rows.filter((r) => r.completed > 0);
    const missed = rows.filter((r) => r.missed > 0);
    return { date, completed, missed };
  },
});

// Same shape as getIslandsForWeeklySummary but only returns islands that
// have actually crossed a new week boundary since their last summary.
export const islandsReadyForWeeklySummary = query({
  args: {},
  handler: async (ctx) => {
    const islands = await ctx.db.query("islands").collect();
    const results: {
      island: Doc<"islands">;
      phones: string[];
      events: Doc<"events">[];
    }[] = [];

    for (const island of islands) {
      const dayCount = island.dayCount ?? 0;
      if (dayCount < 7 || dayCount % 7 !== 0) continue;
      if ((island.lastWeeklySummaryDayCount ?? 0) >= dayCount) continue;

      const members = await ctx.db
        .query("islandMembers")
        .withIndex("by_island", (q) => q.eq("islandId", island._id))
        .collect();
      const phones = members.map((m) => m.phoneNumber);
      if (phones.length === 0) continue;

      const since = Date.now() - 7 * 86400000;
      const events = await ctx.db
        .query("events")
        .withIndex("by_island", (q) => q.eq("islandId", island._id))
        .filter((q) => q.gte(q.field("timestamp"), since))
        .collect();

      results.push({ island, phones, events });
    }

    return results;
  },
});

// Full digest used by RecapOverlay on the client. Combines island progress
// (dayCount → weekNumber / dayOfWeek), aggregated 7-day stats, per-user
// contribution rows, and the latest K2 narrative (if one has been recorded).
export const getIslandWeeklyDigest = query({
  args: { islandId: v.id("islands") },
  handler: async (ctx, { islandId }) => {
    const island = await ctx.db.get(islandId);
    if (!island) return null;

    const dayCount = island.dayCount ?? 1;
    const weekNumber = Math.max(1, Math.ceil(dayCount / 7));
    const dayOfWeek = ((dayCount - 1) % 7) + 1;           // 1..7
    const daysUntilNextReport = Math.max(0, 7 - dayOfWeek);
    const weekStartDay = (weekNumber - 1) * 7 + 1;        // first day of current week

    // Pull events from the start of this week (not a hard 7-day window) so
    // week 1 day 3 doesn't bleed into "last week".
    const msPerDay = 86400000;
    const windowStart = Date.now() - Math.min(7, dayOfWeek) * msPerDay;
    const events = await ctx.db
      .query("events")
      .withIndex("by_island", (q) => q.eq("islandId", islandId))
      .filter((q) => q.gte(q.field("timestamp"), windowStart))
      .collect();

    const checkIns = events.filter((e) => e.type === "check_in");
    const misses = events.filter((e) => e.type === "miss");
    const buildsComplete = events.filter((e) => e.type === "build_complete");
    const totalActions = checkIns.length + misses.length;
    const completionPct = totalActions > 0
      ? Math.round((checkIns.length / totalActions) * 100)
      : 0;

    const checkInByPhone = new Map<string, number>();
    const missByPhone = new Map<string, number>();
    for (const e of checkIns) {
      const p = (e.payload as { phoneNumber?: string } | null)?.phoneNumber;
      if (p) checkInByPhone.set(p, (checkInByPhone.get(p) ?? 0) + 1);
    }
    for (const e of misses) {
      const p = (e.payload as { phoneNumber?: string } | null)?.phoneNumber;
      if (p) missByPhone.set(p, (missByPhone.get(p) ?? 0) + 1);
    }

    const members = await ctx.db
      .query("islandMembers")
      .withIndex("by_island", (q) => q.eq("islandId", islandId))
      .collect();
    const perUser = await Promise.all(
      members.map(async (m) => {
        const completed = checkInByPhone.get(m.phoneNumber) ?? 0;
        const missed = missByPhone.get(m.phoneNumber) ?? 0;
        const total = completed + missed;
        return {
          phone: m.phoneNumber,
          displayName: await lookupDisplayName(ctx, m.phoneNumber),
          completed,
          missed,
          pct: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
      }),
    );
    perUser.sort((a, b) => b.completed - a.completed);

    // Latest weekly narrative (the K2-generated text sent to iMessage)
    const weeklyMessages = await ctx.db
      .query("aiMessages")
      .filter((q) => q.eq(q.field("channel"), "imessage_group"))
      .collect();
    const weeklyForThisIsland = weeklyMessages.filter((m) => {
      const ctxObj = (m.context as { islandId?: string } | null | undefined);
      return ctxObj?.islandId === islandId;
    });
    weeklyForThisIsland.sort((a, b) => b.sentAt - a.sentAt);
    const latest = weeklyForThisIsland[0] ?? null;

    return {
      islandName: island.name,
      dayCount,
      weekNumber,
      dayOfWeek,
      daysUntilNextReport,
      weekStartDay,
      completionPct,
      checkInCount: checkIns.length,
      missCount: misses.length,
      buildingsCompleted: buildsComplete.length,
      perUser,
      lastWeeklySummaryDayCount: island.lastWeeklySummaryDayCount ?? 0,
      latestNarrative: latest
        ? {
            content: latest.content,
            sentAt: latest.sentAt,
          }
        : null,
    };
  },
});
