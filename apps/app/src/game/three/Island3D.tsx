import { useContext, useRef, useMemo, useState, useCallback, useEffect } from "react";
import type { MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Float } from "@react-three/drei";
// Postprocessing (EffectComposer + Pixelation + Vignette) removed —
// combined with many MiniIslandPreview canvases on the dashboard it pushes
// the tab past the browser's WebGL-context limit, and the composer can't
// read `gl.alpha` off a null context. The scene renders fine without it.
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useGame, GameCtx, ISLAND_TIERS } from "../state";
import type { Agent } from "../state";
import { Building3D } from "./Building3D";
import { Agent3D } from "./Agent3D";
import { SceneryRenderer, GrassTuft } from "./Scenery3D";
import { DistrictsRenderer } from "./Districts3D";
import { PlacementGhost } from "./PlacementGhost";

/* ── Gradient skydome (A Short Hike-inspired palette) ─ */
const SkyDome = () => {
  const domeRef = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(
    () => ({
      topColor: { value: new THREE.Color("#beddff") },
      middleColor: { value: new THREE.Color("#ffd8b7") },
      horizonColor: { value: new THREE.Color("#ffae93") },
      glowColor: { value: new THREE.Color("#fff0d8") },
    }),
    [],
  );

  useFrame(({ camera }) => {
    if (!domeRef.current) return;
    domeRef.current.position.copy(camera.position);
  });

  return (
    <mesh ref={domeRef} frustumCulled={false}>
      <sphereGeometry args={[90, 48, 24]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`
          varying float vH;
          void main() {
            vec3 dir = normalize(position);
            vH = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 topColor;
          uniform vec3 middleColor;
          uniform vec3 horizonColor;
          uniform vec3 glowColor;
          varying float vH;
          void main() {
            float h = vH;
            vec3 low = mix(horizonColor, middleColor, smoothstep(0.02, 0.36, h));
            vec3 high = mix(middleColor, topColor, smoothstep(0.30, 1.0, h));
            vec3 color = mix(low, high, smoothstep(0.12, 0.90, h));
            float horizonGlow = smoothstep(0.34, 0.53, h) * (1.0 - smoothstep(0.60, 0.80, h));
            color += glowColor * horizonGlow * 0.28;
            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  );
};

type CloudBlob = {
  position: [number, number, number];
  scale: [number, number, number];
  rot: number;
};

const ROUNDED_CLOUD_BLOBS: CloudBlob[] = [
  { position: [-1.7, 0.0, 0.06], scale: [1.5, 1.02, 1.16], rot: 0.12 },
  { position: [-0.65, 0.26, -0.05], scale: [1.44, 1.08, 1.2], rot: 0.28 },
  { position: [0.45, 0.14, 0.02], scale: [1.56, 1.02, 1.24], rot: -0.18 },
  { position: [1.58, -0.08, 0.06], scale: [1.3, 0.94, 1.08], rot: 0.22 },
  { position: [0.22, -0.42, 0.04], scale: [1.38, 0.8, 1.18], rot: 0.08 },
];

const RoundedCloud = ({
  position,
  scale = 1,
  hueShift = 0,
}: {
  position: [number, number, number];
  scale?: number;
  hueShift?: number;
}) => {
  const colors = useMemo(() => {
    const c0 = new THREE.Color("#ffffff");
    const c1 = new THREE.Color("#f6fbff");
    const c2 = new THREE.Color("#ecf5ff");
    if (hueShift !== 0) {
      c0.offsetHSL(hueShift, -0.01, 0);
      c1.offsetHSL(hueShift, -0.01, 0);
      c2.offsetHSL(hueShift, 0, 0);
    }
    return [`#${c0.getHexString()}`, `#${c1.getHexString()}`, `#${c2.getHexString()}`];
  }, [hueShift]);

  return (
    <group position={position} scale={scale}>
      {ROUNDED_CLOUD_BLOBS.map((blob, idx) => (
        <group key={idx} position={blob.position} rotation={[0, blob.rot, 0]}>
          <mesh castShadow={false} receiveShadow={false} scale={blob.scale}>
            <sphereGeometry args={[1, 24, 20]} />
            <meshLambertMaterial color={colors[idx % colors.length]} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const CloudLayer = () => (
  <group>
    <Float speed={0.2} rotationIntensity={0.03} floatIntensity={0.16}>
      <RoundedCloud position={[-11.5, 11.0, -8.0]} scale={1.32} />
    </Float>
    <Float speed={0.16} rotationIntensity={0.025} floatIntensity={0.14}>
      <RoundedCloud position={[10.0, 12.0, -10.0]} scale={1.18} hueShift={-0.004} />
    </Float>
    <Float speed={0.18} rotationIntensity={0.02} floatIntensity={0.13}>
      <RoundedCloud position={[-7.5, 13.0, 9.0]} scale={1.1} hueShift={0.004} />
    </Float>
    <Float speed={0.15} rotationIntensity={0.02} floatIntensity={0.12}>
      <RoundedCloud position={[13.0, 11.6, 7.0]} scale={1.2} />
    </Float>
  </group>
);

/* ── Animated ocean water with GPU ripples + soft fresnel edge ─ */
const WATER_GEOMETRY = (() => {
  const geo = new THREE.PlaneGeometry(220, 220, 80, 80);
  geo.rotateX(-Math.PI / 2);
  return geo;
})();

const Water = ({ color }: { color: string }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => {
    const eraTint = new THREE.Color(color);
    const shallow = eraTint.clone().lerp(new THREE.Color("#9be7ea"), 0.7);
    const deep = eraTint.clone().lerp(new THREE.Color("#63bfca"), 0.8);
    return {
      uTime: { value: 0 },
      uDeep: { value: deep },
      uShallow: { value: shallow },
      uEdge: { value: new THREE.Color("#d8fbff") },
      uOpacity: { value: 0.9 },
    };
  }, [color]);

  useFrame(({ clock }) => {
    if (!matRef.current) {
      return;
    }
    matRef.current.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh geometry={WATER_GEOMETRY} position={[0, -0.68, 0]} receiveShadow renderOrder={-1}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        vertexShader={`
          uniform float uTime;
          varying vec3 vWorldPos;
          varying vec3 vWorldNormal;

          void main() {
            vec3 pos = position;

            float w1 = sin((pos.x * 0.11) + uTime * 0.45) * 0.18;
            float w2 = cos((pos.z * 0.09) - uTime * 0.38) * 0.15;
            float w3 = sin((pos.x + pos.z) * 0.14 + uTime * 0.62) * 0.07;
            pos.y += w1 + w2 + w3;

            vec3 normalApprox = normalize(vec3(
              -0.11 * cos((position.x * 0.11) + uTime * 0.45) - 0.14 * cos((position.x + position.z) * 0.14 + uTime * 0.62),
               1.0,
               0.09 * sin((position.z * 0.09) - uTime * 0.38) - 0.14 * cos((position.x + position.z) * 0.14 + uTime * 0.62)
            ));

            vec4 worldPos = modelMatrix * vec4(pos, 1.0);
            vWorldPos = worldPos.xyz;
            vWorldNormal = normalize(mat3(modelMatrix) * normalApprox);

            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }
        `}
        fragmentShader={`
          uniform vec3 uDeep;
          uniform vec3 uShallow;
          uniform vec3 uEdge;
          uniform float uOpacity;
          uniform float uTime;
          varying vec3 vWorldPos;
          varying vec3 vWorldNormal;

          void main() {
            vec3 viewDir = normalize(cameraPosition - vWorldPos);
            float fresnel = pow(1.0 - max(dot(normalize(vWorldNormal), viewDir), 0.0), 2.4);
            float ripple = 0.5 + 0.5 * sin(vWorldPos.x * 0.09 + vWorldPos.z * 0.07 + uTime * 0.7);

            vec3 base = mix(uDeep, uShallow, ripple * 0.7 + 0.15);
            vec3 color = base + uEdge * fresnel * 0.55;

            float radial = length(vWorldPos.xz) / 95.0;
            float fade = 1.0 - smoothstep(0.82, 1.14, radial);
            float alpha = uOpacity * fade;

            gl_FragColor = vec4(color, alpha);
          }
        `}
      />
    </mesh>
  );
};

/* ── Scattered grass tufts ───────────────────────────── */
const GrassDecor = () => {
  const tufts = useMemo(
    () =>
      Array.from({ length: 40 }).map((_, i) => {
        const a = (i / 80) * Math.PI * 2 + Math.random() * 0.5;
        const r = 0.6 + Math.random() * 5.5;
        return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
      }),
    [],
  );
  return (
    <>
      {tufts.map((p, i) => (
        <GrassTuft key={i} pos={p} />
      ))}
    </>
  );
};

/* ── Ambient particles / fireflies ───────────────────── */
const Particles = () => {
  const ref = useRef<THREE.Points>(null);
  const count = 25;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 12;
      arr[i * 3 + 1] = 0.5 + Math.random() * 3;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 12;
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const geo = ref.current.geometry;
    const pos = geo.attributes.position.array as Float32Array;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += Math.sin(t * 0.5 + i) * 0.002;
      if (pos[i * 3 + 1] > 4) pos[i * 3 + 1] = 0.5;
    }
    geo.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.04} color="#F4E8A0" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
};

/* ── Real-time build ticker ──────────────────────────── */
const BuildTicker = () => {
  const { tickBuildings, viewingEra } = useGame();
  const flushTimer = useRef(0);
  const accumulated = useRef(0);
  useFrame((_s, delta) => {
    if (viewingEra !== null) return;
    accumulated.current += delta;
    flushTimer.current += delta;
    if (flushTimer.current >= 2.0) {
      tickBuildings(accumulated.current);
      accumulated.current = 0;
      flushTimer.current = 0;
    }
  });
  return null;
};

/* ── Camera tracker — follows the you-agent while preserving user angle/zoom ─── */
const SNAP_DURATION = 0.75; // seconds to animate zoom/tilt on tracking enable
const SNAP_DIST = 7;        // target follow distance when tracking starts
const SNAP_HEIGHT = 4.5;    // camera height when tracking starts

const CameraTracker = ({
  tracking,
  agentPos,
  controlsRef,
}: {
  tracking: boolean;
  agentPos: MutableRefObject<THREE.Vector3>;
  controlsRef: MutableRefObject<OrbitControlsImpl | null>;
}) => {
  const wasTracking = useRef(false);
  const snapElapsed = useRef(0);
  const lastAgentPos = useRef(new THREE.Vector3());
  const moveDelta = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const controls = controlsRef.current;
    if (!tracking || !controls) {
      wasTracking.current = false;
      snapElapsed.current = 0;
      return;
    }

    const current = agentPos.current;

    if (!wasTracking.current) {
      // Tracking just enabled — reset snap timer and seed lastAgentPos
      lastAgentPos.current.copy(current);
      snapElapsed.current = 0;
      wasTracking.current = true;
    }

    snapElapsed.current += delta;

    if (snapElapsed.current < SNAP_DURATION) {
      // ── Snap phase: animate to zoomed-in view, preserving current azimuth ──
      // Preserve the horizontal angle the user was looking from
      const dx = state.camera.position.x - controls.target.x;
      const dz = state.camera.position.z - controls.target.z;
      const horiz = Math.sqrt(dx * dx + dz * dz);
      const ax = horiz > 0.01 ? dx / horiz : 0;
      const az = horiz > 0.01 ? dz / horiz : 1;

      const desiredTarget = new THREE.Vector3(current.x, 0.5, current.z);
      const desiredCamPos = new THREE.Vector3(
        current.x + ax * SNAP_DIST,
        SNAP_HEIGHT,
        current.z + az * SNAP_DIST,
      );

      const t = Math.min(1, delta * 5);
      controls.target.lerp(desiredTarget, t);
      state.camera.position.lerp(desiredCamPos, t);
      controls.update();
    } else {
      // ── Follow phase: translate camera+target by agent's movement delta ──
      // Angle and zoom are fully under user control; we only pan with the agent.
      moveDelta.current.copy(current).sub(lastAgentPos.current);
      if (moveDelta.current.lengthSq() > 1e-6) {
        controls.target.add(moveDelta.current);
        state.camera.position.add(moveDelta.current);
        controls.update();
      }
    }

    lastAgentPos.current.copy(current);
  });
  return null;
};

/* ── Gossip scheduler — periodically walks one agent to another ── */
const GossipScheduler = ({
  agents,
  activeConv,
  agentPositions,
  onApproachIntent,
  onGossip,
}: {
  agents: Agent[];
  activeConv: ActiveConv | null;
  agentPositions: MutableRefObject<Map<string, THREE.Vector3>>;
  onApproachIntent: (aId: string | null, bId: string | null) => void;
  onGossip: (a: Agent, b: Agent) => void;
}) => {
  const timer = useRef(0);
  const nextIn = useRef(20 + Math.random() * 40); // first gossip in 20-60s
  const intent = useRef<{ aId: string; bId: string } | null>(null);

  useFrame((_s, delta) => {
    if (activeConv) return; // pause while conversation is active

    if (intent.current) {
      const posA = agentPositions.current.get(intent.current.aId);
      const posB = agentPositions.current.get(intent.current.bId);
      if (posA && posB && posA.distanceTo(posB) < 0.8) {
        const agentA = agents.find((a) => a.id === intent.current!.aId);
        const agentB = agents.find((a) => a.id === intent.current!.bId);
        intent.current = null;
        onApproachIntent(null, null);
        if (agentA && agentB) onGossip(agentA, agentB);
      }
      return; // don't tick schedule timer while approaching
    }

    timer.current += delta;
    if (timer.current < nextIn.current || agents.length < 2) return;

    const shuffled = [...agents].sort(() => Math.random() - 0.5);
    const [a, b] = shuffled;
    intent.current = { aId: a.id, bId: b.id };
    onApproachIntent(a.id, b.id);
    timer.current = 0;
    nextIn.current = 30 + Math.random() * 60;
  });
  return null;
};

/* ── Gathering scheduler — sends agents to trees/rocks to collect resources ── */
type GatherTarget = {
  pos: THREE.Vector3;
  resource: "logs" | "rocks";
  phase: "approaching" | "gathering";
  gatherTimer: number; // seconds remaining in gathering phase
};

const GATHER_DURATION = 2.5; // seconds of arm-swing before collecting

const GatheringScheduler = ({
  agents,
  scenery,
  agentPositions,
  onGatherTargetUpdate,
  onGather,
  onGatherComplete,
}: {
  agents: Agent[];
  scenery: import("../state").Scenery[];
  agentPositions: MutableRefObject<Map<string, THREE.Vector3>>;
  onGatherTargetUpdate: (agentId: string, target: THREE.Vector3 | null, resource: "logs" | "rocks" | null) => void;
  onGather: (agentId: string, type: "logs" | "rocks") => void;
  onGatherComplete: (agentId: string, resource: "logs" | "rocks") => void;
}) => {
  const timers = useRef<Map<string, number>>(new Map());
  const targets = useRef<Map<string, GatherTarget | null>>(new Map());

  const nextTimerFor = (mood: number) => 15 + (1 - Math.max(0, Math.min(1, mood / 100))) * 45;

  useFrame((_s, delta) => {
    for (const agent of agents) {
      // Init timer on first appearance
      if (!timers.current.has(agent.id)) {
        timers.current.set(agent.id, nextTimerFor(agent.mood) * Math.random());
        targets.current.set(agent.id, null);
      }

      const existing = targets.current.get(agent.id);
      if (existing) {
        const agentPos = agentPositions.current.get(agent.id);
        if (agentPos) {
          const dist = Math.hypot(existing.pos.x - agentPos.x, existing.pos.z - agentPos.z);

          if (existing.phase === "approaching") {
            // Arrived within arm's reach — begin gathering animation
            if (dist < 0.9) {
              targets.current.set(agent.id, { ...existing, phase: "gathering", gatherTimer: GATHER_DURATION });
            }
          } else {
            // Gathering phase: count down the animation timer
            const remaining = existing.gatherTimer - delta;
            if (remaining > 0) {
              targets.current.set(agent.id, { ...existing, gatherTimer: remaining });
            } else {
              // Animation complete — collect resource
              onGather(agent.id, existing.resource);
              onGatherComplete(agent.id, existing.resource);
              targets.current.set(agent.id, null);
              onGatherTargetUpdate(agent.id, null, null);
              timers.current.set(agent.id, nextTimerFor(agent.mood));
            }
          }
        }
      } else {
        // Count down until next gathering trip
        const t = (timers.current.get(agent.id) ?? 0) - delta;
        timers.current.set(agent.id, t);
        if (t <= 0) {
          const resource: "logs" | "rocks" = Math.random() < 0.5 ? "logs" : "rocks";
          const targetType = resource === "logs" ? "tree" : "rock";
          const candidates = scenery.filter((s) => s.type === targetType);
          if (candidates.length > 0) {
            const pick = candidates[Math.floor(Math.random() * candidates.length)];
            const targetVec = new THREE.Vector3(pick.pos[0], 0, pick.pos[1]);
            targets.current.set(agent.id, { pos: targetVec, resource, phase: "approaching", gatherTimer: 0 });
            onGatherTargetUpdate(agent.id, targetVec, resource);
          } else {
            timers.current.set(agent.id, nextTimerFor(agent.mood));
          }
        }
      }
    }
  });
  return null;
};

/* ── Agent waypoints ─────────────────────────────────── */
const WAYPOINTS: [number, number][] = [
  [-2.5,  1.2], [ 2.0, -1.0], [ 1.0,  3.0], [-3.5, -2.5], [ 4.0, -1.5],
  [ 0.0, -2.5], [-1.0, -1.5], [ 5.0,  1.5], [-5.0,  0.5], [ 3.0,  4.0],
  [-3.0,  3.5], [ 1.0, -4.5], [-4.5,  1.5], [ 4.5, -3.5], [ 0.0,  5.0],
];

/* ── Main scene ──────────────────────────────────────── */
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:5001";
const GOSSIP_ENDPOINT = "/jobs/agent-gossip";
const TTS_ENDPOINT = "/jobs/agent-tts";
const SEC_PER_LINE = 2500; // ms each conversation line is shown

type ConvLine = { speaker: 'a' | 'b'; text: string };
type ActiveConv = {
  agentAId: string;
  agentBId: string;
  agentAPosCapture: THREE.Vector3;
  agentBPosCapture: THREE.Vector3;
};
type SaveConversationFn = (agentAPhone: string, agentBPhone: string, lines: ConvLine[], reasoning?: string) => void;

const Scene = ({
  agentTrackPos,
  saveConversation,
}: {
  agentTrackPos: MutableRefObject<THREE.Vector3>;
  saveConversation: SaveConversationFn;
}) => {
  const {
    agents,
    buildings,
    scenery,
    selectedAgent,
    setSelectedAgent,
    placingType,
    islandEra,
    viewingEra,
    timeOffsetMs,
    audioMuted,
    showToast,
    islandId,
  } = useGame();
  const agentPositions = useRef(new Map<string, THREE.Vector3>());
  const [activeConv, setActiveConv] = useState<ActiveConv | null>(null);
  const [gossipBubbles, setGossipBubbles] = useState<Map<string, string>>(new Map());
  const [approachIntent, setApproachIntent] = useState<{ aId: string; bId: string } | null>(null);
  const [gatherTargets, setGatherTargets] = useState<Map<string, THREE.Vector3 | null>>(new Map());
  const [gatherResourceTypes, setGatherResourceTypes] = useState<Map<string, "logs" | "rocks" | null>>(new Map());
  const [gatherPopups, setGatherPopups] = useState<Map<string, "logs" | "rocks">>(new Map());
  const gatherResourceMut = useMutation(api.islands.gatherResource);
  const preferBrowserTtsRef = useRef(false);
  const ttsWarnedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);

  const stopSpeechPlayback = useCallback(() => {
    if (ttsAbortRef.current) {
      ttsAbortRef.current.abort();
      ttsAbortRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const speakWithBrowserTts = useCallback(
    (text: string, speaker: "a" | "b") => {
      if (audioMuted || typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.02;
      utterance.pitch = speaker === "a" ? 1.1 : 0.95;
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const idx = speaker === "a" ? 0 : Math.min(1, voices.length - 1);
        utterance.voice = voices[idx];
      }
      window.speechSynthesis.speak(utterance);
    },
    [audioMuted],
  );

  useEffect(() => {
    if (audioMuted) {
      stopSpeechPlayback();
    }
  }, [audioMuted, stopSpeechPlayback]);

  useEffect(() => stopSpeechPlayback, [stopSpeechPlayback]);

  const speakLine = useCallback(
    (text: string, speaker: "a" | "b"): Promise<void> => {
      if (audioMuted || !text.trim()) {
        return new Promise((r) => setTimeout(r, SEC_PER_LINE));
      }

      if (preferBrowserTtsRef.current) {
        return new Promise<void>((resolve) => {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 1.02;
          utterance.pitch = speaker === "a" ? 1.1 : 0.95;
          const voices = window.speechSynthesis.getVoices();
          if (voices.length > 0) {
            utterance.voice = voices[speaker === "a" ? 0 : Math.min(1, voices.length - 1)];
          }
          utterance.onend = () => resolve();
          utterance.onerror = () => resolve();
          window.speechSynthesis.speak(utterance);
          setTimeout(resolve, 10_000); // safety cap
        });
      }

      stopSpeechPlayback();
      return new Promise<void>((resolve) => {
        const controller = new AbortController();
        ttsAbortRef.current = controller;

        fetch(`${BACKEND_URL}${TTS_ENDPOINT}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, speaker }),
          signal: controller.signal,
        })
          .then(async (response) => {
            if (!response.ok) {
              preferBrowserTtsRef.current = true;
              if (!ttsWarnedRef.current) {
                showToast("ElevenLabs unavailable, using browser voice fallback.");
                ttsWarnedRef.current = true;
              }
              speakWithBrowserTts(text, speaker);
              await new Promise((r) => setTimeout(r, SEC_PER_LINE));
              resolve();
              return;
            }

            const audioBlob = await response.blob();
            if (controller.signal.aborted || audioMuted) { resolve(); return; }

            const audioUrl = URL.createObjectURL(audioBlob);
            audioUrlRef.current = audioUrl;
            const audio = new Audio(audioUrl);
            audioRef.current = audio;

            audio.onended = () => {
              if (audioUrlRef.current === audioUrl) {
                URL.revokeObjectURL(audioUrl);
                audioUrlRef.current = null;
              }
              if (audioRef.current === audio) audioRef.current = null;
              resolve();
            };
            audio.onerror = () => { speakWithBrowserTts(text, speaker); resolve(); };

            audio.play().catch(() => {
              speakWithBrowserTts(text, speaker);
              resolve();
            });
          })
          .catch((err) => {
            if ((err as { name?: string })?.name !== "AbortError") {
              speakWithBrowserTts(text, speaker);
            }
            resolve();
          })
          .finally(() => {
            if (ttsAbortRef.current === controller) ttsAbortRef.current = null;
          });
      });
    },
    [audioMuted, stopSpeechPlayback, speakWithBrowserTts, showToast],
  );

  const onGossip = useCallback((agentA: Agent, agentB: Agent) => {
    const posA = agentPositions.current.get(agentA.id)?.clone() ?? new THREE.Vector3();
    const posB = agentPositions.current.get(agentB.id)?.clone() ?? new THREE.Vector3();

    // Freeze both agents immediately, clear any approach intent
    setApproachIntent(null);
    setActiveConv({ agentAId: agentA.id, agentBId: agentB.id, agentAPosCapture: posA, agentBPosCapture: posB });

    void fetch(`${BACKEND_URL}${GOSSIP_ENDPOINT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_a_personality: { name: agentA.name.replace(/ Jr\.$/, ''), goal: agentA.goal, mood: agentA.mood },
        agent_b_personality: { name: agentB.name.replace(/ Jr\.$/, ''), goal: agentB.goal, mood: agentB.mood },
        recent_events: [`${agentA.name.replace(/ Jr\.$/, '')} and ${agentB.name.replace(/ Jr\.$/, '')} met on the island`],
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(async (data: { lines?: ConvLine[], _reasoning?: string } | null) => {
        const lines = data?.lines;
        const reasoning = data?._reasoning;
        if (!lines?.length) { setActiveConv(null); return; }

        // Play each line only after the previous one finishes speaking
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const speakerId = line.speaker === 'a' ? agentA.id : agentB.id;
          const clearPrevId = i > 0 ? (lines[i - 1].speaker === 'a' ? agentA.id : agentB.id) : null;

          setGossipBubbles((prev) => {
            const next = new Map(prev);
            if (clearPrevId) next.delete(clearPrevId);
            next.set(speakerId, line.text);
            return next;
          });

          await speakLine(line.text, line.speaker);
          // Brief pause between lines
          await new Promise((r) => setTimeout(r, 400));
        }

        setGossipBubbles(new Map());
        setActiveConv(null);
        saveConversation(agentA.id, agentB.id, lines, reasoning);
      })
      .catch(() => { setActiveConv(null); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveConversation, speakLine]);

  const displayEra = viewingEra ?? islandEra;
  const tier = ISLAND_TIERS[displayEra];
  // `buildings` now holds every era (the Convex bridge stopped filtering so
  // past islands stay visitable). Scope down to the era currently on screen.
  const displayBuildings = buildings.filter((b) => (b.placedAtEra ?? 0) === displayEra);

  return (
    <>
      <SkyDome />
      <fog attach="fog" args={["#d8ecff", 36, 104]} />
      <Environment preset="sunset" environmentIntensity={0.25} />

      <ambientLight intensity={0.54} color="#ffead2" />
      <directionalLight
        position={[10, 14, 6]}
        intensity={1.35}
        color="#ffe9c7"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-6, 6, -8]} intensity={0.42} color="#9dc5e0" />
      <hemisphereLight args={["#ffc595", "#6f9f67", 0.34]} />

      <CloudLayer />

      <Water color={tier.waterColor} />

      <DistrictsRenderer />
      <GrassDecor />
      <SceneryRenderer scenery={scenery} />
      <Particles />

      {displayBuildings.map((b) => (
        <Building3D key={b.id} building={b} />
      ))}

      {viewingEra === null && agents.map((a) => (
        <Agent3D
          key={a.id}
          agent={a}
          waypoints={WAYPOINTS}
          buildings={buildings}
          scenery={scenery}
          islandRadius={ISLAND_TIERS[islandEra].radius}
          isSelected={selectedAgent === a.id}
          onClick={() => {
            if (placingType) return;
            setSelectedAgent(a.id);
          }}
          onPositionUpdate={(p) => {
            const cached = agentPositions.current.get(a.id);
            if (cached) {
              cached.copy(p);
            } else {
              agentPositions.current.set(a.id, p.clone());
            }
            if (a.isYou) agentTrackPos.current.copy(p);
          }}
          timeOffsetMs={timeOffsetMs}
          gossipText={gossipBubbles.get(a.id) ?? null}
          gossipFrozenFacingPos={
            activeConv?.agentAId === a.id ? activeConv.agentBPosCapture :
            activeConv?.agentBId === a.id ? activeConv.agentAPosCapture :
            null
          }
          gossipApproachTarget={
            approachIntent?.aId === a.id
              ? (agentPositions.current.get(approachIntent.bId) ?? null)
              : null
          }
          gatherTarget={gatherTargets.get(a.id) ?? null}
          gatherResourceType={gatherResourceTypes.get(a.id) ?? null}
          gatherPopup={gatherPopups.get(a.id) ?? null}
        />
      ))}

      {viewingEra === null && (
        <GossipScheduler
          agents={agents}
          activeConv={activeConv}
          agentPositions={agentPositions}
          onApproachIntent={(aId, bId) => setApproachIntent(aId && bId ? { aId, bId } : null)}
          onGossip={onGossip}
        />
      )}

      {viewingEra === null && (
        <GatheringScheduler
          agents={agents}
          scenery={scenery}
          agentPositions={agentPositions}
          onGatherTargetUpdate={(agentId, target, resource) => {
            setGatherTargets((prev) => {
              const next = new Map(prev);
              next.set(agentId, target);
              return next;
            });
            setGatherResourceTypes((prev) => {
              const next = new Map(prev);
              next.set(agentId, resource);
              return next;
            });
          }}
          onGather={(agentId, resource) => {
            void (async () => {
              if (!islandId) return;
              try {
                await gatherResourceMut({
                  islandId: islandId as import("../../../convex/_generated/dataModel").Id<"islands">,
                  logs: resource === "logs" ? 1 : undefined,
                  rocks: resource === "rocks" ? 1 : undefined,
                });
              } catch {
                // silently ignore — gathering is best-effort
              }
            })();
          }}
          onGatherComplete={(agentId, resource) => {
            setGatherPopups((prev) => new Map(prev).set(agentId, resource));
            setTimeout(() => {
              setGatherPopups((prev) => {
                const next = new Map(prev);
                next.delete(agentId);
                return next;
              });
            }, 1500);
          }}
        />
      )}

      {placingType && <PlacementGhost />}
      <BuildTicker />
    </>
  );
};

/* ── Canvas wrapper ──────────────────────────────────── */
export const Island3D = () => {
  const game = useContext(GameCtx);
  const trackAgent = game?.trackAgent ?? false;
  const timeOffsetMs = game?.timeOffsetMs ?? 0;
  const agentTrackPos = useRef(new THREE.Vector3());
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const islandId = game?.islandId ?? null;
  const saveConversationMut = useMutation(api.gossip.saveConversation);
  const saveConversation = useCallback<SaveConversationFn>(
    (agentAPhone, agentBPhone, lines, reasoning) => {
      if (!islandId) return;
      saveConversationMut({
        islandId: islandId as Id<"islands">,
        agentAPhone,
        agentBPhone,
        lines,
        timestamp: Date.now() + timeOffsetMs,
        reasoning,
      }).catch(console.error);
    },
    [islandId, saveConversationMut, timeOffsetMs],
  );

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Canvas
        shadows
        camera={{ position: [16, 13, 16], fov: 45, near: 0.5, far: 120 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
        dpr={[1, 1.5]}
        style={{ width: "100%", height: "100%" }}
      >
        <GameCtx.Provider value={game}>
          <Scene agentTrackPos={agentTrackPos} saveConversation={saveConversation} />
          <CameraTracker tracking={trackAgent} agentPos={agentTrackPos} controlsRef={controlsRef} />
          <OrbitControls
            ref={controlsRef}
            enablePan={false}
            enableRotate
            minDistance={4}
            maxDistance={55}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 2.3}
            target={[0, 0.5, 0]}
            autoRotate={false}
            enableDamping
            dampingFactor={0.05}
            zoomSpeed={2.2}
          />
        </GameCtx.Provider>
      </Canvas>
    </div>
  );
};
