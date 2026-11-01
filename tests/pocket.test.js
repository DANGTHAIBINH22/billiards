import test from 'node:test';
import assert from 'node:assert/strict';
import { createBall, simulate, POCKETS, R } from '../js/physics.js';

// Fraction of aim angles (within +-15 deg of the pocket centre line) that pot a rolling ball.
function window(ox, oy, idx) {
  const t = POCKETS[idx];
  const u = Math.atan2(t.y - oy, t.x - ox);
  let ok = 0;
  for (let a = -15; a <= 15; a += 0.5) {
    const d = u + (a * Math.PI) / 180;
    const o = createBall(1, ox, oy);
    o.vx = 1.5 * Math.cos(d); o.vy = 1.5 * Math.sin(d); o.wx = -o.vy / R; o.wy = o.vx / R;
    if (simulate([o], { tMax: 3 }).events.some((e) => e.type === 'pocket' && e.pocket === idx)) ok++;
  }
  return ok * 0.5;
}

test('side pocket accepts balls over a real angular window (regression: cushion used to block the mouth)', () => {
  assert.ok(window(0.35, 0.2, 5) >= 5);
  assert.ok(window(0.2, 0.0, 5) >= 5);
});

test('corner pocket has a window too', () => {
  assert.ok(window(1.0, 0.3, 3) >= 4);
});

test('a ball aimed at the cushion beside the pocket still bounces', () => {
  const o = createBall(1, 0.5, 0);
  o.vx = 0; o.vy = 2; o.wx = -2 / R;
  const r = simulate([o], { tMax: 1.5 });
  assert.ok(r.events.some((e) => e.type === 'cushion'));
  assert.ok(!r.events.some((e) => e.type === 'pocket'));
});
