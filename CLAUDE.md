# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Progetto

Sotterranei & Dragoni: sito/PWA per una campagna di D&D 5e tra amici (giocatori, DM,
admin). Sito statico su GitHub Pages + Firebase (Auth, Firestore, Storage, Cloud
Functions). HTML/CSS/JS puro, **nessun build step**, nessun bundler.

Tutto è in italiano: interfaccia, nomi di variabili e funzioni, commenti, commit e PR.
Si risponde all'utente in italiano. Il codice segue lo stile esistente: commenti che
spiegano il perché, nomi italiani (`elencaSessioniCampagna`, `ritaglioValido`…).

## Comandi

```sh
# Controlli statici delle pagine + test delle logiche pure (solo Node, ~1 s)
node --test "test/pagine/*.test.mjs"
node --test test/pagine/ritaglio.test.mjs          # un solo file

# Test delle regole Firestore e Storage (emulatori, serve Java 11+)
cd test/regole && npm ci && npm test
# un solo file: npx firebase emulators:exec --only firestore,storage --project demo-sotterranei \
#   --config ../../firebase.json "node --test --test-concurrency=1 regole.test.mjs"
# Nelle sessioni cloud con proxy, l'emulatore va lanciato senza le variabili del proxy:
#   env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u JAVA_TOOL_OPTIONS npm test

# Logica delle Cloud Functions
cd functions && npm ci && npm test

# Dopo OGNI modifica a pagine, CSS, JS, immagini (anche file eliminati o rinominati):
node strumenti/aggiorna-sw.mjs
```

CI (`.github/workflows/test.yml`) esegue le tre suite su ogni PR e su `main`.

## Regole che contano

- **`sw.js` va rigenerato** con `node strumenti/aggiorna-sw.mjs` e committato insieme
  alle modifiche: contiene l'elenco dei file con impronta SHA-256, `VERSIONE` e
  `DATA_VERSIONE` (mostrata in Impostazioni come «V. gg.mm.aaaa · codice»). I giocatori
  usano l'app installata: senza rigenerazione non ricevono l'aggiornamento.
  `test/pagine/pwa.test.mjs` fallisce se ci si dimentica. Mai modificare a mano la parte
  tra i marcatori `ELENCO GENERATO`.
- **Content Security Policy**: ogni pagina `.html` ha lo stesso `<meta http-equiv="Content-Security-Policy">`
  (verificato da `test/pagine/pagine.test.mjs`). Niente `<script>` inline né `onclick=`:
  il codice di `foo.html` sta in `assets/js/pagine/foo.js`. Un nuovo dominio esterno va
  aggiunto alla CSP di **tutte** le pagine.
- **La sicurezza vive in `firestore.rules` e `storage.rules`**: la config Firebase è
  pubblica e i controlli nelle pagine sono solo UI. Ogni modifica alle regole va coperta
  in `test/regole/` e, dopo il merge, pubblicata dall'utente da Cloud Shell
  (`docs/cloud-shell.md`). Lo stesso vale per `functions/`. Segnalarlo sempre nella PR.
- I dati della campagna reale sono in produzione: non cambiare forma a campi,
  collezioni o percorsi di Firestore/Storage senza una migrazione concordata.

## Architettura

- **Pagine**: `*.html` nella radice, ognuna con il suo modulo in `assets/js/pagine/`.
  Le pagine protette chiamano `proteggiPagina` (`assets/js/auth.js`).
- **Accesso ai dati**: `assets/js/dati/*.js` (uno per area: `campagne`, `sessioni`,
  `schede`, `party`, `combattimento`, `libreria`, `mappa`, `bestiario`…) è l'unico strato
  che parla con Firestore/Storage. Le pagine non chiamano l'SDK direttamente.
- **Firebase SDK** importato da URL `https://www.gstatic.com/firebasejs/10.13.2/…`
  (`assets/js/firebase-config.js`): i moduli che lo importano non girano in Node. Per
  questo la logica testabile sta in **moduli puri senza import di Firebase**
  (`calcoli-scheda.js`, `privilegi.js`, `ritaglio.js`, `cruscotto-calcoli.js`,
  `bestiario-calcoli.js`, `mappa-calcoli.js`, `versione.js`, `musica-stato.js`…), testati
  in `test/pagine/`. Nuova logica non banale → modulo puro + test lì.
- **Ruoli a due livelli**:
  - ruolo sul sito: `users/{uid}.ruolo` ∈ `admin` / `dm` / `player`, più `approvato`
    (i nuovi iscritti attendono l'approvazione dell'admin);
  - ruolo nella campagna: `campagne/{id}.dmUid` e `membriUid`. Ciò che si vede dipende
    da questo (`campagna.mioRuolo` da `ottieniCampagnaCorrente`): un admin o un DM che
    gioca nella campagna di un altro è un giocatore. Nelle regole: `isDMdellaCampagna`,
    `isNellaCampagna`.
- **Dati per campagna**: quasi tutto sta sotto `campagne/{id}/…` (stato sessione,
  combattimento, libreria `immagini` / `immaginiDM`, proposte del calendario, mappa…).
  Eccezioni top-level: `users/{uid}` (profilo, `notifiche`), `registroSessioni/{id}`
  (con `campagnaId`, sottocollezioni `appunti` e `tiriNascosti`), `richiesteEliminazione`.
  Le query su collezioni top-level devono filtrare per `campagnaId`, altrimenti le
  regole le rifiutano. Il commento in testa a `firestore.rules` descrive tutte le
  collezioni.
- **Cloud Functions** (`functions/index.js`, logica pura in `functions/logica.js`):
  email al nuovo iscritto, notifiche push dalle `notifiche`, eliminazione utente,
  blocco spese oltre soglia. Configurazione in `docs/funzioni.md`.
- **PWA**: `sw.js` (cache per impronta, file pesanti `SU_RICHIESTA`), `assets/js/pwa.js`
  (registrazione, controllo aggiornamenti, banner «nuova versione»).
- **CSS**: `assets/css/base.css` (comune) + fogli per area (`scheda`, `sessione`,
  `gioco`, `dm`, …). Le pagine caricano più fogli: l'ordine conta.
- **Librerie incluse**: Three.js in `assets/vendor/` (intro 3D), font in `assets/fonts/`.
  Niente npm per il sito.

## Documenti

- `docs/da-fare.md`: lavori concordati e storico «Già fatto» (aggiornarlo quando si
  chiude un punto).
- `docs/cloud-shell.md`: comandi di deploy di regole e funzioni per l'utente.
- `docs/sicurezza-e-costi.md`, `docs/funzioni.md`: configurazione del progetto Firebase.

## Modo di lavorare con l'utente

- Una PR per argomento; il merge si fa solo con il via libera esplicito dell'utente.
  Il sito si pubblica da solo dopo il merge su `main`; regole e funzioni no.
- Nuova interfaccia: domande di design → bozza sulla tela di design → codice.
- La pulizia del codice la fa un agente parallelo su rami `claude/pulizia-…`, un lotto
  piccolo per PR; i lotti e il loro stato sono tracciati in un registro condiviso (il
  link lo fornisce l'utente) e la sessione principale li verifica prima del merge.
