// Scenario: a table position, a starting shot and an optional lesson goal, as plain JSON.
// No DOM here: the same code validates share links in the browser and lesson files in the tests.
import { R, TABLE } from './physics.js';

export const SCENARIO_VERSION = 1;
export const TIP_LIMIT = 0.5; // max cue-tip offset, in ball radii (beyond this = miss-cue)
export const MAX_ENCODED = 4096; // longest accepted ?s= payload
export const LESSON_ID = /^[a-z0-9-]{1,64}$/;

const DEG = 180 / Math.PI;
const TITLE_MAX = 80;
const PROMPT_MAX = 400;
const POS_EPS = 1e-4; // tolerates the rounding of shared positions (racked balls touch exactly)
const LINES = ['off', 'aim', 'full'];
const VIEWS = ['persp', 'top', 'cue', 'fps', 'cheek'];

/** Cue-ball launch speed (m/s) for a power setting of 1-100. */
export const shotSpeed = (power, jump = false) => (jump ? 0.4 + (power / 100) * 5.1 : 0.4 + (power / 100) * 6.6);

const fail = (msg) => { throw new Error(msg); };
const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round = (v, digits) => Number(v.toFixed(digits));
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isId = (v, lo) => Number.isInteger(v) && v >= lo && v <= 15;

// Out-of-range numbers are clamped rather than rejected: a shot is a UI setting, not a table fact.
function normalizeShot(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  let angle = num(s.angle, 0) % 360;
  if (angle > 180) angle -= 360;
  if (angle <= -180) angle += 360;
  let a = num(s.a, 0);
  let b = num(s.b, 0);
  const m = Math.hypot(a, b);
  if (m > TIP_LIMIT) { a *= TIP_LIMIT / m; b *= TIP_LIMIT / m; }
  const elev = num(s.elev, 0);
  return {
    angle: round(angle, 3),
    power: Math.round(clamp(num(s.power, 35), 1, 100)),
    a: round(a, 3),
    b: round(b, 3),
    elev: elev > 0 ? Math.round(clamp(elev, 10, 60)) : 0,
  };
}

function normalizeBalls(raw) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 16) fail('Thế bi phải có từ 1 đến 16 bi');
  const balls = raw.map((b) => {
    if (!b || !isId(b.id, 0)) fail('Số bi không hợp lệ (phải từ 0 đến 15)');
    if (typeof b.x !== 'number' || typeof b.y !== 'number' || !Number.isFinite(b.x) || !Number.isFinite(b.y)) fail(`Bi ${b.id}: tọa độ không hợp lệ`);
    if (Math.abs(b.x) > TABLE.hx - R + POS_EPS || Math.abs(b.y) > TABLE.hy - R + POS_EPS) fail(`Bi ${b.id} nằm ngoài bàn`);
    return { id: b.id, x: round(b.x, 5), y: round(b.y, 5) };
  });
  if (new Set(balls.map((b) => b.id)).size !== balls.length) fail('Có bi bị trùng số');
  if (!balls.some((b) => b.id === 0)) fail('Thế bi thiếu bi cái');
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      if (Math.hypot(balls[i].x - balls[j].x, balls[i].y - balls[j].y) < 2 * R - POS_EPS) fail(`Bi ${balls[i].id} và bi ${balls[j].id} chồng lên nhau`);
    }
  }
  return balls.sort((u, v) => u.id - v.id);
}

function normalizeGoal(raw, balls) {
  if (raw == null) return null;
  if (typeof raw !== 'object') fail('Mục tiêu không hợp lệ');
  const onTable = (id) => balls.some((b) => b.id === id);
  const goal = { noScratch: raw.noScratch !== false };

  if (raw.pot != null) {
    if (!Array.isArray(raw.pot) || raw.pot.length > 15) fail('Mục tiêu "pot" không hợp lệ');
    goal.pot = raw.pot.map((p) => {
      if (!p || !isId(p.ball, 1) || !onTable(p.ball)) fail('Mục tiêu nhắc tới bi không có trên bàn');
      if (p.pocket == null) return { ball: p.ball };
      if (!Number.isInteger(p.pocket) || p.pocket < 0 || p.pocket > 5) fail('Số lỗ không hợp lệ (phải từ 0 đến 5)');
      return { ball: p.ball, pocket: p.pocket };
    });
    if (!goal.pot.length) delete goal.pot;
  }
  if (raw.firstContact != null) {
    if (!isId(raw.firstContact, 1) || !onTable(raw.firstContact)) fail('Mục tiêu nhắc tới bi không có trên bàn');
    goal.firstContact = raw.firstContact;
  }
  if (raw.cueZone != null) {
    const z = raw.cueZone;
    if (typeof z !== 'object' || [z.x, z.y, z.r].some((v) => typeof v !== 'number' || !Number.isFinite(v))) fail('Vùng mục tiêu không hợp lệ');
    if (Math.abs(z.x) > TABLE.hx || Math.abs(z.y) > TABLE.hy) fail('Vùng mục tiêu nằm ngoài bàn');
    goal.cueZone = { x: round(z.x, 4), y: round(z.y, 4), r: round(clamp(z.r, R, 1), 4) };
  }
  if (!goal.pot && goal.firstContact == null && !goal.cueZone) fail('Mục tiêu trống');
  return goal;
}

/** Check and normalise untrusted scenario data. Throws an Error with a user-facing message. */
export function validateScenario(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('Dữ liệu thế bi không hợp lệ');
  if (raw.v !== SCENARIO_VERSION) fail('Phiên bản thế bi không được hỗ trợ');
  const balls = normalizeBalls(raw.balls);
  return {
    v: SCENARIO_VERSION,
    id: typeof raw.id === 'string' && LESSON_ID.test(raw.id) ? raw.id : null,
    title: text(raw.title, TITLE_MAX),
    prompt: text(raw.prompt, PROMPT_MAX),
    balls,
    shot: normalizeShot(raw.shot),
    demo: raw.demo == null ? null : normalizeShot(raw.demo),
    goal: normalizeGoal(raw.goal, balls),
    lines: LINES.includes(raw.lines) ? raw.lines : 'aim',
    view: VIEWS.includes(raw.view) ? raw.view : 'persp',
  };
}

/** Scenario of the live table. `shot` uses the app's units (angle and elev in radians). */
export function scenarioFromState(balls, shot, jump, elev) {
  return validateScenario({
    v: SCENARIO_VERSION,
    balls: balls.filter((b) => b.active).map((b) => ({ id: b.id, x: b.x, y: b.y })),
    shot: { angle: shot.angle * DEG, power: shot.power, a: shot.a, b: shot.b, elev: jump ? elev * DEG : 0 },
  });
}

/** App-side shot settings (radians) from a scenario shot (degrees). */
export function shotToState(s) {
  return { shot: { angle: s.angle / DEG, power: s.power, a: s.a, b: s.b }, jump: s.elev > 0, elev: s.elev > 0 ? s.elev / DEG : null };
}

/** base64url of the compact JSON, for the ?s= share link. */
export function encodeScenario(sc) {
  const compact = Object.fromEntries(Object.entries(sc).filter(([, v]) => v !== null && v !== ''));
  const bytes = new TextEncoder().encode(JSON.stringify(compact));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeScenario(str) {
  if (typeof str !== 'string' || !str) fail('Link thế bi không hợp lệ');
  if (str.length > MAX_ENCODED) fail('Link thế bi quá dài');
  if (!/^[A-Za-z0-9_-]+$/.test(str)) fail('Link thế bi không hợp lệ');
  let raw;
  try {
    const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  } catch {
    fail('Link thế bi không hợp lệ');
  }
  return validateScenario(raw);
}
