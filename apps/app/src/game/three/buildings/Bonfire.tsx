import React from 'react';
import { getGeometry, getMaterial } from './SharedMaterials';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { RefObject } from 'react';

export const Bonfire = ({ flameRef }: { flameRef: RefObject<THREE.Mesh | null> }) => (
  <group>
    <mesh position={[0, 0.02, 0]}><primitive object={getGeometry('CylinderGeometry', [0.32, 0.35, 0.04, 16])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#3A2818",  })} attach="material" /></mesh>
    {[0, 1, 2, 3, 4].map((i) => (
      <mesh key={i} position={[Math.cos(i * Math.PI / 2.5) * 0.15, 0.1, Math.sin(i * Math.PI / 2.5) * 0.15]} rotation={[Math.PI / 2.5, 0, i]}>
        <primitive object={getGeometry('CylinderGeometry', [0.04, 0.04, 0.34, 6])} attach="geometry" />
        <primitive object={getMaterial('MeshStandardMaterial', { color: "#6B4226",  })} attach="material" />
      </mesh>
    ))}
    <mesh ref={flameRef} position={[0, 0.28, 0]}>
      <primitive object={getGeometry('ConeGeometry', [0.16, 0.45, 8])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#F2A04C", emissive: "#E55A2B", emissiveIntensity: 0.8,  })} attach="material" />
    </mesh>
    <mesh position={[0, 0.42, 0]}>
      <primitive object={getGeometry('ConeGeometry', [0.08, 0.22, 6])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#F4D87C", emissive: "#F4D87C", emissiveIntensity: 0.8,  })} attach="material" />
    </mesh>
    <pointLight position={[0, 0.4, 0]} color="#FF8030" intensity={0.8} distance={2.5} />
    {/* Stones around */}
    {[0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i / 6) * Math.PI * 2;
      return <mesh key={i} position={[Math.cos(a) * 0.32, 0.04, Math.sin(a) * 0.32]}><primitive object={getGeometry('DodecahedronGeometry', [0.06])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#7A6B5A", flatShading: true,  })} attach="material" /></mesh>;
    })}
  </group>
);