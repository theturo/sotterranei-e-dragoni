// Sessioni: stato, numerazione, apertura e chiusura, registro, appunti, tiri
// condivisi e nascosti, riposo breve del party.
import { db } from "../firebase-config.js";
import {
  getDoc,
  doc,
  query,
  collection,
  where,
  getDocs,
  runTransaction,
  arrayRemove,
  writeBatch,
  serverTimestamp,
  updateDoc,
  setDoc,
  addDoc,
  orderBy,
  onSnapshot,
  deleteDoc,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { notificaMembri } from "./comuni.js";
import { archiviaContenutiMostrati } from "./libreria.js";

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
