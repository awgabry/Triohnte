const CACHE_NAME = 'triohnte-cache-v1';
const urlsToCache = [
  './index.html',
  './manifest.webmanifest',
  './Capa.png'
  // Adicione aqui outros arquivos CSS, JS ou imagens importantes do seu projeto
];

// Instalação do Service Worker e cache dos arquivos iniciais
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Interceptação de requisições para servir os arquivos do cache quando offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
