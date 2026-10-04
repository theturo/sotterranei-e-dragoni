// Crediti di livello per campagna: concessi o annullati dal DM, spesi dal
// giocatore con la scheda attiva; livello di partenza.
import { db } from "../firebase-config.js";
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  getDocs,
  setDoc,
  increment,
  serverTimestamp,
  addDoc,
  writeBatch,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { ROLES } from "../auth.js";
import { ottieniCampagna, elencaCampagneAttive, elencaMembriCampagna } from "./campagne.js";
import { ottieniSchedaAttiva } from "./schede.js";
import { sincronizzaRiepilogoParty } from "./party.js";

// ---------- Crediti di livello per campagna ----------
// Il DM concede livelli ai membri della SUA campagna: ogni credito sta in
// "campagne/{id}/livelli/{uid}" (daSpendere) e si spende solo con la scheda
// attiva di quella campagna. Il DM può annullarne uno finché non è speso.

const riferimentoCrediti = (campagnaId, uid) => doc(db, "campagne", campagnaId, "livelli", uid);

// Titolo da mostrare ai giocatori nelle notifiche: niente se è provvisorio.
async function titoloPubblico(campagnaId) {
  const campagna = await ottieniCampagna(campagnaId).catch(() => null);
  return campagna && !campagna.titoloProvvisorio ? campagna.titolo || null : null;
}

// Crediti ancora da spendere di un giocatore in una campagna (0 se nessuno).
export async function creditiLivello(campagnaId, uid) {
  const snapshot = await getDoc(riferimentoCrediti(campagnaId, uid));
  return snapshot.exists() ? snapshot.data().daSpendere || 0 : 0;
}

export function ascoltaCreditiLivello(campagnaId, uid, callback, alErrore = (e) => console.error(e)) {
  return onSnapshot(riferimentoCrediti(campagnaId, uid), (s) => callback(s.exists() ? s.data().daSpendere || 0 : 0), alErrore);
}

// Per il DM: Map uid → crediti in attesa di tutti i membri della campagna.
export function ascoltaCreditiCampagna(campagnaId, callback, alErrore = (e) => console.error(e)) {
  return onSnapshot(collection(db, "campagne", campagnaId, "livelli"), (snapshot) => {
    callback(new Map(snapshot.docs.map((d) => [d.id, d.data().daSpendere || 0])));
  }, alErrore);
}

export async function elencaCreditiCampagna(campagnaId) {
  const snapshot = await getDocs(collection(db, "campagne", campagnaId, "livelli"));
  return new Map(snapshot.docs.map((d) => [d.id, d.data().daSpendere || 0]));
}

// Il DM concede "quanti" livelli a un membro. livelloAttuale è il livello già
// raggiunto (scheda attiva + crediti in attesa), usato solo per il testo
// della notifica ("al 4° livello"); personaggio è il nome, se c'è.
export async function concediLivelli(campagnaId, uid, { livelloAttuale = 1, quanti = 1, personaggio = null } = {}) {
  await setDoc(riferimentoCrediti(campagnaId, uid), { daSpendere: increment(quanti), aggiornatoIl: serverTimestamp() }, { merge: true });
  await addDoc(collection(db, "users", uid, "notifiche"), {
    tipo: "livello_su",
    livelloPrecedente: livelloAttuale,
    livelloNuovo: livelloAttuale + quanti,
    campagnaId,
    campagnaTitolo: await titoloPubblico(campagnaId),
    personaggio,
    letta: false,
    creataIl: serverTimestamp(),
  });
}

// Il DM annulla l'ultimo livello concesso e non ancora speso (livelloAnnullato
// è il livello che il giocatore avrebbe raggiunto, per la notifica).
export async function annullaLivello(campagnaId, uid, { livelloAnnullato = null } = {}) {
  await setDoc(riferimentoCrediti(campagnaId, uid), { daSpendere: increment(-1), aggiornatoIl: serverTimestamp() }, { merge: true });
  await addDoc(collection(db, "users", uid, "notifiche"), {
    tipo: "livello_annullato",
    livelloAnnullato,
    campagnaId,
    campagnaTitolo: await titoloPubblico(campagnaId),
    letta: false,
    creataIl: serverTimestamp(),
  });
}

// Il giocatore applica un passaggio di livello alla scheda attiva, spendendo
// un credito della campagna della scheda. Le due scritture DEVONO avvenire
// insieme (batch atomico): le regole accettano il +1 al livello della scheda
// solo se, nella stessa operazione, il credito scende di 1 ed è segnato con
// l'id della scheda. "campi" contiene gli altri campi aggiornati dalla
// procedura (PF, caratteristiche...).
export async function applicaPassaggioLivello(scheda, campi) {
  const livello = (scheda.livello || 1) + 1;
  const batch = writeBatch(db);
  batch.update(doc(db, "personaggi", scheda.id), { ...campi, livello, aggiornatoIl: serverTimestamp() });
  batch.set(riferimentoCrediti(scheda.campagnaId, scheda.proprietarioUid), {
    daSpendere: increment(-1), schedaId: scheda.id, aggiornatoIl: serverTimestamp(),
  }, { merge: true });
  await batch.commit();
  await sincronizzaRiepilogoParty({ ...scheda, ...campi, livello });
}

// I vecchi crediti del profilo ("livelliDaSpendere", prima dei crediti per
// campagna): con una sola campagna in cui si gioca passano lì, con più
// campagne si azzerano (il DM li riconcede); senza campagne restano dove
// sono finché non si entra in una. Restituisce true se ha cambiato qualcosa.
export async function migraCreditiProfilo(profilo) {
  const vecchi = profilo?.livelliDaSpendere || 0;
  if (!profilo?.uid || vecchi <= 0) return false;
  const giocate = (await elencaCampagneAttive(profilo.uid, profilo.ruolo)).filter((c) => c.mioRuolo === ROLES.PLAYER);
  if (giocate.length === 0) return false;
  const batch = writeBatch(db);
  batch.update(doc(db, "users", profilo.uid), { livelliDaSpendere: 0 });
  if (giocate.length === 1) {
    batch.set(riferimentoCrediti(giocate[0].id, profilo.uid), {
      daSpendere: increment(vecchi), aggiornatoIl: serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
  profilo.livelliDaSpendere = 0;
  return true;
}

// Livello di partenza: il DM porta tutto il party al livello scelto. A ogni
// membro arrivano, con un solo avviso, i crediti che mancano rispetto al
// livello della scheda attiva più i crediti ancora da spendere in questa
// campagna; chi è già a quel livello (o oltre) non riceve nulla. Il livello
// resta sulla campagna ("livelloPartenza") per la guida alla creazione dei
// personaggi.
// Restituisce [{ uid, nome, concessi }] oppure { uid, nome, errore }.
export async function impostaLivelloPartenza(campagnaId, livello) {
  await updateDoc(doc(db, "campagne", campagnaId), { livelloPartenza: livello });
  const [membri, crediti] = await Promise.all([elencaMembriCampagna(campagnaId), elencaCreditiCampagna(campagnaId)]);
  return Promise.all(membri.map(async (membro) => {
    try {
      const scheda = await ottieniSchedaAttiva(membro.uid, campagnaId);
      const raggiunto = (scheda?.livello || 1) + (crediti.get(membro.uid) || 0);
      const concessi = Math.max(0, livello - raggiunto);
      if (concessi > 0) {
        await concediLivelli(campagnaId, membro.uid, { livelloAttuale: raggiunto, quanti: concessi, personaggio: scheda?.nome || null });
      }
      return { uid: membro.uid, nome: membro.nome, concessi };
    } catch (errore) {
      console.error(errore);
      return { uid: membro.uid, nome: membro.nome, errore };
    }
  }));
}
