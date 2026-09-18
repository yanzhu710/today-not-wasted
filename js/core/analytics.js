// Presentation statistics and shares use this common contract. No writes; no new database schema.
import { all, loadKV } from './db.js';
import { CATS, BADGES, PETS } from './catalog.js';
import { todayKey, dateKey, parseKey, addDaysKey, weekdayOf, monthKeyOf } from './util.js';

export const VALID_KINDS = new Set(['task','habit','quick','focus','checklist','journal','ledger']);
export function isDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(parseKey(value)) === value;
}
export function isLifeEvent(e) {
  return !!e && VALID_KINDS.has(e.kind) && isDateKey(e.dateKey) && (e.kind !== 'focus' || Number(e.minutes) >= 5);
}
export function localStamp(value) {
  if (value == null || value === '') return null;
  const d = new Date(value); return Number.isFinite(d.getTime()) ? dateKey(d) : null;
}
export function periodRange(type = 'day', anchor = todayKey()) {
  if (!isDateKey(anchor)) throw new Error('日期无效');
  if (!['day','week','month'].includes(type)) throw new Error('时间范围无效');
  let start = anchor, end = anchor;
  if (type === 'week') { start = addDaysKey(anchor, 1-weekdayOf(anchor)); end = addDaysKey(start,6); }
  if (type === 'month') {
    start = `${monthKeyOf(anchor)}-01`;
    const d = parseKey(start); d.setMonth(d.getMonth()+1); d.setDate(0); end = dateKey(d);
  }
  const days = []; for (let d = start; d <= end; d = addDaysKey(d,1)) days.push(d);
  return { type, anchor, start, end, days, label: start === end ? start : `${start} — ${end}` };
}
const nonNegative = n => Number.isFinite(Number(n)) ? Math.max(0, Number(n)) : 0;
const mapBy = (rows,key='id') => new Map((rows || []).map(r => [r[key],r]));
export function aggregatePeriod(source = {}, type = 'day', anchor = todayKey()) {
  const range = periodRange(type,anchor);
  const within = d => !!d && d >= range.start && d <= range.end;
  const unique = new Map();
  for (const e of source.events || []) if (isLifeEvent(e)) unique.set(e.id || `${e.kind}:${e.refId}:${e.dateKey}`,e);
  const allEvents = [...unique.values()];
  const events = allEvents.filter(e => within(e.dateKey)).sort((a,b) => (Number(b.ts)||0)-(Number(a.ts)||0));
  const dayCounts = Object.fromEntries(range.days.map(d => [d,0]));
  const dayMinutes = Object.fromEntries(range.days.map(d => [d,0]));
  const cat = new Map(); const names = new Set(CATS.map(c=>c.id));
  for (const e of events) {
    dayCounts[e.dateKey]++;
    const minutes = nonNegative(e.minutes); dayMinutes[e.dateKey] += minutes;
    const id = names.has(e.category) ? e.category : 'other';
    const c = cat.get(id) || { id, count: 0, minutes: 0 }; c.count++; c.minutes += minutes; cat.set(id,c);
  }
  const tasks = mapBy(source.tasks), quick = mapBy(source.quick_records), lists = mapBy(source.checklists);
  const habits = mapBy(source.habits), logs = mapBy(source.habit_logs);
  const completedItems = events.filter(e => ['task','quick','habit','checklist'].includes(e.kind)).map(e => {
    let title;
    if (e.kind === 'task') title = tasks.get(e.refId)?.title;
    else if (e.kind === 'quick') title = quick.get(e.refId)?.title;
    else if (e.kind === 'habit') title = habits.get(logs.get(e.refId)?.habitId)?.name;
    else title = lists.get(e.refId)?.title;
    return { id:e.id, kind:e.kind, dateKey:e.dateKey, title: title || ({task:'完成任务',quick:'完成一件小事',habit:'完成习惯',checklist:'完成清单'}[e.kind]), category:e.category || 'other', minutes:nonNegative(e.minutes) };
  });
  const catalogue = mapBy(BADGES);
  const badgeMap = new Map();
  for (const row of source.badges || []) {
    const def = catalogue.get(row.badgeId);
    const obtainedDate = localStamp(row.ts ?? row.unlockedAt ?? row.createdAt);
    if (def && within(obtainedDate)) badgeMap.set(row.badgeId,{...def,ts:row.ts ?? row.unlockedAt ?? row.createdAt,obtainedDate});
  }
  const badges = [...badgeMap.values()].sort((a,b)=>Number(b.ts)-Number(a.ts));
  const activePet = (source.pets || []).find(p=>p.petId===source.appMeta?.activePet) || source.pets?.[0] || null;
  return {
    range, events, eventCount:events.length,
    // Counts are never taken from an already sliced display list.
    completedCount:completedItems.length, completedItems,
    taskCount:events.filter(e=>e.kind==='task').length,
    recordDays:Object.values(dayCounts).filter(n=>n>0).length,
    actualUseDays:new Set(allEvents.filter(e=>within(localStamp(e.ts))).map(e=>localStamp(e.ts))).size,
    focusMin:events.filter(e=>e.kind==='focus').reduce((n,e)=>n+nonNegative(e.minutes),0),
    recordedMin:events.reduce((n,e)=>n+nonNegative(e.minutes),0),
    dayCounts,dayMinutes,categories:[...cat.values()].sort((a,b)=>b.count-a.count),
    badges,badgeCount:badges.length,activePet,petDef:PETS.find(p=>p.petId===activePet?.petId) || null,
    profile:source.profile || {},
  };
}
export async function loadAnalyticsSource() {
  const names = ['events','tasks','quick_records','habits','habit_logs','checklists','badges','pets'];
  const values = await Promise.all(names.map(name=>all(name)));
  const [profile,appMeta] = await Promise.all([loadKV('profile'),loadKV('app_meta')]);
  return {...Object.fromEntries(names.map((name,i)=>[name,values[i]])),profile,appMeta};
}
export async function loadPeriodStats(type='day',anchor=todayKey()) { return aggregatePeriod(await loadAnalyticsSource(),type,anchor); }
export function loadRepairStyles() {
  if (document.getElementById('tjmbg-repair-style')) return;
  const link=document.createElement('link');link.id='tjmbg-repair-style';link.rel='stylesheet';
  link.href=new URL('../../css/repair.css',import.meta.url).href;document.head.append(link);
}
