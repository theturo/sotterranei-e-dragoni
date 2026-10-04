// Bestiario della campagna: creature create dal DM e loro stato.
import { db } from "../firebase-config.js";
import {
  collection,
  onSnapshot,
  serverTimestamp,
  addDoc,
  setDoc,
  doc,
  updateDoc,
  getDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

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
