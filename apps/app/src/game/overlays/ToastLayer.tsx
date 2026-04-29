import { useGame } from "../state";

import { useShallow } from "zustand/react/shallow";

export const ToastLayer = () => {
  const { toast  } = useGame(useShallow(s => ({ toast: s.toast })));
  if (!toast) return null;
  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[60] pointer-events-none animate-in fade-in slide-in-from-top duration-200">
      <div className="hud-panel-dark px-5 py-2.5 text-sm font-extrabold display-font shadow-float">
        {toast}
      </div>
    </div>
  );
};
