// 浠婂ぉ娌＄櫧杩?路 Service Worker锛圓pp Shell 棰勭紦瀛?+ 杩愯鏃剁紦瀛橈紱鏇存柊鐢辩敤鎴风‘璁ゅ悗鍐嶅埛鏂帮級
const VERSION = 'tjmbg-v2.2.0';
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
  './assets/bg/default-room.png',
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
  // 椤甸潰瀵艰埅锛氱綉缁滀紭鍏堬紝绂荤嚎鍥為€€缂撳瓨锛堝彂甯冩柊鐗堟湰鍚庤兘灏藉揩鎷垮埌鏂伴〉闈級
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
  // JS / CSS锛氱綉缁滀紭鍏堬紝纭繚鏇存柊鍚庢嬁鍒版渶鏂颁唬鐮侊紱绂荤嚎鍥為€€缂撳瓨
  if (req.destination === 'script' || req.destination === 'style' || req.url.endsWith('.js') || req.url.endsWith('.css')) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }
  // 鍏朵粬闈欐€佽祫婧愶細缂撳瓨浼樺厛
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
