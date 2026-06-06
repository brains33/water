// PureFlow Service Worker
// Cache-first for static assets, network-first for Supabase API

const CACHE_NAME = 'pureflow-v1';
const OFFLINE_PAGE = './index.html';

// Static assets to cache immediately on install
const STATIC_ASSETS = [
  './index.html',
  './vendor.html',
  './admin.html',
  './cashier.html',
  './driver.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap'
];

// ── INSTALL ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[PureFlow SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[PureFlow SW] Caching static assets');
      // Cache each asset individually so one failure doesn't break everything
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn(`[SW] Failed to cache: ${url}`, err))
        )
      );
    }).then(() => {
      console.log('[PureFlow SW] Install complete');
      return self.skipWaiting(); // Activate immediately
    })
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[PureFlow SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[PureFlow SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[PureFlow SW] Activated — controlling all clients');
      return self.clients.claim();
    })
  );
});

// ── FETCH ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept: Supabase API, Chrome extensions, non-GET
  if (
    event.request.method !== 'GET' ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.io') ||
    url.protocol === 'chrome-extension:'
  ) {
    return; // Let it go straight to network
  }

  // Google Fonts & CDN — cache-first
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdn.jsdelivr.net')
  ) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // App HTML pages — network-first, fallback to cache
  if (
    url.pathname.endsWith('.html') ||
    url.pathname === '/' ||
    STATIC_ASSETS.includes(url.pathname)
  ) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Icons and manifest — cache-first
  if (
    url.pathname.includes('/icons/') ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Everything else — network with cache fallback
  event.respondWith(networkFirst(event.request));
});

// ── STRATEGIES ───────────────────────────────────────────────────────────────

// Network first: try live, fall back to cache, then offline page
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Last resort: return the offline/login page
    const offline = await caches.match(OFFLINE_PAGE);
    return offline || new Response('You are offline. Please reconnect.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Cache first: serve from cache, update cache in background
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Background refresh
    fetch(request).then(response => {
      if (response && response.status === 200) {
        caches.open(CACHE_NAME).then(cache => cache.put(request, response));
      }
    }).catch(() => {});
    return cached;
  }
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    return new Response('Asset not available offline', { status: 503 });
  }
}

// ── BACKGROUND SYNC (for offline order/payment queuing) ───────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'pureflow-sync') {
    console.log('[PureFlow SW] Background sync triggered');
    // Supabase handles its own retry logic, so just log here
  }
});

// ── PUSH NOTIFICATIONS (future use) ───────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'PureFlow', {
      body: data.body || 'You have a new notification',
      icon: './icons/icon-192x192.png',
      badge: './icons/icon-96x96.png',
      tag: 'pureflow-notification',
      renotify: true,
      data: { url: data.url || './index.html' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || './index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

console.log('[PureFlow SW] Service Worker loaded ✅');
