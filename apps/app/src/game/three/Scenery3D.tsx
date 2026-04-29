import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Instances, Instance } from "@react-three/drei";
import * as THREE from "three";
import type { Scenery } from "../state";

/* ── Wind wobble wrapper — gives subtle sway based on world position ── */
const WindSway = ({
  children,
  intensity = 1,
  pos,
}: {
  children: React.ReactNode;
  intensity?: number;
  pos: [number, number];
}) => {
  const ref = useRef<THREE.Group>(null);
  // Phase offset based on position so trees don't sway in unison
  const phase = useMemo(() => pos[0] * 0.7 + pos[1] * 0.5, [pos]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    // Multi-frequency wind: gentle base + occasional gust
    const base = Math.sin(t * 0.9 + phase) * 0.04;
    const gust = Math.sin(t * 0.3 + phase * 0.5) * 0.025;
    ref.current.rotation.z = (base + gust) * intensity;
    ref.current.rotation.x = Math.cos(t * 0.7 + phase) * 0.02 * intensity;
  });

  return <group ref={ref}>{children}</group>;
};

/* ── Pine tree — layered, organic ────────────────────── */
const PineTree = ({ pos, seed }: { pos: [number, number]; seed: number }) => {
  const tilt = (seed - 0.5) * 0.08;
  return (
    <group position={[pos[0], 0.26, pos[1]]} rotation={[tilt, seed * Math.PI * 2, 0]}>
      {/* Trunk — static */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.08, 0.45, 6]} />
        <meshStandardMaterial color="#6B4830" roughness={0.9} />
      </mesh>
      {/* Foliage tiers — sway with wind */}
      <WindSway pos={pos} intensity={0.8}>
        <mesh position={[0, 0.6, 0]} castShadow>
          <coneGeometry args={[0.42, 0.55, 8]} />
          <meshStandardMaterial color="#3A7B40" roughness={0.78} flatShading />
        </mesh>
        <mesh position={[0, 0.9, 0]} castShadow>
          <coneGeometry args={[0.32, 0.45, 8]} />
          <meshStandardMaterial color="#4A8A4A" roughness={0.75} flatShading />
        </mesh>
        <mesh position={[0, 1.15, 0]} castShadow>
          <coneGeometry args={[0.22, 0.35, 7]} />
          <meshStandardMaterial color="#5A9A55" roughness={0.72} flatShading />
        </mesh>
        <mesh position={[0, 1.35, 0]} castShadow>
          <coneGeometry args={[0.12, 0.2, 6]} />
          <meshStandardMaterial color="#68A860" roughness={0.7} />
        </mesh>
      </WindSway>
    </group>
  );
};

/* ── Oak tree — round, lush canopy ───────────────────── */
const OakTree = ({ pos, seed }: { pos: [number, number]; seed: number }) => (
  <group position={[pos[0], 0.26, pos[1]]} rotation={[0, seed * Math.PI * 2, 0]}>
    <mesh position={[0, 0.28, 0]} castShadow>
      <cylinderGeometry args={[0.08, 0.11, 0.56, 6]} />
      <meshStandardMaterial color="#5A3820" roughness={0.9} />
    </mesh>
    <mesh position={[0.12, 0.5, 0.05]} rotation={[0, 0, -0.5]}>
      <cylinderGeometry args={[0.03, 0.04, 0.2, 4]} />
      <meshStandardMaterial color="#5A3820" roughness={0.9} />
    </mesh>
    {/* Canopy — sways */}
    <WindSway pos={pos} intensity={1}>
      <mesh position={[0, 0.78, 0]} castShadow>
        <sphereGeometry args={[0.44, 14, 12]} />
        <meshStandardMaterial color="#4A8548" roughness={0.75} />
      </mesh>
      <mesh position={[0.2, 0.88, 0.08]} castShadow>
        <sphereGeometry args={[0.28, 12, 10]} />
        <meshStandardMaterial color="#5A9A55" roughness={0.72} />
      </mesh>
      <mesh position={[-0.18, 0.85, -0.08]} castShadow>
        <sphereGeometry args={[0.24, 10, 10]} />
        <meshStandardMaterial color="#3D7A3A" roughness={0.78} />
      </mesh>
      <mesh position={[0.05, 0.98, 0.12]} castShadow>
        <sphereGeometry args={[0.2, 10, 8]} />
        <meshStandardMaterial color="#68A860" roughness={0.7} />
      </mesh>
    </WindSway>
  </group>
);

/* ── Palm tree ───────────────────────────────────────── */
const PalmTree = ({ pos, seed }: { pos: [number, number]; seed: number }) => (
  <group position={[pos[0], 0.26, pos[1]]} rotation={[0, seed * Math.PI * 2, 0]}>
    <mesh position={[0, 0.23, 0]} rotation={[0, 0, seed * 0.1]} castShadow>
      <cylinderGeometry args={[0.055, 0.085, 0.46, 7]} />
      <meshStandardMaterial color="#9B7850" roughness={0.85} />
    </mesh>
    <mesh position={[0.015, 0.57, 0]} rotation={[0, 0, seed * 0.06]} castShadow>
      <cylinderGeometry args={[0.038, 0.055, 0.34, 7]} />
      <meshStandardMaterial color="#8B6840" roughness={0.85} />
    </mesh>
    {/* Crown + broad fronds (avoids spiky/buggy silhouette) */}
    <mesh position={[0.02, 0.78, 0]} castShadow>
      <sphereGeometry args={[0.07, 10, 8]} />
      <meshStandardMaterial color="#6A4A2C" roughness={0.88} />
    </mesh>
    <WindSway pos={pos} intensity={0.9}>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2 + (seed - 0.5) * 0.25;
        const shade = i % 2 === 0 ? "#3F9452" : "#4FAE5E";
        return (
          <group key={i} position={[0.02, 0.8, 0]} rotation={[0, a, 0]}>
            <mesh position={[0.22, 0, 0]} rotation={[0, 0, -Math.PI / 2.8]} castShadow>
              <capsuleGeometry args={[0.032, 0.28, 4, 8]} />
              <meshStandardMaterial color={shade} roughness={0.74} />
            </mesh>
            <mesh position={[0.35, -0.03, 0]} rotation={[0, 0, -Math.PI / 2.65]} castShadow>
              <capsuleGeometry args={[0.02, 0.18, 4, 8]} />
              <meshStandardMaterial color={shade} roughness={0.74} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0.08, 0.79, 0.04]}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshStandardMaterial color="#5A3820" roughness={0.85} />
      </mesh>
      <mesh position={[-0.04, 0.78, -0.06]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#4A2818" roughness={0.85} />
      </mesh>
    </WindSway>
  </group>
);

export const Tree3D = ({ pos, variant }: { pos: [number, number]; variant: number }) => {
  const seed = useMemo(() => Math.random(), []);
  if (variant === 2) return <PalmTree pos={pos} seed={seed} />;
  if (variant === 1) return <OakTree pos={pos} seed={seed} />;
  return <PineTree pos={pos} seed={seed} />;
};

/* ── Rocks ──────────────────────────────── */
export const Rock3D = ({ pos, variant }: { pos: [number, number]; variant: number }) => {
  const seed = useMemo(() => Math.random(), []);
  const baseSize = 0.16 + variant * 0.06;

  return (
    <group position={[pos[0], 0.24, pos[1]]} rotation={[seed * 0.3, seed * 2, seed * 0.2]}>
      <mesh castShadow>
        <dodecahedronGeometry args={[baseSize, 1]} />
        <meshStandardMaterial color={variant === 0 ? "#7A7B70" : "#8A8578"} roughness={0.92} flatShading />
      </mesh>
      {variant > 0 && (
        <mesh position={[baseSize * 0.8, -0.03, baseSize * 0.5]} castShadow>
          <dodecahedronGeometry args={[baseSize * 0.55, 1]} />
          <meshStandardMaterial color="#6A6B60" roughness={0.95} flatShading />
        </mesh>
      )}
      <mesh position={[0, baseSize * 0.5, 0]} scale={[1.05, 0.3, 1.05]}>
        <dodecahedronGeometry args={[baseSize, 1]} />
        <meshStandardMaterial color="#5A8C3B" flatShading transparent opacity={0.6} roughness={0.85} />
      </mesh>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + seed;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * baseSize * 1.2, -0.05, Math.sin(a) * baseSize * 1.2]}
          >
            <dodecahedronGeometry args={[0.035, 0]} />
            <meshStandardMaterial color="#8A8578" roughness={0.95} flatShading />
          </mesh>
        );
      })}
    </group>
  );
};

/* ── Flowers ────────────────── */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export const Flower3D = ({ pos, variant }: { pos: [number, number]; variant: number }) => {
  const colors = ["#E58F7B", "#F2C46C", "#C9A0E0", "#FFB6C1", "#88CCDD", "#F4A8A8"];
  return (
    <WindSway pos={pos} intensity={1.4}>
      <group position={[pos[0], 0.26, pos[1]]}>
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2 + variant * 0.5;
          const r = 0.05 + seededRandom(variant * 10 + i) * 0.06;
          return (
            <group key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
              <mesh>
                <cylinderGeometry args={[0.006, 0.006, 0.1 + i * 0.02, 3]} />
                <meshStandardMaterial color="#5A8C3B" roughness={0.8} />
              </mesh>
              <mesh position={[0.02, 0.03, 0]} rotation={[0, 0, 0.4]}>
                <sphereGeometry args={[0.015, 4, 4]} />
                <meshStandardMaterial color="#6BA848" roughness={0.8} />
              </mesh>
              <mesh position={[0, 0.06 + i * 0.01, 0]}>
                <sphereGeometry args={[0.04 + i * 0.005, 8, 6]} />
                <meshStandardMaterial color={colors[(variant + i) % colors.length]} roughness={0.6} />
              </mesh>
              <mesh position={[0, 0.065 + i * 0.01, 0.02]}>
                <sphereGeometry args={[0.015, 6, 6]} />
                <meshStandardMaterial color="#F2D46C" roughness={0.5} />
              </mesh>
            </group>
          );
        })}
      </group>
    </WindSway>
  );
};

/* ── Scattered grass tufts ───────────────────────────── */
const baseGrassGeo = new THREE.ConeGeometry(0.012, 1, 3);
baseGrassGeo.translate(0, 0.5, 0); // origin at bottom

export const GrassTufts = ({ tufts }: { tufts: [number, number][] }) => {
  return (
    <Instances geometry={baseGrassGeo} limit={tufts.length * 5} castShadow receiveShadow>
      <meshStandardMaterial roughness={0.8} />
      {tufts.map((pos, tIdx) => {
        const seed = pos[0] * 73.1 + pos[1] * 119.3;
        return (
          <WindSway key={tIdx} pos={pos} intensity={1.8}>
            <group position={[pos[0], 0.27, pos[1]]}>
              {[0, 1, 2, 3, 4].map((i) => {
                const s = seed + i;
                const a = i * 1.2 + seededRandom(s);
                const lean = (seededRandom(s + 50) - 0.5) * 0.3;
                const h = 0.1 + seededRandom(s + 100) * 0.04;
                const color = new THREE.Color(`hsl(${115 + seededRandom(s + 200) * 20}, ${40 + seededRandom(s + 300) * 15}%, ${38 + seededRandom(s + 400) * 12}%)`);
                return (
                  <Instance
                    key={i}
                    position={[Math.cos(a) * 0.035, 0, Math.sin(a) * 0.035]}
                    rotation={[lean, a, 0.05]}
                    scale={[1, h, 1]}
                    color={color}
                  />
                );
              })}
            </group>
          </WindSway>
        );
      })}
    </Instances>
  );
};

/* ── Renderer ────────────────────────────────────────── */
export const SceneryRenderer = ({ scenery }: { scenery: Scenery[] }) => (
  <>
    {scenery.map((s) => {
      if (s.type === "tree") return <Tree3D key={s.id} pos={s.pos} variant={s.variant} />;
      if (s.type === "rock") return <Rock3D key={s.id} pos={s.pos} variant={s.variant} />;
      if (s.type === "flower") return <Flower3D key={s.id} pos={s.pos} variant={s.variant} />;
      return null;
    })}
  </>
);
