// 今天没白过 · 业务引擎：completion_event / 积分流水 / 日上限 / 成长值 / 徽章解锁 / 撤销修正
// 原则：先可靠保存，后庆祝；同一来源不重复发奖（grantOnce 幂等）；余额 = 流水求和。
import { put, get, del, all, allByIndex, getByIndex, atomically, loadKV, saveKV, patchKV } from './db.js';
import { BADGES, POINTS, GROWTH, STAGES, stageOf, PETS, shopById, catName, isUnlocked, unlockText } from './catalog.js';
import { todayKey, dateKey, weekKeyOf, monthKeyOf, uid, fmtMin, debounce } from './util.js';
import { VALID_KINDS, isLifeEvent, aggregatePeriod } from './analytics.js';
import { buyAtomic, consumeAtomic, redeemCustomRewardAtomic } from './inventory-ops.js';
import * as fx from './fx.js';
import * as sound from './sound.js';

export const DATA_EVENT = 'tjmbg:data';
function emit() { window.dispatchEvent(new CustomEvent(DATA_EVENT)); }

let _bal = null;               // 积分余额缓存（=流水求和）
let _S = null;                 // 统计缓存
const KIND_CAP = { task: POINTS.task.capPerDay, habit: POINTS.habit.capPerDay, quick: POINTS.quick.capPerDay, focus: POINTS.focus.capPerDay, ledger: POINTS.ledger.capPerDay, journal: POINTS.journal.capPerDay, checklist: POINTS.checklist.capPerDay, weekReview: POINTS.weekReview.capPerDay };

export async function initEngine() {
  _caps = { date: null, all: 0, byKind: {} };
  const rows = await all('points');
  _bal = rows.reduce((a, r) => a + r.delta, 0);
  await recomputeStats();
}
export function balance() { return _bal ?? 0; }
export function stats() { return _S; }

// ---- 积分发放（幂等 + 双重日上限：分类上限 + 全局100/天）----
let _caps = { date: null, all: 0, byKind: {} };
async function capsFor(dk) {
  if (_caps.date === dk) return _caps;
  const rows = await allByIndex('points', 'dateKey', dk);
  _caps = { date: dk, all: 0, byKind: {} };
  for (const r of rows) {
    // daily 正向计入上限；adjust（撤销修正的负数）按原 kind 回补上限
    if (r.cls === 'daily' && r.delta > 0) {
      _caps.all += r.delta;
      _caps.byKind[r.kind] = (_caps.byKind[r.kind] || 0) + r.delta;
    } else if (r.cls === 'adjust' && r.delta < 0 && KIND_CAP[r.kind] != null) {
      _caps.all += r.delta;
      _caps.byKind[r.kind] = (_caps.byKind[r.kind] || 0) + r.delta;
    }
  }
  return _caps;
}
async function grantPoints({ dedupe = null, delta, reason, kind, cls = 'daily', dateKey = todayKey(), sourceEventId = null }) {
  if (!delta || delta <= 0) return 0;
  if (dedupe) {
    const ok = await grantOnceCheck(dedupe);
    if (!ok) return 0;
  }
  if (cls === 'daily') {
    const caps = await capsFor(dateKey);
    const kc = KIND_CAP[kind];
    if (kc != null) delta = Math.min(delta, Math.max(0, kc - (caps.byKind[kind] || 0)));
    delta = Math.min(delta, Math.max(0, POINTS.dailyAllCap - caps.all));
    if (delta <= 0) return 0;
  }
  const row = { id: uid('pt'), dedupe, ts: Date.now(), dateKey, delta, reason, kind, cls, sourceEventId };
  await put('points', row);
  _bal += delta;
  if (cls === 'daily' && dateKey === _caps.date) {
    _caps.all += delta;
    _caps.byKind[kind] = (_caps.byKind[kind] || 0) + delta;
  }
  return delta;
}
// 幂等检查：同 dedupe 已发放且未被撤销 → 拒绝；已撤销 → 允许再次发放（序号递增）
async function grantOnceCheck(base) {
  let dedupe = base, n = 1;
  for (;;) {
    const ex = await getByIndex('points', 'dedupe', dedupe);
    if (!ex) return dedupe;
    const rev = await getByIndex('points', 'dedupe', 'rv:' + ex.id);
    if (!rev) return null;
    n++; dedupe = `${base}~${n}`;
  }
}
// 撤销某事件关联的积分（同步修正统计；已购物品不回收，差额体现为待抵扣）
export async function reverseSource(sourceEventId, reason = '撤销修正') {
  const rows = await allByIndex('points', 'sourceEventId', sourceEventId);
  for (const r of rows) {
    if (r.delta <= 0) continue;
    const rd = 'rv:' + r.id;
    const ex = await getByIndex('points', 'dedupe', rd);
    if (ex) continue;
    const row = { id: uid('pt'), dedupe: rd, ts: Date.now(), dateKey: todayKey(), delta: -r.delta, reason, kind: r.kind, cls: 'adjust', sourceEventId: null };
    await put('points', row);
    _bal += row.delta;
  }
  _caps = { date: null, all: 0, byKind: {} };
}


// ---- 宠物成长 ----
export async function getActivePet() {
  const pets = await all('pets');
  if (!pets.length) return null;
  const meta = await loadKV('app_meta');
  return pets.find((p) => p.petId === meta.activePet) || pets[0];
}
export async function grantGrowth(amount, { exempt = false, reason = '', dateKey = todayKey() } = {}) {
  if (amount <= 0) return 0;
  const pet = await getActivePet();
  if (!pet) return 0;
  if (!exempt) {
    const logs = await allByIndex('petlog', 'dateKey', dateKey);
    const used = logs.filter((l) => !l.exempt).reduce((a, l) => a + l.amount, 0);
    amount = Math.min(amount, Math.max(0, GROWTH.capPerDay - used));
    if (amount <= 0) return 0;
  }
  await put('petlog', { id: uid('gl'), dateKey, amount, exempt, reason, ts: Date.now() });
  const before = stageOf(pet.growth).n;
  pet.growth += amount;
  const after = stageOf(pet.growth).n;
  await put('pets', pet);
  if (after > before) {
    fx.queueCele({ type: 'stage', stage: after, stageName: STAGES[after - 1].name, petName: pet.name || '宠物' });
    statsDirty();
  }
  return amount;
}
export async function petInteract({ food = false, toy = false, touch = false, itemId = null }) {
  const ev = { id: uid('pe'), ts: Date.now(), dateKey: todayKey(), kind: 'pet', refId: itemId, meta: { food, toy, touch } };
  await put('events', ev);
  statsDirty();
  return ev;
}

// ---- 统一完成事件 ----
async function addEvent({ kind, refId = null, dateKey = todayKey(), category = null, minutes = null, note = null, meta = null }) {
  const ev = { id: uid('ev'), ts: Date.now(), dateKey, kind, refId, category, minutes, note, meta };
  await put('events', ev);
  return ev;
}
export async function removeEventByRef(refId) {
  const evs = await allByIndex('events', 'refId', refId);
  for (const ev of evs) {
    await reverseSource(ev.id);
    await del('events', ev.id);
  }
  return evs.length;
}

// ---- 各业务动作（返回奖励摘要，页面据此庆祝）----
export async function doTaskComplete(task) {
  if (task.done) return null;
  task.done = true; task.doneAt = Date.now();
  await put('tasks', task);
  const ev = await addEvent({ kind: 'task', refId: task.id, category: task.category || null });
  const p = await grantPoints({ dedupe: `task:${task.id}:${task.doneAt}`, delta: POINTS.task.delta, reason: `完成任务「${task.title}」`, kind: 'task', sourceEventId: ev.id });
  const g = await grantGrowth(GROWTH.task, { reason: '完成任务' });
  sound.play('complete');
  statsDirty();
  return { points: p, growth: g, title: task.title, sub: catName(task.category), ic: 'task', kind: 'task' };
}
export async function doTaskUndo(task) {
  if (!task.done) return null;
  task.done = false; task.doneAt = null;
  await put('tasks', task);
  await removeEventByRef(task.id);
  sound.play('undo');
  statsDirty();
  return true;
}
export async function deleteTask(task) {
  if (task.done) await removeEventByRef(task.id);
  await del('tasks', task.id);
  statsDirty();
}
export async function doHabitDone(habit, dk = todayKey()) {
  const ex = await getByIndex('habit_logs', 'habitId_dateKey', [habit.id, dk]);
  if (ex) return null;
  const log = { id: uid('hl'), habitId: habit.id, dateKey: dk, ts: Date.now() };
  await put('habit_logs', log);
  const ev = await addEvent({ kind: 'habit', refId: log.id, category: habit.category || null, dateKey: dk });
  const p = await grantPoints({ delta: POINTS.habit.delta, reason: `完成习惯「${habit.name}」`, kind: 'habit', dateKey: dk, sourceEventId: ev.id });
  const g = await grantGrowth(GROWTH.habit, { reason: '完成习惯', dateKey: dk });
  sound.play('complete');
  statsDirty();
  return { points: p, growth: g, title: habit.name, sub: catName(habit.category), ic: 'task', kind: 'habit' };
}
export async function doHabitUndo(habit, dk = todayKey()) {
  const log = await getByIndex('habit_logs', 'habitId_dateKey', [habit.id, dk]);
  if (!log) return null;
  await del('habit_logs', log.id);
  await removeEventByRef(log.id);
  sound.play('undo');
  statsDirty();
  return true;
}
export async function addQuickRecord({ dateKey: dk = todayKey(), category, count = null, minutes = null, startTime = null, endTime = null, note = '', title = null }) {
  const rec = { id: uid('qr'), dateKey: dk, ts: Date.now(), category, count, minutes, startTime, endTime, note, title: title || null };
  await put('quick_records', rec);
  const ev = await addEvent({ kind: 'quick', refId: rec.id, category, minutes, dateKey: dk, meta: { startTime, endTime } });
  const p = await grantPoints({ delta: POINTS.quick.delta, reason: `快捷记录「${title || catName(category)}」`, kind: 'quick', dateKey: dk, sourceEventId: ev.id });
  sound.play('complete');
  statsDirty();
  return { points: p, growth: 0, title: title || catName(category), sub: catName(category), ic: 'quick', kind: 'quick' };
}
export async function deleteQuickRecord(rec) {
  await del('quick_records', rec.id);
  await removeEventByRef(rec.id);
  statsDirty();
}
export async function saveFocusSession({ minutes, mode, targetMin = null, linkedType = null, linkedId = null, category = null, note = '', startedTs = null, endedTs = null }) {
  const valid = minutes >= 5;
  const dk = Number.isFinite(Number(startedTs)) ? dateKey(new Date(Number(startedTs))) : todayKey();
  const s = { id: uid('fx'), dateKey: dk, ts: Date.now(), startedTs, endedTs, minutes, valid, mode, targetMin, linkedType, linkedId, note };
  await put('focus_sessions', s);
  let p = 0, g = 0;
  if (valid) {
    const ev = await addEvent({ kind: 'focus', refId: s.id, minutes, category, note, dateKey: dk, meta: { startedTs, endedTs } });
    const tier = POINTS.focusTier.filter(([m]) => minutes >= m).pop();
    p = await grantPoints({ delta: tier ? tier[1] : 0, reason: `专注 ${fmtMin(minutes)}`, kind: 'focus', sourceEventId: ev.id });
    if (minutes >= 30) g = await grantGrowth(GROWTH.focus30, { reason: '有效专注' });
    statsDirty();
  }
  return { points: p, growth: g, minutes, valid, kind: 'focus', title: `专注 ${fmtMin(minutes)}`, ic: 'focus', sub: valid ? null : '不足5分钟，未计入有效专注' };
}
export async function completeChecklist(list) {
  if (list.doneAt) return null;
  list.doneAt = Date.now();
  await put('checklists', list);
  const ev = await addEvent({ kind: 'checklist', refId: list.id, category: 'tidy' });
  const p = await grantPoints({ delta: POINTS.checklist.delta, reason: `完成清单「${list.title}」`, kind: 'checklist', sourceEventId: ev.id });
  sound.play('complete');
  statsDirty();
  return { points: p, growth: 0, title: list.title, sub: '整张清单', ic: 'list', kind: 'checklist' };
}
export async function reopenChecklist(list) {
  list.doneAt = null;
  await put('checklists', list);
  await removeEventByRef(list.id);
  sound.play('undo');
  statsDirty();
}
export async function saveJournal(entry) {
  const isNew = !entry.id;
  entry.id = entry.id || uid('jn');
  entry.ts = entry.ts || Date.now();
  await put('journal', entry);
  let rewards = null;
  if (isNew) {
    const ev = await addEvent({ kind: 'journal', refId: entry.id, category: entry.category || null, dateKey: entry.dateKey, meta: { photo: !!entry.photoId } });
    const prior = (await allByIndex('events', 'dateKey', entry.dateKey)).filter((e) => e.kind === 'journal' && e.refId !== entry.id);
    const p = prior.length ? 0 : await grantPoints({ dedupe: `journal:${entry.id}`, delta: POINTS.journal.delta, reason: '保存手账', kind: 'journal', dateKey: entry.dateKey, sourceEventId: ev.id });
    const g = prior.length ? 0 : await grantGrowth(GROWTH.journalFirst, { reason: '写手账', dateKey: entry.dateKey });
    rewards = { points: p, growth: g, title: '保存手账', ic: 'journal', kind: 'journal' };
  } else {
    // Editing a journal entry must also move/update its timeline event. Keep the
    // original event id so the original reward ledger remains linked and is not re-awarded.
    const evs = (await allByIndex('events', 'refId', entry.id)).filter((e) => e.kind === 'journal');
    if (evs.length) {
      for (const ev of evs) {
        ev.dateKey = entry.dateKey;
        ev.category = entry.category || null;
        ev.meta = { ...(ev.meta || {}), photo: !!entry.photoId };
        await put('events', ev);
      }
    } else {
      await addEvent({ kind: 'journal', refId: entry.id, category: entry.category || null, dateKey: entry.dateKey, meta: { photo: !!entry.photoId } });
    }
  }
  statsDirty();
  return rewards;
}
export async function deleteJournal(entry) {
  if (entry.photoId) await del('photos', entry.photoId).catch(() => {});
  await del('journal', entry.id);
  await removeEventByRef(entry.id);
  statsDirty();
}
export async function addLedgerEntry({ type, amount, category, note = '', dateKey: dk = todayKey() }) {
  const e = { id: uid('lg'), dateKey: dk, ts: Date.now(), type, amount, category, note };
  await put('ledger', e);
  const ev = await addEvent({ kind: 'ledger', refId: e.id, category: 'finance', dateKey: dk });
  const prior = (await allByIndex('events', 'dateKey', dk)).filter((x) => x.kind === 'ledger' && x.refId !== e.id);
  const first = prior.length === 0;
  const p = first ? await grantPoints({ dedupe: `ledger:${e.id}`, delta: POINTS.ledger.delta, reason: '当天第一笔记账', kind: 'ledger', dateKey: dk, sourceEventId: ev.id }) : 0;
  const g = first ? await grantGrowth(GROWTH.ledgerFirst, { reason: '记账', dateKey: dk }) : 0;
  sound.play('pop');
  statsDirty();
  return { points: p, growth: g, title: '记了一笔账', ic: 'ledger', kind: 'ledger' };
}
export async function deleteLedgerEntry(entry) {
  await del('ledger', entry.id);
  await removeEventByRef(entry.id);
  statsDirty();
}
export async function toggleMilestone(goal, ms) {
  if (!ms.done) {
    ms.done = true; ms.doneAt = Date.now();
    await put('goals', goal);
    await addEvent({ kind: 'milestone', refId: ms.id, category: goal.category || null });
    const p = await grantOnce('ms:' + ms.id, { delta: POINTS.milestone.delta, reason: `达成里程碑「${ms.title}」`, kind: 'milestone', cls: 'milestone' });
    const g = await grantGrowth(GROWTH.milestone, { exempt: true, reason: '目标里程碑' });
    sound.play('complete');
    statsDirty();
    return { points: p, growth: g, title: ms.title, sub: `目标「${goal.title}」里程碑`, ic: 'flag', kind: 'milestone' };
  }
  ms.done = false; ms.doneAt = null;
  await put('goals', goal);
  await removeEventByRef(ms.id);
  sound.play('undo');
  statsDirty();
  return null;
}
// 里程碑类一次性奖励（撤销后重新达成可再次发放）
export async function grantOnce(base, payload) {
  const dedupe = await grantOnceCheck(base);
  if (!dedupe) return 0;
  return grantPoints({ dedupe, ...payload });
}
export async function completeGoal(goal) {
  goal.status = 'done'; goal.doneAt = Date.now();
  await put('goals', goal);
  await addEvent({ kind: 'goal', refId: goal.id, category: goal.category || null });
  const p = await grantOnce('goal:' + goal.id, { delta: POINTS.goal.delta, reason: `完成目标「${goal.title}」`, kind: 'goal', cls: 'milestone' });
  const g = await grantGrowth(GROWTH.goal, { exempt: true, reason: '完成目标' });
  statsDirty();
  fx.queueCele({ type: 'goal', title: goal.title, sub: '一个目标抵达了终点', points: p });
  return { points: p, growth: g };
}
export async function reopenGoal(goal) {
  goal.status = 'active'; goal.doneAt = null;
  await put('goals', goal);
  await removeEventByRef(goal.id);
  statsDirty();
}
export async function confirmReview(type, key) {
  const id = `${type}:${key}`;
  const ex = await get('reviews', id);
  if (ex) return null;
  await put('reviews', { id, type, key, ts: Date.now() });
  const p = type === 'week' ? await grantOnce('review:' + id, { delta: POINTS.weekReview.delta, reason: '确认周回顾', kind: 'weekReview', cls: 'daily' }) : 0;
  statsDirty();
  return { points: p, type };
}

// ---- 商城（原子购买：扣分与入库同事务）----
export async function redeemCustomReward(rewardId) {
  const result = await redeemCustomRewardAtomic(rewardId);
  if (result?.ok) {
    _bal = result.balance;
    sound.play('purchase');
    statsDirty();
    emit();
  }
  return result;
}

export async function purchaseItem(requested) {
  const item = shopById(requested?.id);
  if (!item || !Number.isFinite(item.price) || item.price < 0) return { err: '商品无效' };
  const S = await computeStats();
  if (!isUnlocked(item, { maxStage: S.petMaxStage || 1, badgeCount: S.badgeCount || 0, seriesComplete: S.seriesComplete || 0 })) {
    return { err: '商品尚未解锁：' + (unlockText(item) || '条件未满足') };
  }
  try {
    const result = await buyAtomic(item);
    if (result.err) return result;
    _bal = result.balance;
    sound.play('purchase'); statsDirty(); emit();
    return result;
  } catch (error) { return { err: error.message || '兑换失败，积分和库存未改变' }; }
}
export async function useConsumable(itemId) {
  const item = shopById(itemId);
  if (!item || item.type !== 'consumable') return false;
  return consumeAtomic(itemId);
}
export async function usePetItem(itemId) {
  const item = shopById(itemId);
  if (!item || !['food','toy'].includes(item.cat)) return { err: '这件物品不能用于宠物互动' };
  if (!(await getActivePet())) return { err: '还没有伙伴' };
  const ev = { id: uid('pe'), ts: Date.now(), dateKey: todayKey(), kind: 'pet', refId: itemId, meta: { food:item.cat==='food',toy:item.cat==='toy',touch:false } };
  if (item.type === 'consumable') {
    if (!(await consumeAtomic(itemId, ev))) return { err: '道具已用完，请重新选择' };
  } else {
    const inv = await get('inventory',itemId);
    if (!inv || inv.qty <= 0) return { err: '尚未拥有该玩具' };
    await put('events',ev);
  }
  statsDirty();return { ok:true,item,event:ev };
}
export async function equipItem(petRow, slot, itemId) {
  petRow.equipped = petRow.equipped || {};
  if (itemId) petRow.equipped[slot] = itemId;
  else delete petRow.equipped[slot];
  await put('pets', petRow);
  statsDirty();
}
export async function claimPet(petId) {
  const ex = await get('pets', petId);
  if (ex) return { err: '已经领取过这只伙伴' };
  const def = PETS.find((p) => p.petId === petId);
  if (def && def.unlock) {
    if (!_S) return { err: '数据尚未就绪' };
    if (def.unlock.badges && (_S.badgeCount || 0) < def.unlock.badges) return { err: `还需解锁 ${def.unlock.badges - (_S.badgeCount || 0)} 枚徽章` };
    if (def.unlock.stage && (_S.petMaxStage || 1) < def.unlock.stage) return { err: `任一宠物需达到阶段${def.unlock.stage}` };
  }
  const row = { petId, name: '', growth: 0, equipped: {}, ownedAt: Date.now() };
  await put('pets', row);
  await patchKV('app_meta', { activePet: petId });
  statsDirty();
  return { ok: true };
}
export async function savePetName(petRow, name) {
  petRow.name = name.trim().slice(0, 12);
  await put('pets', petRow);
  statsDirty();
}
export async function setActivePet(petId) { await patchKV('app_meta', { activePet: petId }); }

// ---- 统计与徽章 ----
// VALID_KINDS is shared with presentation statistics and shares.
function bumpCat(S, cat, dateKey, minutes) {
  if (!cat) return;
  const st = (S.catStats[cat] = S.catStats[cat] || { count: 0, min: 0, days: new Set() });
  st.count++;
  st.days.add(dateKey);
  if (minutes) st.min += minutes;
}
export async function computeStats() {
  const [events, habits, goals, reviews, pets, inventory, showcase, appMeta, settings] = await Promise.all([
    all('events'), all('habits'), all('goals'), all('reviews'), all('pets'), all('inventory'),
    loadKV('showcase'), loadKV('app_meta'), loadKV('settings'),
  ]);
  const S = {
    onboarded: !!appMeta.onboarded, petNamed: false, firstTask: false, firstQuick: false, firstFocus15: false,
    firstHabitCreated: habits.length > 0, firstHabitDone: false, firstGoalCreated: goals.length > 0,
    firstLedger: false, firstJournal: false, firstWeekReview: false,
    focusMin: 0, catStats: {}, taskCount: 0, checklistDone: 0,
    journalDays: new Set(), journalPhotoCount: 0, monthReviewCount: 0,
    goalCreated: goals.length, goalDone: 0, milestoneDone: 0, goalWith5StepsDone: 0,
    ledgerDays: new Set(), ledgerCount: 0, budgetSet: Object.keys(settings.ledgerBudget || {}).length > 0,
    ledgerReviewMonths: new Set(),
    petOwned: pets.length > 0, petFoodUsed: false, petToyUsed: false, petInteractions: 0, petMaxStage: 1,
    shopPurchases: 0, outfitEquipped: false, furniturePlaced: false, permItems: 0, showcaseCount: showcase.length, seriesComplete: 0,
    months: new Set(), days: new Set(), dayCounts: {}, cats: new Set(), badgeCount: 0,
    seasons: { spring: false, summer: false, autumn: false, winter: false },
  };
  for (const ev of events) {
    const valid = isLifeEvent(ev);
    if (valid) {
      S.days.add(ev.dateKey);
      S.dayCounts[ev.dateKey] = (S.dayCounts[ev.dateKey] || 0) + 1;
      S.months.add(monthKeyOf(ev.dateKey));
      if (ev.category) S.cats.add(ev.category);
      const m = Number(ev.dateKey.slice(5, 7));
      if (m >= 3 && m <= 5) S.seasons.spring = true;
      else if (m >= 6 && m <= 8) S.seasons.summer = true;
      else if (m >= 9 && m <= 11) S.seasons.autumn = true;
      else S.seasons.winter = true;
    }
    switch (ev.kind) {
      case 'task': S.firstTask = true; S.taskCount++; bumpCat(S, ev.category, ev.dateKey, ev.minutes); break;
      case 'habit': S.firstHabitDone = true; bumpCat(S, ev.category, ev.dateKey, ev.minutes); break;
      case 'quick': S.firstQuick = true; bumpCat(S, ev.category, ev.dateKey, ev.minutes); break;
      case 'focus':
        if ((ev.minutes || 0) >= 5) S.focusMin += ev.minutes;
        if ((ev.minutes || 0) >= 15) S.firstFocus15 = true;
        break;
      case 'checklist': S.checklistDone++; break;
      case 'journal':
        S.firstJournal = true; S.journalDays.add(ev.dateKey);
        if (ev.meta && ev.meta.photo) S.journalPhotoCount++;
        break;
      case 'ledger': S.firstLedger = true; S.ledgerCount++; S.ledgerDays.add(ev.dateKey); break;
      case 'milestone': S.milestoneDone++; break;
      case 'goal': S.goalDone++; break;
      case 'pet':
        S.petInteractions++;
        if (ev.meta && ev.meta.food) S.petFoodUsed = true;
        if (ev.meta && ev.meta.toy) S.petToyUsed = true;
        break;
      case 'purchase': S.shopPurchases++; break;
    }
  }
  S.goalWith5StepsDone = goals.some((g) => g.status === 'done' && ((g.steps || []).length >= 5 || (g.milestones || []).length >= 5));
  for (const r of reviews) {
    if (r.type === 'week') S.firstWeekReview = true;
    else { S.monthReviewCount++; S.ledgerReviewMonths.add(r.key); }
  }
  for (const p of pets) {
    if (p.name) S.petNamed = true;
    S.petMaxStage = Math.max(S.petMaxStage, stageOf(p.growth || 0).n);
    const eq = p.equipped || {};
    if (eq.head || eq.neck || eq.body) S.outfitEquipped = true;
  }
  const home = await loadKV('home_layout');
  S.furniturePlaced = !!(home.bed || home.rug || home.desk1 || home.desk2 || home.ground1 || home.ground2 || home.wall1 || home.wall2 || home.cabinet);
  for (const inv of inventory) {
    const item = shopById(inv.itemId);
    if (item && item.type === 'perm' && inv.qty > 0) S.permItems++;
  }
  const unlockedRows = await all('badges');
  S.badgeCount = unlockedRows.length;
  const has = new Set(unlockedRows.map((u) => u.badgeId));
  for (const series of [...new Set(BADGES.map((b) => b.series))]) {
    if (BADGES.filter((b) => b.series === series).every((b) => has.has(b.id))) S.seriesComplete++;
  }
  return S;
}
export const statsDirty = debounce(() => { recomputeStats(); }, 220);
let recomputeChain = Promise.resolve();
export function recomputeStats() {
  const next = recomputeChain.catch(() => {}).then(async () => {
    _S = await computeStats();
    await evaluateBadges();
    emit();
    return _S;
  });
  recomputeChain = next;
  return next;
}
async function evaluateBadges() {
  const unlockedRows = await all('badges');
  const has = new Set(unlockedRows.map((u) => u.badgeId));
  for (let pass = 0; pass < 3; pass++) {
    const newly = [];
    for (const b of BADGES) {
      if (has.has(b.id)) continue;
      let ok = false;
      try { ok = !!b.check(_S); } catch { ok = false; }
      if (ok) newly.push(b);
    }
    if (!newly.length) break;
    for (const b of newly) {
      await put('badges', { badgeId: b.id, ts: Date.now(), basis: b.cond });
      has.add(b.id);
      await grantOnce('badge:' + b.id, { delta: b.points, reason: `解锁徽章「${b.name}」`, kind: 'badge', cls: 'milestone' });
      await grantGrowth(GROWTH.badge, { exempt: true, reason: '解锁徽章' });
      fx.queueCele({ type: 'badge', badgeId: b.id });
    }
    _S.badgeCount = has.size;
    _S.seriesComplete = [...new Set(BADGES.map((b) => b.series))].filter((s) => BADGES.filter((b) => b.series === s).every((b) => has.has(b.id))).length;
    // Re-evaluate count/series dependencies after every pass, without granting an ID twice.
  }
}
export async function badgeRows() { return all('badges'); }

// ---- 今日概览 ----
export async function todaySummary(dk = todayKey()) {
  const caps = await capsFor(dk);
  const [tasks, events] = await Promise.all([allByIndex('tasks', 'dateKey', dk), allByIndex('events', 'dateKey', dk)]);
  const concrete = tasks.filter(t => !t.repeat);
  const summary = aggregatePeriod({ events }, 'day', dk);
  return { points: caps.all, pointsCap: POINTS.dailyAllCap, doneTasks: concrete.filter(t=>t.done).length,
    tasks: concrete.length, validEvents: summary.eventCount, focusMin: summary.focusMin };
}

// ---- 建档 ----
export async function finishOnboard({ account, nickname, petId, petName }) {
  await patchKV('profile', { account, nickname: nickname || account });
  await put('pets', { petId, name: petName || '', growth: 0, equipped: {}, ownedAt: Date.now() });
  await patchKV('app_meta', { onboarded: true, createdAt: Date.now(), activePet: petId });
  const p = await grantOnce('welcome', { delta: POINTS.onboard.delta, reason: '建档欢迎奖励', kind: 'onboard', cls: 'milestone' });
  await recomputeStats();
  return { welcome: p };
}
export async function clearAllForReset() {
  const names = ['kv', 'tasks', 'habits', 'habit_logs', 'goals', 'wishes', 'quick_records', 'focus_sessions', 'checklists', 'journal', 'photos', 'ledger', 'events', 'points', 'badges', 'pets', 'petlog', 'inventory', 'custom_rewards', 'reviews'];
  const { clearEverything } = await import('./db.js');
  await clearEverything();
  _bal = 0; _caps = { date: null, all: 0, byKind: {} }; _S = null;
}
