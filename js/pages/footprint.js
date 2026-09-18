// 今天没白过 · 「足迹」页：月历（法定节假日/调休标注）/ 时间线 / 手账 / 账本 / 统计 / 回顾
import { all, allByIndex, put, del, get, loadKV, saveKV } from '../core/db.js';
import { CATS, catName, catColor, LEDGER_OUT, LEDGER_IN, MOODS, moodById, POINTS } from '../core/catalog.js';
import { stats, deleteJournal, deleteLedgerEntry, saveJournal, confirmReview, balance, addLedgerEntry } from '../core/engine.js';
import { h, icon, todayKey, dateKey, parseKey, addDaysKey, addMonthsKey, daysInMonth, weekdayOf, fmtCN, fmtCNFull, monthKeyOf, monthLabel, weekKeyOf, weekLabel, fmtMoney, fmtMin, fmtNum, uid } from '../core/util.js';
import { dayInfo, holidayName, hasHolidayData, holidayDaysInMonth, nextHoliday, blocksOfYear } from '../core/holidays.js';
import { moodArt } from '../core/art.js';
import { openModal, formDlg, actionSheet, confirmDlg, queueSettle, toast } from '../core/fx.js';
import { quickLedgerDialog } from './today.js';
import * as sound from '../core/sound.js';

let curTab = 'cal';
let curMonth = monthKeyOf(todayKey());
const DOT_COLORS = { task: '#748F72', habit: '#6FA88B', quick: '#D78367', focus: '#7A8FB5', journal: '#C48FB0', ledger: '#D8A94D', checklist: '#9AA07B' };

export async function renderFootprint(view, ctx) {
  view.innerHTML = '';
  const seg = h('div', { class: 'seg', style: 'margin-bottom:12px' },
    [['cal', '月历'], ['tl', '时间线'], ['journal', '手账'], ['ledger', '账本'], ['stats', '统计'], ['review', '回顾']].map(([id, nm]) =>
      h('button', { class: curTab === id ? 'on' : '', onclick: () => { curTab = id; sound.play('tap'); ctx.rerender(); } }, nm)));
  view.append(seg);
  const box = h('div');
  view.append(box);
  if (curTab === 'cal') await renderCalendar(box, ctx);
  else if (curTab === 'tl') await renderTimeline(box);
  else if (curTab === 'journal') await renderJournal(box, ctx);
  else if (curTab === 'ledger') await renderLedger(box, ctx);
  else if (curTab === 'stats') renderStats(box);
  else await renderReview(box, ctx);
}

// ================= 月历 =================
async function renderCalendar(box, ctx) {
  const [y, m] = curMonth.split('-').map(Number);
  const dk = todayKey();
  const [events, tasks, journal, ledgerRows] = await Promise.all([
    all('events'), all('tasks'), all('journal'), allByIndex('ledger', 'dateKey', curMonth),
  ]);
  const evByDate = new Map();
  for (const e of events) { if (!evByDate.has(e.dateKey)) evByDate.set(e.dateKey, []); evByDate.get(e.dateKey).push(e); }
  const jnByDate = new Map(journal.map((j) => [j.dateKey, j]));
  const monthEvents = events.filter((e) => monthKeyOf(e.dateKey) === curMonth);
  const validDays = new Set(monthEvents.map((e) => e.dateKey)).size;
  const spent = ledgerRows.filter((l) => l.type === 'out').reduce((a, l) => a + l.amount, 0);
  const income = ledgerRows.filter((l) => l.type === 'in').reduce((a, l) => a + l.amount, 0);
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
      h('button', { class: 'btn btn-soft btn-sm', onclick: () => { location.hash = '#/footprint'; } }, '记手账'),
      h('button', { class: 'btn btn-soft btn-sm', onclick: () => quickLedgerDialog() }, '补记账')));
  openModal({ title: fmtCNFull(dk) + (info.weekend ? '（周末）' : ''), content });
}
function kindName(k) {
  return { task: '任务', habit: '习惯', quick: '快捷记录', focus: '专注', checklist: '清单', journal: '手账', ledger: '记账', milestone: '里程碑', goal: '目标', review: '回顾', pet: '宠物互动', purchase: '兑换' }[k] || k;
}

// ================= 时间线 =================
async function renderTimeline(box) {
  const events = await all('events');
  const valid = events.filter((e) => e.kind !== 'pet' || true).sort((a, b) => b.ts - a.ts).slice(0, 200);
  const byDate = new Map();
  for (const e of valid) { if (!byDate.has(e.dateKey)) byDate.set(e.dateKey, []); byDate.get(e.dateKey).push(e); }
  const card = h('div', { class: 'card' });
  if (!valid.length) card.append(h('div', { class: 'empty' }, '还没有记录，从「今天」开始'));
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
  if (!entries.length) card.append(h('div', { class: 'empty' }, '一句话也好，今天的值得留下。', h('button', { class: 'act', onclick: () => journalDialog() }, '写第一句')));
  const { get: getRow } = await import('../core/db.js');
  for (const j of entries.slice(0, 60)) {
    const mood = moodById(j.mood);
    const row = h('div', { class: 'row-item', style: 'align-items:flex-start' },
      h('img', { class: 'avatar', style: 'width:34px;height:34px', src: moodArt(j.mood), alt: mood.name }),
      h('div', { class: 'row-main' },
        h('div', { class: 'row-sub' }, h('span', null, fmtCN(j.dateKey)), h('span', null, mood.name), j.category ? h('span', null, catName(j.category)) : null),
        j.text ? h('div', { class: 'row-title', style: 'white-space:normal;font-weight:500;margin-top:2px' }, j.text) : null,
        j.photoId ? h('img', { class: 'journal-photo', style: 'margin-top:8px', 'data-photo': j.photoId, alt: '照片' }) : null),
      h('button', { class: 'iconbtn', style: 'width:34px;height:34px;font-size:16px', onclick: () => journalDialog(j, ctx) }, icon('edit')));
    card.append(row);
  }
  box.append(card);
  fillPhotos(card);
}
export async function fillPhotos(rootEl) {
  const { get } = await import('../core/db.js');
  for (const img of rootEl.querySelectorAll('img[data-photo]')) {
    const row = await get('photos', img.dataset.photo).catch(() => null);
    if (row) img.src = URL.createObjectURL(row.thumb || row.blob);
  }
}
export async function journalDialog(entry = null, ctx = null) {
  const isNew = !entry;
  const j = entry || { id: null, dateKey: todayKey(), mood: 'good', text: '', photoId: null, category: null, ts: null };
  const dateInp = h('input', { class: 'input', type: 'date', value: j.dateKey });
  const ta = h('textarea', { class: 'input', rows: '3', placeholder: '一句话记录今天（可只选心情）', maxlength: '500' });
  ta.value = j.text || '';
  let mood = j.mood;
  const moodPick = h('div', { class: 'mood-pick' }, MOODS.map((m) => h('button', {
    class: m.id === mood ? 'on' : '', onclick: (e) => { mood = m.id; [...moodPick.children].forEach((x) => x.classList.remove('on')); e.currentTarget.classList.add('on'); sound.play('tap'); },
  }, h('img', { src: moodArt(m.id), alt: m.name }), m.name)));
  let photoId = j.photoId || null;
  const photoBtn = h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => {
    const inp = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      toast('正在压缩照片…', { ic: 'camera' });
      photoId = await compressPhoto(f);
      toast(photoId ? '照片已就绪' : '照片处理失败', { ic: photoId ? 'check' : 'error' });
    });
    document.body.append(inp); inp.click(); setTimeout(() => inp.remove(), 8000);
  } }, icon('camera'), photoId ? '更换照片' : '加一张照片');
  const catSel = h('select', { class: 'input' }, h('option', { value: '' }, '不分类'), CATS.map((c) => h('option', { value: c.id, selected: c.id === j.category }, c.name)));
  openModal({
    title: isNew ? '写手账' : '编辑手账',
    content: h('div', { class: 'form-list' },
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '日期（可补记往日）'), dateInp),
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '心情'), moodPick),
      h('div', { class: 'form-item' }, h('span', { class: 'form-label' }, '正文'), ta),
      h('div', { class: 'field-row' }, photoBtn, h('div', { class: 'form-item', style: 'flex:1' }, h('span', { class: 'form-label' }, '分类'), catSel))),
    actions: [
      isNew ? null : {
        label: '删除', cls: 'btn-danger', onClick: async (c) => {
          if (await confirmDlg('删除手账', '这条手账和相关奖励会同步修正。', { danger: true, okLabel: '删除' })) { await deleteJournal(j); c(); ctx && ctx.rerender(); }
        },
      },
      { label: '取消', onClick: (c) => c() },
      {
        label: '保存', cls: 'btn-primary', onClick: async (c) => {
          if (!ta.value.trim() && !photoId && mood === j.mood && !isNew) { c(); return; }
          if (!ta.value.trim() && !photoId) { toast('写一句话或加张照片吧', { ic: 'edit' }); return; }
          const res = await saveJournal({
            id: j.id || undefined, dateKey: dateInp.value || todayKey(), mood, text: ta.value.trim(),
            photoId, category: catSel.value || null, ts: j.ts,
          });
          if (res) queueSettle([res]);
          c(); ctx && ctx.rerender();
          window.dispatchEvent(new CustomEvent('tjmbg:rerender'));
        },
      },
    ],
  });
}
async function compressPhoto(file) {
  try {
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = URL.createObjectURL(file); });
    const long = Math.max(img.width, img.height);
    const ratio = Math.min(1, 1600 / long);
    const cv = h('canvas', { width: Math.round(img.width * ratio), height: Math.round(img.height * ratio) });
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    const blob = await new Promise((r) => cv.toBlob((b) => r(b), 'image/jpeg', 0.82));
    const tr = Math.min(1, 320 / long);
    const tv = h('canvas', { width: Math.round(img.width * tr), height: Math.round(img.height * tr) });
    tv.getContext('2d').drawImage(img, 0, 0, tv.width, tv.height);
    const thumb = await new Promise((r) => tv.toBlob((b) => r(b), 'image/jpeg', 0.75));
    const id = uid('ph');
    const { put } = await import('../core/db.js');
    await put('photos', { id, blob, thumb });
    return id;
  } catch { return null; }
}

// ================= 账本 =================
async function renderLedger(box, ctx) {
  const settings = await loadKV('settings');
  const rows = (await all('ledger')).filter((l) => monthKeyOf(l.dateKey) === curMonth).sort((a, b) => b.ts - a.ts);
  const out = rows.filter((r) => r.type === 'out').reduce((a, r) => a + r.amount, 0);
  const inc = rows.filter((r) => r.type === 'in').reduce((a, r) => a + r.amount, 0);
  const budget = (settings.ledgerBudget || {})[curMonth] || 0;
  const cur = settings.currency || '¥';
  const head = h('div', { class: 'cal-head' },
    h('button', { class: 'cal-nav', onclick: () => { curMonth = addMonthsKey(curMonth + '-01', -1).slice(0, 7); ctx.rerender(); } }, icon('back')),
    h('div', { class: 'cal-title' }, monthLabel(curMonth)),
    h('button', { class: 'cal-nav', onclick: () => { curMonth = addMonthsKey(curMonth + '-01', 1).slice(0, 7); ctx.rerender(); } }, icon('right')));
  const sumRow = h('div', { class: 'ledger-sum' },
    h('div', { class: 'stat-cell' }, h('div', { class: 'v num', style: 'color:var(--primary-deep)' }, fmtMoney(inc, cur)), h('div', { class: 'k' }, '收入')),
    h('div', { class: 'stat-cell' }, h('div', { class: 'v num', style: 'color:var(--accent)' }, fmtMoney(out, cur)), h('div', { class: 'k' }, '支出')),
    h('div', { class: 'stat-cell' }, h('div', { class: 'v num' }, fmtMoney(inc - out, cur)), h('div', { class: 'k' }, '本月差额')));
  const budgetRow = h('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:10px' },
    h('span', { class: 'tag' }, budget ? `预算 ${fmtMoney(budget, cur)}` : '未设预算'),
    budget ? h('div', { class: 'bar', style: 'flex:1' }, h('i', { style: `width:${Math.min(100, Math.round((out / budget) * 100))}%` })) : null,
    h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => {
      const v = await formDlg({ title: '月度预算', fields: [{ key: 'b', label: `${monthLabel(curMonth)}支出预算（元，留空清除）`, type: 'number', value: budget ? budget / 100 : '' }] });
      if (v === null) return;
      const b = v.b === '' ? 0 : Math.round(parseFloat(v.b) * 100) || 0;
      const nb = { ...(settings.ledgerBudget || {}) };
      if (b > 0) nb[curMonth] = b; else delete nb[curMonth];
      settings.ledgerBudget = nb;
      await saveKV('settings', settings);
      toast(b ? '预算已设置' : '预算已清除');
      ctx.rerender();
    } }, budget ? '调整' : '设置'));
  // 分类分布（支出）
  const byCat = new Map();
  for (const r of rows) if (r.type === 'out') byCat.set(r.category, (byCat.get(r.category) || 0) + r.amount);
  const catBox = h('div', { style: 'margin-bottom:10px' });
  const sorted = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length) {
    for (const [c, v] of sorted.slice(0, 6)) {
      catBox.append(h('div', { class: 'cat-bar-row' },
        h('span', { class: 'cb-label' }, c),
        h('div', { class: 'bar' }, h('i', { style: `width:${Math.round((v / out) * 100)}%;background:var(--accent)` })),
        h('span', { class: 'cb-val num' }, fmtMoney(v, cur))));
    }
  }
  // 近6个月趋势
  const trendBox = h('div', { style: 'display:flex;align-items:flex-end;gap:6px;height:80px;margin:6px 0 4px' });
  const months = [];
  for (let i = 5; i >= 0; i--) months.push(addMonthsKey(curMonth + '-01', -i).slice(0, 7));
  const allRows = await all('ledger');
  const maxV = Math.max(1, ...months.map((mk) => allRows.filter((r) => monthKeyOf(r.dateKey) === mk && r.type === 'out').reduce((a, r) => a + r.amount, 0)));
  for (const mk of months) {
    const v = allRows.filter((r) => monthKeyOf(r.dateKey) === mk && r.type === 'out').reduce((a, r) => a + r.amount, 0);
    trendBox.append(h('div', { style: 'flex:1;text-align:center' },
      h('div', { style: `height:${Math.max(4, Math.round((v / maxV) * 64))}px;background:${mk === curMonth ? 'var(--accent)' : 'var(--primary-soft)'};border-radius:6px 6px 2px 2px` }),
      h('div', { style: 'font-size:9.5px;color:var(--muted);margin-top:2px' }, mk.slice(5) + '月')));
  }
  const card = h('div', { class: 'card' }, head, sumRow, budgetRow,
    sorted.length ? h('div', { class: 'card-title' }, '支出分类') : null, catBox,
    h('div', { class: 'card-title' }, '近6个月支出趋势'), trendBox,
    h('button', { class: 'btn btn-primary btn-block btn-sm', onclick: () => quickLedgerDialog() }, icon('plus'), '记一笔'));
  const listCard = h('div', { class: 'card' }, h('div', { class: 'card-title' }, '账目明细'));
  if (!rows.length) listCard.append(h('div', { class: 'empty' }, '本月还没有账目'));
  for (const r of rows) {
    listCard.append(h('div', { class: 'row-item' },
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title', style: 'font-size:13.5px' }, r.category),
        h('div', { class: 'row-sub' }, h('span', null, fmtCN(r.dateKey)), r.note ? h('span', null, r.note) : null)),
      h('span', { class: 'row-pts' + (r.type === 'out' ? ' neg' : '') }, (r.type === 'in' ? '+' : '-') + fmtMoney(r.amount, cur).replace(cur, '')),
      h('button', { class: 'iconbtn', style: 'width:34px;height:34px;font-size:16px', onclick: async () => {
        await actionSheet(`${r.category} ${fmtMoney(r.amount, cur)}`, [
          { ic: 'trash', label: '删除这笔账', danger: true, onClick: async () => { await deleteLedgerEntry(r); toast('已删除，统计与奖励同步修正'); ctx.rerender(); } },
        ]);
      } }, icon('settings'))));
  }
  box.append(card, listCard);
}

// ================= 统计 =================
function renderStats(box) {
  const S = stats() || {};
  const totalEvents = (S.days ? S.days.size : 0);
  const card = h('div', { class: 'card' },
    h('div', { class: 'card-title' }, icon('footprint'), '累计统计'),
    h('div', { class: 'stat-row', style: 'flex-wrap:wrap' },
      statCell(fmtNum(totalEvents), '有效记录天数'),
      statCell(fmtNum(S.taskCount || 0), '完成任务'),
      statCell(fmtMin(S.focusMin || 0), '累计专注'),
      statCell(String(S.badgeCount || 0) + '/120', '徽章'),
      statCell(String(S.checklistDone || 0), '完成清单'),
      statCell(fmtNum(S.goalDone || 0), '达成目标'),
      statCell(fmtNum(S.ledgerCount || 0), '账目笔数'),
      statCell(fmtNum(S.petInteractions || 0), '宠物互动')));

  // === 环形分类图 ===
  const cs = Object.entries(S.catStats || {}).sort((a, b) => b[1].count - a[1].count);
  const totalCount = cs.reduce((sum, [, v]) => sum + v.count, 0);
  const donutCard = h('div', { class: 'card' }, h('div', { class: 'card-title' }, '生活分类分布'));
  if (!cs.length || totalCount === 0) {
    donutCard.append(h('div', { class: 'empty' }, '记录多了以后，这里会显示你的生活重心'));
  } else {
    // SVG donut chart
    const size = 200, cx = size/2, cy = size/2, r = 70, strokeW = 28;
    let offset = 0;
    const circumference = 2 * Math.PI * r;
    const arcs = cs.map(([c, v]) => {
      const pct = v.count / totalCount;
      const dashLen = pct * circumference;
      const el = h('circle', {
        cx, cy, r, fill: 'none', stroke: catColor(c), 'stroke-width': strokeW,
        'stroke-dasharray': `${dashLen} ${circumference - dashLen}`,
        'stroke-dashoffset': -offset,
        transform: `rotate(-90 ${cx} ${cy})`,
        style: 'transition:stroke-dasharray .6s ease,stroke-dashoffset .6s ease',
      });
      offset += dashLen;
      return el;
    });
    const svg = h('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}`, style: 'display:block;margin:0 auto' },
      h('circle', { cx, cy, r, fill: 'none', stroke: 'var(--surface2)', 'stroke-width': strokeW }),
      ...arcs,
      h('text', { x: cx, y: cy - 6, 'text-anchor': 'middle', style: 'font-size:28px;font-weight:800;fill:var(--text)' }, String(totalCount)),
      h('text', { x: cx, y: cy + 16, 'text-anchor': 'middle', style: 'font-size:12px;fill:var(--muted)' }, '总记录'));
    donutCard.append(svg);
    // Legend
    const legend = h('div', { style: 'display:flex;flex-direction:column;gap:6px;margin-top:12px' });
    for (const [c, v] of cs) {
      const pct = Math.round((v.count / totalCount) * 100);
      legend.append(h('div', { style: 'display:flex;align-items:center;gap:8px;font-size:13px' },
        h('span', { style: 'width:10px;height:10px;border-radius:3px;background:' + catColor(c) + ';flex:none' }),
        h('span', { style: 'flex:1' }, catName(c)),
        h('span', { style: 'color:var(--muted);font-variant-numeric:tabular-nums' }, `${v.count}次 · ${pct}%`)));
    }
    donutCard.append(legend);
  }

  // === 热力格（近30天） ===
  const heatCard = h('div', { class: 'card' }, h('div', { class: 'card-title' }, '近30天记录热力'));
  const daysSet = S.days || new Set();
  const today = todayKey();
  const heatGrid = h('div', { style: 'display:grid;grid-template-columns:repeat(10,1fr);gap:4px;margin-top:8px' });
  for (let i = 29; i >= 0; i--) {
    const dk = addDaysKey(today, -i);
    const has = daysSet.has(dk);
    heatGrid.append(h('div', {
      style: `aspect-ratio:1;border-radius:4px;background:${has ? 'var(--primary)' : 'var(--surface2)'};opacity:${has ? 0.7 : 0.5}`,
      title: dk,
    }));
  }
  heatCard.append(heatGrid);
  heatCard.append(h('div', { style: 'font-size:11px;color:var(--muted);margin-top:8px;text-align:center' }, '深色 = 当天有记录'));

  box.append(card, donutCard, heatCard);
}
function statCell(v, k) { return h('div', { class: 'stat-cell', style: 'min-width:30%' }, h('div', { class: 'v num' }, v), h('div', { class: 'k' }, k)); }

// ================= 周月回顾 =================
async function renderReview(box, ctx) {
  const dk = todayKey();
  const wk = weekKeyOf(dk);
  const mk = monthKeyOf(dk);
  const [events, tasks, ledgerRows, reviews, badges, focusRows] = await Promise.all([
    all('events'), all('tasks'), all('ledger'), all('reviews'), all('badges'), all('focus_sessions'),
  ]);
  const weekEvents = events.filter((e) => weekKeyOf(e.dateKey) === wk);
  const weekDays = new Set(weekEvents.map((e) => e.dateKey)).size;
  const weekFocus = focusRows.filter((f) => weekKeyOf(f.dateKey) === wk).reduce((a, f) => a + f.minutes, 0);
  const weekTasks = tasks.filter((t) => t.done && weekKeyOf(t.dateKey) === wk).length;
  const weekBadges = badges.filter((b) => weekKeyOf(new Date(b.ts).toISOString().slice(0, 10)) === wk).length;
  const wkDone = reviews.some((r) => r.id === `week:${wk}`);
  const monthEvents = events.filter((e) => monthKeyOf(e.dateKey) === mk);
  const monthDays = new Set(monthEvents.map((e) => e.dateKey)).size;
  const monthLedger = ledgerRows.filter((l) => monthKeyOf(l.dateKey) === mk);
  const mOut = monthLedger.filter((l) => l.type === 'out').reduce((a, l) => a + l.amount, 0);
  const mIn = monthLedger.filter((l) => l.type === 'in').reduce((a, l) => a + l.amount, 0);
  const mkDone = reviews.some((r) => r.id === `month:${mk}`);
  const settings = await loadKV('settings');

  const weekCard = h('div', { class: 'card' },
    h('div', { class: 'card-title' }, icon('calendar'), '周回顾 · ' + weekLabel(wk),
      wkDone ? h('span', { class: 'tag tag-pri' }, '已确认') : null),
    h('ul', { style: 'margin:0;padding-left:18px;font-size:13.5px;color:var(--muted);line-height:2' },
      h('li', null, `有效记录 ${weekDays} 天，完成任务 ${weekTasks} 件`),
      h('li', null, `专注 ${fmtMin(weekFocus)}`),
      h('li', null, `解锁徽章 ${weekBadges} 枚`),
      h('li', null, `宠物和家园在等你继续`)),
    h('div', { class: 'btn-row', style: 'margin-top:10px' },
      wkDone ? h('span', { class: 'row-sub' }, '本周回顾已确认，下周继续') :
        h('button', { class: 'btn btn-primary btn-sm', style: 'flex:1', onclick: async () => {
          const res = await confirmReview('week', wk);
          if (res && res.points) { queueSettle([{ ic: 'calendar', label: '确认周回顾', points: res.points }]); }
          toast(res ? '已确认' : '本周已确认过');
          ctx.rerender();
        } }, `确认本周回顾（+${POINTS.weekReview.delta}积分）`)));
  const monthCard = h('div', { class: 'card' },
    h('div', { class: 'card-title' }, icon('calendar'), '月回顾 · ' + monthLabel(mk),
      mkDone ? h('span', { class: 'tag tag-pri' }, '已确认') : null),
    h('ul', { style: 'margin:0;padding-left:18px;font-size:13.5px;color:var(--muted);line-height:2' },
      h('li', null, `有效记录 ${monthDays} 天`),
      h('li', null, `收入 ${fmtMoney(mIn, settings.currency)} · 支出 ${fmtMoney(mOut, settings.currency)}（默认不进入分享卡）`),
      h('li', null, `本月徽章 ${badges.filter((b) => monthKeyOf(new Date(b.ts).toISOString().slice(0, 10)) === mk).length} 枚`)),
    h('div', { class: 'btn-row', style: 'margin-top:10px' },
      mkDone ? h('span', { class: 'row-sub' }, '本月回顾已确认') :
        h('button', { class: 'btn btn-soft btn-sm', style: 'flex:1', onclick: async () => { await confirmReview('month', mk); toast('已确认月度回顾'); ctx.rerender(); } }, '确认月度回顾'),
      h('button', { class: 'btn btn-warn btn-sm', style: 'flex:1', onclick: () => shareCard(mk) }, '生成月度分享卡')));
  box.append(weekCard, monthCard,
    h('div', { class: 'form-hint', style: 'text-align:center;padding:0 12px;line-height:1.8' },
      '分享卡默认不包含账目金额与手账正文，只有天数、专注和徽章这些想展示的成就。'));
}

// 月度分享卡：canvas 绘制 → 下载 PNG
async function shareCard(mk) {
  const S = stats() || {};
  const [events, badges] = await Promise.all([all('events'), all('badges')]);
  const monthEvents = events.filter((e) => monthKeyOf(e.dateKey) === mk);
  const days = new Set(monthEvents.map((e) => e.dateKey)).size;
  const focusMin = monthEvents.filter((e) => e.kind === 'focus').reduce((a, e) => a + (e.minutes || 0), 0);
  const bCount = badges.filter((b) => monthKeyOf(new Date(b.ts).toISOString().slice(0, 10)) === mk).length;
  const catCount = S.cats ? S.cats.size : 0;
  const cv = h('canvas', { width: 750, height: 1200 });
  const c = cv.getContext('2d');
  const rr = (x, y2, w, hh, r, fill) => {
    c.fillStyle = fill;
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y2, w, hh, r);
    else c.rect(x, y2, w, hh);
    c.fill();
  };
  // 渐变背景
  const grad = c.createLinearGradient(0, 0, 0, 1200);
  grad.addColorStop(0, '#F0E8D5');
  grad.addColorStop(0.5, '#E8E0CC');
  grad.addColorStop(1, '#D8CCB0');
  c.fillStyle = grad;
  c.fillRect(0, 0, 750, 1200);
  // 装饰圆
  c.fillStyle = 'rgba(116,143,114,0.08)';
  c.beginPath(); c.arc(650, 120, 100, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(80, 1100, 130, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(216,169,77,0.1)';
  c.beginPath(); c.arc(100, 150, 60, 0, Math.PI * 2); c.fill();
  // 主卡片
  rr(50, 50, 650, 1100, 40, '#FFFDF8');
  // 顶部装饰条
  rr(50, 50, 650, 8, 4, '#748F72');
  // 标题区域
  c.fillStyle = '#748F72';
  c.beginPath(); c.arc(375, 180, 48, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#FFFDF8';
  c.font = 'bold 36px sans-serif';
  c.textAlign = 'center';
  c.fillText('☀', 375, 195);
  c.textAlign = 'left';
  c.fillStyle = '#2F3430';
  c.font = 'bold 42px sans-serif';
  c.fillText('今天没白过', 200, 290);
  c.font = '24px sans-serif';
  c.fillStyle = '#747A73';
  c.fillText(monthLabel(mk) + ' · 月度生活足迹', 200, 328);
  // 分隔线
  c.strokeStyle = '#E7E0D2';
  c.lineWidth = 2;
  c.beginPath(); c.moveTo(100, 370); c.lineTo(650, 370); c.stroke();
  // 数据卡片 - 2x2 网格
  const items = [
    ['🌿', '有效记录', days + ' 天', '#748F72'],
    ['⏱', '累计专注', fmtMin(focusMin), '#5B8DB8'],
    ['🏅', '解锁徽章', bCount + ' 枚', '#D8A94D'],
    ['📊', '生活分类', catCount + ' 类', '#D78367'],
  ];
  const cardW = 260, cardH = 180, gap = 20;
  const startX = 100, startY = 410;
  items.forEach(([icon, label, value, color], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = startX + col * (cardW + gap);
    const y = startY + row * (cardH + gap);
    rr(x, y, cardW, cardH, 24, '#F7F3EA');
    c.fillStyle = color;
    c.font = '32px sans-serif';
    c.fillText(icon, x + 24, y + 52);
    c.fillStyle = '#747A73';
    c.font = '20px sans-serif';
    c.fillText(label, x + 24, y + 90);
    c.fillStyle = '#2F3430';
    c.font = 'bold 40px sans-serif';
    c.fillText(value, x + 24, y + 145);
  });
  // 底部标语
  c.fillStyle = '#D78367';
  c.font = 'bold 26px sans-serif';
  c.textAlign = 'center';
  c.fillText('把普通日子变成看得见的成就', 375, 920);
  c.fillStyle = '#9BA39B';
  c.font = '20px sans-serif';
  c.fillText('— 今天没白过 · 生活记录 —', 375, 960);
  // 底部装饰
  c.fillStyle = 'rgba(116,143,114,0.15)';
  for (let i = 0; i < 5; i++) {
    c.beginPath();
    c.arc(200 + i * 80, 1020, 4, 0, Math.PI * 2);
    c.fill();
  }
  const blob = await new Promise((r) => cv.toBlob((b) => r(b), 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: `今天没白过_月度回顾_${mk}.png` });
  document.body.append(a); a.click(); a.remove();
  toast('分享卡已生成并下载', { ic: 'download' });
}
