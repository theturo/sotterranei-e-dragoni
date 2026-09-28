# Cose da fare

Elenco delle idee e dei lavori concordati ma non ancora fatti, in ordine
indicativo. Si aggiorna man mano che si completano.

## Manutenzione e rifiniture

- **Eliminazione di un utente dall'area admin**: pulsante "Elimina" in
  Gestione utenti. Richiede una Cloud Function (l'account di Authentication non
  si può cancellare dal browser), che elimini anche profilo e personaggi.
- **Selettore della campagna** per il DM (oggi si lavora sempre su quella
  "attiva").
- **Pulizia del codice** e piccole rifiniture dell'interfaccia.

## Grafica

La tela di design "Grafica di Base e Caricamento" è la fonte di verità: si
integra solo ciò che è segnato ✅, con una pull request per lotto.

- **Icone per il controllo musica** (⏳ in revisione nella tela): al posto di
  🎵 ⏮ ⏸ ▶ ⏭ nel controllo musica e nel widget della dashboard.
- **Tooltip danno/cura degli incantesimi** in stile pergamena (⏳ in revisione).
- **Icone dell'header ancora in emoji** (🏠 Home, ✏️ Modifica ordinamento,
  📜 Sessione) e il pulsante 🎲 del tracker: da disegnare nella tela.
- **Stemma per l'intestazione** (❌ scartato, drago da rifare).
- **Bussola per la mappa** (tavola degli stati vuoti della Sessione): da usare
  quando arriverà la mappa.

## Funzioni per il tavolo

- **PF e condizioni in tempo reale per il DM** (avvelenato, prono…), con
  aggiornamento istantaneo invece che al caricamento della pagina.
- **Riposo breve e lungo con un clic**, che ripristina slot incantesimo e dadi
  vita.
- **Lancio dadi condiviso** nel registro della sessione.
- **Calendario delle sessioni con le disponibilità**, collegato
  all'interruttore della sessione.
- **Notifiche push** ("la sessione è iniziata", "sei salito di livello"),
  insieme alla PWA (sito installabile sul telefono).
- **Esportazione e backup della scheda** (JSON o PDF).
- **Mappe e nebbia di guerra, gestione dell'esplorazione**: il lavoro più
  grosso, da fare per ultimo. Nella pagina Sessione la mappa andrà sopra gli
  appunti, con una scheda di dimensioni simili (anche sul telefono, prima
  degli appunti).

## Altro

- **Corto animato in JavaScript**: da discutere.

## Già fatto

- Dispense del DM da "sbloccare" per i giocatori: Libreria dei contenuti,
  contenuti mostrati in sessione e Archivio dei giocatori (su Firebase Storage,
  piano Blaze).
- Numerazione delle sessioni senza doppioni (transazione con contatore).
- Tracker di iniziativa e combattimento nella pagina Sessione (turni, round,
  nemici con PF riservati al DM e salute vaga per i giocatori).
- Avviso di sicurezza su `uuid` nelle Cloud Functions (override in
  `functions/package.json`).
- Grafica dalla tela di design, tutte le tavole ✅ in tre lotti:
  velo di caricamento con il d20 su ogni pagina, icone SVG di classe, stati
  vuoti con icona; fregi d'angolo, divisori tematici, segnalini a dado, spinner
  nei pulsanti, icone delle azioni, scrollbar dorata, righe segnaposto nel
  registro; annuncio di livello con raggiera e tiro dei PF nel vassoio (un solo
  lancio per finestra: riaprendola si può ritirare, limite accettato).
