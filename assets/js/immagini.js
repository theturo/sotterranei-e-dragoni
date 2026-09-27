// Immagini su Cloud Storage: ridimensionamento nel browser prima dell'invio,
// caricamento, lettura e cancellazione. Condiviso da scheda personaggio,
// party e galleria della campagna.
//
// Le immagini si leggono con l'SDK (getBlob), non con "link di download"
// pubblici: così ogni lettura passa dalle regole di storage.rules, e chi non
// ha il permesso non può scaricarle nemmeno conoscendone l'indirizzo.
import { storage } from "./firebase-config.js";
import {
  ref,
  uploadBytes,
  getBlob,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

// File accettati in ingresso (prima del ridimensionamento).
const MASSIMO_FILE_ORIGINALE = 25 * 1024 * 1024;
export const TIPI_ACCETTATI = "image/png,image/jpeg,image/webp,image/gif";

export class ErroreImmagine extends Error {}

// Ridimensiona un'immagine scelta dall'utente perché il lato più lungo misuri
// al massimo "lato" pixel, e la ricomprime in WebP (o JPEG, se il browser non
// sa produrre WebP). Restituisce { blob, larghezza, altezza }.
export async function ridimensionaImmagine(file, lato, qualita = 0.85) {
  if (!file || !/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
    throw new ErroreImmagine("Formato non supportato: usa un'immagine PNG, JPEG, WebP o GIF.");
  }
  if (file.size > MASSIMO_FILE_ORIGINALE) {
    throw new ErroreImmagine("Immagine troppo grande (massimo 25 MB).");
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ErroreImmagine("Impossibile leggere l'immagine: il file potrebbe essere danneggiato.");
  }
  const scala = Math.min(1, lato / Math.max(bitmap.width, bitmap.height));
  const larghezza = Math.max(1, Math.round(bitmap.width * scala));
  const altezza = Math.max(1, Math.round(bitmap.height * scala));
  const tela = document.createElement("canvas");
  tela.width = larghezza;
  tela.height = altezza;
  tela.getContext("2d").drawImage(bitmap, 0, 0, larghezza, altezza);
  bitmap.close?.();

  const comprimi = (tipo) => new Promise((risolvi) => tela.toBlob(risolvi, tipo, qualita));
  let blob = await comprimi("image/webp");
  // Browser che non producono WebP restituiscono un PNG: meglio un JPEG.
  if (!blob || blob.type !== "image/webp") blob = await comprimi("image/jpeg");
  if (!blob) throw new ErroreImmagine("Impossibile elaborare l'immagine.");
  return { blob, larghezza, altezza };
}

// Carica un blob già ridimensionato. I file non vengono mai sovrascritti (ogni
// versione ha un nome nuovo), quindi il browser può tenerli in cache a lungo.
export async function caricaImmagine(percorso, blob) {
  await uploadBytes(ref(storage, percorso), blob, {
    contentType: blob.type,
    cacheControl: "private, max-age=31536000, immutable",
  });
}

export async function eliminaImmagine(percorso) {
  try {
    await deleteObject(ref(storage, percorso));
  } catch (errore) {
    // Già eliminata: non è un problema.
    if (errore?.code !== "storage/object-not-found") throw errore;
  }
}

// URL locale (blob:) per mostrare un'immagine protetta in un <img>. Le immagini
// già scaricate in questa pagina vengono riutilizzate.
const cacheUrl = new Map();
export function urlImmagine(percorso) {
  if (!cacheUrl.has(percorso)) {
    const promessa = getBlob(ref(storage, percorso)).then((blob) => URL.createObjectURL(blob));
    promessa.catch(() => cacheUrl.delete(percorso));
    cacheUrl.set(percorso, promessa);
  }
  return cacheUrl.get(percorso);
}

// Mostra l'immagine in un <img> esistente; se non si può leggere (permessi,
// file rimosso) nasconde l'elemento invece di mostrare un'icona rotta.
export async function mostraImmagine(img, percorso) {
  try {
    img.src = await urlImmagine(percorso);
    img.hidden = false;
  } catch (errore) {
    console.error(errore);
    img.hidden = true;
  }
}

// ---------- Ritratti dei personaggi ----------
// Due file per versione: "grande" (scheda) e "icona" (party). La versione è un
// numero (istante del caricamento) salvato nel campo "ritratto" della scheda.
export const LATO_RITRATTO = 512;
export const LATO_ICONA = 96;

export function percorsiRitratto(uid, schedaId, versione) {
  const base = `ritratti/${uid}/${schedaId}-${versione}`;
  return { grande: base, icona: `${base}-icona` };
}

// ---------- Immagini della campagna ----------
// Il file ha lo stesso ID del documento che ne descrive titolo e visibilità
// (campagne/{id}/immagini/{immagineId}); "-mini" è la miniatura per la galleria.
export const LATO_IMMAGINE_CAMPAGNA = 1920;
export const LATO_MINIATURA = 480;

export function percorsiImmagineCampagna(campagnaId, immagineId) {
  return {
    grande: `campagne/${campagnaId}/${immagineId}`,
    mini: `campagne/${campagnaId}/${immagineId}-mini`,
  };
}
