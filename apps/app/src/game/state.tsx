import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import a1 from "@/assets/agent-1.png";
import a2 from "@/assets/agent-2.png";
import a3 from "@/assets/agent-3.png";
import a4 from "@/assets/agent-4.png";
import a5 from "@/assets/agent-5.png";

export type AgentId = string;
export type ScreenId = "island" | "build" | "chat" | "recap" | "history" | "checkin" | "expand" | "party" | "gossip" | null;
export type BuildingType = "house" | "garden" | "library" | "gym" | "lighthouse" | "fountain" | "bonfire" | "cabin" | "dock" | "shrine" | "windmill" | "treehouse" | "bakery" | "teahouse" | "observatory" | "belltower" | "zengarden" | "crystalgrotto" | "amphitheater" | "moongate";
export type DistrictId = "main" | "forest" | "beach" | "hill";

export const ISLAND_TIERS = [
  { era: 0, name: "Pine Hollow",    emoji: "🌿", environment: "spring",   unlockLevel: 0,  radius: 7.0,  fogColor: "#C8DFF0", skyTurbidity: 1.8, skyRayleigh: 0.8,  waterColor: "#3B8EBF", sunPos: [10,5,4] as [number,number,number], description: "Your first island — fresh grass and gentle breeze.", grassColor: "#7AB85A", cliffColor: "#7A6848", sandColor: "#D8C8A0" },
  { era: 1, name: "Amber Ridge",    emoji: "🍂", environment: "autumn",   unlockLevel: 10, radius: 8.5,  fogColor: "#D4A882", skyTurbidity: 3.5, skyRayleigh: 0.4,  waterColor: "#4A7A9B", sunPos: [6,2,8]  as [number,number,number], description: "Golden harvest warmth. A bigger canvas awaits.", grassColor: "#C07830", cliffColor: "#8B5E3C", sandColor: "#E0B878" },
  { era: 2, name: "Frostpeak Isle", emoji: "❄️", environment: "winter",   unlockLevel: 13, radius: 10.0, fogColor: "#C0D4E8", skyTurbidity: 0.8, skyRayleigh: 1.4,  waterColor: "#2A5878", sunPos: [4,3,10] as [number,number,number], description: "Snow-dusted peaks, crisp silence.", grassColor: "#B8CCE0", cliffColor: "#7888A0", sandColor: "#D8E4F0" },
  { era: 3, name: "Coral Cove",     emoji: "🌺", environment: "tropical", unlockLevel: 15, radius: 12.0, fogColor: "#A8D8E8", skyTurbidity: 1.2, skyRayleigh: 1.6,  waterColor: "#1A6B8B", sunPos: [8,8,2]  as [number,number,number], description: "Lush tropics, perpetual summer.", grassColor: "#3DAA60", cliffColor: "#6A7A40", sandColor: "#F0D898" },
] as const;
export type IslandEra = typeof ISLAND_TIERS[number];

export interface IslandSnapshot {
  era: number;
  name: string;
  emoji: string;
  buildings: Building[];
  level: number;
  coinsEarned: number;
  graduatedAt: string;
}

export interface Agent {
  id: AgentId;
  name: string;
  img: string;
  skin: string;
  shirt: string;
  pants: string;
  hair: string;
  hairStyle: "short" | "long" | "bun" | "cap";
  mood: number;
  line: string;
  goal: string;
  online: boolean;
  isYou?: boolean;
  home: [number, number];
}

export interface Building {
  id: string;
  type: BuildingType;
  pos: [number, number];
  rot?: number;
  district: DistrictId;
  score?: number;
  buildProgress: number;   // 0 = just placed, 1 = complete
  buildTime: number;       // total days needed (from BUILD_LIBRARY.buildDays)
  placedAtEra?: number;    // graduation era at placement (0 = Pine Hollow …)
}

export interface BuildOption {
  type: BuildingType;
  name: string;
  cost: number;          // legacy — kept for reference only
  logCost: number;
  rockCost: number;
  radius: number;        // footprint radius in world units
  emoji: string;
  district: DistrictId;
  locked?: string | null;  // kept for custom messages; prefer unlockLevel
  unlockLevel?: number;    // player level required to unlock
  buildDays: number;
  // Islanders-style placement scoring
  rules: {
    likes?: { type: BuildingType | "tree" | "rock" | "water" | "flower"; range: number; pts: number }[];
    dislikes?: { type: BuildingType | "tree" | "rock" | "water" | "flower"; range: number; pts: number }[];
  };
}

export const BUILD_LIBRARY: BuildOption[] = [
  // ── Lv 0 starters ──────────────────────────────────────────────────────────
  { type: "house", name: "Cottage", cost: 120, logCost: 8, rockCost: 4, radius: 0.55, emoji: "🏠", district: "main", buildDays: 3,
    rules: { likes: [{ type: "tree", range: 1.5, pts: 2 }, { type: "fountain", range: 2, pts: 4 }, { type: "garden", range: 1.5, pts: 3 }],
             dislikes: [{ type: "gym", range: 1.5, pts: -3 }, { type: "bonfire", range: 1.2, pts: -2 }] } },
  { type: "garden", name: "Garden", cost: 80, logCost: 4, rockCost: 2, radius: 0.4, emoji: "🌷", district: "main", buildDays: 1,
    rules: { likes: [{ type: "house", range: 1.5, pts: 3 }, { type: "fountain", range: 2, pts: 5 }, { type: "tree", range: 1.5, pts: 2 }] } },
  { type: "bonfire", name: "Bonfire", cost: 60, logCost: 6, rockCost: 0, radius: 0.4, emoji: "🔥", district: "main", buildDays: 1,
    rules: { likes: [{ type: "tree", range: 2, pts: 1 }],
             dislikes: [{ type: "house", range: 1.2, pts: -2 }, { type: "library", range: 1.5, pts: -3 }] } },
  // ── Lv 2 ───────────────────────────────────────────────────────────────────
  { type: "bakery", name: "Bakery", cost: 110, logCost: 6, rockCost: 4, radius: 0.5, emoji: "🥐", district: "main", buildDays: 2, unlockLevel: 2,
    rules: { likes: [{ type: "house", range: 1.5, pts: 4 }, { type: "garden", range: 1.5, pts: 3 }, { type: "fountain", range: 2, pts: 2 }],
             dislikes: [{ type: "gym", range: 1.5, pts: -2 }] } },
  // ── Lv 3 ───────────────────────────────────────────────────────────────────
  { type: "cabin", name: "Forest Cabin", cost: 180, logCost: 12, rockCost: 2, radius: 0.55, emoji: "🛖", district: "forest", buildDays: 3, unlockLevel: 3,
    rules: { likes: [{ type: "tree", range: 1.5, pts: 4 }, { type: "cabin", range: 2.5, pts: 2 }] } },
  { type: "dock", name: "Wooden Dock", cost: 140, logCost: 10, rockCost: 2, radius: 0.6, emoji: "⚓", district: "beach", buildDays: 2, unlockLevel: 3,
    rules: { likes: [{ type: "water", range: 2, pts: 6 }] } },
  // ── Lv 4 ───────────────────────────────────────────────────────────────────
  { type: "fountain", name: "Fountain", cost: 160, logCost: 2, rockCost: 10, radius: 0.55, emoji: "⛲", district: "main", buildDays: 3, unlockLevel: 4,
    rules: { likes: [{ type: "house", range: 2, pts: 3 }, { type: "garden", range: 2, pts: 5 }, { type: "library", range: 2, pts: 3 }] } },
  { type: "teahouse", name: "Tea House", cost: 150, logCost: 8, rockCost: 4, radius: 0.55, emoji: "🍵", district: "forest", buildDays: 3, unlockLevel: 4,
    rules: { likes: [{ type: "tree", range: 1.5, pts: 4 }, { type: "garden", range: 2, pts: 3 }, { type: "rock", range: 1.5, pts: 2 }],
             dislikes: [{ type: "gym", range: 2, pts: -3 }, { type: "bonfire", range: 1.5, pts: -2 }] } },
  // ── Lv 5 ───────────────────────────────────────────────────────────────────
  { type: "gym", name: "Gym Hut", cost: 200, logCost: 4, rockCost: 10, radius: 0.6, emoji: "🏋️", district: "main", buildDays: 4, unlockLevel: 5,
    rules: { likes: [{ type: "fountain", range: 2, pts: 3 }, { type: "rock", range: 1.5, pts: 2 }],
             dislikes: [{ type: "house", range: 1.5, pts: -3 }, { type: "library", range: 2, pts: -5 }] } },
  { type: "zengarden", name: "Zen Garden", cost: 130, logCost: 2, rockCost: 8, radius: 0.5, emoji: "🪨", district: "forest", buildDays: 2, unlockLevel: 5,
    rules: { likes: [{ type: "shrine", range: 2.5, pts: 5 }, { type: "tree", range: 1.5, pts: 3 }, { type: "rock", range: 1.5, pts: 3 }, { type: "flower", range: 1.5, pts: 2 }],
             dislikes: [{ type: "gym", range: 2, pts: -4 }, { type: "bonfire", range: 1.5, pts: -3 }] } },
  // ── Lv 6 ───────────────────────────────────────────────────────────────────
  { type: "library", name: "Library", cost: 240, logCost: 10, rockCost: 8, radius: 0.7, emoji: "📚", district: "main", buildDays: 5, unlockLevel: 6,
    rules: { likes: [{ type: "tree", range: 2, pts: 3 }, { type: "garden", range: 2, pts: 4 }],
             dislikes: [{ type: "gym", range: 2, pts: -5 }, { type: "bonfire", range: 1.5, pts: -3 }] } },
  { type: "observatory", name: "Observatory", cost: 220, logCost: 4, rockCost: 14, radius: 0.6, emoji: "🔭", district: "hill", buildDays: 5, unlockLevel: 6,
    rules: { likes: [{ type: "rock", range: 2, pts: 4 }, { type: "tree", range: 2, pts: 2 }, { type: "water", range: 3, pts: 3 }],
             dislikes: [{ type: "bonfire", range: 2, pts: -4 }] } },
  // ── Lv 7 ───────────────────────────────────────────────────────────────────
  { type: "shrine", name: "Hill Shrine", cost: 320, logCost: 6, rockCost: 12, radius: 0.55, emoji: "⛩️", district: "hill", buildDays: 4, unlockLevel: 7,
    rules: { likes: [{ type: "tree", range: 2, pts: 3 }, { type: "rock", range: 2, pts: 3 }] } },
  { type: "belltower", name: "Bell Tower", cost: 190, logCost: 8, rockCost: 8, radius: 0.5, emoji: "🔔", district: "main", buildDays: 4, unlockLevel: 7,
    rules: { likes: [{ type: "shrine", range: 3, pts: 5 }, { type: "house", range: 2, pts: 3 }, { type: "garden", range: 2, pts: 2 }],
             dislikes: [{ type: "windmill", range: 2, pts: -2 }] } },
  { type: "windmill", name: "Windmill", cost: 360, logCost: 14, rockCost: 4, radius: 0.65, emoji: "🌬️", district: "main", buildDays: 5, unlockLevel: 7,
    rules: { likes: [{ type: "garden", range: 2.5, pts: 5 }, { type: "house", range: 2.5, pts: 3 }],
             dislikes: [{ type: "library", range: 2, pts: -2 }] } },
  // ── Lv 8 ───────────────────────────────────────────────────────────────────
  { type: "treehouse", name: "Treehouse", cost: 280, logCost: 16, rockCost: 2, radius: 0.55, emoji: "🌳", district: "main", buildDays: 4, unlockLevel: 8,
    rules: { likes: [{ type: "tree", range: 1.2, pts: 6 }, { type: "flower", range: 1.5, pts: 2 }],
             dislikes: [{ type: "bonfire", range: 1.5, pts: -4 }] } },
  // ── Lv 9 ───────────────────────────────────────────────────────────────────
  { type: "crystalgrotto", name: "Crystal Grotto", cost: 350, logCost: 4, rockCost: 18, radius: 0.6, emoji: "💎", district: "hill", buildDays: 6, unlockLevel: 9,
    rules: { likes: [{ type: "rock", range: 2, pts: 5 }, { type: "shrine", range: 2.5, pts: 4 }, { type: "fountain", range: 2, pts: 3 }],
             dislikes: [{ type: "bonfire", range: 2, pts: -3 }, { type: "gym", range: 1.5, pts: -2 }] } },
  // ── Lv 10 ──────────────────────────────────────────────────────────────────
  { type: "lighthouse", name: "Lighthouse", cost: 800, logCost: 12, rockCost: 20, radius: 0.7, emoji: "🗼", district: "beach", buildDays: 7, unlockLevel: 10,
    rules: { likes: [{ type: "water", range: 3, pts: 8 }, { type: "dock", range: 2.5, pts: 4 }] } },
  // ── Lv 11 ──────────────────────────────────────────────────────────────────
  { type: "amphitheater", name: "Amphitheater", cost: 420, logCost: 10, rockCost: 16, radius: 0.8, emoji: "🎭", district: "main", buildDays: 7, unlockLevel: 11,
    rules: { likes: [{ type: "fountain", range: 2.5, pts: 4 }, { type: "garden", range: 2, pts: 3 }, { type: "house", range: 2, pts: 2 }],
             dislikes: [{ type: "library", range: 2, pts: -4 }] } },
  // ── Lv 13 ──────────────────────────────────────────────────────────────────
  { type: "moongate", name: "Moon Gate", cost: 560, logCost: 8, rockCost: 20, radius: 0.65, emoji: "🌙", district: "beach", buildDays: 8, unlockLevel: 13,
    rules: { likes: [{ type: "water", range: 2.5, pts: 5 }, { type: "shrine", range: 3, pts: 6 }, { type: "rock", range: 2, pts: 3 }],
             dislikes: [{ type: "bonfire", range: 2, pts: -3 }, { type: "gym", range: 2, pts: -2 }] } },
];

export interface District {
  id: DistrictId;
  name: string;
  emoji: string;
  unlocked: boolean;
  unlockCost: number;
  unlockLevel: number;
  // World position of district center
  center: [number, number];
  radius: number;
  color: string;
  description: string;
}

export const DISTRICTS: District[] = [
  { id: "main",   name: "Pine Hollow",     emoji: "🏝️", unlocked: true,  unlockCost: 0,    unlockLevel: 0,  center: [0, 0],        radius: 7.0, color: "#7AB85A", description: "Your starting island — grass and gentle hills." },
  { id: "forest", name: "Whispering Wood", emoji: "🌲", unlocked: false, unlockCost: 600,  unlockLevel: 12, center: [-15.0, -2.5], radius: 5.0, color: "#3F7A3F", description: "Dense pines & moss. Unlocks forest cabins." },
  { id: "beach",  name: "Coral Cove",      emoji: "🏖️", unlocked: false, unlockCost: 900,  unlockLevel: 14, center: [14.5, 3.0],   radius: 5.2, color: "#EFD9A8", description: "Warm sand & shallow water. Unlocks docks & lighthouse." },
  { id: "hill",   name: "Stoneview Peak",  emoji: "⛰️", unlocked: false, unlockCost: 1400, unlockLevel: 16, center: [2.5, 15.5],   radius: 4.8, color: "#9B8E7E", description: "Rocky highland with old shrines." },
];

export interface Goal { id: string; text: string; done: boolean; reward: number; photo?: boolean; }
export interface ChatMsg { from: "agent" | "you"; text: string; ts: number; }

// ── Decoration scenery (trees/rocks/flowers) — used for placement scoring ──
export interface Scenery { id: string; type: "tree" | "rock" | "flower"; pos: [number, number]; district: DistrictId; variant: number; }

type ConvexSyncPatch = Partial<
  Pick<GameState, "level" | "xp" | "coins" | "logs" | "rocks" | "streak" | "dayCount" | "islandEra" | "agents" | "buildings" | "goals">
> & {
  serverNowMs?: number;
};

interface GameState {
  screen: ScreenId;
  setScreen: (s: ScreenId) => void;
  selectedAgent: AgentId;
  setSelectedAgent: (id: AgentId) => void;
  coins: number;
  logs: number;
  rocks: number;
  streak: number;
  dayCount: number;
  level: number;
  xp: number;
  agents: Agent[];
  buildings: Building[];
  scenery: Scenery[];
  goals: Goal[];

  // Island era / graduation
  islandEra: number;
  islandHistory: IslandSnapshot[];
  isTransitioning: boolean;
  graduateIsland: () => void;
  canGraduate: boolean;

  // Visiting past islands
  viewingEra: number | null;
  setViewingEra: (era: number | null) => void;
  isVisiting: boolean;
  visitIsland: (era: number | null) => void;

  // Free-placement build flow
  placingType: BuildingType | null;
  setPlacingType: (t: BuildingType | null) => void;
  placeBuildingAt: (pos: [number, number], rot?: number) => boolean;
  cancelPlacing: () => void;

  completeGoal: (id: string) => void;
  addGoal: (text: string, reward: number, photo?: boolean) => void;
  editGoal: (id: string, text: string, reward: number, photo?: boolean) => void;
  deleteGoal: (id: string) => void;
  pendingCheckIn: Goal | null;
  setPendingCheckIn: (g: Goal | null) => void;
  chats: Record<string, ChatMsg[]>;
  sendChat: (id: AgentId, text: string) => void;
  toast: string | null;
  showToast: (msg: string) => void;
  islandName: string;
  islandId: string | null;
  phoneNumber: string | null;
  timeOffsetMs: number;
  trackAgent: boolean;
  setTrackAgent: (v: boolean) => void;
  audioMuted: boolean;
  setAudioMuted: (v: boolean) => void;
  syncFromConvex: (patch: ConvexSyncPatch) => void;

  // Dev controls (desktop only)
  devNextDay: () => void;       // ☀️✓ good day — all goals done, mood up
  devNextDayBad: () => void;    // ☀️✗ bad day  — no goals done, mood down
  devLevelUp: () => void;

  // Real-time build progress (called by BuildTicker in scene)
  tickBuildings: (delta: number) => void;

  // Derived motivation value: 0–1, computed from agent moods + online fraction
  groupMotivation: number;
}

export interface GameBootstrapData {
  islandName?: string;
  islandId?: string;
  phoneNumber?: string;
  coins?: number;
  streak?: number;
  dayCount?: number;
  level?: number;
  xp?: number;
  agents?: Agent[];
  goals?: Goal[];
  buildings?: Building[];
  serverNowMs?: number;
  onBuildingPlaced?: (type: string, x: number, y: number, cost: number, days: number, logCost?: number, rockCost?: number) => void | Promise<unknown>;
  onGoalCompleted?: (goalId: string) => void | Promise<void>;
  onDevNextDay?: () => void | Promise<void>;
  onDevNextDayBad?: () => void | Promise<void>;
  onDevLevelUp?: () => void | Promise<void>;
  onGraduateEra?: () => void | Promise<unknown>;
  islandEra?: number;
}

const Ctx = createContext<GameState | null>(null);
export const GameCtx = Ctx;

// How many real seconds make up 1 in-game day.
// At 100% motivation: a 3-day building takes 3 × GAME_DAY_SECS real seconds.
// For the demo this is 2 minutes so buildings feel snappy but still meaningful.
export const GAME_DAY_SECS = 120;

const initialAgents: Agent[] = [
  { id: "sofia",  name: "Sofia",  img: a5, skin: "#F4D7B5", shirt: "#7AC5A0", pants: "#3A4A6B", hair: "#3B2820", hairStyle: "long",  mood: 76, line: "Hydrating!",         goal: "2L water", online: true, isYou: true, home: [  0.5,  -1.2] },
  { id: "kael",   name: "Kael",   img: a1, skin: "#E8C29A", shirt: "#6FA8DC", pants: "#2A3550", hair: "#1F1410", hairStyle: "cap",   mood: 84, line: "Let's lift today!", goal: "Gym 45m",  online: true,              home: [ -2.5,  -0.5] },
  { id: "theo",   name: "Theo",   img: a2, skin: "#F4D7B5", shirt: "#C9A0E0", pants: "#5A4030", hair: "#5A3820", hairStyle: "short", mood: 62, line: "Reading slowly...", goal: "Read 15p", online: true,              home: [  2.0,   1.5] },
  { id: "mei",    name: "Mei",    img: a3, skin: "#EFC9A0", shirt: "#E58F7B", pants: "#3A2A40", hair: "#0F0A08", hairStyle: "bun",   mood: 41, line: "Need a walk.",      goal: "Walk 20m", online: false,             home: [ -1.0,   2.0] },
  { id: "jordan", name: "Jordan", img: a4, skin: "#D9A878", shirt: "#F2C46C", pants: "#3A2A1A", hair: "#2A1810", hairStyle: "short", mood: 91, line: "On a roll!",        goal: "Sleep 8h", online: true,              home: [  1.5,  -2.0] },
];

const initialBuildings: Building[] = [];

// Pre-seeded scenery for the main island
const initialScenery: Scenery[] = [
  // main island trees
  { id: "t1", type: "tree", pos: [ 2.7,  1.9], district: "main", variant: 0 },
  { id: "t2", type: "tree", pos: [-2.8, -1.4], district: "main", variant: 1 },
  { id: "t3", type: "tree", pos: [-2.5,  2.2], district: "main", variant: 0 },
  { id: "t4", type: "tree", pos: [ 2.5, -2.4], district: "main", variant: 2 },
  { id: "t5", type: "tree", pos: [ 0.3, -2.8], district: "main", variant: 1 },
  { id: "t6", type: "tree", pos: [-0.3,  2.7], district: "main", variant: 0 },
  // rocks
  { id: "r1", type: "rock", pos: [ 2.9,  0.0], district: "main", variant: 0 },
  { id: "r2", type: "rock", pos: [-2.9,  0.6], district: "main", variant: 1 },
  { id: "r3", type: "rock", pos: [ 0.6,  2.9], district: "main", variant: 0 },
  // flowers
  { id: "f1", type: "flower", pos: [-1.5, -1.8], district: "main", variant: 0 },
  { id: "f2", type: "flower", pos: [ 1.4, -0.5], district: "main", variant: 1 },
  { id: "f3", type: "flower", pos: [-0.2,  1.6], district: "main", variant: 2 },
];

const initialGoals: Goal[] = [
  { id: "g1", text: "Morning meditation",  done: true,  reward: 20 },
  { id: "g2", text: "Drink 2L of water",   done: false, reward: 15, photo: true },
  { id: "g3", text: "Read 15 pages",       done: false, reward: 25 },
  { id: "g4", text: "Sleep before 11pm",   done: false, reward: 30 },
];

const seedChats = (agents: Agent[]): Record<string, ChatMsg[]> =>
  Object.fromEntries(
    agents.map((agent) => [
      agent.id,
      [{ from: "agent", text: `Hey ${agent.name}, ready to level up today?`, ts: Date.now() } satisfies ChatMsg],
    ]),
  );

const dist = (a: [number, number], b: [number, number]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);

// Detect which district a world position belongs to
export const districtAt = (pos: [number, number], districts: District[]): DistrictId | null => {
  for (const d of districts) {
    if (!d.unlocked) continue;
    if (dist(pos, d.center) <= d.radius) return d.id;
  }
  return null;
};

// Compute placement score for a building at pos
export const scorePlacement = (
  type: BuildingType,
  pos: [number, number],
  buildings: Building[],
  scenery: Scenery[],
  islandRadius: number = 7.0,
): { score: number; valid: boolean; reason?: string; breakdown: { label: string; pts: number }[] } => {
  const opt = BUILD_LIBRARY.find((b) => b.type === type);
  if (!opt) return { score: 0, valid: false, reason: "Unknown", breakdown: [] };

  // Must be within island radius
  if (Math.hypot(pos[0], pos[1]) > islandRadius) {
    return { score: 0, valid: false, reason: "Outside island", breakdown: [] };
  }

  // Collision check
  for (const b of buildings) {
    const other = BUILD_LIBRARY.find((x) => x.type === b.type)!;
    if (dist(b.pos, pos) < opt.radius + other.radius) {
      return { score: 0, valid: false, reason: "Too close", breakdown: [] };
    }
  }

  // Score by rules
  const breakdown: { label: string; pts: number }[] = [];
  let score = 0;
  const apply = (rules: NonNullable<BuildOption["rules"]["likes"]>, sign: 1 | -1) => {
    for (const r of rules) {
      let count = 0;
      if (r.type === "tree" || r.type === "rock" || r.type === "flower") {
        count = scenery.filter((s) => s.type === r.type && dist(s.pos, pos) <= r.range).length;
      } else if (r.type === "water") {
        // water = anywhere near island edge
        const samples = 8;
        for (let i = 0; i < samples; i++) {
          const a = (i / samples) * Math.PI * 2;
          const sp: [number, number] = [pos[0] + Math.cos(a) * r.range, pos[1] + Math.sin(a) * r.range];
          if (Math.hypot(sp[0], sp[1]) > islandRadius) { count++; break; }
        }
      } else {
        count = buildings.filter((b) => b.type === r.type && dist(b.pos, pos) <= r.range).length;
      }
      if (count > 0) {
        const pts = r.pts * count;
        score += pts;
        breakdown.push({ label: `${sign > 0 ? "♥" : "✗"} ${r.type} ×${count}`, pts });
      }
    }
  };
  if (opt.rules.likes) apply(opt.rules.likes, 1);
  if (opt.rules.dislikes) apply(opt.rules.dislikes, -1);

  return { score, valid: true, breakdown };
};

export const GameProvider = ({
  children,
  initialData,
}: {
  children: ReactNode;
  initialData?: GameBootstrapData;
}) => {
  const seededIslandName = initialData?.islandName ?? "Pine Hollow";
  const seededAgents = initialData ? (initialData.agents ?? []) : initialAgents;
  const seededGoals = initialData ? (initialData.goals ?? []) : initialGoals;
  const onBuildingPlacedRef = useRef(initialData?.onBuildingPlaced);
  const onGoalCompletedRef = useRef(initialData?.onGoalCompleted);
  const onDevNextDayRef = useRef(initialData?.onDevNextDay);
  const onDevNextDayBadRef = useRef(initialData?.onDevNextDayBad);
  const onDevLevelUpRef = useRef(initialData?.onDevLevelUp);
  const onGraduateEraRef = useRef(initialData?.onGraduateEra);

  // Keep callback refs in sync when the host (IslandPage) memoizes a new
  // bootstrap object — useRef only captures the first render's value.
  useEffect(() => {
    onBuildingPlacedRef.current = initialData?.onBuildingPlaced;
    onGoalCompletedRef.current = initialData?.onGoalCompleted;
    onDevNextDayRef.current = initialData?.onDevNextDay;
    onDevNextDayBadRef.current = initialData?.onDevNextDayBad;
    onDevLevelUpRef.current = initialData?.onDevLevelUp;
    onGraduateEraRef.current = initialData?.onGraduateEra;
  }, [initialData]);

  const [screen, setScreen] = useState<ScreenId>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentId>(seededAgents[0]?.id ?? "sofia");
  const [coins, setCoins] = useState(initialData?.coins ?? 0);
  const [logs, setLogs] = useState(initialData?.logs ?? 0);
  const [rocks, setRocks] = useState(initialData?.rocks ?? 0);
  const [streak, setStreak] = useState(initialData?.streak ?? 0);
  const [dayCount, setDayCount] = useState(initialData?.dayCount ?? 1);
  const [level, setLevel] = useState(initialData?.level ?? 1);
  const [xp, setXp] = useState(initialData?.xp ?? 0);
  const [islandId] = useState<string | null>(initialData?.islandId ?? null);
  const [phoneNumber] = useState<string | null>(initialData?.phoneNumber ?? null);
  const [timeOffsetMs, setTimeOffsetMs] = useState<number>(
    initialData?.serverNowMs ? initialData.serverNowMs - Date.now() : 0
  );
  const [agents, setAgents] = useState<Agent[]>(seededAgents);
  const [buildings, setBuildings] = useState<Building[]>(initialData?.buildings ?? initialBuildings);
  const [scenery] = useState<Scenery[]>(initialScenery);
  const [goals, setGoals] = useState<Goal[]>(seededGoals);
  const [placingType, setPlacingType] = useState<BuildingType | null>(null);
  const [pendingCheckIn, setPendingCheckIn] = useState<Goal | null>(null);
  const [chats, setChats] = useState<Record<string, ChatMsg[]>>(() => seedChats(seededAgents));
  const [toast, setToast] = useState<string | null>(null);
  const [islandName] = useState(seededIslandName);

  // Island era state — start on era 0 (Pine Hollow) with no history.
  // islandHistory is derived below so every client (not just the one who
  // clicked Fly) can open the visit UI for past eras.
  const [islandEra, setIslandEra] = useState(initialData?.islandEra ?? 0);
  const [trackAgent, setTrackAgent] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isVisiting, setIsVisiting] = useState(false);
  const [viewingEra, setViewingEra] = useState<number | null>(null);
  const [audioMuted, setAudioMuted] = useState(true);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }, []);

  const syncFromConvex = useCallback((patch: ConvexSyncPatch) => {
    if (patch.level !== undefined) setLevel(patch.level);
    if (patch.xp !== undefined) setXp(patch.xp);
    if (patch.coins !== undefined) setCoins(patch.coins);
    if (patch.logs !== undefined) setLogs(patch.logs);
    if (patch.rocks !== undefined) setRocks(patch.rocks);
    if (patch.streak !== undefined) setStreak(patch.streak);
    if (patch.dayCount !== undefined) setDayCount(patch.dayCount);
    if (patch.islandEra !== undefined) setIslandEra(patch.islandEra);
    if (patch.serverNowMs !== undefined) {
      setTimeOffsetMs(patch.serverNowMs - Date.now());
    }
    if (patch.agents !== undefined) {
      setAgents((prev) => {
        const prevById = new Map(prev.map((agent) => [agent.id, agent]));
        return patch.agents!.map((incoming) => {
          const existing = prevById.get(incoming.id);
          const { home: _home, ...rest } = incoming;
          return {
            ...(existing ?? incoming),
            ...rest,
            // Only set home on first appearance; never overwrite so agents don't teleport
            home: existing?.home ?? incoming.home,
          };
        });
      });
    }
    if (patch.buildings !== undefined) {
      if (islandId) {
        // In Convex mode, server is authoritative for placement and progress.
        setBuildings(patch.buildings);
      } else {
        setBuildings((prev) =>
          patch.buildings!.map((incoming) => {
            const local = prev.find((b) => b.id === incoming.id);
            return local
              ? { ...incoming, buildProgress: Math.max(local.buildProgress, incoming.buildProgress) }
              : incoming;
          }),
        );
      }
    }
    if (patch.goals !== undefined) setGoals(patch.goals);
  }, [islandId]);

  const graduateIsland = useCallback(() => {
    const next = ISLAND_TIERS[islandEra + 1];
    if (!next) return;
    if (level < next.unlockLevel) { showToast(`Need Lv.${next.unlockLevel}`); return; }
    setIsTransitioning(true);
    // In Convex mode, the era is the source of truth — mutating it on the
    // server makes old-era buildings stay parked (placedAtEra < new era) and
    // the new era start empty. Local state gets re-synced by ConvexSyncBridge.
    const persist = onGraduateEraRef.current;
    const finishLocal = () => {
      if (!islandId) {
        // Offline/demo path: mutate local state since there is no server.
        setIslandEra(islandEra + 1);
        setBuildings([]);
      }
      setScreen(null);
      setIsTransitioning(false);
      showToast(`🏝️ Welcome to ${next.name}!`);
    };
    if (persist) {
      Promise.resolve(persist())
        .then(() => setTimeout(finishLocal, 1200))
        .catch((err) => {
          console.error("Failed to graduate era", err);
          setIsTransitioning(false);
          showToast(err instanceof Error ? err.message : "Failed to graduate");
        });
    } else {
      setTimeout(finishLocal, 1200);
    }
  }, [islandEra, buildings, level, coins, islandId, showToast]);

  const placeBuildingAt = useCallback((pos: [number, number]): boolean => {
    if (!placingType) return false;
    const opt = BUILD_LIBRARY.find((b) => b.type === placingType)!;
    const currentRadius = ISLAND_TIERS[islandEra].radius;
    const result = scorePlacement(placingType, pos, buildings, scenery, currentRadius);
    if (!result.valid) { showToast(result.reason || "Can't place here"); return false; }
    const pendingId = `pending-${Date.now()}`;
    setPlacingType(null);
    setBuildings((bs) => [
      ...bs,
      {
        id: pendingId,
        type: placingType,
        pos,
        district: "main",
        score: result.score,
        buildProgress: 0,
        buildTime: opt.buildDays,
      },
    ]);

    const persist = onBuildingPlacedRef.current;
    if (!persist) {
      showToast(`+${result.score} harmony · ${opt.name} built!`);
      return true;
    }

    showToast(`Placing ${opt.name}...`);
    Promise.resolve(persist(placingType, pos[0], pos[1], opt.cost, opt.buildDays, opt.logCost, opt.rockCost))
      .then(() => {
        // Convex sync bridge will replace pending entries with canonical records.
        showToast(`+${result.score} harmony · ${opt.name} built!`);
      })
      .catch((err) => {
        console.error("Failed to persist building placement", err);
        setBuildings((bs) => bs.filter((b) => b.id !== pendingId));
        const message = err instanceof Error ? err.message : "Failed to place building";
        showToast(message);
      });

    return true;
  }, [placingType, buildings, scenery, islandEra, showToast]);

  const cancelPlacing = useCallback(() => setPlacingType(null), []);

  // Animated island visit (with flight transition)
  const visitIsland = useCallback((era: number | null) => {
    setIsVisiting(true);
    setTimeout(() => {
      setViewingEra(era);
      setIsVisiting(false);
    }, 900);
  }, []);

  // Derived: history of past eras, built from the current era. Every client
  // (not just the one who clicked Fly) can open the visit UI for any era
  // they've already graduated past, because era lives on the server.
  const islandHistory = useMemo<IslandSnapshot[]>(() => {
    const entries: IslandSnapshot[] = [];
    for (let era = 0; era < islandEra; era += 1) {
      const tier = ISLAND_TIERS[era];
      if (!tier) continue;
      entries.push({
        era,
        name: tier.name,
        emoji: tier.emoji,
        buildings: [],        // visit view fetches its own snapshot
        level: 0,
        coinsEarned: 0,
        graduatedAt: "",
      });
    }
    return entries;
  }, [islandEra]);

  // Derived: group motivation factor (0–1). Used by ticker + UI.
  const groupMotivation = useMemo(() => {
    if (agents.length === 0) return 0;
    const avgMood = agents.reduce((s, a) => s + a.mood, 0) / agents.length;
    const onlineFrac = agents.filter(a => a.online).length / agents.length;
    return Math.max(0, (avgMood - 20) / 80) * onlineFrac;
  }, [agents]);

  // Real-time build ticker — called every ~1s by BuildTicker in the scene
  // Formula: motFactor = max(0, (avgMood - 20) / 80) × onlineFraction
  //          progressPerSec = motFactor / (buildTime × 30)
  const tickBuildings = useCallback((delta: number) => {
    if (islandId) {
      return;
    }
    setBuildings(bs => {
      const hasUnfinished = bs.some(b => b.buildProgress < 1);
      if (!hasUnfinished) return bs;

      let anyCompleted = false;
      const next = bs.map(b => {
        if (b.buildProgress >= 1) return b;
        // 1 game-day of progress (at full motivation) = 1/buildTime per day
        // Real rate: progressPerSec = groupMotivation / (buildTime * GAME_DAY_SECS)
        const progressPerSec = groupMotivation / (Math.max(1, b.buildTime) * GAME_DAY_SECS);
        const newProgress = Math.min(1, b.buildProgress + progressPerSec * delta);
        if (newProgress >= 1 && b.buildProgress < 1) anyCompleted = true;
        return { ...b, buildProgress: newProgress };
      });

      if (anyCompleted) {
        setTimeout(() => showToast("🏗️ Building complete!"), 0);
      }
      return next;
    });
  }, [groupMotivation, showToast]);

  // Dev controls
  // ☀️✓ Good day: all goals get done → mood boost, streak up, coins earned
  const devNextDay = useCallback(() => {
    if (islandId && onDevNextDayRef.current) {
      showToast("Syncing good day...");
      Promise.resolve(onDevNextDayRef.current())
        .then(() => showToast("☀️ Great day synced"))
        .catch((err) => {
          console.error("Failed to sync good day", err);
          showToast(err instanceof Error ? err.message : "Failed to sync good day");
        });
      return;
    }
    if (islandId) {
      showToast("Good day action is unavailable in synced mode.");
      return;
    }
    setGoals(gs => gs.map(g => ({ ...g, done: true })));
    setStreak(s => s + 1);
    setDayCount((d) => d + 1);
    setCoins(c => c + 50);
    setAgents(as => as.map(a => a.isYou ? { ...a, mood: Math.min(100, a.mood + 8) } : a));
    showToast("☀️ Great day! All goals done · mood +8 · +50 coins");
    // Reset for tomorrow after toast
    setTimeout(() => setGoals(gs => gs.map(g => ({ ...g, done: false }))), 400);
  }, [showToast]);

  // ☀️✗ Bad day: goals not done → mood drops, streak breaks
  const devNextDayBad = useCallback(() => {
    if (islandId && onDevNextDayBadRef.current) {
      showToast("Syncing bad day...");
      Promise.resolve(onDevNextDayBadRef.current())
        .then(() => showToast("😞 Bad day synced"))
        .catch((err) => {
          console.error("Failed to sync bad day", err);
          showToast(err instanceof Error ? err.message : "Failed to sync bad day");
        });
      return;
    }
    if (islandId) {
      showToast("Bad day action is unavailable in synced mode.");
      return;
    }
    setGoals(gs => gs.map(g => ({ ...g, done: false }))); // stays incomplete
    setStreak(0); // streak breaks
    setDayCount((d) => d + 1);
    setAgents(as => as.map(a => a.isYou ? { ...a, mood: Math.max(10, a.mood - 15) } : a));
    showToast("😞 Missed goals · mood −15 · streak lost");
  }, [showToast]);

  const devLevelUp = useCallback(() => {
    if (islandId && onDevLevelUpRef.current) {
      showToast("Syncing level up...");
      Promise.resolve(onDevLevelUpRef.current())
        .then(() => showToast("⚡ Level up synced"))
        .catch((err) => {
          console.error("Failed to sync level up", err);
          showToast(err instanceof Error ? err.message : "Failed to sync level up");
        });
      return;
    }
    if (islandId) {
      showToast("Level up action is unavailable in synced mode.");
      return;
    }
    setLevel(l => l + 1);
    setXp(0);
    showToast("⚡ Level up!");
  }, [islandId, showToast]);

  const completeGoal = useCallback((id: string) => {
    const goalToComplete = goals.find((goal) => goal.id === id);
    if (!goalToComplete || goalToComplete.done) {
      setPendingCheckIn(null);
      return;
    }

    setGoals((gs) => gs.map((goal) => goal.id === id ? { ...goal, done: true } : goal));
    showToast(`Syncing check-in for "${goalToComplete.text}"...`);

    const persist = onGoalCompletedRef.current;
    if (persist) {
      Promise.resolve(persist(id))
        .then(() => {
          showToast(`${goalToComplete.text} ✓ saved`);
        })
        .catch((err) => {
          console.error("Failed to persist goal completion", err);
          setGoals((gs) => gs.map((goal) => goal.id === id ? { ...goal, done: false } : goal));
          const message = err instanceof Error ? err.message : "Failed to save check-in";
          showToast(message);
        });
      setPendingCheckIn(null);
      return;
    }

    // Local-only fallback when no backend callback is wired.
    setCoins((c) => c + goalToComplete.reward);
    setXp((prevXp) => {
      const newXp = prevXp + 5;
      if (newXp >= 100) {
        setLevel((l) => l + 1);
        return 0;
      }
      return newXp;
    });
    setAgents(as => as.map(a =>
      a.isYou
        ? { ...a, mood: Math.min(100, a.mood + 6) }
        : { ...a, mood: Math.min(100, a.mood + 2) }
    ));
    showToast(`+${goalToComplete.reward} coins · mood +6 🌟 · ${goalToComplete.text} ✓`);
    setPendingCheckIn(null);
  }, [goals, showToast]);

  const addGoal = useCallback((text: string, reward: number, photo?: boolean) => {
    setGoals((gs) => [...gs, { id: `g${Date.now()}`, text, done: false, reward, photo: photo ?? false }]);
  }, []);

  const editGoal = useCallback((id: string, text: string, reward: number, photo?: boolean) => {
    setGoals((gs) => gs.map((g) => g.id === id ? { ...g, text, reward, photo: photo ?? g.photo } : g));
  }, []);

  const deleteGoal = useCallback((id: string) => {
    setGoals((gs) => gs.filter((g) => g.id !== id));
  }, []);

  const sendChat = useCallback((id: AgentId, text: string) => {
    const userMsg: ChatMsg = { from: "you", text, ts: Date.now() };
    setChats((c) => ({ ...c, [id]: [...(c[id] ?? []), userMsg] }));
    setTimeout(() => {
      const replies = ["Love it 💚", "Let's do it together!", "I'll cheer you on 🏝️", "That sounds wonderful.", "Mmm, I needed that."];
      const reply: ChatMsg = { from: "agent", text: replies[Math.floor(Math.random() * replies.length)], ts: Date.now() };
      setChats((c) => ({ ...c, [id]: [...(c[id] ?? []), reply] }));
    }, 900);
  }, []);

  const canGraduate = !!ISLAND_TIERS[islandEra + 1] && level >= ISLAND_TIERS[islandEra + 1].unlockLevel;

  return (
    <Ctx.Provider value={{
      screen, setScreen,
      selectedAgent, setSelectedAgent,
      coins, logs, rocks, streak, dayCount, level, xp,
      agents, buildings, scenery, goals,
      islandEra, islandHistory, isTransitioning, graduateIsland, canGraduate,
      viewingEra, setViewingEra, isVisiting, visitIsland,
      placingType, setPlacingType, placeBuildingAt, cancelPlacing,
      completeGoal, addGoal, editGoal, deleteGoal, pendingCheckIn, setPendingCheckIn,
      chats, sendChat,
      toast, showToast,
      islandName,
      islandId,
      phoneNumber,
      timeOffsetMs,
      trackAgent, setTrackAgent,
      audioMuted, setAudioMuted,
      syncFromConvex,
      devNextDay, devNextDayBad, devLevelUp,
      tickBuildings,
      groupMotivation,
    }}>
      {children}
    </Ctx.Provider>
  );
};

export const useGame = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGame must be inside GameProvider");
  return v;
};
     
