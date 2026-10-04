// Profili degli utenti (approvazione, ruoli, ordine dei pannelli, preferenze),
// richieste di eliminazione e notifiche della campanella.
import { db } from "../firebase-config.js";
import {
  getCountFromServer,
  query,
  collection,
  where,
  updateDoc,
  doc,
  getDoc,
  orderBy,
  getDocs,
  deleteDoc,
  setDoc,
  serverTimestamp,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

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

// Tutti gli iscritti approvati, qualunque ruolo, per la gestione dei membri
// della campagna: anche un DM può giocare nella campagna di un altro.
export async function elencaUtentiApprovati(escludiUid = null) {
  const snapshot = await getDocs(collection(db, "users"));
  return snapshot.docs
    .map((documento) => ({ uid: documento.id, ...documento.data() }))
    .filter((u) => u.uid !== escludiUid && u.approvato !== false)
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
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

// Preferenze delle push (pannello ⚙️ → Notifiche), sul proprio profilo.
export async function salvaPreferenzeNotifiche(uid, preferenze) {
  await updateDoc(doc(db, "users", uid), { preferenzeNotifiche: preferenze });
}
