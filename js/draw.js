// Helpers for flat overlay graphics (path ribbons, arcs, 3D flight lines) in engine coordinates.
// Engine (x, y, z-up) -> Three (x, z, -y).
import * as THREE from 'three';
import { R } from './physics.js';

/** Flat ribbon on the cloth following `pts` ([[x,y],...]). */
export function ribbon(pts, { width = 0.006, color = '#fff', dash = 0, y = 0.004 } = {}) {
  const pos = [];
  const idx = [];
  let acc = 0;
  const hw = width / 2;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const on = !dash || Math.floor(acc / dash) % 2 === 0;
    acc += len;
    if (!on) continue;
    const nx = (-dy / len) * hw;
    const ny = (dx / len) * hw;
    const k = pos.length / 3;
    pos.push(x0 + nx, y, -(y0 + ny), x0 - nx, y, -(y0 - ny), x1 + nx, y, -(y1 + ny), x1 - nx, y, -(y1 - ny));
    idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false }));
  mesh.renderOrder = 2;
  return mesh;
}

/** Thin 3D polyline for a ball in flight: pts = [[x,y,z],...], z above rest height. */
export function flightLine(pts, color = '#ffffff') {
  const v = pts.map(([x, y, z]) => new THREE.Vector3(x, R + z, -y));
  const curve = new THREE.CatmullRomCurve3(v);
  const geo = new THREE.TubeGeometry(curve, Math.max(8, v.length * 2), 0.0035, 6, false);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  mesh.renderOrder = 3;
  return mesh;
}

export function arcPoints(cx, cy, r, a0, sweep, n = 24) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (sweep * i) / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

export function disposeGroup(g) {
  for (const c of [...g.children]) {
    g.remove(c);
    c.geometry?.dispose();
    c.material?.dispose?.();
  }
}
