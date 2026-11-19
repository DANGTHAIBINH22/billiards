// Pure 2D billiards engine with 3-axis spin. Units: SI (m, s, rad/s).
// 2D frame: x along table length, y along width, z up (right-handed).
// Ball-cloth model after Alciatore ("TP A-4", "TP A-5"): sliding friction until
// contact-point velocity u = v + w x r reaches zero, then rolling.
import { resolveContact } from './contact.js';

export const R = 0.028575; // ball radius
export const G = 9.81;
export const TABLE = { hx: 1.27, hy: 0.635 }; // half extents between cushion noses (9ft table)

export const PARAMS = {
  muSlide: 0.2, // ball-cloth sliding friction
  muRoll: 0.015, // rolling resistance
  spinDecay: 15, // rad/s^2 decay of vertical (side) spin
  eBall: 0.95, // ball-ball restitution
  // Ball-ball friction mu = (A + B * exp(-C * slip speed)) * scale. A, B, C: Alciatore's fit (TP A-14).
  muBallA: 0.00995,
  muBallB: 0.108,
  muBallC: 1.088,
  muBallScale: 1,
  kHertz: 4.86e8, // N/m^1.5, Hertz stiffness of two phenolic balls (E = 5.4 GPa, nu = 0.34)
  contactDt: 2e-6, // s, step of the contact simulation (a two-ball contact lasts about 0.3 ms)
  contactMax: 0.02, // s, safety limit on one contact window
  eCushion: 0.8,
  muCushionW: 0.14, // ball-cushion friction (english changes rebound angle)
  ballMass: 0.17, // kg
  cushionHeight: 0.635 * 2 * R, // cushion nose height above the cloth (WPA: 63.5% of ball diameter)
  cushionSteps: 150, // impulse steps for the compression phase
  squirt: 0.035, // rad of cue-ball deflection per unit (R) of side offset
  jumpKappa: 0.45, // share of the cue's downward push that becomes vertical launch speed
  eLand: 0.35, // vertical restitution when a ball lands on the cloth
  cushionTop: 0.012, // ball centre must be below this height (above rest) to be stopped by a cushion
  pocketTop: 0.01, // balls only drop into a pocket when this close to the cloth
};

// Centres sit on the visual holes (just outside the nose line) so a ball vanishes where it visibly drops.
const PC = 0.02;
export const POCKETS = [
  { x: -TABLE.hx - PC, y: -TABLE.hy - PC, r: 0.088 },
  { x: TABLE.hx + PC, y: -TABLE.hy - PC, r: 0.088 },
  { x: -TABLE.hx - PC, y: TABLE.hy + PC, r: 0.088 },
  { x: TABLE.hx + PC, y: TABLE.hy + PC, r: 0.088 },
  { x: 0, y: -TABLE.hy - 0.03, r: 0.072 },
  { x: 0, y: TABLE.hy + 0.03, r: 0.072 },
];

// Jaw knuckles: the cushion nose stops here and the pocket mouth opens.
// Without them the cushion line ran straight across the mouth and only a ~8 cm window dropped balls in the side pockets.
// Mouths are the tight end of the WPA range, measured between the knuckle surfaces: corner 4.5 in (11.43 cm),
// side 5 in (12.70 cm). They used to be 9.4 cm and 10.8 cm, tighter than any real table.
export const KNUCKLE_R = 0.004;
export const SIDE_K = 0.0675; // |x| of the side-pocket knuckles: 2 * SIDE_K - 2 * KNUCKLE_R = 0.127
export const CORNER_K = 0.0865; // nose-line corner to each corner knuckle: CORNER_K * sqrt(2) - 2 * KNUCKLE_R = 0.1143
export const KNUCKLES = [];
for (const sx of [-1, 1]) {
  for (const sy of [-1, 1]) {
    KNUCKLES.push({ x: sx * TABLE.hx, y: sy * (TABLE.hy - CORNER_K) });
    KNUCKLES.push({ x: sx * (TABLE.hx - CORNER_K), y: sy * TABLE.hy });
  }
  KNUCKLES.push({ x: sx * SIDE_K, y: TABLE.hy }, { x: sx * SIDE_K, y: -TABLE.hy });
}

const STOP_SPEED = 0.002;

export function createBall(id, x = 0, y = 0) {
  return { id, x, y, z: 0, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, active: true };
}

export function cloneBalls(balls) {
  return balls.map((b) => ({ ...b }));
}

export function isMoving(balls) {
  return balls.some((b) => b.active && (b.vx !== 0 || b.vy !== 0 || b.z > 0 || b.vz !== 0));
}

/**
 * Cue strike with a level cue.
 * @param angle aim direction (rad), v0 cue-ball launch speed (m/s)
 * @param a side offset in units of R (+ = right of aim), b vertical offset (+ = above centre)
 * @param elev cue elevation in rad (jump cue); 0 = level cue
 */
export function strike(cue, angle, v0, a, b, elev = 0) {
  // Squirt: ball leaves slightly opposite to the side the cue hits.
  const dirAngle = angle - PARAMS.squirt * a;
  const dx = Math.cos(dirAngle);
  const dy = Math.sin(dirAngle);
  const vh = v0 * Math.cos(elev);
  cue.vx = vh * dx;
  cue.vy = vh * dy;
  cue.vz = elev > 0 ? PARAMS.jumpKappa * v0 * Math.sin(elev) : 0;
  const k = (2.5 * vh * b) / R; // top/back spin; b = 0.4 gives natural roll
  cue.wx = -k * dy;
  cue.wy = k * dx;
  cue.wz = (2.5 * vh * a) / R;
}

function advance(b, dt, events, tNow) {
  if (b.z > 1e-6 || b.vz > 0) {
    // Free flight: no cloth friction, spin is preserved.
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vz -= G * dt;
    b.z += b.vz * dt;
    if (b.z <= 0) {
      b.z = 0;
      const vIn = -b.vz;
      if (events) events.push({ type: 'land', t: tNow, id: b.id, x: b.x, y: b.y, vz: vIn });
      b.vz = vIn < 0.25 ? 0 : vIn * PARAMS.eLand;
    }
    return;
  }
  let t = dt;
  const ux = b.vx - R * b.wy;
  const uy = b.vy + R * b.wx;
  const um = Math.hypot(ux, uy);

  if (um > 1e-4) {
    const mg = PARAMS.muSlide * G;
    const tSlip = um / (3.5 * mg);
    const ts = Math.min(t, tSlip);
    const ax = (-mg * ux) / um;
    const ay = (-mg * uy) / um;
    b.x += b.vx * ts + 0.5 * ax * ts * ts;
    b.y += b.vy * ts + 0.5 * ay * ts * ts;
    b.vx += ax * ts;
    b.vy += ay * ts;
    b.wx += (2.5 / R) * ay * ts;
    b.wy -= (2.5 / R) * ax * ts;
    t -= ts;
    if (ts === tSlip) {
      b.wy = b.vx / R;
      b.wx = -b.vy / R;
    }
  }

  if (t > 0) {
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 0) {
      const dv = PARAMS.muRoll * G * t;
      if (sp <= dv || sp < STOP_SPEED) {
        const tStop = sp / (PARAMS.muRoll * G);
        b.x += 0.5 * b.vx * Math.min(t, tStop);
        b.y += 0.5 * b.vy * Math.min(t, tStop);
        b.vx = b.vy = b.wx = b.wy = 0;
      } else {
        const f = (sp - dv) / sp;
        const vx1 = b.vx * f;
        const vy1 = b.vy * f;
        b.x += 0.5 * (b.vx + vx1) * t;
        b.y += 0.5 * (b.vy + vy1) * t;
        b.vx = vx1;
        b.vy = vy1;
        b.wy = vx1 / R;
        b.wx = -vy1 / R;
      }
    }
  }

  const dw = PARAMS.spinDecay * dt;
  b.wz = Math.abs(b.wz) <= dw ? 0 : b.wz - Math.sign(b.wz) * dw;
}

// Impulse collision, used only while one of the two balls is in the air (jump shots).
function collideBalls(A, B, events, t) {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const dz = B.z - A.z;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 >= 4 * R * R || d2 === 0) return;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  const nz = dz / d;
  const vn = (A.vx - B.vx) * nx + (A.vy - B.vy) * ny + (A.vz - B.vz) * nz;
  if (vn <= 0) return; // separating already

  const before = { ax: A.vx, ay: A.vy, bx: B.vx, by: B.vy };
  const grounded = A.z === 0 && B.z === 0 && A.vz === 0 && B.vz === 0;

  const J = ((1 + PARAMS.eBall) / 2) * vn;
  A.vx -= J * nx;
  A.vy -= J * ny;
  A.vz -= J * nz;
  B.vx += J * nx;
  B.vy += J * ny;
  B.vz += J * nz;

  // Resolve overlap.
  const push = (2 * R - d) / 2;
  A.x -= push * nx;
  A.y -= push * ny;
  A.z -= push * nz;
  B.x += push * nx;
  B.y += push * ny;
  B.z += push * nz;
  if (A.z < 0) A.z = 0;
  if (B.z < 0) B.z = 0;

  if (events) {
    events.push({
      type: 'ball',
      t,
      a: A.id,
      b: B.id,
      ax: A.x,
      ay: A.y,
      bx: B.x,
      by: B.y,
      air: !grounded,
      before,
      after: { ax: A.vx, ay: A.vy, bx: B.vx, by: B.vy },
    });
  }
}

/**
 * Ball-cushion impact after Mathavan, Jackson & Parkin (2010), as implemented in pooltool: the cushion touches the
 * ball above its centre, friction acts at both the cushion contact and the cloth contact, and the impulse is integrated
 * in small steps (compression, then restitution until the work reaches e^2 of the compression work).
 * Top/back spin and side spin therefore change at the cushion, and the ball keeps its remaining slip (the curve after
 * a bounce) instead of being forced back to rolling.
 * Frame: y = into the cushion, x = along it (y cross z), z up. (mx, my) = unit normal pointing into the table.
 */
function cushion(b, mx, my, events, t) {
  const vn = b.vx * mx + b.vy * my;
  if (vn >= 0) return;
  const e = Math.min(0.9, Math.max(0.6, PARAMS.eCushion + 0.1 - 0.06 * -vn));
  const yx = -mx;
  const yy = -my;
  const xx = yy;
  const xy = -yx;
  let vx = b.vx * xx + b.vy * xy;
  let vy = b.vx * yx + b.vy * yy;
  let wx = b.wx * xx + b.wy * xy;
  let wy = b.wx * yx + b.wy * yy;
  let wz = b.wz;

  const M = PARAMS.ballMass;
  const muW = PARAMS.muCushionW;
  const muS = PARAMS.muSlide;
  const sinT = (PARAMS.cushionHeight - R) / R;
  const cosT = Math.sqrt(1 - sinT * sinT);
  const factor = 5 / (2 * M * R);
  const dp = (M * vy) / PARAMS.cushionSteps;
  // Coulomb friction would chatter around zero slip: ramp it up over a small slip speed.
  const ramp = (s) => Math.min(1, s / 0.01);

  let work = 0;
  let target = Infinity;
  for (let i = 0; i < 6 * PARAMS.cushionSteps; i++) {
    const vxI = vx + wy * R * sinT - wz * R * cosT;
    const vyI = -vy * sinT + wx * R;
    const vxC = vx - wy * R;
    const vyC = vy + wx * R;
    const sI = Math.hypot(vxI, vyI);
    const sC = Math.hypot(vxC, vyC);
    const cI = sI > 1e-9 ? (vxI / sI) * ramp(sI) : 0;
    const sIn = sI > 1e-9 ? (vyI / sI) * ramp(sI) : 0;
    const cC = sC > 1e-9 ? (vxC / sC) * ramp(sC) : 0;
    const sCn = sC > 1e-9 ? (vyC / sC) * ramp(sC) : 0;
    const k = sinT + muW * sIn * cosT;

    work += dp * Math.abs(vy) * cosT;
    vx -= ((muW * cI + muS * cC * k) / M) * dp;
    vy -= ((cosT - muW * sinT * sIn + muS * sCn * k) / M) * dp;
    wx -= factor * (muW * sIn + muS * sCn * k) * dp;
    wy -= factor * (muW * cI * sinT - muS * cC * k) * dp;
    wz += factor * muW * cI * cosT * dp;

    if (target === Infinity && vy <= 0) { target = e * e * work; work = 0; } // compression done; count rebound work afresh
    else if (target !== Infinity && work >= target) break;
  }

  b.vx = vx * xx + vy * yx;
  b.vy = vx * xy + vy * yy;
  b.wx = wx * xx + wy * yx;
  b.wy = wx * xy + wy * yy;
  b.wz = wz;
  if (events) events.push({ type: 'cushion', t, id: b.id, x: b.x, y: b.y });
}

function bounceOffKnuckles(b, events, t) {
  const min = R + KNUCKLE_R;
  for (const k of KNUCKLES) {
    const dx = b.x - k.x;
    const dy = b.y - k.y;
    const d = Math.hypot(dx, dy);
    if (d >= min || d < 1e-9) continue;
    b.x = k.x + (dx / d) * min;
    b.y = k.y + (dy / d) * min;
    cushion(b, dx / d, dy / d, events, t);
  }
}

const MAX_TRAVEL = 0.01; // m a ball may move between boundary checks (a 10 m/s break covers 21 mm per 1/480 s)
const MAX_CONTACTS = 64; // contact windows per step before giving up on finding more
const MIN_APPROACH = 1e-3; // m/s: touching balls closing slower than this are resting, not colliding

const onCloth = (b) => b.active && b.z === 0 && b.vz === 0;

/** Earliest moment within `span` at which two balls on the cloth touch, taking their motion as straight. */
function nextContact(balls, span) {
  let best = null;
  for (let i = 0; i < balls.length; i++) {
    const A = balls[i];
    if (!onCloth(A)) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const B = balls[j];
      if (!onCloth(B)) continue;
      const px = B.x - A.x;
      const py = B.y - A.y;
      const wx = B.vx - A.vx;
      const wy = B.vy - A.vy;
      const pw = px * wx + py * wy;
      if (pw >= 0) continue; // not closing
      const d2 = px * px + py * py;
      const c = d2 - 4 * R * R;
      let tau = 0;
      if (c <= 0) {
        if (-pw / Math.sqrt(d2) < MIN_APPROACH) continue;
      } else {
        const a = wx * wx + wy * wy;
        const disc = pw * pw - a * c;
        if (disc < 0) continue;
        tau = (-pw - Math.sqrt(disc)) / a;
        if (tau > span) continue;
      }
      if (!best || tau < best.tau) best = { tau, i, j };
    }
  }
  return best;
}

function contactWindow(balls, hit, events, t) {
  const contacts = resolveContact(balls, hit.i, hit.j, {
    R,
    mass: PARAMS.ballMass,
    k: PARAMS.kHertz,
    e: PARAMS.eBall,
    muA: PARAMS.muBallA,
    muB: PARAMS.muBallB,
    muC: PARAMS.muBallC,
    muScale: PARAMS.muBallScale,
    dt: PARAMS.contactDt,
    tMax: PARAMS.contactMax,
  });
  if (!events) return;
  for (const c of contacts) events.push({ type: 'ball', t, a: c.a, b: c.b, ax: c.ax, ay: c.ay, bx: c.bx, by: c.by, air: false, before: c.before, after: c.after });
}

/**
 * Straight cushion: put the ball back on the nose line at the point where it really crossed it, bounce it there,
 * then give it back the time it spent beyond the line. Without this the rebound point drifts with the step size.
 */
function rails(b, span, events, t) {
  const lx = TABLE.hx - R;
  const ly = TABLE.hy - R;
  if (Math.abs(b.x) > lx) {
    const s = Math.sign(b.x);
    const vn = s * b.vx;
    const tau = vn > 1e-9 ? Math.min((Math.abs(b.x) - lx) / vn, span) : 0;
    const y0 = b.y - b.vy * tau;
    if (Math.abs(y0) < TABLE.hy - CORNER_K) {
      b.x = s * lx;
      b.y = y0;
      cushion(b, -s, 0, events, t);
      b.x += b.vx * tau;
      b.y += b.vy * tau;
    }
  }
  if (Math.abs(b.y) > ly) {
    const s = Math.sign(b.y);
    const vn = s * b.vy;
    const tau = vn > 1e-9 ? Math.min((Math.abs(b.y) - ly) / vn, span) : 0;
    const x0 = Math.abs(b.x - b.vx * tau);
    if (x0 > SIDE_K && x0 < TABLE.hx - CORNER_K) {
      b.x -= b.vx * tau;
      b.y = s * ly;
      cushion(b, 0, -s, events, t);
      b.x += b.vx * tau;
      b.y += b.vy * tau;
    }
  }
}

function boundaries(balls, span, events, t) {
  for (const b of balls) {
    if (!b.active) continue;
    for (const p of POCKETS) {
      if (b.z < PARAMS.pocketTop && Math.hypot(b.x - p.x, b.y - p.y) < p.r) {
        b.active = false;
        b.vx = b.vy = b.vz = b.z = b.wx = b.wy = b.wz = 0;
        if (events) events.push({ type: 'pocket', t, id: b.id, x: p.x, y: p.y, pocket: POCKETS.indexOf(p) });
        break;
      }
    }
    if (!b.active) continue;
    if (b.z > PARAMS.cushionTop) {
      // Flying over the cushion: gone if it clears the rail completely.
      if (Math.abs(b.x) > TABLE.hx + R || Math.abs(b.y) > TABLE.hy + R) {
        b.active = false;
        b.vx = b.vy = b.vz = 0;
        if (events) events.push({ type: 'off', t, id: b.id, x: b.x, y: b.y });
      }
      continue;
    }
    bounceOffKnuckles(b, events, t);
    // Cushion segments exist only between the knuckles; inside a pocket mouth the ball runs on to the hole.
    rails(b, span, events, t);
  }
}

/**
 * Advance the table by dt. The step is cut at every moment two balls on the cloth touch, so a collision is
 * resolved at the real point of contact whatever dt is, and into chunks short enough that a fast ball cannot
 * skip a cushion or pocket check.
 */
export function stepWorld(balls, dt, events, t = 0) {
  let left = dt;
  let now = t;
  let windows = 0;
  while (left > 1e-12) {
    let vmax = 0;
    for (const b of balls) if (b.active) vmax = Math.max(vmax, Math.hypot(b.vx, b.vy));
    let span = vmax * left > MAX_TRAVEL ? MAX_TRAVEL / vmax : left;
    const hit = windows < MAX_CONTACTS ? nextContact(balls, span) : null;
    if (hit) span = hit.tau;
    if (span > 0) for (const b of balls) if (b.active) advance(b, span, events, now);
    now += span;
    left -= span;
    if (hit) { windows++; contactWindow(balls, hit, events, now); }

    for (let i = 0; i < balls.length; i++) {
      const A = balls[i];
      if (!A.active) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const B = balls[j];
        if (B.active && !(onCloth(A) && onCloth(B))) collideBalls(A, B, events, now);
      }
    }
    // The cloth absorbs any downward velocity left over from a collision.
    for (const b of balls) if (b.z === 0 && b.vz < 0) b.vz = 0;
    boundaries(balls, span, events, now);
  }
}

/**
 * Run the engine on a copy of `start`. Same code path as the live game, so the
 * prediction matches the real shot.
 */
export function simulate(start, { tMax = 3, dt = 1 / 480, sampleEvery = 6 } = {}) {
  const balls = cloneBalls(start);
  const events = [];
  const paths = {};
  for (const b of balls) if (b.active) paths[b.id] = [[b.x, b.y, 0, b.z]];

  let t = 0;
  let n = 0;
  while (t < tMax) {
    stepWorld(balls, dt, events, t);
    t += dt;
    n++;
    if (n % sampleEvery === 0) {
      for (const b of balls) if (b.active && paths[b.id] && (b.vx !== 0 || b.vy !== 0 || b.z > 0)) paths[b.id].push([b.x, b.y, t, b.z]);
    }
    if (!isMoving(balls)) break;
  }
  for (const b of balls) if (b.active && paths[b.id]) paths[b.id].push([b.x, b.y, t, b.z]);
  for (const e of events) if (e.type === 'pocket' && paths[e.id]) paths[e.id].push([e.x, e.y, e.t, 0]);
  return { paths, events, final: balls, duration: t };
}
