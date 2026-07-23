/* Service Worker — Mundiláminas (Web Push) */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Llega un push: mostrar la notificación del sistema.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { data = { body: event.data ? event.data.text() : '' }; }

  const title = data.title || 'Mundiláminas';
  const options = {
    body: data.body || '',
    icon: 'icon-192.png?v=20260723b',
    badge: 'icon-192.png?v=20260723b',
    data: { url: data.url || '/index.html' },
    vibrate: [80, 40, 80],
    tag: 'mundilaminas-match',
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Tocar la notificación: enfocar la app abierta o abrirla.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/index.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { if ('navigate' in c) { try { c.navigate(url); } catch (e) {} } return c.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
