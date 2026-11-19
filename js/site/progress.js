// Which lessons the learner has passed, kept in this browser.
// Storage is injected so the logic runs in tests, and so an account-backed store can replace it later.

export const PROGRESS_KEY = 'bida.progress.v1';

/** localStorage, or null where it is blocked (private mode, sandboxed frames). */
export function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const empty = () => ({ v: 1, passed: {} });

export function readProgress(storage = browserStorage()) {
  if (!storage) return empty();
  try {
    const raw = JSON.parse(storage.getItem(PROGRESS_KEY));
    if (!raw || raw.v !== 1 || typeof raw.passed !== 'object' || raw.passed === null || Array.isArray(raw.passed)) return empty();
    const passed = {};
    for (const [id, when] of Object.entries(raw.passed)) if (typeof when === 'string') passed[id] = when;
    return { v: 1, passed };
  } catch {
    return empty();
  }
}

/** Record a pass. Returns false when nothing could be stored; the page still works without it. */
export function markPassed(id, storage = browserStorage(), now = new Date()) {
  if (!storage || typeof id !== 'string' || !id) return false;
  const progress = readProgress(storage);
  // hasOwn, not a plain lookup: an id such as "constructor" would otherwise look already passed.
  if (!Object.hasOwn(progress.passed, id)) progress.passed[id] = now.toISOString();
  try {
    storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export const isPassed = (id, progress) => Object.hasOwn(progress.passed, id);

/** First lesson, in catalogue order, that is still to do and may be opened. Null when all are done. */
export function nextLesson(lessons, progress, canOpen = () => true) {
  return lessons.find((l) => !isPassed(l.id, progress) && canOpen(l)) ?? null;
}
