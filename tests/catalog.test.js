import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { flatten, neighbours, byGroup, isKnownTier, loadCatalog } from '../js/site/catalog.js';
import { canOpenLesson } from '../js/site/access.js';

const index = JSON.parse(readFileSync(new URL('../lessons/index.json', import.meta.url), 'utf8'));

test('the real catalogue flattens in order, with everything a page needs', () => {
  const lessons = flatten(index);
  assert.equal(lessons.length, 10);
  assert.deepEqual(lessons.map((l) => l.order), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const l of lessons) {
    assert.ok(l.summary.length >= 20 && l.summary.length <= 90, `${l.id}: summary is one short line (${l.summary.length})`);
    assert.ok(l.intro.length >= 120, `${l.id}: intro explains the idea`);
    assert.ok(l.groupId && l.groupTitle);
    assert.ok(isKnownTier(l.tier), `${l.id}: tier ${l.tier}`);
  }
});

test('today every lesson is free and opens on the free plan', () => {
  for (const l of flatten(index)) {
    assert.equal(l.tier, 'free', l.id);
    assert.equal(canOpenLesson(l, { plan: 'free' }), true, l.id);
  }
});

test('neighbours follow catalogue order across groups', () => {
  const lessons = flatten(index);
  assert.equal(neighbours(lessons, lessons[0].id).prev, null);
  assert.equal(neighbours(lessons, lessons[0].id).next.id, lessons[1].id);
  assert.equal(neighbours(lessons, lessons[9].id).next, null);
  const mid = neighbours(lessons, 'dung-bi-tranh-roi-lo');
  assert.equal(mid.prev.id, 'cat-30');
  assert.equal(mid.prev.groupId !== mid.lesson.groupId, true);
  assert.deepEqual(neighbours(lessons, 'khong-co'), { lesson: null, prev: null, next: null });
});

test('byGroup restores the sections in order', () => {
  const groups = byGroup(flatten(index));
  assert.deepEqual(groups.map((g) => g.id), index.groups.map((g) => g.id));
  assert.equal(groups.reduce((n, g) => n + g.lessons.length, 0), 10);
});

test('a lesson marked pro or mistyped keeps its tier so the access check can lock it', () => {
  const lessons = flatten({ groups: [{ id: 'g', title: 'G', lessons: [{ id: 'a', title: 'A', tier: 'pro' }, { id: 'b', title: 'B', tier: 'prо-typo' }, { id: 'c', title: 'C' }] }] });
  assert.deepEqual(lessons.map((l) => l.tier), ['pro', 'prо-typo', 'free']);
  assert.deepEqual(lessons.map((l) => canOpenLesson(l, { plan: 'free' })), [false, false, true]);
});

test('a malformed index is rejected with a message for the visitor', () => {
  for (const bad of [null, {}, { groups: 'x' }, { groups: [{ id: 'g' }] }, { groups: [{ id: 'g', title: 'G', lessons: [{ id: 1 }] }] }]) {
    assert.throws(() => flatten(bad), /Danh mục bài học không hợp lệ/);
  }
});

test('loadCatalog reports a failed or slow download in plain words', async () => {
  await assert.rejects(loadCatalog(async () => ({ ok: false })), /Không tải được danh mục bài học/);
  await assert.rejects(loadCatalog(async () => { throw new TypeError('network'); }), /Không tải được danh mục bài học/);
  await assert.rejects(loadCatalog(async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; }), /quá lâu/);
  const ok = await loadCatalog(async (url) => { assert.equal(url, '/lessons/index.json'); return { ok: true, json: async () => index }; });
  assert.equal(ok.length, 10);
});
