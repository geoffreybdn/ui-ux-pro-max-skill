// Service worker : notifications push + carte disponible hors connexion
const CACHE = "pz-card-v1";
const OFFLINE_PAGES = ["/carte"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/icon.svg", "/icon-192.png"])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Déconnexion : on efface la carte mise en cache (appareil partagé)
  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    event.waitUntil(caches.delete(CACHE));
    return;
  }

  // Page carte : réseau d'abord, dernière version en cache si pas de réseau (QR toujours affichable en caisse)
  if (req.method === "GET" && req.mode === "navigate" && OFFLINE_PAGES.includes(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(() => caches.match(url.pathname).then((r) => r || Response.error()))
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Nouvelle notification", body: event.data && event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Pizzeria", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/carte" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/carte";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
