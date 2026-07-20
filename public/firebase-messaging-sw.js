// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

firebase.initializeApp({
  apiKey: "AIzaSyAs7C-OegYfoPxj8LOYNagZgcMi9yo45Zg",
  authDomain: "omix-systems-cd1af.firebaseapp.com",
  projectId: "omix-systems-cd1af",
  storageBucket: "omix-systems-cd1af.firebasestorage.app",
  messagingSenderId: "458479471215",
  appId: "1:458479471215:web:c0210748800fdf51ff5b9a",
});

const messaging = firebase.messaging();

// Handle background push messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const data = payload.data || {};
  const notificationTitle = data.title || payload.notification?.title || 'New message';
  const notificationBody = data.body || payload.notification?.body || '';
  const channelId = data.channelId || '';
  const serverId = data.serverId || '';

  const notificationOptions = {
    body: notificationBody,
    icon: '/logo-192.png',
    badge: '/logo-192.png',
    tag: channelId || 'omix',
    data: {
      channelId,
      serverId,
      click_action: 'open_channel',
    },
    vibrate: [100, 50, 100],
    requireInteraction: true,
    silent: false,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event.notification);

  event.notification.close();

  const data = event.notification.data || {};
  const channelId = data.channelId;

  // Focus or open the app
  const urlToOpen = new URL('/', self.location.origin);

  if (channelId) {
    urlToOpen.searchParams.set('channel', channelId);
  }

  const promiseChain = clients
    .matchAll({
      type: 'window',
      includeUncontrolled: true,
    })
    .then((windowClients) => {
      // If we have an open window, focus it and navigate
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.postMessage({
            type: 'OPEN_CHANNEL',
            channelId,
          });
          return client.focus();
        }
      }
      // Otherwise open a new window
      return clients.openWindow(urlToOpen.toString());
    });

  event.waitUntil(promiseChain);
});
