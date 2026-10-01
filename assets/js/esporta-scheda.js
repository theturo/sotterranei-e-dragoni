// Esportazione delle schede: PDF da stampare o consultare (impaginato da
// pdf-scheda.js) e backup completo dei dati in JSON. Dalla scheda si esporta
// quella aperta, dalla pagina del party il DM esporta tutte le schede attive.
// Librerie e font del PDF (assets/vendor/pdf, assets/fonts/pdf) si scaricano
// solo al primo uso: il service worker li salva allora (vedi sw.js).
import { vistaScheda } from "./calcoli-scheda.js";
import { creaPdfSchede } from "./pdf-scheda.js";
import { scaricaImmagine, percorsiRitratto } from "./immagini.js";
import { mostraAttesa } from "./utils.js";

const FONT = {
  titolo: "cinzel-700.woff",
  testo: "eb-garamond-400.woff",
  grassetto: "eb-garamond-600.woff",
  corsivo: "eb-garamond-400-italic.woff",
};
const LATO_RITRATTO_PDF = 900;

let risorse = null;
function caricaRisorse() {
  if (!risorse) {
    risorse = (async () => {
      const voci = Object.entries(FONT);
      const [libreria, ...byte] = await Promise.all([
        import("../vendor/pdf/pdf-lib-fontkit.min.js"),
        ...voci.map(async ([, nome]) => {
          const risposta = await fetch(new URL(`../fonts/pdf/${nome}`, import.meta.url));
          if (!risposta.ok) throw new Error(`Font ${nome} non disponibile`);
          return new Uint8Array(await risposta.arrayBuffer());
        }),
      ]);
      return {
        pdfLib: { PDFDocument: libreria.PDFDocument, rgb: libreria.rgb },
        fontkit: libreria.fontkit,
        font: Object.fromEntries(voci.map(([chiave], i) => [chiave, byte[i]])),
      };
    })();
    risorse.catch(() => {
      risorse = null;
    });
  }
  return risorse;
}

// Ritratto ritagliato al centro in un quadrato, in JPEG (pdf-lib non legge il
// WebP con cui sono salvati). null se manca o non si riesce a leggere.
async function ritrattoQuadrato(scheda) {
  if (!scheda.ritratto) return null;
  try {
    const blob = await scaricaImmagine(percorsiRitratto(scheda.proprietarioUid, scheda.id, scheda.ritratto).grande);
    const bitmap = await createImageBitmap(blob);
    const lato = Math.min(bitmap.width, bitmap.height);
    const uscita = Math.min(lato, LATO_RITRATTO_PDF);
    const tela = document.createElement("canvas");
    tela.width = uscita;
    tela.height = uscita;
    const ctx = tela.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, uscita, uscita);
    ctx.drawImage(bitmap, (bitmap.width - lato) / 2, (bitmap.height - lato) / 2, lato, lato, 0, 0, uscita, uscita);
    bitmap.close?.();
    const jpeg = await new Promise((risolvi) => tela.toBlob(risolvi, "image/jpeg", 0.88));
    return jpeg ? { byte: new Uint8Array(await jpeg.arrayBuffer()), tipo: "jpg" } : null;
  } catch (errore) {
    console.warn("Ritratto non incluso nel PDF", errore);
    return null;
  }
}

// schede: [{ scheda, giocatore }]
export async function pdfDelleSchede(schede, titoloDocumento) {
  const [r, ritratti] = await Promise.all([caricaRisorse(), Promise.all(schede.map(({ scheda }) => ritrattoQuadrato(scheda)))]);
  const byte = await creaPdfSchede(
    schede.map(({ scheda, giocatore }, i) => ({ vista: vistaScheda(scheda), giocatore, ritratto: ritratti[i] })),
    { ...r, titoloDocumento },
  );
  return new Blob([byte], { type: "application/pdf" });
}

// Dati della scheda pronti per il JSON: date di Firestore in formato ISO.
function serializzabile(valore) {
  if (valore === null || typeof valore !== "object") return valore;
  if (typeof valore.toDate === "function") return valore.toDate().toISOString();
  if (Array.isArray(valore)) return valore.map(serializzabile);
  return Object.fromEntries(Object.entries(valore).map(([k, v]) => [k, serializzabile(v)]));
}

export function jsonDelleSchede(schede, extra = {}) {
  const contenuto = {
    formato: "sotterranei-e-dragoni/schede",
    versione: 1,
    esportatoIl: new Date().toISOString(),
    ...extra,
    schede: schede.map(({ scheda, giocatore }) => ({ giocatore: giocatore || null, ...serializzabile(scheda) })),
  };
  return new Blob([JSON.stringify(contenuto, null, 2)], { type: "application/json" });
}

export function nomeFile(testo, estensione) {
  const base = String(testo || "scheda").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "scheda";
  return `${base}.${estensione}`;
}

// Sul telefono, se il sistema lo permette, si apre la condivisione (Salva in
// File, invia…); altrimenti, o se non va, il file si scarica.
async function consegna(blob, nome) {
  const file = new File([blob], nome, { type: blob.type });
  const suTelefono = window.matchMedia("(hover: none)").matches;
  if (suTelefono && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: nome });
      return;
    } catch (errore) {
      if (errore?.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Finestra con le due esportazioni. opzioni: { titolo, descrizione,
// pdf: async () => ({ blob, nome }), json: async () => ({ blob, nome }) }
export function apriEsportazione({ titolo, descrizione, pdf, json }) {
  const sfondo = document.createElement("div");
  sfondo.className = "modal-overlay";
  sfondo.style.display = "flex";
  const finestra = document.createElement("div");
  finestra.className = "modal-card modal-esporta";
  finestra.setAttribute("role", "dialog");
  finestra.setAttribute("aria-modal", "true");
  finestra.setAttribute("aria-labelledby", "titolo-esporta");
  finestra.innerHTML = `
    <button type="button" class="btn-chiudi-modal" aria-label="Chiudi">×</button>
    <h2 id="titolo-esporta"></h2>
    <p class="card-tagline"></p>
    <div class="impostazioni-opzioni">
      <button type="button" class="btn-tabella btn-tabella-evidenza" data-esporta="pdf">Scarica il PDF</button>
      <p class="esporta-nota">Da stampare o tenere sul telefono: si legge bene anche in bianco e nero.</p>
      <button type="button" class="btn-tabella" data-esporta="json">Backup dei dati (JSON)</button>
      <p class="esporta-nota">Copia completa di tutti i campi, da conservare.</p>
    </div>
    <div class="message" role="status"></div>`;
  finestra.querySelector("h2").textContent = titolo;
  finestra.querySelector(".card-tagline").textContent = descrizione;
  sfondo.append(finestra);
  document.body.append(sfondo);
  const messaggio = finestra.querySelector(".message");
  const chiudi = () => sfondo.remove();
  finestra.querySelector(".btn-chiudi-modal").addEventListener("click", chiudi);
  sfondo.addEventListener("click", (evento) => {
    if (evento.target === sfondo) chiudi();
  });
  finestra.querySelectorAll("[data-esporta]").forEach((bottone) => {
    bottone.addEventListener("click", async () => {
      const tipo = bottone.dataset.esporta;
      const testo = bottone.textContent;
      finestra.querySelectorAll("[data-esporta]").forEach((b) => (b.disabled = true));
      mostraAttesa(bottone, tipo === "pdf" ? "Preparazione del PDF…" : "Preparazione del backup…");
      messaggio.className = "message";
      try {
        const { blob, nome } = await (tipo === "pdf" ? pdf() : json());
        await consegna(blob, nome);
        messaggio.textContent = `Pronto: ${nome}`;
        messaggio.className = "message visible success";
      } catch (errore) {
        console.error(errore);
        messaggio.textContent = navigator.onLine === false
          ? "Serve la connessione per preparare il primo PDF: riprova quando sei online."
          : "Esportazione non riuscita: riprova.";
        messaggio.className = "message visible error";
      } finally {
        bottone.textContent = testo;
        finestra.querySelectorAll("[data-esporta]").forEach((b) => (b.disabled = false));
      }
    });
  });
  finestra.querySelector("[data-esporta='pdf']").focus();
}
