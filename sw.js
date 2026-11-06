const CACHE_NAME = 'odak-pwa-v14';
const STATIC_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'mqttws31.min.js',
  'css/app.css',
  'js/theme-device-audio.js',
  'js/state.js',
  'js/ui-extras.js',
  'js/ambient.js',
  'js/goals-backup.js',
  'js/account.js',
  'js/navigation-plan.js',
  'js/focus.js',
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

let focusCompletionTimeout = null;

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // 📱 Kilit ekranında / arka planda süre dolduğunda tam zamanında kutlama bildirimi fırlat
  if (event.data.type === 'SCHEDULE_FOCUS_COMPLETION') {
    if (focusCompletionTimeout) {
      clearTimeout(focusCompletionTimeout);
      focusCompletionTimeout = null;
    }
    const target = event.data.targetEndTime;
    const now = Date.now();
    const delay = Math.max(0, target - now);
    
    focusCompletionTimeout = setTimeout(() => {
      self.registration.showNotification(`🎉 Tebrikler! ${event.data.taskTitle || 'Odak Seansı'} Tamamlandı!`, {
        body: `${event.data.treeType || '🌳'} ${event.data.treeName || 'Yeni Ağacın'} ormanına eklendi. Harika bir iş çıkardın!`,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'odak-completed',
        renotify: true
      });
    }, delay);
  }
  
  if (event.data.type === 'CANCEL_FOCUS_COMPLETION') {
    if (focusCompletionTimeout) {
      clearTimeout(focusCompletionTimeout);
      focusCompletionTimeout = null;
    }
  }
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
  const url = new URL(event.request.url);

  // 1. API çağrılarını ve Supabase bulut isteklerini doğrudan ağa gönder
  if (url.pathname.includes('/api/') || url.hostname.includes('supabase.co')) {
    return;
  }

  // 2. Gezinme (Sayfa Yükleme): Network-First (En güncel sürümü anında al, çevrimdışıysa önbellekten aç)
  if (event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const toCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, toCache));
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          return caches.match('./').then((rootCached) => {
            return rootCached || caches.match('index.html');
          });
        });
      })
    );
    return;
  }

  // 3. Statik dosyalar: Önbellek Öncelikli (Cache First)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, toCache);
        });
        return response;
      }).catch(() => cached);
    })
  );
});
