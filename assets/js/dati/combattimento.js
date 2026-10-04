// Tracker di combattimento: combattenti, iniziativa, turni, PF dei nemici,
// «Tocca a te».
import { db } from "../firebase-config.js";
import { etichettaDiario } from "../bestiario-calcoli.js";
import {
  getDoc,
  doc,
  getDocs,
  collection,
  writeBatch,
  serverTimestamp,
  updateDoc,
  addDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { scriviAPezzi } from "./comuni.js";
import { sessioneInCorso } from "./sessioni.js";
import { riferimentoTavola, documentiPedineNemici, riferimentoPedina } from "./mappa.js";

// Iniziativa tirata dalla scheda: se c'è un combattimento con il personaggio
// del giocatore, la scrive anche nel tracker. Restituisce true se l'ha scritta.
export async function iniziativaNelTracker(campagnaId, uid, iniziativa, bonus) {
  try {
    const [stato, combattente] = await Promise.all([
      getDoc(doc(db, "campagne", campagnaId, "combattimento", "stato")),
      getDoc(doc(db, "campagne", campagnaId, "combattenti", `pg-${uid}`)),
    ]);
    if (!stato.exists() || !stato.data().attivo || !combattente.exists()) return false;
    await impostaIniziativa(campagnaId, `pg-${uid}`, iniziativa, bonus);
    return true;
  } catch (errore) {
    console.error(errore);
    return false;
  }
}

// ---------- Tracker di combattimento ----------
// campagne/{c}/combattimento/stato: { attivo, round, turno (ID combattente) }
// campagne/{c}/combattenti/{id}: riga del tracker, letta da tutti i membri
//   (tipo "pg" o "nemico", nome, iniziativa, bonus e spareggio per l'ordine,
//   "salute" vaga dei nemici, immagine facoltativa della Libreria).
// campagne/{c}/combattentiDM/{id}: PF dei nemici, solo per il DM.
// campagne/{c}/combattentiNascosti/{id}: nemici non ancora rivelati, solo per
//   il DM (stessi campi di "combattenti"): i giocatori non li vedono né nel
//   tracker né sulla mappa finché il DM non li rivela (rivelaNemici, che li
//   sposta in "combattenti"). Nei comandi "nascosto" dice dove si trovano.

const riferimentoStatoCombattimento = (campagnaId) => doc(db, "campagne", campagnaId, "combattimento", "stato");

const riferimentoCombattente = (campagnaId, id, nascosto = false) =>
  doc(db, "campagne", campagnaId, nascosto ? "combattentiNascosti" : "combattenti", id);

const riferimentoCombattenteDM = (campagnaId, id) => doc(db, "campagne", campagnaId, "combattentiDM", id);

// Tutti i combattenti, visibili e nascosti (per svuotare il tracker).
async function documentiCombattenti(campagnaId) {
  const [visibili, nascosti] = await Promise.all([
    getDocs(collection(db, "campagne", campagnaId, "combattenti")),
    getDocs(collection(db, "campagne", campagnaId, "combattentiNascosti")),
  ]);
  return [...visibili.docs, ...nascosti.docs];
}

export const tiraD20 = () => 1 + Math.floor(Math.random() * 20);

// Salute vaga mostrata ai giocatori, calcolata dai PF che vede solo il DM.
export function saluteDaPf(attuali, massimi) {
  if (attuali <= 0) return "a terra";
  if (!massimi || attuali >= massimi) return "illeso";
  return attuali <= massimi / 2 ? "grave" : "ferito";
}

// Avvia un combattimento con i personaggi indicati ([{ uid, nome }]).
export async function avviaCombattimento(campagnaId, personaggi) {
  const esistenti = await documentiCombattenti(campagnaId);
  await scriviAPezzi(esistenti.map((d) => (b) => {
    b.delete(d.ref);
    b.delete(riferimentoCombattenteDM(campagnaId, d.id));
  }), 4);
  const batch = writeBatch(db);
  personaggi.forEach(({ uid, nome }) => {
    batch.set(riferimentoCombattente(campagnaId, `pg-${uid}`), {
      tipo: "pg",
      nome: (nome || "Personaggio").slice(0, 60),
      uid,
      iniziativa: null,
      bonus: 0,
      spareggio: 0,
      creatoIl: serverTimestamp(),
    });
  });
  batch.set(riferimentoStatoCombattimento(campagnaId), { attivo: true, round: 0, turno: null, avviatoIl: serverTimestamp() });
  await batch.commit();
}

// Aggiunge uno o più nemici uguali ("Goblin" ×4 → Goblin 1…4, PF propri).
// Iniziativa: quella indicata, altrimenti d20 + bonus (un tiro per tutti se
// "comune", altrimenti uno a testa). "nascosti": restano invisibili ai
// giocatori finché il DM non li rivela.
// Dal bestiario: "creatura" ({ fonte: "srd" | "dm", id }) collega i nemici
// alla scheda (solo il DM lo sa), "alleato" mostra a tutti i PF veri,
// "pfAttuali" e "condizioni" sono lo stato di un personaggio unico.
export async function aggiungiNemici(campagnaId, {
  nome, quantita = 1, bonus = 0, pfMassimi = 0, iniziativa = null, iniziativaComune = true, immagineId = null,
  taglia = "media", nascosti = false, alleato = false, creatura = null, pfAttuali = null, condizioni = [],
}) {
  const batch = writeBatch(db);
  const tiroComune = iniziativa ?? tiraD20() + bonus;
  for (let i = 1; i <= quantita; i += 1) {
    const riferimento = doc(collection(db, "campagne", campagnaId, nascosti ? "combattentiNascosti" : "combattenti"));
    const nomeNemico = quantita > 1 ? `${nome} ${i}` : nome;
    batch.set(riferimento, {
      tipo: "nemico",
      nome: nomeNemico.slice(0, 60),
      uid: null,
      iniziativa: iniziativaComune || iniziativa != null ? tiroComune : tiraD20() + bonus,
      bonus,
      spareggio: 0,
      salute: "illeso",
      immagineId: immagineId || null,
      taglia,
      ...(condizioni.length ? { condizioni } : {}),
      ...(alleato ? { alleato: true, pf: { attuali: pfAttuali ?? pfMassimi, massimi: pfMassimi } } : {}),
      creatoIl: serverTimestamp(),
    });
    batch.set(riferimentoCombattenteDM(campagnaId, riferimento.id), {
      pfAttuali: pfAttuali ?? pfMassimi, pfMassimi, note: null, ...(creatura ? { creatura } : {}),
    });
  }
  await batch.commit();
}

export async function combattimentoAttivo(campagnaId) {
  const s = await getDoc(riferimentoStatoCombattimento(campagnaId));
  return s.exists() && s.data().attivo === true;
}

// ID delle creature del bestiario del DM già in combattimento (i personaggi
// unici non si aggiungono due volte).
export async function creatureInCombattimento(campagnaId) {
  const s = await getDocs(collection(db, "campagne", campagnaId, "combattentiDM"));
  return new Set(s.docs.map((d) => d.data().creatura).filter((c) => c?.fonte === "dm").map((c) => c.id));
}

// Una pedina messa a mano sulla mappa entra in combattimento: diventa un
// combattente con lo stesso ID (nascosto se la pedina è nascosta).
export async function pedinaInCombattimento(campagnaId, pedina, { pfMassimi = 0, bonus = 0 } = {}) {
  const batch = writeBatch(db);
  batch.set(riferimentoCombattente(campagnaId, pedina.id, Boolean(pedina.nascosta)), {
    tipo: "nemico",
    nome: pedina.nome.slice(0, 60),
    uid: null,
    iniziativa: tiraD20() + bonus,
    bonus,
    spareggio: 0,
    salute: pfMassimi > 0 ? "illeso" : pedina.salute || "illeso",
    immagineId: pedina.immagineId || null,
    taglia: pedina.taglia || "media",
    condizioni: pedina.condizioni || [],
    creatoIl: serverTimestamp(),
  });
  batch.set(riferimentoCombattenteDM(campagnaId, pedina.id), { pfAttuali: pfMassimi, pfMassimi, note: null });
  await batch.commit();
}

// Iniziativa di un combattente (il giocatore per il proprio, il DM per tutti).
export async function impostaIniziativa(campagnaId, combattenteId, iniziativa, bonus, nascosto = false) {
  const campi = { iniziativa };
  if (bonus != null) campi.bonus = bonus;
  await updateDoc(riferimentoCombattente(campagnaId, combattenteId, nascosto), campi);
}

// Riordina un gruppo di combattenti a pari iniziativa (nell'ordine voluto:
// [{ id, nascosto }]).
export async function impostaSpareggi(campagnaId, inOrdine) {
  const batch = writeBatch(db);
  inOrdine.forEach(({ id, nascosto }, indice) =>
    batch.update(riferimentoCombattente(campagnaId, id, nascosto), { spareggio: inOrdine.length - indice }));
  await batch.commit();
}

// Gli alleati mostrano a tutti anche i PF veri.
export async function aggiornaPfNemico(campagnaId, combattenteId, pfAttuali, pfMassimi, nascosto = false, alleato = false) {
  const batch = writeBatch(db);
  batch.update(riferimentoCombattenteDM(campagnaId, combattenteId), { pfAttuali, pfMassimi });
  batch.update(riferimentoCombattente(campagnaId, combattenteId, nascosto), {
    salute: saluteDaPf(pfAttuali, pfMassimi),
    ...(alleato ? { pf: { attuali: pfAttuali, massimi: pfMassimi } } : {}),
  });
  await batch.commit();
}

export async function impostaCondizioniCombattente(campagnaId, combattenteId, condizioni, nascosto = false) {
  await updateDoc(riferimentoCombattente(campagnaId, combattenteId, nascosto), { condizioni });
}

export async function impostaTurno(campagnaId, round, turno) {
  await updateDoc(riferimentoStatoCombattimento(campagnaId), { round, turno });
}

// "Tocca a te": il DM avvisa il giocatore il cui personaggio è di turno. La
// Cloud Function lo manda come push (secondo le sue preferenze) e lo toglie
// subito: non resta nella campanella. Mai bloccante.
export async function avvisaTurno(uid, { nome, round }) {
  try {
    await addDoc(collection(db, "users", uid, "notifiche"), {
      tipo: "turno", nome: String(nome || "").slice(0, 60), round: round || null, letta: false, creataIl: serverTimestamp(),
    });
  } catch (errore) {
    console.error(errore);
  }
}

// Toglie un combattente; se era il suo turno, il turno passa a "turnoDopo".
export async function rimuoviCombattente(campagnaId, combattenteId, turnoDopo, nascosto = false) {
  const batch = writeBatch(db);
  batch.delete(riferimentoCombattente(campagnaId, combattenteId, nascosto));
  batch.delete(riferimentoCombattenteDM(campagnaId, combattenteId));
  if (turnoDopo !== undefined) batch.update(riferimentoStatoCombattimento(campagnaId), { turno: turnoDopo });
  await batch.commit();
}

// Le pedine dei nemici restano sulla mappa in tavola: prendono salute e
// condizioni del loro combattente, che viene tolto con tutto il tracker.
export async function terminaCombattimento(campagnaId) {
  const [esistenti, tavola, datiDM] = await Promise.all([
    documentiCombattenti(campagnaId),
    getDoc(riferimentoTavola(campagnaId)),
    getDocs(collection(db, "campagne", campagnaId, "combattentiDM")),
  ]);
  await riportaStatoUnici(campagnaId, esistenti, datiDM.docs);
  const mappaId = tavola.exists() ? tavola.data().immagineId : null;
  const pedine = mappaId ? await documentiPedineNemici(campagnaId, mappaId) : new Map();
  // Prima le pedine, poi il tracker: se qualcosa va storto non si perde la
  // salute dei nemici sulla mappa.
  await scriviAPezzi(esistenti.filter((d) => pedine.has(d.id)).map((d) => (b) =>
    b.update(pedine.get(d.id).ref, { salute: d.data().salute || "illeso", condizioni: d.data().condizioni || [], aggiornatoIl: serverTimestamp() })));
  await scriviAPezzi(esistenti.map((d) => (b) => {
    b.delete(d.ref);
    b.delete(riferimentoCombattenteDM(campagnaId, d.id));
  }), 4);
  const batch = writeBatch(db);
  batch.set(riferimentoStatoCombattimento(campagnaId), { attivo: false, round: 0, turno: null });
  await batch.commit();
}

// I personaggi unici del bestiario riportano sulla scheda PF e condizioni di
// fine combattimento, con una voce nel diario.
async function riportaStatoUnici(campagnaId, combattenti, datiDM) {
  const perId = new Map(combattenti.map((d) => [d.id, d.data()]));
  const unici = datiDM.filter((d) => d.data().creatura?.fonte === "dm" && perId.has(d.id));
  if (!unici.length) return;
  const sessione = await sessioneInCorso(campagnaId).catch(() => null);
  const etichetta = etichettaDiario(sessione?.numero ?? null);
  await Promise.all(unici.map(async (d) => {
    const { creatura, pfAttuali, pfMassimi } = d.data();
    const riferimento = doc(db, "campagne", campagnaId, "bestiario", creatura.id);
    const scheda = await getDoc(riferimento);
    if (!scheda.exists() || !scheda.data().unico) return;
    const stato = { pfAttuali: pfMassimi, condizioni: [], risorse: [], equip: [], diario: [], ...(scheda.data().stato || {}) };
    const condizioni = perId.get(d.id).condizioni || [];
    const pf = Math.max(0, Math.min(scheda.data().pf, pfAttuali));
    const testo = `Combattimento: termina con ${pf}/${scheda.data().pf} PF${condizioni.length ? ` (${condizioni.join(", ")})` : ""}.`;
    await updateDoc(riferimento, {
      stato: { ...stato, pfAttuali: pf, condizioni, diario: [...stato.diario, { sessione: etichetta, testo }].slice(-50) },
      aggiornatoIl: serverTimestamp(),
    });
  }));
}

// Ascolta il combattimento in tempo reale: callback({ stato, combattenti }),
// con i PF dei nemici (campo "dm") solo per il DM.
export function ascoltaCombattimento(campagnaId, isDM, callback, alErrore = (e) => console.error(e)) {
  let stato = null;
  let combattenti = null;
  let nascosti = isDM ? null : [];
  let datiDM = isDM ? null : new Map();
  const aggiorna = () => {
    if (!stato || !combattenti || !nascosti || !datiDM) return;
    callback({ stato, combattenti: [...combattenti, ...nascosti].map((c) => ({ ...c, dm: datiDM.get(c.id) || null })) });
  };
  const stop = [
    onSnapshot(riferimentoStatoCombattimento(campagnaId), (s) => {
      stato = s.exists() ? s.data() : { attivo: false, round: 0, turno: null };
      aggiorna();
    }, alErrore),
    onSnapshot(collection(db, "campagne", campagnaId, "combattenti"), (s) => {
      combattenti = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      aggiorna();
    }, alErrore),
  ];
  if (isDM) {
    stop.push(onSnapshot(collection(db, "campagne", campagnaId, "combattentiDM"), (s) => {
      datiDM = new Map(s.docs.map((d) => [d.id, d.data()]));
      aggiorna();
    }, alErrore));
    stop.push(onSnapshot(collection(db, "campagne", campagnaId, "combattentiNascosti"), (s) => {
      nascosti = s.docs.map((d) => ({ id: d.id, ...d.data(), nascosto: true }));
      aggiorna();
    }, alErrore));
  }
  return () => stop.forEach((f) => f());
}

// Rivela (o nasconde di nuovo) dei nemici: il combattente passa tra
// "combattentiNascosti" e "combattenti", la pedina sulla mappa in tavola tra
// "pedineDM" e "pedine". Nell'ordine di iniziativa dei giocatori il nemico
// compare (o sparisce) al suo posto.
// "mappa": la mappa delle pedine (se non indicata, quella in tavola).
export async function rivelaNemici(campagnaId, ids, rivela = true, mappa = undefined) {
  let mappaId = mappa;
  if (mappaId === undefined) {
    const tavola = await getDoc(riferimentoTavola(campagnaId));
    mappaId = tavola.exists() ? tavola.data().immagineId : null;
  }
  const daNascosti = rivela;
  // Ogni nemico in un blocco suo: tracker e mappa cambiano insieme.
  const operazioni = await Promise.all(ids.map(async (id) => {
    const [combattente, pedina] = await Promise.all([
      getDoc(riferimentoCombattente(campagnaId, id, daNascosti)),
      mappaId ? getDoc(riferimentoPedina(campagnaId, mappaId, id, daNascosti)) : null,
    ]);
    return (b) => {
      if (combattente.exists()) {
        b.delete(combattente.ref);
        b.set(riferimentoCombattente(campagnaId, id, !rivela), combattente.data());
      }
      if (pedina?.exists()) {
        b.delete(pedina.ref);
        b.set(riferimentoPedina(campagnaId, mappaId, id, !rivela), { ...pedina.data(), aggiornatoIl: serverTimestamp() });
      }
    };
  }));
  await scriviAPezzi(operazioni, 2);
}
