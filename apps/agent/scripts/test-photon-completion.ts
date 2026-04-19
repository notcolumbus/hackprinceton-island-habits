/**
 * test-photon-completion.ts
 *
 * Photon × K2 Think V2 completion-aware listener.
 *
 * Unlike the existing onboarding / handler flows, this listener does NOT
 * react to slash commands. It watches the session history of each iMessage
 * space and asks K2 Think V2 whether the latest user message indicates
 * they just completed a habit / task. The agent replies ONLY when K2
 * classifies the message as a completion event.
 *
 * Does not edit any existing photon files — runs standalone.
 *
 * Usage:
 *   npx tsx scripts/test-photon-completion.ts              # live listen
 *   npx tsx scripts/test-photon-completion.ts --dry "I just finished my run!"
 *       # run the K2 classifier on a single string (no Photon connection)
 *
 * Required env (from apps/agent/.env or apps/backend/.env):
 *   projid, secret                  — Photon project credentials
 *   K2_API_KEY                      — K2 Think V2 API key
 *   K2_API_URL (optional)           — defaults to https://api.k2think.ai/v1/chat/completions
 *   K2_MODEL   (optional)           — defaults to MBZUAI-IFM/K2-Think-v2
 */

import { Spectrum, text } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import "dotenv/config";

const PROJECT_ID = process.env.projid;
const PROJECT_SECRET = process.env.secret;
const K2_API_KEY = process.env.K2_API_KEY ?? "";
const K2_API_URL =
  process.env.K2_API_URL ?? "https://api.k2think.ai/v1/chat/completions";
const K2_MODEL = process.env.K2_MODEL ?? "MBZUAI-IFM/K2-Think-v2";

const HISTORY_LIMIT = 12;
const AGENT_NAME = "Isla";

type Turn = { role: "user" | "assistant"; sender: string; text: string };
const sessions = new Map<string, Turn[]>();

function pushTurn(spaceId: string, turn: Turn): Turn[] {
  const history = sessions.get(spaceId) ?? [];
  history.push(turn);
  if (history.length > HISTORY_LIMIT) history.splice(0, history.length - HISTORY_LIMIT);
  sessions.set(spaceId, history);
  return history;
}

function renderHistory(history: Turn[]): string {
  return history
    .map((t) => `${t.role === "user" ? `user(${t.sender})` : AGENT_NAME}: ${t.text}`)
    .join("\n");
}

type CompletionVerdict = {
  completed: boolean;
  task: string | null;
  reply: string | null;
  confidence: number;
};

const SYSTEM_PROMPT = `You are the completion-detection brain behind ${AGENT_NAME}, the AI companion for Island of Habits (a habit-tracking game).

You will receive the recent chat transcript from a group iMessage thread plus the newest message from a user.

Your job: decide whether the newest message is the user reporting that they JUST completed one of their habits / tasks / goals (e.g. "done with my run", "finished reading", "meditated this morning ✅"). Do NOT treat intent, plans, or complaints as completions. Past-tense first-person completion only.

Think step by step privately if you must, but your FINAL output MUST be a single JSON object and nothing else. If you use reasoning, wrap it in <think>...</think> and place the JSON after it.

Schema (exact keys, no extras):
{
  "completed": boolean,
  "task": string | null,     // short label of the task completed, or null
  "confidence": number,      // 0..1
  "reply": string | null     // if completed=true, a short (<=2 sentence) warm in-character congratulation referencing the task; else null
}

Example 1 — user: "just finished my 30 min run!"
{"completed": true, "task": "30 min run", "confidence": 0.95, "reply": "Proud of you for lacing up today — the island feels every step."}

Example 2 — user: "ugh I don't feel like reading tonight"
{"completed": false, "task": null, "confidence": 0.9, "reply": null}`;

async function classifyWithK2(
  historyBeforeNew: Turn[],
  latestSender: string,
  latestText: string,
): Promise<CompletionVerdict> {
  if (!K2_API_KEY) {
    throw new Error("K2_API_KEY is not set (apps/backend/.env)");
  }

  const transcript = renderHistory(historyBeforeNew) || "(no prior turns)";
  const userPrompt = `Recent transcript:\n${transcript}\n\nNew message from user(${latestSender}):\n${latestText}\n\nReturn JSON only.`;

  const resp = await fetch(K2_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${K2_API_KEY}`,
    },
    body: JSON.stringify({
      model: K2_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      stream: false,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`K2 HTTP ${resp.status}: ${body.slice(0, 300)}`);
  }

  const data: any = await resp.json();
  const raw: string = data?.choices?.[0]?.message?.content ?? "";
  if (process.env.K2_DEBUG) {
    console.log("── K2 raw content ──\n" + raw + "\n────────────────────");
  }
  return parseVerdict(raw);
}

// K2 Think V2 is a reasoning model. Its `content` typically looks like:
//
//   <think> ... chain-of-thought, often contains { } braces ... </think>
//   ```json
//   { "completed": true, ... }
//   ```
//
// or variations: <answer>…</answer>, or just reasoning followed by a bare
// JSON object. A naive /\{[\s\S]*\}/ match sweeps up the reasoning and
// produces invalid JSON, collapsing to the fallback {confidence:0,...}.
// The extractor below tries strategies in order of specificity.
function extractJsonBlock(raw: string): string | null { // NOSONAR
  const stripped = stripReasoningWrappers(raw);
  const fenced = extractFencedJson(stripped);
  if (fenced) return fenced;

  const candidates = collectBalancedJsonCandidates(stripped);
  const preferred = pickPreferredCandidate(candidates);
  return preferred ?? (candidates.length ? candidates[candidates.length - 1] : null);
}

function stripReasoningWrappers(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .replace(/<answer>([\s\S]*?)<\/answer>/gi, "$1")
    .trim();
}

function extractFencedJson(stripped: string): string | null {
  const fenced = stripped.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (!fenced) return null;
  const block = fenced[1].trim();
  return block.startsWith("{") ? block : null;
}

function collectBalancedJsonCandidates(input: string): string[] {
  const candidates: string[] = [];
  for (let i = 0; i < input.length; i++) {
    if (input[i] !== "{") continue;
    const end = findBalancedObjectEnd(input, i);
    if (end === -1) continue;
    candidates.push(input.slice(i, end + 1));
    i = end;
  }
  return candidates;
}

function findBalancedObjectEnd(input: string, start: number): number {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let j = start; j < input.length; j++) {
    const ch = input[j];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return j;
    }
  }
  return -1;
}

function pickPreferredCandidate(candidates: string[]): string | null {
  for (let i = candidates.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(candidates[i]);
      if (obj && typeof obj === "object" && "completed" in obj) {
        return candidates[i];
      }
    } catch {
      // try next
    }
  }
  return null;
}

function parseVerdict(raw: string): CompletionVerdict {
  const fallback: CompletionVerdict = {
    completed: false,
    task: null,
    reply: null,
    confidence: 0,
  };
  if (!raw) return fallback;

  const jsonStr = extractJsonBlock(raw);
  if (!jsonStr) {
    if (process.env.K2_DEBUG) console.warn("parseVerdict: no JSON block found");
    return fallback;
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      completed: Boolean(parsed.completed),
      task: typeof parsed.task === "string" ? parsed.task : null,
      reply: typeof parsed.reply === "string" ? parsed.reply : null,
      confidence:
        typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0,
    };
  } catch (err) {
    if (process.env.K2_DEBUG) {
      console.warn(`parseVerdict: JSON.parse failed on: ${jsonStr.slice(0, 200)}`);
    }
    return fallback;
  }
}

async function runListen(): Promise<void> {
  if (!PROJECT_ID || !PROJECT_SECRET) {
    throw new Error("Missing projid/secret in apps/agent/.env");
  }
  if (!K2_API_KEY) {
    throw new Error("Missing K2_API_KEY — copy it from apps/backend/.env into apps/agent/.env");
  }

  const app = await Spectrum({
    projectId: PROJECT_ID,
    projectSecret: PROJECT_SECRET,
    providers: [imessage.config()],
  });

  console.log(`\n🌿 ${AGENT_NAME} — completion listener (K2 Think V2)`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Model: ${K2_MODEL}`);
  console.log(`History per space: last ${HISTORY_LIMIT} turns`);
  console.log("Silent unless K2 detects a habit completion.\n");

  for await (const [space, message] of app.messages) {
    const content = message.content[0];
    if (!content || content.type !== "plain_text") continue;

    const body = content.text;
    const sender = message.sender.id;
    const spaceId = space.id;
    const time = message.timestamp.toLocaleTimeString();

    const history = sessions.get(spaceId) ?? [];
    console.log(`[${time}] space=${spaceId} user=${sender}: ${body}`);

    let verdict: CompletionVerdict;
    try {
      verdict = await classifyWithK2(history, sender, body);
    } catch (err: any) {
      console.error(`  ↳ K2 error: ${err?.message ?? err}`);
      pushTurn(spaceId, { role: "user", sender, text: body });
      continue;
    }

    pushTurn(spaceId, { role: "user", sender, text: body });
    console.log(
      `  ↳ verdict completed=${verdict.completed} conf=${verdict.confidence.toFixed(2)} task=${verdict.task ?? "-"}`,
    );

    if (!verdict.completed || !verdict.reply) continue;

    try {
      await message.react(imessage.tapbacks.love);
    } catch {
      // Some providers may not support tapbacks; ignore.
    }
    await space.send(text(verdict.reply));
    pushTurn(spaceId, { role: "assistant", sender: AGENT_NAME, text: verdict.reply });
    console.log(`  ↳ replied: ${verdict.reply}`);
  }
}

async function runDry(input: string): Promise<void> {
  const verdict = await classifyWithK2([], "tester", input);
  console.log(JSON.stringify(verdict, null, 2));
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryIndex = argv.indexOf("--dry");
  if (dryIndex !== -1) {
    const payload = argv.slice(dryIndex + 1).join(" ").trim();
    if (!payload) {
      console.log('Usage: test-photon-completion.ts --dry "I just finished my run"');
      process.exit(1);
    }
    await runDry(payload);
    return;
  }
  await runListen();
}

main().catch((err) => {
  console.error("❌ test-photon-completion crashed:", err);
  process.exit(1);
});
