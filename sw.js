// 版本化 App Shell。新 worker 安装完成后等待用户同意，不自动刷新编辑页。
const APP_VERSION = '2.3.1-fix.1';
const PREFIX = 'tjmbg:' + new URL(self.registration.scope).pathname + ':';
const VERSION = PREFIX + APP_VERSION;
const PRECACHE = [
  './','./index.html','./404.html','./manifest.webmanifest',
  './css/base.css','./css/pages.css','./css/repair.css','./js/main.js',
  ...['util','idb','db','catalog','holidays','engine','art','pets','sound','fx','zip','appmeta','share',
    'record-summary','avatar','share-renderer','stats-view','badge-tracking','companion','backup-restore'].map(n=>'./js/core/'+n+'.js'),
  ...['onboard','today','plan','focus','footprint','home','mine'].map(n=>'./js/pages/'+n+'.js'),
  './icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png',
  './assets/manifest.json',
];
self.addEventListener('install',e=>e.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(PRECACHE))));
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  const keys=await caches.keys();
  // 不清理其他应用的缓存，也不清空 IndexedDB。
  for (const key of keys) {
    if (key === VERSION) continue;
    if (key.startsWith(PREFIX)) { await caches.delete(key); continue; }
    if (/^tjmbg-v\d/.test(key)) {
      // Legacy names did not encode scope: only delete when every entry is ours.
      const legacy = await caches.open(key), entries = await legacy.keys();
      const scope = new URL(self.registration.scope);
      if (entries.length && entries.every(r => { const u = new URL(r.url); return u.origin === scope.origin && u.pathname.startsWith(scope.pathname); })) await caches.delete(key);
    }
  }
  await self.clients.claim();
})()));
self.addEventListener('message',e=>{
  if(e.data?.type==='SKIP_WAITING')self.skipWaiting();
  if(e.data?.type==='GET_VERSION')e.ports[0]?.postMessage({version:APP_VERSION});
});
self.addEventListener('fetch',e=>{
  const req=e.request,url=new URL(req.url),scope=new URL(self.registration.scope);
  if(req.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  e.respondWith((async()=>{
    const cache=await caches.open(VERSION);
    // 当前发行版的 HTML/JS/CSS 从同一缓存读取，避免新旧模块混装。
    if(req.mode==='navigate')return (await cache.match('./index.html'))||fetch(req);
    const hit=await cache.match(req);
    if(hit)return hit;
    const res=await fetch(req);
    if(res.ok && res.type!=='opaque')await cache.put(req,res.clone());
    return res;
  })());
});
