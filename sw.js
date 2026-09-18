// v2.3.1: versioned application shell. Activation is explicitly confirmed by the user.
const VERSION = 'tjmbg-v2.3.1';
const PRECACHE = [
  './', './index.html', './404.html', './manifest.webmanifest',
  './css/base.css', './css/pages.css', './css/repair.css', './js/main.js',
  './js/core/util.js','./js/core/idb.js','./js/core/db.js','./js/core/catalog.js',
  './js/core/holidays.js','./js/core/engine.js','./js/core/art.js','./js/core/pets.js',
  './js/core/sound.js','./js/core/fx.js','./js/core/zip.js','./js/core/appmeta.js',
  './js/core/share.js','./js/core/analytics.js','./js/core/stats-view.js',
  './js/core/avatar.js','./js/core/inventory-ops.js','./js/core/item-picker.js',
  './js/core/tracking.js','./js/core/updates.js',
  './js/pages/onboard.js','./js/pages/today.js','./js/pages/plan.js',
  './js/pages/focus.js','./js/pages/footprint.js','./js/pages/home.js','./js/pages/mine.js',
  './icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png','./assets/manifest.json','./assets/bg/default-room.png',
  './assets/pets/maotuan.png','./assets/pets/lili.png','./assets/pets/mituan.png',
];
self.addEventListener('install', event => {
  // Keep the worker waiting. A failed install never replaces the old working worker.
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(PRECACHE.map(url => new Request(url,{cache:'reload'})))));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('tjmbg-v')&&key!==VERSION).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  const shellPath=new Set(PRECACHE.map(path=>new URL(path,self.registration.scope).pathname));
  const shell=shellPath.has(url.pathname)||req.mode==='navigate';
  event.respondWith((async()=>{
    const cache=await caches.open(VERSION);
    const key=req.mode==='navigate'?new URL('./index.html',self.registration.scope).href:req;
    const hit=await cache.match(key);
    if(hit)return hit;
    try{
      const response=await fetch(req);
      if(response.ok){event.waitUntil(cache.put(key,response.clone()));return response;}
      return response;
    }catch(error){
      if(shell){const fallback=await cache.match(new URL('./index.html',self.registration.scope));if(req.mode==='navigate'&&fallback)return fallback;}
      return new Response('资源尚未缓存，请联网后再试。',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
    }
  })());
});
