/* みちしき — Service Worker
   アプリ本体をキャッシュして、オフラインでも開けるようにする。
   フォントなど外部のものはネットワーク優先で、失敗したらキャッシュを使う。 */
const CACHE = 'michishiki-v1';
const CORE = ['./', './index.html', './css/style.css', './js/app.js', './manifest.webmanifest', './icons/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const sameOrigin = new URL(req.url).origin === location.origin;
  if (sameOrigin) {
    // 本体はキャッシュ優先、裏で更新
    e.respondWith(caches.match(req).then(hit => {
      const fetching = fetch(req).then(res => {
        if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
        return res;
      }).catch(() => hit);
      return hit || fetching;
    }));
  } else {
    e.respondWith(fetch(req).then(res => {
      if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => caches.match(req)));
  }
});
