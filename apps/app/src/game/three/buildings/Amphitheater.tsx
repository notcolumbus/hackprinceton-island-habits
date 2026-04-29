import React from 'react';
import { getGeometry, getMaterial } from './SharedMaterials';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { RefObject } from 'react';

export const Amphitheater = ({ torchRef }: { torchRef: RefObject<THREE.Mesh | null> }) => (
  <group>
    {/* Stage platform */}
    <mesh position={[0, 0.09, 0.24]} castShadow receiveShadow>
      <primitive object={getGeometry('BoxGeometry', [1.1, 0.18, 0.54])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#C8B898", roughness: 0.85,  })} attach="material" />
    </mesh>
    <mesh position={[0, 0.04, 0.53]}><primitive object={getGeometry('BoxGeometry', [0.68, 0.08, 0.1])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#B8A888", roughness: 0.85,  })} attach="material" /></mesh>
    {/* Backdrop wall */}
    <mesh position={[0, 0.47, -0.1]} castShadow><primitive object={getGeometry('BoxGeometry', [1.12, 0.72, 0.12])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#D0C0A0", roughness: 0.8,  })} attach="material" /></mesh>
    {/* Crenellations */}
    {[-0.42, -0.21, 0, 0.21, 0.42].map((x) => (
      <mesh key={x} position={[x, 0.88, -0.1]}><primitive object={getGeometry('BoxGeometry', [0.12, 0.12, 0.13])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#C0B090", roughness: 0.8,  })} attach="material" /></mesh>
    ))}
    {/* Stage columns */}
    {([-0.44, 0.44] as number[]).map((x) => (
      <group key={x}>
        <mesh position={[x, 0.37, -0.02]} castShadow><primitive object={getGeometry('CylinderGeometry', [0.058, 0.065, 0.56, 8])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#E0D5C0",  })} attach="material" /></mesh>
        <mesh position={[x, 0.67, -0.02]}><primitive object={getGeometry('BoxGeometry', [0.16, 0.06, 0.16])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#D0C5B0",  })} attach="material" /></mesh>
        <mesh position={[x, 0.76, -0.02]}><primitive object={getGeometry('CylinderGeometry', [0.058, 0.04, 0.06, 8])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#5A4A38",  })} attach="material" /></mesh>
        <mesh ref={x < 0 ? torchRef : undefined} position={[x, 0.85, -0.02]}>
          <primitive object={getGeometry('ConeGeometry', [0.048, 0.1, 8])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#F2A04C", emissive: "#E55A2B", emissiveIntensity: 0.9,  })} attach="material" />
        </mesh>
        {x < 0 && <pointLight position={[0, 0.87, -0.02]} color="#FF8030" intensity={0.5} distance={2.5} />}
      </group>
    ))}
    {/* Seating tiers — semicircular */}
    {[0, 1, 2].map((tier) => (
      <mesh key={tier} position={[0, 0.07 + tier * 0.13, -0.1]} receiveShadow>
        <primitive object={getGeometry('CylinderGeometry', [0.54 + tier * 0.28, 0.56 + tier * 0.28, 0.13, 10, 1, false, Math.PI, Math.PI])} attach="geometry" />
        <primitive object={getMaterial('MeshStandardMaterial', { color: ["#C8B898","#B8A888","#A89878"][tier], roughness: 0.85,  })} attach="material" />
      </mesh>
    ))}
    {/* Lectern on stage */}
    <mesh position={[0, 0.26, 0.18]} castShadow><primitive object={getGeometry('BoxGeometry', [0.18, 0.17, 0.12])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#8B6B4A", roughness: 0.85,  })} attach="material" /></mesh>
    <mesh position={[0, 0.37, 0.15]}><primitive object={getGeometry('BoxGeometry', [0.22, 0.018, 0.16])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#7A5A3A", roughness: 0.9,  })} attach="material" /></mesh>
  </group>
);

/* ── Moon Gate — glowing stone arch with rune ring ──── */