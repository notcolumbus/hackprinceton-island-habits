export type Command =
  | { kind: "start" }
  | { kind: "help" }
  | { kind: "goals" }
  | { kind: "add"; text: string }
  | { kind: "drop"; index: number }
  | { kind: "edit"; index: number; text: string }
  | { kind: "done"; index: number }
  | { kind: "undo"; index: number }
  | { kind: "status" }
  | { kind: "none" };

export function parseCommand(raw: string): Command {
  const body = raw.trim();
  const lower = body.toLowerCase();

  // Commands must be explicit slash-commands.
  if (!lower.startsWith("/")) return { kind: "none" };

  if (lower === "/start") return { kind: "start" };
  if (lower === "/help") return { kind: "help" };
  if (lower === "/goals") return { kind: "goals" };
  if (lower === "/status") return { kind: "status" };

  let m = body.match(/^\/add\s+(?:goal[:\s]+)?(.+)$/i);
  if (m) return { kind: "add", text: m[1].trim() };

  m = body.match(/^\/drop\s+(\d+)\s*$/i);
  if (m) return { kind: "drop", index: parseInt(m[1], 10) };

  m = body.match(/^\/edit\s+(\d+)\s+(.+)$/i);
  if (m) return { kind: "edit", index: parseInt(m[1], 10), text: m[2].trim() };

  m = body.match(/^\/done\s+(\d+)\s*$/i);
  if (m) return { kind: "done", index: parseInt(m[1], 10) };

  m = body.match(/^\/undo\s+(\d+)\s*$/i);
  if (m) return { kind: "undo", index: parseInt(m[1], 10) };

  return { kind: "none" };
}

export const HELP_TEXT =
  "✨ Island Habits — here's what I can do ✨\n" +
  "🏝️  /start — spin up a fresh island for your group\n" +
  "📋  /goals — list your active goals (numbered)\n" +
  "🌱  /add <goal> — plant a new goal on your island\n" +
  "🍂  /drop <n> — let the Nth goal go\n" +
  "✏️  /edit <n> <new text> — reshape the Nth goal\n" +
  "✅  /done <n> — mark the Nth goal done for today (+1 XP, +10 💰)\n" +
  "↩️  /undo <n> — undo today's check-in for the Nth goal\n" +
  "📊  /status — today's progress & motivation\n" +
  "❓  /help — show this list";
