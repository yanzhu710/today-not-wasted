// 今天没白过 · 数据库结构与访问层
import { openDB, idbPut, idbGet, idbDelete, idbClear, idbAll, idbAllByIndex, idbGetByIndex, idbCount, idbTransaction } from './idb.js';
import { uid } from './util.js';

export const DB_NAME = 'tjmbg';
export const SCHEMA_VERSION = 1;

const STORES = {
  kv: { keyPath: 'key' },
  tasks: { keyPath: 'id', idx: [['dateKey'], ['repeatOf']] },
  habits: { keyPath: 'id' },
  habit_logs: { keyPath: 'id', idx: [['habitId'], ['dateKey'], ['habitId_dateKey', ['habitId', 'dateKey'], true]] },
  goals: { keyPath: 'id' },
  wishes: { keyPath: 'id' },
  quick_records: { keyPath: 'id', idx: [['dateKey']] },
  focus_sessions: { keyPath: 'id', idx: [['dateKey']] },
  checklists: { keyPath: 'id' },
  journal: { keyPath: 'id', idx: [['dateKey']] },
  photos: { keyPath: 'id' },
  ledger: { keyPath: 'id', idx: [['dateKey']] },
  events: { keyPath: 'id', idx: [['dateKey'], ['kind'], ['refId']] },
  points: { keyPath: 'id', idx: [['dateKey'], ['dedupe', 'dedupe', true], ['sourceEventId']] },
  badges: { keyPath: 'badgeId' },
  pets: { keyPath: 'petId' },
  petlog: { keyPath: 'id', idx: [['dateKey']] },
  inventory: { keyPath: 'itemId' },
  custom_rewards: { keyPath: 'id' },
  reviews: { keyPath: 'id' },
};

let _db = null;
export async function initDB() {
  if (_db) return _db;
  _db = await openDB(DB_NAME, SCHEMA_VERSION, (db) => {
    for (const [name, def] of Object.entries(STORES)) {
      let st;
      if (!db.objectStoreNames.contains(name)) st = db.createObjectStore(name, { keyPath: def.keyPath });
      else st = db.transaction.objectStore(name);
      (def.idx || []).forEach(([iname, keyPath, unique]) => {
        if (!st.indexNames.contains(iname)) st.createIndex(iname, keyPath || iname, { unique: !!unique });
      });
    }
  });
  return _db;
}
export function db() { return _db; }

export const put = (store, value) => idbPut(_db, store, value);
export const get = (store, key) => idbGet(_db, store, key);
export const del = (store, key) => idbDelete(_db, store, key);
export const clear = (store) => idbClear(_db, store);
export const all = (store, range) => idbAll(_db, store, range);
export const allByIndex = (store, idx, key) => idbAllByIndex(_db, store, idx, key);
export const getByIndex = (store, idx, key) => idbGetByIndex(_db, store, idx, key);
export const count = (store) => idbCount(_db, store);
export const atomically = (storeNames, ops) => idbTransaction(_db, storeNames, ops);

// ---- KV（配置、档案、首页布局等小数据）----
const KV_DEFAULTS = {
  app_meta: { schemaVersion: SCHEMA_VERSION, onboarded: false, createdAt: null, lastBackupAt: null, hiddenCards: [], lastReviewRead: {} },
  settings: { muted: false, volume: 70, motion: 'rich', theme: 'warm', currency: '¥', ledgerBudget: {} },
  profile: { account: '', nickname: '', avatarId: null, petName: '' },
  home_layout: { bg: null, rug: null, bed: null, desk: [], wall: [], ground: [], cabinet: null },
  showcase: [],
  focus_state: null,
  inspiration: { favorites: [], hidden: [] },
  quick_buttons: null, // 首次使用时按默认生成
};

export async function loadKV(key) {
  const row = await get('kv', key);
  const base = KV_DEFAULTS[key] ? JSON.parse(JSON.stringify(KV_DEFAULTS[key])) : {};
  if (!row || typeof row.value !== 'object' || row.value === null) return base;
  if (Array.isArray(base) || Array.isArray(row.value)) return row.value;
  return Object.assign(base, row.value);
}
export async function saveKV(key, value) { await put('kv', { key, value }); }
export async function patchKV(key, patch) {
  const cur = await loadKV(key);
  const next = Object.assign(cur, patch);
  await saveKV(key, next);
  return next;
}

// ---- 通用 CRUD ----
export function genId(prefix) { return uid(prefix); }

// 备份导出：全部结构化数据（不含照片等媒体，媒体单独列出）
export async function snapshotData() {
  const out = { schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString() };
  for (const name of Object.keys(STORES)) {
    if (name === 'photos') continue;
    out[name] = await all(name);
  }
  return out;
}
export async function mediaIds() {
  const rows = await all('photos');
  return rows.map((r) => ({ id: r.id, hasThumb: !!r.thumb }));
}
export async function restoreData(snapshot) {
  const names = Object.keys(STORES).filter((n) => n !== 'photos');
  const ops = [];
  for (const n of names) {
    ops.push({ store: n, type: 'clear' });
    for (const row of snapshot[n] || []) ops.push({ store: n, type: 'put', value: row });
  }
  await atomically(names, ops);
}
export async function clearEverything() {
  const names = Object.keys(STORES);
  await atomically(names, names.map((n) => ({ store: n, type: 'clear' })));
}
