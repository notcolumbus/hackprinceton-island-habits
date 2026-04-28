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
  autoCheckInFromPhoto,
  parseCommand,
  senderAddress,
  collectParticipants,
  dispatchKnownCommand,
  handleChat,
  syncKnotTransactionsOnBoot,
  logFrame,
} from "./router.js";
import { appendMessage } from "./state/chat-history.js";
import { isTagged } from "./photon/mentions.js";
import { startPhotoAutoCheckinWatcher } from "./photon/photoAutoCheckin.js";
import { startHttpServer } from "./server.js";

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
  void startPhotoAutoCheckinWatcher().catch((err) => {
    console.error("❌ Photo watcher crashed:", err);
  });
  void syncKnotTransactionsOnBoot().catch((err) => {
    console.error("❌ Knot transaction bootstrap sync crashed:", err);
  });

  for await (const [space, message] of app.messages) {
    const resolvedSender = senderAddress(message);
    const senderLabel = resolvedSender ?? `raw:${message.sender.id}`;
    const kind = resolvedSender?.startsWith("+") ? "phone" : resolvedSender ? "email" : "unknown";
    const time = message.timestamp.toLocaleTimeString();
    const textContent = message.content.find((c): c is Extract<typeof c, { type: "plain_text" }> => c.type === "plain_text");
    const body = textContent?.text ?? "";
    const cmd = parseCommand(body);

    const imageAttachments = message.content.filter(
      (c): c is Extract<typeof c, { type: "attachment" }> =>
        c.type === "attachment" && c.mimeType.startsWith("image/"),
    );
    if (imageAttachments.length > 0 && resolvedSender) {
      for (const att of imageAttachments) {
        try {
          const imageBase64 = Buffer.from(att.data).toString("base64");
          const result = await autoCheckInFromPhoto(
            resolvedSender,
            space.id,
            imageBase64,
            att.mimeType,
          );
          if (!result.checkedIn || !result.reply) continue;
          await space.send(text(result.reply));
          console.log(`└─ 📸 auto check-in for ${senderLabel}`);
          break;
        } catch (err: any) {
          console.error(`└─ ❌ image auto check-in failed for ${senderLabel}: ${err?.message ?? err}`);
        }
      }
    }

    if (!textContent) continue;

    logFrame(time, space.id, senderLabel, kind, body, cmd.kind);

    // Log every inbound message so the conversational fallback has context.
    appendMessage(space.id, senderLabel, body);

    if (cmd.kind === "none") {
      if (!resolvedSender) {
        console.log(`└─ (no command matched, no sender — ignored)`);
        continue;
      }
      if (!body.trim()) {
        console.log(`└─ (empty body — tapback or system message, skipped)`);
        continue;
      }
      const participants = collectParticipants(space as any, message as any);
      const isDirectChat = participants.length <= 1;
      const hasWakeWord = isTagged(body);
      if (!hasWakeWord && !isDirectChat) {
        console.log(`└─ (no "isla" mention — skipped)`);
        continue;
      }
      try {
        await handleChat(space, resolvedSender, body, space.id);
        console.log(`└─ 💬 chat reply for ${senderLabel}`);
      } catch (err: any) {
        console.error(`└─ ❌ chat reply for ${senderLabel} failed: ${err?.message ?? err}`);
      }
      continue;
    }

    try {
      const result = await dispatchKnownCommand(space, message, cmd, resolvedSender);
      if (result === "no-sender") {
        console.log(`└─ ⚠️  could not resolve sender address for ${message.sender.id}`);
      } else {
        console.log(`└─ ✅ /${cmd.kind} for ${senderLabel}`);
      }
    } catch (err: any) {
      console.error(`└─ ❌ /${cmd.kind} for ${senderLabel} failed: ${err?.message ?? err}`);
      await space.send(text("Something went wrong. Try again in a moment."));
    }
  }
}

main().catch((err) => {
  console.error("❌ Agent crashed:", err);
  process.exit(1);
});
