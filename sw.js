// Service worker dell'app installabile (PWA).
// - Salva sul telefono pagine, stili, script e icone di questa versione del
//   sito (FILE, sotto) e li serve da lì: l'app si apre subito e resta
//   coerente, perché tutti i file appartengono alla stessa versione.
// - Ogni file ha la sua impronta: a una versione nuova si riscaricano solo
//   i file cambiati, gli altri si copiano dalla versione precedente.
// - Senza rete le pagine mostrano offline.html (i dati stanno su Firebase).
// - VERSIONE e DATA_VERSIONE si leggono dalle Impostazioni (messaggio
//   "versione"), che mostrano «V. 09.10.2026 · codice» e «Cerca aggiornamenti».
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
const VERSIONE = "987e7a36693e";
const DATA_VERSIONE = "2026-11-11";
const FILE = {
  "./admin-utenti.html": "67eb21be5117",
  "./archivio.html": "05a524f56a2e",
  "./assets/css/base.css": "d3b056bb8816",
  "./assets/css/calendario.css": "b7f8d6336144",
  "./assets/css/dashboard.css": "eb68da7900fc",
  "./assets/css/dm.css": "ac39fd0be665",
  "./assets/css/gioco.css": "f4355402f5f2",
  "./assets/css/guida.css": "b6e84121ae34",
  "./assets/css/scheda.css": "8cba156ce1df",
  "./assets/css/sessione.css": "0edb39bef843",
  "./assets/fonts/pdf/LICENZE-OFL.txt": "63f277618d1c",
  "./assets/fonts/pdf/cinzel-700.woff": "83ea41e439a2",
  "./assets/fonts/pdf/eb-garamond-400-italic.woff": "ee21466cc9fc",
  "./assets/fonts/pdf/eb-garamond-400.woff": "4667d9135a65",
  "./assets/fonts/pdf/eb-garamond-600.woff": "f13dee5df7bc",
  "./assets/icone/apple-touch-icon.png": "066f474a771b",
  "./assets/icone/badge-96.png": "a5810617d2c8",
  "./assets/icone/favicon-16.png": "aad1f286b1d7",
  "./assets/icone/favicon-32.png": "8fa040c47c34",
  "./assets/icone/icona-192.png": "7b46b2824be3",
  "./assets/icone/icona-512.png": "6ed4a2fc6073",
  "./assets/icone/icona-maskable-192.png": "7263556ba0fd",
  "./assets/icone/icona-maskable-512.png": "e42dc09f2cda",
  "./assets/img/guida/combattimento.jpg": "bf2d47844299",
  "./assets/img/guida/mappa.jpg": "b2fe3c7f748d",
  "./assets/img/guida/personaggio.jpg": "9c82704408fc",
  "./assets/img/guida/primi-passi.jpg": "d77aa6f0aec8",
  "./assets/img/guida/sessione.jpg": "8a78742a488d",
  "./assets/img/intro/ala_1.webp": "e2c98654c4e3",
  "./assets/img/intro/ala_2.webp": "5dc61a06ec9b",
  "./assets/img/intro/ala_3.webp": "90a6077331a1",
  "./assets/img/intro/ala_4.webp": "7aa53d177a29",
  "./assets/img/intro/ala_5.webp": "9229ba362bf7",
  "./assets/img/intro/ala_6.webp": "0164af342a0e",
  "./assets/img/intro/bianco_finale.webp": "c38065926c60",
  "./assets/img/intro/coda.webp": "c9d1fb79a5a4",
  "./assets/img/intro/corpo.webp": "06820640cc79",
  "./assets/img/intro/d20.webp": "a1aed93739b2",
  "./assets/img/intro/esplosione_spirale.webp": "17e7027855cf",
  "./assets/img/intro/logo_emblema.webp": "f05080757d17",
  "./assets/img/intro/logo_titolo.webp": "c676648e6e19",
  "./assets/img/intro/pennellate.webp": "c76fc016bf22",
  "./assets/img/intro/schegge.webp": "e1ce1791a196",
  "./assets/img/intro/testa_aperta.webp": "2a87d300af14",
  "./assets/img/intro/testa_chiusa.webp": "9aba18650980",
  "./assets/img/intro/testa_tre_quarti.webp": "4f9afdc052e2",
  "./assets/img/intro/vortice_quadrato.webp": "65cf19334bca",
  "./assets/img/intro/zampa_ant.webp": "714536bee26f",
  "./assets/img/intro/zampa_post.webp": "df342e05cbb7",
  "./assets/img/sfondi/dashboard-telefono.webp": "40ede2b8e636",
  "./assets/img/sfondi/dashboard.webp": "a4b37917dbfc",
  "./assets/js/aree-incantesimi.js": "1ff9cb09620d",
  "./assets/js/auth.js": "f54e89ea6ce2",
  "./assets/js/bestiario-calcoli.js": "3110364e2ddd",
  "./assets/js/bestiario-finestra.js": "0ce17e9fccfb",
  "./assets/js/bestiario-scheda.js": "9a1f509ff4c4",
  "./assets/js/calcoli-scheda.js": "660e3a9ce65d",
  "./assets/js/calendario.js": "e6cf8e5bd2ed",
  "./assets/js/combattimento.js": "f564f5c8bc4f",
  "./assets/js/comparsa-contenuti.js": "386de312d62b",
  "./assets/js/condizioni.js": "7798031d4694",
  "./assets/js/contenuti.js": "bc0640a2e0f3",
  "./assets/js/cruscotto-calcoli.js": "00e2a2c6b5fe",
  "./assets/js/dadi-base.js": "13e3dc7d507b",
  "./assets/js/dadi.js": "b9e1dfb187b4",
  "./assets/js/dado-caricamento.js": "223a69f9bc5e",
  "./assets/js/dado-pf.js": "8e31050df550",
  "./assets/js/dati-srd.js": "2ca98999c43e",
  "./assets/js/dati/bestiario.js": "da85ce1ef009",
  "./assets/js/dati/calendario.js": "4ee54ec1e983",
  "./assets/js/dati/campagne.js": "dd9d2897281c",
  "./assets/js/dati/combattimento.js": "1f374f7107b8",
  "./assets/js/dati/comuni.js": "a9d88c523a5a",
  "./assets/js/dati/libreria.js": "6178c7c61e22",
  "./assets/js/dati/livelli.js": "03caddf55208",
  "./assets/js/dati/mappa.js": "631ce999906b",
  "./assets/js/dati/musica.js": "2e7248a4e025",
  "./assets/js/dati/party.js": "f9d4dca97659",
  "./assets/js/dati/schede.js": "a0545974417e",
  "./assets/js/dati/sessioni.js": "4cd8c9e9633b",
  "./assets/js/dati/utenti.js": "cef6301d4201",
  "./assets/js/descrizioni.js": "ebc456fbe5a1",
  "./assets/js/effetti-dadi.js": "55e4c071b95a",
  "./assets/js/equipaggiamento-srd.js": "f76aa365ff02",
  "./assets/js/esporta-scheda.js": "426e98cb61b2",
  "./assets/js/firebase-config.js": "a02623ecb818",
  "./assets/js/fisica-dadi.js": "2c1ccfb28d75",
  "./assets/js/geometria-3d.js": "cf8ca801bd2e",
  "./assets/js/guida-personaggio-dati.js": "c0ef4c32227a",
  "./assets/js/guida-personaggio.js": "d4ebca6b833e",
  "./assets/js/guscio.js": "75ce20308cba",
  "./assets/js/icone.js": "3940048bc896",
  "./assets/js/immagini.js": "c3c6402b078b",
  "./assets/js/incantesimi-srd.js": "eff4eb2dd6b5",
  "./assets/js/inquadratura.js": "4709e9b0e138",
  "./assets/js/intro-dado.js": "4363a290dceb",
  "./assets/js/intro-motore.js": "92d67b259fa6",
  "./assets/js/intro-pezzi.js": "a23b0a47a5ea",
  "./assets/js/intro-scena.js": "8348df513f83",
  "./assets/js/intro-vortice.js": "6f40a7137c42",
  "./assets/js/intro-worker.js": "e15a108f093e",
  "./assets/js/intro.js": "6f29a35f7961",
  "./assets/js/mappa-calcoli.js": "bbb1481c0a4a",
  "./assets/js/mappa-pedine.js": "0680c86d6cc2",
  "./assets/js/mappa-strumenti.js": "4334765dc777",
  "./assets/js/mappa-vista.js": "8c0cce095302",
  "./assets/js/mappa.js": "ec14017c5d2f",
  "./assets/js/menu-utente.js": "ff8766faf855",
  "./assets/js/mostri-srd.js": "ddbfb68e0be4",
  "./assets/js/movimento.js": "6ba031356c7c",
  "./assets/js/musica-stato.js": "d35aa49ed95e",
  "./assets/js/notifiche-push.js": "eefd4466c27c",
  "./assets/js/pagine/admin-utenti.js": "ccc5c591c6d4",
  "./assets/js/pagine/archivio.js": "43defa5d0800",
  "./assets/js/pagine/attesa-approvazione.js": "1f9b02510e75",
  "./assets/js/pagine/bestiario.js": "2e46459da3fa",
  "./assets/js/pagine/calendario.js": "cf25072d09d2",
  "./assets/js/pagine/campagna.js": "bded17816a7d",
  "./assets/js/pagine/controllo-musica.js": "27e2cf131694",
  "./assets/js/pagine/crea-personaggio.js": "ef1d76e44880",
  "./assets/js/pagine/dashboard.js": "487902db4801",
  "./assets/js/pagine/dm-party.js": "d152d223e15f",
  "./assets/js/pagine/glossario-equipaggiamento.js": "3d86e5884421",
  "./assets/js/pagine/glossario-incantesimi.js": "e0de0a19b315",
  "./assets/js/pagine/guida.js": "22bb44e45960",
  "./assets/js/pagine/i-miei-personaggi.js": "b76ba37aadca",
  "./assets/js/pagine/index.js": "9dd83a8c7936",
  "./assets/js/pagine/libreria.js": "dfa3e65f6946",
  "./assets/js/pagine/offline.js": "66f6add61755",
  "./assets/js/pagine/register.js": "d351cfe15864",
  "./assets/js/pagine/scheda-personaggio.js": "4f30a2b887d1",
  "./assets/js/pagine/sessione.js": "2bbbe9e100d1",
  "./assets/js/pagine/tavolo.js": "f38a46e915a7",
  "./assets/js/pagine/verifica-email.js": "9160b11d3edd",
  "./assets/js/pdf-scheda.js": "ab909d461890",
  "./assets/js/poliedri.js": "dca205bc25fe",
  "./assets/js/privilegi.js": "2637166c19f2",
  "./assets/js/pwa.js": "c62e478304f9",
  "./assets/js/riposo.js": "d633ca3f1737",
  "./assets/js/ritaglio.js": "047db73fdef2",
  "./assets/js/scena-dadi.js": "300077db83f6",
  "./assets/js/scheda-rapida.js": "e7462585c3b8",
  "./assets/js/spotify-config.js": "2cd119a39d39",
  "./assets/js/spotify.js": "608a6de358de",
  "./assets/js/suoni.js": "c89c1d1ef463",
  "./assets/js/turno-animato.js": "d2822bb9a2d0",
  "./assets/js/utils.js": "bfba4f8d663e",
  "./assets/js/vaschetta-scelte.js": "3743a40bc6dc",
  "./assets/js/vaschetta.js": "aafcf69a85d6",
  "./assets/js/versione.js": "10e8c49db420",
  "./assets/js/widget-musica.js": "c2be39beebf8",
  "./assets/js/youtube.js": "31a2b419c9ed",
  "./assets/vendor/pdf/LICENZE.txt": "ea9f284440c0",
  "./assets/vendor/pdf/pdf-lib-fontkit.min.js": "2a73af96da27",
  "./attesa-approvazione.html": "46dd7ac6fe50",
  "./bestiario.html": "8efe3810076f",
  "./calendario.html": "bc3da68af6db",
  "./campagna.html": "9e9d9bcf07ea",
  "./controllo-musica.html": "9a9b127571b5",
  "./crea-personaggio.html": "99e8cff41a70",
  "./dashboard.html": "0bac3f515607",
  "./dm-party.html": "33d96d8249dc",
  "./glossario-equipaggiamento.html": "59833926643c",
  "./glossario-incantesimi.html": "59bdd21f0800",
  "./guida.html": "ef612aedbc11",
  "./i-miei-personaggi.html": "ca77fad6d8a1",
  "./index.html": "2b1fb4fe0247",
  "./libreria.html": "b4b5d7089672",
  "./manifest.webmanifest": "879337aa9851",
  "./offline.html": "db6483bdcfa1",
  "./register.html": "03a7cf2e4704",
  "./scheda-personaggio.html": "cdc3e12b5ce6",
  "./sessione.html": "19953a2f9d86",
  "./tavolo.html": "24b0ce5bc660",
  "./verifica-email.html": "374faa034a5b",
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

// "attiva": la versione in attesa prende il controllo (pulsante «Aggiorna»).
// "versione": risponde con codice e data, mostrati nelle Impostazioni.
self.addEventListener("message", (evento) => {
  if (evento.data?.tipo === "attiva") self.skipWaiting();
  if (evento.data?.tipo === "versione") evento.ports[0]?.postMessage({ versione: VERSIONE, data: DATA_VERSIONE });
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
