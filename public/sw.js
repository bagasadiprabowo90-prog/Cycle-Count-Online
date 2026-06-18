/**
 * Service Worker untuk Stock Opname Pro
 * Cache strategy: Stale-While-Revalidate untuk assets
 * Network-first untuk API calls
 */

const CACHE_NAME = 'stock-opname-v7';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name.startsWith('stock-opname'))
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // API calls: Network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCacheFallback(request));
    return;
  }

  // Static assets: Cache first, fallback to network
  if (
    url.pathname.match(/\.(js|css|woff2?|png|jpg|jpeg|gif|svg|ico)$/) ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(cacheFirstWithNetworkFallback(request));
    return;
  }

  // HTML pages: Stale while revalidate
  event.respondWith(staleWhileRevalidate(request));
});

/**
 * Network first with cache fallback
 * Best for API calls - always try network for fresh data
 */
async function networkFirstWithCacheFallback(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    // Try network first
    const networkResponse = await fetch(request);

    // If successful, cache and return
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline error response
    return new Response(
      JSON.stringify({ success: false, message: 'Offline - data tidak tersedia' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Cache first with network fallback
 * Best for static assets
 */
async function cacheFirstWithNetworkFallback(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    // Return cached immediately, update cache in background
    fetchAndCache(request);
    return cachedResponse;
  }

  // Not in cache, fetch from network
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Return offline placeholder for images
    if (request.destination === 'image') {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="#e2e8f0" width="100" height="100"/><text fill="#64748b" font-size="12" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">Offline</text></svg>',
        {
          headers: { 'Content-Type': 'image/svg+xml' },
        }
      );
    }

    throw error;
  }
}

/**
 * Stale while revalidate
 * Best for HTML pages - serve stale content immediately
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  // Start network fetch in background
  const networkFetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  // Return cached immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }

  // Wait for network if no cache
  const networkResponse = await networkFetchPromise;
  return networkResponse || caches.match('/index.html');
}

/**
 * Fetch and update cache (for background updates)
 */
async function fetchAndCache(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse);
    }
  } catch (error) {
    // Ignore errors in background fetch
  }
}

// Handle messages from main thread
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
