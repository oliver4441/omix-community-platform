// Omix service worker — PWA caching + Web Push notifications (VAPID).
// Push payloads are encrypted (RFC 8291) by the omix-api worker; the browser
// decrypts them before firing this handler, so event.data is plain JSON.

var CACHE_NAME = 'omix-cache-v6';
var STATIC_CACHE = 'omix-static-v6';

// Install — skip waiting, activate immediately
self.addEventListener('install', function() {
  self.skipWaiting();
});

// Activate — clean old caches, take control
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
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch — network-first for SPA, cache-first for assets
self.addEventListener('fetch', function(event) {
  var requestUrl = new URL(event.request.url);

  // Only handle same-origin
  if (requestUrl.origin !== self.location.origin) return;

  // Static assets: cache-first
  if (requestUrl.pathname.match(/\.(png|svg|jpg|jpeg|gif|ico|webp|woff2?)$/) ||
      requestUrl.pathname === '/manifest.json') {
    event.respondWith(
      caches.match(event.request).then(function(response) {
        return response || fetch(event.request).then(function(networkResponse) {
          return caches.open(STATIC_CACHE).then(function(cache) {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // JS/CSS: cache on first fetch
  if (requestUrl.pathname.match(/\.(js|css)$/) && requestUrl.pathname.startsWith('/assets/')) {
    event.respondWith(
      fetch(event.request).then(function(networkResponse) {
        return caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      }).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }

  // HTML/SPA: network-first with cached fallback
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
        return cached || caches.match('/index.html');
      });
    })
  );
});

// Web Push — payload is already decrypted by the browser; data is JSON
// { title, body, data: { channelId, serverId, ... } } from the omix-api worker.
self.addEventListener('push', function(event) {
  var title = 'Omix';
  var body = '';
  var data = {};
  try {
    var payload = event.data ? event.data.json() : {};
    title = payload.title || title;
    body = payload.body || body;
    data = payload.data || data;
  } catch (err) {
    // Malformed / empty payload — show a generic notification.
  }

  var notificationOptions = {
    body: body,
    icon: '/logo-192.png',
    badge: '/logo-192.png',
    tag: data.channelId || 'omix',
    data: data,
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, notificationOptions));
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var data = event.notification.data || {};
  var channelId = data.channelId;

  var urlToOpen = new URL('/', self.location.origin);
  if (channelId) {
    urlToOpen.searchParams.set('channel', channelId);
  }

  var promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  }).then(function(windowClients) {
    for (var i = 0; i < windowClients.length; i++) {
      var client = windowClients[i];
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        client.postMessage({ type: 'OPEN_CHANNEL', channelId: channelId });
        return client.focus();
      }
    }
    return clients.openWindow(urlToOpen.toString());
  });

  event.waitUntil(promiseChain);
});
