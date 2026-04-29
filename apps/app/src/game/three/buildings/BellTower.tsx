import React from 'react';
import { getGeometry, getMaterial } from './SharedMaterials';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { RefObject } from 'react';

export const BellTower = ({ bellRef }: { bellRef: RefObject<THREE.Group | null> }) => (
  <group>
    {/* Stone base */}
    <mesh position={[0, 0.1, 0]} receiveShadow><primitive object={getGeometry('BoxGeometry', [0.82, 0.2, 0.82])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#7A6B5A", roughness: 0.9, flatShading: true,  })} attach="material" /></mesh>
    {/* Main tower */}
    <mesh position={[0, 0.98, 0]} castShadow receiveShadow><primitive object={getGeometry('BoxGeometry', [0.66, 1.66, 0.66])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#9B8E7E", roughness: 0.88, flatShading: true,  })} attach="material" /></mesh>
    {/* Stone course bands */}
    {[0.28, 0.7, 1.1, 1.55].map((y) => (
      <mesh key={y} position={[0, y, 0]}><primitive object={getGeometry('BoxGeometry', [0.68, 0.028, 0.68])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#7A6B5A",  })} attach="material" /></mesh>
    ))}
    {/* Arched doorway */}
    <mesh position={[0, 0.27, 0.34]}><primitive object={getGeometry('BoxGeometry', [0.22, 0.4, 0.018])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#2A1A0A",  })} attach="material" /></mesh>
    <mesh position={[0, 0.47, 0.34]} rotation={[Math.PI / 2, 0, 0]}>
      <primitive object={getGeometry('CylinderGeometry', [0.11, 0.11, 0.02, 8, 1, false, 0, Math.PI])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#2A1A0A",  })} attach="material" />
    </mesh>
    {/* Climbing vines */}
    {[0.48, 0.9, 1.32].map((y) => (
      <mesh key={y} position={[0, y, 0]} rotation={[0, y * 0.8, 0]}>
        <primitive object={getGeometry('TorusGeometry', [0.34, 0.016, 4, 12, Math.PI * 1.3])} attach="geometry" />
        <primitive object={getMaterial('MeshStandardMaterial', { color: "#3A6B2A", roughness: 0.9,  })} attach="material" />
      </mesh>
    ))}
    {/* Bell chamber */}
    <mesh position={[0, 1.87, 0]} castShadow><primitive object={getGeometry('BoxGeometry', [0.66, 0.42, 0.66])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#B8A898", roughness: 0.8,  })} attach="material" /></mesh>
    {/* Open arch faces */}
    {[0, 1, 2, 3].map((i) => {
      const a = (i / 4) * Math.PI * 2;
      return (
        <mesh key={i} position={[Math.cos(a) * 0.31, 1.87, Math.sin(a) * 0.31]} rotation={[0, -a, 0]}>
          <primitive object={getGeometry('BoxGeometry', [0.42, 0.28, 0.015])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#1A1008", opacity: 0.4, transparent: true,  })} attach="material" />
        </mesh>
      );
    })}
    {/* Animated bell */}
    <group ref={bellRef} position={[0, 1.94, 0]}>
      <mesh position={[0, 0.06, 0]}><primitive object={getGeometry('CylinderGeometry', [0.04, 0.11, 0.1, 12])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#C9A55B", metalness: 0.65, roughness: 0.35,  })} attach="material" /></mesh>
      <mesh position={[0, -0.02, 0]}><primitive object={getGeometry('CylinderGeometry', [0.11, 0.16, 0.14, 12])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#C9A55B", metalness: 0.65, roughness: 0.35,  })} attach="material" /></mesh>
      <mesh position={[0, -0.12, 0]}><primitive object={getGeometry('SphereGeometry', [0.024, 6, 6])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#8B7040", metalness: 0.5,  })} attach="material" /></mesh>
    </group>
    {/* Spire */}
    <mesh position={[0, 2.14, 0]} castShadow><primitive object={getGeometry('ConeGeometry', [0.37, 0.52, 4])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#4A5A6A", flatShading: true,  })} attach="material" /></mesh>
    {/* Weather vane */}
    <mesh position={[0, 2.42, 0]}><primitive object={getGeometry('CylinderGeometry', [0.007, 0.007, 0.22, 4])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#8B7040", metalness: 0.6,  })} attach="material" /></mesh>
    <mesh position={[0.06, 2.47, 0]}><primitive object={getGeometry('BoxGeometry', [0.14, 0.014, 0.014])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#8B7040", metalness: 0.6,  })} attach="material" /></mesh>
  </group>
);

/* ── Zen Garden — raked sand, stones, bonsai ────────── */