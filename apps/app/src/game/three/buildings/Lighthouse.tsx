import React from 'react';
import { getGeometry, getMaterial } from './SharedMaterials';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { RefObject } from 'react';

export const Lighthouse = ({ lightRef }: { lightRef: RefObject<THREE.Mesh | null> }) => (
  <group>
    <mesh position={[0, 0.05, 0]}><primitive object={getGeometry('CylinderGeometry', [0.5, 0.55, 0.1, 16])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#7A6B5A",  })} attach="material" /></mesh>
    <mesh position={[0, 0.7, 0]} castShadow><primitive object={getGeometry('CylinderGeometry', [0.25, 0.35, 1.3, 16])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#F4F0E8",  })} attach="material" /></mesh>
    {/* Red stripes */}
    {[0.4, 0.9, 1.2].map((y) => (
      <mesh key={y} position={[0, y, 0]}>
        <cylinderGeometry args={[
          y === 0.4 ? 0.32 : y === 0.9 ? 0.27 : 0.255,
          y === 0.4 ? 0.33 : y === 0.9 ? 0.28 : 0.26,
          0.08, 16
        ]} />
        <primitive object={getMaterial('MeshStandardMaterial', { color: "#D9433A",  })} attach="material" />
      </mesh>
    ))}
    <mesh position={[0, 1.45, 0]}><primitive object={getGeometry('CylinderGeometry', [0.3, 0.3, 0.08, 16])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#3A2818",  })} attach="material" /></mesh>
    {/* Lantern room */}
    <mesh position={[0, 1.6, 0]}><primitive object={getGeometry('CylinderGeometry', [0.2, 0.22, 0.25, 12])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#222", opacity: 0.4, transparent: true,  })} attach="material" /></mesh>
    <mesh ref={lightRef} position={[0, 1.6, 0]}>
      <primitive object={getGeometry('ConeGeometry', [1.5, 2, 8, 1, true])} attach="geometry" />
      <primitive object={getMaterial('MeshBasicMaterial', { color: "#FFE49B", opacity: 0.25, side: THREE.DoubleSide, transparent: true,  })} attach="material" />
    </mesh>
    <pointLight position={[0, 1.6, 0]} color="#FFE49B" intensity={1.2} distance={5} />
    <mesh position={[0, 1.85, 0]}><primitive object={getGeometry('ConeGeometry', [0.25, 0.35, 12])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#3A4A6B",  })} attach="material" /></mesh>
    <mesh position={[0, 2.05, 0]}><primitive object={getGeometry('SphereGeometry', [0.04, 8, 8])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#C9A55B", metalness: 0.7,  })} attach="material" /></mesh>
  </group>
);