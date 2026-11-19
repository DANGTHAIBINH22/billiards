// Reference breaks, taken from what players see on a real table (docs/research/2026-11-19_tuan-monkey-tong-hop.md).
// The passing tests pin behaviour the engine reproduces, at the hit thickness where the engine produces it. That
// thickness is not always the one players quote: the wing ball drops for a much fuller hit than "2/3 ball".
// The `todo` tests are targets the engine does not reach yet: they run and report, but do not fail the suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import { R, TABLE, createBall, strike, stepWorld } from '../js/physics.js';
import { buildRack } from '../js/racks.js';

const DEG = 180 / Math.PI;
const ROWS = { '9low': [1, 2, 3, 2, 1], '9high': [1, 2, 3, 2, 1], '10': [1, 2, 3, 4] };
const SIDE_POCKET_FAR = 5; // side pocket across the table from the breaker
const CORNER_NEAR = 1; // foot corner on the breaker's side
const HEAD_CORNER_NEAR = 0; // head corner on the breaker's side

/**
 * Break from the head string at y = cueY (the breaker stands on the negative-y side), hitting `thick` of the 1-ball
 * with the cue ball passing on the breaker's side of it, so the cue ball comes off toward the breaker's rail.
 */
function breakShot(kind, cueY, thick, speed, b) {
  const balls = Array.from({ length: 16 }, (_, i) => Object.assign(createBall(i), { active: false }));
  const rack = buildRack(kind, 3);
  for (const s of rack) Object.assign(balls[s.id], { x: s.x, y: s.y, active: true });
  const one = balls[1];
  const cue = Object.assign(balls[0], { x: -TABLE.hx / 2, y: cueY, active: true });
  const d = Math.hypot(one.x - cue.x, one.y - cue.y);
  const angle = Math.atan2(one.y - cue.y, one.x - cue.x) - Math.asin((2 * R * (1 - thick)) / d);
  strike(cue, angle, speed, 0, b);
  const live = balls.filter((q) => q.active);
  const ev = [];
  let first = null;
  for (let t = 0; t < 30; t += 1 / 480) {
    const pre = Math.hypot(cue.vx, cue.vy);
    stepWorld(live, 1 / 480, ev, t);
    if (!first && ev.some((e) => e.type === 'ball')) {
      // State right after the pack has been hit: where every ball is heading.
      first = { cueAlong: (cue.vx * Math.cos(angle) + cue.vy * Math.sin(angle)) / pre, dir: {} };
      for (const q of live) first.dir[q.id] = Math.atan2(q.vy, q.vx) * DEG;
    }
    if (!live.some((q) => q.active && (q.vx || q.vy || q.z > 0 || q.vz))) break;
  }
  const apexX = rack.find((s) => s.id === 1).x; // the 1-ball itself has moved by the time this is asked
  const at = (row, col) => rack.find((s) => Math.abs(s.x - (apexX + row * R * Math.sqrt(3))) < 1e-4 && Math.abs(s.y - (col - (ROWS[kind][row] - 1) / 2) * 2 * R) < 1e-4).id;
  return {
    first,
    at,
    cue,
    pots: Object.fromEntries(ev.filter((e) => e.type === 'pocket').map((e) => [e.id, e.pocket])),
    firstRail: (id) => ev.find((e) => e.type === 'cushion' && e.id === id),
  };
}

const WING = -0.5; // cue ball about 10 cm off the breaker's long rail
const BOX_EDGE = -(0.3175 - R); // outer edge of the cue ball on the break-box line

test('9-ball low rack, wing break at 2/3 ball: the 1-ball goes to the far long rail just short of the side pocket', () => {
  for (const speed of [7, 9]) {
    const r = breakShot('9low', WING, 0.66, speed, -0.25);
    const rail = r.firstRail(1);
    assert.ok(rail && rail.y > 0, 'the 1-ball must reach the far long rail first');
    assert.ok(rail.x > 0.02 && rail.x < 0.35, `${speed} m/s: 1-ball meets the rail at x = ${rail.x.toFixed(2)}`);
    assert.ok(r.first.dir[0] < -30 && r.first.dir[0] > -90, 'the cue ball comes off toward the breaker\'s rail');
  }
});

test('9-ball low rack, hit too thick: the 1-ball drops in the side pocket or lands right beside it', () => {
  for (const thick of [0.8, 0.85, 0.9]) {
    const r = breakShot('9low', WING, thick, 8, -0.25);
    const rail = r.firstRail(1);
    const beside = r.pots[1] === SIDE_POCKET_FAR || (rail && rail.y > 0 && Math.abs(rail.x) < 0.15);
    assert.ok(beside, `thickness ${thick}: 1-ball ${r.pots[1] != null ? `in pocket ${r.pots[1]}` : `on the rail at x = ${rail?.x.toFixed(2)}`}`);
  }
  assert.equal(breakShot('9low', WING, 0.9, 8, -0.25).pots[1], SIDE_POCKET_FAR);
});

test('9-ball low rack, wing break: the near wing ball leaves toward the foot corner on the breaker\'s side', () => {
  // The corner pocket lies at -47 deg from the wing ball and accepts -49.5..-45.3. See the todo below.
  for (const thick of [0.62, 0.66, 0.7]) {
    const r = breakShot('9low', WING, thick, 8, -0.25);
    const dir = r.first.dir[r.at(2, 0)];
    assert.ok(dir < -35 && dir > -50, `thickness ${thick}: wing ball leaves at ${dir.toFixed(1)} deg`);
  }
});

test('9-ball low rack, wing break, full hit on the 1-ball: the near wing ball drops in the foot corner', () => {
  for (const speed of [7, 8, 9]) {
    for (const thick of [0.875, 0.9, 0.925, 0.95]) {
      const r = breakShot('9low', WING, thick, speed, -0.25);
      assert.equal(r.pots[r.at(2, 0)], CORNER_NEAR, `${speed} m/s, thickness ${thick}: wing ball not in the corner`);
    }
  }
});

test('9-ball low rack, wing break just over half ball: the 1-ball goes one rail and drops in the head corner on the breaker\'s side', () => {
  for (const speed of [7, 8, 9]) {
    for (const thick of [0.575, 0.6]) {
      assert.equal(breakShot('9low', WING, thick, speed, -0.25).pots[1], HEAD_CORNER_NEAR, `${speed} m/s, thickness ${thick}`);
    }
  }
});

test('9-ball low rack, wing break at 2/3 ball: the near wing ball drops in the corner (target: 4 of 6)', { todo: 'it drops for hits of 0.875 and fuller; at 0.62-0.70 it leaves 0-9 deg off the pocket line' }, () => {
  let potted = 0;
  for (const speed of [7, 9]) for (const thick of [0.62, 0.66, 0.7]) { const r = breakShot('9low', WING, thick, speed, -0.25); potted += r.pots[r.at(2, 0)] === CORNER_NEAR; }
  assert.ok(potted >= 4, `wing ball potted ${potted}/6`);
});

test('9-ball high rack from the box edge: the 1-ball heads for the far side pocket; thinner lands nearer the foot', () => {
  const xs = [0.4, 0.45, 0.5].map((thick) => {
    const rail = breakShot('9high', BOX_EDGE, thick, 8, -0.3).firstRail(1);
    assert.ok(rail && rail.y > 0 && Math.abs(rail.x) < 0.12, `thickness ${thick}: 1-ball at x = ${rail?.x.toFixed(2)}`);
    return rail.x;
  });
  assert.ok(xs[0] > xs[1] && xs[1] > xs[2], `thinner must land nearer the foot: ${xs.map((x) => x.toFixed(3))}`);
});

test('9-ball high rack from the box edge, a little thicker than half ball: the 1-ball drops in the side pocket', () => {
  // 0.625 is the 5/8-ball aim Vietnamese players credit to Duong Quoc Hoang.
  for (const speed of [7, 8, 9]) {
    for (const thick of [0.55, 0.6, 0.625, 0.65, 0.675]) {
      assert.equal(breakShot('9high', BOX_EDGE, thick, speed, -0.3).pots[1], SIDE_POCKET_FAR, `${speed} m/s, thickness ${thick}`);
    }
  }
});

test('10-ball soft break from near the centre: both second-row balls leave on the lines to the side pockets', () => {
  const r = breakShot('10', -R, 1, 6.5, -0.15);
  for (const col of [0, 1]) {
    const dir = r.first.dir[r.at(1, col)];
    const want = Math.sign(dir) * Math.atan2(TABLE.hy + 0.03, -(TABLE.hx / 2 + R * Math.sqrt(3))) * DEG;
    assert.ok(Math.abs(dir - want) < 4, `second-row ball leaves at ${dir.toFixed(1)}, pocket at ${want.toFixed(1)}`);
  }
});

test('10-ball soft break: follow sends the second-row balls lower than draw does', { todo: 'cue-ball top or back spin does not change their line yet' }, () => {
  const line = (b) => { const r = breakShot('10', -R, 1, 6.5, b); return Math.abs(r.first.dir[r.at(1, 0)]); };
  assert.ok(line(0.15) < line(-0.15) - 0.3);
});

test('square hit on a frozen pack: the cue ball bounces back', () => {
  for (const [kind, min] of [['10', 0.12], ['9low', 0.05]]) {
    const r = breakShot(kind, kind === '10' ? 0 : WING, 1, 8, 0);
    assert.ok(r.first.cueAlong < -min, `${kind}: cue ball keeps ${(r.first.cueAlong * 100).toFixed(1)}% along its line`);
  }
});

test('9-ball low rack, straight break with a little follow: the cue ball rebounds and holds in the middle of the table', () => {
  const r = breakShot('9low', WING, 1, 9, 0.12);
  assert.ok(r.first.cueAlong < 0);
  assert.ok(r.cue.active && Math.abs(r.cue.x) < TABLE.hx / 2, `cue ball rests at (${r.cue.x.toFixed(2)}, ${r.cue.y.toFixed(2)})`);
});
