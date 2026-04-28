import { v } from "convex/values";
import { mutation } from "./_generated/server";

const RESET_TABLES = [
  "checkIns",
  "goals",
  "buildings",
  "events",
  "aiMessages",
  "gossipConversations",
  "gossipTurns",
  "groupRooms",
  "agents",
  "islandMembers",
  "islands",
  "knotTransactions",
  "knotSyncCursors",
  "knotUserBindings",
  "users",
] as const;

function assertConfirmToken(confirmToken: string): void {
  if (confirmToken !== "RESET_ALL_GAMES") {
    throw new Error("Invalid confirmToken. Refusing to reset database.");
  }
}

function assertResetTable(tableName: string): void {
  if (!RESET_TABLES.includes(tableName as (typeof RESET_TABLES)[number])) {
    throw new Error(`Invalid tableName: ${tableName}`);
  }
}

export const resetTableBatch = mutation({
  args: {
    confirmToken: v.string(),
    tableName: v.string(),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertConfirmToken(args.confirmToken);
    assertResetTable(args.tableName);

    const batchSize = Math.max(1, Math.min(50, Math.floor(args.batchSize ?? 10)));
    const docs = await ctx.db.query(args.tableName as any).take(batchSize);

    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }

    return {
      ok: true,
      tableName: args.tableName,
      deleted: docs.length,
      done: docs.length < batchSize,
    };
  },
});
