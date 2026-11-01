import test from 'node:test';
import assert from 'node:assert/strict';
import { R, createBall, strike, simulate } from '../js/physics.js';

function shot({ gap = 0.05, a = 0, b = 0, v0 = 2, cutDeg = 0 }) {
  const cue = createBall(0, -0.5, 0);
  const th = (cutDeg * Math.PI) / 180;
  // Ghost-ball geometry: object ball placed so the cue contacts it at `th` off the line of centres.
  const obj = createBall(1, -0.5 + 2 * R * Math.cos(th) + gap, 2 * R * Math.sin(th));
  strike(cue, 0, v0, a, b);
  return simulate([cue, obj], { tMax: 1.2 });
}

const firstHit = (r) => r.events.find((e) => e.type === 'ball');
const ang = (x, y) => Math.atan2(y, x);

test('stun shot: cue ball nearly stops after a straight hit', () => {
  const r = shot({ gap: 0.03 });
  const ev = firstHit(r);
  assert.ok(ev, 'collision expected');
  assert.ok(Math.hypot(ev.after.ax, ev.after.ay) < 0.25, `cue speed after = ${Math.hypot(ev.after.ax, ev.after.ay)}`);
  assert.ok(ev.after.bx > 1.5);
});

test('follow shot: cue ball keeps rolling forward', () => {
  const r = shot({ gap: 0.03, b: 0.4 });
  const hitX = firstHit(r).ax;
  const maxX = Math.max(...r.paths[0].map((p) => p[0]));
  assert.ok(maxX > hitX + 0.1, `maxX=${maxX} hitX=${hitX}`);
});

test('draw shot: cue ball comes back', () => {
  const r = shot({ gap: 0.03, b: -0.4 });
  const cuePath = r.paths[0];
  const minX = Math.min(...cuePath.map((p) => p[0]));
  const hitX = firstHit(r).ax;
  assert.ok(minX < hitX - 0.05, `minX=${minX} hitX=${hitX}`);
});

test('30 degree cut, no spin: cue/object separate near 90 degrees', () => {
  const ev = firstHit(shot({ gap: 0.03, cutDeg: 30 }));
  let d = Math.abs(ang(ev.after.ax, ev.after.ay) - ang(ev.after.bx, ev.after.by)) * (180 / Math.PI);
  assert.ok(d > 78 && d < 95, `separation = ${d}`);
  // object ball goes roughly along the line of centres (30 deg)
  const objDir = ang(ev.after.bx, ev.after.by) * (180 / Math.PI);
  assert.ok(Math.abs(objDir - 30) < 6, `objDir = ${objDir}`);
});

test('side spin changes cushion rebound angle', () => {
  const run = (a) => {
    const cue = createBall(0, 0, 0);
    strike(cue, Math.PI / 4 + 0.3, 3, a, 0);
    const r = simulate([cue], { tMax: 1.5 });
    return r.events.find((e) => e.type === 'cushion');
  };
  assert.ok(run(0) && run(0.5));
  const p0 = simulate([(() => { const c = createBall(0, 0, 0); strike(c, 1.0, 3, 0, 0); return c; })()], { tMax: 2 }).paths[0].at(-1);
  const p1 = simulate([(() => { const c = createBall(0, 0, 0); strike(c, 1.0, 3, 0.5, 0); return c; })()], { tMax: 2 }).paths[0].at(-1);
  assert.notEqual(p0[0].toFixed(3), p1[0].toFixed(3));
});

test('ball dropping into a corner pocket is reported', () => {
  const cue = createBall(0, 0.9, 0.4);
  strike(cue, Math.atan2(0.635 - 0.4, 1.27 - 0.9), 2, 0, 0);
  const r = simulate([cue], { tMax: 2 });
  assert.ok(r.events.some((e) => e.type === 'pocket' && e.id === 0));
});
