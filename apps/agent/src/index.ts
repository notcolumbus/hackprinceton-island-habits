/**
 * index.ts
 *
 * Production entrypoint for the Island Habits Photon agent.
 * Run with `npm run dev` (tsx src/index.ts).
 *
 * All command logic lives in ./router.ts — this file only wires the
 * Spectrum message loop to the router and keeps the HTTP server up
 * for outbound /send and /send-group requests.
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
  handleChat,
  logFrame,
} from "./router.js";
import { appendMessage } from "./state/chat-history.js";
import { isTagged } from "./photon/mentions.js";
import { startHttpServer } from "./server.js";

type MessageContext = {
  sender: string | null;
  senderLabel: string;
  body: string;
  spaceId: string;
};

function buildMessageContext(message: any, body: string, spaceId: string): MessageContext {
  const resolvedSender = senderAddress(message);
  return {
    sender: resolvedSender,
    senderLabel: resolvedSender ?? `raw:${message.sender.id}`,
    body,
    spaceId,
  };
}

function shouldHandleChat(ctx: MessageContext): boolean {
  if (!ctx.sender) {
    console.log(`└─ (no command matched, no sender — ignored)`);
    return false;
  }
  if (!ctx.body.trim()) {
    console.log(`└─ (empty body — tapback or system message, skipped)`);
    return false;
  }
  if (!isTagged(ctx.body)) {
    console.log(`└─ (no "isla" mention — skipped)`);
    return false;
  }
  return true;
}

async function processNonCommand(space: any, ctx: MessageContext) {
  if (!shouldHandleChat(ctx)) return;
  try {
    await handleChat(space, ctx.sender!, ctx.body, ctx.spaceId);
    console.log(`└─ 💬 chat reply for ${ctx.senderLabel}`);
  } catch (err: any) {
    console.error(`└─ ❌ chat reply for ${ctx.senderLabel} failed: ${err?.message ?? err}`);
  }
}

async function processKnownCommand(space: any, message: any, cmd: ReturnType<typeof parseCommand>, ctx: MessageContext) {
  try {
    const result = await dispatchKnownCommand(space, message, cmd, ctx.sender);
    if (result === "no-sender") {
      console.log(`└─ ⚠️  could not resolve sender address for ${message.sender.id}`);
      return;
    }
    console.log(`└─ ✅ /${cmd.kind} for ${ctx.senderLabel}`);
  } catch (err: any) {
    console.error(`└─ ❌ /${cmd.kind} for ${ctx.senderLabel} failed: ${err?.message ?? err}`);
    await space.send(text("Something went wrong. Try again in a moment."));
  }
}

async function main(): Promise<void> {
  assertEnv();

  const app = await Spectrum({
    projectId: PROJECT_ID!,
    projectSecret: PROJECT_SECRET!,
    providers: [imessage.config()],
  });

  console.log("\n🌿 Island Habits Agent");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`CONVEX_URL=${CONVEX_URL}`);
  console.log(`Commands: /start /help /goals /add /drop /edit /done /undo /status\n`);

  startHttpServer(app);

  for await (const [space, message] of app.messages) {
    const content = message.content[0];
    if (!content || content.type !== "plain_text") continue;
    const body = content.text;
    const time = message.timestamp.toLocaleTimeString();
    const cmd = parseCommand(body);
    const ctx = buildMessageContext(message, body, space.id);
    const kind = ctx.sender?.startsWith("+") ? "phone" : ctx.sender ? "email" : "unknown";

    logFrame(time, space.id, ctx.senderLabel, kind, body, cmd.kind);

    // Log every inbound message so the conversational fallback has context.
    appendMessage(space.id, ctx.senderLabel, body);

    if (cmd.kind === "none") {
      await processNonCommand(space, ctx);
      continue;
    }

    await processKnownCommand(space, message, cmd, ctx);
  }
}

main().catch((err) => {
  console.error("❌ Agent crashed:", err);
  process.exit(1);
});
