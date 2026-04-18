import { X, Hammer, Lock, Heart, AlertCircle } from "lucide-react";
import { useGame, BUILD_LIBRARY } from "../state";
import { useOverlayClose } from "@/hooks/useOverlayClose";

export const BuildOverlay = () => {
  const { screen, setScreen, logs, rocks, level, setPlacingType, placingType } = useGame();
  const { closing, close } = useOverlayClose(() => setScreen(null));

  if (screen !== "build" && !closing) return null;

  const isLocked = (b: typeof BUILD_LIBRARY[number]) =>
    (b.unlockLevel != null && level < b.unlockLevel) || !!b.locked;
  const lockMsg = (b: typeof BUILD_LIBRARY[number]) =>
    b.unlockLevel != null && level < b.unlockLevel
      ? `Unlock at Lv.${b.unlockLevel}`
      : b.locked ?? null;
  const canAfford = (b: typeof BUILD_LIBRARY[number]) =>
    logs >= (b.logCost ?? 0) && rocks >= (b.rockCost ?? 0);

  const startPlacing = (type: typeof BUILD_LIBRARY[number]["type"]) => {
    const opt = BUILD_LIBRARY.find((b) => b.type === type)!;
    if (isLocked(opt)) return;
    if (!canAfford(opt)) return;
    setPlacingType(type);
    setScreen(null);
  };

  return (
    <div
      className={`absolute inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-foreground/50 backdrop-blur-md pointer-events-auto
        ${closing ? "animate-out fade-out duration-150" : "animate-in fade-in duration-200"}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className={`hud-panel max-w-3xl w-full max-h-[92vh] sm:max-h-[88%] flex flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl
        ${closing ? "animate-out slide-out-to-bottom sm:zoom-out-95 duration-150" : "animate-in slide-in-from-bottom sm:zoom-in-95 duration-300"}`}>

        {/* Header */}
        <header className="relative flex items-center justify-between p-4 border-b border-foreground/10 bg-gradient-to-r from-primary-soft/60 via-secondary-soft/40 to-honey-soft/50">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-progress-gradient flex items-center justify-center shadow-float">
              <Hammer className="h-5 w-5 text-white" strokeWidth={2.8} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Build menu</p>
              <p className="display-font text-lg font-bold leading-tight">Craft your island</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="resource-pill">
              <span className="text-base">🪵</span> <span className="text-sm tabular-nums">{logs}</span>
            </div>
            <div className="resource-pill">
              <span className="text-base">🪨</span> <span className="text-sm tabular-nums">{rocks}</span>
            </div>
            <button onClick={close} className="h-9 w-9 rounded-xl bg-card hover:bg-muted flex items-center justify-center transition shadow-soft">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Hint */}
        <div className="px-4 py-2.5 bg-honey-soft/50 border-b border-foreground/5 flex items-center gap-2 text-[11px] font-bold text-foreground/80">
          <Heart className="h-3.5 w-3.5 text-accent fill-accent" />
          Each building loves & hates neighbors. Place wisely for <b>harmony bonus 🌟</b>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 overflow-y-auto bg-gradient-to-b from-background to-secondary-soft/20">
          {BUILD_LIBRARY.map((b) => {
            const locked = isLocked(b);
            const tooExpensive = !locked && !canAfford(b);
            const lockReason = lockMsg(b);
            const isPlacing = placingType === b.type;
            const totalCost = (b.logCost ?? 0) + (b.rockCost ?? 0);
            const tier = totalCost < 10 ? "common" : totalCost < 18 ? "rare" : totalCost < 26 ? "epic" : "legendary";
            const tierStyle = {
              common: "from-secondary-soft/70 to-secondary-soft/30 border-secondary",
              rare: "from-primary-soft/70 to-primary-soft/30 border-primary",
              epic: "from-accent-soft/70 to-accent-soft/30 border-accent",
              legendary: "from-honey-soft/80 to-honey-soft/40 border-honey",
            }[tier];
            const tierGlow = {
              common: "shadow-[0_4px_20px_-6px_hsl(var(--secondary)/0.4)]",
              rare: "shadow-[0_4px_20px_-6px_hsl(var(--primary)/0.5)]",
              epic: "shadow-[0_4px_20px_-6px_hsl(var(--accent)/0.5)]",
              legendary: "shadow-[0_4px_24px_-4px_hsl(var(--honey)/0.7)]",
            }[tier];

            return (
              <button
                key={b.type}
                disabled={locked || tooExpensive}
                onClick={() => startPlacing(b.type)}
                className={`group relative text-left p-3 rounded-2xl border-2 transition-all duration-200 ${
                  locked
                    ? "bg-muted/40 border-muted opacity-60"
                    : tooExpensive
                    ? "bg-card border-border opacity-70"
                    : isPlacing
                    ? "bg-primary-soft border-primary shadow-float -translate-y-1 scale-[1.02]"
                    : `bg-card border-border hover:border-primary hover:-translate-y-1 hover:scale-[1.03] ${tierGlow} cursor-pointer`
                }`}
              >
                {!locked && !tooExpensive && (
                  <span className={`absolute -top-1.5 -right-1.5 z-10 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${
                    tier === "legendary" ? "bg-honey text-honey-foreground border-honey-foreground/20" :
                    tier === "epic" ? "bg-accent text-accent-foreground border-accent-foreground/20" :
                    tier === "rare" ? "bg-primary text-primary-foreground border-primary-foreground/20" :
                    "bg-secondary text-secondary-foreground border-secondary-foreground/20"
                  }`}>{tier}</span>
                )}
                <div className={`relative aspect-square w-full rounded-xl bg-gradient-to-br ${tierStyle} flex items-center justify-center text-5xl mb-2 overflow-hidden border`}>
                  <span className="transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 drop-shadow-[0_4px_8px_rgba(0,0,0,0.2)]">{b.emoji}</span>
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="font-extrabold text-sm leading-tight">{b.name}</p>
                <div className="flex items-center justify-between mt-1.5 gap-1">
                  <div className="flex items-center gap-1.5">
                    {(b.logCost ?? 0) > 0 && (
                      <span className={`text-xs font-black flex items-center gap-0.5 ${tooExpensive && logs < (b.logCost ?? 0) ? "text-destructive" : "text-honey-foreground"}`}>
                        🪵{b.logCost}
                      </span>
                    )}
                    {(b.rockCost ?? 0) > 0 && (
                      <span className={`text-xs font-black flex items-center gap-0.5 ${tooExpensive && rocks < (b.rockCost ?? 0) ? "text-destructive" : "text-foreground/70"}`}>
                        🪨{b.rockCost}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">⌀{b.radius.toFixed(1)}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {b.rules.likes?.slice(0, 2).map((r, i) => (
                    <span key={i} className="text-[9px] font-bold text-primary bg-primary-soft px-1.5 py-0.5 rounded-full">♥ {r.type} +{r.pts}</span>
                  ))}
                  {b.rules.dislikes?.slice(0, 1).map((r, i) => (
                    <span key={i} className="text-[9px] font-bold text-destructive bg-accent-soft px-1.5 py-0.5 rounded-full">✗ {r.type} {r.pts}</span>
                  ))}
                </div>
                {locked && (
                  <div className="absolute inset-0 rounded-2xl bg-foreground/40 backdrop-blur-[3px] flex flex-col items-center justify-center text-card font-bold text-xs gap-1.5">
                    <Lock className="h-6 w-6" />
                    <span className="bg-foreground/80 px-2 py-1 rounded text-center text-[10px]">{lockReason}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-3 border-t border-foreground/10 bg-gradient-to-r from-honey-soft/40 to-primary-soft/30 text-center text-xs font-bold text-honey-foreground flex items-center justify-center gap-2">
          <AlertCircle className="h-3.5 w-3.5" />
          Pick → hover island for ghost preview. Green ✓ valid · red ✗ blocked
        </div>
      </div>
    </div>
  );
};
