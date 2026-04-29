import React from 'react';
import { getGeometry, getMaterial } from './SharedMaterials';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { RefObject } from 'react';

export const Garden = () => (
  <group>
    <mesh position={[0, 0.05, 0]} receiveShadow>
      <primitive object={getGeometry('CylinderGeometry', [0.4, 0.45, 0.1, 12])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#6B4226",  })} attach="material" />
    </mesh>
    <mesh position={[0, 0.11, 0]}>
      <primitive object={getGeometry('CylinderGeometry', [0.36, 0.36, 0.02, 12])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#3A2818",  })} attach="material" />
    </mesh>
    {[[-0.18, 0.18], [0.15, -0.1], [0.05, 0.2], [-0.1, -0.15], [0.2, 0.15], [-0.2, -0.05]].map((p, i) => (
      <group key={i} position={[p[0], 0.13, p[1]]}>
        <mesh><primitive object={getGeometry('CylinderGeometry', [0.018, 0.018, 0.18, 6])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#5A8C3B",  })} attach="material" /></mesh>
        <mesh position={[0, 0.13, 0]}><primitive object={getGeometry('SphereGeometry', [0.07, 8, 8])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: ["#E58F7B", "#F2C46C", "#C9A0E0", "#FFB6C1", "#E89BC5", "#F4A8A8"][i],  })} attach="material" /></mesh>
        <mesh position={[0, 0.13, 0]}><primitive object={getGeometry('SphereGeometry', [0.025, 6, 6])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#F2C46C",  })} attach="material" /></mesh>
      </group>
    ))}
  </group>
);