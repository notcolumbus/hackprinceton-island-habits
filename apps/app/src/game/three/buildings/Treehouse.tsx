import React from 'react';
import { getGeometry, getMaterial } from './SharedMaterials';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { RefObject } from 'react';

export const Treehouse = () => (
  <group>
    {/* Big trunk */}
    <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
      <primitive object={getGeometry('CylinderGeometry', [0.16, 0.22, 1.0, 8])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#5A3820", roughness: 0.92, flatShading: true,  })} attach="material" />
    </mesh>
    {/* Side branch supports */}
    {[-0.3, 0.3].map((x) => (
      <mesh key={x} position={[x, 0.6, 0]} rotation={[0, 0, x > 0 ? -0.6 : 0.6]}>
        <primitive object={getGeometry('CylinderGeometry', [0.04, 0.05, 0.35, 6])} attach="geometry" />
        <primitive object={getMaterial('MeshStandardMaterial', { color: "#5A3820", roughness: 0.9,  })} attach="material" />
      </mesh>
    ))}
    {/* Wood platform */}
    <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
      <primitive object={getGeometry('CylinderGeometry', [0.55, 0.55, 0.06, 16])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#8B6B4A", roughness: 0.85,  })} attach="material" />
    </mesh>
    {/* Plank seams on platform */}
    {[-0.3, -0.1, 0.1, 0.3].map((x) => (
      <mesh key={x} position={[x, 0.89, 0]}>
        <primitive object={getGeometry('BoxGeometry', [0.015, 0.005, 1.0])} attach="geometry" />
        <primitive object={getMaterial('MeshStandardMaterial', { color: "#5A3820",  })} attach="material" />
      </mesh>
    ))}
    {/* Cabin walls */}
    <mesh position={[0, 1.15, 0]} castShadow receiveShadow>
      <primitive object={getGeometry('BoxGeometry', [0.7, 0.5, 0.7])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#A87A4E", roughness: 0.85,  })} attach="material" />
    </mesh>
    {/* Window */}
    <mesh position={[0, 1.2, 0.36]}>
      <primitive object={getGeometry('BoxGeometry', [0.2, 0.2, 0.02])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#F2C46C", emissive: "#F2C46C", emissiveIntensity: 0.6,  })} attach="material" />
    </mesh>
    {/* Door (side) */}
    <mesh position={[0.36, 1.1, 0]}>
      <primitive object={getGeometry('BoxGeometry', [0.02, 0.32, 0.18])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#3A2818",  })} attach="material" />
    </mesh>
    {/* Slanted roof */}
    <mesh position={[0, 1.55, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
      <primitive object={getGeometry('ConeGeometry', [0.6, 0.45, 4])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#3F7A3F", roughness: 0.78,  })} attach="material" />
    </mesh>
    {/* Foliage around treehouse */}
    {[
      [0.6, 1.1, 0.3, 0.3],
      [-0.55, 1.2, -0.2, 0.28],
      [0.2, 1.4, -0.55, 0.32],
      [-0.4, 1.5, 0.45, 0.26],
    ].map(([x, y, z, r], i) => (
      <mesh key={i} position={[x, y, z]} castShadow>
        <primitive object={getGeometry('SphereGeometry', [r, 12, 10])} attach="geometry" />
        <primitive object={getMaterial('MeshStandardMaterial', { color: i % 2 ? "#4A8548" : "#5A9A55", roughness: 0.75, flatShading: true,  })} attach="material" />
      </mesh>
    ))}
    {/* Rope ladder */}
    {[0.05, 0.15, 0.25, 0.35, 0.5, 0.65].map((y, i) => (
      <mesh key={i} position={[-0.5, y, 0.1]}>
        <primitive object={getGeometry('BoxGeometry', [0.12, 0.015, 0.015])} attach="geometry" />
        <primitive object={getMaterial('MeshStandardMaterial', { color: "#6B4226",  })} attach="material" />
      </mesh>
    ))}
    {/* Rope sides */}
    <mesh position={[-0.56, 0.4, 0.1]}>
      <primitive object={getGeometry('CylinderGeometry', [0.008, 0.008, 0.85, 4])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#3A2818",  })} attach="material" />
    </mesh>
    <mesh position={[-0.44, 0.4, 0.1]}>
      <primitive object={getGeometry('CylinderGeometry', [0.008, 0.008, 0.85, 4])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#3A2818",  })} attach="material" />
    </mesh>
    {/* Lantern hanging */}
    <mesh position={[0.4, 1.35, 0.4]}>
      <primitive object={getGeometry('BoxGeometry', [0.08, 0.1, 0.08])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#F4D87C", emissive: "#F4D87C", emissiveIntensity: 0.7,  })} attach="material" />
    </mesh>
    <pointLight position={[0.4, 1.35, 0.4]} color="#F4D87C" intensity={0.4} distance={1.8} />
  </group>
);

/* ── Bakery — warm pastry shop with striped awning ──── */