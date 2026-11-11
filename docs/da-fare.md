# Cose da fare

Elenco delle idee e dei lavori concordati ma non ancora fatti, in ordine
indicativo. Si aggiorna man mano che si completano.

## Manutenzione e rifiniture

- **Pulizia del codice** e piccole rifiniture dell'interfaccia.

## Grafica

La tela di design "Grafica di Base e Caricamento" è la fonte di verità: si
integra solo ciò che è segnato ✅, con una pull request per lotto.

- **Redesign dell'interfaccia** (blu notte, dipinto del drago e del D20): fatti
  la dashboard e il guscio comune (barra laterale, cassetto, testata compatta)
  su tutte le pagine interne. Prossimi passi, ognuno con le sue tavole: i
  contenuti di Calendario, Sessione, scheda personaggio, login
  (e le altre pagine prima dell'accesso), il velo di caricamento ancora
  col vecchio d20, una famiglia di icone nuova. I colori sono già in base.css
  (variabili `--rd-*`).
- **Animazioni in JavaScript** (da valutare insieme): fatti il dado di
  caricamento, il tiro dei PF, il cambio turno nel tracker e la vaschetta dei
  dadi; l'annuncio di livello resta in CSS (scelta della tela). Da valutare:
  la vaschetta anche per il lanciatore libero della Sessione (oggi mostra solo
  un avviso) e per il dado vita del passaggio di livello; il suono di ogni
  urto sul fondo; danni e cure sui PF. `turno-animato.js` e
  `comparsa-contenuti.js` hanno ancora la loro copia di molla e curve: possono
  passare a `movimento.js`.

## Funzioni per il tavolo

Nessuna in sospeso.

## Altro

- **Corto animato in JavaScript**: da discutere.

## Già fatto

- Registro sessioni: sessioni e appunti si leggono solo dal DM e dai membri
  della campagna (anche l'admin, se non ne fa parte, non li vede più); tutte
  le query del sito filtravano già per campagna.
- Fine della migrazione: tolti la casella «Migra qui i dati già esistenti»,
  il codice che portava i dati di prima delle campagne e la regola della
  vecchia raccolta «campagna». Musica: un brano di Spotify non aggiornato da
  più di un'ora (pagina del DM chiusa, o stato rimasto dai test) non si
  mostra più ai giocatori.
- Versione dell'app nelle Impostazioni ⚙️: «V. 09.10.2026 · codice», lo
  stato rispetto al sito e «Cerca aggiornamenti» / «Aggiorna ora» (si
  scaricano solo i file cambiati). Data e codice si generano da soli con
  node strumenti/aggiorna-sw.mjs.
- Stati dei pulsanti (tavola della tela): niente più riquadro colorato del
  browser al tocco, al suo posto lo stato «premuto»; anello di focus da
  tastiera bordeaux (oro sul fondo scuro); hover solo dove c'è un mouse e mai
  sui pulsanti disabilitati. I pulsanti evidenziati (.btn-tabella-evidenza)
  ora si vedono davvero pieni.
- Inquadratura delle immagini: scegliendo un ritratto si apre «Inquadra il
  ritratto» (trascina, zoom con due dita, rotella, cursore o tastiera, con le
  anteprime di scheda, pedina, party e tabella del DM). Si salvano l'originale
  e le versioni ritagliate; «Inquadra» sotto il ritratto lo risistema senza
  ricaricarlo, anche per i ritratti di prima. Le creature del bestiario hanno
  «Inquadra» accanto all'immagine: la creatura ricorda il ritaglio (la
  Libreria resta intatta) e lo passa a tracker e pedine.
- Logo e header (grafiche generate con un'IA, provvisorie finché il grafico
  non le ridisegna): header orizzontale nelle pagine d'accesso (stemma con
  la scritta sul telefono), logo piccolo nella dashboard, nuova icona
  dell'app (192/512, maskable, iPhone), intro dell'app che finisce sul
  drago avvolto al d20. La favicon resta quella di prima.
- Membri della campagna: in Gestione campagna → Giocatori compaiono tutti
  gli iscritti approvati, anche chi ha il ruolo di DM (si può aggiungere come
  giocatore), con il ruolo indicato; i membri attuali compaiono sempre (anche
  senza profilo), così si possono togliere. Creando una campagna la casella
  di migrazione porta solo i dati: i giocatori si aggiungono a mano.
- Effetti sonori (kit della tela, sintetizzati nel browser, nessun file):
  «Tocca a te» (non per il DM), nuovo round, contenuto rivelato, dado vita,
  lancio rapido, 20 e 1 naturale, passaggio di livello, ping della mappa.
  In ⚙️ → Effetti sonori interruttore, volume e prova, salvati sul
  dispositivo; mai sullo schermo del tavolo né a pagina nascosta.
- Comparsa dei contenuti nella Sessione del giocatore (effetto scenico della
  tela): la riga si apre, la miniatura si svela da sfocata a nitida con un
  riflesso, il titolo si scrive, la riga si accende d'oro; il sigillo
  «Nuovo» resta finché il giocatore non apre il contenuto. Quando il DM
  nasconde, la riga si chiude sfumando. Corretto anche il toast «Il DM ti
  mostra» che all'apertura della pagina usciva per contenuti già mostrati.
- Cambio turno animato nel tracker: per tutti una cornice dorata scorre
  sulla riga di turno con il ▶, il sottotitolo cambia in dissolvenza e il
  numero del round si illumina; per il giocatore di turno la cornice arriva
  a molla con scia, onda, riflesso e scintille, il banner «Tocca a te!»
  entra con un lampo e la riga pulsa. Il DM vede sempre la versione sobria;
  con «riduci animazioni» il cambio è istantaneo.
- Crediti di livello per campagna: il DM concede (o annulla, finché non è
  speso) un livello a un membro della sua campagna dalla pagina del party,
  dove il livello mostrato è quello del personaggio attivo con «↑ al N° in
  attesa · Annulla». Il giocatore lo spende solo con il personaggio attivo di
  quella campagna (pulsante nella scheda e nella card di I miei personaggi);
  avvisi e notifiche portano il nome della campagna. I vecchi crediti del
  profilo passano alla campagna del giocatore se ne ha una sola, altrimenti
  si azzerano.
- Ruolo per campagna: si è DM della campagna che si guida e giocatori di
  quelle di cui si è membri, anche da admin o da DM (selettore della campagna
  con «DM»/«giocatore»; dashboard, sessione, calendario e archivio si
  adattano). Le regole danno i poteri del DM solo a chi guida la campagna:
  un admin che gioca non vede nemici nascosti, note o tiri segreti.
- Controllo musica: elenco dei link YouTube salvati dal DM (solo suo), con
  «Salva nell'elenco» e un nome, un tocco per caricarlo e trasmetterlo,
  rinomina e «togli» con «Annulla».
- Dashboard ridisegnata: in alto il cruscotto della campagna (sessione in
  evidenza con il pulsante giusto — «Apri la sessione di oggi», «Vai alla
  sessione», «Rispondi alle date» —, party con PF, condizioni e livelli da
  completare, avvisi «Da fare»); per il giocatore il proprio personaggio,
  la musica e i suoi avvisi. Sotto gli strumenti raggruppati in Prepara /
  Gioca / Consulta, compatti e riordinabili dentro ogni gruppo (due per riga
  sul telefono). Gestione campagna a schede (Panoramica con i numeri,
  Giocatori con il personaggio attivo, Sessioni in programma, proposte e
  giocate con il registro, Altre campagne), con l'indirizzo della scheda
  (campagna.html#sessioni).
- Guida e FAQ per i giocatori (guida.html), uguale anche per il DM: sette
  capitoli brevi a passi numerati con piccole schermate dal telefono (un tocco
  le ingrandisce) e dieci domande frequenti, con una ricerca che filtra
  entrambi; sul telefono l'indice è una tendina e sotto ogni capitolo ci sono
  le sue domande. Si apre dal pannello «Guida e FAQ» della dashboard e dal
  pannello ⚙️.
- Manuale del DM: documento condivisibile (Claude Docs) con la prima
  sessione passo per passo e un capitolo per ogni pagina, con le schermate
  della campagna di esempio.
- Bestiario, prima parte: pagina del DM con tutti i 334 mostri del SRD 5.1
  in italiano (blocco statistiche completo, misure in metri), ricerca e
  filtri, tiri a un clic nel registro della sessione (nascosti o visibili),
  creature del DM nuove o «Usa come base», indole, personaggi unici con
  stato che continua tra le sessioni (PF, condizioni, risorse,
  equipaggiamento, diario delle apparizioni).
- Bestiario, seconda parte: «Dal bestiario» in «Aggiungi nemici» del tracker
  (nome, iniziativa, PF, taglia e immagine già compilati) e «Aggiungi al
  combattimento» dalla pagina Bestiario; scheda con i tiri aperta dal tracker
  (📜) o dalla pedina; alleati con il bordo verde e i PF visibili a tutti;
  personaggi unici che entrano con il loro stato, una volta sola, e a fine
  combattimento riportano PF e condizioni sulla scheda con una voce nel diario.
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
  "riduci animazioni"). Sostituita dall'intro «drago e D20» (sotto).
- Intro «drago e D20» con pezzi dipinti: il drago entra da sinistra, gira attorno
  al D20, lo colpisce, esplosione a spirale che vira al bianco e logo (6,7 s).
  Copre il caricamento: all'avvio a freddo dell'app installata e subito dopo il
  login; si entra quando la dashboard è pronta. Disegno in un worker
  (OffscreenCanvas) dove c'è; un tocco salta; logo fermo con "riduci animazioni".
  Tolti Three.js e il Cinzel per il web, non più usati.
- Icone nuove dal bozzetto del drago avvolto al D20: angoli trasparenti per
  desktop e Android, maskable ricostruita con il vortice dipinto fino ai bordi
  (drago e D20 nella zona sicura), favicon sul D20 (16 e 32 px, al posto della
  favicon vettoriale), icona per iPhone. Colore dell'app blu notte (#0c1f2f) nel
  manifest e nelle pagine.
- Guscio ridisegnato su tutte le pagine dopo l'accesso (tranne lo schermo del
  tavolo): stessa barra laterale della dashboard con la pagina corrente accesa,
  testata compatta (riga campagna · ruolo dove serve, titolo, comandi della
  pagina, campanella), fascia del dipinto attenuata e sfondo blu; sotto i 900 px
  la barra diventa un cassetto aperto dal ☰ (anche nella dashboard, al posto
  dell'emblema). Sessione con la barra a sole icone; in «I miei personaggi» la
  matita è diventata «Riordina» sopra l'elenco. Contenuti delle pagine invariati.
- Dashboard ridisegnata: blu notte con il dipinto del drago e del D20, barra
  laterale con le stesse voci delle tessere (segue il ruolo nella campagna;
  Amministrazione il ruolo dell'account, con il numero degli iscritti in
  attesa), testata con campagna, targhette DM/Giocatore e Admin e la sola
  campanella, «● Sessione in corso» quando il tavolo è aperto, saluto e
  sessione in un unico pannello, riepilogo su pergamena, «Riordina» accanto
  agli strumenti. Barra a sole icone tra 900 e 1199 px; sotto i 900 px
  testata del telefono, «Da fare» prima del party, strumenti su due colonne e
  pannello ⚙️ come foglio dal basso. Le altre pagine restano com'erano
  (l'intestazione condivisa ha una variante compatta usata solo qui).
- Logo nuovo nel sito: emblema e titolo in Cinzel (gli stessi file dell'intro)
  nelle pagine prima dell'accesso, al posto del logo orizzontale e dello stemma;
  nell'intestazione della dashboard l'emblema con la scritta in Cinzel come
  testo. Tolti i vecchi loghi oro e bordeaux.
- Notifiche push: gli avvisi della campanella (livello, date proposte, sessione
  confermata e il nuovo "la sessione è iniziata") arrivano anche ad app chiusa,
  sul telefono (app installata; su iPhone da iOS 16.4) o sul computer;
  attivabili dall'invito in dashboard o dal pannello ⚙️, al tocco aprono la
  pagina giusta (Cloud Function `inviaNotificaPush`).
- Notifiche, seconda parte: push "Tocca a te!" quando arriva il turno del
  proprio personaggio nel tracker (non se la Sessione è già aperta e visibile);
  in ⚙️ → Notifiche si sceglie quali push ricevere (sessione, date, livello,
  turno) e una fascia "non disturbare" in cui le push sono in pausa (gli
  avvisi restano nella campanella).
- Scheda rapida in Sessione: il bottone fisso «La mia scheda» apre la scheda
  del proprio personaggio per il gioco (Combattimento, Prove, Magia,
  Privilegi): tiri con la finestra dei dadi e negli appunti, PF, slot e usi
  salvati su scheda e party. Sul computer è un pannello a destra che lascia
  la mappa visibile, sul telefono occupa lo schermo. Il DM vede «Schede del
  party» in sola lettura.
- Icone SVG al posto delle emoji rimaste (tavole «cruscotto e tracker» e
  «guida, bestiario, mappa e musica»): strumenti e «Da fare» della dashboard,
  tracker di combattimento (dado, scheda, frecce, turno), mappa («Centra su di
  me», «Scheda», croce della pedina a terra e bussola quando non c'è una
  mappa), capitoli e segni della guida, tiri e tag del Bestiario, elenco
  YouTube e audio del widget musica. Registro in assets/js/icone.js (icona()).
- Tiro dei PF in 3D vero (JS) nel passaggio di livello: un ottaedro che
  rotola e si ferma con il risultato davanti (dado-pf.js), al posto
  dell'animazione CSS; con «riduci animazioni» compare già fermo.
- Revisione del codice, parte 1 (sicurezza): sessioni e appunti leggibili e
  scrivibili solo da DM e membri della loro campagna; PF, condizioni e
  ritratto scritti insieme al riepilogo del party; eliminando un utente si
  tolgono anche combattente e pedina, e non si elimina chi guida una
  campagna.
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
- Vaschetta dei dadi: nella finestra del tiro (dalla scheda e dalla scheda
  rapida) e nel riposo breve i dadi sono solidi veri, dal d4 al d20, cremisi
  con spigoli e numeri d'oro come il D20 dell'intro. Cadono in una vaschetta
  di legno con il fondo rivestito, rimbalzano su fondo e pareti, si urtano e
  si fermano appoggiati su una faccia con il risultato in alto; con più dadi
  rotolano tutti insieme. Vantaggio e svantaggio: due d20, quello scartato si
  spegne. 20 naturale con lampo d'oro e scintille, 1 naturale con il dado che
  si incrina e perde schegge. Il risultato resta quello tirato dall'app e
  scritto nel registro. In ⚙️ → Dadi si scelgono il rivestimento (feltro blu
  notte, verde o cremisi, cuoio, legno) e la vista (di tre quarti o
  dall'alto), salvati sul dispositivo. Con "riduci animazioni" i dadi
  compaiono già fermi. Il d100 mostra solo il risultato, come prima.
