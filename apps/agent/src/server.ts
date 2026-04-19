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

export function startHttpServer(app: SpectrumApp): http.Server {
  const im = imessage(app);

  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405).end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    let body = "";
    for await (const chunk of req) body += chunk;

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400).end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    res.setHeader("Content-Type", "application/json");

    try {
      if (req.url === "/send") {
        const { to, message } = payload as { to: string; message: string };
        if (!to || !message) {
          res.writeHead(400).end(JSON.stringify({ error: "to and message are required" }));
          return;
        }
        const user = await im.user(to);
        const space = await im.space(user);
        await space.send(text(message));
        console.log(`[agent/send] → ${to} (${message.length} chars)`);
        res.writeHead(200).end(JSON.stringify({ ok: true }));

      } else if (req.url === "/send-group") {
        // Legacy: caller supplies the participant list directly. Still here
        // for back-compat, but callers should prefer /send-island so the
        // participant tuple is pinned server-side.
        const { participants, message } = payload as { participants: string[]; message: string };
        if (!participants?.length || !message) {
          res.writeHead(400).end(JSON.stringify({ error: "participants and message are required" }));
          return;
        }
        const users = await Promise.all(participants.map((p) => im.user(p)));
        const space = await im.space(...(users as [typeof users[0], ...typeof users]));
        await space.send(text(message));
        console.log(`[agent/send-group] → ${participants.length} participants`);
        res.writeHead(200).end(JSON.stringify({ ok: true }));

      } else if (req.url === "/send-island") {
        // Preferred group-send path: caller passes islandId, we resolve to
        // the same participant tuple that hosted /start. Two islands that
        // happen to share members can no longer collide onto one iMessage
        // thread because they have different groupRooms rows.
        const { islandId, message } = payload as { islandId: string; message: string };
        if (!islandId || !message) {
          res.writeHead(400).end(JSON.stringify({ error: "islandId and message are required" }));
          return;
        }
        const phones = await phonesForIsland(islandId);
        if (!phones.length) {
          res.writeHead(404).end(JSON.stringify({ error: "Island has no resolvable participants" }));
          return;
        }
        const users = await Promise.all(phones.map((p) => im.user(p)));
        const space = await im.space(...(users as [typeof users[0], ...typeof users]));
        await space.send(text(message));
        console.log(`[agent/send-island] islandId=${islandId} participants=${phones.length} space=${space.id}`);
        res.writeHead(200).end(JSON.stringify({ ok: true, participants: phones.length, spaceId: space.id }));

      } else {
        res.writeHead(404).end(JSON.stringify({ error: "Not found" }));
      }
    } catch (err) {
      console.error("Send error:", err);
      res.writeHead(500).end(JSON.stringify({ error: String(err) }));
    }
  });

  server.listen(PORT, () => {
    console.log(`Agent HTTP server listening on port ${PORT}`);
  });

  return server;
}
