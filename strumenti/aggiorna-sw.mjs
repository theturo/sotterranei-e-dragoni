// Aggiorna in sw.js l'elenco dei file da salvare sul telefono e la VERSIONE,
// un'impronta (SHA-256) del loro contenuto. Va lanciato dopo ogni modifica al
// sito: node strumenti/aggiorna-sw.mjs
// Una VERSIONE nuova fa scaricare il service worker aggiornato e mostrare
// "È disponibile una nuova versione" a chi ha l'app aperta. Il test
// test/pagine/pwa.test.mjs fallisce se ci si dimentica di lanciarlo.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const RADICE = fileURLToPath(new URL("../", import.meta.url));
export const INIZIO = "// === ELENCO GENERATO: node strumenti/aggiorna-sw.mjs ===";
export const FINE = "// === FINE ELENCO GENERATO ===";

function fileIn(cartella) {
  // I file nascosti (.DS_Store e simili) non vengono pubblicati: si saltano.
  return readdirSync(join(RADICE, cartella), { withFileTypes: true }).filter((voce) => !voce.name.startsWith(".")).flatMap((voce) => {
    const percorso = `${cartella}/${voce.name}`;
    return voce.isDirectory() ? fileIn(percorso) : [percorso];
  });
}

// Cartelle pesanti usate di rado (librerie e font del PDF della scheda): non
// si scaricano all'installazione, il service worker le salva al primo uso.
// Lo stesso elenco è in sw.js (SU_RICHIESTA).
export const SU_RICHIESTA = ["assets/vendor/pdf/", "assets/fonts/pdf/"];

// Pagine, manifest e tutto assets/ (tranne SU_RICHIESTA), in ordine stabile.
export function elencoFile() {
  const pagine = readdirSync(RADICE).filter((f) => f.endsWith(".html"));
  const asset = fileIn("assets").filter((f) => !SU_RICHIESTA.some((c) => f.startsWith(c)));
  return [...pagine, "manifest.webmanifest", ...asset].sort();
}

export function versione(file = elencoFile()) {
  const hash = createHash("sha256");
  for (const f of file) {
    hash.update(`${f}\n`);
    hash.update(readFileSync(join(RADICE, f)));
  }
  return hash.digest("hex").slice(0, 12);
}

export function bloccoGenerato(file = elencoFile()) {
  return [
    INIZIO,
    `const VERSIONE = "${versione(file)}";`,
    "const FILE = [",
    ...file.map((f) => `  "./${f}",`),
    "];",
    FINE,
  ].join("\n");
}

export function swAggiornato(sorgente) {
  const inizio = sorgente.indexOf(INIZIO);
  const fine = sorgente.indexOf(FINE);
  if (inizio === -1 || fine === -1) throw new Error("sw.js: marcatori dell'elenco generato non trovati");
  return sorgente.slice(0, inizio) + bloccoGenerato() + sorgente.slice(fine + FINE.length);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const percorso = join(RADICE, "sw.js");
  const prima = readFileSync(percorso, "utf8");
  const dopo = swAggiornato(prima);
  writeFileSync(percorso, dopo);
  console.log(prima === dopo ? "sw.js era già aggiornato." : `sw.js aggiornato: versione ${versione()}.`);
}
