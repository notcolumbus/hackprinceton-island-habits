import React from 'react';
import { getGeometry, getMaterial } from './SharedMaterials';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { RefObject } from 'react';

export const Moongate = ({ glowRef }: { glowRef: RefObject<THREE.Mesh | null> }) => (
  <group>
    {/* Stone base platform */}
    <mesh position={[0, 0.04, 0]} receiveShadow><primitive object={getGeometry('CylinderGeometry', [0.72, 0.77, 0.08, 16])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#7A6B5A", roughness: 0.9,  })} attach="material" /></mesh>
    <mesh position={[0, 0.1, 0]}><primitive object={getGeometry('CylinderGeometry', [0.62, 0.65, 0.06, 16])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#8A7B6A", roughness: 0.88,  })} attach="material" /></mesh>
    {/* Two stone pillars */}
    {([-0.39, 0.39] as number[]).map((x) => (
      <group key={x}>
        <mesh position={[x, 0.68, 0]} castShadow><primitive object={getGeometry('BoxGeometry', [0.19, 1.22, 0.19])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#8A7B6A", roughness: 0.88, flatShading: true,  })} attach="material" /></mesh>
        <mesh position={[x, 1.32, 0]}><primitive object={getGeometry('BoxGeometry', [0.23, 0.08, 0.23])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#9A8B7A",  })} attach="material" /></mesh>
        {/* Moss vines */}
        <mesh position={[x + (x > 0 ? -0.096 : 0.096), 0.72, 0.096]} rotation={[0, 0, x > 0 ? -0.12 : 0.12]}>
          <primitive object={getGeometry('BoxGeometry', [0.013, 0.54, 0.013])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#3A5A2A", roughness: 0.9,  })} attach="material" />
        </mesh>
      </group>
    ))}
    {/* Lintel */}
    <mesh position={[0, 1.33, 0]}><primitive object={getGeometry('BoxGeometry', [0.98, 0.09, 0.19])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#8A7B6A", roughness: 0.88,  })} attach="material" /></mesh>
    {/* The glowing torus ring */}
    <mesh ref={glowRef} position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <primitive object={getGeometry('TorusGeometry', [0.41, 0.062, 12, 38])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#6858D8", emissive: "#6858D8", emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.4,  })} attach="material" />
    </mesh>
    {/* Inner bright ring */}
    <mesh position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <primitive object={getGeometry('TorusGeometry', [0.37, 0.018, 8, 26])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#B8A8FF", emissive: "#B8A8FF", emissiveIntensity: 1.0,  })} attach="material" />
    </mesh>
    {/* Rune dots */}
    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      const a = (i / 8) * Math.PI * 2;
      return (
        <mesh key={i} position={[Math.cos(a) * 0.41, 0.9, Math.sin(a) * 0.41]}>
          <primitive object={getGeometry('SphereGeometry', [0.017, 6, 6])} attach="geometry" />
          <primitive object={getMaterial('MeshStandardMaterial', { color: "#F0E8FF", emissive: "#D0C0FF", emissiveIntensity: 0.9,  })} attach="material" />
        </mesh>
      );
    })}
    {/* Portal shimmer disk */}
    <mesh position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <primitive object={getGeometry('CircleGeometry', [0.34, 24])} attach="geometry" />
      <primitive object={getMaterial('MeshBasicMaterial', { color: "#3030B0", opacity: 0.13, side: THREE.DoubleSide, transparent: true,  })} attach="material" />
    </mesh>
    <pointLight position={[0, 0.9, 0]} color="#8080FF" intensity={0.6} distance={2.8} />
  </group>
);