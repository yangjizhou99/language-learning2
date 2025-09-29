// Minimal Service Worker to enable installability without aggressive caching
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Do not intercept fetch by default to avoid breaking dynamic APIs

