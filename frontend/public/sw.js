// Notificaciones del navegador de Carpetazo (avisos de la lista de deseos). No guarda archivos ni intercepta la navegación.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_error) { data = {}; }
  const title = typeof data.title === 'string' && data.title ? data.title.slice(0, 80) : 'Carpetazo';
  const options = {
    body: typeof data.body === 'string' ? data.body.slice(0, 200) : '',
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: typeof data.tag === 'string' ? data.tag : 'carpetazo',
    data: { url: typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(target);
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
