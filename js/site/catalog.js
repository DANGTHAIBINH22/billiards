// The lesson catalogue: lessons/index.json turned into an ordered list the pages can render.

const TIMEOUT = 8000;
const TIERS = ['free', 'pro'];

/** Flat, ordered lessons with their group. Throws when the index is not shaped as expected. */
export function flatten(index) {
  if (!index || !Array.isArray(index.groups)) throw new Error('Danh mục bài học không hợp lệ');
  const lessons = [];
  for (const g of index.groups) {
    if (!g || typeof g.id !== 'string' || typeof g.title !== 'string' || !Array.isArray(g.lessons)) throw new Error('Danh mục bài học không hợp lệ');
    for (const l of g.lessons) {
      if (!l || typeof l.id !== 'string' || typeof l.title !== 'string') throw new Error('Danh mục bài học không hợp lệ');
      lessons.push({
        id: l.id,
        title: l.title,
        summary: typeof l.summary === 'string' ? l.summary : '',
        intro: typeof l.intro === 'string' ? l.intro : '',
        // Keep an unrecognised tier as written: access.js treats it as locked.
        tier: l.tier === undefined ? 'free' : l.tier,
        groupId: g.id,
        groupTitle: g.title,
        order: lessons.length + 1,
      });
    }
  }
  return lessons;
}

export const isKnownTier = (tier) => TIERS.includes(tier);

/** The lesson with this id and the ones before and after it in catalogue order. */
export function neighbours(lessons, id) {
  const i = lessons.findIndex((l) => l.id === id);
  if (i < 0) return { lesson: null, prev: null, next: null };
  return { lesson: lessons[i], prev: lessons[i - 1] ?? null, next: lessons[i + 1] ?? null };
}

/** Lessons grouped again, for rendering section by section. */
export function byGroup(lessons) {
  const groups = [];
  for (const l of lessons) {
    let g = groups[groups.length - 1];
    if (!g || g.id !== l.groupId) groups.push((g = { id: l.groupId, title: l.groupTitle, lessons: [] }));
    g.lessons.push(l);
  }
  return groups;
}

export async function loadCatalog(fetchImpl = fetch) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  let index;
  try {
    const res = await fetchImpl('/lessons/index.json', { signal: ctl.signal });
    if (!res.ok) throw new Error('http');
    index = await res.json();
  } catch (err) {
    throw new Error(err.name === 'AbortError' ? 'Tải danh mục bài học quá lâu' : 'Không tải được danh mục bài học');
  } finally {
    clearTimeout(timer);
  }
  return flatten(index);
}
