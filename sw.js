// v2.4.0. All executable dependencies are cached as a unit; artwork is optional.
// Never stores user records, never calls IndexedDB, never clears another app's cache.
const RELEASE = '2.4.0';
const PREFIX = 'tjmbg-app:' + encodeURIComponent(new URL(self.registration.scope).pathname) + ':';
const CACHE = PREFIX + RELEASE;
const CORE = [
  "./",
  "./index.html",
  "./404.html",
  "./manifest.webmanifest",
  "./css/base.css",
  "./css/journal-ui.css",
  "./css/pages.css",
  "./css/repair.css",
  "./js/core/analytics.js",
  "./js/core/appmeta.js",
  "./js/core/art.js",
  "./js/core/avatar.js",
  "./js/core/backup-restore.js",
  "./js/core/badge-tracking.js",
  "./js/core/catalog.js",
  "./js/core/companion.js",
  "./js/core/db.js",
  "./js/core/engine.js",
  "./js/core/fx.js",
  "./js/core/holidays.js",
  "./js/core/idb.js",
  "./js/core/inventory-ops.js",
  "./js/core/item-picker.js",
  "./js/core/pets.js",
  "./js/core/record-summary.js",
  "./js/core/share-renderer.js",
  "./js/core/share.js",
  "./js/core/sound.js",
  "./js/core/stats-view.js",
  "./js/core/tracking.js",
  "./js/core/updates.js",
  "./js/core/util.js",
  "./js/core/zip.js",
  "./js/main.js",
  "./js/pages/focus.js",
  "./js/pages/footprint.js",
  "./js/pages/home.js",
  "./js/pages/mine.js",
  "./js/pages/onboard.js",
  "./js/pages/plan.js",
  "./js/pages/today.js",
  "./js/ui/paper.js",
  "./js/ui/tabs.js"
];
const ART = [
  "./assets/manifest.json",
  "./assets/bg/default-room.png",
  "./assets/ui/quiet-room.webp",
  "./assets/pets/maotuan.png",
  "./assets/pets/lili.png",
  "./assets/pets/mituan.png",
  "./assets/ui/pets/maotuan.webp",
  "./assets/ui/pets/lili.webp",
  "./assets/ui/pets/mituan.webp",
  "./icons/apple-touch-icon.png",
  "./icons/icon-512.png",
  "./icons/icon-192.png",
  "./icons/icon-maskable-512.png"
];
const absolute = path => new URL(path, self.registration.scope).href;
async function fetchBounded(url, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(new Request(url, { cache: 'reload', signal: controller.signal }));
    if (!response.ok) throw new Error('Cannot cache ' + url + ': ' + response.status);
    // Keep the deadline active while receiving the body, not just the headers.
    const bytes = await response.arrayBuffer();
    return new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
  } finally { clearTimeout(timer); }
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // A missing or invalid script makes installation fail; the old worker stays active.
    await Promise.all(CORE.map(async path => {
      const url = absolute(path), response = await fetchBounded(url);
      const type = response.headers.get('Content-Type') || '';
      if (path.endsWith('.js') && !/javascript|ecmascript/i.test(type)) throw new Error('Invalid script MIME: '+path);
      if (path.endsWith('.css') && !/text\/css/i.test(type)) throw new Error('Invalid stylesheet MIME: '+path);
      await cache.put(url, response);
    }));
    // A failed decorative image must not block an otherwise complete release.
    await Promise.allSettled(ART.map(async path => { const url=absolute(path); await cache.put(url, await fetchBounded(url,4000)); }));
    // No skipWaiting here. The existing app asks the user before switching.
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    // Legacy tjmbg-v* caches are deliberately left alone: they were not scope-namespaced.
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = request.mode === 'navigate' ? absolute('./index.html') : request;
    const hit = await cache.match(key);
    if (hit) return hit;
    try {
      const response = await fetch(request);
      if (response.ok) event.waitUntil(cache.put(key,response.clone()).catch(()=>{}));
      return response;
    } catch {
      // Never return an HTML page for a JS/image request.
      return new Response('This resource is not cached yet. Please connect and retry.', {status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
    }
  })());
});
