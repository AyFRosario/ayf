// A&F · Service worker
// · Archivos de la app: primero la red (para que las actualizaciones lleguen
//   apenas se publican en GitHub Pages) y, sin conexión, la copia guardada.
// · Librerías externas (Firebase, fuentes, lector de códigos): primero la copia
//   guardada, porque sus direcciones tienen versión fija.
const VERSION = "af-0.2.0";
const APP = [
  "./", "index.html", "manifest.json", "css/app.css",
  "js/app.js", "js/config.js", "js/db.js", "js/db-demo.js", "js/db-firebase.js", "js/store.js",
  "js/util.js", "js/buscar.js", "js/scanner.js", "js/print.js", "js/importar.js",
  "js/vistas/salon.js", "js/vistas/mesa.js", "js/vistas/cobro.js", "js/vistas/cocina.js",
  "js/vistas/caja.js", "js/vistas/productos.js", "js/vistas/usuarios.js", "js/vistas/ajustes.js",
  "img/logo.svg", "img/logo-blanco.svg", "img/icon-192.png", "img/icon-512.png",
];
const EXTERNOS = ["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com", "fastly.jsdelivr.net", "cdn.jsdelivr.net", "cdn.sheetjs.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(APP)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Firestore y Auth van siempre directo (tienen su propia caché)
  if (url.hostname.includes("googleapis.com") && !url.hostname.startsWith("fonts.")) return;
  if (url.hostname.includes("firebase") || url.hostname.includes("identitytoolkit")) return;

  if (EXTERNOS.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((r) => {
        if (r.ok || r.type === "opaque") { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(req, copia)); }
        return r;
      }))
    );
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(req).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(req, copia)); }
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match("index.html")))
  );
});
