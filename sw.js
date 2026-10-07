/* Suivi-Garage-Partage — sw.js (v148)
   Service worker MINIMAL : notifications push seulement.
   Aucun cache, aucun gestionnaire « fetch » → l'app charge toujours la dernière version déployée,
   exactement comme avant (aucun risque de copie périmée, aucun bandeau de mise à jour). */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// v178 : vibration par type d'alerte (Android ; iOS ignore `vibrate`). LIMITE PLATEFORME : le SON d'une notification push est choisi par le
// système (sonnerie, mode silencieux, Concentration), jamais par l'app : il n'est pas réglable ici. Les sons plus forts et le volume réglable
// ne valent que pour l'app OUVERTE (index.html, jouerSon). Le défaut reste le motif d'origine.
const VIBRATIONS = {
  demande: [300, 150, 300, 150, 300, 150, 600],
  sms: [200, 100, 200, 100, 400],
  appel: [400, 150, 400, 150, 400],
};
const VIBRATION_DEFAUT = [200, 100, 200, 100, 400];

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { titre: "MTR Performance", corps: e.data ? e.data.text() : "" }; }
  const titre = d.titre || "MTR Performance";
  const options = {
    body: d.corps || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: d.tag || "mtr-" + Date.now(),
    renotify: true,
    requireInteraction: d.type === "demande",   // une demande reste affichée jusqu'à ce qu'on la touche (là où c'est supporté)
    vibrate: Object.prototype.hasOwnProperty.call(VIBRATIONS, d.type) ? VIBRATIONS[d.type] : VIBRATION_DEFAUT,   // v178 : par type
    data: { url: d.url || "/", type: d.type || "info" },
  };
  e.waitUntil(self.registration.showNotification(titre, options));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const cible = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil((async () => {
    const fen = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const f of fen) {
      if (f.url.startsWith(self.location.origin)) {
        try { await f.focus(); } catch (_) {}
        try { await f.navigate(cible); } catch (_) { f.postMessage({ type: "ouvrir", url: cible }); }
        return;
      }
    }
    await self.clients.openWindow(cible);
  })());
});
