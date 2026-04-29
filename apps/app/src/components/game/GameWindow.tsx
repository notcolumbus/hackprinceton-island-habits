import { Suspense } from "react";
import { TopBar } from "./TopBar";
import { QuestLog } from "./QuestLog";
import { ActionDock } from "./ActionDock";
import { Island3D } from "@/game/three/Island3D";
import { BuildOverlay } from "@/game/overlays/BuildOverlay";
import { RecapOverlay } from "@/game/overlays/RecapOverlay";
import { HistoryOverlay } from "@/game/overlays/HistoryOverlay";
import { ExpandOverlay } from "@/game/overlays/ExpandOverlay";
import { GossipHistoryOverlay } from "@/game/overlays/GossipHistoryOverlay";
import { PartyOverlay } from "@/game/overlays/PartyOverlay";
import { ToastLayer } from "@/game/overlays/ToastLayer";
import { MobilePlacingHUD } from "./MobilePlacingHUD";
import { DevPanel } from "./DevPanel";
import { useGame } from "@/game/state";

import { useShallow } from "zustand/react/shallow";

const TrackAgentButton = () => {
  const { trackAgent, setTrackAgent, viewingEra, setScreen  } = useGame(useShallow(s => ({ trackAgent: s.trackAgent, setTrackAgent: s.setTrackAgent, viewingEra: s.viewingEra, setScreen: s.setScreen })));
  if (viewingEra !== null) return null;
  // On mobile these buttons live in QuestLog's floating row instead.
  return (
    <div
      className="hidden sm:flex absolute left-4 z-30 pointer-events-auto flex-col gap-2"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
    >
      <button
        onClick={() => setTrackAgent(!trackAgent)}
        className={`hud-panel px-3 py-2 text-xs font-bold rounded-xl active:scale-95 transition shadow-float ${
          trackAgent ? "btn-game-coral" : "opacity-80"
        }`}
      >
        {trackAgent ? "🎯 Tracking" : "🎯 Track Me"}
      </button>
      <button
        onClick={() => setScreen("gossip")}
        className="hud-panel px-3 py-2 text-xs font-bold rounded-xl active:scale-95 transition shadow-float opacity-80"
      >
        💬 Gossip Log
      </button>
    </div>
  );
};

const VisitBanner = () => {
  const { viewingEra, visitIsland, islandHistory  } = useGame(useShallow(s => ({ viewingEra: s.viewingEra, visitIsland: s.visitIsland, islandHistory: s.islandHistory })));
  if (viewingEra === null) return null;
  const snap = islandHistory[viewingEra];
  if (!snap) return null;
  return (
    <div className="absolute top-0 left-0 right-0 z-[300] flex justify-center pointer-events-none"
         style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 140px)" }}>
      <div className="hud-panel-dark px-4 py-2.5 flex items-center gap-3 pointer-events-auto shadow-float animate-in slide-in-from-top duration-300">
        <span className="text-2xl">{snap.emoji}</span>
        <div className="leading-none">
          <p className="text-[9px] font-bold uppercase tracking-widest opacity-60">Visiting past island</p>
          <p className="display-font text-sm font-bold">{snap.name}</p>
        </div>
        <button
          onClick={() => visitIsland(null)}
          className="ml-2 btn-game-coral px-3 py-1.5 text-[11px] font-black rounded-xl active:scale-95 transition"
        >
          ← Return Home
        </button>
      </div>
    </div>
  );
};

const TransitionOverlay = () => {
  const { isTransitioning  } = useGame(useShallow(s => ({ isTransitioning: s.isTransitioning })));
  if (!isTransitioning) return null;
  return (
    <div className="absolute inset-0 z-[150] pointer-events-none flex items-center justify-center animate-in fade-in duration-700"
         style={{ background: "radial-gradient(circle at center, #FFFBE8 0%, #B8D8F8 60%, #4A90D0 100%)" }}>
      <div className="text-center animate-in zoom-in-75 duration-500">
        <div className="text-5xl mb-3 animate-bounce">✈️</div>
        <p className="display-font text-2xl font-black text-white/90 drop-shadow-lg">Setting sail…</p>
      </div>
    </div>
  );
};

const VisitTransitionOverlay = () => {
  const { isVisiting, viewingEra, islandHistory  } = useGame(useShallow(s => ({ isVisiting: s.isVisiting, viewingEra: s.viewingEra, islandHistory: s.islandHistory })));
  if (!isVisiting) return null;
  // figure out where we're going — if viewingEra is still set we're returning home, otherwise arriving
  const snap = viewingEra !== null ? islandHistory[viewingEra] : null;
  return (
    <div className="absolute inset-0 z-[150] pointer-events-none flex items-center justify-center animate-in fade-in duration-400"
         style={{ background: "radial-gradient(circle at center, #FFF8E0 0%, #D0E8F8 55%, #5A8FC0 100%)" }}>
      <div className="text-center animate-in zoom-in-75 duration-300">
        <div className="text-5xl mb-3" style={{ animation: "spin 0.9s linear" }}>🕰️</div>
        <p className="display-font text-xl font-black text-white/90 drop-shadow-lg">
          {snap ? `Traveling to ${snap.name}…` : "Returning home…"}
        </p>
      </div>
    </div>
  );
};

export const GameWindow = () => (
  <div className="game-window w-full h-full relative overflow-hidden">
    {/* Content area — full screen */}
    <div className="absolute inset-0 overflow-hidden">
      {/* Layer 0 — 3D world canvas (lowest) */}
      <div className="absolute inset-0 z-0">
        <Suspense
          fallback={
            <div className="h-full w-full bg-world flex items-center justify-center text-foreground font-bold">
              <div className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-progress-gradient animate-pulse flex items-center justify-center">
                  <span className="text-white text-2xl">🏝️</span>
                </div>
                <span className="display-font text-lg">Loading island...</span>
              </div>
            </div>
          }
        >
          <Island3D />
        </Suspense>
      </div>

      {/* Layer 1 — HUD panels (above canvas, below overlays) */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <TopBar />
        <QuestLog />
        <ActionDock />
        <TrackAgentButton />
      </div>

      {/* Dev panel — desktop only, sits flush below dock */}
      <div className="absolute bottom-0 right-0 z-[45] pointer-events-none">
        <DevPanel />
      </div>

      {/* Layer 1.5 — Mobile placement HUD (crosshair + place button) */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        <MobilePlacingHUD />
      </div>

      {/* Layer 2 — Modal overlays (highest, above EVERYTHING) */}
      <div className="absolute inset-0 z-[100] pointer-events-none" style={{ isolation: "isolate" }}>
        <PartyOverlay />
        <BuildOverlay />
        <RecapOverlay />
        <HistoryOverlay />
        <ExpandOverlay />
        <GossipHistoryOverlay />
      </div>

      {/* Transition overlay — shown during island graduation */}
      <TransitionOverlay />

      {/* Visit transition — shown while time-traveling to a past island */}
      <VisitTransitionOverlay />

      {/* Visit banner — shown when viewing a past island */}
      <VisitBanner />

      {/* Layer 3 — Toast notifications (topmost) */}
      <div className="absolute inset-0 z-[200] pointer-events-none">
        <ToastLayer />
      </div>
    </div>
  </div>
);
