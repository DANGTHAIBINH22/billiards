// Lesson page: the explanation beside the embedded practice table, with progress and next/previous.
import { loadCatalog, neighbours } from './catalog.js';
import { canOpenLesson, getEntitlements } from './access.js';
import { readProgress, isPassed, PROGRESS_KEY } from './progress.js';

const $ = (id) => document.getElementById(id);
const lessonUrl = (id) => `/bai-hoc/?id=${encodeURIComponent(id)}`;
const CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5"/></svg>';

function show(id) {
  for (const key of ['loading', 'failed', 'missing', 'view']) $(key).hidden = key !== id;
}

function pagerLink(node, lesson, prefix) {
  node.hidden = !lesson;
  if (!lesson) return;
  node.href = lessonUrl(lesson.id);
  node.firstElementChild.textContent = `${prefix} ${lesson.title}`;
}

let current = null; // { lesson, next, locked }

function paintResult() {
  if (!current || current.locked) return;
  const passed = isPassed(current.lesson.id, readProgress());
  const box = $('result');
  box.className = `result${passed ? ' passed' : ''}`;
  if (passed) {
    box.innerHTML = CHECK;
    box.append(current.next ? 'Đã đạt. Sang bài tiếp theo được rồi.' : 'Đã đạt. Đây là bài cuối trong danh mục.');
  } else {
    box.textContent = 'Chưa đạt bài này.';
  }
  // Once passed, the way forward becomes the main action.
  $('next').classList.toggle('primary', passed);
}

function render(lessons, id) {
  const { lesson, prev, next } = neighbours(lessons, id);
  if (!lesson) {
    document.title = 'Không tìm thấy bài học · Bida 3D Pro';
    show('missing');
    $('missing').querySelector('h1').focus(); // announce the dead end instead of leaving focus on the body
    return;
  }
  const locked = !canOpenLesson(lesson, getEntitlements());
  current = { lesson, next, locked };

  document.title = `${lesson.title} · Bida 3D Pro`;
  $('crumbGroup').textContent = lesson.groupTitle;
  $('title').textContent = lesson.title;
  $('summary').textContent = lesson.summary;
  $('intro').textContent = lesson.intro;
  pagerLink($('prev'), prev, '← Bài trước:');
  pagerLink($('next'), next, 'Bài sau:');

  $('stage').hidden = locked;
  $('lock').hidden = !locked;
  $('howto').hidden = locked;
  $('result').hidden = locked;
  if (!locked) {
    // The lesson file is only requested once the visitor may open it.
    const q = `?lesson=${encodeURIComponent(lesson.id)}`;
    $('sim').src = `/gia-lap/${q}&embed=1`;
    $('fullLink').href = `/gia-lap/${q}`;
    paintResult();
  }
  show('view');
}

async function boot() {
  show('loading');
  const id = new URLSearchParams(location.search).get('id') ?? '';
  let lessons;
  try {
    lessons = await loadCatalog();
  } catch (err) {
    $('failedText').textContent = `${err.message}.`;
    show('failed');
    return;
  }
  render(lessons, id);
}

$('retry').addEventListener('click', boot);
// The embedded table writes progress when the learner passes; this page hears it as a storage event.
addEventListener('storage', (e) => { if (e.key === PROGRESS_KEY || e.key === null) paintResult(); });
addEventListener('pageshow', (e) => { if (e.persisted) paintResult(); });
boot();
