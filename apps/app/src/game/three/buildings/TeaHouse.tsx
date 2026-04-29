import React from 'react';
import { getGeometry, getMaterial } from './SharedMaterials';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { RefObject } from 'react';

export const TeaHouse = ({ lanternRef }: { lanternRef: RefObject<THREE.Mesh | null> }) => (
  <group>
    {/* Stone base */}
    <mesh position={[0, 0.05, 0]} receiveShadow><primitive object={getGeometry('BoxGeometry', [1.05, 0.1, 0.95])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#7A6B5A", roughness: 0.9,  })} attach="material" /></mesh>
    <mesh position={[0, 0.03, 0.54]}><primitive object={getGeometry('BoxGeometry', [0.38, 0.06, 0.1])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#9B8E7E",  })} attach="material" /></mesh>
    {/* Lower walls */}
    <mesh position={[0, 0.36, 0]} castShadow><primitive object={getGeometry('BoxGeometry', [0.86, 0.52, 0.76])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#3A2010",  })} attach="material" /></mesh>
    {/* Sliding door slats */}
    {[-0.12, -0.04, 0.04, 0.12].map((x, i) => (
      <mesh key={i} position={[x, 0.31, 0.385]}><primitive object={getGeometry('BoxGeometry', [0.06, 0.4, 0.012])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: i % 2 === 0 ? "#6B4A28" : "#5A3A18",  })} attach="material" /></mesh>
    ))}
    {/* Side window */}
    <mesh position={[-0.33, 0.4, 0.385]}><primitive object={getGeometry('BoxGeometry', [0.14, 0.2, 0.012])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#F2C46C", emissive: "#F2C46C", emissiveIntensity: 0.6,  })} attach="material" /></mesh>
    {/* First roof tier */}
    <mesh position={[0, 0.66, 0]} castShadow><primitive object={getGeometry('BoxGeometry', [1.12, 0.05, 1.02])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#1E1208",  })} attach="material" /></mesh>
    <mesh position={[0, 0.73, 0]} castShadow rotation={[0, Math.PI / 4, 0]}><primitive object={getGeometry('ConeGeometry', [0.9, 0.22, 4])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#2A1A08",  })} attach="material" /></mesh>
    {/* Upturned eave tips */}
    {([[0.56, 0.68, 0.5, -0.35, 0.35], [-0.56, 0.68, 0.5, 0.35, 0.35], [0.56, 0.68, -0.5, -0.35, -0.35], [-0.56, 0.68, -0.5, 0.35, -0.35]] as number[][]).map(([x, y, z, rx, rz], i) => (
      <mesh key={i} position={[x, y, z]} rotation={[rz * 0.5, 0, rx * 0.5]}>
        <primitive object={getGeometry('BoxGeometry', [0.1, 0.04, 0.14])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#1E1208",  })} attach="material" />
      </mesh>
    ))}
    {/* Gold trim ring */}
    <mesh position={[0, 0.67, 0]}><primitive object={getGeometry('TorusGeometry', [0.6, 0.012, 4, 4])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#C9A55B", metalness: 0.4,  })} attach="material" /></mesh>
    {/* Second story */}
    <mesh position={[0, 0.92, 0]} castShadow><primitive object={getGeometry('BoxGeometry', [0.64, 0.36, 0.56])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#3A2010",  })} attach="material" /></mesh>
    <mesh position={[0, 1.0, 0.285]}><primitive object={getGeometry('BoxGeometry', [0.22, 0.16, 0.01])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#F2C46C", emissive: "#F2C46C", emissiveIntensity: 0.5,  })} attach="material" /></mesh>
    {/* Second roof tier */}
    <mesh position={[0, 1.12, 0]}><primitive object={getGeometry('BoxGeometry', [0.8, 0.045, 0.72])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#1E1208",  })} attach="material" /></mesh>
    <mesh position={[0, 1.22, 0]} castShadow rotation={[0, Math.PI / 4, 0]}><primitive object={getGeometry('ConeGeometry', [0.62, 0.36, 4])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#2A1A08",  })} attach="material" /></mesh>
    {/* Finial */}
    <mesh position={[0, 1.44, 0]}><primitive object={getGeometry('CylinderGeometry', [0.012, 0.012, 0.24, 6])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#C9A55B", metalness: 0.5,  })} attach="material" /></mesh>
    <mesh position={[0, 1.57, 0]}><primitive object={getGeometry('SphereGeometry', [0.038, 8, 8])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#C9A55B", metalness: 0.7,  })} attach="material" /></mesh>
    {/* Hanging lanterns */}
    {[[-0.36, 0.63, 0.49], [0.36, 0.63, 0.49]].map(([x, y, z], i) => (
      <group key={i} position={[x, y, z]}>
        <mesh position={[0, 0.04, 0]}><primitive object={getGeometry('CylinderGeometry', [0.007, 0.007, 0.08, 4])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#2A1A08",  })} attach="material" /></mesh>
        <mesh ref={i === 0 ? lanternRef : undefined} position={[0, -0.02, 0]}>
          <primitive object={getGeometry('CylinderGeometry', [0.044, 0.038, 0.1, 8])} attach="geometry" />
          <primitive object={getMaterial('MeshStandardMaterial', { color: "#E03020", emissive: "#FF6020", emissiveIntensity: 0.7,  })} attach="material" />
        </mesh>
        <mesh position={[0, -0.08, 0]}><primitive object={getGeometry('CylinderGeometry', [0.014, 0.0, 0.04, 6])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#F4D87C",  })} attach="material" /></mesh>
      </group>
    ))}
    {/* Bamboo corner poles */}
    {[[-0.48, -0.44], [0.48, -0.44], [-0.48, 0.39], [0.48, 0.39]].map(([x, z], i) => (
      <mesh key={i} position={[x, 0.42, z]} castShadow><primitive object={getGeometry('CylinderGeometry', [0.024, 0.024, 0.84, 6])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#6A8B3A", roughness: 0.8,  })} attach="material" /></mesh>
    ))}
  </group>
);

/* ── Observatory — stone dome with telescope ────────── */