import { useRef, useMemo } from "react";
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Building } from "../state";
import { useGame } from "../state";

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
  const { groupMotivation } = useGame();
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

  useFrame(({ clock }, delta) => { // NOSONAR
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

const House = ({ smokeRef, flagRef }: { smokeRef: RefObject<THREE.Mesh | null>; flagRef: RefObject<THREE.Mesh | null> }) => (
  <group>
    <mesh position={[0, 0.05, 0]} receiveShadow>
      <boxGeometry args={[0.95, 0.1, 0.95]} />
      <meshStandardMaterial color="#9B8E7E" />
    </mesh>
    <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.85, 0.7, 0.85]} />
      <meshStandardMaterial color="#F4E1C1" />
    </mesh>
    {/* Window left */}
    <mesh position={[-0.25, 0.45, 0.43]}>
      <boxGeometry args={[0.18, 0.18, 0.02]} />
      <meshStandardMaterial color="#7BC5E5" emissive="#7BC5E5" emissiveIntensity={0.3} />
    </mesh>
    <mesh position={[-0.25, 0.45, 0.44]}>
      <boxGeometry args={[0.2, 0.02, 0.005]} /><meshStandardMaterial color="#5A4226" />
    </mesh>
    <mesh position={[-0.25, 0.45, 0.44]}>
      <boxGeometry args={[0.02, 0.2, 0.005]} /><meshStandardMaterial color="#5A4226" />
    </mesh>
    {/* Window planter with flowers */}
    <mesh position={[-0.25, 0.32, 0.46]} castShadow>
      <boxGeometry args={[0.22, 0.06, 0.06]} />
      <meshStandardMaterial color="#6B4226" />
    </mesh>
    {[-0.32, -0.25, -0.18].map((x, i) => (
      <mesh key={i} position={[x, 0.37, 0.46]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshStandardMaterial color={["#E58F7B", "#F2C46C", "#C9A0E0"][i]} />
      </mesh>
    ))}
    {/* Door */}
    <mesh position={[0.18, 0.32, 0.43]}>
      <boxGeometry args={[0.18, 0.42, 0.02]} />
      <meshStandardMaterial color="#6B4226" />
    </mesh>
    <mesh position={[0.24, 0.32, 0.44]}>
      <sphereGeometry args={[0.012, 6, 6]} /><meshStandardMaterial color="#C9A55B" metalness={0.6} />
    </mesh>
    {/* Roof */}
    <mesh position={[0, 0.92, 0]} castShadow rotation={[0, Math.PI / 4, 0]}>
      <coneGeometry args={[0.75, 0.55, 4]} />
      <meshStandardMaterial color="#C5523A" />
    </mesh>
    {/* Flag pole + animated flag */}
    <mesh position={[0, 1.3, 0]} castShadow>
      <cylinderGeometry args={[0.012, 0.012, 0.35, 6]} />
      <meshStandardMaterial color="#3A2818" />
    </mesh>
    <mesh ref={flagRef} position={[0.08, 1.38, 0]}>
      <planeGeometry args={[0.16, 0.1]} />
      <meshStandardMaterial color="#D9433A" side={THREE.DoubleSide} />
    </mesh>
    {/* Chimney + smoke */}
    <mesh position={[0.25, 1.0, -0.15]} castShadow>
      <boxGeometry args={[0.1, 0.25, 0.1]} />
      <meshStandardMaterial color="#5A4A38" />
    </mesh>
    <mesh ref={smokeRef} position={[0.25, 1.2, -0.15]}>
      <sphereGeometry args={[0.08, 8, 8]} />
      <meshStandardMaterial color="#E0E0E0" transparent opacity={0.5} />
    </mesh>
    <mesh position={[0.18, 0.07, 0.5]}>
      <boxGeometry args={[0.22, 0.05, 0.1]} />
      <meshStandardMaterial color="#6B4226" />
    </mesh>
  </group>
);

const Garden = () => (
  <group>
    <mesh position={[0, 0.05, 0]} receiveShadow>
      <cylinderGeometry args={[0.4, 0.45, 0.1, 12]} />
      <meshStandardMaterial color="#6B4226" />
    </mesh>
    <mesh position={[0, 0.11, 0]}>
      <cylinderGeometry args={[0.36, 0.36, 0.02, 12]} />
      <meshStandardMaterial color="#3A2818" />
    </mesh>
    {[[-0.18, 0.18], [0.15, -0.1], [0.05, 0.2], [-0.1, -0.15], [0.2, 0.15], [-0.2, -0.05]].map((p, i) => (
      <group key={i} position={[p[0], 0.13, p[1]]}>
        <mesh><cylinderGeometry args={[0.018, 0.018, 0.18, 6]} /><meshStandardMaterial color="#5A8C3B" /></mesh>
        <mesh position={[0, 0.13, 0]}><sphereGeometry args={[0.07, 8, 8]} /><meshStandardMaterial color={["#E58F7B", "#F2C46C", "#C9A0E0", "#FFB6C1", "#E89BC5", "#F4A8A8"][i]} /></mesh>
        <mesh position={[0, 0.13, 0]}><sphereGeometry args={[0.025, 6, 6]} /><meshStandardMaterial color="#F2C46C" /></mesh>
      </group>
    ))}
  </group>
);

const Library = () => (
  <group>
    <mesh position={[0, 0.05, 0]} receiveShadow>
      <boxGeometry args={[1.2, 0.1, 0.9]} />
      <meshStandardMaterial color="#9B8E7E" />
    </mesh>
    <mesh position={[0, 0.5, 0]} castShadow>
      <boxGeometry args={[1.1, 0.9, 0.8]} />
      <meshStandardMaterial color="#A87FCB" />
    </mesh>
    <mesh position={[0, 1.0, 0]} castShadow>
      <boxGeometry args={[1.2, 0.15, 0.9]} />
      <meshStandardMaterial color="#6B4F8C" />
    </mesh>
    {/* Columns */}
    {[-0.45, 0.45].map((x) => (
      <mesh key={x} position={[x, 0.5, 0.41]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.85, 8]} />
        <meshStandardMaterial color="#F4E8D9" />
      </mesh>
    ))}
    {/* Door */}
    <mesh position={[0, 0.4, 0.42]}>
      <boxGeometry args={[0.25, 0.6, 0.02]} />
      <meshStandardMaterial color="#5A3820" />
    </mesh>
    {/* Windows */}
    {[-0.42, 0.42].map((x) => (
      <mesh key={x} position={[x, 0.7, 0.41]}>
        <boxGeometry args={[0.12, 0.18, 0.005]} />
        <meshStandardMaterial color="#F2C46C" emissive="#F2C46C" emissiveIntensity={0.5} />
      </mesh>
    ))}
    {/* Sign */}
    <mesh position={[0, 1.15, 0.46]}>
      <boxGeometry args={[0.4, 0.12, 0.02]} />
      <meshStandardMaterial color="#F4E1C1" />
    </mesh>
  </group>
);

const Gym = () => (
  <group>
    <mesh position={[0, 0.05, 0]} receiveShadow>
      <boxGeometry args={[1.0, 0.1, 1.0]} />
      <meshStandardMaterial color="#5A4A38" />
    </mesh>
    <mesh position={[0, 0.45, 0]} castShadow>
      <boxGeometry args={[0.9, 0.8, 0.9]} />
      <meshStandardMaterial color="#6FA8DC" />
    </mesh>
    <mesh position={[0, 0.9, 0]} castShadow>
      <boxGeometry args={[1.0, 0.1, 1.0]} />
      <meshStandardMaterial color="#3F6FA0" />
    </mesh>
    {/* Garage door */}
    <mesh position={[0, 0.4, 0.46]}>
      <boxGeometry args={[0.55, 0.65, 0.02]} />
      <meshStandardMaterial color="#2C4F70" />
    </mesh>
    {[0.15, 0.3, 0.45, 0.6].map((y, i) => (
      <mesh key={i} position={[0, y, 0.47]}>
        <boxGeometry args={[0.55, 0.012, 0.005]} />
        <meshStandardMaterial color="#1F3A52" />
      </mesh>
    ))}
    {/* Dumbbell */}
    <group position={[0.55, 0.12, 0.45]}>
      <mesh><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color="#1A1A1A" /></mesh>
      <mesh position={[0.18, 0, 0]}><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color="#1A1A1A" /></mesh>
      <mesh position={[0.09, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.025, 0.025, 0.18, 6]} /><meshStandardMaterial color="#555" /></mesh>
    </group>
    {/* Sign */}
    <mesh position={[0, 0.95, 0.51]}>
      <boxGeometry args={[0.5, 0.1, 0.02]} />
      <meshStandardMaterial color="#F2C46C" emissive="#F2C46C" emissiveIntensity={0.3} />
    </mesh>
  </group>
);

const Fountain = () => (
  <group>
    <mesh position={[0, 0.1, 0]} receiveShadow><cylinderGeometry args={[0.6, 0.65, 0.2, 24]} /><meshStandardMaterial color="#E0D5C0" /></mesh>
    <mesh position={[0, 0.21, 0]}><torusGeometry args={[0.55, 0.05, 8, 24]} /><meshStandardMaterial color="#9B8E7E" /></mesh>
    <mesh position={[0, 0.22, 0]}><cylinderGeometry args={[0.5, 0.5, 0.04, 24]} /><meshStandardMaterial color="#5BA3D0" transparent opacity={0.85} /></mesh>
    <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.08, 0.12, 0.35, 8]} /><meshStandardMaterial color="#E0D5C0" /></mesh>
    <mesh position={[0, 0.6, 0]}><cylinderGeometry args={[0.18, 0.18, 0.04, 16]} /><meshStandardMaterial color="#9B8E7E" /></mesh>
    <mesh position={[0, 0.65, 0]}><cylinderGeometry args={[0.16, 0.16, 0.02, 16]} /><meshStandardMaterial color="#5BA3D0" transparent opacity={0.85} /></mesh>
    <mesh position={[0, 0.78, 0]}><sphereGeometry args={[0.13, 16, 16]} /><meshStandardMaterial color="#7BC5E5" transparent opacity={0.7} emissive="#7BC5E5" emissiveIntensity={0.2} /></mesh>
    {/* Water droplets */}
    {[0, 1, 2, 3].map((i) => {
      const a = (i / 4) * Math.PI * 2;
      return <mesh key={i} position={[Math.cos(a) * 0.35, 0.5, Math.sin(a) * 0.35]}><sphereGeometry args={[0.04, 6, 6]} /><meshStandardMaterial color="#7BC5E5" transparent opacity={0.6} /></mesh>;
    })}
  </group>
);

const Bonfire = ({ flameRef }: { flameRef: RefObject<THREE.Mesh | null> }) => (
  <group>
    <mesh position={[0, 0.02, 0]}><cylinderGeometry args={[0.32, 0.35, 0.04, 16]} /><meshStandardMaterial color="#3A2818" /></mesh>
    {[0, 1, 2, 3, 4].map((i) => (
      <mesh key={i} position={[Math.cos(i * Math.PI / 2.5) * 0.15, 0.1, Math.sin(i * Math.PI / 2.5) * 0.15]} rotation={[Math.PI / 2.5, 0, i]}>
        <cylinderGeometry args={[0.04, 0.04, 0.34, 6]} />
        <meshStandardMaterial color="#6B4226" />
      </mesh>
    ))}
    <mesh ref={flameRef} position={[0, 0.28, 0]}>
      <coneGeometry args={[0.16, 0.45, 8]} />
      <meshStandardMaterial color="#F2A04C" emissive="#E55A2B" emissiveIntensity={0.8} />
    </mesh>
    <mesh position={[0, 0.42, 0]}>
      <coneGeometry args={[0.08, 0.22, 6]} />
      <meshStandardMaterial color="#F4D87C" emissive="#F4D87C" emissiveIntensity={0.8} />
    </mesh>
    <pointLight position={[0, 0.4, 0]} color="#FF8030" intensity={0.8} distance={2.5} />
    {/* Stones around */}
    {[0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i / 6) * Math.PI * 2;
      return <mesh key={i} position={[Math.cos(a) * 0.32, 0.04, Math.sin(a) * 0.32]}><dodecahedronGeometry args={[0.06]} /><meshStandardMaterial color="#7A6B5A" flatShading /></mesh>;
    })}
  </group>
);

const Lighthouse = ({ lightRef }: { lightRef: RefObject<THREE.Mesh | null> }) => (
  <group>
    <mesh position={[0, 0.05, 0]}><cylinderGeometry args={[0.5, 0.55, 0.1, 16]} /><meshStandardMaterial color="#7A6B5A" /></mesh>
    <mesh position={[0, 0.7, 0]} castShadow><cylinderGeometry args={[0.25, 0.35, 1.3, 16]} /><meshStandardMaterial color="#F4F0E8" /></mesh>
    {/* Red stripes */}
    {[0.4, 0.9, 1.2].map((y) => (
      <mesh key={y} position={[0, y, 0]}>
        <cylinderGeometry args={[
          y === 0.4 ? 0.32 : y === 0.9 ? 0.27 : 0.255,
          y === 0.4 ? 0.33 : y === 0.9 ? 0.28 : 0.26,
          0.08, 16
        ]} />
        <meshStandardMaterial color="#D9433A" />
      </mesh>
    ))}
    <mesh position={[0, 1.45, 0]}><cylinderGeometry args={[0.3, 0.3, 0.08, 16]} /><meshStandardMaterial color="#3A2818" /></mesh>
    {/* Lantern room */}
    <mesh position={[0, 1.6, 0]}><cylinderGeometry args={[0.2, 0.22, 0.25, 12]} /><meshStandardMaterial color="#222" transparent opacity={0.4} /></mesh>
    <mesh ref={lightRef} position={[0, 1.6, 0]}>
      <coneGeometry args={[1.5, 2, 8, 1, true]} />
      <meshBasicMaterial color="#FFE49B" transparent opacity={0.25} side={THREE.DoubleSide} />
    </mesh>
    <pointLight position={[0, 1.6, 0]} color="#FFE49B" intensity={1.2} distance={5} />
    <mesh position={[0, 1.85, 0]}><coneGeometry args={[0.25, 0.35, 12]} /><meshStandardMaterial color="#3A4A6B" /></mesh>
    <mesh position={[0, 2.05, 0]}><sphereGeometry args={[0.04, 8, 8]} /><meshStandardMaterial color="#C9A55B" metalness={0.7} /></mesh>
  </group>
);

const Cabin = ({ smokeRef }: { smokeRef: RefObject<THREE.Mesh | null> }) => (
  <group>
    {/* Log walls */}
    {[0.15, 0.3, 0.45, 0.6, 0.75].map((y) => (
      <mesh key={y} position={[0, y, 0]} castShadow>
        <boxGeometry args={[0.85, 0.13, 0.85]} />
        <meshStandardMaterial color={y % 0.3 < 0.15 ? "#8B5E3C" : "#6B4226"} />
      </mesh>
    ))}
    {/* Roof */}
    <mesh position={[0, 1.0, 0]} castShadow rotation={[0, 0, 0]}>
      <boxGeometry args={[1.0, 0.05, 1.0]} />
      <meshStandardMaterial color="#3A4A6B" />
    </mesh>
    <mesh position={[0, 1.2, 0]} castShadow rotation={[0, Math.PI / 4, 0]}>
      <coneGeometry args={[0.8, 0.55, 4]} />
      <meshStandardMaterial color="#3F7A3F" />
    </mesh>
    {/* Door */}
    <mesh position={[0, 0.35, 0.43]}>
      <boxGeometry args={[0.22, 0.55, 0.02]} />
      <meshStandardMaterial color="#3A2818" />
    </mesh>
    {/* Window */}
    <mesh position={[-0.28, 0.5, 0.43]}>
      <boxGeometry args={[0.18, 0.18, 0.02]} />
      <meshStandardMaterial color="#F2C46C" emissive="#F2C46C" emissiveIntensity={0.4} />
    </mesh>
    {/* Chimney smoke */}
    <mesh position={[0.3, 1.1, -0.2]}>
      <boxGeometry args={[0.1, 0.3, 0.1]} />
      <meshStandardMaterial color="#3A2818" />
    </mesh>
    <mesh ref={smokeRef} position={[0.3, 1.3, -0.2]}>
      <sphereGeometry args={[0.09, 8, 8]} />
      <meshStandardMaterial color="#D0D0D0" transparent opacity={0.5} />
    </mesh>
  </group>
);

const Dock = () => (
  <group>
    {/* Wooden planks */}
    <mesh position={[0, 0.12, 0]} receiveShadow castShadow>
      <boxGeometry args={[1.2, 0.05, 0.6]} />
      <meshStandardMaterial color="#8B5E3C" />
    </mesh>
    {/* Plank seams */}
    {[-0.4, -0.13, 0.13, 0.4].map((x) => (
      <mesh key={x} position={[x, 0.15, 0]}>
        <boxGeometry args={[0.02, 0.005, 0.6]} />
        <meshStandardMaterial color="#5A3820" />
      </mesh>
    ))}
    {/* Posts */}
    {[[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]].map(([x, z], i) => (
      <mesh key={i} position={[x, 0.05, z]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.3, 8]} />
        <meshStandardMaterial color="#5A3820" />
      </mesh>
    ))}
    {/* Lantern */}
    <mesh position={[0.55, 0.4, 0]}>
      <cylinderGeometry args={[0.04, 0.04, 0.4, 6]} />
      <meshStandardMaterial color="#3A2818" />
    </mesh>
    <mesh position={[0.55, 0.65, 0]}>
      <boxGeometry args={[0.12, 0.12, 0.12]} />
      <meshStandardMaterial color="#F4D87C" emissive="#F4D87C" emissiveIntensity={0.8} />
    </mesh>
    {/* no point light on dock — ambient is enough */}
  </group>
);

const Shrine = () => (
  <group>
    {/* Stone base */}
    <mesh position={[0, 0.05, 0]}><boxGeometry args={[0.9, 0.1, 0.7]} /><meshStandardMaterial color="#9B8E7E" /></mesh>
    {/* Two red columns */}
    {[-0.35, 0.35].map((x) => (
      <mesh key={x} position={[x, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.07, 0.85, 8]} />
        <meshStandardMaterial color="#C5523A" />
      </mesh>
    ))}
    {/* Top crossbeams */}
    <mesh position={[0, 0.95, 0]}>
      <boxGeometry args={[0.95, 0.06, 0.12]} />
      <meshStandardMaterial color="#3A2818" />
    </mesh>
    <mesh position={[0, 1.05, 0]}>
      <boxGeometry args={[1.05, 0.08, 0.18]} />
      <meshStandardMaterial color="#C5523A" />
    </mesh>
    {/* Bell */}
    <mesh position={[0, 0.85, 0]}>
      <cylinderGeometry args={[0.08, 0.1, 0.12, 8]} />
      <meshStandardMaterial color="#C9A55B" metalness={0.5} />
    </mesh>
  </group>
);

/* ── Windmill — rotating blades, classic Dutch ──────── */
const Windmill = ({ bladesRef }: { bladesRef: RefObject<THREE.Group | null> }) => (
  <group>
    {/* Stone base */}
    <mesh position={[0, 0.1, 0]} receiveShadow castShadow>
      <cylinderGeometry args={[0.45, 0.55, 0.2, 16]} />
      <meshStandardMaterial color="#7A6B5A" roughness={0.9} flatShading />
    </mesh>
    {/* Tapered tower */}
    <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.32, 0.45, 1.1, 16]} />
      <meshStandardMaterial color="#F4E1C1" roughness={0.85} />
    </mesh>
    {/* Wood beam stripes */}
    {[0.4, 0.7, 1.0].map((y) => (
      <mesh key={y} position={[0, y, 0]}>
        <cylinderGeometry args={[
          0.45 - (y - 0.2) * 0.118,
          0.45 - (y - 0.2) * 0.118,
          0.04, 16
        ]} />
        <meshStandardMaterial color="#8B6B4A" roughness={0.9} />
      </mesh>
    ))}
    {/* Door */}
    <mesh position={[0, 0.35, 0.43]}>
      <boxGeometry args={[0.18, 0.4, 0.02]} />
      <meshStandardMaterial color="#5A3820" />
    </mesh>
    {/* Window */}
    <mesh position={[0, 0.85, 0.4]}>
      <boxGeometry args={[0.14, 0.14, 0.02]} />
      <meshStandardMaterial color="#F2C46C" emissive="#F2C46C" emissiveIntensity={0.5} />
    </mesh>
    {/* Conical roof cap */}
    <mesh position={[0, 1.42, 0]} castShadow>
      <coneGeometry args={[0.36, 0.32, 12]} />
      <meshStandardMaterial color="#5A3820" roughness={0.8} flatShading />
    </mesh>
    {/* Hub for blades */}
    <mesh position={[0, 1.15, 0.35]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[0.06, 0.06, 0.12, 12]} />
      <meshStandardMaterial color="#3A2818" />
    </mesh>
    {/* Rotating blades */}
    <group ref={bladesRef} position={[0, 1.15, 0.4]}>
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, 0, angle]}>
            {/* Blade arm */}
            <mesh position={[0, 0.4, 0]} castShadow>
              <boxGeometry args={[0.04, 0.8, 0.03]} />
              <meshStandardMaterial color="#5A3820" roughness={0.85} />
            </mesh>
            {/* Sail (cloth) */}
            <mesh position={[0.1, 0.5, 0]} castShadow>
              <boxGeometry args={[0.18, 0.45, 0.005]} />
              <meshStandardMaterial color="#F4E8D9" side={THREE.DoubleSide} roughness={0.7} />
            </mesh>
            {/* Cross slats on sail */}
            {[0.35, 0.55, 0.7].map((y) => (
              <mesh key={y} position={[0.1, y, 0.005]}>
                <boxGeometry args={[0.18, 0.008, 0.002]} />
                <meshStandardMaterial color="#8B6B4A" />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  </group>
);

/* ── Treehouse — built into a big oak ──────────────── */
const Treehouse = () => (
  <group>
    {/* Big trunk */}
    <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.16, 0.22, 1.0, 8]} />
      <meshStandardMaterial color="#5A3820" roughness={0.92} flatShading />
    </mesh>
    {/* Side branch supports */}
    {[-0.3, 0.3].map((x) => (
      <mesh key={x} position={[x, 0.6, 0]} rotation={[0, 0, x > 0 ? -0.6 : 0.6]}>
        <cylinderGeometry args={[0.04, 0.05, 0.35, 6]} />
        <meshStandardMaterial color="#5A3820" roughness={0.9} />
      </mesh>
    ))}
    {/* Wood platform */}
    <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.55, 0.55, 0.06, 16]} />
      <meshStandardMaterial color="#8B6B4A" roughness={0.85} />
    </mesh>
    {/* Plank seams on platform */}
    {[-0.3, -0.1, 0.1, 0.3].map((x) => (
      <mesh key={x} position={[x, 0.89, 0]}>
        <boxGeometry args={[0.015, 0.005, 1.0]} />
        <meshStandardMaterial color="#5A3820" />
      </mesh>
    ))}
    {/* Cabin walls */}
    <mesh position={[0, 1.15, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.7, 0.5, 0.7]} />
      <meshStandardMaterial color="#A87A4E" roughness={0.85} />
    </mesh>
    {/* Window */}
    <mesh position={[0, 1.2, 0.36]}>
      <boxGeometry args={[0.2, 0.2, 0.02]} />
      <meshStandardMaterial color="#F2C46C" emissive="#F2C46C" emissiveIntensity={0.6} />
    </mesh>
    {/* Door (side) */}
    <mesh position={[0.36, 1.1, 0]}>
      <boxGeometry args={[0.02, 0.32, 0.18]} />
      <meshStandardMaterial color="#3A2818" />
    </mesh>
    {/* Slanted roof */}
    <mesh position={[0, 1.55, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
      <coneGeometry args={[0.6, 0.45, 4]} />
      <meshStandardMaterial color="#3F7A3F" roughness={0.78} />
    </mesh>
    {/* Foliage around treehouse */}
    {[
      [0.6, 1.1, 0.3, 0.3],
      [-0.55, 1.2, -0.2, 0.28],
      [0.2, 1.4, -0.55, 0.32],
      [-0.4, 1.5, 0.45, 0.26],
    ].map(([x, y, z, r], i) => (
      <mesh key={i} position={[x, y, z]} castShadow>
        <sphereGeometry args={[r, 12, 10]} />
        <meshStandardMaterial color={i % 2 ? "#4A8548" : "#5A9A55"} roughness={0.75} flatShading />
      </mesh>
    ))}
    {/* Rope ladder */}
    {[0.05, 0.15, 0.25, 0.35, 0.5, 0.65].map((y, i) => (
      <mesh key={i} position={[-0.5, y, 0.1]}>
        <boxGeometry args={[0.12, 0.015, 0.015]} />
        <meshStandardMaterial color="#6B4226" />
      </mesh>
    ))}
    {/* Rope sides */}
    <mesh position={[-0.56, 0.4, 0.1]}>
      <cylinderGeometry args={[0.008, 0.008, 0.85, 4]} />
      <meshStandardMaterial color="#3A2818" />
    </mesh>
    <mesh position={[-0.44, 0.4, 0.1]}>
      <cylinderGeometry args={[0.008, 0.008, 0.85, 4]} />
      <meshStandardMaterial color="#3A2818" />
    </mesh>
    {/* Lantern hanging */}
    <mesh position={[0.4, 1.35, 0.4]}>
      <boxGeometry args={[0.08, 0.1, 0.08]} />
      <meshStandardMaterial color="#F4D87C" emissive="#F4D87C" emissiveIntensity={0.7} />
    </mesh>
    <pointLight position={[0.4, 1.35, 0.4]} color="#F4D87C" intensity={0.4} distance={1.8} />
  </group>
);

/* ── Bakery — warm pastry shop with striped awning ──── */
const Bakery = ({ smokeRef }: { smokeRef: RefObject<THREE.Mesh | null> }) => (
  <group>
    <mesh position={[0, 0.05, 0]} receiveShadow>
      <boxGeometry args={[1.0, 0.1, 0.88]} />
      <meshStandardMaterial color="#9B8E7E" />
    </mesh>
    <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.9, 0.8, 0.78]} />
      <meshStandardMaterial color="#F8EAC8" />
    </mesh>
    {/* Display window */}
    <mesh position={[-0.12, 0.38, 0.4]}>
      <boxGeometry args={[0.44, 0.34, 0.015]} />
      <meshStandardMaterial color="#A8D8F0" emissive="#F4E8C0" emissiveIntensity={0.3} transparent opacity={0.7} />
    </mesh>
    <mesh position={[-0.12, 0.55, 0.41]}><boxGeometry args={[0.46, 0.015, 0.01]} /><meshStandardMaterial color="#7A5032" /></mesh>
    <mesh position={[-0.12, 0.22, 0.41]}><boxGeometry args={[0.46, 0.015, 0.01]} /><meshStandardMaterial color="#7A5032" /></mesh>
    <mesh position={[-0.12, 0.38, 0.41]}><boxGeometry args={[0.015, 0.36, 0.01]} /><meshStandardMaterial color="#7A5032" /></mesh>
    {/* Striped awning */}
    {[-0.28, -0.18, -0.08, 0.02, 0.12].map((x, i) => (
      <mesh key={i} position={[x, 0.64, 0.46]} rotation={[-0.38, 0, 0]}>
        <boxGeometry args={[0.098, 0.005, 0.24]} />
        <meshStandardMaterial color={i % 2 === 0 ? "#D9433A" : "#F8F4EE"} />
      </mesh>
    ))}
    <mesh position={[-0.08, 0.575, 0.585]} rotation={[-0.38, 0, 0]}>
      <boxGeometry args={[0.54, 0.03, 0.015]} /><meshStandardMaterial color="#C53030" />
    </mesh>
    {/* Door */}
    <mesh position={[0.3, 0.34, 0.4]}>
      <boxGeometry args={[0.18, 0.52, 0.015]} /><meshStandardMaterial color="#7A5032" />
    </mesh>
    <mesh position={[0.3, 0.49, 0.41]}>
      <boxGeometry args={[0.1, 0.12, 0.01]} /><meshStandardMaterial color="#A8D8F0" transparent opacity={0.6} />
    </mesh>
    <mesh position={[0.36, 0.34, 0.415]}><sphereGeometry args={[0.012, 6, 6]} /><meshStandardMaterial color="#C9A55B" metalness={0.6} /></mesh>
    {/* Hanging sign */}
    <mesh position={[-0.12, 0.82, 0.5]}><boxGeometry args={[0.26, 0.14, 0.018]} /><meshStandardMaterial color="#F4D87C" /></mesh>
    <mesh position={[-0.24, 0.9, 0.47]}><boxGeometry args={[0.015, 0.16, 0.015]} /><meshStandardMaterial color="#5A3820" /></mesh>
    <mesh position={[0.0, 0.9, 0.47]}><boxGeometry args={[0.015, 0.16, 0.015]} /><meshStandardMaterial color="#5A3820" /></mesh>
    {/* Roof */}
    <mesh position={[0, 0.93, 0]}><boxGeometry args={[1.02, 0.06, 0.9]} /><meshStandardMaterial color="#C5523A" /></mesh>
    <mesh position={[0, 1.14, 0]} castShadow rotation={[0, Math.PI / 4, 0]}>
      <coneGeometry args={[0.73, 0.44, 4]} /><meshStandardMaterial color="#C5523A" />
    </mesh>
    {/* Chimney + smoke */}
    <mesh position={[-0.22, 1.05, -0.12]} castShadow><boxGeometry args={[0.1, 0.28, 0.1]} /><meshStandardMaterial color="#7A6B5A" /></mesh>
    <mesh ref={smokeRef} position={[-0.22, 1.2, -0.12]}><sphereGeometry args={[0.07, 8, 8]} /><meshStandardMaterial color="#E8E8E8" transparent opacity={0.5} /></mesh>
    {/* Flower boxes */}
    {[-0.3, 0.12].map((x, i) => (
      <group key={i} position={[x, 0.47, 0.43]}>
        <mesh><boxGeometry args={[0.14, 0.055, 0.06]} /><meshStandardMaterial color="#6B4226" /></mesh>
        {[-0.04, 0, 0.04].map((dx, j) => (
          <mesh key={j} position={[dx, 0.05, 0]}><sphereGeometry args={[0.024, 6, 6]} /><meshStandardMaterial color={["#F4A0A0","#F2C46C","#D4A8E0"][j]} /></mesh>
        ))}
      </group>
    ))}
  </group>
);

/* ── Tea House — two-tier pagoda with lanterns ──────── */
const TeaHouse = ({ lanternRef }: { lanternRef: RefObject<THREE.Mesh | null> }) => (
  <group>
    {/* Stone base */}
    <mesh position={[0, 0.05, 0]} receiveShadow><boxGeometry args={[1.05, 0.1, 0.95]} /><meshStandardMaterial color="#7A6B5A" roughness={0.9} /></mesh>
    <mesh position={[0, 0.03, 0.54]}><boxGeometry args={[0.38, 0.06, 0.1]} /><meshStandardMaterial color="#9B8E7E" /></mesh>
    {/* Lower walls */}
    <mesh position={[0, 0.36, 0]} castShadow><boxGeometry args={[0.86, 0.52, 0.76]} /><meshStandardMaterial color="#3A2010" /></mesh>
    {/* Sliding door slats */}
    {[-0.12, -0.04, 0.04, 0.12].map((x, i) => (
      <mesh key={i} position={[x, 0.31, 0.385]}><boxGeometry args={[0.06, 0.4, 0.012]} /><meshStandardMaterial color={i % 2 === 0 ? "#6B4A28" : "#5A3A18"} /></mesh>
    ))}
    {/* Side window */}
    <mesh position={[-0.33, 0.4, 0.385]}><boxGeometry args={[0.14, 0.2, 0.012]} /><meshStandardMaterial color="#F2C46C" emissive="#F2C46C" emissiveIntensity={0.6} /></mesh>
    {/* First roof tier */}
    <mesh position={[0, 0.66, 0]} castShadow><boxGeometry args={[1.12, 0.05, 1.02]} /><meshStandardMaterial color="#1E1208" /></mesh>
    <mesh position={[0, 0.73, 0]} castShadow rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[0.9, 0.22, 4]} /><meshStandardMaterial color="#2A1A08" /></mesh>
    {/* Upturned eave tips */}
    {([[0.56, 0.68, 0.5, -0.35, 0.35], [-0.56, 0.68, 0.5, 0.35, 0.35], [0.56, 0.68, -0.5, -0.35, -0.35], [-0.56, 0.68, -0.5, 0.35, -0.35]] as number[][]).map(([x, y, z, rx, rz], i) => (
      <mesh key={i} position={[x, y, z]} rotation={[rz * 0.5, 0, rx * 0.5]}>
        <boxGeometry args={[0.1, 0.04, 0.14]} /><meshStandardMaterial color="#1E1208" />
      </mesh>
    ))}
    {/* Gold trim ring */}
    <mesh position={[0, 0.67, 0]}><torusGeometry args={[0.6, 0.012, 4, 4]} /><meshStandardMaterial color="#C9A55B" metalness={0.4} /></mesh>
    {/* Second story */}
    <mesh position={[0, 0.92, 0]} castShadow><boxGeometry args={[0.64, 0.36, 0.56]} /><meshStandardMaterial color="#3A2010" /></mesh>
    <mesh position={[0, 1.0, 0.285]}><boxGeometry args={[0.22, 0.16, 0.01]} /><meshStandardMaterial color="#F2C46C" emissive="#F2C46C" emissiveIntensity={0.5} /></mesh>
    {/* Second roof tier */}
    <mesh position={[0, 1.12, 0]}><boxGeometry args={[0.8, 0.045, 0.72]} /><meshStandardMaterial color="#1E1208" /></mesh>
    <mesh position={[0, 1.22, 0]} castShadow rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[0.62, 0.36, 4]} /><meshStandardMaterial color="#2A1A08" /></mesh>
    {/* Finial */}
    <mesh position={[0, 1.44, 0]}><cylinderGeometry args={[0.012, 0.012, 0.24, 6]} /><meshStandardMaterial color="#C9A55B" metalness={0.5} /></mesh>
    <mesh position={[0, 1.57, 0]}><sphereGeometry args={[0.038, 8, 8]} /><meshStandardMaterial color="#C9A55B" metalness={0.7} /></mesh>
    {/* Hanging lanterns */}
    {[[-0.36, 0.63, 0.49], [0.36, 0.63, 0.49]].map(([x, y, z], i) => (
      <group key={i} position={[x, y, z]}>
        <mesh position={[0, 0.04, 0]}><cylinderGeometry args={[0.007, 0.007, 0.08, 4]} /><meshStandardMaterial color="#2A1A08" /></mesh>
        <mesh ref={i === 0 ? lanternRef : undefined} position={[0, -0.02, 0]}>
          <cylinderGeometry args={[0.044, 0.038, 0.1, 8]} />
          <meshStandardMaterial color="#E03020" emissive="#FF6020" emissiveIntensity={0.7} />
        </mesh>
        <mesh position={[0, -0.08, 0]}><cylinderGeometry args={[0.014, 0.0, 0.04, 6]} /><meshStandardMaterial color="#F4D87C" /></mesh>
      </group>
    ))}
    {/* Bamboo corner poles */}
    {[[-0.48, -0.44], [0.48, -0.44], [-0.48, 0.39], [0.48, 0.39]].map(([x, z], i) => (
      <mesh key={i} position={[x, 0.42, z]} castShadow><cylinderGeometry args={[0.024, 0.024, 0.84, 6]} /><meshStandardMaterial color="#6A8B3A" roughness={0.8} /></mesh>
    ))}
  </group>
);

/* ── Observatory — stone dome with telescope ────────── */
const Observatory = () => (
  <group>
    {/* Stone cylinder base */}
    <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.55, 0.62, 0.64, 16]} />
      <meshStandardMaterial color="#8B8078" roughness={0.9} flatShading />
    </mesh>
    {/* Gold decorative band */}
    <mesh position={[0, 0.58, 0]}><cylinderGeometry args={[0.57, 0.57, 0.04, 16]} /><meshStandardMaterial color="#C9A55B" metalness={0.4} /></mesh>
    {/* Glowing amber windows */}
    {[0, 1, 2, 3].map((i) => {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      return (
        <mesh key={i} position={[Math.cos(a) * 0.53, 0.3, Math.sin(a) * 0.53]} rotation={[0, -a, 0]}>
          <boxGeometry args={[0.12, 0.2, 0.015]} />
          <meshStandardMaterial color="#F2C46C" emissive="#F2A030" emissiveIntensity={0.9} />
        </mesh>
      );
    })}
    {/* Dome (hemisphere) */}
    <mesh position={[0, 0.65, 0]} castShadow>
      <sphereGeometry args={[0.52, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color="#A0AEBB" metalness={0.45} roughness={0.28} />
    </mesh>
    <mesh position={[0, 0.65, 0]}><cylinderGeometry args={[0.53, 0.53, 0.04, 24]} /><meshStandardMaterial color="#788898" metalness={0.5} /></mesh>
    {/* Telescope barrel poking out */}
    <mesh position={[0.22, 0.97, 0]} rotation={[0, 0, -Math.PI / 5.5]}>
      <cylinderGeometry args={[0.055, 0.075, 0.56, 10]} />
      <meshStandardMaterial color="#3A4A5A" metalness={0.85} roughness={0.2} />
    </mesh>
    <mesh position={[0.44, 1.12, 0]} rotation={[0, 0, -Math.PI / 5.5]}>
      <cylinderGeometry args={[0.065, 0.065, 0.04, 12]} />
      <meshStandardMaterial color="#7BC5E5" emissive="#7BC5E5" emissiveIntensity={0.35} />
    </mesh>
    {/* Star dots on dome */}
    {[0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i / 6) * Math.PI * 2;
      return (
        <mesh key={i} position={[Math.cos(a) * 0.41, 0.84, Math.sin(a) * 0.41]}>
          <sphereGeometry args={[0.019, 6, 6]} />
          <meshStandardMaterial color="#F4E87C" emissive="#F4E87C" emissiveIntensity={1.0} />
        </mesh>
      );
    })}
    {/* Stone steps */}
    {[0, 1, 2].map((i) => (
      <mesh key={i} position={[0, 0.04 + i * 0.04, 0.68 - i * 0.05]}>
        <boxGeometry args={[0.38, 0.04, 0.14]} /><meshStandardMaterial color="#9B8E7E" />
      </mesh>
    ))}
    <mesh position={[0, 1.16, 0]}><sphereGeometry args={[0.038, 8, 8]} /><meshStandardMaterial color="#C9A55B" metalness={0.7} /></mesh>
    <pointLight position={[0, 0.88, 0]} color="#6060FF" intensity={0.45} distance={2.2} />
  </group>
);

/* ── Bell Tower — tall stone tower with animated bell ─ */
const BellTower = ({ bellRef }: { bellRef: RefObject<THREE.Group | null> }) => (
  <group>
    {/* Stone base */}
    <mesh position={[0, 0.1, 0]} receiveShadow><boxGeometry args={[0.82, 0.2, 0.82]} /><meshStandardMaterial color="#7A6B5A" roughness={0.9} flatShading /></mesh>
    {/* Main tower */}
    <mesh position={[0, 0.98, 0]} castShadow receiveShadow><boxGeometry args={[0.66, 1.66, 0.66]} /><meshStandardMaterial color="#9B8E7E" roughness={0.88} flatShading /></mesh>
    {/* Stone course bands */}
    {[0.28, 0.7, 1.1, 1.55].map((y) => (
      <mesh key={y} position={[0, y, 0]}><boxGeometry args={[0.68, 0.028, 0.68]} /><meshStandardMaterial color="#7A6B5A" /></mesh>
    ))}
    {/* Arched doorway */}
    <mesh position={[0, 0.27, 0.34]}><boxGeometry args={[0.22, 0.4, 0.018]} /><meshStandardMaterial color="#2A1A0A" /></mesh>
    <mesh position={[0, 0.47, 0.34]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.11, 0.11, 0.02, 8, 1, false, 0, Math.PI]} />
      <meshStandardMaterial color="#2A1A0A" />
    </mesh>
    {/* Climbing vines */}
    {[0.48, 0.9, 1.32].map((y) => (
      <mesh key={y} position={[0, y, 0]} rotation={[0, y * 0.8, 0]}>
        <torusGeometry args={[0.34, 0.016, 4, 12, Math.PI * 1.3]} />
        <meshStandardMaterial color="#3A6B2A" roughness={0.9} />
      </mesh>
    ))}
    {/* Bell chamber */}
    <mesh position={[0, 1.87, 0]} castShadow><boxGeometry args={[0.66, 0.42, 0.66]} /><meshStandardMaterial color="#B8A898" roughness={0.8} /></mesh>
    {/* Open arch faces */}
    {[0, 1, 2, 3].map((i) => {
      const a = (i / 4) * Math.PI * 2;
      return (
        <mesh key={i} position={[Math.cos(a) * 0.31, 1.87, Math.sin(a) * 0.31]} rotation={[0, -a, 0]}>
          <boxGeometry args={[0.42, 0.28, 0.015]} /><meshStandardMaterial color="#1A1008" transparent opacity={0.4} />
        </mesh>
      );
    })}
    {/* Animated bell */}
    <group ref={bellRef} position={[0, 1.94, 0]}>
      <mesh position={[0, 0.06, 0]}><cylinderGeometry args={[0.04, 0.11, 0.1, 12]} /><meshStandardMaterial color="#C9A55B" metalness={0.65} roughness={0.35} /></mesh>
      <mesh position={[0, -0.02, 0]}><cylinderGeometry args={[0.11, 0.16, 0.14, 12]} /><meshStandardMaterial color="#C9A55B" metalness={0.65} roughness={0.35} /></mesh>
      <mesh position={[0, -0.12, 0]}><sphereGeometry args={[0.024, 6, 6]} /><meshStandardMaterial color="#8B7040" metalness={0.5} /></mesh>
    </group>
    {/* Spire */}
    <mesh position={[0, 2.14, 0]} castShadow><coneGeometry args={[0.37, 0.52, 4]} /><meshStandardMaterial color="#4A5A6A" flatShading /></mesh>
    {/* Weather vane */}
    <mesh position={[0, 2.42, 0]}><cylinderGeometry args={[0.007, 0.007, 0.22, 4]} /><meshStandardMaterial color="#8B7040" metalness={0.6} /></mesh>
    <mesh position={[0.06, 2.47, 0]}><boxGeometry args={[0.14, 0.014, 0.014]} /><meshStandardMaterial color="#8B7040" metalness={0.6} /></mesh>
  </group>
);

/* ── Zen Garden — raked sand, stones, bonsai ────────── */
const ZenGarden = () => (
  <group>
    {/* Outer stone border */}
    {([-0.51, 0.51] as number[]).map((z) => (
      <mesh key={z} position={[0, 0.07, z]}><boxGeometry args={[1.12, 0.14, 0.1]} /><meshStandardMaterial color="#7A6B5A" roughness={0.9} /></mesh>
    ))}
    {([-0.51, 0.51] as number[]).map((x) => (
      <mesh key={x} position={[x, 0.07, 0]}><boxGeometry args={[0.1, 0.14, 0.92]} /><meshStandardMaterial color="#7A6B5A" roughness={0.9} /></mesh>
    ))}
    {/* Sand floor */}
    <mesh position={[0, 0.01, 0]}><boxGeometry args={[0.93, 0.018, 0.93]} /><meshStandardMaterial color="#E8D8B0" roughness={1.0} /></mesh>
    {/* Raked lines */}
    {[-0.32, -0.18, -0.04, 0.1, 0.24].map((z) => (
      <mesh key={z} position={[0, 0.022, z]}><boxGeometry args={[0.85, 0.003, 0.011]} /><meshStandardMaterial color="#D4C8A0" /></mesh>
    ))}
    {/* Rocks */}
    <mesh position={[-0.22, 0.08, -0.16]}><dodecahedronGeometry args={[0.1]} /><meshStandardMaterial color="#4A4845" roughness={0.95} flatShading /></mesh>
    <mesh position={[0.18, 0.07, 0.13]}><dodecahedronGeometry args={[0.085]} /><meshStandardMaterial color="#5A5250" roughness={0.95} flatShading /></mesh>
    <mesh position={[0.06, 0.05, -0.25]}><dodecahedronGeometry args={[0.062]} /><meshStandardMaterial color="#625E5A" roughness={0.95} flatShading /></mesh>
    {/* Bonsai */}
    <mesh position={[0.28, 0.1, -0.1]}><cylinderGeometry args={[0.016, 0.022, 0.18, 6]} /><meshStandardMaterial color="#5A3820" /></mesh>
    <mesh position={[0.28, 0.23, -0.1]}><sphereGeometry args={[0.07, 10, 8]} /><meshStandardMaterial color="#3A7A3A" roughness={0.8} flatShading /></mesh>
    <mesh position={[0.22, 0.29, -0.06]}><sphereGeometry args={[0.048, 8, 6]} /><meshStandardMaterial color="#4A8A4A" roughness={0.8} flatShading /></mesh>
    <mesh position={[0.34, 0.29, -0.13]}><sphereGeometry args={[0.04, 8, 6]} /><meshStandardMaterial color="#3A7A3A" roughness={0.8} flatShading /></mesh>
    {/* Bamboo corner posts */}
    {([[-0.49, -0.49], [0.49, -0.49], [-0.49, 0.49], [0.49, 0.49]] as [number,number][]).map(([x, z], i) => (
      <mesh key={i} position={[x, 0.15, z]}><cylinderGeometry args={[0.017, 0.017, 0.3, 6]} /><meshStandardMaterial color="#7AB848" roughness={0.85} /></mesh>
    ))}
    {/* Bamboo rake leaning on border */}
    <mesh position={[-0.38, 0.16, 0.32]} rotation={[0, 0.5, -0.28]}>
      <cylinderGeometry args={[0.007, 0.007, 0.44, 4]} /><meshStandardMaterial color="#8B6040" roughness={0.9} />
    </mesh>
  </group>
);

/* ── Crystal Grotto — glowing gem spires ─────────────── */
const CrystalGrotto = ({ crystalRef }: { crystalRef: RefObject<THREE.Mesh | null> }) => {
  const crystals: { pos: [number,number,number]; scale: [number,number,number]; color: string; tilt: number }[] = [
    { pos: [0,    0.38, 0],     scale: [0.11, 0.72, 0.11], color: "#8060FF", tilt: 0 },
    { pos: [0.22, 0.22, 0.1],  scale: [0.085, 0.46, 0.085], color: "#40B0FF", tilt: 0.28 },
    { pos: [-0.2, 0.2, 0.14],  scale: [0.078, 0.38, 0.078], color: "#C060FF", tilt: -0.2 },
    { pos: [0.1,  0.16, -0.26],scale: [0.068, 0.34, 0.068], color: "#60FFDF", tilt: 0.14 },
    { pos: [-0.16,0.13, -0.21],scale: [0.058, 0.27, 0.058], color: "#8060FF", tilt: -0.34 },
    { pos: [0.28, 0.1, -0.16], scale: [0.054, 0.22, 0.054], color: "#40B0FF", tilt: 0.42 },
    { pos: [-0.27,0.1, -0.05], scale: [0.058, 0.24, 0.058], color: "#FF80C0", tilt: -0.25 },
    { pos: [0.05, 0.08, 0.3],  scale: [0.046, 0.18, 0.046], color: "#C060FF", tilt: 0.18 },
  ];
  return (
    <group>
      {/* Dark rocky base */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[0.5, 0.57, 0.12, 10]} />
        <meshStandardMaterial color="#2E2C28" roughness={0.95} flatShading />
      </mesh>
      {/* Stone mounds */}
      {([[0.3, 0.08, 0.26], [-0.32, 0.06, 0.2], [0.08, 0.07, -0.32]] as [number,number,number][]).map((p, i) => (
        <mesh key={i} position={p}><dodecahedronGeometry args={[0.1]} /><meshStandardMaterial color="#1E1C18" roughness={0.95} flatShading /></mesh>
      ))}
      {/* Crystal spires */}
      {crystals.map((c, i) => (
        <mesh key={i} ref={i === 0 ? crystalRef : undefined} position={c.pos} scale={c.scale} rotation={[c.tilt, 0, c.tilt * 0.5]}>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={c.color} emissive={c.color} emissiveIntensity={0.5} transparent opacity={0.88} roughness={0.08} metalness={0.08} />
        </mesh>
      ))}
      {/* Scattered shards */}
      {([[-.38, .03, .1], [.36, .03, -.32], [-.1, .03, .4]] as [number,number,number][]).map((p, i) => (
        <mesh key={i} position={p} rotation={[.3 * i, 0, .2 * i]}>
          <octahedronGeometry args={[0.034, 0]} />
          <meshStandardMaterial color={["#8060FF","#40B0FF","#C060FF"][i]} emissive={["#8060FF","#40B0FF","#C060FF"][i]} emissiveIntensity={0.5} />
        </mesh>
      ))}
      <pointLight position={[0, 0.5, 0]} color="#8080FF" intensity={0.6} distance={2.2} />
    </group>
  );
};

/* ── Amphitheater — semicircular stone seating + stage ─ */
const Amphitheater = ({ torchRef }: { torchRef: RefObject<THREE.Mesh | null> }) => (
  <group>
    {/* Stage platform */}
    <mesh position={[0, 0.09, 0.24]} castShadow receiveShadow>
      <boxGeometry args={[1.1, 0.18, 0.54]} /><meshStandardMaterial color="#C8B898" roughness={0.85} />
    </mesh>
    <mesh position={[0, 0.04, 0.53]}><boxGeometry args={[0.68, 0.08, 0.1]} /><meshStandardMaterial color="#B8A888" roughness={0.85} /></mesh>
    {/* Backdrop wall */}
    <mesh position={[0, 0.47, -0.1]} castShadow><boxGeometry args={[1.12, 0.72, 0.12]} /><meshStandardMaterial color="#D0C0A0" roughness={0.8} /></mesh>
    {/* Crenellations */}
    {[-0.42, -0.21, 0, 0.21, 0.42].map((x) => (
      <mesh key={x} position={[x, 0.88, -0.1]}><boxGeometry args={[0.12, 0.12, 0.13]} /><meshStandardMaterial color="#C0B090" roughness={0.8} /></mesh>
    ))}
    {/* Stage columns */}
    {([-0.44, 0.44] as number[]).map((x) => (
      <group key={x}>
        <mesh position={[x, 0.37, -0.02]} castShadow><cylinderGeometry args={[0.058, 0.065, 0.56, 8]} /><meshStandardMaterial color="#E0D5C0" /></mesh>
        <mesh position={[x, 0.67, -0.02]}><boxGeometry args={[0.16, 0.06, 0.16]} /><meshStandardMaterial color="#D0C5B0" /></mesh>
        <mesh position={[x, 0.76, -0.02]}><cylinderGeometry args={[0.058, 0.04, 0.06, 8]} /><meshStandardMaterial color="#5A4A38" /></mesh>
        <mesh ref={x < 0 ? torchRef : undefined} position={[x, 0.85, -0.02]}>
          <coneGeometry args={[0.048, 0.1, 8]} /><meshStandardMaterial color="#F2A04C" emissive="#E55A2B" emissiveIntensity={0.9} />
        </mesh>
        {x < 0 && <pointLight position={[0, 0.87, -0.02]} color="#FF8030" intensity={0.5} distance={2.5} />}
      </group>
    ))}
    {/* Seating tiers — semicircular */}
    {[0, 1, 2].map((tier) => (
      <mesh key={tier} position={[0, 0.07 + tier * 0.13, -0.1]} receiveShadow>
        <cylinderGeometry args={[0.54 + tier * 0.28, 0.56 + tier * 0.28, 0.13, 10, 1, false, Math.PI, Math.PI]} />
        <meshStandardMaterial color={["#C8B898","#B8A888","#A89878"][tier]} roughness={0.85} />
      </mesh>
    ))}
    {/* Lectern on stage */}
    <mesh position={[0, 0.26, 0.18]} castShadow><boxGeometry args={[0.18, 0.17, 0.12]} /><meshStandardMaterial color="#8B6B4A" roughness={0.85} /></mesh>
    <mesh position={[0, 0.37, 0.15]}><boxGeometry args={[0.22, 0.018, 0.16]} /><meshStandardMaterial color="#7A5A3A" roughness={0.9} /></mesh>
  </group>
);

/* ── Moon Gate — glowing stone arch with rune ring ──── */
const Moongate = ({ glowRef }: { glowRef: RefObject<THREE.Mesh | null> }) => (
  <group>
    {/* Stone base platform */}
    <mesh position={[0, 0.04, 0]} receiveShadow><cylinderGeometry args={[0.72, 0.77, 0.08, 16]} /><meshStandardMaterial color="#7A6B5A" roughness={0.9} /></mesh>
    <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.62, 0.65, 0.06, 16]} /><meshStandardMaterial color="#8A7B6A" roughness={0.88} /></mesh>
    {/* Two stone pillars */}
    {([-0.39, 0.39] as number[]).map((x) => (
      <group key={x}>
        <mesh position={[x, 0.68, 0]} castShadow><boxGeometry args={[0.19, 1.22, 0.19]} /><meshStandardMaterial color="#8A7B6A" roughness={0.88} flatShading /></mesh>
        <mesh position={[x, 1.32, 0]}><boxGeometry args={[0.23, 0.08, 0.23]} /><meshStandardMaterial color="#9A8B7A" /></mesh>
        {/* Moss vines */}
        <mesh position={[x + (x > 0 ? -0.096 : 0.096), 0.72, 0.096]} rotation={[0, 0, x > 0 ? -0.12 : 0.12]}>
          <boxGeometry args={[0.013, 0.54, 0.013]} /><meshStandardMaterial color="#3A5A2A" roughness={0.9} />
        </mesh>
      </group>
    ))}
    {/* Lintel */}
    <mesh position={[0, 1.33, 0]}><boxGeometry args={[0.98, 0.09, 0.19]} /><meshStandardMaterial color="#8A7B6A" roughness={0.88} /></mesh>
    {/* The glowing torus ring */}
    <mesh ref={glowRef} position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.41, 0.062, 12, 38]} />
      <meshStandardMaterial color="#6858D8" emissive="#6858D8" emissiveIntensity={0.6} metalness={0.3} roughness={0.4} />
    </mesh>
    {/* Inner bright ring */}
    <mesh position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.37, 0.018, 8, 26]} />
      <meshStandardMaterial color="#B8A8FF" emissive="#B8A8FF" emissiveIntensity={1.0} />
    </mesh>
    {/* Rune dots */}
    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      const a = (i / 8) * Math.PI * 2;
      return (
        <mesh key={i} position={[Math.cos(a) * 0.41, 0.9, Math.sin(a) * 0.41]}>
          <sphereGeometry args={[0.017, 6, 6]} />
          <meshStandardMaterial color="#F0E8FF" emissive="#D0C0FF" emissiveIntensity={0.9} />
        </mesh>
      );
    })}
    {/* Portal shimmer disk */}
    <mesh position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.34, 24]} />
      <meshBasicMaterial color="#3030B0" transparent opacity={0.13} side={THREE.DoubleSide} />
    </mesh>
    <pointLight position={[0, 0.9, 0]} color="#8080FF" intensity={0.6} distance={2.8} />
  </group>
);
