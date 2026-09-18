// 今天没白过 · 基础工具与 DOM 助手
export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

let _uid = 0;
export function uid(prefix = 'id') {
  _uid++;
  return `${prefix}_${Date.now().toString(36)}${_uid.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ---- DOM 助手 ----
export function h(tag, attrs = null, ...children) {
  const svgTags = new Set(['svg', 'circle', 'path', 'g', 'rect', 'line', 'polyline', 'polygon', 'text', 'defs', 'linearGradient', 'stop', 'ellipse']);
  const el = svgTags.has(tag) ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    // Only internal, trusted template markup belongs in innerHTML; user content goes in children.
    else if (k === 'innerHTML') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      if (k !== 'onclick') el.addEventListener(k.slice(2), v);
      else {
        let pending = false;
        el.addEventListener('click', async (event) => {
          if (pending || el.disabled) return;
          pending = true;
          try {
            const result = v(event);
            if (result && typeof result.then === 'function') {
              el.setAttribute('aria-busy', 'true');
              await result;
            }
          } catch (error) {
            console.error(error);
            window.dispatchEvent(new CustomEvent('tjmbg:error', { detail: error }));
          } finally {
            pending = false;
            el.removeAttribute('aria-busy');
          }
        });
      }
    }
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (k === 'disabled' || k === 'selected' || k === 'multiple') el[k] = !!v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  appendChildren(el, children);
  return el;
}
function appendChildren(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === '') continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
}
export function svgEl(markup, cls) {
  const d = document.createElement('div');
  d.innerHTML = markup.trim();
  const s = d.firstElementChild;
  if (cls) s.setAttribute('class', cls);
  return s;
}
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---- 日期 ----
export const pad2 = (n) => (n < 10 ? '0' + n : '' + n);
export function dateKey(d = new Date()) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
export const todayKey = () => dateKey();
export function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDaysKey(k, n) { const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d); }
export function addMonthsKey(k, n) {
  const d = parseKey(k); const day = d.getDate(); d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last)); return dateKey(d);
}
export function daysInMonth(y, m0) { return new Date(y, m0 + 1, 0).getDate(); }
export const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];
export function weekdayOf(k) { const n = parseKey(k).getDay(); return n === 0 ? 7 : n; } // 1=周一 … 7=周日
export function fmtCN(k) { const d = parseKey(k); return `${d.getMonth() + 1}月${d.getDate()}日`; }
export function fmtCNFull(k) { const d = parseKey(k); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`; }
export function monthKeyOf(k) { return k.slice(0, 7); }
export function monthLabel(mkey) { const [y, m] = mkey.split('-'); return `${y}年${Number(m)}月`; }
// 一周的周一日期作为周 key
export function weekKeyOf(k) { const d = parseKey(k); d.setDate(d.getDate() - (weekdayOf(k) - 1)); return dateKey(d); }
export function weekLabel(wk) { const end = addDaysKey(wk, 6); return `${fmtCN(wk)} – ${fmtCN(end)}`; }
export function greeting() {
  const hh = new Date().getHours();
  if (hh < 5) return '夜深了';
  if (hh < 11) return '早上好';
  if (hh < 14) return '中午好';
  if (hh < 18) return '下午好';
  return '晚上好';
}

// ---- 数字与金额 ----
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function parseMoney(str) {
  const s = String(str ?? '').trim().replace(/[^\d.]/g, '');
  if (!s) return null;
  const n = Math.round(parseFloat(s) * 100);
  return isFinite(n) ? n : null;
}
export function fmtMoney(cents, symbol = '¥') {
  const neg = cents < 0; const v = Math.abs(cents) / 100;
  return `${neg ? '-' : ''}${symbol}${v.toFixed(2)}`;
}
export function fmtNum(n) { return Number(n || 0).toLocaleString('zh-CN'); }
export function fmtMin(min) {
  min = Math.round(min || 0);
  const hh = Math.floor(min / 60), mm = min % 60;
  if (hh && mm) return `${hh}小时${mm}分钟`;
  if (hh) return `${hh}小时`;
  return `${mm}分钟`;
}
export function fmtClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(total / 3600), mm = Math.floor((total % 3600) / 60), ss = total % 60;
  return (hh ? `${pad2(hh)}:` : '') + `${pad2(mm)}:${pad2(ss)}`;
}

export function debounce(fn, ms = 250) {
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ---- 小图标（线性 SVG，风格统一）----
const I = (inner, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="1em" height="1em" aria-hidden="true">${inner}</svg>`;
export const ICONS = {
  today: I('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M9 14.5l2 2 4-4"/>'),
  plan: I('<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z"/><path d="M8 9h8M8 12.5h8M8 16h5"/>'),
  footprint: I('<path d="M12 21c-4.5 0-8-2.8-8-7 0-4.5 3.6-9 8-9s8 4.5 8 9c0 4.2-3.5 7-8 7z"/><circle cx="9.5" cy="11" r="1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="11" r="1" fill="currentColor" stroke="none"/>'),
  home: I('<path d="M4 11.5 12 4l8 7.5"/><path d="M6.5 10v9.5h11V10"/><path d="M10.5 19.5v-5h3v5"/>'),
  mine: I('<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1.2-3.4 3.9-5 7-5s5.8 1.6 7 5"/>'),
  plus: I('<path d="M12 5v14M5 12h14" stroke-width="2.2"/>'),
  mute: I('<path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4z"/><path d="M16.5 9c1.4 1.7 1.4 4.3 0 6"/><path d="M19 6.5c2.6 3 2.6 8 0 11"/>'),
  muted: I('<path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/>'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="2.4"/>'),
  close: I('<path d="M6 6l12 12M18 6L6 18" stroke-width="2.2"/>'),
  back: I('<path d="M14.5 5.5 8 12l6.5 6.5"/>'),
  right: I('<path d="M9.5 5.5 16 12l-6.5 6.5"/>'),
  task: I('<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12.5l2.5 2.5 5-5.5"/>'),
  quick: I('<path d="M13 3 5 13.5h5.5L10 21l8-10.5h-5.5z"/>'),
  focus: I('<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2M9.5 3h5"/>'),
  ledger: I('<path d="M5 4.5h11.5A2.5 2.5 0 0 1 19 7v12.5H7.5A2.5 2.5 0 0 1 5 17z"/><path d="M5 17a2.5 2.5 0 0 1 2.5-2.5H19M9 8.5h6"/>'),
  journal: I('<path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6.5A1.5 1.5 0 0 1 5 18.5z"/><path d="M8.5 4v16M12 9h4M12 12.5h4"/>'),
  badge: I('<circle cx="12" cy="9.5" r="5.5"/><path d="M9 14.2 7.5 21l4.5-2.5L16.5 21 15 14.2"/>'),
  pet: I('<circle cx="7" cy="9" r="1.9"/><circle cx="12" cy="6.8" r="1.9"/><circle cx="17" cy="9" r="1.9"/><path d="M12 12c3.2 0 5.8 2.2 5.8 4.8 0 1.9-1.6 3.2-3.5 3.2-1 0-1.6-.3-2.3-.3s-1.3.3-2.3.3c-1.9 0-3.5-1.3-3.5-3.2 0-2.6 2.6-4.8 5.8-4.8z"/>'),
  shop: I('<path d="M5 8.5h14l-1 11a1.5 1.5 0 0 1-1.5 1.4h-9A1.5 1.5 0 0 1 6 19.5z"/><path d="M8.8 8.3V7a3.2 3.2 0 0 1 6.4 0v1.3"/>'),
  bag: I('<path d="M5.5 8h13l1 12h-15z"/><path d="M9 10.5V7a3 3 0 0 1 6 0v3.5"/>'),
  points: I('<circle cx="12" cy="12" r="8"/><path d="M14.8 9.2c-.5-.8-1.6-1.3-2.8-1.3-1.7 0-3 .9-3 2.1 0 2.6 5.8 1.3 5.8 3.9 0 1.2-1.3 2.1-3 2.1-1.3 0-2.4-.5-2.9-1.3M12 6.5v11"/>'),
  star: I('<path d="M12 4l2.4 5 5.6.7-4.1 3.8 1.1 5.5L12 16.3 7 19l1.1-5.5L4 9.7l5.6-.7z"/>'),
  moon: I('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>'),
  sun: I('<circle cx="12" cy="12" r="4.2"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/>'),
  trash: I('<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/><path d="M10.5 11v5M13.5 11v5"/>'),
  edit: I('<path d="M4 20h4.5L20 8.5a2.1 2.1 0 0 0-3-3L5.5 17z"/><path d="M14 7l3 3"/>'),
  play: I('<path d="M8 5.5v13l11-6.5z"/>'),
  pause: I('<path d="M8.5 5.5v13M15.5 5.5v13" stroke-width="2.6"/>'),
  stop: I('<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>'),
  gift: I('<rect x="4" y="10" width="16" height="10" rx="1.5"/><path d="M4 10h16M12 10v10M12 10s-4.5.3-5.5-2C5.8 6.4 8 5 9.3 5.8 10.8 6.7 12 10 12 10zm0 0s4.5.3 5.5-2C18.2 6.4 16 5 14.7 5.8 13.2 6.7 12 10 12 10z"/>'),
  heart: I('<path d="M12 20s-7.5-4.6-7.5-9.7C4.5 7.6 6.6 6 8.8 6c1.4 0 2.6.7 3.2 1.8C12.6 6.7 13.8 6 15.2 6c2.2 0 4.3 1.6 4.3 4.3C19.5 15.4 12 20 12 20z"/>'),
  search: I('<circle cx="11" cy="11" r="6"/><path d="M15.5 15.5 20 20"/>'),
  settings: I('<circle cx="12" cy="12" r="3"/><path d="M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M6.7 6.7l1.4 1.4M15.9 15.9l1.4 1.4M17.3 6.7l-1.4 1.4M8.1 15.9l-1.4 1.4"/>'),
  download: I('<path d="M12 4v10.5M7.5 11 12 15.5 16.5 11"/><path d="M5 19h14"/>'),
  upload: I('<path d="M12 15.5V5M7.5 9.5 12 5l4.5 4.5"/><path d="M5 19h14"/>'),
  calendar: I('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>'),
  fire: I('<path d="M12 3.5c1 2.5 4.5 4 4.5 8a4.5 4.5 0 0 1-9 0c0-1.6.8-2.7 1.7-3.7.2 1 .7 1.7 1.6 2.2C10.6 8 11.5 5.5 12 3.5z"/>'),
  wish: I('<path d="M12 3l2 4.3 4.7.6-3.4 3.2.9 4.6L12 13.4 7.8 15.7l.9-4.6L5.3 7.9l4.7-.6z"/>'),
  idea: I('<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3.5a6 6 0 0 1 3.5 10.9c-.7.5-1 1.2-1 2V17h-5v-.6c0-.8-.3-1.5-1-2A6 6 0 0 1 12 3.5z"/>'),
  list: I('<path d="M8.5 6.5h11M8.5 12h11M8.5 17.5h11"/><path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" stroke-width="2.6"/>'),
  book: I('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20"/>'),
  sleep: I('<path d="M4 8.5h6l-6 7h6M13 5.5h7l-7 8h7" stroke-width="1.7"/>'),
  camera: I('<rect x="3.5" y="7" width="17" height="13" rx="3"/><path d="M9 7l1.5-2.5h3L15 7"/><circle cx="12" cy="13.2" r="3.4"/>'),
  volume: I('<path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4z"/><path d="M15.5 9.5a4 4 0 0 1 0 5"/>'),
};

export function icon(name, cls = '') {
  const s = svgEl(ICONS[name] || ICONS.star, cls);
  s.setAttribute('class', `ic ${cls}`);
  return s;
}
