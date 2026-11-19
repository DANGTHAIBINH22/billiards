import test from 'node:test';
import assert from 'node:assert/strict';
import { FEATURES, getEntitlements, canOpenLesson, canUseFeature } from '../js/site/access.js';

const free = { plan: 'free' };
const pro = { plan: 'pro' };

test('everyone is on the free plan until accounts exist', () => {
  assert.deepEqual(getEntitlements(), { plan: 'free' });
});

test('a free lesson opens for everyone; a pro lesson only for the pro plan', () => {
  assert.equal(canOpenLesson({ tier: 'free' }, free), true);
  assert.equal(canOpenLesson({ tier: 'free' }, pro), true);
  assert.equal(canOpenLesson({ tier: 'pro' }, free), false);
  assert.equal(canOpenLesson({ tier: 'pro' }, pro), true);
  assert.equal(canOpenLesson({}, free), true, 'no tier means free');
});

test('a lesson with an unrecognised tier stays locked, whatever the plan', () => {
  assert.equal(canOpenLesson({ tier: 'premium' }, free), false);
  assert.equal(canOpenLesson({ tier: 'premium' }, pro), false);
  assert.equal(canOpenLesson({ tier: 1 }, pro), false);
});

test('a tier of the wrong type or named like an object property never unlocks', () => {
  for (const tier of [null, ['free'], ['pro'], {}, 0, false, '', 'Free', 'constructor', '__proto__', 'toString']) {
    assert.equal(canOpenLesson({ tier }, free), false, JSON.stringify(tier));
    assert.equal(canOpenLesson({ tier }, pro), false, JSON.stringify(tier));
  }
  assert.equal(canOpenLesson({ tier: 'pro' }, { plan: ['pro'] }), false, 'a plan must be a string too');
  assert.equal(canOpenLesson({ tier: 'pro' }, { plan: 'constructor' }), false);
});

test('an unrecognised plan is treated as free', () => {
  assert.equal(canOpenLesson({ tier: 'pro' }, { plan: 'gold' }), false);
  assert.equal(canOpenLesson({ tier: 'free' }, { plan: 'gold' }), true);
  assert.equal(canOpenLesson({ tier: 'pro' }, {}), false);
});

test('every declared simulator feature is open today, and a pro-only feature would lock for free', () => {
  assert.deepEqual(Object.keys(FEATURES).sort(), ['breakPower', 'fullLines', 'match', 'share', 'slowmo']);
  for (const key of Object.keys(FEATURES)) {
    assert.equal(canUseFeature(key), true, key);
    assert.equal(canUseFeature(key, pro), true, key);
  }
  const saved = FEATURES.match;
  FEATURES.match = 'pro';
  try {
    assert.equal(canUseFeature('match', free), false);
    assert.equal(canUseFeature('match', pro), true);
  } finally {
    FEATURES.match = saved;
  }
});

test('asking about an undeclared feature is a programming error', () => {
  assert.throws(() => canUseFeature('teleport'), /unknown feature/);
  assert.throws(() => canUseFeature('constructor'), /unknown feature/);
});
