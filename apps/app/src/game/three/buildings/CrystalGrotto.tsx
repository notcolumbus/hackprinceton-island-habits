import React from 'react';
import { getGeometry, getMaterial } from './SharedMaterials';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { RefObject } from 'react';

export const CrystalGrotto = ({ crystalRef }: { crystalRef: RefObject<THREE.Mesh | null> }) => {
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
        <primitive object={getGeometry('CylinderGeometry', [0.5, 0.57, 0.12, 10])} attach="geometry" />
        <primitive object={getMaterial('MeshStandardMaterial', { color: "#2E2C28", roughness: 0.95, flatShading: true,  })} attach="material" />
      </mesh>
      {/* Stone mounds */}
      {([[0.3, 0.08, 0.26], [-0.32, 0.06, 0.2], [0.08, 0.07, -0.32]] as [number,number,number][]).map((p, i) => (
        <mesh key={i} position={p}><primitive object={getGeometry('DodecahedronGeometry', [0.1])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#1E1C18", roughness: 0.95, flatShading: true,  })} attach="material" /></mesh>
      ))}
      {/* Crystal spires */}
      {crystals.map((c, i) => (
        <mesh key={i} ref={i === 0 ? crystalRef : undefined} position={c.pos} scale={c.scale} rotation={[c.tilt, 0, c.tilt * 0.5]}>
          <primitive object={getGeometry('OctahedronGeometry', [1, 0])} attach="geometry" />
          <primitive object={getMaterial('MeshStandardMaterial', { color: c.color, emissive: c.color, emissiveIntensity: 0.5, opacity: 0.88, roughness: 0.08, metalness: 0.08, transparent: true,  })} attach="material" />
        </mesh>
      ))}
      {/* Scattered shards */}
      {([[-.38, .03, .1], [.36, .03, -.32], [-.1, .03, .4]] as [number,number,number][]).map((p, i) => (
        <mesh key={i} position={p} rotation={[.3 * i, 0, .2 * i]}>
          <primitive object={getGeometry('OctahedronGeometry', [0.034, 0])} attach="geometry" />
          <primitive object={getMaterial('MeshStandardMaterial', { color: ["#8060FF","#40B0FF","#C060FF"][i], emissive: ["#8060FF","#40B0FF","#C060FF"][i], emissiveIntensity: 0.5,  })} attach="material" />
        </mesh>
      ))}
      <pointLight position={[0, 0.5, 0]} color="#8080FF" intensity={0.6} distance={2.2} />
    </group>
  );
};

/* ── Amphitheater — semicircular stone seating + stage ─ */