import test from 'node:test';
import assert from 'node:assert/strict';
import { R, TABLE, PARAMS, createBall, strike, simulate, stepWorld } from '../js/physics.js';
import { resolveContact } from '../js/contact.js';
import { buildRack } from '../js/racks.js';

const DEG = 180 / Math.PI;

// Cue ball travelling along +x hits an object ball at a given cut, in open table. Stops at the cue ball's first cushion.
function shot(cutDeg, speed, b, dist, dt = 1 / 480) {
  const off = 2 * R * Math.sin(cutDeg / DEG);
  const cue = createBall(0, -0.9, -0.3 - off);
  const obj = createBall(1, -0.9 + dist, -0.3);
  strike(cue, 0, speed, 0, b);
  const balls = [cue, obj];
  const ev = [];
  let hit = null;
  let rollDir = null;
  for (let t = 0; t < 8; t += dt) {
    stepWorld(balls, dt, ev, t);
    if (!hit) { hit = ev.find((e) => e.type === 'ball'); if (!hit) continue; }
    if (ev.some((e) => e.type === 'cushion' && e.id === 0) || Math.hypot(cue.vx, cue.vy) < 0.02) break;
    rollDir = Math.atan2(cue.vy, cue.vx) * DEG;
    if (Math.hypot(cue.vx - R * cue.wy, cue.vy + R * cue.wx) < 1e-3) break; // cue ball has finished curving
  }
  assert.ok(hit, 'cue ball never reached the object ball');
  const pre = Math.hypot(hit.before.ax, hit.before.ay);
  return {
    objDir: Math.atan2(hit.after.by, hit.after.bx) * DEG,
    rollDir,
    keeps: Math.hypot(hit.after.ax, hit.after.ay) / pre,
    e: (hit.after.bx - hit.after.ax) / pre,
  };
}

test('object-ball direction does not depend on the time step, at any speed or starting distance', () => {
  for (const speed of [1, 2, 3, 5, 7, 10]) {
    for (let k = 0; k < 12; k++) {
      const dist = 0.3 + k * 0.0031;
      const coarse = shot(30, speed, 0, dist).objDir;
      const fine = shot(30, speed, 0, dist, 1 / 4800).objDir;
      assert.ok(Math.abs(coarse - fine) < 0.02, `${speed} m/s, ${dist.toFixed(4)} m: ${coarse.toFixed(3)} vs ${fine.toFixed(3)}`);
    }
  }
});

test('moving the cue ball a few millimetres does not change where the object ball goes', () => {
  // Rolling cue ball: it arrives in the same state from every distance, so any spread would be a stepping artefact.
  for (const speed of [1, 2, 3, 5, 7, 10]) {
    const dirs = [];
    for (let k = 0; k < 12; k++) dirs.push(shot(30, speed, 0.4, 0.3 + k * 0.0031).objDir);
    const spread = Math.max(...dirs) - Math.min(...dirs);
    assert.ok(spread < 0.2, `${speed} m/s: spread ${spread.toFixed(3)} deg`);
  }
});

test('a graze that overlaps by 0.3 mm is not missed at break speed', () => {
  const cue = createBall(0, -0.9, -0.3 - (2 * R - 0.0003));
  const obj = createBall(1, -0.5, -0.3);
  strike(cue, 0, 10, 0, 0);
  const sim = simulate([cue, obj], { tMax: 0.2 });
  assert.equal(sim.events.filter((e) => e.type === 'ball').length, 1);
});

test('a fast ball meets the cushion at the same point whatever the time step', () => {
  const at = (dt) => {
    const b = createBall(1, 0.2, 0);
    const v = 7 / Math.SQRT2;
    Object.assign(b, { vx: v, vy: v, wx: -v / R, wy: v / R });
    return simulate([b], { tMax: 1, dt }).events.find((e) => e.type === 'cushion');
  };
  const a = at(1 / 480);
  const c = at(1 / 4800);
  assert.ok(Math.hypot(a.x - c.x, a.y - c.y) < 0.001, `cushion points ${Math.hypot(a.x - c.x, a.y - c.y) * 1000} mm apart`);
});

test('two-ball restitution is the same at every speed', () => {
  for (const speed of [1, 3, 5, 8]) {
    const e = shot(0, speed, 0, 0.05).e;
    assert.ok(Math.abs(e - PARAMS.eBall) < 0.005, `${speed} m/s: e = ${e.toFixed(3)}`);
    assert.ok(e >= 0.92 && e <= 0.96);
  }
});

test('cut-induced throw is large on a soft half-ball hit and fades as the shot gets harder', () => {
  const throwAt = (speed) => 30 - shot(30, speed, 0, 0.05).objDir;
  const t = [0.5, 1, 2, 3, 5, 7].map(throwAt);
  assert.ok(t[1] > 3.5 && t[1] < 5.5, `1 m/s: ${t[1].toFixed(2)} deg`);
  assert.ok(t[0] < 5.5, 'throw saturates near 5 degrees');
  for (let i = 2; i < t.length; i++) assert.ok(t[i] < t[i - 1], `throw must fall with speed: ${t.map((v) => v.toFixed(2))}`);
  assert.ok(t[3] > 1.5 && t[3] < 2.6, `3 m/s: ${t[3].toFixed(2)} deg`); // Dr. Dave's "fast" (7 mph): about 1.5-2 deg
  assert.ok(t[5] > 0, 'throw never reverses');
});

test('stun shots keep the 90-degree rule speeds: the cue ball keeps (1 - ball fraction hit) of its speed', () => {
  for (const [cut, want] of [[7.2, 0.125], [14.5, 0.25], [30, 0.5]]) {
    const keeps = shot(cut, 3, 0, 0.05).keeps;
    assert.ok(Math.abs(keeps - want) <= 0.03, `cut ${cut}: keeps ${keeps.toFixed(3)}`);
  }
});

test('a rolling cue ball follows the 30-degree rule', () => {
  const roll = (cut) => Math.abs(shot(cut, 1.2, 0.4, 0.6, 1 / 4800).rollDir);
  const half = roll(30);
  assert.ok(half > 30 && half < 35, `half ball: ${half.toFixed(1)}`);
  assert.ok(roll(14.5) > 25 && roll(14.5) < half, '3/4 ball deflects a little less than half ball');
  assert.ok(roll(48.6) > 25 && roll(48.6) < half, '1/4 ball deflects a little less than half ball');
  const thin = roll(61);
  assert.ok(thin > 18 && thin < 21, `1/8 ball: ${thin.toFixed(1)}`);
});

const contactParams = () => ({ R, mass: PARAMS.ballMass, k: PARAMS.kHertz, e: PARAMS.eBall, muA: PARAMS.muBallA, muB: PARAMS.muBallB, muC: PARAMS.muBallC, muScale: PARAMS.muBallScale, dt: PARAMS.contactDt, tMax: PARAMS.contactMax });
const momentum = (balls) => balls.reduce((m, b) => [m[0] + b.vx, m[1] + b.vy], [0, 0]);
const energy = (balls) => balls.reduce((k, b) => k + b.vx * b.vx + b.vy * b.vy, 0);

test('a contact window conserves momentum and never adds energy, even through a whole rack', () => {
  const rack = buildRack('10', 3).map((s) => createBall(s.id, s.x, s.y));
  const one = rack.find((b) => b.id === 1);
  const cue = createBall(0, one.x - 2 * R, 0.004);
  cue.vx = 8;
  const balls = [cue, ...rack];
  const p0 = momentum(balls);
  const k0 = energy(balls);
  const contacts = resolveContact(balls, 0, balls.indexOf(one), contactParams());
  const p1 = momentum(balls);
  assert.ok(Math.abs(p1[0] - p0[0]) < 1e-9 && Math.abs(p1[1] - p0[1]) < 1e-9, 'momentum changed');
  assert.ok(energy(balls) < k0, 'energy must drop (restitution, friction)');
  assert.ok(energy(balls) > 0.75 * k0, 'but not by much');
  assert.equal(contacts[0].a === 0 || contacts[0].b === 0, true, 'the cue ball contact is reported first');
  assert.ok(contacts.length >= 9, 'every touching pair of the pack is reported');
  assert.ok(cue.vx < -0.08 * 8, `cue ball must rebound off a frozen pack: vx = ${cue.vx.toFixed(2)}`);
});

test('balls that already overlap separate without gaining energy', () => {
  const a = createBall(0, 0, 0);
  const b = createBall(1, 2 * R - 0.001, 0); // 1 mm inside each other, as after a late-noticed contact
  a.vx = 1;
  resolveContact([a, b], 0, 1, contactParams());
  assert.ok(energy([a, b]) <= 1 + 1e-9, `energy ${energy([a, b])}`);
  assert.ok(b.vx > 0.9 && Math.abs(a.vx) < 0.1, 'still a normal head-on transfer');
});

test('the same break always ends in the same position', () => {
  const run = () => {
    const balls = [createBall(0, -TABLE.hx / 2, -0.4), ...buildRack('9low', 3).map((s) => createBall(s.id, s.x, s.y))];
    strike(balls[0], Math.atan2(0.4, TABLE.hx), 8, 0, -0.2);
    return simulate(balls, { tMax: 30 }).final.map((b) => [b.id, b.x, b.y, b.active]);
  };
  assert.deepEqual(run(), run());
});
