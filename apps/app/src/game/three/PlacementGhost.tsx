import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useGame, scorePlacement, BUILD_LIBRARY, ISLAND_TIERS } from "../state";
import type { BuildingType } from "../state";
import { Building3D } from "./Building3D";
import { useIsMobile } from "@/hooks/use-mobile";

import { useShallow } from "zustand/react/shallow";

// Shared ref so MobilePlacingHUD can read current ghost position for cancel
export const mobileGhostPosRef = { current: null as [number, number] | null };

export const PlacementGhost = () => {
  const { placingType, buildings, scenery, islandEra, placeBuildingAt, cancelPlacing  } = useGame(useShallow(s => ({ placingType: s.placingType, buildings: s.buildings, scenery: s.scenery, islandEra: s.islandEra, placeBuildingAt: s.placeBuildingAt, cancelPlacing: s.cancelPlacing })));
  const islandRadius = ISLAND_TIERS[islandEra]?.radius ?? 7.0;
  const isMobile = useIsMobile();
  const [pos, setPos] = useState<[number, number] | null>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  // Double-tap detection for mobile
  const lastTapRef = useRef(0);
  const lastTapPosRef = useRef<[number, number] | null>(null);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 4) * 0.05;
      ringRef.current.scale.set(s, 1, s);
    }
  });

  if (!placingType) {
    mobileGhostPosRef.current = null;
    return null;
  }

  const opt = BUILD_LIBRARY.find((b) => b.type === placingType)!;
  const result = pos ? scorePlacement(placingType, pos, buildings, scenery, islandRadius) : null;
  const valid = result?.valid;
  mobileGhostPosRef.current = pos;

  /* ── Desktop: hover preview, single-click place ──── */
  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    if (isMobile) return;
    setPos([e.point.x, e.point.z]);
  };

  /* ── Unified click handler ───────────────────────── */
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const tapPos: [number, number] = [e.point.x, e.point.z];

    if (!isMobile) {
      // Desktop: single click → place immediately
      if (pos) placeBuildingAt(pos);
      return;
    }

    // Mobile tap logic:
    const now = Date.now();
    const timeSinceLast = now - lastTapRef.current;

    // Check if this tap is close to the last tap (within ~1 unit)
    const lastP = lastTapPosRef.current;
    const sameSpot = lastP
      ? Math.abs(lastP[0] - tapPos[0]) < 1.2 && Math.abs(lastP[1] - tapPos[1]) < 1.2
      : false;

    if (pos && timeSinceLast < 500 && sameSpot) {
      // ── Double-tap: PLACE IT ─────────────────────
      placeBuildingAt(pos);
      lastTapRef.current = 0;
      lastTapPosRef.current = null;
    } else {
      // ── First tap: move ghost to this spot ───────
      setPos(tapPos);
      mobileGhostPosRef.current = tapPos;
      lastTapRef.current = now;
      lastTapPosRef.current = tapPos;
    }
  };

  return (
    <>
      {/* Large invisible catcher plane — both mobile and desktop */}
      <mesh
        position={[0, -0.18, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={handleMove}
        onClick={handleClick}
        onPointerLeave={() => {
          if (!isMobile) {
            setPos(null);
            mobileGhostPosRef.current = null;
          }
        }}
      >
        <planeGeometry args={[60, 60]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {pos && (
        <group position={[pos[0], 0, pos[1]]}>
          {/* Footprint ring */}
          <mesh ref={ringRef} position={[0, -0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[opt.radius, opt.radius + 0.06, 32]} />
            <meshBasicMaterial color={valid ? "#7AC5A0" : "#E55A6B"} transparent opacity={0.85} />
          </mesh>
          <mesh position={[0, -0.155, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[opt.radius, 32]} />
            <meshBasicMaterial color={valid ? "#7AC5A0" : "#E55A6B"} transparent opacity={0.25} />
          </mesh>

          {/* Ghost building */}
          <GhostBuildingPreview type={placingType} valid={!!valid} />

          {/* Score/validity popup */}
          <Html position={[0, 1.8, 0]} center distanceFactor={7}>
            <div
              className={`hud-panel-dark px-3 py-2 pointer-events-none whitespace-nowrap text-center ${
                valid ? "" : "!border-destructive"
              }`}
              style={!valid ? { borderBottomColor: "hsl(0 70% 45%)" } : undefined}
            >
              {valid ? (
                <>
                  <div
                    className={`display-font text-lg font-black ${
                      (result?.score ?? 0) > 0
                        ? "text-primary"
                        : (result?.score ?? 0) < 0
                        ? "text-destructive"
                        : "text-foreground"
                    }`}
                  >
                    {(result?.score ?? 0) > 0 ? "+" : ""}
                    {result?.score ?? 0}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider opacity-70 font-bold">harmony</div>
                  {result && result.breakdown.length > 0 && (
                    <div className="mt-1 pt-1 border-t border-white/15 space-y-0.5">
                      {result.breakdown.slice(0, 3).map((b, i) => (
                        <div key={i} className="text-[10px] font-bold flex justify-between gap-2">
                          <span className="opacity-80">{b.label}</span>
                          <span className={b.pts > 0 ? "text-primary" : "text-destructive"}>
                            {b.pts > 0 ? "+" : ""}
                            {b.pts}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {isMobile && (
                    <div className="mt-1 pt-1 border-t border-white/15 text-[9px] text-white/60 font-bold">
                      tap again to place ✓
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs font-extrabold text-destructive">{result?.reason}</div>
              )}
            </div>
          </Html>
        </group>
      )}

      {/* Desktop cancel button — floating above scene */}
      {!isMobile && (
        <Html position={[0, 4, 0]} center>
          <button
            onClick={(e) => {
              e.stopPropagation();
              cancelPlacing();
            }}
            className="btn-game-coral text-xs px-3 py-1.5 pointer-events-auto"
          >
            ✕ Cancel placing {opt.emoji} {opt.name}
          </button>
        </Html>
      )}
    </>
  );
};

const GhostBuildingPreview = ({ type, valid }: { type: string; valid: boolean }) => (
  <group>
    <Building3D
      building={{
        id: "ghost",
        type: type as BuildingType,
        pos: [0, 0],
        district: "main",
        buildProgress: 1,
        buildTime: 1,
      }}
    />
    <mesh position={[0, 0.5, 0]}>
      <sphereGeometry args={[0.6, 16, 16]} />
      <meshBasicMaterial color={valid ? "#7AC5A0" : "#E55A6B"} transparent opacity={0.15} />
    </mesh>
  </group>
);
