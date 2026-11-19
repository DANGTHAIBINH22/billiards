import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createBall, strike, simulate } from '../js/physics.js';
import { validateScenario, shotSpeed, LESSON_ID } from '../js/scenario.js';
import { evaluateGoal } from '../js/lesson.js';

const DIR = new URL('../lessons/', import.meta.url);
const RAD = Math.PI / 180;

// Same strike the app performs for a scenario shot.
function play(sc, shot) {
  const balls = sc.balls.map((b) => createBall(b.id, b.x, b.y));
  strike(balls.find((b) => b.id === 0), shot.angle * RAD, shotSpeed(shot.power, shot.elev > 0), shot.a, shot.b, shot.elev * RAD);
  const sim = simulate(balls, { tMax: 30 });
  return evaluateGoal(sc.goal, sim.events, sim.final);
}

const cut = () => validateScenario({
  v: 1,
  balls: [{ id: 0, x: 0.626, y: -0.269 }, { id: 1, x: 0.8, y: 0.2 }, { id: 2, x: -0.8, y: 0.3 }],
  goal: { pot: [{ ball: 1, pocket: 3 }], firstContact: 1 },
});

test('a potted ball in the right pocket passes every check', () => {
  const res = play(cut(), { angle: 73.09, power: 35, a: 0, b: 0, elev: 0 });
  assert.equal(res.pass, true);
  assert.deepEqual(res.checks.map((c) => c.key), ['pot', 'first', 'scratch']);
});

test('a miss names the failed condition', () => {
  const res = play(cut(), { angle: 69.65, power: 35, a: 0, b: 0, elev: 0 });
  assert.equal(res.pass, false);
  const pot = res.checks.find((c) => c.key === 'pot');
  assert.equal(pot.ok, false);
  assert.match(pot.text, /Bi 1 chưa vào lỗ góc trên-phải/);
  assert.equal(res.checks.find((c) => c.key === 'first').ok, true);
});

test('hitting nothing fails first contact; the wrong ball is named', () => {
  const none = play(cut(), { angle: -90, power: 20, a: 0, b: 0, elev: 0 });
  assert.match(none.checks.find((c) => c.key === 'first').text, /không chạm bi nào/);
  const sc = cut();
  const wrong = play(sc, { angle: Math.atan2(0.3 + 0.269, -0.8 - 0.626) / RAD, power: 50, a: 0, b: 0, elev: 0 });
  assert.match(wrong.checks.find((c) => c.key === 'first').text, /đã chạm bi 2/);
});

test('events decide the result: wrong pocket, scratch, cue ball off the table', () => {
  const goal = validateScenario({ v: 1, balls: [{ id: 0, x: 0, y: 0 }, { id: 1, x: 0.3, y: 0 }], goal: { pot: [{ ball: 1, pocket: 3 }] } }).goal;
  const rest = [{ id: 0, x: 0, y: 0, active: true }];
  const text = (events, key) => evaluateGoal(goal, events, rest).checks.find((c) => c.key === key).text;
  assert.match(text([{ type: 'pocket', id: 1, pocket: 5 }], 'pot'), /vào nhầm lỗ giữa trên/);
  assert.match(text([{ type: 'pocket', id: 1, pocket: 3 }, { type: 'pocket', id: 0, pocket: 3 }], 'scratch'), /Bi cái rơi lỗ/);
  assert.match(text([{ type: 'off', id: 0 }], 'scratch'), /bay khỏi bàn/);
  assert.equal(evaluateGoal(goal, [{ type: 'pocket', id: 1, pocket: 3 }], rest).pass, true);
});

test('cue zone is judged on the resting cue ball; a pocketed cue ball is never inside', () => {
  const goal = { noScratch: false, cueZone: { x: 0.5, y: 0, r: 0.1 } };
  assert.equal(evaluateGoal(goal, [], [{ id: 0, x: 0.55, y: 0.05, active: true }]).pass, true);
  const far = evaluateGoal(goal, [], [{ id: 0, x: 0.9, y: 0, active: true }]);
  assert.equal(far.pass, false);
  assert.match(far.checks[0].text, /cách vùng mục tiêu 30 cm/);
  assert.equal(evaluateGoal(goal, [], [{ id: 0, x: 0.5, y: 0, active: false }]).pass, false);
});

// Every shipped lesson must be solvable by its own model shot, and must not open already solved.
for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json'))) {
  test(`lesson ${file}: valid, demo passes, starting shot does not`, () => {
    const sc = validateScenario(JSON.parse(readFileSync(new URL(file, DIR), 'utf8')));
    assert.match(sc.id, LESSON_ID);
    assert.equal(`${sc.id}.json`, file);
    assert.ok(sc.title && sc.prompt && sc.goal && sc.demo, 'lesson needs title, prompt, goal and demo');
    const demo = play(sc, sc.demo);
    assert.equal(demo.pass, true, `demo fails: ${demo.checks.filter((c) => !c.ok).map((c) => c.text).join('; ')}`);
    assert.equal(play(sc, sc.shot).pass, false, 'starting shot already solves the lesson');
  });
}
