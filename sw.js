/* Offline support. Uses the network when it can so updates appear straight away,
   and falls back to the saved copy when there is no connection.
   Add any new game file to FILES. */
const CACHE = "catch-to-cash-v38";
const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/style.css",
  "js/vendor/three.bundle.js",
  "js/vendor/people.data.js",
  "js/3d/stage.js",
  "js/3d/people.js",
  "js/3d/models.js",
  "js/levels.js",
  "js/audio.js",
  "js/game.js",
  "js/missions.js",
  "js/layout.js",
  "js/sea.js",
  "js/art.js",
  "js/render.js",
  "js/leap.js",
  "js/ui.js",
  "js/main.js",
  "js/splash.js",
  "fonts/Righteous-Regular.ttf",
  "fonts/Bungee-Regular.ttf",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match("index.html")))
  );
});
