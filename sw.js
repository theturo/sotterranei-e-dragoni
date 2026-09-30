// Service worker dell'app installabile (PWA).
// - Salva sul telefono pagine, stili, script e icone di questa versione del
//   sito (FILE, sotto) e li serve da lì: l'app si apre subito e resta
//   coerente, perché tutti i file appartengono alla stessa versione.
// - Senza rete le pagine mostrano offline.html (i dati stanno su Firebase).
// - Una versione nuova si installa in silenzio e resta in attesa: la pagina
//   mostra "È disponibile una nuova versione" e, con "Aggiorna", manda il
//   messaggio "attiva" (vedi assets/js/pwa.js). Altrimenti si attiva alla
//   prossima apertura dell'app.
// - Le richieste a Firebase e agli altri servizi esterni non passano di qui,
//   tranne gli script dell'SDK di Firebase (indirizzi con la versione, che
//   non cambiano mai: si salvano alla prima richiesta).
// L'elenco e la VERSIONE si rigenerano con: node strumenti/aggiorna-sw.mjs

// === ELENCO GENERATO: node strumenti/aggiorna-sw.mjs ===
const VERSIONE = "18ff4d1b17ec";
const FILE = [
  "./admin-utenti.html",
  "./archivio.html",
  "./assets/css/style.css",
  "./assets/icone/apple-touch-icon.png",
  "./assets/icone/favicon-32.png",
  "./assets/icone/favicon.svg",
  "./assets/icone/icona-192.png",
  "./assets/icone/icona-512.png",
  "./assets/icone/icona-maskable-512.png",
  "./assets/js/auth.js",
  "./assets/js/calendario.js",
  "./assets/js/combattimento.js",
  "./assets/js/condizioni.js",
  "./assets/js/contenuti.js",
  "./assets/js/dadi.js",
  "./assets/js/dati-srd.js",
  "./assets/js/descrizioni.js",
  "./assets/js/equipaggiamento-srd.js",
  "./assets/js/firebase-config.js",
  "./assets/js/icone.js",
  "./assets/js/immagini.js",
  "./assets/js/incantesimi-srd.js",
  "./assets/js/menu-utente.js",
  "./assets/js/pagine/admin-utenti.js",
  "./assets/js/pagine/archivio.js",
  "./assets/js/pagine/attesa-approvazione.js",
  "./assets/js/pagine/calendario.js",
  "./assets/js/pagine/campagna.js",
  "./assets/js/pagine/controllo-musica.js",
  "./assets/js/pagine/crea-personaggio.js",
  "./assets/js/pagine/dashboard.js",
  "./assets/js/pagine/dm-party.js",
  "./assets/js/pagine/glossario-equipaggiamento.js",
  "./assets/js/pagine/glossario-incantesimi.js",
  "./assets/js/pagine/i-miei-personaggi.js",
  "./assets/js/pagine/index.js",
  "./assets/js/pagine/libreria.js",
  "./assets/js/pagine/offline.js",
  "./assets/js/pagine/register.js",
  "./assets/js/pagine/scheda-personaggio.js",
  "./assets/js/pagine/sessione.js",
  "./assets/js/pagine/verifica-email.js",
  "./assets/js/privilegi.js",
  "./assets/js/pwa.js",
  "./assets/js/riposo.js",
  "./assets/js/spotify-config.js",
  "./assets/js/spotify.js",
  "./assets/js/utils.js",
  "./assets/js/widget-musica.js",
  "./assets/js/youtube.js",
  "./attesa-approvazione.html",
  "./calendario.html",
  "./campagna.html",
  "./controllo-musica.html",
  "./crea-personaggio.html",
  "./dashboard.html",
  "./dm-party.html",
  "./glossario-equipaggiamento.html",
  "./glossario-incantesimi.html",
  "./i-miei-personaggi.html",
  "./index.html",
  "./libreria.html",
  "./manifest.webmanifest",
  "./offline.html",
  "./register.html",
  "./scheda-personaggio.html",
  "./sessione.html",
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

async function file(richiesta) {
  const salvato = await caches.match(richiesta, { cacheName: CACHE });
  return salvato || fetch(richiesta);
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
