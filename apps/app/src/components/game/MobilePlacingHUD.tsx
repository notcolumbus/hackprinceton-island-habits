import { useGame, BUILD_LIBRARY } from "@/game/state";
import { useIsMobile } from "@/hooks/use-mobile";
import { mobileGhostPosRef } from "@/game/three/PlacementGhost";

import { useShallow } from "zustand/react/shallow";

/**
 * Mobile-only HUD shown during building placement.
 *
 * Flow:
 *   1. Tap anywhere on the island → ghost building appears at that spot
 *   2. Tap the same spot again (within ~500 ms) → building is placed
 *   3. Drag with one finger → pans the camera freely across all islands
 */
export const MobilePlacingHUD = () => {
  const { placingType, cancelPlacing  } = useGame(useShallow(s => ({ placingType: s.placingType, cancelPlacing: s.cancelPlacing })));
  const isMobile = useIsMobile();

  if (!placingType || !isMobile) return null;

  const opt = BUILD_LIBRARY.find((b) => b.type === placingType);
  if (!opt) return null;

  const handleCancel = () => {
    mobileGhostPosRef.current = null;
    cancelPlacing();
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* ── Hint strip near top (below TopBar) ─────────── */}
      <div
        className="absolute left-0 right-0 flex justify-center px-4"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 124px)" }}
      >
        <div className="hud-panel-dark px-3 py-1.5 flex items-center gap-2 pointer-events-none">
          <span className="text-base leading-none">{opt.emoji}</span>
          <p className="text-[10px] font-bold text-white/80 whitespace-nowrap">
            Tap to preview · tap again to place
          </p>
        </div>
      </div>

      {/* ── Cancel button — bottom center above dock ────── */}
      <div
        className="absolute left-0 right-0 flex justify-center pointer-events-auto"
        style={{ bottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}
      >
        <button
          onClick={handleCancel}
          className="btn-game-coral px-6 py-2.5 text-sm font-black active:scale-95 transition flex items-center gap-2"
        >
          ✕ Cancel {opt.name}
        </button>
      </div>
    </div>
  );
};
