import { Island, Goal, Agent, GoalLookup } from "./types.js";
import { convex } from "../router.js";

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
