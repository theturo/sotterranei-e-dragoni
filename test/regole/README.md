# Test delle regole Firestore

Verificano, sull'emulatore di Firestore, che `firestore.rules` permetta le
operazioni legittime e **neghi** quelle pericolose (auto-promozione ad admin,
lettura delle email altrui, livelli regalati, appunti falsificati, titolo
provvisorio svelato...). Ogni modifica alle regole dovrebbe passare da qui
prima di essere pubblicata.

Girano in automatico su GitHub (workflow `.github/workflows/test.yml`) a ogni
pull request e a ogni push su `main`, insieme ai controlli statici delle pagine
(`node --test "test/pagine/*.test.mjs"`, senza emulatore).

Serve Node.js 20+ e Java 11+ (per l'emulatore).

```sh
cd test/regole
npm install
npm test
```

Pubblicazione delle regole (al posto del copia-incolla nella Console), dalla
cartella principale del progetto:

```sh
npx firebase-tools deploy --only firestore:rules --project sotterranei-e-dragoni
```
