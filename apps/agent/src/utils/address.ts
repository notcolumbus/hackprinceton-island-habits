import { BOT_PHONE } from "../router.js";

export function toE164Like(value: unknown): string | null {
  if (!value || typeof value !== "string") return null;
  const digits = value.trim().replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return `+${digits}`;
}

export function toEmailLike(value: unknown): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  // Accept any valid-looking email so iMessage Apple IDs from other domains
  // aren't dropped in group chats.
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

export function normalizeParticipantId(value: unknown): string | null {
  const phone = toE164Like(value);
  if (phone && phone.replace(/\D/g, "") !== BOT_PHONE) return phone;
  const email = toEmailLike(value);
  if (email) return email.toLowerCase();
  return null;
}

export function senderAddress(message: any): string | null {
  const s = message?.sender ?? {};
  const candidates = [s.phoneNumber, s.address, s.email, s.id];
  for (const c of candidates) {
    const participant = normalizeParticipantId(c);
    if (participant) return participant;
  }
  return null;
}

export function collectParticipants(space: any, message: any): string[] {
  const raw: unknown[] = [];
  for (const arr of [space?.participants, space?.members, space?.users]) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) raw.push(item?.phoneNumber, item?.address, item?.email, item?.id, item);
  }
  raw.push(message?.sender?.phoneNumber, message?.sender?.address, message?.sender?.email, message?.sender?.id);
  const out = new Set<string>();
  for (const v of raw) {
    const participant = normalizeParticipantId(v);
    if (participant) out.add(participant);
  }
  return [...out];
}
