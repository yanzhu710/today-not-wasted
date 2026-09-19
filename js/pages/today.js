// 今天没白过 · 「今天」页：宠物陪伴卡 / 主记录 / 快捷记录 / 追踪徽章 / 今日任务
import { all, allByIndex, put, del, get, loadKV } from '../core/db.js';
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
import { timeRangeField } from '../ui/time-range.js';

function diffDay(a, b) {
  const da = new Date(a + 'T00:00:00'), db = new Date(b + 'T00:00:00');
  return Math.round((db - da) / 86400000);
}

export async function renderToday(view, ctx) {
  const dk = todayKey();
  await ensureInstances(dk);
  const [tasks, habits, goals, appMeta, summary, todayLogs, pets, ledgerRows, journalRows] = await Promise.all([
    all('tasks'), all('habits'), all('goals'), loadKV('app_meta'), todaySummary(),
    allByIndex('habit_logs', 'dateKey', dk), all('pets'),
    allByIndex('ledger', 'dateKey', dk), allByIndex('journal', 'dateKey', dk),
  ]);
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
    { ic:'quick', label:'记录', action:()=>quickRecordDialog(), href:'footprint?tab=timeline&filter=quick' },
    { ic:'focus', label:'专注', action:()=>openFocus(), href:'footprint?tab=timeline&filter=focus' },
    { ic:'heart', label:'心情', action:async()=> (await import('./footprint.js')).journalDialog(), href:'footprint?tab=timeline&filter=journal' },
    { ic:'ledger', label:'记账', action:()=>quickLedgerDialog(), href:'footprint?tab=timeline&filter=ledger' },
  ];
  const actionGrid=h('section',{class:'ref-action-grid'});
  primaryActions.forEach((item,i)=>{
    const card=h('div',{class:`ref-action-card tone-${i}`},
      h('button',{class:'ref-action-main','aria-label':item.label,onclick:item.action},h('span',{class:'ref-action-blob'},icon(item.ic)),h('b',null,item.label)),
      h('button',{class:'ref-action-history','aria-label':`查看${item.label}记录`,onclick:()=>{location.hash='#/'+item.href;}},icon('book')));
    actionGrid.append(card);
  });
  view.append(actionGrid);


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
  const due=habits.filter(hb=>!hb.paused&&habitDueOn(hb,dk));
  const habitDone=due.filter(hb=>logByHabit.has(hb.id)).length;
  const activeGoals=goals.filter(g=>g.status!=='done').length;
  const planCard=h('section',{class:'card today-plan-card'},
    h('div',{class:'today-plan-head'},
      h('div',null,h('h2',null,'今日计划'),h('p',null,'今天要做的事，都在这里。')),
      h('button',{class:'paper-text-link',onclick:()=>{location.hash='#/plan?tab=tasks';}},'进入计划',icon('right'))),
    h('div',{class:'today-plan-summary'},
      h('span',null,h('b',{class:'num'},`${done.length}/${todayTasks.length}`),h('small',null,'待办')),
      h('span',null,h('b',{class:'num'},`${habitDone}/${due.length}`),h('small',null,'习惯')),
      h('span',null,h('b',{class:'num'},String(activeGoals)),h('small',null,'进行目标'))),
    h('div',{class:'today-plan-create'},
      h('button',{class:'btn btn-soft btn-sm',onclick:()=>taskDialog()},icon('plus'),'新建任务'),
      h('button',{class:'btn btn-soft btn-sm',onclick:async()=>{const m=await import('./plan.js');m.habitDialog();}},icon('plus'),'新建习惯')));
  const taskGroup=h('div',{class:'today-plan-group'},h('div',{class:'today-plan-label'},h('b',null,'待办'),h('button',{onclick:()=>{location.hash='#/plan?tab=tasks';}},'全部')));
  if(!todayTasks.length)taskGroup.append(h('p',{class:'paper-empty'},'今天还没有待办，可以直接新建。'));
  else [...undone,...done].slice(0,4).forEach(t=>taskGroup.append(refTaskRow(t,tplById,ctx)));
  const habitGroup=h('div',{class:'today-plan-group'},h('div',{class:'today-plan-label'},h('b',null,'习惯'),h('button',{onclick:()=>{location.hash='#/plan?tab=habits';}},'全部')));
  if(!due.length)habitGroup.append(h('p',{class:'paper-empty'},'今天没有需要打卡的习惯。'));
  else due.slice(0,4).forEach(hb=>{const checked=logByHabit.has(hb.id);habitGroup.append(h('div',{class:'ref-habit-row'},
    h('button',{class:'checkbtn'+(checked?' on':''),'aria-label':(checked?'撤销':'完成')+hb.name,onclick:async()=>{if(checked)await doHabitUndo(hb,dk);else{const result=await doHabitDone(hb,dk);if(result)queueSettle([result]);}await ctx.rerender();}},icon('check')),
    h('span',{class:checked?'done':''},hb.name),h('small',null,habitFreqLabel(hb))));});
  planCard.append(taskGroup,habitGroup);view.append(planCard);
  view.append(h('div',{class:'ref-dashboard-grid'},badgeSlot,overview));

  view.append(h('p',{class:'paper-page-note'},'今天没白过 · 把平凡的日子，过成喜欢的样子。'));

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
      h('div', { class: 'field-row' }, h('div', { class: 'form-item', style: 'flex:1' }, h('span', { class: 'form-label' }, '日期'), dateInp), h('div', { class: 'form-item', style: 'flex:1' }, h('span', { class: 'form-label' }, '预计用时（计划）'), estInp)),
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
export async function quickRecordDialog({ dateKey: recordDate = todayKey(), title = '', category = 'other', count = '', startTime = '', endTime = '', note = '' } = {}) {
  const dateInp = h('input', { class: 'input', type: 'date', value: recordDate });
  const nameInp = h('input', { class: 'input', placeholder: '例如：陪家人散步（可留空）', value:title });
  const catSel = h('select', { class: 'input' }, CATS.map((c) => h('option', { value: c.id, selected: c.id === category }, c.name)));
  const cntInp = h('input', { class: 'input', type: 'number', min: '1', placeholder: '次数（可选）', value:count });
  const timeRange = timeRangeField({start:startTime,end:endTime});
  const noteInp = h('input', { class: 'input', placeholder: '一句话备注（可选）', value:note });
  const { formDlg } = await import('../core/fx.js');
  const v = await formDlg({
    title: '记录一件小事',
    fields: [],
    submitLabel: '记录',
    extra: h('div', { class: 'form-list' },
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '日期'), dateInp),
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '事项名称'), nameInp),
      h('div', { class: 'field-row' }, h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '分类'), catSel), h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '次数'), cntInp)),
      timeRange.root,
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '备注'), noteInp)),
  });
  if (!v) return;
  const range=timeRange.get();
  if(!range.ok){toast('请同时选择有效的开始和结束时间',{ic:'error'});return;}
  if (!cntInp.value && !range.minutes && !nameInp.value.trim()) { toast('至少填写名称、次数或实际时间之一', { ic: 'error' }); return; }
  const res = await addQuickRecord({
    dateKey: dateInp.value || todayKey(), category: catSel.value, count: Number(cntInp.value) || null, minutes: range.minutes, startTime:range.startTime, endTime:range.endTime,
    note: noteInp.value.trim(), title: nameInp.value.trim() || null,
  });
  queueSettle([res]);
  toast('已保存到「记录」里', { ic: 'check' });
  window.dispatchEvent(new CustomEvent('tjmbg:rerender'));
}

// ---- 快速记账弹窗 ----
export async function quickLedgerDialog({ dateKey: presetDate = todayKey() } = {}) {
  const { LEDGER_OUT, LEDGER_IN } = await import('../core/catalog.js');
  let type = 'out';
  const amtInp = h('input', { class: 'input', type: 'number', min: '0', step: '0.01', inputmode: 'decimal', placeholder: '0.00' });
  const outSel = h('select', { class: 'input' }, LEDGER_OUT.map((c) => h('option', { value: c }, c)));
  const inSel = h('select', { class: 'input', style: 'display:none' }, LEDGER_IN.map((c) => h('option', { value: c }, c)));
  const dateInp = h('input', { class: 'input', type: 'date', value: presetDate });
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
          toast('账目已保存到「记录」', { ic:'check' });
          c();
          window.dispatchEvent(new CustomEvent('tjmbg:rerender'));
        },
      },
    ],
  });
}
