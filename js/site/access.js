// The one place that decides what a visitor may open or use.
//
// Today everyone is on the free plan and nothing is locked. When accounts and payments arrive, replace
// getEntitlements() with a call to the server; every page and the simulator already ask here.
//
// On a static site this is presentation only: a lesson file can still be fetched by anyone who knows its
// path. Real protection needs a server that checks the plan before it serves the lesson.

const RANK = { free: 0, pro: 1 };

/** Lowest plan that may use each simulator feature. All free for now. */
export const FEATURES = {
  match: 'free', // two-player games
  share: 'free', // share-link for the table
  fullLines: 'free', // full path prediction
  slowmo: 'free', // slow motion
  breakPower: 'free', // break-speed power scale
};

export function getEntitlements() {
  return { plan: 'free' };
}

const rankOf = (plan) => (typeof plan === 'string' && Object.hasOwn(RANK, plan) ? RANK[plan] : 0);

/**
 * Only a lesson with no tier at all counts as free. Any other value must be exactly a known tier, or the lesson
 * stays locked: a typo or a wrong type in the data must not give content away.
 */
export function canOpenLesson(lesson, ent = getEntitlements()) {
  const tier = lesson?.tier === undefined ? 'free' : lesson.tier;
  if (typeof tier !== 'string' || !Object.hasOwn(RANK, tier)) return false;
  return rankOf(ent.plan) >= RANK[tier];
}

export function canUseFeature(key, ent = getEntitlements()) {
  if (!Object.hasOwn(FEATURES, key)) throw new Error(`unknown feature "${key}"`);
  return rankOf(ent.plan) >= RANK[FEATURES[key]];
}
