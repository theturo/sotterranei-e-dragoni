# Cloud Functions: pubblicazione e configurazione

Le funzioni (`functions/`) sono tre:

| Funzione | Cosa fa | Si attiva |
|---|---|---|
| `notificaNuovoIscritto` | Invia un'email all'admin quando qualcuno si registra ed è in attesa di approvazione (massimo 10 email all'ora, contro le registrazioni in massa) | alla creazione di un documento in `users` |
| `inviaNotificaPush` | Manda ogni avviso della campanella (passaggio di livello, date proposte, sessione confermata, sessione iniziata) come **notifica push** ai dispositivi su cui l'utente le ha attivate; toglie i dispositivi il cui token non vale più | alla creazione di un documento in `users/{uid}/notifiche` |
| `bloccaSpeseOltreSoglia` | Se la spesa del mese raggiunge la soglia (predefinita: 10), **scollega la fatturazione** dal progetto | a ogni avviso del budget, via Pub/Sub |

Girano in `europe-west1` (la regione che corrisponde al database Firestore `eur3`),
con al massimo un'istanza ciascuna e 256 MB di memoria.

> **Cosa succede se scatta il blocco spese.** Tutti i servizi a pagamento si
> fermano: Storage (immagini), le funzioni e, oltre le quote gratuite, Firestore.
> Il sito resta raggiungibile ma in parte non funzionante finché non si ricollega
> la fatturazione a mano (vedi "Se il blocco scatta"). Se la fatturazione resta
> scollegata a lungo, Google può eliminare le risorse: va ricollegata appena
> chiarita la causa.

Tutti i comandi qui sotto si eseguono in **Google Cloud Shell**: in
[console.cloud.google.com](https://console.cloud.google.com), icona `>_` in alto a
destra, con il progetto `sotterranei-e-dragoni` selezionato. Non serve installare
nulla sul proprio computer.

Come usare il terminale:
- incollare **un comando alla volta** e aspettare che ricompaia il prompt (`$`)
  prima del successivo; molti comandi, se vanno a buon fine, scrivono poco o
  nulla, e `gcloud services enable` può restare fermo un paio di minuti;
- i comandi su più righe (che finiscono con `\`) vanno incollati tutti insieme;
- le righe che iniziano con `#` sono commenti, non vanno eseguite;
- nei blocchi di codice di questo file, le righe con i tre accenti gravi
  (```` ``` ````) sono solo formattazione: non vanno copiate.

## 1. Account Gmail di appoggio (una volta)

1. Creare un account Gmail dedicato al portale (es. `portale.sotterranei@gmail.com`).
2. Attivare la **verifica in due passaggi** su quell'account.
3. Creare una **password per le app** in
   [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   (nome: "Portale"). Sono 16 lettere, mostrate in gruppi di quattro: al punto 4
   vanno inserite **senza spazi** (se incollate con spazi o a capo, Gmail rifiuta
   l'accesso con "Username and Password not accepted"). Non vanno salvate altrove.

L'account di appoggio serve **solo** come casella da cui partono le email: non va
usato per il login della CLI (punto 4) e non va aggiunto ai membri del progetto.

## 2. Preparare il progetto (una volta)

```sh
gcloud config set project sotterranei-e-dragoni

# Servizi necessari alle funzioni e al blocco spese
gcloud services enable cloudbilling.googleapis.com pubsub.googleapis.com \
  cloudfunctions.googleapis.com run.googleapis.com eventarc.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

# Argomento Pub/Sub su cui il budget pubblica i suoi avvisi
gcloud pubsub topics create avvisi-budget

# Account di servizio dedicato al blocco spese: è l'unico a cui si dà il
# permesso di gestire la fatturazione
gcloud iam service-accounts create blocco-spese --display-name="Blocco spese automatico"

# ID dell'account di fatturazione (la parte dopo "billingAccounts/")
gcloud billing projects describe sotterranei-e-dragoni

# Sostituire XXXXXX-XXXXXX-XXXXXX con l'ID appena letto
gcloud billing accounts add-iam-policy-binding XXXXXX-XXXXXX-XXXXXX \
  --member="serviceAccount:blocco-spese@sotterranei-e-dragoni.iam.gserviceaccount.com" \
  --role="roles/billing.admin"
```

## 3. Collegare il budget all'argomento Pub/Sub (una volta)

Console Google Cloud → **Fatturazione** → **Budget e avvisi** → aprire il budget
del progetto → sezione **Gestisci notifiche** → **Collega un argomento Pub/Sub a
questo budget** → scegliere `projects/sotterranei-e-dragoni/topics/avvisi-budget`
→ **Salva**. Il budget deve riguardare solo questo progetto.

## 4. Pubblicare le funzioni

```sh
git clone https://github.com/theturo/sotterranei-e-dragoni.git
cd sotterranei-e-dragoni
(cd functions && npm ci)

# Login con il PROPRIO account (proprietario del progetto), non con quello di
# appoggio: quest'ultimo non ha permessi sul progetto (errore 403).
npx firebase-tools@latest login --no-localhost

# Firebase Cloud Messaging, per le notifiche push (di solito è già attivo:
# il comando non fa nulla in quel caso)
gcloud services enable fcm.googleapis.com --project sotterranei-e-dragoni

# Chiede la password per le app del punto 1 e la salva in Secret Manager
npx firebase-tools@latest functions:secrets:set PASSWORD_APP_GMAIL --project sotterranei-e-dragoni

npx firebase-tools@latest deploy --only functions --project sotterranei-e-dragoni
```

Al primo deploy la CLI chiede tre valori, che salva solo in Cloud Shell
(`functions/.env.sotterranei-e-dragoni`, escluso da git: gli indirizzi non
finiscono nel repo pubblico):

- `EMAIL_MITTENTE`: l'indirizzo Gmail di appoggio;
- `EMAIL_ADMIN`: dove ricevere le notifiche (anche la propria email personale);
- `SOGLIA_BLOCCO_SPESA`: spesa mensile, nella valuta dell'account di
  fatturazione, oltre la quale scollegare la fatturazione (consigliato **10**,
  il doppio dell'avviso a 5: l'email del budget arriva prima e lascia tempo per
  intervenire a mano).

Se la CLI propone una **politica di pulizia delle immagini dei container**,
accettarla (tiene Artifact Registry entro la quota gratuita).

Se il primo deploy fallisce con un errore sui permessi di Eventarc o di un
"service agent", aspettare 3–5 minuti (Google sta ancora propagando i permessi
appena creati) e rilanciare lo stesso comando.

Avvisi innocui durante `npm ci` in Cloud Shell: `EBADENGINE` (Cloud Shell ha una
versione di Node più recente; in produzione le funzioni girano con Node 22),
pacchetti `deprecated` e `install scripts blocked`. Non lanciare `npm audit fix`
in Cloud Shell: le dipendenze si aggiornano nel repository (con una pull
request) e poi si ripubblica. Per esempio `package.json` impone a `uuid`
(usato internamente dalle librerie Google) una versione senza l'avviso di
sicurezza GHSA-w5hq-g745-h8pq, tramite la sezione `overrides`.

### 4b. Permesso di invocazione per gli attivatori (una volta, dopo il primo deploy)

Gli attivatori delle funzioni devono poterle chiamare, altrimenti nei log
compare "The request was not authenticated … lacks run.routes.invoke" e la
funzione non parte. Controllare quale account usa ciascun attivatore:

```sh
# Blocco spese (attivatore Pub/Sub, in europe-west1)
gcloud eventarc triggers list --location=europe-west1 --format="table(name, serviceAccount)"

# Email dei nuovi iscritti (attivatore Firestore: sta nella località del
# database, eur3, anche se la funzione gira in europe-west1)
gcloud eventarc triggers list --location=eur3 --format="table(name, serviceAccount)"
```

e concedere il ruolo a quegli account (sostituire `ACCOUNT` con quello mostrato
per `notificanuovoiscritto` e `ACCOUNT_PUSH` con quello di `invianotificapush`,
di solito lo stesso):

```sh
gcloud run services add-iam-policy-binding bloccaspeseoltresoglia --region=europe-west1 \
  --member="serviceAccount:blocco-spese@sotterranei-e-dragoni.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

gcloud run services add-iam-policy-binding notificanuovoiscritto --region=europe-west1 \
  --member="serviceAccount:ACCOUNT" --role="roles/run.invoker"

gcloud run services add-iam-policy-binding invianotificapush --region=europe-west1 \
  --member="serviceAccount:ACCOUNT_PUSH" --role="roles/run.invoker"
```

Per una funzione aggiunta dopo il primo deploy (come `inviaNotificaPush`) basta
lanciare i comandi che la riguardano.

Gli eventi rimasti in sospeso nel frattempo vengono riconsegnati da soli (fino a
circa 24 ore).

## 5. Verificare

- **Email**: il modo più rapido è creare a mano, in Console Firebase →
  Firestore → collezione `users`, un documento con ID nuovo (es.
  `prova-notifica-1`) e i campi `nome` (string), `email` (string) e `approvato`
  (boolean, **false**): entro un minuto arriva l'email a `EMAIL_ADMIN`
  (controllare anche lo spam). Poi eliminare il documento. In alternativa ci si
  può registrare dal sito con un alias Gmail (`nome+prova1@gmail.com`), che
  arriva nella stessa casella.
  Il limite di 10 email all'ora conta anche i tentativi falliti: se nei log
  compare "Troppe registrazioni nell'ultima ora", aspettare o eliminare il
  documento `sistema/notificheEmail` per azzerare il contatore.
  Se nei log compare "Invalid login", reimpostare la password per le app
  (`functions:secrets:set PASSWORD_APP_GMAIL`, senza spazi) e ripubblicare con
  `deploy --only functions:notificaNuovoIscritto`.
- **Notifiche push**: sul telefono, nell'app installata, toccare **Attiva** nella
  dashboard (o ⚙️ → **Attiva le notifiche**) e consentire. Poi, da un altro
  dispositivo, il DM apre una sessione (o segnala un passaggio di livello):
  entro pochi secondi arriva la notifica, anche ad app chiusa, e toccandola si
  apre la pagina giusta. Nei log della funzione compare "Notifica push inviata"
  con quante sono partite. I dispositivi registrati stanno in Firestore sotto
  `users/{uid}/dispositivi`. Su iPhone e iPad serve iOS 16.4 o successivo e
  l'app aggiunta alla schermata Home.
- **Blocco spese** (senza farlo scattare davvero): pubblicare un avviso finto
  **sotto** la soglia

  ```sh
  gcloud pubsub topics publish avvisi-budget \
    --message='{"costAmount": 1, "budgetAmount": 5, "currencyCode": "EUR"}'
  ```

  e controllare in Console Firebase → **Functions** → **Log** la riga "Avviso di
  budget ricevuto". **Non** pubblicare un valore sopra la soglia: scollegherebbe
  davvero la fatturazione.

## Se il blocco scatta

1. Console Google Cloud → **Fatturazione** → **Gestione account** → il progetto
   risulta senza fatturazione.
2. Capire la causa: Console Firebase → **Utilizzo e fatturazione**, e i log delle
   funzioni.
3. Ricollegare: Console Google Cloud → **Fatturazione** → **I miei progetti** →
   `sotterranei-e-dragoni` → **Cambia fatturazione** → scegliere l'account.

## Aggiornare le funzioni in futuro

```sh
cd sotterranei-e-dragoni && git pull && (cd functions && npm ci)
npx firebase-tools@latest deploy --only functions --project sotterranei-e-dragoni
```
