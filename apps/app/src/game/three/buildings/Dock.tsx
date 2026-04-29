import React from 'react';
import { getGeometry, getMaterial } from './SharedMaterials';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { RefObject } from 'react';

export const Dock = () => (
  <group>
    {/* Wooden planks */}
    <mesh position={[0, 0.12, 0]} receiveShadow castShadow>
      <primitive object={getGeometry('BoxGeometry', [1.2, 0.05, 0.6])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#8B5E3C",  })} attach="material" />
    </mesh>
    {/* Plank seams */}
    {[-0.4, -0.13, 0.13, 0.4].map((x) => (
      <mesh key={x} position={[x, 0.15, 0]}>
        <primitive object={getGeometry('BoxGeometry', [0.02, 0.005, 0.6])} attach="geometry" />
        <primitive object={getMaterial('MeshStandardMaterial', { color: "#5A3820",  })} attach="material" />
      </mesh>
    ))}
    {/* Posts */}
    {[[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]].map(([x, z], i) => (
      <mesh key={i} position={[x, 0.05, z]} castShadow>
        <primitive object={getGeometry('CylinderGeometry', [0.05, 0.05, 0.3, 8])} attach="geometry" />
        <primitive object={getMaterial('MeshStandardMaterial', { color: "#5A3820",  })} attach="material" />
      </mesh>
    ))}
    {/* Lantern */}
    <mesh position={[0.55, 0.4, 0]}>
      <primitive object={getGeometry('CylinderGeometry', [0.04, 0.04, 0.4, 6])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#3A2818",  })} attach="material" />
    </mesh>
    <mesh position={[0.55, 0.65, 0]}>
      <primitive object={getGeometry('BoxGeometry', [0.12, 0.12, 0.12])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#F4D87C", emissive: "#F4D87C", emissiveIntensity: 0.8,  })} attach="material" />
    </mesh>
    {/* no point light on dock — ambient is enough */}
  </group>
);