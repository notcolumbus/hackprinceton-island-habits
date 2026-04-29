import type { QueryCtx, MutationCtx } from "../_generated/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function normalizeParticipantId(raw: string): string {
  const value = raw.trim();
  if (!value) throw new Error("Participant identifier is required");

  const digits = value.replace(/\D/g, "");
  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }

  const email = value.toLowerCase();
  if (EMAIL_RE.test(email)) {
    return email;
  }

  throw new Error(`Invalid participant identifier: ${raw}`);
}

export function tryNormalizeParticipantId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    return normalizeParticipantId(raw);
  } catch {
    return null;
  }
}

export function normalizeParticipantList(values: string[]): string[] {
  const out = new Set<string>();
  for (const value of values) {
    const normalized = normalizeParticipantId(value);
    out.add(normalized);
  }
  return [...out];
}

export async function requireParticipantId(ctx: QueryCtx | MutationCtx, providedPhoneNumber: string): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const identityPhone = identity.phoneNumber ? normalizeParticipantId(identity.phoneNumber) : null;
  const identityEmail = identity.email ? normalizeParticipantId(identity.email) : null;
  const requested = normalizeParticipantId(providedPhoneNumber);

  if (requested !== identityPhone && requested !== identityEmail) {
    throw new Error("Unauthorized: identity mismatch");
  }

  return requested;
}
