/* Firebase Cloud Messaging: notificações recebidas com a aplicação fechada. */
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAajz5PVa79vH1FSWrC0pPrGxs0Q-9xkFk',
  authDomain: 'triohnte-database.firebaseapp.com',
  databaseURL: 'https://triohnte-database-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'triohnte-database',
  appId: '1:127473963183:web:c071072d846a8d7240045a',
  messagingSenderId: '127473963183'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const data = payload.data || {};

  // Atualiza o número de publicações não lidas mesmo com o PWA em segundo plano.
  const quantidade = Number.parseInt(data.badgeCount || '0', 10);
  if (Number.isFinite(quantidade) && typeof self.registration.setAppBadge === 'function') {
    const atualizacao = quantidade > 0
      ? self.registration.setAppBadge(quantidade)
      : (typeof self.registration.clearAppBadge === 'function'
          ? self.registration.clearAppBadge()
          : self.registration.setAppBadge(0));
    if (atualizacao && typeof atualizacao.catch === 'function') {
      atualizacao.catch(error => console.warn('Triohnte: não foi possível atualizar o emblema em segundo plano.', error));
    }
  }

  // Mensagens com payload de notificação são exibidas automaticamente pelo navegador.
  if (payload.notification) return;

  const title = data.title || 'Novidade no Triohnte';
  const options = {
    body: data.body || 'Há uma nova atividade na comunidade.',
    icon: './mu-natal.svg',
    badge: './mu-natal.svg',
    data: { url: data.url || './index.html' },
    tag: data.tag || 'triohnte-novidade'
  };
  return self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = new URL(
    (event.notification.data && event.notification.data.url) || './index.html',
    self.location.origin
  ).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client && client.url !== targetUrl) await client.navigate(targetUrl);
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(targetUrl);
  })());
});

const CACHE_NAME = 'triohnte-cache-v5';
const CACHE_PREFIX = 'triohnte-cache-';
const APP_SHELL = [
  './index.html',
  './manifest.webmanifest',
  './mu.png',
  './mu-natal.svg',
  './triwo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          return cachedPage || caches.match('./index.html');
        })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
