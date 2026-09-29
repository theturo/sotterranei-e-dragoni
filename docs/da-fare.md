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
- **Animazioni in JavaScript** (da valutare insieme): rivedere le animazioni
  oggi fatte solo in CSS (d20 di caricamento, lancio del dado dei PF, annuncio
  di livello, comparsa dei contenuti in sessione, turno nel tracker…) e capire
  dove un'animazione in JavaScript, eventualmente con risorse aggiuntive
  (sprite, suoni, particelle), renderebbe meglio.

## Funzioni per il tavolo

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
- PF e condizioni in tempo reale: party della Sessione, tracker e scheda si
  aggiornano da soli; il DM applica danni/cure (prima sui PF temporanei), PF
  temporanei, condizioni ed esaurimento dal pannello "Stato"; condizioni anche
  sui nemici del tracker, visibili a tutti.
- Riposo breve e lungo: dalla scheda o dal DM per il party (il breve come
  invito ai giocatori, che spendono i dadi vita tirandoli nell'app o a mano);
  dadi vita, slot, incantesimi di razza, tiri contro la morte ed esaurimento,
  con annotazione negli appunti della sessione.
- Contatori dei privilegi di classe (Ira, Azione Impetuosa, Incanalare
  Divinità, Punti Ki, Imposizione delle Mani…): usi e ricarica automatici per
  classe e livello, ripristinati dai riposi, visibili a tutto il party.
- Lancio dei dadi condiviso: lanciatore libero in Sessione e tiri con un clic
  dalla scheda (caratteristiche, salvezze, abilità, iniziativa, attacchi e
  danni), vantaggio/svantaggio, critici, tiri nascosti del DM; tutto negli
  appunti della sessione e l'iniziativa anche nel tracker.
- Tiri degli incantesimi dalla scheda (per colpire, danni e cure, con attacco
  e CD degli incantesimi) e bonus d'attacco delle armi calcolato in automatico
  (modificabile a mano).
- Calendario delle sessioni: vista mensile, date proposte dal DM con le
  disponibilità dei giocatori (sì/forse/no, visibili a tutti), conferma che
  crea la sessione programmata con data e ora, avvisi nella campanella,
  prossima sessione in dashboard, file .ics e apertura guidata della
  sessione del giorno.
- Avviso di sicurezza su `uuid` nelle Cloud Functions (override in
  `functions/package.json`).
- Grafica dalla tela di design, tutte le tavole ✅ in tre lotti:
  velo di caricamento con il d20 su ogni pagina, icone SVG di classe, stati
  vuoti con icona; fregi d'angolo, divisori tematici, segnalini a dado, spinner
  nei pulsanti, icone delle azioni, scrollbar dorata, righe segnaposto nel
  registro; annuncio di livello con raggiera e tiro dei PF nel vassoio (un solo
  lancio per finestra: riaprendola si può ritirare, limite accettato).
