const CACHE_NAME = 'odak-pwa-v14';
const STATIC_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'js/vendor/mqttws31.min.js',
  'js/vendor/supabase-2.45.4.js',
  'css/app.css',
  'js/core.js',
  'js/theme-device-audio.js',
  'js/state.js',
  'js/ui-extras.js',
  'js/ambient.js',
  'js/goals-backup.js',
  'js/account.js',
  'js/navigation-plan.js',
  'js/focus.js',
  'js/friend-protocol.js',
  'js/friends.js',
  'js/stats.js',
  'js/main.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'sounds/rain.mp3',
  'sounds/forest.mp3',
  'sounds/cafe.mp3',
  'sounds/waves.mp3',
  'sounds/silence.m4a',
  'sounds/silence.mp3',
  'sounds/silence.wav'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('PWA Asset önbelleğe alma:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

/*
 * Not: Eski sürüm burada setTimeout ile "seans bitince bildirim" zamanlıyordu.
 * Tarayıcılar boşta kalan Service Worker'ı genellikle 30 sn - birkaç dk içinde
 * durdurur; durunca zamanlayıcı da kaybolur. Yani 25 dk'lık bir bildirim için
 * güvenilir değildi ve kaldırıldı. Uygulama tamamen kapalıyken bildirim
 * göndermenin güvenilir yolu bir sunucudan Web Push göndermektir (bu projede yok).
 * Seans bitişi sayfa tarafında zaman damgasından hesaplanır.
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('./');
      }
    })
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Sadece kendi dosyalarımızı önbelleğe alırız (Supabase, MQTT vb. doğrudan ağa gider).
  if (url.origin !== self.location.origin) return;

  // Ses ve ikonlar büyük ve nadiren değişir: önce önbellek.
  if (/\/(sounds|icons)\//.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      }))
    );
    return;
  }

  // HTML / JS / CSS: önce ağ (güncel sürüm), ağ yoksa önbellek (çevrimdışı çalışma).
  event.respondWith(
    fetch(req).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then((cached) => {
      if (cached) return cached;
      if (req.mode === 'navigate') return caches.match('index.html');
      return Response.error();
    }))
  );
});
