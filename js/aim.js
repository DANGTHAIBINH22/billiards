// Prediction layer: runs the real engine on a copy of the table and extracts
// the numbers a player cares about (cut angle, thickness, exit lines, result).
import { R, TABLE, KNUCKLES, cloneBalls, strike, simulate } from './physics.js';

const DEG = 180 / Math.PI;

export function predict(balls, shot, tMax) {
  const work = cloneBalls(balls);
  const cue = work[0];
  strike(cue, shot.angle, shot.speed, shot.a, shot.b, shot.elev || 0);
  const sim = simulate(work, { tMax });
  return { sim, info: analyze(sim, shot) };
}

// Signed difference of two angles in (-180, 180] degrees.
function angDiff(a, b) {
  let d = (a - b) * DEG;
  while (d > 180) d -= 360;
  while (d <= -180) d += 360;
  return d;
}

function analyze(sim, shot) {
  const info = { hit: false, pocketed: [], scratch: false, cushionsBeforeHit: 0, pocketOf: {} };
  const cuePath = sim.paths[0] || [];
  info.maxHeight = cuePath.reduce((m, p) => Math.max(m, p[3] || 0), 0);
  const land = sim.events.find((e) => e.type === 'land' && e.id === 0);
  info.landing = land ? { x: land.x, y: land.y, t: land.t } : null;
  info.jumpedOff = sim.events.some((e) => e.type === 'off' && e.id === 0);
  let cushions = 0;

  for (const e of sim.events) {
    if (e.type === 'pocket') {
      info.pocketOf[e.id] = e.pocket;
      if (e.id === 0) info.scratch = true;
      else info.pocketed.push(e.id);
    }
    if (e.type === 'cushion' && e.id === 0 && !info.hit) cushions++;
    if (e.type === 'ball' && !info.hit && (e.a === 0 || e.b === 0)) {
      const cueIsA = e.a === 0;
      const c = cueIsA
        ? { x: e.ax, y: e.ay, vb: [e.before.ax, e.before.ay], va: [e.after.ax, e.after.ay] }
        : { x: e.bx, y: e.by, vb: [e.before.bx, e.before.by], va: [e.after.bx, e.after.by] };
      const o = cueIsA
        ? { id: e.b, x: e.bx, y: e.by, vb: [e.before.bx, e.before.by], va: [e.after.bx, e.after.by] }
        : { id: e.a, x: e.ax, y: e.ay, vb: [e.before.ax, e.before.ay], va: [e.after.ax, e.after.ay] };

      const inDir = Math.atan2(c.vb[1], c.vb[0]);
      // The engine detects contact a step late (balls already overlap), so rebuild the true contact from the
      // straight incoming path: lateral offset L of the object centre gives sin(cut) = L / 2R exactly.
      // The event position is already pushed apart along the line of centres, so take a sample from just before it.
      const before = cuePath.filter((q) => q[2] < e.t - 1e-9).pop();
      const p0 = before ? { x: before[0], y: before[1] } : c;
      // First contact: the object ball is still at its starting spot (the push-apart nudged its recorded position).
      const start = sim.paths[o.id]?.[0];
      const oPos = start ? { x: start[0], y: start[1] } : o;
      const ox = oPos.x - p0.x;
      const oy = oPos.y - p0.y;
      const lateral = Math.cos(inDir) * oy - Math.sin(inDir) * ox; // + = object centre left of the path
      const along = Math.cos(inDir) * ox + Math.sin(inDir) * oy;
      const sin0 = Math.max(-1, Math.min(1, lateral / (2 * R)));
      const back = along - Math.sqrt(Math.max(0, 4 * R * R - lateral * lateral));
      const ghost = { x: p0.x + Math.cos(inDir) * back, y: p0.y + Math.sin(inDir) * back };
      const lineDir = Math.atan2(oPos.y - ghost.y, oPos.x - ghost.x); // line of centres, cue -> object
      const cut = Math.asin(sin0) * DEG;
      const absCut = Math.abs(cut);
      const sin = Math.abs(sin0);

      Object.assign(info, {
        hit: true,
        t: e.t,
        ghost,
        object: { id: o.id, x: oPos.x, y: oPos.y },
        inDir,
        lineDir,
        cut,
        absCut,
        thickness: 1 - sin, // fraction of the object ball covered by the cue ball
        cueExitDir: Math.atan2(c.va[1], c.va[0]),
        cueExitSpeed: Math.hypot(c.va[0], c.va[1]),
        objExitDir: Math.atan2(o.va[1], o.va[0]),
        objExitSpeed: Math.hypot(o.va[0], o.va[1]),
        impactSpeed: Math.hypot(c.vb[0], c.vb[1]),
        air: !!e.air,
      });
      info.cueDeflect = Math.abs(info.cueExitSpeed) > 0.02 ? angDiff(info.cueExitDir, inDir) : null;
      info.split = info.cueDeflect === null ? null : Math.abs(angDiff(info.cueExitDir, info.objExitDir));
    }
  }
  info.cushionsBeforeHit = cushions;
  return info;
}

const FRACTIONS = ['sát mép', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8', '1/1'];

/** Nearest eighth of the object ball covered by the cue ball, as players name it ("1/2 bi"). */
export function thicknessFraction(t) {
  return FRACTIONS[Math.max(0, Math.min(8, Math.round(t * 8)))];
}

export function thicknessLabel(t) {
  return `${Math.round(t * 100)}% ≈ ${thicknessFraction(t)}${t < 0.0625 ? '' : ' bi'}`;
}

/** Cut angle (deg) for a given overlap fraction: lateral offset 2R*sin(cut) = 2R*(1 - t). */
export const cutFromThickness = (t) => Math.asin(Math.max(0, Math.min(1, 1 - t))) * DEG;

/**
 * Aim angle for a signed lateral offset `s` of the object ball's centre from the cue ball's path
 * (+ = object ball to the left of the path). |s| = 0 is a full-ball hit, |s| = 2R only grazes it.
 */
export function aimForOffset(cue, target, s) {
  const dx = target.x - cue.x;
  const dy = target.y - cue.y;
  const d = Math.hypot(dx, dy);
  if (d <= 2 * R + 0.01) return null;
  const lim = 1.98 * R;
  return Math.atan2(dy, dx) - Math.asin(Math.max(-lim, Math.min(lim, s)) / d);
}

/**
 * Aim angle that hits `target` with overlap `t` (1 = full ball, 0 = edge).
 * side +1 sends the object ball to the left of the cue's path (same sign as `info.cut`).
 */
export function aimForThickness(cue, target, t, side) {
  return aimForOffset(cue, target, side * 2 * R * (1 - Math.max(0, Math.min(1, t))));
}

// Perpendicular distance from point k to the infinite line through a -> b.
function lineDist(a, b, k) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.abs(dx * (k.y - a.y) - dy * (k.x - a.x)) / Math.hypot(dx, dy);
}

/**
 * Best point to aim the object ball at: the spot on the pocket mouth (between its two knuckles) that keeps the
 * ball furthest from both jaw tips. Aiming at the hole centre clips the near knuckle on shallow approaches.
 */
function mouthAimPoint(target, pocket) {
  const ks = KNUCKLES.filter((k) => Math.hypot(k.x - pocket.x, k.y - pocket.y) < 0.2);
  if (ks.length !== 2) return pocket;
  let best = pocket;
  let bestScore = -Infinity;
  for (let s = 0.1; s <= 0.9; s += 0.02) {
    const p = { x: ks[0].x + (ks[1].x - ks[0].x) * s, y: ks[0].y + (ks[1].y - ks[0].y) * s };
    const score = Math.min(lineDist(target, p, ks[0]), lineDist(target, p, ks[1]));
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best;
}

/**
 * The ghost-ball line ignores throw (cut-induced sideways push, ~2-3 deg at 20 deg cut), so correct the aim with the
 * real engine: secant steps until the object ball leaves along `desired`.
 */
function refineForThrow(angle, desired, ctx, id) {
  const miss = (a) => {
    const { info } = predict(ctx.balls, { ...ctx.shot, angle: a }, ctx.tMax || 2.5);
    return info.hit && info.object.id === id ? angDiff(info.objExitDir, desired) : null;
  };
  let a = angle;
  const h = 0.002;
  for (let i = 0; i < 3; i++) {
    const f0 = miss(a);
    const f1 = miss(a + h);
    if (f0 === null || f1 === null || Math.abs(f0) < 0.05) break;
    const slope = (f1 - f0) / h;
    if (Math.abs(slope) < 1) break;
    a -= f0 / slope;
  }
  return a;
}

/**
 * Aim that sends `target` into `pocket` through the middle of its mouth; reports the resulting overlap.
 * `ctx` ({ balls, shot: { speed, a, b, elev }, tMax }) enables the throw correction.
 */
export function aimForPocket(cue, target, pocket, ctx) {
  const aim = mouthAimPoint(target, pocket);
  const ux = aim.x - target.x;
  const uy = aim.y - target.y;
  const len = Math.hypot(ux, uy);
  const gx = target.x - (2 * R * ux) / len;
  const gy = target.y - (2 * R * uy) / len;
  let angle = Math.atan2(gy - cue.y, gx - cue.x);
  const lineDir = Math.atan2(uy, ux);
  const cut = angDiff(lineDir, angle);
  const abs = Math.abs(cut);
  if (abs >= 89) return null; // cue ball would have to hit from behind the object ball
  if (ctx) angle = refineForThrow(angle, lineDir, ctx, target.id);
  return { angle, cut, thickness: 1 - Math.sin((abs * Math.PI) / 180) };
}

/** Place a cue ball and an object ball so the shot sends the object into `pocket` at a given cut. */
export function cutShot(target, pocket, cutDeg, dist = 0.5) {
  const ux = pocket.x - target.x;
  const uy = pocket.y - target.y;
  const len = Math.hypot(ux, uy);
  const u = Math.atan2(uy, ux);
  const g = { x: target.x - (2 * R * ux) / len, y: target.y - (2 * R * uy) / len };
  const inside = (p) => Math.abs(p.x) < TABLE.hx - R && Math.abs(p.y) < TABLE.hy - R;
  let best = null;
  for (const sign of [1, -1]) {
    const d = u + (sign * cutDeg) / DEG;
    const cue = { x: g.x - dist * Math.cos(d), y: g.y - dist * Math.sin(d) };
    if (inside(cue) && !best) best = { cue, angle: d };
  }
  return best;
}
