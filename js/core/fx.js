// 今天没白过 · 反馈层：Toast / 弹窗 / 底部操作面板 / 庆祝结算队列 / 粒子
import { h, qs, icon } from './util.js';
import { badgeById, badgeRarity } from './catalog.js';
import { badgeArt } from './art.js';
import * as sound from './sound.js';

let _motion = 'rich';
export function configure({ motion } = {}) { if (motion) _motion = motion; }
export function motionLevel() {
  if (_motion === 'off') return 'off';
  if (_motion === 'light') return 'light';
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'light';
  return 'rich';
}

function root() { return qs('#fx-root'); }

// ---- Toast ----
// ---- 轻量局部动效 ----
function pointOf(targetOrPoint) {
  if (!targetOrPoint) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  if (typeof targetOrPoint.x === 'number' && typeof targetOrPoint.y === 'number') return targetOrPoint;
  const rect = targetOrPoint.getBoundingClientRect ? targetOrPoint.getBoundingClientRect() : null;
  return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}
export function pulse(el, cls = 'tap-pop', ms = 520) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  clearTimeout(el._pulseT);
  el._pulseT = setTimeout(() => el.classList.remove(cls), ms);
}
export function burstAt(targetOrPoint, { colors = ['#D8A94D', '#F2D98C', '#D78367', '#748F72'], count = 14, spread = 54, rise = 64 } = {}) {
  if (motionLevel() === 'off') return;
  const r = root();
  const pt = pointOf(targetOrPoint);
  const total = motionLevel() === 'rich' ? count : Math.max(8, Math.floor(count * 0.6));
  for (let i = 0; i < total; i++) {
    const shape = Math.random() < 0.22 ? ' confetti-dot' : Math.random() < 0.5 ? ' confetti-ribbon' : '';
    const p = h('span', { class: 'confetti confetti-mini' + shape });
    p.style.left = pt.x + 'px';
    p.style.top = pt.y + 'px';
    p.style.background = colors[i % colors.length];
    p.style.width = (6 + Math.random() * 6).toFixed(1) + 'px';
    p.style.height = (shape.includes('dot') ? 6 + Math.random() * 5 : 8 + Math.random() * 8).toFixed(1) + 'px';
    p.style.opacity = (0.72 + Math.random() * 0.28).toFixed(2);
    p.style.setProperty('--dx', (Math.random() * spread * 2 - spread) + 'px');
    p.style.setProperty('--dy', (Math.random() * rise * 0.9 - rise) + 'px');
    p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
    p.style.animationDelay = (Math.random() * 0.07) + 's';
    r.append(p);
    setTimeout(() => p.remove(), 1200);
  }
}

export function sparkleAt(targetOrPoint, { colors = ['#FFF6DF', '#D8A94D', '#F2D98C'], count = 8, radius = 38 } = {}) {
  if (motionLevel() === 'off') return;
  const r = root();
  const pt = pointOf(targetOrPoint);
  const total = motionLevel() === 'rich' ? count : Math.max(4, Math.floor(count * 0.6));
  for (let i = 0; i < total; i++) {
    const a = (Math.PI * 2 * i) / total + Math.random() * 0.35;
    const s = h('span', { class: 'sparkle-burst' });
    s.style.left = pt.x + 'px';
    s.style.top = pt.y + 'px';
    s.style.color = colors[i % colors.length];
    s.style.setProperty('--dx', (Math.cos(a) * (radius * (0.72 + Math.random() * 0.5))).toFixed(1) + 'px');
    s.style.setProperty('--dy', (Math.sin(a) * (radius * (0.48 + Math.random() * 0.38)) - radius * 0.22).toFixed(1) + 'px');
    s.style.setProperty('--rot', (Math.random() * 120 - 60).toFixed(1) + 'deg');
    s.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" fill="currentColor"/><circle cx="19" cy="6" r="1.5" fill="currentColor" opacity=".75"/></svg>'
    r.append(s);
    setTimeout(() => s.remove(), 950);
  }
}

export function toast(msg, { ic = 'star', ms = 1900 } = {}) {
  const r = root();
  const t = h('div', { class: 'toast' }, icon(ic), h('span', null, msg));
  t.addEventListener('click', () => t.remove());
  r.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 260); }, ms);
}

// ---- 弹窗 ----
let _openStack = [];
export function openModal({ title = '', content = null, actions = [], onClose = null, noPad = false } = {}) {
  const back = h('div', { class: 'modal-back' });
  const card = h('div', { class: 'modal-card' });
  const head = h('div', { class: 'modal-head' }, h('div', { class: 'modal-title' }, title),
    h('button', { class: 'modal-x', 'aria-label': '关闭', onclick: () => close() }, icon('close')));
  const body = h('div', { class: 'modal-body' + (noPad ? ' nopad' : '') }, content);
  const foot = actions.length ? h('div', { class: 'modal-foot' },
    actions.map((a) => h('button', {
      class: 'btn ' + (a.cls || (a.primary ? 'btn-primary' : 'btn-ghost')),
      onclick: () => a.onClick ? a.onClick(close) : close(),
    }, a.label))) : null;
  card.append(head, body);
  if (foot) card.append(foot);
  back.append(card);
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  root().append(back);
  requestAnimationFrame(() => back.classList.add('show'));
  function close() {
    back.classList.remove('show');
    setTimeout(() => back.remove(), 220);
    _openStack = _openStack.filter((x) => x !== close);
    if (onClose) onClose();
  }
  _openStack.push(close);
  return { el: card, body, close };
}
export function closeTopModal() { if (_openStack.length) _openStack[_openStack.length - 1](); }

export function confirmDlg(title, msg, { okLabel = '确定', cancelLabel = '取消', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = openModal({
      title,
      content: h('div', { class: 'confirm-msg' }, msg),
      actions: [
        { label: cancelLabel, onClick: (c) => { done = true; c(); resolve(false); } },
        { label: okLabel, cls: danger ? 'btn-danger' : 'btn-primary', onClick: (c) => { done = true; c(); resolve(true); } },
      ],
      onClose: () => { if (!done) resolve(false); },
    });
    return m;
  });
}

// 表单弹窗：fields = [{key,label,type,value,placeholder,options,min,max,step,required,hint}]
export function formDlg({ title, fields, submitLabel = '保存', extra = null }) {
  return new Promise((resolve) => {
    let done = false;
    const inputs = {};
    const content = h('div', { class: 'form-list' },
      fields.map((f) => {
        let inp;
        if (f.type === 'select') {
          inp = h('select', { class: 'input' },
            (f.options || []).map((o) => h('option', { value: o.value, selected: o.value === f.value }, o.label)));
        } else if (f.type === 'textarea') {
          inp = h('textarea', { class: 'input', rows: f.rows || 3, placeholder: f.placeholder || '', value: f.value ?? '' });
        } else if (f.type === 'range') {
          inp = h('input', { class: 'input range', type: 'range', min: f.min ?? 0, max: f.max ?? 100, step: f.step || 1, value: f.value ?? 0 });
        } else {
          inp = h('input', { class: 'input', type: f.type || 'text', placeholder: f.placeholder || '', value: f.value ?? '', inputmode: f.inputmode || null, min: f.min, max: f.max });
        }
        inputs[f.key] = inp;
        return h('label', { class: 'form-item' },
          h('span', { class: 'form-label' }, f.label),
          inp,
          f.hint ? h('span', { class: 'form-hint' }, f.hint) : null);
      }),
      extra || null);
    const m = openModal({
      title,
      content,
      actions: [
        { label: '取消', onClick: (c) => { done = true; c(); resolve(null); } },
        {
          label: submitLabel, cls: 'btn-primary', onClick: (c) => {
            const out = {};
            for (const [k, inp] of Object.entries(inputs)) out[k] = inp.value;
            c(); done = true; resolve(out);
          },
        },
      ],
      onClose: () => { if (!done) resolve(null); },
    });
    setTimeout(() => { const first = Object.values(inputs)[0]; if (first && first.focus) first.focus(); }, 260);
    return m;
  });
}

// 底部操作面板
export function actionSheet(title, items) {
  return new Promise((resolve) => {
    let done = false;
    const content = h('div', { class: 'sheet-list' },
      items.map((it, i) => h('button', {
        class: 'sheet-item' + (it.danger ? ' danger' : ''),
        onclick: () => { cleanup(); if (it.onClick) it.onClick(); resolve(i); },
      }, icon(it.ic || 'right'), h('span', { class: 'sheet-label' }, it.label), it.sub ? h('span', { class: 'sheet-sub' }, it.sub) : null)));
    const m = openModal({ title, content, noPad: true, onClose: () => { if (!done) resolve(-1); } });
    function cleanup() { done = true; m.close(); }
    return m;
  });
}

// ---- 庆祝队列：一次操作只合并为一场结算；业务先保存后播放 ----
const _q = [];
let _playing = false;
export function queueCele(item) { _q.push(item); pumpCele(); }
export function queueSettle(list, title = '本次收获') { if (list.length) queueCele({ type: 'settle', list, title }); }
async function pumpCele() {
  if (_playing) return;
  const item = _q.shift();
  if (!item) return;
  _playing = true;
  try { await showCele(item); } catch (e) { console.error(e); }
  _playing = false;
  setTimeout(pumpCele, 60);
}
function overlay(skipFn) {
  const ov = h('div', { class: 'cele-back' });
  const skip = h('button', { class: 'cele-skip', onclick: () => finish() }, '跳过');
  ov.append(skip);
  ov.addEventListener('click', (e) => { if (e.target === ov) finish(); });
  root().append(ov);
  let _fin = false;
  function finish() { if (_fin) return; _fin = true; ov.classList.add('bye'); setTimeout(() => ov.remove(), 240); skipFn && skipFn(); }
  return { ov, finish };
}
function particles(ov, colors, n = 22) {
  if (motionLevel() !== 'rich') return;
  for (let i = 0; i < n; i++) {
    const p = h('span', { class: 'confetti' });
    p.style.left = (8 + Math.random() * 84) + '%';
    p.style.top = (12 + Math.random() * 30) + '%';
    p.style.background = colors[i % colors.length];
    p.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
    p.style.setProperty('--dy', (140 + Math.random() * 160) + 'px');
    p.style.setProperty('--rot', (Math.random() * 540 - 270) + 'deg');
    p.style.animationDelay = (Math.random() * 0.25) + 's';
    ov.append(p);
    setTimeout(() => p.remove(), 1600);
  }
}
const WAIT = (ms) => new Promise((r) => setTimeout(r, ms));

async function showCele(item) {
  if (item.type === 'badge') {
    const b = badgeById(item.badgeId);
    if (!b) return;
    sound.play('badge');
    await new Promise((resolve) => {
      const { ov, finish } = overlay(resolve);
      const rar = badgeRarity(b.points);
      const card = h('div', { class: 'cele-card badge-reveal' },
        h('div', { class: 'cele-kicker' }, '徽章解锁'),
        h('div', { class: 'cele-badge-ring' }, h('img', { class: 'cele-badge-img', src: badgeArt(b.id), alt: b.name })),
        h('div', { class: 'cele-name' }, b.name),
        h('div', { class: 'cele-sub' }, `${b.series} · ${rar.name}`),
        h('div', { class: 'cele-cond' }, b.cond),
        h('div', { class: 'cele-pts' }, `+${b.points} 积分 · 宠物成长 +${b.points >= 0 ? 5 : 0}`));
      ov.append(card);
      requestAnimationFrame(() => ov.classList.add('show'));
      particles(ov, ['#D8A94D', '#F2D98C', '#D78367', '#FFF6DF'], 26);
      setTimeout(finish, 3400);
    });
  } else if (item.type === 'goal') {
    sound.play('goal');
    await new Promise((resolve) => {
      const { ov, finish } = overlay(resolve);
      const card = h('div', { class: 'cele-card' },
        h('div', { class: 'cele-kicker' }, '目标达成'),
        h('img', { class: 'cele-big', src: badgeArt(item.badgeArtId || 'A063'), alt: '' }),
        h('div', { class: 'cele-name' }, item.title),
        h('div', { class: 'cele-sub' }, item.sub || ''),
        h('div', { class: 'cele-pts' }, item.points ? `+${item.points} 积分` : ''));
      ov.append(card);
      requestAnimationFrame(() => ov.classList.add('show'));
      particles(ov, ['#748F72', '#A8C4A0', '#D8A94D', '#FFF6DF'], 26);
      setTimeout(finish, 3000);
    });
  } else if (item.type === 'stage') {
    sound.play('goal');
    await new Promise((resolve) => {
      const { ov, finish } = overlay(resolve);
      const card = h('div', { class: 'cele-card' },
        h('div', { class: 'cele-kicker' }, '宠物成长'),
        h('div', { class: 'cele-stage-num' }, `阶段 ${item.stage} · ${item.stageName}`),
        h('div', { class: 'cele-name' }, `${item.petName} 和你的默契又深了一层`),
        h('div', { class: 'cele-sub' }, item.sub || '新的表现与解锁正在等待'));
      ov.append(card);
      requestAnimationFrame(() => ov.classList.add('show'));
      particles(ov, ['#D8A94D', '#D78367', '#F2D98C'], 20);
      setTimeout(finish, 2800);
    });
  } else if (item.type === 'settle') {
    sound.play('points');
    const dur = motionLevel() === 'rich' ? 2300 : 1400;
    await new Promise((resolve) => {
      const { ov, finish } = overlay(resolve);
      const card = h('div', { class: 'cele-card settle' },
        h('div', { class: 'cele-kicker' }, item.title || '本次收获'),
        h('div', { class: 'settle-list' },
          item.list.map((r) => h('div', { class: 'settle-row' },
            h('span', { class: 'settle-ic' }, icon(r.ic || 'star')),
            h('span', { class: 'settle-label' }, h('b', null, r.label), r.sub ? h('span', { class: 'settle-sub' }, r.sub) : null),
            h('span', { class: 'settle-pts' },
              r.points ? `+${r.points}` : null,
              r.growth ? h('em', { class: 'settle-growth' }, `成长+${r.growth}`) : null)))));
      ov.append(card);
      requestAnimationFrame(() => ov.classList.add('show'));
      if (item.list.length > 1) particles(ov, ['#D8A94D', '#748F72', '#D78367'], 14);
      setTimeout(finish, dur);
    });
  }
}
