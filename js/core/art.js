// 今天没白过 · 程序化矢量美术：徽章（12系列统一珐琅语言）/ 商品 / 心情
// 素材优先级：assets/ 正式文件 > 内置矢量生成。assets/manifest.json 列出已提供的正式文件。
import { badgeRarity } from './catalog.js';

const rx = (x, y, w, h2, r, f, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h2}" rx="${r}" fill="${f}" ${extra}/>`;
const ci = (cx, cy, r, f, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}" ${extra}/>`;
const el = (cx, cy, rxx, ry, f, extra = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rxx}" ry="${ry}" fill="${f}" ${extra}/>`;
const pa = (d, f = 'none', extra = '') => `<path d="${d}" fill="${f}" ${extra}/>`;
const ln = (d, sw, co, extra = '') => `<path d="${d}" fill="none" stroke="${co}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const pg = (pts, f, extra = '') => `<polygon points="${pts}" fill="${f}" ${extra}/>`;
function starPts(cx, cy, r1, r2, n = 5, rot = -90) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? r1 : r2, a = (rot + (i * 180) / n) * Math.PI / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}
const star = (cx, cy, r, f, extra = '') => pg(starPts(cx, cy, r, r * 0.45), f, extra);

// ---- 母题库（0–100 画布内绘制）----
const M = {
  door: (c, a) => rx(34, 22, 32, 56, 16, 'none', `stroke="${c}" stroke-width="5"`) + ci(60, 50, 3, c) + pa('M34 78h32', 'none', `stroke="${c}" stroke-width="5" stroke-linecap="round"`),
  sun: (c, a) => ci(50, 50, 14, a) + [0, 45, 90, 135, 180, 225, 270, 315].map((d) => ln(`M${50 + 20 * Math.cos(d * Math.PI / 180)} ${50 + 20 * Math.sin(d * Math.PI / 180)}L${50 + 28 * Math.cos(d * Math.PI / 180)} ${50 + 28 * Math.sin(d * Math.PI / 180)}`, 4, c)).join(''),
  key: (c, a) => ci(40, 40, 12, 'none', `stroke="${c}" stroke-width="5"`) + ln('M48 48L70 70', 5, c) + ln('M62 62l6 6M68 56l6 6', 4, c),
  path: (c, a) => ln('M28 76c10-14 4-22 14-32s20-8 30-24', 5, c) + ci(70, 20, 3.4, a) + ci(58, 34, 2.6, a) + ci(44, 52, 2.2, a),
  bell: (c, a) => pa('M32 60c0-16 6-28 18-28s18 12 18 28z', c) + ln('M28 60h44', 5, c) + ci(50, 68, 4.5, a),
  flag: (c, a) => ln('M36 22v56', 5, c) + pa('M36 24l30 8-30 9z', a),
  sprout: (c, a) => ln('M50 78V52', 5, c) + pa('M50 56c-16 2-22-8-20-20 12 0 20 6 20 20z', a) + pa('M50 52c16 2 22-8 20-20-12 0-20 6-20 20z', c),
  cup: (c, a) => rx(34, 38, 28, 26, 8, 'none', `stroke="${c}" stroke-width="5"`) + pa('M62 44c10 0 10 14 0 14', 'none', `stroke="${c}" stroke-width="5"`) + pa('M40 30c2-4-2-6 0-10M50 30c2-4-2-6 0-10', 'none', `stroke="${a}" stroke-width="3.4"`),
  star: (c, a) => star(50, 50, 22, a) + star(50, 50, 12, 'none', `stroke="${c}" stroke-width="2.4" stroke-linejoin="round"`),
  envelope: (c, a) => rx(26, 32, 48, 36, 5, 'none', `stroke="${c}" stroke-width="5"`) + pa('M28 36l22 16 22-16', 'none', `stroke="${a}" stroke-width="4.6"`),
  book: (c, a) => pa('M26 34c8-4 16-4 24 0v40c-8-4-16-4-24 0z', a) + pa('M74 34c-8-4-16-4-24 0v40c8-4 16-4 24 0z', c) + ln('M50 34v40', 3, c),
  lamp: (c, a) => pg('36,26 64,26 58,46 42,46', a) + ln('M50 46v24', 5, c) + rx(36, 70, 28, 6, 3, c) + ci(50, 36, 3, '#FFF8E8'),
  clock: (c, a) => ci(50, 50, 24, 'none', `stroke="${c}" stroke-width="5"`) + ln('M50 50V36M50 50l10 7', 4.4, a) + ci(50, 50, 2.4, c),
  quill: (c, a) => pa('M34 74C44 56 58 38 74 28c-2 18-12 34-30 42z', a) + ln('M36 72c8-12 16-22 26-30', 3, c) + ln('M30 76l6-6', 4, c),
  shelf: (c, a) => ln('M26 40h48M26 62h48', 4.6, c) + rx(30, 26, 8, 14, 2, a) + rx(41, 30, 8, 10, 2, c) + rx(56, 24, 9, 16, 2, a) + rx(31, 48, 8, 14, 2, c) + rx(43, 52, 9, 10, 2, a),
  teacup: (c, a) => rx(32, 40, 30, 20, 8, 'none', `stroke="${c}" stroke-width="5"`) + pa('M62 44c10 0 10 12 0 12', 'none', `stroke="${c}" stroke-width="4.4"`) + ln('M28 68h38', 4.4, c) + pa('M42 32c2-4-2-6 0-10M54 32c2-4-2-6 0-10', 'none', `stroke="${a}" stroke-width="3.2"`),
  ink: (c, a) => rx(34, 48, 32, 24, 6, a) + rx(44, 40, 12, 8, 2, c) + pa('M58 24l14-8-4 16z', c),
  page: (c, a) => pa('M32 24h26l12 12v40H32z', 'none', `stroke="${c}" stroke-width="5"`) + ln('M58 24v12h12', 4.2, a) + ln('M40 48h20M40 56h20M40 64h14', 3.4, a),
  boot: (c, a) => pa('M36 24h16v26c10 2 18 6 18 14v6H36z', a) + ln('M36 70h34', 5, c) + ln('M42 34h8', 3.4, c),
  footprint: (c, a) => el(42, 58, 10, 14, a) + ci(34, 38, 4, c) + ci(44, 34, 4.4, c) + ci(54, 38, 4, c) + el(64, 66, 7, 9, c),
  mountain: (c, a) => pg('20,76 44,34 62,76', c) + pg('52,50 68,76 36,76', a) + pa('M40 42l4-6 4 6-4 4z', '#FFF'),
  tree: (c, a) => ln('M50 74V54', 5, c) + ci(50, 40, 16, a) + ci(38, 48, 10, a) + ci(62, 48, 10, a),
  cloud: (c, a) => pa('M30 62c-8 0-12-6-10-12 2-5 8-7 12-5 1-8 9-13 17-11 7 2 11 8 10 14 7-1 12 4 11 9-1 4-5 5-8 5z', a),
  pot: (c, a) => rx(30, 46, 40, 26, 10, a) + rx(26, 42, 48, 8, 4, c) + ln('M26 50l-6-2M74 50l6-2', 4, c) + pa('M42 34c2-4-2-6 0-10M54 34c2-4-2-6 0-10', 'none', `stroke="${a}" stroke-width="3.2"`),
  plate: (c, a) => ci(50, 52, 24, 'none', `stroke="${c}" stroke-width="5"`) + ci(50, 52, 13, a),
  bread: (c, a) => rx(28, 40, 44, 24, 12, a) + ln('M38 48l6 6M48 44l6 6M58 48l6 6', 3.6, c),
  fire: (c, a) => pa('M50 24c8 10 16 16 16 28a16 16 0 0 1-32 0c0-8 5-12 9-17 1 5 3 8 7 10-1-8 0-14 0-21z', a),
  cake: (c, a) => rx(28, 46, 44, 24, 6, a) + ln('M28 54h44', 3, c) + ln('M50 46V34', 3.4, c) + ci(50, 30, 4, '#E8657A'),
  box: (c, a) => rx(26, 42, 48, 30, 5, a) + ln('M26 52h48', 3.4, c) + rx(44, 36, 12, 16, 2, c),
  window: (c, a) => rx(30, 28, 40, 44, 6, a) + ln('M50 28v44M30 50h40', 4, c) + ln('M26 72h48', 5, c),
  hanger: (c, a) => pa('M50 30c-5 0-7 6-2 8l26 16H26l26-16', 'none', `stroke="${c}" stroke-width="4.6"`) + ln('M26 54h48', 5, a),
  plant: (c, a) => pa('M40 56h20l-3 20H43z', a) + pa('M50 56c-2-14-12-18-20-18 2 12 8 18 20 18z', c) + pa('M50 56c2-14 12-18 20-18-2 12-8 18-20 18z', a),
  broom: (c, a) => ln('M62 24L44 54', 5, c) + pa('M40 56l14-6 8 16-18 6z', a) + ln('M42 66l-6 8M50 68l-4 9M58 64l-2 9', 3, a),
  house: (c, a) => pg('26,50 50,28 74,50', a) + rx(32, 50, 36, 26, 3, 'none', `stroke="${c}" stroke-width="5"`) + rx(45, 58, 10, 18, 2, c),
  flower: (c, a) => [0, 72, 144, 216, 288].map((d) => el(50 + 12 * Math.cos(d * Math.PI / 180), 44 + 12 * Math.sin(d * Math.PI / 180), 8, 8, a)).join('') + ci(50, 44, 6, c) + ln('M50 58v18', 4, c) + pa('M50 68c-8 0-12-4-14-10 8-1 13 3 14 10z', a),
  film: (c, a) => rx(24, 34, 52, 32, 4, a) + [30, 42, 54, 66].map((x) => rx(x, 30, 4, 6, 1, c) + rx(x, 64, 4, 6, 1, c)).join('') + ci(50, 50, 8, c) + ci(50, 50, 3.4, a),
  heart: (c, a) => pa('M50 70C38 62 30 54 30 45c0-7 5-11 11-11 4 0 7 2 9 5 2-3 5-5 9-5 6 0 11 4 11 11 0 9-8 17-20 25z', a),
  camera: (c, a) => rx(26, 38, 48, 32, 8, a) + pg('40,38 44,30 56,30 60,38', a) + ci(50, 54, 10, c) + ci(50, 54, 5, '#FFF8E8'),
  lighthouse: (c, a) => pg('42,34 58,34 64,76 36,76', c) + rx(44, 26, 12, 8, 2, a) + ci(50, 30, 3.4, '#FFF8E8') + ln('M36 34L20 28M64 34l16-6', 3.4, a) + ln('M30 76h40', 5, c),
  map: (c, a) => pa('M26 32l16-6 16 6 16-6v42l-16 6-16-6-16 6z', 'none', `stroke="${c}" stroke-width="4.6"`) + ln('M34 42c8 4 4 12 12 14s6 10 12 12', 3.4, a) + ci(60, 38, 3.4, a),
  anchor: (c, a) => ci(50, 30, 6, 'none', `stroke="${c}" stroke-width="4.6"`) + ln('M50 36v36M36 52h28', 4.6, c) + pa('M32 60c2 10 10 16 18 16s16-6 18-16', 'none', `stroke="${a}" stroke-width="4.6"`),
  compass: (c, a) => ci(50, 50, 24, 'none', `stroke="${c}" stroke-width="5"`) + pg('50,32 56,50 50,68 44,50', a) + ci(50, 50, 3, c),
  ship: (c, a) => pa('M30 56h40l-6 14H36z', a) + ln('M50 56V30', 4.4, c) + pa('M50 30l18 20h-18z', c) + ln('M24 76h52', 4.4, c),
  ledger: (c, a) => rx(28, 24, 44, 52, 6, 'none', `stroke="${c}" stroke-width="5"`) + ln('M36 38h28M36 48h28M36 58h18', 3.6, a) + ci(60, 62, 7, a),
  coin: (c, a) => ci(50, 50, 22, a) + ci(50, 50, 15, 'none', `stroke="${c}" stroke-width="3.4"`) + ln('M44 44l6 8 6-8M50 52v10M45 56h10', 3, c),
  abacus: (c, a) => rx(26, 32, 48, 36, 4, 'none', `stroke="${c}" stroke-width="4.6"`) + ln('M26 44h48M26 56h48', 3, c) + ci(36, 44, 4.4, a) + ci(50, 44, 4.4, a) + ci(60, 56, 4.4, a) + ci(68, 56, 4.4, a),
  paw: (c, a) => el(50, 60, 13, 10, a) + ci(36, 46, 5, c) + ci(45, 40, 5, c) + ci(55, 40, 5, c) + ci(64, 46, 5, c),
  collar: (c, a) => pa('M30 40a24 14 0 0 1 40 0', 'none', `stroke="${c}" stroke-width="7"`) + ci(50, 58, 8, a) + ci(50, 58, 3.4, c),
  bone: (c, a) => ln('M36 50h28', 8, a) + ci(34, 44, 7, a) + ci(34, 56, 7, a) + ci(66, 44, 7, a) + ci(66, 56, 7, a),
  bowl: (c, a) => pa('M28 50h44c0 14-10 22-22 22s-22-8-22-22z', a) + ln('M36 42c2-4-2-6 0-10M50 42c2-4-2-6 0-10', 'none', `stroke="${c}" stroke-width="3.2"`) + ln('M24 50h52', 4.4, c),
  vase: (c, a) => pa('M42 40h16l4 16c2 12-4 20-12 20s-14-8-12-20z', a) + ln('M50 40V26', 3.6, c) + pa('M50 30c-6-2-8-6-8-10 6 0 8 4 8 10zm0 0c6-2 8-6 8-10-6 0-8 4-8 10z', c),
  frame: (c, a) => rx(28, 28, 44, 44, 4, 'none', `stroke="${c}" stroke-width="6"`) + rx(38, 38, 24, 24, 2, a) + ci(46, 46, 4, c),
  rain: (c, a) => pa('M32 44c-8 0-12-6-10-12 2-5 8-7 12-5 1-8 9-13 17-11 7 2 11 8 10 14 7-1 12 4 11 9-1 4-5 5-8 5z', a) + ln('M36 54l-4 10M50 54l-4 10M64 54l-4 10', 3.6, c),
  snow: (c, a) => [0, 60, 120].map((r) => ln(`M${50 - 22 * Math.cos(r * Math.PI / 180)} ${50 - 22 * Math.sin(r * Math.PI / 180)}L${50 + 22 * Math.cos(r * Math.PI / 180)} ${50 + 22 * Math.sin(r * Math.PI / 180)}`, 4, a)).join('') + ci(50, 50, 4, c),
  moon: (c, a) => pa('M62 26a26 26 0 1 0 12 34 22 22 0 0 1-12-34z', a) + star(66, 40, 6, c),
  city: (c, a) => rx(26, 46, 16, 30, 2, c) + rx(44, 34, 16, 42, 2, a) + rx(62, 52, 14, 24, 2, c) + ci(50, 24, 6, a) + ln('M22 76h58', 4, c),
  trophy: (c, a) => pa('M38 28h24v14c0 10-5 16-12 16s-12-6-12-16z', a) + pa('M38 32H28c0 10 4 14 10 14M62 32h10c0 10-4 14-10 14', 'none', `stroke="${c}" stroke-width="4"`) + ln('M50 58v8M42 70h16', 4.6, c) + ci(50, 72, 3.4, a),
  globe: (c, a) => ci(50, 50, 22, 'none', `stroke="${c}" stroke-width="5"`) + el(50, 50, 10, 22, 'none', `stroke="${a}" stroke-width="3.4"`) + ln('M28 50h44', 3.4, a),
  spark: (c, a) => pg(starPts(50, 50, 24, 7, 4), a) + pg(starPts(72, 28, 9, 3, 4), c),
  route: (c, a) => ln('M30 70c12 0 8-16 20-16s8 16 20 16', 5, c) + ci(30, 70, 5, a) + ci(70, 70, 5, a) + ci(50, 54, 5, c),
  folder: (c, a) => pa('M26 34h18l6 8h24v28a4 4 0 0 1-4 4H30a4 4 0 0 1-4-4z', a) + ln('M26 46h48', 3, c),
  scale: (c, a) => ln('M50 28v40M36 72h28', 4.6, c) + ln('M28 38h44', 4.4, c) + pa('M28 38l-8 14h16zM72 38l-8 14h16z', 'none', `stroke="${a}" stroke-width="3.4"`) + ci(50, 72, 3.4, a),
  vault: (c, a) => rx(26, 28, 48, 44, 6, 'none', `stroke="${c}" stroke-width="5"`) + ci(50, 50, 12, 'none', `stroke="${a}" stroke-width="4.4"`) + ln('M50 38v-5M50 67v-5M38 50h-5M67 50h-5', 3.4, a),
};

// ---- 系列（统一边框/材质，主体可辨）----
const SER = {
  '初见启程': { bg: ['#FCF5E5', '#EFDCB2'], ring: ['#E7C87E', '#A87E3B'], ink: '#7A5A28', ac: '#D9A05B', motifs: ['door', 'sun', 'key', 'path', 'bell', 'flag', 'sprout', 'cup', 'star', 'envelope'] },
  '专注书房': { bg: ['#F8EFD9', '#E6CFA0'], ring: ['#9A7B4A', '#5C4322'], ink: '#5C4322', ac: '#B08F45', motifs: ['book', 'lamp', 'clock', 'quill', 'shelf', 'teacup', 'ink', 'page', 'route', 'star'] },
  '步履微光': { bg: ['#EDF5EF', '#CFE4D7'], ring: ['#A3BCAC', '#6E8F7D'], ink: '#3F5C4E', ac: '#6FA88B', motifs: ['boot', 'footprint', 'mountain', 'tree', 'cloud', 'path', 'sun', 'flag', 'sprout', 'star'] },
  '烟火厨房': { bg: ['#FDEDDF', '#F5D3B6'], ring: ['#DD8E62', '#A65B33'], ink: '#8A4B26', ac: '#D78367', motifs: ['pot', 'plate', 'bread', 'fire', 'cup', 'bowl', 'cake', 'spark', 'heart', 'star'] },
  '整洁小屋': { bg: ['#F3F3E7', '#DFE0C8'], ring: ['#AEAE84', '#7C7D55'], ink: '#5C5D3A', ac: '#9AA07B', motifs: ['box', 'window', 'hanger', 'plant', 'broom', 'shelf', 'folder', 'sprout', 'house', 'star'] },
  '心绪花笺': { bg: ['#F9ECF1', '#EDD5E0'], ring: ['#D8AEC2', '#A87690'], ink: '#8A5570', ac: '#C48FB0', motifs: ['envelope', 'flower', 'film', 'page', 'heart', 'quill', 'camera', 'moon', 'bell', 'star'] },
  '目标远航': { bg: ['#E7EEF5', '#C7D8E7'], ring: ['#93A9BF', '#5F7891'], ink: '#39516A', ac: '#5F7891', motifs: ['lighthouse', 'mountain', 'map', 'flag', 'anchor', 'compass', 'ship', 'route', 'star', 'globe'] },
  '收支有序': { bg: ['#E9F1EE', '#CCDFD8'], ring: ['#84A79A', '#54776B'], ink: '#3C5A50', ac: '#5F9B8C', motifs: ['ledger', 'folder', 'abacus', 'coin', 'chart', 'scale', 'vault', 'frame', 'route', 'star'] },
  '伙伴物语': { bg: ['#FBEDE6', '#F3D4C6'], ring: ['#E2AC8E', '#B3765A'], ink: '#8A4F38', ac: '#D78367', motifs: ['paw', 'collar', 'bone', 'bowl', 'heart', 'bell', 'house', 'spark', 'footprint', 'star'] },
  '家园收藏': { bg: ['#F5EFE4', '#E2D6C0'], ring: ['#B5945F', '#7E6438'], ink: '#6B5330', ac: '#D8A94D', motifs: ['shelf', 'key', 'frame', 'box', 'lamp', 'plant', 'vase', 'trophy', 'house', 'star'] },
  '四季印记': { bg: ['#F0F4F7', '#D6E3EB'], ring: ['#ADC3D1', '#7C99AA'], ink: '#4E6B7C', ac: '#7A8FB5', motifs: ['flower', 'rain', 'sprout', 'snow', 'sun', 'cloud', 'leaf4', 'moon', 'star', 'route'] },
  '生活全景': { bg: ['#F1ECF5', '#DBD2E6'], ring: ['#A294BA', '#6F5F88'], ink: '#55466E', ac: '#8B6FA8', motifs: ['city', 'globe', 'sun', 'heart', 'trophy', 'spark', 'star', 'route', 'house', 'frame'] },
};
M.leaf4 = (c, a) => pa('M50 26c10 8 10 22 0 24-10-2-10-16 0-24z', a) + pa('M50 74c-10-8-10-22 0-24 10 2 10 16 0 24z', c) + pa('M26 50c8-10 22-10 24 0-2 10-16 10-24 0z', a) + pa('M74 50c-8 10-22 10-24 0 2-10 16-10 24 0z', c);
M.chart = (c, a) => ln('M28 72h44', 4, c) + rx(34, 56, 8, 14, 2, a) + rx(46, 44, 8, 26, 2, c) + rx(58, 32, 8, 38, 2, a);

const serOf = (b) => SER[b.series] || SER['生活全景'];
let _artInit = false, _overrides = new Set();
export async function initArt() {
  if (_artInit) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const r = await fetch('./assets/manifest.json', { cache: 'no-cache', signal: controller.signal });
    if (!r.ok) throw new Error('美术清单加载失败');
    const j = await r.json();
    _overrides = new Set(j.files || []);
  } catch { _overrides = new Set(); }
  finally { clearTimeout(timeout); }
  // 标记哪些宠物有正式图片
  window.__PET_IMAGES = {};
  for (const p of ['maotuan', 'lili', 'mituan']) {
    if (_overrides.has(`pets/${p}.png`)) window.__PET_IMAGES[p] = true;
  }
  _artInit = true;
}
const hasFile = (rel) => _artInit && _overrides.has(rel);
const dataUri = (svg) => `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' '))}`;

// ---- 徽章 ----
const _badgeCache = new Map();
export function badgeArt(badgeId) {
  if (hasFile(`badges/${badgeId}.png`)) return `./assets/badges/${badgeId}.png`;
  if (hasFile(`badges/${badgeId}.svg`)) return `./assets/badges/${badgeId}.svg`;
  if (_badgeCache.has(badgeId)) return _badgeCache.get(badgeId);
  const b = window.__BADGE_INDEX?.[badgeId];
  const s = b ? serOf(b) : SER['生活全景'];
  const idx = b ? parseInt(badgeId.slice(1), 10) % 10 : 0;
  const motif = s.motifs[idx];
  const rar = badgeRarity(b?.points ?? 10);
  const uidSafe = badgeId.replace(/[^A-Z0-9]/gi, '');
  const starsHtml = rar.stars ? [1, 2, 3].slice(0, rar.stars).map((i) => star(50 + (i - (rar.stars + 1) / 2) * 13, 87, 4.8, '#FFF8E8', `stroke="${s.ring[1]}" stroke-width="0.8"`)).join('') : '';
  const sparkles = [
    star(22, 24, 3.6, '#FFF8E8', 'opacity="0.85"'),
    star(78, 30, 2.8, '#FFF8E8', 'opacity="0.7"'),
    star(72, 76, 2.8, '#FFF8E8', 'opacity="0.55"'),
  ].join('');
  const ribbon = rar.stars >= 2
    ? `<path d="M31 78h38l-4 13-15-5-15 5z" fill="url(#rb${uidSafe})" opacity="0.92"/>`
    : '';
  const chips = [0, 1, 2, 3].map((n) => ci(28 + n * 14, 16, 1.4 + (n % 2 ? 0.2 : 0), '#FFFFFF', 'opacity="0.36"')).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="r${uidSafe}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${s.ring[0]}"/><stop offset="1" stop-color="${s.ring[1]}"/></linearGradient>
    <linearGradient id="b${uidSafe}" x1="0.1" y1="0" x2="0.86" y2="1"><stop offset="0" stop-color="${s.bg[0]}"/><stop offset="1" stop-color="${s.bg[1]}"/></linearGradient>
    <linearGradient id="rb${uidSafe}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${s.ring[0]}"/><stop offset="1" stop-color="${s.ac}"/></linearGradient>
    <radialGradient id="shine${uidSafe}" cx="0.28" cy="0.22" r="0.78"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.85"/><stop offset="0.42" stop-color="#FFFFFF" stop-opacity="0.16"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
    <radialGradient id="core${uidSafe}" cx="0.5" cy="0.42" r="0.64"><stop offset="0" stop-color="#FFF9EC"/><stop offset="1" stop-color="#F5EAD2" stop-opacity="0.92"/></radialGradient>
    <filter id="sh${uidSafe}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#000" flood-opacity="0.14"/></filter>
  </defs>
  <rect x="5" y="5" width="90" height="90" rx="28" fill="url(#r${uidSafe})" filter="url(#sh${uidSafe})"/>
  <rect x="10" y="10" width="80" height="80" rx="24" fill="url(#b${uidSafe})"/>
  <rect x="10" y="10" width="80" height="80" rx="24" fill="url(#shine${uidSafe})"/>
  <rect x="13" y="13" width="74" height="74" rx="21" fill="none" stroke="#FFF8E8" stroke-opacity="0.36" stroke-width="1.2"/>
  <circle cx="50" cy="48" r="24" fill="url(#core${uidSafe})" opacity="0.96"/>
  <circle cx="50" cy="48" r="26.5" fill="none" stroke="${s.ring[1]}" stroke-opacity="0.18" stroke-width="6"/>
  <circle cx="50" cy="48" r="22.8" fill="none" stroke="${s.ring[0]}" stroke-opacity="0.72" stroke-width="1.3"/>
  <path d="M22 72c10-10 22-14 28-14 11 0 19 4 28 14" fill="none" stroke="${s.ring[0]}" stroke-opacity="0.18" stroke-width="4" stroke-linecap="round"/>
  ${chips}
  ${sparkles}
  ${ribbon}
  <g transform="translate(50,48) scale(0.62) translate(-50,-50)">${(M[motif] || M.star)(s.ink, s.ac)}</g>
  ${starsHtml}
</svg>`;
  const uri = dataUri(svg);
  _badgeCache.set(badgeId, uri);
  return uri;
}

// 由页面注入徽章索引（id → badge 对象），供生成器取系列与积分
export function setBadgeIndex(badges) { window.__BADGE_INDEX = Object.fromEntries(badges.map((b) => [b.id, b])); }

// ---- 商品 ----
const CAT_BG = { food: '#FDF3E7', toy: '#EDF3F6', outfit: '#F7EDF2', furniture: '#F2EEE4', bg: '#EAF0EA', display: '#F3EDE2' };
function shopMotif(item) {
  const c = '#6B6156', a = '#D78367', g = '#B9A98F', y = '#D8A94D', b5 = '#7A8FB5', gr = '#748F72';
  const d = item.id;
  const foodWrap = (inner) => inner;
  switch (d) {
    case 'S001': return pa('M24 50c8-12 20-18 30-18 6 0 14 6 20 18-6 12-14 18-20 18-10 0-22-6-30-18z', '#EFC9A0') + pg('74,42 88,50 74,58', '#EFC9A0') + ci(36, 46, 3, c) + ln('M30 54c4 3 10 3 14 0', 2.6, c) + ln('M52 40c4 3 4 8 0 10', 2.6, '#C99B6C');
    case 'S002': return ci(38, 46, 14, '#E88F4E') + ci(62, 58, 12, '#EFa468') + ln('M32 40l12 12M44 40L32 52', 2.6, '#C96F33') + ln('M56 52l12 12M68 52l-12 12', 2.6, '#C96F33') + pa('M30 26c6-6 14-6 18 0', 'none', `stroke="${gr}" stroke-width="4"`);
    case 'S003': return pa('M28 54h44c0 14-10 22-22 22s-22-8-22-22z', '#F3E3C6') + pa('M34 54c2-8 8-12 16-12s14 4 16 12z', '#E8C88F') + pa('M46 42c2-4 6-4 8 0 1 4-2 6-4 6s-5-2-4-6z', '#C98A4B') + ci(50, 36, 3, '#C98A4B');
    case 'S004': return rx(34, 34, 32, 38, 6, '#F4F0E6') + rx(34, 46, 32, 22, 6, '#E8A0B4') + ci(44, 52, 3.4, '#C96888') + ci(58, 60, 3, '#C96888') + rx(40, 28, 20, 8, 3, '#D8D2C4');
    case 'S005': return rx(26, 40, 48, 32, 10, '#E8B87A') + rx(26, 58, 48, 10, 6, '#D9A05B') + pa('M34 40c4-8 10-8 12 0 2-6 8-6 10 0', 'none', `stroke="#E8D49A" stroke-width="5"`) + ci(50, 30, 4, '#E8D49A');
    case 'S006': return pa('M30 58c-6 0-10-6-8-12 2-5 7-7 11-6 1-8 9-13 17-11 7 2 11 8 10 14 7-1 12 4 11 9-1 4-5 6-8 6z', '#F4C6D4') + ln('M50 58v20', 4, '#B9A98F') + ci(42, 42, 2.4, '#FFF');
    case 'S007': return pa('M26 48h48l-4 8c-2 12-10 18-20 18s-18-6-20-18z', '#E8A050') + rx(24, 42, 52, 8, 4, '#D98B3F') + ci(40, 52, 2.6, '#F3C880') + ci(58, 54, 2.6, '#F3C880') + pa('M42 32c2-4-2-6 0-10M56 32c2-4-2-6 0-10', 'none', `stroke="#D98B3F" stroke-width="3"`);
    case 'S008': return pg('50,24 78,68 22,68', '#F3E8D4') + rx(42, 60, 16, 10, 2, '#4A4A44') + ci(50, 40, 3, '#E8C88F') + ln('M34 56c8 4 24 4 32 0', 2.6, '#D9C9AC');
    case 'S009': return star(50, 50, 24, '#EFC9A0') + star(50, 50, 12, '#D9A05B') + ci(50, 50, 3, '#FFF8E8');
    case 'S010': return pg('50,26 80,72 20,72', '#E8B87A') + pg('50,38 70,70 30,70', '#E8A050') + ci(50, 34, 5, '#C9684E') + pa('M30 72h40', 'none', `stroke="#D9A05B" stroke-width="6"`);
    case 'S011': return rx(30, 40, 40, 30, 8, '#8A5B3A') + rx(26, 66, 48, 8, 4, '#6E4630') + pa('M36 40c0-8 6-14 14-14s14 6 14 14', 'none', `stroke="#F3E8D4" stroke-width="4"`) + ci(42, 34, 4, '#F4F0E6') + ci(58, 36, 3.4, '#F4F0E6');
    case 'S012': return rx(26, 50, 48, 24, 5, '#F3E3C6') + rx(26, 42, 48, 10, 4, '#E8A0B4') + ln('M50 42V30', 3.4, '#D8A94D') + ci(50, 26, 5, '#E8657A') + ln('M34 62h32', 2.6, '#D9C9AC');
    case 'S013': return ci(50, 50, 22, '#E8A0B4') + pa('M32 44c12-4 24 4 24 14M36 32c10 2 20 10 20 22M50 28c8 4 16 14 14 26', 'none', `stroke="#C96888" stroke-width="3"`) + ln('M70 62l10 12', 4, '#B9A98F');
    case 'S014': return pg('26,42 74,22 54,50', '#F4F0E6') + pg('54,50 74,22 66,66', '#D9D2C0') + ln('M26 42l28 8', 2, '#B9A98F');
    case 'S015': return pa('M40 56c0-14 4-24 10-24s10 10 10 24z', y) + ln('M34 56h32', 5, y) + ci(50, 62, 4.4, '#B08F45') + ci(50, 30, 3, '#B08F45');
    case 'S016': return rx(26, 54, 20, 18, 3, '#D9A05B') + rx(50, 54, 24, 18, 3, '#C98A4B') + rx(38, 34, 22, 18, 3, '#E8B87A') + ci(60, 43, 2.6, '#8A5B3A') + ci(66, 43, 2.6, '#8A5B3A');
    case 'S017': return rx(32, 52, 26, 20, 6, '#9AB5C9') + rx(38, 44, 14, 8, 3, '#7A8FB5') + ci(68, 30, 6, 'none', `stroke="#9AB5C9" stroke-width="3"`) + ci(78, 44, 4, 'none', `stroke="#9AB5C9" stroke-width="2.6"`) + ci(62, 22, 3, 'none', `stroke="#9AB5C9" stroke-width="2"`);
    case 'S018': return ln('M50 46v30', 4, '#B9A98F') + [0, 90, 180, 270].map((r) => pg(`50,46 ${50 + 24 * Math.cos(r * Math.PI / 180)},${46 + 24 * Math.sin(r * Math.PI / 180)} ${50 + 17 * Math.cos((r + 45) * Math.PI / 180)},${46 + 17 * Math.sin((r + 45) * Math.PI / 180)}`, r % 180 ? '#E8657A' : y)).join('') + ci(50, 46, 4, '#8A5B3A');
    case 'S019': return ci(50, 48, 18, '#9AB5C9') + ci(50, 48, 10, 'none', `stroke="#FFF" stroke-width="2.6" stroke-opacity="0.7"`) + star(50, 48, 5, '#FFF') + ln('M50 66v14', 4, '#B9A98F') + ci(50, 82, 4, y);
    case 'S020': return el(50, 54, 26, 10, '#E8657A') + el(50, 52, 26, 8, '#F08A9C') + el(50, 51, 14, 4, 'none', `stroke="#FFF" stroke-width="2.4" stroke-opacity="0.8"`) + ln('M30 60l-6 6M70 60l6 6', 3.4, '#C94860');
    case 'S021': return pa('M30 34a24 20 0 0 1 40 0', 'none', `stroke="#7A8FB5" stroke-width="9"`) + pa('M30 34a24 20 0 0 1 40 0', 'none', `stroke="#F4F0E6" stroke-width="3" stroke-dasharray="6 6"`) + pg('42,42 50,58 58,42', '#7A8FB5');
    case 'S022': return ci(50, 50, 16, '#EFC94C') + ln('M50 34v32M38 42l24 16M62 42L38 58', 2.6, '#D9A02C') + ci(50, 50, 16, 'none', `stroke="#FFF" stroke-width="2" stroke-opacity="0.6"`);
    case 'S023': return pa('M32 52c0-14 8-24 18-24s18 10 18 24z', '#8B8FA8') + el(50, 54, 26, 7, '#6F7390') + ci(50, 36, 3.4, y);
    case 'S024': return pa('M32 36a22 18 0 0 1 36 0', 'none', `stroke="#5B7EA6" stroke-width="9"`) + ln('M36 30a18 14 0 0 1 28 0', 3, '#F4F0E6') + ln('M40 36l-6 12M60 36l6 12', 6, '#5B7EA6');
    case 'S025': return el(50, 46, 24, 14, '#B5776B') + ci(50, 40, 14, '#C98A7E') + ln('M62 34c4-2 8 0 8 4', 3, '#8A5B4A') + ci(50, 28, 3, '#8A5B4A');
    case 'S026': return pa('M34 34c0-10 7-16 16-16s16 6 16 16v34H34z', '#E8C84E') + pa('M38 34c0-8 5-12 12-12s12 4 12 12', 'none', `stroke="#D9B02C" stroke-width="3.4"`) + ln('M34 48h32', 3, '#D9B02C') + ci(50, 60, 3, '#D9B02C');
    case 'S027': return pa('M34 52c0-10 7-18 16-18s16 8 16 18z', '#7A8FB5') + pg('34,52 66,52 74,64 26,64', '#8B9BC5') + ci(76, 66, 5, '#F4F0E6') + star(50, 44, 4, '#F4F0E6');
    case 'S028': return pa('M30 40a24 20 0 0 1 40 0', 'none', `stroke="#C9484E" stroke-width="11"`) + pg('58,50 70,58 60,74 50,60', '#C9484E') + ln('M40 46c6 4 14 4 20 0', 2.6, '#A83238');
    case 'S029': return rx(32, 46, 32, 24, 6, '#A67B4E') + rx(32, 46, 32, 10, 6, '#8A6238') + ci(48, 58, 3.4, y) + pa('M40 46c0-12 4-20 10-20s10 8 10 20', 'none', `stroke="#8A6238" stroke-width="4"`);
    case 'S030': return pa('M28 46c8-12 36-12 44 0 4 8 2 16-4 18-12 4-24 4-36 0-6-2-8-10-4-18z', '#F4F0E6') + pa('M32 50c10-8 26-8 36 0', 'none', `stroke="#D9D2E8" stroke-width="4"`) + ci(40, 56, 2.6, '#D9D2E8') + ci(60, 56, 2.6, '#D9D2E8');
    case 'S031': return pg('30,58 34,34 44,48 50,30 56,48 66,34 70,58', y) + ci(50, 58, 6, '#B08F45') + pg('30,58 70,58 68,66 32,66', '#D9B44C') + star(50, 24, 6, '#FFF8E8');
    case 'S032': return pa('M36 34h28l4 40H32z', '#8B6FA8') + pa('M36 34c4 10 10 14 14 14s10-4 14-14', 'none', `stroke="#F4F0E6" stroke-width="3"`) + ln('M50 48v26', 3, '#D8A94D') + ci(50, 30, 4, '#D8A94D');
    case 'S033': return rx(22, 52, 56, 16, 8, '#C98A4B') + el(38, 48, 12, 8, '#F4F0E6') + rx(28, 60, 8, 12, 2, '#8A5B3A') + rx(64, 60, 8, 12, 2, '#8A5B3A') + rx(24, 46, 52, 8, 6, '#D9A05B');
    case 'S034': return pa('M30 44h40c0 14-9 22-20 22s-20-8-20-22z', '#C98A4B') + rx(26, 40, 48, 7, 3, '#8A5B3A') + ci(42, 38, 3, '#E8B87A') + ci(52, 35, 3, '#E8B87A') + ci(60, 39, 2.6, '#E8B87A');
    case 'S035': return rx(26, 28, 48, 46, 4, 'none', `stroke="#8A5B3A" stroke-width="5"`) + ln('M26 50h48', 4, '#8A5B3A') + rx(30, 34, 8, 14, 1, '#7A8FB5') + rx(40, 38, 8, 10, 1, '#E8657A') + rx(30, 56, 8, 14, 1, '#748F72') + rx(42, 60, 8, 10, 1, '#D8A94D');
    case 'S036': return pa('M40 56h20l-3 18H43z', '#C98A4B') + pa('M50 56c-2-14-12-18-20-18 2 12 8 18 20 18z', '#748F72') + pa('M50 56c2-14 12-18 20-18-2 12-8 18-20 18z', '#8FAF8F') + ln('M50 38v-10', 3, '#748F72');
    case 'S037': return pg('38,26 62,26 56,46 44,46', '#E8B87A') + ln('M50 46v22', 4, '#8A5B3A') + rx(36, 68, 28, 6, 3, '#8A5B3A') + el(50, 36, 5, 7, '#FFF3D0');
    case 'S038': return el(50, 56, 28, 16, '#D9A05B') + el(50, 56, 20, 11, '#E8B87A') + el(50, 56, 12, 6, '#D9A05B') + ln('M32 64c12 6 24 6 36 0', 2.6, '#C98A4B');
    case 'S039': return rx(24, 44, 52, 8, 4, '#C98A4B') + rx(30, 52, 8, 22, 2, '#8A5B3A') + rx(62, 52, 8, 22, 2, '#8A5B3A') + ci(38, 40, 6, 'none', `stroke="#748F72" stroke-width="3"`) + pa('M46 44c4-8 12-8 14 0', 'none', `stroke="#748F72" stroke-width="2.6"`);
    case 'S040': return rx(26, 40, 48, 32, 4, '#B08F5C') + ln('M26 52h48M26 62h48', 3, '#8A6B3F') + rx(22, 36, 56, 8, 4, '#C9A97A') + ci(50, 47, 3, '#6B5330');
    case 'S041': return ci(50, 50, 24, '#F4F0E6') + ci(50, 50, 24, 'none', `stroke="#8A5B3A" stroke-width="4"`) + ln('M50 50V34M50 50l10 6', 3.4, '#5B4A3C') + ci(50, 30, 2.6, '#8A5B3A') + ci(50, 70, 2.6, '#8A5B3A') + ci(30, 50, 2.6, '#8A5B3A') + ci(70, 50, 2.6, '#8A5B3A');
    case 'S042': return rx(28, 30, 18, 22, 2, '#F4F0E6') + rx(52, 34, 20, 16, 2, '#E8C88F') + rx(38, 56, 24, 18, 2, '#D9D2C0') + ln('M30 34h14M54 38h16M42 60h16', 2.4, '#B9A98F') + ln('M28 26c8-6 36-6 44 0', 3, '#D9A05B');
    case 'S043': return pa('M26 56c0-6 4-10 10-10h28c6 0 10 4 10 10v14H26z', '#B5776B') + rx(26, 66, 48, 8, 4, '#9A5F55') + el(50, 50, 16, 8, '#C98A7E') + rx(22, 50, 8, 14, 4, '#9A5F55') + rx(70, 50, 8, 14, 4, '#9A5F55');
    case 'S044': return rx(24, 30, 52, 44, 4, '#8A5B3A') + ln('M24 52h52', 4, '#6E4630') + ci(38, 42, 8, '#2F3430') + ci(38, 42, 3, '#B08F45') + rx(54, 36, 12, 12, 2, '#D8A94D') + rx(54, 58, 12, 12, 2, '#748F72') + ci(38, 64, 8, '#2F3430') + ci(38, 64, 3, '#B08F45');
    case 'S045': return rx(28, 44, 44, 30, 4, '#B5776B') + pa('M36 74V56a14 12 0 0 1 28 0v18', 'none', `stroke="#6E4630" stroke-width="4"`) + pa('M50 52c4 6 8 8 8 14a8 8 0 0 1-16 0c0-6 4-8 8-14z', '#E8654E') + rx(26, 40, 48, 6, 3, '#8A5B4A');
    case 'S046': return rx(24, 26, 52, 48, 4, 'none', `stroke="#8A6B3F" stroke-width="5"`) + ln('M24 50h52', 3.4, '#8A6B3F') + star(38, 40, 8, '#D8A94D') + ci(60, 40, 6, '#7A8FB5') + star(38, 62, 7, '#E8657A') + ci(60, 62, 5, '#748F72');
    case 'S047': return rx(14, 12, 72, 76, 6, '#FDE8C8') + rx(20, 20, 60, 50, 4, '#FFF3D9') + ci(72, 22, 10, '#F5C86A') + pa('M14 70h72v18H14z', '#E8B87A') + rx(30, 44, 24, 22, 4, '#D9A05B');
    case 'S048': return rx(14, 12, 72, 76, 6, '#FDF6EA') + rx(20, 18, 60, 54, 4, '#FFFDF6') + ln('M20 18c10 20 10 34 0 54M80 18c-10 20-10 34 0 54', 5, '#E8D5B5') + rx(14, 66, 72, 22, 4, '#D9C9AC') + el(50, 30, 8, 5, '#F5D9A0');
    case 'S049': return rx(14, 12, 72, 76, 6, '#CBD5DC') + rx(20, 18, 60, 54, 4, '#AEBDC9') + ln('M28 26l-6 14M44 24l-6 16M60 26l-6 14M74 30l-6 12', 3, '#8FA3B3') + rx(14, 66, 72, 22, 4, '#8FA3B3') + ci(66, 50, 8, '#C9D4DC');
    case 'S050': return rx(14, 12, 72, 76, 6, '#F5C9A0') + ci(50, 40, 14, '#F09A56') + rx(14, 52, 72, 6, 2, '#C97B4E') + ln('M20 58v18M36 58v18M52 58v18M68 58v18M14 62h72', 4, '#A85F38') + rx(14, 66, 72, 22, 4, '#B5683D');
    case 'S051': return rx(14, 12, 72, 76, 6, '#3A4148') + el(50, 30, 20, 12, '#F5D9A0') + pa('M44 34h12v10H44z', '#F5D9A0') + rx(20, 52, 40, 30, 4, '#2F363C') + rx(26, 58, 12, 16, 2, '#4E575E') + rx(42, 58, 12, 16, 2, '#4E575E') + ci(50, 30, 3, '#FFF3D0');
    case 'S052': return rx(14, 12, 72, 76, 6, '#EFF5E8') + rx(14, 60, 72, 28, 4, '#D9B47E') + ci(28, 34, 6, '#F4B8C8') + ci(44, 26, 5, '#F4CBD6') + ci(58, 36, 6, '#F4B8C8') + ci(70, 28, 4.4, '#F4CBD6') + pa('M40 62c6-6 14-6 20 0', 'none', `stroke="#8FAF6E" stroke-width="3"`);
    case 'S053': return rx(14, 12, 72, 76, 6, '#F3E0C8') + pg('18,44 50,22 82,44', '#A6714A') + rx(26, 44, 48, 28, 3, '#C98A5E') + rx(42, 52, 14, 20, 2, '#6E4630') + ci(24, 60, 7, '#E0884E') + ci(76, 58, 6, '#D9743E') + ci(66, 68, 5, '#E0884E');
    case 'S054': return rx(14, 12, 72, 76, 6, '#2E3440') + star(28, 24, 3, '#F5E9C8') + star(44, 18, 2.4, '#F5E9C8') + star(62, 26, 3, '#F5E9C8') + star(76, 20, 2.2, '#F5E9C8') + ci(58, 38, 9, '#C9D4E8') + pg('20,68 38,46 56,68', '#D9A05B') + pg('48,68 62,52 76,68', '#C98A4B') + rx(14, 68, 72, 20, 4, '#4E4636');
    case 'S055': return rx(20, 20, 60, 60, 6, '#C9A97A') + rx(28, 28, 44, 44, 4, '#EFE6D2') + star(50, 50, 14, '#D8A94D') + ln('M20 20l-6-6M80 20l6-6', 4, '#8A6B3F');
    case 'S056': return rx(20, 20, 60, 60, 12, '#F4E6D9') + rx(28, 28, 44, 44, 8, '#FDF8F0') + ci(50, 50, 14, '#F4C6D4') + ci(44, 46, 4, '#FFF');
    case 'S057': return rx(20, 20, 60, 60, 6, '#D8B45C') + rx(27, 27, 46, 46, 4, '#F2E4BC') + star(50, 50, 15, '#B08F45') + ln('M20 20h8v8M80 20h-8v8M20 80h8v-8M80 80h-8v-8', 3.4, '#8A6B3F');
    case 'S058': return rx(16, 26, 68, 48, 6, '#3A4148') + [26, 36, 62, 72].map((x) => rx(x, 30, 5, 8, 1, '#F4F0E6')).join('') + [26, 36, 62, 72].map((x) => rx(x, 62, 5, 8, 1, '#F4F0E6')).join('') + rx(46, 34, 14, 32, 3, '#9AB5C9') + ci(53, 44, 4, '#F4F0E6');
    case 'S059': return rx(22, 24, 56, 52, 4, '#F4E8D4') + rx(30, 32, 40, 36, 2, '#FFFDF6') + pa('M22 20c10-4 46-4 56 0', 'none', `stroke="#E8A0B4" stroke-width="7"`) + ln('M36 44h28M36 52h20', 3, '#B9A98F') + star(58, 62, 6, '#D8A94D');
    case 'S060': return rx(18, 18, 64, 64, 8, '#8A6B3F') + rx(25, 25, 50, 50, 5, '#F2E4BC') + rx(30, 30, 40, 40, 3, 'none', `stroke="#D8B45C" stroke-width="2.4"`) + star(50, 50, 17, '#B08F45') + star(50, 50, 9, '#FFF3D0');
    default: return star(50, 50, 20, y);
  }
}
const _shopCache = new Map();
export function shopArt(itemId) {
  if (hasFile(`shop/${itemId}.png`)) return `./assets/shop/${itemId}.png`;
  if (hasFile(`shop/${itemId}.svg`)) return `./assets/shop/${itemId}.svg`;
  if (_shopCache.has(itemId)) return _shopCache.get(itemId);
  const item = (window.__SHOP_INDEX || {})[itemId] || { id: itemId, cat: 'other' };
  const bgc = CAT_BG[item.cat] || '#F2EEE4';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${rx(4, 4, 92, 92, 22, bgc)}${shopMotif(item)}</svg>`;
  const uri = dataUri(svg);
  _shopCache.set(itemId, uri);
  return uri;
}
export function setShopIndex(items) { window.__SHOP_INDEX = Object.fromEntries(items.map((i) => [i.id, i])); }

// ---- 心情脸 ----
const _moodCache = new Map();
export function moodArt(moodId) {
  if (_moodCache.has(moodId)) return _moodCache.get(moodId);
  const ink = '#4A423C';
  let face = '';
  if (moodId === 'great') {
    face = ci(40, 42, 3.6, ink) + ci(60, 42, 3.6, ink) + pa('M36 56c4 8 9 12 14 12s10-4 14-12', 'none', `stroke="${ink}" stroke-width="4.2" stroke-linecap="round"`);
  } else if (moodId === 'good') {
    face = ci(40, 42, 3.6, ink) + ci(60, 42, 3.6, ink) + pa('M39 57c3 5 7 8 11 8s8-3 11-8', 'none', `stroke="${ink}" stroke-width="4.2" stroke-linecap="round"`);
  } else if (moodId === 'ok') {
    face = ci(40, 42, 3.6, ink) + ci(60, 42, 3.6, ink) + ln('M39 60h22', 4.2, ink);
  } else if (moodId === 'low') {
    face = ci(40, 44, 3.6, ink) + ci(60, 44, 3.6, ink) + pa('M39 64c3-5 7-8 11-8s8 3 11 8', 'none', `stroke="${ink}" stroke-width="4.2" stroke-linecap="round"`);
  } else {
    face = ln('M35 38l9 6M44 38l-9 6', 3.2, ink) + ln('M56 38l9 6M65 38l-9 6', 3.2, ink) + pa('M39 64c3-5 7-8 11-8s8 3 11 8', 'none', `stroke="${ink}" stroke-width="4.2" stroke-linecap="round"`);
  }
  const fill = { great: '#F5D66B', good: '#A8C4A0', ok: '#BCC2CC', low: '#9FB4D0', bad: '#E8A0A4' }[moodId] || '#BCC2CC';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${ci(50, 50, 38, fill)}${face}</svg>`;
  const uri = dataUri(svg);
  _moodCache.set(moodId, uri);
  return uri;
}

// ---- 节假日标记配色（供月历使用）----
export const HOLIDAY_COLORS = { rest: '#C96868', work: '#5B7EA6' };
