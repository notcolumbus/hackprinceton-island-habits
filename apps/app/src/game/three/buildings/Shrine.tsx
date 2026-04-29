import React from 'react';
import { getGeometry, getMaterial } from './SharedMaterials';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { RefObject } from 'react';

export const Shrine = () => (
  <group>
    {/* Stone base */}
    <mesh position={[0, 0.05, 0]}><primitive object={getGeometry('BoxGeometry', [0.9, 0.1, 0.7])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#9B8E7E",  })} attach="material" /></mesh>
    {/* Two red columns */}
    {[-0.35, 0.35].map((x) => (
      <mesh key={x} position={[x, 0.5, 0]} castShadow>
        <primitive object={getGeometry('CylinderGeometry', [0.06, 0.07, 0.85, 8])} attach="geometry" />
        <primitive object={getMaterial('MeshStandardMaterial', { color: "#C5523A",  })} attach="material" />
      </mesh>
    ))}
    {/* Top crossbeams */}
    <mesh position={[0, 0.95, 0]}>
      <primitive object={getGeometry('BoxGeometry', [0.95, 0.06, 0.12])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#3A2818",  })} attach="material" />
    </mesh>
    <mesh position={[0, 1.05, 0]}>
      <primitive object={getGeometry('BoxGeometry', [1.05, 0.08, 0.18])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#C5523A",  })} attach="material" />
    </mesh>
    {/* Bell */}
    <mesh position={[0, 0.85, 0]}>
      <primitive object={getGeometry('CylinderGeometry', [0.08, 0.1, 0.12, 8])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#C9A55B", metalness: 0.5,  })} attach="material" />
    </mesh>
  </group>
);

/* ── Windmill — rotating blades, classic Dutch ──────── */