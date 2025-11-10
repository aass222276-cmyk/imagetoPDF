// sw.js — cache jsPDF(CDN)を含む完全版（Bプラン）
// まずはオンラインで一度アクセスしてCDNをキャッシュします。

const CACHE_NAME = 'namepdf-v2.5.0';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  // 必要なら画像やアイコンも追加
  // './otamesi.jpg',
  // './icons/icon-192.png',
  // jsPDF（index.htmlで使っているURLと完全一致させること）
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
];

// ----- install -----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// ----- activate -----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

// ----- fetch (cache-first) -----
self.addEventListener('fetch', (event) => {
  const req = event.request;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;

      // ネットに無ければ失敗、あれば（同一オリジンのみ）キャッシュへ
      return fetch(req).then((res) => {
        try {
          const resClone = res.clone();
          const sameOrigin = new URL(req.url).origin === self.location.origin;

          if (res.ok && sameOrigin) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
        } catch (_) {
          // 何もしない（opaque等）
        }
        return res;
      });
    })
  );
});
