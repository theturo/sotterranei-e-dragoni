// Funzioni condivise di autenticazione e gestione ruoli.
import { auth, db, ADMIN_EMAILS } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  verifyBeforeUpdateEmail,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
  writeBatch,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  documentId,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

export const ROLES = {
  ADMIN: "admin",
  DM: "dm",
  PLAYER: "player",
};

// Etichette leggibili dei ruoli, condivise da dashboard, header e pannelli admin/DM.
export const ETICHETTE_RUOLO = {
  [ROLES.ADMIN]: "Admin",
  [ROLES.DM]: "Dungeon Master",
  [ROLES.PLAYER]: "Giocatore",
};

// Traduce i codici di errore Firebase in messaggi comprensibili in italiano.
export function traduciErrore(codice) {
  const mappa = {
    "auth/email-already-in-use": "Questa email è già registrata. Prova ad accedere.",
    "auth/invalid-email": "L'indirizzo email non è valido.",
    "auth/weak-password": "La password deve avere almeno 6 caratteri.",
    "auth/user-not-found": "Nessun account trovato con questa email.",
    "auth/wrong-password": "Password errata.",
    "auth/invalid-credential": "Email o password non corretti.",
    "auth/too-many-requests": "Troppi tentativi falliti. Riprova più tardi.",
    "auth/missing-password": "Inserisci una password.",
    "auth/requires-recent-login": "Per sicurezza, effettua di nuovo l'accesso e riprova.",
  };
  return mappa[codice] || "Si è verificato un errore. Riprova.";
}

// Crea un nuovo account e il relativo documento utente in Firestore.
export async function registraUtente({ nome, email, password }) {
  const credenziali = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credenziali.user, { displayName: nome });
  await sendEmailVerification(credenziali.user);

  const ruolo = ADMIN_EMAILS.includes(email.toLowerCase()) ? ROLES.ADMIN : ROLES.PLAYER;

  await setDoc(doc(db, "users", credenziali.user.uid), {
    nome,
    email,
    ruolo,
    livello: 1,
    livelliDaSpendere: 0,
    emailVerificata: false,
    creatoIl: serverTimestamp(),
  });

  return { uid: credenziali.user.uid, ruolo };
}

export async function accediUtente({ email, password }) {
  const credenziali = await signInWithEmailAndPassword(auth, email, password);
  return credenziali.user;
}

export async function esciUtente() {
  await signOut(auth);
}

// Recupera il profilo (con ruolo) dell'utente autenticato da Firestore.
export async function ottieniProfiloUtente(uid) {
  const riferimento = doc(db, "users", uid);
  const snapshot = await getDoc(riferimento);
  return snapshot.exists() ? snapshot.data() : null;
}

// Restituisce l'elenco di tutti gli utenti registrati (solo admin, vedi firestore.rules).
export async function elencaUtenti() {
  const riferimento = query(collection(db, "users"), orderBy("creatoIl", "asc"));
  const snapshot = await getDocs(riferimento);
  return snapshot.docs.map((documento) => ({ uid: documento.id, ...documento.data() }));
}

// Cambia il ruolo di un utente (solo admin, vedi firestore.rules).
export async function aggiornaRuoloUtente(uid, nuovoRuolo) {
  await updateDoc(doc(db, "users", uid), { ruolo: nuovoRuolo });
}

// Salva l'ordine personalizzato dei pannelli della dashboard per una sezione
// (admin/dm/player): ogni utente può riordinare a piacimento i propri pannelli
// senza toccare quelli degli altri, dato che il campo vive sul proprio documento.
export async function salvaOrdinePannelli(uid, sezione, ordineChiavi) {
  await updateDoc(doc(db, "users", uid), { [`ordinePannelli.${sezione}`]: ordineChiavi });
}

// Invia l'email di reset password all'indirizzo indicato. Firebase Authentication
// stesso decide se l'indirizzo corrisponde a un account esistente: qui non serve (né
// è possibile, prima del login) verificarlo a mano contro Firestore.
export async function inviaResetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

// Ri-autentica l'utente corrente con la password attuale: richiesto da Firebase
// prima di operazioni sensibili come cambio password o email (auth/requires-recent-login).
async function riautenticaUtente(passwordAttuale) {
  const credenziale = EmailAuthProvider.credential(auth.currentUser.email, passwordAttuale);
  await reauthenticateWithCredential(auth.currentUser, credenziale);
}

// Cambia la password dell'utente corrente, dopo essersi ri-autenticato con quella attuale.
export async function cambiaPassword(passwordAttuale, nuovaPassword) {
  await riautenticaUtente(passwordAttuale);
  await updatePassword(auth.currentUser, nuovaPassword);
}

// Invia un'email di conferma alla NUOVA casella: l'indirizzo su Firebase Authentication
// cambia solo dopo che l'utente clicca il link, non subito.
export async function cambiaEmail(passwordAttuale, nuovaEmail) {
  await riautenticaUtente(passwordAttuale);
  await verifyBeforeUpdateEmail(auth.currentUser, nuovaEmail);
}

// Invia (o re-invia) l'email di verifica all'utente indicato.
export async function inviaEmailVerifica(user) {
  await sendEmailVerification(user);
}

// Ricarica i dati dell'utente da Firebase Auth (serve per rileggere emailVerified
// dopo che l'utente ha cliccato il link di verifica in un'altra scheda).
export async function ricaricaUtente(user) {
  await reload(user);
}

// Restituisce il roster dei soli giocatori (solo DM/admin, vedi firestore.rules).
// Nota: l'ordinamento è fatto lato client (e non con orderBy in query) per
// evitare di richiedere un indice composito Firestore per ruolo+nome.
export async function elencaGiocatori() {
  const riferimento = query(collection(db, "users"), where("ruolo", "==", ROLES.PLAYER));
  const snapshot = await getDocs(riferimento);
  return snapshot.docs
    .map((documento) => ({ uid: documento.id, ...documento.data() }))
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
}

// Il giocatore consuma un credito di livello (concesso dal DM) applicandolo a una
// delle proprie schede. Non richiede permessi speciali: le regole di sicurezza
// permettono già al proprietario di un account di modificare "livelliDaSpendere"
// (solo "ruolo" e "livello" dell'utente sono bloccati per il proprietario).
export async function consumaLivelloDaSpendere(uid) {
  await updateDoc(doc(db, "users", uid), { livelliDaSpendere: increment(-1) });
}

// Il DM segnala che un giocatore è salito di livello (solo DM/admin, vedi firestore.rules).
// livelloAttuale è il livello mostrato in UI prima dell'aggiornamento, usato solo
// per scrivere un testo leggibile nella notifica (es. "2 → 3").
export async function segnalaLivelloSu(uid, livelloAttuale) {
  const livelloPrecedente = livelloAttuale ?? 1;
  await updateDoc(doc(db, "users", uid), {
    livello: increment(1),
    livelliDaSpendere: increment(1),
  });
  await addDoc(collection(db, "users", uid, "notifiche"), {
    tipo: "livello_su",
    livelloPrecedente,
    livelloNuovo: livelloPrecedente + 1,
    letta: false,
    creataIl: serverTimestamp(),
  });
}

// Restituisce lo storico delle notifiche di un utente, più recenti prima.
export async function elencaNotifiche(uid) {
  const riferimento = query(collection(db, "users", uid, "notifiche"), orderBy("creataIl", "desc"));
  const snapshot = await getDocs(riferimento);
  return snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
}

// Segna una singola notifica come letta.
export async function segnaNotificaLetta(uid, notificaId) {
  await updateDoc(doc(db, "users", uid, "notifiche", notificaId), { letta: true });
}

// Una campagna (collezione "campagne") è il contenitore di tutto ciò che un
// tavolo gioca insieme: ha un titolo (eventualmente provvisorio, per un
// "reveal" alla prima sessione), un DM proprietario e un elenco di giocatori
// membri. Un DM può avere più campagne nel tempo, ma solo una alla volta ha
// stato "attiva" (non esiste ancora un selettore in dashboard): è quella
// campagna a determinare party, personaggi e registro sessioni mostrati.
export async function creaCampagna(dmUid, { titolo, titoloProvvisorio }) {
  const riferimento = await addDoc(collection(db, "campagne"), {
    titolo,
    titoloProvvisorio: !!titoloProvvisorio,
    dmUid,
    membriUid: [],
    stato: "pianificazione",
    creataIl: serverTimestamp(),
  });
  return riferimento.id;
}

// Elenca tutte le campagne di un DM (proprie), più vecchia prima.
export async function elencaCampagneDM(dmUid) {
  const riferimento = query(collection(db, "campagne"), where("dmUid", "==", dmUid));
  const snapshot = await getDocs(riferimento);
  return snapshot.docs
    .map((documento) => ({ id: documento.id, ...documento.data() }))
    .sort((a, b) => (a.creataIl?.toMillis?.() ?? 0) - (b.creataIl?.toMillis?.() ?? 0));
}

// Restituisce la campagna "corrente" per un utente: per un DM/admin, la
// propria campagna con stato "attiva"; per un giocatore, la campagna attiva
// di cui è membro. Restituisce null se non ne esiste ancora una (prima
// configurazione, o giocatore non ancora invitato a nessuna campagna). Il
// filtro per ruolo è fatto lato client (non con una seconda clausola "where")
// per evitare un indice composito: le campagne di un singolo utente sono
// comunque pochissime.
export async function ottieniCampagnaCorrente(uid, ruolo) {
  const riferimento =
    ruolo === ROLES.PLAYER
      ? query(collection(db, "campagne"), where("membriUid", "array-contains", uid))
      : query(collection(db, "campagne"), where("dmUid", "==", uid));
  const snapshot = await getDocs(riferimento);
  const attiva = snapshot.docs.find((documento) => documento.data().stato === "attiva");
  return attiva ? { id: attiva.id, ...attiva.data() } : null;
}

export async function aggiornaCampagna(campagnaId, campi) {
  await updateDoc(doc(db, "campagne", campagnaId), campi);
}

// Rende attiva una campagna tra quelle di un DM: quella eventualmente già
// attiva torna "in pausa" (non "conclusa": il DM non ha chiesto di
// concluderla, solo di metterla temporaneamente da parte).
export async function impostaCampagnaAttiva(dmUid, campagnaId) {
  const campagne = await elencaCampagneDM(dmUid);
  const batch = writeBatch(db);
  campagne.forEach((campagna) => {
    if (campagna.id === campagnaId) {
      batch.update(doc(db, "campagne", campagna.id), { stato: "attiva" });
    } else if (campagna.stato === "attiva") {
      batch.update(doc(db, "campagne", campagna.id), { stato: "in pausa" });
    }
  });
  await batch.commit();
}

export async function aggiungiMembroCampagna(campagnaId, uid) {
  await updateDoc(doc(db, "campagne", campagnaId), { membriUid: arrayUnion(uid) });
}

export async function rimuoviMembroCampagna(campagnaId, uid) {
  await updateDoc(doc(db, "campagne", campagnaId), { membriUid: arrayRemove(uid) });
}

// Roster di una campagna: i profili utente dei suoi membriUid (max 30, il
// limite di una query "in" — più che sufficiente per un tavolo casalingo).
export async function elencaMembriCampagna(campagnaId) {
  const campagna = await getDoc(doc(db, "campagne", campagnaId));
  const membriUid = campagna.exists() ? campagna.data().membriUid || [] : [];
  if (membriUid.length === 0) return [];
  const riferimento = query(collection(db, "users"), where(documentId(), "in", membriUid));
  const snapshot = await getDocs(riferimento);
  return snapshot.docs
    .map((documento) => ({ uid: documento.id, ...documento.data() }))
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
}

// Migrazione una tantum: porta dentro alla campagna indicata i dati che
// esistevano prima dell'introduzione delle campagne (personaggi e sessioni
// senza "campagnaId", più i vecchi documenti singoli "campagna/sessione" e
// "campagna/musica"). Va eseguita dal DM una sola volta, sulla prima campagna
// creata. Il filtro "manca campagnaId" è fatto lato client perché Firestore
// non permette di interrogare un campo assente.
export async function migraDatiEsistenti(campagnaId) {
  const batch = writeBatch(db);

  const tutteLeSchede = await getDocs(collection(db, "personaggi"));
  tutteLeSchede.docs.forEach((documento) => {
    if (!documento.data().campagnaId) {
      batch.update(doc(db, "personaggi", documento.id), { campagnaId });
    }
  });

  const tutteLeSessioni = await getDocs(collection(db, "registroSessioni"));
  tutteLeSessioni.docs.forEach((documento) => {
    if (!documento.data().campagnaId) {
      batch.update(doc(db, "registroSessioni", documento.id), {
        campagnaId,
        stato: documento.data().chiusaIl ? "chiusa" : "in-corso",
      });
    }
  });

  try {
    const vecchiaSessione = await getDoc(doc(db, "campagna", "sessione"));
    if (vecchiaSessione.exists()) {
      batch.set(doc(db, "campagne", campagnaId, "stato", "sessione"), vecchiaSessione.data());
    }
    const vecchiaMusica = await getDoc(doc(db, "campagna", "musica"));
    if (vecchiaMusica.exists()) {
      batch.set(doc(db, "campagne", campagnaId, "stato", "musica"), vecchiaMusica.data());
    }
  } catch (errore) {
    // La vecchia collezione "campagna" potrebbe non esistere più (regole già
    // aggiornate altrove): non è un problema, semplicemente non c'è nulla da
    // migrare su quel fronte.
    console.error(errore);
  }

  await batch.commit();
}

// Ogni utente può avere più schede personaggio (collezione "personaggi", un
// documento per scheda, con "proprietarioUid", "campagnaId" e un flag
// "attiva"). Solo una scheda per utente PER CAMPAGNA è "attiva" alla volta: è
// quella usata in sessione e visibile al DM.

// Elenca tutte le schede di un utente in una campagna (le proprie, o quelle
// di un giocatore se chi chiama è admin/DM). Ordinate per "ordine" (impostato
// riordinando le schede a mano) se tutte lo hanno già; finché anche una sola
// ne è priva (schede più vecchie di questa funzionalità, o mai riordinate) si
// torna all'ordine di creazione, così non serve una migrazione esplicita.
export async function elencaSchedePersonaggio(uid, campagnaId) {
  const riferimento = query(
    collection(db, "personaggi"),
    where("proprietarioUid", "==", uid),
    where("campagnaId", "==", campagnaId)
  );
  const snapshot = await getDocs(riferimento);
  const schede = snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
  const tutteOrdinate = schede.every((s) => typeof s.ordine === "number");
  return tutteOrdinate
    ? schede.sort((a, b) => a.ordine - b.ordine)
    : schede.sort((a, b) => (a.creataIl?.toMillis?.() ?? 0) - (b.creataIl?.toMillis?.() ?? 0));
}

// Crea una nuova scheda personaggio per un utente in una campagna. Se è la
// sua prima scheda IN QUELLA CAMPAGNA diventa automaticamente quella attiva.
export async function creaScheda(uid, campagnaId, dati) {
  const schedeEsistenti = await elencaSchedePersonaggio(uid, campagnaId);
  const riferimento = await addDoc(collection(db, "personaggi"), {
    ...dati,
    proprietarioUid: uid,
    campagnaId,
    attiva: schedeEsistenti.length === 0,
    ordine: schedeEsistenti.length,
    creataIl: serverTimestamp(),
    aggiornatoIl: serverTimestamp(),
  });
  return riferimento.id;
}

// Salva il nuovo ordine (drag & drop) di tutte le schede di un utente: idsInOrdine
// è l'elenco completo degli id nell'ordine desiderato.
export async function riordinaSchede(idsInOrdine) {
  const batch = writeBatch(db);
  idsInOrdine.forEach((id, indice) => {
    batch.update(doc(db, "personaggi", id), { ordine: indice });
  });
  await batch.commit();
}

// Recupera una scheda per id (di sola lettura per chi non è il proprietario:
// le regole di sicurezza impediscono comunque la lettura a chi non ha diritto).
export async function ottieniScheda(schedaId) {
  const snapshot = await getDoc(doc(db, "personaggi", schedaId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

// Restituisce la scheda attualmente attiva di un utente in una campagna, o
// null se non ne ha ancora creata nessuna lì (usata sia dal giocatore stesso,
// sia dal DM per vedere i PF in tabella).
export async function ottieniSchedaAttiva(uid, campagnaId) {
  const riferimento = query(
    collection(db, "personaggi"),
    where("proprietarioUid", "==", uid),
    where("campagnaId", "==", campagnaId),
    where("attiva", "==", true)
  );
  const snapshot = await getDocs(riferimento);
  if (snapshot.empty) return null;
  const documento = snapshot.docs[0];
  return { id: documento.id, ...documento.data() };
}

// Rende attiva una scheda tra quelle di un utente in una campagna, disattivando le altre.
export async function impostaSchedaAttiva(uid, campagnaId, schedaId) {
  const schede = await elencaSchedePersonaggio(uid, campagnaId);
  const batch = writeBatch(db);
  schede.forEach((scheda) => {
    batch.update(doc(db, "personaggi", scheda.id), { attiva: scheda.id === schedaId });
  });
  await batch.commit();
}

// Elimina una scheda personaggio. Se era quella attiva e ne restano altre
// nella stessa campagna, la prima rimasta diventa la nuova attiva (come già
// succede per la primissima scheda creata), per non lasciare l'utente senza
// un personaggio attivo.
export async function eliminaScheda(uid, campagnaId, schedaId) {
  const schede = await elencaSchedePersonaggio(uid, campagnaId);
  const scheda = schede.find((s) => s.id === schedaId);
  await deleteDoc(doc(db, "personaggi", schedaId));

  if (scheda?.attiva) {
    const restanti = schede.filter((s) => s.id !== schedaId);
    if (restanti.length > 0) {
      await updateDoc(doc(db, "personaggi", restanti[0].id), { attiva: true });
    }
  }
}

export async function aggiornaHp(schedaId, hp) {
  await updateDoc(doc(db, "personaggi", schedaId), { hp, aggiornatoIl: serverTimestamp() });
}

export async function aggiornaTiriSalvezzaMorte(schedaId, tiriSalvezzaMorte) {
  await updateDoc(doc(db, "personaggi", schedaId), { tiriSalvezzaMorte, aggiornatoIl: serverTimestamp() });
}

// Inventario di una scheda: array di { chiave, nome, categoria, quantita, bonusAttacco? }.
export async function aggiornaInventario(schedaId, inventario) {
  await updateDoc(doc(db, "personaggi", schedaId), { inventario, aggiornatoIl: serverTimestamp() });
}

// Aggiornamento generico di uno o più campi di una scheda (abilità competenti,
// personalità, talenti, competenze/linguaggi, monete, equipaggiamento indossato...).
export async function aggiornaScheda(schedaId, campi) {
  await updateDoc(doc(db, "personaggi", schedaId), { ...campi, aggiornatoIl: serverTimestamp() });
}

// Stato condiviso della sessione di gioco corrente per una campagna:
// "campagne/{campagnaId}/stato/sessione", con un interruttore manuale
// ("inCorso", attivato dal DM) e il riferimento alla voce di registro
// attualmente aperta.
export async function ottieniStatoSessione(campagnaId) {
  const snapshot = await getDoc(doc(db, "campagne", campagnaId, "stato", "sessione"));
  return snapshot.exists() ? snapshot.data() : { inCorso: false, sessioneAttivaId: null };
}

// Tutte le sessioni (di ogni stato: programmata/in-corso/chiusa) di una
// campagna. Il filtro è fatto solo su campagnaId (un'unica clausola "where",
// nessun indice composito necessario); l'ordinamento per numero è fatto lato
// client, come già altrove nel file.
async function elencaSessioniCampagna(campagnaId) {
  const riferimento = query(collection(db, "registroSessioni"), where("campagnaId", "==", campagnaId));
  const snapshot = await getDocs(riferimento);
  return snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
}

// Il DM programma una sessione futura: nasce come voce di registro con stato
// "programmata" e una data, ma senza appunti — diventerà quella "in corso"
// quando arriverà il momento (vedi apriSessione). Solo admin/DM (vedi
// firestore.rules).
export async function creaSessioneProgrammata(campagnaId, { titolo, dataProgrammata }) {
  const sessioni = await elencaSessioniCampagna(campagnaId);
  const prossimoNumero = sessioni.reduce((massimo, s) => Math.max(massimo, s.numero || 0), 0) + 1;
  const riferimento = await addDoc(collection(db, "registroSessioni"), {
    campagnaId,
    numero: prossimoNumero,
    titolo: titolo || null,
    stato: "programmata",
    dataProgrammata,
    apertaIl: null,
    chiusaIl: null,
  });
  return { id: riferimento.id, numero: prossimoNumero };
}

// Elenca le sole sessioni "programmata" di una campagna, più prossima prima.
export async function elencaSessioniProgrammate(campagnaId) {
  const sessioni = await elencaSessioniCampagna(campagnaId);
  return sessioni
    .filter((s) => s.stato === "programmata")
    .sort((a, b) => (a.dataProgrammata || "").localeCompare(b.dataProgrammata || ""));
}

export async function eliminaSessioneProgrammata(sessioneId) {
  await deleteDoc(doc(db, "registroSessioni", sessioneId));
}

// Il DM apre una nuova sessione per una campagna: se esiste già una sessione
// "programmata" in attesa, la promuove a "in-corso" (riusa numero e titolo
// già assegnati); altrimenti ne crea una nuova ad-hoc con numero progressivo.
// Da qui in poi gli appunti scritti da chiunque finiscono in questa voce.
// Solo admin/DM (vedi firestore.rules).
export async function apriSessione(campagnaId) {
  const sessioni = await elencaSessioniCampagna(campagnaId);
  const programmate = sessioni
    .filter((s) => s.stato === "programmata")
    .sort((a, b) => (a.dataProgrammata || "").localeCompare(b.dataProgrammata || ""));

  let sessioneId, numero;
  if (programmate.length > 0) {
    sessioneId = programmate[0].id;
    numero = programmate[0].numero;
    await updateDoc(doc(db, "registroSessioni", sessioneId), { stato: "in-corso", apertaIl: serverTimestamp() });
  } else {
    numero = sessioni.reduce((massimo, s) => Math.max(massimo, s.numero || 0), 0) + 1;
    const nuovaSessione = await addDoc(collection(db, "registroSessioni"), {
      campagnaId,
      numero,
      stato: "in-corso",
      apertaIl: serverTimestamp(),
      chiusaIl: null,
    });
    sessioneId = nuovaSessione.id;
  }

  await setDoc(
    doc(db, "campagne", campagnaId, "stato", "sessione"),
    { inCorso: true, sessioneAttivaId: sessioneId },
    { merge: true }
  );
  return { id: sessioneId, numero };
}

// Il DM chiude la sessione in corso: la voce di registro resta nello storico
// (sola lettura), l'interruttore torna spento.
export async function chiudiSessione(campagnaId, sessioneAttivaId) {
  if (sessioneAttivaId) {
    await updateDoc(doc(db, "registroSessioni", sessioneAttivaId), { stato: "chiusa", chiusaIl: serverTimestamp() });
  }
  await setDoc(
    doc(db, "campagne", campagnaId, "stato", "sessione"),
    { inCorso: false, sessioneAttivaId: null },
    { merge: true }
  );
}

// Aggiunge un appunto alla sessione indicata: chiunque sia autenticato può
// scriverne (DM e giocatori), sempre a proprio nome (vedi firestore.rules).
export async function aggiungiAppunto(sessioneId, autoreUid, autoreNome, testo) {
  await addDoc(collection(db, "registroSessioni", sessioneId, "appunti"), {
    autoreUid,
    autoreNome,
    testo,
    creatoIl: serverTimestamp(),
  });
}

// Ascolta in tempo reale gli appunti della sessione indicata (usata dalla
// pagina Sessione mentre è in corso, così tutti vedono comparire le note
// senza dover ricaricare la pagina). Restituisce la funzione per interrompere
// l'ascolto.
export function ascoltaAppunti(sessioneId, callback) {
  const riferimento = query(collection(db, "registroSessioni", sessioneId, "appunti"), orderBy("creatoIl", "asc"));
  return onSnapshot(riferimento, (snapshot) => {
    callback(snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() })));
  });
}

// Elenco delle sessioni passate o in corso (storico) di una campagna, più
// recente prima. Le sessioni ancora "programmata" (future) sono escluse: si
// vedono da elencaSessioniProgrammate. Gli appunti di ogni sessione si
// caricano a parte (elencaAppuntiSessione) solo quando l'utente apre quella
// voce: evita di scaricare tutto lo storico in un colpo solo, man mano che le
// sessioni si accumulano nel tempo.
export async function elencaRegistroSessioni(campagnaId) {
  const sessioni = await elencaSessioniCampagna(campagnaId);
  return sessioni
    .filter((s) => s.stato !== "programmata")
    .sort((a, b) => (b.numero || 0) - (a.numero || 0));
}

// Appunti di una singola sessione (lettura una tantum, per lo storico: non
// serve il tempo reale su una sessione già conclusa).
export async function elencaAppuntiSessione(sessioneId) {
  const riferimento = query(collection(db, "registroSessioni", sessioneId, "appunti"), orderBy("creatoIl", "asc"));
  const snapshot = await getDocs(riferimento);
  return snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
}

// Stato condiviso della musica di sessione per una campagna:
// "campagne/{campagnaId}/stato/musica", con la sorgente attualmente trasmessa
// ai giocatori ("spotify"/"youtube"/null) e uno snapshot per ciascuna sorgente
// (scritto dal browser del DM, che è l'unico ad avere accesso diretto a
// Spotify/YouTube).
export async function ottieniStatoMusica(campagnaId) {
  const snapshot = await getDoc(doc(db, "campagne", campagnaId, "stato", "musica"));
  return snapshot.exists() ? snapshot.data() : { sorgente: null };
}

// Solo admin/DM possono scrivere (vedi firestore.rules). Merge così sorgente
// e snapshot dei brani si aggiornano indipendentemente.
export async function salvaStatoMusica(campagnaId, campi) {
  await setDoc(doc(db, "campagne", campagnaId, "stato", "musica"), campi, { merge: true });
}

// Ascolta in tempo reale lo stato della musica: usata dal pannello "Musica di
// sessione" in dashboard, così ogni giocatore vede comparire cambi di brano o
// di sorgente senza dover ricaricare. Restituisce la funzione per interrompere
// l'ascolto.
export function ascoltaStatoMusica(campagnaId, callback) {
  return onSnapshot(doc(db, "campagne", campagnaId, "stato", "musica"), (snapshot) => {
    callback(snapshot.exists() ? snapshot.data() : { sorgente: null });
  });
}

// Roster del party di una campagna con la scheda attiva di ciascun membro
// (nome personaggio, classe, PF): usato dalla pagina Sessione, visibile a
// tutti — una scheda "attiva" è leggibile da chiunque sia autenticato, non
// solo dal proprietario o da admin/DM (vedi firestore.rules).
export async function elencaPartyConSchede(campagnaId) {
  const giocatori = await elencaMembriCampagna(campagnaId);
  return Promise.all(
    giocatori.map(async (giocatore) => ({
      ...giocatore,
      schedaAttiva: await ottieniSchedaAttiva(giocatore.uid, campagnaId),
    }))
  );
}

// Blocca l'accesso a una pagina finché non si conosce lo stato di autenticazione,
// poi esegue la callback con (user, profilo). Se non autenticato, reindirizza al
// login; se autenticato ma con email non verificata, reindirizza alla pagina di
// verifica (usata da tutte le pagine "vere" dell'app, non da verifica-email.html).
export function proteggiPagina(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    if (!user.emailVerified) {
      window.location.href = "verifica-email.html";
      return;
    }
    const profilo = await ottieniProfiloUtente(user.uid);
    // A questo punto sappiamo per certo che l'email è verificata: se il documento
    // Firestore non lo riflette ancora (account creato prima di questa funzione,
    // o verificato in un'altra scheda), lo allineiamo. Non blocca il rendering.
    if (profilo && profilo.emailVerificata !== true) {
      profilo.emailVerificata = true;
      updateDoc(doc(db, "users", user.uid), { emailVerificata: true }).catch((errore) =>
        console.error(errore)
      );
    }
    // Se l'utente ha completato un cambio email (verifyBeforeUpdateEmail), l'indirizzo
    // su Authentication è già aggiornato: allineiamo la copia su Firestore.
    if (profilo && user.email && profilo.email !== user.email) {
      profilo.email = user.email;
      updateDoc(doc(db, "users", user.uid), { email: user.email }).catch((errore) =>
        console.error(errore)
      );
    }
    callback(user, profilo);
  });
}

// Come proteggiPagina, ma SENZA richiedere l'email verificata: usata solo dalla
// pagina di verifica stessa, che deve restare accessibile a chi non l'ha ancora fatto.
export function proteggiPaginaSenzaVerifica(callback) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    callback(user);
  });
}

// Come proteggiPagina, ma riservata alle sole pagine admin: chi non ha
// ruolo "admin" viene rimandato alla dashboard.
export function proteggiPaginaAdmin(callback) {
  proteggiPagina((user, profilo) => {
    if (profilo?.ruolo !== ROLES.ADMIN) {
      window.location.href = "dashboard.html";
      return;
    }
    callback(user, profilo);
  });
}

// Come proteggiPagina, ma riservata alle pagine del Dungeon Master
// (accessibile anche all'admin). Chi non ha questi ruoli viene rimandato alla dashboard.
export function proteggiPaginaDM(callback) {
  proteggiPagina((user, profilo) => {
    if (profilo?.ruolo !== ROLES.DM && profilo?.ruolo !== ROLES.ADMIN) {
      window.location.href = "dashboard.html";
      return;
    }
    callback(user, profilo);
  });
}
