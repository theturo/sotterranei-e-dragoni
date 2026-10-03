// Service worker dell'app installabile (PWA).
// - Salva sul telefono pagine, stili, script e icone di questa versione del
//   sito (FILE, sotto) e li serve da lì: l'app si apre subito e resta
//   coerente, perché tutti i file appartengono alla stessa versione.
// - Senza rete le pagine mostrano offline.html (i dati stanno su Firebase).
// - Una versione nuova si installa in silenzio e resta in attesa: la pagina
//   mostra "È disponibile una nuova versione" e, con "Aggiorna", manda il
//   messaggio "attiva" (vedi assets/js/pwa.js). Altrimenti si attiva alla
//   prossima apertura dell'app.
// - Mostra le notifiche push (inviate dalla Cloud Function inviaNotificaPush,
//   vedi assets/js/notifiche-push.js) e al tocco apre la pagina indicata.
// - Le richieste a Firebase e agli altri servizi esterni non passano di qui,
//   tranne gli script dell'SDK di Firebase (indirizzi con la versione, che
//   non cambiano mai: si salvano alla prima richiesta).
// L'elenco e la VERSIONE si rigenerano con: node strumenti/aggiorna-sw.mjs

// === ELENCO GENERATO: node strumenti/aggiorna-sw.mjs ===
const VERSIONE = "720786d91857";
const FILE = [
  "./admin-utenti.html",
  "./archivio.html",
  "./assets/css/style.css",
  "./assets/fonts/cinzel-700.woff2",
  "./assets/fonts/cinzel-OFL.txt",
  "./assets/icone/apple-touch-icon.png",
  "./assets/icone/badge-96.png",
  "./assets/icone/favicon-32.png",
  "./assets/icone/favicon.svg",
  "./assets/icone/icona-192.png",
  "./assets/icone/icona-512.png",
  "./assets/icone/icona-maskable-512.png",
  "./assets/img/guida/combattimento.jpg",
  "./assets/img/guida/mappa.jpg",
  "./assets/img/guida/personaggio.jpg",
  "./assets/img/guida/primi-passi.jpg",
  "./assets/img/guida/sessione.jpg",
  "./assets/js/aree-incantesimi.js",
  "./assets/js/auth.js",
  "./assets/js/bestiario-calcoli.js",
  "./assets/js/bestiario-finestra.js",
  "./assets/js/bestiario-scheda.js",
  "./assets/js/calcoli-scheda.js",
  "./assets/js/calendario.js",
  "./assets/js/combattimento.js",
  "./assets/js/condizioni.js",
  "./assets/js/contenuti.js",
  "./assets/js/cruscotto-calcoli.js",
  "./assets/js/dadi-base.js",
  "./assets/js/dadi.js",
  "./assets/js/dado-caricamento.js",
  "./assets/js/dati-srd.js",
  "./assets/js/descrizioni.js",
  "./assets/js/equipaggiamento-srd.js",
  "./assets/js/esporta-scheda.js",
  "./assets/js/firebase-config.js",
  "./assets/js/guida-personaggio-dati.js",
  "./assets/js/guida-personaggio.js",
  "./assets/js/icone.js",
  "./assets/js/immagini.js",
  "./assets/js/incantesimi-srd.js",
  "./assets/js/intro-dado.js",
  "./assets/js/intro.js",
  "./assets/js/mappa-calcoli.js",
  "./assets/js/mappa-pedine.js",
  "./assets/js/mappa-strumenti.js",
  "./assets/js/mappa-vista.js",
  "./assets/js/mappa.js",
  "./assets/js/menu-utente.js",
  "./assets/js/mostri-srd.js",
  "./assets/js/notifiche-push.js",
  "./assets/js/pagine/admin-utenti.js",
  "./assets/js/pagine/archivio.js",
  "./assets/js/pagine/attesa-approvazione.js",
  "./assets/js/pagine/bestiario.js",
  "./assets/js/pagine/calendario.js",
  "./assets/js/pagine/campagna.js",
  "./assets/js/pagine/controllo-musica.js",
  "./assets/js/pagine/crea-personaggio.js",
  "./assets/js/pagine/dashboard.js",
  "./assets/js/pagine/dm-party.js",
  "./assets/js/pagine/glossario-equipaggiamento.js",
  "./assets/js/pagine/glossario-incantesimi.js",
  "./assets/js/pagine/guida.js",
  "./assets/js/pagine/i-miei-personaggi.js",
  "./assets/js/pagine/index.js",
  "./assets/js/pagine/libreria.js",
  "./assets/js/pagine/offline.js",
  "./assets/js/pagine/register.js",
  "./assets/js/pagine/scheda-personaggio.js",
  "./assets/js/pagine/sessione.js",
  "./assets/js/pagine/tavolo.js",
  "./assets/js/pagine/verifica-email.js",
  "./assets/js/pdf-scheda.js",
  "./assets/js/privilegi.js",
  "./assets/js/pwa.js",
  "./assets/js/riposo.js",
  "./assets/js/spotify-config.js",
  "./assets/js/spotify.js",
  "./assets/js/utils.js",
  "./assets/js/widget-musica.js",
  "./assets/js/youtube.js",
  "./assets/vendor/three-LICENSE.txt",
  "./assets/vendor/three.module.min.js",
  "./attesa-approvazione.html",
  "./bestiario.html",
  "./calendario.html",
  "./campagna.html",
  "./controllo-musica.html",
  "./crea-personaggio.html",
  "./dashboard.html",
  "./dm-party.html",
  "./glossario-equipaggiamento.html",
  "./glossario-incantesimi.html",
  "./guida.html",
  "./i-miei-personaggi.html",
  "./index.html",
  "./libreria.html",
  "./manifest.webmanifest",
  "./offline.html",
  "./register.html",
  "./scheda-personaggio.html",
  "./sessione.html",
  "./tavolo.html",
  "./verifica-email.html",
];
// === FINE ELENCO GENERATO ===

const CACHE = `sed-${VERSIONE}`;
const CACHE_SDK = "sed-sdk-firebase";
const PREFISSO_SDK = "https://www.gstatic.com/firebasejs/";
const PAGINA_OFFLINE = "./offline.html";

const indirizzo = (percorso) => new URL(percorso, self.registration.scope).href;

self.addEventListener("install", (evento) => {
  // cache: "reload" scavalca la cache HTTP: si scaricano davvero i file nuovi.
  evento.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILE.map((f) => new Request(f, { cache: "reload" }))))
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil((async () => {
    const nomi = await caches.keys();
    await Promise.all(nomi.filter((n) => n.startsWith("sed-") && n !== CACHE && n !== CACHE_SDK).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (evento) => {
  if (evento.data?.tipo === "attiva") self.skipWaiting();
});

async function paginaOffline() {
  return (await caches.match(indirizzo(PAGINA_OFFLINE), { cacheName: CACHE }))
    || new Response("Sei offline.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

async function navigazione(richiesta) {
  if (self.navigator.onLine === false) return paginaOffline();
  const url = new URL(richiesta.url);
  const percorso = url.pathname.endsWith("/") ? indirizzo("./index.html") : url.origin + url.pathname;
  const salvata = await caches.match(percorso, { cacheName: CACHE, ignoreSearch: true });
  if (salvata) return salvata;
  try {
    return await fetch(richiesta);
  } catch {
    return paginaOffline();
  }
}

// Librerie e font del PDF della scheda: pesanti e usati di rado, non sono
// in FILE e si salvano al primo uso (vedi SU_RICHIESTA in aggiorna-sw.mjs).
const SU_RICHIESTA = ["./assets/vendor/pdf/", "./assets/fonts/pdf/"].map(indirizzo);

async function file(richiesta) {
  const salvato = await caches.match(richiesta, { cacheName: CACHE });
  if (salvato) return salvato;
  const risposta = await fetch(richiesta);
  if (risposta.ok && SU_RICHIESTA.some((prefisso) => richiesta.url.startsWith(prefisso))) {
    const copia = risposta.clone();
    caches.open(CACHE).then((cache) => cache.put(richiesta, copia)).catch(() => {});
  }
  return risposta;
}

async function sdkFirebase(richiesta) {
  const cache = await caches.open(CACHE_SDK);
  const salvato = await cache.match(richiesta);
  if (salvato) return salvato;
  const risposta = await fetch(richiesta);
  if (risposta.ok || risposta.type === "opaque") cache.put(richiesta, risposta.clone());
  return risposta;
}

self.addEventListener("fetch", (evento) => {
  const richiesta = evento.request;
  if (richiesta.method !== "GET") return;
  if (richiesta.url.startsWith(PREFISSO_SDK)) {
    evento.respondWith(sdkFirebase(richiesta));
    return;
  }
  if (new URL(richiesta.url).origin !== self.location.origin) return;
  evento.respondWith(richiesta.mode === "navigate" ? navigazione(richiesta) : file(richiesta));
});

// ---------- Notifiche push ----------
// Messaggi di soli dati di Firebase Cloud Messaging: { data: { titolo, testo,
// url, tag } }. Ogni push mostra sempre una notifica (lo esigono i browser).

const ICONA_NOTIFICA = "./assets/icone/icona-192.png";
const BADGE_NOTIFICA = "./assets/icone/badge-96.png";

// Solo pagine di questo sito: qualunque altro indirizzo porta alla dashboard.
function paginaDaAprire(url) {
  try {
    const destinazione = new URL(url || "./dashboard.html", self.registration.scope);
    if (destinazione.href.startsWith(self.registration.scope)) return destinazione.href;
  } catch {
    // Indirizzo non valido.
  }
  return indirizzo("./dashboard.html");
}

self.addEventListener("push", (evento) => {
  let dati = {};
  try {
    const corpo = evento.data?.json() || {};
    dati = corpo.data || corpo.notification || {};
  } catch {
    dati = { testo: evento.data?.text() || "" };
  }
  const titolo = String(dati.titolo || dati.title || "Sotterranei & Dragoni").slice(0, 120);
  evento.waitUntil(self.registration.showNotification(titolo, {
    body: String(dati.testo || dati.body || "").slice(0, 300),
    icon: indirizzo(ICONA_NOTIFICA),
    badge: indirizzo(BADGE_NOTIFICA),
    lang: "it",
    ...(dati.tag ? { tag: String(dati.tag) } : {}),
    data: { url: paginaDaAprire(dati.url) },
  }));
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const url = paginaDaAprire(evento.notification.data?.url);
  evento.waitUntil((async () => {
    const finestre = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const stessa = finestre.find((f) => f.url === url);
    if (stessa) return stessa.focus();
    // Se l'app è già aperta la si porta in primo piano sulla pagina giusta.
    const aperta = finestre.find((f) => f.url.startsWith(self.registration.scope));
    if (aperta) {
      const portata = await aperta.focus().catch(() => aperta);
      if (portata.navigate) return portata.navigate(url).catch(() => self.clients.openWindow(url));
    }
    return self.clients.openWindow(url);
  })());
});
