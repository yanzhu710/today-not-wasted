// 今天没白过 · IndexedDB 轻封装（Promise 化，支持多 store 原子事务）
export function openDB(name, version, upgrade) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = (e) => upgrade(req.result, e.oldVersion);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function p(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export function idbPut(db, store, value) { return p(db.transaction(store, 'readwrite').objectStore(store).put(value)); }
export function idbGet(db, store, key) { return p(db.transaction(store).objectStore(store).get(key)); }
export function idbDelete(db, store, key) { return p(db.transaction(store, 'readwrite').objectStore(store).delete(key)); }
export function idbClear(db, store) { return p(db.transaction(store, 'readwrite').objectStore(store).clear()); }
export function idbAll(db, store, range) {
  const st = db.transaction(store).objectStore(store);
  return p(range ? st.getAll(range) : st.getAll());
}
export function idbAllByIndex(db, store, indexName, key) {
  return p(db.transaction(store).objectStore(store).index(indexName).getAll(key));
}
export function idbGetByIndex(db, store, indexName, key) {
  return p(db.transaction(store).objectStore(store).index(indexName).get(key));
}
export function idbCount(db, store) { return p(db.transaction(store).objectStore(store).count()); }

// 多 store 原子操作：ops = [{store, type:'put'|'delete', value, key}]
// 全部成功才提交，任一出错整体回滚 —— 用于“扣分 + 入库”这类必须同时成功/失败的操作。
export function idbTransaction(db, storeNames, ops) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite');
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
    for (const op of ops) {
      const st = tx.objectStore(op.store);
      if (op.type === 'put') st.put(op.value);
      else if (op.type === 'delete') st.delete(op.key);
      else if (op.type === 'clear') st.clear();
    }
  });
}
