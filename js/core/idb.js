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
function writeOne(db, store, operation) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite'); let result;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error || new Error('写入未提交'));
    tx.onerror = () => {};
    try { const request = operation(tx.objectStore(store)); request.onsuccess = () => {result = request.result;}; }
    catch(e) { tx.abort(); reject(e); }
  });
}
export function idbPut(db, store, value) { return writeOne(db, store, st => st.put(value)); }
export function idbGet(db, store, key) { return p(db.transaction(store).objectStore(store).get(key)); }
export function idbDelete(db, store, key) { return writeOne(db, store, st => st.delete(key)); }
export function idbClear(db, store) { return writeOne(db, store, st => st.clear()); }
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
    let failure = null;
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => {}; // onabort observes the final transaction outcome.
    tx.onabort = () => reject(failure || tx.error || new Error('transaction aborted'));
    try {
      for (const op of ops) {
        const store = tx.objectStore(op.store);
        if (op.type === 'put') store.put(op.value);
        else if (op.type === 'delete') store.delete(op.key);
        else if (op.type === 'clear') store.clear();
        else throw new Error('Unsupported database operation: ' + op.type);
      }
    } catch (error) {
      failure = error;
      try { tx.abort(); } catch { reject(error); }
    }
  });
}
