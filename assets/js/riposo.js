// Riposo breve e lungo: calcoli (cosa cambia sulla scheda) e finestre condivise
// da scheda personaggio e pagina Sessione. Le scritture le fanno le pagine.
//
// Riposo lungo: PF al massimo, PF temporanei azzerati, recupero di metà dei
// dadi vita totali (almeno 1), slot incantesimo e incantesimi di razza
// ripristinati, tiri salvezza contro la morte azzerati, esaurimento −1.
// Riposo breve: si spendono dadi vita (dado + modificatore di Costituzione
// ciascuno) e si ricaricano gli slot del Patto Magico del Warlock.
// I privilegi di classe si ricaricano secondo privilegi.js.
import { CLASSI, TIPO_LANCIATORE, modificatore, formattaModificatore } from "./dati-srd.js";
import { creaElemento } from "./contenuti.js";
import { privilegiDelPersonaggio, usiDopoRiposoBreve } from "./privilegi.js";

export const dadoVitaClasse = (classe) => CLASSI[classe]?.dadoVita || 8;

export function dadiVitaDisponibili({ livello, dadiVitaSpesi }) {
  return Math.max(0, (livello || 1) - (dadiVitaSpesi || 0));
}

export const TIRI_MORTE_AZZERATI = () => ({ successi: [false, false, false], fallimenti: [false, false, false] });

// "personaggio" può essere la scheda o il riepilogo del party (servono solo
// hp, livello, dadiVitaSpesi ed esaurimento).
export function effettiRiposoLungo(personaggio) {
  const livello = personaggio.livello || 1;
  const recuperati = Math.max(1, Math.floor(livello / 2));
  const hp = personaggio.hp || { massimi: 0, attuali: 0, temporanei: 0 };
  return {
    hp: { massimi: hp.massimi || 0, attuali: hp.massimi || 0, temporanei: 0 },
    dadiVitaSpesi: Math.max(0, (personaggio.dadiVitaSpesi || 0) - recuperati),
    esaurimento: Math.max(0, (personaggio.esaurimento || 0) - 1),
    slotIncantesimoUsati: {},
    incantesimiRazzaUsati: [],
    tiriSalvezzaMorte: TIRI_MORTE_AZZERATI(),
    usiPrivilegi: {},
  };
}

// PF recuperati spendendo dadi vita: ogni dado + Costituzione (mai sotto 0).
// Con "somma" (dadi fisici) si conosce solo il totale dei dadi.
export function pfDaDadiVita({ tiri = null, somma = null, dadi, modCostituzione }) {
  if (tiri) return tiri.reduce((totale, tiro) => totale + Math.max(0, tiro + modCostituzione), 0);
  return Math.max(0, (somma || 0) + dadi * modCostituzione);
}

export function tiraDadiVita(quanti, dadoVita) {
  return Array.from({ length: quanti }, () => 1 + Math.floor(Math.random() * dadoVita));
}

// "scheda" è la scheda completa (serve la classe per il Patto Magico).
export function effettiRiposoBreve(scheda, { dadi, pf }) {
  const hp = scheda.hp || { massimi: 0, attuali: 0, temporanei: 0 };
  const campi = {
    hp: { ...hp, attuali: Math.min(hp.massimi || 0, (hp.attuali || 0) + pf) },
    dadiVitaSpesi: (scheda.dadiVitaSpesi || 0) + dadi,
  };
  if (TIPO_LANCIATORE[scheda.classe] === "patto") {
    const { patto, ...altri } = scheda.slotIncantesimoUsati || {};
    campi.slotIncantesimoUsati = altri;
  }
  const usi = usiDopoRiposoBreve(scheda);
  if (JSON.stringify(usi) !== JSON.stringify(scheda.usiPrivilegi || {})) campi.usiPrivilegi = usi;
  return campi;
}

// Nomi dei privilegi che un riposo breve ricarica (per la finestra).
export function privilegiRicaricatiDalBreve(personaggio) {
  return privilegiDelPersonaggio(personaggio).filter((p) => p.ricarica === "breve" && Number.isFinite(p.max)).map((p) => p.nome);
}

// Testo per gli appunti della sessione.
export function testoRiposoBreve(nomePersonaggio, { dadi, tiri, pf }, dadoVita) {
  if (!dadi) return `${nomePersonaggio}: riposo breve, nessun dado vita speso.`;
  const dettaglio = tiri ? ` (${tiri.join(", ")})` : "";
  return `${nomePersonaggio}: riposo breve, ${dadi}d${dadoVita}${dettaglio} → +${pf} PF.`;
}

// ---------- Finestre ----------

function creaFinestra(titolo, classe = "") {
  const sfondo = creaElemento("div", "modal-overlay");
  const scheda = creaElemento("div", `modal-card modal-riposo ${classe}`.trim());
  scheda.setAttribute("role", "dialog");
  scheda.setAttribute("aria-modal", "true");
  scheda.setAttribute("aria-label", titolo);
  scheda.append(creaElemento("h2", null, titolo));
  sfondo.append(scheda);
  document.body.append(sfondo);
  return { sfondo, scheda, chiudi: () => sfondo.remove() };
}

function bottone(testo, classe = "btn-tabella") {
  const b = creaElemento("button", classe, testo);
  b.type = "button";
  return b;
}

// Conferma di un riposo, con l'elenco degli effetti. Con "personaggi"
// ([{ id, nome, nota? }]) mostra le caselle per scegliere a chi applicarlo e
// restituisce gli id scelti; altrimenti true. null se si annulla.
export function confermaRiposo({ titolo, effetti, personaggi = null, etichettaConferma = "Conferma" }) {
  return new Promise((risolvi) => {
    const { sfondo, scheda, chiudi } = creaFinestra(titolo);
    const elenco = creaElemento("ul", "effetti-riposo");
    effetti.forEach((testo) => elenco.append(creaElemento("li", null, testo)));
    scheda.append(elenco);

    let caselle = [];
    if (personaggi) {
      const scelta = creaElemento("fieldset", "scelta-personaggi-riposo");
      scelta.append(creaElemento("legend", null, "Personaggi"));
      caselle = personaggi.map((p) => {
        const etichetta = creaElemento("label", "checkbox-scudo");
        const casella = document.createElement("input");
        casella.type = "checkbox";
        casella.value = p.id;
        casella.checked = true;
        etichetta.append(casella, ` ${p.nome}`);
        if (p.nota) etichetta.append(creaElemento("small", "party-sessione-sub", ` · ${p.nota}`));
        scelta.append(etichetta);
        return casella;
      });
      scheda.append(scelta);
    }

    const azioni = creaElemento("div", "azioni-selettore");
    const annulla = bottone("Annulla");
    const conferma = bottone(etichettaConferma, "btn-tabella btn-tabella-evidenza");
    azioni.append(annulla, conferma);
    scheda.append(azioni);

    const aggiornaConferma = () => {
      conferma.disabled = personaggi ? !caselle.some((c) => c.checked) : false;
    };
    caselle.forEach((c) => c.addEventListener("change", aggiornaConferma));
    aggiornaConferma();

    const fine = (valore) => {
      document.removeEventListener("keydown", tasto);
      chiudi();
      risolvi(valore);
    };
    const tasto = (evento) => {
      if (evento.key === "Escape") fine(null);
    };
    document.addEventListener("keydown", tasto);
    annulla.addEventListener("click", () => fine(null));
    sfondo.addEventListener("click", (evento) => {
      if (evento.target === sfondo) fine(null);
    });
    conferma.addEventListener("click", () => fine(personaggi ? caselle.filter((c) => c.checked).map((c) => c.value) : true));
    conferma.focus();
  });
}

const SVG_DADO = '<svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M50 4 L90 27 L90 73 L50 96 L10 73 L10 27 Z" stroke="#e8c65a" stroke-width="3" stroke-linejoin="round"/><path d="M50 4 L50 46 M10 27 L50 46 M90 27 L50 46 M50 46 L10 73 M50 46 L90 73 M50 46 L50 96" stroke="#e8c65a" stroke-width="1.3" opacity="0.5"/></svg>';

function creaVassoio(etichetta) {
  const vassoio = creaElemento("div", "vassoio-tiro");
  vassoio.hidden = true;
  const stage = creaElemento("div", "vassoio-stage");
  const dado = creaElemento("div", "vassoio-dado");
  dado.innerHTML = SVG_DADO;
  const esito = creaElemento("div", "esito-numero");
  esito.hidden = true;
  stage.append(creaElemento("div", "vassoio-ombra"), dado, esito);
  vassoio.append(creaElemento("div", "vassoio-etichetta", etichetta), stage);
  return { vassoio, esito };
}

// Riposo breve di un personaggio: quanti dadi vita spendere, poi tiro
// nell'app (una sola volta, come per i PF di livello) oppure somma dei dadi
// fisici. Restituisce { dadi, tiri, pf } (tiri = null se inseriti a mano),
// oppure null se si annulla.
export function apriRiposoBreve(scheda, { sottotitolo = null } = {}) {
  return new Promise((risolvi) => {
    const dadoVita = dadoVitaClasse(scheda.classe);
    const disponibili = dadiVitaDisponibili(scheda);
    const modCostituzione = modificatore(scheda.caratteristiche?.costituzione ?? 10);
    const hp = scheda.hp || { massimi: 0, attuali: 0 };
    const { sfondo, scheda: finestra, chiudi } = creaFinestra(`Riposo breve — ${scheda.nome || "personaggio"}`);
    if (sottotitolo) finestra.append(creaElemento("p", "card-tagline", sottotitolo));

    finestra.append(creaElemento("p", "riposo-situazione",
      `PF ${hp.attuali ?? 0} / ${hp.massimi ?? 0} · Dadi vita disponibili: ${disponibili} su ${scheda.livello || 1} (d${dadoVita}, Costituzione ${formattaModificatore(modCostituzione)} per dado)`));
    const ricaricati = [
      ...(TIPO_LANCIATORE[scheda.classe] === "patto" ? ["slot del Patto Magico"] : []),
      ...privilegiRicaricatiDalBreve(scheda),
    ];
    if (ricaricati.length) {
      finestra.append(creaElemento("p", "riposo-nota", `Si ricaricano: ${ricaricati.join(", ")}.`));
    }

    const campoDadi = creaElemento("label", "campo-riposo");
    const inputDadi = document.createElement("input");
    inputDadi.type = "number";
    inputDadi.min = "0";
    inputDadi.max = String(disponibili);
    inputDadi.value = String(Math.min(1, disponibili));
    inputDadi.className = "input-hp";
    inputDadi.disabled = disponibili === 0;
    campoDadi.append("Dadi vita da spendere", inputDadi);
    finestra.append(campoDadi);

    const scelta = creaElemento("div", "scelta-pf");
    const tiraApp = bottone("Tira nell'app", "btn-tabella btn-tabella-evidenza");
    const aMano = bottone("Ho tirato i dadi", "btn-tabella btn-tabella-evidenza secondaria");
    scelta.append(tiraApp, aMano);
    finestra.append(scelta);

    const campoSomma = creaElemento("label", "campo-riposo");
    const inputSomma = document.createElement("input");
    inputSomma.type = "number";
    inputSomma.className = "input-hp";
    campoSomma.append("Somma dei dadi (senza Costituzione)", inputSomma);
    campoSomma.hidden = true;
    finestra.append(campoSomma);

    const { vassoio, esito } = creaVassoio(`Dadi vita — d${dadoVita}`);
    finestra.append(vassoio);
    const risultato = creaElemento("div", "risultato-pf");
    risultato.setAttribute("role", "status");
    risultato.hidden = true;
    finestra.append(risultato);

    const azioni = creaElemento("div", "azioni-selettore");
    const annulla = bottone("Annulla");
    const conferma = bottone("Conferma", "btn-tabella btn-tabella-evidenza");
    azioni.append(annulla, conferma);
    finestra.append(azioni);

    let esitoCorrente = null;
    const dadiScelti = () => Math.max(0, Math.min(disponibili, Math.trunc(Number(inputDadi.value)) || 0));
    const aggiorna = () => {
      const dadi = dadiScelti();
      scelta.hidden = dadi === 0 || esitoCorrente?.tiri != null;
      if (dadi === 0) {
        campoSomma.hidden = true;
        esitoCorrente = { dadi: 0, tiri: null, pf: 0 };
      } else if (!campoSomma.hidden) {
        const somma = Math.trunc(Number(inputSomma.value));
        inputSomma.min = String(dadi);
        inputSomma.max = String(dadi * dadoVita);
        esitoCorrente = somma >= dadi && somma <= dadi * dadoVita
          ? { dadi, tiri: null, pf: pfDaDadiVita({ somma, dadi, modCostituzione }) }
          : null;
      } else if (!esitoCorrente?.tiri) {
        esitoCorrente = null;
      }
      conferma.disabled = !esitoCorrente;
      if (esitoCorrente && esitoCorrente.dadi > 0 && !esitoCorrente.tiri) {
        risultato.textContent = `+${esitoCorrente.pf} PF`;
        risultato.hidden = false;
      } else if (!esitoCorrente?.tiri) {
        risultato.hidden = true;
      }
      conferma.textContent = dadi === 0 ? "Riposa senza spendere dadi" : "Conferma";
    };

    inputDadi.addEventListener("input", aggiorna);
    inputSomma.addEventListener("input", aggiorna);
    aMano.addEventListener("click", () => {
      campoSomma.hidden = false;
      inputSomma.focus();
      aggiorna();
    });
    tiraApp.addEventListener("click", () => {
      const dadi = dadiScelti();
      if (!dadi) return;
      const tiri = tiraDadiVita(dadi, dadoVita);
      const pf = pfDaDadiVita({ tiri, dadi, modCostituzione });
      // Il tiro è definitivo: niente ritiri cambiando il numero di dadi.
      inputDadi.disabled = true;
      campoSomma.hidden = true;
      scelta.hidden = true;
      conferma.disabled = true;
      annulla.disabled = true;
      esito.hidden = true;
      risultato.hidden = true;
      vassoio.hidden = false;
      vassoio.classList.remove("in-lancio");
      void vassoio.offsetWidth;
      vassoio.classList.add("in-lancio");
      const durata = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 300 : 3400;
      setTimeout(() => {
        esito.textContent = String(tiri.reduce((a, b) => a + b, 0));
        esito.hidden = false;
        const bonus = modCostituzione ? ` ${modCostituzione > 0 ? "+" : "−"} ${Math.abs(modCostituzione)} per dado` : "";
        risultato.textContent = `Tiri: ${tiri.join(", ")}${bonus} → +${pf} PF`;
        risultato.hidden = false;
        esitoCorrente = { dadi, tiri, pf };
        conferma.disabled = false;
        // Il tiro è fatto: resta solo da confermarlo.
        annulla.hidden = true;
      }, durata);
    });

    const fine = (valore) => {
      document.removeEventListener("keydown", tasto);
      chiudi();
      risolvi(valore);
    };
    // Dopo un tiro nell'app non si annulla (il risultato resta quello).
    const tasto = (evento) => {
      if (evento.key === "Escape" && !esitoCorrente?.tiri && !annulla.disabled) fine(null);
    };
    document.addEventListener("keydown", tasto);
    annulla.addEventListener("click", () => fine(null));
    sfondo.addEventListener("click", (evento) => {
      if (evento.target === sfondo && !esitoCorrente?.tiri && !annulla.disabled) fine(null);
    });
    conferma.addEventListener("click", () => {
      if (esitoCorrente) fine(esitoCorrente);
    });
    aggiorna();
  });
}
