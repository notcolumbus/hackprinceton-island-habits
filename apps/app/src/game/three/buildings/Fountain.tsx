import React from 'react';
import { getGeometry, getMaterial } from './SharedMaterials';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { RefObject } from 'react';

export const Fountain = () => (
  <group>
    <mesh position={[0, 0.1, 0]} receiveShadow><primitive object={getGeometry('CylinderGeometry', [0.6, 0.65, 0.2, 24])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#E0D5C0",  })} attach="material" /></mesh>
    <mesh position={[0, 0.21, 0]}><primitive object={getGeometry('TorusGeometry', [0.55, 0.05, 8, 24])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#9B8E7E",  })} attach="material" /></mesh>
    <mesh position={[0, 0.22, 0]}><primitive object={getGeometry('CylinderGeometry', [0.5, 0.5, 0.04, 24])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#5BA3D0", opacity: 0.85, transparent: true,  })} attach="material" /></mesh>
    <mesh position={[0, 0.4, 0]}><primitive object={getGeometry('CylinderGeometry', [0.08, 0.12, 0.35, 8])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#E0D5C0",  })} attach="material" /></mesh>
    <mesh position={[0, 0.6, 0]}><primitive object={getGeometry('CylinderGeometry', [0.18, 0.18, 0.04, 16])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#9B8E7E",  })} attach="material" /></mesh>
    <mesh position={[0, 0.65, 0]}><primitive object={getGeometry('CylinderGeometry', [0.16, 0.16, 0.02, 16])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#5BA3D0", opacity: 0.85, transparent: true,  })} attach="material" /></mesh>
    <mesh position={[0, 0.78, 0]}><primitive object={getGeometry('SphereGeometry', [0.13, 16, 16])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#7BC5E5", opacity: 0.7, emissive: "#7BC5E5", emissiveIntensity: 0.2, transparent: true,  })} attach="material" /></mesh>
    {/* Water droplets */}
    {[0, 1, 2, 3].map((i) => {
      const a = (i / 4) * Math.PI * 2;
      return <mesh key={i} position={[Math.cos(a) * 0.35, 0.5, Math.sin(a) * 0.35]}><primitive object={getGeometry('SphereGeometry', [0.04, 6, 6])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#7BC5E5", opacity: 0.6, transparent: true,  })} attach="material" /></mesh>;
    })}
  </group>
);