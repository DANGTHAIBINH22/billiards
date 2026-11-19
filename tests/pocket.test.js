import test from 'node:test';
import assert from 'node:assert/strict';
import { createBall, simulate, POCKETS, KNUCKLES, KNUCKLE_R, CORNER_K, SIDE_K, TABLE, R } from '../js/physics.js';

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

test('pocket mouths are WPA size between the knuckle surfaces: corner 4.5 in, side 5 in', () => {
  const corner = CORNER_K * Math.SQRT2 - 2 * KNUCKLE_R;
  const side = 2 * SIDE_K - 2 * KNUCKLE_R;
  assert.ok(Math.abs(corner - 0.1143) < 0.001, `corner mouth ${(corner * 100).toFixed(2)} cm`);
  assert.ok(Math.abs(side - 0.127) < 0.001, `side mouth ${(side * 100).toFixed(2)} cm`);
  // and the knuckles really sit there
  const near = (p) => KNUCKLES.filter((k) => Math.hypot(k.x - p.x, k.y - p.y) < 0.2);
  const [a, b] = near(POCKETS[3]);
  assert.ok(Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - 2 * KNUCKLE_R - 0.1143) < 0.001);
  const [c, d] = near(POCKETS[5]);
  assert.ok(Math.abs(Math.hypot(c.x - d.x, c.y - d.y) - 2 * KNUCKLE_R - 0.127) < 0.001);
});

// Total angle (deg) over which a sliding ball from `from` drops in pocket `idx`, scanned in 0.1 deg steps.
function sweep(from, idx, speed) {
  const t = POCKETS[idx];
  const u = Math.atan2(t.y - from.y, t.x - from.x);
  let ok = 0;
  for (let a = -10; a <= 10; a += 0.1) {
    const d = u + (a * Math.PI) / 180;
    const o = createBall(1, from.x, from.y);
    o.vx = speed * Math.cos(d); o.vy = speed * Math.sin(d);
    if (simulate([o], { tMax: 20 }).events.some((e) => e.type === 'pocket' && e.pocket === idx)) ok++;
  }
  return ok * 0.1;
}

test('corner pocket takes about 6 deg from the wing-ball spot of a 9-ball rack, slow or fast', () => {
  const wing = { x: TABLE.hx / 2 + 2 * R * Math.sqrt(3), y: -2 * R };
  for (const speed of [0.8, 3]) {
    const w = sweep(wing, 1, speed);
    assert.ok(w >= 5.5 && w <= 6.5, `${speed} m/s: ${w.toFixed(1)} deg`);
  }
});

test('side pocket takes about 10 deg straight in from 0.6 m', () => {
  for (const speed of [0.8, 3]) {
    const w = sweep({ x: 0, y: 0.05 }, 5, speed);
    assert.ok(w >= 9.5 && w <= 10.6, `${speed} m/s: ${w.toFixed(1)} deg`);
  }
});

test('no ball ends up behind a cushion: every shot at a pocket drops or stays on the bed', () => {
  // Deterministic pseudo-random shots aimed around each pocket from all over the table.
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 300; i++) {
    const p = POCKETS[i % 6];
    const from = { x: (rnd() * 2 - 1) * (TABLE.hx - 0.1), y: (rnd() * 2 - 1) * (TABLE.hy - 0.1) };
    const aim = Math.atan2(p.y - from.y + (rnd() - 0.5) * 0.25, p.x - from.x + (rnd() - 0.5) * 0.25);
    const speed = 0.5 + rnd() * 7.5;
    const o = createBall(1, from.x, from.y);
    o.vx = speed * Math.cos(aim); o.vy = speed * Math.sin(aim);
    const b = simulate([o], { tMax: 60 }).final[0];
    if (!b.active) continue;
    // Resting on the bed means inside the nose lines, or hanging in a pocket mouth short of the hole.
    const inMouth = POCKETS.some((q) => Math.hypot(b.x - q.x, b.y - q.y) < q.r + 2 * R);
    const onBed = Math.abs(b.x) <= TABLE.hx - R + 1e-6 && Math.abs(b.y) <= TABLE.hy - R + 1e-6;
    assert.ok(onBed || inMouth, `shot ${i}: ball rests at (${b.x.toFixed(3)}, ${b.y.toFixed(3)})`);
    assert.ok(Math.abs(b.x) < TABLE.hx + 0.05 && Math.abs(b.y) < TABLE.hy + 0.05, `shot ${i}: ball left the table`);
  }
});
