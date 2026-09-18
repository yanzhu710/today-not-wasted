// 记录、统计、回顾、分享共用口径。纯计算不发奖、不写业务数据。
import { all, loadKV } from './db.js';
import { BADGES, PETS, catName } from './catalog.js';
import { dateKey as localDateKey, todayKey, parseKey, addDaysKey, weekdayOf } from './util.js';

export const VALID_KINDS = new Set(['task', 'habit', 'quick', 'focus', 'checklist', 'journal', 'ledger']);
const COMPLETED_KINDS = new Set(['task', 'habit', 'quick', 'checklist']);
export function isDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = parseKey(value);
  return Number.isFinite(d.getTime()) && localDateKey(d) === value;
}
export function isValidRecord(e) {
  return !!e && VALID_KINDS.has(e.kind) && isDateKey(e.dateKey) &&
    (e.kind !== 'focus' || (Number.isFinite(Number(e.minutes)) && Number(e.minutes) >= 5));
}
export function timestampDay(value) {
  if (value == null || value === '') return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? localDateKey(d) : null;
}
export function periodRange(type = 'day', anchor = todayKey()) {
  if (!isDateKey(anchor)) throw new Error('日期无效，请重新选择');
  if (type === 'day') return { type, start: anchor, end: anchor, anchor };
  if (type === 'week') {
    const start = addDaysKey(anchor, 1 - weekdayOf(anchor));
    return { type, start, end: addDaysKey(start, 6), anchor };
  }
  if (type === 'month') {
    const d = parseKey(anchor);
    return { type, start: anchor.slice(0, 7) + '-01', end: localDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0)), anchor };
  }
  throw new Error('不支持的统计范围');
}
export function periodDays(range) {
  const out = [];
  for (let d = range.start; d <= range.end; d = addDaysKey(d, 1)) out.push(d);
  return out;
}
export function uniqueValidEvents(events = []) {
  const seen = new Set();
  return events.filter(e => {
    if (!isValidRecord(e)) return false;
    if (e.id && seen.has(e.id)) return false;
    if (e.id) seen.add(e.id);
    return true;
  });
}
export function summarizeRecords(source = {}, type = 'day', anchor = todayKey()) {
  const range = periodRange(type, anchor);
  const inside = d => d && d >= range.start && d <= range.end;
  const valid = uniqueValidEvents(source.events || []);
  const events = valid.filter(e => inside(e.dateKey)).sort((a, b) => (Number(a.ts) || 0) - (Number(b.ts) || 0));
  const dayCounts = Object.fromEntries(periodDays(range).map(d => [d, 0]));
  const dayMinutes = Object.fromEntries(periodDays(range).map(d => [d, 0]));
  const cats = {};
  let focusMin = 0;
  for (const e of events) {
    const min = Number.isFinite(Number(e.minutes)) ? Math.max(0, Number(e.minutes)) : 0;
    const category = e.category || (e.kind === 'ledger' ? 'finance' : 'other');
    const c = cats[category] ||= { id: category, name: catName(category), count: 0, minutes: 0 };
    c.count++; c.minutes += min;
    dayCounts[e.dateKey]++; dayMinutes[e.dateKey] += min;
    if (e.kind === 'focus') focusMin += min;
  }
  const by = list => new Map((list || []).map(r => [r.id, r]));
  const tasks = by(source.tasks), quick = by(source.quick_records), habits = by(source.habits);
  const logs = by(source.habit_logs), lists = by(source.checklists);
  const completed = events.filter(e => COMPLETED_KINDS.has(e.kind)).map(e => {
    const row = e.kind === 'task' ? tasks.get(e.refId) : e.kind === 'quick' ? quick.get(e.refId) :
      e.kind === 'habit' ? habits.get(logs.get(e.refId)?.habitId) : lists.get(e.refId);
    return { eventId: e.id, refId: e.refId, kind: e.kind, dateKey: e.dateKey,
      title: row?.title || row?.name || e.meta?.title || `${catName(e.category)}记录`, minutes: Number(e.minutes) || 0 };
  });
  const badgeMap = new Map(BADGES.map(b => [b.id, b]));
  const seenBadges = new Set();
  const newBadges = (source.badges || []).filter(b => {
    const day = timestampDay(b.ts ?? b.unlockedAt ?? b.createdAt);
    if (!inside(day) || seenBadges.has(b.badgeId) || !badgeMap.has(b.badgeId)) return false;
    seenBadges.add(b.badgeId); return true;
  }).map(b => ({ ...badgeMap.get(b.badgeId), ts: b.ts ?? b.unlockedAt ?? b.createdAt }));
  const activeId = source.appMeta?.activePet;
  const activePet = (source.pets || []).find(p => p.petId === activeId) || source.pets?.[0] || null;
  const recordDays = Object.values(dayCounts).filter(Boolean).length;
  // actualSaveDays 按实际保存时间统计；补记日期不能冒充多日回访。
  const actualSaveDays = new Set(valid.map(e => timestampDay(e.ts)).filter(inside)).size;
  return { range, events, dayCounts, dayMinutes, categories: Object.values(cats), recordDays, actualSaveDays,
    validCount: events.length, completedCount: completed.length, taskCount: events.filter(e => e.kind === 'task').length,
    completed, focusMin, newBadges, badgeCount: newBadges.length, activePet,
    petDef: PETS.find(p => p.petId === activePet?.petId), profile: source.profile || {} };
}
export async function loadRecordSource() {
  const names = ['events','tasks','quick_records','habits','habit_logs','checklists','badges','pets'];
  const rows = await Promise.all(names.map(n => all(n)));
  const [appMeta, profile] = await Promise.all([loadKV('app_meta'), loadKV('profile')]);
  return { ...Object.fromEntries(names.map((n, i) => [n, rows[i]])), appMeta, profile };
}
export async function loadPeriodSummary(type, anchor) { return summarizeRecords(await loadRecordSource(), type, anchor); }
