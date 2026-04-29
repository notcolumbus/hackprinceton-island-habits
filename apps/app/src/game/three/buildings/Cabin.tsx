import React from 'react';
import { getGeometry, getMaterial } from './SharedMaterials';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { RefObject } from 'react';

export const Cabin = ({ smokeRef }: { smokeRef: RefObject<THREE.Mesh | null> }) => (
  <group>
    {/* Log walls */}
    {[0.15, 0.3, 0.45, 0.6, 0.75].map((y) => (
      <mesh key={y} position={[0, y, 0]} castShadow>
        <primitive object={getGeometry('BoxGeometry', [0.85, 0.13, 0.85])} attach="geometry" />
        <primitive object={getMaterial('MeshStandardMaterial', { color: y % 0.3 < 0.15 ? "#8B5E3C" : "#6B4226",  })} attach="material" />
      </mesh>
    ))}
    {/* Roof */}
    <mesh position={[0, 1.0, 0]} castShadow rotation={[0, 0, 0]}>
      <primitive object={getGeometry('BoxGeometry', [1.0, 0.05, 1.0])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#3A4A6B",  })} attach="material" />
    </mesh>
    <mesh position={[0, 1.2, 0]} castShadow rotation={[0, Math.PI / 4, 0]}>
      <primitive object={getGeometry('ConeGeometry', [0.8, 0.55, 4])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#3F7A3F",  })} attach="material" />
    </mesh>
    {/* Door */}
    <mesh position={[0, 0.35, 0.43]}>
      <primitive object={getGeometry('BoxGeometry', [0.22, 0.55, 0.02])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#3A2818",  })} attach="material" />
    </mesh>
    {/* Window */}
    <mesh position={[-0.28, 0.5, 0.43]}>
      <primitive object={getGeometry('BoxGeometry', [0.18, 0.18, 0.02])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#F2C46C", emissive: "#F2C46C", emissiveIntensity: 0.4,  })} attach="material" />
    </mesh>
    {/* Chimney smoke */}
    <mesh position={[0.3, 1.1, -0.2]}>
      <primitive object={getGeometry('BoxGeometry', [0.1, 0.3, 0.1])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#3A2818",  })} attach="material" />
    </mesh>
    <mesh ref={smokeRef} position={[0.3, 1.3, -0.2]}>
      <primitive object={getGeometry('SphereGeometry', [0.09, 8, 8])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#D0D0D0", opacity: 0.5, transparent: true,  })} attach="material" />
    </mesh>
  </group>
);