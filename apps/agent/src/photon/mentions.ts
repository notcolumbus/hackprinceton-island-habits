export const AGENT_NAME = "isla";

export function isTagged(text: string): boolean {
  const normalized = (text ?? "").normalize("NFKC").toLowerCase();
  if (!normalized) return false;
  // Tokenize by non-alphanumeric separators so punctuation/emoji/quotes
  // around the mention do not break detection.
  const tokens = normalized.split(/[^a-z0-9@]+/g).filter(Boolean);
  return tokens.some((token) => token === AGENT_NAME || token === `@${AGENT_NAME}`);
}

export function isStartCommand(text: string): boolean {
  return text.trim().toLowerCase() === "/start";
}
