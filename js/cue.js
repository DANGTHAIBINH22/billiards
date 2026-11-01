// Cue models. Local +z runs from the tip towards the butt; the tip sits at the origin.
import * as THREE from 'three';

function cyl(rTop, rBot, len, z0, mat) {
  // CylinderGeometry axis is y; rotate so +y -> +z. Top radius ends up on the butt side.
  const g = new THREE.CylinderGeometry(rTop, rBot, len, 28);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, z0 + len / 2);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}

const std = (o) => new THREE.MeshPhysicalMaterial({ clearcoat: 0.6, clearcoatRoughness: 0.15, ...o });

/** Playing cue: maple shaft, white ferrule, blue tip, black carbon butt with red ring accents. */
export function makeCue() {
  const L = 1.45;
  const g = new THREE.Group();
  const tip = cyl(0.0058, 0.0058, 0.012, 0, new THREE.MeshStandardMaterial({ color: '#2f6fd6', roughness: 0.9 }));
  const ferrule = cyl(0.0062, 0.0062, 0.025, 0.012, std({ color: '#f4f1e8', roughness: 0.3 }));
  const shaft = cyl(0.0125, 0.0063, 0.72, 0.037, std({ color: '#e3c28f', roughness: 0.35 }));
  const joint = cyl(0.0135, 0.0135, 0.03, 0.757, new THREE.MeshStandardMaterial({ color: '#b9bec6', metalness: 1, roughness: 0.25 }));
  const butt = cyl(0.0165, 0.0135, L - 0.787, 0.787, std({ color: '#0d0d10', roughness: 0.25, clearcoat: 1 }));
  const ring = cyl(0.0168, 0.0168, 0.012, 0.9, new THREE.MeshStandardMaterial({ color: '#b3141c', roughness: 0.4 }));
  const ring2 = cyl(0.0168, 0.0168, 0.006, 0.93, new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 1, roughness: 0.2 }));
  const wrap = cyl(0.0172, 0.0172, 0.28, 1.0, std({ color: '#1b1b1f', roughness: 0.85, clearcoat: 0 }));
  g.add(tip, ferrule, shaft, joint, butt, ring, ring2, wrap);
  g.userData.length = L;
  return g;
}

/** Jump cue: short, heavy-looking, hard white tip, glossy graphite body. */
export function makeJumpCue() {
  const L = 1.02;
  const g = new THREE.Group();
  const tip = cyl(0.0065, 0.0065, 0.01, 0, new THREE.MeshStandardMaterial({ color: '#f1f1f1', roughness: 0.5 }));
  const ferrule = cyl(0.0072, 0.0072, 0.03, 0.01, std({ color: '#d8dbe0', roughness: 0.2 }));
  const body = cyl(0.0165, 0.0075, 0.46, 0.04, std({ color: '#14161c', roughness: 0.2, clearcoat: 1 }));
  const butt = cyl(0.0185, 0.0165, L - 0.5, 0.5, std({ color: '#0a0a0c', roughness: 0.2, clearcoat: 1 }));
  const band = cyl(0.0188, 0.0188, 0.012, 0.62, new THREE.MeshStandardMaterial({ color: '#f2b705', roughness: 0.35 }));
  const wrap = cyl(0.0192, 0.0192, 0.22, 0.7, std({ color: '#25252a', roughness: 0.9, clearcoat: 0 }));
  g.add(tip, ferrule, body, butt, band, wrap);
  g.userData.length = L;
  return g;
}
