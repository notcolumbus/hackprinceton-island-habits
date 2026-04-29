import * as THREE from 'three';

const geoCache = new Map<string, THREE.BufferGeometry>();
const matCache = new Map<string, THREE.Material>();

export function getGeometry(type: string, args: any[]): THREE.BufferGeometry {
  const key = type + JSON.stringify(args);
  if (!geoCache.has(key)) {
    const GeoClass = (THREE as any)[type];
    geoCache.set(key, new GeoClass(...args));
  }
  return geoCache.get(key)!;
}

export function getMaterial(type: string, props: any): THREE.Material {
  const key = type + JSON.stringify(props);
  if (!matCache.has(key)) {
    const MatClass = (THREE as any)[type];
    matCache.set(key, new MatClass(props));
  }
  return matCache.get(key)!;
}
