import { useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { District } from "../state";
import { useGame, ISLAND_TIERS, DISTRICTS } from "../state";

import { useShallow } from "zustand/react/shallow";

/* ── Bumpy terrain disc using deformed cylinder ─────── */
const BumpyTerrain = ({
  radius,
  height,
  color,
  segments = 64,
  bumpScale = 0.18,
  position = [0, 0, 0] as [number, number, number],
  receiveShadow = true,
  flatShading = true,
}: {
  radius: number;
  height: number;
  color: string;
  segments?: number;
  bumpScale?: number;
  position?: [number, number, number];
  receiveShadow?: boolean;
  flatShading?: boolean;
}) => {
  const geometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(radius, radius * 0.92, height, segments, 4);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    // Deterministic noise per-vertex
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      // Only deform top vertices (y > 0)
      if (v.y > height * 0.3) {
        const angle = Math.atan2(v.z, v.x);
        const dist = Math.hypot(v.x, v.z);
        // Multi-octave wobble — gives gentle hills
        const noise =
          Math.sin(angle * 5 + dist * 3) * 0.5 +
          Math.sin(angle * 11 + dist * 1.5) * 0.3 +
          Math.cos(angle * 3 - dist * 4) * 0.4;
        v.y += noise * bumpScale;
        // Slightly pull edges in for organic shape
        const edgeFactor = dist / radius;
        v.x *= 1 - Math.abs(noise) * 0.04 * edgeFactor;
        v.z *= 1 - Math.abs(noise) * 0.04 * edgeFactor;
      }
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  }, [radius, height, segments, bumpScale]);

  return (
    <mesh position={position} receiveShadow={receiveShadow} castShadow geometry={geometry}>
      <meshStandardMaterial color={color} roughness={0.85} flatShading={flatShading} />
    </mesh>
  );
};

/* ── Single district landmass with layered geology ──── */
const DistrictLand = ({ d, overrideGrass, overrideCliff, overrideSand }: { d: District; overrideGrass?: string; overrideCliff?: string; overrideSand?: string }) => {
  const terrainSeed = `${d.id}:${d.radius}:${d.center[0]}:${d.center[1]}:${d.color}`;

  // Bigger, more dramatic hills
  const hills = useMemo(() => {
    const arr: { x: number; z: number; r: number; h: number; color: string }[] = [];
    const count = d.id === "hill" ? 9 : d.id === "forest" ? 6 : d.id === "beach" ? 3 : 5;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.8;
      const rr = (d.radius - 1.0) * (0.2 + Math.random() * 0.55);
      arr.push({
        x: Math.cos(a) * rr,
        z: Math.sin(a) * rr,
        r: 0.45 + Math.random() * 0.7,
        h:
          d.id === "hill"
            ? 0.55 + Math.random() * 0.85
            : d.id === "forest"
            ? 0.25 + Math.random() * 0.35
            : 0.15 + Math.random() * 0.25,
        color:
          d.id === "hill"
            ? `hsl(${80 + Math.random() * 20}, ${25 + Math.random() * 15}%, ${45 + Math.random() * 14}%)`
            : d.id === "forest"
            ? `hsl(${110 + Math.random() * 20}, ${38 + Math.random() * 15}%, ${30 + Math.random() * 12}%)`
            : d.color,
      });
    }
    return arr;
  }, [terrainSeed, d.id, d.radius, d.color]);

  // Cliff rocks around perimeter — more rugged
  const cliffRocks = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => {
        const a = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
        return {
          x: Math.cos(a) * (d.radius - 0.05),
          z: Math.sin(a) * (d.radius - 0.05),
          y: -0.55 + Math.random() * 0.35,
          s: 0.18 + Math.random() * 0.25,
          rot: Math.random() * Math.PI,
        };
      }),
    [terrainSeed, d.radius],
  );

  const grassPatches = useMemo(
    () =>
      Array.from({ length: 40 }).map((_, i) => {
        const a = (i / 40) * Math.PI * 2 + Math.random() * 0.6;
        const r = (d.radius - 0.6) * (0.15 + Math.random() * 0.75);
        return {
          x: Math.cos(a) * r,
          z: Math.sin(a) * r,
          s: 0.2 + Math.random() * 0.28,
          c:
            d.id === "forest"
              ? `hsl(${115 + Math.random() * 15}, ${40 + Math.random() * 15}%, ${28 + Math.random() * 10}%)`
              : d.id === "hill"
              ? `hsl(${85 + Math.random() * 20}, ${25 + Math.random() * 15}%, ${45 + Math.random() * 12}%)`
              : d.id === "beach"
              ? `hsl(${40 + Math.random() * 15}, ${55 + Math.random() * 20}%, ${65 + Math.random() * 10}%)`
              : `hsl(${120 + Math.random() * 20}, ${38 + Math.random() * 18}%, ${42 + Math.random() * 14}%)`,
        };
      }),
    [terrainSeed, d.id, d.radius, d.color],
  );

  // Animated foam ring
  const foamRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (foamRef.current) {
      const t = clock.elapsedTime;
      const m = foamRef.current.material as THREE.MeshStandardMaterial;
      m.opacity = 0.5 + Math.sin(t * 1.2 + d.center[0]) * 0.15;
      foamRef.current.scale.setScalar(1 + Math.sin(t * 0.8 + d.center[1]) * 0.015);
    }
  });

  const sandColor = overrideSand ?? (d.id === "beach" ? "#F4DCAC" : "#D8C8A0");
  const cliffColor = overrideCliff ?? (d.id === "hill" ? "#6A6058" : "#7A6848");
  const cliffDark = overrideCliff
    ? overrideCliff  // approximate
    : (d.id === "hill" ? "#4A4238" : "#5A4830");
  const grassColor = overrideGrass ?? d.color;

  return (
    <group position={[d.center[0], 0, d.center[1]]}>
      {/* Deep underwater foundation — tapered */}
      <mesh position={[0, -2.4, 0]} receiveShadow>
        <coneGeometry args={[d.radius - 0.8, 3, 24]} />
        <meshStandardMaterial color={cliffDark} roughness={0.95} flatShading />
      </mesh>
      {/* Mid cliff layer — rugged */}
      <mesh position={[0, -1.0, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[d.radius - 0.3, d.radius - 0.7, 0.9, 32, 1]} />
        <meshStandardMaterial color={cliffColor} roughness={0.9} flatShading />
      </mesh>
      {/* Cliff rim with rocks */}
      <mesh position={[0, -0.45, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[d.radius - 0.05, d.radius - 0.3, 0.5, 48, 1]} />
        <meshStandardMaterial color={cliffColor} roughness={0.85} flatShading />
      </mesh>
      {/* Cliff rocks scattered on edge */}
      {cliffRocks.map((rk, i) => (
        <mesh
          key={i}
          position={[rk.x, rk.y, rk.z]}
          rotation={[rk.rot * 0.3, rk.rot, rk.rot * 0.2]}
          castShadow
        >
          <dodecahedronGeometry args={[rk.s, 0]} />
          <meshStandardMaterial color={cliffDark} roughness={0.95} flatShading />
        </mesh>
      ))}
      {/* Sand ring */}
      <mesh position={[0, -0.18, 0]} receiveShadow>
        <cylinderGeometry args={[d.radius + 0.08, d.radius - 0.08, 0.22, 48]} />
        <meshStandardMaterial color={sandColor} roughness={0.92} />
      </mesh>
      {/* MAIN GRASS — bumpy heightmap terrain */}
      <BumpyTerrain
        radius={d.radius - 0.05}
        height={0.32}
        color={grassColor}
        segments={48}
        bumpScale={d.id === "hill" ? 0.32 : 0.18}
        position={[0, 0.1, 0]}
      />

      {/* Grass color variation patches */}
      {grassPatches.map((p, i) => (
        <mesh
          key={i}
          position={[p.x, 0.27, p.z]}
          rotation={[-Math.PI / 2, 0, Math.random() * Math.PI]}
        >
          <circleGeometry args={[p.s, 8]} />
          <meshStandardMaterial
            color={p.c}
            transparent
            opacity={0.65}
            roughness={0.85}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Rolling hills — bigger, dome-shaped */}
      {hills.map((h, i) => (
        <mesh
          key={i}
          position={[h.x, 0.12 + h.h * 0.45, h.z]}
          castShadow
          receiveShadow
          scale={[1, h.h, 1]}
        >
          <sphereGeometry args={[h.r, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={h.color} roughness={0.82} flatShading />
        </mesh>
      ))}

      {/* Animated shore foam ring */}
      <mesh ref={foamRef} position={[0, -0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[d.radius - 0.02, d.radius + 0.45, 64]} />
        <meshStandardMaterial
          color="#E8F4FF"
          transparent
          opacity={0.55}
          roughness={0.3}
          depthWrite={false}
        />
      </mesh>
      {/* Inner bright foam */}
      <mesh position={[0, -0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[d.radius - 0.05, d.radius + 0.12, 64]} />
        <meshStandardMaterial
          color="#FFFFFF"
          transparent
          opacity={0.7}
          roughness={0.2}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

/* ── Bridge between two districts ────────────────────── */
export const Bridge = ({ from, to }: { from: [number, number]; to: [number, number] }) => {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dz, dx);
  const mx = (from[0] + to[0]) / 2;
  const mz = (from[1] + to[1]) / 2;

  const plankCount = Math.floor(length * 2.5);

  return (
    <group position={[mx, -0.05, mz]} rotation={[0, -angle, 0]}>
      {/* Main deck */}
      <mesh receiveShadow castShadow>
        <boxGeometry args={[length, 0.05, 0.55]} />
        <meshStandardMaterial color="#8B6B4A" roughness={0.85} />
      </mesh>
      {/* Plank seams */}
      {Array.from({ length: plankCount }).map((_, i) => (
        <mesh key={i} position={[-length / 2 + 0.2 + i * (length / plankCount), 0.03, 0]}>
          <boxGeometry args={[0.015, 0.005, 0.55]} />
          <meshStandardMaterial color="#5A3820" roughness={0.9} />
        </mesh>
      ))}
      {/* Side railings */}
      {[0.25, -0.25].map((zz) => (
        <group key={zz}>
          <mesh position={[0, 0.12, zz]}>
            <boxGeometry args={[length, 0.04, 0.04]} />
            <meshStandardMaterial color="#6B4830" roughness={0.85} />
          </mesh>
          {Array.from({ length: Math.floor(length * 1.5) }).map((_, i) => (
            <mesh
              key={i}
              position={[-length / 2 + 0.3 + i * (length / Math.floor(length * 1.5)), 0.07, zz]}
            >
              <cylinderGeometry args={[0.02, 0.02, 0.14, 6]} />
              <meshStandardMaterial color="#5A3820" roughness={0.85} />
            </mesh>
          ))}
        </group>
      ))}
      {Array.from({ length: 3 }).map((_, i) => (
        <mesh key={i} position={[-length / 3 + i * (length / 3), -0.2, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.45, 6]} />
          <meshStandardMaterial color="#5A3820" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
};

/* ── Locked district ghost preview ───────────────────── */
export const LockedGhost = ({ d, onClick }: { d: District; onClick: () => void }) => (
  <group position={[d.center[0], 0, d.center[1]]}>
    <mesh
      position={[0, -0.4, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
    >
      <cylinderGeometry args={[d.radius, d.radius - 0.3, 0.12, 32]} />
      <meshStandardMaterial color={d.color} transparent opacity={0.15} />
    </mesh>
    <mesh position={[0, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[d.radius - 0.15, d.radius + 0.1, 48]} />
      <meshBasicMaterial color={d.color} transparent opacity={0.3} side={THREE.DoubleSide} />
    </mesh>
    <mesh position={[0, -0.1, 0]}>
      <sphereGeometry args={[d.radius * 0.7, 16, 16]} />
      <meshStandardMaterial color="#D0D8E0" transparent opacity={0.12} />
    </mesh>

    <Html position={[0, 0.4, 0]} center distanceFactor={9}>
      <button
        onClick={onClick}
        className="hud-panel-dark px-3 py-2 cursor-pointer hover:scale-105 transition pointer-events-auto whitespace-nowrap text-center"
      >
        <div className="text-2xl mb-0.5">{d.emoji}</div>
        <div className="display-font text-sm font-bold">{d.name}</div>
        <div className="text-[10px] opacity-70 font-bold">
          🔒 Lv.{d.unlockLevel} · {d.unlockCost}🪙
        </div>
      </button>
    </Html>
  </group>
);

/* ── Districts renderer — single island era ──────────── */
export const DistrictsRenderer = () => {
  const { islandEra, viewingEra  } = useGame(useShallow(s => ({ islandEra: s.islandEra, viewingEra: s.viewingEra })));
  const displayEra = viewingEra ?? islandEra;
  const tier = ISLAND_TIERS[displayEra];

  // Build a District-compatible object from the current island tier
  const mainDistrict: District = useMemo(
    () => ({
      ...DISTRICTS[0],
      name: tier.name,
      radius: tier.radius,
      color: tier.grassColor,
      unlocked: true,
    }),
    [tier.name, tier.radius, tier.grassColor],
  );

  return (
    <>
      <DistrictLand d={mainDistrict} overrideGrass={tier.grassColor} overrideCliff={tier.cliffColor} overrideSand={tier.sandColor} />
    </>
  );
};
