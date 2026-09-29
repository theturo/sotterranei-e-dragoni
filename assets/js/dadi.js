// Lancio dei dadi condiviso: tiri (con vantaggio/svantaggio sui d20 e critici
// sui danni), testo per il registro della sessione e finestra con il vassoio.
// Le scritture (appunti, tiri nascosti, iniziativa) le fanno le pagine.
import { creaElemento } from "./contenuti.js";

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

// ---------- Finestra di tiro ----------

const SVG_DADO = '<svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M50 4 L90 27 L90 73 L50 96 L10 73 L10 27 Z" stroke="#e8c65a" stroke-width="3" stroke-linejoin="round"/><path d="M50 4 L50 46 M10 27 L50 46 M90 27 L50 46 M50 46 L10 73 M50 46 L90 73 M50 46 L50 96" stroke="#e8c65a" stroke-width="1.3" opacity="0.5"/></svg>';

// Chiede come tirare (vantaggio/svantaggio sui d20, critico sui danni),
// tira, chiama subito onTiro(tiro) (per il registro) e mostra il risultato nel
// vassoio. onTiro può restituire (anche con una promessa) una riga da mostrare
// sotto il risultato, es. "Solo per te: nessuna sessione in corso".
export function apriTiro({ etichetta, quanti = 1, facce = 20, modificatore = 0, tipo = "d20", onTiro }) {
  const sfondo = creaElemento("div", "modal-overlay");
  const finestra = creaElemento("div", "modal-card modal-riposo modal-tiro");
  finestra.setAttribute("role", "dialog");
  finestra.setAttribute("aria-modal", "true");
  finestra.setAttribute("aria-label", `Tiro: ${etichetta}`);
  finestra.append(
    creaElemento("h2", null, etichetta),
    creaElemento("p", "riposo-situazione tiro-formula", formula({ quanti, facce, modificatore }))
  );

  const scelte = creaElemento("div", "scelta-pf scelta-tiro");
  const modi = tipo === "d20"
    ? [["svantaggio", "Svantaggio"], ["normale", "Tira"], ["vantaggio", "Vantaggio"]]
    : tipo === "danno" ? [["normale", "Tira"], ["critico", "Critico"]] : [["normale", "Tira"]];
  modi.forEach(([modo, testo]) => {
    const b = creaElemento("button", `btn-tabella btn-tabella-evidenza${modo === "normale" ? "" : " secondaria"}`, testo);
    b.type = "button";
    b.dataset.modo = modo;
    scelte.append(b);
  });
  finestra.append(scelte);

  const vassoio = creaElemento("div", "vassoio-tiro");
  vassoio.hidden = true;
  const stage = creaElemento("div", "vassoio-stage");
  const dado = creaElemento("div", "vassoio-dado");
  dado.innerHTML = SVG_DADO;
  const esito = creaElemento("div", "esito-numero");
  esito.hidden = true;
  stage.append(creaElemento("div", "vassoio-ombra"), dado, esito);
  vassoio.append(creaElemento("div", "vassoio-etichetta", `d${facce}`), stage);
  const risultato = creaElemento("div", "risultato-pf");
  risultato.setAttribute("role", "status");
  risultato.hidden = true;
  const chiudi = creaElemento("button", "btn-tabella", "Chiudi");
  chiudi.type = "button";
  const azioni = creaElemento("div", "azioni-selettore");
  azioni.append(chiudi);
  finestra.append(vassoio, risultato, azioni);
  sfondo.append(finestra);
  document.body.append(sfondo);

  const fine = () => {
    document.removeEventListener("keydown", tasto);
    sfondo.remove();
  };
  const tasto = (evento) => {
    if (evento.key === "Escape") fine();
  };
  document.addEventListener("keydown", tasto);
  chiudi.addEventListener("click", fine);
  sfondo.addEventListener("click", (evento) => {
    if (evento.target === sfondo) fine();
  });

  scelte.addEventListener("click", (evento) => {
    const b = evento.target.closest("[data-modo]");
    if (!b) return;
    const tiro = tira({ etichetta, quanti, facce, modificatore, modo: b.dataset.modo });
    scelte.hidden = true;
    const nota = Promise.resolve(onTiro?.(tiro)).catch(() => null);
    vassoio.hidden = false;
    vassoio.classList.add("in-lancio", "lancio-rapido");
    const durata = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 200 : 1300;
    setTimeout(() => {
      esito.textContent = String(tiro.totale);
      esito.hidden = false;
      risultato.textContent = testoTiro(null, tiro).replace(`${tiro.etichetta}: `, "");
      risultato.classList.toggle("tiro-critico", tiro.critico === "successo");
      risultato.classList.toggle("tiro-fallimento", tiro.critico === "fallimento");
      risultato.hidden = false;
      nota.then((testo) => {
        if (testo) finestra.insertBefore(creaElemento("p", "riposo-nota", testo), azioni);
      });
    }, durata);
  });
  scelte.querySelector('[data-modo="normale"]').focus();
}
