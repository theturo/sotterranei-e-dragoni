// Finestra «Inquadra» (tavola "Inquadratura delle immagini" della tela):
// si trascina l'immagine (dito o mouse) e la si ingrandisce (due dita,
// rotella, cursore o tasti + e −); il cerchio mostra cosa resterà visibile e
// le anteprime accanto si aggiornano dal vivo. Con la tastiera: le frecce
// spostano, + e − ingrandiscono, Esc annulla.
import { ErroreImmagine, comprimiTela } from "./immagini.js";
import {
  ZOOM_MASSIMO,
  ritaglioCentrato,
  ritaglioValido,
  limitaRitaglio,
  stileRitaglio,
  spostaRitaglio,
  zoomRitaglio,
  rettangoloSorgente,
} from "./ritaglio.js";

// Dove compare l'immagine: nome, lato in px e aspetto del cerchio.
export const ANTEPRIME_RITRATTO = [
  { nome: "Scheda", lato: 112 },
  { nome: "Pedina", lato: 64, tipo: "pedina" },
  { nome: "Party", lato: 52 },
  { nome: "Tabella DM", lato: 28, tipo: "mini" },
];
export const ANTEPRIME_CREATURA = [
  { nome: "Pedina", lato: 64, tipo: "pedina" },
  { nome: "Bestiario", lato: 64 },
  { nome: "Tracker", lato: 36, tipo: "mini" },
];

const ICONA_MENO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M8 11h6M20 20l-4.5-4.5"/></svg>';
const ICONA_PIU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M7.5 11h7M11 7.5v7M20 20l-4-4"/></svg>';

function crea(tag, classe, testo) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (testo != null) el.textContent = testo;
  return el;
}

function applicaStile(img, ritaglio) {
  Object.assign(img.style, stileRitaglio(ritaglio));
}

// Ritaglia il quadrato scelto e lo riduce a "lato" px (mai ingrandito).
export async function ritagliaImmagine(bitmap, ritaglio, lato, qualita = 0.85) {
  const { sx, sy, lato: latoSorgente } = rettangoloSorgente(ritaglio, bitmap.width, bitmap.height);
  const uscita = Math.max(1, Math.round(Math.min(lato, latoSorgente)));
  const tela = document.createElement("canvas");
  tela.width = uscita;
  tela.height = uscita;
  const ctx = tela.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, latoSorgente, latoSorgente, 0, 0, uscita, uscita);
  return comprimiTela(tela, qualita);
}

// Apre la finestra. "sorgente": l'immagine (File o Blob); "ritaglio": quello
// di partenza (se manca, centrato). Restituisce { ritaglio, bitmap } con
// "Salva", null con "Annulla" (la bitmap va chiusa da chi la riceve).
export async function apriInquadratura({ sorgente, ritaglio = null, titolo = "Inquadra il ritratto", anteprime = ANTEPRIME_RITRATTO }) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(sorgente);
  } catch {
    throw new ErroreImmagine("Impossibile leggere l'immagine: il file potrebbe essere danneggiato.");
  }
  const url = URL.createObjectURL(sorgente);
  const iniziale = ritaglioCentrato(bitmap.width, bitmap.height);
  // Il ritaglio salvato vale solo se l'immagine ha le stesse proporzioni.
  let stato = ritaglioValido(ritaglio) && Math.abs(ritaglio.r - iniziale.r) < 0.02
    ? limitaRitaglio({ ...ritaglio, r: iniziale.r })
    : iniziale;
  const giaAttivo = document.activeElement;

  return new Promise((risolvi) => {
    const sfondo = crea("div", "modal-overlay");
    const scheda = crea("div", "modal-card modal-inquadra");
    scheda.setAttribute("role", "dialog");
    scheda.setAttribute("aria-modal", "true");
    scheda.setAttribute("aria-labelledby", "inquadra-titolo");
    const intestazione = crea("h2", null, titolo);
    intestazione.id = "inquadra-titolo";
    const aiuto = crea("p", "inquadra-aiuto", "Trascina per spostare l'immagine; due dita, la rotella o il cursore per ingrandirla.");

    const palco = crea("div", "inquadra-palco");
    palco.tabIndex = 0;
    palco.setAttribute("aria-label", "Immagine da inquadrare: frecce per spostarla, + e − per lo zoom");
    const immagine = crea("img");
    immagine.alt = "";
    immagine.draggable = false;
    immagine.src = url;
    palco.append(immagine, crea("div", "inquadra-maschera"));

    const zoom = crea("label", "inquadra-zoom");
    const cursore = document.createElement("input");
    cursore.type = "range";
    cursore.min = "100";
    cursore.max = String(ZOOM_MASSIMO * 100);
    cursore.step = "1";
    cursore.setAttribute("aria-label", "Zoom");
    const meno = crea("span");
    meno.innerHTML = ICONA_MENO;
    const piu = crea("span");
    piu.innerHTML = ICONA_PIU;
    zoom.append(meno, cursore, piu);

    const sinistra = crea("div", "inquadra-sinistra");
    sinistra.append(palco, zoom);

    const elencoAnteprime = crea("div", "inquadra-anteprime");
    const immaginiAnteprima = anteprime.map(({ nome, lato, tipo }) => {
      const figura = crea("figure", "inquadra-anteprima");
      const cerchio = crea("div", `inquadra-cerchio${tipo ? ` inquadra-cerchio-${tipo}` : ""}`);
      cerchio.style.width = `${lato}px`;
      const img = crea("img");
      img.alt = "";
      img.draggable = false;
      img.src = url;
      cerchio.append(img);
      figura.append(cerchio, crea("figcaption", null, nome));
      elencoAnteprime.append(figura);
      return img;
    });

    const corpo = crea("div", "inquadra-corpo");
    corpo.append(sinistra, elencoAnteprime);

    const azioni = crea("div", "inquadra-azioni");
    const centra = crea("button", "btn-tabella", "Centra");
    const annulla = crea("button", "btn-tabella", "Annulla");
    const salva = crea("button", "btn-tabella btn-tabella-evidenza", "Salva");
    for (const b of [centra, annulla, salva]) b.type = "button";
    azioni.append(centra, annulla, salva);

    scheda.append(intestazione, aiuto, corpo, azioni);
    sfondo.append(scheda);
    document.body.append(sfondo);

    function disegna() {
      applicaStile(immagine, stato);
      for (const img of immaginiAnteprima) applicaStile(img, stato);
      cursore.value = String(Math.round(stato.z * 100));
    }
    disegna();
    palco.focus();

    // ---- Trascinamento e zoom con due dita ----
    const puntatori = new Map();
    let ultimo = null; // { cx, cy, distanza }
    const lato = () => palco.getBoundingClientRect().width;
    const riassunto = () => {
      const punti = [...puntatori.values()];
      const cx = punti.reduce((s, p) => s + p.x, 0) / punti.length;
      const cy = punti.reduce((s, p) => s + p.y, 0) / punti.length;
      const distanza = punti.length > 1 ? Math.hypot(punti[0].x - punti[1].x, punti[0].y - punti[1].y) : 0;
      return { cx, cy, distanza };
    };
    palco.addEventListener("pointerdown", (e) => {
      palco.setPointerCapture?.(e.pointerId);
      puntatori.set(e.pointerId, { x: e.clientX, y: e.clientY });
      ultimo = riassunto();
      palco.classList.add("in-trascinamento");
    });
    palco.addEventListener("pointermove", (e) => {
      if (!puntatori.has(e.pointerId)) return;
      puntatori.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const ora = riassunto();
      const l = lato();
      if (ultimo.distanza > 0 && ora.distanza > 0) {
        const r = palco.getBoundingClientRect();
        stato = zoomRitaglio(stato, stato.z * (ora.distanza / ultimo.distanza), (ora.cx - r.left) / l, (ora.cy - r.top) / l);
      }
      stato = spostaRitaglio(stato, ora.cx - ultimo.cx, ora.cy - ultimo.cy, l);
      ultimo = ora;
      disegna();
    });
    const lascia = (e) => {
      puntatori.delete(e.pointerId);
      ultimo = puntatori.size ? riassunto() : null;
      if (!puntatori.size) palco.classList.remove("in-trascinamento");
    };
    palco.addEventListener("pointerup", lascia);
    palco.addEventListener("pointercancel", lascia);
    palco.addEventListener("wheel", (e) => {
      e.preventDefault();
      const r = palco.getBoundingClientRect();
      const fattore = Math.exp(-e.deltaY * 0.0015);
      stato = zoomRitaglio(stato, stato.z * fattore, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
      disegna();
    }, { passive: false });
    palco.addEventListener("keydown", (e) => {
      const passo = lato() * 0.04;
      const spostamenti = { ArrowLeft: [passo, 0], ArrowRight: [-passo, 0], ArrowUp: [0, passo], ArrowDown: [0, -passo] };
      if (spostamenti[e.key]) {
        stato = spostaRitaglio(stato, ...spostamenti[e.key], lato());
      } else if (e.key === "+" || e.key === "=") {
        stato = zoomRitaglio(stato, stato.z * 1.1);
      } else if (e.key === "-") {
        stato = zoomRitaglio(stato, stato.z / 1.1);
      } else {
        return;
      }
      e.preventDefault();
      disegna();
    });
    cursore.addEventListener("input", () => {
      stato = zoomRitaglio(stato, Number(cursore.value) / 100);
      disegna();
    });
    centra.addEventListener("click", () => {
      stato = iniziale;
      disegna();
    });

    function chiudi(esito) {
      document.removeEventListener("keydown", tasti, true);
      sfondo.remove();
      URL.revokeObjectURL(url);
      if (!esito) bitmap.close?.();
      giaAttivo?.focus?.();
      risolvi(esito);
    }
    function tasti(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        chiudi(null);
      }
    }
    document.addEventListener("keydown", tasti, true);
    annulla.addEventListener("click", () => chiudi(null));
    salva.addEventListener("click", () => chiudi({ ritaglio: stato, bitmap }));
  });
}
