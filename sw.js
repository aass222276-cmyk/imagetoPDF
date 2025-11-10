// ★★★ 修正点: v9 にバージョンアップ ★★★
const CACHE_NAME = 'name-pdf-app-v2.0.1'

// ★★★ 修正点: 'jspdf.umd.min.js' をキャッシュ対象に追加 ★★★
const urlsToCache = [
  '.',
  'index.html',
  'style.css',
  'script.js',
  'manifest.json',
  'jspdf.umd.min.js' // ← これが正しいファイル名
  // 'icons/icon-192x192.png',
  // 'icons/icon-512x512.png'
];

// (インストール処理 ... 変更なし)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// (フェッチ処理 ... 変更なし)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// (アクティベート処理 ... v9 以外を削除)
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME]; // [ 'name-pdf-app-v9' ]
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // v9 以外を削除
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});