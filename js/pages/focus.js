// 今天没白过 · 专注计时：正/倒计时、暂停、结束确认、离开页面后核对经过时间
import { loadKV, saveKV, all, allByIndex } from '../core/db.js';
import { saveFocusSession } from '../core/engine.js';
import { h, icon, fmtClock, fmtMin, todayKey } from '../core/util.js';
import { openModal, queueSettle, toast, confirmDlg } from '../core/fx.js';
import * as sound from '../core/sound.js';

async function loadState() { return loadKV('focus_state'); }
async function setState(s) { await saveKV('focus_state', s); }
function elapsedOf(s) { return s.paused ? s.accumMs : s.accumMs + (Date.now() - s.startedTs); }

export async function openFocus() {
  let s = await loadState();
  const isNew = !s;
  if (!s || typeof s.startedTs !== 'number' || typeof s.accumMs !== 'number') {
    s = { mode: 'up', targetMin: null, startedTs: Date.now(), paused: false, accumMs: 0, linkType: null, linkId: null, linkCategory: null, linkLabel: '', done: false };
    await setState(s);
  }
  let timer = null;
  let closed = false;
  let started = !isNew; // 恢复中的会话视为已开始
  let optRow = null;

  const [pets, appMeta] = await Promise.all([all('pets'), loadKV('app_meta')]);
  const activePet = pets.find(p => p.petId === appMeta.activePet) || pets[0] || null;
  const { petFigure } = await import('../ui/paper.js');
  const timeEl = h('div', { class: 'focus-time num' }, '00:00');
  const stateEl = h('div', { class: 'focus-state' }, '');
  const ctrlRow = h('div', { class: 'btn-row focus-controls' });
  const linkInfo = h('div', { class: 'focus-link-info' }, s.linkLabel ? `正在为「${s.linkLabel}」计时` : '不关联任务也没关系，专心做眼前这一件事');
  const pet = activePet ? petFigure(activePet) : h('div',{class:'focus-pet-fallback'},icon('pet'));
  const wrap = h('div', { class:'focus-paper' },
    h('div',{class:'focus-scene'},
      h('span',{class:'focus-moon','aria-hidden':'true'}),
      h('span',{class:'focus-leaf focus-leaf-a','aria-hidden':'true'}),
      h('span',{class:'focus-leaf focus-leaf-b','aria-hidden':'true'}),
      h('div',{class:'focus-pet'},pet),
      h('div',{class:'focus-scene-copy'},h('b',null,'把这一小段时间，留给自己'),h('span',null,'慢一点，也是在前进。'))),
    h('div',{class:'focus-dial'},timeEl,stateEl),
    linkInfo,
    ctrlRow,
    h('div', { class: 'form-hint focus-hint' },
      '少于 5 分钟不计为有效专注；计时期间可以离开页面，时间仍会继续累计。'));

  const modal = openModal({ title: s.done ? '专注完成待确认' : isNew ? '开始专注' : '专注进行中', content: wrap });
  modal.body.parentElement && null;

  function renderCtrls() {
    ctrlRow.innerHTML = '';
    if (s.done) {
      stateEl.textContent = `倒计时 ${s.targetMin} 分钟已结束，请确认保存`;
      ctrlRow.append(
        h('button', { class: 'btn btn-primary', onclick: endConfirm }, icon('check'), '确认保存'),
        h('button', { class: 'btn btn-ghost', onclick: discard }, '放弃'));
      return;
    }
    if (!started && !s.paused && s.accumMs === 0 && s.mode === 'up') {
      // 尚未真正开始：给模式与目标选择
      stateEl.textContent = '选择计时方式后开始';
      const seg = h('div', { class: 'seg', style: 'margin-top:12px' },
        h('button', { class: 'on', 'data-m': 'up', onclick: (e) => { s.mode = 'up'; [...seg.children].forEach((x) => x.classList.remove('on')); e.currentTarget.classList.add('on'); } }, '正计时'),
        h('button', { 'data-m': 'down', onclick: (e) => { s.mode = 'down'; [...seg.children].forEach((x) => x.classList.remove('on')); e.currentTarget.classList.add('on'); } }, '倒计时'));
      const presets = h('div', { class: 'seg', style: 'margin-top:8px' },
        [15, 25, 30, 45, 60].map((n) => h('button', { onclick: (e) => { s.mode = 'down'; s.targetMin = n; [...presets.children].forEach((x) => x.classList.remove('on')); e.currentTarget.classList.add('on'); seg.querySelectorAll('button')[1].classList.add('on'); sound.play('tap'); } }, `${n} 分钟`)));
      const linkSel = h('select', { class: 'input', style: 'margin-top:10px' }, h('option', { value: '' }, '不关联'));
      buildLinkOptions(linkSel);
      ctrlRow.append(
        h('button', {
          class: 'btn btn-primary btn-block', onclick: async () => {
            s.startedTs = Date.now(); s.paused = false; s.accumMs = 0;
            const opt = linkSel.selectedOptions[0];
            if (opt && opt.value) { s.linkType = opt.dataset.type; s.linkId = opt.value; s.linkCategory = opt.dataset.cat; s.linkLabel = opt.textContent; }
            await setState(s); sound.play('tap'); started = true; if (optRow) optRow.style.display = 'none'; renderCtrls(); tick();
          },
        }, icon('play'), '开始'));
      optRow = h('div', null, seg, presets, linkSel);
      wrap.insertBefore(optRow, ctrlRow);
      return;
    }
    if (s.paused) {
      stateEl.textContent = '已暂停';
      ctrlRow.append(
        h('button', { class: 'btn btn-primary', onclick: async () => { s.paused = false; s.startedTs = Date.now(); await setState(s); sound.play('tap'); renderCtrls(); } }, icon('play'), '继续'),
        h('button', { class: 'btn btn-ghost', onclick: endConfirm }, icon('check'), '结束'),
        h('button', { class: 'btn btn-ghost', onclick: discard }, '放弃'));
    } else {
      stateEl.textContent = s.mode === 'down' ? `倒计时 ${s.targetMin} 分钟` : '专注进行中';
      ctrlRow.append(
        h('button', { class: 'btn btn-primary', onclick: async () => { s.accumMs = elapsedOf(s); s.paused = true; await setState(s); sound.play('tap'); renderCtrls(); } }, icon('pause'), '暂停'),
        h('button', { class: 'btn btn-ghost', onclick: endConfirm }, icon('check'), '结束'),
        h('button', { class: 'btn btn-ghost', onclick: discard }, '放弃'));
    }
  }

  function tick() {
    if (closed) return;
    const el = elapsedOf(s);
    if (s.mode === 'down' && s.targetMin && !s.done) {
      const remain = s.targetMin * 60000 - el;
      if (remain <= 0) {
        s.done = true; setState(s); sound.play('complete'); renderCtrls();
        timeEl.textContent = '00:00';
        return;
      }
      timeEl.textContent = fmtClock(remain);
    } else {
      timeEl.textContent = fmtClock(el);
    }
    timer = setTimeout(tick, 500);
  }

  async function buildLinkOptions(sel) {
    const dk = todayKey();
    const [tasks, habits, goals] = await Promise.all([allByIndex('tasks', 'dateKey', dk), all('habits'), all('goals')]);
    const g1 = h('optgroup', { label: '任务' });
    tasks.filter((t) => !t.done).slice(0, 10).forEach((t) => g1.append(h('option', { value: t.id, 'data-type': 'task', 'data-cat': t.category || '' }, t.title)));
    const g2 = h('optgroup', { label: '习惯' });
    habits.filter((x) => !x.paused).slice(0, 10).forEach((x) => g2.append(h('option', { value: x.id, 'data-type': 'habit', 'data-cat': x.category || '' }, x.name)));
    const g3 = h('optgroup', { label: '目标' });
    goals.filter((g) => g.status === 'active').slice(0, 10).forEach((g) => g3.append(h('option', { value: g.id, 'data-type': 'goal', 'data-cat': g.category || '' }, g.title)));
    sel.append(g1, g2, g3);
  }

  async function endConfirm() {
    const mins = Math.max(1, Math.round(elapsedOf(s) / 60000));
    const inp = h('input', { class: 'input', type: 'number', min: '1', value: String(mins) });
    const note = h('input', { class: 'input', placeholder: '这次专注做了什么（可选）' });
    openModal({
      title: '确认有效时长',
      content: h('div', { class: 'form-list' },
        h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '实际有效专注（分钟）'), inp),
        h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '备注'), note),
        h('div', { class: 'form-hint' }, '结束前请核对时长；确认后保存并结算奖励')),
      actions: [
        { label: '取消', onClick: (c) => c() },
        {
          label: '保存', cls: 'btn-primary', onClick: async (c) => {
            const minutes = Math.max(0, Number(inp.value) || 0);
            if (minutes <= 0) { toast('至少专注 1 分钟再保存', { ic: 'error' }); return; }
            const res = await saveFocusSession({
              minutes, mode: s.mode, targetMin: s.targetMin, linkedType: s.linkType, linkedId: s.linkId,
              category: s.linkCategory, note: note.value.trim(), startedTs: s.startedTs, endedTs: Date.now(),
            });
            await setState(null);
            stopTimer(); c(); modal.close();
            queueSettle([res]);
            window.dispatchEvent(new CustomEvent('tjmbg:rerender'));
          },
        },
      ],
    });
  }
  async function discard() {
    const ok = await confirmDlg('放弃这次专注？', '不保存任何记录，也不产生积分。', { okLabel: '放弃', danger: true });
    if (!ok) return;
    await setState(null);
    stopTimer(); modal.close();
    window.dispatchEvent(new CustomEvent('tjmbg:rerender'));
  }
  function stopTimer() { closed = true; if (timer) clearTimeout(timer); }
  const origClose = modal.close;
  modal.close = () => { stopTimer(); origClose(); };

  // 若倒计时在离开页面期间已结束，直接进入待确认状态
  if (s.mode === 'down' && s.targetMin && !s.done && elapsedOf(s) >= s.targetMin * 60000) {
    s.done = true; await setState(s);
  }
  if (s.done) {
    timeEl.textContent = '00:00';
    stateEl.textContent = `专注目标 ${s.targetMin} 分钟已达成`;
    renderCtrls();
  } else {
    if (!s.paused && (s.accumMs > 0 || !isNew)) {
      const el = elapsedOf(s);
      if (el > 0) stateEl.textContent = `已计时 ${fmtMin(Math.floor(el / 60000))}（含离开页面的时间）`;
    }
    renderCtrls();
    tick();
  }
}
