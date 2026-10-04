// Service worker dell'app installabile (PWA).
// - Salva sul telefono pagine, stili, script e icone di questa versione del
//   sito (FILE, sotto) e li serve da lì: l'app si apre subito e resta
//   coerente, perché tutti i file appartengono alla stessa versione.
// - Ogni file ha la sua impronta: a una versione nuova si riscaricano solo
//   i file cambiati, gli altri si copiano dalla versione precedente.
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
const VERSIONE = "fde1da4f8960";
const FILE = {
  "./admin-utenti.html": "c3dce814aae5",
  "./archivio.html": "57c375711752",
  "./assets/css/style.css": "9c5a876df5ae",
  "./assets/fonts/cinzel-700.woff2": "8efa224fe70f",
  "./assets/fonts/cinzel-OFL.txt": "f5a242cf68ad",
  "./assets/fonts/pdf/LICENZE-OFL.txt": "63f277618d1c",
  "./assets/fonts/pdf/cinzel-700.woff": "83ea41e439a2",
  "./assets/fonts/pdf/eb-garamond-400-italic.woff": "ee21466cc9fc",
  "./assets/fonts/pdf/eb-garamond-400.woff": "4667d9135a65",
  "./assets/fonts/pdf/eb-garamond-600.woff": "f13dee5df7bc",
  "./assets/icone/apple-touch-icon.png": "9bab2bfdad2b",
  "./assets/icone/badge-96.png": "a5810617d2c8",
  "./assets/icone/favicon-32.png": "81bfc5f90bb6",
  "./assets/icone/favicon.svg": "97973c21e3af",
  "./assets/icone/icona-192.png": "0a7fd460b893",
  "./assets/icone/icona-512.png": "8746630aaa13",
  "./assets/icone/icona-maskable-512.png": "25a81e1c86b0",
  "./assets/img/guida/combattimento.jpg": "bf2d47844299",
  "./assets/img/guida/mappa.jpg": "b2fe3c7f748d",
  "./assets/img/guida/personaggio.jpg": "9c82704408fc",
  "./assets/img/guida/primi-passi.jpg": "d77aa6f0aec8",
  "./assets/img/guida/sessione.jpg": "8a78742a488d",
  "./assets/js/aree-incantesimi.js": "1ff9cb09620d",
  "./assets/js/auth.js": "af345e349d87",
  "./assets/js/bestiario-calcoli.js": "3110364e2ddd",
  "./assets/js/bestiario-finestra.js": "983e79dcb7bc",
  "./assets/js/bestiario-scheda.js": "9a1f509ff4c4",
  "./assets/js/calcoli-scheda.js": "660e3a9ce65d",
  "./assets/js/calendario.js": "e6cf8e5bd2ed",
  "./assets/js/combattimento.js": "1f254952e47e",
  "./assets/js/condizioni.js": "7798031d4694",
  "./assets/js/contenuti.js": "bc0640a2e0f3",
  "./assets/js/cruscotto-calcoli.js": "610babaca0d6",
  "./assets/js/dadi-base.js": "d1ee4ec14672",
  "./assets/js/dadi.js": "d20e65c43d60",
  "./assets/js/dado-caricamento.js": "7e138df9f108",
  "./assets/js/dado-pf.js": "e1413301e1e1",
  "./assets/js/dati-srd.js": "2ca98999c43e",
  "./assets/js/descrizioni.js": "ebc456fbe5a1",
  "./assets/js/equipaggiamento-srd.js": "f76aa365ff02",
  "./assets/js/esporta-scheda.js": "426e98cb61b2",
  "./assets/js/firebase-config.js": "a02623ecb818",
  "./assets/js/geometria-3d.js": "c44409e8b331",
  "./assets/js/guida-personaggio-dati.js": "c0ef4c32227a",
  "./assets/js/guida-personaggio.js": "9aa3cb0a738c",
  "./assets/js/icone.js": "3940048bc896",
  "./assets/js/immagini.js": "ff9a3dd7757a",
  "./assets/js/incantesimi-srd.js": "eff4eb2dd6b5",
  "./assets/js/intro-dado.js": "4363a290dceb",
  "./assets/js/intro.js": "c22faa6d2de2",
  "./assets/js/mappa-calcoli.js": "bbb1481c0a4a",
  "./assets/js/mappa-pedine.js": "4acd888fab54",
  "./assets/js/mappa-strumenti.js": "a9364c7db074",
  "./assets/js/mappa-vista.js": "7312b06793fd",
  "./assets/js/mappa.js": "24a6fb7022d7",
  "./assets/js/menu-utente.js": "380821c25e72",
  "./assets/js/mostri-srd.js": "ddbfb68e0be4",
  "./assets/js/notifiche-push.js": "eefd4466c27c",
  "./assets/js/pagine/admin-utenti.js": "a15ee345eec3",
  "./assets/js/pagine/archivio.js": "cd787e4dbb38",
  "./assets/js/pagine/attesa-approvazione.js": "6243ff3a9e8b",
  "./assets/js/pagine/bestiario.js": "cda788b57ea5",
  "./assets/js/pagine/calendario.js": "d3397d661c42",
  "./assets/js/pagine/campagna.js": "26e06c80500f",
  "./assets/js/pagine/controllo-musica.js": "ea148e578539",
  "./assets/js/pagine/crea-personaggio.js": "3b1ec1f4ad78",
  "./assets/js/pagine/dashboard.js": "15088ef87f59",
  "./assets/js/pagine/dm-party.js": "3b54242e743d",
  "./assets/js/pagine/glossario-equipaggiamento.js": "017f9c070127",
  "./assets/js/pagine/glossario-incantesimi.js": "e93b517f737b",
  "./assets/js/pagine/guida.js": "f22cfb6c9854",
  "./assets/js/pagine/i-miei-personaggi.js": "e94f4fee17a4",
  "./assets/js/pagine/index.js": "c6be58e471e8",
  "./assets/js/pagine/libreria.js": "b279730ee4aa",
  "./assets/js/pagine/offline.js": "66f6add61755",
  "./assets/js/pagine/register.js": "d351cfe15864",
  "./assets/js/pagine/scheda-personaggio.js": "0e3e325e4b12",
  "./assets/js/pagine/sessione.js": "a278e4cc24b8",
  "./assets/js/pagine/tavolo.js": "55439a589e74",
  "./assets/js/pagine/verifica-email.js": "0a9537d7b5e9",
  "./assets/js/pdf-scheda.js": "ab909d461890",
  "./assets/js/privilegi.js": "b1564bd3089a",
  "./assets/js/pwa.js": "3b17ae011d28",
  "./assets/js/riposo.js": "0c092c556e9e",
  "./assets/js/scheda-rapida.js": "417ab758cf14",
  "./assets/js/spotify-config.js": "2cd119a39d39",
  "./assets/js/spotify.js": "608a6de358de",
  "./assets/js/utils.js": "bfba4f8d663e",
  "./assets/js/widget-musica.js": "8553a1a89d9f",
  "./assets/js/youtube.js": "31a2b419c9ed",
  "./assets/vendor/pdf/LICENZE.txt": "ea9f284440c0",
  "./assets/vendor/pdf/pdf-lib-fontkit.min.js": "2a73af96da27",
  "./assets/vendor/three-LICENSE.txt": "852e0e869916",
  "./assets/vendor/three.module.min.js": "19b09d1f0a1d",
  "./attesa-approvazione.html": "c37e89bbfb4e",
  "./bestiario.html": "5d1c61e17985",
  "./calendario.html": "6d5e78baaac9",
  "./campagna.html": "1f6eebbe47e7",
  "./controllo-musica.html": "43ce986e48dc",
  "./crea-personaggio.html": "fe531a622993",
  "./dashboard.html": "5b637f84f3d8",
  "./dm-party.html": "c5c7bc57e7cf",
  "./glossario-equipaggiamento.html": "8b9598f3f899",
  "./glossario-incantesimi.html": "38559991c12f",
  "./guida.html": "9053ecb22ee0",
  "./i-miei-personaggi.html": "eeb83867157b",
  "./index.html": "141d610370d6",
  "./libreria.html": "675fb83975a2",
  "./manifest.webmanifest": "e0b6ccda87a2",
  "./offline.html": "58e922ae6b9c",
  "./register.html": "944e4beb9a6c",
  "./scheda-personaggio.html": "863e2f22a44e",
  "./sessione.html": "bee86a002456",
  "./tavolo.html": "8ebc64dcc6f4",
  "./verifica-email.html": "8d4bb0392b3f",
};
// === FINE ELENCO GENERATO ===

const CACHE = `sed-${VERSIONE}`;
const CACHE_SDK = "sed-sdk-firebase";
const PREFISSO_SDK = "https://www.gstatic.com/firebasejs/";
const PAGINA_OFFLINE = "./offline.html";

const indirizzo = (percorso) => new URL(percorso, self.registration.scope).href;

// File pesanti usati di rado: non si scaricano all'installazione ma al primo
// uso (vedi SU_RICHIESTA in aggiorna-sw.mjs): librerie e font del PDF della
// scheda, mostri del SRD (solo per il DM).
const SU_RICHIESTA = ["./assets/vendor/pdf/", "./assets/fonts/pdf/", "./assets/js/mostri-srd.js"];
const suRichiesta = (f) => SU_RICHIESTA.some((prefisso) => f.startsWith(prefisso));
const SU_RICHIESTA_URL = SU_RICHIESTA.map(indirizzo);

// Le impronte della versione salvata, dentro la sua stessa cache.
const IMPRONTE = indirizzo("./impronte-sw.json");

// Copie salvate dalle versioni precedenti: [{ cache, impronte }].
async function versioniPrecedenti() {
  const nomi = (await caches.keys()).filter((n) => n.startsWith("sed-") && n !== CACHE && n !== CACHE_SDK);
  const elenco = await Promise.all(nomi.map(async (nome) => {
    const cache = await caches.open(nome);
    const impronte = await cache.match(IMPRONTE).then((r) => r?.json()).catch(() => null);
    return impronte ? { cache, impronte } : null;
  }));
  return elenco.filter(Boolean);
}

self.addEventListener("install", (evento) => {
  evento.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const precedenti = await versioniPrecedenti();
    try {
      await Promise.all(Object.entries(FILE).map(async ([f, impronta]) => {
        const url = indirizzo(f);
        // Stesso contenuto di una versione già sul telefono: si copia.
        for (const { cache: vecchia, impronte } of precedenti) {
          if (impronte[f] !== impronta) continue;
          const copia = await vecchia.match(url);
          if (copia) return cache.put(url, copia);
        }
        if (suRichiesta(f)) return;
        // cache: "reload" scavalca la cache HTTP: si scarica davvero il file nuovo.
        const risposta = await fetch(new Request(url, { cache: "reload" }));
        if (!risposta.ok) throw new Error(`${f}: ${risposta.status}`);
        await cache.put(url, risposta);
      }));
      await cache.put(IMPRONTE, new Response(JSON.stringify(FILE), { headers: { "Content-Type": "application/json" } }));
    } catch (errore) {
      // Installazione a metà: si riprova da capo la prossima volta.
      await caches.delete(CACHE);
      throw errore;
    }
  })());
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
  if (salvato) return salvato;
  const risposta = await fetch(richiesta);
  if (risposta.ok && SU_RICHIESTA_URL.some((prefisso) => richiesta.url.startsWith(prefisso))) {
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
  evento.waitUntil((async () => {
    // "Tocca a te": se la Sessione è già aperta davanti, basta il riquadro nella pagina.
    if (dati.nascondiSe) {
      const finestre = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const pagina = paginaDaAprire(dati.nascondiSe);
      if (finestre.some((f) => f.url.split("#")[0] === pagina && f.visibilityState === "visible")) return;
    }
    await self.registration.showNotification(titolo, {
    body: String(dati.testo || dati.body || "").slice(0, 300),
    icon: indirizzo(ICONA_NOTIFICA),
    badge: indirizzo(BADGE_NOTIFICA),
    lang: "it",
    ...(dati.tag ? { tag: String(dati.tag) } : {}),
    data: { url: paginaDaAprire(dati.url) },
    });
  })());
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
