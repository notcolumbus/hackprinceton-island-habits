import { Flame, Sparkles, Sun, Home, ChevronDown, Zap, Volume2, VolumeX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/game/state";
import { useIsMobile } from "@/hooks/use-mobile";

const SEASONS = ["Winter", "Spring", "Spring", "Summer", "Summer", "Summer", "Autumn", "Autumn", "Autumn", "Winter", "Winter", "Winter"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const TopBar = () => {
  const navigate = useNavigate();
  const { logs, rocks, streak, dayCount, level, xp, agents, screen, setScreen, islandName, audioMuted, setAudioMuted } = useGame();
  const isMobile = useIsMobile();
  const onlineCount = agents.filter((a) => a.online).length;

  // Dynamic date — day number from shared island day counter.
  const now = new Date();
  const dayLabel = `Day ${Math.max(1, dayCount)}`;
  const dayOfWeek = DAYS[now.getDay()];
  const season = SEASONS[now.getMonth()];

  /* ── Mobile layout ──────────────────────────────────── */
  if (isMobile) {

    return (
      <div
        className="absolute top-0 left-0 right-0 z-30 pointer-events-none"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="absolute top-2 right-3 pointer-events-auto">
          <button
            onClick={() => setAudioMuted(!audioMuted)}
            title={audioMuted ? "Unmute agent voices" : "Mute agent voices"}
            aria-label={audioMuted ? "Unmute agent voices" : "Mute agent voices"}
            className="hud-panel-dark h-9 w-9 flex items-center justify-center active:scale-95 transition"
          >
            {audioMuted ? (
              <VolumeX className="h-4 w-4" strokeWidth={2.5} />
            ) : (
              <Volume2 className="h-4 w-4" strokeWidth={2.5} />
            )}
          </button>
        </div>

        {/* Single unified card — all info lives here */}
        <div className="mx-3 mt-2 pointer-events-auto">
          <div className="hud-panel overflow-hidden">

            {/* ── Section 1: Island + XP + Bell ─────────────── */}
            <div className="flex items-center gap-3 px-3 pt-3 pb-2">
              {/* Island icon */}
              <div className="h-8 w-8 rounded-xl bg-progress-gradient flex items-center justify-center flex-shrink-0 shadow-soft">
                <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
              </div>

              {/* Name + level + XP bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="display-font text-[15px] font-bold leading-none truncate">{islandName}</p>
                  <span className="flex-shrink-0 text-[9px] font-black text-honey border border-honey/40 bg-honey/10 px-1.5 py-[3px] rounded-full leading-none">
                    Lv {level}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="xp-bar h-1.5 flex-1">
                    <div className="xp-bar-fill transition-all duration-700" style={{ width: `${xp}%` }} />
                  </div>
                  <span className="text-[9px] text-muted-foreground font-semibold flex-shrink-0 tabular-nums">
                    {Math.round(xp * 11.5)}<span className="opacity-50"> / 1150</span>
                  </span>
                </div>
              </div>

            </div>

            {/* Thin divider */}
            <div className="mx-3 h-px bg-foreground/8" />

            {/* ── Section 2: Stats + Party ───────────────────── */}
            <div className="flex items-center px-3 py-2.5 gap-1">

              {/* Logs */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-[13px] leading-none">🪵</span>
                <span className="text-[14px] font-black tabular-nums leading-none">{logs}</span>
              </div>

              {/* Dot separator */}
              <div className="mx-1.5 h-3 w-px bg-foreground/15 flex-shrink-0" />

              {/* Rocks */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-[13px] leading-none">🪨</span>
                <span className="text-[14px] font-black tabular-nums leading-none">{rocks}</span>
              </div>

              {/* Dot separator */}
              <div className="mx-1.5 h-3 w-px bg-foreground/15 flex-shrink-0" />

              {/* Streak */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Flame className="h-3.5 w-3.5 text-accent" strokeWidth={2.5} />
                <span className="text-[14px] font-black leading-none">
                  {streak}<span className="text-[10px] text-muted-foreground font-semibold ml-0.5">day</span>
                </span>
              </div>

              {/* Push party to right */}
              <div className="flex-1" />

              {/* Party button */}
              <button
                onClick={() => setScreen(screen === "party" ? null : "party")}
                className={`flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-xl transition active:scale-95 ${
                  screen === "party"
                    ? "bg-primary/15 ring-1 ring-primary/40"
                    : "bg-foreground/5"
                }`}
              >
                {/* Avatar stack */}
                <div className="flex -space-x-1.5">
                  {agents.slice(0, 3).map((a) => (
                    <img
                      key={a.id} src={a.img} alt={a.name}
                      className="h-6 w-6 rounded-full border-2 border-card object-cover flex-shrink-0"
                    />
                  ))}
                  {agents.length > 3 && (
                    <div className="h-6 w-6 rounded-full border-2 border-card bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-[8px] font-black text-muted-foreground">+{agents.length - 3}</span>
                    </div>
                  )}
                </div>
                <div className="leading-none text-left">
                  <span className="text-[12px] font-black block">{onlineCount}</span>
                  <span className="text-[8px] text-muted-foreground font-semibold">online</span>
                </div>
                <ChevronDown
                  className={`h-3 w-3 text-muted-foreground/60 transition-transform flex-shrink-0 ${
                    screen === "party" ? "rotate-180" : ""
                  }`}
                />
              </button>

            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Desktop layout ─────────────────────────────────── */
  return (
    <div className="absolute top-0 left-0 right-0 z-30 flex items-start justify-between p-4 pointer-events-none">
      {/* Left side */}
      <div className="flex flex-col gap-2 pointer-events-auto">
        <div className="hud-panel-dark w-[300px] px-3 py-2.5 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-progress-gradient flex items-center justify-center shadow-inner flex-shrink-0">
            <Sparkles className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-secondary/80 leading-none">Your Island</p>
                <p className="display-font text-base font-bold leading-tight">{islandName}</p>
              </div>
              <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-lg ml-2 flex-shrink-0">
                <Zap className="h-3 w-3 text-honey fill-honey" strokeWidth={2.5} />
                <span className="text-[11px] font-black text-honey">Lv.{level}</span>
                <span className="text-[9px] opacity-50 font-bold">→{level + 1}</span>
              </div>
            </div>
            <div className="xp-bar h-2 mt-1">
              <div className="xp-bar-fill" style={{ width: `${xp}%` }} />
            </div>
            <p className="text-[9px] opacity-50 mt-0.5 font-semibold tabular-nums">
              {Math.round(xp * 11.5)} / 1,150 XP
            </p>
          </div>
        </div>

        <button
          onClick={() => setScreen(screen === "party" ? null : "party")}
          className={`hud-panel w-[300px] px-3 py-2 flex items-center gap-3 hover:scale-[1.02] transition text-left ${
            screen === "party" ? "ring-2 ring-primary ring-offset-1 ring-offset-transparent" : ""
          }`}
        >
          <div className="flex -space-x-1.5">
            {agents.map((a) => (
              <div key={a.id} className="relative" title={a.name}>
                <img src={a.img} alt={a.name} className="h-8 w-8 rounded-full border-2 border-card object-cover bg-secondary-soft" />
                <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-[1.5px] border-card ${a.online ? "bg-primary" : "bg-muted-foreground/40"}`} />
              </div>
            ))}
          </div>
          <div className="border-l border-foreground/15 pl-3 flex items-center gap-1.5">
            <span className="text-[13px] font-black text-foreground tabular-nums">{onlineCount}</span>
            <span className="text-[11px] text-muted-foreground font-semibold">/ {agents.length} online</span>
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground ml-0.5 transition-transform ${screen === "party" ? "rotate-180" : ""}`} />
          </div>
        </button>
      </div>

      {/* Right side */}
      <div className="flex flex-col items-end gap-2 pointer-events-auto">
        <div className="flex items-center gap-2">
          <div className="hud-panel-dark px-3 py-1.5 flex items-center gap-2">
            <Sun className="h-4 w-4 text-honey" strokeWidth={2.5} />
            <div className="text-right leading-none">
              <p className="text-[9px] font-bold uppercase tracking-wider opacity-70">{dayLabel}</p>
              <p className="text-[11px] font-extrabold display-font">{season} · {dayOfWeek}</p>
            </div>
          </div>
          <button
            onClick={() => setAudioMuted(!audioMuted)}
            title={audioMuted ? "Unmute agent voices" : "Mute agent voices"}
            aria-label={audioMuted ? "Unmute agent voices" : "Mute agent voices"}
            className="hud-panel-dark h-10 w-10 flex items-center justify-center hover:scale-105 transition"
          >
            {audioMuted ? (
              <VolumeX className="h-4 w-4" strokeWidth={2.5} />
            ) : (
              <Volume2 className="h-4 w-4" strokeWidth={2.5} />
            )}
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            title="Your Islands"
            aria-label="Go to Your Islands"
            className="hud-panel-dark h-10 w-10 flex items-center justify-center hover:scale-105 transition"
          >
            <Home className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="resource-pill">
            <span className="h-7 w-7 rounded-full bg-honey-gradient flex items-center justify-center shadow-inner text-base">🪵</span>
            <span className="text-sm tabular-nums">{logs}</span>
          </div>
          <div className="resource-pill">
            <span className="h-7 w-7 rounded-full bg-secondary-soft flex items-center justify-center shadow-inner text-base">🪨</span>
            <span className="text-sm tabular-nums">{rocks}</span>
          </div>
          <div className="resource-pill">
            <span className="h-7 w-7 rounded-full bg-coral-gradient flex items-center justify-center shadow-inner">
              <Flame className="h-4 w-4 text-white" strokeWidth={2.8} />
            </span>
            <span className="text-sm">{streak}<span className="text-[10px] opacity-70 font-semibold">d</span></span>
          </div>
        </div>
      </div>
    </div>
  );
};
