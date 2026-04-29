import { useRef } from "react";
import { X, Zap } from "lucide-react";
import { useGame } from "../state";
import { useOverlayClose } from "@/hooks/useOverlayClose";
import { useIsMobile } from "@/hooks/use-mobile";

import { useShallow } from "zustand/react/shallow";

export const PartyOverlay = () => {
  const { screen, setScreen, agents, islandName  } = useGame(useShallow(s => ({ screen: s.screen, setScreen: s.setScreen, agents: s.agents, islandName: s.islandName })));
  const isMobile = useIsMobile();
  const { closing, close } = useOverlayClose(() => setScreen(null));
  const panelRef = useRef<HTMLDivElement>(null);

  if (screen !== "party" && !closing) return null;

  const AgentList = () => (
    <div className="py-1.5 overflow-y-auto scrollbar-hide flex-1">
      {agents.map((a) => {
        const moodColor =
          a.mood < 50
            ? "linear-gradient(90deg,hsl(12 88% 78%),hsl(8 80% 60%))"
            : a.mood < 70
            ? "linear-gradient(90deg,hsl(45 95% 70%),hsl(35 90% 55%))"
            : "linear-gradient(90deg,hsl(145 60% 65%),hsl(145 55% 45%))";
        return (
          <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition">
            <div className="relative flex-shrink-0 w-10 h-10">
              <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-card shadow-soft bg-secondary-soft">
                <img src={a.img} alt={a.name} className="w-full h-full object-cover object-top" />
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${a.online ? "bg-primary" : "bg-muted-foreground/40"}`} />
              {a.mood > 80 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-honey-gradient flex items-center justify-center border border-white">
                  <Zap className="h-2.5 w-2.5 text-white fill-white" strokeWidth={3} />
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[12px] font-extrabold text-foreground leading-none">{a.name}</span>
                {a.isYou && <span className="text-[8px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-black leading-none flex-shrink-0">YOU</span>}
                <span className={`ml-auto text-[10px] font-bold flex-shrink-0 leading-none ${a.online ? "text-primary" : "text-muted-foreground/50"}`}>
                  {a.online ? "● online" : "○ offline"}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex-1 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${a.mood}%`, background: moodColor }} />
                </div>
                <span className="text-[11px] font-black text-foreground tabular-nums w-6 text-right flex-shrink-0">{a.mood}</span>
              </div>
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[10px] font-semibold text-muted-foreground whitespace-nowrap">🎯 {a.goal}</span>
                <span className="text-muted-foreground/30 flex-shrink-0 mx-0.5">·</span>
                <span className="text-[10px] italic text-foreground/40 truncate">"{a.line}"</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  /* ── Mobile: full-screen bottom sheet ───────────────── */
  if (isMobile) {
    return (
      <>
        <div
          className={`absolute inset-0 z-40 bg-black/40 backdrop-blur-sm pointer-events-auto
            ${closing ? "animate-out fade-out duration-150" : "animate-in fade-in duration-200"}`}
          onClick={close}
        />
        <div
          className={`absolute inset-x-0 bottom-0 z-50 rounded-t-3xl overflow-hidden flex flex-col bg-card/95 backdrop-blur-md border-t border-foreground/10 shadow-float pointer-events-auto
            ${closing ? "animate-out slide-out-to-bottom duration-150" : "animate-in slide-in-from-bottom duration-300"}`}
          style={{ maxHeight: "80vh", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="h-1 w-10 rounded-full bg-foreground/20" />
          </div>
          <div className="px-4 py-2.5 border-b border-foreground/10 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-primary-soft/50 to-secondary-soft/30">
            <div>
              <p className="display-font text-sm font-bold">Party · {islandName}</p>
              <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                {agents.filter((a) => a.online).length}/{agents.length} online
              </p>
            </div>
            <button onClick={close} className="h-8 w-8 rounded-xl bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition">
              <X className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
          <AgentList />
          <div className="px-4 py-3 border-t border-foreground/10 bg-secondary-soft/30 flex-shrink-0">
            <span className="text-[10px] font-bold text-muted-foreground">
              {agents.filter((a) => a.online).length}/{agents.length} members online
            </span>
          </div>
        </div>
      </>
    );
  }

  /* ── Desktop: dropdown ──────────────────────────────── */
  return (
    <div
      ref={panelRef}
      className={`absolute left-4 z-50 w-[300px] pointer-events-auto
        ${closing
          ? "animate-out fade-out slide-out-to-top-2 duration-150"
          : "animate-in fade-in slide-in-from-top-2 duration-200"
        }`}
      style={{ top: "160px" }}
    >
      <div className="hud-panel overflow-hidden shadow-float flex flex-col" style={{ maxHeight: "440px" }}>
        <div className="px-4 py-2.5 border-b border-foreground/10 bg-gradient-to-r from-primary-soft/50 to-secondary-soft/30 flex-shrink-0">
          <p className="display-font text-sm font-bold">Party · {islandName}</p>
          <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">
            {agents.filter((a) => a.online).length}/{agents.length} online
          </p>
        </div>
        <AgentList />
        <div className="px-4 py-2.5 border-t border-foreground/10 bg-secondary-soft/30 flex-shrink-0">
          <span className="text-[10px] font-bold text-muted-foreground">
            {agents.filter((a) => a.online).length}/{agents.length} members online
          </span>
        </div>
      </div>
    </div>
  );
};
