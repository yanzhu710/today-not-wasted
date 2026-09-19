// 今天没白过 · 「计划」页：目标 / 习惯 / 清单 / 灵感（四个子标签）
import { all, allByIndex, put, del, loadKV, saveKV, genId } from '../core/db.js';
import { CATS, catName, catColor, CHECKLIST_TEMPLATES, INSPIRATIONS, POINTS } from '../core/catalog.js';
import { doTaskComplete, doTaskUndo, doHabitDone, doHabitUndo, toggleMilestone, completeGoal, reopenGoal, completeChecklist, reopenChecklist, addQuickRecord } from '../core/engine.js';
import { h, icon, uid, todayKey, addDaysKey, weekdayOf, fmtMin, fmtCN } from '../core/util.js';
import { openModal, formDlg, actionSheet, confirmDlg, queueSettle, toast } from '../core/fx.js';
import * as sound from '../core/sound.js';
import { routeTabs } from '../ui/tabs.js';

export async function renderPlan(view, ctx) {
  const requested = ctx.routeParams?.get('tab');
  const tab = ['tasks','habits','goals','more'].includes(requested) ? requested : 'tasks';
  view.replaceChildren();
  view.dataset.planTab = tab;
  view.append(routeTabs({
    value: tab,
    ariaLabel: '计划分类',
    items: [
      { id:'tasks', label:'任务', href:'plan?tab=tasks' },
      { id:'habits', label:'习惯', href:'plan?tab=habits' },
      { id:'goals', label:'目标', href:'plan?tab=goals' },
      { id:'more', label:'更多', href:'plan?tab=more' },
    ],
  }));
  const box = h('div', { class: 'plan-content' });
  view.append(box);
  if (tab === 'tasks') await renderTasks(box, ctx);
  else if (tab === 'habits') await renderHabits(box, ctx);
  else if (tab === 'goals') await renderGoals(box, ctx);
  else {
    box.append(h('div',{class:'plan-more-intro card'},h('b',null,'清单与灵感'),h('span',null,'低频工具放在这里，不和每天要执行的任务抢位置。')));
    await renderLists(box, ctx);
    await renderInsp(box, ctx);
  }
}

async function renderTasks(box, ctx) {
  const dk = todayKey();
  const { ensureInstances } = await import('./today.js');
  await ensureInstances(dk);
  const rows = (await all('tasks')).filter(t => !t.repeat);
  rows.sort((a,b) => (a.dateKey || '').localeCompare(b.dateKey || '') || (a.createdAt||0)-(b.createdAt||0));
  const todayRows = rows.filter(t => !t.done && t.dateKey === dk);
  const overdue = rows.filter(t => !t.done && t.dateKey < dk);
  const upcoming = rows.filter(t => !t.done && t.dateKey > dk);
  const completed = rows.filter(t => t.done).sort((a,b)=>(b.doneAt||0)-(a.doneAt||0)).slice(0,12);

  const head = h('section',{class:'card plan-task-head'},
    h('div',{class:'card-title'},icon('task'),'任务',h('button',{class:'more',onclick:async()=>{const {taskDialog}=await import('./today.js');taskDialog();}},icon('plus'),'新建')),
    h('div',{class:'plan-task-summary'},
      h('div',null,h('b',{class:'num'},String(todayRows.length)),h('span',null,'今天待办')),
      h('div',null,h('b',{class:'num'},String(upcoming.length)),h('span',null,'接下来')),
      h('div',null,h('b',{class:'num'},String(completed.length)),h('span',null,'最近完成'))));
  box.append(head);

  const section = (title, list, note='') => {
    const card = h('section',{class:'card plan-task-section'},h('div',{class:'card-title'},title,note?h('span',{class:'tag'},note):null));
    if (!list.length) card.append(h('div',{class:'empty'},title==='今天'?'今天没有待办，留一点空白也很好。':'这里暂时是空的。'));
    for (const task of list) card.append(planTaskRow(task, ctx));
    box.append(card);
  };
  if (overdue.length) section('待处理', overdue, '之前未完成');
  section('今天', todayRows);
  section('接下来', upcoming.slice(0,30));
  if (completed.length) section('最近完成', completed);
}

function planTaskRow(task, ctx) {
  const openEdit = async () => { const { taskDialog } = await import('./today.js'); taskDialog(task); };
  return h('div',{class:'plan-task-row'},
    h('button',{class:'checkbtn'+(task.done?' on':''),'aria-label':task.done?'撤销完成':'完成任务',onclick:async()=>{
      const result = task.done ? await doTaskUndo(task) : await doTaskComplete(task);
      if (result && result.points != null) queueSettle([result]);
      ctx.rerender('plan?tab=tasks');
    }},icon('check')),
    h('button',{class:'plan-task-main',onclick:openEdit},
      h('b',{class:task.done?'done':''},task.title),
      h('span',null,task.dateKey===todayKey()?'今天':fmtCN(task.dateKey),task.category?' · '+catName(task.category):'')),
    h('button',{class:'iconbtn plan-task-edit','aria-label':'编辑任务',onclick:openEdit},icon('edit')));
}

// ---- 频率工具（今天页也复用）----
export function habitFreqLabel(hb) {
  const f = hb.freq;
  if (f.type === 'daily') return '每天';
  if (f.type === 'week') return '每周' + f.days.map((d) => '一二三四五六日'[d - 1]).join('');
  if (f.type === 'weekN') return `每周${f.n}次`;
  return `每月${f.n}次`;
}
export function habitDueOn(hb, dk) {
  const f = hb.freq;
  if (f.type === 'week') return f.days.includes(weekdayOf(dk));
  return true; // daily / 每周N次 / 每月N次 都按自选节奏，不强制连续
}

// ---- 目标与愿望 ----
async function renderGoals(box, ctx) {
  const [goals, wishes] = await Promise.all([all('goals'), all('wishes')]);
  goals.sort((a, b) => (a.status === 'done') - (b.status === 'done') || b.createdAt - a.createdAt);
  wishes.sort((a, b) => b.createdAt - a.createdAt);
  const card = h('div', { class: 'card' },
    h('div', { class: 'card-title' }, icon('flag'), '目标',
      h('button', { class: 'more', onclick: () => goalDialog() }, icon('plus'), '新建')));
  if (!goals.length) card.append(h('div', { class: 'empty' }, '还没有目标。', h('button', { class: 'act', onclick: () => goalDialog() }, '立一个吧，哪怕很小')));
  for (const g of goals) {
    const msTotal = (g.milestones || []).length;
    const msDone = (g.milestones || []).filter((m) => m.done).length;
    const prog = g.targetNum ? Math.min(100, Math.round(((g.progressNum || 0) / g.targetNum) * 100)) : (msTotal ? Math.round((msDone / msTotal) * 100) : 0);
    const cardEl = h('div', { class: 'card goal-card', style: g.status === 'done' ? 'opacity:0.65' : '' },
      h('div', { class: 'goal-top' },
        h('div', { class: 'row-main', style: 'cursor:pointer', onclick: () => goalDialog(g) },
          h('div', { class: 'row-title' }, g.title, g.status === 'done' ? ' · 已达成' : ''),
          h('div', { class: 'row-sub' },
            h('span', { style: 'display:inline-flex;align-items:center;gap:4px' }, h('i', { class: 'dot', style: `background:${catColor(g.category)}` }), catName(g.category)),
            g.deadline ? h('span', { class: 'goal-deadline' }, `${fmtCN(g.deadline)} 截止`) : null)),
        h('button', { class: 'iconbtn', style: 'width:34px;height:34px;font-size:16px', onclick: () => goalMoreSheet(g, ctx) }, icon('settings'))),
      h('div', { class: 'bar', style: 'margin-top:8px' }, h('i', { style: `width:${prog}%` })),
      h('div', { class: 'row-sub', style: 'margin-top:4px' },
        g.targetNum ? h('span', { class: 'num' }, `${g.progressNum || 0}/${g.targetNum}${g.unit || ''}`) : null,
        msTotal ? h('span', null, `里程碑 ${msDone}/${msTotal}`) : null,
        g.steps && g.steps.length ? h('span', null, `步骤 ${g.steps.filter((s) => s.done).length}/${g.steps.length}`) : null));
    // 里程碑快捷勾选（最多展示3个未完成的）
    const openMs = (g.milestones || []).filter((m) => !m.done).slice(0, 3);
    if (g.status === 'active' && openMs.length) {
      for (const m of openMs) {
        cardEl.append(h('button', {
          class: 'ms-chip', onclick: async () => {
            const res = await toggleMilestone(g, m);
            if (res) queueSettle([res]);
            ctx.rerender();
          },
        }, h('span', { class: 'checkbtn', style: 'width:24px;height:24px;font-size:13px' }, icon('check')), m.title));
      }
    }
    if (g.status === 'active' && (!g.milestones || !g.milestones.length) && !g.targetNum) {
      cardEl.append(h('button', { class: 'btn btn-soft btn-sm btn-block', style: 'margin-top:8px', onclick: () => { completeGoal(g).then(() => ctx.rerender()); } }, '标记完成（+' + POINTS.goal.delta + '积分）'));
    }
    card.append(cardEl);
  }
  box.append(card);
  // 愿望
  const wishCard = h('div', { class: 'card' },
    h('div', { class: 'card-title' }, icon('wish'), '愿望清单（先记下来，随时转成目标）',
      h('button', { class: 'more', onclick: async () => {
        const v = await formDlg({ title: '许个愿望', fields: [{ key: 't', label: '想做成什么？', type: 'text', placeholder: '例如：学会做十道菜' }] });
        if (v && v.t.trim()) { await put('wishes', { id: uid('w'), title: v.t.trim(), note: '', createdAt: Date.now() }); ctx.rerender(); }
      } }, icon('plus'), '许愿')));
  if (!wishes.length) wishCard.append(h('div', { class: 'empty' }, '先记下心里想做的事'));
  for (const w of wishes) {
    wishCard.append(h('div', { class: 'row-item' },
      h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, w.title)),
      h('button', { class: 'btn btn-soft btn-sm', onclick: async () => {
        await put('goals', { id: uid('g'), title: w.title, category: 'other', deadline: null, targetNum: null, unit: null, progressNum: 0, milestones: [], steps: [], status: 'active', doneAt: null, createdAt: Date.now() });
        await del('wishes', w.id);
        toast('愿望已转为目标');
        ctx.rerender();
      } }, '转目标'),
      h('button', { class: 'iconbtn', style: 'width:34px;height:34px;font-size:16px', onclick: async () => { await del('wishes', w.id); ctx.rerender(); } }, icon('trash'))));
  }
  box.append(wishCard);
}
async function goalMoreSheet(g, ctx) {
  sound.play('tap');
  const items = [{ ic: 'edit', label: '编辑目标', onClick: () => goalDialog(g) }];
  if (g.status === 'active') {
    items.push({ ic: 'check', label: '标记整个目标完成（+' + POINTS.goal.delta + '积分）', onClick: async () => { await completeGoal(g); ctx.rerender(); } });
  } else {
    items.push({ ic: 'undo', label: '重新打开', onClick: async () => { await reopenGoal(g); ctx.rerender(); } });
  }
  items.push({ ic: 'trash', label: '删除', danger: true, onClick: async () => { if (await confirmDlg('删除目标', `删除「${g.title}」？相关统计与奖励会同步修正。`, { danger: true, okLabel: '删除' })) { await del('goals', g.id); ctx.rerender(); } } });
  await actionSheet(g.title, items);
}
async function goalDialog(g = null) {
  const isNew = !g;
  const t = g || { title: '', category: 'other', deadline: null, targetNum: null, unit: '', progressNum: 0, milestones: [], steps: [], status: 'active' };
  const titleInp = h('input', { class: 'input', value: t.title || '', placeholder: '目标名称（必填）', maxlength: '40' });
  const catSel = h('select', { class: 'input' }, CATS.map((c) => h('option', { value: c.id, selected: c.id === t.category }, c.name)));
  const dlInp = h('input', { class: 'input', type: 'date', value: t.deadline || '' });
  const numInp = h('input', { class: 'input', type: 'number', min: '1', value: t.targetNum || '', placeholder: '数值（可选，如 20）' });
  const unitInp = h('input', { class: 'input', value: t.unit || '', placeholder: '单位（如 本/公里/次）', maxlength: '6' });
  const msTa = h('textarea', { class: 'input', rows: '3', placeholder: '一行一个里程碑（可选）\n例如：跑完5公里\n例如：连续7天晨跑' });
  msTa.value = (t.milestones || []).map((m) => m.title).join('\n');
  const stTa = h('textarea', { class: 'input', rows: '3', placeholder: '一行一个步骤（可选，≥5个步骤完成有徽章）' });
  stTa.value = (t.steps || []).map((s) => s.title).join('\n');
  const progRow = t.targetNum ? h('div', { class: 'num-stepper' },
    h('button', { onclick: () => { progRow._v = Math.max(0, (progRow._v || 0) - 1); vEl.textContent = progRow._v; } }, '−'),
    h('span', { class: 'v num' }, String(t.progressNum || 0)),
    h('button', { onclick: () => { progRow._v = (progRow._v ?? t.progressNum ?? 0) + 1; vEl.textContent = progRow._v; } }, '＋')) : null;
  let vEl = progRow ? progRow.children[1] : null;
  if (progRow) progRow._v = t.progressNum || 0;
  openModal({
    title: isNew ? '新建目标' : '编辑目标',
    content: h('div', { class: 'form-list' },
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '目标'), titleInp),
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '分类'), catSel),
      h('div', { class: 'field-row' }, h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '截止日期'), dlInp), h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '数值目标'), numInp), h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '单位'), unitInp)),
      progRow ? h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '当前进度'), progRow) : null,
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '里程碑（每个+20积分）'), msTa),
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '步骤拆解'), stTa)),
    actions: [
      { label: '取消', onClick: (c) => c() },
      {
        label: isNew ? '立下目标' : '保存', cls: 'btn-primary', onClick: async (c) => {
          const title = titleInp.value.trim();
          if (!title) { toast('目标名称不能为空', { ic: 'error' }); return; }
          const milestones = msTa.value.split('\n').map((s) => s.trim()).filter(Boolean);
          const oldMs = new Map((t.milestones || []).map((m) => [m.title, m]));
          const steps = stTa.value.split('\n').map((s) => s.trim()).filter(Boolean).map((s) => ({ id: uid('sp'), title: s, done: false }));
          const data = {
            title, category: catSel.value, deadline: dlInp.value || null,
            targetNum: Number(numInp.value) || null, unit: unitInp.value.trim(),
            progressNum: progRow ? (progRow._v ?? 0) : (t.progressNum || 0),
            milestones: milestones.map((m) => oldMs.get(m) || { id: uid('ms'), title: m, done: false, doneAt: null }),
            steps, status: t.status || 'active', doneAt: t.doneAt || null, createdAt: t.createdAt || Date.now(),
          };
          if (isNew) { data.id = uid('g'); await put('goals', data); sound.play('pop'); }
          else { data.id = t.id; await put('goals', data); }
          c();
          window.dispatchEvent(new CustomEvent('tjmbg:rerender'));
        },
      },
    ],
  });
}

// ---- 习惯 ----
async function renderHabits(box, ctx) {
  const dk = todayKey();
  const [habits, logs] = await Promise.all([all('habits'), allByIndex('habit_logs', 'dateKey', dk)]);
  const doneSet = new Set(logs.map((l) => l.habitId));
  habits.sort((a, b) => (a.paused ? 1 : 0) - (b.paused ? 1 : 0) || a.createdAt - b.createdAt);
  const card = h('div', { class: 'card' },
    h('div', { class: 'card-title' }, icon('task'), '习惯',
      h('button', { class: 'more', onclick: () => habitDialog() }, icon('plus'), '新建')),
    h('div', { class: 'form-hint', style: 'margin-bottom:6px' }, '默认统计累计达成，不使用连续天数，不惩罚断签'));
  if (!habits.length) card.append(h('div', { class: 'empty' }, '还没有习惯，创建一个吧'));
  // 近14天打卡
  const recentLogs = await all('habit_logs');
  const byHabit = new Map();
  for (const l of recentLogs) { if (!byHabit.has(l.habitId)) byHabit.set(l.habitId, []); byHabit.get(l.habitId).push(l.dateKey); }
  for (const hb of habits) {
    const days = new Set(byHabit.get(hb.id) || []);
    const dots = h('div', { style: 'display:flex;gap:3px;margin-left:auto' });
    for (let i = 13; i >= 0; i--) {
      const d = addDaysKey(dk, -i);
      dots.append(h('i', { style: `width:7px;height:7px;border-radius:50%;background:${days.has(d) ? 'var(--primary)' : 'var(--line)'}` }));
    }
    card.append(h('div', { class: 'row-item', style: hb.paused ? 'opacity:0.55' : '' },
      h('button', {
        class: 'checkbtn' + (doneSet.has(hb.id) ? ' on' : ''), 'aria-label': hb.name,
        onclick: async () => {
          if (doneSet.has(hb.id)) await doHabitUndo(hb, dk); else { const res = await doHabitDone(hb, dk); if (res) queueSettle([res]); }
          ctx.rerender();
        },
      }, icon('check')),
      h('div', { class: 'row-main', onclick: () => habitDialog(hb) },
        h('div', { class: 'row-title' }, hb.name, hb.paused ? ' · 已暂停' : ''),
        h('div', { class: 'row-sub' }, h('span', { style: 'display:inline-flex;align-items:center;gap:4px' }, h('i', { class: 'dot', style: `background:${catColor(hb.category)}` }), catName(hb.category)), h('span', null, habitFreqLabel(hb)), h('span', { class: 'num' }, `累计 ${days.size} 天`))),
      dots,
      h('button', { class: 'iconbtn', style: 'width:34px;height:34px;font-size:16px', onclick: () => habitMoreSheet(hb, ctx) }, icon('settings'))));
  }
  box.append(card);
}
async function habitMoreSheet(hb, ctx) {
  sound.play('tap');
  await actionSheet(hb.name, [
    { ic: 'edit', label: '编辑', onClick: () => habitDialog(hb) },
    { ic: 'pause', label: hb.paused ? '恢复' : '暂停', onClick: async () => { hb.paused = !hb.paused; await put('habits', hb); toast(hb.paused ? '已暂停，随时可恢复' : '已恢复'); ctx.rerender(); } },
    { ic: 'trash', label: '删除', danger: true, onClick: async () => { if (await confirmDlg('删除习惯', `删除「${hb.name}」？历史打卡会保留在统计里。`, { danger: true, okLabel: '删除' })) { await del('habits', hb.id); ctx.rerender(); } } },
  ]);
}
export async function habitDialog(hb = null) {
  const isNew = !hb;
  const t = hb || { name: '', category: 'health', freq: { type: 'daily' } };
  const nameInp = h('input', { class: 'input', value: t.name || '', placeholder: '习惯名称（必填）', maxlength: '20' });
  const catSel = h('select', { class: 'input' }, CATS.map((c) => h('option', { value: c.id, selected: c.id === t.category }, c.name)));
  let freq = t.freq ? { ...t.freq, days: [...(t.freq.days || [])] } : { type: 'daily' };
  const freqSeg = h('div', { class: 'seg' }, [['daily', '每天'], ['week', '每周几'], ['weekN', '每周N次'], ['monthN', '每月N次']].map(([id, lb]) =>
    h('button', { class: freq.type === id ? 'on' : '', onclick: (e) => { freq.type = id; [...freqSeg.children].forEach((x) => x.classList.remove('on')); e.currentTarget.classList.add('on'); weekRow.style.display = id === 'week' ? '' : 'none'; nRow.style.display = (id === 'weekN' || id === 'monthN') ? '' : 'none'; sound.play('tap'); } }, lb)));
  const weekRow = h('div', { class: 'seg', style: freq.type === 'week' ? '' : 'display:none' }, '一二三四五六日'.split('').map((c, i) =>
    h('button', { class: freq.days && freq.days.includes(i + 1) ? 'on' : '', onclick: (e) => { e.currentTarget.classList.toggle('on'); sound.play('toggle'); } }, '周' + c)));
  const nInp = h('input', { class: 'input', type: 'number', min: '1', max: '31', value: freq.n || 3 });
  const nRow = h('div', { class: 'form-item', style: (freq.type === 'weekN' || freq.type === 'monthN') ? '' : 'display:none' }, h('span', { class: 'form-label' }, '次数 N'), nInp);
  openModal({
    title: isNew ? '新建习惯' : '编辑习惯',
    content: h('div', { class: 'form-list' },
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '名称'), nameInp),
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '分类'), catSel),
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '频率'), freqSeg, weekRow, nRow)),
    actions: [
      { label: '取消', onClick: (c) => c() },
      {
        label: isNew ? '创建' : '保存', cls: 'btn-primary', onClick: async (c) => {
          const name = nameInp.value.trim();
          if (!name) { toast('先给习惯起个名字', { ic: 'error' }); return; }
          const f = { type: freq.type };
          if (freq.type === 'week') f.days = [...weekRow.children].map((b, i) => (b.classList.contains('on') ? i + 1 : null)).filter(Boolean);
          if (!f.days || !f.days.length) { if (freq.type === 'week') { f.days = [weekdayOf(todayKey())]; } }
          if (freq.type === 'weekN' || freq.type === 'monthN') f.n = Math.max(1, Number(nInp.value) || 3);
          if (isNew) await put('habits', { id: uid('h'), name, category: catSel.value, freq: f, paused: false, createdAt: Date.now() });
          else { hb.name = name; hb.category = catSel.value; hb.freq = f; await put('habits', hb); }
          sound.play('pop'); c();
          window.dispatchEvent(new CustomEvent('tjmbg:rerender'));
        },
      },
    ],
  });
}

// ---- 生活清单 ----
async function renderLists(box, ctx) {
  const lists = await all('checklists');
  lists.sort((a, b) => (a.doneAt ? 1 : 0) - (b.doneAt ? 1 : 0) || b.createdAt - a.createdAt);
  const card = h('div', { class: 'card' },
    h('div', { class: 'card-title' }, icon('list'), '生活清单',
      h('button', { class: 'more', onclick: () => listDialog() }, icon('plus'), '新建')),
    h('div', { class: 'form-hint', style: 'margin-bottom:6px' }, '清单里的子项不单独发积分，整张完成记一件事（+' + POINTS.checklist.delta + '）'));
  if (!lists.length) {
    card.append(h('div', { class: 'empty' }, '从模板复制一张，或自己新建'));
    const tpl = h('div', { class: 'tpl-grid' });
    for (const tp of CHECKLIST_TEMPLATES) {
      tpl.append(h('button', { class: 'tpl-cell', onclick: async () => {
        await put('checklists', { id: uid('cl'), title: tp.title, items: tp.items.map((s) => ({ id: uid('ci'), title: s, checked: false })), doneAt: null, createdAt: Date.now() });
        sound.play('pop'); toast(`已复制「${tp.title}」`); ctx.rerender();
      } }, h('div', { class: 't' }, tp.title), h('div', { class: 's' }, `${tp.items.length} 个子项 · 点此复制`)));
    }
    card.append(tpl);
  }
  for (const l of lists) {
    const doneN = l.items.filter((i) => i.checked).length;
    card.append(h('div', { class: 'row-item' },
      h('div', { class: 'row-main', style: 'cursor:pointer', onclick: () => listOpen(l, ctx) },
        h('div', { class: 'row-title' }, l.title, l.doneAt ? ' · 已完成' : ''),
        h('div', { class: 'row-sub' }, h('span', { class: 'num' }, `${doneN}/${l.items.length}`), l.doneAt ? h('span', null, fmtCN(new Date(l.doneAt).toISOString().slice(0, 10))) : null)),
      h('div', { class: 'bar', style: 'width:70px' }, h('i', { style: `width:${l.items.length ? Math.round((doneN / l.items.length) * 100) : 0}%` })),
      h('button', { class: 'iconbtn', style: 'width:34px;height:34px;font-size:16px', onclick: () => listMoreSheet(l, ctx) }, icon('settings'))));
  }
  box.append(card);
}
async function listMoreSheet(l, ctx) {
  sound.play('tap');
  await actionSheet(l.title, [
    { ic: 'list', label: '打开清单', onClick: () => listOpen(l, ctx) },
    { ic: 'check', label: l.doneAt ? '重新打开清单' : '整张完成（+' + POINTS.checklist.delta + '积分）', onClick: async () => { const res = l.doneAt ? await reopenChecklist(l) : await completeChecklist(l); if (res) queueSettle([res]); ctx.rerender(); } },
    { ic: 'trash', label: '删除清单', danger: true, onClick: async () => { if (await confirmDlg('删除清单', `删除「${l.title}」？`, { danger: true, okLabel: '删除' })) { await del('checklists', l.id); ctx.rerender(); } } },
  ]);
}
async function listOpen(l, ctx) {
  const listBox = h('div', { class: 'checklist-items' });
  const render = () => {
    listBox.innerHTML = '';
    for (const it of l.items) {
      listBox.append(h('div', { class: 'row-item' },
        h('button', {
          class: 'checkbtn' + (it.checked ? ' on' : ''), onclick: async () => {
            it.checked = !it.checked; await put('checklists', l); sound.play('toggle'); render();
            headProg.textContent = `${l.items.filter((x) => x.checked).length}/${l.items.length}`;
          },
        }, icon('check')),
        h('div', { class: 'row-main' }, h('div', { class: 'row-title' + (it.checked ? ' done' : '') }, it.title))));
    }
  };
  const headProg = h('span', null, `${l.items.filter((x) => x.checked).length}/${l.items.length}`);
  const modal = openModal({
    title: l.title,
    content: h('div', null,
      h('div', { class: 'row-sub', style: 'margin-bottom:6px' }, headProg, h('span', null, '全部勾选后可整张完成')),
      listBox,
      h('div', { class: 'btn-row', style: 'margin-top:10px' },
        h('button', { class: 'btn btn-soft btn-sm', onclick: async () => {
          const v = await formDlg({ title: '添加子项', fields: [{ key: 't', label: '子项内容', type: 'text' }] });
          if (v && v.t.trim()) { l.items.push({ id: uid('ci'), title: v.t.trim(), checked: false }); await put('checklists', l); render(); headProg.textContent = `${l.items.filter((x) => x.checked).length}/${l.items.length}`; }
        } }, '添加子项'),
        h('button', {
          class: 'btn btn-primary btn-sm', style: 'flex:2', onclick: async () => {
            if (l.doneAt) await reopenChecklist(l); else { const res = await completeChecklist(l); if (res) queueSettle([res]); }
            modal.close(); ctx.rerender();
          },
        }, l.doneAt ? '重新打开' : '整张完成（+' + POINTS.checklist.delta + '）'))),
    actions: [],
  });
  render();
}
async function listDialog() {
  const v = await formDlg({
    title: '新建清单',
    fields: [{ key: 't', label: '清单名称', type: 'text', placeholder: '例如：周末采购' }],
    submitLabel: '创建',
  });
  if (!v || !v.t.trim()) return;
  await put('checklists', { id: uid('cl'), title: v.t.trim(), items: [], doneAt: null, createdAt: Date.now() });
  window.dispatchEvent(new CustomEvent('tjmbg:rerender'));
}

// ---- 生活灵感 ----
function renderInsp(box, ctx) {
  const favBox = h('div');
  const cardBox = h('div');
  let filters = { min: null, scene: null, type: null };
  let current = null;
  async function customList() {
    const insp = await loadKV('inspiration');
    return insp.custom || [];
  }
  const pool = async () => {
    const custom = await customList();
    const all = [...INSPIRATIONS, ...custom];
    return all.filter((x) =>
      (filters.min == null || x.min === filters.min) &&
      (filters.scene == null || x.scene === filters.scene) &&
      (filters.type == null || x.type === filters.type));
  };
  const seg = (list, key, labels) => h('div', { class: 'seg' },
    h('button', { class: 'on', onclick: (e) => { filters[key] = null; mark(e); draw(); } }, labels[0]),
    list.map(([v, lb]) => h('button', { onclick: (e) => { filters[key] = v; mark(e); draw(); } }, lb)));
  function mark(e) { [...e.currentTarget.parentElement.children].forEach((x) => x.classList.remove('on')); e.currentTarget.classList.add('on'); sound.play('tap'); }

  async function draw() {
    cardBox.innerHTML = '';
    cardBox.append(h('div', { class: 'insp-filter' },
      seg([[5, '5分钟'], [15, '15分钟'], [30, '半小时'], [60, '一小时']], 'min', ['任意时长']),
      seg([['home', '在家'], ['out', '出门']], 'scene', ['都可以']),
      seg([['relax', '放松'], ['tidy', '整理'], ['study', '学习'], ['sport', '运动'], ['social', '陪伴']], 'type', ['都可以'])));
    const p = await pool();
    if (!p.length) { cardBox.append(h('div', { class: 'card empty' }, '这个组合下暂时没有灵感，换个条件试试')); return; }
    current = p[Math.floor(Math.random() * p.length)];
    cardBox.append(h('div', { class: 'card insp-card' },
      h('div', { class: 'row-sub' }, h('span', { class: 'tag tag-pri' }, `${current.min}分钟`), h('span', { class: 'tag' }, current.scene === 'home' ? '在家' : '出门'), h('span', { class: 'tag' }, catName(current.cat))),
      h('div', { class: 'insp-title' }, current.t),
      h('div', { class: 'insp-desc' }, current.d),
      h('div', { class: 'btn-row', style: 'margin-top:12px' },
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => draw() }, '换一个'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => { const insp = await loadKV('inspiration'); insp.hidden.push(current.t); await saveKV('inspiration', insp); toast('下次不推荐这条了'); draw(); } }, '不感兴趣'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => { const insp = await loadKV('inspiration'); if (!insp.favorites.includes(current.t)) insp.favorites.push(current.t); await saveKV('inspiration', insp); toast('已收藏'); drawFav(); } }, '收藏'),
        h('button', {
          class: 'btn btn-primary btn-sm', style: 'flex:1', onclick: async () => {
            const { quickRecordDialog } = await import('./today.js');
            await quickRecordDialog({ category: current.cat, title: current.t, note: '来自生活灵感' });
          },
        }, '去记录'))));
  }
  async function drawFav() {
    const insp = await loadKV('inspiration');
    favBox.innerHTML = '';
    const card = h('div', { class: 'card' }, h('div', { class: 'card-title' }, icon('star'), '收藏的灵感'));
    if (!insp.favorites.length) card.append(h('div', { class: 'empty' }, '收藏喜欢的灵感，随时来做'));
    for (const t of insp.favorites) {
      const item = INSPIRATIONS.find((x) => x.t === t);
      card.append(h('div', { class: 'row-item' },
        h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, t), item ? h('div', { class: 'row-sub' }, `${item.min}分钟 · ${item.d}`) : null),
        item ? h('button', { class: 'btn btn-soft btn-sm', onclick: async () => { const { quickRecordDialog } = await import('./today.js'); await quickRecordDialog({ category:item.cat, title:item.t }); } }, '去记录') : null,
        h('button', { class: 'iconbtn', style: 'width:34px;height:34px;font-size:16px', onclick: async () => { const insp2 = await loadKV('inspiration'); insp2.favorites = insp2.favorites.filter((x) => x !== t); await saveKV('inspiration', insp2); drawFav(); } }, icon('trash'))));
    }
    favBox.append(card);
  }
  box.append(h('div', { class: 'card' },
    h('div', { class: 'card-title' }, icon('idea'), '生活灵感',
      h('button', { class: 'more', onclick: () => createInspiration() }, icon('plus'), '创建')),
    h('div', { class: 'form-hint', style: 'margin-bottom:8px' }, '按你现在的时间和场景，随机推荐一件马上能做的小事（本地规则库，不联网）')),
    cardBox, favBox);
  draw(); drawFav();
}

function createInspiration() {
  formDlg({
    title: '创建灵感',
    submitLabel: '保存',
    fields: [
      { key: 'title', label: '灵感内容', type: 'text', placeholder: '例如：泡杯茶发呆5分钟', required: true },
      { key: 'min', label: '建议时长（分钟）', type: 'number', value: '15', min: 1, max: 180 },
      { key: 'scene', label: '场景', type: 'select', options: [['home', '在家'], ['out', '出门']], value: 'home' },
      { key: 'cat', label: '分类', type: 'select', options: CATS.map((c) => [c.id, c.name]) },
    ],
  }).then(async (v) => {
    if (!v || !v.title) return;
    const insp = await loadKV('inspiration');
    if (!insp.custom) insp.custom = [];
    insp.custom.push({
      t: v.title.trim(), d: '我的自定义灵感',
      min: Number(v.min) || 15, scene: v.scene || 'home', type: v.cat || 'relax',
      cat: v.cat || 'other',
    });
    await saveKV('inspiration', insp);
    toast('灵感已保存', { ic: 'check' });
  });
}
