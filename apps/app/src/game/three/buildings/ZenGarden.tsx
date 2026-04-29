import React from 'react';
import { getGeometry, getMaterial } from './SharedMaterials';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { RefObject } from 'react';

export const ZenGarden = () => (
  <group>
    {/* Outer stone border */}
    {([-0.51, 0.51] as number[]).map((z) => (
      <mesh key={z} position={[0, 0.07, z]}><primitive object={getGeometry('BoxGeometry', [1.12, 0.14, 0.1])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#7A6B5A", roughness: 0.9,  })} attach="material" /></mesh>
    ))}
    {([-0.51, 0.51] as number[]).map((x) => (
      <mesh key={x} position={[x, 0.07, 0]}><primitive object={getGeometry('BoxGeometry', [0.1, 0.14, 0.92])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#7A6B5A", roughness: 0.9,  })} attach="material" /></mesh>
    ))}
    {/* Sand floor */}
    <mesh position={[0, 0.01, 0]}><primitive object={getGeometry('BoxGeometry', [0.93, 0.018, 0.93])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#E8D8B0", roughness: 1.0,  })} attach="material" /></mesh>
    {/* Raked lines */}
    {[-0.32, -0.18, -0.04, 0.1, 0.24].map((z) => (
      <mesh key={z} position={[0, 0.022, z]}><primitive object={getGeometry('BoxGeometry', [0.85, 0.003, 0.011])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#D4C8A0",  })} attach="material" /></mesh>
    ))}
    {/* Rocks */}
    <mesh position={[-0.22, 0.08, -0.16]}><primitive object={getGeometry('DodecahedronGeometry', [0.1])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#4A4845", roughness: 0.95, flatShading: true,  })} attach="material" /></mesh>
    <mesh position={[0.18, 0.07, 0.13]}><primitive object={getGeometry('DodecahedronGeometry', [0.085])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#5A5250", roughness: 0.95, flatShading: true,  })} attach="material" /></mesh>
    <mesh position={[0.06, 0.05, -0.25]}><primitive object={getGeometry('DodecahedronGeometry', [0.062])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#625E5A", roughness: 0.95, flatShading: true,  })} attach="material" /></mesh>
    {/* Bonsai */}
    <mesh position={[0.28, 0.1, -0.1]}><primitive object={getGeometry('CylinderGeometry', [0.016, 0.022, 0.18, 6])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#5A3820",  })} attach="material" /></mesh>
    <mesh position={[0.28, 0.23, -0.1]}><primitive object={getGeometry('SphereGeometry', [0.07, 10, 8])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#3A7A3A", roughness: 0.8, flatShading: true,  })} attach="material" /></mesh>
    <mesh position={[0.22, 0.29, -0.06]}><primitive object={getGeometry('SphereGeometry', [0.048, 8, 6])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#4A8A4A", roughness: 0.8, flatShading: true,  })} attach="material" /></mesh>
    <mesh position={[0.34, 0.29, -0.13]}><primitive object={getGeometry('SphereGeometry', [0.04, 8, 6])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#3A7A3A", roughness: 0.8, flatShading: true,  })} attach="material" /></mesh>
    {/* Bamboo corner posts */}
    {([[-0.49, -0.49], [0.49, -0.49], [-0.49, 0.49], [0.49, 0.49]] as [number,number][]).map(([x, z], i) => (
      <mesh key={i} position={[x, 0.15, z]}><primitive object={getGeometry('CylinderGeometry', [0.017, 0.017, 0.3, 6])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#7AB848", roughness: 0.85,  })} attach="material" /></mesh>
    ))}
    {/* Bamboo rake leaning on border */}
    <mesh position={[-0.38, 0.16, 0.32]} rotation={[0, 0.5, -0.28]}>
      <primitive object={getGeometry('CylinderGeometry', [0.007, 0.007, 0.44, 4])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#8B6040", roughness: 0.9,  })} attach="material" />
    </mesh>
  </group>
);

/* ── Crystal Grotto — glowing gem spires ─────────────── */