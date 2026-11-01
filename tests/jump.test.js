import test from 'node:test';
import assert from 'node:assert/strict';
import { R, createBall, strike, simulate } from '../js/physics.js';

const rad = (d) => (d * Math.PI) / 180;

function jump({ elev = 40, v0 = 4.5, blockerX = -0.2 }) {
  const cue = createBall(0, -0.5, 0);
  const blocker = createBall(1, blockerX, 0);
  strike(cue, 0, v0, 0, 0, rad(elev));
  return simulate([cue, blocker], { tMax: 1.5 });
}

test('level cue cannot pass through a blocker (elev=0)', () => {
  const r = jump({ elev: 0, v0: 3 });
  assert.ok(r.events.some((e) => e.type === 'ball' && !e.air));
});

test('jump shot clears a ball 0.3 m ahead and lands beyond it', () => {
  const r = jump({});
  const land = r.events.find((e) => e.type === 'land' && e.id === 0);
  const hit = r.events.find((e) => e.type === 'ball');
  assert.ok(!hit || hit.t > land.t, 'must not touch the blocker while flying over it');
  assert.ok(land && land.x > -0.2 + 2 * R, `landed at x=${land?.x}`);
  const maxZ = Math.max(...r.paths[0].map((p) => p[3]));
  assert.ok(maxZ > 2 * R, `maxZ=${maxZ}`);
});

test('too low a jump still hits the blocker (airborne contact)', () => {
  const r = jump({ elev: 10, v0: 3 });
  assert.ok(r.events.some((e) => e.type === 'ball'));
});

test('jumping hard over the rail sends the ball off the table', () => {
  const cue = createBall(0, 1.0, 0);
  strike(cue, 0, 5, 0, 0, rad(40));
  const r = simulate([cue], { tMax: 2 });
  assert.ok(r.events.some((e) => e.type === 'off' && e.id === 0));
});

test('ball comes to rest on the cloth after landing', () => {
  const r = jump({});
  const f = r.final[0];
  assert.equal(f.z, 0);
  assert.equal(f.vz, 0);
});
