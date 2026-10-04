// Lancio dei dadi condiviso: tiri (con vantaggio/svantaggio sui d20 e critici
// sui danni), testo per il registro della sessione e finestra con il vassoio.
// Le scritture (appunti, tiri nascosti, iniziativa) le fanno le pagine.
import { creaElemento } from "./contenuti.js";

import { FACCE, conSegno, formula, leggiFormula, tira, testoTiro } from "./dadi-base.js";
import { suonaTiro } from "./suoni.js";

export { FACCE, conSegno, formula, leggiFormula, tira, testoTiro };

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
    suonaTiro(tiro, durata);
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
