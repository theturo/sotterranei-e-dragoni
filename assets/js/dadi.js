// Lancio dei dadi condiviso: tiri (con vantaggio/svantaggio sui d20 e critici
// sui danni), testo per il registro della sessione e finestra con la vaschetta
// in cui i dadi rotolano. Le scritture (appunti, tiri nascosti, iniziativa) le
// fanno le pagine.
import { creaElemento } from "./contenuti.js";

import { FACCE, conSegno, formula, leggiFormula, tira, testoTiro, dadiPerVaschetta } from "./dadi-base.js";
import { suonaTiro } from "./suoni.js";

export { FACCE, conSegno, formula, leggiFormula, tira, testoTiro };

// ---------- Vaschetta ----------
// La vaschetta (fisica e disegno, vaschetta.js) si scarica solo quando serve
// la prima volta: le pagine che non tirano dadi non la caricano.
let modulo = null;
function caricaVaschetta() {
  modulo ??= import("./vaschetta.js").catch((errore) => {
    // Si riprova al prossimo tiro (per esempio se mancava la rete).
    modulo = null;
    throw errore;
  });
  return modulo;
}

// Prepara una vaschetta dentro `contenitore` (nascosto finché non serve).
// lancia(voci, opzioni) fa rotolare i dadi e si risolve quando sono fermi; se
// la vaschetta non c'è (dado non previsto, come il d100, o modulo non
// scaricato) si risolve subito: chi chiama mostra comunque il risultato.
// vuota() la mostra senza dadi. `scelte` sono le opzioni di creaVaschetta
// (per esempio l'altezza).
export function montaVaschetta(contenitore, scelte = {}) {
  let vaschetta = null;
  caricaVaschetta().catch(() => {});
  return {
    async vuota() {
      try {
        const { creaVaschetta } = await caricaVaschetta();
        contenitore.hidden = false;
        vaschetta ??= creaVaschetta(contenitore, scelte);
        await vaschetta.vuota();
        return true;
      } catch (errore) {
        console.error(errore);
        return false;
      }
    },
    async lancia(voci, opzioni) {
      try {
        const { creaVaschetta, lanciabili } = await caricaVaschetta();
        if (!lanciabili(voci.dadi)) return false;
        contenitore.hidden = false;
        vaschetta ??= creaVaschetta(contenitore, scelte);
        return await vaschetta.lancia(voci, opzioni);
      } catch (errore) {
        console.error(errore);
        return false;
      }
    },
    ferma: () => vaschetta?.ferma(),
  };
}

// ---------- Finestra di tiro ----------

// Chiede come tirare (vantaggio/svantaggio sui d20, critico sui danni),
// tira, chiama subito onTiro(tiro) (per il registro) e fa rotolare i dadi
// nella vaschetta; a dadi fermi mostra il risultato. onTiro può restituire
// (anche con una promessa) una riga da mostrare sotto il risultato, es. "Solo
// per te: nessuna sessione in corso".
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

  const palco = creaElemento("div", "vaschetta-tiro");
  palco.hidden = true;
  const vaschetta = montaVaschetta(palco);
  const totale = creaElemento("div", "tiro-totale");
  totale.hidden = true;
  const risultato = creaElemento("div", "risultato-pf");
  risultato.setAttribute("role", "status");
  risultato.hidden = true;
  const chiudi = creaElemento("button", "btn-tabella", "Chiudi");
  chiudi.type = "button";
  const azioni = creaElemento("div", "azioni-selettore");
  azioni.append(chiudi);
  finestra.append(palco, totale, risultato, azioni);
  sfondo.append(finestra);
  document.body.append(sfondo);

  const fine = () => {
    document.removeEventListener("keydown", tasto);
    vaschetta.ferma();
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

  scelte.addEventListener("click", async (evento) => {
    const b = evento.target.closest("[data-modo]");
    if (!b) return;
    const tiro = tira({ etichetta, quanti, facce, modificatore, modo: b.dataset.modo });
    scelte.hidden = true;
    const nota = Promise.resolve(onTiro?.(tiro)).catch(() => null);
    // Il suono del dado dura quanto il lancio nella vaschetta.
    const rotolati = await vaschetta.lancia(dadiPerVaschetta(tiro, facce), { suInizio: (durata) => suonaTiro(tiro, durata) });
    if (!sfondo.isConnected) return;
    if (!rotolati) suonaTiro(tiro, 200);
    totale.textContent = String(tiro.totale);
    totale.classList.toggle("tiro-critico", tiro.critico === "successo");
    totale.classList.toggle("tiro-fallimento", tiro.critico === "fallimento");
    totale.hidden = false;
    risultato.textContent = testoTiro(null, tiro).replace(`${tiro.etichetta}: `, "");
    risultato.classList.toggle("tiro-critico", tiro.critico === "successo");
    risultato.classList.toggle("tiro-fallimento", tiro.critico === "fallimento");
    risultato.hidden = false;
    nota.then((testo) => {
      if (testo) finestra.insertBefore(creaElemento("p", "riposo-nota", testo), azioni);
    });
  });
  scelte.querySelector('[data-modo="normale"]').focus();
}
