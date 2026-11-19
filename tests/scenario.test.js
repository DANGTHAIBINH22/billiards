import test from 'node:test';
import assert from 'node:assert/strict';
import { R, TABLE, createBall } from '../js/physics.js';
import { buildRack } from '../js/racks.js';
import { validateScenario, encodeScenario, decodeScenario, scenarioFromState, shotToState, shotSpeed, MAX_ENCODED } from '../js/scenario.js';

const base = () => ({
  v: 1,
  title: 'Cắt 30° vào lỗ góc',
  prompt: 'Đưa bi 1 vào lỗ góc trên-phải.',
  balls: [{ id: 1, x: 0.55, y: -0.05 }, { id: 0, x: -0.2, y: 0.1 }],
  shot: { angle: 20, power: 35, a: 0, b: 0 },
  demo: { angle: 31.4, power: 40, a: 0, b: -0.1 },
  goal: { pot: [{ ball: 1, pocket: 3 }], firstContact: 1, cueZone: { x: 0.2, y: 0.1, r: 0.2 } },
});

test('a valid scenario is normalised with defaults', () => {
  const s = validateScenario(base());
  assert.deepEqual(s.balls.map((b) => b.id), [0, 1]);
  assert.equal(s.goal.noScratch, true);
  assert.equal(s.lines, 'aim');
  assert.equal(s.view, 'persp');
  assert.equal(s.shot.elev, 0);
  assert.equal(s.id, null);
});

test('encode -> decode round-trips, Vietnamese text included', () => {
  const s = validateScenario(base());
  const str = encodeScenario(s);
  assert.match(str, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeScenario(str), s);
});

test('a scenario without a goal stays a plain table position', () => {
  const s = validateScenario({ v: 1, balls: [{ id: 0, x: 0, y: 0 }] });
  assert.equal(s.goal, null);
  assert.equal(s.demo, null);
  assert.deepEqual(s.shot, { angle: 0, power: 35, a: 0, b: 0, elev: 0 });
});

test('invalid tables are rejected with a reason', () => {
  const bad = (patch, re) => assert.throws(() => validateScenario({ ...base(), ...patch }), re);
  bad({ v: 2 }, /Phiên bản/);
  bad({ balls: [{ id: 1, x: 0, y: 0 }] }, /thiếu bi cái/);
  bad({ balls: [{ id: 0, x: 0, y: 0 }, { id: 1, x: R, y: 0 }] }, /chồng lên nhau/);
  bad({ balls: [{ id: 0, x: TABLE.hx, y: 0 }] }, /ngoài bàn/);
  bad({ balls: [{ id: 0, x: 0, y: 0 }, { id: 0, x: 0.3, y: 0 }] }, /trùng số/);
  bad({ balls: [{ id: 16, x: 0, y: 0 }] }, /Số bi/);
  bad({ balls: [{ id: 0, x: '0', y: 0 }] }, /tọa độ/);
  bad({ balls: [] }, /từ 1 đến 16/);
  bad({ goal: { pot: [{ ball: 5 }] } }, /không có trên bàn/);
  bad({ goal: { pot: [{ ball: 1, pocket: 6 }] } }, /Số lỗ/);
  bad({ goal: { noScratch: true } }, /Mục tiêu trống/);
  bad({ goal: { cueZone: { x: 5, y: 0, r: 0.1 } } }, /ngoài bàn/);
  assert.throws(() => validateScenario(null), /không hợp lệ/);
  assert.throws(() => validateScenario([]), /không hợp lệ/);
});

test('shot numbers are clamped, text is trimmed to its limit', () => {
  const s = validateScenario({ ...base(), title: 'x'.repeat(200), prompt: 'y'.repeat(900), shot: { angle: 725, power: 500, a: 3, b: 4, elev: 5 }, lines: 'everything', view: 'x', id: '../etc' });
  assert.equal(s.title.length, 80);
  assert.equal(s.prompt.length, 400);
  assert.equal(s.shot.angle, 5);
  assert.equal(s.shot.power, 100);
  assert.ok(Math.abs(Math.hypot(s.shot.a, s.shot.b) - 0.5) < 1e-3);
  assert.equal(s.shot.elev, 10);
  assert.equal(s.lines, 'aim');
  assert.equal(s.view, 'persp');
  assert.equal(s.id, null);
});

test('garbage and oversized share payloads are rejected', () => {
  assert.throws(() => decodeScenario('rác!'), /không hợp lệ/);
  assert.throws(() => decodeScenario(''), /không hợp lệ/);
  assert.throws(() => decodeScenario('abcd'), /không hợp lệ/);
  assert.throws(() => decodeScenario(btoa('{"v":1')), /không hợp lệ/);
  assert.throws(() => decodeScenario('A'.repeat(MAX_ENCODED + 1)), /quá dài/);
});

test('a full 15-ball rack survives the share round-trip (touching balls are not "overlapping")', () => {
  const balls = Array.from({ length: 16 }, (_, i) => Object.assign(createBall(i), { active: false }));
  for (const b of buildRack('15', 7)) Object.assign(balls[b.id], { x: b.x, y: b.y, active: true });
  Object.assign(balls[0], { x: -0.6, y: 0.1, active: true });
  const sc = scenarioFromState(balls, { angle: 0.3, power: 85, a: 0.1, b: -0.2 }, false, 0.6);
  assert.equal(sc.balls.length, 16);
  const str = encodeScenario(sc);
  assert.ok(str.length < MAX_ENCODED, `share payload is ${str.length} chars`);
  const back = decodeScenario(str);
  assert.deepEqual(back, sc);
  for (const b of back.balls) assert.ok(Math.abs(b.x - balls[b.id].x) < 1e-5 && Math.abs(b.y - balls[b.id].y) < 1e-5);
});

test('scenario shot <-> app shot conversion keeps the jump cue', () => {
  const sc = scenarioFromState([Object.assign(createBall(0), { x: 0, y: 0 })], { angle: Math.PI / 6, power: 60, a: 0, b: 0.2 }, true, (40 * Math.PI) / 180);
  assert.equal(sc.shot.angle, 30);
  assert.equal(sc.shot.elev, 40);
  const st = shotToState(sc.shot);
  assert.ok(Math.abs(st.shot.angle - Math.PI / 6) < 1e-6);
  assert.equal(st.jump, true);
  assert.ok(Math.abs(st.elev - (40 * Math.PI) / 180) < 1e-9);
  assert.equal(shotToState(validateScenario(base()).shot).jump, false);
});

test('shotSpeed matches the power slider range', () => {
  assert.ok(Math.abs(shotSpeed(100) - 7) < 1e-9);
  assert.ok(Math.abs(shotSpeed(100, true) - 5.5) < 1e-9);
  assert.ok(Math.abs(shotSpeed(100, false, true) - 10.5) < 1e-9);
  assert.ok(Math.abs(shotSpeed(1, false, true) - shotSpeed(1)) < 0.05, 'the soft end barely moves');
});

test('break power travels with a scenario shot, and is absent unless set', () => {
  const plain = validateScenario(base());
  assert.equal('breakPower' in plain.shot, false);
  const brk = validateScenario({ ...base(), shot: { angle: 0, power: 90, breakPower: true } });
  assert.equal(brk.shot.breakPower, true);
  assert.deepEqual(decodeScenario(encodeScenario(brk)), brk);
  assert.equal(shotToState(brk.shot).breakPower, true);
  assert.equal(shotToState(plain.shot).breakPower, false);
  assert.equal('breakPower' in validateScenario({ ...base(), shot: { elev: 30, breakPower: true } }).shot, false, 'a jump shot is never a break');
  const live = scenarioFromState([Object.assign(createBall(0), { x: 0, y: 0 })], { angle: 0, power: 80, a: 0, b: 0 }, false, 0, true);
  assert.equal(live.shot.breakPower, true);
});
