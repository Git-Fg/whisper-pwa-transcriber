// Service Worker pour Whisper PWA Transcriber
// Version 1.0.0

const CACHE_NAME = 'whisper-pwa-v1.0.0';
const MODEL_CACHE = 'whisper-models-v1.0.0';
const RUNTIME_CACHE = 'whisper-runtime-v1.0.0';

// Fichiers essentiels à mettre en cache
const CORE_FILES = [
  '/',
  '/manifest.json',
  '/offline.html',
  '/_next/static/css/',
  '/_next/static/js/'
];

// Patterns d'URLs pour les modèles ML
const MODEL_URL_PATTERNS = [
  /huggingface\.co/,
  /cdn\.jsdelivr\.net.*transformers/,
  /onnx-community/,
  /\.onnx$/,
  /\.wasm$/
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installation démarrée');
  
  event.waitUntil(
    Promise.all([
      // Cache des fichiers essentiels
      caches.open(CACHE_NAME)
        .then(cache => {
          console.log('[SW] Mise en cache des fichiers essentiels');
          return cache.addAll(CORE_FILES.filter(url => !url.endsWith('/')));
        }),
      
      // Initialisation du cache des modèles
      caches.open(MODEL_CACHE)
        .then(cache => {
          console.log('[SW] Cache des modèles initialisé');
          return Promise.resolve();
        }),
        
      // Cache runtime
      caches.open(RUNTIME_CACHE)
        .then(cache => {
          console.log('[SW] Cache runtime initialisé');
          return Promise.resolve();
        })
    ]).then(() => {
      console.log('[SW] Installation terminée');
      return self.skipWaiting();
    })
  );
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation démarrée');
  
  event.waitUntil(
    Promise.all([
      // Nettoyage des anciens caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== MODEL_CACHE && 
                cacheName !== RUNTIME_CACHE) {
              console.log('[SW] Suppression ancien cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Prise de contrôle immédiate
      self.clients.claim()
    ]).then(() => {
      console.log('[SW] Activation terminée');
    })
  );
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') {
    return;
  }

  // Stratégie de cache pour les modèles ML
  if (MODEL_URL_PATTERNS.some(pattern => pattern.test(request.url))) {
    event.respondWith(handleModelRequest(request));
    return;
  }

  // Stratégie de cache pour les fichiers Next.js
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(handleNextJSRequest(request));
    return;
  }

  // Stratégie pour les pages
  if (url.pathname === '/' || url.pathname.startsWith('/app/')) {
    event.respondWith(handlePageRequest(request));
    return;
  }

  // Stratégie par défaut
  event.respondWith(handleDefaultRequest(request));
});

/**
 * Gestion des requêtes de modèles ML avec cache persistant
 */
async function handleModelRequest(request) {
  const cache = await caches.open(MODEL_CACHE);
  
  try {
    // Vérifier le cache d'abord
    let cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('[SW] Modèle servi depuis le cache:', request.url);
      return cachedResponse;
    }

    // Télécharger et cacher
    console.log('[SW] Téléchargement modèle:', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cloner pour le cache (les streams ne peuvent être lus qu'une fois)
      const responseToCache = networkResponse.clone();
      
      // Mise en cache asynchrone pour ne pas bloquer la réponse
      cache.put(request, responseToCache).catch(err => {
        console.warn('[SW] Erreur mise en cache modèle:', err);
      });
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error('[SW] Erreur chargement modèle:', error);
    
    // Tentative de récupération depuis le cache même expiré
    cachedResponse = await cache.match(request, { ignoreVary: true });
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

/**
 * Gestion des assets Next.js avec cache stale-while-revalidate
 */
async function handleNextJSRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  // Stratégie Cache First pour les assets statiques
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Revalidation en arrière-plan pour les assets
    if (request.url.includes('/_next/static/')) {
      fetch(request).then(networkResponse => {
        if (networkResponse.ok) {
          cache.put(request, networkResponse.clone());
        }
      }).catch(() => {/* Ignorer les erreurs de revalidation */});
    }
    
    return cachedResponse;
  }

  // Réseau puis cache
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      cache.put(request, responseToCache);
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error('[SW] Erreur chargement asset Next.js:', error);
    throw error;
  }
}

/**
 * Gestion des pages avec Network First, fallback vers cache
 */
async function handlePageRequest(request) {
  try {
    // Essayer le réseau d'abord
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Mettre en cache la page
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('[SW] Réseau indisponible, tentative cache:', request.url);
    
    // Fallback vers le cache
    const cache = await caches.open(RUNTIME_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback vers la page offline
    const offlineCache = await caches.open(CACHE_NAME);
    return offlineCache.match('/offline.html') || new Response(
      'Application hors ligne indisponible',
      { status: 503, statusText: 'Service Unavailable' }
    );
  }
}

/**
 * Stratégie par défaut
 */
async function handleDefaultRequest(request) {
  try {
    return await fetch(request);
  } catch (error) {
    // Tentative de récupération depuis tous les caches
    const cacheNames = [RUNTIME_CACHE, CACHE_NAME, MODEL_CACHE];
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    throw error;
  }
}

// Gestion des messages depuis l'application
self.addEventListener('message', (event) => {
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        self.skipWaiting();
        break;
        
      case 'GET_CACHE_SIZE':
        getCacheSize().then(size => {
          event.ports[0].postMessage({ size });
        });
        break;
        
      case 'CLEAR_MODEL_CACHE':
        clearModelCache().then(() => {
          event.ports[0].postMessage({ success: true });
        }).catch(error => {
          event.ports[0].postMessage({ error: error.message });
        });
        break;
    }
  }
});

/**
 * Calcule la taille totale des caches
 */
async function getCacheSize() {
  const cacheNames = await caches.keys();
  let totalSize = 0;
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    for (const key of keys) {
      const response = await cache.match(key);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
  }
  
  return totalSize;
}

/**
 * Vide le cache des modèles
 */
async function clearModelCache() {
  const cache = await caches.open(MODEL_CACHE);
  const keys = await cache.keys();
  
  return Promise.all(
    keys.map(key => cache.delete(key))
  );
}

// Gestion des erreurs globales
self.addEventListener('error', (error) => {
  console.error('[SW] Erreur globale:', error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Promise rejetée:', event.reason);
});