import React from 'react';
import { getGeometry, getMaterial } from './SharedMaterials';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { RefObject } from 'react';

export const Gym = () => (
  <group>
    <mesh position={[0, 0.05, 0]} receiveShadow>
      <primitive object={getGeometry('BoxGeometry', [1.0, 0.1, 1.0])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#5A4A38",  })} attach="material" />
    </mesh>
    <mesh position={[0, 0.45, 0]} castShadow>
      <primitive object={getGeometry('BoxGeometry', [0.9, 0.8, 0.9])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#6FA8DC",  })} attach="material" />
    </mesh>
    <mesh position={[0, 0.9, 0]} castShadow>
      <primitive object={getGeometry('BoxGeometry', [1.0, 0.1, 1.0])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#3F6FA0",  })} attach="material" />
    </mesh>
    {/* Garage door */}
    <mesh position={[0, 0.4, 0.46]}>
      <primitive object={getGeometry('BoxGeometry', [0.55, 0.65, 0.02])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#2C4F70",  })} attach="material" />
    </mesh>
    {[0.15, 0.3, 0.45, 0.6].map((y, i) => (
      <mesh key={i} position={[0, y, 0.47]}>
        <primitive object={getGeometry('BoxGeometry', [0.55, 0.012, 0.005])} attach="geometry" />
        <primitive object={getMaterial('MeshStandardMaterial', { color: "#1F3A52",  })} attach="material" />
      </mesh>
    ))}
    {/* Dumbbell */}
    <group position={[0.55, 0.12, 0.45]}>
      <mesh><primitive object={getGeometry('SphereGeometry', [0.08, 8, 8])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#1A1A1A",  })} attach="material" /></mesh>
      <mesh position={[0.18, 0, 0]}><primitive object={getGeometry('SphereGeometry', [0.08, 8, 8])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#1A1A1A",  })} attach="material" /></mesh>
      <mesh position={[0.09, 0, 0]} rotation={[0, 0, Math.PI / 2]}><primitive object={getGeometry('CylinderGeometry', [0.025, 0.025, 0.18, 6])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#555",  })} attach="material" /></mesh>
    </group>
    {/* Sign */}
    <mesh position={[0, 0.95, 0.51]}>
      <primitive object={getGeometry('BoxGeometry', [0.5, 0.1, 0.02])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#F2C46C", emissive: "#F2C46C", emissiveIntensity: 0.3,  })} attach="material" />
    </mesh>
  </group>
);