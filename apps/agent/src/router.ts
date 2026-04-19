/**
 * router.ts
 *
 * Shared router module for the Island Habits Photon agent. Imports fine
 * from both `src/index.ts` (production entrypoint) and `scripts/*.ts`
 * (test scripts that layer extra commands on top).
 *
 * Exports: env config, address normalization, Convex helpers, goal lookup
 * by index, command parsing, help text, and one handler per command.
 */

import { text } from "spectrum-ts";
import { ConvexHttpClient } from "convex/browser";
import { hasOnboarded, markOnboarded } from "./state/seen-spaces.js";
import { appendMessage, getHistory } from "./state/chat-history.js";
import "dotenv/config";

// ── Env / config ──────────────────────────────────────────────────────

export const PROJECT_ID = process.env.PHOTON_PROJECT_ID ?? process.env.projid;
export const PROJECT_SECRET = process.env.PHOTON_SECRET ?? process.env.secret;
export const CONVEX_URL = (process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL ?? "").replace(/\/+$/, "");
export const APP_BASE_URL = (process.env.APP_BASE_URL ?? "http://localhost:5173").replace(/\/+$/, "");
export const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:5001").replace(/\/+$/, "");
export const BOT_PHONE = (process.env.BOT_PHONE ?? "+14155952874").replace(/\D/g, "");

export function assertEnv(): void {
  if (!PROJECT_ID || !PROJECT_SECRET) {
    console.error("❌ Missing PHOTON_PROJECT_ID/PHOTON_SECRET (or projid/secret) in apps/agent/.env");
    process.exit(1);
  }
  if (!CONVEX_URL) {
    console.error("❌ Missing CONVEX_URL in apps/agent/.env");
    process.exit(1);
  }
}

export const convex = new ConvexHttpClient(CONVEX_URL);

// ── Types ─────────────────────────────────────────────────────────────

export type Island = {
  _id: string; code: string; name: string; status: string;
  islandLevel: number; xp: number; currency: number;
};
export type Goal = {
  _id: string; text: string; islandId: string; phoneNumber: string;
  status: string; createdAt: number;
};
export type Agent = {
  _id: string; phoneNumber: string; motivation: number; personalityProfile: string;
};

// ── Address normalization ─────────────────────────────────────────────

export function toE164Like(value: unknown): string | null {
  if (!value || typeof value !== "string") return null;
  const digits = value.trim().replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return `+${digits}`;
}

export function toEmailLike(value: unknown): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (/^[^\s@]+@(icloud\.com|me\.com|apple\.com|mail\.com|gmail\.com)$/.test(trimmed)) {
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

// ── Convex helpers ────────────────────────────────────────────────────

export async function resolveSenderIsland(sender: string, spaceId?: string): Promise<Island | null> {
  if (spaceId) {
    const room = await convex.query("groupRooms:getBySpace" as any, { spaceId });
    if (room?.island) {
      return room.island as Island;
    }
  }
  const islands: Island[] = await convex.query("islands:getIslandsByPhone" as any, { phoneNumber: sender });
  if (!islands.length) return null;
  const active = islands.filter((i) => i.status === "active");
  const pool = active.length ? active : islands;
  return pool[0];
}

export async function fetchGoals(islandId: string, sender: string): Promise<Goal[]> {
  return await convex.query("goals:getGoals" as any, { islandId, phoneNumber: sender });
}

export type GoalLookup =
  | { ok: true; island: Island; goal: Goal; goals: Goal[] }
  | { ok: false; reason: "no-island" | "no-goals" | "out-of-range"; count?: number };

export async function lookupGoalByIndex(sender: string, index1: number, spaceId?: string): Promise<GoalLookup> {
  const island = await resolveSenderIsland(sender, spaceId);
  if (!island) return { ok: false, reason: "no-island" };
  const goals = await fetchGoals(island._id, sender);
  if (!goals.length) return { ok: false, reason: "no-goals" };
  const idx = index1 - 1;
  if (idx < 0 || idx >= goals.length) return { ok: false, reason: "out-of-range", count: goals.length };
  return { ok: true, island, goal: goals[idx], goals };
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Command parsing ───────────────────────────────────────────────────

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

  if (lower === "/start") return { kind: "start" };
  if (lower === "/help" || lower === "help") return { kind: "help" };
  if (lower === "/goals" || lower === "goals" || lower === "my goals") return { kind: "goals" };
  if (lower === "/status" || lower === "status") return { kind: "status" };

  let m = body.match(/^\/?add\s+(?:goal[:\s]+)?(.+)$/i);
  if (m) return { kind: "add", text: m[1].trim() };

  m = body.match(/^\/?drop\s+(\d+)\s*$/i);
  if (m) return { kind: "drop", index: parseInt(m[1], 10) };

  m = body.match(/^\/?edit\s+(\d+)\s+(.+)$/i);
  if (m) return { kind: "edit", index: parseInt(m[1], 10), text: m[2].trim() };

  m = body.match(/^\/?done\s+(\d+)\s*$/i);
  if (m) return { kind: "done", index: parseInt(m[1], 10) };

  m = body.match(/^\/?undo\s+(\d+)\s*$/i);
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
  "❓  /help — show this list\n\n" +
  "Tip: you can drop the leading slash (e.g. `done 1`).";


// ── Handlers ──────────────────────────────────────────────────────────

export async function handleStart(space: any, message: any): Promise<void> {
  try {
    const existingRoom = await convex.query("groupRooms:getBySpace" as any, { spaceId: space.id });
    if (existingRoom?.room && existingRoom?.island) {
      const participants = collectParticipants(space, message);
      if (participants.length) {
        await convex.mutation("groupRooms:syncParticipants" as any, {
          spaceId: space.id,
          participants,
        });
      }
      markOnboarded(space.id);
      await space.send(
        text(
          `Island already started for this group.\n\nRoom Code: ${existingRoom.room.code}\nJoin: ${APP_BASE_URL}/dashboard?code=${existingRoom.room.code}`
        )
      );
      return;
    }

    if (hasOnboarded(space.id)) {
      await space.send(text("The start process has already been initiated."));
      return;
    }
    const participants = collectParticipants(space, message);
    if (!participants.length) {
      await space.send(text("Couldn't detect group members. Start this in a group iMessage with phone numbers or iCloud emails."));
      return;
    }

    const result: any = await convex.mutation("islands:createIsland" as any, { phoneNumbers: participants });
    const code = result.code as string;
    await convex.mutation("groupRooms:bindSpaceToIsland" as any, {
      spaceId: space.id,
      islandId: result.islandId,
      code,
      participants,
    });
    markOnboarded(space.id);
    await space.send(text(`Island Habits started.\n\nRoom Code: ${code}\nJoin: ${APP_BASE_URL}/dashboard?code=${code}`));
    console.log(`[/start] code=${code} participants=${participants.join(",")}`);
  } catch (err: any) {
    console.error("[/start] failed:", err?.message ?? err);
    await space.send(text("Failed to create room code. Try /start again."));
  }
}

export async function handleGoals(space: any, sender: string, spaceId?: string): Promise<void> {
  const island = await resolveSenderIsland(sender, spaceId);
  if (!island) {
    await space.send(text("I couldn't find an island for you yet. Ask someone to run /start in your group."));
    return;
  }
  const goals = await fetchGoals(island._id, sender);
  if (!goals.length) {
    await space.send(text(`No active goals on ${island.name}. Add one with "/add <goal>".`));
    return;
  }
  const lines = goals.map((g, i) => `${i + 1}. ${g.text}`);
  await space.send(text(`Your goals on ${island.name}:\n${lines.join("\n")}`));
}

async function roastGoal(playerName: string, proposedGoal: string): Promise<{ message: string, reasoning?: string }> {
  const res = await fetch(`${BACKEND_URL}/jobs/roast-goal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_name: playerName, proposed_goal: proposedGoal }),
  });
  if (!res.ok) throw new Error(`roast-goal HTTP ${res.status}`);
  return await res.json() as { message: string, reasoning?: string };
}

export async function handleAdd(space: any, sender: string, goalText: string, spaceId?: string): Promise<void> {
  if (!goalText) {
    await space.send(text("Usage: /add <goal text>"));
    return;
  }
  const island = await resolveSenderIsland(sender, spaceId);
  if (!island) {
    await space.send(text("I couldn't find an island for you. Run /start first."));
    return;
  }

  let roastMsg = "";
  let roastReasoning = "";
  try {
    const resp = await roastGoal(sender, goalText);
    roastMsg = resp.message;
    if (resp.reasoning) roastReasoning = resp.reasoning;
  } catch (err: any) {
    console.error("[/add] roast-goal failed, skipping:", err?.message ?? err);
  }

  await convex.mutation("goals:addGoals" as any, {
    islandId: island._id,
    phoneNumber: sender,
    goals: [goalText],
  });
  await convex.mutation("agents:createAgent" as any, {
    islandId: island._id,
    phoneNumber: sender,
    goals: [goalText],
  });

  const goals = await fetchGoals(island._id, sender);
  const count = goals.length;
  const plural = count === 1 ? "" : "s";
  const fallback = `🌱 Planted "${goalText}" on ${island.name}. ${count} goal${plural} growing.`;
  const finalMessage = roastMsg || fallback;
  await space.send(text(finalMessage));

  if (roastMsg) {
    try {
      const details: any = await convex.query("islands:getIslandDetails" as any, { islandId: island._id });
      const agent = details.agents?.find((a: any) => a.phoneNumber === sender);
      if (agent) {
        await convex.mutation("jobMutations:logAiMessage" as any, {
          agentId: agent._id,
          channel: "imessage_personal",
          content: finalMessage,
          context: roastReasoning ? { reasoning: roastReasoning } : {},
        });
      }
    } catch (e) {
      console.error("[/add] failed to log ai message:", e);
    }
  }
}

export async function handleDrop(space: any, sender: string, index: number, spaceId?: string): Promise<void> {
  const lookup = await lookupGoalByIndex(sender, index, spaceId);
  if (!lookup.ok) {
    if (lookup.reason === "no-island") {
      await space.send(text("I couldn't find an island for you. Run /start first."));
    } else if (lookup.reason === "no-goals") {
      await space.send(text("You don't have any active goals to drop yet. Try /add <goal>."));
    } else {
      await space.send(text(`Goal ${index} doesn't exist — you have ${lookup.count} goal${lookup.count === 1 ? "" : "s"}. Try /goals to see them.`));
    }
    return;
  }
  try {
    await convex.mutation("goals:archiveGoal" as any, { goalId: lookup.goal._id });
    await space.send(text(`🍂 Dropped goal ${index}: "${lookup.goal.text}".`));
  } catch (err: any) {
    console.error("[/drop] failed:", err?.message ?? err);
    await space.send(text("Couldn't drop that goal. It may already be archived."));
  }
}

export async function handleEdit(space: any, sender: string, index: number, newText: string, spaceId?: string): Promise<void> {
  const lookup = await lookupGoalByIndex(sender, index, spaceId);
  if (!lookup.ok) {
    if (lookup.reason === "no-island") {
      await space.send(text("I couldn't find an island for you. Run /start first."));
    } else if (lookup.reason === "no-goals") {
      await space.send(text("You don't have any active goals to edit yet. Try /add <goal>."));
    } else {
      await space.send(text(`Goal ${index} doesn't exist — you have ${lookup.count} goal${lookup.count === 1 ? "" : "s"}. Try /goals to see them.`));
    }
    return;
  }
  try {
    await convex.mutation("goals:editGoal" as any, { goalId: lookup.goal._id, newText });
    await space.send(text(`✏️ Goal ${index} updated: "${lookup.goal.text}" → "${newText}".`));
  } catch (err: any) {
    console.error("[/edit] failed:", err?.message ?? err);
    await space.send(text("Couldn't edit that goal."));
  }
}

export async function handleStatus(space: any, sender: string, spaceId?: string): Promise<void> {
  const island = await resolveSenderIsland(sender, spaceId);
  if (!island) {
    await space.send(text("No island for you yet. Run /start in a group chat."));
    return;
  }
  const today = todayIsoDate();
  const [goals, checkIns, details] = await Promise.all([
    fetchGoals(island._id, sender),
    convex.query("goals:getTodayCheckIns" as any, { islandId: island._id, phoneNumber: sender, date: today }),
    convex.query("islands:getIslandDetails" as any, { islandId: island._id }),
  ]);

  const checkedGoalIds = new Set((checkIns as any[]).filter((c) => c.completed).map((c) => c.goalId));
  const done = goals.filter((g) => checkedGoalIds.has(g._id));
  const pending = goals.filter((g) => !checkedGoalIds.has(g._id));

  const agent: Agent | undefined = (details.agents as Agent[]).find((a) => a.phoneNumber === sender);
  const motivationLine = agent ? `Agent motivation: ${agent.motivation}/100` : "No agent assigned yet.";

  const lines = [
    `${island.name} — level ${island.islandLevel}, ${island.xp} XP`,
    `Today: ${done.length}/${goals.length} goals done`,
  ];
  if (done.length) lines.push(`  ✓ ${done.map((g) => g.text).join(", ")}`);
  if (pending.length) lines.push(`  ○ ${pending.map((g) => g.text).join(", ")}`);
  lines.push(motivationLine);

  await space.send(text(lines.join("\n")));
}

export async function handleDone(space: any, sender: string, index: number, spaceId?: string): Promise<void> {
  const lookup = await lookupGoalByIndex(sender, index, spaceId);
  if (!lookup.ok) {
    if (lookup.reason === "no-island") {
      await space.send(text("I couldn't find an island for you. Run /start first."));
    } else if (lookup.reason === "no-goals") {
      await space.send(text("You don't have any active goals to complete yet. Try /add <goal>."));
    } else {
      await space.send(text(`Goal ${index} doesn't exist — you have ${lookup.count} goal${lookup.count === 1 ? "" : "s"}. Try /goals to see them.`));
    }
    return;
  }
  const today = todayIsoDate();
  try {
    const result = await convex.mutation("goals:checkIn" as any, {
      goalId: lookup.goal._id,
      islandId: lookup.island._id,
      phoneNumber: sender,
      date: today,
    });
    // checkIn returns the existing record if already checked in
    if (result && (result as any).completed) {
      const goals = await fetchGoals(lookup.island._id, sender);
      const checkIns: any[] = await convex.query("goals:getTodayCheckIns" as any, {
        islandId: lookup.island._id,
        phoneNumber: sender,
        date: today,
      });
      const doneCount = checkIns.filter((c) => c.completed).length;
      await space.send(text(`✅ "${lookup.goal.text}" done! (${doneCount}/${goals.length} today) — +1 XP, +10 💰`));
    }
  } catch (err: any) {
    console.error("[/done] failed:", err?.message ?? err);
    await space.send(text("Couldn't mark that goal done. Try again."));
  }
}

export async function handleUndo(space: any, sender: string, index: number, spaceId?: string): Promise<void> {
  const lookup = await lookupGoalByIndex(sender, index, spaceId);
  if (!lookup.ok) {
    if (lookup.reason === "no-island") {
      await space.send(text("I couldn't find an island for you. Run /start first."));
    } else if (lookup.reason === "no-goals") {
      await space.send(text("You don't have any active goals to undo. Try /add <goal>."));
    } else {
      await space.send(text(`Goal ${index} doesn't exist — you have ${lookup.count} goal${lookup.count === 1 ? "" : "s"}. Try /goals to see them.`));
    }
    return;
  }
  const today = todayIsoDate();
  try {
    const result = await convex.mutation("goals:uncheckIn" as any, {
      goalId: lookup.goal._id,
      islandId: lookup.island._id,
      phoneNumber: sender,
      date: today,
    });
    if (result === null) {
      await space.send(text(`Goal ${index} ("${lookup.goal.text}") wasn't checked in today — nothing to undo.`));
    } else {
      await space.send(text(`↩️ Undid check-in for "${lookup.goal.text}". XP and currency reversed.`));
    }
  } catch (err: any) {
    console.error("[/undo] failed:", err?.message ?? err);
    await space.send(text("Couldn't undo that check-in. Try again."));
  }
}

export async function handleChat(space: any, sender: string, body: string, spaceId: string): Promise<void> {
  const island = await resolveSenderIsland(sender, spaceId);
  let contextStr = "No island linked yet.";
  let playerName = sender;

  if (island) {
    try {
      const [goals, details] = await Promise.all([
        fetchGoals(island._id, sender),
        convex.query("islands:getIslandDetails" as any, { islandId: island._id }),
      ]);
      const member = (details?.members ?? []).find((m: any) => m.phoneNumber === sender);
      if (member?.displayName) playerName = member.displayName.split(/\s+/)[0];
      const goalLines = goals.length
        ? goals.map((g, i) => `  ${i + 1}. ${g.text}`).join("\n")
        : "  (none yet)";
      contextStr =
        `Island: ${island.name} (level ${island.islandLevel}, ${island.xp} XP)\n` +
        `Sender goals:\n${goalLines}`;
    } catch (err: any) {
      console.error("[chat] failed to load context:", err?.message ?? err);
    }
  }

  const history = getHistory(spaceId).slice(0, -1);

  let reply = "";
  try {
    const res = await fetch(`${BACKEND_URL}/jobs/chat-reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        player_name: playerName,
        island_context: contextStr,
        history: history.map((h) => ({ who: h.who, text: h.text })),
        latest: body,
      }),
    });
    if (!res.ok) throw new Error(`chat-reply HTTP ${res.status}`);
    const data = (await res.json()) as { message?: string };
    reply = (data.message ?? "").trim();
  } catch (err: any) {
    console.error("[chat] chat-reply failed:", err?.message ?? err);
    return;
  }

  if (!reply || reply.toUpperCase() === "SKIP") return;

  await space.send(text(reply));
  appendMessage(spaceId, "agent", reply);
}

// ── Framed console log helper ─────────────────────────────────────────

export function logFrame(time: string, spaceId: string, senderLabel: string, kind: string, body: string, cmdKind: string): void {
  console.log(
    `\n┌─ [${time}] space=${spaceId}` +
    `\n│  user: ${senderLabel} (${kind})` +
    `\n│  msg:  ${JSON.stringify(body)}` +
    `\n│  cmd:  ${cmdKind}`,
  );
}

// ── Dispatcher ────────────────────────────────────────────────────────
// Runs the known command. Returns "handled" | "unhandled" so test scripts
// that layer new commands on top know whether to pick it up themselves.

export async function dispatchKnownCommand(
  space: any,
  message: any,
  cmd: Command,
  resolvedSender: string | null,
  helpText: string = HELP_TEXT,
): Promise<"handled" | "unhandled" | "no-sender"> {
  if (cmd.kind === "none") return "unhandled";

  if (cmd.kind === "start") {
    await handleStart(space, message);
    return "handled";
  }
  if (cmd.kind === "help") {
    await space.send(text(helpText));
    return "handled";
  }

  if (!resolvedSender) {
    await space.send(text("I couldn't read your phone/email from this message."));
    return "no-sender";
  }

  const participants = collectParticipants(space, message);
  if (participants.length) {
    try {
      await convex.mutation("groupRooms:syncParticipants" as any, {
        spaceId: space.id,
        participants,
      });
    } catch (err) {
      console.error("[router] failed to sync room participants:", err);
    }
  }

  switch (cmd.kind) {
    case "goals":  await handleGoals(space, resolvedSender, space.id); break;
    case "add":    await handleAdd(space, resolvedSender, cmd.text, space.id); break;
    case "drop":   await handleDrop(space, resolvedSender, cmd.index, space.id); break;
    case "edit":   await handleEdit(space, resolvedSender, cmd.index, cmd.text, space.id); break;
    case "done":   await handleDone(space, resolvedSender, cmd.index, space.id); break;
    case "undo":   await handleUndo(space, resolvedSender, cmd.index, space.id); break;
    case "status": await handleStatus(space, resolvedSender, space.id); break;
  }
  return "handled";
}
