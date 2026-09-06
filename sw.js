/* みちしき — Service Worker
   アプリ本体はネット優先で、開くたびに最新を取る。ネットが無いときだけキャッシュを使う。
   VERSION を上げると新しい Service Worker として入れ替わり、古いキャッシュを捨てる。 */
const VERSION = '0.6.1';
const CACHE = 'michishiki-' + VERSION;
const CORE = ['./', './index.html', './css/style.css', './js/app.js', './manifest.webmanifest', './icons/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(CORE.map(u => fetch(u, { cache: 'reload' }).then(r => r.ok && c.put(u, r)).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

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
  // 本体も外部（フォントなど）も、ネット優先。取れなければキャッシュ
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(res => { putLater(req, res); return res; })
      .catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
