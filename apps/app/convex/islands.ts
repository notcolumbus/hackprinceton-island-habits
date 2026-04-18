import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { defaultActivity, defaultMovementState } from "./lib/agentState";
import { normalizeParticipantId, normalizeParticipantList } from "./lib/identity";

// Generate a random alphanumeric code (4-6 chars)
function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function ensureAgentForMember(ctx: any, islandId: any, participantId: string) {
  const existingAgents = await ctx.db
    .query("agents")
    .withIndex("by_island_phone", (q: any) =>
      q.eq("islandId", islandId).eq("phoneNumber", participantId)
    )
    .collect();

  if (existingAgents.length > 0) {
    const [keep, ...dupes] = [...existingAgents].sort((a, b) => a.createdAt - b.createdAt);
    for (const duplicate of dupes) {
      await ctx.db.delete(duplicate._id);
    }
    await ctx.db.patch(keep._id, {
      currentActivity: keep.currentActivity ?? defaultActivity(),
      movementState: keep.movementState ?? defaultMovementState(`${islandId}:${participantId}`),
    });
    return;
  }

  await ctx.db.insert("agents", {
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

// Create a new island with a game code
export const createIsland = mutation({
  args: {
    phoneNumbers: v.array(v.string()), // Can contain phone numbers or emails
  },
  async handler(ctx, args) {
    const participants = normalizeParticipantList(args.phoneNumbers);
    if (participants.length === 0) {
      throw new Error("At least one participant is required");
    }

    let code = generateCode();
    // Ensure code uniqueness
    let existing = await ctx.db
      .query("islands")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    while (existing) {
      code = generateCode();
      existing = await ctx.db
        .query("islands")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
    }
    const islandId = await ctx.db.insert("islands", {
      code,
      name: `Island ${code}`,
      status: "onboarding",
      tier: 1,
      islandLevel: 0,
      xp: 0,
      currency: 300,
      streakDays: 0,
      dayCount: 1,
      era: 0,
      difficulty: "normal",
      gridSize: {
        width: 10,
        height: 10,
      },
      phoneNumbers: participants,
      createdAt: Date.now(),
    });

    // Add all participants (phone numbers or emails) as island members
    for (const participant of participants) {
      await ctx.db.insert("islandMembers", {
        islandId,
        phoneNumber: participant, // Can be either normalized phone or email
        joinedAt: Date.now(),
        role: participant === participants[0] ? "creator" : "member",
      });
      await ensureAgentForMember(ctx, islandId, participant);
    }

    return { islandId, code };
  },
});

// Get island by code
export const getIslandByCode = query({
  args: {
    code: v.string(),
  },
  async handler(ctx, args) {
    const island = await ctx.db
      .query("islands")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();

    return island;
  },
});

// Get island details (with members and agents)
export const getIslandDetails = query({
  args: {
    islandId: v.id("islands"),
  },
  async handler(ctx, args) {
    const island = await ctx.db.get(args.islandId);
    if (!island) {
      throw new Error("Island not found");
    }

    const members = await ctx.db
      .query("islandMembers")
      .withIndex("by_island", (q) => q.eq("islandId", args.islandId))
      .collect();

    const agents = await ctx.db
      .query("agents")
      .withIndex("by_island", (q) => q.eq("islandId", args.islandId))
      .collect();

    const membersWithNames = await Promise.all(
      members.map(async (m) => {
        const id = m.phoneNumber;
        const isEmail = id.includes("@");
        const userRow = isEmail
          ? await ctx.db
              .query("users")
              .withIndex("by_email", (q) => q.eq("email", id.toLowerCase()))
              .first()
          : await ctx.db
              .query("users")
              .withIndex("by_phone", (q) => q.eq("phoneNumber", id))
              .first();
        return { ...m, displayName: userRow?.displayName ?? null };
      })
    );

    return {
      island,
      members: membersWithNames.sort((a, b) => a.phoneNumber.localeCompare(b.phoneNumber)),
      agents: agents.sort((a, b) => a.phoneNumber.localeCompare(b.phoneNumber)),
      serverNowMs: Date.now(),
    };
  },
});

// Join an island (add current phone as island member)
export const joinIsland = mutation({
  args: {
    islandId: v.id("islands"),
    phoneNumber: v.string(),
  },
  async handler(ctx, args) {
    const participantId = normalizeParticipantId(args.phoneNumber);

    // Check if already a member
    const existing = await ctx.db
      .query("islandMembers")
      .withIndex("by_island_phone", (q) =>
        q.eq("islandId", args.islandId).eq("phoneNumber", participantId)
      )
      .first();

    if (existing) {
      return existing;
    }

    // Add as member
    const memberId = await ctx.db.insert("islandMembers", {
      islandId: args.islandId,
      phoneNumber: participantId,
      joinedAt: Date.now(),
      role: "member",
    });

    // Keep denormalized phoneNumbers array in sync
    const island = await ctx.db.get(args.islandId);
    if (island && !island.phoneNumbers.includes(participantId)) {
      await ctx.db.patch(args.islandId, {
        phoneNumbers: [...island.phoneNumbers, participantId],
      });
    }

    await ensureAgentForMember(ctx, args.islandId, participantId);

    return await ctx.db.get(memberId);
  },
});

// Mark island as active (all players have completed onboarding)
export const activateIsland = mutation({
  args: {
    islandId: v.id("islands"),
  },
  async handler(ctx, args) {
    const island = await ctx.db.get(args.islandId);
    if (!island) {
      throw new Error("Island not found");
    }

    await ctx.db.patch(args.islandId, { status: "active" });
    return true;
  },
});

// Graduate the island to the next era. Buildings from the previous era keep
// their `placedAtEra` tag so they stay in the table (for visiting history)
// but are filtered out of the active-era view on the client.
export const graduateEra = mutation({
  args: { islandId: v.id("islands") },
  async handler(ctx, { islandId }) {
    const island = await ctx.db.get(islandId);
    if (!island) throw new Error("Island not found");
    const nextEra = (island.era ?? 0) + 1;
    await ctx.db.patch(islandId, { era: nextEra });
    return { era: nextEra };
  },
});

// Get all islands for a phone number (or email)
export const getIslandsByPhone = query({
  args: {
    phoneNumber: v.string(),
  },
  async handler(ctx, args) {
    const participantId = normalizeParticipantId(args.phoneNumber);
    const members = await ctx.db
      .query("islandMembers")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", participantId))
      .collect();

    const islands = [];
    for (const member of members) {
      const island = await ctx.db.get(member.islandId);
      if (island) {
        islands.push(island);
      }
    }

    return islands;
  },
});


export const gatherResource = mutation({
  args: {
    islandId: v.id("islands"),
    logs: v.optional(v.number()),
    rocks: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const island = await ctx.db.get(args.islandId);
    if (!island) return;
    await ctx.db.patch(args.islandId, {
      logs: (island.logs ?? 0) + (args.logs ?? 0),
      rocks: (island.rocks ?? 0) + (args.rocks ?? 0),
    });
  },
});
