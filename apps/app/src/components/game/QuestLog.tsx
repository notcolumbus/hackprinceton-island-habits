import { useState } from "react";
import { Check, ChevronRight, Scroll } from "lucide-react";
import { useGame } from "@/game/state";
import { useIsMobile } from "@/hooks/use-mobile";

export const QuestLog = () => {
  const { goals, setScreen, completeGoal, groupMotivation, buildings, trackAgent, setTrackAgent, viewingEra } = useGame();
  const isMobile = useIsMobile();
  const doneCount = goals.filter((g) => g.done).length;
  const [sheetOpen, setSheetOpen] = useState(false);

  /* ── Shared quest list ───────────────────────────────── */
  const QuestListContent = () => (
    <>
      <div className="space-y-1.5 flex-1 overflow-y-auto scrollbar-hide">
        {goals.map((g) => (
          <button
            key={g.id}
            onClick={() => { if (!g.done) { completeGoal(g.id); if (isMobile) setSheetOpen(false); } }}
            disabled={g.done}
            className={`w-full flex items-center gap-2 p-2 rounded-xl transition text-left ${
              g.done ? "bg-primary-soft/60 cursor-default" : "bg-white/60 hover:bg-white/90 cursor-pointer hover:translate-x-0.5"
            }`}
          >
            {g.done ? (
              <div className="h-6 w-6 rounded-full bg-progress-gradient flex items-center justify-center shadow-soft flex-shrink-0 border-2 border-white">
                <Check className="h-3 w-3 text-white" strokeWidth={3.5} />
              </div>
            ) : (
              <div className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground/50 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-[11px] font-bold ${g.done ? "text-muted-foreground line-through" : "text-foreground"}`}>{g.text}</p>
              <span className="text-[9px] font-black text-honey-foreground bg-honey/30 px-1.5 py-0.5 rounded-full mt-0.5 inline-block">
                +{g.reward}🪙
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-2 pt-2 border-t border-foreground/10 space-y-1.5">
        {/* Group motivation */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Group motivation</span>
            <span
              className="text-[10px] font-black"
              style={{ color: groupMotivation > 0.6 ? "#5DBB6A" : groupMotivation > 0.3 ? "#F4B942" : "#E05A4A" }}
            >
              {Math.round(groupMotivation * 100)}%
            </span>
          </div>
          <div className="xp-bar">
            <div
              className="xp-bar-fill"
              style={{
                width: `${Math.round(groupMotivation * 100)}%`,
                background: groupMotivation > 0.6
                  ? "linear-gradient(90deg,#5DBB6A,#8EE09B)"
                  : groupMotivation > 0.3
                  ? "linear-gradient(90deg,#F4B942,#FFDA7A)"
                  : "linear-gradient(90deg,#E05A4A,#F07868)",
              }}
            />
          </div>
        </div>
        {/* Building ETA */}
        {buildings.some(b => b.buildProgress < 1) && (() => {
          const nearestDays = buildings
            .filter(b => b.buildProgress < 1)
            .reduce<number>((min, b) => {
              const days = groupMotivation > 0
                ? (1 - b.buildProgress) * Math.max(1, b.buildTime) / groupMotivation
                : Infinity;
              return days < min ? days : min;
            }, Infinity);
          const etaLabel = nearestDays === Infinity ? "—"
            : nearestDays < 0.1 ? "< 0.1 day"
            : nearestDays < 1.05 ? `~${nearestDays.toFixed(1)} day`
            : `~${Math.ceil(nearestDays)} days`;
          return (
            <div className="flex items-center justify-between text-[9px]">
              <span className="text-muted-foreground font-semibold">🏗️ next building done</span>
              <span className="font-black text-foreground">{etaLabel}</span>
            </div>
          );
        })()}
      </div>
    </>
  );

  /* ── Mobile layout ──────────────────────────────────── */
  if (isMobile) {
    return (
      <div className="pointer-events-none">
        {/* Floating row above dock */}
        <div
          className="absolute left-2 z-30 pointer-events-auto flex items-center gap-2"
          style={{ bottom: "calc(72px + env(safe-area-inset-bottom, 0px))" }}
        >
          <button
            onClick={() => setSheetOpen(true)}
            className="hud-panel px-2.5 py-1.5 flex items-center gap-1.5 hover:scale-[1.02] active:scale-95 transition"
          >
            <Scroll className="h-3.5 w-3.5 text-accent" strokeWidth={2.5} />
            <span className="text-[11px] font-extrabold">Quests</span>
            <span className="text-[10px] font-black text-accent-foreground bg-accent/30 px-1.5 py-0.5 rounded-full">
              {doneCount}/{goals.length}
            </span>
            {doneCount < goals.length && (
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            )}
          </button>

          {viewingEra === null && (
            <>
              <button
                onClick={() => setTrackAgent(!trackAgent)}
                className={`hud-panel px-2.5 py-1.5 text-[11px] font-extrabold flex items-center gap-1 active:scale-95 transition ${
                  trackAgent ? "btn-game-coral" : ""
                }`}
              >
                🎯 {trackAgent ? "Tracking" : "Track Me"}
              </button>
              <button
                onClick={() => setScreen("gossip")}
                className="hud-panel px-2.5 py-1.5 text-[11px] font-extrabold flex items-center gap-1 active:scale-95 transition"
              >
                💬 Gossip
              </button>
            </>
          )}
        </div>

        {sheetOpen && (
          <div
            className="absolute inset-0 z-40 bg-black/40 backdrop-blur-sm pointer-events-auto animate-in fade-in duration-200"
            onClick={() => setSheetOpen(false)}
          />
        )}

        {sheetOpen && (
          <div
            className="absolute inset-x-0 bottom-0 z-50 pointer-events-auto rounded-t-3xl overflow-hidden flex flex-col bg-card/95 backdrop-blur-md border-t border-foreground/10 shadow-float animate-in slide-in-from-bottom duration-300"
            style={{ maxHeight: "75vh", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="h-1 w-10 rounded-full bg-foreground/20" />
            </div>
            <div className="flex items-center justify-between px-4 pb-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Scroll className="h-4 w-4 text-accent" strokeWidth={2.5} />
                <p className="display-font text-sm font-bold">Today's Quests</p>
                <span className="text-[10px] font-black text-accent-foreground bg-accent/30 px-2 py-0.5 rounded-full">
                  {doneCount}/{goals.length}
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-hidden px-4 pb-4 flex flex-col gap-2">
              <div className="quest-scroll p-3 flex flex-col flex-1 overflow-hidden">
                <QuestListContent />
              </div>
              <button
                onClick={() => { setScreen("history"); setSheetOpen(false); }}
                className="hud-panel-dark p-3 flex items-center gap-2 hover:scale-[1.01] transition flex-shrink-0"
              >
                <div className="h-8 w-8 rounded-xl bg-accent/30 flex items-center justify-center text-base flex-shrink-0">🌧️</div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[9px] font-bold uppercase tracking-wider opacity-70">Event · 2h left</p>
                  <p className="text-[10px] font-extrabold leading-tight">Rain blessing — water habits 2× rewards</p>
                </div>
                <ChevronRight className="h-4 w-4 opacity-60" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Desktop layout ─────────────────────────────────── */
  return (
    <div className="absolute right-4 top-[112px] bottom-[88px] z-30 w-[260px] flex flex-col gap-2 pointer-events-auto">
      <div className="quest-scroll p-3 flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Scroll className="h-4 w-4 text-accent" strokeWidth={2.5} />
            <p className="display-font text-sm font-bold text-foreground">Today's Quests</p>
          </div>
          <span className="text-[10px] font-black text-accent-foreground bg-accent/30 px-2 py-0.5 rounded-full">
            {doneCount}/{goals.length}
          </span>
        </div>
        <QuestListContent />
      </div>

      <button
        onClick={() => setScreen("history")}
        className="hud-panel-dark p-3 flex items-center gap-2 hover:scale-[1.02] transition"
      >
        <div className="h-9 w-9 rounded-xl bg-accent/30 flex items-center justify-center text-lg flex-shrink-0">🌧️</div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[9px] font-bold uppercase tracking-wider opacity-70">Event · 2h left</p>
          <p className="text-[11px] font-extrabold leading-tight">Rain blessing — water habits 2× rewards</p>
        </div>
        <ChevronRight className="h-4 w-4 opacity-60" />
      </button>
    </div>
  );
};
