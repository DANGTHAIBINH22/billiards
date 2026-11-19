// Ball-ball contact as a short compliant simulation of every ball that touches (Hertz spring + Coulomb friction).
//
// Why not impulses: a tight rack is one many-body contact. Pairwise impulses give an order-dependent answer and no
// rebound of the cue ball off the pack. Here the whole group is integrated together for the fraction of a millisecond
// the contact lasts, so the rebound, the spread of the pack, throw and spin transfer all come from the same forces.
//
// The window is treated as instantaneous by the caller: the group's balls end it a few millimetres ahead of where
// they started (at most window x speed), which is far below what the table geometry can resolve.

const NEAR = 1e-4; // m: a ball this close to the group takes part (racked balls a hair apart, rounded share links)
const PAIR_RANGE = 5e-4; // m: pairs closer than this are force candidates until the next rescan
const RESCAN = 16; // steps between neighbour rescans; RESCAN * dt * top speed stays below PAIR_RANGE
const QUIET_STEPS = 50; // steps without any contact before the window closes (lets a ball cross a hair gap)
const STICK_SPEED = 0.005; // m/s: friction ramps up to full over this slip speed instead of chattering at zero

/**
 * Resolve the contact that starts between balls[i] and balls[j].
 * @param balls every ball of the table; only active balls resting on the cloth can join the group
 * @param c { R, mass, k, e, muA, muB, muC, muScale, dt, tMax }
 * @returns contacts in the order they began: [{ a, b, ax, ay, bx, by, before, after }] (a, b = ball ids)
 */
export function resolveContact(balls, i, j, c) {
  const n = balls.length;
  const D = 2 * c.R;
  const inertia = 0.4 * c.mass * c.R * c.R;
  const e2 = c.e * c.e;
  const onCloth = (b) => b.active && b.z === 0 && b.vz === 0;

  const member = new Array(n).fill(false);
  const group = [];
  const join = (k) => { member[k] = true; group.push(k); };
  join(i);
  join(j);
  const grow = () => {
    for (let q = 0; q < group.length; q++) {
      const A = balls[group[q]];
      for (let k = 0; k < n; k++) {
        if (member[k] || !onCloth(balls[k])) continue;
        const dx = balls[k].x - A.x;
        const dy = balls[k].y - A.y;
        if (dx * dx + dy * dy < (D + NEAR) * (D + NEAR)) join(k);
      }
    }
  };

  // Rest length per pair. Two balls that already overlap when first seen (positions rounded in a share link, a
  // contact noticed late) keep that distance as their rest length, so no stored spring energy is released.
  const rest = new Map();
  const restOf = (a, b, d) => {
    const key = a < b ? a * n + b : b * n + a;
    let r = rest.get(key);
    if (r === undefined) { r = Math.min(D, d); rest.set(key, r); }
    return r;
  };

  let pairs = [];
  const scan = () => {
    grow();
    pairs = [];
    for (let p = 0; p < group.length; p++) {
      for (let q = p + 1; q < group.length; q++) {
        const A = balls[group[p]];
        const B = balls[group[q]];
        const d = Math.hypot(B.x - A.x, B.y - A.y);
        if (d < D + PAIR_RANGE) { restOf(group[p], group[q], d); pairs.push(group[p], group[q]); }
      }
    }
  };

  const fx = new Float64Array(n);
  const fy = new Float64Array(n);
  const tx = new Float64Array(n);
  const ty = new Float64Array(n);
  const tz = new Float64Array(n);
  const started = new Map();
  const contacts = [];
  const vel = (b) => [b.vx, b.vy];

  let quiet = 0;
  for (let step = 0; step * c.dt < c.tMax; step++) {
    if (step % RESCAN === 0) scan();
    let touching = false;
    for (let p = 0; p < pairs.length; p += 2) {
      const ia = pairs[p];
      const ib = pairs[p + 1];
      const A = balls[ia];
      const B = balls[ib];
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const d = Math.hypot(dx, dy);
      const pen = restOf(ia, ib, d) - d;
      if (pen <= 0 || d === 0) continue;
      touching = true;
      const nx = dx / d;
      const ny = dy / d;
      const rvx = B.vx - A.vx;
      const rvy = B.vy - A.vy;
      const key = ia * n + ib;
      if (!started.has(key)) {
        const rec = { a: A.id, b: B.id, ia, ib, ax: A.x, ay: A.y, bx: B.x, by: B.y, before: { ax: A.vx, ay: A.vy, bx: B.vx, by: B.vy } };
        started.set(key, rec);
        contacts.push(rec);
      }
      // Stiffer while the balls close than while they part: restitution e for any impact speed.
      const closing = rvx * nx + rvy * ny < 0;
      const fn = c.k * pen * Math.sqrt(pen) * (closing ? 1 : e2);

      // Slip of B's surface relative to A's at the contact point: along the table (t) and vertically (z).
      const st = -rvx * ny + rvy * nx - c.R * (A.wz + B.wz);
      const sz = -c.R * ((A.wx + B.wx) * ny - (A.wy + B.wy) * nx);
      const slip = Math.hypot(st, sz);
      let ft = 0;
      let fz = 0;
      if (slip > 1e-9) {
        // Ball-ball friction falls with sliding speed (Alciatore, TP A-14): big throw on soft shots, little on hard ones.
        const mu = (c.muA + c.muB * Math.exp(-c.muC * slip)) * c.muScale * Math.min(1, slip / STICK_SPEED);
        ft = (mu * fn * st) / slip;
        fz = (mu * fn * sz) / slip;
      }
      // A is dragged along the slip, B against it; the friction torque is the same on both balls.
      const ax = -fn * nx - ft * ny;
      const ay = -fn * ny + ft * nx;
      fx[ia] += ax; fy[ia] += ay;
      fx[ib] -= ax; fy[ib] -= ay;
      const mz = c.R * ft;
      const mx = c.R * fz * ny;
      const my = -c.R * fz * nx;
      tx[ia] += mx; ty[ia] += my; tz[ia] += mz;
      tx[ib] += mx; ty[ib] += my; tz[ib] += mz;
    }
    for (let q = 0; q < group.length; q++) {
      const k = group[q];
      const b = balls[k];
      if (touching) {
        b.vx += (fx[k] / c.mass) * c.dt;
        b.vy += (fy[k] / c.mass) * c.dt;
        b.wx += (tx[k] / inertia) * c.dt;
        b.wy += (ty[k] / inertia) * c.dt;
        b.wz += (tz[k] / inertia) * c.dt;
        fx[k] = fy[k] = tx[k] = ty[k] = tz[k] = 0;
      }
      b.x += b.vx * c.dt;
      b.y += b.vy * c.dt;
    }
    quiet = touching ? 0 : quiet + 1;
    if (quiet >= QUIET_STEPS) break;
  }

  for (const rec of contacts) {
    const [avx, avy] = vel(balls[rec.ia]);
    const [bvx, bvy] = vel(balls[rec.ib]);
    rec.after = { ax: avx, ay: avy, bx: bvx, by: bvy };
    delete rec.ia;
    delete rec.ib;
  }
  return contacts;
}
