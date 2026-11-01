// Pool balls styled after tournament phenolic sets (glossy, big white number discs, red-dot cue ball).
import * as THREE from 'three';
import { R } from './physics.js';

export const BALL_COLORS = [
  '#f3f0e6', '#f7c600', '#0a3f94', '#d4161f', '#4a2685', '#f26a12', '#0b7d3d', '#7a1517',
  '#0c0c0e', '#f7c600', '#0a3f94', '#d4161f', '#4a2685', '#f26a12', '#0b7d3d', '#7a1517',
];

function ballTexture(id) {
  const W = 1024;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const color = BALL_COLORS[id];
  const stripe = id >= 9;
  g.fillStyle = id === 0 || stripe ? '#f3f0e6' : color;
  g.fillRect(0, 0, W, H);
  if (stripe) {
    g.fillStyle = color;
    g.fillRect(0, H * 0.27, W, H * 0.46);
  }
  if (id === 0) {
    g.fillStyle = '#c4202a';
    const dots = [[0, 0.5], [0.25, 0.5], [0.5, 0.5], [0.75, 0.5], [1, 0.5], [0.125, 0.2], [0.375, 0.8], [0.625, 0.2], [0.875, 0.8]];
    for (const [u, v] of dots) {
      g.beginPath();
      g.ellipse(u * W, v * H, 14, 14, 0, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    for (const u of [0.25, 0.75]) {
      const x = u * W;
      g.fillStyle = '#f7f4ea';
      g.beginPath();
      g.arc(x, H / 2, 62, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#101010';
      g.font = 'bold 84px Arial, Helvetica, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(id), x, H / 2 + 6);
      if (id === 6 || id === 9) {
        g.fillRect(x - 24, H / 2 + 52, 48, 7); // underline so 6 and 9 can be told apart
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const ballGeo = new THREE.SphereGeometry(R, 48, 32);

export function makeBallMesh(id) {
  const mat = new THREE.MeshPhysicalMaterial({
    map: ballTexture(id),
    roughness: 0.12,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 0.9,
  });
  const m = new THREE.Mesh(ballGeo, mat);
  m.castShadow = true;
  m.userData.id = id;
  return m;
}

const _q = new THREE.Quaternion();
const _axis = new THREE.Vector3();

/** Sync a mesh with engine state, integrating spin into orientation. Engine (wx,wy,wz) -> Three (wx,wz,-wy). */
export function syncBall(mesh, b, dt = 0) {
  mesh.visible = b.active;
  mesh.position.set(b.x, R + b.z, -b.y);
  if (dt > 0) {
    _axis.set(b.wx, b.wz, -b.wy);
    const w = _axis.length();
    if (w > 1e-6) {
      _q.setFromAxisAngle(_axis.multiplyScalar(1 / w), w * dt);
      mesh.quaternion.premultiply(_q);
    }
  }
}
