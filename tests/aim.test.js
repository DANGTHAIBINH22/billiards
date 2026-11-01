import test from 'node:test';
import assert from 'node:assert/strict';
import { createBall, POCKETS } from '../js/physics.js';
import { predict, cutShot, aimForThickness, aimForPocket, thicknessFraction, cutFromThickness } from '../js/aim.js';

const setup = (cue, obj) => { const c = createBall(0, cue.x, cue.y); const o = createBall(1, obj.x, obj.y); return [c, o]; };
const shot = (angle) => ({ angle, speed: 1.5, a: 0, b: 0 });

test('thickness fractions and cut angles match the usual table', () => {
  assert.equal(thicknessFraction(0.5), '1/2');
  assert.equal(thicknessFraction(0.76), '3/4');
  assert.equal(thicknessFraction(1), '1/1');
  assert.ok(Math.abs(cutFromThickness(0.5) - 30) < 1e-9);
  assert.ok(Math.abs(cutFromThickness(0.25) - 48.59) < 0.01);
});

test('aimForThickness produces the requested overlap in the real prediction', () => {
  const [c, o] = setup({ x: -0.8, y: -0.1 }, { x: 0.2, y: 0.05 });
  for (const t of [1, 0.75, 0.5, 0.25, 0.125]) {
    for (const side of [1, -1]) {
      const { info } = predict([c, o], shot(aimForThickness(c, o, t, side)), 1);
      assert.ok(info.hit, `hit t=${t}`);
      assert.ok(Math.abs(info.thickness - t) < 0.005, `t=${t} got ${info.thickness}`);
      if (t < 1) assert.equal(Math.sign(info.cut), side);
    }
  }
});

test('aimForPocket sends the object ball into the side pocket', () => {
  for (const [obj, idx, cut] of [[{ x: 0.25, y: 0.3 }, 5, 25], [{ x: 0.3, y: -0.25 }, 4, 20], [{ x: -0.35, y: 0.2 }, 5, 15]]) {
    const start = cutShot(obj, POCKETS[idx], cut, 0.6);
    const [c, o] = setup(start.cue, obj);
    const r = aimForPocket(c, o, POCKETS[idx], { balls: [c, o], shot: { speed: 2.5, a: 0, b: 0 }, tMax: 4 });
    assert.ok(r);
    assert.ok(Math.abs(Math.abs(r.cut) - cut) < 4);
    const { info } = predict([c, o], { ...shot(r.angle), speed: 2.5 }, 4);
    assert.equal(info.pocketOf[1], idx);
  }
});
