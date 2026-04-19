import http from "http";
import { text } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { convex } from "./router.js";

type SpectrumApp = Awaited<ReturnType<typeof import("./photon/app.js")["createApp"]>>;

export const PORT = 3001;

// Resolve an islandId to every phone on that island. Uses `islandMembers`
// (full roster, updated whenever anyone joins via iMessage OR the web) so
// a group announcement reaches the whole team instead of just the creator
// that ran /start. `groupRooms.participants` is only captured at /start
// time and doesn't include web-only joiners, so it's used as a last-resort
// fallback if islandMembers is empty.
async function phonesForIsland(islandId: string): Promise<string[]> {
  try {
    const details: { members?: { phoneNumber: string }[] } = await convex.query(
      "islands:getIslandDetails" as any,
      { islandId: islandId as any },
    );
    const phones = (details?.members ?? [])
      .map((m) => m.phoneNumber)
      .filter((p): p is string => typeof p === "string" && p.length > 0);
    if (phones.length) return phones;
  } catch (err) {
    console.error("[phonesForIsland] getIslandDetails failed:", err);
  }
  // Fallback: whatever /start captured.
  try {
    const room: { participants?: string[] } | null = await convex.query(
      "groupRooms:getByIsland" as any,
      { islandId: islandId as any },
    );
    return room?.participants ?? [];
  } catch {
    return [];
  }
}

function writeJson(res: http.ServerResponse, status: number, body: Record<string, unknown>) {
  res.writeHead(status).end(JSON.stringify(body));
}

async function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown> | null> {
  let body = "";
  for await (const chunk of req) body += chunk;
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function requireFields(
  payload: Record<string, unknown>,
  fields: string[],
): { ok: true } | { ok: false; missing: string[] } {
  const missing = fields.filter((field) => !payload[field]);
  if (missing.length > 0) {
    return { ok: false, missing };
  }
  return { ok: true };
}

async function sendDirect(im: any, payload: Record<string, unknown>) {
  const guard = requireFields(payload, ["to", "message"]);
  if (!guard.ok) {
    return { status: 400, body: { error: "to and message are required" } };
  }
  const user = await im.user(payload.to as string);
  const space = await im.space(user);
  await space.send(text(payload.message as string));
  console.log(`[agent/send] → ${payload.to as string} (${(payload.message as string).length} chars)`);
  return { status: 200, body: { ok: true } };
}

async function sendGroup(im: any, payload: Record<string, unknown>) {
  const guard = requireFields(payload, ["participants", "message"]);
  const participants = payload.participants as string[] | undefined;
  if (!guard.ok || !participants?.length) {
    return { status: 400, body: { error: "participants and message are required" } };
  }
  const users = await Promise.all(participants.map((p) => im.user(p)));
  const space = await im.space(...(users as [typeof users[0], ...typeof users]));
  await space.send(text(payload.message as string));
  console.log(`[agent/send-group] → ${participants.length} participants`);
  return { status: 200, body: { ok: true } };
}

async function sendIsland(im: any, payload: Record<string, unknown>) {
  const guard = requireFields(payload, ["islandId", "message"]);
  const islandId = payload.islandId as string | undefined;
  if (!guard.ok || !islandId) {
    return { status: 400, body: { error: "islandId and message are required" } };
  }
  const phones = await phonesForIsland(islandId);
  if (!phones.length) {
    return { status: 404, body: { error: "Island has no resolvable participants" } };
  }
  const users = await Promise.all(phones.map((p) => im.user(p)));
  const space = await im.space(...(users as [typeof users[0], ...typeof users]));
  await space.send(text(payload.message as string));
  console.log(`[agent/send-island] islandId=${islandId} participants=${phones.length} space=${space.id}`);
  return { status: 200, body: { ok: true, participants: phones.length, spaceId: space.id } };
}

export function startHttpServer(app: SpectrumApp): http.Server {
  const im = imessage(app);
  const handlers: Record<string, (payload: Record<string, unknown>) => Promise<{ status: number; body: Record<string, unknown> }>> = {
    "/send": (payload) => sendDirect(im, payload),
    "/send-group": (payload) => sendGroup(im, payload),
    "/send-island": (payload) => sendIsland(im, payload),
  };

  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST") {
      writeJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const handler = req.url ? handlers[req.url] : undefined;
    if (!handler) {
      writeJson(res, 404, { error: "Not found" });
      return;
    }

    const payload = await readJsonBody(req);
    if (!payload) {
      writeJson(res, 400, { error: "Invalid JSON" });
      return;
    }
    res.setHeader("Content-Type", "application/json");

    try {
      const result = await handler(payload);
      writeJson(res, result.status, result.body);
    } catch (err) {
      console.error("Send error:", err);
      writeJson(res, 500, { error: String(err) });
    }
  });

  server.listen(PORT, () => {
    console.log(`Agent HTTP server listening on port ${PORT}`);
  });

  return server;
}
