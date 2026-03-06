const CACHE_NAME = 'brewpos-v4';
const STATIC_ASSETS = [
  '/BrewPOS/',
  '/BrewPOS/index.html',
  '/BrewPOS/manifest.json',
  '/BrewPOS/css/main.css',
  '/BrewPOS/js/db.js',
  '/BrewPOS/js/data.js',
  '/BrewPOS/js/app.js',
  '/BrewPOS/icons/icon-48.png',
  '/BrewPOS/icons/icon-72.png',
  '/BrewPOS/icons/icon-96.png',
  '/BrewPOS/icons/icon-144.png',
  '/BrewPOS/icons/icon-192.png',
  '/BrewPOS/icons/icon-512.png'
];

// ── INSTALL ──
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ──
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: offline-first strategy ──
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Return cached, but also update in background
        const fetchPromise = fetch(event.request).then(response => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => null);
        return cached;
      }

      // Not in cache - fetch from network
      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Offline fallback
          if (event.request.destination === 'document') {
            return caches.match('/BrewPOS/index.html');
          }
        });
    })
  );
});

// ── BACKGROUND SYNC ──
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event.tag);
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }
});

async function syncOrders() {
  console.log('[SW] Syncing orders...');
}

// ── PERIODIC BACKGROUND SYNC ──
self.addEventListener('periodicsync', event => {
  console.log('[SW] Periodic sync:', event.tag);
  if (event.tag === 'update-check') {
    event.waitUntil(checkForUpdates());
  }
});

async function checkForUpdates() {
  console.log('[SW] Checking for updates...');
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(STATIC_ASSETS).catch(() => {});
}

// ── PUSH NOTIFICATIONS ──
self.addEventListener('push', event => {
  console.log('[SW] Push received');
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'BrewPOS';
  const options = {
    body: data.body || 'New notification from BrewPOS',
    icon: '/BrewPOS/icons/icon-192.png',
    badge: '/BrewPOS/icons/icon-96.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/BrewPOS/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── NOTIFICATION CLICK ──
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url === '/BrewPOS/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url || '/BrewPOS/');
      }
    })
  );
});

// ── MESSAGE ──
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
