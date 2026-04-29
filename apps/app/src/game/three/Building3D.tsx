import { useRef, useMemo } from "react";
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Building } from "../state";
import { useGame } from "../state";

import {
import { useShallow } from "zustand/react/shallow";

  House, Garden, Library, Gym, Fountain, Bonfire, Lighthouse, Cabin, Dock, Shrine,
  Windmill, Treehouse, Bakery, TeaHouse, Observatory, BellTower, ZenGarden,
  CrystalGrotto, Amphitheater, Moongate
} from "./buildings";

interface Props { building: Building; }

const Scaffolding = ({ progress }: { progress: number }) => {
  const opacity = 1 - progress;
  const poleColor = "#8B6B4A";
  const poles: [number, number][] = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]];
  return (
    <group>
      {/* 4 corner poles */}
      {poles.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.6, z]}>
          <cylinderGeometry args={[0.025, 0.025, 1.2, 6]} />
          <meshStandardMaterial color={poleColor} transparent opacity={opacity} />
        </mesh>
      ))}
      {/* Horizontal crossbeams at two heights */}
      {[0.3, 0.8].map((y) => (
        <group key={y}>
          <mesh position={[0, y, -0.5]}>
            <boxGeometry args={[1.0, 0.025, 0.025]} />
            <meshStandardMaterial color={poleColor} transparent opacity={opacity} />
          </mesh>
          <mesh position={[0, y, 0.5]}>
            <boxGeometry args={[1.0, 0.025, 0.025]} />
            <meshStandardMaterial color={poleColor} transparent opacity={opacity} />
          </mesh>
          <mesh position={[-0.5, y, 0]}>
            <boxGeometry args={[0.025, 0.025, 1.0]} />
            <meshStandardMaterial color={poleColor} transparent opacity={opacity} />
          </mesh>
          <mesh position={[0.5, y, 0]}>
            <boxGeometry args={[0.025, 0.025, 1.0]} />
            <meshStandardMaterial color={poleColor} transparent opacity={opacity} />
          </mesh>
        </group>
      ))}
      {/* Netting/tarp — translucent plane */}
      <mesh position={[0, 0.6, 0.52]}>
        <planeGeometry args={[1.0, 1.2]} />
        <meshStandardMaterial color="#F4D87C" transparent opacity={opacity * 0.18} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

export const Building3D = ({ building }: Props) => {
  const { type, pos, rot = 0 } = building;
  const { groupMotivation  } = useGame(useShallow(s => ({ groupMotivation: s.groupMotivation })));
  const flameRef   = useRef<THREE.Mesh>(null);
  const lightRef   = useRef<THREE.Mesh>(null);
  const smokeRef   = useRef<THREE.Mesh>(null);
  const bladesRef  = useRef<THREE.Group>(null);
  const flagRef    = useRef<THREE.Mesh>(null);
  const bellRef    = useRef<THREE.Group>(null);
  const lanternRef = useRef<THREE.Mesh>(null);
  const crystalRef = useRef<THREE.Mesh>(null);
  const torchRef   = useRef<THREE.Mesh>(null);
  const glowRef    = useRef<THREE.Mesh>(null);
  const groupRef   = useRef<THREE.Group>(null);
  // Separate ref for the construction body so we can lerp scale imperatively
  // instead of letting React drive it (which causes 1-per-second discrete jumps).
  const bodyRef    = useRef<THREE.Group>(null);
  const displayProg = useRef(building.buildProgress);
  const mountTime = useMemo(() => performance.now(), []);

  const isBuilding = building.buildProgress < 1;
  const progress = building.buildProgress;

  // ETA in game-days at full motivation — matches the semantics of the Good
  // Day dev button (1 click = 1 game-day advance). Real-time pacing still
  // scales by mood on the server ticker, but the label users read should
  // answer "how many more good days until this finishes".
  const etaText = useMemo(() => {
    const daysLeft = (1 - progress) * Math.max(1, building.buildTime);
    if (daysLeft < 0.1) return "<0.1 day";
    if (daysLeft < 1.05) return `~${daysLeft.toFixed(1)}d`;
    return `~${Math.ceil(daysLeft)}d`;
  }, [progress, building.buildTime]);

  const motPct = Math.round(groupMotivation * 100);

  useFrame(({ clock }, delta) => {
    // ── Smooth build-progress lerp (fixes discrete 1/2-second jumps) ─────────
    // Snap immediately on completion, smooth on the way up.
    const progTarget = building.buildProgress;
    if (progTarget >= 1) {
      displayProg.current = 1;
    } else {
      displayProg.current += (progTarget - displayProg.current) * Math.min(1, delta * 7);
    }
    if (bodyRef.current) {
      const dp = displayProg.current;
      bodyRef.current.scale.y = Math.max(0.08, dp);
      bodyRef.current.position.y = -(1 - dp) * 0.5;
    }

    // ── Pop-in elastic on first appearance ───────────────────────────────────
    if (groupRef.current) {
      const elapsed = (performance.now() - mountTime) / 1000;
      if (elapsed < 0.7) {
        const t = elapsed / 0.7;
        const eased = 1 - Math.pow(1 - t, 3);
        const overshoot = Math.sin(t * Math.PI * 2) * (1 - t) * 0.15;
        groupRef.current.scale.setScalar(eased + overshoot);
      } else {
        groupRef.current.scale.setScalar(1);
      }
    }
    if (type === "bonfire" && flameRef.current) {
      const s = 0.9 + Math.sin(clock.elapsedTime * 8) * 0.15;
      flameRef.current.scale.set(s, s * 1.3, s);
    }
    if (type === "lighthouse" && lightRef.current) {
      lightRef.current.rotation.y = clock.elapsedTime * 1.5;
    }
    if (type === "windmill" && bladesRef.current) {
      bladesRef.current.rotation.z = clock.elapsedTime * 0.8;
    }
    if ((type === "house" || type === "cabin" || type === "bakery") && smokeRef.current) {
      smokeRef.current.position.y = 1.2 + (clock.elapsedTime % 2) * 0.3;
      const m = smokeRef.current.material as THREE.MeshStandardMaterial;
      m.opacity = 0.5 - (clock.elapsedTime % 2) * 0.25;
    }
    if (type === "house" && flagRef.current) {
      flagRef.current.rotation.y = Math.sin(clock.elapsedTime * 4) * 0.3;
      flagRef.current.scale.x = 1 + Math.sin(clock.elapsedTime * 5) * 0.06;
    }
    if (type === "belltower" && bellRef.current) {
      bellRef.current.rotation.z = Math.sin(clock.elapsedTime * 1.4) * 0.18;
    }
    if (type === "teahouse" && lanternRef.current) {
      lanternRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.9) * 0.12;
    }
    if (type === "crystalgrotto" && crystalRef.current) {
      const mat = crystalRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.45 + Math.sin(clock.elapsedTime * 1.8) * 0.25;
    }
    if (type === "amphitheater" && torchRef.current) {
      const s = 0.92 + Math.sin(clock.elapsedTime * 9) * 0.12;
      torchRef.current.scale.set(s, s * 1.2, s);
    }
    if (type === "moongate" && glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.5 + Math.sin(clock.elapsedTime * 1.2) * 0.3;
    }
  });

  return (
    <group ref={groupRef} position={[pos[0], 0.26, pos[1]]} rotation={[0, rot, 0]}>
      {/* bodyRef: scale/position driven imperatively by displayProg lerp in useFrame.
          No React props here — avoids discrete per-tick visual jumps. */}
      <group ref={bodyRef}>
        {type === "house"         && <House smokeRef={smokeRef} flagRef={flagRef} />}
        {type === "garden"        && <Garden />}
        {type === "library"       && <Library />}
        {type === "gym"           && <Gym />}
        {type === "fountain"      && <Fountain />}
        {type === "bonfire"       && <Bonfire flameRef={flameRef} />}
        {type === "lighthouse"    && <Lighthouse lightRef={lightRef} />}
        {type === "cabin"         && <Cabin smokeRef={smokeRef} />}
        {type === "dock"          && <Dock />}
        {type === "shrine"        && <Shrine />}
        {type === "windmill"      && <Windmill bladesRef={bladesRef} />}
        {type === "treehouse"     && <Treehouse />}
        {type === "bakery"        && <Bakery smokeRef={smokeRef} />}
        {type === "teahouse"      && <TeaHouse lanternRef={lanternRef} />}
        {type === "observatory"   && <Observatory />}
        {type === "belltower"     && <BellTower bellRef={bellRef} />}
        {type === "zengarden"     && <ZenGarden />}
        {type === "crystalgrotto" && <CrystalGrotto crystalRef={crystalRef} />}
        {type === "amphitheater"  && <Amphitheater torchRef={torchRef} />}
        {type === "moongate"      && <Moongate glowRef={glowRef} />}
      </group>
      {isBuilding && (
        <>
          <Scaffolding progress={progress} />
          <Html position={[0, 1.7, 0]} center distanceFactor={6} zIndexRange={[5, 0]}>
            <div className="pointer-events-none flex flex-col items-center gap-0.5 select-none" style={{ minWidth: 72 }}>
              {/* Progress line */}
              <div className="hud-panel-dark px-2 py-0.5 text-[9px] font-black whitespace-nowrap flex items-center gap-1 w-full justify-center">
                <span>🔨</span>
                <span>{Math.round(progress * 100)}%</span>
                <span className="opacity-50 font-semibold">·</span>
                <span className="opacity-80">{etaText}</span>
              </div>
              {/* Build progress bar */}
              <div className="h-1 w-full rounded-full bg-black/30 overflow-hidden">
                <div className="h-full rounded-full bg-honey-gradient transition-all" style={{ width: `${progress * 100}%` }} />
              </div>
              {/* Motivation indicator */}
              <div className="flex items-center gap-0.5 mt-0.5">
                <span className="text-[7px] opacity-50 font-bold">mot</span>
                <div className="h-0.5 w-8 rounded-full bg-black/20 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${motPct}%`,
                      background: motPct > 60 ? "#5DBB6A" : motPct > 30 ? "#F4B942" : "#E05A4A",
                    }}
                  />
                </div>
                <span className="text-[7px] font-black opacity-70">{motPct}%</span>
              </div>
            </div>
          </Html>
        </>
      )}
    </group>
  );
};
