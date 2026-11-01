// Rack layouts around the foot spot. Ball ordering follows common tournament practice:
// apex ball (1) on the spot, key ball (8 / 9 / 10) in the middle of the pack.
import { R, TABLE } from './physics.js';

export const FOOT_SPOT = { x: TABLE.hx / 2, y: 0 };
export const HEAD_STRING_X = -TABLE.hx / 2; // break box = everything behind this line

const GAP = 2 * R * 1.0005; // balls nearly touching so the rack is tight
const ROW = (GAP * Math.sqrt(3)) / 2;

export const RACK_KINDS = {
  '15': '15 bi (trơn/sọc)',
  '9low': '9 bi xếp thấp',
  '9high': '9 bi xếp cao',
  '10': '10 bi',
};

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Slots of a pack: rows[i] balls in row i, rows spaced by ROW towards the foot rail. */
function slots(rows, originX) {
  const out = [];
  rows.forEach((n, r) => {
    for (let c = 0; c < n; c++) out.push({ x: originX + r * ROW, y: (c - (n - 1) / 2) * GAP, row: r, col: c, n });
  });
  return out;
}

/**
 * @param kind '15' | '9low' | '9high' | '10'
 * 9low: apex ball on the foot spot (WPA standard). 9high: centre ball (9) on the foot spot.
 * @returns [{id, x, y}] without the cue ball
 */
export function buildRack(kind, seed = Date.now()) {
  const rand = rng(seed);
  let sl;
  const ids = new Array();

  if (kind === '15') {
    sl = slots([1, 2, 3, 4, 5], FOOT_SPOT.x);
    const solid = 2 + Math.floor(rand() * 6); // 2..7
    const stripe = 9 + Math.floor(rand() * 7); // 9..15
    const corners = rand() < 0.5 ? [solid, stripe] : [stripe, solid];
    const rest = shuffle(
      [2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15].filter((i) => i !== solid && i !== stripe),
      rand
    );
    sl.forEach((s) => {
      if (s.row === 0) ids.push(1);
      else if (s.row === 2 && s.col === 1) ids.push(8);
      else if (s.row === 4 && s.col === 0) ids.push(corners[0]);
      else if (s.row === 4 && s.col === 4) ids.push(corners[1]);
      else ids.push(rest.pop());
    });
  } else if (kind === '9low' || kind === '9high') {
    const originX = kind === '9low' ? FOOT_SPOT.x : FOOT_SPOT.x - 2 * ROW;
    sl = slots([1, 2, 3, 2, 1], originX);
    const rest = shuffle([2, 3, 4, 5, 6, 7, 8], rand);
    sl.forEach((s) => {
      if (s.row === 0) ids.push(1);
      else if (s.row === 2 && s.col === 1) ids.push(9);
      else ids.push(rest.pop());
    });
  } else if (kind === '10') {
    sl = slots([1, 2, 3, 4], FOOT_SPOT.x);
    const corners = rand() < 0.5 ? [2, 3] : [3, 2];
    const rest = shuffle([4, 5, 6, 7, 8, 9], rand);
    sl.forEach((s) => {
      if (s.row === 0) ids.push(1);
      else if (s.row === 2 && s.col === 1) ids.push(10);
      else if (s.row === 3 && s.col === 0) ids.push(corners[0]);
      else if (s.row === 3 && s.col === 3) ids.push(corners[1]);
      else ids.push(rest.pop());
    });
  } else {
    throw new Error(`unknown rack ${kind}`);
  }
  return sl.map((s, i) => ({ id: ids[i], x: s.x, y: s.y }));
}

export const HEAD_SPOT = { x: -TABLE.hx / 2, y: 0 };

/** Nearest free position on/behind the foot spot for a re-spotted ball (WPA: as close behind as possible). */
export function spotPosition(occupied) {
  const free = (x, y) => occupied.every((b) => Math.hypot(b.x - x, b.y - y) >= 2 * R);
  for (let x = FOOT_SPOT.x; x <= TABLE.hx - R; x += 0.004) {
    if (free(x, 0)) return { x, y: 0 };
  }
  for (let x = FOOT_SPOT.x; x >= -TABLE.hx + R; x -= 0.004) {
    if (free(x, 0)) return { x, y: 0 };
  }
  return { x: FOOT_SPOT.x, y: 0 };
}
