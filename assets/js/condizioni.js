// Condizioni (prono, avvelenato…) ed esaurimento: etichette da mostrare e
// selettore per modificarle. Usato da party della Sessione, tracker di
// combattimento e scheda personaggio.
import { CONDIZIONI, LIVELLI_ESAURIMENTO } from "./dati-srd.js";
import { creaElemento } from "./contenuti.js";

const PER_CHIAVE = new Map(CONDIZIONI.map((c) => [c.chiave, c]));

// Etichette delle condizioni attive (vuoto se nessuna). La descrizione è nel
// tooltip, per ricordare al tavolo cosa comporta.
export function creaChipCondizioni(condizioni = [], esaurimento = 0) {
  const contenitore = creaElemento("div", "chip-condizioni");
  condizioni.forEach((chiave) => {
    const dati = PER_CHIAVE.get(chiave);
    if (!dati) return;
    const chip = creaElemento("span", "chip-condizione", dati.nome);
    chip.title = dati.descrizione;
    contenitore.append(chip);
  });
  if (esaurimento > 0) {
    const chip = creaElemento("span", "chip-condizione chip-esaurimento", `Esaurimento ${esaurimento}`);
    chip.title = LIVELLI_ESAURIMENTO[esaurimento] || "";
    contenitore.append(chip);
  }
  contenitore.hidden = contenitore.childElementCount === 0;
  return contenitore;
}

// Selettore: un pulsante per condizione (acceso/spento) e, se richiesto, il
// livello di esaurimento. Ogni modifica chiama subito onCambia({ condizioni,
// esaurimento }) con il nuovo stato completo.
export function creaEditorCondizioni({ condizioni = [], esaurimento = 0, conEsaurimento = true, onCambia }) {
  const stato = { condizioni: [...condizioni], esaurimento };
  const editor = creaElemento("div", "editor-condizioni");
  const griglia = creaElemento("div", "griglia-condizioni");
  CONDIZIONI.forEach(({ chiave, nome, descrizione }) => {
    const bottone = creaElemento("button", "toggle-condizione", nome);
    bottone.type = "button";
    bottone.title = descrizione;
    bottone.dataset.condizione = chiave;
    bottone.setAttribute("aria-pressed", String(stato.condizioni.includes(chiave)));
    bottone.addEventListener("click", () => {
      const attiva = bottone.getAttribute("aria-pressed") === "true";
      stato.condizioni = attiva
        ? stato.condizioni.filter((c) => c !== chiave)
        : CONDIZIONI.map((c) => c.chiave).filter((c) => c === chiave || stato.condizioni.includes(c));
      bottone.setAttribute("aria-pressed", String(!attiva));
      onCambia({ ...stato });
    });
    griglia.append(bottone);
  });
  editor.append(griglia);

  if (conEsaurimento) {
    const etichetta = creaElemento("label", "campo-esaurimento");
    const select = document.createElement("select");
    select.className = "select-esaurimento";
    LIVELLI_ESAURIMENTO.forEach((testo, livello) => select.add(new Option(livello === 0 ? "Nessuno" : testo, String(livello))));
    select.value = String(stato.esaurimento || 0);
    select.addEventListener("change", () => {
      stato.esaurimento = Number(select.value);
      onCambia({ ...stato });
    });
    etichetta.append("Esaurimento", select);
    editor.append(etichetta);
  }
  return editor;
}
