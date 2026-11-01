import test from 'node:test';
import assert from 'node:assert/strict';
import { createBall, stepWorld, strike, simulate, R } from '../js/physics.js';

const DEG = Math.PI / 180;

/** Roll a ball into the +x cushion and return its state right after the bounce. */
function bounce({ angle = 45, v = 2, wz = 0, roll = true, y = 0.1 }) {
  const c = createBall(0, 1.2, y);
  c.vx = v * Math.cos(angle * DEG);
  c.vy = v * Math.sin(angle * DEG);
  if (roll) { c.wy = c.vx / R; c.wx = -c.vy / R; }
  c.wz = (wz * v) / R;
  const dt = 1 / 480;
  for (let i = 0; i < 480; i++) {
    const ev = [];
    stepWorld([c], dt, ev, i * dt);
    if (ev.some((e) => e.type === 'cushion')) return c;
  }
  throw new Error('no cushion contact');
}

test('cushion never adds translational energy and loses speed like a real rail', () => {
  for (const wz of [-0.6, 0, 0.6]) {
    for (const angle of [10, 30, 60, 85]) {
      const c = bounce({ angle, wz });
      const ratio = Math.hypot(c.vx, c.vy) / 2;
      assert.ok(ratio < 1 && ratio > 0.55, `angle ${angle} wz ${wz} speed ratio ${ratio}`);
    }
  }
});

test('mirror symmetry: flipping side and y flips the rebound', () => {
  const a = bounce({ angle: 40, wz: 0.4, y: 0.1 });
  const b = bounce({ angle: -40, wz: -0.4, y: -0.1 });
  assert.ok(Math.abs(a.vx - b.vx) < 1e-6 && Math.abs(a.vy + b.vy) < 1e-6);
  assert.ok(Math.abs(a.wz + b.wz) < 1e-6);
});

test('a ball rolling straight into the rail leaves with no sideways slip (no curve)', () => {
  const c = bounce({ angle: 0.01 });
  const ux = c.vx - R * c.wy;
  const uy = c.vy + R * c.wx;
  assert.ok(Math.abs(c.vy) < 0.01);
  assert.ok(Math.abs(uy) < 0.02, `lateral slip ${uy}`);
  assert.ok(Math.abs(ux) > 0); // normal slip remains (backspin relative to motion)
});

test('running english opens the rebound, reverse english closes it', () => {
  const run = bounce({ wz: 0.5 });
  const rev = bounce({ wz: -0.5 });
  const angleOf = (c) => Math.atan2(c.vy, -c.vx) / DEG; // rebound angle from the rail normal's perpendicular
  assert.ok(angleOf(run) < angleOf(rev), `running ${angleOf(run)} vs reverse ${angleOf(rev)}`);
});

test('path curvature after a rail fades from bounce to bounce', () => {
  const c = createBall(0, -0.9, -0.2);
  strike(c, 20 * DEG, 3, 0.5, 0);
  const r = simulate([c], { tMax: 12, sampleEvery: 2 });
  const hits = r.events.filter((e) => e.type === 'cushion').map((e) => e.t);
  assert.ok(hits.length >= 3);
  const bounds = [0, ...hits, r.duration];
  const rate = (k) => {
    const pts = r.paths[0].filter((q) => q[2] > bounds[k] + 0.02 && q[2] < bounds[k + 1] - 0.02);
    let turn = 0;
    let len = 0;
    let prev = null;
    for (let i = 1; i < pts.length; i++) {
      const h = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
      if (prev !== null) { let d = h - prev; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; turn += d; }
      prev = h;
      len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    return Math.abs(turn / len);
  };
  assert.ok(rate(0) < 0.01, 'straight before the first rail');
  assert.ok(rate(1) > rate(2), `after rail 1: ${rate(1)}, after rail 2: ${rate(2)}`);
});
