// Riepilogo pubblico del party (campagne/{id}/party) e scritture di scheda e
// riepilogo insieme (PF, condizioni, riposi, privilegi).
import { db } from "../firebase-config.js";
import {
  serverTimestamp,
  setDoc,
  doc,
  getDoc,
  getDocs,
  collection,
  deleteDoc,
  onSnapshot,
  writeBatch,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { ottieniProfiloUtente } from "./utenti.js";
import { elencaMembriCampagna } from "./campagne.js";
import { ottieniSchedaAttiva } from "./schede.js";

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
    condizioni: scheda ? scheda.condizioni ?? [] : [],
    esaurimento: scheda ? scheda.esaurimento ?? 0 : 0,
    dadiVitaSpesi: scheda ? scheda.dadiVitaSpesi ?? 0 : 0,
    usiPrivilegi: scheda ? scheda.usiPrivilegi ?? {} : {},
    // Serve a calcolare i massimi di alcuni privilegi (Ispirazione Bardica…).
    carisma: scheda ? scheda.caratteristiche?.carisma ?? null : null,
    aggiornatoIl: serverTimestamp(),
  };
}

// Aggiorna il riepilogo a partire da una scheda già in memoria (e già salvata),
// se è quella attiva. Mai bloccante: se fallisce (es. il giocatore non è più
// membro della campagna) la modifica alla scheda resta comunque salvata.
export async function sincronizzaRiepilogoParty(scheda) {
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

// Il contenuto di un riepilogo da confrontare (chiavi in ordine, senza la
// data di aggiornamento): due riepiloghi uguali non si riscrivono.
function firmaRiepilogo(dati) {
  const ordina = (v) => (Array.isArray(v) ? v.map(ordina)
    : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordina(v[k])])) : v);
  const { aggiornatoIl, ...resto } = dati || {};
  return JSON.stringify(ordina(resto));
}

// Riallinea il riepilogo di un utente alla sua scheda attiva (dopo un cambio
// di scheda attiva, una creazione o un'eliminazione, all'apertura della
// Sessione). Scrive solo se è cambiato: ogni scrittura arriva a tutti quelli
// che hanno il party aperto. "esistente" è il riepilogo attuale, se già letto
// (undefined = da leggere, null = non c'è).
export async function sincronizzaRiepilogoUtente(uid, campagnaId, esistente) {
  try {
    const riferimento = doc(db, "campagne", campagnaId, "party", uid);
    const [scheda, nome, attuale] = await Promise.all([
      ottieniSchedaAttiva(uid, campagnaId),
      nomeProfilo(uid),
      esistente !== undefined ? esistente : getDoc(riferimento).then((s) => (s.exists() ? s.data() : null)),
    ]);
    const dati = datiRiepilogo(nome, scheda);
    if (attuale && firmaRiepilogo(attuale) === firmaRiepilogo(dati)) return;
    await setDoc(riferimento, dati);
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
  const [membri, esistenti] = await Promise.all([
    elencaMembriCampagna(campagnaId),
    getDocs(collection(db, "campagne", campagnaId, "party")),
  ]);
  membri.forEach((membro) => cacheNomiProfilo.set(membro.uid, membro.nome ?? null));
  const attuali = new Map(esistenti.docs.map((d) => [d.id, d.data()]));
  await Promise.all(membri.map((membro) => sincronizzaRiepilogoUtente(membro.uid, campagnaId, attuali.get(membro.uid) ?? null)));

  const uidMembri = new Set(membri.map((membro) => membro.uid));
  await Promise.all(
    esistenti.docs.filter((documento) => !uidMembri.has(documento.id)).map((documento) => deleteDoc(documento.ref))
  );
}

// Riepiloghi del party in tempo reale (PF e condizioni si aggiornano da soli).
export function ascoltaRiepiloghiParty(campagnaId, callback, alErrore = (e) => console.error(e)) {
  return onSnapshot(collection(db, "campagne", campagnaId, "party"), (snapshot) => {
    callback(
      snapshot.docs
        .map((documento) => ({ uid: documento.id, ...documento.data() }))
        .sort((a, b) => (a.nomeGiocatore || "").localeCompare(b.nomeGiocatore || ""))
    );
  }, alErrore);
}

// Il DM aggiorna PF, condizioni o esaurimento di un personaggio dalla
// Sessione: scheda e riepilogo del party insieme, in un'unica scrittura.
// "riepilogo" è quello attuale del party (con uid e schedaId).
export async function aggiornaStatoPersonaggio(campagnaId, riepilogo, { hp, condizioni, esaurimento }) {
  // Sempre tutti e tre: scheda e riepilogo devono restare identici (le regole
  // lo verificano), anche se il riepilogo era stato scritto prima di questi campi.
  const campi = {
    hp: hp ?? riepilogo.hp,
    condizioni: condizioni ?? riepilogo.condizioni ?? [],
    esaurimento: esaurimento ?? riepilogo.esaurimento ?? 0,
  };
  const batch = writeBatch(db);
  batch.update(doc(db, "personaggi", riepilogo.schedaId), { ...campi, aggiornatoIl: serverTimestamp() });
  batch.update(doc(db, "campagne", campagnaId, "party", riepilogo.uid), { ...campi, aggiornatoIl: serverTimestamp() });
  await batch.commit();
}

// Il giocatore aggiorna condizioni ed esaurimento della propria scheda.
export async function aggiornaCondizioniScheda(scheda, condizioni, esaurimento) {
  await aggiornaSchedaERiepilogo(scheda, { condizioni, esaurimento });
}

// ---------- Riposi ----------

// Aggiorna la propria scheda e, se è quella attiva, il riepilogo del party
// nella stessa scrittura: con due clic ravvicinati ogni riepilogo coincide
// con la scheda scritta insieme a lui (le regole lo verificano). Se il
// riepilogo non si può scrivere (es. non più membro), salva solo la scheda.
export async function aggiornaSchedaERiepilogo(scheda, campi) {
  const riferimento = doc(db, "personaggi", scheda.id);
  if (!scheda.attiva || !scheda.campagnaId || !scheda.proprietarioUid) {
    await updateDoc(riferimento, { ...campi, aggiornatoIl: serverTimestamp() });
    return;
  }
  const nome = await nomeProfilo(scheda.proprietarioUid);
  const batch = writeBatch(db);
  batch.update(riferimento, { ...campi, aggiornatoIl: serverTimestamp() });
  batch.set(doc(db, "campagne", scheda.campagnaId, "party", scheda.proprietarioUid), datiRiepilogo(nome, { ...scheda, ...campi }));
  try {
    await batch.commit();
  } catch (errore) {
    console.error(errore);
    await updateDoc(riferimento, { ...campi, aggiornatoIl: serverTimestamp() });
  }
}

// Il giocatore applica un riposo alla propria scheda ("campi" da riposo.js).
export async function applicaRiposoScheda(scheda, campi) {
  await aggiornaSchedaERiepilogo(scheda, campi);
}

// Il DM applica un riposo a uno o più personaggi dalla Sessione: schede e
// riepiloghi del party in un'unica scrittura. "voci" = [{ riepilogo, campi }].
export async function applicaRiposoPersonaggi(campagnaId, voci) {
  const batch = writeBatch(db);
  voci.forEach(({ riepilogo, campi }) => {
    batch.update(doc(db, "personaggi", riepilogo.schedaId), { ...campi, aggiornatoIl: serverTimestamp() });
    batch.update(doc(db, "campagne", campagnaId, "party", riepilogo.uid), {
      hp: campi.hp ?? riepilogo.hp,
      condizioni: riepilogo.condizioni ?? [],
      esaurimento: campi.esaurimento ?? riepilogo.esaurimento ?? 0,
      dadiVitaSpesi: campi.dadiVitaSpesi ?? riepilogo.dadiVitaSpesi ?? 0,
      usiPrivilegi: campi.usiPrivilegi ?? riepilogo.usiPrivilegi ?? {},
      aggiornatoIl: serverTimestamp(),
    });
  });
  await batch.commit();
}

// Il giocatore segna l'uso (o il recupero) di un privilegio di classe.
export async function aggiornaUsiPrivilegi(scheda, usiPrivilegi) {
  await aggiornaSchedaERiepilogo(scheda, { usiPrivilegi });
}

// Riepiloghi del party di una campagna, in ordine di nome del giocatore.
export async function elencaRiepiloghiParty(campagnaId) {
  const snapshot = await getDocs(collection(db, "campagne", campagnaId, "party"));
  return snapshot.docs
    .map((documento) => ({ uid: documento.id, ...documento.data() }))
    .sort((a, b) => (a.nomeGiocatore || "").localeCompare(b.nomeGiocatore || ""));
}
