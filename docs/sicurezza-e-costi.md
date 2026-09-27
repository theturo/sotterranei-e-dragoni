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
  (PNG, JPEG, WebP, GIF), massimo 2 MB per i ritratti e 5 MB per le immagini
  della campagna, solo nelle cartelle previste; tutto il resto è vietato.
- Test automatici di entrambe le regole a ogni pull request (`test/regole`).

## Da fare nella Console (una volta)

### 1. Pubblicare le regole di Storage
Console Firebase → **Storage** → **Regole** → incollare il contenuto di
`storage.rules` → **Pubblica**. Alla prima pubblicazione la Console chiede di
autorizzare Storage a leggere Firestore (le regole controllano profili e
campagne): va **accettato**, altrimenti ogni accesso viene negato.

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

### 4. Limitare le registrazioni automatiche
Console Firebase → **Authentication** → **Impostazioni**:
- **Protezione dall'enumerazione delle email**: attiva.
- **Quota di registrazione** (sign-up quota): abbassarla (es. 5 nuovi account
  all'ora per indirizzo IP) per rendere inutile la creazione massiva di account.

### 5. Chiave API
Console Google Cloud → **API e servizi** → **Credenziali** → chiave del sito:
oltre alla restrizione per dominio, se è attiva anche la restrizione per API
l'elenco deve includere **Cloud Storage for Firebase API**, altrimenti il
caricamento delle immagini verrà rifiutato.

### 6. Controllo periodico
Console Firebase → **Utilizzo e fatturazione**: dare un'occhiata ogni tanto,
soprattutto dopo le prime sessioni con le immagini. Per 6–7 persone ci si
aspetta di restare entro le quote gratuite.

## Quote gratuite di riferimento (verificare nella Console, cambiano nel tempo)

| Servizio | Gratis | Note |
|---|---|---|
| Firestore | 50.000 letture, 20.000 scritture, 20.000 cancellazioni al giorno; 1 GiB | uguale su Spark e Blaze |
| Cloud Storage (bucket in us-east1) | 5 GB di spazio; 100 GB/mese di traffico in uscita | solo regioni US |
| Cloud Functions | 2 milioni di chiamate al mese | per le funzioni future |
| Artifact Registry | 0,5 GB | immagini delle funzioni: attivare la pulizia automatica |
