import React from 'react';
import { getGeometry, getMaterial } from './SharedMaterials';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { RefObject } from 'react';

export const Observatory = () => (
  <group>
    {/* Stone cylinder base */}
    <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
      <primitive object={getGeometry('CylinderGeometry', [0.55, 0.62, 0.64, 16])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#8B8078", roughness: 0.9, flatShading: true,  })} attach="material" />
    </mesh>
    {/* Gold decorative band */}
    <mesh position={[0, 0.58, 0]}><primitive object={getGeometry('CylinderGeometry', [0.57, 0.57, 0.04, 16])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#C9A55B", metalness: 0.4,  })} attach="material" /></mesh>
    {/* Glowing amber windows */}
    {[0, 1, 2, 3].map((i) => {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      return (
        <mesh key={i} position={[Math.cos(a) * 0.53, 0.3, Math.sin(a) * 0.53]} rotation={[0, -a, 0]}>
          <primitive object={getGeometry('BoxGeometry', [0.12, 0.2, 0.015])} attach="geometry" />
          <primitive object={getMaterial('MeshStandardMaterial', { color: "#F2C46C", emissive: "#F2A030", emissiveIntensity: 0.9,  })} attach="material" />
        </mesh>
      );
    })}
    {/* Dome (hemisphere) */}
    <mesh position={[0, 0.65, 0]} castShadow>
      <primitive object={getGeometry('SphereGeometry', [0.52, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#A0AEBB", metalness: 0.45, roughness: 0.28,  })} attach="material" />
    </mesh>
    <mesh position={[0, 0.65, 0]}><primitive object={getGeometry('CylinderGeometry', [0.53, 0.53, 0.04, 24])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#788898", metalness: 0.5,  })} attach="material" /></mesh>
    {/* Telescope barrel poking out */}
    <mesh position={[0.22, 0.97, 0]} rotation={[0, 0, -Math.PI / 5.5]}>
      <primitive object={getGeometry('CylinderGeometry', [0.055, 0.075, 0.56, 10])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#3A4A5A", metalness: 0.85, roughness: 0.2,  })} attach="material" />
    </mesh>
    <mesh position={[0.44, 1.12, 0]} rotation={[0, 0, -Math.PI / 5.5]}>
      <primitive object={getGeometry('CylinderGeometry', [0.065, 0.065, 0.04, 12])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#7BC5E5", emissive: "#7BC5E5", emissiveIntensity: 0.35,  })} attach="material" />
    </mesh>
    {/* Star dots on dome */}
    {[0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i / 6) * Math.PI * 2;
      return (
        <mesh key={i} position={[Math.cos(a) * 0.41, 0.84, Math.sin(a) * 0.41]}>
          <primitive object={getGeometry('SphereGeometry', [0.019, 6, 6])} attach="geometry" />
          <primitive object={getMaterial('MeshStandardMaterial', { color: "#F4E87C", emissive: "#F4E87C", emissiveIntensity: 1.0,  })} attach="material" />
        </mesh>
      );
    })}
    {/* Stone steps */}
    {[0, 1, 2].map((i) => (
      <mesh key={i} position={[0, 0.04 + i * 0.04, 0.68 - i * 0.05]}>
        <primitive object={getGeometry('BoxGeometry', [0.38, 0.04, 0.14])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#9B8E7E",  })} attach="material" />
      </mesh>
    ))}
    <mesh position={[0, 1.16, 0]}><primitive object={getGeometry('SphereGeometry', [0.038, 8, 8])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#C9A55B", metalness: 0.7,  })} attach="material" /></mesh>
    <pointLight position={[0, 0.88, 0]} color="#6060FF" intensity={0.45} distance={2.2} />
  </group>
);

/* ── Bell Tower — tall stone tower with animated bell ─ */