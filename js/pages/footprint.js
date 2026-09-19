// 今天没白过 · 「足迹」页：月历（法定节假日/调休标注）/ 时间线 / 手账 / 账本 / 统计 / 回顾
import { all, allByIndex, put, del, get, loadKV, saveKV } from '../core/db.js';
import { CATS, catName, catColor, LEDGER_OUT, LEDGER_IN, MOODS, moodById, POINTS } from '../core/catalog.js';
import { stats, deleteJournal, deleteLedgerEntry, saveJournal, confirmReview, balance, addLedgerEntry } from '../core/engine.js';
import { h, icon, todayKey, dateKey, parseKey, addDaysKey, addMonthsKey, daysInMonth, weekdayOf, fmtCN, fmtCNFull, monthKeyOf, monthLabel, weekKeyOf, weekLabel, fmtMoney, fmtMin, fmtNum, uid } from '../core/util.js';
import { dayInfo, holidayName, hasHolidayData, holidayDaysInMonth, nextHoliday, blocksOfYear } from '../core/holidays.js';
import { moodArt } from '../core/art.js';
import { openModal, formDlg, actionSheet, confirmDlg, queueSettle, toast } from '../core/fx.js';
import { quickLedgerDialog, quickRecordDialog } from './today.js';
import * as sound from '../core/sound.js';
import { renderStatsView } from '../core/stats-view.js';
import { isValidRecord, summarizeRecords, timestampDay } from '../core/record-summary.js';
import { openSharePanel } from '../core/share.js';
import { routeTabs } from '../ui/tabs.js';

let curMonth = monthKeyOf(todayKey());
const DOT_COLORS = { task: '#748F72', habit: '#6FA88B', quick: '#D78367', focus: '#7A8FB5', journal: '#C48FB0', ledger: '#D8A94D', checklist: '#9AA07B' };

export async function renderFootprint(view, ctx) {
  const raw = ctx.routeParams?.get('tab') || 'timeline';
  const legacy = { cal:'calendar', tl:'timeline', journal:'timeline', ledger:'timeline', stats:'data', review:'data' };
  const tab = ['timeline','calendar','data'].includes(raw) ? raw : (legacy[raw] || 'timeline');
  let filter = ctx.routeParams?.get('filter') || 'all';
  if (raw === 'journal') filter = 'journal';
  if (raw === 'ledger') filter = 'ledger';
  if (!['all','quick','focus','journal','ledger'].includes(filter)) filter = 'all';
  if (legacy[raw]) history.replaceState(null,'','#/footprint?tab='+tab+(filter!=='all'?'&filter='+filter:''));
  view.replaceChildren();
  view.dataset.recordTab = tab;
  view.append(routeTabs({
    value: tab,
    ariaLabel: '记录查看方式',
    items: [
      { id:'timeline', label:'记录', href:'footprint?tab=timeline' },
      { id:'calendar', label:'日历', href:'footprint?tab=calendar' },
      { id:'data', label:'数据', href:'footprint?tab=data' },
    ],
  }));
  const box = h('div', { class:'record-content' });
  view.append(box);
  if (tab === 'timeline') await renderRecordFeed(box, ctx, filter);
  else if (tab === 'calendar') await renderCalendar(box, ctx);
  else {
    const dataView=ctx.routeParams?.get('view')==='ledger'?'ledger':'life';
    box.append(routeTabs({value:dataView,ariaLabel:'数据类型',className:'data-view-tabs',items:[
      {id:'life',label:'生活数据',href:'footprint?tab=data&view=life'},
      {id:'ledger',label:'账本分析',href:'footprint?tab=data&view=ledger'},
    ]}));
    if(dataView==='ledger') await renderLedger(box,ctx);
    else {
      box.append(h('section',{class:'card record-data-intro'},
        h('div',{class:'card-title'},icon('stats'),'数据与回顾',h('button',{class:'more',onclick:()=>openSharePanel()},icon('share'),'分享')),
        h('p',{class:'row-sub'},'看看这段时间留下了什么，也可以生成一张回顾分享。')));
      await renderStats(box);
      await renderReview(box, ctx);
    }
  }
}

async function renderRecordFeed(box, ctx, filter = 'all') {
  const [events, quickRows, focusRows, journalRows, ledgerRows, tasks, habits, habitLogs, appMeta, pets] = await Promise.all([
    all('events'), all('quick_records'), all('focus_sessions'), all('journal'), all('ledger'), all('tasks'), all('habits'), all('habit_logs'), loadKV('app_meta'), all('pets'),
  ]);
  const quickMap = new Map(quickRows.map(r=>[r.id,r]));
  const focusMap = new Map(focusRows.map(r=>[r.id,r]));
  const journalMap = new Map(journalRows.map(r=>[r.id,r]));
  const ledgerMap = new Map(ledgerRows.map(r=>[r.id,r]));
  const taskMap = new Map(tasks.map(r=>[r.id,r]));
  const habitMap = new Map(habits.map(r=>[r.id,r]));
  const habitLogMap = new Map(habitLogs.map(r=>[r.id,r]));

  let recordPet = null;
  try {
    const active = pets.find(p=>p.petId===appMeta.activePet) || pets[0];
    if (active) { const { petFigure } = await import('../ui/paper.js'); recordPet = petFigure(active); }
  } catch {}
  box.append(h('section',{class:'record-art-hero'},
    h('div',{class:'record-art-copy'},
      h('span',{class:'record-art-kicker'},'LIFE NOTES'),
      h('h2',null,'生活一件一件记，',h('br'),'就会慢慢发光。'),
      h('p',null,'已经发生的小事、专注、心情和账目，都沿着时间留在这里。'),
      h('div',{class:'record-art-tags'},h('span',null,'按时间排列'),h('span',null,'真实记录'),h('span',null,'随时回看'))),
    recordPet ? h('div',{class:'record-art-pet'},recordPet) : h('div',{class:'record-art-mark','aria-hidden':'true'},'♡'),
    h('span',{class:'record-art-leaf leaf-one','aria-hidden':'true'}),
    h('span',{class:'record-art-leaf leaf-two','aria-hidden':'true'}),
    h('span',{class:'record-art-tape','aria-hidden':'true'})));

  box.append(routeTabs({
    value: filter,
    ariaLabel: '记录类型',
    className: 'record-filter-tabs',
    items: [
      {id:'all',label:'全部',href:'footprint?tab=timeline&filter=all'},
      {id:'quick',label:'小事',href:'footprint?tab=timeline&filter=quick'},
      {id:'focus',label:'专注',href:'footprint?tab=timeline&filter=focus'},
      {id:'journal',label:'心情',href:'footprint?tab=timeline&filter=journal'},
      {id:'ledger',label:'账目',href:'footprint?tab=timeline&filter=ledger'},
    ],
  }));
  if(filter==='ledger') box.append(h('div',{class:'record-filter-action'},h('button',{class:'btn btn-soft btn-sm',onclick:()=>{location.hash='#/footprint?tab=data&view=ledger';}},icon('stats'),'查看账本分析')));

  const actualTs = e => {
    if(e.kind==='quick'){const r=quickMap.get(e.refId);if(r?.startTime){const t=Date.parse(`${e.dateKey}T${r.startTime}:00`);if(Number.isFinite(t))return t;}}
    if(e.kind==='focus'){const r=focusMap.get(e.refId);if(Number.isFinite(Number(r?.startedTs)))return Number(r.startedTs);}
    return Number(e.ts)||0;
  };
  const visible = events
    .filter(e => isValidRecord(e))
    .filter(e => filter === 'all' || e.kind === filter)
    .sort((a,b) => (b.dateKey || '').localeCompare(a.dateKey || '') || actualTs(b)-actualTs(a))
    .slice(0,260);
  if (!visible.length) {
    const {petEmptyState}=await import('../ui/empty.js');
    box.append(await petEmptyState('records',{actionLabel:filter==='all'?'去今天记录':'查看全部记录',onAction:()=>{location.hash=filter==='all'?'#/today':'#/footprint?tab=timeline&filter=all';}}));
    return;
  }

  const dayCount = new Map(); visible.forEach(e=>dayCount.set(e.dateKey,(dayCount.get(e.dateKey)||0)+1));
  const card = h('section',{class:'record-feed record-timeline-art'});
  let lastDate = '';
  for (const e of visible) {
    if (e.dateKey !== lastDate) {
      lastDate = e.dateKey;
      const info=dayInfo(e.dateKey);
      card.append(h('div',{class:'record-date-head'},
        h('div',{class:'record-date-brush'},h('b',null,e.dateKey===todayKey()?'今天':fmtCN(e.dateKey)),h('small',null,info.weekend?'周末':'生活足迹')),
        h('span',{class:'record-day-count'},`${dayCount.get(e.dateKey)||0} 条记录`)));
    }
    const meta = recordMeta(e);
    const row = h('article',{class:'record-feed-row timeline-row kind-'+e.kind+(meta.click?' clickable':''),'data-kind':e.kind},
      h('span',{class:'record-kind-icon','aria-hidden':'true'},icon(kindIcon(e.kind))),
      h('div',{class:'record-feed-main'},
        h('div',{class:'record-feed-title'},h('b',null,meta.title),h('time',null,meta.timeLabel||new Date(actualTs(e)||Date.now()).toTimeString().slice(0,5))),
        meta.sub ? h('div',{class:'record-feed-sub'},meta.sub) : null,
        meta.photoId ? h('img',{class:'journal-photo record-photo','data-photo':meta.photoId,alt:'手账照片',loading:'lazy'}) : null),
      h('span',{class:'record-kind-label'},kindName(e.kind)),
      h('span',{class:'record-row-doodle','aria-hidden':'true'},e.kind==='journal'?'♡':e.kind==='focus'?'✦':e.kind==='ledger'?'◌':'·'));
    if (meta.click) row.addEventListener('click', meta.click);
    card.append(row);
  }
  box.append(card);
  await fillPhotos(card);

  function recordMeta(e) {
    if (e.kind === 'quick') {
      const r=quickMap.get(e.refId);const range=r?.startTime&&r?.endTime?`${r.startTime}–${r.endTime}`:''; return {title:r?.title||r?.note||catName(e.category)||'记录了一件小事',timeLabel:r?.startTime||null,sub:[range,r?.minutes?fmtMin(r.minutes):'',r?.count?`×${r.count}`:'',r?.note||''].filter(Boolean).join(' · ')};
    }
    if (e.kind === 'focus') {
      const r=focusMap.get(e.refId);const st=Number(r?.startedTs),et=Number(r?.endedTs);const range=Number.isFinite(st)&&Number.isFinite(et)?`${new Date(st).toTimeString().slice(0,5)}–${new Date(et).toTimeString().slice(0,5)}`:''; return {title:`专注 ${fmtMin(e.minutes||r?.minutes||0)}`,timeLabel:Number.isFinite(st)?new Date(st).toTimeString().slice(0,5):null,sub:[range,r?.note||''].filter(Boolean).join(' · ')};
    }
    if (e.kind === 'journal') {
      const r=journalMap.get(e.refId); return {title:r?.text||'记录了一份心情',sub:r?.mood?`心情 · ${moodById(r.mood)?.name||'已记录'}`:'',photoId:r?.photoId||null,click:r?()=>journalDialog(r,ctx):null};
    }
    if (e.kind === 'ledger') {
      const r=ledgerMap.get(e.refId); const settingsCurrency='¥';
      return {title:r?`${r.type==='in'?'收入':'支出'} · ${r.category}`:'记了一笔账',sub:r?`${fmtMoney(r.amount,settingsCurrency)}${r.note?' · '+r.note:''}`:''};
    }
    if (e.kind === 'task') { const r=taskMap.get(e.refId); return {title:r?.title||'完成了一项任务',sub:r?.category?catName(r.category):''}; }
    if (e.kind === 'habit') { const log=habitLogMap.get(e.refId), hb=habitMap.get(log?.habitId); return {title:hb?.name||'完成了一次习惯',sub:hb?.category?catName(hb.category):''}; }
    return {title:kindName(e.kind),sub:e.note|| (e.minutes?fmtMin(e.minutes):'')};
  }
}

// ================= 月历 =================
async function renderCalendar(box, ctx) {
  const [y, m] = curMonth.split('-').map(Number);
  const dk = todayKey();
  const [events, tasks, journal, ledgerRows] = await Promise.all([
    all('events'), all('tasks'), all('journal'), all('ledger'),
  ]);
  const evByDate = new Map();
  for (const e of events) { if (!evByDate.has(e.dateKey)) evByDate.set(e.dateKey, []); evByDate.get(e.dateKey).push(e); }
  const jnByDate = new Map(journal.map((j) => [j.dateKey, j]));
  const monthEvents = events.filter((e) => monthKeyOf(e.dateKey) === curMonth);
  const validDays = new Set(monthEvents.map((e) => e.dateKey)).size;
  const spent = ledgerRows.filter((l) => l.type === 'out' && monthKeyOf(l.dateKey) === curMonth).reduce((a, l) => a + l.amount, 0);
  const income = ledgerRows.filter((l) => l.type === 'in' && monthKeyOf(l.dateKey) === curMonth).reduce((a, l) => a + l.amount, 0);
  const holDays = holidayDaysInMonth(curMonth);
  const nh = nextHoliday(dk);

  const head = h('div', { class: 'cal-head' },
    h('button', { class: 'cal-nav', onclick: () => { curMonth = addMonthsKey(curMonth + '-01', -1).slice(0, 7); sound.play('tap'); ctx.rerender(); } }, icon('back')),
    h('div', { class: 'cal-title' }, monthLabel(curMonth)),
    h('button', { class: 'cal-nav', onclick: () => { curMonth = addMonthsKey(curMonth + '-01', 1).slice(0, 7); sound.play('tap'); ctx.rerender(); } }, icon('right')));
  const infoRow = h('div', { class: 'row-sub', style: 'justify-content:center;margin-bottom:8px;flex-wrap:wrap' },
    h('span', { class: 'tag tag-pri' }, `有效记录 ${validDays} 天`),
    holDays ? h('span', { class: 'tag tag-hol' }, `法定假日 ${holDays} 天`) : null,
    spent || income ? h('span', { class: 'tag' }, `支 ${fmtMoney(spent)} / 收 ${fmtMoney(income)}`) : null,
    !hasHolidayData(y) ? h('span', { class: 'tag' }, `${y}年放假安排待国务院公布，暂按周末显示`) : null,
    nh && nh.start.slice(0, 4) === String(y) ? h('span', { class: 'tag tag-acc' }, `下一个假期：${nh.name} ${fmtCN(nh.start)}起`) : null);

  const grid = h('div', { class: 'cal-grid' });
  for (const wd of ['一', '二', '三', '四', '五', '六', '日']) grid.append(h('div', { class: 'cal-wd' }, wd));
  const first = `${curMonth}-01`;
  const lead = weekdayOf(first) - 1; // 周一为一行开头
  for (let i = 0; i < lead; i++) grid.append(h('div', { class: 'cal-cell blank' }));
  const total = daysInMonth(y, m - 1);
  for (let d = 1; d <= total; d++) {
    const key = `${curMonth}-${String(d).padStart(2, '0')}`;
    const info = dayInfo(key);
    const evs = evByDate.get(key) || [];
    const dots = [...new Set(evs.filter((e) => DOT_COLORS[e.kind]).map((e) => e.kind))].slice(0, 4);
    const cell = h('button', { class: 'cal-cell' + (info.weekend ? ' weekend' : '') + (info.holiday ? ' holiday' : '') + (info.makeup ? ' makeup' : '') + (key === dk ? ' today' : ''), onclick: () => daySheet(key) },
      info.makeup ? h('span', { class: 'mk work' }, '班') : info.holiday ? h('span', { class: 'mk rest' }, '休') : null,
      h('span', { class: 'd num' }, String(d)),
      dots.length ? h('span', { class: 'cal-dots' }, dots.map((k) => h('i', { style: `background:${DOT_COLORS[k]}` }))) : null);
    grid.append(cell);
  }
  const legend = h('div', { class: 'row-sub', style: 'justify-content:center;margin-top:10px' },
    h('span', null, h('b', { style: 'color:var(--danger)' }, '休'), ' 法定假日'),
    h('span', null, h('b', { style: 'color:var(--info)' }, '班'), ' 调休上班'),
    h('span', null, '橙字为周末'));
  box.append(h('div', { class: 'card' }, head, infoRow, grid, legend));
}

async function daySheet(dk) {
  const [tasks, evs, jnRows, lg] = await Promise.all([
    allByIndex('tasks', 'dateKey', dk), allByIndex('events', 'dateKey', dk),
    allByIndex('journal', 'dateKey', dk), allByIndex('ledger', 'dateKey', dk),
  ]);
  const jn = jnRows[0] || null;
  const info = dayInfo(dk);
  const doneTasks = tasks.filter((t) => t.done);
  const focusEv = evs.filter((e) => e.kind === 'focus').reduce((a, e) => a + (e.minutes || 0), 0);
  const outSum = lg.filter((l) => l.type === 'out').reduce((a, l) => a + l.amount, 0);
  const inSum = lg.filter((l) => l.type === 'in').reduce((a, l) => a + l.amount, 0);
  const journalRow = jn && jn.dateKey === dk ? jn : null;
  const sec = (title, node) => h('div', { class: 'day-sheet-sec' }, h('div', { class: 'form-label' }, title), node);
  const content = h('div', null,
    info.holiday || info.makeup ? h('div', {
      class: 'card', style: 'padding:10px 14px;background:' + (info.makeup ? 'var(--info-soft)' : 'var(--danger-soft)') + ';border:0',
    }, h('b', null, info.makeup ? '调休上班日' : info.holiday), h('div', { style: 'font-size:12px;color:var(--muted)' }, info.makeup ? '今天是调休补班，周末变工作日' : '法定休假日，好好休息或做点喜欢的事')) : null,
    sec('任务', doneTasks.length ? h('div', null, doneTasks.map((t) => h('div', { class: 'row-title', style: 'font-size:13.5px' }, '✓ ' + t.title))) : h('div', { class: 'row-sub' }, '无完成任务')),
    sec('记录', (() => {
      const kinds = evs.filter((e) => e.kind !== 'focus');
      if (!kinds.length && !focusEv) return h('div', { class: 'row-sub' }, '这一天还没有其他记录');
      return h('div', null,
        focusEv ? h('div', { class: 'row-title', style: 'font-size:13.5px' }, `专注 ${fmtMin(focusEv)}`) : null,
        kinds.slice(0, 12).map((e) => h('div', { class: 'row-title', style: 'font-size:13.5px' },
          `${kindName(e.kind)}${e.category ? ' · ' + catName(e.category) : ''}${e.note ? ' · ' + e.note : ''}`)));
    })()),
    journalRow ? sec('手账', h('div', { class: 'row-title', style: 'font-size:13.5px' }, journalRow.text || '（只有心情）')) : null,
    outSum || inSum ? sec('账目', h('div', { class: 'row-title', style: 'font-size:13.5px' }, `支 ${fmtMoney(outSum)} · 收 ${fmtMoney(inSum)}`)) : null,
    h('div', { class: 'btn-row', style: 'margin-top:6px' },
      h('button', { class: 'btn btn-soft btn-sm', onclick: () => quickRecordDialog({dateKey:dk}) }, '记小事'),
      h('button', { class: 'btn btn-soft btn-sm', onclick: () => journalDialog(null,null,dk) }, '补心情'),
      h('button', { class: 'btn btn-soft btn-sm', onclick: () => quickLedgerDialog({dateKey:dk}) }, '补记账')));
  openModal({ title: fmtCNFull(dk) + (info.weekend ? '（周末）' : ''), content });
}
function kindName(k) {
  return { task: '任务', habit: '习惯', quick: '快捷记录', focus: '专注', checklist: '清单', journal: '心情', ledger: '记账', milestone: '里程碑', goal: '目标', review: '回顾', pet: '宠物互动', purchase: '兑换' }[k] || k;
}

// ================= 时间线 =================
async function renderTimeline(box) {
  const events = await all('events');
  const valid = events.filter((e) => e.kind !== 'pet').sort((a, b) => b.ts - a.ts).slice(0, 200);
  const byDate = new Map();
  for (const e of valid) { if (!byDate.has(e.dateKey)) byDate.set(e.dateKey, []); byDate.get(e.dateKey).push(e); }
  const card = h('div', { class: 'card' });
  if (!valid.length) { const {petEmptyState}=await import('../ui/empty.js'); card.append(await petEmptyState('records',{compact:true})); }
  let lastD = '';
  for (const e of valid) {
    if (e.dateKey !== lastD) {
      lastD = e.dateKey;
      const info = dayInfo(lastD);
      card.append(h('div', { class: 'tl-date' }, fmtCN(lastD),
        info.holiday ? h('span', { class: 'tag tag-hol' }, info.holiday) : info.makeup ? h('span', { class: 'tag tag-work' }, '班') : null));
    }
    card.append(h('div', { class: 'row-item' },
      h('span', { class: 'settle-ic', style: 'width:30px;height:30px;font-size:14px' }, icon(kindIcon(e.kind))),
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title', style: 'font-size:13.5px' }, kindName(e.kind), e.refId && (e.kind === 'purchase') ? '' : e.category ? ' · ' + catName(e.category) : ''),
        h('div', { class: 'row-sub' },
          e.minutes ? h('span', null, fmtMin(e.minutes)) : null,
          e.note ? h('span', null, e.note) : null,
          h('span', null, new Date(e.ts).toTimeString().slice(0, 5))))));
  }
  box.append(card);
}
function kindIcon(k) { return { task: 'task', habit: 'task', quick: 'quick', focus: 'focus', checklist: 'list', journal: 'journal', ledger: 'ledger', milestone: 'flag', goal: 'wish', purchase: 'gift', pet: 'pet' }[k] || 'star'; }

// ================= 手账 =================
async function renderJournal(box, ctx) {
  const entries = await all('journal');
  entries.sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.ts - a.ts);
  const card = h('div', { class: 'card' },
    h('div', { class: 'card-title' }, icon('journal'), '生活手账',
      h('button', { class: 'more', onclick: () => journalDialog() }, icon('plus'), '写一句')));
  if (!entries.length) { const {petEmptyState}=await import('../ui/empty.js'); card.append(await petEmptyState('journal',{compact:true,actionLabel:'写一句',onAction:()=>journalDialog()})); }
  const { get: getRow } = await import('../core/db.js');
  for (const j of entries.slice(0, 60)) {
    const mood = moodById(j.mood);
    const row = h('div', { class: 'row-item', style: 'align-items:flex-start' },
      h('img', { class: 'avatar', style: 'width:34px;height:34px', src: moodArt(j.mood), alt: mood.name }),
      h('div', { class: 'row-main' },
        h('div', { class: 'row-sub' }, h('span', null, fmtCN(j.dateKey)), h('span', null, mood.name), j.category ? h('span', null, catName(j.category)) : null),
        j.text ? h('div', { class: 'row-title', style: 'white-space:normal;font-weight:500;margin-top:2px' }, j.text) : null,
        j.photoId ? h('img', { class: 'journal-photo', style: 'margin-top:8px', 'data-photo': j.photoId, alt: '照片', loading:'lazy' }) : null),
      h('button', { class: 'iconbtn', style: 'width:34px;height:34px;font-size:16px', onclick: () => journalDialog(j, ctx) }, icon('edit')));
    card.append(row);
  }
  box.append(card);
  fillPhotos(card);
}
export async function fillPhotos(rootEl) {
  const { get } = await import('../core/db.js');
  for (const img of rootEl.querySelectorAll('img[data-photo]')) {
    const photoId = img.dataset.photo;
    const row = await get('photos', photoId).catch(() => null);
    if (row) {
      const url = URL.createObjectURL(row.blob || row.thumb);
      img.addEventListener('load', () => URL.revokeObjectURL(url), { once:true });
      img.src = url;
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', '查看大图');
      img.addEventListener('click', (e) => { e.stopPropagation(); openJournalPhoto(photoId); });
      img.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openJournalPhoto(photoId); } });
    }
  }
}
async function openJournalPhoto(photoId) {
  const row = await get('photos', photoId).catch(() => null);
  if (!row) { toast('这张照片暂时无法读取', { ic:'error' }); return; }
  const url = URL.createObjectURL(row.blob || row.thumb);
  const img = h('img', { class:'journal-photo-viewer', src:url, alt:'手账照片大图' });
  openModal({ title:'手账照片', content:img, noPad:true, onClose:()=>URL.revokeObjectURL(url) });
}
export async function journalDialog(entry = null, ctx = null, presetDate = null) {
  const isNew = !entry;
  const j = entry || { id: null, dateKey: presetDate || todayKey(), mood: 'good', text: '', photoId: null, category: null, ts: null };
  const dateInp = h('input', { class: 'input', type: 'date', value: j.dateKey });
  const ta = h('textarea', { class: 'input', rows: '3', placeholder: '一句话记录今天（可只选心情）', maxlength: '500' });
  ta.value = j.text || '';
  let mood = j.mood;
  const moodPick = h('div', { class: 'mood-pick' }, MOODS.map((m) => h('button', {
    class: m.id === mood ? 'on' : '', onclick: (e) => { mood = m.id; [...moodPick.children].forEach((x) => x.classList.remove('on')); e.currentTarget.classList.add('on'); sound.play('tap'); },
  }, h('img', { src: moodArt(m.id), alt: m.name }), m.name)));
  const originalPhotoId = j.photoId || null;
  let photoId = originalPhotoId;
  const tempPhotoIds = new Set();
  let previewUrl = null;
  const photoPreview = h('div', { class: 'journal-upload-preview' },
    h('div', { class:'journal-upload-empty' }, icon('camera'), h('span',null,'还没有照片')));
  async function refreshPhotoPreview() {
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    photoPreview.replaceChildren();
    if (!photoId) {
      photoPreview.append(h('div',{class:'journal-upload-empty'},icon('camera'),h('span',null,'还没有照片')));
      return;
    }
    const row = await get('photos', photoId).catch(()=>null);
    if (!row) {
      photoPreview.append(h('div',{class:'journal-upload-empty'},icon('error'),h('span',null,'照片暂时无法读取')));
      return;
    }
    previewUrl = URL.createObjectURL(row.blob || row.thumb);
    const img = h('img',{src:previewUrl,alt:'手账照片预览',tabindex:'0',role:'button','aria-label':'查看大图'});
    img.addEventListener('click',()=>openJournalPhoto(photoId));
    img.addEventListener('keydown',(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openJournalPhoto(photoId);}});
    const remove = h('button',{class:'journal-photo-remove',type:'button','aria-label':'移除照片',onclick:async()=>{
      const removed = photoId; photoId=null;
      if (removed && tempPhotoIds.has(removed)) { tempPhotoIds.delete(removed); await del('photos', removed).catch(()=>{}); }
      photoBtn.replaceChildren(icon('camera'),'选择照片');
      refreshPhotoPreview();
    }},icon('close'));
    photoPreview.append(img, remove);
  }
  const photoBtn = h('button', { class: 'btn btn-ghost btn-sm journal-photo-button', onclick: async () => {
    const inp = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      photoBtn.disabled = true;
      toast('正在处理照片…', { ic: 'camera' });
      const nextId = await compressPhoto(f);
      photoBtn.disabled = false;
      if (!nextId) { toast('照片处理失败，请换一张重试', { ic: 'error' }); return; }
      if (photoId && tempPhotoIds.has(photoId)) { const old=photoId; tempPhotoIds.delete(old); await del('photos',old).catch(()=>{}); }
      photoId = nextId; tempPhotoIds.add(nextId);
      photoBtn.replaceChildren(icon('camera'),'更换照片');
      await refreshPhotoPreview();
      toast('照片已就绪', { ic: 'check' });
    });
    document.body.append(inp); inp.click(); setTimeout(() => inp.remove(), 8000);
  } }, icon('camera'), photoId ? '更换照片' : '选择照片');
  refreshPhotoPreview();
  const catSel = h('select', { class: 'input' }, h('option', { value: '' }, '不分类'), CATS.map((c) => h('option', { value: c.id, selected: c.id === j.category }, c.name)));
  let dialogFinalized = false;
  openModal({
    title: isNew ? '记录心情' : '编辑心情',
    content: h('div', { class: 'form-list' },
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '日期（可补记往日）'), dateInp),
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '心情'), moodPick),
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '正文'), ta),
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '照片'), photoPreview),
      h('div', { class: 'field-row journal-photo-actions' }, photoBtn, h('div', { class: 'form-item', style: 'flex:1' }, h('span', { class: 'form-label' }, '分类'), catSel))),
    actions: [
      isNew ? null : {
        label: '删除', cls: 'btn-danger', onClick: async (c) => {
          if (await confirmDlg('删除心情记录', '这条心情记录和相关奖励会同步修正。', { danger: true, okLabel: '删除' })) {
            await deleteJournal(j);
            for (const id of tempPhotoIds) await del('photos',id).catch(()=>{});
            if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl=null; }
            dialogFinalized = true;
            c(); ctx && ctx.rerender();
          }
        },
      },
      { label: '取消', onClick: async (c) => { for (const id of tempPhotoIds) await del('photos',id).catch(()=>{}); tempPhotoIds.clear(); if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl=null; } dialogFinalized=true; c(); } },
      {
        label: '保存', cls: 'btn-primary', onClick: async (c) => {
          if (!ta.value.trim() && !photoId && mood === j.mood && !isNew) { c(); return; }
          const res = await saveJournal({
            id: j.id || undefined, dateKey: dateInp.value || todayKey(), mood, text: ta.value.trim(),
            photoId, category: catSel.value || null, ts: j.ts,
          });
          if (originalPhotoId && originalPhotoId !== photoId) await del('photos', originalPhotoId).catch(()=>{});
          for (const id of [...tempPhotoIds]) if (id !== photoId) await del('photos',id).catch(()=>{});
          tempPhotoIds.clear();
          if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl=null; }
          if (res) queueSettle([res]);
          toast('心情已保存到「记录」', { ic:'check' });
          dialogFinalized=true;
          c(); ctx && ctx.rerender();
          window.dispatchEvent(new CustomEvent('tjmbg:rerender'));
        },
      },
    ],
    onClose: () => {
      if (dialogFinalized) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      for (const id of tempPhotoIds) del('photos', id).catch(()=>{});
    },
  });
}
async function compressPhoto(file) {
  try {
    const img = await new Promise((resolve, reject) => { const url=URL.createObjectURL(file); const i=new Image(); i.onload=()=>{URL.revokeObjectURL(url);resolve(i);}; i.onerror=(err)=>{URL.revokeObjectURL(url);reject(err);}; i.src=url; });
    const long = Math.max(img.width, img.height);
    const ratio = Math.min(1, 2400 / long);
    const cv = h('canvas', { width: Math.round(img.width * ratio), height: Math.round(img.height * ratio) });
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    const blob = await new Promise((r) => cv.toBlob((b) => r(b), 'image/jpeg', 0.9));
    const tr = Math.min(1, 960 / long);
    const tv = h('canvas', { width: Math.round(img.width * tr), height: Math.round(img.height * tr) });
    tv.getContext('2d').drawImage(img, 0, 0, tv.width, tv.height);
    const thumb = await new Promise((r) => tv.toBlob((b) => r(b), 'image/jpeg', 0.86));
    const id = uid('ph');
    const { put } = await import('../core/db.js');
    await put('photos', { id, blob, thumb });
    return id;
  } catch { return null; }
}

// ================= 账本 =================
async function renderLedger(box, ctx) {
  const settings = await loadKV('settings');
  const allRows = await all('ledger');
  const rows = allRows.filter((l) => monthKeyOf(l.dateKey) === curMonth).sort((a, b) => (b.dateKey||'').localeCompare(a.dateKey||'') || (b.ts||0)-(a.ts||0));
  const out = rows.filter(r=>r.type==='out').reduce((n,r)=>n+r.amount,0), inc=rows.filter(r=>r.type==='in').reduce((n,r)=>n+r.amount,0);
  const budget=(settings.ledgerBudget||{})[curMonth]||0, cur=settings.currency||'¥';
  const head=h('div',{class:'ledger-analysis-head'},
    h('button',{class:'cal-nav','aria-label':'上个月',onclick:()=>{curMonth=addMonthsKey(curMonth+'-01',-1).slice(0,7);ctx.rerender('footprint?tab=data&view=ledger');}},icon('back')),
    h('div',null,h('b',null,monthLabel(curMonth)),h('span',null,'账本分析')),
    h('button',{class:'cal-nav','aria-label':'下个月',onclick:()=>{curMonth=addMonthsKey(curMonth+'-01',1).slice(0,7);ctx.rerender('footprint?tab=data&view=ledger');}},icon('right')));
  const summary=h('div',{class:'ledger-analysis-summary'},
    ledgerMetric('收入',fmtMoney(inc,cur),'income'),ledgerMetric('支出',fmtMoney(out,cur),'out'),ledgerMetric('结余',fmtMoney(inc-out,cur),'balance'));
  const byCat=new Map();for(const r of rows)if(r.type==='out')byCat.set(r.category,(byCat.get(r.category)||0)+r.amount);
  const sorted=[...byCat.entries()].sort((a,b)=>b[1]-a[1]);
  const palette=['#d98d72','#e6b85f','#7c9b7e','#7b94b2','#ad8aa3','#8ca8a0'];let acc=0;const segments=[];
  for(let i=0;i<sorted.length;i++){const pct=out?sorted[i][1]/out*100:0;segments.push(`${palette[i%palette.length]} ${acc}% ${acc+pct}%`);acc+=pct;}
  const donut=h('div',{class:'ledger-donut',style:`--ledger-gradient:${segments.length?`conic-gradient(${segments.join(',')})`:'conic-gradient(var(--surface2) 0 100%)'}`},h('div',null,h('b',null,out?fmtMoney(out,cur):'0'),h('span',null,'本月支出')));
  const legend=h('div',{class:'ledger-legend'});sorted.slice(0,6).forEach(([cat,val],i)=>legend.append(h('div',null,h('i',{style:`background:${palette[i%palette.length]}`}),h('span',null,cat),h('b',null,`${out?Math.round(val/out*100):0}% · ${fmtMoney(val,cur)}`))));
  if(!sorted.length)legend.append(h('p',{class:'paper-empty'},'本月还没有支出分类。'));
  const budgetBox=h('div',{class:'ledger-budget'},h('div',null,h('b',null,'月度预算'),h('span',null,budget?`${fmtMoney(out,cur)} / ${fmtMoney(budget,cur)}`:'还未设置预算')),
    budget?h('div',{class:'bar'},h('i',{style:`width:${Math.min(100,Math.round(out/budget*100))}%`})):null,
    h('button',{class:'btn btn-ghost btn-sm',onclick:async()=>{const v=await formDlg({title:'月度预算',fields:[{key:'b',label:`${monthLabel(curMonth)}支出预算（元，留空清除）`,type:'number',value:budget?budget/100:''}]});if(v===null)return;const b=v.b===''?0:Math.round(parseFloat(v.b)*100)||0;const nb={...(settings.ledgerBudget||{})};if(b>0)nb[curMonth]=b;else delete nb[curMonth];settings.ledgerBudget=nb;await saveKV('settings',settings);ctx.rerender('footprint?tab=data&view=ledger');}},budget?'调整预算':'设置预算'));
  const months=[];for(let i=5;i>=0;i--)months.push(addMonthsKey(curMonth+'-01',-i).slice(0,7));
  const totals=months.map(mk=>allRows.filter(r=>r.type==='out'&&monthKeyOf(r.dateKey)===mk).reduce((n,r)=>n+r.amount,0)),max=Math.max(1,...totals);
  const trend=h('div',{class:'ledger-trend'});months.forEach((mk,i)=>trend.append(h('div',null,h('span',{style:`height:${Math.max(4,totals[i]/max*78)}px`}),h('small',null,mk.slice(5)+'月'),h('b',null,totals[i]?fmtMoney(totals[i],cur):'0'))));
  const biggest=sorted[0];
  const analysis=h('section',{class:'card ledger-analysis-card'},head,summary,h('div',{class:'ledger-analysis-main'},donut,legend),budgetBox,
    h('div',{class:'ledger-section-title'},'近 6 个月支出趋势'),trend,
    biggest?h('p',{class:'ledger-insight'},`本月支出最多的是「${biggest[0]}」，占 ${Math.round(biggest[1]/out*100)}%。`):h('p',{class:'ledger-insight'},'开始记账后，这里会自动生成真实的分类和趋势分析。'),
    h('button',{class:'btn btn-primary btn-block',onclick:()=>quickLedgerDialog()},icon('plus'),'记一笔'));
  const listCard=h('section',{class:'card ledger-list-card'},h('div',{class:'card-title'},'账目明细',h('span',{class:'tag'},`${rows.length} 笔`)));
  if(!rows.length){const {petEmptyState}=await import('../ui/empty.js');listCard.append(await petEmptyState('records',{compact:true,actionLabel:'记一笔',onAction:()=>quickLedgerDialog()}));}
  rows.forEach(r=>listCard.append(h('div',{class:'row-item'},h('div',{class:'row-main'},h('div',{class:'row-title'},r.category),h('div',{class:'row-sub'},h('span',null,fmtCN(r.dateKey)),r.note?h('span',null,r.note):null)),h('span',{class:'row-pts'+(r.type==='out'?' neg':'')},(r.type==='in'?'+':'-')+fmtMoney(r.amount,cur).replace(cur,'')),h('button',{class:'iconbtn','aria-label':'账目操作',onclick:async()=>{await actionSheet(`${r.category} ${fmtMoney(r.amount,cur)}`,[{ic:'trash',label:'删除这笔账',danger:true,onClick:async()=>{await deleteLedgerEntry(r);toast('已删除，统计与奖励同步修正');ctx.rerender('footprint?tab=data&view=ledger');}}]);}},icon('settings')))));
  box.append(analysis,listCard);
  function ledgerMetric(label,value,tone){return h('div',{class:'ledger-metric '+tone},h('span',null,label),h('b',{class:'num'},value));}
}

// ================= 统计 =================
async function renderStats(box) { return renderStatsView(box); }
function statCell(v, k) { return h('div', { class: 'stat-cell', style: 'min-width:30%' }, h('div', { class: 'v num' }, v), h('div', { class: 'k' }, k)); }

// ================= 周月回顾 =================
async function renderReview(box, ctx) {
  const dk=todayKey(), wk=weekKeyOf(dk), mk=monthKeyOf(dk);
  const [events,tasks,reviews,badges,focusRows,pets,meta]=await Promise.all([
    all('events'),all('tasks'),all('reviews'),all('badges'),all('focus_sessions'),all('pets'),loadKV('app_meta')
  ]);
  const weekEvents=events.filter(e=>weekKeyOf(e.dateKey)===wk), monthEvents=events.filter(e=>monthKeyOf(e.dateKey)===mk);
  const weekDays=new Set(weekEvents.map(e=>e.dateKey)).size, monthDays=new Set(monthEvents.map(e=>e.dateKey)).size;
  const weekFocus=focusRows.filter(f=>weekKeyOf(f.dateKey)===wk).reduce((a,f)=>a+(f.minutes||0),0);
  const weekTasks=tasks.filter(t=>t.done&&weekKeyOf(t.dateKey)===wk).length;
  const weekBadges=badges.filter(b=>weekKeyOf(new Date(b.ts).toISOString().slice(0,10))===wk).length;
  const monthFocus=focusRows.filter(f=>monthKeyOf(f.dateKey)===mk).reduce((a,f)=>a+(f.minutes||0),0);
  const monthTasks=tasks.filter(t=>t.done&&monthKeyOf(t.dateKey)===mk).length;
  const monthBadges=badges.filter(b=>monthKeyOf(new Date(b.ts).toISOString().slice(0,10))===mk).length;
  const wkDone=reviews.some(r=>r.id===`week:${wk}`), mkDone=reviews.some(r=>r.id===`month:${mk}`);
  let pet=null;try{const active=pets.find(p=>p.petId===meta.activePet)||pets[0];if(active){const {petFigure}=await import('../ui/paper.js');pet=petFigure(active);}}catch{}
  const hub=h('section',{class:'review-hub'},
    h('div',{class:'review-hub-copy'},h('span',null,'回顾'),h('h2',null,'把这一段生活收好'),h('p',null,'看看这一周或这个月留下了什么，也可以生成分享卡。')),
    pet?h('div',{class:'review-hub-pet'},pet):null,
    h('div',{class:'review-period-grid'},
      reviewPeriod('week','本周',weekLabel(wk),weekDays,weekTasks,weekFocus,weekBadges,wkDone),
      reviewPeriod('month','本月',monthLabel(mk),monthDays,monthTasks,monthFocus,monthBadges,mkDone)),
    h('button',{class:'btn btn-primary review-share-main',onclick:()=>openSharePanel({type:'week',dateKey:dk})},icon('share'),'生成回顾分享'));
  box.append(hub);

  function reviewPeriod(type,title,label,days,taskN,focusMin,badgeN,done){
    return h('article',{class:'review-period'},
      h('div',{class:'review-period-head'},h('b',null,title),h('small',null,label),done?h('span',{class:'tag tag-pri'},'已确认'):null),
      h('div',{class:'review-metrics'},
        h('span',null,h('b',{class:'num'},days),h('small',null,'记录日')),
        h('span',null,h('b',{class:'num'},taskN),h('small',null,'完成事项')),
        h('span',null,h('b',{class:'num'},fmtMin(focusMin)),h('small',null,'专注')),
        h('span',null,h('b',{class:'num'},badgeN),h('small',null,'新徽章'))),
      h('div',{class:'review-period-actions'},
        done?h('span',{class:'review-confirmed'},'这段回顾已经收好'):
          h('button',{class:'btn btn-soft btn-sm',onclick:async()=>{const result=await confirmReview(type,type==='week'?wk:mk);if(result?.points)queueSettle([{ic:'calendar',label:`确认${title}回顾`,points:result.points}]);toast('已确认回顾',{ic:'check'});ctx.rerender();}},'确认回顾'),
        h('button',{class:'btn btn-ghost btn-sm',onclick:()=>openSharePanel({type,dateKey:dk})},'分享')));
  }
}

