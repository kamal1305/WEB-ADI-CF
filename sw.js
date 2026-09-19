/* ═══════════════════════════════════════════════════════════
   SERVICE WORKER — A.D. ICOVESA (ADI C.F.)
   PWA Caching & Offline Resilience
   ═══════════════════════════════════════════════════════════ */

const CACHE_NAME = 'adi-cf-v1';

// Recursos esenciales para el arranque offline (App Shell)
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './img/escudo.png',
  './img/icons/icon-192.png',
  './img/icons/icon-512.png',
  './img/icons/icon-maskable-512.png',
  './img/icons/apple-touch-icon.png'
];

// Instalación: precarga de assets críticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activación: limpieza de cachés antiguas y toma de control inmediata
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Manejo de peticiones (Fetch)
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo interceptamos peticiones GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Ignorar extensiones de navegador y esquemas no http/https
  if (!url.protocol.startsWith('http')) return;

  // 1. Datos dinámicos (JSON de contenido del club: calendario, noticias, equipos, etc.)
  // Estrategia: Network-First con fallback a Caché
  if (url.pathname.includes('/content/') && url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // 2. Fuentes de Google Fonts (CSS y WOFF2)
  // Estrategia: Stale-While-Revalidate
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => cachedResponse);
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // 3. Recursos estáticos propios (HTML, imágenes, CSS, iconos)
  // Estrategia: Cache-First con fallback a Red y actualización en segundo plano
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // En segundo plano intentamos actualizar el cache si hay conexión
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => { /* Sin conexión, mantenemos caché */ });

        return cachedResponse;
      }

      // Si no está en caché, buscar en red y cachear
      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // Fallback para navegación offline: si falla la carga de página HTML, retornar el index precacheado
          if (request.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./');
          }
          return new Response('Sin conexión', { status: 503, statusText: 'Service Unavailable' });
        });
    })
  );
});

// Comunicación con clientes (para forzar actualización si se solicita)
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
