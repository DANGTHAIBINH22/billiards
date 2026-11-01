import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { R, TABLE, createBall, cloneBalls, strike, stepWorld, isMoving, POCKETS } from './physics.js';
import { predict, thicknessLabel, thicknessFraction, aimForThickness, aimForPocket, cutShot } from './aim.js';
import { buildTable } from './table.js';
import { buildRoom } from './env.js';
import { makeBallMesh, syncBall, BALL_COLORS } from './balls.js';
import { makeCue, makeJumpCue } from './cue.js';
import { ribbon, flightLine, arcPoints, disposeGroup } from './draw.js';
import { buildRack, spotPosition, HEAD_STRING_X, HEAD_SPOT, RACK_KINDS } from './racks.js';
import { createGame, groupOf, KINDS } from './rules.js';

const DEG = 180 / Math.PI;
const TIP_LIMIT = 0.5; // max cue-tip offset, in ball radii (beyond this = miss-cue)
const $ = (id) => document.getElementById(id);
const POCKET_NAMES = ['góc dưới-trái', 'góc dưới-phải', 'góc trên-trái', 'góc trên-phải', 'giữa dưới', 'giữa trên'];

// ---------- State ----------
const state = {
  balls: [],
  shot: { angle: 0, power: 35, a: 0, b: 0 },
  jump: false,
  elev: 35 / DEG,
  horizon: 2.5,
  lines: 'aim', // off | aim | full
  tool: 'aim', // aim | move | add | remove
  addId: 1,
  view: 'persp',
  phase: 'aim', // aim | pull | thrust | run | modal
  phaseT: 0,
  undo: null,
  slowmo: false,
  dirty: true,
  pending: null,
  game: null,
  matchRack: '15',
  practice: { preset: 'cut30', seed: 1, breakBox: false },
  callPocket: null,
  show: { deg: true, cheek: true }, // what to label on the object ball: cut angle, contact point / thickness
  cheek: false, // drag on the table sets the contact point on the object ball
  cheekSide: 1, // +1: object ball leaves to the left of the cue path
  aimBall: null,
  aimPocket: null, // { idx, angle } while the angle still comes from the pocket button
  fps: { dist: 1.15, pitch: 0 },
  events: [],
  simT: 0,
  shotCtx: null,
};

const powerToSpeed = (p) => (state.jump ? 0.4 + (p / 100) * 5.1 : 0.4 + (p / 100) * 6.6); // m/s

// ---------- Scene ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 40);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.enableDamping = true;
controls.minDistance = 0.8;
controls.maxDistance = 6;
controls.maxPolarAngle = Math.PI * 0.49;
controls.mouseButtons = { LEFT: -1, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: -1, TWO: THREE.TOUCH.DOLLY_ROTATE };

const room = buildRoom(scene, renderer);
buildTable(scene);

const meshes = [];
for (let i = 0; i < 16; i++) {
  const m = makeBallMesh(i);
  scene.add(m);
  meshes.push(m);
}
const normalCue = makeCue();
const jumpCue = makeJumpCue();
jumpCue.visible = false;
scene.add(normalCue, jumpCue);
const overlay = new THREE.Group();
scene.add(overlay);

// Break box highlight (everything behind the head string).
const boxMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(TABLE.hx / 2, 2 * TABLE.hy),
  new THREE.MeshBasicMaterial({ color: '#f2c14e', transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false })
);
boxMesh.rotation.x = -Math.PI / 2;
boxMesh.position.set(-TABLE.hx + TABLE.hx / 4, 0.003, 0);
const boxLine = new THREE.Mesh(new THREE.PlaneGeometry(0.004, 2 * TABLE.hy), new THREE.MeshBasicMaterial({ color: '#f2c14e', toneMapped: false }));
boxLine.rotation.x = -Math.PI / 2;
boxLine.position.set(HEAD_STRING_X, 0.0035, 0);
const boxGroup = new THREE.Group();
boxGroup.add(boxMesh, boxLine);
boxGroup.visible = false;
scene.add(boxGroup);

const callRing = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.065, 40), new THREE.MeshBasicMaterial({ color: '#6be3a0', toneMapped: false, side: THREE.DoubleSide }));
callRing.rotation.x = -Math.PI / 2;
callRing.visible = false;
scene.add(callRing);

// ---------- Layout / camera ----------
const avail = { w: 1, h: 1 }; // part of the viewport not covered by the control panel

function layout() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  const panel = $('panel');
  const pr = panel.getBoundingClientRect();
  if (w <= 760) {
    const ph = panel.classList.contains('collapsed') ? 0 : pr.height;
    const bottomOf = (id) => ($(id).hidden ? 0 : $(id).getBoundingClientRect().bottom);
    const top = Math.max(bottomOf('hud'), bottomOf('score'));
    Object.assign(avail, { w, h: h - ph - top });
    camera.setViewOffset(w, h, 0, (ph - top) / 2, w, h);
  } else {
    const cover = pr.width + 32;
    Object.assign(avail, { w: w - cover, h });
    camera.setViewOffset(w, h, cover / 2, 0, w, h);
  }
  camera.updateProjectionMatrix();
}
new ResizeObserver(() => layout()).observe($('hud'));
new ResizeObserver(() => layout()).observe($('score'));

function resize() {
  layout();
  if (state.view === 'persp' || state.view === 'top') frameView(state.view);
}

function fitDistance(halfW, halfH) {
  const t = Math.tan((camera.fov * Math.PI) / 360);
  const full = renderer.domElement.clientHeight || innerHeight;
  return Math.max(halfW / (t * (avail.w / full)), halfH / (t * (avail.h / full)));
}

function frameView(view) {
  const fit = fitDistance(TABLE.hx + 0.22, TABLE.hy + 0.2);
  camera.position.set(0, fit * (view === 'top' ? 1.02 : 0.9), view === 'top' ? 0.0001 : fit * 0.7);
  controls.target.set(0, 0, 0);
  controls.update();
}

function setView(v) {
  state.view = v;
  document.querySelectorAll('#views button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  controls.enabled = v === 'persp' || v === 'top';
  const fov = v === 'fps' ? 62 : 42;
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  if (v === 'persp' || v === 'top') frameView(v);
}

const camGoal = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
function updateFollowCamera(dt) {
  const c = state.balls[0];
  const d = new THREE.Vector3(Math.cos(state.shot.angle), 0, -Math.sin(state.shot.angle));
  if (state.view === 'cue') {
    camGoal.pos.set(c.x, 0, -c.y).addScaledVector(d, -0.62).setY(0.34);
    camGoal.look.set(c.x, 0.02, -c.y).addScaledVector(d, 0.7);
  } else {
    // First person: a standing player behind the cue ball, looking down the cue.
    camGoal.pos.set(c.x, 0, -c.y).addScaledVector(d, -state.fps.dist).setY(0.82);
    camGoal.look.set(c.x, 0, -c.y).addScaledVector(d, 0.55 - state.fps.pitch * 0.5);
  }
  const k = 1 - Math.exp(-dt * 9);
  camera.position.lerp(camGoal.pos, k);
  controls.target.lerp(camGoal.look, k);
  camera.lookAt(controls.target);
}

// ---------- Table setups ----------
function newBalls() {
  state.balls = Array.from({ length: 16 }, (_, i) => {
    const b = createBall(i, 0, 0);
    b.active = false;
    return b;
  });
}

function place(id, x, y) {
  Object.assign(state.balls[id], { x, y, z: 0, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, active: true });
}

function placeRack(kind, seed) {
  newBalls();
  for (const b of buildRack(kind, seed)) place(b.id, b.x, b.y);
  place(0, HEAD_SPOT.x, 0);
}

function setPreset(name, seed = (Math.random() * 1e9) | 0) {
  const corner = { x: TABLE.hx, y: TABLE.hy };
  state.practice = { preset: name, seed, breakBox: false };
  newBalls();
  if (name.startsWith('rack')) {
    placeRack(name.slice(4), seed);
    state.practice.breakBox = true;
    state.shot.angle = 0;
    state.shot.power = 85;
  } else if (name === 'straight') {
    place(0, -0.6, 0);
    place(1, 0.1, 0);
    state.shot.angle = 0;
  } else if (name.startsWith('cut')) {
    const target = { x: 0.55, y: -0.05 };
    const s = cutShot(target, corner, Number(name.slice(3)), 0.6);
    place(0, s.cue.x, s.cue.y);
    place(1, target.x, target.y);
    state.shot.angle = s.angle;
  } else if (name === 'empty') {
    place(0, HEAD_SPOT.x, 0);
    state.shot.angle = 0;
  }
  state.game = null;
  document.body.classList.remove('match');
  normalizeAngle();
  state.undo = null;
  afterSetup();
}

function afterSetup() {
  state.phase = 'aim';
  state.aimBall = null;
  state.aimPocket = null;
  $('shoot').disabled = false;
  $('winner').hidden = true;
  syncMeshes();
  syncUI();
  syncModeUI();
  state.dirty = true;
}

function startMatch({ kind, rack9, names }) {
  const k = Number(kind);
  state.game = createGame({ kind: k, players: names });
  state.matchRack = k === 8 ? '15' : k === 9 ? rack9 : '10';
  placeRack(state.matchRack, (Math.random() * 1e9) | 0);
  state.shot = { angle: 0, power: 85, a: 0, b: 0 };
  state.jump = false;
  state.callPocket = null;
  state.undo = null;
  state.lines = 'aim';
  document.body.classList.add('match');
  toast(state.game.message);
  afterSetup();
}

function normalizeAngle() {
  let a = state.shot.angle * DEG;
  while (a > 180) a -= 360;
  while (a < -180) a += 360;
  state.shot.angle = a / DEG;
}

function syncMeshes(dt = 0) {
  state.balls.forEach((b, i) => syncBall(meshes[i], b, dt));
}

// ---------- Prediction overlay ----------
function pathPts(path, from, to) {
  return path.filter((p) => p[2] >= from && p[2] <= to).map((p) => [p[0], p[1]]);
}

function wrapPi(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

function drawOverlay(result) {
  disposeGroup(overlay);
  callRing.visible = false;
  if (state.lines === 'off' || state.phase !== 'aim') return;
  const full = state.lines === 'full';
  const { sim, info } = result;
  const cuePath = sim.paths[0] || [];
  const tHit = info.hit ? info.t : Infinity;

  const pre = pathPts(cuePath, 0, tHit);
  if (info.hit) pre.push([info.ghost.x, info.ghost.y]);
  overlay.add(ribbon(pre, { width: 0.006, color: '#ffffff' }));

  // Jump: show the real 3D flight and the landing spot.
  const airborne = cuePath.filter((p) => p[3] > 0.001);
  if (airborne.length > 2) {
    const first = cuePath.indexOf(airborne[0]);
    const last = cuePath.indexOf(airborne[airborne.length - 1]);
    const seg = cuePath.slice(Math.max(first - 1, 0), Math.min(last + 2, cuePath.length));
    overlay.add(flightLine(seg.map((p) => [p[0], p[1], p[3]]), '#7ff0ff'));
  }
  if (info.landing && info.maxHeight > 0.004) {
    overlay.add(ribbon(arcPoints(info.landing.x, info.landing.y, R * 0.9, 0, Math.PI * 2, 32), { width: 0.004, color: '#7ff0ff', y: 0.006 }));
  }

  if (info.hit) {
    if (full) {
      const post = [[info.ghost.x, info.ghost.y], ...pathPts(cuePath, tHit + 1e-6, Infinity)];
      overlay.add(ribbon(post, { width: 0.005, color: '#6fd3ff', dash: 0.03 }));
    }
    for (const [id, path] of Object.entries(sim.paths)) {
      if (id === '0' || path.length < 3) continue;
      const isObj = Number(id) === info.object.id;
      if (!full && !isObj) continue;
      overlay.add(ribbon(path.map((p) => [p[0], p[1]]), { width: isObj ? 0.007 : 0.005, color: isObj ? '#f2c14e' : '#ff9a56', dash: isObj ? 0 : 0.03 }));
    }

    const ghost = new THREE.Mesh(
      new THREE.SphereGeometry(R, 24, 16),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.28, depthWrite: false, toneMapped: false })
    );
    ghost.position.set(info.ghost.x, R, -info.ghost.y);
    overlay.add(ghost);
    overlay.add(ribbon(arcPoints(info.ghost.x, info.ghost.y, R, 0, Math.PI * 2, 40), { width: 0.0025, color: '#ffffff', y: 0.005 }));

    // Contact point on the object ball ("má bi"): midway between the ghost and the object centre.
    if (state.show.cheek) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 14, 10), new THREE.MeshBasicMaterial({ color: '#ff4d3d', toneMapped: false, depthTest: false }));
    dot.position.set((info.ghost.x + info.object.x) / 2, R, -(info.ghost.y + info.object.y) / 2);
    dot.renderOrder = 10;
    overlay.add(dot);
    overlay.add(ribbon(arcPoints(info.object.x, info.object.y, R * 1.08, 0, Math.PI * 2, 40), { width: 0.003, color: '#ff4d3d', y: 0.005 }));
    }

    if (full) {
      const tx = -Math.sin(info.lineDir);
      const ty = Math.cos(info.lineDir);
      overlay.add(ribbon(
        [[info.ghost.x - tx * 0.35, info.ghost.y - ty * 0.35], [info.ghost.x + tx * 0.35, info.ghost.y + ty * 0.35]],
        { width: 0.0025, color: '#c9d1dc', dash: 0.02, y: 0.0035 }
      ));
    }
    const sweep = wrapPi(info.lineDir - info.inDir);
    if (state.show.deg && Math.abs(sweep) > 0.01) {
      overlay.add(ribbon(arcPoints(info.ghost.x, info.ghost.y, 0.1, info.inDir, sweep), { width: 0.004, color: '#f2c14e', y: 0.006 }));
    }
  }

  for (const e of sim.events) {
    if (e.type !== 'pocket') continue;
    if (!full && e.id !== info.object?.id) continue;
    overlay.add(ribbon(arcPoints(e.x, e.y, 0.05, 0, Math.PI * 2, 32), { width: 0.006, color: e.id === 0 ? '#ff7a7a' : '#6be3a0', y: 0.006 }));
  }
}

const _v = new THREE.Vector3();
/** Label shown next to the object ball, honouring the angle / thickness toggles. */
function cutText(info) {
  if (!info?.hit) return '';
  const parts = [];
  if (state.show.deg) parts.push(`${info.absCut.toFixed(1)}°`);
  if (state.show.cheek) parts.push(`má ${thicknessFraction(info.thickness)}${info.thickness < 0.0625 ? '' : ' bi'}`);
  return parts.join(' · ');
}

function updateCutLabel() {
  const label = $('cutLabel');
  const info = state.pending?.info;
  const text = cutText(info);
  if (!info?.hit || state.phase !== 'aim' || state.lines === 'off' || !text) {
    label.hidden = true;
    return;
  }
  const mid = info.inDir + wrapPi(info.lineDir - info.inDir) / 2;
  _v.set(info.ghost.x + 0.15 * Math.cos(mid), 0.01, -(info.ghost.y + 0.15 * Math.sin(mid))).project(camera);
  label.hidden = _v.z > 1;
  label.style.left = `${(_v.x * 0.5 + 0.5) * innerWidth}px`;
  label.style.top = `${(-_v.y * 0.5 + 0.5) * innerHeight}px`;
  label.textContent = text;
}

// ---------- Cheek (contact point) aiming ----------
function setAngle(a) {
  state.shot.angle = a;
  normalizeAngle();
  syncUI();
  state.dirty = true;
}

/** Object ball being aimed at: explicit pick, else what the current line hits, else the nearest ball. */
function cheekTarget() {
  const picked = state.aimBall != null ? state.balls[state.aimBall] : null;
  if (picked?.active && picked.id !== 0) return picked;
  const hitId = state.pending?.info?.object?.id;
  if (hitId != null) return state.balls[hitId];
  const c = state.balls[0];
  const d = (b) => Math.hypot(b.x - c.x, b.y - c.y);
  return state.balls.filter((b) => b.active && b.id !== 0).sort((u, v) => d(u) - d(v))[0] || null;
}

function applyThickness(t) {
  const target = cheekTarget();
  if (!target || state.phase !== 'aim') return;
  const a = aimForThickness(state.balls[0], target, t, state.cheekSide);
  if (a == null) { toast('Bi cái quá sát bi mục tiêu để chọn má này.'); return; }
  state.aimBall = target.id;
  state.aimPocket = null;
  setAngle(a);
}

function applyPocket(idx) {
  const target = cheekTarget();
  if (!target || state.phase !== 'aim') return;
  const ctx = { balls: state.balls, shot: { speed: powerToSpeed(state.shot.power), a: state.shot.a, b: state.shot.b, elev: state.jump ? state.elev : 0 }, tMax: state.horizon };
  const r = aimForPocket(state.balls[0], target, POCKETS[idx], ctx);
  if (!r) { toast('Từ vị trí này không thể đưa bi vào lỗ đó (phải đánh từ phía sau bi mục tiêu).'); return; }
  state.aimBall = target.id;
  state.cheekSide = Math.sign(r.cut) || state.cheekSide;
  setAngle(r.angle);
  state.aimPocket = { idx, angle: state.shot.angle };
}

/** Pointer drag around the object ball: the cursor direction picks the contact point on its rim. */
function cheekAt(p) {
  const t = cheekTarget();
  const c = state.balls[0];
  if (!t) return;
  const d = Math.hypot(p.x - t.x, p.y - t.y);
  if (d < R * 0.3) return;
  let ux = (p.x - t.x) / d;
  let uy = (p.y - t.y) / d;
  const cx = c.x - t.x;
  const cy = c.y - t.y;
  const cl = Math.hypot(cx, cy);
  if (cl < 2 * R) return;
  // The cue ball can only touch the half of the object ball that faces it.
  if (ux * cx + uy * cy < 0) {
    const s = Math.sign(-ux * cy + uy * cx) || 1;
    ux = (-s * cy) / cl;
    uy = (s * cx) / cl;
  }
  state.aimBall = t.id;
  state.aimPocket = null;
  setAngle(Math.atan2(t.y + 2 * R * uy - c.y, t.x + 2 * R * ux - c.x));
}

function syncCheekUI(info) {
  const out = $('cheekReadout');
  document.querySelectorAll('#aimPockets button').forEach((b) => b.classList.remove('on'));
  if (!info.hit) { out.textContent = 'Chưa chạm bi nào: bấm vào bi mục tiêu, rồi chọn má.'; return; }
  if (Math.abs(info.cut) > 0.3) state.cheekSide = Math.sign(info.cut);
  document.querySelectorAll('#thickSide button').forEach((b) => b.classList.toggle('on', Number(b.dataset.side) === state.cheekSide));
  const pct = Math.round(info.thickness * 100);
  const thick = $('thick');
  if (document.activeElement !== thick) thick.value = Math.max(3, pct);
  $('thickOut').textContent = `${pct}% · ${thicknessFraction(info.thickness)}`;
  const shown = [];
  if (state.show.deg) shown.push(`góc cắt <b>${info.absCut.toFixed(1)}°</b>`);
  if (state.show.cheek) shown.push(`má <b>${thicknessFraction(info.thickness)}${info.thickness < 0.0625 ? '' : ' bi'}</b> (${pct}%)`);
  let html = `Bi ${info.object.id}: ${shown.join(' = ') || 'đã ẩn góc và má'}, bi đi sang ${info.cut > 0 ? 'trái' : 'phải'}`;
  if (state.aimBall != null && state.aimBall !== info.object.id) html += `<br>⚠ Đang chọn bi ${state.aimBall} nhưng cơ chạm bi ${info.object.id} trước.`;
  const ap = state.aimPocket;
  if (ap && Math.abs(ap.angle - state.shot.angle) < 1e-9) {
    document.querySelector(`#aimPockets button[data-pocket="${ap.idx}"]`)?.classList.add('on');
    const ok = info.pocketOf[info.object.id] === ap.idx;
    html += `<br>${ok ? '✓ Bi vào ' : '✗ Chưa vào '}lỗ ${POCKET_NAMES[ap.idx]}${ok ? '' : ' (tăng lực, đổi má hoặc bị bi/đầu hàm chặn)'}`;
  }
  out.innerHTML = html;
}

// ---------- HUD ----------
const side = (deg) => (Math.abs(deg) < 0.05 ? '' : deg > 0 ? ' (trái)' : ' (phải)');

function renderHud(info) {
  syncCheekUI(info);
  $('hud').hidden = state.lines === 'off';
  const rows = [];
  if (info.hit) {
    if (state.show.deg) rows.push(['Góc cắt (cut angle)', `${info.absCut.toFixed(1)}°${side(info.cut)}`, true]);
    if (state.show.cheek) rows.push(['Má bi (thickness)', thicknessLabel(info.thickness), true]);
    rows.push(['Bi mục tiêu', `bi ${info.object.id}${info.air ? ' (bi nhảy chạm)' : ''}`]);
    rows.push(['Bi mục tiêu đi', `${(info.objExitDir * DEG).toFixed(1)}° · ${info.objExitSpeed.toFixed(2)} m/s`]);
    if (info.cueExitSpeed > 0.02) {
      rows.push(['Bi cái sau va chạm', `${(info.cueExitDir * DEG).toFixed(1)}° · ${info.cueExitSpeed.toFixed(2)} m/s`]);
      rows.push(['Góc tách', `${info.split.toFixed(1)}°`]);
    } else rows.push(['Bi cái sau va chạm', 'dừng tại chỗ (stun)']);
    if (info.cushionsBeforeHit) rows.push(['Bi cái ăn băng trước khi chạm', String(info.cushionsBeforeHit)]);
  } else rows.push(['Góc cắt', '—']);
  if (state.jump) {
    rows.push(['Độ cao tối đa', `${(info.maxHeight * 100).toFixed(1)} cm`]);
    if (info.landing) rows.push(['Hạ cánh sau', `${info.landing.t.toFixed(2)} s`]);
  }
  $('metrics').innerHTML = rows.map(([k, v, hl]) => `<dt>${k}</dt><dd${hl ? ' class="hl"' : ''}>${v}</dd>`).join('');

  const v = $('verdict');
  v.className = '';
  if (info.jumpedOff) { v.textContent = 'Bi cái bay khỏi bàn!'; v.className = 'bad'; }
  else if (info.scratch) { v.textContent = 'Bi cái rơi lỗ (scratch)'; v.className = 'bad'; }
  else if (info.pocketed.length) { v.textContent = `Bi ${info.pocketed.join(', ')} vào lỗ`; v.className = 'ok'; }
  else if (!info.hit) v.textContent = 'Bi cái không chạm bi nào trong thời gian dự đoán';
  else v.textContent = '';

  const { a, b } = state.shot;
  const tips = [];
  if (b > 0.05) tips.push('Đẩy (follow): bi cái chạy theo sau khi va chạm.');
  if (b < -0.05) tips.push('Kéo (draw): bi cái bị kéo lùi sau va chạm.');
  if (Math.abs(a) > 0.05) tips.push(`Phê ${a > 0 ? 'phải' : 'trái'}: bi cái lệch nhẹ khi rời cơ (squirt), làm bi mục tiêu lệch (throw) và đổi góc nảy khi ăn băng.`);
  if (state.jump) tips.push('Gậy nhảy: nâng cơ càng cao bi bay càng cao nhưng ngắn; cần đủ lực để vượt bi cản.');
  $('tips').textContent = tips.join(' ');
}

function syncUI() {
  const s = state.shot;
  $('angle').value = (s.angle * DEG).toFixed(2);
  $('angleOut').textContent = `${(s.angle * DEG).toFixed(2)}°`;
  $('power').value = s.power;
  $('powerOut').textContent = `${s.power}% · ${powerToSpeed(s.power).toFixed(1)} m/s`;
  $('horizonOut').textContent = `${state.horizon.toFixed(1)} s`;
  $('elevOut').textContent = `${Math.round(state.elev * DEG)}°`;
  $('jumpCue').checked = state.jump;
  $('jumpBox').hidden = !state.jump;
  const pct = (v) => Math.round(Math.abs(v / TIP_LIMIT) * 100);
  const parts = [];
  parts.push(Math.abs(s.b) < 0.01 ? 'Giữa dọc' : `${s.b > 0 ? 'Đẩy' : 'Kéo'} <b>${pct(s.b)}%</b>`);
  parts.push(Math.abs(s.a) < 0.01 ? 'Không phê' : `Phê ${s.a > 0 ? 'phải' : 'trái'} <b>${pct(s.a)}%</b>`);
  $('tipReadout').innerHTML = parts.join('<br>');
  drawTipPad();
}

function syncModeUI() {
  const match = !!state.game;
  $('practiceGroup').hidden = match;
  $('undo').hidden = match;
  $('reset').hidden = match;
  $('score').hidden = !match;
  document.querySelectorAll('#lines button').forEach((b) => b.classList.toggle('on', b.dataset.lines === state.lines));
  document.querySelectorAll('#presets button').forEach((b) => b.classList.toggle('on', !match && b.dataset.preset === state.practice.preset));
  document.querySelectorAll('#tools button').forEach((b) => b.classList.toggle('on', b.dataset.tool === state.tool));
  $('addChips').hidden = state.tool !== 'add';
  refreshMatchUI();
  layout();
}

// ---------- Match UI ----------
const dot = (id) => `<span class="dot" style="background:${BALL_COLORS[id]};${id >= 9 ? 'box-shadow: inset 0 0 0 3px #f3f0e6;' : ''}${[2, 3, 4, 7, 8].includes(id) ? 'color:#fff' : ''}">${id}</span>`;
const GROUP_LABEL = { solid: 'Trơn (1-7)', stripe: 'Sọc (9-15)' };

function refreshMatchUI() {
  const g = state.game;
  $('callGroup').hidden = !(g && g.needsCall() && state.phase === 'aim');
  $('pushGroup').hidden = !(g && g.canPushOut() && state.phase === 'aim');
  if (!g) return;
  g.players.forEach((p, i) => {
    const el = $(`pl${i}`);
    el.classList.toggle('turn', g.current === i);
    el.querySelector('.nm').textContent = p.name;
    el.querySelector('.grp').textContent = g.kind === 8 ? (p.group ? GROUP_LABEL[p.group] : 'Bàn mở') : KINDS[g.kind];
    el.querySelector('.pots').innerHTML = p.pocketed.map(dot).join('');
    el.querySelector('.foul').textContent = g.kind !== 8 && p.fouls ? `Lỗi liên tiếp: ${p.fouls}/3` : '';
  });
  const legal = g.legalFirst();
  const grp = g.players[g.current].group;
  const want = g.kind === 8
    ? (legal.length === 1 && legal[0] === 8 ? 'bi 8' : grp ? GROUP_LABEL[grp] : 'bất kỳ bi trơn/sọc (không phải 8)')
    : `bi ${legal[0]}`;
  const bih = g.ballInHand ? (g.breakBox ? ' · Kéo bi cái vào break box' : ' · Cầm bi: kéo bi cái đặt tự do') : '';
  $('scoreMsg').textContent = `${g.message}  Mục tiêu: ${want}.${bih}`;
}

function updateCallUI() {
  const g = state.game;
  if (!g || !g.needsCall()) { callRing.visible = false; return; }
  const info = state.pending?.info;
  const ball = g.kind === 8 ? 8 : info?.object?.id;
  const auto = ball != null ? info?.pocketOf?.[ball] : undefined;
  const pocket = state.callPocket ?? auto;
  document.querySelectorAll('#pocketBtns button').forEach((b) => b.classList.toggle('on', Number(b.dataset.pocket) === pocket));
  $('callInfo').textContent = pocket != null && ball != null ? `bi ${ball} → ${POCKET_NAMES[pocket]}` : '(chọn lỗ)';
  if (pocket != null) {
    const p = POCKETS[pocket];
    callRing.position.set(p.x, 0.006, -p.y);
    callRing.visible = state.phase === 'aim';
  } else callRing.visible = false;
}

let toastTimer = 0;
function toast(msg, ms = 3800) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function ask(title, text, a, b) {
  return new Promise((resolve) => {
    const d = $('choice');
    $('choiceTitle').textContent = title;
    $('choiceText').textContent = text;
    $('choiceA').textContent = a;
    $('choiceB').textContent = b;
    d.addEventListener('close', () => resolve(d.returnValue === 'a'), { once: true });
    d.returnValue = '';
    d.showModal();
  });
}

// ---------- Tip pad ----------
const pad = $('tipPad');
const padCtx = pad.getContext('2d');
function drawTipPad() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const size = pad.clientWidth || 130;
  if (pad.width !== Math.round(size * dpr)) pad.width = pad.height = Math.round(size * dpr);
  const g = padCtx;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, size, size);
  const c = size / 2;
  const r = c - 2;
  const grad = g.createRadialGradient(c - r * 0.3, c - r * 0.35, r * 0.1, c, c, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#c9ccd2');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(c, c, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,.25)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(c, 4); g.lineTo(c, size - 4); g.moveTo(4, c); g.lineTo(size - 4, c);
  g.stroke();
  g.setLineDash([4, 3]);
  g.strokeStyle = 'rgba(200,40,40,.7)';
  g.beginPath();
  g.arc(c, c, r * TIP_LIMIT, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = 'rgba(0,0,0,.55)';
  g.font = '600 10px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('ĐẨY', c, 14);
  g.fillText('KÉO', c, size - 6);
  g.fillText('TRÁI', 16, c + 3);
  g.fillText('PHẢI', size - 16, c + 3);
  g.fillStyle = '#2f6fe0';
  g.strokeStyle = '#fff';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(c + state.shot.a * r, c - state.shot.b * r, r * 0.14, 0, Math.PI * 2);
  g.fill();
  g.stroke();
}

function setTipFromPointer(e) {
  const rect = pad.getBoundingClientRect();
  const r = rect.width / 2 - 2;
  let a = (e.clientX - rect.left - rect.width / 2) / r;
  let b = -(e.clientY - rect.top - rect.height / 2) / r;
  const m = Math.hypot(a, b);
  if (m > TIP_LIMIT) { a *= TIP_LIMIT / m; b *= TIP_LIMIT / m; }
  setTip(a, b);
}

function setTip(a, b) {
  state.shot.a = Math.abs(a) < 0.015 ? 0 : a;
  state.shot.b = Math.abs(b) < 0.015 ? 0 : b;
  syncUI();
  state.dirty = true;
}

let padDrag = false;
pad.addEventListener('pointerdown', (e) => { padDrag = true; pad.setPointerCapture(e.pointerId); setTipFromPointer(e); });
pad.addEventListener('pointermove', (e) => padDrag && setTipFromPointer(e));
pad.addEventListener('pointerup', () => (padDrag = false));
pad.addEventListener('pointercancel', () => (padDrag = false));

// ---------- Table pointer interaction ----------
const ray = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -R);
const ndc = new THREE.Vector2();
const hit = new THREE.Vector3();
const pointers = new Set();
let drag = null;

function tablePoint(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.ray.intersectPlane(plane, hit) ? { x: hit.x, y: -hit.z } : null;
}

function aimAt(p) {
  const c = state.balls[0];
  if (Math.hypot(p.x - c.x, p.y - c.y) < R * 0.5) return;
  state.shot.angle = Math.atan2(p.y - c.y, p.x - c.x);
  state.aimPocket = null;
  syncUI();
  state.dirty = true;
}

/** Where may the cue ball be dropped right now? */
function cueZone() {
  const g = state.game;
  const inBox = g ? g.ballInHand && g.breakBox : state.practice.breakBox;
  return { xmin: -TABLE.hx + R, xmax: inBox ? HEAD_STRING_X : TABLE.hx - R };
}

function canPlace(id, x, y) {
  let xmin = -TABLE.hx + R;
  let xmax = TABLE.hx - R;
  if (id === 0) ({ xmin, xmax } = cueZone());
  if (x < xmin || x > xmax || Math.abs(y) > TABLE.hy - R) return false;
  return state.balls.every((b) => b.id === id || !b.active || Math.hypot(b.x - x, b.y - y) >= 2 * R);
}

function nearestBall(p, maxD = R * 1.8, includeCue = true) {
  return state.balls
    .filter((b) => b.active && (includeCue || b.id !== 0) && Math.hypot(b.x - p.x, b.y - p.y) < maxD)
    .sort((u, v) => Math.hypot(u.x - p.x, u.y - p.y) - Math.hypot(v.x - p.x, v.y - p.y))[0];
}

function renderAddChips() {
  $('addChips').innerHTML = Array.from({ length: 15 }, (_, i) => i + 1)
    .map((i) => `<button data-add="${i}" class="${i === state.addId ? 'on' : ''}" ${state.balls[i]?.active ? 'disabled' : ''}>${i}</button>`)
    .join('');
}

function addBallAt(p) {
  const id = state.addId;
  if (state.balls[id].active) { toast(`Bi ${id} đã có trên bàn`); return; }
  if (!canPlace(id, p.x, p.y)) { toast('Vị trí bị chồng bi hoặc ngoài bàn'); return; }
  place(id, p.x, p.y);
  syncMeshes();
  state.dirty = true;
  const next = Array.from({ length: 15 }, (_, i) => i + 1).find((i) => !state.balls[i].active);
  if (next) state.addId = next;
  renderAddChips();
}

const el = renderer.domElement;
el.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || state.phase !== 'aim') return;
  pointers.add(e.pointerId);
  if (pointers.size > 1) { drag = null; return; }
  el.setPointerCapture(e.pointerId);
  const p = tablePoint(e);
  const g = state.game;
  const followView = state.view === 'cue' || state.view === 'fps';

  if (g && g.ballInHand && p && nearestBall(p, R * 2.2) === state.balls[0]) { drag = { kind: 'ball', id: 0 }; return; }
  if (!g && p && state.tool === 'move') {
    const near = nearestBall(p);
    drag = near ? { kind: 'ball', id: near.id } : null;
    return;
  }
  if (!g && p && state.tool === 'add') { addBallAt(p); return; }
  if (!g && p && state.tool === 'remove') {
    const near = nearestBall(p, R * 1.8, false);
    if (near) { near.active = false; syncMeshes(); state.dirty = true; renderAddChips(); }
    return;
  }
  if (state.cheek && p && (g || state.tool === 'aim')) {
    const near = nearestBall(p, R * 1.6, false);
    if (near) state.aimBall = near.id;
    if (cheekTarget()) { drag = { kind: 'cheek' }; cheekAt(p); return; }
  }
  if (followView) drag = { kind: 'turn', x: e.clientX, y: e.clientY };
  else if (p) { drag = { kind: 'aim' }; aimAt(p); }
});

el.addEventListener('pointermove', (e) => {
  if (!drag || state.phase !== 'aim') return;
  if (drag.kind === 'turn') {
    state.shot.angle -= (e.clientX - drag.x) * 0.0015;
    state.fps.pitch = Math.max(-1, Math.min(1, state.fps.pitch + (e.clientY - drag.y) * 0.003));
    drag.x = e.clientX;
    drag.y = e.clientY;
    normalizeAngle();
    syncUI();
    state.dirty = true;
    return;
  }
  const p = tablePoint(e);
  if (!p) return;
  if (drag.kind === 'aim') aimAt(p);
  else if (drag.kind === 'cheek') cheekAt(p);
  else if (drag.kind === 'ball' && canPlace(drag.id, p.x, p.y)) {
    Object.assign(state.balls[drag.id], { x: p.x, y: p.y });
    syncMeshes();
    state.undo = null;
    state.dirty = true;
  }
});

const endPointer = (e) => { pointers.delete(e.pointerId); drag = null; };
el.addEventListener('pointerup', endPointer);
el.addEventListener('pointercancel', endPointer);

// ---------- Controls wiring ----------
$('angle').addEventListener('input', (e) => { state.shot.angle = Number(e.target.value) / DEG; syncUI(); state.dirty = true; });
const nudge = (deg) => { state.shot.angle += deg / DEG; normalizeAngle(); syncUI(); state.dirty = true; };
$('angleMinus').addEventListener('click', () => nudge(-0.1));
$('anglePlus').addEventListener('click', () => nudge(0.1));
$('power').addEventListener('input', (e) => { state.shot.power = Number(e.target.value); syncUI(); state.dirty = true; });
$('horizon').addEventListener('input', (e) => { state.horizon = Number(e.target.value); syncUI(); state.dirty = true; });
$('elev').addEventListener('input', (e) => { state.elev = Number(e.target.value) / DEG; syncUI(); state.dirty = true; });
$('jumpCue').addEventListener('change', (e) => { state.jump = e.target.checked; syncUI(); state.dirty = true; });
$('slowmo').addEventListener('change', (e) => (state.slowmo = e.target.checked));
$('tipPresets').addEventListener('click', (e) => {
  const t = e.target.closest('button')?.dataset.tip;
  if (t) { const [a, b] = t.split(',').map(Number); setTip(a, b); }
});
$('views').addEventListener('click', (e) => { const v = e.target.closest('button')?.dataset.view; if (v) setView(v); });
$('lines').addEventListener('click', (e) => { const l = e.target.closest('button')?.dataset.lines; if (l) setLines(l); });
$('tools').addEventListener('click', (e) => {
  const t = e.target.closest('button')?.dataset.tool;
  if (!t) return;
  state.tool = t;
  if (t === 'add') {
    state.addId = Array.from({ length: 15 }, (_, i) => i + 1).find((i) => !state.balls[i].active) || 1;
    renderAddChips();
  }
  syncModeUI();
});
$('addChips').addEventListener('click', (e) => {
  const id = Number(e.target.closest('button')?.dataset.add);
  if (id) { state.addId = id; renderAddChips(); }
});
$('presets').addEventListener('click', (e) => { const p = e.target.closest('button')?.dataset.preset; if (p && state.phase === 'aim') setPreset(p); });
$('pocketBtns').addEventListener('click', (e) => {
  const p = e.target.closest('button')?.dataset.pocket;
  if (p === undefined) return;
  state.callPocket = Number(p);
  updateCallUI();
});
const setCheek = (on) => { state.cheek = on; $('cheekMode').checked = on; renderer.domElement.style.cursor = on ? 'crosshair' : ''; };
$('cheekMode').addEventListener('change', (e) => setCheek(e.target.checked));
const setShow = (key, on) => {
  state.show[key] = on;
  $(key === 'deg' ? 'showDeg' : 'showCheek').checked = on;
  state.dirty = true;
};
$('showDeg').addEventListener('change', (e) => setShow('deg', e.target.checked));
$('showCheek').addEventListener('change', (e) => setShow('cheek', e.target.checked));
$('thickChips').addEventListener('click', (e) => { const t = e.target.closest('button')?.dataset.t; if (t) applyThickness(Number(t)); });
$('thick').addEventListener('input', (e) => applyThickness(Number(e.target.value) / 100));
$('thickSide').addEventListener('click', (e) => {
  const sd = e.target.closest('button')?.dataset.side;
  if (!sd) return;
  state.cheekSide = Number(sd);
  applyThickness(state.pending?.info?.hit ? state.pending.info.thickness : Number($('thick').value) / 100);
});
$('aimPockets').addEventListener('click', (e) => { const p = e.target.closest('button')?.dataset.pocket; if (p !== undefined) applyPocket(Number(p)); });
$('shoot').addEventListener('click', shoot);
$('undo').addEventListener('click', undoShot);
$('reset').addEventListener('click', () => state.phase === 'aim' && setPreset(state.practice.preset, state.practice.seed));
$('menuBtn').addEventListener('click', () => $('menu').showModal());
$('winnerBtn').addEventListener('click', () => { $('winner').hidden = true; $('menu').showModal(); });
$('panelToggle').addEventListener('click', () => {
  const p = $('panel');
  const collapsed = p.classList.toggle('collapsed');
  $('panelToggle').setAttribute('aria-expanded', String(!collapsed));
  layout();
  if (state.view === 'persp' || state.view === 'top') frameView(state.view);
});

function setLines(l) {
  state.lines = l;
  document.querySelectorAll('#lines button').forEach((b) => b.classList.toggle('on', b.dataset.lines === l));
  state.dirty = true;
  $('hud').hidden = l === 'off';
}

const keys = new Set();
addEventListener('keydown', (e) => {
  if (document.querySelector('dialog[open]') || e.target.matches('input[type="text"], textarea')) return;
  if (e.code === 'Space') { e.preventDefault(); shoot(); }
  else if (e.code === 'ArrowLeft') { nudge(e.shiftKey ? 1 : 0.1); e.preventDefault(); }
  else if (e.code === 'ArrowRight') { nudge(e.shiftKey ? -1 : -0.1); e.preventDefault(); }
  else if (e.code === 'KeyT') setCheek(!state.cheek);
  else if (e.code === 'KeyG') setShow('deg', !state.show.deg);
  else if (e.code === 'KeyM') setShow('cheek', !state.show.cheek);
  else if (e.code === 'KeyL') setLines({ off: 'aim', aim: 'full', full: 'off' }[state.lines]);
  else if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) setView(['persp', 'top', 'cue', 'fps'][Number(e.code.slice(5)) - 1]);
  else keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));

// Menu
const menuForm = $('menuForm');
function syncMenu() {
  const f = new FormData(menuForm);
  const match = f.get('mode') === 'match';
  $('ruleSet').hidden = !match;
  $('names').hidden = !match;
  $('rack9').hidden = !(match && f.get('kind') === '9');
}
menuForm.addEventListener('change', syncMenu);
$('menu').addEventListener('close', () => {
  if ($('menu').returnValue !== 'start') return;
  const f = new FormData(menuForm);
  if (f.get('mode') === 'match') {
    startMatch({ kind: f.get('kind'), rack9: f.get('rack9'), names: [f.get('p0') || 'Người chơi 1', f.get('p1') || 'Người chơi 2'] });
  } else setPreset(state.practice.preset === 'empty' ? 'cut30' : state.practice.preset, state.practice.seed);
});

// ---------- Shot lifecycle ----------
function shoot() {
  if (state.phase !== 'aim') return;
  const g = state.game;
  const c = state.balls[0];
  if (g && g.winner !== null) return;
  if (!c.active) return;
  if (g && g.ballInHand && g.breakBox && c.x > HEAD_STRING_X + 1e-6) { toast('Bi cái phải nằm trong break box'); return; }

  let call = null;
  if (g?.needsCall()) {
    const info = state.pending?.info;
    const ball = g.kind === 8 ? 8 : info?.object?.id;
    const pocket = state.callPocket ?? (ball != null ? info?.pocketOf?.[ball] : undefined);
    if (ball == null || pocket == null) { toast('Hãy chọn lỗ để gọi trước khi đánh'); return; }
    call = { ball, pocket };
  }
  const pushOut = !!(g && $('pushOut').checked && g.canPushOut());

  if (!g) state.undo = { balls: cloneBalls(state.balls), shot: { ...state.shot } };
  state.shotCtx = { call, pushOut };
  state.phase = 'pull';
  state.phaseT = 0;
  $('shoot').disabled = true;
  disposeGroup(overlay);
  callRing.visible = false;
  $('cutLabel').hidden = true;
  $('callGroup').hidden = true;
  $('pushGroup').hidden = true;
}

function undoShot() {
  if (state.phase !== 'aim' || !state.undo || state.game) return;
  state.balls = cloneBalls(state.undo.balls);
  state.shot = { ...state.undo.shot };
  state.undo = null;
  syncMeshes();
  syncUI();
  state.dirty = true;
}

function buildReport(events) {
  const first = events.find((e) => e.type === 'ball' && (e.a === 0 || e.b === 0));
  const tFirst = first ? first.t : Infinity;
  const railBalls = new Set();
  for (const e of events) if (e.type === 'cushion' && e.id !== 0) railBalls.add(e.id);
  const ctx = state.shotCtx || {};
  return {
    firstContact: first ? (first.a === 0 ? first.b : first.a) : null,
    pocketed: events.filter((e) => e.type === 'pocket' && e.id !== 0).map((e) => ({ id: e.id, pocket: e.pocket })),
    scratch: events.some((e) => e.type === 'pocket' && e.id === 0),
    off: events.filter((e) => e.type === 'off').map((e) => e.id),
    railAfterContact: events.some((e) => e.type === 'cushion' && e.t >= tFirst),
    railCount: railBalls.size,
    call: ctx.call || null,
    pushOut: !!ctx.pushOut,
  };
}

function respot(ids) {
  for (const id of ids) {
    const p = spotPosition(state.balls.filter((b) => b.active && b.id !== id));
    place(id, p.x, p.y);
  }
}

function placeCueAfterFoul(res) {
  const c = state.balls[0];
  place(0, res.breakBox ? HEAD_SPOT.x : -TABLE.hx / 2, 0);
  let x = c.x;
  while (!canPlace(0, x, 0) && x > -TABLE.hx + R) x -= 2 * R;
  c.x = x;
}

async function finishShot() {
  const g = state.game;
  state.practice.breakBox = false;
  if (!g) {
    if (!state.balls[0].active) place(0, HEAD_SPOT.x, 0);
    resumeAim();
    return;
  }

  state.phase = 'modal';
  const res = g.endShot(buildReport(state.events));
  if (res.respot?.length) respot(res.respot);
  if (!state.balls[0].active) placeCueAfterFoul(res);
  state.callPocket = null;
  $('pushOut').checked = false;
  syncMeshes();
  toast(res.message);

  if (g.winner !== null) {
    $('winnerText').textContent = `${g.players[g.winner].name} thắng!`;
    $('winner').hidden = false;
    refreshMatchUI();
    return;
  }
  if (res.rerackOffer) {
    const accept = await ask('Phá bi không hợp lệ', `${g.players[g.current].name} chọn:`, 'Chơi tiếp thế bi này', 'Xếp lại, người phá đánh lại');
    if (g.resolveRerack(accept).rerack) placeRack(state.matchRack, (Math.random() * 1e9) | 0);
  } else if (res.pushOutDone) {
    const take = await ask('Push-out', `${g.players[g.current].name}: chơi từ thế bi hiện tại hay trả lượt?`, 'Tôi đánh', 'Trả lượt cho đối thủ');
    g.resolvePushout(take);
  }
  resumeAim();
}

function resumeAim() {
  state.phase = 'aim';
  $('shoot').disabled = false;
  syncMeshes();
  refreshMatchUI();
  state.dirty = true;
}

const SIM_DT = 1 / 480;
let acc = 0;
function runSimulation(dt) {
  acc += dt * (state.slowmo ? 0.25 : 1);
  let steps = 0;
  while (acc >= SIM_DT && steps < 80) {
    stepWorld(state.balls, SIM_DT, state.events, state.simT);
    state.simT += SIM_DT;
    acc -= SIM_DT;
    steps++;
  }
  if (steps) syncMeshes(steps * SIM_DT);
  if (!isMoving(state.balls)) finishShot();
}

// ---------- Cue pose ----------
const _back = new THREE.Vector3();
const _up = new THREE.Vector3();
const _right = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1);
function poseCue(pull) {
  const c = state.balls[0];
  const { angle, a, b } = state.shot;
  const e = state.jump ? state.elev : 0;
  const cue = state.jump ? jumpCue : normalCue;
  normalCue.visible = !state.jump && c.active;
  jumpCue.visible = state.jump && c.active;
  const cx = Math.cos(angle);
  const sy = Math.sin(angle);
  _back.set(-cx * Math.cos(e), Math.sin(e), sy * Math.cos(e)); // tip -> butt
  _up.set(cx * Math.sin(e), Math.cos(e), -sy * Math.sin(e));
  _right.set(sy, 0, cx);
  const depth = Math.sqrt(Math.max(R * R - (a * R) ** 2 - (b * R) ** 2, 0));
  cue.position
    .set(c.x, R + c.z, -c.y)
    .addScaledVector(_back, depth + 0.025 + pull)
    .addScaledVector(_right, a * R)
    .addScaledVector(_up, b * R);
  cue.quaternion.setFromUnitVectors(_z, _back);
}

// ---------- Main loop ----------
const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (state.phase === 'aim' || state.phase === 'modal') {
    if (state.dirty && state.phase === 'aim') {
      const s = state.shot;
      state.pending = predict(
        state.balls,
        { angle: s.angle, speed: powerToSpeed(s.power), a: s.a, b: s.b, elev: state.jump ? state.elev : 0 },
        state.horizon
      );
      drawOverlay(state.pending);
      renderHud(state.pending.info);
      updateCallUI();
      state.dirty = false;
    }
    poseCue(0);
    if (state.phase === 'modal') normalCue.visible = jumpCue.visible = false;
  } else if (state.phase === 'pull') {
    state.phaseT += dt;
    const k = Math.min(state.phaseT / 0.4, 1);
    poseCue(0.02 + 0.13 * (1 - Math.pow(1 - k, 2)) * (0.3 + (0.7 * state.shot.power) / 100));
    if (k >= 1) { state.phase = 'thrust'; state.phaseT = 0; }
  } else if (state.phase === 'thrust') {
    state.phaseT += dt;
    const k = Math.min(state.phaseT / 0.09, 1);
    poseCue((0.15 * (0.3 + (0.7 * state.shot.power) / 100) + 0.02) * (1 - k * k));
    if (k >= 1) {
      const s = state.shot;
      strike(state.balls[0], s.angle, powerToSpeed(s.power), s.a, s.b, state.jump ? state.elev : 0);
      acc = 0;
      state.events = [];
      state.simT = 0;
      state.phase = 'run';
      normalCue.visible = jumpCue.visible = false;
    }
  } else if (state.phase === 'run') {
    runSimulation(dt);
  }

  if (state.view === 'cue' || state.view === 'fps') {
    if (keys.has('KeyA')) { state.shot.angle += dt * 0.35; state.dirty = true; syncUI(); }
    if (keys.has('KeyD')) { state.shot.angle -= dt * 0.35; state.dirty = true; syncUI(); }
    if (keys.has('KeyW')) state.fps.dist = Math.max(0.55, state.fps.dist - dt * 0.7);
    if (keys.has('KeyS')) state.fps.dist = Math.min(1.9, state.fps.dist + dt * 0.7);
    normalizeAngle();
    updateFollowCamera(dt);
  } else controls.update();

  const g = state.game;
  boxGroup.visible = state.phase === 'aim' && (g ? g.ballInHand && g.breakBox : state.practice.breakBox);
  // The pendant lamp hangs between a high camera and the table: hide it then.
  const lampVisible = camera.position.y < room.lampY - 0.1;
  for (const m of room.lampParts) m.visible = lampVisible;
  updateCutLabel();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

addEventListener('resize', () => { resize(); drawTipPad(); });
if (innerWidth <= 760) $('panel').classList.add('collapsed');
setPreset('cut30', 1);
resize();
setView('persp');
syncMenu();
requestAnimationFrame(tick);
if (!new URLSearchParams(location.search).has('nomenu')) $('menu').showModal();

// Test / debugging hook.
window.__billiards = { setShow, applyThickness, applyPocket, cheekAt, setCheek, state, setPreset, startMatch, shoot, setTip, setView, setLines, camera, controls, POCKETS, RACK_KINDS, groupOf };
