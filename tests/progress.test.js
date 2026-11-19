import test from 'node:test';
import assert from 'node:assert/strict';
import { PROGRESS_KEY, readProgress, markPassed, isPassed, nextLesson } from '../js/site/progress.js';

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}

test('nothing stored reads as no progress', () => {
  assert.deepEqual(readProgress(fakeStorage()), { v: 1, passed: {} });
  assert.deepEqual(readProgress(null), { v: 1, passed: {} });
});

test('a pass is stored once, with the time of the first pass', () => {
  const s = fakeStorage();
  assert.equal(markPassed('tro-ve', s, new Date('2026-11-19T10:00:00Z')), true);
  assert.equal(markPassed('tro-ve', s, new Date('2026-12-01T10:00:00Z')), true);
  const p = readProgress(s);
  assert.equal(p.passed['tro-ve'], '2026-11-19T10:00:00.000Z');
  assert.equal(isPassed('tro-ve', p), true);
  assert.equal(isPassed('cat-30', p), false);
});

test('corrupt or foreign data is ignored instead of breaking the page', () => {
  for (const raw of ['not json', '[]', '{"v":2,"passed":{"a":"x"}}', '{"v":1,"passed":[1]}', '{"v":1,"passed":null}', 'null']) {
    assert.deepEqual(readProgress(fakeStorage({ [PROGRESS_KEY]: raw })), { v: 1, passed: {} }, raw);
  }
  const mixed = readProgress(fakeStorage({ [PROGRESS_KEY]: '{"v":1,"passed":{"ok":"2026-01-01T00:00:00.000Z","bad":5}}' }));
  assert.deepEqual(Object.keys(mixed.passed), ['ok']);
});

test('a lesson id that looks like an object property is not "passed" by accident, and can still be passed', () => {
  const p = readProgress(fakeStorage());
  assert.equal(isPassed('constructor', p), false);
  assert.equal(isPassed('toString', p), false);
  for (const id of ['constructor', 'tostring', 'hasownproperty', 'valueof']) {
    const s = fakeStorage();
    assert.equal(markPassed(id, s), true);
    assert.equal(isPassed(id, readProgress(s)), true, id);
  }
});

test('storage that is missing or throws does not throw back', () => {
  assert.equal(markPassed('a', null), false);
  assert.equal(markPassed('', fakeStorage()), false);
  const full = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  assert.equal(markPassed('a', full), false);
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => {} };
  assert.deepEqual(readProgress(broken), { v: 1, passed: {} });
});

test('next lesson is the first one not passed that may be opened', () => {
  const lessons = [{ id: 'a' }, { id: 'b', tier: 'pro' }, { id: 'c' }];
  const progress = { v: 1, passed: { a: 'x' } };
  assert.equal(nextLesson(lessons, progress).id, 'b');
  assert.equal(nextLesson(lessons, progress, (l) => l.tier !== 'pro').id, 'c');
  assert.equal(nextLesson(lessons, { v: 1, passed: { a: 'x', b: 'x', c: 'x' } }), null);
});
