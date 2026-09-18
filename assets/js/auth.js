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

// Ogni utente può avere più schede personaggio (collezione "personaggi", un
// documento per scheda, con "proprietarioUid" e un flag "attiva"). Solo una
// scheda per utente è "attiva" alla volta: è quella usata in sessione e
// visibile al DM.

// Elenca tutte le schede di un utente (le proprie, o quelle di un giocatore
// se chi chiama è admin/DM). Ordinate per "ordine" (impostato riordinando le
// schede a mano) se tutte lo hanno già; finché anche una sola ne è priva
// (schede più vecchie di questa funzionalità, o mai riordinate) si torna
// all'ordine di creazione, così non serve una migrazione esplicita.
export async function elencaSchedePersonaggio(uid) {
  const riferimento = query(collection(db, "personaggi"), where("proprietarioUid", "==", uid));
  const snapshot = await getDocs(riferimento);
  const schede = snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
  const tutteOrdinate = schede.every((s) => typeof s.ordine === "number");
  return tutteOrdinate
    ? schede.sort((a, b) => a.ordine - b.ordine)
    : schede.sort((a, b) => (a.creataIl?.toMillis?.() ?? 0) - (b.creataIl?.toMillis?.() ?? 0));
}

// Crea una nuova scheda personaggio per un utente. Se è la sua prima scheda
// diventa automaticamente quella attiva.
export async function creaScheda(uid, dati) {
  const schedeEsistenti = await elencaSchedePersonaggio(uid);
  const riferimento = await addDoc(collection(db, "personaggi"), {
    ...dati,
    proprietarioUid: uid,
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

// Restituisce la scheda attualmente attiva di un utente, o null se non ne ha
// ancora creata nessuna (usata sia dal giocatore stesso, sia dal DM per
// vedere i PF in tabella).
export async function ottieniSchedaAttiva(uid) {
  const riferimento = query(
    collection(db, "personaggi"),
    where("proprietarioUid", "==", uid),
    where("attiva", "==", true)
  );
  const snapshot = await getDocs(riferimento);
  if (snapshot.empty) return null;
  const documento = snapshot.docs[0];
  return { id: documento.id, ...documento.data() };
}

// Rende attiva una scheda tra quelle di un utente, disattivando le altre.
export async function impostaSchedaAttiva(uid, schedaId) {
  const schede = await elencaSchedePersonaggio(uid);
  const batch = writeBatch(db);
  schede.forEach((scheda) => {
    batch.update(doc(db, "personaggi", scheda.id), { attiva: scheda.id === schedaId });
  });
  await batch.commit();
}

// Elimina una scheda personaggio. Se era quella attiva e ne restano altre, la
// prima rimasta diventa la nuova attiva (come già succede per la primissima
// scheda creata), per non lasciare l'utente senza un personaggio attivo.
export async function eliminaScheda(uid, schedaId) {
  const schede = await elencaSchedePersonaggio(uid);
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
