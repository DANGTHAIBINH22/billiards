// Tournament-style 9ft table (black lacquer rails with red inlay, tournament-green cloth, pearl sights).
// Plan-view shapes are written in engine coordinates (x, y); rotateX(-90°) maps them to Three (x, z=-y).
import * as THREE from 'three';
import { TABLE, CORNER_K, SIDE_K } from './physics.js';

const { hx, hy } = TABLE;
const RAIL_H = 0.05;
const RAIL_W = 0.19; // from the nose line outwards
const SIDE_JAW = 0.1; // half-width of the side-pocket jaw piece
// WPA pocket facings, as the angle between the cushion nose and the cut into the pocket.
const CORNER_FACING = (142 * Math.PI) / 180;
const SIDE_FACING = (104 * Math.PI) / 180;

/** First point where the ray from (px, py) along (dx, dy) meets the circle; the jaw facing ends there. */
function rayToCircle(px, py, dx, dy, cx, cy, r) {
  const ox = px - cx;
  const oy = py - cy;
  const b = ox * dx + oy * dy;
  const t = -b - Math.sqrt(b * b - (ox * ox + oy * oy - r * r));
  return [px + dx * t, py + dy * t];
}

function clothTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 512, 512);
  const img = g.getImageData(0, 0, 512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 128 + (Math.random() - 0.5) * 46;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14, 7);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function extrudePlan(shape, depth, bevel = 0.003) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * bevel,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 28,
  });
  geo.translate(0, 0, bevel);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function cornerShape() {
  const a = hx;
  const b = hy;
  const cx = a + 0.02;
  const cy = b + 0.02;
  const r = 0.08;
  // The jaw starts at the physics knuckles, so what looks like rail is rail: each facing runs from a knuckle back to
  // the hole at the WPA facing angle.
  const f = Math.PI - CORNER_FACING; // facing direction, measured from the nose line
  const [t1x, t1y] = rayToCircle(a - CORNER_K, b, Math.cos(f), Math.sin(f), cx, cy, r);
  const [t2x, t2y] = rayToCircle(a, b - CORNER_K, Math.sin(f), Math.cos(f), cx, cy, r);
  const s = new THREE.Shape();
  s.moveTo(a - CORNER_K, b);
  s.lineTo(a - CORNER_K, b + RAIL_W);
  s.lineTo(a + RAIL_W, b + RAIL_W);
  s.lineTo(a + RAIL_W, b - CORNER_K);
  s.lineTo(a, b - CORNER_K);
  s.lineTo(t2x, t2y);
  s.absarc(cx, cy, r, Math.atan2(t2y - cy, t2x - cx) + 2 * Math.PI, Math.atan2(t1y - cy, t1x - cx) + 2 * Math.PI, false);
  s.lineTo(a - CORNER_K, b);
  return s;
}

function sideShape() {
  const b = hy;
  const cy = b + 0.03;
  const r = 0.065;
  const f = SIDE_FACING - Math.PI / 2; // facing lean from the perpendicular to the rail
  const [tx, ty] = rayToCircle(SIDE_K, b, -Math.sin(f), Math.cos(f), 0, cy, r);
  const s = new THREE.Shape();
  s.moveTo(-SIDE_JAW, b);
  s.lineTo(-SIDE_JAW, b + RAIL_W);
  s.lineTo(SIDE_JAW, b + RAIL_W);
  s.lineTo(SIDE_JAW, b);
  s.lineTo(SIDE_K, b);
  s.lineTo(tx, ty);
  s.absarc(0, cy, r, Math.atan2(ty - cy, tx), Math.atan2(ty - cy, -tx) + 2 * Math.PI, false);
  s.lineTo(-SIDE_K, b);
  s.lineTo(-SIDE_JAW, b);
  return s;
}

function cushionGeo(len) {
  const p = new THREE.Shape();
  p.moveTo(-0.014, 0);
  p.lineTo(0, 0.0375);
  p.lineTo(0.03, 0.043);
  p.lineTo(0.06, 0.043);
  p.lineTo(0.06, 0);
  p.closePath();
  const g = new THREE.ExtrudeGeometry(p, { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  return g;
}

export function buildTable(scene) {
  const root = new THREE.Group();

  const lacquer = new THREE.MeshPhysicalMaterial({ color: '#0c0b0d', roughness: 0.28, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.1 });
  const wood = new THREE.MeshPhysicalMaterial({ color: '#17100d', roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const felt = new THREE.MeshStandardMaterial({ color: '#0e5a3d', roughness: 0.95, map: clothTexture() });
  const cushionMat = new THREE.MeshStandardMaterial({ color: '#0c4f35', roughness: 0.92, map: felt.map });
  const pearl = new THREE.MeshPhysicalMaterial({ color: '#f4efe0', roughness: 0.25, clearcoat: 1, envMapIntensity: 1.2 });
  const inlay = new THREE.MeshStandardMaterial({ color: '#b3141c', roughness: 0.4 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#cfd3da', metalness: 1, roughness: 0.2 });
  const leather = new THREE.MeshStandardMaterial({ color: '#150f0b', roughness: 0.9, side: THREE.BackSide });
  const black = new THREE.MeshBasicMaterial({ color: '#030303' });

  const add = (m, x = 0, y = 0, z = 0) => {
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    root.add(m);
    return m;
  };

  // Cloth, slate and pocket openings.
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2 * hx + 0.5, 2 * hy + 0.5), felt);
  cloth.rotation.x = -Math.PI / 2;
  cloth.receiveShadow = true;
  root.add(cloth);
  add(new THREE.Mesh(new THREE.BoxGeometry(2 * hx + 0.5, 0.05, 2 * hy + 0.5), new THREE.MeshStandardMaterial({ color: '#0d2b1e' })), 0, -0.0255, 0);

  const holes = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) holes.push({ x: sx * (hx + 0.02), z: sz * (hy + 0.02), r: 0.08, corner: [sx, sz] });
  for (const sz of [-1, 1]) holes.push({ x: 0, z: sz * (hy + 0.03), r: 0.065, side: sz });
  for (const h of holes) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(h.r, 32), black);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(h.x, 0.0015, h.z);
    root.add(disc);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(h.r * 0.96, h.r * 0.7, 0.16, 28, 1, true), leather);
    cup.position.set(h.x, -0.08, h.z);
    root.add(cup);
  }

  // Corner jaws + side jaws (single solid pieces with the pocket bite cut out).
  const cornerGeo = extrudePlan(cornerShape(), RAIL_H);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const m = new THREE.Mesh(cornerGeo, lacquer);
      m.scale.set(sx, 1, sy);
      add(m);
    }
  }
  const sideGeo = extrudePlan(sideShape(), RAIL_H);
  for (const sy of [-1, 1]) {
    const m = new THREE.Mesh(sideGeo, lacquer);
    m.scale.set(1, 1, sy);
    add(m);
  }

  // Straight rail tops between the jaws, with a red inlay and pearl sights.
  const longLen = hx - CORNER_K - SIDE_JAW;
  const cx = (hx - CORNER_K + SIDE_JAW) / 2;
  const shortLen = 2 * (hy - CORNER_K);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      add(new THREE.Mesh(new THREE.BoxGeometry(longLen, RAIL_H, RAIL_W - 0.06), lacquer), sx * cx, RAIL_H / 2, sz * (hy + 0.06 + (RAIL_W - 0.06) / 2));
      add(new THREE.Mesh(new THREE.BoxGeometry(longLen, 0.001, 0.006), inlay), sx * cx, RAIL_H + 0.0005, sz * (hy + 0.075));
    }
    add(new THREE.Mesh(new THREE.BoxGeometry(RAIL_W - 0.06, RAIL_H, shortLen), lacquer), sx * (hx + 0.06 + (RAIL_W - 0.06) / 2), RAIL_H / 2, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.001, shortLen), inlay), sx * (hx + 0.075), RAIL_H + 0.0005, 0);
  }
  const dia = new THREE.CylinderGeometry(0.0085, 0.0085, 0.002, 20);
  const sight = (x, z) => add(new THREE.Mesh(dia, pearl), x, RAIL_H + 0.001, z);
  for (const sz of [-1, 1]) for (const k of [-3, -2, -1, 1, 2, 3]) sight((k * hx) / 4, sz * (hy + 0.125));
  for (const sx of [-1, 1]) for (const k of [-1, 0, 1]) sight(sx * (hx + 0.125), (k * hy) / 2);

  // Cushions.
  const longC = cushionGeo(longLen);
  const shortC = cushionGeo(shortLen);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const m = new THREE.Mesh(longC, cushionMat);
      m.rotation.y = sz > 0 ? -Math.PI / 2 : Math.PI / 2; // u axis outwards, length along x
      add(m, sx * cx, 0, sz * hy);
    }
    const s = new THREE.Mesh(shortC, cushionMat);
    s.rotation.y = sx > 0 ? 0 : Math.PI; // u axis points away from the table
    add(s, sx * hx, 0, 0);
  }

  // Apron + cabinet.
  const ox = hx + RAIL_W;
  const oz = hy + RAIL_W;
  add(new THREE.Mesh(new THREE.BoxGeometry(2 * ox - 0.04, 0.12, 2 * oz - 0.04), wood), 0, -0.12, 0);
  add(new THREE.Mesh(new THREE.BoxGeometry(2 * ox - 0.3, 0.1, 2 * oz - 0.3), wood), 0, -0.2, 0);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.62, 24), lacquer);
      add(leg, sx * (hx - 0.1), -0.5, sz * (hy - 0.05));
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.04, 24), chrome);
      add(foot, sx * (hx - 0.1), -0.78, sz * (hy - 0.05));
    }
  }
  // Red band around the apron (accent).
  for (const sz of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(2 * ox - 0.036, 0.012, 0.004), inlay), 0, -0.1, sz * (oz - 0.02));
  for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 2 * oz - 0.036), inlay), sx * (ox - 0.02), -0.1, 0);

  // Head spot / foot spot / centre spot.
  const spotMat = new THREE.MeshBasicMaterial({ color: '#cfe8dc' });
  for (const x of [-hx / 2, 0, hx / 2]) {
    const s = new THREE.Mesh(new THREE.CircleGeometry(0.005, 12), spotMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(x, 0.0012, 0);
    root.add(s);
  }

  scene.add(root);
  return root;
}
