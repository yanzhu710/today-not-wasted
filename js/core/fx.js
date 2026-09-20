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
export function openModal({ title = '', content = null, actions = [], onClose = null, noPad = false, canClose = null } = {}) {
  const previousFocus = document.activeElement;
  const back = h('div', { class: 'modal-back' });
  const card = h('div', { class: 'modal-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabindex: '-1' });
  let closed = false, pending = false;
  const buttons = [];
  const closeFromUI = () => { if (!pending && (!canClose || canClose())) close(); };
  const x = h('button', { type: 'button', class: 'modal-x', 'aria-label': '关闭', onclick: closeFromUI }, icon('close'));
  const body = h('div', { class: 'modal-body' + (noPad ? ' nopad' : '') }, content);
  card.append(h('div', { class: 'modal-head' }, h('div', { class: 'modal-title' }, title), x), body);
  const validActions = actions.filter(Boolean);
  if (validActions.length) {
    const foot = h('div', { class: 'modal-foot' });
    for (const a of validActions) {
      const button = h('button', {
        type: 'button', disabled: !!a.disabled,
        class: 'btn ' + (a.cls || (a.primary ? 'btn-primary' : 'btn-ghost')),
        onclick: async () => {
          if (closed || pending || a.disabled) return;
          pending = true;
          const disabledBefore = buttons.map(b => b.disabled);
          buttons.forEach(b => { b.disabled = true; }); x.disabled = true;
          card.setAttribute('aria-busy', 'true');
          try {
            if (a.onClick) await a.onClick(close); else close();
          } catch (error) {
            console.error(error);
            toast(error?.message || '操作未完成，请重试', { ic: 'error', ms: 3200 });
          } finally {
            pending = false;
            card.removeAttribute('aria-busy'); x.disabled = false;
            buttons.forEach((b, i) => { b.disabled = disabledBefore[i]; });
          }
        },
      }, a.label);
      buttons.push(button); foot.append(button);
    }
    card.append(foot);
  }
  back.append(card);
  back.addEventListener('click', (e) => { if (e.target === back) closeFromUI(); });
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFromUI(); }
    if (e.key !== 'Tab') return;
    const focusable = [...card.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')];
    if (!focusable.length) { e.preventDefault(); card.focus(); return; }
    const first = focusable[0], last = focusable.at(-1);
    if (e.shiftKey && (document.activeElement === first || document.activeElement === card)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  root().append(back);
  requestAnimationFrame(() => { if (!closed) { back.classList.add('show'); card.focus({ preventScroll: true }); } });
  function close() {
    if (closed) return;
    closed = true;
    back.classList.remove('show');
    back.style.pointerEvents = 'none';
    back.setAttribute('aria-hidden', 'true');
    back.inert = true;
    setTimeout(() => back.remove(), 220);
    _openStack = _openStack.filter((fn) => fn !== closeFromUI);
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    if (onClose) onClose();
  }
  _openStack.push(closeFromUI);
  return { el: card, body, close, isClosed: () => closed };
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
            (f.options || []).map((o) => {
              const val = Array.isArray(o) ? o[0] : (typeof o === 'object' ? o.value : o);
              const lab = Array.isArray(o) ? o[1] : (typeof o === 'object' ? o.label : o);
              return h('option', { value: val, selected: val === f.value }, lab);
            }));
        } else if (f.type === 'textarea') {
          inp = h('textarea', { class: 'input', rows: f.rows || 3, placeholder: f.placeholder || '', value: f.value ?? '' });
        } else if (f.type === 'range') {
          inp = h('input', { class: 'input range', type: 'range', min: f.min ?? 0, max: f.max ?? 100, step: f.step || 1, value: f.value ?? 0 });
        } else {
          inp = h('input', { class: 'input', type: f.type || 'text', placeholder: f.placeholder || '', value: f.value ?? '', inputmode: f.inputmode || null, min: f.min, max: f.max });
        }
        if (f.required) inp.required = true;
        if (f.step != null) inp.step = String(f.step);
        if (f.maxlength != null) inp.maxLength = Number(f.maxlength);
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
            // Validate extra fields too. Invalid forms stay open with their input intact.
            for (const inp of content.querySelectorAll('input,select,textarea')) {
              if (!inp.disabled && typeof inp.reportValidity === 'function' && !inp.reportValidity()) return;
            }
            const out = {};
            for (const [k, inp] of Object.entries(inputs)) out[k] = inp.value;
            done = true; resolve(out); c();
          },
        },
      ],
      onClose: () => { if (!done) resolve(null); },
    });
    setTimeout(() => { const first = Object.values(inputs)[0]; if (first?.isConnected && !m.isClosed()) first.focus(); }, 260);
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
        onclick: async () => { cleanup(); resolve(i); if (it.onClick) await it.onClick(); },
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
      const stage = Math.max(1, Math.min(4, Number(item.stage)||1));
      const crown = stage === 4;
      const card = h('div', { class: 'cele-card evolve-reveal stage-'+stage },
        h('div', { class: 'evolve-halo', 'aria-hidden':'true' }, h('span',null), h('span',null), h('span',null)),
        h('div', { class: 'cele-kicker' }, crown ? '纪念加冕' : '伙伴进化'),
        h('div', { class: 'evolve-pet-wrap' },
          h('span',{class:'evolve-ring','aria-hidden':'true'}),
          h('img',{class:'evolve-pet',src:`./assets/pets/ali/ali_lv${stage}_celebrate.png`,alt:item.petName||'伙伴',draggable:'false'}),
          crown ? h('span',{class:'evolve-crown','aria-hidden':'true'},'♛') : null),
        h('div', { class: 'cele-stage-num' }, `Lv.${stage} · ${item.stageName}`),
        h('div', { class: 'cele-name' }, `${item.petName} 和你的陪伴进入了新的阶段`),
        h('div', { class: 'cele-sub' }, item.sub || (crown?'这一刻值得认真收藏。':'新的形态和闪卡已经解锁。')));
      ov.append(card);
      requestAnimationFrame(() => ov.classList.add('show'));
      particles(ov, crown?['#FFF4C7','#E7B85A','#F2D98C','#FFFFFF']:['#D8A94D','#D78367','#F2D98C','#A8C4A0'], crown?38:30);
      try { navigator.vibrate?.(crown?[80,40,120,50,180]:[50,35,80]); } catch {}
      setTimeout(finish, crown?3800:3300);
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
            h('span', { class: 'settle-label' }, h('b', null, r.label || r.title || '记录已保存'), r.sub ? h('span', { class: 'settle-sub' }, r.sub) : null),
            h('span', { class: 'settle-pts' },
              r.points ? `${r.points > 0 ? '+' : ''}${r.points}` : null,
              r.growth ? h('em', { class: 'settle-growth' }, `成长+${r.growth}`) : null)))));
      ov.append(card);
      requestAnimationFrame(() => ov.classList.add('show'));
      if (item.list.length > 1) particles(ov, ['#D8A94D', '#748F72', '#D78367'], 14);
      setTimeout(finish, dur);
    });
  }
}
