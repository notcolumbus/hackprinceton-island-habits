import { useRef, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { Html, Float } from "@react-three/drei";
import * as THREE from "three";
import { BUILD_LIBRARY } from "../state";
import type { Agent, Building, Scenery } from "../state";

interface Props {
  agent: Agent;
  waypoints: [number, number][];
  buildings: Building[];
  scenery: Scenery[];
  onClick: () => void;
  isSelected: boolean;
  islandRadius?: number;
  onPositionUpdate?: (pos: THREE.Vector3) => void;
  timeOffsetMs?: number;
  gossipText?: string | null;
  gossipFrozenFacingPos?: THREE.Vector3 | null;
  gossipApproachTarget?: THREE.Vector3 | null;
  gatherTarget?: THREE.Vector3 | null;
}

const hashAgentId = (input: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const smoothStep = (t: number) => t * t * (3 - 2 * t);

/* ── Chibi-style cozy villager agent ──────────────────── */
export const Agent3D = ({
  agent,
  waypoints,
  buildings,
  scenery,
  onClick,
  isSelected,
  islandRadius = 7.0,
  onPositionUpdate,
  timeOffsetMs = 0,
  gossipText,
  gossipFrozenFacingPos,
  gossipApproachTarget,
  gatherTarget,
}: Props) => {
  const group = useRef<THREE.Group>(null);
  const bodyGroup = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Mesh>(null);
  const rightLeg = useRef<THREE.Mesh>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const seedHash = useMemo(() => hashAgentId(agent.id), [agent.id]);
  const seed = useMemo(() => (seedHash % 10_000) / 10_000, [seedHash]);
  const GROUND_Y = 0.26;
  const AGENT_RADIUS = 0.32;

  // Stable deterministic route per agent so all tabs/accounts animate identically.
  const orderedWaypoints = useMemo<[number, number][]>(() => {
    if (!waypoints || waypoints.length === 0) {
      return [agent.home];
    }
    return [...waypoints]
      .map((point, idx) => ({
        point,
        key: hashAgentId(`${agent.id}:${idx}`),
      }))
      .sort((a, b) => a.key - b.key)
      .map((entry) => entry.point);
  }, [agent.home, agent.id, waypoints]);

  const pos = useRef(new THREE.Vector3(agent.home[0], GROUND_Y, agent.home[1]));
  const angle = useRef(seed * Math.PI * 2);
  const walkCycle = useRef(0);
  // Accumulated route travel distance — incremented by pace*delta each frame so
  // mood changes only affect speed going forward, never snap position.
  const travelRef = useRef(seed * 10); // seed offset so agents start spread out
  // Cumulative offset applied on top of deterministic lerp so agents can slide
  // around obstacles instead of clipping through buildings/scenery.
  const displacement = useRef(new THREE.Vector2(0, 0));

  // Keep fresh refs so useFrame closure always has latest live data.
  const buildingsRef = useRef(buildings);
  buildingsRef.current = buildings;
  const sceneryRef = useRef(scenery);
  sceneryRef.current = scenery;
  const sceneryCountRef = useRef(scenery.length);
  sceneryCountRef.current = scenery.length;

  useFrame((_state, delta) => {
    if (!group.current) return;
    const nowMs = Date.now() + timeOffsetMs; // cosmetic effects only (body sway)

    // ── Gossip freeze mode: stop movement, face partner ──
    if (gossipFrozenFacingPos) {
      const dx = gossipFrozenFacingPos.x - pos.current.x;
      const dz = gossipFrozenFacingPos.z - pos.current.z;
      angle.current = Math.atan2(dx, dz);
      group.current.position.copy(pos.current);
      group.current.rotation.y = angle.current;
      onPositionUpdate?.(pos.current);
      walkCycle.current = 0;
      if (leftLeg.current) leftLeg.current.rotation.x = 0;
      if (rightLeg.current) rightLeg.current.rotation.x = 0;
      if (leftArm.current) { leftArm.current.rotation.x = 0; leftArm.current.rotation.z = 0; }
      if (rightArm.current) { rightArm.current.rotation.x = 0; rightArm.current.rotation.z = 0; }
      if (bodyGroup.current) { bodyGroup.current.position.y = Math.sin(nowMs * 0.002) * 0.008; bodyGroup.current.rotation.z = 0; }
      return;
    }

    const pace = 0.085 + (agent.mood / 100) * 0.045;
    let direction = new THREE.Vector2(0, 0);

    if (gossipApproachTarget) {
      // ── Approach mode: walk toward another agent ──
      const dx = gossipApproachTarget.x - pos.current.x;
      const dz = gossipApproachTarget.z - pos.current.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 0.15) {
        const step = Math.min(pace * delta * 60 * delta, dist);
        pos.current.x += (dx / dist) * step;
        pos.current.z += (dz / dist) * step;
        direction.set(dx, dz);
        angle.current = Math.atan2(dx, dz);
      }
      pos.current.y = GROUND_Y;
    } else if (gatherTarget) {
      // ── Gather mode: walk toward a tree or rock ──
      const dx = gatherTarget.x - pos.current.x;
      const dz = gatherTarget.z - pos.current.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 0.9) {
        const step = Math.min(pace * delta * 60 * delta, dist);
        pos.current.x += (dx / dist) * step;
        pos.current.z += (dz / dist) * step;
        direction.set(dx, dz);
        angle.current = Math.atan2(dx, dz);
      }
      pos.current.y = GROUND_Y;
    } else {
      // ── Normal mode: follow deterministic waypoint route ──
      const route = orderedWaypoints.length > 0 ? orderedWaypoints : [agent.home];
      const routeLen = route.length;
      travelRef.current += pace * delta * 60 * delta;
      const seg = ((travelRef.current % routeLen) + routeLen) % routeLen;
      const segIdx = Math.floor(seg);
      const nextIdx = (segIdx + 1) % routeLen;
      const routeT = smoothStep(seg - segIdx);

      const start = route[segIdx] ?? agent.home;
      const end = route[nextIdx] ?? start;
      direction = new THREE.Vector2(end[0] - start[0], end[1] - start[1]);

      pos.current.set(
        start[0] + (end[0] - start[0]) * routeT,
        GROUND_Y,
        start[1] + (end[1] - start[1]) * routeT,
      );
    }

    // ── Obstacle repulsion: keep agents from clipping through buildings/scenery ──
    let pushX = 0;
    let pushZ = 0;
    for (const b of buildingsRef.current) {
      const opt = BUILD_LIBRARY.find((x) => x.type === b.type);
      const bR = (opt?.radius ?? 0.5) + AGENT_RADIUS;
      const dx = pos.current.x - b.pos[0];
      const dz = pos.current.z - b.pos[1];
      const d = Math.hypot(dx, dz);
      if (d < bR && d > 0.001) {
        const str = ((bR - d) / bR) * 5;
        pushX += (dx / d) * str;
        pushZ += (dz / d) * str;
      }
    }
    for (const s of sceneryRef.current) {
      if (s.type === "flower") continue;
      const sR = (s.type === "tree" ? 0.38 : 0.22) + AGENT_RADIUS;
      const dx = pos.current.x - s.pos[0];
      const dz = pos.current.z - s.pos[1];
      const d = Math.hypot(dx, dz);
      if (d < sR && d > 0.001) {
        const str = ((sR - d) / sR) * 4;
        pushX += (dx / d) * str;
        pushZ += (dz / d) * str;
      }
    }
    const collisionDt = Math.min(delta, 0.05);
    if (gossipApproachTarget) {
      // Approach mode: pos is incremental, so push applies directly and persists.
      pos.current.x += pushX * collisionDt;
      pos.current.z += pushZ * collisionDt;
    } else {
      // Waypoint mode: pos is overwritten every frame by deterministic lerp,
      // so we accumulate the push into a decaying displacement offset.
      displacement.current.x = (displacement.current.x + pushX * collisionDt) * 0.9;
      displacement.current.y = (displacement.current.y + pushZ * collisionDt) * 0.9;
      pos.current.x += displacement.current.x;
      pos.current.z += displacement.current.y;
    }

    // Optional "work mode": if agent gets very close to an active construction,
    // stop and face it so all clients display the same behavior.
    let nearConstruction = false;
    let nearestSite: [number, number] | null = null;
    let nearestDist = Infinity;
    for (const building of buildingsRef.current) {
      if ((building.buildProgress ?? 1) >= 1) continue;
      const dx = building.pos[0] - pos.current.x;
      const dz = building.pos[1] - pos.current.z;
      const d = Math.hypot(dx, dz);
      if (d < nearestDist) {
        nearestDist = d;
        nearestSite = building.pos;
      }
    }
    // Also trigger work animation when at gather target
    if (gatherTarget) {
      const gdx = gatherTarget.x - pos.current.x;
      const gdz = gatherTarget.z - pos.current.z;
      if (Math.hypot(gdx, gdz) < 1.0) {
        nearConstruction = true;
        angle.current = Math.atan2(gdx, gdz);
      }
    }
    if (!nearConstruction && nearestSite && nearestDist < 1.25) {
      nearConstruction = true;
      angle.current = Math.atan2(nearestSite[0] - pos.current.x, nearestSite[1] - pos.current.z);
    } else if (direction.lengthSq() > 0.0001) {
      angle.current = Math.atan2(direction.x, direction.y);
    }

    if (Math.hypot(pos.current.x, pos.current.z) > islandRadius) {
      const clamped = new THREE.Vector2(pos.current.x, pos.current.z).setLength(islandRadius);
      pos.current.x = clamped.x;
      pos.current.z = clamped.y;
    }

    const walking = !nearConstruction && direction.lengthSq() > 0.01;

    group.current.position.copy(pos.current);
    group.current.rotation.y = angle.current;
    onPositionUpdate?.(pos.current);

    // ── Animation cycle — deterministic by world time ───
    walkCycle.current += delta * (nearConstruction ? 8 : (walking ? (5.5 + pace * 20) : 0));
    const t = walkCycle.current;
    const swing = walking ? Math.sin(t) * 0.45 : 0;
    const bounce = (walking || nearConstruction)
      ? Math.abs(Math.sin(t * 2)) * 0.035
      : Math.sin(nowMs * 0.002) * 0.008;

    if (leftLeg.current) leftLeg.current.rotation.x = nearConstruction ? 0 : swing;
    if (rightLeg.current) rightLeg.current.rotation.x = nearConstruction ? 0 : -swing;

    if (nearConstruction) {
      // Hammering: right arm pumps aggressively up and down
      const hammer = Math.sin(t) * 0.9;
      if (rightArm.current) {
        rightArm.current.rotation.x = -0.6 + hammer;
        rightArm.current.rotation.z = -0.25;
      }
      if (leftArm.current) {
        leftArm.current.rotation.x = 0.3;
        leftArm.current.rotation.z = 0.1;
      }
      if (leftArm.current) leftArm.current.rotation.x = 0.2;
    } else {
      if (leftArm.current) leftArm.current.rotation.x = -swing * 0.5;
      if (rightArm.current) rightArm.current.rotation.x = swing * 0.5;
    }

    // Body bounce
    if (bodyGroup.current) {
      bodyGroup.current.position.y = bounce;
      bodyGroup.current.rotation.z = walking ? Math.sin(t) * 0.03 : 0;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick();
  };

  const moodColor = agent.mood > 70 ? "#7AC5A0" : agent.mood > 50 ? "#F2C46C" : "#E58F7B";
  const skinMat = useMemo(() => new THREE.MeshStandardMaterial({ color: agent.skin, roughness: 0.7, metalness: 0.02 }), [agent.skin]);
  const shirtMat = useMemo(() => new THREE.MeshStandardMaterial({ color: agent.shirt, roughness: 0.65, metalness: 0.05 }), [agent.shirt]);
  const pantsMat = useMemo(() => new THREE.MeshStandardMaterial({ color: agent.pants, roughness: 0.75, metalness: 0.02 }), [agent.pants]);
  const hairMat = useMemo(() => new THREE.MeshStandardMaterial({ color: agent.hair, roughness: 0.8, metalness: 0.0 }), [agent.hair]);

  return (
    <group
      ref={group}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "default";
      }}
    >
      {/* Selection / hover ring */}
      {(isSelected || hovered) && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.32, 0.4, 32]} />
          <meshBasicMaterial
            color={agent.isYou ? "#7AC5A0" : isSelected ? "#6FA8DC" : "#F2C46C"}
            transparent
            opacity={0.75}
          />
        </mesh>
      )}

      {/* Shadow blob */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.2, 16]} />
        <meshBasicMaterial color="#2A3A20" transparent opacity={0.2} />
      </mesh>

      <group ref={bodyGroup}>
        {/* ── LEGS ── */}
        {/* Left leg */}
        <group position={[0.08, 0.12, 0]}>
          <mesh ref={leftLeg} castShadow>
            <capsuleGeometry args={[0.055, 0.1, 4, 8]} />
            <primitive object={pantsMat} attach="material" />
          </mesh>
          {/* Shoe */}
          <mesh position={[0, -0.08, 0.02]}>
            <sphereGeometry args={[0.06, 8, 6, 0, Math.PI * 2, 0, Math.PI / 1.5]} />
            <meshStandardMaterial color="#3A2418" roughness={0.8} />
          </mesh>
        </group>
        {/* Right leg */}
        <group position={[-0.08, 0.12, 0]}>
          <mesh ref={rightLeg} castShadow>
            <capsuleGeometry args={[0.055, 0.1, 4, 8]} />
            <primitive object={pantsMat} attach="material" />
          </mesh>
          <mesh position={[0, -0.08, 0.02]}>
            <sphereGeometry args={[0.06, 8, 6, 0, Math.PI * 2, 0, Math.PI / 1.5]} />
            <meshStandardMaterial color="#3A2418" roughness={0.8} />
          </mesh>
        </group>

        {/* ── TORSO ── roundish body */}
        <mesh position={[0, 0.34, 0]} castShadow>
          <sphereGeometry args={[0.18, 12, 10]} />
          <primitive object={shirtMat} attach="material" />
        </mesh>
        {/* Lower shirt overlap */}
        <mesh position={[0, 0.24, 0]} castShadow>
          <sphereGeometry args={[0.155, 10, 8]} />
          <primitive object={shirtMat} attach="material" />
        </mesh>

        {/* ── ARMS ── */}
        <group ref={leftArm} position={[0.22, 0.36, 0]}>
          {/* Sleeve */}
          <mesh castShadow>
            <sphereGeometry args={[0.065, 8, 8]} />
            <primitive object={shirtMat} attach="material" />
          </mesh>
          {/* Lower arm */}
          <mesh position={[0, -0.1, 0]} castShadow>
            <capsuleGeometry args={[0.04, 0.08, 4, 6]} />
            <primitive object={skinMat} attach="material" />
          </mesh>
          {/* Hand */}
          <mesh position={[0, -0.17, 0]}>
            <sphereGeometry args={[0.042, 8, 8]} />
            <primitive object={skinMat} attach="material" />
          </mesh>
        </group>
        <group ref={rightArm} position={[-0.22, 0.36, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.065, 8, 8]} />
            <primitive object={shirtMat} attach="material" />
          </mesh>
          <mesh position={[0, -0.1, 0]} castShadow>
            <capsuleGeometry args={[0.04, 0.08, 4, 6]} />
            <primitive object={skinMat} attach="material" />
          </mesh>
          <mesh position={[0, -0.17, 0]}>
            <sphereGeometry args={[0.042, 8, 8]} />
            <primitive object={skinMat} attach="material" />
          </mesh>
        </group>

        {/* ── NECK ── */}
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.05, 0.06, 0.06, 8]} />
          <primitive object={skinMat} attach="material" />
        </mesh>

        {/* ── HEAD — big chibi head ── */}
        <group position={[0, 0.68, 0]}>
          {/* Main head sphere */}
          <mesh castShadow>
            <sphereGeometry args={[0.2, 20, 18]} />
            <primitive object={skinMat} attach="material" />
          </mesh>

          {/* ── FACE ── */}
          {/* Eyes — big expressive */}
          <group position={[0, 0, 0.16]}>
            {/* Eye whites */}
            <mesh position={[0.065, 0.01, 0]}>
              <sphereGeometry args={[0.035, 12, 12]} />
              <meshStandardMaterial color="#FAFAF8" roughness={0.3} />
            </mesh>
            <mesh position={[-0.065, 0.01, 0]}>
              <sphereGeometry args={[0.035, 12, 12]} />
              <meshStandardMaterial color="#FAFAF8" roughness={0.3} />
            </mesh>
            {/* Pupils */}
            <mesh position={[0.065, 0.01, 0.025]}>
              <sphereGeometry args={[0.02, 10, 10]} />
              <meshBasicMaterial color="#1A1410" />
            </mesh>
            <mesh position={[-0.065, 0.01, 0.025]}>
              <sphereGeometry args={[0.02, 10, 10]} />
              <meshBasicMaterial color="#1A1410" />
            </mesh>
            {/* Eye shine */}
            <mesh position={[0.058, 0.02, 0.035]}>
              <sphereGeometry args={[0.008, 6, 6]} />
              <meshBasicMaterial color="#FFFFFF" />
            </mesh>
            <mesh position={[-0.058, 0.02, 0.035]}>
              <sphereGeometry args={[0.008, 6, 6]} />
              <meshBasicMaterial color="#FFFFFF" />
            </mesh>
          </group>

          {/* Cheek blush — rosy */}
          <mesh position={[0.12, -0.04, 0.13]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color="#F4A8A8" transparent opacity={0.5} roughness={0.9} />
          </mesh>
          <mesh position={[-0.12, -0.04, 0.13]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color="#F4A8A8" transparent opacity={0.5} roughness={0.9} />
          </mesh>

          {/* Nose — tiny dot */}
          <mesh position={[0, -0.02, 0.19]}>
            <sphereGeometry args={[0.015, 8, 8]} />
            <meshStandardMaterial color={agent.skin} roughness={0.6} />
          </mesh>

          {/* Mouth */}
          {agent.mood > 60 ? (
            /* Smile arc */
            <mesh position={[0, -0.065, 0.175]} rotation={[0.15, 0, 0]}>
              <torusGeometry args={[0.025, 0.005, 6, 12, Math.PI]} />
              <meshBasicMaterial color="#5A3020" />
            </mesh>
          ) : (
            /* Neutral line */
            <mesh position={[0, -0.065, 0.18]}>
              <boxGeometry args={[0.035, 0.008, 0.004]} />
              <meshBasicMaterial color="#5A3020" />
            </mesh>
          )}

          {/* ── HAIR ── */}
          {agent.hairStyle === "short" && (
            <group>
              <mesh position={[0, 0.06, -0.02]} castShadow>
                <sphereGeometry args={[0.21, 16, 14, 0, Math.PI * 2, 0, Math.PI / 1.8]} />
                <primitive object={hairMat} attach="material" />
              </mesh>
              {/* Side tufts */}
              <mesh position={[0.15, 0.02, 0.08]} castShadow>
                <sphereGeometry args={[0.06, 8, 8]} />
                <primitive object={hairMat} attach="material" />
              </mesh>
              <mesh position={[-0.15, 0.02, 0.08]} castShadow>
                <sphereGeometry args={[0.06, 8, 8]} />
                <primitive object={hairMat} attach="material" />
              </mesh>
            </group>
          )}
          {agent.hairStyle === "long" && (
            <group>
              <mesh position={[0, 0.06, -0.02]} castShadow>
                <sphereGeometry args={[0.215, 16, 14, 0, Math.PI * 2, 0, Math.PI / 1.6]} />
                <primitive object={hairMat} attach="material" />
              </mesh>
              {/* Long hair draping down */}
              <mesh position={[0.13, -0.1, -0.08]} castShadow>
                <capsuleGeometry args={[0.06, 0.2, 4, 8]} />
                <primitive object={hairMat} attach="material" />
              </mesh>
              <mesh position={[-0.13, -0.1, -0.08]} castShadow>
                <capsuleGeometry args={[0.06, 0.2, 4, 8]} />
                <primitive object={hairMat} attach="material" />
              </mesh>
              <mesh position={[0, -0.05, -0.15]} castShadow>
                <capsuleGeometry args={[0.1, 0.18, 4, 8]} />
                <primitive object={hairMat} attach="material" />
              </mesh>
            </group>
          )}
          {agent.hairStyle === "bun" && (
            <group>
              <mesh position={[0, 0.05, -0.02]} castShadow>
                <sphereGeometry args={[0.21, 16, 14, 0, Math.PI * 2, 0, Math.PI / 1.8]} />
                <primitive object={hairMat} attach="material" />
              </mesh>
              {/* Bun on top */}
              <mesh position={[0, 0.22, -0.06]} castShadow>
                <sphereGeometry args={[0.1, 12, 10]} />
                <primitive object={hairMat} attach="material" />
              </mesh>
              {/* Hair stick */}
              <mesh position={[0.04, 0.28, -0.06]} rotation={[0.3, 0, 0.4]}>
                <cylinderGeometry args={[0.008, 0.008, 0.12, 4]} />
                <meshStandardMaterial color="#C9A55B" metalness={0.4} roughness={0.4} />
              </mesh>
            </group>
          )}
          {agent.hairStyle === "cap" && (
            <group>
              {/* Hair under cap */}
              <mesh position={[0, 0.03, 0.08]} castShadow>
                <sphereGeometry args={[0.19, 12, 10, 0, Math.PI * 2, Math.PI / 3, Math.PI / 2]} />
                <primitive object={hairMat} attach="material" />
              </mesh>
              {/* Cap dome */}
              <mesh position={[0, 0.1, 0]} castShadow>
                <sphereGeometry args={[0.215, 14, 12, 0, Math.PI * 2, 0, Math.PI / 2.2]} />
                <primitive object={shirtMat} attach="material" />
              </mesh>
              {/* Visor */}
              <mesh position={[0, 0.08, 0.15]} rotation={[-0.3, 0, 0]}>
                <cylinderGeometry args={[0.18, 0.18, 0.02, 12, 1, false, -Math.PI / 2, Math.PI]} />
                <primitive object={shirtMat} attach="material" />
              </mesh>
            </group>
          )}

          {/* Ears (subtle) */}
          <mesh position={[0.19, -0.02, 0]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <primitive object={skinMat} attach="material" />
          </mesh>
          <mesh position={[-0.19, -0.02, 0]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <primitive object={skinMat} attach="material" />
          </mesh>
        </group>

        {/* ── Mood orb floating above ── */}
        <Float speed={3} rotationIntensity={0} floatIntensity={0.15}>
          <mesh position={[0, 1.08, 0]}>
            <sphereGeometry args={[0.05, 12, 12]} />
            <meshStandardMaterial
              color={moodColor}
              emissive={moodColor}
              emissiveIntensity={0.6}
              transparent
              opacity={0.85}
            />
          </mesh>
          <pointLight position={[0, 1.08, 0]} color={moodColor} intensity={0.15} distance={1} />
        </Float>
      </group>

      {/* ── Name tag label ── */}
      <Html position={[0, 1.25, 0]} center distanceFactor={6} zIndexRange={[10, 0]}>
        <div className="pointer-events-none flex flex-col items-center gap-0.5 select-none">
          <div
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black shadow-lg whitespace-nowrap ${
              agent.isYou
                ? "bg-primary text-primary-foreground border-2 border-white"
                : "bg-card text-foreground border border-border"
            }`}
          >
            {agent.name}
            {agent.isYou && " ★"}
          </div>
          <div className="h-1 w-10 rounded-full bg-black/30 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${agent.mood}%`, background: moodColor }}
            />
          </div>
        </div>
      </Html>

      {/* ── Gossip speech bubble — portaled to body to stay above all UI ── */}
      {gossipText && (
        <Html position={[0, 1.65, 0]} center distanceFactor={6} zIndexRange={[9999, 9999]} portal={{ current: document.body }}>
          <div className="pointer-events-none relative bg-white rounded-2xl px-3 py-1.5 text-[11px] font-bold shadow-lg max-w-[150px] text-center leading-snug border border-neutral-200 select-none">
            {gossipText}
            <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border-r border-b border-neutral-200 rotate-45" />
          </div>
        </Html>
      )}
    </group>
  );
};
