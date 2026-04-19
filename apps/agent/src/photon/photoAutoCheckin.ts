import {
  attachmentGuid,
  chatGuid,
  createClient,
  type AdvancedIMessage,
} from "@photon-ai/advanced-imessage";
import {
  PROJECT_ID,
  PROJECT_SECRET,
  autoCheckInFromPhoto,
  normalizeParticipantId,
} from "../router.js";

type TokenResponse =
  | { type: "shared"; token: string; expiresIn: number }
  | { type: "dedicated" | "multi"; auth: Record<string, string>; expiresIn: number };

const SPECTRUM_CLOUD_URL = `https://${process.env.SPECTRUM_CLOUD_URL ?? "spectrum.photon.codes"}`;
const TOKEN_EXPIRY_BUFFER_MS = 30_000;

async function issueImessageTokens(projectId: string, projectSecret: string): Promise<TokenResponse> {
  const auth = Buffer.from(`${projectId}:${projectSecret}`).toString("base64");
  const res = await fetch(`${SPECTRUM_CLOUD_URL}/projects/${projectId}/imessage/tokens`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    throw new Error(`token endpoint HTTP ${res.status}`);
  }
  const json = (await res.json()) as { succeed?: boolean; data?: TokenResponse };
  if (!json?.succeed || !json?.data) {
    throw new Error("token endpoint returned invalid payload");
  }
  return json.data;
}

async function createCloudAttachmentClient(projectId: string, projectSecret: string): Promise<AdvancedIMessage> {
  let tokenData = await issueImessageTokens(projectId, projectSecret);
  let tokenExpiresAt = Date.now() + tokenData.expiresIn * 1000;

  const refreshIfNeeded = async () => {
    if (Date.now() < tokenExpiresAt - TOKEN_EXPIRY_BUFFER_MS) return;
    tokenData = await issueImessageTokens(projectId, projectSecret);
    tokenExpiresAt = Date.now() + tokenData.expiresIn * 1000;
  };

  if (tokenData.type === "shared") {
    const address = process.env.SPECTRUM_IMESSAGE_ADDRESS ?? "imessage.spectrum.photon.codes:443";
    return createClient({
      address,
      tls: true,
      token: async () => {
        await refreshIfNeeded();
        return (tokenData as { token: string }).token;
      },
    });
  }

  const authMap = (tokenData as { auth: Record<string, string> }).auth;
  const first = Object.entries(authMap)[0];
  if (!first) throw new Error("no dedicated iMessage instance found in token response");
  const [instanceId] = first;
  return createClient({
    address: `${instanceId}.imsg.photon.codes:443`,
    tls: true,
    token: async () => {
      await refreshIfNeeded();
      const next = (tokenData as { auth: Record<string, string> }).auth[instanceId];
      if (!next) throw new Error(`missing token for instance ${instanceId}`);
      return next;
    },
  });
}

export async function startPhotoAutoCheckinWatcher(): Promise<never> {
  if (!PROJECT_ID || !PROJECT_SECRET) {
    throw new Error("Missing PHOTON_PROJECT_ID / PHOTON_SECRET for photo watcher");
  }

  const client = await createCloudAttachmentClient(PROJECT_ID, PROJECT_SECRET);
  const seen = new Set<string>();
  console.log("[photo] attachment watcher started");

  const sub = client.messages.subscribe("message.received");
  for await (const event of sub) {
    const msg = event.message;
    if (!msg || msg.isFromMe) continue;

    const sender = normalizeParticipantId(msg.sender?.address);
    if (!sender) continue;

    const imageAttachments = (msg.attachments ?? []).filter(
      (a) => Boolean(a.mimeType) && a.mimeType.startsWith("image/"),
    );
    if (!imageAttachments.length) continue;

    const dedupeKey = String(msg.guid);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    if (seen.size > 2000) seen.clear();

    for (const att of imageAttachments) {
      try {
        const bytes = await client.attachments.downloadBuffer(attachmentGuid(String(att.guid)));
        const base64 = Buffer.from(bytes).toString("base64");
        const result = await autoCheckInFromPhoto(
          sender,
          String(event.chatGuid),
          base64,
          att.mimeType || "image/jpeg",
        );
        if (!result.checkedIn || !result.reply) continue;

        await client.messages.send(chatGuid(String(event.chatGuid)), result.reply);
        console.log(`[photo] auto check-in sent for ${sender}`);
        break;
      } catch (err: any) {
        console.error("[photo] attachment auto check-in failed:", err?.message ?? err);
      }
    }
  }

  throw new Error("photo watcher stream ended unexpectedly");
}
