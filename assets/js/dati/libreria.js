// Libreria dei contenuti della campagna (mappe, luoghi, PNG, dispense):
// visibilità, archivio, sessioni collegate.
import { db } from "../firebase-config.js";
import {
  doc,
  collection,
  writeBatch,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { campiVisibilita, unione, scriviAPezzi } from "./comuni.js";

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
export async function archiviaContenutiMostrati(campagnaId, sessioneId) {
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
