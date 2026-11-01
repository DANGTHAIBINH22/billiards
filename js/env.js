// The pool hall: floor, walls, pendant lamp, furniture, lights and reflections.
import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';

const FLOOR_Y = -0.8; // table cloth is at y = 0, so the table stands 0.8 m tall

function woodTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1024;
  const g = c.getContext('2d');
  for (let i = 0; i < 16; i++) {
    const shade = 38 + Math.random() * 22;
    g.fillStyle = `rgb(${shade + 22}, ${shade + 8}, ${shade - 6})`;
    g.fillRect(0, i * 64, 1024, 62);
    g.strokeStyle = 'rgba(0,0,0,.25)';
    for (let k = 0; k < 14; k++) {
      g.beginPath();
      const y = i * 64 + Math.random() * 60;
      g.moveTo(0, y);
      g.bezierCurveTo(300, y + (Math.random() - 0.5) * 6, 700, y + (Math.random() - 0.5) * 6, 1024, y);
      g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,.5)';
    g.fillRect(0, i * 64 + 62, 1024, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function poster(w, h, title, c1, c2) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = Math.round(256 * (h / w));
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, c.width, c.height);
  grd.addColorStop(0, c1);
  grd.addColorStop(1, c2);
  g.fillStyle = grd;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(255,255,255,.85)';
  g.font = 'bold 30px Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText(title, c.width / 2, c.height / 2 + 10);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
}

export function buildRoom(scene, renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.background = new THREE.Color('#07090c');
  scene.fog = new THREE.Fog('#07090c', 9, 18);

  const room = new THREE.Group();
  const RW = 7;
  const RD = 5.5;
  const H = 3.2;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * RW, 2 * RD), new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.55, metalness: 0.05, envMapIntensity: 0.4 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  room.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: '#1a2220', roughness: 0.9 });
  const mk = (w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    room.add(m);
  };
  const cy = FLOOR_Y + H / 2;
  mk(2 * RW, H, 0, cy, -RD, 0);
  mk(2 * RW, H, 0, cy, RD, Math.PI);
  mk(2 * RD, H, -RW, cy, 0, Math.PI / 2);
  mk(2 * RD, H, RW, cy, 0, -Math.PI / 2);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(2 * RW, 2 * RD), new THREE.MeshStandardMaterial({ color: '#0d1110', roughness: 1 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = FLOOR_Y + H;
  room.add(ceil);

  // Wainscot + posters.
  const panel = new THREE.MeshPhysicalMaterial({ color: '#2a1810', roughness: 0.5, clearcoat: 0.4 });
  const wains = new THREE.Mesh(new THREE.BoxGeometry(2 * RW, 1.0, 0.06), panel);
  wains.position.set(0, FLOOR_Y + 0.5, -RD + 0.03);
  room.add(wains);
  const p1 = poster(1.4, 0.9, 'BILLIARDS', '#1c5f4a', '#0b2a22');
  p1.position.set(-2.2, 0.55, -RD + 0.02);
  const p2 = poster(1.0, 1.3, '9 · 10 · 8', '#6a1a22', '#240a0d');
  p2.position.set(2.4, 0.5, -RD + 0.02);
  room.add(p1, p2);

  // Cue rack on the left wall.
  const rack = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.5, 0.5), panel);
  rack.position.set(-RW + 0.04, 0.2, 1.4);
  room.add(rack);
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.015, 1.4, 12), new THREE.MeshStandardMaterial({ color: i % 2 ? '#e3c28f' : '#14141a', roughness: 0.4 }));
    c.position.set(-RW + 0.1, 0.2, 1.2 + i * 0.08);
    room.add(c);
  }

  // Stools.
  const stoolMat = new THREE.MeshStandardMaterial({ color: '#2b1a14', roughness: 0.5 });
  const seatMat = new THREE.MeshStandardMaterial({ color: '#6a1a22', roughness: 0.7 });
  for (const [x, z] of [[-3.2, 1.2], [-3.2, -0.2], [3.4, 1.0], [3.4, -0.4]]) {
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 24), seatMat);
    seat.position.set(x, FLOOR_Y + 0.72, z);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.7, 12), stoolMat);
    stem.position.set(x, FLOOR_Y + 0.36, z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 24), stoolMat);
    base.position.set(x, FLOOR_Y + 0.015, z);
    seat.castShadow = stem.castShadow = true;
    room.add(seat, stem, base);
  }
  // Side table with chalk.
  const side = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.4), panel);
  side.position.set(3.0, FLOOR_Y + 0.9, 2.2);
  const sideLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.9, 12), stoolMat);
  sideLeg.position.set(3.0, FLOOR_Y + 0.45, 2.2);
  const chalk = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), new THREE.MeshStandardMaterial({ color: '#2f6fd6', roughness: 0.9 }));
  chalk.position.set(3.0, FLOOR_Y + 0.935, 2.2);
  room.add(side, sideLeg, chalk);

  // Pendant billiard lamp above the table.
  const lampY = 1.3;
  const shade = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.12, 0.42),
    new THREE.MeshPhysicalMaterial({ color: '#0e2a20', roughness: 0.3, clearcoat: 1, metalness: 0.2 })
  );
  shade.position.set(0, lampY, 0);
  shade.castShadow = false;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.34), new THREE.MeshBasicMaterial({ color: '#fff6e0', toneMapped: false }));
  glow.rotation.x = Math.PI / 2;
  glow.position.set(0, lampY - 0.062, 0);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.02, 0.46), new THREE.MeshStandardMaterial({ color: '#b08d3e', metalness: 1, roughness: 0.3 }));
  trim.position.set(0, lampY - 0.065, 0);
  room.add(shade, glow, trim);
  const lampParts = [shade, glow, trim];
  for (const x of [-0.9, 0.9]) {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, FLOOR_Y + H - lampY, 6), new THREE.MeshBasicMaterial({ color: '#111' }));
    cable.position.set(x, lampY + (FLOOR_Y + H - lampY) / 2, 0);
    room.add(cable);
    lampParts.push(cable);
  }

  scene.add(room);

  // Lights: soft ambient + a shadowing spot standing in for the lamp + a fill from the room.
  scene.add(new THREE.HemisphereLight('#bcd0ff', '#2a1b12', 0.25));
  const spot = new THREE.SpotLight('#fff1d6', 26, 6, Math.PI / 3.2, 0.55, 1.2);
  spot.position.set(0, lampY - 0.1, 0);
  spot.target.position.set(0, 0, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048);
  spot.shadow.camera.near = 0.3;
  spot.shadow.camera.far = 4;
  spot.shadow.bias = -0.0003;
  spot.shadow.radius = 4;
  scene.add(spot, spot.target);
  const fill = new THREE.PointLight('#ffd9a8', 3, 9, 1.6);
  fill.position.set(0, 2.1, 2.6);
  scene.add(fill);

  return { floorY: FLOOR_Y, lampY, lampParts };
}
