# Cloud Functions: pubblicazione e configurazione

Le funzioni (`functions/`) sono due:

| Funzione | Cosa fa | Si attiva |
|---|---|---|
| `notificaNuovoIscritto` | Invia un'email all'admin quando qualcuno si registra ed è in attesa di approvazione (massimo 10 email all'ora, contro le registrazioni in massa) | alla creazione di un documento in `users` |
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

## 1. Account Gmail di appoggio (una volta)

1. Creare un account Gmail dedicato al portale (es. `portale.sotterranei@gmail.com`).
2. Attivare la **verifica in due passaggi** su quell'account.
3. Creare una **password per le app** in
   [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   (nome: "Portale"). Sono 16 lettere: servono al punto 4, non vanno salvate altrove.

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

npx firebase-tools@latest login --no-localhost

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

## 5. Verificare

- **Email**: registrare un account di prova dal sito → entro un minuto arriva
  l'email all'indirizzo `EMAIL_ADMIN`. Poi eliminare l'account di prova
  (Authentication + documento in `users`).
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
