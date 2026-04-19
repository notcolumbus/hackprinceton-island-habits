import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { defaultActivity, defaultMovementState } from "./lib/agentState";
import { normalizeParticipantList } from "./lib/identity";

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

export const getBySpace = query({
  args: { spaceId: v.string() },
  handler: async (ctx, { spaceId }) => {
    const room = await ctx.db
      .query("groupRooms")
      .withIndex("by_space", (q) => q.eq("spaceId", spaceId))
      .first();
    if (!room) return null;
    const island = await ctx.db.get(room.islandId);
    if (!island) return null;
    return { room, island };
  },
});

// Reverse lookup used by proactive senders: given an islandId, find the
// iMessage spaceId + the exact participant tuple captured at /start time.
// Prefer this over islandMembers for addressing — islandMembers can accrete
// extra phones later (web-only joins) that would change which iMessage
// thread `im.space(...phones)` resolves to.
export const getByIsland = query({
  args: { islandId: v.id("islands") },
  handler: async (ctx, { islandId }) => {
    const room = await ctx.db
      .query("groupRooms")
      .withIndex("by_island", (q) => q.eq("islandId", islandId))
      .first();
    return room ?? null;
  },
});

export const bindSpaceToIsland = mutation({
  args: {
    spaceId: v.string(),
    islandId: v.id("islands"),
    code: v.string(),
    participants: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const participants = normalizeParticipantList(args.participants);
    const existing = await ctx.db
      .query("groupRooms")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        islandId: args.islandId,
        code: args.code,
        participants,
        updatedAt: now,
        lastSyncedAt: now,
      });
      return await ctx.db.get(existing._id);
    }
    const id = await ctx.db.insert("groupRooms", {
      spaceId: args.spaceId,
      islandId: args.islandId,
      code: args.code,
      participants,
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: now,
    });
    return await ctx.db.get(id);
  },
});

export const syncParticipants = mutation({
  args: {
    spaceId: v.string(),
    participants: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("groupRooms")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .first();
    if (!room) return null;

    const participants = normalizeParticipantList(args.participants);
    const island = await ctx.db.get(room.islandId);
    if (!island) return null;

    for (const participant of participants) {
      const member = await ctx.db
        .query("islandMembers")
        .withIndex("by_island_phone", (q) =>
          q.eq("islandId", room.islandId).eq("phoneNumber", participant)
        )
        .first();
      if (!member) {
        await ctx.db.insert("islandMembers", {
          islandId: room.islandId,
          phoneNumber: participant,
          joinedAt: Date.now(),
          role: "member",
        });
      }
      await ensureAgentForMember(ctx, room.islandId, participant);
    }

    const islandParticipants = new Set(island.phoneNumbers);
    for (const participant of participants) {
      islandParticipants.add(participant);
    }
    await ctx.db.patch(room.islandId, {
      phoneNumbers: [...islandParticipants],
    });

    await ctx.db.patch(room._id, {
      participants,
      updatedAt: Date.now(),
      lastSyncedAt: Date.now(),
    });

    return {
      islandId: room.islandId,
      participantCount: participants.length,
    };
  },
});
