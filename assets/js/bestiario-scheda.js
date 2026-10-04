// Blocco statistiche di una creatura (mostro SRD o creatura del DM), con un
// pulsante con il dado sulle azioni che si possono tirare. Usato dalla pagina Bestiario
// e, durante il combattimento, dalla pagina Sessione.
// Tutto il testo passa da textContent.
import { creaElemento } from "./contenuti.js";
import { elementoIcona } from "./icone.js";
import { CARATTERISTICHE, modificatore, testoModificatore, azioneTirabile, descrizioneTipo } from "./bestiario-calcoli.js";

function riga(etichetta, valore) {
  const p = creaElemento("p", "blocco-riga");
  p.append(creaElemento("b", null, `${etichetta} `), document.createTextNode(valore));
  return p;
}

function voce(creatura, a, onTira) {
  const p = creaElemento("p", "blocco-voce");
  p.append(creaElemento("b", null, `${a.nome}. `));
  // I testi a capo (incantesimi, armi a soffio) diventano righe.
  a.testo.split("\n").forEach((parte, i) => {
    if (i > 0) p.append(document.createElement("br"));
    p.append(document.createTextNode(parte));
  });
  if (onTira && azioneTirabile(a)) {
    const b = creaElemento("button", "blocco-tiro");
    b.append(elementoIcona("dado"), Number.isFinite(a.colpire) ? testoModificatore(a.colpire) : a.ts ? "CD" : "danni");
    b.type = "button";
    b.title = `Tira: ${a.nome}`;
    b.setAttribute("aria-label", `Tira ${a.nome}`);
    b.addEventListener("click", () => onTira(a));
    p.append(" ", b);
  }
  return p;
}

const INTRO_LEGGENDARIE = (nome) => `${nome} può effettuare 3 azioni leggendarie, scegliendo tra le opzioni seguenti. Si può usare una sola opzione alla volta e solo alla fine del turno di un'altra creatura. Le azioni leggendarie spese si recuperano all'inizio del suo turno.`;

// opzioni: { onTira(azione), compatto (senza le righe di competenze e sensi) }
export function creaBloccoStatistiche(creatura, { onTira = null, compatto = false } = {}) {
  const blocco = creaElemento("div", `blocco-statistiche${compatto ? " compatto" : ""}`);
  blocco.append(
    riga("Classe Armatura", creatura.ca),
    riga("Punti Ferita", `${creatura.pf} (${String(creatura.dadiPf).replace(/([+-])/, " $1 ")})`),
    riga("Velocità", creatura.velocita),
    creaElemento("div", "blocco-filetto"),
  );
  const car = creaElemento("div", "blocco-caratteristiche");
  CARATTERISTICHE.forEach((c, i) => {
    const valore = creatura.car?.[i] ?? 10;
    const cella = creaElemento("div");
    cella.append(creaElemento("b", null, c.sigla), creaElemento("span", null, `${valore} (${testoModificatore(modificatore(valore))})`));
    car.append(cella);
  });
  blocco.append(car, creaElemento("div", "blocco-filetto"));
  const proprieta = [
    ["Tiri salvezza", creatura.ts], ["Abilità", creatura.abilita], ["Vulnerabilità ai danni", creatura.vulnerabilita],
    ["Resistenze ai danni", creatura.resistenze], ["Immunità ai danni", creatura.immunita], ["Immunità alle condizioni", creatura.immunitaCondizioni],
    ["Sensi", creatura.sensi], ["Lingue", creatura.lingue],
  ];
  if (!compatto) proprieta.filter(([, v]) => v).forEach(([e, v]) => blocco.append(riga(e, v)));
  blocco.append(riga("Grado di Sfida", `${creatura.gs}${creatura.pe != null ? ` (${Number(creatura.pe).toLocaleString("it-IT")} PE)` : ""}`));
  const sezione = (titolo, lista, intro = null) => {
    if (!lista?.length) return;
    if (titolo) blocco.append(creaElemento("h4", "blocco-sezione", titolo));
    if (intro) blocco.append(creaElemento("p", "blocco-voce", intro));
    lista.forEach((a) => blocco.append(voce(creatura, a, onTira)));
  };
  if (creatura.tratti?.length) blocco.append(creaElemento("div", "blocco-filetto"));
  sezione(null, creatura.tratti);
  sezione("Azioni", creatura.azioni);
  sezione("Reazioni", creatura.reazioni);
  sezione("Azioni leggendarie", creatura.leggendarie, INTRO_LEGGENDARIE(creatura.nome));
  return blocco;
}

export { descrizioneTipo };
