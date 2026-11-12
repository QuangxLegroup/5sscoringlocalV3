/**
 * Service Worker cơ bản cho PWA LeGroup 5S.
 * Cache các file tĩnh để app load nhanh hơn.
 * Khi mất mạng sẽ hiển thị trang offline thay vì lỗi trắng.
 */

const CACHE_NAME = "legroup-5s-v172";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/styles.css",
  "/app.js",
  "/modules/local-data-api.js",
  "/modules/core/page-registry.js",
  "/modules/core/safety-timeline.js",
  "/modules/core/image-circle-annotator.js",
  "/modules/core/form-draft-manager.js",
  "/modules/core/custom-dropdown.js",
  "/modules/pages/admin-home-page.js",
  "/modules/pages/assessor-page.js",
  "/modules/pages/summary-page.js",
  "/modules/pages/safety-page.js",
  "/modules/pages/issue-stats-page.js",
  "/modules/pages/safety-live-page.js",
  "/modules/pages/catalog-page.js",
  "/modules/pages/accounts-page.js",
  "/modules/pages/data-page.js",
  "/modules/pages/five-s-findings-page.js",
  "/modules/pages/user-guide-content.js",
  "/modules/pages/mobile-prototype.js",
  "/modules/pages/guide-setup-page.js",
  "/modules/pages/audit-log-page.js",
  "/standards.js",
  "/images/Logo.jpg",
  "/images/anhnhamay.jpg",
  "/images/congnhan.png",
  "/images/congnhan2.png",
  "/images/pwa-192.png",
  "/images/pwa-512.png"
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
// API calls và non-GET requests luôn đi qua mạng, không cache
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }
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
      .catch(async () => {
        // Offline: trả về từ cache (hỗ trợ khớp cả URL có query ?v=...)
        const exactCached = await caches.match(event.request);
        if (exactCached) return exactCached;
        const ignoreSearchCached = await caches.match(event.request, { ignoreSearch: true });
        if (ignoreSearchCached) return ignoreSearchCached;
        // Nếu không có trong cache, trả về trang chính khi điều hướng
        if (event.request.mode === "navigate") {
          const fallbackPage = await caches.match("/index.html", { ignoreSearch: true });
          if (fallbackPage) return fallbackPage;
        }
        return new Response("Offline", {
          status: 503,
          statusText: "Offline",
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      })
  );
});
