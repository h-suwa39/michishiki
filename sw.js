/* みちしき — Service Worker
   アプリ本体をキャッシュして、オフラインでも開けるようにする。
   フォントなど外部のものはネットワーク優先で、失敗したらキャッシュを使う。 */
const CACHE = 'michishiki-v2';
const CORE = ['./', './index.html', './css/style.css', './js/app.js', './manifest.webmanifest', './icons/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

/* 応答の複製は、本体を読まれる前に同期で取っておく（あとから clone すると失敗する） */
function putLater(req, res) {
  if (!res || !res.ok) return;
  const copy = res.clone();
  caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!url.protocol.startsWith('http')) return;
  const sameOrigin = url.origin === location.origin;
  if (sameOrigin) {
    // 本体はキャッシュ優先、裏で更新
    e.respondWith(caches.match(req).then(hit => {
      const fetching = fetch(req).then(res => { putLater(req, res); return res; }).catch(() => hit);
      return hit || fetching;
    }));
  } else {
    e.respondWith(fetch(req).then(res => { putLater(req, res); return res; }).catch(() => caches.match(req)));
  }
});
