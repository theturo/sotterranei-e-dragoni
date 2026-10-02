# Sicurezza e costi (piano Blaze)

Con il piano Blaze non esiste un tetto di spesa automatico: gli avvisi di budget
avvisano ma non bloccano nulla. Le difese contro spese impreviste o fraudolente
sono quindi a più livelli: regole di sicurezza (nel repo, testate), impostazioni
della Console (qui sotto, da fare una volta) e limiti nel codice.

## Già nel codice

- `firestore.rules`: solo utenti con email verificata e **approvati dall'admin**
  leggono e scrivono dati della campagna; campi e dimensioni dei documenti
  limitati (schede, appunti, riepiloghi).
- `storage.rules`: solo utenti approvati leggono o caricano file; solo immagini
  (PNG, JPEG, WebP, GIF), massimo 2 MB per i ritratti e 10 MB per le immagini
  della campagna, solo nelle cartelle previste; tutto il resto è vietato.
- Le immagini vengono ridimensionate nel browser prima dell'invio (ritratti
  512 px con icona da 96 px, immagini della campagna 1920 px (le mappe 4096 px,
  ricompresse finché non stanno nei 10 MB) con miniatura da 480 px, in WebP):
  pochi KB/centinaia di KB ciascuna invece di foto da vari MB.
- Le immagini si scaricano con l'SDK, non con link pubblici: ogni lettura passa
  dalle regole. Un contenuto della libreria che il DM non ha mostrato a un
  giocatore (o messo nel suo archivio) non si scarica
  nemmeno conoscendone il percorso.
- Test automatici di entrambe le regole a ogni pull request (`test/regole`).

## Da fare nella Console (una volta)

### 1. Pubblicare le regole di Storage
Console Firebase → **Storage** → **Regole** → incollare il contenuto di
`storage.rules` → **Pubblica**. Alla prima pubblicazione la Console chiede di
autorizzare Storage a leggere Firestore (le regole controllano profili e
campagne): va **accettato**, altrimenti ogni accesso viene negato.

### 1b. CORS del bucket (serve per mostrare le immagini)
Il sito scarica le immagini direttamente dal bucket, che per farlo deve
accettare richieste dal dominio del sito (`cors.json` nel repo: solo lettura, solo
da `https://theturo.github.io`). Una volta, in Google Cloud Shell (vedi
`docs/funzioni.md` su come usarla):

```sh
cd sotterranei-e-dragoni && git pull
gcloud storage buckets update gs://sotterranei-e-dragoni.firebasestorage.app --cors-file=cors.json
```

Verifica: `gcloud storage buckets describe gs://sotterranei-e-dragoni.firebasestorage.app --format="default(cors_config)"`.
Senza questo passaggio il caricamento funziona ma le immagini non compaiono (nella
console del browser: errore "CORS").

### 2. App Check anche su Storage
Console Firebase → **App Check** → scheda **API** → **Cloud Storage** →
**Applica** (Enforce). Così solo il sito vero (con reCAPTCHA) può usare il
bucket, non script esterni che abbiano copiato la configurazione pubblica.
Verificare che Firestore e Authentication risultino già "Applicato".

### 3. Avvisi di budget su più soglie
Console Google Cloud → **Fatturazione** → **Budget e avvisi** → budget esistente:
soglie al **50%, 90% e 100%** della spesa effettiva e al **100% della spesa
prevista** (forecast), con invio email agli amministratori della fatturazione.
Gli avvisi possono arrivare con qualche ora (a volte giorni) di ritardo.

### 4. Registrazioni automatiche
Console Firebase → **Authentication** → **Impostazioni**: tenere attiva la
**protezione dall'enumerazione delle email**. La quota di registrazione
predefinita (100 account all'ora per IP) si può abbassare solo temporaneamente,
e va bene lasciarla così: App Check blocca gli script esterni, un account non
approvato non vede nulla e può scrivere solo il proprio profilo, e la notifica
email all'admin ha un tetto di 10 messaggi all'ora.

### 5. Chiave API
Console Google Cloud → **API e servizi** → **Credenziali** → chiave del sito:
oltre alla restrizione per dominio, se è attiva anche la restrizione per API
l'elenco deve includere **Cloud Storage for Firebase API**, altrimenti il
caricamento delle immagini verrà rifiutato.

### 6. Controllo periodico
Console Firebase → **Utilizzo e fatturazione**: dare un'occhiata ogni tanto,
soprattutto dopo le prime sessioni con le immagini. Per 6–7 persone ci si
aspetta di restare entro le quote gratuite.

### 7. Cloud Functions e blocco spese automatico
Notifica email degli iscritti e "interruttore" che scollega la fatturazione
oltre una soglia: pubblicazione e configurazione in `docs/funzioni.md`.

## Quote gratuite di riferimento (verificare nella Console, cambiano nel tempo)

| Servizio | Gratis | Note |
|---|---|---|
| Firestore | 50.000 letture, 20.000 scritture, 20.000 cancellazioni al giorno; 1 GiB | uguale su Spark e Blaze |
| Cloud Storage (bucket in us-east1) | 5 GB di spazio; 100 GB/mese di traffico in uscita | solo regioni US |
| Cloud Functions | 2 milioni di chiamate al mese | per le funzioni future |
| Artifact Registry | 0,5 GB | immagini delle funzioni: attivare la pulizia automatica |
