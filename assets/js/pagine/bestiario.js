// Script di bestiario.html: il bestiario del DM.
// - Elenco con ricerca e filtri (fonte, grado di sfida, tipo, taglia) di tutti
//   i mostri del SRD 5.1 (mostri-srd.js) e delle creature create dal DM.
// - Scheda con il blocco statistiche 5e e i tiri a un clic (🎲): se c'è una
//   sessione in corso finiscono nel suo registro, nascosti ai giocatori a meno
//   che il DM non li renda visibili.
// - Creature del DM: «+ Nuova creatura» o «Usa come base» su qualsiasi
//   creatura, modifica di tutto il blocco, indole (ostile, neutrale, alleata)
//   e personaggi unici con uno stato che continua tra le sessioni (PF,
//   condizioni, risorse, equipaggiamento, diario delle apparizioni).
// - «Aggiungi al combattimento»: la creatura entra nel tracker della Sessione
//   (se c'è un combattimento), collegata alla sua scheda.
// Dati e permessi: "Bestiario" in auth.js e firestore.rules.
import {
  proteggiPaginaDM, ottieniCampagnaCorrente, ascoltaBestiario, creaCreatura, salvaCreatura, salvaStatoCreatura, eliminaCreatura,
  ascoltaLibreriaDM, sessioneInCorso, aggiungiTiro, aggiungiNemici, combattimentoAttivo, creatureInCombattimento,
} from "../auth.js";
import { montaMenuUtente } from "../menu-utente.js";
import { creaElemento } from "../contenuti.js";
import { urlImmagine, percorsiImmagineCampagna } from "../immagini.js";
import { CONDIZIONI } from "../dati-srd.js";
import { leggiFormula } from "../dadi.js";
import { MOSTRI } from "../mostri-srd.js";
import { creaBloccoStatistiche } from "../bestiario-scheda.js";
import {
  INDOLI, TAGLIE_CREATURA, TIPI_CREATURA, CARATTERISTICHE, FASCE_GS, descrizioneTipo, tiraAzione, filtraCreature, copiaCreatura,
  creaturaVuota, danniDaTesto, testoDaDanni, statoIniziale, riposoLungo, cambiaUsi, etichettaDiario, bonusIniziativa,
} from "../bestiario-calcoli.js";

const veil = document.getElementById("veil");
const contenuto = document.getElementById("contenuto");
const toast = document.getElementById("toast");
const lista = document.getElementById("bestiario-lista");
const dettaglio = document.getElementById("bestiario-dettaglio");
const conteggio = document.getElementById("bestiario-conteggio");
const filtri = {
  testo: document.getElementById("filtro-testo"),
  gs: document.getElementById("filtro-gs"),
  tipo: document.getElementById("filtro-tipo"),
  taglia: document.getElementById("filtro-taglia"),
  fonte: "",
};
const NOMI_TAGLIE = { minuscola: "Minuscola", piccola: "Piccola", media: "Media", grande: "Grande", enorme: "Enorme", mastodontica: "Mastodontica" };
const NOMI_CONDIZIONI = new Map(CONDIZIONI.map((c) => [c.chiave, c.nome]));

let toastTimer = null;
function mostraToast(testo, errore = false) {
  toast.textContent = testo;
  toast.className = `toast visibile${errore ? " toast-errore" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.className = "toast"), 3200);
}
const bottone = (testo, classe = "btn-tabella") => {
  const b = creaElemento("button", classe, testo);
  b.type = "button";
  return b;
};

const SRD = MOSTRI.map((m) => ({ ...m, id: `srd:${m.chiave}`, fonte: "srd", indole: "ostile" }));
let campagnaId = null;
let utente = null;
let mie = [];
let immagini = []; // Libreria: PNG e nemici prima
let sceltaId = null;
let modifica = null; // bozza della creatura in modifica (o null)

const tutte = () => [...mie, ...SRD];
const creatura = (id) => tutte().find((c) => c.id === id);

// ---------- filtri ----------
function riempiFiltri() {
  filtri.gs.replaceChildren(...FASCE_GS.map((f) => new Option(f.nome, f.chiave)));
  filtri.tipo.replaceChildren(new Option("Tutti i tipi", ""), ...TIPI_CREATURA.map((t) => new Option(t[0].toUpperCase() + t.slice(1), t)));
  filtri.taglia.replaceChildren(new Option("Tutte le taglie", ""), ...TAGLIE_CREATURA.map((t) => new Option(NOMI_TAGLIE[t], t)));
  for (const el of [filtri.testo, filtri.gs, filtri.tipo, filtri.taglia]) el.addEventListener("input", disegnaLista);
  document.querySelectorAll(".chip-filtro").forEach((chip) => chip.addEventListener("click", () => {
    filtri.fonte = chip.dataset.fonte;
    disegnaLista();
  }));
}

// ---------- avatar ----------
const COLORI_TIPO = {
  bestia: "#6f6a4a", drago: "#a5293a", "non morto": "#8a8678", immondo: "#7a1f2b", umanoide: "#8a6a3a", gigante: "#6a5a3a",
  elementale: "#3a6a8a", celestiale: "#c9a227", folletto: "#4f9a72", aberrazione: "#6a4a8a", mostruosità: "#5f7d4a",
};
const iniziali = (nome) => nome.split(/[\s,]+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
function creaAvatar(c, grande = false) {
  const avatar = creaElemento("span", `bestiario-avatar${grande ? " grande" : ""}`, iniziali(c.nome));
  avatar.style.setProperty("--colore", COLORI_TIPO[c.tipo] || "#6a5a4a");
  if (c.immagineId && campagnaId) {
    urlImmagine(percorsiImmagineCampagna(campagnaId, c.immagineId).mini).then((url) => {
      const img = creaElemento("img");
      img.alt = "";
      img.src = url;
      avatar.replaceChildren(img);
    }).catch(() => {});
  }
  return avatar;
}
const etichettaIndole = (indole) => {
  const el = creaElemento("span", `bestiario-indole ${indole}`, INDOLI.find((i) => i.chiave === indole)?.nome || "");
  return el;
};

// ---------- elenco ----------
function disegnaLista() {
  document.querySelectorAll(".chip-filtro").forEach((chip) => {
    const scelto = chip.dataset.fonte === filtri.fonte;
    chip.classList.toggle("scelto", scelto);
    chip.setAttribute("aria-pressed", String(scelto));
  });
  const elenco = filtraCreature(tutte(), {
    testo: filtri.testo.value, fonte: filtri.fonte, gs: filtri.gs.value, tipo: filtri.tipo.value, taglia: filtri.taglia.value,
  });
  conteggio.textContent = elenco.length === 1 ? "1 creatura" : `${elenco.length} creature`;
  lista.replaceChildren(...elenco.map((c) => {
    const li = creaElemento("li");
    const voce = bottone("", `bestiario-voce${c.id === sceltaId ? " scelta" : ""}`);
    voce.dataset.id = c.id;
    const testo = creaElemento("span", "bestiario-voce-testo");
    testo.append(creaElemento("b", null, c.nome), creaElemento("small", null, `${descrizioneTipo({ tipo: c.tipo, taglia: c.taglia })} · GS ${c.gs}`));
    const fonte = creaElemento("span", `bestiario-fonte ${c.fonte}${c.unico ? " unico" : ""}`, c.fonte === "srd" ? "SRD" : c.unico ? "Unico" : "Modello");
    voce.append(creaAvatar(c), testo, etichettaIndole(c.indole), fonte);
    voce.addEventListener("click", () => scegli(c.id, true));
    li.append(voce);
    return li;
  }));
  if (!elenco.length) lista.append(creaElemento("li", "sessione-placeholder", "Nessuna creatura trovata."));
}

function scegli(id, scorri = false) {
  sceltaId = id;
  modifica = null;
  try {
    history.replaceState(null, "", id ? `#${encodeURIComponent(id)}` : location.pathname);
  } catch {
    // Solo una comodità per ricaricare la pagina sulla stessa creatura.
  }
  disegnaLista();
  disegnaDettaglio();
  if (scorri && window.matchMedia("(max-width: 900px)").matches) dettaglio.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- tiri ----------
const tiriElenco = document.getElementById("tiri-elenco");
const tiriVisibili = document.getElementById("tiri-visibili");
const tiriNota = document.getElementById("tiri-nota");
try {
  tiriVisibili.checked = localStorage.getItem("sed-bestiario-tiri-visibili") === "1";
} catch {
  // Senza memoria i tiri partono nascosti.
}
tiriVisibili.addEventListener("change", () => {
  try {
    localStorage.setItem("sed-bestiario-tiri-visibili", tiriVisibili.checked ? "1" : "0");
  } catch {
    // Solo una comodità.
  }
});
async function tira(c, azione) {
  const { testo, tiro } = tiraAzione(c, azione);
  const li = creaElemento("li", null, testo);
  tiriElenco.prepend(li);
  while (tiriElenco.children.length > 8) tiriElenco.lastChild.remove();
  try {
    const sessione = await sessioneInCorso(campagnaId);
    if (!sessione) {
      tiriNota.textContent = "Nessuna sessione in corso: i tiri restano qui.";
      return;
    }
    const nascosto = !tiriVisibili.checked;
    await aggiungiTiro(sessione.id, utente.uid, utente.nome, testo, tiro, nascosto);
    li.append(creaElemento("span", `bestiario-tag${nascosto ? "" : " visibile"}`, nascosto ? "🔒 nel registro, solo DM" : "👁 nel registro, a tutti"));
    tiriNota.textContent = "";
  } catch (errore) {
    console.error(errore);
    mostraToast("Impossibile scrivere il tiro nel registro.", true);
  }
}

// ---------- scheda ----------
function disegnaDettaglio() {
  if (modifica) {
    dettaglio.replaceChildren(moduloModifica());
    return;
  }
  const c = sceltaId && creatura(sceltaId);
  if (!c) {
    dettaglio.replaceChildren(creaElemento("p", "sessione-placeholder", "Scegli una creatura dall'elenco."));
    return;
  }
  const testa = creaElemento("div", "bestiario-testa");
  const titoli = creaElemento("div");
  const etichette = creaElemento("div", "bestiario-etichette");
  etichette.append(etichettaIndole(c.indole), creaElemento("span", null, c.fonte === "srd" ? "Mostro del SRD 5.1" : c.unico ? "Personaggio unico" : "Creata da te"));
  titoli.append(creaElemento("h2", null, c.nome), creaElemento("p", "bestiario-sottotitolo", descrizioneTipo(c)), etichette);
  const base = c.base && SRD.find((m) => m.chiave === c.base);
  if (base) titoli.append(creaElemento("p", "bestiario-base", `Basata su: ${base.nome} (SRD)`));
  testa.append(creaAvatar(c, true), titoli);

  const azioni = creaElemento("div", "bestiario-azioni");
  if (c.fonte === "dm") {
    const bModifica = bottone("Modifica");
    bModifica.addEventListener("click", () => apriModifica(c));
    const elimina = bottone("Elimina", "btn-tabella btn-tabella-pericolo");
    elimina.addEventListener("click", async () => {
      if (!confirm(`Eliminare «${c.nome}» dal bestiario?`)) return;
      try {
        await eliminaCreatura(campagnaId, c.id);
        mostraToast(`«${c.nome}» eliminata.`);
        scegli(null);
      } catch (errore) {
        console.error(errore);
        mostraToast("Impossibile eliminare la creatura.", true);
      }
    });
    azioni.append(bModifica, elimina);
  }
  const usa = bottone("Usa come base");
  usa.title = "Crea una copia modificabile di questa creatura";
  usa.addEventListener("click", () => apriModifica(copiaCreatura(c), true));
  const combatti = bottone("Aggiungi al combattimento", "btn-tabella btn-tabella-evidenza");
  combatti.title = "Entra nel tracker della Sessione (nascosta ai giocatori, se non è alleata)";
  combatti.addEventListener("click", () => aggiungiAlCombattimento(c, combatti));
  azioni.append(usa, combatti);

  const parti = [testa, azioni];
  if (c.fonte === "dm" && c.unico) parti.push(pannelloStato(c));
  parti.push(creaBloccoStatistiche(c, { onTira: (a) => tira(c, a) }));
  if (c.note) {
    const note = creaElemento("div", "bestiario-note");
    note.append(creaElemento("b", null, "Note del DM: "), document.createTextNode(c.note));
    parti.push(note);
  }
  dettaglio.replaceChildren(...parti);
}

async function aggiungiAlCombattimento(c, pulsante) {
  pulsante.disabled = true;
  try {
    if (!(await combattimentoAttivo(campagnaId))) {
      mostraToast("Nessun combattimento in corso: avvialo dalla pagina Sessione.", true);
      return;
    }
    const unico = c.fonte === "dm" && c.unico;
    if (unico && (await creatureInCombattimento(campagnaId)).has(c.id)) {
      mostraToast(`«${c.nome}» è già in combattimento.`, true);
      return;
    }
    const alleato = c.indole === "alleata";
    await aggiungiNemici(campagnaId, {
      nome: c.nome.slice(0, 50),
      bonus: bonusIniziativa(c),
      pfMassimi: c.pf,
      immagineId: c.immagineId || null,
      taglia: c.taglia || "media",
      nascosti: !alleato,
      alleato,
      creatura: { fonte: c.fonte, id: c.fonte === "srd" ? c.chiave : c.id },
      ...(unico ? { pfAttuali: Math.min(c.pf, c.stato?.pfAttuali ?? c.pf), condizioni: c.stato?.condizioni || [] } : {}),
    });
    mostraToast(`«${c.nome}» è nel tracker${alleato ? "" : " (nascosta ai giocatori)"}.`);
  } catch (errore) {
    console.error(errore);
    mostraToast("Impossibile aggiungerla al combattimento.", true);
  } finally {
    pulsante.disabled = false;
  }
}

// ---------- stato dei personaggi unici ----------
let timerStato = null;
let statoInAttesa = null;
function salvaStato(c, stato) {
  c.stato = stato;
  statoInAttesa = { id: c.id, stato };
  clearTimeout(timerStato);
  timerStato = setTimeout(async () => {
    const daSalvare = statoInAttesa;
    statoInAttesa = null;
    try {
      await salvaStatoCreatura(campagnaId, daSalvare.id, daSalvare.stato);
    } catch (errore) {
      console.error(errore);
      mostraToast("Impossibile salvare lo stato.", true);
    }
  }, 400);
}

let numeroSessione;
async function etichettaOggi() {
  if (numeroSessione === undefined) {
    try {
      numeroSessione = (await sessioneInCorso(campagnaId))?.numero ?? null;
    } catch {
      numeroSessione = null;
    }
  }
  return etichettaDiario(numeroSessione);
}

function pannelloStato(c) {
  const stato = { ...statoIniziale(c), ...(c.stato || {}) };
  const aggiorna = (nuovo) => {
    salvaStato(c, nuovo);
    disegnaDettaglio();
  };
  const pannello = creaElemento("section", "bestiario-stato");
  const titolo = creaElemento("h3", null, "Stato attuale");
  titolo.append(creaElemento("small", null, " continua tra le sessioni"));
  const riposo = bottone("Riposo lungo");
  riposo.addEventListener("click", async () => aggiorna(riposoLungo(c, stato, await etichettaOggi())));
  const intestazione = creaElemento("div", "bestiario-stato-testa");
  intestazione.append(titolo, riposo);

  // PF
  const pf = creaElemento("div", "bestiario-stato-campo");
  pf.append(creaElemento("b", null, "Punti ferita"));
  const rigaPf = creaElemento("div", "bestiario-pf");
  const meno = bottone("−", "btn-tabella bestiario-mini");
  meno.setAttribute("aria-label", "Togli 1 PF");
  const piu = bottone("+", "btn-tabella bestiario-mini");
  piu.setAttribute("aria-label", "Aggiungi 1 PF");
  const valore = creaElemento("input", "input-dadi bestiario-pf-valore");
  Object.assign(valore, { type: "number", min: 0, max: c.pf, value: stato.pfAttuali });
  valore.setAttribute("aria-label", "PF attuali");
  const cambiaPf = (n) => aggiorna({ ...stato, pfAttuali: Math.max(0, Math.min(c.pf, n)) });
  meno.addEventListener("click", () => cambiaPf(stato.pfAttuali - 1));
  piu.addEventListener("click", () => cambiaPf(stato.pfAttuali + 1));
  valore.addEventListener("change", () => cambiaPf(Number(valore.value) || 0));
  rigaPf.append(meno, valore, creaElemento("span", null, `/ ${c.pf}`), piu);
  const barra = creaElemento("div", "bestiario-barra-pf");
  const pieno = creaElemento("div");
  const quota = c.pf ? stato.pfAttuali / c.pf : 0;
  pieno.style.width = `${Math.round(quota * 100)}%`;
  pieno.style.background = quota > 0.5 ? "#3f9a6a" : quota > 0.25 ? "#c9a227" : "#a5293a";
  barra.append(pieno);
  pf.append(rigaPf, barra);

  // Condizioni
  const cond = creaElemento("div", "bestiario-stato-campo");
  cond.append(creaElemento("b", null, "Condizioni"));
  const chips = creaElemento("div", "bestiario-chips-stato");
  stato.condizioni.forEach((k) => {
    const chip = creaElemento("span", "bestiario-chip-cond", NOMI_CONDIZIONI.get(k) || k);
    const x = bottone("×", "bestiario-x");
    x.setAttribute("aria-label", `Togli ${NOMI_CONDIZIONI.get(k) || k}`);
    x.addEventListener("click", () => aggiorna({ ...stato, condizioni: stato.condizioni.filter((y) => y !== k) }));
    chip.append(x);
    chips.append(chip);
  });
  if (!stato.condizioni.length) chips.append(creaElemento("span", "bestiario-vuoto", "nessuna"));
  const sceltaCond = creaElemento("select", "select-dadi");
  sceltaCond.setAttribute("aria-label", "Condizione da aggiungere");
  sceltaCond.replaceChildren(new Option("Aggiungi condizione…", ""), ...CONDIZIONI.filter((x) => !stato.condizioni.includes(x.chiave)).map((x) => new Option(x.nome, x.chiave)));
  sceltaCond.addEventListener("change", () => {
    if (sceltaCond.value) aggiorna({ ...stato, condizioni: [...stato.condizioni, sceltaCond.value] });
  });
  cond.append(chips, sceltaCond);

  // Risorse
  const ris = creaElemento("div", "bestiario-stato-campo");
  ris.append(creaElemento("b", null, "Risorse"));
  stato.risorse.forEach((r, i) => {
    const rigaR = creaElemento("div", "bestiario-risorsa");
    rigaR.append(creaElemento("span", null, r.nome));
    for (let j = 0; j < r.max; j += 1) {
      const pallino = bottone("", `bestiario-pallino${j < r.usati ? " usato" : ""}`);
      pallino.setAttribute("aria-label", `${r.nome}: ${j < r.usati ? "usato" : "disponibile"}`);
      pallino.addEventListener("click", () => aggiorna({ ...stato, risorse: stato.risorse.map((y, k) => (k === i ? cambiaUsi(y, j) : y)) }));
      rigaR.append(pallino);
    }
    const x = bottone("×", "bestiario-x");
    x.setAttribute("aria-label", `Togli ${r.nome}`);
    x.addEventListener("click", () => aggiorna({ ...stato, risorse: stato.risorse.filter((_, k) => k !== i) }));
    rigaR.append(x);
    ris.append(rigaR);
  });
  const nuovaR = creaElemento("form", "bestiario-aggiungi");
  const nomeR = creaElemento("input", "input-dadi");
  Object.assign(nomeR, { placeholder: "Es. Grido di battaglia (1/giorno)", maxLength: 60, required: true });
  nomeR.setAttribute("aria-label", "Nome della risorsa");
  const maxR = creaElemento("input", "input-dadi bestiario-numero");
  Object.assign(maxR, { type: "number", min: 1, max: 9, value: 1 });
  maxR.setAttribute("aria-label", "Usi");
  const piuR = creaElemento("button", "btn-tabella bestiario-mini", "+");
  piuR.type = "submit";
  piuR.setAttribute("aria-label", "Aggiungi risorsa");
  nuovaR.append(nomeR, maxR, piuR);
  nuovaR.addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = nomeR.value.trim();
    if (nome) aggiorna({ ...stato, risorse: [...stato.risorse, { nome: nome.slice(0, 60), max: Math.max(1, Math.min(9, Number(maxR.value) || 1)), usati: 0 }].slice(0, 20) });
  });
  ris.append(nuovaR);

  // Equipaggiamento
  const eq = creaElemento("div", "bestiario-stato-campo");
  eq.append(creaElemento("b", null, "Equipaggiamento"));
  const ul = creaElemento("ul", "bestiario-equip");
  stato.equip.forEach((o, i) => {
    const li = creaElemento("li", null, o);
    const x = bottone("×", "bestiario-x");
    x.setAttribute("aria-label", `Togli ${o}`);
    x.addEventListener("click", () => aggiorna({ ...stato, equip: stato.equip.filter((_, k) => k !== i) }));
    li.append(" ", x);
    ul.append(li);
  });
  const nuovoO = creaElemento("form", "bestiario-aggiungi");
  const testoO = creaElemento("input", "input-dadi");
  Object.assign(testoO, { placeholder: "Aggiungi oggetto…", maxLength: 80, required: true });
  testoO.setAttribute("aria-label", "Oggetto da aggiungere");
  const piuO = creaElemento("button", "btn-tabella bestiario-mini", "+");
  piuO.type = "submit";
  piuO.setAttribute("aria-label", "Aggiungi oggetto");
  nuovoO.append(testoO, piuO);
  nuovoO.addEventListener("submit", (e) => {
    e.preventDefault();
    if (testoO.value.trim()) aggiorna({ ...stato, equip: [...stato.equip, testoO.value.trim().slice(0, 80)].slice(0, 60) });
  });
  eq.append(ul, nuovoO);

  // Diario
  const diario = creaElemento("div", "bestiario-stato-campo bestiario-diario");
  diario.append(creaElemento("b", null, "Diario delle apparizioni"));
  [...stato.diario].reverse().forEach((v) => {
    const p = creaElemento("p", "bestiario-voce-diario");
    p.append(creaElemento("b", null, v.sessione), document.createTextNode(` — ${v.testo}`));
    diario.append(p);
  });
  const nuovaV = creaElemento("form", "bestiario-aggiungi");
  const testoV = creaElemento("input", "input-dadi");
  Object.assign(testoV, { placeholder: "Nota per la sessione di oggi…", maxLength: 300, required: true });
  testoV.setAttribute("aria-label", "Nota del diario");
  const annota = creaElemento("button", "btn-tabella", "Annota");
  annota.type = "submit";
  nuovaV.append(testoV, annota);
  nuovaV.addEventListener("submit", async (e) => {
    e.preventDefault();
    const testo = testoV.value.trim();
    if (testo) aggiorna({ ...stato, diario: [...stato.diario, { sessione: await etichettaOggi(), testo: testo.slice(0, 300) }].slice(-50) });
  });
  diario.append(nuovaV);

  const griglia = creaElemento("div", "bestiario-stato-griglia");
  griglia.append(pf, cond, ris, eq, diario);
  pannello.append(intestazione, griglia);
  return pannello;
}

// ---------- modifica ----------
function apriModifica(c, nuova = false) {
  modifica = { ...structuredClone(c), nuova, idOriginale: nuova ? null : c.id };
  disegnaDettaglio();
  dettaglio.scrollIntoView({ behavior: "smooth", block: "start" });
}

function campo(etichetta, controllo, largo = false) {
  const label = creaElemento("label", `bestiario-campo${largo ? " largo" : ""}`);
  label.append(creaElemento("span", null, etichetta), controllo);
  return label;
}
function input(valore, opzioni = {}) {
  const el = creaElemento("input", "input-dadi");
  Object.assign(el, { type: "text", value: valore ?? "", ...opzioni });
  return el;
}
function select(valore, voci) {
  const el = creaElemento("select", "select-dadi");
  el.replaceChildren(...voci.map(([v, t]) => new Option(t, v)));
  el.value = valore ?? "";
  return el;
}

const SEZIONI = [
  ["tratti", "Tratti", 30, "tratto"], ["azioni", "Azioni", 30, "azione"], ["reazioni", "Reazioni", 10, "reazione"],
  ["leggendarie", "Azioni leggendarie", 10, "azione leggendaria"],
];

function editorVoci(m, chiave, titolo, massimo, singolare) {
  const box = creaElemento("fieldset", "bestiario-voci");
  box.append(creaElemento("legend", null, titolo));
  const voci = m[chiave] || (m[chiave] = []);
  const ridisegna = () => box.replaceWith(editorVoci(m, chiave, titolo, massimo, singolare));
  voci.forEach((a, i) => {
    const riga = creaElemento("div", "bestiario-voce-modifica");
    const nome = input(a.nome, { maxLength: 80 });
    nome.addEventListener("input", () => (a.nome = nome.value));
    const testo = creaElemento("textarea", "input-dadi");
    testo.rows = 3;
    testo.maxLength = 2000;
    testo.value = a.testo || "";
    testo.addEventListener("input", () => (a.testo = testo.value));
    const colpire = input(Number.isFinite(a.colpire) ? a.colpire : "", { type: "number", min: -5, max: 30 });
    colpire.addEventListener("input", () => {
      if (colpire.value === "") delete a.colpire;
      else a.colpire = Number(colpire.value);
    });
    const danni = input(testoDaDanni(a.danni), { placeholder: "1d6+2 taglienti; 2d6 fuoco" });
    danni.addEventListener("input", () => {
      const d = danniDaTesto(danni.value);
      if (d.length) a.danni = d;
      else delete a.danni;
    });
    const cd = input(a.ts?.cd ?? "", { type: "number", min: 1, max: 40 });
    const car = select(a.ts?.car ?? "des", CARATTERISTICHE.map((x) => [x.chiave, x.nome]));
    const meta = creaElemento("input");
    meta.type = "checkbox";
    meta.checked = Boolean(a.ts?.meta);
    const aggiornaTs = () => {
      if (cd.value === "") delete a.ts;
      else a.ts = { cd: Number(cd.value), car: car.value, ...(meta.checked ? { meta: true } : {}) };
    };
    for (const el of [cd, car, meta]) el.addEventListener("input", aggiornaTs);
    const ricarica = select(a.ricarica ? String(a.ricarica) : "", [["", "—"], ["6", "6"], ["5", "5–6"], ["4", "4–6"]]);
    ricarica.addEventListener("input", () => {
      if (ricarica.value) a.ricarica = Number(ricarica.value);
      else delete a.ricarica;
    });
    const metaLabel = creaElemento("label", "bestiario-campo-check");
    metaLabel.append(meta, document.createTextNode(" metà se superato"));
    const tiro = creaElemento("div", "bestiario-tiro-modifica");
    tiro.append(campo("Bonus per colpire", colpire), campo("Danni", danni), campo("CD", cd), campo("Tiro salvezza su", car), metaLabel, campo("Ricarica", ricarica));
    const comandi = creaElemento("div", "bestiario-voce-comandi");
    const su = bottone("↑", "btn-tabella bestiario-mini");
    su.setAttribute("aria-label", `Sposta su ${a.nome}`);
    su.disabled = i === 0;
    su.addEventListener("click", () => {
      [voci[i - 1], voci[i]] = [voci[i], voci[i - 1]];
      ridisegna();
    });
    const togli = bottone("×", "btn-tabella btn-tabella-pericolo bestiario-mini");
    togli.setAttribute("aria-label", `Togli ${a.nome}`);
    togli.addEventListener("click", () => {
      voci.splice(i, 1);
      ridisegna();
    });
    comandi.append(su, togli);
    riga.append(campo("Nome", nome), comandi, campo("Testo", testo, true), tiro);
    box.append(riga);
  });
  const aggiungi = bottone(`+ Aggiungi ${singolare}`);
  aggiungi.disabled = voci.length >= massimo;
  aggiungi.addEventListener("click", () => {
    voci.push({ nome: "", testo: "" });
    ridisegna();
  });
  box.append(aggiungi);
  return box;
}

function moduloModifica() {
  const m = modifica;
  const form = creaElemento("form", "bestiario-modifica");
  form.noValidate = true;
  form.append(creaElemento("h2", null, m.nuova ? "Nuova creatura" : `Modifica: ${m.nome}`));

  const g = creaElemento("div", "bestiario-griglia-modifica");
  const lega = (el, chiave, conv = (v) => v) => {
    el.addEventListener("input", () => (m[chiave] = conv(el.value)));
    return el;
  };
  const nome = lega(input(m.nome, { maxLength: 60, required: true }), "nome");
  const unico = creaElemento("input");
  unico.type = "checkbox";
  unico.checked = Boolean(m.unico);
  unico.addEventListener("change", () => (m.unico = unico.checked));
  const unicoLabel = creaElemento("label", "bestiario-campo-check largo");
  unicoLabel.append(unico, document.createTextNode(" Personaggio unico: un solo esemplare, con PF, condizioni, risorse, equipaggiamento e diario che continuano tra le sessioni"));
  const immagini2 = [["", "Nessuna"], ...immagini.map((x) => [x.id, x.titolo])];
  g.append(
    campo("Nome", nome),
    campo("Indole", lega(select(m.indole, INDOLI.map((x) => [x.chiave, x.nome])), "indole")),
    unicoLabel,
    campo("Taglia", lega(select(m.taglia, TAGLIE_CREATURA.map((t) => [t, NOMI_TAGLIE[t]])), "taglia")),
    campo("Tipo", lega(select(m.tipo, TIPI_CREATURA.map((t) => [t, t])), "tipo")),
    campo("Sottotipo", lega(input(m.sottotipo, { maxLength: 40, placeholder: "facoltativo" }), "sottotipo")),
    campo("Allineamento", lega(input(m.allineamento, { maxLength: 60 }), "allineamento")),
    campo("Classe Armatura (testo)", lega(input(m.ca, { maxLength: 120 }), "ca")),
    campo("CA (numero)", lega(input(m.caValore, { type: "number", min: 0, max: 40 }), "caValore", Number)),
    campo("PF (media)", lega(input(m.pf, { type: "number", min: 1, max: 10000 }), "pf", Number)),
    campo("Dadi vita", lega(input(m.dadiPf, { maxLength: 30, placeholder: "9d8+18" }), "dadiPf")),
    campo("Velocità", lega(input(m.velocita, { maxLength: 120 }), "velocita")),
    campo("Grado di Sfida", lega(input(m.gs, { maxLength: 6, placeholder: "1/4" }), "gs")),
    campo("PE", lega(input(m.pe, { type: "number", min: 0, max: 1000000 }), "pe", Number)),
    campo("Immagine dalla Libreria", lega(select(m.immagineId || "", immagini2), "immagineId", (v) => v || null)),
  );
  const car = creaElemento("div", "bestiario-car-modifica");
  CARATTERISTICHE.forEach((c, i) => {
    const el = input(m.car?.[i] ?? 10, { type: "number", min: 1, max: 30 });
    el.addEventListener("input", () => (m.car[i] = Number(el.value) || 10));
    car.append(campo(c.sigla, el));
  });
  const testi = creaElemento("div", "bestiario-griglia-modifica");
  for (const [chiave, etichetta] of [["ts", "Tiri salvezza"], ["abilita", "Abilità"], ["vulnerabilita", "Vulnerabilità ai danni"],
    ["resistenze", "Resistenze ai danni"], ["immunita", "Immunità ai danni"], ["immunitaCondizioni", "Immunità alle condizioni"],
    ["sensi", "Sensi"], ["lingue", "Lingue"]]) {
    testi.append(campo(etichetta, lega(input(m[chiave], { maxLength: 300 }), chiave)));
  }
  const note = creaElemento("textarea", "input-dadi");
  note.rows = 3;
  note.maxLength = 4000;
  note.value = m.note || "";
  lega(note, "note");

  const errore = creaElemento("p", "bestiario-errore");
  errore.setAttribute("role", "alert");
  const salva = creaElemento("button", "btn-tabella btn-tabella-evidenza", m.nuova ? "Crea" : "Salva");
  salva.type = "submit";
  const annulla = bottone("Annulla");
  annulla.addEventListener("click", () => {
    modifica = null;
    disegnaDettaglio();
  });
  const comandi = creaElemento("div", "bestiario-azioni");
  comandi.append(salva, annulla);

  form.append(g, car, testi, ...SEZIONI.map(([k, t, max, uno]) => editorVoci(m, k, t, max, uno)), campo("Note del DM (solo per te)", note, true), errore, comandi);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const problema = controlla(m);
    errore.textContent = problema || "";
    if (problema) return;
    salva.disabled = true;
    try {
      const pulita = pulisci(m);
      if (m.idOriginale) {
        await salvaCreatura(campagnaId, m.idOriginale, pulita);
        mostraToast(`«${pulita.nome}» salvata.`);
        modifica = null;
        sceltaId = m.idOriginale;
      } else {
        const id = await creaCreatura(campagnaId, pulita);
        mostraToast(`«${pulita.nome}» aggiunta al bestiario.`);
        modifica = null;
        sceltaId = id;
        // La nuova creatura deve comparire nell'elenco.
        filtri.fonte = "dm";
        filtri.testo.value = "";
        for (const f of [filtri.gs, filtri.tipo, filtri.taglia]) f.value = "";
      }
      disegnaLista();
      disegnaDettaglio();
    } catch (err) {
      console.error(err);
      errore.textContent = "Impossibile salvare la creatura.";
    } finally {
      salva.disabled = false;
    }
  });
  return form;
}

function controlla(m) {
  if (!m.nome?.trim()) return "Dai un nome alla creatura.";
  if (!(m.pf >= 1)) return "I PF devono essere almeno 1.";
  if (!leggiFormula(m.dadiPf) && !/^\d+$/.test(String(m.dadiPf))) return "Dadi vita non validi (es. 9d8+18).";
  if (!m.ca?.trim()) return "Scrivi la Classe Armatura.";
  for (const [k] of SEZIONI) for (const a of m[k] || []) if (!a.nome?.trim() || !a.testo?.trim()) return "Ogni tratto e ogni azione ha bisogno di nome e testo.";
  return null;
}

// Solo i campi del documento, senza quelli vuoti; lo stato nasce con i PF pieni.
function pulisci(m) {
  const { nuova, idOriginale, id, fonte, chiave, ...dati } = m;
  const out = {};
  for (const [k, v] of Object.entries(dati)) {
    if (v === undefined || (typeof v === "string" && !v.trim() && !["note"].includes(k))) continue;
    out[k] = typeof v === "string" ? v.trim() : v;
  }
  out.nome = out.nome.slice(0, 60);
  out.caValore = Number.isFinite(out.caValore) ? out.caValore : Number.parseInt(out.ca, 10) || 10;
  out.note = (m.note || "").trim();
  out.base = m.base || null;
  out.immagineId = m.immagineId || null;
  out.unico = Boolean(m.unico);
  for (const [k] of SEZIONI) out[k] = (m[k] || []).map((a) => ({ ...a, nome: a.nome.trim(), testo: a.testo.trim() }));
  if (out.unico) out.stato = { ...statoIniziale(out), ...(m.stato || {}), pfAttuali: Math.min(out.pf, m.stato?.pfAttuali ?? out.pf) };
  else delete out.stato;
  return out;
}

// ---------- avvio ----------
proteggiPaginaDM(async (user, profilo) => {
  montaMenuUtente({ contenitore: document.getElementById("slot-utente"), user, profilo });
  utente = { uid: user.uid, nome: profilo?.nome || "DM" };
  const campagna = await ottieniCampagnaCorrente(user.uid, profilo?.ruolo);
  veil.style.display = "none";
  contenuto.style.display = "block";
  if (!campagna) {
    document.getElementById("nessuna-campagna").hidden = false;
    return;
  }
  campagnaId = campagna.id;
  document.getElementById("bestiario").hidden = false;
  riempiFiltri();
  document.getElementById("btn-nuova").addEventListener("click", () => {
    sceltaId = null;
    apriModifica(creaturaVuota(), true);
  });
  const daIndirizzo = decodeURIComponent(location.hash.slice(1));
  if (daIndirizzo && creatura(daIndirizzo)) sceltaId = daIndirizzo;
  disegnaLista();
  disegnaDettaglio();
  let primo = true;
  ascoltaBestiario(campagnaId, (elenco) => {
    mie = elenco;
    if (primo && daIndirizzo && creatura(daIndirizzo)) sceltaId = daIndirizzo;
    primo = false;
    disegnaLista();
    // Non si ridisegna la scheda mentre il DM sta modificando o scrivendo nello stato.
    if (!modifica && !statoInAttesa && !dettaglio.contains(document.activeElement)) disegnaDettaglio();
  }, (errore) => {
    console.error(errore);
    mostraToast("Impossibile leggere il bestiario.", true);
  });
  ascoltaLibreriaDM(campagnaId, (elenco) => {
    const peso = (c) => (c.categoria === "png" ? 0 : c.categoria === "nemico" ? 1 : 2);
    immagini = [...elenco].sort((a, b) => peso(a) - peso(b) || a.titolo.localeCompare(b.titolo, "it"));
  }, (errore) => console.error(errore));
});
