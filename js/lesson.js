// Lesson grading: judges a finished shot against a scenario goal.
// Reads only the engine's event log and the resting balls, so it runs the same in the browser and in tests.

export const POCKET_NAMES = ['góc dưới-trái', 'góc dưới-phải', 'góc trên-trái', 'góc trên-phải', 'giữa dưới', 'giữa trên'];

function checkPot(want, events) {
  const ev = events.find((e) => e.type === 'pocket' && e.id === want.ball);
  const where = want.pocket == null ? '' : ` ${POCKET_NAMES[want.pocket]}`;
  if (!ev) return { key: 'pot', ok: false, text: `Bi ${want.ball} chưa vào lỗ${where}` };
  if (want.pocket != null && ev.pocket !== want.pocket) return { key: 'pot', ok: false, text: `Bi ${want.ball} vào nhầm lỗ ${POCKET_NAMES[ev.pocket]}` };
  return { key: 'pot', ok: true, text: `Bi ${want.ball} vào lỗ${where}` };
}

function checkFirstContact(want, events) {
  const first = events.find((e) => e.type === 'ball' && (e.a === 0 || e.b === 0));
  const hit = first ? (first.a === 0 ? first.b : first.a) : null;
  if (hit === want) return { key: 'first', ok: true, text: `Bi cái chạm bi ${want} trước` };
  return { key: 'first', ok: false, text: `Bi cái phải chạm bi ${want} trước (${hit == null ? 'không chạm bi nào' : `đã chạm bi ${hit}`})` };
}

function checkScratch(events) {
  if (events.some((e) => e.type === 'off' && e.id === 0)) return { key: 'scratch', ok: false, text: 'Bi cái bay khỏi bàn' };
  if (events.some((e) => e.type === 'pocket' && e.id === 0)) return { key: 'scratch', ok: false, text: 'Bi cái rơi lỗ' };
  return { key: 'scratch', ok: true, text: 'Bi cái không rơi lỗ' };
}

function checkRails(want, events) {
  const hit = events.filter((e) => e.type === 'cushion' && e.id === 0).length;
  if (hit >= want) return { key: 'rails', ok: true, text: `Bi cái chạm ${hit} băng` };
  return { key: 'rails', ok: false, text: `Bi cái phải chạm ít nhất ${want} băng (mới chạm ${hit})` };
}

function checkZone(zone, balls) {
  const cue = balls.find((b) => b.id === 0);
  if (!cue || !cue.active) return { key: 'zone', ok: false, text: 'Bi cái không còn trên bàn' };
  const miss = Math.hypot(cue.x - zone.x, cue.y - zone.y) - zone.r;
  if (miss <= 0) return { key: 'zone', ok: true, text: 'Bi cái dừng trong vùng mục tiêu' };
  return { key: 'zone', ok: false, text: `Bi cái dừng cách vùng mục tiêu ${Math.max(1, Math.round(miss * 100))} cm` };
}

/**
 * @param goal normalised scenario goal
 * @param events engine events of the whole shot
 * @param balls balls at rest after the shot
 * @returns {{ pass: boolean, checks: { key: string, ok: boolean, text: string }[] }}
 */
export function evaluateGoal(goal, events, balls) {
  const checks = [];
  for (const want of goal.pot || []) checks.push(checkPot(want, events));
  if (goal.firstContact != null) checks.push(checkFirstContact(goal.firstContact, events));
  if (goal.cueRails != null) checks.push(checkRails(goal.cueRails, events));
  if (goal.cueZone) checks.push(checkZone(goal.cueZone, balls));
  if (goal.noScratch) checks.push(checkScratch(events));
  return { pass: checks.every((c) => c.ok), checks };
}
