// Schede personaggio: elenco, creazione, scheda attiva, aggiornamenti e
// ascolto in tempo reale.
import { db } from "../firebase-config.js";
import { percorsiRitratto, eliminaImmagine } from "../immagini.js";
import {
  query,
  collection,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  writeBatch,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { sincronizzaRiepilogoUtente, aggiornaSchedaERiepilogo } from "./party.js";

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
    const { grande, icona, originale } = percorsiRitratto(uid, schedaId, scheda.ritratto);
    await Promise.all([eliminaImmagine(grande), eliminaImmagine(icona), eliminaImmagine(originale)]).catch((errore) => console.error(errore));
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
  await aggiornaSchedaERiepilogo(scheda, { hp });
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
export async function impostaRitratto(scheda, versione, ritaglio = null) {
  await aggiornaSchedaERiepilogo(scheda, { ritratto: versione, ritrattoRitaglio: ritaglio });
}

// Aggiornamento generico di uno o più campi di una scheda (abilità competenti,
// personalità, talenti, competenze/linguaggi, monete, equipaggiamento indossato...).
export async function aggiornaScheda(schedaId, campi) {
  await updateDoc(doc(db, "personaggi", schedaId), { ...campi, aggiornatoIl: serverTimestamp() });
}

// La scheda in tempo reale (es. il DM applica danni mentre è aperta).
export function ascoltaScheda(schedaId, callback, alErrore = (e) => console.error(e)) {
  return onSnapshot(doc(db, "personaggi", schedaId), (snapshot) => {
    if (snapshot.exists()) callback({ id: snapshot.id, ...snapshot.data() });
  }, alErrore);
}
