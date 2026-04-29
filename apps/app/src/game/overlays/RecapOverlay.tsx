import { X, Sparkles, TrendingUp, Coins, Trophy, Clock } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useGame } from "../state";
import { useOverlayClose } from "@/hooks/useOverlayClose";

import { useShallow } from "zustand/react/shallow";

const ENCOURAGEMENTS = [
  "Week just started — plenty of room to surprise yourself.",
  "Early in the week. Stack two good days back-to-back.",
  "Halfway point. The habit is starting to feel normal.",
  "Past halfway. Lock in the finish.",
  "Almost at the report — one strong push left.",
  "Last couple days. Close out clean.",
  "Final day before the weekly recap drops.",
];

export const RecapOverlay = () => {
  const { screen, setScreen, islandId, islandName, agents  } = useGame(useShallow(s => ({ screen: s.screen, setScreen: s.setScreen, islandId: s.islandId, islandName: s.islandName, agents: s.agents })));
  const { closing, close } = useOverlayClose(() => setScreen(null));

  // Always call hooks before any early return.
  const digest = useQuery(
    api.jobQueries.getIslandWeeklyDigest,
    islandId ? { islandId: islandId as Id<"islands"> } : "skip",
  );

  if (screen !== "recap" && !closing) return null;

  const dayCount = digest?.dayCount ?? 1;
  const weekNumber = digest?.weekNumber ?? 1;
  const dayOfWeek = digest?.dayOfWeek ?? 1;
  const daysUntilNext = digest?.daysUntilNextReport ?? 0;
  const weekComplete = daysUntilNext === 0;

  const completionPct = digest?.completionPct ?? 0;
  const checkInCount = digest?.checkInCount ?? 0;
  const buildingsCompleted = digest?.buildingsCompleted ?? 0;
  const narrative = digest?.latestNarrative;
  const perUser = digest?.perUser ?? [];

  const encouragementIdx = Math.min(ENCOURAGEMENTS.length - 1, Math.max(0, dayOfWeek - 1));
  const encouragement = ENCOURAGEMENTS[encouragementIdx];

  // Prefer server-side per-user contribution data when available; otherwise
  // fall back to the in-memory agents array so the overlay still renders.
  const contributionRows = perUser.length > 0
    ? perUser.map((row) => {
        const agent = agents.find((a) => a.id === row.phone);
        return {
          id: row.phone,
          name: row.displayName || agent?.name || "Player",
          img: agent?.img ?? "",
          pct: row.pct,
          completed: row.completed,
          missed: row.missed,
        };
      })
    : agents.map((a) => ({
        id: a.id,
        name: a.name,
        img: a.img,
        pct: a.mood,
        completed: 0,
        missed: 0,
      }));

  return (
    <div
      className={`absolute inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-8 pointer-events-auto
        bg-black/40 backdrop-blur-sm
        ${closing ? "animate-out fade-out duration-150" : "animate-in fade-in duration-200"}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className={`hud-panel max-w-2xl w-full max-h-[90vh] sm:max-h-[85%] flex flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl
        ${closing ? "animate-out slide-out-to-bottom sm:zoom-out-95 duration-150" : "animate-in slide-in-from-bottom sm:zoom-in-95 duration-300"}`}>

        <header className="flex items-center justify-between p-4 border-b border-foreground/10">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-coral-gradient flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-white" strokeWidth={2.8} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Weekly recap</p>
              <p className="display-font text-base font-bold">
                {islandName || digest?.islandName || "Island"} · Week {weekNumber}
              </p>
            </div>
          </div>
          <button onClick={close} className="h-9 w-9 rounded-xl bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="overflow-y-auto p-5 space-y-4">
          {/* Week progress */}
          <div className="bg-muted/40 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Day {dayOfWeek} of 7
              </p>
              <p className="text-[11px] font-bold text-foreground/80">
                {weekComplete ? "Week complete ✓" : `${daysUntilNext} day${daysUntilNext === 1 ? "" : "s"} until report`}
              </p>
            </div>
            <div className="xp-bar h-2">
              <div className="xp-bar-fill" style={{ width: `${(dayOfWeek / 7) * 100}%` }} />
            </div>
          </div>

          {/* Narrative OR encouragement */}
          {narrative ? (
            <div className="quest-scroll p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-accent">AI Narrative</p>
                <span className="ml-auto text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(narrative.sentAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-foreground font-semibold whitespace-pre-wrap">
                {narrative.content}
              </p>
            </div>
          ) : (
            <div className="quest-scroll p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
                  {weekComplete ? "Generating report…" : "This week"}
                </p>
              </div>
              <p className="text-sm leading-relaxed text-foreground font-semibold">
                {encouragement}
              </p>
              {!weekComplete && (
                <p className="text-xs text-muted-foreground mt-2 font-semibold">
                  Full AI recap unlocks on day 7 — {checkInCount} check-ins so far.
                </p>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <Stat icon={<Trophy className="h-4 w-4" />} label="Completion" value={`${completionPct}%`} tone="primary" />
            <Stat icon={<Coins className="h-4 w-4" />} label="Check-ins" value={String(checkInCount)} tone="honey" />
            <Stat icon={<Sparkles className="h-4 w-4" />} label="Built" value={`${buildingsCompleted} new`} tone="coral" />
          </div>

          {/* Contributions */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Contributions</p>
            <div className="space-y-2">
              {contributionRows.length === 0 && (
                <p className="text-xs text-muted-foreground font-semibold">No check-ins yet this week.</p>
              )}
              {contributionRows.map((row) => (
                <div key={row.id} className="bg-card border border-border rounded-xl p-2.5 flex items-center gap-3">
                  {row.img ? (
                    <img src={row.img} className="h-9 w-9 rounded-xl object-cover" />
                  ) : (
                    <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center text-xs font-black text-muted-foreground">
                      {row.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-extrabold truncate">{row.name}</span>
                      <span className="text-xs font-black text-foreground">{row.pct}%</span>
                    </div>
                    <div className="xp-bar h-2"><div className="xp-bar-fill" style={{ width: `${row.pct}%` }} /></div>
                    {perUser.length > 0 && (
                      <p className="text-[10px] font-semibold text-muted-foreground mt-1">
                        {row.completed} done · {row.missed} missed
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Debug day count */}
          <p className="text-[10px] text-muted-foreground text-center pt-2">
            Day {dayCount} of your island journey
          </p>
        </div>
      </div>
    </div>
  );
};

const Stat = ({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "primary" | "honey" | "coral" }) => {
  const bg = tone === "primary" ? "bg-primary-soft" : tone === "honey" ? "bg-honey-soft" : "bg-accent-soft";
  return (
    <div className={`${bg} rounded-xl p-3 text-center`}>
      <div className="flex justify-center mb-1 opacity-70">{icon}</div>
      <p className="text-lg font-black display-font">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
    </div>
  );
};
