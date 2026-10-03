# Cose da fare

Elenco delle idee e dei lavori concordati ma non ancora fatti, in ordine
indicativo. Si aggiorna man mano che si completano.

## Manutenzione e rifiniture

- **Pulizia del codice** e piccole rifiniture dell'interfaccia.

## Grafica

La tela di design "Grafica di Base e Caricamento" è la fonte di verità: si
integra solo ciò che è segnato ✅, con una pull request per lotto.

- **Tiro dei PF in 3D vero (JS)** (⏳ in revisione nella tela): ottaedro al
  posto dell'illusione CSS nel passaggio di livello.
- **Pulsante 🎲 del tracker di combattimento**: ancora in emoji, da disegnare
  nella tela.
- **Stemma per l'intestazione** (❌ scartato, drago da rifare).
- **Bussola per la mappa** (tavola degli stati vuoti della Sessione): da usare
  nel pannello Mappa quando non c'è ancora nessuna mappa.
- **Animazioni in JavaScript** (da valutare insieme): fatto il dado di
  caricamento, in revisione il tiro dei PF; l'annuncio di livello resta in CSS
  (scelta della tela). Da valutare: comparsa dei contenuti in sessione, turno
  nel tracker, eventuali risorse aggiuntive (sprite, suoni, particelle).

## Funzioni per il tavolo

- **Dashboard e pannello di controllo della campagna da ridisegnare**: UI e
  usabilità della gestione della campagna per il DM.
- **Notifiche, seconda parte**:
  - avviso "Tocca a te" quando arriva il proprio turno nel tracker di
    combattimento;
  - scelta dei tipi di avviso da ricevere come push;
  - fascia "non disturbare", che rispetti comunque le impostazioni del
    telefono (modalità silenziosa / full immersion).
- **Creazione di PNG e nemici per il DM**: schede rapide, con la possibilità di
  partire dai mostri del materiale gratuito di Wizards of the Coast (SRD 5.1,
  licenza Creative Commons), come già fatto per incantesimi ed equipaggiamento.

## Altro

- **Corto animato in JavaScript**: da discutere.

## Già fatto

- Mappe della sessione, fase 1: pannello Mappa nella Sessione (sopra gli
  appunti), mappe della Libreria fino a 4096 px, griglia per mappa (anche
  con la taratura a due clic), mappa in tavola e mappe in preparazione,
  pedine dei personaggi (ritratto, PF, condizioni, "A terra") che ogni
  giocatore muove da sé con la distanza in metri, schermo del tavolo
  (tavolo.html) che segue l'inquadratura del DM.
- Mappe della sessione, fase 2: nemici sulla mappa dal vassoio del tracker o
  messi a mano dalla Libreria, nascosti finché il DM non li rivela (anche
  dall'ordine di iniziativa dei giocatori), taglie fino a 4×4, salute vaga per
  i giocatori, "A terra" a 0 PF, alone sul turno, schermo del tavolo che segue
  chi è di turno, "Tocca a te!" sul telefono.
- Mappe della sessione, fase 3: nebbia di guerra a caselle per ogni mappa,
  disegnata in diretta dal DM (pennello 1×1 o 3×3, rettangolo, svela/copri,
  annulla, svela/copri tutto, torcia attorno ai PG, "Vedi come i giocatori");
  velo per il DM, buio sfumato per i giocatori; i nemici sotto la nebbia
  spariscono per i giocatori.
- Mappe della sessione, fase 4: strumenti per tutti, ognuno col suo colore
  (oro per il DM). Righello che gli altri vedono mentre si misura, ping con
  onda e suono (quello del DM centra telefoni e tavolo), aree degli
  incantesimi (sfera, cono, cubo, linea) dai propri incantesimi del SRD o a
  mano, con le caselle e le pedine colpite evidenziate; restano finché le
  toglie chi le ha messe o il DM.

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
- Layout su telefono rivisto pagina per pagina (verifica automatica da 320 a
  844 px): intestazione compatta con ruolo ed "Esci" nel pannello ⚙️, campi a
  16 px, aree di tocco più grandi, tracker di combattimento a righe compatte
  con i comandi dietro ▾, attacchi della scheda come piccole schede, libreria
  e archivio a due colonne, descrizioni di condizioni, privilegi e
  incantesimi con un tocco.
- App installabile (PWA): icona "S&D" dal d20, manifest, service worker che
  salva il sito sul telefono, pagina "sei offline", avviso "nuova versione"
  con "Aggiorna", invito a installare in dashboard e nel pannello ⚙️ (su
  iPhone con le istruzioni).
- Intro dell'app installata: d20 in resina avorio con i numeri rossi (Three.js)
  che entra rimbalzando, si ferma sul 20, il 20 si accende d'oro e il dado
  diventa l'icona con il titolo (2,5 s, un tocco la salta, versione ferma con
  "riduci animazioni").
- Notifiche push: gli avvisi della campanella (livello, date proposte, sessione
  confermata e il nuovo "la sessione è iniziata") arrivano anche ad app chiusa,
  sul telefono (app installata; su iPhone da iOS 16.4) o sul computer;
  attivabili dall'invito in dashboard o dal pannello ⚙️, al tocco aprono la
  pagina giusta (Cloud Function `inviaNotificaPush`).
- Pulizia e campagne: il DM elimina dal registro una o più sessioni (anche
  già giocate, con appunti e tiri; il contatore riparte dal numero più alto
  rimasto); l'admin elimina un utente da Gestione utenti (Cloud Function
  `eliminaUtente`: account, profilo, personaggi e ritratti; gli appunti
  restano); più campagne attive insieme, con il selettore in dashboard e nel
  pannello ⚙️ (la scelta resta nel browser).
- Esportazione delle schede: PDF in stile app (ritratto grande, caratteristiche
  in verticale come nella scheda, leggibile anche in bianco e nero) e backup
  JSON completo; dalla scheda (giocatore o DM) e, per il DM, tutto il party in
  un colpo dalla pagina del party. Librerie e font del PDF si scaricano solo
  al primo uso. Il ripristino da JSON, se servirà, è da fare.
- Guida alla creazione del personaggio nella scheda: pannello con i passi
  (background, abilità, allineamento, privilegi, equipaggiamento, competenze,
  personalità, passaggi di livello, sottoclasse, incantesimi) che si spuntano
  da soli, fumetti su misura per classe e razza, azioni rapide (aggiungi i
  privilegi, scrivi le competenze, imposta la sottoclasse, sali di livello).
  Il DM sceglie il livello di partenza della campagna dalla pagina del party e
  i livelli mancanti arrivano a tutti con un solo avviso. Corretti i tratti di
  classe dei livelli 2 e 3 (e i dadi del Bardo) secondo il SRD.
- Avviso di sicurezza su `uuid` nelle Cloud Functions (override in
  `functions/package.json`).
- Grafica, lotto 4: icone del controllo musica, dell'header (Home, Modifica
  ordinamento, Sessione, Calendario) e del conteggio disponibilità nel
  calendario; tooltip pergamena di danno/cura degli incantesimi (mouse, tab e
  tocco sul telefono); dado di caricamento in 3D vero (fermo sul 20 con
  "riduci animazioni").
- Grafica dalla tela di design, tutte le tavole ✅ in tre lotti:
  velo di caricamento con il d20 su ogni pagina, icone SVG di classe, stati
  vuoti con icona; fregi d'angolo, divisori tematici, segnalini a dado, spinner
  nei pulsanti, icone delle azioni, scrollbar dorata, righe segnaposto nel
  registro; annuncio di livello con raggiera e tiro dei PF nel vassoio (un solo
  lancio per finestra: riaprendola si può ritirare, limite accettato).
