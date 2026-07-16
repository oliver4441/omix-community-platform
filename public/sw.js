var CACHE_NAME = 'omix-cache-v4';
var STATIC_CACHE = 'omix-static-v4';
var urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/firebase-init.js',
  '/app.js',
  '/utils/store.js',
  '/components/Layout.js',
  '/components/ServerRail.js',
  '/components/ChannelSidebar.js',
  '/components/ChatPane.js',
  '/components/MobileNav.js',
  '/sw.js',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png',
  '/logo.jpg',
  '/logo-192.png',
  '/logo-512.png',
  '/logo-192-maskable.png',
  '/logo-512-maskable.png'
];

// Install — cache all static assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function(cache) {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(name) {
          return name !== STATIC_CACHE && name !== CACHE_NAME;
        }).map(function(name) {
          return caches.delete(name);
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch — cache-first for static, network-first for everything else
self.addEventListener('fetch', function(event) {
  var requestUrl = new URL(event.request.url);

  // Only handle same-origin requests
  if (requestUrl.origin !== self.location.origin) return;

  // For static assets (icons, manifest, js), use cache-first
  if (requestUrl.pathname.match(/\.(png|svg|jpg|jpeg|gif|ico|webp)$/) ||
      requestUrl.pathname === '/manifest.json') {
    event.respondWith(
      caches.match(event.request).then(function(response) {
        return response || fetch(event.request);
      })
    );
    return;
  }

  // For HTML and JS, use network-first with cache fallback (always serve fresh if online)
  event.respondWith(
    fetch(event.request).then(function(networkResponse) {
      if (networkResponse && networkResponse.status === 200) {
        var cacheCopy = networkResponse.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, cacheCopy);
        });
      }
      return networkResponse;
    }).catch(function() {
      return caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        // If index.html is requested offline, serve it from static cache
        if (requestUrl.pathname === '/index.html' || requestUrl.pathname === '/') {
          return caches.match('/index.html');
        }
        // For other uncached requests, return index.html (SPA fallback)
        return caches.match('/index.html');
      });
    })
  );
});
