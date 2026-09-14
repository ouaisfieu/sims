/* ============================================================
   sw.js — hors ligne d'abord. Rien ne sort du navigateur.
   ============================================================ */
const VERSION = "fumee-blanche-v2";
const SOCLE = [
  "./",
  "./index.html",
  "./conclave/",
  "./conclave/index.html",
  "./conclave/methodologie.html",
  "./conclave/mesures/",
  "./conclave/cheatcodes/",
  "./conclave/manifest.webmanifest",
  "./assets/css/base.css",
  "./assets/css/jeu.css",
  "./assets/css/corpus.css",
  "./assets/css/cheatcodes.css",
  "./assets/js/app.js",
  "./assets/js/moteur.js",
  "./assets/js/stockage.js",
  "./assets/js/partage.js",
  "./assets/js/corpus.js",
  "./assets/data/jeu.json",
  "./assets/data/corpus.json",
  "./assets/data/combinaisons.json",
  "./assets/img/icone.svg",
  "./assets/img/icone-192.png",
  "./assets/img/icone-512.png",
  "./assets/img/partage.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.allSettled(SOCLE.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== VERSION).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  /* Navigation : reseau d'abord, cache en secours, puis le jeu. */
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then((r) => { majCache(request, r.clone()); return r; })
        .catch(async () =>
          (await caches.match(request)) ||
          (await caches.match("./conclave/index.html")) ||
          new Response("Hors ligne, et cette page n'a pas encore été visitée.", {
            status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        )
    );
    return;
  }

  /* Ressources : cache d'abord, rafraichi en arriere-plan. */
  e.respondWith(
    caches.match(request).then((cachee) => {
      const reseau = fetch(request)
        .then((r) => { if (r.ok) majCache(request, r.clone()); return r; })
        .catch(() => cachee);
      return cachee || reseau;
    })
  );
});

function majCache(request, reponse) {
  caches.open(VERSION).then((c) => c.put(request, reponse)).catch(() => {});
}
