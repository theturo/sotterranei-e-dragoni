// Dadi senza DOM (provati in Node): formule, tiri con vantaggio/svantaggio e
// critici, testo per il registro. Riesportati da dadi.js.
export const FACCE = [4, 6, 8, 10, 12, 20, 100];

const d = (facce) => 1 + Math.floor(Math.random() * facce);

export const conSegno = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "");

export function formula({ quanti, facce, modificatore = 0 }) {
  return `${quanti}d${facce}${modificatore ? conSegno(modificatore) : ""}`;
}

// "1d8", "2d6+3" → { quanti, facce, modificatore } (null se non valida).
export function leggiFormula(testo) {
  const m = String(testo).replace(/\s|−/g, (c) => (c === "−" ? "-" : "")).match(/^(\d{0,2})d(\d{1,3})([+-]\d{1,3})?$/i);
  if (!m) return null;
  return { quanti: Number(m[1] || 1), facce: Number(m[2]), modificatore: Number(m[3] || 0) };
}

// Tiro completo. modo: "normale" | "vantaggio" | "svantaggio" (solo su 1d20)
// | "critico" (raddoppia i dadi, per i danni).
export function tira({ etichetta, quanti = 1, facce = 20, modificatore = 0, modo = "normale" }) {
  quanti = Math.max(1, Math.min(20, Math.trunc(quanti) || 1));
  const suD20 = facce === 20 && quanti === 1;
  if (!suD20 && (modo === "vantaggio" || modo === "svantaggio")) modo = "normale";
  const numeroDadi = modo === "critico" ? quanti * 2 : quanti;
  const dadi = Array.from({ length: numeroDadi }, () => d(facce));
  let scartato = null;
  if (modo === "vantaggio" || modo === "svantaggio") {
    const altro = d(facce);
    const tieni = modo === "vantaggio" ? Math.max(dadi[0], altro) : Math.min(dadi[0], altro);
    scartato = tieni === dadi[0] ? altro : dadi[0];
    dadi[0] = tieni;
  }
  const totale = dadi.reduce((a, b) => a + b, 0) + modificatore;
  let critico = null;
  if (suD20 && dadi[0] === 20) critico = "successo";
  if (suD20 && dadi[0] === 1) critico = "fallimento";
  return {
    etichetta: String(etichetta || "Tiro").slice(0, 60),
    formula: formula({ quanti: numeroDadi, facce, modificatore }),
    dadi,
    scartato,
    modificatore,
    modo,
    totale,
    critico,
  };
}

const NOMI_MODO = { vantaggio: "vantaggio", svantaggio: "svantaggio", critico: "critico" };

// "Eroe — Atletica: 19 (1d20+5: 14; vantaggio, scartato 7) · 20 naturale!"
export function testoTiro(chi, tiro) {
  const dettagli = [`${tiro.formula}: ${tiro.dadi.join(" + ")}`];
  if (tiro.modo !== "normale") dettagli.push(NOMI_MODO[tiro.modo] + (tiro.scartato != null ? `, scartato ${tiro.scartato}` : ""));
  const critico = tiro.critico === "successo" ? " · 20 naturale!" : tiro.critico === "fallimento" ? " · 1 naturale" : "";
  return `${chi ? `${chi} — ` : ""}${tiro.etichetta}: ${tiro.totale} (${dettagli.join("; ")})${critico}`;
}
