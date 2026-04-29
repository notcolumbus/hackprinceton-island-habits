import React from 'react';
import { getGeometry, getMaterial } from './SharedMaterials';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { RefObject } from 'react';

export const Windmill = ({ bladesRef }: { bladesRef: RefObject<THREE.Group | null> }) => (
  <group>
    {/* Stone base */}
    <mesh position={[0, 0.1, 0]} receiveShadow castShadow>
      <primitive object={getGeometry('CylinderGeometry', [0.45, 0.55, 0.2, 16])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#7A6B5A", roughness: 0.9, flatShading: true,  })} attach="material" />
    </mesh>
    {/* Tapered tower */}
    <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
      <primitive object={getGeometry('CylinderGeometry', [0.32, 0.45, 1.1, 16])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#F4E1C1", roughness: 0.85,  })} attach="material" />
    </mesh>
    {/* Wood beam stripes */}
    {[0.4, 0.7, 1.0].map((y) => (
      <mesh key={y} position={[0, y, 0]}>
        <cylinderGeometry args={[
          0.45 - (y - 0.2) * 0.118,
          0.45 - (y - 0.2) * 0.118,
          0.04, 16
        ]} />
        <primitive object={getMaterial('MeshStandardMaterial', { color: "#8B6B4A", roughness: 0.9,  })} attach="material" />
      </mesh>
    ))}
    {/* Door */}
    <mesh position={[0, 0.35, 0.43]}>
      <primitive object={getGeometry('BoxGeometry', [0.18, 0.4, 0.02])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#5A3820",  })} attach="material" />
    </mesh>
    {/* Window */}
    <mesh position={[0, 0.85, 0.4]}>
      <primitive object={getGeometry('BoxGeometry', [0.14, 0.14, 0.02])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#F2C46C", emissive: "#F2C46C", emissiveIntensity: 0.5,  })} attach="material" />
    </mesh>
    {/* Conical roof cap */}
    <mesh position={[0, 1.42, 0]} castShadow>
      <primitive object={getGeometry('ConeGeometry', [0.36, 0.32, 12])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#5A3820", roughness: 0.8, flatShading: true,  })} attach="material" />
    </mesh>
    {/* Hub for blades */}
    <mesh position={[0, 1.15, 0.35]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <primitive object={getGeometry('CylinderGeometry', [0.06, 0.06, 0.12, 12])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#3A2818",  })} attach="material" />
    </mesh>
    {/* Rotating blades */}
    <group ref={bladesRef} position={[0, 1.15, 0.4]}>
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, 0, angle]}>
            {/* Blade arm */}
            <mesh position={[0, 0.4, 0]} castShadow>
              <primitive object={getGeometry('BoxGeometry', [0.04, 0.8, 0.03])} attach="geometry" />
              <primitive object={getMaterial('MeshStandardMaterial', { color: "#5A3820", roughness: 0.85,  })} attach="material" />
            </mesh>
            {/* Sail (cloth) */}
            <mesh position={[0.1, 0.5, 0]} castShadow>
              <primitive object={getGeometry('BoxGeometry', [0.18, 0.45, 0.005])} attach="geometry" />
              <primitive object={getMaterial('MeshStandardMaterial', { color: "#F4E8D9", side: THREE.DoubleSide, roughness: 0.7,  })} attach="material" />
            </mesh>
            {/* Cross slats on sail */}
            {[0.35, 0.55, 0.7].map((y) => (
              <mesh key={y} position={[0.1, y, 0.005]}>
                <primitive object={getGeometry('BoxGeometry', [0.18, 0.008, 0.002])} attach="geometry" />
                <primitive object={getMaterial('MeshStandardMaterial', { color: "#8B6B4A",  })} attach="material" />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  </group>
);

/* ── Treehouse — built into a big oak ──────────────── */