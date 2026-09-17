// 今天没白过 · 「今天」页：今日概览 / 任务 / 习惯条 / 快捷记录 / 专注与记账入口 / 最近徽章
import { all, allByIndex, put, del, get, loadKV, saveKV } from '../core/db.js';
import { CATS, catName, catColor, BADGES } from '../core/catalog.js';
import { doTaskComplete, doTaskUndo, deleteTask, addQuickRecord, doHabitDone, doHabitUndo, addLedgerEntry, todaySummary, balance } from '../core/engine.js';
import { h, icon, todayKey, addDaysKey, weekdayOf, uid, fmtMin } from '../core/util.js';
import { holidayName, dayInfo, nextHoliday } from '../core/holidays.js';
import { queueSettle, actionSheet, confirmDlg, toast } from '../core/fx.js';
import { openFocus } from './focus.js';
import { habitDueOn, habitFreqLabel } from './plan.js';
import * as sound from '../core/sound.js';
import { badgeArt } from '../core/art.js';

const QUICK_DEFAULTS = [
  { id: 'q_walk', label: '散步', category: 'sport', minutes: 30 },
  { id: 'q_read', label: '阅读', category: 'study', minutes: 15 },
  { id: 'q_cook', label: '做饭', category: 'cook' },
  { id: 'q_tidy', label: '整理', category: 'tidy', minutes: 15 },
];
export async function renderToday(view, ctx) {
  const dk = todayKey();
  await ensureInstances(dk);
  const [tasks, habits, profile, appMeta, settings, summary, badgeRows, quickCfg, events, todayLogs] = await Promise.all([
    all('tasks'), all('habits'), loadKV('profile'), loadKV('app_meta'), loadKV('settings'),
    todaySummary(), all('badges'), loadKV('quick_buttons'), allByIndex('events', 'dateKey', dk),
    allByIndex('habit_logs', 'dateKey', dk),
  ]);
  const logByHabit = new Map(todayLogs.map((l) => [l.habitId, l]));
  const quickButtons = quickCfg && quickCfg.length ? quickCfg : QUICK_DEFAULTS;
  const tplById = new Map(tasks.filter((t) => t.repeat).map((t) => [t.id, t]));
  const todayTasks = tasks.filter((t) => !t.repeat && t.dateKey === dk);
  const undone = todayTasks.filter((t) => !t.done).sort((a, b) => (a.order || 0) - (b.order || 0) || a.createdAt - b.createdAt);
  const done = todayTasks.filter((t) => t.done);
  const hol = holidayName(dk);
  const info = dayInfo(dk);
  const nh = nextHoliday(dk);
  const weekDone = new Set(events.map((e) => e.dateKey)).size;

  view.innerHTML = '';
  // 横向滑动容器：每屏占满宽度，左右滑动切换
  const swipe = h('div', { class: 'today-swipe' });

  // 第1屏：今日概览 + 任务
  const s1 = h('div', { class: 'today-screen' },
    h('div', { class: 'card hi-card rise' },
      h('div', { class: 'hi-date' },
        h('span', null, new Date().getFullYear() + '年' + (new Date().getMonth() + 1) + '月' + new Date().getDate() + '日 · 周' + '一二三四五六日'[weekdayOf(dk) - 1]),
        hol ? h('span', { class: 'tag tag-hol' }, hol + ' · 休') : info.makeup ? h('span', { class: 'tag tag-work' }, '调休上班') : null,
        nh && !hol && nh.start > dk ? h('span', { class: 'tag' }, `距离${nh.name}还有 ${diffDay(dk, nh.start)} 天`) : null),
      h('div', { class: 'hi-main' }, summary.tasks ? `今日已完成 ${summary.doneTasks}/${summary.tasks} 件` : '今天还没有安排，记一件小事就算数'),
      h('div', { class: 'hi-sub' }, `今日积分 +${summary.points}/${summary.pointsCap} · 有效记录 ${summary.validEvents} 条`),
      h('div', { class: 'bar' }, h('i', { style: `width:${Math.min(100, Math.round((summary.points / summary.pointsCap) * 100))}%` }))),
    taskSection(undone, done, tplById, ctx),
  );

  // 第2屏：习惯 + 快捷记录
  const s2 = h('div', { class: 'today-screen' },
    h('div', { class: 'card' },
      h('div', { class: 'card-title' }, icon('task'), '今天要做的习惯',
        h('button', { class: 'more', onclick: () => location.hash = '#/plan' }, '全部', icon('right'))),
      habits.length ? (() => {
        const due = habits.filter((x) => !x.paused && habitDueOn(x, dk));
        if (!due.length) return h('div', { class: 'empty' }, '今天没有排班习惯，去计划页看看');
        const strip = h('div', { class: 'habit-strip' });
        for (const hb of due) {
          const logId = logByHabit.get(hb.id);
          strip.append(h('div', { class: 'habit-pill' },
            h('button', {
              class: 'checkbtn' + (logId ? ' on' : ''), 'aria-label': hb.name,
              onclick: async () => {
                if (logId) await doHabitUndo(hb, dk); else await doHabitDone(hb, dk);
                ctx.rerender();
              },
            }, icon('check')),
            h('span', null, hb.name)));
        }
        return strip;
      })() : h('div', { class: 'empty' }, '还没有习惯，', h('button', { class: 'act', onclick: () => location.hash = '#/plan' }, '去创建一个'))),

    h('div', { class: 'card' },
      h('div', { class: 'card-title' }, icon('quick'), '快捷记录',
        h('button', { class: 'more', onclick: () => manageQuickButtons(ctx) }, '管理', icon('right'))),
      h('div', { class: 'qbtns' },
        quickButtons.map((q) => h('button', {
          class: 'qbtn',
          onclick: async () => {
            sound.play('tap');
            const res = await addQuickRecord({ category: q.category, minutes: q.minutes || null, count: q.count || null, title: q.label });
            queueSettle([{ ic: 'quick', label: q.label, sub: q.minutes ? fmtMin(q.minutes) : catName(q.category), points: res.points }]);
            ctx.rerender();
          },
        },
          h('span', { class: 'qb-ic', style: `background:${catColor(q.category)}` }),
          h('span', { class: 'qb-t' }, q.label),
          h('span', { class: 'qb-s' }, q.minutes ? fmtMin(q.minutes) : q.count ? `×${q.count}` : catName(q.category))))),
      h('div', { class: 'quick-journal' },
        h('button', { class: 'btn btn-soft btn-sm', style: 'flex:1', onclick: quickRecordDialog }, icon('quick'), '记一件完成的事'),
        h('button', { class: 'btn btn-warn btn-sm', style: 'flex:1', onclick: quickLedgerDialog }, icon('ledger'), '快速记账'))),
  );

  // 第3屏：统计 + 徽章
  const s3 = h('div', { class: 'today-screen' },
    h('div', { class: 'stat-row' },
      h('button', { class: 'stat-cell', style: 'cursor:pointer', onclick: () => openFocus() },
        h('div', { class: 'v', style: 'color:var(--primary-deep)' }, icon('focus')), h('div', { class: 'k' }, '开始专注')),
      h('div', { class: 'stat-cell' }, h('div', { class: 'v num' }, String(weekDone)), h('div', { class: 'k' }, '本周有效天数')),
      h('button', { class: 'stat-cell', style: 'cursor:pointer', onclick: () => location.hash = '#/footprint' },
        h('div', { class: 'v num', style: 'color:var(--reward)' }, String(balance())), h('div', { class: 'k' }, '积分余额'))),

    h('div', { class: 'card' },
      h('div', { class: 'card-title' }, icon('badge'), '最近解锁的徽章',
        h('button', { class: 'more', onclick: () => location.hash = '#/home' }, '收藏册', icon('right'))),
      badgeRows.length ? h('div', { class: 'badge-mini-strip' },
        badgeRows.sort((a, b) => b.ts - a.ts).slice(0, 3).map((r) => {
          const b = BADGES.find((x) => x.id === r.badgeId);
          if (!b) return null;
          return h('div', { class: 'badge-mini' }, h('img', { 'data-badge': b.id, alt: b.name }), h('div', { style: 'min-width:0' }, h('div', { class: 't' }, b.name), h('div', { class: 's' }, b.series)));
        })) : h('div', { class: 'empty' }, '完成第一件事，解锁第一枚徽章'))),
  );

  swipe.append(s1, s2, s3);
  const dots = h('div', { class: 'swipe-dots' },
    h('i', { class: 'on' }), h('i', null), h('i', null));
  swipe.addEventListener('scroll', () => {
    const idx = Math.round(swipe.scrollLeft / swipe.clientWidth);
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i === idx));
  });
  view.append(swipe, dots);
  fillBadgeImgs(view);
}

// 徽章图片填充（生成器是同步的，这里统一设置 src）
export function fillBadgeImgs(rootEl) {
  rootEl.querySelectorAll('img[data-badge]').forEach((img) => { img.src = badgeArt(img.dataset.badge); });
}

function diffDay(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

// ---- 任务区 ----
let showAllTasks = false;
function taskSection(undone, done, tplById, ctx) {
  const list = showAllTasks ? undone : undone.slice(0, 3);
  const rows = list.map((t) => taskRow(t, tplById, ctx));
  const sec = h('div', { class: 'card' },
    h('div', { class: 'card-title' }, icon('task'), '今日待办',
      h('button', { class: 'more', onclick: () => taskDialog() }, icon('plus'), '新建')));
  if (!undone.length && !done.length) {
    sec.append(h('div', { class: 'empty' }, '今天还没有任务。', h('button', { class: 'act', onclick: () => taskDialog() }, '新建一件今天的事')));
  } else {
    if (rows.length) sec.append(...rows);
    if (undone.length > 3) sec.append(h('button', { class: 'btn btn-ghost btn-sm btn-block', style: 'margin-top:8px', onclick: () => { showAllTasks = !showAllTasks; ctx.rerender(); } }, showAllTasks ? '收起' : `还有 ${undone.length - 3} 件`));
    if (done.length) {
      const doneBox = h('div', { style: 'margin-top:8px' });
      const head = h('button', { class: 'more', style: 'width:100%;justify-content:space-between;font-size:12.5px;color:var(--muted);padding:8px 2px', onclick: () => { doneBox.classList.toggle('hide'); } },
        `已完成 ${done.length}`, icon('right'));
      doneBox.classList.add('hide');
      doneBox.style.cssText = 'display:none';
      head.addEventListener('click', () => { doneBox.style.display = doneBox.style.display === 'none' ? '' : 'none'; });
      doneBox.append(...done.map((t) => taskRow(t, tplById, ctx)));
      sec.append(head, doneBox);
    }
  }
  return sec;
}
function taskRow(t, tplById, ctx) {
  const tpl = t.repeatOf ? tplById.get(t.repeatOf) : null;
  const rep = tpl ? tpl.repeat : t.repeat;
  const subDone = (t.subtasks || []).filter((s) => s.done).length;
  const more = h('button', { class: 'iconbtn', style: 'width:34px;height:34px;font-size:16px', 'aria-label': '更多' }, icon('settings'));
  more.addEventListener('click', () => taskMoreSheet(t, ctx));
  return h('div', { class: 'row-item' },
    h('button', {
      class: 'checkbtn' + (t.done ? ' on' : ''), 'aria-label': t.done ? '撤销完成' : '完成',
      onclick: async () => {
        const res = t.done ? await doTaskUndo(t) : await doTaskComplete(t);
        if (res && res.points != null) queueSettle([res]);
        ctx.rerender();
      },
    }, icon('check')),
    h('div', { class: 'row-main', onclick: () => taskDialog(t) },
      h('div', { class: 'row-title' + (t.done ? ' done' : '') }, t.title),
      h('div', { class: 'row-sub' },
        h('span', { style: 'display:inline-flex;align-items:center;gap:4px' }, h('i', { class: 'dot', style: `background:${catColor(t.category)}` }), catName(t.category)),
        rep ? h('span', { class: 'tag' }, repeatLabel(rep)) : null,
        t.estMin ? h('span', { class: 'tag' }, `约${fmtMin(t.estMin)}`) : null,
        (t.subtasks || []).length ? h('span', { class: 'tag' }, `子任务 ${subDone}/${t.subtasks.length}`) : null,
        t.note ? h('span', null, t.note) : null)),
    more);
}
function repeatLabel(rep) {
  if (rep.type === 'daily') return '每天';
  if (rep.type === 'week') return '每周' + rep.days.map((d) => '一二三四五六日'[d - 1]).join('');
  if (rep.type === 'month') return `每月${rep.day}日`;
  return '重复';
}
async function taskMoreSheet(t, ctx) {
  sound.play('tap');
  await actionSheet(t.title, [
    { ic: 'edit', label: '编辑', onClick: () => taskDialog(t) },
    { ic: 'right', label: '顺延到明天', onClick: async () => { t.dateKey = addDaysKey(t.dateKey, 1); await put('tasks', t); toast('已顺延到明天'); ctx.rerender(); } },
    { ic: 'trash', label: '删除', danger: true, onClick: async () => { if (await confirmDlg('删除任务', `删除「${t.title}」？相关统计与奖励会同步修正。`, { danger: true, okLabel: '删除' })) { await deleteTask(t); ctx.rerender(); } } },
  ]);
}

// ---- 任务编辑弹窗 ----
export async function taskDialog(task = null) {
  const dk = todayKey();
  const isNew = !task;
  const t = task || { id: null, title: '', note: '', dateKey: dk, category: 'other', estMin: null, subtasks: [], repeat: null, done: false, createdAt: Date.now() };
  const titleInp = h('input', { class: 'input', placeholder: '要做什么？（必填）', value: t.title || '', maxlength: '40' });
  const noteInp = h('input', { class: 'input', placeholder: '备注（可选）', value: t.note || '', maxlength: '60' });
  const dateInp = h('input', { class: 'input', type: 'date', value: t.dateKey });
  const estInp = h('input', { class: 'input', type: 'number', min: '1', placeholder: '分钟（可选）', value: t.estMin || '' });
  const catSel = h('select', { class: 'input' }, CATS.map((c) => h('option', { value: c.id, selected: c.id === (t.category || 'other') }, c.name)));
  const subTa = h('textarea', { class: 'input', rows: '2', placeholder: '一行一个子任务（可选）' });
  subTa.value = (t.subtasks || []).map((s) => s.title).join('\n');
  let rep = t.repeat ? JSON.parse(JSON.stringify(t.repeat)) : null;
  const repSeg = h('div', { class: 'seg' }, ['不重复', '每天', '每周', '每月'].map((lb, i) => h('button', {
    class: i === 0 ? (rep ? '' : 'on') : (rep && rep.type === ['daily', 'week', 'month'][i - 1] ? 'on' : ''),
    'data-rep': i === 0 ? '' : ['daily', 'week', 'month'][i - 1],
    onclick: (e) => {
      sound.play('tap');
      [...repSeg.children].forEach((c) => c.classList.remove('on'));
      e.currentTarget.classList.add('on');
      const r = e.currentTarget.dataset.rep;
      rep = r ? { type: r, days: [weekdayOf(dk)], day: Number(dk.slice(8)) } : null;
      weekRow.style.display = rep && rep.type === 'week' ? '' : 'none';
    },
  }, lb)));
  const weekRow = h('div', { class: 'seg', style: rep && rep.type === 'week' ? '' : 'display:none' }, ['一二三四五六日'].map((_, i) => h('button', {
    class: rep && rep.type === 'week' && rep.days.includes(i + 1) ? 'on' : '',
    onclick: (e) => { e.currentTarget.classList.toggle('on'); sound.play('toggle'); },
  }, '周' + '一二三四五六日'[i])));
  if (rep) [...repSeg.children].forEach((c, i) => c.classList.toggle('on', (i === 0 && !rep) || (rep && c.dataset.rep === rep.type)));

  const { openModal } = await import('../core/fx.js');
  openModal({
    title: isNew ? '新建任务' : '编辑任务',
    content: h('div', { class: 'form-list' },
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '标题'), titleInp),
      h('div', { class: 'field-row' }, h('div', { class: 'form-item', style: 'flex:1' }, h('span', { class: 'form-label' }, '日期'), dateInp), h('div', { class: 'form-item', style: 'flex:1' }, h('span', { class: 'form-label' }, '预计时长'), estInp)),
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '生活分类'), catSel),
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '重复'), repSeg, weekRow, h('span', { class: 'form-hint' }, '重复任务会按规则每天自动出现，可顺延可撤销，不惩罚断签')),
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '子任务'), subTa),
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '备注'), noteInp)),
    actions: [
      { label: '取消', onClick: (c) => c() },
      {
        label: isNew ? '创建' : '保存', cls: 'btn-primary', onClick: async (c) => {
          const title = titleInp.value.trim();
          if (!title) { toast('先写下要做什么', { ic: 'edit' }); return; }
          const repVal = rep && [...weekRow.children].map((b, i) => b.classList.contains('on') ? i + 1 : null).filter(Boolean);
          const repeat = rep ? (rep.type === 'week' ? { type: 'week', days: repVal.length ? repVal : [weekdayOf(dk)] } : rep.type === 'month' ? { type: 'month', day: rep.day } : { type: 'daily' }) : null;
          const subs = subTa.value.split('\n').map((s) => s.trim()).filter(Boolean).map((s) => ({ id: uid('st'), title: s, done: false }));
          if (isNew) {
            const base = { id: uid('t'), title, note: noteInp.value.trim(), dateKey: dateInp.value || dk, category: catSel.value, estMin: Number(estInp.value) || null, subtasks: subs, repeat, done: false, doneAt: null, createdAt: Date.now() };
            if (repeat) { await put('tasks', base); await ensureInstances(dateInp.value || dk); }
            else await put('tasks', base);
          } else {
            task.title = title; task.note = noteInp.value.trim(); task.category = catSel.value;
            task.estMin = Number(estInp.value) || null;
            task.subtasks = subTa.value.split('\n').map((s) => s.trim()).filter(Boolean).map((s) => ({ id: uid('st'), title: s, done: false }));
            if (!task.repeatOf) { task.dateKey = dateInp.value || dk; }
            await put('tasks', task);
          }
          sound.play('pop');
          c();
          window.dispatchEvent(new CustomEvent('tjmbg:rerender'));
        },
      },
    ],
  });
}

// 重复任务实例化（幂等：固定 ID）
export async function ensureInstances(dk) {
  const tasks = await all('tasks');
  const templates = tasks.filter((t) => t.repeat);
  for (const tpl of templates) {
    if (!repeatDue(tpl.repeat, dk)) continue;
    const instId = `ri_${tpl.id}_${dk}`;
    if (tasks.some((t) => t.id === instId)) continue;
    await put('tasks', {
      id: instId, title: tpl.title, note: tpl.note, dateKey: dk, category: tpl.category, estMin: tpl.estMin,
      subtasks: (tpl.subtasks || []).map((s) => ({ id: uid('st'), title: s.title, done: false })),
      done: false, doneAt: null, repeatOf: tpl.id, repeat: null, createdAt: Date.now(),
    });
  }
  // 清理过期的空实例（3天前的未完成实例不删除，保留补记可能；仅删除30天前未完成实例）
  const stale = tasks.filter((t) => t.repeatOf && !t.done && t.dateKey < addDaysKey(dk, -30));
  for (const t of stale) await del('tasks', t.id);
}
function repeatDue(rep, dk) {
  if (rep.type === 'daily') return true;
  if (rep.type === 'week') return rep.days.includes(weekdayOf(dk));
  if (rep.type === 'month') return Number(dk.slice(8)) === rep.day;
  return false;
}

// ---- 快捷记录弹窗 ----
export async function quickRecordDialog() {
  const nameInp = h('input', { class: 'input', placeholder: '例如：陪家人散步（可留空）' });
  const catSel = h('select', { class: 'input' }, CATS.map((c) => h('option', { value: c.id, selected: c.id === 'other' }, c.name)));
  const cntInp = h('input', { class: 'input', type: 'number', min: '1', placeholder: '次数（可选）' });
  const minInp = h('input', { class: 'input', type: 'number', min: '1', placeholder: '时长分钟（可选）' });
  const noteInp = h('input', { class: 'input', placeholder: '一句话备注（可选）' });
  const { formDlg } = await import('../core/fx.js');
  const v = await formDlg({
    title: '记一件完成的事',
    fields: [],
    submitLabel: '记录',
    extra: h('div', { class: 'form-list' },
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '事项名称'), nameInp),
      h('div', { class: 'field-row' }, h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '分类'), catSel), h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '次数'), cntInp), h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '时长(分)'), minInp)),
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '备注'), noteInp)),
  });
  if (!v) return;
  if (!cntInp.value && !minInp.value && !nameInp.value.trim()) { toast('至少填写名称、次数或时长之一', { ic: 'error' }); return; }
  const res = await addQuickRecord({
    category: catSel.value, count: Number(cntInp.value) || null, minutes: Number(minInp.value) || null,
    note: noteInp.value.trim(), title: nameInp.value.trim() || null,
  });
  queueSettle([res]);
  window.dispatchEvent(new CustomEvent('tjmbg:rerender'));
}

// ---- 快速记账弹窗 ----
export async function quickLedgerDialog() {
  const { LEDGER_OUT, LEDGER_IN } = await import('../core/catalog.js');
  let type = 'out';
  const amtInp = h('input', { class: 'input', type: 'number', min: '0', step: '0.01', inputmode: 'decimal', placeholder: '0.00' });
  const outSel = h('select', { class: 'input' }, LEDGER_OUT.map((c) => h('option', { value: c }, c)));
  const inSel = h('select', { class: 'input', style: 'display:none' }, LEDGER_IN.map((c) => h('option', { value: c }, c)));
  const dateInp = h('input', { class: 'input', type: 'date', value: todayKey() });
  const noteInp = h('input', { class: 'input', placeholder: '备注（可选）' });
  const seg = h('div', { class: 'seg' },
    h('button', { class: 'on', onclick: (e) => { type = 'out'; [...seg.children].forEach((x) => x.classList.remove('on')); e.currentTarget.classList.add('on'); outSel.style.display = ''; inSel.style.display = 'none'; } }, '支出'),
    h('button', { onclick: (e) => { type = 'in'; [...seg.children].forEach((x) => x.classList.remove('on')); e.currentTarget.classList.add('on'); outSel.style.display = 'none'; inSel.style.display = ''; } }, '收入'));
  const { openModal } = await import('../core/fx.js');
  openModal({
    title: '记一笔',
    content: h('div', { class: 'form-list' }, seg,
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '金额'), amtInp),
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '分类'), outSel, inSel),
      h('div', { class: 'field-row' }, h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '日期'), dateInp)),
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '备注'), noteInp),
      h('div', { class: 'form-hint' }, '记账只奖励“当天记了账”这件事，与金额多少无关')),
    actions: [
      { label: '取消', onClick: (c) => c() },
      {
        label: '保存', cls: 'btn-primary', onClick: async (c) => {
          const amt = Math.round(parseFloat(amtInp.value) * 100);
          if (!amt || amt <= 0) { toast('请填写正确的金额', { ic: 'error' }); return; }
          const res = await addLedgerEntry({ type, amount: amt, category: (type === 'out' ? outSel : inSel).value, note: noteInp.value.trim(), dateKey: dateInp.value || todayKey() });
          if (res.points) queueSettle([res]);
          c();
          window.dispatchEvent(new CustomEvent('tjmbg:rerender'));
        },
      },
    ],
  });
}

// ---- 快捷按钮管理 ----
async function manageQuickButtons(ctx) {
  const cfg = (await loadKV('quick_buttons')) || QUICK_DEFAULTS.map((q) => ({ ...q }));
  const items = cfg.map((q) => ({
    ic: 'quick', label: q.label, sub: `${catName(q.category)}${q.minutes ? ' · ' + fmtMin(q.minutes) : ''}${q.count ? ' · ×' + q.count : ''}`,
    onClick: async () => {
      const choice = await actionSheet(q.label, [
        { ic: 'trash', label: '删除这个按钮', danger: true, onClick: async () => { const next = cfg.filter((x) => x.id !== q.id); await saveKV('quick_buttons', next); toast('已删除'); ctx.rerender(); } },
      ]);
    },
  }));
  items.push({
    ic: 'plus', label: '添加快捷按钮', onClick: async () => {
      const { formDlg } = await import('../core/fx.js');
      const v = await formDlg({
        title: '添加快捷按钮',
        fields: [
          { key: 'label', label: '按钮名称', type: 'text', placeholder: '例如：拉伸', required: true },
          { key: 'category', label: '生活分类', type: 'select', value: 'health', options: CATS.map((c) => ({ value: c.id, label: c.name })) },
          { key: 'minutes', label: '默认时长（分钟，可选）', type: 'number', placeholder: '如 15' },
          { key: 'count', label: '默认次数（可选）', type: 'number', placeholder: '如 1' },
        ],
        submitLabel: '添加',
      });
      if (!v || !v.label.trim()) return;
      cfg.push({ id: uid('qb'), label: v.label.trim().slice(0, 6), category: v.category, minutes: Number(v.minutes) || null, count: Number(v.count) || null });
      await saveKV('quick_buttons', cfg);
      toast('已添加到快捷记录');
      ctx.rerender();
    },
  });
  await actionSheet('管理快捷按钮', items);
}
