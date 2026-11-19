import test from 'node:test';
import assert from 'node:assert/strict';
import { R, TABLE } from '../js/physics.js';
import { buildRack, FOOT_SPOT } from '../js/racks.js';

const byId = (rack, id) => rack.find((b) => b.id === id);

function assertValid(rack, n) {
  assert.equal(rack.length, n);
  assert.equal(new Set(rack.map((b) => b.id)).size, n, 'unique ids');
  for (const a of rack) {
    assert.ok(Math.abs(a.x) < TABLE.hx - R && Math.abs(a.y) < TABLE.hy - R, 'inside table');
    for (const b of rack) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 2 * R - 1e-9, 'no overlap');
  }
}

test('15-ball: 1 on the foot spot, 8 in the middle, mixed back corners', () => {
  for (let seed = 1; seed < 30; seed++) {
    const r = buildRack('15', seed);
    assertValid(r, 15);
    assert.deepEqual([byId(r, 1).x, byId(r, 1).y], [FOOT_SPOT.x, 0]);
    const eight = byId(r, 8);
    assert.ok(Math.abs(eight.y) < 1e-9 && eight.x > FOOT_SPOT.x);
    const corners = r.filter((b) => b.x > FOOT_SPOT.x + 3.4 * 2 * R * 0.866 && Math.abs(b.y) > 3.9 * R);
    assert.equal(corners.length, 2);
    const kinds = new Set(corners.map((b) => (b.id < 8 ? 's' : 't')));
    assert.equal(kinds.size, 2, 'one solid, one stripe');
  }
});

test('9-ball low: apex on the foot spot, 9 in the centre', () => {
  const r = buildRack('9low', 7);
  assertValid(r, 9);
  assert.equal(byId(r, 1).x, FOOT_SPOT.x);
  assert.ok(Math.abs(byId(r, 9).y) < 1e-9);
  assert.ok(byId(r, 9).x > FOOT_SPOT.x);
});

test('9-ball high: the 9 sits on the foot spot', () => {
  const r = buildRack('9high', 7);
  assertValid(r, 9);
  assert.ok(Math.abs(byId(r, 9).x - FOOT_SPOT.x) < 1e-9);
  assert.ok(byId(r, 1).x < FOOT_SPOT.x);
});

test('10-ball: 1 apex, 10 centre, 2 and 3 in the back corners', () => {
  const r = buildRack('10', 3);
  assertValid(r, 10);
  assert.equal(byId(r, 1).x, FOOT_SPOT.x);
  assert.ok(Math.abs(byId(r, 10).y) < 1e-9);
  const back = r.filter((b) => Math.abs(b.x - byId(r, 2).x) < 1e-9).map((b) => b.id).sort();
  assert.deepEqual([byId(r, 2).y, byId(r, 3).y].map(Math.abs).every((y) => y > 3 * R - 1e-9), true);
  assert.equal(back.length, 4);
});
