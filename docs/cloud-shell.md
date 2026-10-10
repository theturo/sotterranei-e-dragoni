# Promemoria Cloud Shell

I comandi da usare più spesso, in ordine. La configurazione fatta una volta
sola (account Gmail, blocco spese, segreti, CORS) è in `docs/funzioni.md` e
`docs/sicurezza-e-costi.md`.

**Quando serve?** Solo quando una pull request dice «dopo il merge va fatto il
deploy delle regole» (o delle funzioni). Il sito (pagine, stili, script) si
pubblica da solo su GitHub Pages dopo il merge: lì non c'è niente da fare.

## 0. Aprire Cloud Shell

[console.cloud.google.com](https://console.cloud.google.com) → controllare in
alto che il progetto sia **sotterranei-e-dragoni** → icona **`>_`** in alto a
destra. Si incolla **un comando alla volta** e si aspetta il prompt (`$`).

## 1. Aggiornare la copia del sito (sempre, per prima cosa)

```sh
cd ~/sotterranei-e-dragoni
git checkout main
git pull
```

Basta `git pull`: scarica le ultime modifiche di `main`. `git checkout main`
serve solo se la copia fosse rimasta su un altro ramo (se è già su `main` dice
«Already on 'main'»).

Se `git pull` si lamenta di modifiche locali («Your local changes … would be
overwritten»): la copia in Cloud Shell non va mai modificata a mano, quindi si
può riallineare a GitHub con

```sh
git fetch origin
git reset --hard origin/main
```

Se `cd` risponde «No such file or directory», la copia non c'è più (Cloud Shell
cancella i file dopo molti mesi di inutilizzo): si riscarica con

```sh
cd ~
git clone https://github.com/theturo/sotterranei-e-dragoni.git
cd sotterranei-e-dragoni
```

Per vedere quale versione c'è: `git log --oneline -1` (l'ultima riga di
«Merge pull request #…»).

## 2. Pubblicare le regole

**Firestore** (il caso più frequente):

```sh
npx firebase-tools@latest deploy --only firestore:rules --project sotterranei-e-dragoni
```

**Storage** (immagini): `--only storage` · **tutte e due**: `--only firestore:rules,storage`

Va tutto bene se alla fine compare **«Deploy complete!»**. Le regole si
possono anche incollare a mano nella Console Firebase (Firestore Database →
Regole → Pubblica), ma il comando evita errori di copia.

## 3. Pubblicare le funzioni (Cloud Functions)

Solo quando una pull request cambia la cartella `functions/`:

```sh
(cd functions && npm ci)
npx firebase-tools@latest deploy --only functions --project sotterranei-e-dragoni
```

Una sola funzione: `--only functions:nomeFunzione` (es. `functions:inviaNotificaPush`).

## 4. Se chiede di accedere

```sh
npx firebase-tools@latest login --no-localhost
```

Con il **proprio** account Google (proprietario del progetto), non con quello
Gmail di appoggio. Se l'accesso è scaduto: `login --reauth --no-localhost`.

## 5. Controlli utili

- Registro delle funzioni (errori delle email o delle notifiche):
  `npx firebase-tools@latest functions:log --project sotterranei-e-dragoni`
- Progetti a cui si ha accesso: `npx firebase-tools@latest projects:list`

## Riassunto da copiare

```sh
cd ~/sotterranei-e-dragoni && git checkout main && git pull
npx firebase-tools@latest deploy --only firestore:rules --project sotterranei-e-dragoni
```
