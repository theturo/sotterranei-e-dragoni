// Calendario: proposte di date, disponibilità dei giocatori, sessioni fissate.
import { db } from "../firebase-config.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  setDoc,
  doc,
  updateDoc,
  getDocs,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { notificaMembri } from "./comuni.js";
import { creaSessioneProgrammata, elencaSessioniCampagna } from "./sessioni.js";

// ---------- Calendario: proposte di date e disponibilità ----------
// campagne/{c}/proposte/{id}: { titolo, note, opzioni: [{ id, data, ora }],
// stato: aperta|confermata|annullata, confermata: { opzioneId, sessioneId } };
// .../risposte/{uid}: { nome, risposte: { opzioneId: "si"|"forse"|"no" } }.

const collezioneProposte = (campagnaId) => collection(db, "campagne", campagnaId, "proposte");

export async function creaProposta(campagnaId, { titolo, note, opzioni }) {
  const riferimento = await addDoc(collezioneProposte(campagnaId), {
    titolo: titolo || null,
    note: note || null,
    opzioni,
    stato: "aperta",
    creataIl: serverTimestamp(),
  });
  await notificaMembri(campagnaId, { tipo: "proposta_sessione", titolo: titolo || null, date: opzioni.length });
  return riferimento.id;
}

export function ascoltaProposte(campagnaId, callback, alErrore = (e) => console.error(e)) {
  return onSnapshot(collezioneProposte(campagnaId), (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, alErrore);
}

export function ascoltaRisposte(campagnaId, propostaId, callback, alErrore = (e) => console.error(e)) {
  return onSnapshot(collection(db, "campagne", campagnaId, "proposte", propostaId, "risposte"), (snapshot) => {
    callback(snapshot.docs.map((d) => ({ uid: d.id, ...d.data() })));
  }, alErrore);
}

export async function rispondiProposta(campagnaId, propostaId, uid, nome, risposte) {
  await setDoc(doc(db, "campagne", campagnaId, "proposte", propostaId, "risposte", uid), {
    nome,
    risposte,
    aggiornatoIl: serverTimestamp(),
  });
}

// Il DM sceglie una delle date: diventa una sessione programmata (con numero)
// e la proposta si chiude.
export async function confermaProposta(campagnaId, proposta, opzione) {
  const { id: sessioneId, numero } = await creaSessioneProgrammata(campagnaId, {
    titolo: proposta.titolo,
    dataProgrammata: opzione.data,
    oraProgrammata: opzione.ora,
  });
  await updateDoc(doc(collezioneProposte(campagnaId), proposta.id), {
    stato: "confermata",
    confermata: { opzioneId: opzione.id, sessioneId },
  });
  await notificaMembri(campagnaId, {
    tipo: "sessione_confermata", titolo: proposta.titolo || null, numero, data: opzione.data, ora: opzione.ora || null,
  });
  return { sessioneId, numero };
}

// Il DM fissa direttamente una data (senza proposta), con avviso ai membri.
export async function fissaSessione(campagnaId, { titolo, data, ora }) {
  const risultato = await creaSessioneProgrammata(campagnaId, { titolo, dataProgrammata: data, oraProgrammata: ora });
  await notificaMembri(campagnaId, { tipo: "sessione_confermata", titolo: titolo || null, numero: risultato.numero, data, ora: ora || null });
  return risultato;
}

// Per la dashboard: sessioni della campagna, proposte aperte e a quante
// l'utente non ha ancora risposto.
export async function riepilogoCalendario(campagnaId, uid) {
  const [sessioni, proposte] = await Promise.all([
    elencaSessioniCampagna(campagnaId),
    getDocs(collezioneProposte(campagnaId)),
  ]);
  const aperte = proposte.docs.filter((d) => d.data().stato === "aperta");
  const mie = await Promise.all(aperte.map((d) => getDoc(doc(d.ref, "risposte", uid))));
  return { sessioni, aperte: aperte.length, daRispondere: mie.filter((m) => !m.exists()).length };
}

// Proposte aperte di una campagna, con chi ha già risposto ({ ..., risposte: [uid] }),
// dalla più vecchia. Per il cruscotto della dashboard e la Gestione campagna.
export async function elencaProposteAperte(campagnaId) {
  const proposte = await getDocs(collezioneProposte(campagnaId));
  const aperte = proposte.docs.filter((d) => d.data().stato === "aperta");
  const risposte = await Promise.all(aperte.map((d) => getDocs(collection(d.ref, "risposte"))));
  return aperte
    .map((d, i) => ({ id: d.id, ...d.data(), risposte: risposte[i].docs.map((r) => r.id) }))
    .sort((a, b) => (a.creataIl?.toMillis?.() ?? 0) - (b.creataIl?.toMillis?.() ?? 0));
}

export async function annullaProposta(campagnaId, propostaId) {
  await updateDoc(doc(collezioneProposte(campagnaId), propostaId), { stato: "annullata" });
}
