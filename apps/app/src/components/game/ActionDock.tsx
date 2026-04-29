import { Home, Hammer, Sparkles, TrendingUp } from "lucide-react";
import { useGame, type ScreenId } from "@/game/state";
import { useIsMobile } from "@/hooks/use-mobile";

import { useShallow } from "zustand/react/shallow";

export const ActionDock = () => {
  const { screen, setScreen  } = useGame(useShallow(s => ({ screen: s.screen, setScreen: s.setScreen })));
  const isMobile = useIsMobile();

  const navItems: { id: string; icon: typeof Home; route: ScreenId }[] = [
    { id: "Island",  icon: Home,        route: null },
    { id: "Build",   icon: Hammer,      route: "build" },
    { id: "Report",  icon: TrendingUp,  route: "recap" as ScreenId },
    { id: "Journey", icon: Sparkles,    route: "expand" as ScreenId },
  ];

  /* ── Mobile layout ──────────────────────────────────── */
  if (isMobile) {
    return (
      <div
        className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="hud-panel mx-2 mb-2 flex items-end justify-around px-1 py-1.5 pointer-events-auto">
          {navItems.map((it) => {
            const Icon = it.icon;
            const isActive = screen === it.route;
            return (
              <button
                key={it.id}
                onClick={() => setScreen(it.route)}
                className={`flex flex-col items-center gap-0.5 flex-1 py-2 rounded-xl transition active:scale-90 ${
                  isActive ? "bg-progress-gradient text-white shadow-soft" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={2.5} />
                <span className="text-[8px] font-black uppercase tracking-wide">{it.id}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── Desktop layout ─────────────────────────────────── */
  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 flex items-end justify-center p-4 pointer-events-none">
      <div className="hud-panel flex items-end gap-1 px-2 py-2 pointer-events-auto">
        {navItems.map((it) => {
          const Icon = it.icon;
          const isActive = screen === it.route;
          return (
            <button
              key={it.id}
              onClick={() => setScreen(it.route)}
              className={`relative flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition ${
                isActive ? "bg-progress-gradient text-white shadow-soft" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={2.5} />
              <span className="text-[9px] font-black uppercase tracking-wider">{it.id}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
