import React from 'react';
import { getGeometry, getMaterial } from './SharedMaterials';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { RefObject } from 'react';

export const Bakery = ({ smokeRef }: { smokeRef: RefObject<THREE.Mesh | null> }) => (
  <group>
    <mesh position={[0, 0.05, 0]} receiveShadow>
      <primitive object={getGeometry('BoxGeometry', [1.0, 0.1, 0.88])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#9B8E7E",  })} attach="material" />
    </mesh>
    <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
      <primitive object={getGeometry('BoxGeometry', [0.9, 0.8, 0.78])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#F8EAC8",  })} attach="material" />
    </mesh>
    {/* Display window */}
    <mesh position={[-0.12, 0.38, 0.4]}>
      <primitive object={getGeometry('BoxGeometry', [0.44, 0.34, 0.015])} attach="geometry" />
      <primitive object={getMaterial('MeshStandardMaterial', { color: "#A8D8F0", emissive: "#F4E8C0", emissiveIntensity: 0.3, opacity: 0.7, transparent: true,  })} attach="material" />
    </mesh>
    <mesh position={[-0.12, 0.55, 0.41]}><primitive object={getGeometry('BoxGeometry', [0.46, 0.015, 0.01])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#7A5032",  })} attach="material" /></mesh>
    <mesh position={[-0.12, 0.22, 0.41]}><primitive object={getGeometry('BoxGeometry', [0.46, 0.015, 0.01])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#7A5032",  })} attach="material" /></mesh>
    <mesh position={[-0.12, 0.38, 0.41]}><primitive object={getGeometry('BoxGeometry', [0.015, 0.36, 0.01])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#7A5032",  })} attach="material" /></mesh>
    {/* Striped awning */}
    {[-0.28, -0.18, -0.08, 0.02, 0.12].map((x, i) => (
      <mesh key={i} position={[x, 0.64, 0.46]} rotation={[-0.38, 0, 0]}>
        <primitive object={getGeometry('BoxGeometry', [0.098, 0.005, 0.24])} attach="geometry" />
        <primitive object={getMaterial('MeshStandardMaterial', { color: i % 2 === 0 ? "#D9433A" : "#F8F4EE",  })} attach="material" />
      </mesh>
    ))}
    <mesh position={[-0.08, 0.575, 0.585]} rotation={[-0.38, 0, 0]}>
      <primitive object={getGeometry('BoxGeometry', [0.54, 0.03, 0.015])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#C53030",  })} attach="material" />
    </mesh>
    {/* Door */}
    <mesh position={[0.3, 0.34, 0.4]}>
      <primitive object={getGeometry('BoxGeometry', [0.18, 0.52, 0.015])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#7A5032",  })} attach="material" />
    </mesh>
    <mesh position={[0.3, 0.49, 0.41]}>
      <primitive object={getGeometry('BoxGeometry', [0.1, 0.12, 0.01])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#A8D8F0", opacity: 0.6, transparent: true,  })} attach="material" />
    </mesh>
    <mesh position={[0.36, 0.34, 0.415]}><primitive object={getGeometry('SphereGeometry', [0.012, 6, 6])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#C9A55B", metalness: 0.6,  })} attach="material" /></mesh>
    {/* Hanging sign */}
    <mesh position={[-0.12, 0.82, 0.5]}><primitive object={getGeometry('BoxGeometry', [0.26, 0.14, 0.018])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#F4D87C",  })} attach="material" /></mesh>
    <mesh position={[-0.24, 0.9, 0.47]}><primitive object={getGeometry('BoxGeometry', [0.015, 0.16, 0.015])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#5A3820",  })} attach="material" /></mesh>
    <mesh position={[0.0, 0.9, 0.47]}><primitive object={getGeometry('BoxGeometry', [0.015, 0.16, 0.015])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#5A3820",  })} attach="material" /></mesh>
    {/* Roof */}
    <mesh position={[0, 0.93, 0]}><primitive object={getGeometry('BoxGeometry', [1.02, 0.06, 0.9])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#C5523A",  })} attach="material" /></mesh>
    <mesh position={[0, 1.14, 0]} castShadow rotation={[0, Math.PI / 4, 0]}>
      <primitive object={getGeometry('ConeGeometry', [0.73, 0.44, 4])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#C5523A",  })} attach="material" />
    </mesh>
    {/* Chimney + smoke */}
    <mesh position={[-0.22, 1.05, -0.12]} castShadow><primitive object={getGeometry('BoxGeometry', [0.1, 0.28, 0.1])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#7A6B5A",  })} attach="material" /></mesh>
    <mesh ref={smokeRef} position={[-0.22, 1.2, -0.12]}><primitive object={getGeometry('SphereGeometry', [0.07, 8, 8])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#E8E8E8", opacity: 0.5, transparent: true,  })} attach="material" /></mesh>
    {/* Flower boxes */}
    {[-0.3, 0.12].map((x, i) => (
      <group key={i} position={[x, 0.47, 0.43]}>
        <mesh><primitive object={getGeometry('BoxGeometry', [0.14, 0.055, 0.06])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: "#6B4226",  })} attach="material" /></mesh>
        {[-0.04, 0, 0.04].map((dx, j) => (
          <mesh key={j} position={[dx, 0.05, 0]}><primitive object={getGeometry('SphereGeometry', [0.024, 6, 6])} attach="geometry" /><primitive object={getMaterial('MeshStandardMaterial', { color: ["#F4A0A0","#F2C46C","#D4A8E0"][j],  })} attach="material" /></mesh>
        ))}
      </group>
    ))}
  </group>
);

/* ── Tea House — two-tier pagoda with lanterns ──────── */