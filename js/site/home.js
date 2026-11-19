// Home page: the full lesson menu with progress, and the "start / continue" button.
import { loadCatalog, byGroup } from './catalog.js';
import { canOpenLesson, getEntitlements } from './access.js';
import { readProgress, isPassed, nextLesson, PROGRESS_KEY } from './progress.js';

const $ = (id) => document.getElementById(id);
export const lessonUrl = (id) => `/bai-hoc/?id=${encodeURIComponent(id)}`;

// Fixed markup only; lesson text always goes in through textContent.
const ICONS = {
  check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5"/></svg>',
  lock: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/></svg>',
  go: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>',
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function status(kind, label) {
  const s = el('span', 'row-status');
  s.innerHTML = ICONS[kind];
  s.append(el('span', '', label));
  return s;
}

function lessonRow(lesson, progress, ent) {
  const passed = isPassed(lesson.id, progress);
  const locked = !canOpenLesson(lesson, ent);
  const a = el('a', `row${passed ? ' passed' : ''}${locked ? ' locked' : ''}`);
  a.href = lessonUrl(lesson.id);
  const num = el('span', 'row-num', String(lesson.order));
  num.setAttribute('aria-hidden', 'true');
  const body = el('span');
  body.append(el('span', 'row-title', lesson.title), el('span', 'row-summary', lesson.summary));
  a.append(num, body, locked ? status('lock', 'Gói Pro') : passed ? status('check', 'Đã đạt') : status('go', 'Vào bài'));
  const li = el('li');
  li.append(a);
  return li;
}

function renderCatalog(lessons, progress, ent) {
  const root = $('catalog');
  root.setAttribute('aria-busy', 'false');
  if (!lessons.length) {
    const box = el('div', 'state');
    box.append(el('p', '', 'Chưa có bài học nào.'));
    root.replaceChildren(box);
    return;
  }
  root.replaceChildren(...byGroup(lessons).map((g) => {
    const section = el('section', 'group');
    const h = el('h3', '', g.title);
    h.append(el('small', '', `${g.lessons.length} bài`));
    const list = el('ol', 'rows');
    list.append(...g.lessons.map((l) => lessonRow(l, progress, ent)));
    section.append(h, list);
    return section;
  }));
  $('lessonsCount').textContent = `${lessons.length} bài, ${byGroup(lessons).length} nhóm`;
}

function renderStart(lessons, progress, ent) {
  const done = lessons.filter((l) => isPassed(l.id, progress)).length;
  const next = nextLesson(lessons, progress, (l) => canOpenLesson(l, ent));
  const btn = $('startBtn');
  const line = $('progressLine');
  if (!lessons.length) return;
  if (!done) {
    btn.textContent = 'Bắt đầu bài đầu tiên';
    btn.href = lessonUrl((next ?? lessons[0]).id);
    line.hidden = true;
    return;
  }
  line.hidden = false;
  line.replaceChildren(el('b', '', `Đã đạt ${done}/${lessons.length} bài.`), next ? ` Bài kế tiếp: ${next.title}.` : ' Bạn đã qua hết các bài đang mở.');
  btn.textContent = next ? `Học tiếp: ${next.title}` : 'Ôn lại từ bài đầu';
  btn.href = lessonUrl((next ?? lessons[0]).id);
}

function renderError(message) {
  const root = $('catalog');
  root.setAttribute('aria-busy', 'false');
  const box = el('div', 'state');
  box.setAttribute('role', 'alert');
  const retry = el('button', 'btn', 'Thử lại');
  retry.type = 'button';
  retry.addEventListener('click', boot);
  box.append(el('p', '', `${message}. Giả lập vẫn dùng được.`), retry);
  root.replaceChildren(box);
}

let lessons = null;
function paint() {
  if (!lessons) return;
  const progress = readProgress();
  const ent = getEntitlements();
  renderCatalog(lessons, progress, ent);
  renderStart(lessons, progress, ent);
}

async function boot() {
  try {
    lessons = await loadCatalog();
  } catch (err) {
    renderError(err.message);
    return;
  }
  paint();
}

// Progress changes in another tab, or on the lesson page the visitor comes back from.
addEventListener('storage', (e) => { if (e.key === PROGRESS_KEY || e.key === null) paint(); });
addEventListener('pageshow', (e) => { if (e.persisted) paint(); });
boot();
