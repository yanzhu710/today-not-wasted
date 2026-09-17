// 今天没白过 · Service Worker（App Shell 预缓存 + 运行时缓存；更新由用户确认后再刷新）
const VERSION = 'tjmbg-v1.6.0';
const PRECACHE = [
  './',
  './index.html',
  './404.html',
  './manifest.webmanifest',
  './css/base.css',
  './css/pages.css',
  './js/main.js',
  './js/core/util.js',
  './js/core/idb.js',
  './js/core/db.js',
  './js/core/catalog.js',
  './js/core/holidays.js',
  './js/core/engine.js',
  './js/core/art.js',
  './js/core/pets.js',
  './js/core/sound.js',
  './js/core/fx.js',
  './js/core/zip.js',
  './js/core/appmeta.js',
  './js/pages/onboard.js',
  './js/pages/today.js',
  './js/pages/plan.js',
  './js/pages/focus.js',
  './js/pages/footprint.js',
  './js/pages/home.js',
  './js/pages/mine.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './assets/manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // 页面导航：网络优先，离线回退缓存（发布新版本后能尽快拿到新页面）
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }
  // 静态资源：缓存优先，未命中走网络（失败则由页面自行降级）
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});
