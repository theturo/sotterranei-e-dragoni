// Funzioni condivise di autenticazione e gestione ruoli.
import { auth, db } from "./firebase-config.js";
import { eliminaImmagine, percorsiRitratto } from "./immagini.js";
import { codificaCelle, decodificaCelle } from "./mappa-calcoli.js";
import { etichettaDiario } from "./bestiario-calcoli.js";
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
  runTransaction,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  documentId,
  getCountFromServer,
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

// Crea un nuovo account e il relativo documento utente in Firestore. Chiunque si
// registri nasce "player" in attesa di approvazione: il ruolo admin/DM e
// l'approvazione li assegna solo un admin (le regole di sicurezza rifiutano
// qualsiasi altro valore, anche se qualcuno scrivesse al database a mano).
export async function registraUtente({ nome, email, password }) {
  const credenziali = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credenziali.user, { displayName: nome });
  await sendEmailVerification(credenziali.user);

  await setDoc(doc(db, "users", credenziali.user.uid), {
    nome,
    // L'email normalizzata da Firebase Authentication, che le regole
    // confrontano con quella del token.
    email: credenziali.user.email,
    ruolo: ROLES.PLAYER,
    livello: 1,
    livelliDaSpendere: 0,
    emailVerificata: false,
    approvato: false,
    creatoIl: serverTimestamp(),
  });

  return { uid: credenziali.user.uid, ruolo: ROLES.PLAYER };
}

// Un profilo è approvato se l'admin l'ha approvato, oppure se è stato creato
// prima che esistesse l'approvazione (nessun campo "approvato").
export function profiloApprovato(profilo) {
  return profilo?.approvato !== false;
}

// Quanti iscritti aspettano l'approvazione dell'admin. È una query di
// conteggio: Firestore la fattura come una sola lettura ogni 1000 documenti
// contati, invece di leggere i profili uno per uno.
export async function contaUtentiInAttesa() {
  const snapshot = await getCountFromServer(query(collection(db, "users"), where("approvato", "==", false)));
  return snapshot.data().count;
}

// L'admin approva un nuovo iscritto (vedi firestore.rules).
export async function approvaUtente(uid) {
  await updateDoc(doc(db, "users", uid), { approvato: true });
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
// Chi il DM può mettere nel party: i giocatori e anche gli admin (un admin
// della piattaforma può giocare nella campagna di un altro), approvati, tranne
// il DM stesso.
export async function elencaGiocatori(escludiUid = null) {
  const riferimento = query(collection(db, "users"), where("ruolo", "in", [ROLES.PLAYER, ROLES.ADMIN]));
  const snapshot = await getDocs(riferimento);
  return snapshot.docs
    .map((documento) => ({ uid: documento.id, ...documento.data() }))
    .filter((u) => u.uid !== escludiUid && u.approvato !== false)
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
}

// Il giocatore applica un passaggio di livello a una propria scheda, consumando
// un credito "livelliDaSpendere" concesso dal DM. Le due scritture DEVONO
// avvenire insieme (batch atomico): le regole di sicurezza accettano il +1 al
// livello della scheda solo se, nella stessa operazione, il credito scende di 1.
// "campi" contiene gli altri campi aggiornati dalla procedura (PF, caratteristiche...).
export async function applicaPassaggioLivello(scheda, campi) {
  const batch = writeBatch(db);
  batch.update(doc(db, "personaggi", scheda.id), {
    ...campi,
    livello: (scheda.livello || 1) + 1,
    aggiornatoIl: serverTimestamp(),
  });
  batch.update(doc(db, "users", scheda.proprietarioUid), { livelliDaSpendere: increment(-1) });
  await batch.commit();
  await sincronizzaRiepilogoParty({ ...scheda, ...campi, livello: (scheda.livello || 1) + 1 });
}

// Il DM segnala che un giocatore è salito di livello (solo DM/admin, vedi firestore.rules).
// livelloAttuale è il livello mostrato in UI prima dell'aggiornamento, usato solo
// per scrivere un testo leggibile nella notifica (es. "2 → 3"); quanti è il
// numero di livelli concessi in una volta (es. livello di partenza della campagna).
export async function segnalaLivelloSu(uid, livelloAttuale, quanti = 1) {
  const livelloPrecedente = livelloAttuale ?? 1;
  await updateDoc(doc(db, "users", uid), {
    livello: increment(quanti),
    livelliDaSpendere: increment(quanti),
  });
  await addDoc(collection(db, "users", uid, "notifiche"), {
    tipo: "livello_su",
    livelloPrecedente,
    livelloNuovo: livelloPrecedente + quanti,
    letta: false,
    creataIl: serverTimestamp(),
  });
}

// L'admin chiede di eliminare un utente: la Cloud Function eliminaUtente
// esegue la richiesta e scrive l'esito ("stato": completata | errore).
// Una richiesta precedente (es. finita in errore) si toglie prima di rifarla.
export async function richiediEliminazioneUtente(uid, adminUid) {
  const riferimento = doc(db, "richiesteEliminazione", uid);
  const precedente = await getDoc(riferimento);
  if (precedente.exists()) await deleteDoc(riferimento);
  await setDoc(riferimento, { richiestaDa: adminUid, richiestaIl: serverTimestamp() });
}

export function ascoltaRichiestaEliminazione(uid, callback, alErrore = (e) => console.error(e)) {
  return onSnapshot(doc(db, "richiesteEliminazione", uid), (snapshot) => callback(snapshot.data() || null), alErrore);
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
// membri. Più campagne possono essere "attive" insieme (gruppi diversi in
// parallelo): ognuno sceglie dal selettore su quale lavorare (la scelta resta
// in questo browser, vedi scegliCampagna) ed è quella a determinare party,
// personaggi e registro sessioni mostrati.
//
// Titolo provvisorio: finché la campagna non viene "rivelata", il titolo vero
// vive SOLO in "campagne/{id}/privato/titolo" (leggibile dal DM e dall'admin),
// mentre il campo pubblico "titolo" resta null — i giocatori membri possono
// leggere il documento della campagna, quindi non deve contenerlo.
export async function creaCampagna(dmUid, { titolo, titoloProvvisorio }) {
  const riferimento = doc(collection(db, "campagne"));
  const batch = writeBatch(db);
  batch.set(riferimento, {
    titolo: titoloProvvisorio ? null : titolo,
    titoloProvvisorio: !!titoloProvvisorio,
    dmUid,
    membriUid: [],
    stato: "pianificazione",
    creataIl: serverTimestamp(),
  });
  batch.set(doc(db, "campagne", riferimento.id, "privato", "titolo"), { titolo });
  await batch.commit();
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

// Come elencaCampagneDM, ma con il titolo VERO di ogni campagna (per il
// pannello del DM). Le campagne create prima del titolo privato vengono
// sistemate qui la prima volta: il titolo passa nel documento privato e, se
// provvisorio, sparisce da quello pubblico.
export async function elencaCampagneDMConTitolo(dmUid) {
  const campagne = await elencaCampagneDM(dmUid);
  return Promise.all(
    campagne.map(async (campagna) => {
      const privato = await getDoc(doc(db, "campagne", campagna.id, "privato", "titolo"));
      if (privato.exists()) return { ...campagna, titolo: privato.data().titolo };

      const titolo = campagna.titolo || "";
      const batch = writeBatch(db);
      batch.set(doc(db, "campagne", campagna.id, "privato", "titolo"), { titolo });
      if (campagna.titoloProvvisorio && campagna.titolo) {
        batch.update(doc(db, "campagne", campagna.id), { titolo: null });
      }
      await batch.commit();
      return { ...campagna, titolo };
    })
  );
}

// Aggiorna titolo e/o stato "provvisorio" di una campagna, tenendo allineati
// il documento privato (sempre il titolo vero) e quello pubblico (il titolo
// solo se rivelato). Rivelare = passare titoloProvvisorio a false.
export async function aggiornaTitoloCampagna(campagnaId, { titolo, titoloProvvisorio }) {
  const batch = writeBatch(db);
  batch.set(doc(db, "campagne", campagnaId, "privato", "titolo"), { titolo });
  batch.update(doc(db, "campagne", campagnaId), {
    titolo: titoloProvvisorio ? null : titolo,
    titoloProvvisorio: !!titoloProvvisorio,
  });
  await batch.commit();
}

// Il ruolo dipende dalla campagna, non dal profilo: si è DM di quelle che si
// guidano e giocatori di quelle di cui si è membri (un admin o un DM può
// giocare nella campagna di un altro).
export const ruoloNellaCampagna = (campagna, uid) => (campagna?.dmUid === uid ? ROLES.DM : ROLES.PLAYER);

// Campagne attive dell'utente, ognuna con "mioRuolo": per DM e admin quelle
// che guidano più quelle in cui giocano, per un giocatore quelle di cui è
// membro. "soloDM": solo quelle che guida (pagine riservate al DM). Più
// vecchia prima. Il filtro per stato è fatto lato client (niente indice
// composito: sono pochissime).
export async function elencaCampagneAttive(uid, ruolo, { soloDM = false } = {}) {
  const query1 = query(collection(db, "campagne"), where("dmUid", "==", uid));
  const query2 = query(collection(db, "campagne"), where("membriUid", "array-contains", uid));
  const interrogazioni = ruolo === ROLES.PLAYER ? [query2] : soloDM ? [query1] : [query1, query2];
  const risultati = await Promise.all(interrogazioni.map((q) => getDocs(q)));
  const viste = new Map();
  risultati.flatMap((r) => r.docs).forEach((documento) => {
    if (documento.data().stato === "attiva") viste.set(documento.id, { id: documento.id, ...documento.data() });
  });
  return [...viste.values()]
    .map((c) => ({ ...c, mioRuolo: ruoloNellaCampagna(c, uid) }))
    .sort((a, b) => (a.creataIl?.toMillis?.() ?? 0) - (b.creataIl?.toMillis?.() ?? 0));
}

// Campagna su cui si sta lavorando, scelta dal selettore e ricordata in
// questo browser (per utente).
const chiaveCampagna = (uid) => `sed-campagna-${uid}`;
export function campagnaScelta(uid) {
  try {
    return localStorage.getItem(chiaveCampagna(uid));
  } catch {
    return null;
  }
}
export function scegliCampagna(uid, campagnaId) {
  try {
    localStorage.setItem(chiaveCampagna(uid), campagnaId);
  } catch {
    // Non salvata: si torna alla prima campagna attiva.
  }
}

// La campagna corrente: quella scelta, se è ancora attiva, altrimenti la
// prima attiva. null se non ce n'è (prima configurazione, giocatore non
// ancora invitato a nessuna campagna).
export async function ottieniCampagnaCorrente(uid, ruolo, opzioni = {}) {
  const attive = await elencaCampagneAttive(uid, ruolo, opzioni);
  const scelta = campagnaScelta(uid);
  return attive.find((c) => c.id === scelta) || attive[0] || null;
}

export async function ottieniCampagna(campagnaId) {
  const snapshot = await getDoc(doc(db, "campagne", campagnaId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

// Livello di partenza: il DM porta tutto il party al livello scelto. A ogni
// membro arrivano, con un solo avviso, i crediti che mancano rispetto al
// livello della scheda attiva più i crediti ancora da spendere; chi è già a
// quel livello (o oltre) non riceve nulla. Il livello resta sulla campagna
// ("livelloPartenza") per la guida alla creazione dei personaggi.
// Restituisce [{ uid, nome, concessi }] oppure { uid, nome, errore }.
export async function impostaLivelloPartenza(campagnaId, livello) {
  await updateDoc(doc(db, "campagne", campagnaId), { livelloPartenza: livello });
  const membri = await elencaMembriCampagna(campagnaId);
  return Promise.all(membri.map(async (membro) => {
    try {
      const scheda = await ottieniSchedaAttiva(membro.uid, campagnaId);
      const raggiunto = (scheda?.livello || 1) + (membro.livelliDaSpendere || 0);
      const concessi = Math.max(0, livello - raggiunto);
      if (concessi > 0) await segnalaLivelloSu(membro.uid, raggiunto, concessi);
      return { uid: membro.uid, nome: membro.nome, concessi };
    } catch (errore) {
      console.error(errore);
      return { uid: membro.uid, nome: membro.nome, errore };
    }
  }));
}

export async function aggiornaCampagna(campagnaId, campi) {
  await updateDoc(doc(db, "campagne", campagnaId), campi);
}

// Rende attiva una campagna di un DM (le altre attive restano tali: si
// possono guidare più gruppi insieme) e la sceglie come campagna corrente.
export async function impostaCampagnaAttiva(dmUid, campagnaId) {
  await updateDoc(doc(db, "campagne", campagnaId), { stato: "attiva" });
  scegliCampagna(dmUid, campagnaId);
}

// Mette da parte una campagna attiva (non "conclusa": si potrà riprendere).
export async function mettiInPausaCampagna(campagnaId) {
  await updateDoc(doc(db, "campagne", campagnaId), { stato: "in pausa" });
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
  if (schedeEsistenti.length === 0) await sincronizzaRiepilogoUtente(uid, campagnaId);
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
  await sincronizzaRiepilogoUtente(uid, campagnaId);
}

// Elimina una scheda personaggio. Se era quella attiva e ne restano altre
// nella stessa campagna, la prima rimasta diventa la nuova attiva (come già
// succede per la primissima scheda creata), per non lasciare l'utente senza
// un personaggio attivo.
export async function eliminaScheda(uid, campagnaId, schedaId) {
  const schede = await elencaSchedePersonaggio(uid, campagnaId);
  const scheda = schede.find((s) => s.id === schedaId);
  await deleteDoc(doc(db, "personaggi", schedaId));
  if (scheda?.ritratto) {
    // Via anche i file del ritratto (senza bloccare se non riesce).
    const { grande, icona } = percorsiRitratto(uid, schedaId, scheda.ritratto);
    await Promise.all([eliminaImmagine(grande), eliminaImmagine(icona)]).catch((errore) => console.error(errore));
  }

  if (scheda?.attiva) {
    const restanti = schede.filter((s) => s.id !== schedaId);
    if (restanti.length > 0) {
      await updateDoc(doc(db, "personaggi", restanti[0].id), { attiva: true });
    }
    await sincronizzaRiepilogoUtente(uid, campagnaId);
  }
}

// Riceve la scheda intera (non solo l'id) per poter aggiornare anche il
// riepilogo del party, se è quella attiva.
export async function aggiornaHp(scheda, hp) {
  await updateDoc(doc(db, "personaggi", scheda.id), { hp, aggiornatoIl: serverTimestamp() });
  await sincronizzaRiepilogoParty({ ...scheda, hp });
}

export async function aggiornaTiriSalvezzaMorte(schedaId, tiriSalvezzaMorte) {
  await updateDoc(doc(db, "personaggi", schedaId), { tiriSalvezzaMorte, aggiornatoIl: serverTimestamp() });
}

// Inventario di una scheda: array di { chiave, nome, categoria, quantita, bonusAttacco? }.
export async function aggiornaInventario(schedaId, inventario) {
  await updateDoc(doc(db, "personaggi", schedaId), { inventario, aggiornatoIl: serverTimestamp() });
}

// Imposta (o toglie, con null) la versione del ritratto di una scheda, dopo
// averne caricato i file (vedi immagini.js), e aggiorna il riepilogo del party.
export async function impostaRitratto(scheda, versione) {
  await updateDoc(doc(db, "personaggi", scheda.id), { ritratto: versione, aggiornatoIl: serverTimestamp() });
  await sincronizzaRiepilogoParty({ ...scheda, ritratto: versione });
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

// La sessione in corso ({ id, numero }), o null se non ce n'è una.
export async function sessioneInCorso(campagnaId) {
  const stato = await ottieniStatoSessione(campagnaId);
  if (!stato.inCorso || !stato.sessioneAttivaId) return null;
  const sessione = await getDoc(doc(db, "registroSessioni", stato.sessioneAttivaId));
  return { id: stato.sessioneAttivaId, numero: sessione.exists() ? sessione.data().numero ?? null : null };
}

// Tutte le sessioni (di ogni stato: programmata/in-corso/chiusa) di una
// campagna. Il filtro è fatto solo su campagnaId (un'unica clausola "where",
// nessun indice composito necessario); l'ordinamento per numero è fatto lato
// client, come già altrove nel file.
export async function elencaSessioniCampagna(campagnaId) {
  const riferimento = query(collection(db, "registroSessioni"), where("campagnaId", "==", campagnaId));
  const snapshot = await getDocs(riferimento);
  return snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
}

// ---------- Numerazione delle sessioni ----------
// Il numero progressivo si assegna in una transazione che legge e aggiorna il
// contatore "ultimoNumero" in campagne/{id}/stato/sessione: se due richieste
// arrivano insieme (doppio clic, due schede aperte), Firestore ripete la
// seconda con il contatore già aggiornato, quindi i numeri non si ripetono.
// Per le campagne nate prima del contatore si parte dal numero più alto già
// presente nel registro.

const riferimentoStatoSessione = (campagnaId) => doc(db, "campagne", campagnaId, "stato", "sessione");

function numeroPiuAlto(sessioni) {
  return sessioni.reduce((massimo, s) => Math.max(massimo, s.numero || 0), 0);
}

// Da chiamare dentro una transazione: prenota il prossimo numero.
async function prenotaNumero(transazione, campagnaId, sessioni) {
  const stato = await transazione.get(riferimentoStatoSessione(campagnaId));
  const numero = Math.max(stato.data()?.ultimoNumero ?? 0, numeroPiuAlto(sessioni)) + 1;
  return { numero, stato: stato.data() || {} };
}

// Il DM programma una sessione futura: nasce come voce di registro con stato
// "programmata" e una data, ma senza appunti — diventerà quella "in corso"
// quando arriverà il momento (vedi apriSessione). Solo admin/DM (vedi
// firestore.rules).
export async function creaSessioneProgrammata(campagnaId, { titolo, dataProgrammata, oraProgrammata = null }) {
  const sessioni = await elencaSessioniCampagna(campagnaId);
  const nuova = doc(collection(db, "registroSessioni"));
  const numero = await runTransaction(db, async (transazione) => {
    const { numero } = await prenotaNumero(transazione, campagnaId, sessioni);
    transazione.set(riferimentoStatoSessione(campagnaId), { ultimoNumero: numero }, { merge: true });
    transazione.set(nuova, {
      campagnaId,
      numero,
      titolo: titolo || null,
      stato: "programmata",
      dataProgrammata,
      oraProgrammata: oraProgrammata || null,
      apertaIl: null,
      chiusaIl: null,
    });
    return numero;
  });
  return { id: nuova.id, numero };
}

// Elenca le sole sessioni "programmata" di una campagna, più prossima prima.
export async function elencaSessioniProgrammate(campagnaId) {
  const sessioni = await elencaSessioniCampagna(campagnaId);
  return sessioni
    .filter((s) => s.stato === "programmata")
    .sort((a, b) => (a.dataProgrammata || "").localeCompare(b.dataProgrammata || ""));
}

// Annulla una sessione pianificata. Se era l'ultima numerata, il contatore
// riparte dal numero più alto rimasto, così la prossima non lascia buchi.
export async function eliminaSessioneProgrammata(campagnaId, sessioneId) {
  const riferimento = doc(db, "registroSessioni", sessioneId);
  const altre = (await elencaSessioniCampagna(campagnaId)).filter((s) => s.id !== sessioneId);
  await runTransaction(db, async (transazione) => {
    const [sessione, stato] = await Promise.all([
      transazione.get(riferimento),
      transazione.get(riferimentoStatoSessione(campagnaId)),
    ]);
    if (!sessione.exists()) return;
    const numero = sessione.data().numero;
    if (numero && stato.data()?.ultimoNumero === numero) {
      transazione.set(riferimentoStatoSessione(campagnaId), { ultimoNumero: numeroPiuAlto(altre) }, { merge: true });
    }
    transazione.delete(riferimento);
  });
}

// Il DM elimina sessioni dal registro (es. quelle di prova), anche già
// chiuse: con loro spariscono appunti, tiri e tiri nascosti; la libreria
// dimentica dove erano state mostrate o collegate; se una era in corso la
// sessione si chiude; il contatore riparte dal numero più alto rimasto (se
// non ne resta nessuna, la prossima sarà la n. 1).
export async function eliminaSessioni(campagnaId, sessioniId) {
  const daEliminare = new Set(sessioniId);
  for (const sessioneId of daEliminare) {
    const [appunti, nascosti, mostrati, collegati] = await Promise.all([
      getDocs(collection(db, "registroSessioni", sessioneId, "appunti")),
      getDocs(collection(db, "registroSessioni", sessioneId, "tiriNascosti")),
      getDocs(query(collection(db, "campagne", campagnaId, "immagini"), where("sessioniMostrata", "array-contains", sessioneId))),
      getDocs(query(collection(db, "campagne", campagnaId, "immaginiDM"), where("sessioniCollegate", "array-contains", sessioneId))),
    ]);
    // A blocchi: una scrittura atomica accetta al massimo 500 operazioni.
    const operazioni = [
      ...appunti.docs.map((d) => (b) => b.delete(d.ref)),
      ...nascosti.docs.map((d) => (b) => b.delete(d.ref)),
      ...mostrati.docs.map((d) => (b) => b.update(d.ref, { sessioniMostrata: arrayRemove(sessioneId) })),
      ...collegati.docs.map((d) => (b) => b.update(d.ref, { sessioniCollegate: arrayRemove(sessioneId) })),
    ];
    for (let i = 0; i < operazioni.length; i += 450) {
      const batch = writeBatch(db);
      operazioni.slice(i, i + 450).forEach((op) => op(batch));
      await batch.commit();
    }
  }
  const rimaste = (await elencaSessioniCampagna(campagnaId)).filter((s) => !daEliminare.has(s.id));
  await runTransaction(db, async (transazione) => {
    const stato = await transazione.get(riferimentoStatoSessione(campagnaId));
    const aggiornamento = { ultimoNumero: numeroPiuAlto(rimaste) };
    if (daEliminare.has(stato.data()?.sessioneAttivaId)) Object.assign(aggiornamento, { inCorso: false, sessioneAttivaId: null });
    transazione.set(riferimentoStatoSessione(campagnaId), aggiornamento, { merge: true });
    daEliminare.forEach((id) => transazione.delete(doc(db, "registroSessioni", id)));
  });
}

// Il DM apre una nuova sessione per una campagna: se esiste già una sessione
// "programmata" in attesa, la promuove a "in-corso" (riusa numero e titolo
// già assegnati); altrimenti ne crea una nuova ad-hoc con numero progressivo.
// Se una sessione è già in corso (doppio clic, altra scheda) non ne apre
// un'altra: restituisce quella. Da qui in poi gli appunti scritti da chiunque
// finiscono in questa voce. Ai membri arriva l'avviso "la sessione è
// iniziata" (campanella e notifica push). Solo admin/DM (vedi firestore.rules).
export async function apriSessione(campagnaId) {
  const sessioni = await elencaSessioniCampagna(campagnaId);
  const programmate = sessioni
    .filter((s) => s.stato === "programmata")
    .sort((a, b) => (a.dataProgrammata || "").localeCompare(b.dataProgrammata || ""));

  const aperta = await runTransaction(db, async (transazione) => {
    const { numero: prossimo, stato } = await prenotaNumero(transazione, campagnaId, sessioni);
    if (stato.inCorso && stato.sessioneAttivaId) {
      const giaAperta = sessioni.find((s) => s.id === stato.sessioneAttivaId);
      return { id: stato.sessioneAttivaId, numero: giaAperta?.numero ?? null, giaAperta: true };
    }

    // La prima pianificata ancora tale (riletta nella transazione).
    let scelta = null;
    for (const candidata of programmate) {
      const attuale = await transazione.get(doc(db, "registroSessioni", candidata.id));
      if (attuale.exists() && attuale.data().stato === "programmata") {
        scelta = { id: candidata.id, numero: attuale.data().numero, titolo: attuale.data().titolo || null };
        break;
      }
    }

    let sessioneId, numero;
    if (scelta) {
      ({ id: sessioneId, numero } = scelta);
      transazione.update(doc(db, "registroSessioni", sessioneId), { stato: "in-corso", apertaIl: serverTimestamp() });
    } else {
      numero = prossimo;
      const nuova = doc(collection(db, "registroSessioni"));
      sessioneId = nuova.id;
      transazione.set(nuova, {
        campagnaId,
        numero,
        stato: "in-corso",
        apertaIl: serverTimestamp(),
        chiusaIl: null,
      });
    }

    transazione.set(
      riferimentoStatoSessione(campagnaId),
      { inCorso: true, sessioneAttivaId: sessioneId, ...(scelta ? {} : { ultimoNumero: numero }) },
      { merge: true }
    );
    return { id: sessioneId, numero, titolo: scelta?.titolo ?? null };
  });
  if (!aperta.giaAperta) {
    await notificaMembri(campagnaId, { tipo: "sessione_iniziata", numero: aperta.numero, titolo: aperta.titolo });
  }
  return { id: aperta.id, numero: aperta.numero };
}

// Il DM chiude la sessione in corso: i contenuti mostrati vanno in archivio
// (vedi archiviaContenutiMostrati), la voce di registro resta nello storico
// (sola lettura), l'interruttore torna spento.
export async function chiudiSessione(campagnaId, sessioneAttivaId) {
  await archiviaContenutiMostrati(campagnaId, sessioneAttivaId);
  if (sessioneAttivaId) {
    await updateDoc(doc(db, "registroSessioni", sessioneAttivaId), { stato: "chiusa", chiusaIl: serverTimestamp() });
  }
  await setDoc(
    doc(db, "campagne", campagnaId, "stato", "sessione"),
    { inCorso: false, sessioneAttivaId: null },
    { merge: true }
  );
}

// Aggiunge un appunto alla sessione indicata: ogni utente approvato può
// scriverne (DM e giocatori), sempre a proprio nome — le regole verificano che
// autoreNome coincida con il nome del profilo (vedi firestore.rules).
// "tipo": null per gli appunti scritti a mano, "riposo" per quelli dei riposi.
export async function aggiungiAppunto(sessioneId, autoreUid, autoreNome, testo, tipo = null) {
  await addDoc(collection(db, "registroSessioni", sessioneId, "appunti"), {
    autoreUid,
    autoreNome,
    testo,
    ...(tipo ? { tipo } : {}),
    creatoIl: serverTimestamp(),
  });
}

// ---------- Lancio dei dadi condiviso ----------

// Un tiro di dadi nel registro della sessione: negli appunti (visibile a
// tutti) o, per il DM, tra i tiri nascosti (visibili solo a lui).
export async function aggiungiTiro(sessioneId, autoreUid, autoreNome, testo, tiro, nascosto = false) {
  await addDoc(collection(db, "registroSessioni", sessioneId, nascosto ? "tiriNascosti" : "appunti"), {
    autoreUid,
    autoreNome,
    testo: testo.slice(0, 2000),
    tipo: "tiro",
    tiro,
    creatoIl: serverTimestamp(),
  });
}

// Dalla scheda: annota il tiro se c'è una sessione in corso. Restituisce
// true se è finito nel registro, false se è rimasto solo per chi l'ha tirato.
export async function annotaTiro(campagnaId, autoreUid, autoreNome, testo, tiro) {
  try {
    const stato = await ottieniStatoSessione(campagnaId);
    if (!stato.inCorso || !stato.sessioneAttivaId) return false;
    await aggiungiTiro(stato.sessioneAttivaId, autoreUid, autoreNome, testo, tiro);
    return true;
  } catch (errore) {
    console.error(errore);
    return false;
  }
}

export function ascoltaTiriNascosti(sessioneId, callback, alErrore = (e) => console.error(e)) {
  const riferimento = query(collection(db, "registroSessioni", sessioneId, "tiriNascosti"), orderBy("creatoIl", "asc"));
  return onSnapshot(riferimento, (snapshot) => {
    callback(snapshot.docs.map((documento) => ({ id: documento.id, nascosto: true, ...documento.data() })));
  }, alErrore);
}

// Iniziativa tirata dalla scheda: se c'è un combattimento con il personaggio
// del giocatore, la scrive anche nel tracker. Restituisce true se l'ha scritta.
export async function iniziativaNelTracker(campagnaId, uid, iniziativa, bonus) {
  try {
    const [stato, combattente] = await Promise.all([
      getDoc(doc(db, "campagne", campagnaId, "combattimento", "stato")),
      getDoc(doc(db, "campagne", campagnaId, "combattenti", `pg-${uid}`)),
    ]);
    if (!stato.exists() || !stato.data().attivo || !combattente.exists()) return false;
    await impostaIniziativa(campagnaId, `pg-${uid}`, iniziativa, bonus);
    return true;
  } catch (errore) {
    console.error(errore);
    return false;
  }
}

// Moderazione: il DM (o l'admin) elimina un appunto.
export async function eliminaAppunto(sessioneId, appuntoId, collezione = "appunti") {
  await deleteDoc(doc(db, "registroSessioni", sessioneId, collezione, appuntoId));
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

// Link YouTube salvati dal DM (campagne/{c}/privato/musica): solo il DM li
// legge, così i nomi delle tracce non anticipano nulla ai giocatori.
export async function ottieniLinkMusica(campagnaId) {
  const snapshot = await getDoc(doc(db, "campagne", campagnaId, "privato", "musica"));
  return snapshot.exists() ? snapshot.data() : {};
}

export async function salvaLinkMusica(campagnaId, youtube) {
  await setDoc(doc(db, "campagne", campagnaId, "privato", "musica"), { youtube });
}

// Ascolta in tempo reale lo stato della musica: usata dal pannello "Musica di
// sessione" in dashboard, così ogni giocatore vede comparire cambi di brano o
// di sorgente senza dover ricaricare. Restituisce la funzione per interrompere
// l'ascolto.
export function ascoltaStatoMusica(campagnaId, callback, alErrore = (errore) => console.error(errore)) {
  return onSnapshot(
    doc(db, "campagne", campagnaId, "stato", "musica"),
    (snapshot) => callback(snapshot.exists() ? snapshot.data() : { sorgente: null }),
    alErrore
  );
}

// ---------- Riepilogo pubblico del party ----------
// I giocatori non possono leggere le schede complete degli altri né i loro
// profili (con l'email): per la pagina Sessione esiste un riepilogo per membro,
// "campagne/{campagnaId}/party/{uid}", con solo nome del giocatore e nome,
// classe, livello e PF della scheda attiva. Lo scrive il giocatore stesso a
// ogni modifica rilevante della propria scheda attiva (o il DM, rigenerandoli
// tutti); le regole di sicurezza verificano che coincida con la scheda vera.

// Nomi dei profili già letti, per non rileggerli a ogni aggiornamento dei PF.
const cacheNomiProfilo = new Map();

async function nomeProfilo(uid) {
  if (!cacheNomiProfilo.has(uid)) {
    const profilo = await ottieniProfiloUtente(uid);
    cacheNomiProfilo.set(uid, profilo?.nome ?? null);
  }
  return cacheNomiProfilo.get(uid);
}

function datiRiepilogo(nomeGiocatore, scheda) {
  return {
    nomeGiocatore,
    schedaId: scheda?.id ?? null,
    nomePersonaggio: scheda ? scheda.nome ?? null : null,
    classe: scheda ? scheda.classe ?? null : null,
    livello: scheda ? scheda.livello ?? null : null,
    hp: scheda ? scheda.hp ?? null : null,
    ritratto: scheda ? scheda.ritratto ?? null : null,
    condizioni: scheda ? scheda.condizioni ?? [] : [],
    esaurimento: scheda ? scheda.esaurimento ?? 0 : 0,
    dadiVitaSpesi: scheda ? scheda.dadiVitaSpesi ?? 0 : 0,
    usiPrivilegi: scheda ? scheda.usiPrivilegi ?? {} : {},
    // Serve a calcolare i massimi di alcuni privilegi (Ispirazione Bardica…).
    carisma: scheda ? scheda.caratteristiche?.carisma ?? null : null,
    aggiornatoIl: serverTimestamp(),
  };
}

// Aggiorna il riepilogo a partire da una scheda già in memoria (e già salvata),
// se è quella attiva. Mai bloccante: se fallisce (es. il giocatore non è più
// membro della campagna) la modifica alla scheda resta comunque salvata.
async function sincronizzaRiepilogoParty(scheda) {
  if (!scheda?.attiva || !scheda.campagnaId || !scheda.proprietarioUid) return;
  try {
    const nome = await nomeProfilo(scheda.proprietarioUid);
    await setDoc(
      doc(db, "campagne", scheda.campagnaId, "party", scheda.proprietarioUid),
      datiRiepilogo(nome, scheda)
    );
  } catch (errore) {
    console.error(errore);
  }
}

// Riscrive il riepilogo di un utente rileggendo la sua scheda attiva (dopo un
// cambio di scheda attiva, una creazione o un'eliminazione).
async function sincronizzaRiepilogoUtente(uid, campagnaId) {
  try {
    const scheda = await ottieniSchedaAttiva(uid, campagnaId);
    const nome = await nomeProfilo(uid);
    await setDoc(doc(db, "campagne", campagnaId, "party", uid), datiRiepilogo(nome, scheda));
  } catch (errore) {
    console.error(errore);
  }
}

// Il giocatore riallinea il proprio riepilogo (es. all'apertura della pagina
// Sessione), così anche le schede create prima di questa funzione compaiono.
export async function sincronizzaMioRiepilogo(uid, campagnaId) {
  await sincronizzaRiepilogoUtente(uid, campagnaId);
}

// Il DM rigenera tutti i riepiloghi della campagna dalle schede vere, e
// rimuove quelli di chi non è più membro.
export async function rigeneraRiepiloghiParty(campagnaId) {
  const membri = await elencaMembriCampagna(campagnaId);
  membri.forEach((membro) => cacheNomiProfilo.set(membro.uid, membro.nome ?? null));
  await Promise.all(membri.map((membro) => sincronizzaRiepilogoUtente(membro.uid, campagnaId)));

  const uidMembri = new Set(membri.map((membro) => membro.uid));
  const esistenti = await getDocs(collection(db, "campagne", campagnaId, "party"));
  await Promise.all(
    esistenti.docs.filter((documento) => !uidMembri.has(documento.id)).map((documento) => deleteDoc(documento.ref))
  );
}

// Riepiloghi del party in tempo reale (PF e condizioni si aggiornano da soli).
export function ascoltaRiepiloghiParty(campagnaId, callback, alErrore = (e) => console.error(e)) {
  return onSnapshot(collection(db, "campagne", campagnaId, "party"), (snapshot) => {
    callback(
      snapshot.docs
        .map((documento) => ({ uid: documento.id, ...documento.data() }))
        .sort((a, b) => (a.nomeGiocatore || "").localeCompare(b.nomeGiocatore || ""))
    );
  }, alErrore);
}

// Il DM aggiorna PF, condizioni o esaurimento di un personaggio dalla
// Sessione: scheda e riepilogo del party insieme, in un'unica scrittura.
// "riepilogo" è quello attuale del party (con uid e schedaId).
export async function aggiornaStatoPersonaggio(campagnaId, riepilogo, { hp, condizioni, esaurimento }) {
  // Sempre tutti e tre: scheda e riepilogo devono restare identici (le regole
  // lo verificano), anche se il riepilogo era stato scritto prima di questi campi.
  const campi = {
    hp: hp ?? riepilogo.hp,
    condizioni: condizioni ?? riepilogo.condizioni ?? [],
    esaurimento: esaurimento ?? riepilogo.esaurimento ?? 0,
  };
  const batch = writeBatch(db);
  batch.update(doc(db, "personaggi", riepilogo.schedaId), { ...campi, aggiornatoIl: serverTimestamp() });
  batch.update(doc(db, "campagne", campagnaId, "party", riepilogo.uid), { ...campi, aggiornatoIl: serverTimestamp() });
  await batch.commit();
}

// Il giocatore aggiorna condizioni ed esaurimento della propria scheda.
export async function aggiornaCondizioniScheda(scheda, condizioni, esaurimento) {
  await updateDoc(doc(db, "personaggi", scheda.id), { condizioni, esaurimento, aggiornatoIl: serverTimestamp() });
  await sincronizzaRiepilogoParty({ ...scheda, condizioni, esaurimento });
}

// ---------- Riposi ----------

// Aggiorna la propria scheda e, se è quella attiva, il riepilogo del party
// nella stessa scrittura: con due clic ravvicinati ogni riepilogo coincide
// con la scheda scritta insieme a lui (le regole lo verificano). Se il
// riepilogo non si può scrivere (es. non più membro), salva solo la scheda.
async function aggiornaSchedaERiepilogo(scheda, campi) {
  const riferimento = doc(db, "personaggi", scheda.id);
  if (!scheda.attiva || !scheda.campagnaId || !scheda.proprietarioUid) {
    await updateDoc(riferimento, { ...campi, aggiornatoIl: serverTimestamp() });
    return;
  }
  const nome = await nomeProfilo(scheda.proprietarioUid);
  const batch = writeBatch(db);
  batch.update(riferimento, { ...campi, aggiornatoIl: serverTimestamp() });
  batch.set(doc(db, "campagne", scheda.campagnaId, "party", scheda.proprietarioUid), datiRiepilogo(nome, { ...scheda, ...campi }));
  try {
    await batch.commit();
  } catch (errore) {
    console.error(errore);
    await updateDoc(riferimento, { ...campi, aggiornatoIl: serverTimestamp() });
  }
}

// Il giocatore applica un riposo alla propria scheda ("campi" da riposo.js).
export async function applicaRiposoScheda(scheda, campi) {
  await aggiornaSchedaERiepilogo(scheda, campi);
}

// Il DM applica un riposo a uno o più personaggi dalla Sessione: schede e
// riepiloghi del party in un'unica scrittura. "voci" = [{ riepilogo, campi }].
export async function applicaRiposoPersonaggi(campagnaId, voci) {
  const batch = writeBatch(db);
  voci.forEach(({ riepilogo, campi }) => {
    batch.update(doc(db, "personaggi", riepilogo.schedaId), { ...campi, aggiornatoIl: serverTimestamp() });
    batch.update(doc(db, "campagne", campagnaId, "party", riepilogo.uid), {
      hp: campi.hp ?? riepilogo.hp,
      condizioni: riepilogo.condizioni ?? [],
      esaurimento: campi.esaurimento ?? riepilogo.esaurimento ?? 0,
      dadiVitaSpesi: campi.dadiVitaSpesi ?? riepilogo.dadiVitaSpesi ?? 0,
      usiPrivilegi: campi.usiPrivilegi ?? riepilogo.usiPrivilegi ?? {},
      aggiornatoIl: serverTimestamp(),
    });
  });
  await batch.commit();
}

// Il giocatore segna l'uso (o il recupero) di un privilegio di classe.
export async function aggiornaUsiPrivilegi(scheda, usiPrivilegi) {
  await aggiornaSchedaERiepilogo(scheda, { usiPrivilegi });
}

// Riposo breve avviato dal DM per il party: "campagne/{c}/stato/riposo" con
// chi è invitato ("partecipanti") e chi ha già finito ("conclusi").
const riferimentoRiposo = (campagnaId) => doc(db, "campagne", campagnaId, "stato", "riposo");

export async function avviaRiposoBreve(campagnaId, partecipanti) {
  await setDoc(riferimentoRiposo(campagnaId), {
    tipo: "breve", attivo: true, partecipanti, conclusi: [], avviatoIl: serverTimestamp(),
  });
}

export async function terminaRiposoBreve(campagnaId) {
  await updateDoc(riferimentoRiposo(campagnaId), { attivo: false });
}

// Il giocatore (o il DM per lui) segna di aver finito il riposo breve.
export async function segnaRiposoConcluso(campagnaId, uid) {
  await updateDoc(riferimentoRiposo(campagnaId), { conclusi: arrayUnion(uid) });
}

export function ascoltaRiposo(campagnaId, callback, alErrore = (e) => console.error(e)) {
  return onSnapshot(riferimentoRiposo(campagnaId), (snapshot) => {
    callback(snapshot.exists() ? snapshot.data() : null);
  }, alErrore);
}

// Annota un riposo negli appunti della sessione in corso (se ce n'è una).
// Mai bloccante: il riposo resta applicato anche se l'annotazione fallisce.
export async function annotaRiposo(campagnaId, autoreUid, autoreNome, testo) {
  try {
    const stato = await ottieniStatoSessione(campagnaId);
    if (stato.inCorso && stato.sessioneAttivaId) {
      await aggiungiAppunto(stato.sessioneAttivaId, autoreUid, autoreNome, testo, "riposo");
    }
  } catch (errore) {
    console.error(errore);
  }
}

// La scheda in tempo reale (es. il DM applica danni mentre è aperta).
export function ascoltaScheda(schedaId, callback, alErrore = (e) => console.error(e)) {
  return onSnapshot(doc(db, "personaggi", schedaId), (snapshot) => {
    if (snapshot.exists()) callback({ id: snapshot.id, ...snapshot.data() });
  }, alErrore);
}

// ---------- Calendario: proposte di date e disponibilità ----------
// campagne/{c}/proposte/{id}: { titolo, note, opzioni: [{ id, data, ora }],
// stato: aperta|confermata|annullata, confermata: { opzioneId, sessioneId } };
// .../risposte/{uid}: { nome, risposte: { opzioneId: "si"|"forse"|"no" } }.

const collezioneProposte = (campagnaId) => collection(db, "campagne", campagnaId, "proposte");

// Notifica (nella campanella) a tutti i membri della campagna. Mai bloccante.
async function notificaMembri(campagnaId, dati) {
  try {
    const campagna = await getDoc(doc(db, "campagne", campagnaId));
    const membri = campagna.data()?.membriUid || [];
    await Promise.allSettled(membri.map((uid) =>
      addDoc(collection(db, "users", uid, "notifiche"), { ...dati, letta: false, creataIl: serverTimestamp() })));
  } catch (errore) {
    console.error(errore);
  }
}

export async function creaProposta(campagnaId, { titolo, note, opzioni }) {
  const riferimento = await addDoc(collezioneProposte(campagnaId), {
    titolo: titolo || null,
    note: note || null,
    opzioni,
    stato: "aperta",
    creataIl: serverTimestamp(),
  });
  await notificaMembri(campagnaId, { tipo: "proposta_sessione", titolo: titolo || null, date: opzioni.length });
  return riferimento.id;
}

export function ascoltaProposte(campagnaId, callback, alErrore = (e) => console.error(e)) {
  return onSnapshot(collezioneProposte(campagnaId), (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, alErrore);
}

export function ascoltaRisposte(campagnaId, propostaId, callback, alErrore = (e) => console.error(e)) {
  return onSnapshot(collection(db, "campagne", campagnaId, "proposte", propostaId, "risposte"), (snapshot) => {
    callback(snapshot.docs.map((d) => ({ uid: d.id, ...d.data() })));
  }, alErrore);
}

export async function rispondiProposta(campagnaId, propostaId, uid, nome, risposte) {
  await setDoc(doc(db, "campagne", campagnaId, "proposte", propostaId, "risposte", uid), {
    nome,
    risposte,
    aggiornatoIl: serverTimestamp(),
  });
}

// Il DM sceglie una delle date: diventa una sessione programmata (con numero)
// e la proposta si chiude.
export async function confermaProposta(campagnaId, proposta, opzione) {
  const { id: sessioneId, numero } = await creaSessioneProgrammata(campagnaId, {
    titolo: proposta.titolo,
    dataProgrammata: opzione.data,
    oraProgrammata: opzione.ora,
  });
  await updateDoc(doc(collezioneProposte(campagnaId), proposta.id), {
    stato: "confermata",
    confermata: { opzioneId: opzione.id, sessioneId },
  });
  await notificaMembri(campagnaId, {
    tipo: "sessione_confermata", titolo: proposta.titolo || null, numero, data: opzione.data, ora: opzione.ora || null,
  });
  return { sessioneId, numero };
}

// Il DM fissa direttamente una data (senza proposta), con avviso ai membri.
export async function fissaSessione(campagnaId, { titolo, data, ora }) {
  const risultato = await creaSessioneProgrammata(campagnaId, { titolo, dataProgrammata: data, oraProgrammata: ora });
  await notificaMembri(campagnaId, { tipo: "sessione_confermata", titolo: titolo || null, numero: risultato.numero, data, ora: ora || null });
  return risultato;
}

// Per la dashboard: sessioni della campagna, proposte aperte e a quante
// l'utente non ha ancora risposto.
export async function riepilogoCalendario(campagnaId, uid) {
  const [sessioni, proposte] = await Promise.all([
    elencaSessioniCampagna(campagnaId),
    getDocs(collezioneProposte(campagnaId)),
  ]);
  const aperte = proposte.docs.filter((d) => d.data().stato === "aperta");
  const mie = await Promise.all(aperte.map((d) => getDoc(doc(d.ref, "risposte", uid))));
  return { sessioni, aperte: aperte.length, daRispondere: mie.filter((m) => !m.exists()).length };
}

// Proposte aperte di una campagna, con chi ha già risposto ({ ..., risposte: [uid] }),
// dalla più vecchia. Per il cruscotto della dashboard e la Gestione campagna.
export async function elencaProposteAperte(campagnaId) {
  const proposte = await getDocs(collezioneProposte(campagnaId));
  const aperte = proposte.docs.filter((d) => d.data().stato === "aperta");
  const risposte = await Promise.all(aperte.map((d) => getDocs(collection(d.ref, "risposte"))));
  return aperte
    .map((d, i) => ({ id: d.id, ...d.data(), risposte: risposte[i].docs.map((r) => r.id) }))
    .sort((a, b) => (a.creataIl?.toMillis?.() ?? 0) - (b.creataIl?.toMillis?.() ?? 0));
}

export async function annullaProposta(campagnaId, propostaId) {
  await updateDoc(doc(collezioneProposte(campagnaId), propostaId), { stato: "annullata" });
}

// Riepiloghi del party di una campagna, in ordine di nome del giocatore.
export async function elencaRiepiloghiParty(campagnaId) {
  const snapshot = await getDocs(collection(db, "campagne", campagnaId, "party"));
  return snapshot.docs
    .map((documento) => ({ uid: documento.id, ...documento.data() }))
    .sort((a, b) => (a.nomeGiocatore || "").localeCompare(b.nomeGiocatore || ""));
}

// ---------- Libreria dei contenuti della campagna ----------
// Ogni contenuto (mappa, luogo, PNG, nemico, oggetto, dispensa…) ha:
// - campagne/{c}/immagini/{id}: ciò che un giocatore può vedere (titolo,
//   descrizione, categoria) più chi lo vede: "mostrataA" (ora, in sessione),
//   "vistaDa" (chi l'ha visto nella sessione in corso), "archiviataPer" (nel
//   cui archivio si trova), "visibileA" (unione di mostrataA e archiviataPer,
//   su cui le regole decidono chi legge), "sessioniMostrata" (dove è comparso);
// - campagne/{c}/immaginiDM/{id}: solo per il DM (note, tag, "archivio" =
//   destinato all'archivio dei giocatori, sessioni a cui è collegato).
// Il file sta in Storage con lo stesso ID.

const unione = (...liste) => [...new Set(liste.flat())];

// "inTavolaPer": i membri che vedono il contenuto perché è la mappa in tavola
// (vedi impostaMappaInTavola). Va ripassato a ogni ricalcolo.
function campiVisibilita(mostrataA, archiviataPer, inTavolaPer = []) {
  return { mostrataA, archiviataPer, inTavolaPer, visibileA: unione(mostrataA, archiviataPer, inTavolaPer) };
}

// ID per un nuovo contenuto, da usare anche come nome del file.
export function nuovoIdImmagine(campagnaId) {
  return doc(collection(db, "campagne", campagnaId, "immagini")).id;
}

export async function creaContenuto(campagnaId, immagineId, { titolo, descrizione, categoria, larghezza, altezza, note, tag, archivio }) {
  const batch = writeBatch(db);
  batch.set(doc(db, "campagne", campagnaId, "immagini", immagineId), {
    titolo,
    descrizione: descrizione || null,
    categoria,
    larghezza,
    altezza,
    caricataIl: serverTimestamp(),
    vistaDa: [],
    sessioniMostrata: [],
    ...campiVisibilita([], []),
  });
  batch.set(doc(db, "campagne", campagnaId, "immaginiDM", immagineId), {
    note: note || null,
    tag: tag || [],
    archivio: Boolean(archivio),
    sessioniCollegate: [],
  });
  await batch.commit();
}

// Aggiorna i dettagli (dalla libreria del DM). "contenuto" è quello attuale,
// serve per ricalcolare chi lo vede se cambia l'archivio.
export async function aggiornaContenuto(campagnaId, contenuto, { titolo, descrizione, categoria, archiviataPer, note, tag, archivio, sessioniCollegate }) {
  const batch = writeBatch(db);
  batch.update(doc(db, "campagne", campagnaId, "immagini", contenuto.id), {
    titolo,
    descrizione: descrizione || null,
    categoria,
    ...campiVisibilita(contenuto.mostrataA || [], archiviataPer, contenuto.inTavolaPer || []),
  });
  batch.update(doc(db, "campagne", campagnaId, "immaginiDM", contenuto.id), {
    note: note || null,
    tag,
    archivio: Boolean(archivio),
    sessioniCollegate,
  });
  await batch.commit();
}

// Mostra ora un contenuto ai giocatori indicati (lista vuota = nasconde).
// Chi lo vede viene ricordato in "vistaDa": alla chiusura della sessione, se
// il contenuto è destinato all'archivio, entra nell'archivio di queste persone.
// Il contenuto viene anche collegato alla sessione in corso, se non lo era.
export async function mostraContenuto(campagnaId, contenuto, uids, sessioneId) {
  const batch = writeBatch(db);
  batch.update(doc(db, "campagne", campagnaId, "immagini", contenuto.id), {
    vistaDa: unione(contenuto.vistaDa || [], uids),
    ...campiVisibilita(uids, contenuto.archiviataPer || [], contenuto.inTavolaPer || []),
  });
  if (sessioneId && uids.length > 0) {
    batch.update(doc(db, "campagne", campagnaId, "immaginiDM", contenuto.id), { sessioniCollegate: arrayUnion(sessioneId) });
  }
  await batch.commit();
}

// Collega e scollega contenuti da una sessione (anche solo pianificata).
export async function collegaContenutiSessione(campagnaId, sessioneId, daCollegare, daScollegare) {
  const batch = writeBatch(db);
  daCollegare.forEach((id) =>
    batch.update(doc(db, "campagne", campagnaId, "immaginiDM", id), { sessioniCollegate: arrayUnion(sessioneId) })
  );
  daScollegare.forEach((id) =>
    batch.update(doc(db, "campagne", campagnaId, "immaginiDM", id), { sessioniCollegate: arrayRemove(sessioneId) })
  );
  await batch.commit();
}

// Se era la mappa in tavola, il tavolo resta vuoto; griglia e pedine della
// mappa se ne vanno con lei.
export async function eliminaContenuto(campagnaId, immagineId) {
  const [tavola, pedine, pedineDM] = await Promise.all([
    getDoc(doc(db, "campagne", campagnaId, "stato", "tavola")),
    getDocs(collection(db, "campagne", campagnaId, "mappe", immagineId, "pedine")),
    getDocs(collection(db, "campagne", campagnaId, "mappe", immagineId, "pedineDM")),
  ]);
  const batch = writeBatch(db);
  batch.delete(doc(db, "campagne", campagnaId, "immagini", immagineId));
  batch.delete(doc(db, "campagne", campagnaId, "immaginiDM", immagineId));
  batch.delete(doc(db, "campagne", campagnaId, "mappe", immagineId));
  batch.delete(doc(db, "campagne", campagnaId, "mappe", immagineId, "nebbia", "stato"));
  [...pedine.docs, ...pedineDM.docs].forEach((d) => batch.delete(d.ref));
  if (tavola.exists() && tavola.data().immagineId === immagineId) {
    batch.set(doc(db, "campagne", campagnaId, "stato", "tavola"), { immagineId: null, inquadratura: null, aggiornatoIl: serverTimestamp() }, { merge: true });
  }
  await batch.commit();
  const [aree, strumenti] = await Promise.all([
    getDocs(collection(db, "campagne", campagnaId, "mappe", immagineId, "aree")),
    getDocs(collection(db, "campagne", campagnaId, "mappe", immagineId, "strumenti")),
  ]);
  await scriviAPezzi([...aree.docs, ...strumenti.docs].map((d) => (b) => b.delete(d.ref)));
}

// Fine sessione: ciò che è stato mostrato smette di essere visibile "dal vivo";
// quello destinato all'archivio entra nell'archivio di chi l'ha visto; la
// sessione viene annotata tra quelle in cui il contenuto è comparso.
async function archiviaContenutiMostrati(campagnaId, sessioneId) {
  const [pubblici, riservati] = await Promise.all([
    getDocs(collection(db, "campagne", campagnaId, "immagini")),
    getDocs(collection(db, "campagne", campagnaId, "immaginiDM")),
  ]);
  const archivio = new Map(riservati.docs.map((d) => [d.id, d.data().archivio === true]));
  const batch = writeBatch(db);
  let modifiche = 0;
  pubblici.docs.forEach((documento) => {
    const dati = documento.data();
    const vistaDa = unione(dati.vistaDa || [], dati.mostrataA || []);
    if (vistaDa.length === 0) return;
    const archiviataPer = archivio.get(documento.id) ? unione(dati.archiviataPer || [], vistaDa) : dati.archiviataPer || [];
    batch.update(documento.ref, {
      vistaDa: [],
      sessioniMostrata: sessioneId ? unione(dati.sessioniMostrata || [], [sessioneId]) : dati.sessioniMostrata || [],
      ...campiVisibilita([], archiviataPer, dati.inTavolaPer || []),
    });
    modifiche += 1;
  });
  if (modifiche > 0) await batch.commit();
}

function unisciContenuti(pubblici, riservati) {
  return pubblici
    .map((p) => ({ ...p, riservati: riservati.get(p.id) || { note: null, tag: [], archivio: false, sessioniCollegate: [] } }))
    .sort((a, b) => (b.caricataIl?.toMillis?.() ?? Infinity) - (a.caricataIl?.toMillis?.() ?? Infinity));
}

// DM: quanti contenuti della libreria sono collegati a una sessione.
export async function contaContenutiCollegati(campagnaId, sessioneId) {
  const snapshot = await getDocs(query(collection(db, "campagne", campagnaId, "immaginiDM"), where("sessioniCollegate", "array-contains", sessioneId)));
  return snapshot.size;
}

// DM: tutta la libreria, con i dati riservati, in tempo reale.
export function ascoltaLibreriaDM(campagnaId, callback, alErrore = (e) => console.error(e)) {
  let pubblici = null;
  let riservati = null;
  const aggiorna = () => {
    if (pubblici && riservati) callback(unisciContenuti(pubblici, riservati));
  };
  const stop1 = onSnapshot(collection(db, "campagne", campagnaId, "immagini"), (s) => {
    pubblici = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    aggiorna();
  }, alErrore);
  const stop2 = onSnapshot(collection(db, "campagne", campagnaId, "immaginiDM"), (s) => {
    riservati = new Map(s.docs.map((d) => [d.id, d.data()]));
    aggiorna();
  }, alErrore);
  return () => {
    stop1();
    stop2();
  };
}

// Giocatore: i contenuti che può vedere (mostrati ora o nel suo archivio).
export function ascoltaContenutiVisibili(campagnaId, uid, callback, alErrore = (e) => console.error(e)) {
  const riferimento = query(collection(db, "campagne", campagnaId, "immagini"), where("visibileA", "array-contains", uid));
  return onSnapshot(
    riferimento,
    (s) => callback(unisciContenuti(s.docs.map((d) => ({ id: d.id, ...d.data() })), new Map())),
    alErrore
  );
}

// ---------- Mappe della sessione ----------
// campagne/{c}/stato/tavola: { immagineId (mappa della Libreria in tavola, o
//   null), inquadratura ({x, y, w, h} in pixel dell'immagine: ciò che mostra
//   lo schermo comune; null = tutta la mappa) }
// campagne/{c}/mappe/{immagineId}: griglia della mappa { lato, ox, oy,
//   visibile, snap } (lato e scarto in pixel dell'immagine).
// campagne/{c}/mappe/{immagineId}/pedine/{id}: le pedine che vedono tutti:
//   personaggi { tipo: "pg", uid, c, r } (ID = uid del giocatore) e nemici
//   { tipo: "nemico", nome, immagineId, taglia, salute, condizioni, c, r }
//   (ID = quello del combattente nel tracker, se ci è entrato). c e r sono
//   colonna e riga della casella in alto a sinistra (decimali se la pedina non
//   è agganciata).
// campagne/{c}/mappe/{immagineId}/pedineDM/{id}: nemici nascosti, solo per il
//   DM (stessi campi): passano in "pedine" quando il DM li rivela.
// campagne/{c}/mappe/{immagineId}/nebbia/stato: nebbia di guerra { attiva, c0,
//   r0, colonne, righe, celle } (celle: un bit per casella, in base64; vedi
//   "Nebbia di guerra" in mappa-calcoli.js). Assente = nebbia mai usata.
// campagne/{c}/mappe/{immagineId}/strumenti/{uid}: righello e ping di ognuno
//   { righello: { x1, y1, x2, y2 } | null, ping: { x, y, n } | null } (in
//   pixel della mappa); ognuno scrive solo il proprio.
// campagne/{c}/mappe/{immagineId}/aree/{id}: aree degli incantesimi { autoreUid,
//   nome, forma, misura (metri), x, y, angolo }: restano finché le toglie chi
//   le ha messe o il DM.
// I giocatori leggono solo la mappa in tavola, e ne scaricano l'immagine
// perché compaiono nel suo "inTavolaPer".

const riferimentoTavola = (campagnaId) => doc(db, "campagne", campagnaId, "stato", "tavola");
const riferimentoMappa = (campagnaId, immagineId) => doc(db, "campagne", campagnaId, "mappe", immagineId);
const riferimentoPedine = (campagnaId, immagineId, nascoste = false) =>
  collection(db, "campagne", campagnaId, "mappe", immagineId, nascoste ? "pedineDM" : "pedine");
const riferimentoPedina = (campagnaId, immagineId, id, nascosta = false) => doc(riferimentoPedine(campagnaId, immagineId, nascosta), id);

// Pedine dei nemici (visibili e nascoste) di una mappa, per ID.
async function documentiPedineNemici(campagnaId, immagineId) {
  const [visibili, nascoste] = await Promise.all([
    getDocs(riferimentoPedine(campagnaId, immagineId)),
    getDocs(riferimentoPedine(campagnaId, immagineId, true)),
  ]);
  return new Map([...visibili.docs, ...nascoste.docs].filter((d) => d.data().tipo === "nemico").map((d) => [d.id, d]));
}

export const GRIGLIA_PREDEFINITA = { lato: 50, ox: 0, oy: 0, visibile: true, snap: true };

export function ascoltaTavola(campagnaId, callback, alErrore = (e) => console.error(e)) {
  return onSnapshot(
    riferimentoTavola(campagnaId),
    (s) => callback({ immagineId: null, inquadratura: null, segueTurno: true, ...(s.exists() ? s.data() : {}) }),
    alErrore
  );
}

// Mette in tavola una mappa (o la toglie, con "nuova" null): i membri indicati
// la vedono finché resta in tavola; la mappa precedente torna com'era.
export async function impostaMappaInTavola(campagnaId, { nuova, precedente, membri }) {
  const batch = writeBatch(db);
  if (precedente && precedente.id !== nuova?.id) {
    batch.update(doc(db, "campagne", campagnaId, "immagini", precedente.id),
      campiVisibilita(precedente.mostrataA || [], precedente.archiviataPer || [], []));
  }
  if (nuova) {
    batch.update(doc(db, "campagne", campagnaId, "immagini", nuova.id),
      campiVisibilita(nuova.mostrataA || [], nuova.archiviataPer || [], membri));
  }
  batch.set(riferimentoTavola(campagnaId), { immagineId: nuova?.id ?? null, inquadratura: null, aggiornatoIl: serverTimestamp() }, { merge: true });
  await batch.commit();
}

export function impostaInquadratura(campagnaId, inquadratura) {
  return updateDoc(riferimentoTavola(campagnaId), { inquadratura, aggiornatoIl: serverTimestamp() });
}

export function ascoltaGriglia(campagnaId, immagineId, callback, alErrore = (e) => console.error(e)) {
  return onSnapshot(
    riferimentoMappa(campagnaId, immagineId),
    (s) => callback({ ...GRIGLIA_PREDEFINITA, ...(s.exists() ? s.data() : {}) }),
    alErrore
  );
}

export function salvaGriglia(campagnaId, immagineId, { lato, ox, oy, visibile, snap }) {
  return setDoc(riferimentoMappa(campagnaId, immagineId), { lato, ox, oy, visibile, snap, aggiornatoIl: serverTimestamp() });
}

// Il DM riceve anche le pedine nascoste (con "nascosta": true).
export function ascoltaPedine(campagnaId, immagineId, callback, alErrore = (e) => console.error(e), conNascoste = false) {
  let visibili = null;
  let nascoste = conNascoste ? null : [];
  const aggiorna = () => {
    if (visibili && nascoste) callback([...visibili, ...nascoste]);
  };
  const stop = [onSnapshot(riferimentoPedine(campagnaId, immagineId), (s) => {
    visibili = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    aggiorna();
  }, alErrore)];
  if (conNascoste) {
    stop.push(onSnapshot(riferimentoPedine(campagnaId, immagineId, true), (s) => {
      nascoste = s.docs.map((d) => ({ id: d.id, ...d.data(), nascosta: true }));
      aggiorna();
    }, alErrore));
  }
  return () => stop.forEach((f) => f());
}

export function salvaPedina(campagnaId, immagineId, uid, { c, r }) {
  return setDoc(doc(riferimentoPedine(campagnaId, immagineId), uid), { tipo: "pg", uid, c, r, aggiornatoIl: serverTimestamp() });
}

// Più pedine insieme (il DM piazza il party).
export async function salvaPedine(campagnaId, immagineId, posizioni) {
  const batch = writeBatch(db);
  posizioni.forEach(({ uid, c, r }) =>
    batch.set(doc(riferimentoPedine(campagnaId, immagineId), uid), { tipo: "pg", uid, c, r, aggiornatoIl: serverTimestamp() }));
  await batch.commit();
}

export function rimuoviPedina(campagnaId, immagineId, id, nascosta = false) {
  return deleteDoc(riferimentoPedina(campagnaId, immagineId, id, nascosta));
}

// Pedina di un nemico (dal vassoio del tracker o messa a mano dal DM).
// "id": quello del combattente, o nuovo (nuovoIdPedina) per una pedina libera.
export function nuovoIdPedina(campagnaId, immagineId) {
  return doc(riferimentoPedine(campagnaId, immagineId)).id;
}

export function salvaPedinaNemico(campagnaId, immagineId, id, { nome, immagineId: immagine = null, taglia = "media", salute = "illeso", condizioni = [], c, r, alleato = false }, nascosta = true) {
  return setDoc(riferimentoPedina(campagnaId, immagineId, id, nascosta), {
    tipo: "nemico",
    nome: nome.slice(0, 60),
    immagineId: immagine,
    taglia,
    salute,
    condizioni,
    c,
    r,
    ...(alleato ? { alleato: true } : {}),
    aggiornatoIl: serverTimestamp(),
  });
}

// Il DM sposta una pedina di nemico, o ne cambia la taglia.
export function aggiornaPedinaNemico(campagnaId, immagineId, id, nascosta, campi) {
  return updateDoc(riferimentoPedina(campagnaId, immagineId, id, nascosta), { ...campi, aggiornatoIl: serverTimestamp() });
}

// Toglie in un colpo le pedine indicate ([{ id, nascosta }]).
export async function rimuoviPedine(campagnaId, immagineId, pedine) {
  const batch = writeBatch(db);
  pedine.forEach(({ id, nascosta }) => batch.delete(riferimentoPedina(campagnaId, immagineId, id, nascosta)));
  await batch.commit();
}

const riferimentoNebbia = (campagnaId, immagineId) => doc(db, "campagne", campagnaId, "mappe", immagineId, "nebbia", "stato");

// callback(nebbia | null), con "celle" già decodificate.
export function ascoltaNebbia(campagnaId, immagineId, callback, alErrore = (e) => console.error(e)) {
  return onSnapshot(riferimentoNebbia(campagnaId, immagineId), (s) => {
    if (!s.exists()) {
      callback(null);
      return;
    }
    const d = s.data();
    callback({
      attiva: d.attiva === true,
      c0: d.c0, r0: d.r0, colonne: d.colonne, righe: d.righe,
      celle: decodificaCelle(d.celle, d.colonne * d.righe),
    });
  }, alErrore);
}

export function salvaNebbia(campagnaId, immagineId, { attiva, c0, r0, colonne, righe, celle }) {
  return setDoc(riferimentoNebbia(campagnaId, immagineId), {
    attiva: Boolean(attiva), c0, r0, colonne, righe, celle: codificaCelle(celle), aggiornatoIl: serverTimestamp(),
  });
}

// ---------- Strumenti della mappa (fase 4) ----------
const riferimentoStrumenti = (campagnaId, immagineId, uid) =>
  doc(db, "campagne", campagnaId, "mappe", immagineId, "strumenti", uid);
const collezioneAree = (campagnaId, immagineId) => collection(db, "campagne", campagnaId, "mappe", immagineId, "aree");

// callback([{ uid, righello, ping, aggiornatoIl (millisecondi) }]).
export function ascoltaStrumenti(campagnaId, immagineId, callback, alErrore = (e) => console.error(e)) {
  return onSnapshot(collection(db, "campagne", campagnaId, "mappe", immagineId, "strumenti"), (s) => {
    callback(s.docs.map((d) => {
      const dati = d.data();
      return {
        uid: d.id,
        righello: dati.righello || null,
        ping: dati.ping || null,
        aggiornatoIl: dati.aggiornatoIl?.toMillis?.() ?? Date.now(),
      };
    }));
  }, alErrore);
}

// Righello in corso ({ x1, y1, x2, y2 } in pixel della mappa) o null quando
// si smette di misurare; il ping ({ x, y, n }) resta finché non ne arriva un
// altro (gli altri lo vedono quando cambia "n").
export function salvaStrumenti(campagnaId, immagineId, uid, modifiche) {
  return setDoc(riferimentoStrumenti(campagnaId, immagineId, uid), { ...modifiche, aggiornatoIl: serverTimestamp() }, { merge: true });
}

// callback([{ id, autoreUid, nome, forma, misura, x, y, angolo }]).
export function ascoltaAree(campagnaId, immagineId, callback, alErrore = (e) => console.error(e)) {
  return onSnapshot(collezioneAree(campagnaId, immagineId), (s) => {
    callback(s.docs.map((d) => {
      const { autoreUid, nome, forma, misura, x, y, angolo } = d.data();
      return { id: d.id, autoreUid, nome, forma, misura, x, y, angolo };
    }));
  }, alErrore);
}

export function creaArea(campagnaId, immagineId, uid, { nome, forma, misura, x, y, angolo }) {
  return addDoc(collezioneAree(campagnaId, immagineId), {
    autoreUid: uid, nome, forma, misura, x, y, angolo, aggiornatoIl: serverTimestamp(),
  });
}

export function rimuoviArea(campagnaId, immagineId, id) {
  return deleteDoc(doc(collezioneAree(campagnaId, immagineId), id));
}

// DM: toglie tutte le aree della mappa.
export async function rimuoviAree(campagnaId, immagineId) {
  const aree = await getDocs(collezioneAree(campagnaId, immagineId));
  await scriviAPezzi(aree.docs.map((d) => (b) => b.delete(d.ref)));
}

// Il tavolo segue (o no) la pedina di turno durante il combattimento.
export function impostaSegueTurno(campagnaId, segueTurno) {
  return updateDoc(riferimentoTavola(campagnaId), { segueTurno, aggiornatoIl: serverTimestamp() });
}

// ---------- Bestiario ----------
// campagne/{c}/bestiario/{id}: creature create dal DM (solo per lui): blocco
// statistiche come i mostri di mostri-srd.js, più base (chiave del mostro SRD
// di partenza), indole, unico, note, immagineId (Libreria) e, per i personaggi
// unici, lo stato che continua tra le sessioni { pfAttuali, condizioni,
// risorse: [{ nome, max, usati }], equip: [testo], diario: [{ sessione, testo }] }.
const collezioneBestiario = (campagnaId) => collection(db, "campagne", campagnaId, "bestiario");

export function ascoltaBestiario(campagnaId, callback, alErrore = (e) => console.error(e)) {
  return onSnapshot(collezioneBestiario(campagnaId), (s) => {
    callback(s.docs.map((d) => {
      const { aggiornatoIl, ...dati } = d.data();
      return { ...dati, id: d.id, fonte: "dm" };
    }));
  }, alErrore);
}

const datiCreatura = ({ id, fonte, chiave, ...dati }) => ({ ...dati, aggiornatoIl: serverTimestamp() });

export async function creaCreatura(campagnaId, creatura) {
  const riferimento = await addDoc(collezioneBestiario(campagnaId), datiCreatura(creatura));
  return riferimento.id;
}

export function salvaCreatura(campagnaId, id, creatura) {
  return setDoc(doc(collezioneBestiario(campagnaId), id), datiCreatura(creatura));
}

// Solo lo stato di un personaggio unico (PF, condizioni, risorse, oggetti, diario).
export function salvaStatoCreatura(campagnaId, id, stato) {
  return updateDoc(doc(collezioneBestiario(campagnaId), id), { stato, aggiornatoIl: serverTimestamp() });
}

export async function ottieniCreatura(campagnaId, id) {
  const s = await getDoc(doc(collezioneBestiario(campagnaId), id));
  if (!s.exists()) return null;
  const { aggiornatoIl, ...dati } = s.data();
  return { ...dati, id: s.id, fonte: "dm" };
}

export function eliminaCreatura(campagnaId, id) {
  return deleteDoc(doc(collezioneBestiario(campagnaId), id));
}

// ---------- Tracker di combattimento ----------
// campagne/{c}/combattimento/stato: { attivo, round, turno (ID combattente) }
// campagne/{c}/combattenti/{id}: riga del tracker, letta da tutti i membri
//   (tipo "pg" o "nemico", nome, iniziativa, bonus e spareggio per l'ordine,
//   "salute" vaga dei nemici, immagine facoltativa della Libreria).
// campagne/{c}/combattentiDM/{id}: PF dei nemici, solo per il DM.
// campagne/{c}/combattentiNascosti/{id}: nemici non ancora rivelati, solo per
//   il DM (stessi campi di "combattenti"): i giocatori non li vedono né nel
//   tracker né sulla mappa finché il DM non li rivela (rivelaNemici, che li
//   sposta in "combattenti"). Nei comandi "nascosto" dice dove si trovano.

const riferimentoStatoCombattimento = (campagnaId) => doc(db, "campagne", campagnaId, "combattimento", "stato");
const riferimentoCombattente = (campagnaId, id, nascosto = false) =>
  doc(db, "campagne", campagnaId, nascosto ? "combattentiNascosti" : "combattenti", id);
const riferimentoCombattenteDM = (campagnaId, id) => doc(db, "campagne", campagnaId, "combattentiDM", id);

// Scritture in più blocchi: ogni scrittura fa verificare alle regole che sia
// il DM, e una richiesta sola con troppe scritture supera i limiti di
// valutazione di Firestore. "operazioni": funzioni (batch) => void.
async function scriviAPezzi(operazioni, perBlocco = 8) {
  for (let i = 0; i < operazioni.length; i += perBlocco) {
    const batch = writeBatch(db);
    operazioni.slice(i, i + perBlocco).forEach((op) => op(batch));
    await batch.commit();
  }
}

// Tutti i combattenti, visibili e nascosti (per svuotare il tracker).
async function documentiCombattenti(campagnaId) {
  const [visibili, nascosti] = await Promise.all([
    getDocs(collection(db, "campagne", campagnaId, "combattenti")),
    getDocs(collection(db, "campagne", campagnaId, "combattentiNascosti")),
  ]);
  return [...visibili.docs, ...nascosti.docs];
}

export const tiraD20 = () => 1 + Math.floor(Math.random() * 20);

// Salute vaga mostrata ai giocatori, calcolata dai PF che vede solo il DM.
export function saluteDaPf(attuali, massimi) {
  if (attuali <= 0) return "a terra";
  if (!massimi || attuali >= massimi) return "illeso";
  return attuali <= massimi / 2 ? "grave" : "ferito";
}

// Avvia un combattimento con i personaggi indicati ([{ uid, nome }]).
export async function avviaCombattimento(campagnaId, personaggi) {
  const esistenti = await documentiCombattenti(campagnaId);
  await scriviAPezzi(esistenti.map((d) => (b) => {
    b.delete(d.ref);
    b.delete(riferimentoCombattenteDM(campagnaId, d.id));
  }), 4);
  const batch = writeBatch(db);
  personaggi.forEach(({ uid, nome }) => {
    batch.set(riferimentoCombattente(campagnaId, `pg-${uid}`), {
      tipo: "pg",
      nome: (nome || "Personaggio").slice(0, 60),
      uid,
      iniziativa: null,
      bonus: 0,
      spareggio: 0,
      creatoIl: serverTimestamp(),
    });
  });
  batch.set(riferimentoStatoCombattimento(campagnaId), { attivo: true, round: 0, turno: null, avviatoIl: serverTimestamp() });
  await batch.commit();
}

// Aggiunge uno o più nemici uguali ("Goblin" ×4 → Goblin 1…4, PF propri).
// Iniziativa: quella indicata, altrimenti d20 + bonus (un tiro per tutti se
// "comune", altrimenti uno a testa). "nascosti": restano invisibili ai
// giocatori finché il DM non li rivela.
// Dal bestiario: "creatura" ({ fonte: "srd" | "dm", id }) collega i nemici
// alla scheda (solo il DM lo sa), "alleato" mostra a tutti i PF veri,
// "pfAttuali" e "condizioni" sono lo stato di un personaggio unico.
export async function aggiungiNemici(campagnaId, {
  nome, quantita = 1, bonus = 0, pfMassimi = 0, iniziativa = null, iniziativaComune = true, immagineId = null,
  taglia = "media", nascosti = false, alleato = false, creatura = null, pfAttuali = null, condizioni = [],
}) {
  const batch = writeBatch(db);
  const tiroComune = iniziativa ?? tiraD20() + bonus;
  for (let i = 1; i <= quantita; i += 1) {
    const riferimento = doc(collection(db, "campagne", campagnaId, nascosti ? "combattentiNascosti" : "combattenti"));
    const nomeNemico = quantita > 1 ? `${nome} ${i}` : nome;
    batch.set(riferimento, {
      tipo: "nemico",
      nome: nomeNemico.slice(0, 60),
      uid: null,
      iniziativa: iniziativaComune || iniziativa != null ? tiroComune : tiraD20() + bonus,
      bonus,
      spareggio: 0,
      salute: "illeso",
      immagineId: immagineId || null,
      taglia,
      ...(condizioni.length ? { condizioni } : {}),
      ...(alleato ? { alleato: true, pf: { attuali: pfAttuali ?? pfMassimi, massimi: pfMassimi } } : {}),
      creatoIl: serverTimestamp(),
    });
    batch.set(riferimentoCombattenteDM(campagnaId, riferimento.id), {
      pfAttuali: pfAttuali ?? pfMassimi, pfMassimi, note: null, ...(creatura ? { creatura } : {}),
    });
  }
  await batch.commit();
}

export async function combattimentoAttivo(campagnaId) {
  const s = await getDoc(riferimentoStatoCombattimento(campagnaId));
  return s.exists() && s.data().attivo === true;
}

// ID delle creature del bestiario del DM già in combattimento (i personaggi
// unici non si aggiungono due volte).
export async function creatureInCombattimento(campagnaId) {
  const s = await getDocs(collection(db, "campagne", campagnaId, "combattentiDM"));
  return new Set(s.docs.map((d) => d.data().creatura).filter((c) => c?.fonte === "dm").map((c) => c.id));
}

// Una pedina messa a mano sulla mappa entra in combattimento: diventa un
// combattente con lo stesso ID (nascosto se la pedina è nascosta).
export async function pedinaInCombattimento(campagnaId, pedina, { pfMassimi = 0, bonus = 0 } = {}) {
  const batch = writeBatch(db);
  batch.set(riferimentoCombattente(campagnaId, pedina.id, Boolean(pedina.nascosta)), {
    tipo: "nemico",
    nome: pedina.nome.slice(0, 60),
    uid: null,
    iniziativa: tiraD20() + bonus,
    bonus,
    spareggio: 0,
    salute: pfMassimi > 0 ? "illeso" : pedina.salute || "illeso",
    immagineId: pedina.immagineId || null,
    taglia: pedina.taglia || "media",
    condizioni: pedina.condizioni || [],
    creatoIl: serverTimestamp(),
  });
  batch.set(riferimentoCombattenteDM(campagnaId, pedina.id), { pfAttuali: pfMassimi, pfMassimi, note: null });
  await batch.commit();
}

// Iniziativa di un combattente (il giocatore per il proprio, il DM per tutti).
export async function impostaIniziativa(campagnaId, combattenteId, iniziativa, bonus, nascosto = false) {
  const campi = { iniziativa };
  if (bonus != null) campi.bonus = bonus;
  await updateDoc(riferimentoCombattente(campagnaId, combattenteId, nascosto), campi);
}

// Riordina un gruppo di combattenti a pari iniziativa (nell'ordine voluto:
// [{ id, nascosto }]).
export async function impostaSpareggi(campagnaId, inOrdine) {
  const batch = writeBatch(db);
  inOrdine.forEach(({ id, nascosto }, indice) =>
    batch.update(riferimentoCombattente(campagnaId, id, nascosto), { spareggio: inOrdine.length - indice }));
  await batch.commit();
}

// Gli alleati mostrano a tutti anche i PF veri.
export async function aggiornaPfNemico(campagnaId, combattenteId, pfAttuali, pfMassimi, nascosto = false, alleato = false) {
  const batch = writeBatch(db);
  batch.update(riferimentoCombattenteDM(campagnaId, combattenteId), { pfAttuali, pfMassimi });
  batch.update(riferimentoCombattente(campagnaId, combattenteId, nascosto), {
    salute: saluteDaPf(pfAttuali, pfMassimi),
    ...(alleato ? { pf: { attuali: pfAttuali, massimi: pfMassimi } } : {}),
  });
  await batch.commit();
}

export async function impostaCondizioniCombattente(campagnaId, combattenteId, condizioni, nascosto = false) {
  await updateDoc(riferimentoCombattente(campagnaId, combattenteId, nascosto), { condizioni });
}

export async function impostaTurno(campagnaId, round, turno) {
  await updateDoc(riferimentoStatoCombattimento(campagnaId), { round, turno });
}

// Toglie un combattente; se era il suo turno, il turno passa a "turnoDopo".
export async function rimuoviCombattente(campagnaId, combattenteId, turnoDopo, nascosto = false) {
  const batch = writeBatch(db);
  batch.delete(riferimentoCombattente(campagnaId, combattenteId, nascosto));
  batch.delete(riferimentoCombattenteDM(campagnaId, combattenteId));
  if (turnoDopo !== undefined) batch.update(riferimentoStatoCombattimento(campagnaId), { turno: turnoDopo });
  await batch.commit();
}

// Le pedine dei nemici restano sulla mappa in tavola: prendono salute e
// condizioni del loro combattente, che viene tolto con tutto il tracker.
export async function terminaCombattimento(campagnaId) {
  const [esistenti, tavola, datiDM] = await Promise.all([
    documentiCombattenti(campagnaId),
    getDoc(riferimentoTavola(campagnaId)),
    getDocs(collection(db, "campagne", campagnaId, "combattentiDM")),
  ]);
  await riportaStatoUnici(campagnaId, esistenti, datiDM.docs);
  const mappaId = tavola.exists() ? tavola.data().immagineId : null;
  const pedine = mappaId ? await documentiPedineNemici(campagnaId, mappaId) : new Map();
  // Prima le pedine, poi il tracker: se qualcosa va storto non si perde la
  // salute dei nemici sulla mappa.
  await scriviAPezzi(esistenti.filter((d) => pedine.has(d.id)).map((d) => (b) =>
    b.update(pedine.get(d.id).ref, { salute: d.data().salute || "illeso", condizioni: d.data().condizioni || [], aggiornatoIl: serverTimestamp() })));
  await scriviAPezzi(esistenti.map((d) => (b) => {
    b.delete(d.ref);
    b.delete(riferimentoCombattenteDM(campagnaId, d.id));
  }), 4);
  const batch = writeBatch(db);
  batch.set(riferimentoStatoCombattimento(campagnaId), { attivo: false, round: 0, turno: null });
  await batch.commit();
}

// I personaggi unici del bestiario riportano sulla scheda PF e condizioni di
// fine combattimento, con una voce nel diario.
async function riportaStatoUnici(campagnaId, combattenti, datiDM) {
  const perId = new Map(combattenti.map((d) => [d.id, d.data()]));
  const unici = datiDM.filter((d) => d.data().creatura?.fonte === "dm" && perId.has(d.id));
  if (!unici.length) return;
  const sessione = await sessioneInCorso(campagnaId).catch(() => null);
  const etichetta = etichettaDiario(sessione?.numero ?? null);
  await Promise.all(unici.map(async (d) => {
    const { creatura, pfAttuali, pfMassimi } = d.data();
    const riferimento = doc(db, "campagne", campagnaId, "bestiario", creatura.id);
    const scheda = await getDoc(riferimento);
    if (!scheda.exists() || !scheda.data().unico) return;
    const stato = { pfAttuali: pfMassimi, condizioni: [], risorse: [], equip: [], diario: [], ...(scheda.data().stato || {}) };
    const condizioni = perId.get(d.id).condizioni || [];
    const pf = Math.max(0, Math.min(scheda.data().pf, pfAttuali));
    const testo = `Combattimento: termina con ${pf}/${scheda.data().pf} PF${condizioni.length ? ` (${condizioni.join(", ")})` : ""}.`;
    await updateDoc(riferimento, {
      stato: { ...stato, pfAttuali: pf, condizioni, diario: [...stato.diario, { sessione: etichetta, testo }].slice(-50) },
      aggiornatoIl: serverTimestamp(),
    });
  }));
}

// Ascolta il combattimento in tempo reale: callback({ stato, combattenti }),
// con i PF dei nemici (campo "dm") solo per il DM.
export function ascoltaCombattimento(campagnaId, isDM, callback, alErrore = (e) => console.error(e)) {
  let stato = null;
  let combattenti = null;
  let nascosti = isDM ? null : [];
  let datiDM = isDM ? null : new Map();
  const aggiorna = () => {
    if (!stato || !combattenti || !nascosti || !datiDM) return;
    callback({ stato, combattenti: [...combattenti, ...nascosti].map((c) => ({ ...c, dm: datiDM.get(c.id) || null })) });
  };
  const stop = [
    onSnapshot(riferimentoStatoCombattimento(campagnaId), (s) => {
      stato = s.exists() ? s.data() : { attivo: false, round: 0, turno: null };
      aggiorna();
    }, alErrore),
    onSnapshot(collection(db, "campagne", campagnaId, "combattenti"), (s) => {
      combattenti = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      aggiorna();
    }, alErrore),
  ];
  if (isDM) {
    stop.push(onSnapshot(collection(db, "campagne", campagnaId, "combattentiDM"), (s) => {
      datiDM = new Map(s.docs.map((d) => [d.id, d.data()]));
      aggiorna();
    }, alErrore));
    stop.push(onSnapshot(collection(db, "campagne", campagnaId, "combattentiNascosti"), (s) => {
      nascosti = s.docs.map((d) => ({ id: d.id, ...d.data(), nascosto: true }));
      aggiorna();
    }, alErrore));
  }
  return () => stop.forEach((f) => f());
}

// Rivela (o nasconde di nuovo) dei nemici: il combattente passa tra
// "combattentiNascosti" e "combattenti", la pedina sulla mappa in tavola tra
// "pedineDM" e "pedine". Nell'ordine di iniziativa dei giocatori il nemico
// compare (o sparisce) al suo posto.
// "mappa": la mappa delle pedine (se non indicata, quella in tavola).
export async function rivelaNemici(campagnaId, ids, rivela = true, mappa = undefined) {
  let mappaId = mappa;
  if (mappaId === undefined) {
    const tavola = await getDoc(riferimentoTavola(campagnaId));
    mappaId = tavola.exists() ? tavola.data().immagineId : null;
  }
  const daNascosti = rivela;
  // Ogni nemico in un blocco suo: tracker e mappa cambiano insieme.
  const operazioni = await Promise.all(ids.map(async (id) => {
    const [combattente, pedina] = await Promise.all([
      getDoc(riferimentoCombattente(campagnaId, id, daNascosti)),
      mappaId ? getDoc(riferimentoPedina(campagnaId, mappaId, id, daNascosti)) : null,
    ]);
    return (b) => {
      if (combattente.exists()) {
        b.delete(combattente.ref);
        b.set(riferimentoCombattente(campagnaId, id, !rivela), combattente.data());
      }
      if (pedina?.exists()) {
        b.delete(pedina.ref);
        b.set(riferimentoPedina(campagnaId, mappaId, id, !rivela), { ...pedina.data(), aggiornatoIl: serverTimestamp() });
      }
    };
  }));
  await scriviAPezzi(operazioni, 2);
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
    // Le regole di sicurezza leggono "email_verified" dal token di accesso, che
    // Firebase aggiorna da solo solo ogni ora: se l'email è stata appena
    // verificata, forziamo subito un token nuovo.
    const token = await user.getIdTokenResult();
    if (token.claims.email_verified !== true) await user.getIdToken(true);

    const profilo = await ottieniProfiloUtente(user.uid);
    // A questo punto sappiamo per certo che l'email è verificata: se il documento
    // Firestore non lo riflette ancora (account creato prima di questa funzione,
    // o verificato in un'altra scheda), lo allineiamo. Non blocca il rendering.
    const allineamenti = [];
    if (profilo && profilo.emailVerificata !== true) {
      profilo.emailVerificata = true;
      allineamenti.push(
        updateDoc(doc(db, "users", user.uid), { emailVerificata: true }).catch((errore) => console.error(errore))
      );
    }
    // Se l'utente ha completato un cambio email (verifyBeforeUpdateEmail), l'indirizzo
    // su Authentication è già aggiornato: allineiamo la copia su Firestore.
    if (profilo && user.email && profilo.email !== user.email) {
      profilo.email = user.email;
      allineamenti.push(
        updateDoc(doc(db, "users", user.uid), { email: user.email }).catch((errore) => console.error(errore))
      );
    }
    // Iscritto non ancora approvato dall'admin: resta nella pagina di attesa
    // (dopo aver completato gli allineamenti, così l'admin vede l'email come
    // verificata prima di approvarlo).
    if (!profiloApprovato(profilo)) {
      await Promise.all(allineamenti);
      window.location.href = "attesa-approvazione.html";
      return;
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
