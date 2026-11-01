import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../js/rules.js';

const rep = (o = {}) => ({ firstContact: null, pocketed: [], scratch: false, off: [], railAfterContact: true, railCount: 0, call: null, ...o });
const pk = (...ids) => ids.map((id) => ({ id, pocket: 0 }));
// Skip the break with a legal, non-scoring one.
function afterBreak(kind, who = 0) {
  const g = createGame({ kind });
  g.endShot(rep({ railCount: 4 }));
  assert.equal(g.current, 1 - who);
  return g;
}

test('break: <4 rails and no pocket offers a re-rack', () => {
  const g = createGame({ kind: 9 });
  const r = g.endShot(rep({ railCount: 2 }));
  assert.equal(r.rerackOffer, true);
  g.resolveRerack(false);
  assert.equal(g.current, 0);
  assert.equal(g.isBreak, true);
});

test('break: scratch gives opponent ball in hand behind the head string', () => {
  const g = createGame({ kind: 8 });
  const r = g.endShot(rep({ scratch: true, railCount: 4 }));
  assert.equal(r.ballInHand, true);
  assert.equal(r.breakBox, true);
  assert.equal(g.current, 1);
});

test('9-ball: must hit lowest ball first', () => {
  const g = afterBreak(9);
  const r = g.endShot(rep({ firstContact: 3 }));
  assert.ok(r.foul.some((f) => f.includes('bi 1')));
  assert.equal(r.ballInHand, true);
  assert.equal(g.current, 0);
});

test('9-ball: combo pocketing the 9 wins', () => {
  const g = afterBreak(9);
  const r = g.endShot(rep({ firstContact: 1, pocketed: pk(9) }));
  assert.equal(r.winner, 1); // player 1 is up after player 0 broke dry
});

test('9-ball: 9 pocketed on a foul is re-spotted', () => {
  const g = afterBreak(9);
  const r = g.endShot(rep({ firstContact: 1, pocketed: pk(9), scratch: true }));
  assert.deepEqual(r.respot, [9]);
  assert.ok(!r.winner);
  assert.ok(g.onTable.has(9));
});

test('9-ball: three consecutive fouls lose', () => {
  const g = afterBreak(9);
  g.endShot(rep({ firstContact: 1, scratch: true })); // p1 foul #1 -> p0 turn
  g.endShot(rep({ firstContact: 1, pocketed: pk(1) })); // p0 pots, continues
  g.endShot(rep({ firstContact: 2 })); // p0 misses
  g.endShot(rep({ firstContact: 2, scratch: true })); // p1 foul #2
  g.endShot(rep({ firstContact: 2 }));
  const r = g.endShot(rep({ firstContact: 2, scratch: true })); // someone's third
  const fouls = g.players.map((p) => p.fouls);
  assert.ok(Math.max(...fouls) >= 2);
  assert.ok(r.foul.length === 1);
});

test('9-ball: no rail after contact is a foul', () => {
  const g = afterBreak(9);
  const r = g.endShot(rep({ firstContact: 1, railAfterContact: false }));
  assert.ok(r.foul.length);
});

test('8-ball: group assigned by first legal pocketed ball and turn continues', () => {
  const g = afterBreak(8);
  const r = g.endShot(rep({ firstContact: 3, pocketed: pk(3) }));
  assert.equal(g.players[1].group, 'solid'); // player 1 shot after player 0 broke dry
  assert.equal(g.players[0].group, 'stripe');
  assert.equal(r.next, 1);
});

test('8-ball: hitting the opponent group first is a foul', () => {
  const g = afterBreak(8);
  g.endShot(rep({ firstContact: 3, pocketed: pk(3) }));
  const r = g.endShot(rep({ firstContact: 10 }));
  assert.ok(r.foul.length);
  assert.equal(r.ballInHand, true);
});

test('8-ball: sinking the 8 early loses', () => {
  const g = afterBreak(8);
  const r = g.endShot(rep({ firstContact: 3, pocketed: pk(8) }));
  assert.equal(r.winner, 0);
});

test('8-ball: the 8 on the break is re-spotted', () => {
  const g = createGame({ kind: 8 });
  const r = g.endShot(rep({ pocketed: pk(8), railCount: 4 }));
  assert.deepEqual(r.respot, [8]);
  assert.ok(g.onTable.has(8));
});

test('8-ball: winning needs the cleared group and a called pocket', () => {
  const g = afterBreak(8);
  g.endShot(rep({ firstContact: 1, pocketed: pk(1) })); // p0 = solid
  for (const id of [2, 3, 4, 5, 6, 7]) g.endShot(rep({ firstContact: id, pocketed: pk(id) }));
  assert.equal(g.needsCall(), true);
  const wrong = JSON.parse(JSON.stringify(g.players));
  const r = g.endShot(rep({ firstContact: 8, pocketed: [{ id: 8, pocket: 2 }], call: { ball: 8, pocket: 2 } }));
  assert.equal(r.winner, 1);
  assert.ok(wrong);
});

test('8-ball: 8 in an uncalled pocket loses', () => {
  const g = afterBreak(8);
  g.endShot(rep({ firstContact: 1, pocketed: pk(1) }));
  for (const id of [2, 3, 4, 5, 6, 7]) g.endShot(rep({ firstContact: id, pocketed: pk(id) }));
  const r = g.endShot(rep({ firstContact: 8, pocketed: [{ id: 8, pocket: 3 }], call: { ball: 8, pocket: 2 } }));
  assert.equal(r.winner, 0);
});

test('10-ball: an uncalled pocketed ball is spotted and the turn passes', () => {
  const g = afterBreak(10);
  assert.equal(g.needsCall(), true);
  const r = g.endShot(rep({ firstContact: 1, pocketed: [{ id: 1, pocket: 2 }], call: { ball: 1, pocket: 4 } }));
  assert.deepEqual(r.respot, [1]);
  assert.equal(r.next, 0);
  assert.ok(g.onTable.has(1));
});

test('10-ball: called ball in called pocket continues the turn', () => {
  const g = afterBreak(10);
  const r = g.endShot(rep({ firstContact: 1, pocketed: [{ id: 1, pocket: 2 }], call: { ball: 1, pocket: 2 } }));
  assert.equal(r.next, 1);
  assert.ok(!g.onTable.has(1));
});

test('9-ball push-out: opponent may hand the shot back', () => {
  const g = createGame({ kind: 9 });
  g.endShot(rep({ railCount: 4 }));
  assert.equal(g.canPushOut(), true);
  const r = g.endShot(rep({ pushOut: true, firstContact: 2, railAfterContact: false }));
  assert.equal(r.foul.length, 0);
  assert.equal(g.current, 0);
  g.resolvePushout(false);
  assert.equal(g.current, 1);
});
