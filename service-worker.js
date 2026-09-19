/**
 * Service Worker cơ bản cho PWA LeGroup 5S.
 * Cache các file tĩnh để app load nhanh hơn.
 * Khi mất mạng sẽ hiển thị trang offline thay vì lỗi trắng.
 */

const CACHE_NAME = "legroup-5s-v1";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/standards.js",
  "/images/Logo.jpg"
];

// Cài đặt: cache các file tĩnh chính
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Kích hoạt: xóa cache cũ khi có phiên bản mới
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Chiến lược: Network First (ưu tiên mạng, dùng cache khi offline)
// API calls luôn đi qua mạng, không cache
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Không cache API calls
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache bản mới nhất
        if (response.ok && event.request.method === "GET") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline: trả về từ cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Nếu không có trong cache, trả về trang chính
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
        });
      })
  );
});
