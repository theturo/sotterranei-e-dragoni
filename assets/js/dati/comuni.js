// Funzioni di servizio usate da più moduli dei dati: scritture a blocchi,
// avvisi a tutti i membri, visibilità dei contenuti.
import { db } from "../firebase-config.js";
import {
  getDoc,
  doc,
  addDoc,
  collection,
  serverTimestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// Notifica (nella campanella) a tutti i membri della campagna. Mai bloccante.
export async function notificaMembri(campagnaId, dati) {
  try {
    const campagna = await getDoc(doc(db, "campagne", campagnaId));
    const membri = campagna.data()?.membriUid || [];
    await Promise.allSettled(membri.map((uid) =>
      addDoc(collection(db, "users", uid, "notifiche"), { ...dati, letta: false, creataIl: serverTimestamp() })));
  } catch (errore) {
    console.error(errore);
  }
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

export const unione = (...liste) => [...new Set(liste.flat())];

// "inTavolaPer": i membri che vedono il contenuto perché è la mappa in tavola
// (vedi impostaMappaInTavola). Va ripassato a ogni ricalcolo.
export function campiVisibilita(mostrataA, archiviataPer, inTavolaPer = []) {
  return { mostrataA, archiviataPer, inTavolaPer, visibileA: unione(mostrataA, archiviataPer, inTavolaPer) };
}

// Scritture in più blocchi: ogni scrittura fa verificare alle regole che sia
// il DM, e una richiesta sola con troppe scritture supera i limiti di
// valutazione di Firestore. "operazioni": funzioni (batch) => void.
export async function scriviAPezzi(operazioni, perBlocco = 8) {
  for (let i = 0; i < operazioni.length; i += perBlocco) {
    const batch = writeBatch(db);
    operazioni.slice(i, i + perBlocco).forEach((op) => op(batch));
    await batch.commit();
  }
}
