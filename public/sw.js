// Firebase Cloud Messaging Service Worker + Cache
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

firebase.initializeApp({
  apiKey: "AIzaSy...45Zg",
  authDomain: "omix-systems-cd1af.firebaseapp.com",
  projectId: "omix-systems-cd1af",
  storageBucket: "omix-systems-cd1af.firebasestorage.app",
  messagingSenderId: "458479471215",
  appId: "1:458479471215:web:c0210748800fdf51ff5b9a",
});

const messaging = firebase.messaging();

var CACHE_NAME = 'omix-cache-v5';
var STATIC_CACHE = 'omix-static-v5';

// Install — skip waiting, activate immediately
self.addEventListener('install', function(event) {
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
        if (cached) return cached;
        if (requestUrl.pathname === '/' || requestUrl.pathname === '/index.html') {
          return caches.match('/index.html');
        }
        return caches.match('/index.html');
      });
    })
  );
});

// Handle background push messages
messaging.onBackgroundMessage(function(payload) {
  var data = payload.data || {};
  var notificationTitle = data.title || payload.notification && payload.notification.title || 'New message';
  var notificationBody = data.body || payload.notification && payload.notification.body || '';
  var channelId = data.channelId || '';
  var serverId = data.serverId || '';

  var notificationOptions = {
    body: notificationBody,
    icon: '/logo-192.png',
    badge: '/logo-192.png',
    tag: channelId || 'omix',
    data: {
      channelId: channelId,
      serverId: serverId,
      click_action: 'open_channel',
    },
    vibrate: [100, 50, 100],
    requireInteraction: true,
    silent: false,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
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
