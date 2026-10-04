// Stato della musica condivisa e link YouTube salvati dal DM.
import { db } from "../firebase-config.js";
import { getDoc, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// Stato condiviso della musica di sessione per una campagna:
// "campagne/{campagnaId}/stato/musica", con la sorgente attualmente trasmessa
// ai giocatori ("spotify"/"youtube"/null) e uno snapshot per ciascuna sorgente
// (scritto dal browser del DM, che è l'unico ad avere accesso diretto a
// Spotify/YouTube).
export async function ottieniStatoMusica(campagnaId) {
  const snapshot = await getDoc(doc(db, "campagne", campagnaId, "stato", "musica"));
  return snapshot.exists() ? snapshot.data() : { sorgente: null };
}

// Solo admin/DM possono scrivere (vedi firestore.rules). Merge così sorgente
// e snapshot dei brani si aggiornano indipendentemente.
export async function salvaStatoMusica(campagnaId, campi) {
  await setDoc(doc(db, "campagne", campagnaId, "stato", "musica"), campi, { merge: true });
}

// Link YouTube salvati dal DM (campagne/{c}/privato/musica): solo il DM li
// legge, così i nomi delle tracce non anticipano nulla ai giocatori.
export async function ottieniLinkMusica(campagnaId) {
  const snapshot = await getDoc(doc(db, "campagne", campagnaId, "privato", "musica"));
  return snapshot.exists() ? snapshot.data() : {};
}

export async function salvaLinkMusica(campagnaId, youtube) {
  await setDoc(doc(db, "campagne", campagnaId, "privato", "musica"), { youtube });
}

// Ascolta in tempo reale lo stato della musica: usata dal pannello "Musica di
// sessione" in dashboard, così ogni giocatore vede comparire cambi di brano o
// di sorgente senza dover ricaricare. Restituisce la funzione per interrompere
// l'ascolto.
export function ascoltaStatoMusica(campagnaId, callback, alErrore = (errore) => console.error(errore)) {
  return onSnapshot(
    doc(db, "campagne", campagnaId, "stato", "musica"),
    (snapshot) => callback(snapshot.exists() ? snapshot.data() : { sorgente: null }),
    alErrore
  );
}
