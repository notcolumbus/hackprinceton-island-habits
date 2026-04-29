import React from 'react';
import { getGeometry, getMaterial } from './SharedMaterials';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { RefObject } from 'react';

export const Library = () => (
  <group>
    <mesh position={[0, 0.05, 0]} receiveShadow>
      <primitive object={getGeometry('BoxGeometry', [1.2, 0.1, 0.9])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#9B8E7E",  })} attach="material" />
    </mesh>
    <mesh position={[0, 0.5, 0]} castShadow>
      <primitive object={getGeometry('BoxGeometry', [1.1, 0.9, 0.8])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#A87FCB",  })} attach="material" />
    </mesh>
    <mesh position={[0, 1.0, 0]} castShadow>
      <primitive object={getGeometry('BoxGeometry', [1.2, 0.15, 0.9])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#6B4F8C",  })} attach="material" />
    </mesh>
    {/* Columns */}
    {[-0.45, 0.45].map((x) => (
      <mesh key={x} position={[x, 0.5, 0.41]} castShadow>
        <primitive object={getGeometry('CylinderGeometry', [0.05, 0.05, 0.85, 8])} attach="geometry" />
        <primitive object={getMaterial('MeshStandardMaterial', { color: "#F4E8D9",  })} attach="material" />
      </mesh>
    ))}
    {/* Door */}
    <mesh position={[0, 0.4, 0.42]}>
      <primitive object={getGeometry('BoxGeometry', [0.25, 0.6, 0.02])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#5A3820",  })} attach="material" />
    </mesh>
    {/* Windows */}
    {[-0.42, 0.42].map((x) => (
      <mesh key={x} position={[x, 0.7, 0.41]}>
        <primitive object={getGeometry('BoxGeometry', [0.12, 0.18, 0.005])} attach="geometry" />
        <primitive object={getMaterial('MeshStandardMaterial', { color: "#F2C46C", emissive: "#F2C46C", emissiveIntensity: 0.5,  })} attach="material" />
      </mesh>
    ))}
    {/* Sign */}
    <mesh position={[0, 1.15, 0.46]}>
      <primitive object={getGeometry('BoxGeometry', [0.4, 0.12, 0.02])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#F4E1C1",  })} attach="material" />
    </mesh>
  </group>
);