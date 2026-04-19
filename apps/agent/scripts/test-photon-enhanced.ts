/**
 * test-photon-enhanced.ts
 *
 * Enhanced test script for the Photon Spectrum agent. Runs ALL production
 * commands from router.ts (/start /help /goals /add /drop /edit /done /undo /status)
 * plus test-only extras:
 *
 *   /boost <n> <amount>  — give the Nth goal's island an XP boost (test only)
 *   /reward <amount>     — give instant currency to the sender's island
 *   /motivation <amount> — directly set the sender's agent motivation (0-100)
 *   /reset               — reset the seen-spaces cache (re-enable /start)
 *   /debug               — dump raw island + goals + check-ins for sender
 *
 * Usage:
 *   npx tsx scripts/test-photon-enhanced.ts            # live listen
 *   npx tsx scripts/test-photon-enhanced.ts --dry      # print help and exit
 *
 * Required env (apps/agent/.env):
 *   projid, secret    — Photon/Spectrum project credentials
 *   CONVEX_URL        — Convex deployment URL
 */

import { Spectrum, text } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import {
  PROJECT_ID,
  PROJECT_SECRET,
  CONVEX_URL,
  assertEnv,
  parseCommand,
  senderAddress,
  dispatchKnownCommand,
  logFrame,
  HELP_TEXT,
  convex,
  resolveSenderIsland,
  fetchGoals,
  lookupGoalByIndex,
  todayIsoDate,
  type Island,
  type Agent,
} from "../src/router.js";
import { startHttpServer } from "../src/server.js";
import { resetOnboarded } from "../src/state/seen-spaces.js";

// ── Extended command parsing ──────────────────────────────────────────

type ExtendedCommand =
  | ReturnType<typeof parseCommand>
  | { kind: "boost"; index: number; amount: number }
  | { kind: "reward"; amount: number }
  | { kind: "motivation"; amount: number }
  | { kind: "reset" }
  | { kind: "debug" };

function parseExtendedCommand(raw: string): ExtendedCommand { // NOSONAR
  const body = raw.trim();
  const lower = body.toLowerCase();

  // Test-only commands
  let m = body.match(/^\/?boost\s+(\d+)\s+(\d+)\s*$/i);
  if (m) return { kind: "boost", index: parseInt(m[1], 10), amount: parseInt(m[2], 10) };

  m = body.match(/^\/?reward\s+(\d+)\s*$/i);
  if (m) return { kind: "reward", amount: parseInt(m[1], 10) };

  m = body.match(/^\/?motivation\s+(\d+)\s*$/i);
  if (m) return { kind: "motivation", amount: Math.max(0, Math.min(100, parseInt(m[1], 10))) };

  if (lower === "/reset" || lower === "reset") return { kind: "reset" };
  if (lower === "/debug" || lower === "debug") return { kind: "debug" };

  // Fall through to production commands
  return parseCommand(raw);
}

const EXTENDED_HELP =
  HELP_TEXT +
  "\n\n--- Test-only commands ---\n" +
  "🚀  /boost <n> <xp>   — XP boost for the Nth goal's island\n" +
  "💰  /reward <amount>   — instant currency for your island\n" +
  "💪  /motivation <0-100> — set your agent's motivation\n" +
  "🔄  /reset             — re-enable /start for this chat\n" +
  "🐛  /debug             — dump raw island, goals, check-ins";

// ── Extended handlers ─────────────────────────────────────────────────

async function handleBoost(space: any, sender: string, index: number, xpAmount: number): Promise<void> { // NOSONAR
  const lookup = await lookupGoalByIndex(sender, index);
  if (!lookup.ok) {
    if (lookup.reason === "no-island") {
      await space.send(text("No island found. Run /start first."));
    } else if (lookup.reason === "no-goals") {
      await space.send(text("No goals to boost. Try /add <goal>."));
    } else {
      await space.send(text(`Goal ${index} doesn't exist. Try /goals to see them.`));
    }
    return;
  }
  try {
    const island = lookup.island;
    const newXp = island.xp + xpAmount;
    const newLevel = Math.floor(newXp / 20);
    // Patch the island directly via Convex — we use a generic mutation approach.
    // Since there's no dedicated "boostXp" mutation, we'll call checkIn multiple
    // times or use a raw patch. For testing, we'll use the islands:activateIsland
    // mutation as a proxy to update status then manually patch XP via the client.
    // Actually, let's just call checkIn N times (hacky but works for testing).
    const today = todayIsoDate();
    for (let i = 0; i < xpAmount; i++) {
      // Create fake check-ins to pump XP. Each adds +1 XP and +10 currency.
      // We'll undo these afterward if needed.
      await convex.mutation("goals:checkIn" as any, {
        goalId: lookup.goal._id,
        islandId: island._id,
        phoneNumber: sender,
        date: `${today}-boost-${i}`, // Unique fake date to avoid idempotency guard
      });
    }
    await space.send(text(`🚀 Boosted ${island.name} by +${xpAmount} XP! New XP: ~${newXp}, Level: ~${newLevel}`));
  } catch (err: any) {
    console.error("[/boost] failed:", err?.message ?? err);
    await space.send(text("Boost failed. Check Convex logs."));
  }
}

async function handleReward(space: any, sender: string, amount: number): Promise<void> {
  const island = await resolveSenderIsland(sender);
  if (!island) {
    await space.send(text("No island found. Run /start first."));
    return;
  }
  try {
    // Reward currency by creating ghost check-ins on a synthetic date
    const today = todayIsoDate();
    const goals = await fetchGoals(island._id, sender);
    if (!goals.length) {
      await space.send(text("No goals to reward against. Try /add <goal>."));
      return;
    }
    // Each check-in gives 10 currency, so do amount/10 check-ins
    const ticks = Math.max(1, Math.ceil(amount / 10));
    for (let i = 0; i < ticks; i++) {
      await convex.mutation("goals:checkIn" as any, {
        goalId: goals[0]._id,
        islandId: island._id,
        phoneNumber: sender,
        date: `${today}-reward-${i}`,
      });
    }
    await space.send(text(`💰 Rewarded ${island.name} with ~${ticks * 10} currency!`));
  } catch (err: any) {
    console.error("[/reward] failed:", err?.message ?? err);
    await space.send(text("Reward failed."));
  }
}

async function handleMotivation(space: any, sender: string, amount: number): Promise<void> {
  const island = await resolveSenderIsland(sender);
  if (!island) {
    await space.send(text("No island found. Run /start first."));
    return;
  }
  try {
    const details: any = await convex.query("islands:getIslandDetails" as any, { islandId: island._id });
    const agent: Agent | undefined = (details.agents as Agent[]).find((a) => a.phoneNumber === sender);
    if (!agent) {
      await space.send(text("No agent found for you on this island."));
      return;
    }
    await convex.mutation("agents:updateMotivation" as any, {
      agentId: agent._id,
      motivation: amount,
    });
    await space.send(text(`💪 Motivation set to ${amount}/100 for your agent.`));
  } catch (err: any) {
    console.error("[/motivation] failed:", err?.message ?? err);
    await space.send(text(`Couldn't set motivation — the mutation may not exist yet. Error: ${err?.message}`));
  }
}

async function handleDebug(space: any, sender: string): Promise<void> {
  const island = await resolveSenderIsland(sender);
  if (!island) {
    await space.send(text("No island found for you."));
    return;
  }
  const today = todayIsoDate();
  const [goals, checkIns, details] = await Promise.all([
    fetchGoals(island._id, sender),
    convex.query("goals:getTodayCheckIns" as any, { islandId: island._id, phoneNumber: sender, date: today }),
    convex.query("islands:getIslandDetails" as any, { islandId: island._id }),
  ]);

  const lines = [
    `🐛 DEBUG for ${sender}`,
    `Island: ${island.name} (${island._id})`,
    `  code=${island.code} status=${island.status} tier=${(island as any).tier}`,
    `  level=${island.islandLevel} xp=${island.xp} currency=${island.currency}`,
    `Goals (${goals.length}):`,
    ...goals.map((g, i) => `  ${i + 1}. [${g.status}] ${g.text}`),
    `Today's check-ins (${(checkIns as any[]).length}):`,
    ...(checkIns as any[]).map((c: any) => `  goalId=${c.goalId} completed=${c.completed}`),
    `Agents: ${(details as any).agents.length}`,
    ...(details as any).agents.map((a: Agent) => `  ${a.phoneNumber} mot=${a.motivation} ${a.personalityProfile.slice(0, 40)}...`),
  ];

  await space.send(text(lines.join("\n")));
}

async function handleReset(space: any): Promise<void> {
  resetOnboarded(space.id);
  await space.send(text("🔄 Space onboarding cache cleared. You can /start again."));
}

function requireSender(resolvedSender: string | null): resolvedSender is string {
  if (resolvedSender) return true;
  console.log(`└─ ⚠️  could not resolve sender`);
  return false;
}

async function handleExtendedCommand(
  cmd: ExtendedCommand,
  space: any,
  message: any,
  resolvedSender: string | null,
  senderLabel: string,
): Promise<void> {
  switch (cmd.kind) {
    case "reset":
      await handleReset(space);
      console.log(`└─ ✅ /reset`);
      return;
    case "debug":
      if (!requireSender(resolvedSender)) return;
      await handleDebug(space, resolvedSender);
      console.log(`└─ ✅ /debug for ${senderLabel}`);
      return;
    case "boost":
      if (!requireSender(resolvedSender)) return;
      await handleBoost(space, resolvedSender, cmd.index, cmd.amount);
      console.log(`└─ ✅ /boost for ${senderLabel}`);
      return;
    case "reward":
      if (!requireSender(resolvedSender)) return;
      await handleReward(space, resolvedSender, cmd.amount);
      console.log(`└─ ✅ /reward for ${senderLabel}`);
      return;
    case "motivation":
      if (!requireSender(resolvedSender)) return;
      await handleMotivation(space, resolvedSender, cmd.amount);
      console.log(`└─ ✅ /motivation for ${senderLabel}`);
      return;
    default: {
      const result = await dispatchKnownCommand(space, message, cmd as any, resolvedSender, EXTENDED_HELP);
      if (result === "no-sender") {
        console.log(`└─ ⚠️  could not resolve sender for ${message.sender.id}`);
      } else {
        console.log(`└─ ✅ /${cmd.kind} for ${senderLabel}`);
      }
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────

async function main(): Promise<void> { // NOSONAR
  if (process.argv.includes("--dry")) {
    console.log(EXTENDED_HELP);
    return;
  }

  assertEnv();

  const app = await Spectrum({
    projectId: PROJECT_ID!,
    projectSecret: PROJECT_SECRET!,
    providers: [imessage.config()],
  });

  console.log("\n🧪 Island Habits Agent — ENHANCED TEST MODE");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`CONVEX_URL=${CONVEX_URL}`);
  console.log(`All production commands + /boost /reward /motivation /reset /debug\n`);

  startHttpServer(app);

  for await (const [space, message] of app.messages) {
    const content = message.content[0];
    if (!content || content.type !== "plain_text") continue;
    const body = content.text;
    const time = message.timestamp.toLocaleTimeString();
    const cmd = parseExtendedCommand(body);

    const resolvedSender = senderAddress(message);
    const senderLabel = resolvedSender ?? `raw:${message.sender.id}`;
    const kind = resolvedSender?.startsWith("+") ? "phone" : resolvedSender ? "email" : "unknown";

    logFrame(time, space.id, senderLabel, kind, body, cmd.kind);

    if (cmd.kind === "none") {
      console.log(`└─ (no command matched — ignored)`);
      continue;
    }

    try {
      await handleExtendedCommand(cmd, space, message, resolvedSender, senderLabel);
    } catch (err: any) {
      console.error(`└─ ❌ /${cmd.kind} for ${senderLabel} failed: ${err?.message ?? err}`);
      await space.send(text("Something went wrong. Try again in a moment."));
    }
  }
}

main().catch((err) => {
  console.error("❌ test-photon-enhanced crashed:", err);
  process.exit(1);
});
