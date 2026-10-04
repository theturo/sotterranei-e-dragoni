// Campagne: creazione, titolo (anche provvisorio), campagna corrente, membri,
// migrazione dei dati pre-campagne.
import { db } from "../firebase-config.js";
import {
  doc,
  collection,
  writeBatch,
  serverTimestamp,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  documentId,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { ROLES } from "../auth.js";

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
