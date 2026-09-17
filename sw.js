// Service Worker: cacheia o app shell para permitir abrir offline após a
// primeira visita. Usa "network-first" para o HTML (para sempre pegar
// versão nova quando há internet) e "cache-first" para assets estáticos.

const CACHE_NAME = 'hand-interface-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Não interceptar chamadas a CDNs externos (MediaPipe/Three.js) nem a
  // requisições que não sejam GET — deixa passar direto para a rede.
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) {
    return;
  }

  // Navegação / HTML: network-first. Sempre tenta buscar a versão mais
  // nova da rede primeiro; só usa o cache como fallback se estiver offline.
  // Isso evita ficar preso numa versão antiga do app depois de um deploy.
  const isHTML = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Demais assets estáticos (ícones, manifest): cache-first, com
  // atualização em segundo plano (stale-while-revalidate).
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
