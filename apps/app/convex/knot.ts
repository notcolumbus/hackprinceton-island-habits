import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { normalizeParticipantId } from "./lib/identity";

function uniqueStrings(values: string[]): string[] {
  const out = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed) out.add(trimmed);
  }
  return [...out];
}

async function lookupUserRowByParticipant(ctx: any, participantId: string) {
  if (participantId.includes("@")) {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", participantId.toLowerCase()))
      .first();
  }
  return await ctx.db
    .query("users")
    .withIndex("by_phone", (q: any) => q.eq("phoneNumber", participantId))
    .first();
}

async function candidateExternalIdsForParticipant(ctx: any, participantId: string): Promise<string[]> {
  const candidates: string[] = [];

  const binding = await ctx.db
    .query("knotUserBindings")
    .withIndex("by_participant", (q: any) => q.eq("participantId", participantId))
    .first();
  if (binding?.externalUserId) candidates.push(binding.externalUserId);

  const userRow = await lookupUserRowByParticipant(ctx, participantId);
  if (userRow?.clerkUserId) candidates.push(userRow.clerkUserId);
  if (userRow?.email) candidates.push(userRow.email);
  if (userRow?.phoneNumber) candidates.push(userRow.phoneNumber);

  // Last fallback: some deployments use phone/email as external_user_id.
  candidates.push(participantId);
  return uniqueStrings(candidates);
}

export const bindExternalUser = mutation({
  args: {
    participantId: v.string(),
    externalUserId: v.string(),
  },
  async handler(ctx, args) {
    const participantId = normalizeParticipantId(args.participantId);
    const externalUserId = args.externalUserId.trim();
    if (!externalUserId) throw new Error("externalUserId is required");

    const now = Date.now();
    const existing = await ctx.db
      .query("knotUserBindings")
      .withIndex("by_participant", (q) => q.eq("participantId", participantId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { externalUserId, updatedAt: now });
      return await ctx.db.get(existing._id);
    }

    const id = await ctx.db.insert("knotUserBindings", {
      participantId,
      externalUserId,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(id);
  },
});

export const getExternalUserCandidatesForIsland = query({
  args: { islandId: v.id("islands") },
  async handler(ctx, args) {
    const members = await ctx.db
      .query("islandMembers")
      .withIndex("by_island", (q) => q.eq("islandId", args.islandId))
      .collect();

    const out: { participantId: string; externalUserIds: string[] }[] = [];
    for (const member of members) {
      const participantId = member.phoneNumber;
      const externalUserIds = await candidateExternalIdsForParticipant(ctx, participantId);
      out.push({ participantId, externalUserIds });
    }
    return out;
  },
});

export const getCursor = query({
  args: {
    externalUserId: v.string(),
    merchantId: v.number(),
  },
  async handler(ctx, args) {
    const row = await ctx.db
      .query("knotSyncCursors")
      .withIndex("by_external_merchant", (q) =>
        q.eq("externalUserId", args.externalUserId).eq("merchantId", args.merchantId)
      )
      .first();
    return row?.cursor ?? null;
  },
});

export const upsertCursor = mutation({
  args: {
    externalUserId: v.string(),
    merchantId: v.number(),
    cursor: v.string(),
  },
  async handler(ctx, args) {
    const now = Date.now();
    const existing = await ctx.db
      .query("knotSyncCursors")
      .withIndex("by_external_merchant", (q) =>
        q.eq("externalUserId", args.externalUserId).eq("merchantId", args.merchantId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { cursor: args.cursor, updatedAt: now });
      return existing._id;
    }

    return await ctx.db.insert("knotSyncCursors", {
      externalUserId: args.externalUserId,
      merchantId: args.merchantId,
      cursor: args.cursor,
      updatedAt: now,
    });
  },
});

export const upsertTransactionBatch = mutation({
  args: {
    externalUserId: v.string(),
    participantId: v.optional(v.string()),
    merchantId: v.number(),
    merchantName: v.optional(v.string()),
    transactions: v.array(
      v.object({
        id: v.string(),
        datetime: v.optional(v.string()),
        orderStatus: v.optional(v.string()),
        total: v.optional(v.string()),
        currency: v.optional(v.string()),
        productSummary: v.optional(v.string()),
        raw: v.optional(v.any()),
      })
    ),
  },
  async handler(ctx, args) {
    const now = Date.now();
    const participantId = args.participantId
      ? normalizeParticipantId(args.participantId)
      : undefined;

    let inserted = 0;
    let updated = 0;

    for (const tx of args.transactions) {
      const txId = tx.id.trim();
      if (!txId) continue;

      const existing = await ctx.db
        .query("knotTransactions")
        .withIndex("by_external_transaction", (q) =>
          q.eq("externalUserId", args.externalUserId).eq("transactionId", txId)
        )
        .first();

      const patch = {
        participantId,
        merchantId: args.merchantId,
        merchantName: args.merchantName,
        datetime: tx.datetime,
        orderStatus: tx.orderStatus,
        total: tx.total,
        currency: tx.currency,
        productSummary: tx.productSummary,
        raw: tx.raw,
        syncedAt: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, patch);
        updated += 1;
      } else {
        await ctx.db.insert("knotTransactions", {
          externalUserId: args.externalUserId,
          transactionId: txId,
          ...patch,
        });
        inserted += 1;
      }
    }

    return { inserted, updated };
  },
});

export const getTransactionContextForParticipant = query({
  args: {
    participantId: v.string(),
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const participantId = normalizeParticipantId(args.participantId);
    const limit = Math.max(1, Math.min(10, args.limit ?? 5));
    const externalCandidates = await candidateExternalIdsForParticipant(ctx, participantId);

    let externalUserId: string | null = null;
    let rows: any[] = [];

    for (const candidate of externalCandidates) {
      const candidateRows = await ctx.db
        .query("knotTransactions")
        .withIndex("by_external_synced", (q) => q.eq("externalUserId", candidate))
        .order("desc")
        .take(limit * 5);
      if (candidateRows.length > 0) {
        externalUserId = candidate;
        rows = candidateRows;
        break;
      }
    }

    if (!externalUserId || rows.length === 0) {
      return null;
    }

    const seen = new Set<string>();
    const latest = [];
    for (const row of rows) {
      if (seen.has(row.transactionId)) continue;
      seen.add(row.transactionId);
      latest.push(row);
      if (latest.length >= limit) break;
    }

    const merchantTotals = new Map<string, number>();
    for (const tx of latest) {
      const key = tx.merchantName || `Merchant ${tx.merchantId}`;
      const amount = Number.parseFloat(tx.total ?? "");
      if (Number.isFinite(amount)) {
        merchantTotals.set(key, (merchantTotals.get(key) ?? 0) + amount);
      }
    }

    const totalSpent = [...merchantTotals.values()].reduce((acc, value) => acc + value, 0);
    const spendByMerchant = [...merchantTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([merchant, amount]) => `${merchant}: $${amount.toFixed(2)}`);

    const lines = latest.map((tx) => {
      const merchant = tx.merchantName || `Merchant ${tx.merchantId}`;
      const total = tx.total ? `$${tx.total}` : "$?";
      const when = tx.datetime ? tx.datetime.slice(0, 10) : "unknown date";
      const product = tx.productSummary ? ` - ${tx.productSummary}` : "";
      return `${merchant} ${total} on ${when}${product}`;
    });

    return {
      externalUserId,
      lastSyncedAt: latest[0]?.syncedAt ?? null,
      totalSpent: Number.isFinite(totalSpent) ? totalSpent : null,
      spendByMerchant,
      transactions: latest.map((tx) => ({
        transactionId: tx.transactionId,
        merchantId: tx.merchantId,
        merchantName: tx.merchantName ?? null,
        datetime: tx.datetime ?? null,
        total: tx.total ?? null,
        currency: tx.currency ?? null,
        orderStatus: tx.orderStatus ?? null,
        productSummary: tx.productSummary ?? null,
      })),
      summary: lines.join("\n"),
    };
  },
});
