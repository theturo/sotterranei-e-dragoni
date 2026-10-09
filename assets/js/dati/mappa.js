// Mappe della sessione: mappa in tavola, griglia, pedine, nemici, nebbia di
// guerra, strumenti e aree.
import { db } from "../firebase-config.js";
import { decodificaCelle, codificaCelle } from "../mappa-calcoli.js";
import {
  doc,
  collection,
  getDocs,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  updateDoc,
  setDoc,
  deleteDoc,
  addDoc,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { campiVisibilita, scriviAPezzi } from "./comuni.js";

// ---------- Mappe della sessione ----------
// campagne/{c}/stato/tavola: { immagineId (mappa della Libreria in tavola, o
//   null), inquadratura ({x, y, w, h} in pixel dell'immagine: ciò che mostra
//   lo schermo comune; null = tutta la mappa) }
// campagne/{c}/mappe/{immagineId}: griglia della mappa { lato, ox, oy,
//   visibile, snap } (lato e scarto in pixel dell'immagine).
// campagne/{c}/mappe/{immagineId}/pedine/{id}: le pedine che vedono tutti:
//   personaggi { tipo: "pg", uid, c, r } (ID = uid del giocatore) e nemici
//   { tipo: "nemico", nome, immagineId, ritaglio, taglia, salute, condizioni, c, r }
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

export const riferimentoTavola = (campagnaId) => doc(db, "campagne", campagnaId, "stato", "tavola");

const riferimentoMappa = (campagnaId, immagineId) => doc(db, "campagne", campagnaId, "mappe", immagineId);

const riferimentoPedine = (campagnaId, immagineId, nascoste = false) =>
  collection(db, "campagne", campagnaId, "mappe", immagineId, nascoste ? "pedineDM" : "pedine");

export const riferimentoPedina = (campagnaId, immagineId, id, nascosta = false) => doc(riferimentoPedine(campagnaId, immagineId, nascosta), id);

// Pedine dei nemici (visibili e nascoste) di una mappa, per ID.
export async function documentiPedineNemici(campagnaId, immagineId) {
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

export function salvaPedinaNemico(campagnaId, immagineId, id, { nome, immagineId: immagine = null, ritaglio = null, taglia = "media", salute = "illeso", condizioni = [], c, r, alleato = false }, nascosta = true) {
  return setDoc(riferimentoPedina(campagnaId, immagineId, id, nascosta), {
    tipo: "nemico",
    nome: nome.slice(0, 60),
    immagineId: immagine,
    ...(immagine && ritaglio ? { ritaglio } : {}),
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
