import React from 'react';
import { getGeometry, getMaterial } from './SharedMaterials';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { RefObject } from 'react';

export const House = ({ smokeRef, flagRef }: { smokeRef: RefObject<THREE.Mesh | null>; flagRef: RefObject<THREE.Mesh | null> }) => (
  <group>
    <mesh position={[0, 0.05, 0]} receiveShadow>
      <primitive object={getGeometry('BoxGeometry', [0.95, 0.1, 0.95])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#9B8E7E",  })} attach="material" />
    </mesh>
    <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
      <primitive object={getGeometry('BoxGeometry', [0.85, 0.7, 0.85])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#F4E1C1",  })} attach="material" />
    </mesh>
    {/* Window left */}
    <mesh position={[-0.25, 0.45, 0.43]}>
      <primitive object={getGeometry('BoxGeometry', [0.18, 0.18, 0.02])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#7BC5E5", emissive: "#7BC5E5", emissiveIntensity: 0.3,  })} attach="material" />
    </mesh>
    <mesh position={[-0.25, 0.45, 0.44]}>
      <primitive object={getGeometry('BoxGeometry', [0.2, 0.02, 0.005])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#5A4226",  })} attach="material" />
    </mesh>
    <mesh position={[-0.25, 0.45, 0.44]}>
      <primitive object={getGeometry('BoxGeometry', [0.02, 0.2, 0.005])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#5A4226",  })} attach="material" />
    </mesh>
    {/* Window planter with flowers */}
    <mesh position={[-0.25, 0.32, 0.46]} castShadow>
      <primitive object={getGeometry('BoxGeometry', [0.22, 0.06, 0.06])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#6B4226",  })} attach="material" />
    </mesh>
    {[-0.32, -0.25, -0.18].map((x, i) => (
      <mesh key={i} position={[x, 0.37, 0.46]}>
        <primitive object={getGeometry('SphereGeometry', [0.025, 6, 6])} attach="geometry" />
        <primitive object={getMaterial('MeshStandardMaterial', { color: ["#E58F7B", "#F2C46C", "#C9A0E0"][i],  })} attach="material" />
      </mesh>
    ))}
    {/* Door */}
    <mesh position={[0.18, 0.32, 0.43]}>
      <primitive object={getGeometry('BoxGeometry', [0.18, 0.42, 0.02])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#6B4226",  })} attach="material" />
    </mesh>
    <mesh position={[0.24, 0.32, 0.44]}>
      <primitive object={getGeometry('SphereGeometry', [0.012, 6, 6])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#C9A55B", metalness: 0.6,  })} attach="material" />
    </mesh>
    {/* Roof */}
    <mesh position={[0, 0.92, 0]} castShadow rotation={[0, Math.PI / 4, 0]}>
      <primitive object={getGeometry('ConeGeometry', [0.75, 0.55, 4])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#C5523A",  })} attach="material" />
    </mesh>
    {/* Flag pole + animated flag */}
    <mesh position={[0, 1.3, 0]} castShadow>
      <primitive object={getGeometry('CylinderGeometry', [0.012, 0.012, 0.35, 6])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#3A2818",  })} attach="material" />
    </mesh>
    <mesh ref={flagRef} position={[0.08, 1.38, 0]}>
      <primitive object={getGeometry('PlaneGeometry', [0.16, 0.1])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#D9433A", side: THREE.DoubleSide,  })} attach="material" />
    </mesh>
    {/* Chimney + smoke */}
    <mesh position={[0.25, 1.0, -0.15]} castShadow>
      <primitive object={getGeometry('BoxGeometry', [0.1, 0.25, 0.1])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#5A4A38",  })} attach="material" />
    </mesh>
    <mesh ref={smokeRef} position={[0.25, 1.2, -0.15]}>
      <primitive object={getGeometry('SphereGeometry', [0.08, 8, 8])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#E0E0E0", opacity: 0.5, transparent: true,  })} attach="material" />
    </mesh>
    <mesh position={[0.18, 0.07, 0.5]}>
      <primitive object={getGeometry('BoxGeometry', [0.22, 0.05, 0.1])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#6B4226",  })} attach="material" />
    </mesh>
  </group>
);