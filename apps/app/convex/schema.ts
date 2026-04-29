import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  islands: defineTable({
    code: v.string(),
    name: v.string(),
    status: v.union(v.literal("onboarding"), v.literal("active"), v.literal("ascended")),
    tier: v.number(),
    islandLevel: v.number(),
    xp: v.number(),
    currency: v.number(),
    // Island-wide resource stockpiles (logs / rocks) consumed when placing
    // buildings. Present on newer documents; older rows leave these undefined.
    logs: v.optional(v.number()),
    rocks: v.optional(v.number()),
    streakDays: v.optional(v.number()),
    dayCount: v.optional(v.number()),
    lastCheckInDate: v.optional(v.string()),
    // Last UTC date for which building progress was advanced from the
    // daily check-in pathway. Prevents same-day double-advance races.
    lastBuildAdvanceDate: v.optional(v.string()),
    lastBuildTickAt: v.optional(v.number()),
    // Graduation era (0 = Pine Hollow, 1 = Amber Ridge, …). Undefined/0 for
    // islands created before this field existed — treated as era 0.
    era: v.optional(v.number()),
    // `island.dayCount` value at the time the most recent weekly summary was
    // sent. Weekly cron only fires for an island when dayCount crosses a new
    // multiple of 7 past this value, so each week-boundary only sends once.
    lastWeeklySummaryDayCount: v.optional(v.number()),
    // One entry per past era the player has already graduated off. Populated
    // by `graduateEra`. Drives the Visit UI so each retired island shows its
    // real "Lv.N when left" and the actual graduation date.
    eraSnapshots: v.optional(v.array(v.object({
      era: v.number(),
      level: v.number(),
      currency: v.number(),
      graduatedAt: v.number(),
    }))),
    difficulty: v.union(v.literal("easy"), v.literal("normal"), v.literal("hard")),
    gridSize: v.object({
      width: v.number(),
      height: v.number(),
    }),
    phoneNumbers: v.array(v.string()),
    createdAt: v.number(),
    ascendedAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_status", ["status"]),

  islandMembers: defineTable({
    islandId: v.id("islands"),
    phoneNumber: v.string(),
    joinedAt: v.number(),
    role: v.union(v.literal("creator"), v.literal("member")),
  })
    .index("by_island", ["islandId"])
    .index("by_phone", ["phoneNumber"])
    .index("by_island_phone", ["islandId", "phoneNumber"])
    .index("by_island_joined", ["islandId", "joinedAt"]),

  agents: defineTable({
    islandId: v.id("islands"),
    phoneNumber: v.string(),
    personalityProfile: v.string(),
    motivation: v.number(),
    reminderVariants: v.array(v.string()),
    // Human-readable activity state shown across clients.
    currentActivity: v.optional(v.string()),
    // Shared movement state primitives so clients can animate consistently.
    movementState: v.optional(v.object({
      mode: v.union(
        v.literal("idle"),
        v.literal("wander"),
        v.literal("approach"),
        v.literal("chat"),
        v.literal("work"),
      ),
      seed: v.number(),
      phase: v.number(),
      updatedAt: v.number(),
    })),
    createdAt: v.number(),
  })
    .index("by_island", ["islandId"])
    .index("by_island_phone", ["islandId", "phoneNumber"]),

  goals: defineTable({
    islandId: v.id("islands"),
    phoneNumber: v.string(),
    text: v.string(),
    status: v.union(v.literal("active"), v.literal("archived")),
    createdAt: v.number(),
    archivedAt: v.optional(v.number()),
    parentGoalId: v.optional(v.id("goals")),
  })
    .index("by_island", ["islandId"])
    .index("by_island_phone", ["islandId", "phoneNumber"])
    .index("by_island_phone_status", ["islandId", "phoneNumber", "status"])
    .index("by_status", ["status"]),

  checkIns: defineTable({
    goalId: v.id("goals"),
    phoneNumber: v.string(),
    islandId: v.id("islands"),
    date: v.string(),
    completed: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_goal", ["goalId"])
    .index("by_island_date", ["islandId", "date"])
    .index("by_goal_phone_date", ["goalId", "phoneNumber", "date"]),

  buildings: defineTable({
    islandId: v.id("islands"),
    type: v.string(),
    gridX: v.number(),
    gridY: v.number(),
    footprint: v.object({
      width: v.number(),
      height: v.number(),
    }),
    state: v.union(v.literal("constructing"), v.literal("complete"), v.literal("damaged")),
    buildProgress: v.number(),
    buildTimeDays: v.number(),
    costPaid: v.number(),
    // Resource cost breakdown (if a building charges logs/rocks on top of
    // currency). Present on newer documents; older rows leave these undefined
    // and the schema tolerates both.
    logCost: v.optional(v.number()),
    rockCost: v.optional(v.number()),
    placedBy: v.string(),
    placedAt: v.number(),
    completedAt: v.optional(v.number()),
    // Graduation era at which this building was placed. Used to hide old-era
    // buildings once the player flies to the next island (they still live in
    // the table so visits can browse history). Undefined = legacy = era 0.
    placedAtEra: v.optional(v.number()),
  })
    .index("by_island", ["islandId"])
    .index("by_state", ["state"]),

  events: defineTable({
    islandId: v.id("islands"),
    type: v.union(
      v.literal("check_in"),
      v.literal("miss"),
      v.literal("build_placed"),
      v.literal("build_complete"),
      v.literal("damage"),
      v.literal("repair"),
      v.literal("agent_message"),
      v.literal("weekly_summary"),
      v.literal("ascension"),
      v.literal("goal_add"),
      v.literal("goal_edit"),
      v.literal("goal_delete")
    ),
    payload: v.any(),
    timestamp: v.number(),
  }).index("by_island", ["islandId"]),

  aiMessages: defineTable({
    agentId: v.id("agents"),
    channel: v.union(v.literal("imessage_personal"), v.literal("imessage_group")),
    content: v.string(),
    context: v.optional(v.any()),
    sentAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_sent", ["agentId", "sentAt"]),

  users: defineTable({
    phoneNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
    displayName: v.string(),
    updatedAt: v.number(),
  })
    .index("by_phone", ["phoneNumber"])
    .index("by_email", ["email"])
    .index("by_clerk_user_id", ["clerkUserId"]),

  // Mapping between an island participant identity (phone/email) and the
  // external user id used in Knot (currently Clerk user id).
  knotUserBindings: defineTable({
    participantId: v.string(),
    externalUserId: v.string(),
    updatedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_participant", ["participantId"])
    .index("by_external", ["externalUserId"]),

  // Last seen cursor per (external user, merchant) for cursor-based sync.
  knotSyncCursors: defineTable({
    externalUserId: v.string(),
    merchantId: v.number(),
    cursor: v.string(),
    updatedAt: v.number(),
  }).index("by_external_merchant", ["externalUserId", "merchantId"]),

  // Transaction snapshots synced from Knot for agent context.
  knotTransactions: defineTable({
    externalUserId: v.string(),
    participantId: v.optional(v.string()),
    merchantId: v.number(),
    merchantName: v.optional(v.string()),
    transactionId: v.string(),
    datetime: v.optional(v.string()),
    orderStatus: v.optional(v.string()),
    total: v.optional(v.string()),
    currency: v.optional(v.string()),
    productSummary: v.optional(v.string()),
    raw: v.optional(v.any()),
    syncedAt: v.number(),
  })
    .index("by_external_transaction", ["externalUserId", "transactionId"])
    .index("by_external_synced", ["externalUserId", "syncedAt"]),

  gossipConversations: defineTable({
    islandId: v.id("islands"),
    agentAPhone: v.string(),
    agentBPhone: v.string(),
    lines: v.array(v.object({ speaker: v.string(), text: v.string() })),
    timestamp: v.number(),
    reasoning: v.optional(v.string()),
  }).index("by_island", ["islandId"]),

  // Persistent mapping from iMessage group-space id to island.
  // This enforces one room code per group chat, independent of sender identity.
  groupRooms: defineTable({
    spaceId: v.string(),
    islandId: v.id("islands"),
    code: v.string(),
    participants: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastSyncedAt: v.optional(v.number()),
  })
    .index("by_space", ["spaceId"])
    .index("by_island", ["islandId"]),

  // Per-island gossip slot claims so only one client triggers a conversation
  // for a given time slot.
  gossipTurns: defineTable({
    islandId: v.id("islands"),
    slot: v.number(),
    agentAPhone: v.string(),
    agentBPhone: v.string(),
    claimedAt: v.number(),
  }).index("by_island_slot", ["islandId", "slot"]),
});
