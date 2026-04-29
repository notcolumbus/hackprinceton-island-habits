import { useGame } from "@/game/state";
import { useIsMobile } from "@/hooks/use-mobile";

import { useShallow } from "zustand/react/shallow";

export const DevPanel = () => {
  const { devNextDay, devNextDayBad, devLevelUp, level, streak, groupMotivation  } = useGame(useShallow(s => ({ devNextDay: s.devNextDay, devNextDayBad: s.devNextDayBad, devLevelUp: s.devLevelUp, level: s.level, streak: s.streak, groupMotivation: s.groupMotivation })));
  const isMobile = useIsMobile();
  if (isMobile) return null;

  const motPct = Math.round(groupMotivation * 100);
  const motColor = motPct > 60 ? "#5DBB6A" : motPct > 30 ? "#F4B942" : "#E05A4A";

  return (
    <div className="pointer-events-auto flex flex-row gap-1 p-3 pb-4">
      {/* Good day */}
      <button
        onClick={devNextDay}
        className="hud-panel-dark px-3 py-2 flex items-center gap-2 hover:scale-105 active:scale-95 transition text-left"
      >
        <span className="text-base leading-none">☀️</span>
        <div className="leading-none">
          <p className="text-[11px] font-black">Good Day</p>
          <p className="text-[9px] opacity-50 font-semibold mt-0.5">streak {streak + 1}d · mood +8</p>
        </div>
      </button>

      {/* Bad day */}
      <button
        onClick={devNextDayBad}
        className="hud-panel-dark px-3 py-2 flex items-center gap-2 hover:scale-105 active:scale-95 transition text-left border border-red-400/30"
      >
        <span className="text-base leading-none">😞</span>
        <div className="leading-none">
          <p className="text-[11px] font-black">Bad Day</p>
          <p className="text-[9px] opacity-50 font-semibold mt-0.5">streak 0 · mood −15</p>
        </div>
      </button>

      {/* Motivation indicator */}
      <div className="hud-panel-dark px-2.5 py-2 flex items-center gap-1.5">
        <div className="flex flex-col items-center gap-0.5">
          <p className="text-[8px] font-bold uppercase tracking-wider opacity-50">mot</p>
          <p className="text-[12px] font-black leading-none" style={{ color: motColor }}>{motPct}%</p>
        </div>
        <div className="h-8 w-1.5 rounded-full bg-black/20 overflow-hidden flex flex-col-reverse">
          <div
            className="w-full rounded-full transition-all duration-500"
            style={{ height: `${motPct}%`, background: motColor }}
          />
        </div>
      </div>

      {/* Level up */}
      <button
        onClick={devLevelUp}
        className="hud-panel-dark px-3 py-2 flex items-center gap-2 hover:scale-105 active:scale-95 transition text-left"
      >
        <span className="text-base leading-none">⚡</span>
        <div className="leading-none">
          <p className="text-[11px] font-black">Level Up</p>
          <p className="text-[9px] opacity-50 font-semibold mt-0.5">Lv.{level} → {level + 1}</p>
        </div>
      </button>

    </div>
  );
};
