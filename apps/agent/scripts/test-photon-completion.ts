/**
 * test-photon-completion.ts
 *
 * Photon × Gemini completion-aware listener.
 *
 * Unlike the existing onboarding / handler flows, this listener does NOT
 * react to slash commands. It watches the session history of each iMessage
 * space and asks Gemini whether the latest user message indicates
 * they just completed a habit / task. The agent replies ONLY when Gemini
 * classifies the message as a completion event.
 *
 * Does not edit any existing photon files — runs standalone.
 *
 * Usage:
 *   npx tsx scripts/test-photon-completion.ts              # live listen
 *   npx tsx scripts/test-photon-completion.ts --dry "I just finished my run!"
 *       # run the Gemini classifier on a single string (no Photon connection)
 *
 * Required env (from apps/agent/.env or apps/backend/.env):
 *   projid, secret                  — Photon project credentials
 *   GOOGLE_API_KEY                  — Gemini API key
 *   GOOGLE_API_URL (optional)       — defaults to https://generativelanguage.googleapis.com/v1beta
 *   GOOGLE_MODEL   (optional)       — defaults to gemma-4-26b-a4b-it
 */

import { Spectrum, text } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import "dotenv/config";

const PROJECT_ID = process.env.projid;
const PROJECT_SECRET = process.env.secret;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY ?? "";
const GOOGLE_API_URL =
  process.env.GOOGLE_API_URL ?? "https://generativelanguage.googleapis.com/v1beta";
const GOOGLE_MODEL = process.env.GOOGLE_MODEL ?? "gemma-4-26b-a4b-it";

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

function extractGeminiText(data: any): string {
  const candidates = data?.candidates ?? [];
  const parts = candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part?.thought === true) continue;
    if (typeof part?.text === "string" && part.text.trim()) return part.text.trim();
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const text = parts?.[i]?.text;
    if (typeof text === "string" && text.trim()) return text.trim();
  }
  return "";
}

async function classifyWithGemini(
  historyBeforeNew: Turn[],
  latestSender: string,
  latestText: string,
): Promise<CompletionVerdict> {
  if (!GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is not set (apps/backend/.env)");
  }

  const transcript = renderHistory(historyBeforeNew) || "(no prior turns)";
  const userPrompt = `Recent transcript:\n${transcript}\n\nNew message from user(${latestSender}):\n${latestText}\n\nReturn JSON only.`;
  const url = `${GOOGLE_API_URL}/models/${GOOGLE_MODEL}:generateContent?key=${GOOGLE_API_KEY}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                `System instructions:\n${SYSTEM_PROMPT}\n\n` +
                `User input:\n${userPrompt}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 220,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Gemini HTTP ${resp.status}: ${body.slice(0, 300)}`);
  }

  const data: any = await resp.json();
  const raw = extractGeminiText(data);
  if (process.env.GEMINI_DEBUG || process.env.K2_DEBUG) {
    console.log("── Gemini raw content ──\n" + raw + "\n────────────────────────");
  }
  return parseVerdict(raw);
}

// Gemini may return fenced JSON or extra prose around JSON.
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
function extractJsonBlock(raw: string): string | null {
  // 1. Strip reasoning envelopes so their braces can't poison the search.
  const stripped = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .replace(/<answer>([\s\S]*?)<\/answer>/gi, "$1")
    .trim();

  // 2. Prefer a fenced ```json ... ``` block.
  const fenced = stripped.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1].trim().startsWith("{")) {
    return fenced[1].trim();
  }

  // 3. Scan for a balanced {...} object, skipping strings. Prefer the LAST
  //    balanced object (the final answer after any reasoning scratchpad).
  const candidates: string[] = [];
  for (let i = 0; i < stripped.length; i++) {
    if (stripped[i] !== "{") continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let j = i; j < stripped.length; j++) {
      const ch = stripped[j];
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
        if (depth === 0) {
          candidates.push(stripped.slice(i, j + 1));
          i = j;
          break;
        }
      }
    }
  }
  // Prefer the candidate that actually parses and has a "completed" key.
  for (let k = candidates.length - 1; k >= 0; k--) {
    try {
      const obj = JSON.parse(candidates[k]);
      if (obj && typeof obj === "object" && "completed" in obj) return candidates[k];
    } catch {
      // try next
    }
  }
  return candidates.length ? candidates[candidates.length - 1] : null;
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
    if (process.env.GEMINI_DEBUG || process.env.K2_DEBUG) console.warn("parseVerdict: no JSON block found");
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
    if (process.env.GEMINI_DEBUG || process.env.K2_DEBUG) {
      console.warn(`parseVerdict: JSON.parse failed on: ${jsonStr.slice(0, 200)}`);
    }
    return fallback;
  }
}

async function runListen(): Promise<void> {
  if (!PROJECT_ID || !PROJECT_SECRET) {
    throw new Error("Missing projid/secret in apps/agent/.env");
  }
  if (!GOOGLE_API_KEY) {
    throw new Error("Missing GOOGLE_API_KEY — copy it from apps/backend/.env into apps/agent/.env");
  }

  const app = await Spectrum({
    projectId: PROJECT_ID,
    projectSecret: PROJECT_SECRET,
    providers: [imessage.config()],
  });

  console.log(`\n🌿 ${AGENT_NAME} — completion listener (Gemini)`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Model: ${GOOGLE_MODEL}`);
  console.log(`History per space: last ${HISTORY_LIMIT} turns`);
  console.log("Silent unless Gemini detects a habit completion.\n");

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
      verdict = await classifyWithGemini(history, sender, body);
    } catch (err: any) {
      console.error(`  ↳ Gemini error: ${err?.message ?? err}`);
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
  const verdict = await classifyWithGemini([], "tester", input);
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
