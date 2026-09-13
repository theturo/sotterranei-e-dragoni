# Sotterranei e Dragoni

Portale interattivo per la campagna D&D del gruppo: login/registrazione, schede personaggio, controllo musica lato Dungeon Master e (in futuro) mappe/pedine/nebbia di guerra.

Sito statico pensato per **GitHub Pages**, con **Firebase** come backend per autenticazione e dati condivisi (nessun dominio personalizzato).

## Stato attuale

Implementato:
- Registrazione, login, logout, dashboard con pannelli diversi in base al ruolo (`admin` / `dm` / `player`).
- Pannello admin di gestione utenti: elenco utenti, cambio ruolo, invio email di reset password (`admin-utenti.html`).
- Pannello DM "Party e livelli": roster dei giocatori e trigger "segnala livello su" (`dm-party.html`). Il DM vede solo i giocatori, in sola lettura sulle schede (non ancora esistenti) e non gestisce account/password.
- Notifica di salita di livello: popup al giocatore al login successivo alla segnalazione del DM (la spesa dei punti guadagnati sarà gestita dalla futura scheda personaggio).

Non ancora implementato: scheda personaggio, controllo musica, mappe.

## 1. Crea il tuo progetto Firebase (gratuito)

1. Vai su [console.firebase.google.com](https://console.firebase.google.com) e crea un nuovo progetto (es. "sotterranei-e-dragoni").
2. Nel progetto, vai su **Build > Authentication > Sign-in method** e abilita il provider **Email/Password**.
3. Vai su **Build > Firestore Database** e crea un database (modalità produzione va bene, sistemiamo le regole al punto 3).
4. Vai su **Impostazioni progetto** (icona ingranaggio) > scorri fino a "Le tue app" > clicca sull'icona **Web** (`</>`) per registrare una nuova web app (non serve Hosting, solo la registrazione).
5. Copia i valori di configurazione mostrati (`apiKey`, `authDomain`, `projectId`, ecc.) e incollali in [`assets/js/firebase-config.js`](assets/js/firebase-config.js), sostituendo i placeholder `INSERISCI_...`.
6. Nello stesso file, aggiungi la tua email nell'array `ADMIN_EMAILS`: sarà l'unico account promosso automaticamente ad **admin** in fase di registrazione. Tutti gli altri diventano `player` di default.

## 2. Imposta le regole di sicurezza Firestore

Vai su **Firestore Database > Regole** nella console Firebase e incolla il contenuto di [`firestore.rules`](firestore.rules), poi pubblica.

Queste regole impediscono a un giocatore di auto-assegnarsi il ruolo di admin o DM modificando i propri dati dal client.

## 3. Prova in locale

Serve un server statico qualsiasi (i moduli ES richiedono `http://`, non `file://`). Ad esempio:

```bash
python3 -m http.server 8000
```

Poi apri `http://localhost:8000`.

## 4. Promuovi qualcuno a Dungeon Master

Accedi come admin, vai su **Gestione utenti** dalla dashboard e cambia il ruolo dell'utente in "Dungeon Master" dal menu a tendina.

## 5. Pubblica su GitHub Pages

1. Crea una repository su GitHub e carica questi file (nessun dominio personalizzato).
2. Nelle impostazioni della repo, vai su **Pages** e scegli come sorgente il branch `main` (cartella root).
3. Dopo qualche minuto il sito sarà raggiungibile all'URL `https://<tuo-utente>.github.io/<nome-repo>/`: condividilo con DM e giocatori.

## Struttura del progetto

```
index.html          → pagina di login
register.html        → registrazione nuovo account
dashboard.html        → area post-login, pannelli in base al ruolo
admin-utenti.html      → pannello admin: elenco utenti, ruoli, reset password
dm-party.html         → pannello DM: roster giocatori, trigger livello
assets/css/style.css   → tema visivo fantasy condiviso
assets/js/firebase-config.js → configurazione Firebase (da personalizzare)
assets/js/auth.js       → logica di autenticazione, ruoli e livelli
firestore.rules        → regole di sicurezza da incollare nella console Firebase
```

## Prossimi passi

- Scheda personaggio interattiva (creazione, statistiche, inventario, spesa punti livello).
- Controllo musica DM (playlist Spotify/YouTube) con toggle lato giocatori.
- Adattamento mobile/tablet più rifinito.
- Lavagna/schede informazioni raccolte durante le sessioni.
- Mappe, nebbia di guerra, pedine.
- Rivedere la tagline del footer in fase di rifinitura finale.
