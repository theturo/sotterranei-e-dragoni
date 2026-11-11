// Lanciatore libero della pagina Sessione, nel pannello «Vaschetta dei dadi»:
// si scelgono quanti dadi, il tipo, il modificatore e (sul d20) vantaggio o
// svantaggio; i dadi rotolano nella vaschetta sotto i campi e a dadi fermi
// compare il risultato. Il tiro va subito nel registro (lo fa la pagina, con
// `registra`), così gli altri lo vedono negli appunti.
// - La vaschetta sta sempre in vista, anche vuota: larga quanto il pannello ma
//   bassa, per non rubare spazio sul telefono.
// - Un tiro nuovo prende il posto di quello ancora in corso.
// - Il d100 non ha un dado nella vaschetta: mostra solo il risultato.
import { creaElemento } from "./contenuti.js";
import { tira, testoTiro, dadiPerVaschetta } from "./dadi-base.js";
import { montaVaschetta } from "./dadi.js";
import { suonaTiro } from "./suoni.js";

// Metà della larghezza, tra 170 px (telefono) e 240 px (computer).
const altezzaBassa = (larghezza) => Math.round(Math.min(240, Math.max(170, larghezza * 0.5)));

// modulo: il <form> con i campi; palco: dove sta la vaschetta; esito: la riga
// del risultato; registra(tiro): scrive il tiro nel registro e risolve true
// se c'è riuscita (false senza sessione in corso).
export function montaLanciatoreDadi({ modulo, palco, esito, registra }) {
  const campo = (id) => modulo.querySelector(`#${id}`);
  const vaschetta = montaVaschetta(palco, { altezza: altezzaBassa });
  let giro = 0;
  let inLancio = false;

  const invito = () => esito.replaceChildren(creaElemento("p", "esito-dadi-invito", "Scegli i dadi e premi «Tira»."));
  invito();

  // La vaschetta vuota si disegna appena il pannello ha una larghezza (la
  // pagina compare dopo l'accesso) e si ridisegna se la larghezza cambia, per
  // esempio girando il telefono.
  let larghezza = 0;
  new ResizeObserver(() => {
    const nuova = Math.round(palco.clientWidth);
    if (!nuova || nuova === larghezza) return;
    larghezza = nuova;
    if (!inLancio) vaschetta.vuota();
  }).observe(palco);

  // Vantaggio e svantaggio valgono solo sul d20.
  campo("dadi-facce").addEventListener("change", (evento) => {
    const modo = campo("dadi-modo");
    modo.disabled = evento.target.value !== "20";
    if (modo.disabled) modo.value = "normale";
  });

  function scrivi(tiro) {
    const totale = creaElemento("b", "esito-dadi-totale", String(tiro.totale));
    const testo = creaElemento("span", "esito-dadi-testo", testoTiro(null, tiro));
    const riga = creaElemento("p", "esito-dadi-riga");
    riga.classList.toggle("tiro-critico", tiro.critico === "successo");
    riga.classList.toggle("tiro-fallimento", tiro.critico === "fallimento");
    riga.append(totale, testo);
    esito.replaceChildren(riga);
  }

  modulo.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const valore = (id) => Math.trunc(Number(campo(id).value)) || 0;
    const facce = valore("dadi-facce");
    const tiro = tira({
      etichetta: campo("dadi-etichetta").value.trim() || "Tiro",
      quanti: Math.max(1, valore("dadi-quanti")),
      facce,
      modificatore: valore("dadi-modificatore"),
      modo: campo("dadi-modo").value,
    });
    campo("dadi-etichetta").value = "";
    const mio = ++giro;
    const registrato = Promise.resolve(registra(tiro)).catch(() => false);
    inLancio = true;
    esito.replaceChildren();
    // Il suono del dado dura quanto il lancio nella vaschetta.
    const rotolati = await vaschetta.lancia(dadiPerVaschetta(tiro, facce), { suInizio: (durata) => suonaTiro(tiro, durata) });
    if (mio !== giro) return;
    inLancio = false;
    if (!rotolati) {
      // Niente dadi da far rotolare (d100): il suono breve e la vaschetta vuota.
      suonaTiro(tiro);
      vaschetta.vuota();
    }
    scrivi(tiro);
    if (!(await registrato) && mio === giro) {
      esito.append(creaElemento("p", "esito-dadi-nota", "Solo per te: nessuna sessione in corso."));
    }
  });
}
