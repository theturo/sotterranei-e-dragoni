// Script della pagina scheda-personaggio.html (spostato fuori dall'HTML per la Content Security Policy:
// la policy consente solo script serviti dal sito stesso, niente script inline).
import {
  proteggiPagina,
  ottieniCampagnaCorrente,
  ottieniScheda,
  ottieniSchedaAttiva,
  aggiornaHp,
  aggiornaTiriSalvezzaMorte,
  aggiornaInventario,
  aggiornaScheda,
  applicaPassaggioLivello,
  impostaRitratto,
  aggiornaCondizioniScheda,
  ascoltaScheda,
  applicaRiposoScheda,
  annotaRiposo,
  ascoltaRiposo,
  segnaRiposoConcluso,
  aggiornaUsiPrivilegi,
  annotaTiro,
  iniziativaNelTracker,
} from "../auth.js";
import { apriTiro, testoTiro, leggiFormula } from "../dadi.js";
import { privilegiDelPersonaggio, NOMI_RICARICA } from "../privilegi.js";
import {
  ridimensionaImmagine,
  caricaImmagine,
  eliminaImmagine,
  mostraImmagine,
  percorsiRitratto,
  LATO_RITRATTO,
  LATO_ICONA,
  ErroreImmagine,
} from "../immagini.js";
import { montaMenuUtente } from "../menu-utente.js";
import { creaChipCondizioni, creaEditorCondizioni } from "../condizioni.js";
import {
  apriRiposoBreve,
  confermaRiposo,
  dadiVitaDisponibili,
  dadoVitaClasse,
  effettiRiposoBreve,
  effettiRiposoLungo,
  testoRiposoBreve,
} from "../riposo.js";
import { esc } from "../utils.js";
import {
  CLASSI,
  ICONA_CLASSE_FALLBACK,
  CARATTERISTICHE,
  ABILITA,
  ABBREVIAZIONI_CARATTERISTICHE,
  ALLINEAMENTI,
  nomeAllineamento,
  LIVELLI_ASI,
  puntiVitaMedi,
  tiraPuntiVitaLivello,
  TIPO_LANCIATORE,
  TRATTI_PER_LIVELLO,
  slotIncantesimoAlLivello,
  CLASSI_CONOSCENZA_FISSA,
  CLASSI_PREPARAZIONE,
  CARATTERISTICA_INCANTESIMI,
  trucchettiConosciutiAlLivello,
  trucchettoBonusRazza,
  incantesimiConosciutiAlLivello,
  incantesimiPreparatiAlLivello,
  incantesimiRazzialiAlLivello,
  modificatore,
  formattaModificatore,
  nomeRazzaCompleto,
  velocitaRazza,
} from "../dati-srd.js";
import { ARMI, ARMATURE, cercaEquipaggiamento, ETICHETTE_CATEGORIA } from "../equipaggiamento-srd.js";
import { cercaIncantesimi, ottieniIncantesimo, TIRI_INCANTESIMI } from "../incantesimi-srd.js";

const veil = document.getElementById("veil");
const contenuto = document.getElementById("contenuto");

let uidCorrente = null;
let scheda = null;
let soloLettura = false;
let profiloCorrente = null;

function formattaVelocita(velocita) {
  return `${String(velocita).replace(".", ",")} m`;
}

function bonusCompetenza(livello) {
  return 2 + Math.floor(((livello || 1) - 1) / 4);
}

function renderIntestazione() {
  const classe = CLASSI[scheda.classe];
  document.getElementById("scheda-nome-valore").textContent = scheda.nome || "—";
  document.getElementById("icona-classe").innerHTML = classe?.iconaSvg || ICONA_CLASSE_FALLBACK;
  document.getElementById("scheda-classe-livello").textContent = `${classe?.nome || "—"} ${scheda.livello || 1}`;
  document.getElementById("scheda-razza").textContent = nomeRazzaCompleto(scheda.razza, scheda.sottorazza);
}

// ---------- Ritratto ----------
// Il proprietario carica un'immagine: il browser ne ricava una versione per la
// scheda (512 px) e un'icona per il party (96 px); la scheda salva solo il
// numero di versione (vedi immagini.js).
function renderRitratto() {
  const img = document.getElementById("ritratto-img");
  const vuoto = document.getElementById("ritratto-vuoto");
  document.getElementById("ritratto-azioni").hidden = soloLettura;
  document.getElementById("btn-rimuovi-ritratto").hidden = !scheda.ritratto;
  document.getElementById("ritratto-etichetta-carica").textContent = scheda.ritratto ? "Cambia" : "Carica ritratto";
  if (!scheda.ritratto) {
    img.hidden = true;
    img.removeAttribute("src");
    vuoto.hidden = false;
    return;
  }
  vuoto.hidden = true;
  mostraImmagine(img, percorsiRitratto(scheda.proprietarioUid, scheda.id, scheda.ritratto).grande).then(() => {
    if (img.hidden) vuoto.hidden = false;
  });
}

function mostraAvviso(testo) {
  const toast = document.getElementById("toast");
  toast.textContent = testo;
  toast.className = "toast visibile toast-errore";
  setTimeout(() => (toast.className = "toast"), 3600);
}

document.getElementById("ritratto-file").addEventListener("change", async (evento) => {
  const file = evento.target.files?.[0];
  evento.target.value = "";
  if (!file || soloLettura) return;
  const azioni = document.getElementById("ritratto-azioni");
  azioni.classList.add("in-caricamento");
  const precedente = scheda.ritratto;
  try {
    const [grande, icona] = await Promise.all([
      ridimensionaImmagine(file, LATO_RITRATTO),
      ridimensionaImmagine(file, LATO_ICONA),
    ]);
    const versione = Date.now();
    const percorsi = percorsiRitratto(scheda.proprietarioUid, scheda.id, versione);
    await caricaImmagine(percorsi.grande, grande.blob);
    await caricaImmagine(percorsi.icona, icona.blob);
    await impostaRitratto(scheda, versione);
    scheda.ritratto = versione;
    renderRitratto();
    if (precedente) {
      const vecchi = percorsiRitratto(scheda.proprietarioUid, scheda.id, precedente);
      Promise.all([eliminaImmagine(vecchi.grande), eliminaImmagine(vecchi.icona)]).catch((e) => console.error(e));
    }
  } catch (errore) {
    console.error(errore);
    mostraAvviso(errore instanceof ErroreImmagine ? errore.message : "Impossibile caricare il ritratto. Riprova.");
  } finally {
    azioni.classList.remove("in-caricamento");
  }
});

document.getElementById("btn-rimuovi-ritratto").addEventListener("click", async () => {
  if (soloLettura || !scheda.ritratto) return;
  if (!confirm("Rimuovere il ritratto di questo personaggio?")) return;
  const vecchi = percorsiRitratto(scheda.proprietarioUid, scheda.id, scheda.ritratto);
  try {
    await impostaRitratto(scheda, null);
    scheda.ritratto = null;
    renderRitratto();
    await Promise.all([eliminaImmagine(vecchi.grande), eliminaImmagine(vecchi.icona)]);
  } catch (errore) {
    console.error(errore);
    mostraAvviso("Impossibile rimuovere il ritratto. Riprova.");
  }
});

function renderBackground() {
  const campo = document.getElementById("input-background");
  campo.value = scheda.background || "";
  campo.title = scheda.background || "";
  campo.disabled = soloLettura;
}

function renderAllineamento() {
  const bottone = document.getElementById("btn-allineamento");
  bottone.textContent = scheda.allineamento ? nomeAllineamento(scheda.allineamento) : "—";
  bottone.disabled = soloLettura;
}

// ---------- Passaggio di livello ----------
function creditiLivelloDisponibili() {
  return !soloLettura && (profiloCorrente?.livelliDaSpendere || 0) > 0;
}

function renderPulsanteLivello() {
  document.getElementById("btn-livello-su").hidden = !creditiLivelloDisponibili();
}

const statoLivello = { guadagnoPF: null, metodoPF: null, modoAsi: "due", asi: {}, tratti: [], incantesimiScelti: [] };

function mostraPassoLivello(id) {
  document.querySelectorAll(".wizard-livello-passo").forEach((el) => (el.hidden = el.id !== id));
}

function apriModalLivello() {
  if (!creditiLivelloDisponibili()) return;
  statoLivello.guadagnoPF = null;
  statoLivello.metodoPF = null;
  statoLivello.modoAsi = "due";
  statoLivello.asi = {};
  statoLivello.tratti = [];
  statoLivello.incantesimiScelti = [];
  document.getElementById("risultato-pf").hidden = true;
  document.getElementById("btn-avanti-pf").disabled = true;
  document.getElementById("vassoio-tiro").hidden = true;
  document.querySelectorAll(".scelta-pf [data-metodo]").forEach((b) => (b.disabled = false));
  const numero = document.getElementById("livello-rivelazione-numero");
  numero.textContent = String((scheda.livello || 1) + 1);
  numero.dataset.numero = numero.textContent;
  // Filigrana: l'icona della classe, grande e tenue dietro al numero (SVG fisso).
  document.getElementById("filigrana-classe").innerHTML = CLASSI[scheda.classe]?.iconaSvg || ICONA_CLASSE_FALLBACK;
  document.getElementById("livello-rivelazione").hidden = false;
  document.getElementById("wizard-livello").hidden = true;
  document.getElementById("modal-livello").style.display = "flex";
}

document.getElementById("btn-livello-su").addEventListener("click", apriModalLivello);

document.getElementById("livello-rivelazione").addEventListener("click", () => {
  document.getElementById("livello-rivelazione").hidden = true;
  document.getElementById("wizard-livello").hidden = false;
  mostraPassoLivello("passo-pf");
});

document.querySelectorAll(".scelta-pf [data-metodo]").forEach((bottone) => {
  bottone.addEventListener("click", () => {
    const modCostituzione = modificatore(scheda.caratteristiche?.costituzione ?? 10);
    const risultato = document.getElementById("risultato-pf");
    const btnAvanti = document.getElementById("btn-avanti-pf");

    if (bottone.dataset.metodo === "media") {
      statoLivello.metodoPF = "media";
      statoLivello.guadagnoPF = puntiVitaMedi(scheda.classe, modCostituzione);
      risultato.textContent = `+${statoLivello.guadagnoPF} PF`;
      risultato.hidden = false;
      btnAvanti.disabled = false;
    } else {
      // Il dado si tira una sola volta: il risultato resta fisso (niente
      // ritiri finché non esce un numero alto).
      statoLivello.metodoPF = "tiro";
      document.querySelectorAll(".scelta-pf [data-metodo]").forEach((b) => (b.disabled = true));
      risultato.hidden = true;
      btnAvanti.disabled = true;
      const dadoVita = CLASSI[scheda.classe]?.dadoVita || 8;
      const { tiro, totale } = tiraPuntiVitaLivello(scheda.classe, modCostituzione);
      statoLivello.guadagnoPF = totale;

      const vassoio = document.getElementById("vassoio-tiro");
      const esito = document.getElementById("esito-numero");
      document.getElementById("vassoio-etichetta").textContent = `Dado vita — d${dadoVita}`;
      esito.hidden = true;
      vassoio.hidden = false;
      // Riavvia l'animazione del lancio.
      vassoio.classList.remove("in-lancio");
      void vassoio.offsetWidth;
      vassoio.classList.add("in-lancio");
      const durata = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 300 : 3400;
      setTimeout(() => {
        esito.textContent = String(tiro);
        esito.hidden = false;
        const bonus = totale - tiro;
        risultato.textContent = `Tiro: ${tiro}${bonus ? ` ${bonus > 0 ? "+" : "−"} ${Math.abs(bonus)} (Costituzione)` : ""} → +${totale} PF`;
        risultato.hidden = false;
        btnAvanti.disabled = false;
      }, durata);
    }
  });
});

function opzioniCaratteristica(select, escludi, limiteMassimo) {
  const attuale = select.dataset.valoreAttuale || "";
  select.innerHTML = '<option value="" disabled>— Scegli —</option>';
  CARATTERISTICHE.forEach(({ chiave, nome }) => {
    const punteggio = scheda.caratteristiche?.[chiave] ?? 10;
    if (punteggio > limiteMassimo && chiave !== attuale) return;
    if (escludi.includes(chiave) && chiave !== attuale) return;
    const opzione = document.createElement("option");
    opzione.value = chiave;
    opzione.textContent = `${nome} (${punteggio})`;
    if (chiave === attuale) opzione.selected = true;
    select.appendChild(opzione);
  });
}

function renderCampiAsi() {
  const contenitore = document.getElementById("campi-asi");
  const modo = statoLivello.modoAsi;
  contenitore.innerHTML = "";

  if (modo === "una") {
    const select = document.createElement("select");
    select.className = "select-asi";
    select.dataset.indice = "0";
    contenitore.appendChild(wrapCampo("+2 a", select));
    opzioniCaratteristica(select, [], 18);
  } else {
    const select1 = document.createElement("select");
    select1.className = "select-asi";
    select1.dataset.indice = "0";
    const select2 = document.createElement("select");
    select2.className = "select-asi";
    select2.dataset.indice = "1";
    contenitore.appendChild(wrapCampo("+1 a", select1));
    contenitore.appendChild(wrapCampo("+1 a", select2));
    opzioniCaratteristica(select1, [select2.value], 19);
    opzioniCaratteristica(select2, [select1.value], 19);
  }
}

function wrapCampo(etichetta, select) {
  const div = document.createElement("div");
  div.className = "field";
  div.innerHTML = `<label>${etichetta}</label>`;
  div.appendChild(select);
  return div;
}

document.querySelectorAll('input[name="modo-asi"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    statoLivello.modoAsi = radio.value;
    renderCampiAsi();
  });
});

document.getElementById("campi-asi").addEventListener("change", (evento) => {
  const select = evento.target.closest(".select-asi");
  if (!select) return;
  select.dataset.valoreAttuale = select.value;
  const selects = document.querySelectorAll(".select-asi");
  if (selects.length === 2) {
    opzioniCaratteristica(selects[0], [selects[1].value], 19);
    opzioniCaratteristica(selects[1], [selects[0].value], 19);
    selects.forEach((s) => (s.value = s.dataset.valoreAttuale || s.value));
  }
});

document.getElementById("btn-avanti-pf").addEventListener("click", () => {
  const nuovoLivello = (scheda.livello || 1) + 1;
  if (LIVELLI_ASI.includes(nuovoLivello)) {
    renderCampiAsi();
    mostraPassoLivello("passo-asi");
  } else {
    procediDopoCaratteristiche();
  }
});

document.getElementById("btn-avanti-asi").addEventListener("click", () => {
  const selects = Array.from(document.querySelectorAll(".select-asi"));
  if (selects.some((s) => !s.value)) {
    mostraToastLivello("Scegli tutte le caratteristiche richieste.");
    return;
  }
  statoLivello.asi = {};
  const bonus = statoLivello.modoAsi === "una" ? 2 : 1;
  selects.forEach((s) => {
    statoLivello.asi[s.value] = (statoLivello.asi[s.value] || 0) + bonus;
  });
  procediDopoCaratteristiche();
});

// ---------- Fase 2: tratti di classe e nuovi incantesimi ----------
function slotIncantesimoCambiato(classe, livelloPrec, livelloNuovo) {
  const tipo = TIPO_LANCIATORE[classe];
  if (!tipo) return false;
  const prima = slotIncantesimoAlLivello(classe, livelloPrec);
  const dopo = slotIncantesimoAlLivello(classe, livelloNuovo);
  if (tipo === "patto") return prima.slot !== dopo.slot || prima.livelloSlot !== dopo.livelloSlot;
  return JSON.stringify(prima) !== JSON.stringify(dopo);
}

function procediDopoCaratteristiche() {
  const nuovoLivello = (scheda.livello || 1) + 1;
  statoLivello.tratti = TRATTI_PER_LIVELLO[scheda.classe]?.[nuovoLivello] || [];

  if (statoLivello.tratti.length > 0) {
    document.getElementById("lista-tratti-livello").innerHTML = statoLivello.tratti.map((t) => `<li><b>${esc(t)}</b></li>`).join("");
    mostraPassoLivello("passo-tratti-livello");
  } else {
    procediDopoTratti();
  }
}

document.getElementById("btn-avanti-tratti").addEventListener("click", procediDopoTratti);

function formattaSlotIncantesimo(classe, livello) {
  const tipo = TIPO_LANCIATORE[classe];
  const slot = slotIncantesimoAlLivello(classe, livello);
  if (!tipo || !slot) return "nessuno slot ancora";
  if (tipo === "patto") {
    return slot.slot > 0 ? `Patto Magico: ${slot.slot} slot di ${slot.livelloSlot}° livello` : "nessuno slot ancora";
  }
  const parti = slot.map((n, i) => (n > 0 ? `${n}×${i + 1}°` : null)).filter(Boolean);
  return parti.length ? parti.join(", ") : "nessuno slot ancora";
}

// Lo step "nuovi incantesimi" del level-up ha senso solo per chi "impara"
// (conoscenza fissa) o "annota nel libro" (Mago) — le classi a preparazione
// (Chierico/Druido/Paladino) conoscono già tutta la lista della classe e
// preparano dalla scheda in qualsiasi momento, non al passaggio di livello.
function procediDopoTratti() {
  const nuovoLivello = (scheda.livello || 1) + 1;
  const modo = modoIncantatore(scheda.classe);
  const rilevante = (modo === "fisso" || modo === "libro") && slotIncantesimoCambiato(scheda.classe, scheda.livello || 1, nuovoLivello);
  if (rilevante) {
    document.getElementById("incantesimi-livello-nota").textContent = `Al livello ${nuovoLivello} ottieni nuovi slot incantesimo: ${formattaSlotIncantesimo(scheda.classe, nuovoLivello)}.`;
    document.getElementById("ricerca-incantesimi-livello").value = "";
    document.getElementById("risultati-incantesimi-livello").hidden = true;
    renderIncantesimiSceltiLivello();
    mostraPassoLivello("passo-incantesimi-livello");
  } else {
    renderRiepilogoLivello();
    mostraPassoLivello("passo-riepilogo-livello");
  }
}

function renderIncantesimiSceltiLivello() {
  const lista = document.getElementById("lista-incantesimi-livello-scelti");
  if (statoLivello.incantesimiScelti.length === 0) {
    lista.innerHTML = '<li class="scheda-testo-libero">Nessun incantesimo scelto finora.</li>';
    return;
  }
  lista.innerHTML = statoLivello.incantesimiScelti
    .map((chiave) => {
      const dati = ottieniIncantesimo(chiave);
      return `<li><b>${esc(dati?.nome || chiave)}</b> <button class="btn-rimuovi-talento" data-chiave="${esc(chiave)}" type="button" aria-label="Rimuovi">×</button></li>`;
    })
    .join("");
}

document.getElementById("ricerca-incantesimi-livello").addEventListener("input", (evento) => {
  const contenitore = document.getElementById("risultati-incantesimi-livello");
  const testo = evento.target.value;
  if (!testo.trim()) {
    contenitore.hidden = true;
    contenitore.innerHTML = "";
    return;
  }
  const risultati = cercaIncantesimi(testo, { classe: scheda.classe }).slice(0, 15);
  if (risultati.length === 0) {
    contenitore.hidden = true;
    contenitore.innerHTML = "";
    return;
  }
  contenitore.hidden = false;
  contenitore.innerHTML = risultati
    .map((voce) => {
      const etichettaLivello = voce.livello === 0 ? "Trucchetto" : `Livello ${voce.livello}`;
      return `<div class="risultato-riga">
        <span>${esc(voce.nome)} <small>(${esc(etichettaLivello)} · ${esc(voce.scuola)})</small></span>
        <button class="btn-tabella azione-aggiungi" data-scegli-incantesimo="${esc(voce.chiave)}" type="button">Aggiungi</button>
      </div>`;
    })
    .join("");
});

document.getElementById("risultati-incantesimi-livello").addEventListener("click", (evento) => {
  const bottone = evento.target.closest("[data-scegli-incantesimo]");
  if (!bottone) return;
  const chiave = bottone.dataset.scegliIncantesimo;

  if (CLASSI_CONOSCENZA_FISSA.includes(scheda.classe)) {
    const nuovoLivello = (scheda.livello || 1) + 1;
    const maxConosciuti = incantesimiConosciutiAlLivello(scheda.classe, nuovoLivello);
    const attualiNonTrucchetto = (scheda.incantesimiConosciuti || []).filter((c) => ottieniIncantesimo(c)?.livello > 0).length;
    if (attualiNonTrucchetto + statoLivello.incantesimiScelti.length >= maxConosciuti) {
      mostraToastLivello(`Hai già raggiunto il limite di incantesimi conosciuti per il livello ${nuovoLivello}.`);
      return;
    }
  }

  const giaConosciuto = (scheda.incantesimiConosciuti || []).includes(chiave) || statoLivello.incantesimiScelti.includes(chiave);
  if (!giaConosciuto) statoLivello.incantesimiScelti.push(chiave);
  document.getElementById("ricerca-incantesimi-livello").value = "";
  document.getElementById("risultati-incantesimi-livello").hidden = true;
  renderIncantesimiSceltiLivello();
});

document.getElementById("lista-incantesimi-livello-scelti").addEventListener("click", (evento) => {
  const bottone = evento.target.closest("[data-chiave]");
  if (!bottone) return;
  statoLivello.incantesimiScelti = statoLivello.incantesimiScelti.filter((c) => c !== bottone.dataset.chiave);
  renderIncantesimiSceltiLivello();
});

document.getElementById("btn-avanti-incantesimi").addEventListener("click", () => {
  renderRiepilogoLivello();
  mostraPassoLivello("passo-riepilogo-livello");
});

let timerToastLivello = null;
function mostraToastLivello(testo) {
  const toast = document.getElementById("toast");
  toast.textContent = testo;
  toast.className = "toast visibile toast-errore";
  clearTimeout(timerToastLivello);
  timerToastLivello = setTimeout(() => {
    toast.className = "toast";
  }, 3200);
}

function renderRiepilogoLivello() {
  const nuovoLivello = (scheda.livello || 1) + 1;
  const pfAttuali = scheda.hp.massimi;
  const righeAsi = Object.entries(statoLivello.asi)
    .map(([chiave, bonus]) => {
      const nome = CARATTERISTICHE.find((c) => c.chiave === chiave)?.nome || chiave;
      return `<li>${esc(nome)}: ${esc(scheda.caratteristiche[chiave])} → <b>${esc(scheda.caratteristiche[chiave] + bonus)}</b></li>`;
    })
    .join("");
  const righeTratti = statoLivello.tratti.map((t) => `<li>${esc(t)}</li>`).join("");
  const righeIncantesimi = statoLivello.incantesimiScelti
    .map((chiave) => `<li>${esc(ottieniIncantesimo(chiave)?.nome || chiave)}</li>`)
    .join("");
  document.getElementById("riepilogo-livello").innerHTML = `
    <p><label>Nuovo livello</label> <b>${esc(nuovoLivello)}</b></p>
    <p><label>Punti Ferita massimi</label> <b>${esc(pfAttuali)} → ${esc(pfAttuali + statoLivello.guadagnoPF)}</b></p>
    ${righeAsi ? `<p><label>Caratteristiche</label></p><ul class="lista-competenze">${righeAsi}</ul>` : ""}
    ${righeTratti ? `<p><label>Nuovi tratti</label></p><ul class="lista-competenze">${righeTratti}</ul>` : ""}
    ${righeIncantesimi ? `<p><label>Nuovi incantesimi</label></p><ul class="lista-competenze">${righeIncantesimi}</ul>` : ""}
  `;
}

document.getElementById("btn-conferma-livello").addEventListener("click", async () => {
  const bottone = document.getElementById("btn-conferma-livello");
  bottone.disabled = true;
  try {
    const nuovoLivello = (scheda.livello || 1) + 1;
    scheda.hp.massimi += statoLivello.guadagnoPF;
    scheda.hp.attuali += statoLivello.guadagnoPF;
    Object.entries(statoLivello.asi).forEach(([chiave, bonus]) => {
      scheda.caratteristiche[chiave] = (scheda.caratteristiche[chiave] || 10) + bonus;
    });
    scheda.talenti = [...(scheda.talenti || []), ...statoLivello.tratti];
    scheda.incantesimiConosciuti = Array.from(
      new Set([...(scheda.incantesimiConosciuti || []), ...statoLivello.incantesimiScelti])
    );

    // Livello e consumo del credito vengono salvati insieme, in un'unica
    // scrittura atomica: le regole di sicurezza rifiutano l'uno senza l'altro.
    await applicaPassaggioLivello(scheda, {
      hp: scheda.hp,
      caratteristiche: scheda.caratteristiche,
      talenti: scheda.talenti,
      incantesimiConosciuti: scheda.incantesimiConosciuti,
    });
    scheda.livello = nuovoLivello;
    profiloCorrente.livelliDaSpendere = (profiloCorrente.livelliDaSpendere || 1) - 1;

    document.getElementById("modal-livello").style.display = "none";
    renderIntestazione();
    renderCaratteristiche();
    renderSalvezze();
    renderVelocitaEDadi();
    renderAbilita();
    renderHp();
    renderTalenti();
    renderIncantesimi();
    renderIncantesimiRazza();
    renderPrivilegi();
    renderAttacchi();
    renderPulsanteLivello();
  } catch (errore) {
    console.error(errore);
    mostraToastLivello("Impossibile salvare il livello. Riprova.");
  } finally {
    bottone.disabled = false;
  }
});

// ---------- Ruota a spicchi per la scelta dell'allineamento ----------
function posizioneRuota(angoloGradi, raggio) {
  const rad = (angoloGradi * Math.PI) / 180;
  return { x: 50 + raggio * Math.sin(rad), y: 50 - raggio * Math.cos(rad) };
}

function coloreAllineamento(angoloGradi) {
  const rad = (angoloGradi * Math.PI) / 180;
  const t = (1 - Math.cos(rad)) / 2;
  const oro = [232, 198, 90], bordeaux = [165, 41, 58];
  const canale = (i) => Math.round(oro[i] + (bordeaux[i] - oro[i]) * t);
  return `rgb(${canale(0)}, ${canale(1)}, ${canale(2)})`;
}

const RAGGIO_INTERNO_RUOTA = 17;
const RAGGIO_ZONA_RUOTA = 34;

function clipSpicchio(angoloGradi) {
  const segmenti = 10;
  const puntiArco = [];
  for (let i = 0; i <= segmenti; i++) {
    const a = angoloGradi - 22.5 + (45 * i) / segmenti;
    const p = posizioneRuota(a, RAGGIO_INTERNO_RUOTA);
    puntiArco.push(`${p.x}% ${p.y}%`);
  }
  const o1 = posizioneRuota(angoloGradi + 22.5, 100);
  const o2 = posizioneRuota(angoloGradi - 22.5, 100);
  return `polygon(${puntiArco.join(", ")}, ${o1.x}% ${o1.y}%, ${o2.x}% ${o2.y}%)`;
}

function anteprimaAllineamento(voce) {
  document.getElementById("allineamento-anteprima-nome").textContent = voce.nome;
  document.getElementById("allineamento-anteprima-testo").textContent = voce.blurb;
}

function selezionaAllineamento(voce) {
  scheda.allineamento = voce.chiave;
  renderAllineamento();
  document.getElementById("modal-allineamento").style.display = "none";
  aggiornaScheda(scheda.id, { allineamento: voce.chiave }).catch((errore) => console.error(errore));
}

let ruotaAllineamentoCostruita = false;
function costruisciRuotaAllineamento() {
  if (ruotaAllineamentoCostruita) return;
  ruotaAllineamentoCostruita = true;

  const host = document.getElementById("ruota-allineamento");
  const anello = document.createElement("div");
  anello.className = "ruota-allineamento-anello";

  const centro = ALLINEAMENTI.find((a) => a.angolo === null);

  ALLINEAMENTI.filter((a) => a.angolo !== null).forEach((voce) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "spicchio-allineamento";
    btn.style.clipPath = clipSpicchio(voce.angolo);
    btn.style.background = coloreAllineamento(voce.angolo);
    btn.setAttribute("aria-label", voce.nome);

    const zona = posizioneRuota(voce.angolo, RAGGIO_ZONA_RUOTA);
    const etichetta = document.createElement("span");
    etichetta.className = "spicchio-allineamento-etichetta";
    etichetta.textContent = voce.chiave;
    etichetta.style.left = zona.x + "%";
    etichetta.style.top = zona.y + "%";
    btn.appendChild(etichetta);

    btn.addEventListener("mouseenter", () => anteprimaAllineamento(voce));
    btn.addEventListener("focus", () => anteprimaAllineamento(voce));
    btn.addEventListener("click", () => selezionaAllineamento(voce));
    anello.appendChild(btn);
  });

  const decorazione = document.createElement("div");
  decorazione.className = "ruota-decorazione";
  anello.appendChild(decorazione);

  host.appendChild(anello);
  const bordo = document.createElement("div");
  bordo.className = "ruota-allineamento-bordo";
  host.appendChild(bordo);

  const hub = document.createElement("button");
  hub.type = "button";
  hub.className = "hub-allineamento";
  hub.style.background = "var(--color-gold)";
  hub.textContent = centro.chiave;
  hub.setAttribute("aria-label", centro.nome);
  hub.addEventListener("mouseenter", () => anteprimaAllineamento(centro));
  hub.addEventListener("focus", () => anteprimaAllineamento(centro));
  hub.addEventListener("click", () => selezionaAllineamento(centro));
  host.appendChild(hub);

  anteprimaAllineamento(centro);
}

document.getElementById("btn-allineamento").addEventListener("click", () => {
  if (soloLettura) return;
  costruisciRuotaAllineamento();
  const attuale = ALLINEAMENTI.find((a) => a.chiave === scheda.allineamento);
  anteprimaAllineamento(attuale || ALLINEAMENTI.find((a) => a.angolo === null));
  document.getElementById("modal-allineamento").style.display = "flex";
});

document.getElementById("btn-chiudi-allineamento").addEventListener("click", () => {
  document.getElementById("modal-allineamento").style.display = "none";
});

document.getElementById("modal-allineamento").addEventListener("click", (evento) => {
  if (evento.target.id === "modal-allineamento") {
    evento.currentTarget.style.display = "none";
  }
});

document.getElementById("modal-livello").addEventListener("click", (evento) => {
  if (evento.target.id === "modal-livello") {
    evento.currentTarget.style.display = "none";
  }
});

document.getElementById("input-background").addEventListener("change", async (evento) => {
  if (soloLettura) return;
  scheda.background = evento.target.value.trim();
  renderBackground();
  try {
    await aggiornaScheda(scheda.id, { background: scheda.background });
  } catch (errore) {
    console.error(errore);
  }
});

function renderCaratteristiche() {
  CARATTERISTICHE.forEach(({ chiave }) => {
    const punteggio = scheda.caratteristiche?.[chiave] ?? 10;
    const mod = modificatore(punteggio);
    const box = document.querySelector(`.caratteristica[data-chiave="${chiave}"]`);
    box.querySelector(".caratteristica-punteggio").textContent = punteggio;
    box.querySelector(".caratteristica-mod").textContent = formattaModificatore(mod);
  });

  const modDestrezza = modificatore(scheda.caratteristiche?.destrezza ?? 10);
  document.getElementById("valore-iniziativa").textContent = formattaModificatore(modDestrezza);
}

// L'armatura/lo scudo indossati (scelti tra quelli posseduti in inventario)
// determinano la Classe Armatura effettiva.
function possiedeScudo() {
  return (scheda.inventario || []).some((v) => v.categoria === "armatura" && ARMATURE[v.chiave]?.sottocategoria === "scudo");
}

function oggettiArmaturaIndossabile() {
  return (scheda.inventario || []).filter((v) => v.categoria === "armatura" && ARMATURE[v.chiave]?.sottocategoria !== "scudo");
}

function renderCA() {
  const modDes = modificatore(scheda.caratteristiche?.destrezza ?? 10);
  const armatura = scheda.armaturaIndossata ? ARMATURE[scheda.armaturaIndossata] : null;
  let ca;
  if (armatura) {
    const desEffettivo = armatura.usaDestrezza ? (armatura.desMax != null ? Math.min(modDes, armatura.desMax) : modDes) : 0;
    ca = armatura.caBase + desEffettivo;
  } else {
    ca = 10 + modDes;
  }
  if (scheda.scudoIndossato && possiedeScudo()) ca += ARMATURE.scudo.bonusScudo;
  document.getElementById("valore-ca").textContent = String(ca);
}

function renderEquipaggiamentoIndossato() {
  const select = document.getElementById("select-armatura-indossata");
  const checkboxScudo = document.getElementById("checkbox-scudo");
  const armorItems = oggettiArmaturaIndossabile();
  const haScudo = possiedeScudo();

  select.innerHTML =
    '<option value="">Nessuna (senza armatura)</option>' +
    armorItems.map((v) => `<option value="${esc(v.chiave)}">${esc(v.nome)}</option>`).join("");
  select.value = scheda.armaturaIndossata || "";
  select.disabled = soloLettura;

  checkboxScudo.checked = Boolean(scheda.scudoIndossato) && haScudo;
  checkboxScudo.disabled = soloLettura || !haScudo;

  document.getElementById("equip-indossato-wrap").hidden = armorItems.length === 0 && !haScudo;
  renderCA();
}

function renderAbilita() {
  const bonus = bonusCompetenza(scheda.livello);
  const competenti = scheda.abilitaCompetenti || [];
  document.getElementById("lista-abilita").innerHTML = ABILITA.map(({ chiave, nome, caratteristica }) => {
    const punteggio = scheda.caratteristiche?.[caratteristica] ?? 10;
    const competente = competenti.includes(chiave);
    const mod = modificatore(punteggio) + (competente ? bonus : 0);
    const abbr = ABBREVIAZIONI_CARATTERISTICHE[caratteristica];
    return `<li data-chiave="${chiave}" class="${competente ? "competente" : ""}">
      <span class="pallino${soloLettura ? "" : " pallino-cliccabile"}" data-abilita="${chiave}"></span>${nome} (${abbr}) <b>${formattaModificatore(mod)}</b>
    </li>`;
  }).join("");

  const modSaggezza = modificatore(scheda.caratteristiche?.saggezza ?? 10);
  const bonusPercezione = competenti.includes("percezione") ? bonus : 0;
  document.getElementById("valore-percezione-passiva").textContent = String(10 + modSaggezza + bonusPercezione);
}

function renderAttacchi() {
  const armi = (scheda.inventario || []).filter((v) => v.categoria === "arma");
  const corpo = document.getElementById("corpo-attacchi");
  const vuoto = document.getElementById("attacchi-vuoto");
  document.querySelector(".tabella-attacchi").hidden = armi.length === 0;

  if (armi.length === 0) {
    corpo.innerHTML = "";
    vuoto.hidden = false;
    return;
  }
  vuoto.hidden = true;
  corpo.innerHTML = armi
    .map((voce) => {
      const dati = ARMI[voce.chiave];
      const bonus = bonusAttaccoArma(voce);
      const automatico = bonusAttaccoSuggerito(voce.chiave);
      const personalizzato = voce.bonusAttacco != null && voce.bonusAttacco !== automatico;
      return `<tr data-chiave="${esc(voce.chiave)}">
        <td>${esc(voce.nome)}</td>
        <td>${
          soloLettura
            ? esc(formattaModificatore(bonus))
            : `<input type="number" class="input-bonus-attacco" data-chiave="${esc(voce.chiave)}" value="${esc(bonus)}" title="${personalizzato ? "Valore scritto a mano" : "Calcolato: competenza + caratteristica"}" />${
              personalizzato ? `<button type="button" class="btn-tabella btn-bonus-auto" data-bonus-auto="${esc(voce.chiave)}" title="Torna al valore calcolato (${esc(formattaModificatore(automatico))})" aria-label="Torna al valore calcolato">↺</button>` : ""}`
        }</td>
        <td>${dati ? `${esc(dati.danno)} ${esc(dati.tipoDanno)}` : "—"}</td>
        <td class="colonna-tiri">${soloLettura ? "" : `<button type="button" class="btn-tabella btn-tiro" data-tiro-colpire="${esc(voce.chiave)}" title="Tiro per colpire">Colpire</button>${
          dati && leggiFormula(dati.danno) ? `<button type="button" class="btn-tabella btn-tiro" data-tiro-danno="${esc(voce.chiave)}" title="Tiro per i danni">Danno</button>` : ""}`}</td>
      </tr>`;
    })
    .join("");
}

function modoIncantatore(classe) {
  if (CLASSI_CONOSCENZA_FISSA.includes(classe)) return "fisso";
  if (classe === "mago") return "libro";
  if (CLASSI_PREPARAZIONE.includes(classe)) return "preparazione";
  return null;
}

function livelloMassimoDisponibile(classe, livello) {
  const tipo = TIPO_LANCIATORE[classe];
  const slot = slotIncantesimoAlLivello(classe, livello);
  if (!tipo || !slot) return 0;
  if (tipo === "patto") return slot.slot > 0 ? slot.livelloSlot : 0;
  for (let i = slot.length - 1; i >= 0; i--) {
    if (slot[i] > 0) return i + 1;
  }
  return 0;
}

function etichettaIncantesimo(dati) {
  return dati.livello === 0 ? "Trucchetto" : `Livello ${dati.livello}`;
}

// Testo del tooltip (attributo title) mostrato sul nome dell'incantesimo:
// danno/cura (se presenti) seguiti dalla descrizione completa.
function tooltipIncantesimo(dati) {
  const righe = [];
  if (dati.danno) righe.push(`Danno: ${dati.danno}`);
  if (dati.cura) righe.push(`Cura: ${dati.cura}`);
  righe.push(dati.descrizione);
  return righe.join("\n").replace(/"/g, "&quot;");
}

function popolaFiltroLivello(select, livelloMax) {
  const attuale = select.value;
  select.innerHTML = '<option value="">Tutti i livelli</option><option value="0">Trucchetti</option>';
  for (let i = 1; i <= livelloMax; i++) {
    const opzione = document.createElement("option");
    opzione.value = String(i);
    opzione.textContent = `${i}° livello`;
    select.appendChild(opzione);
  }
  select.value = attuale && Number(attuale) <= livelloMax ? attuale : "";
}

// Livelli di slot uguali o superiori a quello base dell'incantesimo che
// hanno ancora almeno uno slot libero (upcasting): solo per lanciatori
// "pieno"/"mezzo" — il Warlock lancia sempre al livello del Patto Magico.
function livelliSlotDisponibili(classe, livello, livelloBase) {
  const tipo = TIPO_LANCIATORE[classe];
  const slot = slotIncantesimoAlLivello(classe, livello);
  if ((tipo !== "pieno" && tipo !== "mezzo") || !slot) return [];
  const usati = scheda.slotIncantesimoUsati || {};
  const risultato = [];
  for (let i = livelloBase; i <= slot.length; i++) {
    const max = slot[i - 1] || 0;
    if (max === 0) continue;
    const disponibili = max - (usati[i] || 0);
    if (disponibili > 0) risultato.push({ livello: i, disponibili });
  }
  return risultato;
}

// Chiave dell'incantesimo per cui è aperto il selettore del livello di
// slot da usare (upcasting): null quando nessun selettore è aperto.
let spellChooserAperto = null;

function renderControlloLancio(chiave, dati) {
  const tipo = TIPO_LANCIATORE[scheda.classe];
  if (tipo === "patto") {
    return `<button class="btn-tabella btn-lancia-incantesimo" data-lancia="${chiave}" type="button">Lancia</button>`;
  }
  if (chiave !== spellChooserAperto) {
    return `<button class="btn-tabella btn-lancia-incantesimo" data-lancia="${chiave}" type="button">Lancia</button>`;
  }
  const opzioni = livelliSlotDisponibili(scheda.classe, scheda.livello || 1, dati.livello);
  if (opzioni.length === 0) {
    return `<span class="scelta-slot-vuota">Nessuno slot disponibile</span>`;
  }
  const bottoni = opzioni
    .map(
      (o) =>
        `<button class="btn-tabella btn-slot-livello" data-lancia-livello="${chiave}:${o.livello}" type="button">${o.livello}° (${o.disponibili})</button>`
    )
    .join("");
  return `<span class="scelta-slot-incantesimo">${bottoni}<button class="btn-tabella btn-annulla-slot" data-annulla-slot="${chiave}" type="button" aria-label="Annulla">×</button></span>`;
}

function renderListaIncantesimi(idLista, idVuoto, chiavi, { campo, lanciabile }) {
  const lista = document.getElementById(idLista);
  const vuoto = idVuoto ? document.getElementById(idVuoto) : null;
  if (chiavi.length === 0) {
    lista.innerHTML = "";
    if (vuoto) vuoto.hidden = false;
    return;
  }
  if (vuoto) vuoto.hidden = true;
  lista.innerHTML = chiavi
    .map((chiave) => {
      const dati = ottieniIncantesimo(chiave);
      if (!dati) return "";
      const bottoneLancia = !soloLettura && lanciabile && dati.livello > 0 ? renderControlloLancio(chiave, dati) : "";
      const bottoneRimuovi = soloLettura ? "" : `<button class="btn-tabella" data-rimuovi="${esc(campo)}:${esc(chiave)}" type="button">Rimuovi</button>`;
      const bottoniTiro = !soloLettura && (lanciabile || dati.livello === 0) ? bottoniTiroIncantesimo(chiave) : "";
      return `<li class="inventario-riga" data-chiave="${esc(chiave)}">
        <span class="inventario-nome con-descrizione" title="${esc(tooltipIncantesimo(dati))}">${esc(dati.nome)} <small>(${esc(etichettaIncantesimo(dati))})</small></span>
        ${bottoniTiro}${bottoneLancia}${bottoneRimuovi}
      </li>`;
    })
    .join("");
}

// Tiri degli incantesimi: attacco = competenza + caratteristica da
// incantatore; CD dei tiri salvezza = 8 + lo stesso bonus.
function modIncantatore() {
  return modificatore(scheda.caratteristiche?.[CARATTERISTICA_INCANTESIMI[scheda.classe]] ?? 10);
}
const bonusAttaccoIncantesimi = () => bonusCompetenza(scheda.livello) + modIncantatore();

function bottoniTiroIncantesimo(chiave) {
  const tiri = TIRI_INCANTESIMI[chiave];
  if (!tiri) return "";
  const bottone = (tipo, testo) =>
    `<button class="btn-tabella btn-tiro" data-tiro-incantesimo="${esc(chiave)}" data-tipo-tiro="${tipo}" type="button">${testo}</button>`;
  return `${tiri.attacco ? bottone("colpire", "Colpire") : ""}${tiri.danno ? bottone("danno", "Danno") : ""}${tiri.cura ? bottone("cura", "Cura") : ""}`;
}

function renderIncantesimi() {
  const classe = scheda.classe;
  const modo = modoIncantatore(classe);
  const sezione = document.getElementById("sezione-incantesimi");
  sezione.hidden = !modo;
  if (!modo) return;
  const attacco = bonusAttaccoIncantesimi();
  document.getElementById("statistiche-incantesimi").textContent =
    `Attacco con incantesimi ${formattaModificatore(attacco)} · CD dei tiri salvezza ${8 + attacco}`;

  const livello = scheda.livello || 1;
  const livelloMax = livelloMassimoDisponibile(classe, livello);

  const maxTrucchetti = trucchettiConosciutiAlLivello(classe, livello) + trucchettoBonusRazza(scheda.razza, scheda.sottorazza);
  const trucchetti = (scheda.incantesimiConosciuti || []).filter((c) => ottieniIncantesimo(c)?.livello === 0);
  document.getElementById("trucchetti-limite").textContent = `${trucchetti.length} / ${maxTrucchetti}`;
  document.getElementById("ricerca-trucchetti-wrap").hidden = soloLettura || trucchetti.length >= maxTrucchetti;
  renderListaIncantesimi("lista-trucchetti", null, trucchetti, { campo: "conosciuti", lanciabile: false });

  const blocoConosciuti = document.getElementById("blocco-conosciuti");
  const blocoPreparati = document.getElementById("blocco-preparati");

  if (modo === "fisso") {
    blocoConosciuti.hidden = false;
    blocoPreparati.hidden = true;
    document.getElementById("titolo-blocco-conosciuti").textContent = "Incantesimi conosciuti";
    const max = incantesimiConosciutiAlLivello(classe, livello);
    const conosciuti = (scheda.incantesimiConosciuti || []).filter((c) => ottieniIncantesimo(c)?.livello > 0);
    document.getElementById("incantesimi-limite").textContent = `${conosciuti.length} / ${max}`;
    document.getElementById("ricerca-incantesimi-wrap").hidden = soloLettura || conosciuti.length >= max;
    popolaFiltroLivello(document.getElementById("filtro-livello-incantesimi"), livelloMax);
    renderListaIncantesimi("lista-incantesimi", "incantesimi-vuoto", conosciuti, { campo: "conosciuti", lanciabile: true });
  } else if (modo === "libro") {
    blocoConosciuti.hidden = false;
    blocoPreparati.hidden = false;
    document.getElementById("titolo-blocco-conosciuti").textContent = "Incantesimi nel libro";
    document.getElementById("incantesimi-limite").textContent = "";
    document.getElementById("ricerca-incantesimi-wrap").hidden = soloLettura;
    popolaFiltroLivello(document.getElementById("filtro-livello-incantesimi"), livelloMax);
    const libro = (scheda.incantesimiConosciuti || []).filter((c) => ottieniIncantesimo(c)?.livello > 0);
    renderListaIncantesimi("lista-incantesimi", "incantesimi-vuoto", libro, { campo: "conosciuti", lanciabile: false });
    renderBloccoPreparati(classe, livello, livelloMax);
  } else {
    blocoConosciuti.hidden = true;
    blocoPreparati.hidden = false;
    renderBloccoPreparati(classe, livello, livelloMax);
  }

  renderSlotPips();
}

function renderBloccoPreparati(classe, livello, livelloMax) {
  const punteggio = scheda.caratteristiche?.[CARATTERISTICA_INCANTESIMI[classe]] ?? 10;
  const max = incantesimiPreparatiAlLivello(classe, livello, punteggio) || 0;
  const preparati = scheda.incantesimiPreparati || [];
  document.getElementById("preparati-limite").textContent = `${preparati.length} / ${max}`;
  document.getElementById("ricerca-preparati-wrap").hidden = soloLettura || preparati.length >= max;
  popolaFiltroLivello(document.getElementById("filtro-livello-preparati"), livelloMax);
  renderListaIncantesimi("lista-preparati", "preparati-vuoto", preparati, { campo: "preparati", lanciabile: true });
}

function renderRisultatiRicercaIncantesimi(idContenitore, risultati, attributoDati) {
  const contenitore = document.getElementById(idContenitore);
  if (risultati.length === 0) {
    contenitore.hidden = true;
    contenitore.innerHTML = "";
    return;
  }
  contenitore.hidden = false;
  contenitore.innerHTML = risultati
    .map(
      (voce) => `<div class="risultato-riga">
    <span>${esc(voce.nome)} <small>(${esc(etichettaIncantesimo(voce))} · ${esc(voce.scuola)})</small></span>
    <button class="btn-tabella azione-aggiungi" data-${attributoDati}="${esc(voce.chiave)}" type="button">Aggiungi</button>
  </div>`
    )
    .join("");
}

async function aggiungiIncantesimoConosciuto(chiave) {
  scheda.incantesimiConosciuti = scheda.incantesimiConosciuti || [];
  if (!scheda.incantesimiConosciuti.includes(chiave)) scheda.incantesimiConosciuti.push(chiave);
  renderIncantesimi();
  try {
    await aggiornaScheda(scheda.id, { incantesimiConosciuti: scheda.incantesimiConosciuti });
  } catch (errore) {
    console.error(errore);
  }
}

document.getElementById("ricerca-trucchetti").addEventListener("input", (evento) => {
  const testo = evento.target.value;
  if (!testo.trim()) {
    renderRisultatiRicercaIncantesimi("risultati-trucchetti", []);
    return;
  }
  const risultati = cercaIncantesimi(testo, { classe: scheda.classe, livello: 0 }).slice(0, 10);
  renderRisultatiRicercaIncantesimi("risultati-trucchetti", risultati, "aggiungi-trucchetto");
});

document.getElementById("risultati-trucchetti").addEventListener("click", async (evento) => {
  const bottone = evento.target.closest("[data-aggiungi-trucchetto]");
  if (!bottone) return;
  await aggiungiIncantesimoConosciuto(bottone.dataset.aggiungiTrucchetto);
  document.getElementById("ricerca-trucchetti").value = "";
  renderRisultatiRicercaIncantesimi("risultati-trucchetti", []);
});

function aggiornaRisultatiPrincipali() {
  const testo = document.getElementById("ricerca-incantesimi").value;
  const livelloSel = document.getElementById("filtro-livello-incantesimi").value;
  if (!testo.trim() && livelloSel === "") {
    renderRisultatiRicercaIncantesimi("risultati-incantesimi", []);
    return;
  }
  const opzioni = { classe: scheda.classe };
  if (livelloSel !== "") opzioni.livello = Number(livelloSel);
  const risultati = cercaIncantesimi(testo, opzioni)
    .filter((v) => v.livello > 0)
    .slice(0, 15);
  renderRisultatiRicercaIncantesimi("risultati-incantesimi", risultati, "aggiungi-incantesimo");
}

document.getElementById("ricerca-incantesimi").addEventListener("input", aggiornaRisultatiPrincipali);
document.getElementById("filtro-livello-incantesimi").addEventListener("change", aggiornaRisultatiPrincipali);

document.getElementById("risultati-incantesimi").addEventListener("click", async (evento) => {
  const bottone = evento.target.closest("[data-aggiungi-incantesimo]");
  if (!bottone) return;
  await aggiungiIncantesimoConosciuto(bottone.dataset.aggiungiIncantesimo);
  document.getElementById("ricerca-incantesimi").value = "";
  aggiornaRisultatiPrincipali();
});

function aggiornaRisultatiPreparati() {
  const testo = document.getElementById("ricerca-preparati").value;
  const livelloSel = document.getElementById("filtro-livello-preparati").value;
  if (!testo.trim() && livelloSel === "") {
    renderRisultatiRicercaIncantesimi("risultati-preparati", []);
    return;
  }
  let candidati;
  if (scheda.classe === "mago") {
    const query = testo.trim().toLowerCase();
    candidati = (scheda.incantesimiConosciuti || [])
      .map((c) => ottieniIncantesimo(c))
      .filter((v) => v && v.livello > 0)
      .filter((v) => !query || v.nome.toLowerCase().includes(query))
      .filter((v) => livelloSel === "" || v.livello === Number(livelloSel));
  } else {
    const opzioni = { classe: scheda.classe };
    if (livelloSel !== "") opzioni.livello = Number(livelloSel);
    candidati = cercaIncantesimi(testo, opzioni).filter((v) => v.livello > 0);
  }
  candidati = candidati.filter((v) => !(scheda.incantesimiPreparati || []).includes(v.chiave)).slice(0, 15);
  renderRisultatiRicercaIncantesimi("risultati-preparati", candidati, "aggiungi-preparato");
}

document.getElementById("ricerca-preparati").addEventListener("input", aggiornaRisultatiPreparati);
document.getElementById("filtro-livello-preparati").addEventListener("change", aggiornaRisultatiPreparati);

document.getElementById("risultati-preparati").addEventListener("click", async (evento) => {
  const bottone = evento.target.closest("[data-aggiungi-preparato]");
  if (!bottone) return;
  const chiave = bottone.dataset.aggiungiPreparato;
  scheda.incantesimiPreparati = scheda.incantesimiPreparati || [];
  if (!scheda.incantesimiPreparati.includes(chiave)) scheda.incantesimiPreparati.push(chiave);
  document.getElementById("ricerca-preparati").value = "";
  renderIncantesimi();
  aggiornaRisultatiPreparati();
  try {
    await aggiornaScheda(scheda.id, { incantesimiPreparati: scheda.incantesimiPreparati });
  } catch (errore) {
    console.error(errore);
  }
});

// livelloScelto: livello dello slot da consumare (upcasting), solo per
// lanciatori "pieno"/"mezzo" — se omesso si usa il livello base dell'incantesimo.
// Il Warlock (Patto Magico) usa sempre e solo il livello del proprio slot.
async function lanciaIncantesimo(chiave, livelloScelto) {
  if (soloLettura) return;
  const dati = ottieniIncantesimo(chiave);
  if (!dati || dati.livello === 0) return;
  const tipo = TIPO_LANCIATORE[scheda.classe];
  const slot = slotIncantesimoAlLivello(scheda.classe, scheda.livello || 1);
  scheda.slotIncantesimoUsati = scheda.slotIncantesimoUsati || {};

  if (tipo === "patto") {
    if (dati.livello > slot.livelloSlot) {
      mostraToastLivello("Non hai ancora uno slot Patto Magico abbastanza alto.");
      return;
    }
    const usati = scheda.slotIncantesimoUsati.patto || 0;
    if (usati >= slot.slot) {
      mostraToastLivello("Nessuno slot Patto Magico disponibile.");
      return;
    }
    scheda.slotIncantesimoUsati.patto = usati + 1;
  } else {
    const livelloSlot = livelloScelto || dati.livello;
    if (livelloSlot < dati.livello) return;
    const max = slot[livelloSlot - 1] || 0;
    const usati = scheda.slotIncantesimoUsati[livelloSlot] || 0;
    if (usati >= max) {
      mostraToastLivello(`Nessuno slot di ${livelloSlot}° livello disponibile.`);
      return;
    }
    scheda.slotIncantesimoUsati[livelloSlot] = usati + 1;
  }

  spellChooserAperto = null;
  renderIncantesimi();
  try {
    await aggiornaScheda(scheda.id, { slotIncantesimoUsati: scheda.slotIncantesimoUsati });
  } catch (errore) {
    console.error(errore);
  }
}

function renderPipRow(max, usati, chiaveSlot) {
  const disponibili = Math.max(0, max - usati);
  let html = "";
  for (let i = 0; i < max; i++) {
    const acceso = i < disponibili;
    html += `<span class="pallino${acceso ? " competente" : ""}${soloLettura ? "" : " pallino-cliccabile"}" data-pip-slot="${chiaveSlot}"></span>`;
  }
  return html;
}

function renderSlotPips() {
  const contenitore = document.getElementById("pips-slot-incantesimo");
  const tipo = TIPO_LANCIATORE[scheda.classe];
  const slot = slotIncantesimoAlLivello(scheda.classe, scheda.livello || 1);
  if (!tipo || !slot) {
    contenitore.innerHTML = "";
    return;
  }
  if (tipo === "patto") {
    const usati = scheda.slotIncantesimoUsati?.patto || 0;
    contenitore.innerHTML =
      slot.slot > 0
        ? `<div class="riga-pip-slot"><span class="pip-slot-etichetta">Patto ${slot.livelloSlot}°</span>${renderPipRow(slot.slot, usati, "patto")}</div>`
        : "";
    return;
  }
  contenitore.innerHTML = slot
    .map((max, indice) => {
      if (max === 0) return "";
      const livelloSlot = indice + 1;
      const usati = scheda.slotIncantesimoUsati?.[livelloSlot] || 0;
      return `<div class="riga-pip-slot"><span class="pip-slot-etichetta">${livelloSlot}°</span>${renderPipRow(max, usati, String(livelloSlot))}</div>`;
    })
    .join("");
}

document.getElementById("pips-slot-incantesimo").addEventListener("click", async (evento) => {
  if (soloLettura) return;
  const pip = evento.target.closest("[data-pip-slot]");
  if (!pip) return;
  const chiaveSlot = pip.dataset.pipSlot;
  const acceso = pip.classList.contains("competente");
  scheda.slotIncantesimoUsati = scheda.slotIncantesimoUsati || {};
  const attuale = scheda.slotIncantesimoUsati[chiaveSlot] || 0;
  scheda.slotIncantesimoUsati[chiaveSlot] = acceso ? attuale + 1 : Math.max(0, attuale - 1);
  renderSlotPips();
  try {
    await aggiornaScheda(scheda.id, { slotIncantesimoUsati: scheda.slotIncantesimoUsati });
  } catch (errore) {
    console.error(errore);
  }
});

// Incantesimi innati di razza: indipendenti dalla classe (e quindi dalla
// sezione "modo incantatore"), lanciabili 1 volta al giorno senza slot.
function renderIncantesimiRazza() {
  const sezione = document.getElementById("sezione-incantesimi-razza");
  const elenco = incantesimiRazzialiAlLivello(scheda.razza, scheda.sottorazza, scheda.livello || 1);
  sezione.hidden = elenco.length === 0;
  if (elenco.length === 0) return;
  const usati = scheda.incantesimiRazzaUsati || [];
  document.getElementById("lista-incantesimi-razza").innerHTML = elenco
    .map((chiave) => {
      const dati = ottieniIncantesimo(chiave);
      if (!dati) return "";
      const usato = usati.includes(chiave);
      const pip = `<span class="pallino${usato ? "" : " competente"}"></span>`;
      const azione = soloLettura
        ? ""
        : usato
        ? `<span class="etichetta-incantesimo-razza-usato">Usato oggi</span>`
        : `<button class="btn-tabella btn-lancia-incantesimo" data-lancia-razza="${esc(chiave)}" type="button">Lancia</button>`;
      return `<li class="inventario-riga">
        <span class="inventario-nome con-descrizione" title="${esc(tooltipIncantesimo(dati))}">${pip} ${esc(dati.nome)} <small>(1/giorno)</small></span>
        ${azione}
      </li>`;
    })
    .join("");
}

document.getElementById("lista-incantesimi-razza").addEventListener("click", async (evento) => {
  if (soloLettura) return;
  const bottone = evento.target.closest("[data-lancia-razza]");
  if (!bottone) return;
  const chiave = bottone.dataset.lanciaRazza;
  scheda.incantesimiRazzaUsati = scheda.incantesimiRazzaUsati || [];
  scheda.condizioni = scheda.condizioni || [];
  scheda.esaurimento = scheda.esaurimento || 0;
  if (!scheda.incantesimiRazzaUsati.includes(chiave)) scheda.incantesimiRazzaUsati.push(chiave);
  renderIncantesimiRazza();
  try {
    await aggiornaScheda(scheda.id, { incantesimiRazzaUsati: scheda.incantesimiRazzaUsati });
  } catch (errore) {
    console.error(errore);
  }
});

document.getElementById("sezione-incantesimi").addEventListener("click", async (evento) => {
  const bottoneRimuovi = evento.target.closest("[data-rimuovi]");
  if (bottoneRimuovi) {
    const [campo, chiave] = bottoneRimuovi.dataset.rimuovi.split(":");
    const proprieta = campo === "preparati" ? "incantesimiPreparati" : "incantesimiConosciuti";
    scheda[proprieta] = (scheda[proprieta] || []).filter((c) => c !== chiave);
    renderIncantesimi();
    try {
      await aggiornaScheda(scheda.id, { [proprieta]: scheda[proprieta] });
    } catch (errore) {
      console.error(errore);
    }
    return;
  }
  const bottoneLancia = evento.target.closest("[data-lancia]");
  if (bottoneLancia) {
    const chiave = bottoneLancia.dataset.lancia;
    if (TIPO_LANCIATORE[scheda.classe] === "patto") {
      await lanciaIncantesimo(chiave);
    } else {
      spellChooserAperto = chiave;
      renderIncantesimi();
    }
    return;
  }
  const bottoneLivello = evento.target.closest("[data-lancia-livello]");
  if (bottoneLivello) {
    const [chiave, livelloStr] = bottoneLivello.dataset.lanciaLivello.split(":");
    await lanciaIncantesimo(chiave, Number(livelloStr));
    return;
  }
  const bottoneAnnulla = evento.target.closest("[data-annulla-slot]");
  if (bottoneAnnulla) {
    spellChooserAperto = null;
    renderIncantesimi();
  }
});

// Bonus d'attacco di un'arma: quello scritto a mano se c'è, altrimenti
// calcolato (si aggiorna da solo con livello e caratteristiche).
function bonusAttaccoArma(voce) {
  return voce.bonusAttacco ?? bonusAttaccoSuggerito(voce.chiave);
}

function bonusAttaccoSuggerito(chiaveArma) {
  const arma = ARMI[chiaveArma];
  if (!arma) return 0;
  const modFor = modificatore(scheda.caratteristiche?.forza ?? 10);
  const modDes = modificatore(scheda.caratteristiche?.destrezza ?? 10);
  const finezza = arma.proprieta?.includes("Finezza");
  const modPertinente = finezza ? Math.max(modFor, modDes) : arma.tipo === "a distanza" ? modDes : modFor;
  return modPertinente + bonusCompetenza(scheda.livello);
}

function renderPersonalita() {
  const campi = {
    "personalita-tratti": "tratti",
    "personalita-ideali": "ideali",
    "personalita-legami": "legami",
    "personalita-difetti": "difetti",
    "competenze-linguaggi": "competenzeLinguaggi",
  };
  Object.entries(campi).forEach(([id, chiave]) => {
    const campo = document.getElementById(id);
    campo.value = chiave === "competenzeLinguaggi" ? scheda.competenzeLinguaggi || "" : scheda.personalita?.[chiave] || "";
    campo.disabled = soloLettura;
  });
}

function renderTalenti() {
  const talenti = scheda.talenti || [];
  const lista = document.getElementById("lista-talenti");
  const vuoto = document.getElementById("talenti-vuoto");
  document.getElementById("form-talento-wrap").hidden = soloLettura;

  if (talenti.length === 0) {
    lista.innerHTML = "";
    vuoto.hidden = false;
    return;
  }
  vuoto.hidden = true;
  lista.innerHTML = talenti
    .map(
      (testo, indice) => `
    <li>
      <b>${esc(testo)}</b>
      ${soloLettura ? "" : `<button class="btn-rimuovi-talento" data-indice="${indice}" type="button" aria-label="Rimuovi">×</button>`}
    </li>`
    )
    .join("");
}

function renderMonete() {
  const monete = scheda.monete;
  document.getElementById("moneta-rame").value = monete.rame;
  document.getElementById("moneta-argento").value = monete.argento;
  document.getElementById("moneta-oro").value = monete.oro;
  document.getElementById("moneta-elettro").value = monete.elettro;
  document.getElementById("moneta-platino").value = monete.platino;
  ["moneta-rame", "moneta-argento", "moneta-oro", "moneta-elettro", "moneta-platino"].forEach((id) => {
    document.getElementById(id).disabled = soloLettura;
  });
}

function renderSalvezze() {
  const classe = CLASSI[scheda.classe];
  const bonus = bonusCompetenza(scheda.livello);
  CARATTERISTICHE.forEach(({ chiave }) => {
    const punteggio = scheda.caratteristiche?.[chiave] ?? 10;
    const competente = Boolean(classe?.salvezze?.includes(chiave));
    const mod = modificatore(punteggio) + (competente ? bonus : 0);
    const riga = document.querySelector(`#lista-salvezze li[data-chiave="${chiave}"]`);
    riga.classList.toggle("competente", competente);
    riga.querySelector("b").textContent = formattaModificatore(mod);
  });
  document.getElementById("valore-bonus-competenza").textContent = `+${bonus}`;
}

function renderVelocitaEDadi() {
  document.getElementById("valore-velocita").textContent = formattaVelocita(velocitaRazza(scheda.razza, scheda.sottorazza));
  renderDadiVita();
}

function renderDadiVita() {
  document.getElementById("dadi-vita").textContent =
    `${dadiVitaDisponibili(scheda)} / ${scheda.livello || 1} (d${dadoVitaClasse(scheda.classe)})`;
}

function renderHp() {
  document.getElementById("hp-massimi").textContent = scheda.hp.massimi;
  document.getElementById("hp-attuali").value = scheda.hp.attuali;
  document.getElementById("hp-temporanei").value = scheda.hp.temporanei;
  document.getElementById("hp-attuali").disabled = soloLettura;
  document.getElementById("hp-temporanei").disabled = soloLettura;
}

// Condizioni ed esaurimento: il proprietario le modifica, gli altri (es. il
// DM che consulta la scheda) le vedono soltanto.
let firmaCondizioniMostrate = null;
function renderCondizioni() {
  const contenitore = document.getElementById("condizioni-scheda");
  const firma = JSON.stringify([scheda.condizioni, scheda.esaurimento, soloLettura]);
  if (firma === firmaCondizioniMostrate) return;
  firmaCondizioniMostrate = firma;
  if (soloLettura) {
    const chip = creaChipCondizioni(scheda.condizioni, scheda.esaurimento);
    contenitore.replaceChildren(chip.hidden ? Object.assign(document.createElement("span"), { className: "party-sessione-sub", textContent: "Nessuna" }) : chip);
    return;
  }
  contenitore.replaceChildren(creaEditorCondizioni({
    condizioni: scheda.condizioni,
    esaurimento: scheda.esaurimento,
    onCambia: async ({ condizioni, esaurimento }) => {
      scheda.condizioni = condizioni;
      scheda.esaurimento = esaurimento;
      firmaCondizioniMostrate = JSON.stringify([condizioni, esaurimento, soloLettura]);
      try {
        await aggiornaCondizioniScheda(scheda, condizioni, esaurimento);
      } catch (errore) {
        console.error(errore);
      }
    },
  }));
}

// Aggiornamenti dal database mentre la scheda è aperta (es. il DM applica
// danni o condizioni dalla Sessione): si aggiornano solo PF e condizioni,
// senza toccare un campo che si sta scrivendo.
function ascoltaModificheEsterne() {
  ascoltaScheda(scheda.id, (remota) => {
    const hp = remota.hp || scheda.hp;
    const inputHp = [document.getElementById("hp-attuali"), document.getElementById("hp-temporanei")];
    if (JSON.stringify(hp) !== JSON.stringify(scheda.hp) && !inputHp.includes(document.activeElement)) {
      scheda.hp = hp;
      renderHp();
    }
    scheda.condizioni = remota.condizioni || [];
    scheda.esaurimento = remota.esaurimento || 0;
    renderCondizioni();
    // Riposi applicati dal DM: dadi vita, slot, incantesimi di razza, tiri
    // contro la morte.
    const firmaRiposo = (s) => JSON.stringify([s.dadiVitaSpesi || 0, s.slotIncantesimoUsati || {},
      s.incantesimiRazzaUsati || [], s.tiriSalvezzaMorte || null, s.usiPrivilegi || {}]);
    if (firmaRiposo(remota) !== firmaRiposo(scheda)) {
      scheda.dadiVitaSpesi = remota.dadiVitaSpesi || 0;
      scheda.slotIncantesimoUsati = remota.slotIncantesimoUsati || {};
      scheda.incantesimiRazzaUsati = remota.incantesimiRazzaUsati || [];
      if (remota.tiriSalvezzaMorte) scheda.tiriSalvezzaMorte = remota.tiriSalvezzaMorte;
      scheda.usiPrivilegi = remota.usiPrivilegi || {};
      renderPrivilegi();
      renderDadiVita();
      renderSlotPips();
      renderIncantesimiRazza();
      renderPalliniMorte();
    }
  });
}

// ---------- Privilegi di classe ----------
// Usi limitati (Ira, Azione Impetuosa, Punti Ki…): pallini come gli slot
// (pieno = disponibile, clic per usarlo o recuperarlo); per le riserve grandi
// (Punti Ki, Imposizione delle Mani…) un contatore con quantità.
const LIMITE_PALLINI = 10;

function renderPrivilegi() {
  const privilegi = privilegiDelPersonaggio(scheda);
  document.getElementById("box-privilegi").hidden = privilegi.length === 0;
  const lista = document.getElementById("lista-privilegi");
  lista.replaceChildren(...privilegi.map((p) => {
    const li = document.createElement("li");
    li.className = "riga-privilegio";
    li.dataset.privilegio = p.chiave;
    const nome = document.createElement("span");
    nome.className = "privilegio-nome con-descrizione";
    nome.textContent = p.nome;
    nome.title = `${p.descrizione} Si ricarica con un ${NOMI_RICARICA[p.ricarica]}.`;
    const ricarica = document.createElement("small");
    ricarica.className = "privilegio-ricarica";
    ricarica.textContent = p.ricarica === "breve" ? "breve" : "lungo";
    nome.append(" ", ricarica);
    li.append(nome);
    if (!Number.isFinite(p.max)) {
      li.append(Object.assign(document.createElement("span"), { className: "privilegio-conteggio", textContent: "illimitato" }));
      return li;
    }
    if (p.max <= LIMITE_PALLINI) {
      const pallini = document.createElement("span");
      pallini.className = "pallini-privilegio";
      pallini.innerHTML = renderPipRow(p.max, p.usati, p.chiave);
      pallini.setAttribute("aria-label", `${p.rimasti} su ${p.max} disponibili`);
      li.append(pallini);
      return li;
    }
    const conteggio = document.createElement("span");
    conteggio.className = "privilegio-conteggio";
    conteggio.textContent = `${p.rimasti} / ${p.max}`;
    li.append(conteggio);
    if (!soloLettura) {
      const quanti = document.createElement("input");
      quanti.type = "number";
      quanti.min = "1";
      quanti.value = "1";
      quanti.className = "input-privilegio";
      quanti.setAttribute("aria-label", `Quantità di ${p.nome}`);
      const usa = Object.assign(document.createElement("button"), { type: "button", className: "btn-tabella", textContent: "Usa" });
      const recupera = Object.assign(document.createElement("button"), { type: "button", className: "btn-tabella", textContent: "Recupera" });
      usa.dataset.usaPrivilegio = p.chiave;
      recupera.dataset.recuperaPrivilegio = p.chiave;
      li.append(quanti, usa, recupera);
    }
    return li;
  }));
}

async function cambiaUsoPrivilegio(chiave, delta) {
  const privilegio = privilegiDelPersonaggio(scheda).find((p) => p.chiave === chiave);
  if (!privilegio || !Number.isFinite(privilegio.max)) return;
  const usati = Math.max(0, Math.min(privilegio.max, privilegio.usati + delta));
  if (usati === privilegio.usati) return;
  const usi = { ...(scheda.usiPrivilegi || {}) };
  if (usati) usi[chiave] = usati;
  else delete usi[chiave];
  scheda.usiPrivilegi = usi;
  renderPrivilegi();
  try {
    await aggiornaUsiPrivilegi(scheda, usi);
  } catch (errore) {
    console.error(errore);
    mostraAvviso("Impossibile salvare il privilegio. Riprova.");
  }
}

document.getElementById("lista-privilegi").addEventListener("click", (evento) => {
  if (soloLettura) return;
  const pip = evento.target.closest("[data-pip-slot]");
  if (pip) {
    cambiaUsoPrivilegio(pip.dataset.pipSlot, pip.classList.contains("competente") ? 1 : -1);
    return;
  }
  const bottone = evento.target.closest("[data-usa-privilegio], [data-recupera-privilegio]");
  if (!bottone) return;
  const quanti = Math.max(1, Math.trunc(Number(bottone.closest("li").querySelector(".input-privilegio")?.value)) || 1);
  if (bottone.dataset.usaPrivilegio) cambiaUsoPrivilegio(bottone.dataset.usaPrivilegio, quanti);
  else cambiaUsoPrivilegio(bottone.dataset.recuperaPrivilegio, -quanti);
});

// ---------- Riposi ----------
// Il proprietario fa un riposo dalla scheda; se il DM ha avviato un riposo
// breve per il party, compare l'invito e, finito il riposo, lo si segna.
let invitoRiposoAperto = false;

function ascoltaInvitoRiposo() {
  if (soloLettura || !scheda.attiva || !scheda.campagnaId) return;
  ascoltaRiposo(scheda.campagnaId, (riposo) => {
    invitoRiposoAperto = Boolean(riposo?.attivo && riposo.partecipanti?.includes(uidCorrente)
      && !riposo.conclusi?.includes(uidCorrente));
    document.getElementById("invito-riposo").hidden = !invitoRiposoAperto;
    document.getElementById("btn-riposo-breve").classList.toggle("btn-tabella-evidenza", invitoRiposoAperto);
  }, (errore) => console.error(errore));
}

async function salvaRiposo(campi, testoAppunto) {
  Object.assign(scheda, campi);
  renderPrivilegi();
  renderHp();
  renderCondizioni();
  renderDadiVita();
  renderSlotPips();
  renderIncantesimiRazza();
  renderPalliniMorte();
  try {
    await applicaRiposoScheda(scheda, campi);
  } catch (errore) {
    console.error(errore);
    mostraAvviso("Impossibile salvare il riposo. Riprova.");
    return false;
  }
  if (scheda.campagnaId && scheda.attiva) {
    annotaRiposo(scheda.campagnaId, uidCorrente, profiloCorrente?.nome ?? null, testoAppunto);
  }
  return true;
}

document.getElementById("btn-riposo-breve").addEventListener("click", async () => {
  if (soloLettura) return;
  const esito = await apriRiposoBreve(scheda);
  if (!esito) return;
  const salvato = await salvaRiposo(
    effettiRiposoBreve(scheda, esito),
    testoRiposoBreve(scheda.nome || "Personaggio", esito, dadoVitaClasse(scheda.classe))
  );
  if (salvato && invitoRiposoAperto) {
    segnaRiposoConcluso(scheda.campagnaId, uidCorrente).catch((errore) => console.error(errore));
  }
});

document.getElementById("btn-riposo-lungo").addEventListener("click", async () => {
  if (soloLettura) return;
  const campi = effettiRiposoLungo(scheda);
  const recuperati = (scheda.dadiVitaSpesi || 0) - campi.dadiVitaSpesi;
  const conferma = await confermaRiposo({
    titolo: "Riposo lungo",
    effetti: [
      `PF al massimo (${scheda.hp.massimi}), PF temporanei azzerati`,
      `Dadi vita recuperati: ${recuperati} (disponibili ${dadiVitaDisponibili({ ...scheda, ...campi })} su ${scheda.livello || 1})`,
      "Slot incantesimo e incantesimi di razza ripristinati",
      "Tiri salvezza contro la morte azzerati",
      ...(privilegiDelPersonaggio(scheda).length ? ["Privilegi di classe ripristinati"] : []),
      ...(scheda.esaurimento > 0 ? [`Esaurimento: da ${scheda.esaurimento} a ${campi.esaurimento}`] : []),
    ],
  });
  if (!conferma) return;
  await salvaRiposo(campi, `${scheda.nome || "Personaggio"}: riposo lungo.`);
});

function renderPalliniMorte() {
  document.querySelectorAll(".pallini-morte .pallino[data-tipo]").forEach((pallino) => {
    const tipo = pallino.dataset.tipo;
    const indice = Number(pallino.dataset.indice);
    pallino.classList.toggle("competente", Boolean(scheda.tiriSalvezzaMorte[tipo][indice]));
    pallino.classList.toggle("pallino-cliccabile", !soloLettura);
  });
  document.getElementById("btn-reset-morte").style.display = soloLettura ? "none" : "";
}

function renderInventario() {
  const lista = document.getElementById("lista-inventario");
  const vuoto = document.getElementById("inventario-vuoto");
  const inventario = scheda.inventario || [];

  document.getElementById("ricerca-equip-wrap").hidden = soloLettura;

  if (inventario.length === 0) {
    lista.innerHTML = "";
    vuoto.hidden = false;
  } else {
    vuoto.hidden = true;
    lista.innerHTML = inventario
      .map(
        (voce) => `
      <li class="inventario-riga" data-chiave="${esc(voce.chiave)}">
        <span class="inventario-nome">${esc(voce.nome)}</span>
        ${
          soloLettura
            ? `<span class="inventario-quantita">×${esc(voce.quantita)}</span>`
            : `<input type="number" class="input-quantita" min="1" value="${esc(voce.quantita)}" data-chiave="${esc(voce.chiave)}" />
               <button class="btn-tabella" data-rimuovi="${esc(voce.chiave)}" type="button">Rimuovi</button>`
        }
      </li>`
      )
      .join("");
  }
}

async function salvaInventario() {
  try {
    await aggiornaInventario(scheda.id, scheda.inventario || []);
  } catch (errore) {
    console.error(errore);
  }
}

function renderRisultatiRicerca(testo) {
  const contenitore = document.getElementById("risultati-equip");
  const risultati = cercaEquipaggiamento(testo).slice(0, 15);
  if (risultati.length === 0) {
    contenitore.hidden = true;
    contenitore.innerHTML = "";
    return;
  }
  contenitore.hidden = false;
  contenitore.innerHTML = risultati
    .map(
      (voce) => `
    <div class="risultato-riga">
      <span>${esc(voce.nome)} <small>(${esc(ETICHETTE_CATEGORIA[voce.categoria])}${voce.costo ? " · " + esc(voce.costo) : ""})</small></span>
      <button class="btn-tabella azione-aggiungi" data-aggiungi="${esc(voce.chiave)}" data-nome="${esc(voce.nome)}" data-categoria="${esc(voce.categoria)}" type="button">Aggiungi</button>
    </div>`
    )
    .join("");
}

function renderBadgeStato() {
  const badge = document.getElementById("badge-stato");
  if (soloLettura) {
    badge.textContent = "Sola lettura";
    badge.style.borderColor = "var(--color-danger)";
    badge.style.color = "#d98a94";
  } else {
    badge.textContent = "Alcuni campi non sono ancora modificabili";
    badge.style.borderColor = "";
    badge.style.color = "";
  }
}

proteggiPagina(async (user, profilo) => {
  uidCorrente = user.uid;
  profiloCorrente = profilo || {};
  montaMenuUtente({ contenitore: document.getElementById("slot-utente"), user, profilo });
  const idParam = new URLSearchParams(window.location.search).get("id");

  try {
    if (idParam) {
      scheda = await ottieniScheda(idParam);
    } else {
      const campagna = await ottieniCampagnaCorrente(user.uid, profilo?.ruolo);
      scheda = campagna ? await ottieniSchedaAttiva(user.uid, campagna.id) : null;
    }
  } catch (errore) {
    console.error(errore);
    scheda = null;
  }

  if (!scheda) {
    window.location.href = "i-miei-personaggi.html";
    return;
  }

  soloLettura = scheda.proprietarioUid !== user.uid;

  // Normalizza i campi introdotti dopo la creazione di schede più vecchie.
  scheda.abilitaCompetenti = scheda.abilitaCompetenti || [];
  scheda.personalita = scheda.personalita || {};
  scheda.talenti = scheda.talenti || [];
  scheda.competenzeLinguaggi = scheda.competenzeLinguaggi || "";
  scheda.monete = scheda.monete || { rame: 0, argento: 0, oro: 0, elettro: 0, platino: 0 };
  scheda.inventario = scheda.inventario || [];
  // Bonus d'attacco uguali al calcolato: diventano automatici (seguiranno
  // livello e caratteristiche); quelli scritti a mano restano.
  scheda.inventario.forEach((voce) => {
    if (voce.categoria === "arma" && voce.bonusAttacco === bonusAttaccoSuggerito(voce.chiave)) voce.bonusAttacco = null;
  });
  scheda.armaturaIndossata = scheda.armaturaIndossata || null;
  scheda.scudoIndossato = Boolean(scheda.scudoIndossato);
  scheda.background = scheda.background || "";
  scheda.allineamento = scheda.allineamento || null;
  scheda.incantesimiConosciuti = scheda.incantesimiConosciuti || [];
  scheda.incantesimiPreparati = scheda.incantesimiPreparati || [];
  scheda.slotIncantesimoUsati = scheda.slotIncantesimoUsati || {};
  scheda.incantesimiRazzaUsati = scheda.incantesimiRazzaUsati || [];
  scheda.dadiVitaSpesi = scheda.dadiVitaSpesi || 0;
  scheda.usiPrivilegi = scheda.usiPrivilegi || {};
  scheda.tiriSalvezzaMorte = scheda.tiriSalvezzaMorte || { successi: [false, false, false], fallimenti: [false, false, false] };

  renderBadgeStato();
  renderIntestazione();
  renderRitratto();
  renderBackground();
  renderAllineamento();
  renderCaratteristiche();
  renderSalvezze();
  renderVelocitaEDadi();
  renderHp();
  renderCondizioni();
  renderPalliniMorte();
  renderInventario();
  renderEquipaggiamentoIndossato();
  renderAbilita();
  renderAttacchi();
  renderIncantesimi();
  renderIncantesimiRazza();
  renderPrivilegi();
  renderPersonalita();
  renderTalenti();
  renderMonete();
  renderPulsanteLivello();
  document.getElementById("azioni-riposo").hidden = soloLettura;
  ascoltaModificheEsterne();
  ascoltaInvitoRiposo();

  veil.style.display = "none";
  contenuto.style.display = "block";
});

// PF attuali/temporanei: salva al cambio di valore (blur o invio).
async function salvaHpDaInput() {
  if (soloLettura) return;
  const attuali = Math.max(0, Number(document.getElementById("hp-attuali").value) || 0);
  const temporanei = Math.max(0, Number(document.getElementById("hp-temporanei").value) || 0);
  scheda.hp.attuali = attuali;
  scheda.hp.temporanei = temporanei;
  renderHp();
  try {
    await aggiornaHp(scheda, scheda.hp);
  } catch (errore) {
    console.error(errore);
  }
}
document.getElementById("hp-attuali").addEventListener("change", salvaHpDaInput);
document.getElementById("hp-temporanei").addEventListener("change", salvaHpDaInput);

// Tiri salvezza contro la morte: click su un pallino lo accende/spegne.
document.querySelectorAll(".pallini-morte .pallino[data-tipo]").forEach((pallino) => {
  pallino.addEventListener("click", async () => {
    if (soloLettura) return;
    const tipo = pallino.dataset.tipo;
    const indice = Number(pallino.dataset.indice);
    scheda.tiriSalvezzaMorte[tipo][indice] = !scheda.tiriSalvezzaMorte[tipo][indice];
    renderPalliniMorte();
    try {
      await aggiornaTiriSalvezzaMorte(scheda.id, scheda.tiriSalvezzaMorte);
    } catch (errore) {
      console.error(errore);
    }
  });
});

document.getElementById("btn-reset-morte").addEventListener("click", async () => {
  if (soloLettura) return;
  scheda.tiriSalvezzaMorte = { successi: [false, false, false], fallimenti: [false, false, false] };
  renderPalliniMorte();
  try {
    await aggiornaTiriSalvezzaMorte(scheda.id, scheda.tiriSalvezzaMorte);
  } catch (errore) {
    console.error(errore);
  }
});

// Ricerca nel catalogo equipaggiamento e aggiunta all'inventario.
const inputRicerca = document.getElementById("ricerca-equip");
inputRicerca.addEventListener("input", () => {
  renderRisultatiRicerca(inputRicerca.value);
});

document.getElementById("risultati-equip").addEventListener("click", async (evento) => {
  const bottone = evento.target.closest("[data-aggiungi]");
  if (!bottone) return;

  const chiave = bottone.dataset.aggiungi;
  const categoria = bottone.dataset.categoria;
  scheda.inventario = scheda.inventario || [];
  const esistente = scheda.inventario.find((voce) => voce.chiave === chiave);
  if (esistente) {
    esistente.quantita += 1;
  } else {
    const nuovaVoce = { chiave, nome: bottone.dataset.nome, categoria, quantita: 1 };
    if (categoria === "arma") nuovaVoce.bonusAttacco = null;
    scheda.inventario.push(nuovaVoce);
  }

  inputRicerca.value = "";
  renderRisultatiRicerca("");
  renderInventario();
  renderEquipaggiamentoIndossato();
  renderAttacchi();
  await salvaInventario();
});

document.getElementById("lista-inventario").addEventListener("click", async (evento) => {
  const bottone = evento.target.closest("[data-rimuovi]");
  if (!bottone) return;

  scheda.inventario = (scheda.inventario || []).filter((voce) => voce.chiave !== bottone.dataset.rimuovi);
  renderInventario();
  renderEquipaggiamentoIndossato();
  renderAttacchi();
  await salvaInventario();
});

document.getElementById("lista-inventario").addEventListener("change", async (evento) => {
  const input = evento.target.closest(".input-quantita");
  if (!input) return;

  const quantita = Math.max(1, Number(input.value) || 1);
  const voce = (scheda.inventario || []).find((v) => v.chiave === input.dataset.chiave);
  if (voce) voce.quantita = quantita;
  renderInventario();
  await salvaInventario();
});

// Armatura/scudo indossati: cambiano la Classe Armatura calcolata.
document.getElementById("select-armatura-indossata").addEventListener("change", async (evento) => {
  if (soloLettura) return;
  scheda.armaturaIndossata = evento.target.value || null;
  renderCA();
  try {
    await aggiornaScheda(scheda.id, { armaturaIndossata: scheda.armaturaIndossata });
  } catch (errore) {
    console.error(errore);
  }
});

document.getElementById("checkbox-scudo").addEventListener("change", async (evento) => {
  if (soloLettura) return;
  scheda.scudoIndossato = evento.target.checked;
  renderCA();
  try {
    await aggiornaScheda(scheda.id, { scudoIndossato: scheda.scudoIndossato });
  } catch (errore) {
    console.error(errore);
  }
});

// Abilità: click su un pallino accende/spegne la competenza.
document.getElementById("lista-abilita").addEventListener("click", async (evento) => {
  if (soloLettura) return;
  const pallino = evento.target.closest("[data-abilita]");
  if (!pallino) return;

  const chiave = pallino.dataset.abilita;
  const competenti = new Set(scheda.abilitaCompetenti || []);
  if (competenti.has(chiave)) competenti.delete(chiave);
  else competenti.add(chiave);
  scheda.abilitaCompetenti = Array.from(competenti);
  renderAbilita();
  try {
    await aggiornaScheda(scheda.id, { abilitaCompetenti: scheda.abilitaCompetenti });
  } catch (errore) {
    console.error(errore);
  }
});

// Bonus attacco: editabile per ogni arma dell'inventario.
document.getElementById("corpo-attacchi").addEventListener("change", async (evento) => {
  const input = evento.target.closest(".input-bonus-attacco");
  if (!input) return;

  const voce = (scheda.inventario || []).find((v) => v.chiave === input.dataset.chiave);
  if (!voce) return;
  const valore = Math.trunc(Number(input.value)) || 0;
  // Uguale al calcolato: torna automatico (seguirà livello e caratteristiche).
  voce.bonusAttacco = valore === bonusAttaccoSuggerito(voce.chiave) ? null : valore;
  renderAttacchi();
  await salvaInventario();
});

// ---------- Tiri dalla scheda ----------
// Clic su caratteristiche, tiri salvezza, abilità, iniziativa e attacchi: il
// tiro si vede nel vassoio e, con una sessione in corso, va nel registro.
function tiroDallaScheda(opzioni, dopo = null) {
  if (soloLettura) return;
  apriTiro({
    ...opzioni,
    onTiro: async (tiro) => {
      const registrato = scheda.attiva && scheda.campagnaId
        ? await annotaTiro(scheda.campagnaId, uidCorrente, profiloCorrente?.nome ?? null, testoTiro(scheda.nome || "Personaggio", tiro), tiro)
        : false;
      const extra = dopo ? await dopo(tiro) : null;
      return [registrato ? null : "Solo per te: nessuna sessione in corso.", extra].filter(Boolean).join(" ") || null;
    },
  });
}

const modCaratteristica = (chiave) => modificatore(scheda.caratteristiche?.[chiave] ?? 10);
const nomeCaratteristica = (chiave) => CARATTERISTICHE.find((c) => c.chiave === chiave)?.nome || chiave;

document.getElementById("griglia-caratteristiche").addEventListener("click", (evento) => {
  const box = evento.target.closest(".caratteristica[data-chiave]");
  if (!box) return;
  tiroDallaScheda({ etichetta: `Prova di ${nomeCaratteristica(box.dataset.chiave)}`, modificatore: modCaratteristica(box.dataset.chiave) });
});

document.getElementById("lista-salvezze").addEventListener("click", (evento) => {
  const riga = evento.target.closest("li[data-chiave]");
  if (!riga) return;
  const chiave = riga.dataset.chiave;
  const competente = Boolean(CLASSI[scheda.classe]?.salvezze?.includes(chiave));
  tiroDallaScheda({
    etichetta: `Tiro salvezza su ${nomeCaratteristica(chiave)}`,
    modificatore: modCaratteristica(chiave) + (competente ? bonusCompetenza(scheda.livello) : 0),
  });
});

// Sulle abilità il pallino segna la competenza; il resto della riga tira.
document.getElementById("lista-abilita").addEventListener("click", (evento) => {
  if (evento.target.closest("[data-abilita]")) return;
  const riga = evento.target.closest("li[data-chiave]");
  const abilita = riga && ABILITA.find((a) => a.chiave === riga.dataset.chiave);
  if (!abilita) return;
  const competente = (scheda.abilitaCompetenti || []).includes(abilita.chiave);
  tiroDallaScheda({
    etichetta: abilita.nome,
    modificatore: modCaratteristica(abilita.caratteristica) + (competente ? bonusCompetenza(scheda.livello) : 0),
  });
});

document.getElementById("valore-iniziativa").closest(".scheda-box").addEventListener("click", () => {
  const bonus = modCaratteristica("destrezza");
  tiroDallaScheda({ etichetta: "Iniziativa", modificatore: bonus }, async (tiro) => {
    if (!scheda.attiva || !scheda.campagnaId) return null;
    const scritta = await iniziativaNelTracker(scheda.campagnaId, uidCorrente, tiro.totale, bonus);
    return scritta ? "Iniziativa scritta nel tracker del combattimento." : null;
  });
});

// Danni: dado dell'arma + Forza (Destrezza per le armi a distanza, la
// migliore delle due con Finezza).
function modDannoArma(dati) {
  const forza = modCaratteristica("forza");
  const destrezza = modCaratteristica("destrezza");
  if (dati.tipo === "a distanza") return destrezza;
  if ((dati.proprieta || []).includes("Finezza")) return Math.max(forza, destrezza);
  return forza;
}

document.getElementById("corpo-attacchi").addEventListener("click", (evento) => {
  const colpire = evento.target.closest("[data-tiro-colpire]");
  const danno = evento.target.closest("[data-tiro-danno]");
  const chiave = colpire?.dataset.tiroColpire || danno?.dataset.tiroDanno;
  if (!chiave) return;
  const voce = (scheda.inventario || []).find((v) => v.chiave === chiave);
  const dati = ARMI[chiave];
  if (!voce) return;
  if (colpire) {
    tiroDallaScheda({ etichetta: `${voce.nome}: per colpire`, modificatore: bonusAttaccoArma(voce) });
    return;
  }
  const formula = dati && leggiFormula(dati.danno);
  if (!formula) return;
  tiroDallaScheda({
    etichetta: `${voce.nome}: danni${dati.tipoDanno ? ` (${dati.tipoDanno})` : ""}`,
    quanti: formula.quanti,
    facce: formula.facce,
    modificatore: formula.modificatore + modDannoArma(dati),
    tipo: "danno",
  });
});

document.getElementById("corpo-attacchi").addEventListener("click", async (evento) => {
  const riporta = evento.target.closest("[data-bonus-auto]");
  if (!riporta || soloLettura) return;
  const voce = (scheda.inventario || []).find((v) => v.chiave === riporta.dataset.bonusAuto);
  if (!voce) return;
  voce.bonusAttacco = null;
  renderAttacchi();
  await salvaInventario();
});

// Incantesimi: tiro per colpire, danni o cure dalla lista.
function moltiplicatoreTrucchetto(livello) {
  return 1 + (livello >= 5) + (livello >= 11) + (livello >= 17);
}

document.getElementById("sezione-incantesimi").addEventListener("click", (evento) => {
  const bottone = evento.target.closest("[data-tiro-incantesimo]");
  if (!bottone) return;
  const chiave = bottone.dataset.tiroIncantesimo;
  const dati = ottieniIncantesimo(chiave);
  const tiri = TIRI_INCANTESIMI[chiave];
  if (!dati || !tiri) return;
  const tipo = bottone.dataset.tipoTiro;
  if (tipo === "colpire") {
    tiroDallaScheda({ etichetta: `${dati.nome}: per colpire`, modificatore: bonusAttaccoIncantesimi() });
    return;
  }
  const formula = leggiFormula(tipo === "cura" ? tiri.cura : tiri.danno);
  if (!formula) return;
  const quanti = dati.livello === 0 && !tiri.perRaggio ? formula.quanti * moltiplicatoreTrucchetto(scheda.livello || 1) : formula.quanti;
  const dettaglio = tipo === "cura" ? "cura" : `danni${tiri.tipo ? ` (${tiri.tipo})` : ""}${tiri.perRaggio ? ", per raggio" : ""}`;
  tiroDallaScheda({
    etichetta: `${dati.nome}: ${dettaglio}`,
    quanti,
    facce: formula.facce,
    modificatore: formula.modificatore + (tiri.piuMod ? modIncantatore() : 0),
    tipo: tipo === "cura" ? "libero" : "danno",
  });
});

// Personalità e competenze/linguaggi: testo libero, salvato al cambio.
const CAMPI_PERSONALITA = {
  "personalita-tratti": "tratti",
  "personalita-ideali": "ideali",
  "personalita-legami": "legami",
  "personalita-difetti": "difetti",
};
Object.keys(CAMPI_PERSONALITA).forEach((id) => {
  document.getElementById(id).addEventListener("change", async (evento) => {
    if (soloLettura) return;
    scheda.personalita = scheda.personalita || {};
    scheda.personalita[CAMPI_PERSONALITA[id]] = evento.target.value;
    try {
      await aggiornaScheda(scheda.id, { personalita: scheda.personalita });
    } catch (errore) {
      console.error(errore);
    }
  });
});

document.getElementById("competenze-linguaggi").addEventListener("change", async (evento) => {
  if (soloLettura) return;
  scheda.competenzeLinguaggi = evento.target.value;
  try {
    await aggiornaScheda(scheda.id, { competenzeLinguaggi: scheda.competenzeLinguaggi });
  } catch (errore) {
    console.error(errore);
  }
});

// Caratteristiche e talenti: elenco libero di voci aggiunte una alla volta.
async function salvaTalenti() {
  try {
    await aggiornaScheda(scheda.id, { talenti: scheda.talenti || [] });
  } catch (errore) {
    console.error(errore);
  }
}

document.getElementById("btn-aggiungi-talento").addEventListener("click", async () => {
  if (soloLettura) return;
  const input = document.getElementById("input-talento");
  const testo = input.value.trim();
  if (!testo) return;
  scheda.talenti = [...(scheda.talenti || []), testo];
  input.value = "";
  renderTalenti();
  await salvaTalenti();
});

document.getElementById("lista-talenti").addEventListener("click", async (evento) => {
  if (soloLettura) return;
  const bottone = evento.target.closest(".btn-rimuovi-talento");
  if (!bottone) return;
  const indice = Number(bottone.dataset.indice);
  scheda.talenti = (scheda.talenti || []).filter((_, i) => i !== indice);
  renderTalenti();
  await salvaTalenti();
});

// Monete: salvate al cambio di ciascun campo.
["rame", "argento", "oro", "elettro", "platino"].forEach((chiave) => {
  document.getElementById(`moneta-${chiave}`).addEventListener("change", async (evento) => {
    if (soloLettura) return;
    scheda.monete[chiave] = Math.max(0, Number(evento.target.value) || 0);
    try {
      await aggiornaScheda(scheda.id, { monete: scheda.monete });
    } catch (errore) {
      console.error(errore);
    }
  });
});
