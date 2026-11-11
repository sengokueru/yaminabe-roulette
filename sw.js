// 公開のたびに版数を上げること（上げないと古い版が配信され続ける）
const PREFIX = 'yaminabe-' + encodeURIComponent(self.registration.scope) + '-';
const CACHE = PREFIX + 'v3';
const FONTS = PREFIX + 'fonts';
const ASSETS = ['./', 'index.html', 'names.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIX) && k !== CACHE && k !== FONTS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  // 文字（Google Fonts）は一度読んだら保存して、電波がなくても同じ見た目にする
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(r);
      const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()).catch(() => {}); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // 画面(HTML)はネット優先：更新がすぐ届く。オフライン時だけキャッシュ
  if (r.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(r);
        if (!res.ok) return (await cache.match('index.html')) || res;
        try { await cache.put('index.html', res.clone()); } catch (_) { /* 容量不足でもオンライン表示は続ける */ }
        return res;
      } catch (err) {
        return (await cache.match('index.html')) || Response.error();
      }
    })());
    return;
  }
  e.respondWith(caches.open(CACHE).then(c => c.match(r)).then(m => m || fetch(r)));
});
