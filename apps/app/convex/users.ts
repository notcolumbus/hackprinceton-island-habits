import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Persist the Clerk-side display name for the signed-in user so other clients
// (notably the /agents directory) can resolve a human name from just a phone
// number or email. This is the single source of truth that lets us show other
// island participants' names — `useUser()` only ever returns the current user.
export const upsertProfile = mutation({
  args: {
    phoneNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
    displayName: v.string(),
  },
  async handler(ctx, args) {
    const phone = args.phoneNumber?.trim() || undefined;
    const email = args.email?.trim().toLowerCase() || undefined;
    const clerkUserId = args.clerkUserId?.trim() || undefined;
    const name = args.displayName.trim();
    if (!name) return null;
    if (!phone && !email && !clerkUserId) return null;

    let existing = null as null | Awaited<ReturnType<typeof ctx.db.get>>;
    if (phone) {
      existing = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", phone))
        .first();
    }
    if (!existing && email) {
      existing = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
    }
    if (!existing && clerkUserId) {
      existing = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
        .first();
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        phoneNumber: phone ?? (existing as any).phoneNumber,
        email: email ?? (existing as any).email,
        clerkUserId: clerkUserId ?? (existing as any).clerkUserId,
        displayName: name,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      phoneNumber: phone,
      email,
      clerkUserId,
      displayName: name,
      updatedAt: Date.now(),
    });
  },
});

export const getByPhones = query({
  args: { phoneNumbers: v.array(v.string()) },
  async handler(ctx, args) {
    const out: { phoneNumber: string; displayName: string }[] = [];
    for (const phone of args.phoneNumbers) {
      const row = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", phone))
        .first();
      if (row) {
        out.push({ phoneNumber: phone, displayName: row.displayName });
      }
    }
    return out;
  },
});
