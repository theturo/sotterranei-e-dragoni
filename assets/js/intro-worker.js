// Worker dell'intro: riceve le due tele (OffscreenCanvas) e ci fa girare il motore, così il
// disegno non pesa sul caricamento della pagina. Messaggi dalla pagina: avvia, dimensiona,
// pronta, salta, ferma. Messaggi alla pagina: vivo, partita, finita, errore.
import { creaMotore } from "./intro-motore.js";

let motore = null;

self.onmessage = async ({ data }) => {
  if (data.tipo === "avvia") {
    try {
      motore = creaMotore({ fondo: data.fondo, scena: data.scena, avvisa: (tipo) => self.postMessage({ tipo }) });
      motore.dimensiona(data.W, data.H);
      await motore.avvia();
    } catch (errore) {
      self.postMessage({ tipo: "errore", messaggio: String(errore) });
    }
    return;
  }
  if (!motore) return;
  if (data.tipo === "dimensiona") motore.dimensiona(data.W, data.H);
  else if (data.tipo === "pronta") motore.pronta();
  else if (data.tipo === "salta") motore.salta();
  else if (data.tipo === "ferma") motore.ferma();
};

// la pagina aspetta questo messaggio per sapere che i worker a modulo funzionano
self.postMessage({ tipo: "vivo" });
