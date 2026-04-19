/**
 * Interactive Photon Cloud Test
 *
 * Photon cloud agent phone number: +1 (415) 595-2874
 * People text THIS number to interact with the agent via iMessage.
 *
 * Usage:
 *   npx tsx scripts/test-photon-interactive.ts info              # Show cloud instance info
 *   npx tsx scripts/test-photon-interactive.ts check +1XXXXXXXXXX # Check if a number has iMessage
 *   npx tsx scripts/test-photon-interactive.ts send +1XXXXXXXXXX  # Send a test message to someone
 *   npx tsx scripts/test-photon-interactive.ts listen             # Listen & auto-reply to incoming messages
 *   npx tsx scripts/test-photon-interactive.ts group +1X +1Y      # Create group chat & send welcome
 */

import { createClient, type AdvancedIMessage } from "@photon-ai/advanced-imessage";
import { ConvexHttpClient } from "convex/browser";
import { cloud, Spectrum, text } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import "dotenv/config";

const PROJECT_ID = process.env.projid!;
const PROJECT_SECRET = process.env.secret!;
const CONVEX_URL = process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;
const BOT_PHONE = (process.env.BOT_PHONE ?? "+14155952874").replace(/\D/g, "");

function toE164Like(value: unknown): string | null {
  if (!value || typeof value !== "string") return null;
  const digits = value.trim().replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return `+${digits}`;
}

function collectPhones(space: any, message: any): string[] {
  const raw: unknown[] = [];
  const candidateArrays = [
    space?.participants,
    space?.members,
    space?.users,
    message?.participants,
    message?.members,
  ];
  for (const arr of candidateArrays) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      raw.push(item?.phoneNumber, item?.address, item?.id, item);
    }
  }
  raw.push(message?.sender?.phoneNumber, message?.sender?.address, message?.sender?.id);

  return Array.from(
    new Set(
      raw
        .map(toE164Like)
        .filter((p): p is string => Boolean(p))
        .filter((p) => p.replace(/\D/g, "") !== BOT_PHONE)
    )
  );
}

async function getRawClient(): Promise<AdvancedIMessage> {
  const tokenData = await cloud.issueImessageTokens(PROJECT_ID, PROJECT_SECRET);

  if (tokenData.type === "shared") {
    const address = process.env.SPECTRUM_IMESSAGE_ADDRESS ?? "imessage.spectrum.photon.codes:443";
    return createClient({ address, tls: true, token: tokenData.token });
  }

  const [instanceId, token] = Object.entries(tokenData.auth)[0]!;
  const address = `${instanceId}.imsg.photon.codes:443`;
  console.log(`Connected to dedicated instance: ${address}`);
  return createClient({ address, tls: true, token });
}

async function showInfo() {
  console.log("=== Photon Cloud Instance Info ===\n");

  const tokenData = await cloud.issueImessageTokens(PROJECT_ID, PROJECT_SECRET);
  console.log("Token type:", tokenData.type);
  console.log("Expires in:", tokenData.expiresIn, "seconds");

  if (tokenData.type === "dedicated") {
    const instances = Object.keys(tokenData.auth);
    console.log("Instance IDs:", instances);
    console.log("Endpoints:", instances.map(id => `${id}.imsg.photon.codes:443`));
  }

  const client = await getRawClient();

  console.log("\n--- Chat Stats ---");
  try {
    const chatCount = await client.chats.count();
    console.log(`Total chats: ${chatCount}`);
  } catch (err: any) {
    console.log("Could not count chats:", err.message);
  }

  console.log("\n--- Message Stats ---");
  try {
    const stats = await client.messages.stats();
    console.log(`Sent: ${stats.sent}, Received: ${stats.received}, Total: ${stats.total}`);
  } catch (err: any) {
    console.log("Could not get stats:", err.message);
  }

  console.log("\n--- Recent Messages ---");
  try {
    const paginated = client.messages.list({ limit: 10 });
    const page = await paginated;
    for (const msg of page.data) {
      const direction = msg.isFromMe ? "→ SENT" : "← RECV";
      const addr = msg.isFromMe ? (msg.sender?.address || "me") : (msg.sender?.address || "unknown");
      const time = msg.dateCreated?.toLocaleString() || "?";
      let msgText = msg.text || "(no text)";
      console.log(`  [${direction}] ${addr} @ ${time}: "${msgText.slice(0, 100)}"`);
    }
  } catch (err: any) {
    console.log("Could not list messages:", err.message);
  }

  await client.close();

  console.log("\n==========================================");
  console.log("Agent phone number: +1 (415) 595-2874");
  console.log("Text this number from your iPhone to test!");
  console.log("==========================================");
}

async function checkAddress(address: string) {
  console.log(`Checking iMessage for: ${address}\n`);
  const client = await getRawClient();

  try {
    const available = await client.addresses.checkAvailability(address);
    console.log(`iMessage available: ${available}`);
    if (available) {
      const info = await client.addresses.get(address);
      console.log("Address info:", JSON.stringify(info, null, 2));
    }
  } catch (err: any) {
    console.log("Check failed:", err.message);
  }

  await client.close();
}

async function sendMessage(address: string, customText?: string) {
  console.log(`Sending message to: ${address}\n`);

  const app = await Spectrum({
    projectId: PROJECT_ID,
    projectSecret: PROJECT_SECRET,
    providers: [imessage.config()],
  });

  const im = imessage(app);
  const user = await im.user(address);
  const space = await im.space(user);

  const msg = customText || "Hello! This is a test from the Photon cloud agent.";
  await space.send(text(msg));
  console.log("Message sent!");

  await app.stop();
}

async function sendStartHelp(space: any) {
  await space.send(
    text(
      "Commands:\n" +
      "- 'done' - Mark today's goal as complete\n" +
      "- 'status' - Check status\n" +
      "- 'help' - Show this message"
    )
  );
}

async function handleStartCommand(space: any, message: any) {
  if (!CONVEX_URL) {
    await space.send(text("Missing CONVEX_URL in agent env. I can't create a room code yet."));
    console.log("  -> Missing CONVEX_URL\n");
    return;
  }

  try {
    const convex = new ConvexHttpClient(CONVEX_URL);
    const phoneNumbers = collectPhones(space as any, message as any);
    if (!phoneNumbers.length) {
      await space.send(
        text(
          "Couldn't detect group member phone numbers. Make sure this is a group iMessage thread."
        )
      );
      console.log("  -> No valid participant phones\n");
      return;
    }

    const result = await (convex as any).mutation("islands:createIsland", { phoneNumbers });
    const code = result.code as string;
    const gameLink = `http://localhost:5173/onboarding?code=${code}`;

    await space.send(text(`Island Habits started.\n\nRoom Code: ${code}\nJoin: ${gameLink}`));
    console.log(`  -> Created island code ${code}\n`);
  } catch (err: any) {
    await space.send(text("Failed to create room code. Try /start again."));
    console.log(`  -> /start error: ${err?.message ?? String(err)}\n`);
  }
}

async function handlePlainTextMessage(space: any, message: any, textBody: string) {
  const reply = textBody.toLowerCase();

  if (reply.trim() === "/start") {
    await handleStartCommand(space, message);
    return;
  }
  if (reply === "done" || reply === "completed") {
    await message.react(imessage.tapbacks.love);
    await space.send(text("Great job! Your goal has been marked as complete for today."));
    console.log("  -> Reacted + confirmed completion\n");
    return;
  }
  if (reply === "status") {
    await space.send(text("Status: 3 buildings complete, 2 under construction. Team motivation: 78/100."));
    console.log("  -> Sent status\n");
    return;
  }
  if (reply === "help") {
    await sendStartHelp(space);
    console.log("  -> Sent help\n");
    return;
  }

  await space.responding(async () => {
    await space.send(text(`Received: "${textBody}". Reply 'help' for commands.`));
  });
  console.log("  -> Echoed\n");
}

async function listenForMessages() { // NOSONAR
  console.log("=== Photon Agent - Listening Mode ===\n");
  console.log("Agent phone: +1 (415) 595-2874");
  console.log("Text that number from your iPhone to test.\n");
  console.log("Ctrl+C to stop.\n");

  const app = await Spectrum({
    projectId: PROJECT_ID,
    projectSecret: PROJECT_SECRET,
    providers: [imessage.config()],
  });

  console.log("Connected and waiting for messages...\n");

  for await (const [space, message] of app.messages) {
    const content = message.content[0];
    const time = message.timestamp.toLocaleTimeString();

    console.log(`[${time}] From: ${message.sender.id} | Space: ${space.id}`);

    if (content?.type === "plain_text") {
      console.log(`  Text: "${content.text}"`);
      await handlePlainTextMessage(space, message, content.text);
    } else if (content?.type === "attachment") {
      console.log(`  Attachment: ${content.name} (${content.mimeType})`);
      await space.send(text("Got your attachment!"));
      console.log("  -> Acknowledged\n");
    }
  }
}

async function createGroup(addresses: string[]) {
  console.log(`Creating group with: ${addresses.join(", ")}\n`);

  const app = await Spectrum({
    projectId: PROJECT_ID,
    projectSecret: PROJECT_SECRET,
    providers: [imessage.config()],
  });

  const im = imessage(app);
  const users = await Promise.all(addresses.map(addr => im.user(addr)));
  const group = await im.space(...users as [any, ...any[]]);

  console.log(`Group created: ${group.id}`);

  await group.send(text(
    "Welcome! Send /start to kick things off."
  ));
  console.log("Welcome message sent!");

  await app.stop();
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "info":
      await showInfo();
      break;
    case "check":
      if (!args[0]) { console.log("Usage: ... check +15551234567"); break; }
      await checkAddress(args[0]);
      break;
    case "send":
      if (!args[0]) { console.log("Usage: ... send +15551234567 [message]"); break; }
      await sendMessage(args[0], args.slice(1).join(" ") || undefined);
      break;
    case "listen":
      await listenForMessages();
      break;
    case "group":
      if (args.length < 2) { console.log("Usage: ... group +1XXX +1YYY [+1ZZZ]"); break; }
      await createGroup(args);
      break;
    default:
      console.log(`
Photon Agent - Cloud Test
=========================
Agent Phone: +1 (415) 595-2874

Commands:
  info                     Cloud instance details & recent messages
  check <phone>            Check if a number has iMessage
  send <phone> [msg]       Send a message to a phone number
  listen                   Listen for messages & auto-reply (interactive)
  group <phone1> <phone2>  Create a group chat

Examples:
  npx tsx scripts/test-photon-interactive.ts info
  npx tsx scripts/test-photon-interactive.ts check +15551234567
  npx tsx scripts/test-photon-interactive.ts send +15551234567 "Hello!"
  npx tsx scripts/test-photon-interactive.ts listen
  npx tsx scripts/test-photon-interactive.ts group +15551111111 +15552222222
`);
  }
}

main().catch(console.error);
