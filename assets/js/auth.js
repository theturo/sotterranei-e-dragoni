// Funzioni condivise di autenticazione e gestione ruoli.
import { auth, db } from "./firebase-config.js";
import { eliminaImmagine, percorsiRitratto } from "./immagini.js";
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
export async function elencaGiocatori() {
  const riferimento = query(collection(db, "users"), where("ruolo", "==", ROLES.PLAYER));
  const snapshot = await getDocs(riferimento);
  return snapshot.docs
    .map((documento) => ({ uid: documento.id, ...documento.data() }))
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
export async function creaSessioneProgrammata(campagnaId, { titolo, dataProgrammata }) {
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

// Il DM apre una nuova sessione per una campagna: se esiste già una sessione
// "programmata" in attesa, la promuove a "in-corso" (riusa numero e titolo
// già assegnati); altrimenti ne crea una nuova ad-hoc con numero progressivo.
// Se una sessione è già in corso (doppio clic, altra scheda) non ne apre
// un'altra: restituisce quella. Da qui in poi gli appunti scritti da chiunque
// finiscono in questa voce. Solo admin/DM (vedi firestore.rules).
export async function apriSessione(campagnaId) {
  const sessioni = await elencaSessioniCampagna(campagnaId);
  const programmate = sessioni
    .filter((s) => s.stato === "programmata")
    .sort((a, b) => (a.dataProgrammata || "").localeCompare(b.dataProgrammata || ""));

  return runTransaction(db, async (transazione) => {
    const { numero: prossimo, stato } = await prenotaNumero(transazione, campagnaId, sessioni);
    if (stato.inCorso && stato.sessioneAttivaId) {
      const giaAperta = sessioni.find((s) => s.id === stato.sessioneAttivaId);
      return { id: stato.sessioneAttivaId, numero: giaAperta?.numero ?? null };
    }

    // La prima pianificata ancora tale (riletta nella transazione).
    let scelta = null;
    for (const candidata of programmate) {
      const attuale = await transazione.get(doc(db, "registroSessioni", candidata.id));
      if (attuale.exists() && attuale.data().stato === "programmata") {
        scelta = { id: candidata.id, numero: attuale.data().numero };
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
    return { id: sessioneId, numero };
  });
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
export async function aggiungiAppunto(sessioneId, autoreUid, autoreNome, testo) {
  await addDoc(collection(db, "registroSessioni", sessioneId, "appunti"), {
    autoreUid,
    autoreNome,
    testo,
    creatoIl: serverTimestamp(),
  });
}

// Moderazione: il DM (o l'admin) elimina un appunto.
export async function eliminaAppunto(sessioneId, appuntoId) {
  await deleteDoc(doc(db, "registroSessioni", sessioneId, "appunti", appuntoId));
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

function campiVisibilita(mostrataA, archiviataPer) {
  return { mostrataA, archiviataPer, visibileA: unione(mostrataA, archiviataPer) };
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
    ...campiVisibilita(contenuto.mostrataA || [], archiviataPer),
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
    ...campiVisibilita(uids, contenuto.archiviataPer || []),
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

export async function eliminaContenuto(campagnaId, immagineId) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "campagne", campagnaId, "immagini", immagineId));
  batch.delete(doc(db, "campagne", campagnaId, "immaginiDM", immagineId));
  await batch.commit();
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
      ...campiVisibilita([], archiviataPer),
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

// ---------- Tracker di combattimento ----------
// campagne/{c}/combattimento/stato: { attivo, round, turno (ID combattente) }
// campagne/{c}/combattenti/{id}: riga del tracker, letta da tutti i membri
//   (tipo "pg" o "nemico", nome, iniziativa, bonus e spareggio per l'ordine,
//   "salute" vaga dei nemici, immagine facoltativa della Libreria).
// campagne/{c}/combattentiDM/{id}: PF dei nemici, solo per il DM.

const riferimentoStatoCombattimento = (campagnaId) => doc(db, "campagne", campagnaId, "combattimento", "stato");
const riferimentoCombattente = (campagnaId, id) => doc(db, "campagne", campagnaId, "combattenti", id);
const riferimentoCombattenteDM = (campagnaId, id) => doc(db, "campagne", campagnaId, "combattentiDM", id);

export const tiraD20 = () => 1 + Math.floor(Math.random() * 20);

// Salute vaga mostrata ai giocatori, calcolata dai PF che vede solo il DM.
export function saluteDaPf(attuali, massimi) {
  if (attuali <= 0) return "a terra";
  if (!massimi || attuali >= massimi) return "illeso";
  return attuali <= massimi / 2 ? "grave" : "ferito";
}

// Avvia un combattimento con i personaggi indicati ([{ uid, nome }]).
export async function avviaCombattimento(campagnaId, personaggi) {
  const esistenti = await getDocs(collection(db, "campagne", campagnaId, "combattenti"));
  const batch = writeBatch(db);
  esistenti.docs.forEach((d) => {
    batch.delete(d.ref);
    batch.delete(riferimentoCombattenteDM(campagnaId, d.id));
  });
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
// "comune", altrimenti uno a testa).
export async function aggiungiNemici(campagnaId, { nome, quantita = 1, bonus = 0, pfMassimi = 0, iniziativa = null, iniziativaComune = true, immagineId = null }) {
  const batch = writeBatch(db);
  const tiroComune = iniziativa ?? tiraD20() + bonus;
  for (let i = 1; i <= quantita; i += 1) {
    const riferimento = doc(collection(db, "campagne", campagnaId, "combattenti"));
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
      creatoIl: serverTimestamp(),
    });
    batch.set(riferimentoCombattenteDM(campagnaId, riferimento.id), { pfAttuali: pfMassimi, pfMassimi, note: null });
  }
  await batch.commit();
}

// Iniziativa di un combattente (il giocatore per il proprio, il DM per tutti).
export async function impostaIniziativa(campagnaId, combattenteId, iniziativa, bonus) {
  const campi = { iniziativa };
  if (bonus != null) campi.bonus = bonus;
  await updateDoc(riferimentoCombattente(campagnaId, combattenteId), campi);
}

// Riordina un gruppo di combattenti a pari iniziativa (ID nell'ordine voluto).
export async function impostaSpareggi(campagnaId, idInOrdine) {
  const batch = writeBatch(db);
  idInOrdine.forEach((id, indice) => batch.update(riferimentoCombattente(campagnaId, id), { spareggio: idInOrdine.length - indice }));
  await batch.commit();
}

export async function aggiornaPfNemico(campagnaId, combattenteId, pfAttuali, pfMassimi) {
  const batch = writeBatch(db);
  batch.update(riferimentoCombattenteDM(campagnaId, combattenteId), { pfAttuali, pfMassimi });
  batch.update(riferimentoCombattente(campagnaId, combattenteId), { salute: saluteDaPf(pfAttuali, pfMassimi) });
  await batch.commit();
}

export async function impostaTurno(campagnaId, round, turno) {
  await updateDoc(riferimentoStatoCombattimento(campagnaId), { round, turno });
}

// Toglie un combattente; se era il suo turno, il turno passa a "turnoDopo".
export async function rimuoviCombattente(campagnaId, combattenteId, turnoDopo) {
  const batch = writeBatch(db);
  batch.delete(riferimentoCombattente(campagnaId, combattenteId));
  batch.delete(riferimentoCombattenteDM(campagnaId, combattenteId));
  if (turnoDopo !== undefined) batch.update(riferimentoStatoCombattimento(campagnaId), { turno: turnoDopo });
  await batch.commit();
}

export async function terminaCombattimento(campagnaId) {
  const esistenti = await getDocs(collection(db, "campagne", campagnaId, "combattenti"));
  const batch = writeBatch(db);
  esistenti.docs.forEach((d) => {
    batch.delete(d.ref);
    batch.delete(riferimentoCombattenteDM(campagnaId, d.id));
  });
  batch.set(riferimentoStatoCombattimento(campagnaId), { attivo: false, round: 0, turno: null });
  await batch.commit();
}

// Ascolta il combattimento in tempo reale: callback({ stato, combattenti }),
// con i PF dei nemici (campo "dm") solo per il DM.
export function ascoltaCombattimento(campagnaId, isDM, callback, alErrore = (e) => console.error(e)) {
  let stato = null;
  let combattenti = null;
  let datiDM = isDM ? null : new Map();
  const aggiorna = () => {
    if (!stato || !combattenti || !datiDM) return;
    callback({ stato, combattenti: combattenti.map((c) => ({ ...c, dm: datiDM.get(c.id) || null })) });
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
  }
  return () => stop.forEach((f) => f());
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
