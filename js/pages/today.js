// 今天没白过 · 「今天」页：宠物陪伴卡 / 主记录 / 快捷记录 / 追踪徽章 / 今日任务
import { all, allByIndex, put, del, get, loadKV, saveKV } from '../core/db.js';
import { CATS, catName, catColor, BADGES, PETS, stageOf, stageProgress, moodById } from '../core/catalog.js';
import { petSVG, petAct, floatFx } from '../core/pets.js';
import { doTaskComplete, doTaskUndo, deleteTask, addQuickRecord, doHabitDone, doHabitUndo, addLedgerEntry, todaySummary, balance } from '../core/engine.js';
import { h, icon, todayKey, addDaysKey, weekdayOf, uid, fmtMin, fmtMoney } from '../core/util.js';
import { holidayName, dayInfo, nextHoliday } from '../core/holidays.js';
import { queueSettle, actionSheet, confirmDlg, toast } from '../core/fx.js';
import { openFocus } from './focus.js';
import { habitDueOn, habitFreqLabel } from './plan.js';
import * as sound from '../core/sound.js';
import { badgeArt } from '../core/art.js';
import { openSharePanel } from '../core/share.js';

function diffDay(a, b) {
  const da = new Date(a + 'T00:00:00'), db = new Date(b + 'T00:00:00');
  return Math.round((db - da) / 86400000);
}

const QUICK_DEFAULTS = [
  { id: 'q_walk', label: '散步', category: 'sport', minutes: 30 },
  { id: 'q_read', label: '阅读', category: 'study', minutes: 15 },
  { id: 'q_cook', label: '做饭', category: 'cook' },
  { id: 'q_tidy', label: '整理', category: 'tidy', minutes: 15 },
];
export async function renderToday(view, ctx) {
  const dk = todayKey();
  await ensureInstances(dk);
  const [tasks, habits, appMeta, summary, quickCfg, todayLogs, pets, ledgerRows, journalRows] = await Promise.all([
    all('tasks'), all('habits'), loadKV('app_meta'), todaySummary(),
    loadKV('quick_buttons'), allByIndex('habit_logs', 'dateKey', dk), all('pets'),
    allByIndex('ledger', 'dateKey', dk), allByIndex('journal', 'dateKey', dk),
  ]);
  const quickButtons = Array.isArray(quickCfg) && quickCfg.length ? quickCfg : QUICK_DEFAULTS;
  const logByHabit = new Map(todayLogs.map(l => [l.habitId, l]));
  const tplById = new Map(tasks.filter(t => t.repeat).map(t => [t.id, t]));
  const todayTasks = tasks.filter(t => !t.repeat && t.dateKey === dk);
  const undone = todayTasks.filter(t => !t.done).sort((a,b) => (a.order||0)-(b.order||0));
  const done = todayTasks.filter(t => t.done);
  const active = pets.find(p => p.petId === appMeta.activePet) || pets[0];
  const def = PETS.find(p => p.petId === active?.petId);
  const { petFigure, petResponse } = await import('../ui/paper.js');
  view.replaceChildren();
  view.classList.add('paper-today', 'paper-reference-page');

  if (active && def) {
    const progress = stageProgress(active.growth || 0);
    const bubble = h('p', { class: 'ref-hero-bubble', 'aria-live': 'polite' },
      summary.validEvents ? `今天已经认真记下 ${summary.validEvents} 件小事啦。` : '新的一天，也是很棒的一天！');
    let figure;
    figure = petFigure(active, { interactive: true, onDispose: ctx.onDispose, onClick: () => {
      sound.play('pet'); petResponse(figure, bubble, '我在呢，慢慢来就好。', 'touch');
    }});
    const scene = h('div', { class: 'ref-hero-scene' },
      h('span', { class: 'ref-leaf leaf-a', 'aria-hidden':'true' }),
      h('span', { class: 'ref-leaf leaf-b', 'aria-hidden':'true' }),
      h('span', { class: 'ref-grass', 'aria-hidden':'true' }),
      h('div', { class: 'ref-hero-pet' }, figure),
      bubble,
      h('div', { class: 'ref-food-bowl', 'aria-hidden':'true' }, h('span',null,'✦')),
      h('div', { class: 'ref-sticky' }, '小事也值得被', h('br'), '认真记录！', h('br'), h('b', null, '汪～')),
      h('span', { class:'ref-heart', 'aria-hidden':'true' }, '♥'));
    const hero = h('section', { class:'ref-hero card' },
      scene,
      h('div', { class:'ref-hero-footer' },
        h('b', null, `Lv.${progress.cur.n}`),
        h('strong', null, active.name || def.name),
        h('progress', { class:'paper-progress', value:Math.max(0,Math.min(1,progress.ratio)), max:'1', 'aria-label':'当前阶段成长进度' }),
        h('span', null, progress.next ? `${active.growth||0}/${progress.next.min}` : '一起同行'),
        h('button', { class:'btn ref-partner-btn', onclick:()=>{ location.hash='#/home?tab=home'; } }, '查看伙伴', icon('right'))));
    view.append(hero);
  }

  const primaryActions = [
    ['quick','记一件小事','记录生活瞬间', async()=>quickRecordDialog()],
    ['focus','专注','高效又专注', ()=>openFocus()],
    ['journal','手账','写下此刻心情', async()=> (await import('./footprint.js')).journalDialog()],
    ['ledger','记账','收支简单明了', ()=>quickLedgerDialog()],
  ];
  view.append(h('section', { class:'ref-action-grid' }, primaryActions.map(([ic,label,sub,fn],i)=>
    h('button', { class:`ref-action-card tone-${i}`, onclick:fn },
      h('span', { class:'ref-action-blob' }, icon(ic)), h('b',null,label), h('small',null,sub)))));

  const quickInput = h('input', { class:'ref-quick-input', type:'text', maxlength:'36', placeholder:'例如：喝了一杯好喝的咖啡 ☕', 'aria-label':'快速记录今天' });
  const quickSave = h('button', { class:'btn ref-quick-save', onclick:async()=>{
    const title=quickInput.value.trim();
    if(!title){ quickInput.focus(); toast('先写下一件小事吧',{ic:'quick'}); return; }
    quickSave.disabled=true;
    try{
      const result=await addQuickRecord({ category:'other', title });
      quickInput.value=''; queueSettle([{ic:'quick',label:title,sub:'已记进今天',points:result.points}]); await ctx.rerender();
    } finally { quickSave.disabled=false; }
  }}, icon('plus'),'记录');
  quickInput.addEventListener('keydown', e=>{ if(e.key==='Enter'){e.preventDefault();quickSave.click();} });
  view.append(h('section',{class:'card ref-quick-bar'},h('label',null,'快速记录今天吧…'),h('div',null,quickInput,quickSave)));

  const overview = h('section',{class:'card ref-overview-card'},
    h('div',{class:'ref-card-head'},h('h2',null,'今日总览'),h('small',null,'每一份努力都算数 ✦')),
    h('div',{class:'ref-overview-grid'},
      overviewCell('quick',summary.validEvents,'记录'),
      overviewCell('focus',fmtFocusCompact(summary.focusMin),'专注'),
      overviewCell('ledger',todayOutflow(ledgerRows),'支出'),
      overviewCell('heart',todayMood(journalRows),'心情')));

  const badgeSlot=h('section',{class:'ref-badge-wrap'});
  try {
    const { renderTrackedBadge } = await import('../core/tracking.js');
    await renderTrackedBadge(badgeSlot);
  } catch(error) {
    console.warn('徽章卡加载未完成',error);
    badgeSlot.append(h('section',{class:'card ref-badge-fallback'},h('h2',null,'本周徽章'),h('p',null,'徽章卡暂时没有加载，但不会影响今天的记录。'),
      h('button',{class:'btn btn-soft btn-sm',onclick:()=>{location.hash='#/home?tab=badges';}},'查看收藏册')));
  }
  const badgeRoot=badgeSlot.firstElementChild;
  badgeRoot?.classList.add('ref-dashboard-card','ref-badge-card');
  view.append(h('div',{class:'ref-dashboard-grid'},badgeSlot,overview));

  const taskCard=h('section',{class:'card ref-compact-card ref-task-card'},
    h('div',{class:'ref-card-head'},h('h2',null,'今日待办'),h('button',{class:'more',onclick:()=>taskDialog()},`${done.length}/${todayTasks.length} 已完成`,icon('right'))));
  if(!todayTasks.length) taskCard.append(h('p',{class:'paper-empty'},'今天还没有待办。'));
  else {
    const shown=[...undone,...done].slice(0,5);
    shown.forEach(t=>taskCard.append(refTaskRow(t,tplById,ctx)));
    if(todayTasks.length>5) taskCard.append(h('button',{class:'paper-text-link',onclick:()=>{location.hash='#/plan?tab=tasks';}},`再看 ${todayTasks.length-5} 件`,icon('right')));
  }

  const due=habits.filter(hb=>!hb.paused&&habitDueOn(hb,dk));
  const habitDone=due.filter(hb=>logByHabit.has(hb.id)).length;
  const habitCard=h('section',{class:'card ref-compact-card ref-habit-card'},
    h('div',{class:'ref-card-head'},h('h2',null,'今日习惯'),h('button',{class:'more',onclick:()=>{location.hash='#/plan?tab=habits';}},`${habitDone}/${due.length}`,icon('right'))));
  if(!due.length) habitCard.append(h('p',{class:'paper-empty'},'今天没有需要打卡的习惯。'));
  else due.slice(0,5).forEach(hb=>{
    const checked=logByHabit.has(hb.id);
    habitCard.append(h('div',{class:'ref-habit-row'},
      h('button',{class:'checkbtn'+(checked?' on':''),'aria-label':(checked?'撤销':'完成')+hb.name,onclick:async()=>{
        if(checked) await doHabitUndo(hb,dk); else { const result=await doHabitDone(hb,dk); if(result) queueSettle([result]); }
        await ctx.rerender();
      }},icon('check')),
      h('span',{class:checked?'done':''},hb.name),h('small',null,habitFreqLabel(hb))));
  });
  view.append(h('div',{class:'ref-lower-grid'},taskCard,habitCard));

  const quickStrip=h('section',{class:'ref-quick-strip'},quickButtons.slice(0,4).map(q=>h('button',{onclick:async()=>{
    const result=await addQuickRecord({category:q.category,minutes:q.minutes||null,count:q.count||null,title:q.label});
    queueSettle([{ic:'quick',label:q.label,sub:q.minutes?fmtMin(q.minutes):catName(q.category),points:result.points}]); await ctx.rerender();
  }},icon(({sport:'footprint',study:'plan',cook:'gift',tidy:'home'})[q.category]||'quick'),q.label)));
  view.append(quickStrip,h('p',{class:'paper-page-note'},'今天没白过 · 把平凡的日子，过成喜欢的样子。'));

  function overviewCell(ic,value,label){return h('div',{class:'ref-overview-cell'},h('span',{class:'ref-overview-icon'},icon(ic)),h('div',null,h('b',null,String(value)),h('small',null,label)));}
  function fmtFocusCompact(min){if(!min)return '0m';if(min<60)return `${min}m`;const h=Math.floor(min/60),r=min%60;return r?`${h}h${r}m`:`${h}h`;}
  function todayOutflow(rows){const cents=rows.filter(r=>r.type==='out').reduce((n,r)=>n+(Number(r.amount)||0),0);return cents?fmtMoney(cents).replace(/^¥/,''):'0';}
  function todayMood(rows){const row=rows[0];if(!row?.mood)return '—';return moodById(row.mood)?.name||'已记';}
}

function refTaskRow(t,tplById,ctx){
  return h('div',{class:'ref-task-row'},
    h('button',{class:'checkbtn'+(t.done?' on':''),'aria-label':t.done?'撤销完成':'完成',onclick:async()=>{
      const res=t.done?await doTaskUndo(t):await doTaskComplete(t);if(res&&res.points!=null)queueSettle([res]);await ctx.rerender();
    }},icon('check')),
    h('button',{class:'ref-task-title'+(t.done?' done':''),onclick:()=>taskDialog(t)},t.title));
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
