// Service worker khusus Web Push — hanya menangani notifikasi chat, tidak
// melakukan caching apa pun (aplikasi ini tetap online-only).

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { /* payload bukan JSON, abaikan */ }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Kalau ada tab yang sedang aktif dilihat, orang itu sudah lihat pesannya
      // langsung di dalam app (toast + badge) — tidak perlu notifikasi OS lagi.
      const hasVisibleClient = clients.some((c) => c.visibilityState === 'visible');
      if (hasVisibleClient) return;

      return self.registration.showNotification(data.title || 'Pesan baru', {
        body: data.body || '',
        icon: '/FOTO/LOGO.png',
        badge: '/FOTO/LOGO.png',
        tag: data.room_id || 'chat',
        data: { url: data.url || '/chat.html' },
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/chat.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) {
          if ('navigate' in c) c.navigate(url);
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
