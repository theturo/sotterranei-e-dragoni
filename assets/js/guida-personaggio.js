// Guida alla creazione del personaggio, nella scheda (scheda-personaggio.js):
// un pannello con i passi da completare (background, abilità, privilegi,
// equipaggiamento, incantesimi, passaggi di livello fino a quello di
// partenza della campagna, sottoclasse…). Toccando un passo la pagina scorre
// alla sezione, la evidenzia e un fumetto spiega cosa fare, su misura per
// classe e razza. I passi si spuntano da soli guardando la scheda.
// Dati e regole: guida-personaggio-dati.js. Stato del pannello (chiuso,
// passo aperto) nel localStorage di questo browser.
import { esc } from "./utils.js";
import { icona } from "./icone.js";
import {
  passiGuida,
  ABILITA_CLASSE,
  ABILITA_RAZZA,
  ABILITA_BACKGROUND,
  abilitaAttese,
  nomeAbilita,
  COMPETENZE_CLASSE,
  COMPETENZE_RAZZA,
  LINGUAGGI_RAZZA,
  EQUIPAGGIAMENTO_INIZIALE,
  SOTTOCLASSI,
  sottoclasseScelta,
  trattiLivello1Mancanti,
  incantesimiAttesi,
  incantesimiPresenti,
  nomeClasse,
  nomeRazza,
  trattiAlLivello,
} from "./guida-personaggio-dati.js";

const BERSAGLI = {
  background: () => document.getElementById("input-background")?.parentElement,
  abilita: () => document.getElementById("lista-abilita")?.closest(".scheda-box"),
  allineamento: () => document.getElementById("btn-allineamento")?.parentElement,
  tratti: () => document.getElementById("lista-talenti")?.closest(".scheda-box"),
  sottoclasse: () => document.getElementById("lista-talenti")?.closest(".scheda-box"),
  equipaggiamento: () => document.getElementById("ricerca-equip-wrap")?.closest(".scheda-box"),
  competenze: () => document.getElementById("competenze-linguaggi")?.closest(".scheda-box"),
  personalita: () => document.getElementById("personalita-tratti")?.closest(".scheda-box"),
  livello: () => document.getElementById("scheda-classe-livello")?.closest("div"),
  incantesimi: () => document.getElementById("sezione-incantesimi"),
  ritratto: () => document.querySelector(".ritratto-scheda"),
};

const elenco = (voci) => `<ul class="guida-elenco">${voci.map((v) => `<li>${v}</li>`).join("")}</ul>`;

// ---------- Testi dei passi ----------

function testoPasso(passo, scheda, contesto) {
  const classe = scheda.classe;
  const nome = esc(nomeClasse(classe));
  const livello = scheda.livello || 1;
  switch (passo.id.startsWith("livello-") ? "livello" : passo.id) {
    case "background":
      return `<p>Il background racconta chi era il personaggio prima dell'avventura. Dà <b>${ABILITA_BACKGROUND} abilità</b>, qualche competenza o linguaggio e un po' di equipaggiamento.</p>
        <p>Nel materiale gratuito (SRD) c'è l'<b>Accolito</b>: Intuizione e Religione, due linguaggi a scelta. Se il DM lo permette puoi prenderne uno dal Manuale del Giocatore (Criminale, Eroe Popolare, Sapiente, Soldato…).</p>
        <p>Scrivi il nome qui sopra.</p>`;
    case "abilita": {
      const info = ABILITA_CLASSE[classe];
      const competenti = new Set(scheda.abilitaCompetenti || []);
      const voci = info?.scelta
        ? `tra ${info.scelta.map((a) => (competenti.has(a) ? `<b>${esc(nomeAbilita(a))} ${icona("fatto", "icona-spunta")}</b>` : esc(nomeAbilita(a)))).join(", ")}`
        : "tra tutte";
      const razza = ABILITA_RAZZA[scheda.razza];
      const testoRazza = razza
        ? razza.fisse.length
          ? `<li>dalla razza (${esc(nomeRazza(scheda.razza))}): ${razza.fisse.map((a) => esc(nomeAbilita(a))).join(", ")};</li>`
          : `<li>dalla razza (${esc(nomeRazza(scheda.razza))}): ${razza.libere} a scelta;</li>`
        : "";
      return `<p>Tocca il pallino accanto a un'abilità per segnare la competenza (bonus +${2 + Math.floor((livello - 1) / 4)}).</p>
        <ul class="guida-elenco">
          <li>dalla classe (${nome}): <b>${info?.numero ?? 0}</b> ${voci};</li>
          <li>dal background: <b>${ABILITA_BACKGROUND}</b>;</li>
          ${testoRazza}
        </ul>
        <p class="guida-conteggio">Segnate: <b>${competenti.size}</b> su ${abilitaAttese(scheda)}.</p>`;
    }
    case "allineamento":
      return `<p>Tocca il pulsante dell'allineamento e scegli sulla ruota: descrive la bussola morale del personaggio. Se hai dubbi, parlane con il DM.</p>`;
    case "tratti": {
      const mancanti = trattiLivello1Mancanti(scheda);
      return `<p>I privilegi di 1° livello del ${nome} vanno tra <b>Caratteristiche e talenti</b>. Quelli dei livelli successivi li aggiunge da solo il passaggio di livello.</p>
        ${mancanti.length ? `${elenco(mancanti.map(esc))}<button type="button" class="btn-tabella btn-tabella-evidenza" data-azione-guida="tratti">Aggiungi ai talenti</button>` : "<p>Ci sono tutti. ✓</p>"}`;
    }
    case "sottoclasse": {
      const info = SOTTOCLASSI[classe];
      const scelta = sottoclasseScelta(scheda);
      if (livello < info.livello) {
        return `<p>Il ${nome} sceglie il <b>${esc(info.etichetta)}</b> al livello ${info.livello}: prima passa a quel livello.</p>`;
      }
      return `<p>La sottoclasse del ${nome} è il <b>${esc(info.etichetta)}</b>: dà privilegi propri a vari livelli.</p>
        <p>Nel materiale gratuito c'è <b>${esc(info.srd)}</b>; con il permesso del DM puoi sceglierne un'altra dal Manuale del Giocatore.</p>
        <div class="guida-sottoclasse">
          <label for="guida-input-sottoclasse">${esc(info.etichetta)}</label>
          <input type="text" id="guida-input-sottoclasse" maxlength="60" list="guida-sottoclassi" value="${esc(scelta || "")}" placeholder="${esc(info.srd)}" autocomplete="off" />
          <datalist id="guida-sottoclassi"><option value="${esc(info.srd)}"></option></datalist>
          <button type="button" class="btn-tabella btn-tabella-evidenza" data-azione-guida="sottoclasse">${scelta ? "Cambia" : "Imposta"}</button>
        </div>`;
    }
    case "equipaggiamento":
      return `<p>Equipaggiamento iniziale del ${nome} (per ogni riga scegli un'opzione):</p>
        ${elenco((EQUIPAGGIAMENTO_INIZIALE[classe] || []).map(esc))}
        <p>Aggiungi anche quello del background. Cerca gli oggetti nel catalogo qui sotto, poi scegli l'armatura indossata e lo scudo: Classe Armatura e attacchi si calcolano da soli.</p>`;
    case "competenze": {
      const sottorazza = COMPETENZE_RAZZA[`${scheda.razza}/${scheda.sottorazza}`] || COMPETENZE_RAZZA[scheda.razza];
      const testo = testoCompetenze(scheda);
      return `<ul class="guida-elenco">
          <li>dalla classe: ${esc(COMPETENZE_CLASSE[classe] || "—")}</li>
          ${sottorazza ? `<li>dalla razza: ${esc(sottorazza)}</li>` : ""}
          <li>linguaggi: ${esc(LINGUAGGI_RAZZA[scheda.razza] || "Comune.")}</li>
          <li>più competenze e linguaggi del background.</li>
        </ul>
        ${(scheda.competenzeLinguaggi || "").trim() ? "" : `<button type="button" class="btn-tabella btn-tabella-evidenza" data-azione-guida="competenze" data-testo="${esc(testo)}">Scrivile nel riquadro</button>`}`;
    }
    case "personalita":
      return `<p>Quattro righe per dare voce al personaggio: <b>tratti</b> (come si comporta), <b>ideali</b> (in cosa crede), <b>legami</b> (persone, luoghi o promesse a cui tiene) e <b>difetti</b> (le sue debolezze). Il background suggerisce spunti; bastano poche parole.</p>`;
    case "livello": {
      const l = passo.livello;
      const nuovi = trattiAlLivello(classe, l);
      if (livello >= l) return `<p>Fatto: il personaggio è di livello ${livello}. ${icona("fatto", "icona-spunta")}</p>`;
      if (livello < l - 1) return `<p>Prima completa il passaggio al livello ${l - 1}.</p>`;
      const dettagli = `<p>Al livello ${l} sceglierai i Punti Ferita (media o tiro del dado vita)${nuovi.length ? `; nuovi privilegi: <b>${nuovi.map(esc).join(", ")}</b>` : ""}.</p>`;
      return contesto.crediti > 0
        ? `${dettagli}<p>Tocca la freccia accanto a classe e livello e segui la procedura.</p>
           <button type="button" class="btn-tabella btn-tabella-evidenza" data-azione-guida="livello">Passa al livello ${l}</button>`
        : `${dettagli}<p>Il DM non ti ha ancora concesso questo livello: quando lo farà riceverai un avviso e qui comparirà il pulsante.</p>`;
    }
    case "incantesimi": {
      const attesi = incantesimiAttesi(scheda);
      if (!attesi) return `<p>Il ${nome} lancia incantesimi dal 2° livello: completa prima il passaggio di livello.</p>`;
      const presenti = incantesimiPresenti(scheda);
      const righe = [];
      if (attesi.trucchetti) righe.push(`trucchetti: <b>${presenti.trucchetti} / ${attesi.trucchetti}</b>`);
      if (attesi.conosciuti) righe.push(`incantesimi conosciuti: <b>${presenti.conosciuti} / ${attesi.conosciuti}</b>`);
      if (attesi.libro) righe.push(`incantesimi nel libro: <b>${presenti.conosciuti} / ${attesi.libro}</b> (6 al 1° livello, 2 in più a ogni livello)`);
      if (attesi.preparati) righe.push(`preparati oggi: <b>${presenti.preparati} / ${attesi.preparati}</b>`);
      const spiegazione = {
        fisso: "Scegli i trucchetti e gli incantesimi che conosci: sono sempre pronti, li cambi solo salendo di livello.",
        libro: "Scegli i trucchetti e gli incantesimi da scrivere nel libro; ogni giorno ne prepari alcuni da lanciare.",
        preparazione: "Conosci tutta la lista della classe: scegli i trucchetti e, ogni giorno, gli incantesimi da preparare.",
      }[attesi.modo];
      return `<p>${spiegazione}</p>${elenco(righe)}<p>Usa le ricerche nella sezione: ti propongono solo quelli del tuo livello.</p>`;
    }
    case "ritratto":
      return `<p>Facoltativo: carica un'immagine del personaggio. Comparirà anche nel party e nel tracker di combattimento.</p>`;
    default:
      return "";
  }
}

function testoCompetenze(scheda) {
  const sottorazza = COMPETENZE_RAZZA[`${scheda.razza}/${scheda.sottorazza}`] || COMPETENZE_RAZZA[scheda.razza];
  return [
    COMPETENZE_CLASSE[scheda.classe],
    sottorazza,
    `Linguaggi: ${LINGUAGGI_RAZZA[scheda.razza] || "Comune."}`,
  ].filter(Boolean).join("\n");
}

// ---------- Pannello ----------

const chiaveLocale = (id) => `sed-guida-${id}`;
function leggiStato(id) {
  try {
    return JSON.parse(localStorage.getItem(chiaveLocale(id)) || "{}");
  } catch {
    return {};
  }
}
function scriviStato(id, stato) {
  try {
    localStorage.setItem(chiaveLocale(id), JSON.stringify(stato));
  } catch {
    // Non salvato: alla prossima apertura riparte dallo stato predefinito.
  }
}

// opzioni: { scheda: () => scheda, crediti: () => n, livelloObiettivo: () => n,
// azioni: { aggiungiTalenti(lista), impostaSottoclasse(nome), compilaCompetenze(testo), apriLivello() },
// apri: true per aprirla subito sul primo passo da fare (scheda appena creata),
// apriSeIncompleta: true per aprirla se ci sono passi da fare e non è stata
// chiusa in questo browser, pulsante: elemento che la riapre }
export function montaGuida({ scheda, crediti, livelloObiettivo, azioni, apri = false, apriSeIncompleta = false, pulsante }) {
  const id = scheda().id;
  let stato = leggiStato(id);
  let passoAperto = null;

  const pannello = document.createElement("aside");
  pannello.className = "guida-pannello";
  pannello.setAttribute("aria-label", "Guida al personaggio");
  pannello.hidden = true;
  pannello.innerHTML = `
    <div class="guida-testata">
      <button type="button" class="guida-titolo" aria-expanded="true">
        <span>Guida al personaggio</span> <span class="guida-avanzamento"></span>
      </button>
      <button type="button" class="guida-chiudi" aria-label="Chiudi la guida">×</button>
    </div>
    <div class="guida-corpo">
      <p class="guida-obiettivo"></p>
      <ol class="guida-passi"></ol>
      <p class="guida-completa" hidden>Il personaggio è pronto per la prima sessione!</p>
    </div>`;
  const fumetto = document.createElement("div");
  fumetto.className = "guida-fumetto";
  fumetto.setAttribute("role", "dialog");
  fumetto.hidden = true;
  document.body.append(pannello, fumetto);

  const passi = () => passiGuida(scheda(), { livelloObiettivo: livelloObiettivo() });

  function disegnaPannello() {
    const elenco = passi();
    const obbligatori = elenco.filter((p) => !p.facoltativo);
    const fatti = obbligatori.filter((p) => p.fatto).length;
    pannello.querySelector(".guida-avanzamento").textContent = `${fatti}/${obbligatori.length}`;
    const obiettivo = livelloObiettivo();
    pannello.querySelector(".guida-obiettivo").textContent = obiettivo > 1
      ? `La campagna parte dal livello ${obiettivo}: completa i passi nell'ordine.`
      : "Completa i passi nell'ordine: si spuntano da soli.";
    const primoDaFare = elenco.find((p) => !p.fatto && !p.facoltativo);
    pannello.querySelector(".guida-passi").innerHTML = elenco.map((p) => `
      <li><button type="button" data-passo="${p.id}" class="${p.fatto ? "fatto" : ""} ${p.id === passoAperto ? "aperto" : ""} ${p === primoDaFare ? "prossimo" : ""}">
        <span class="guida-segno" aria-hidden="true">${icona(p.fatto ? "fatto" : p === primoDaFare ? "prossimo" : "da-fare")}</span>
        <span>${esc(p.titolo)}${p.facoltativo ? " <i>(facoltativo)</i>" : ""}</span>
        <span class="sr-only">${p.fatto ? "completato" : "da fare"}</span>
      </button></li>`).join("");
    pannello.querySelector(".guida-completa").hidden = fatti < obbligatori.length;
  }

  function bersaglio(idPasso) {
    return BERSAGLI[idPasso.startsWith("livello-") ? "livello" : idPasso]?.();
  }

  function posizionaFumetto() {
    if (fumetto.hidden || !passoAperto) return;
    const elemento = bersaglio(passoAperto);
    if (!elemento) return;
    const r = elemento.getBoundingClientRect();
    // Il fumetto non copre il pannello: sta alla sua sinistra; se non c'è
    // spazio il pannello si riduce alla sola testata.
    let limite = document.documentElement.clientWidth - 12;
    if (!pannello.hidden && !pannello.classList.contains("ridotto")) {
      if (spazioAccanto()) limite = pannello.getBoundingClientRect().left - 12;
      else riduci(true);
    }
    const larghezza = Math.min(360, limite - 12);
    fumetto.style.width = `${larghezza}px`;
    const sinistra = Math.max(12, Math.min(r.left, limite - larghezza)) + window.scrollX;
    fumetto.style.left = `${sinistra}px`;
    fumetto.style.top = `${r.bottom + window.scrollY + 12}px`;
    fumetto.style.setProperty("--freccia", `${Math.max(16, Math.min(larghezza - 24, r.left + window.scrollX + Math.min(40, r.width / 2) - sinistra))}px`);
  }

  // C'è posto per il fumetto accanto al pannello aperto (solo su schermi larghi).
  function spazioAccanto() {
    return !window.matchMedia("(max-width: 639px)").matches && pannello.getBoundingClientRect().left - 12 >= 272;
  }

  function evidenzia(elemento) {
    document.querySelectorAll(".guida-evidenziata").forEach((e) => e.classList.remove("guida-evidenziata"));
    elemento?.classList.add("guida-evidenziata");
  }

  function disegnaFumetto() {
    const passo = passi().find((p) => p.id === passoAperto);
    if (!passo) {
      chiudiFumetto();
      return;
    }
    const elenco = passi();
    const indice = elenco.indexOf(passo);
    fumetto.innerHTML = `
      <div class="guida-fumetto-testata">
        <h3>${esc(passo.titolo)}${passo.fatto ? ` <span class="guida-fatto">${icona("fatto")}</span>` : ""}</h3>
        <button type="button" class="guida-chiudi" data-fumetto="chiudi" aria-label="Chiudi">×</button>
      </div>
      <div class="guida-fumetto-testo">${testoPasso(passo, scheda(), { crediti: crediti() })}</div>
      <div class="guida-fumetto-azioni">
        ${indice > 0 ? '<button type="button" class="btn-tabella" data-fumetto="indietro">Indietro</button>' : "<span></span>"}
        ${indice < elenco.length - 1 ? '<button type="button" class="btn-tabella" data-fumetto="avanti">Avanti</button>' : ""}
      </div>`;
    fumetto.setAttribute("aria-label", passo.titolo);
  }

  function apriPasso(idPasso, { scorri = true } = {}) {
    passoAperto = idPasso;
    stato = { ...stato, passo: idPasso };
    scriviStato(id, stato);
    const elemento = bersaglio(idPasso);
    evidenzia(elemento);
    fumetto.hidden = false;
    disegnaFumetto();
    disegnaPannello();
    // Sul telefono il pannello si riduce alla sola testata: resta visibile la sezione.
    if (window.matchMedia("(max-width: 639px)").matches) riduci(true);
    if (scorri && elemento) {
      const riduciMoto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      elemento.scrollIntoView({ behavior: riduciMoto ? "auto" : "smooth", block: "start" });
    }
    requestAnimationFrame(posizionaFumetto);
  }

  function chiudiFumetto() {
    passoAperto = null;
    fumetto.hidden = true;
    evidenzia(null);
    disegnaPannello();
  }

  function riduci(ridotto) {
    pannello.classList.toggle("ridotto", ridotto);
    pannello.querySelector(".guida-titolo").setAttribute("aria-expanded", String(!ridotto));
  }

  function mostra() {
    stato = { ...stato, chiusa: false };
    scriviStato(id, stato);
    pannello.hidden = false;
    riduci(false);
    disegnaPannello();
    if (pulsante) pulsante.hidden = true;
  }

  function nascondi() {
    stato = { ...stato, chiusa: true };
    scriviStato(id, stato);
    pannello.hidden = true;
    chiudiFumetto();
    if (pulsante) pulsante.hidden = false;
  }

  pannello.addEventListener("click", (evento) => {
    const bottonePasso = evento.target.closest("[data-passo]");
    if (bottonePasso) {
      apriPasso(bottonePasso.dataset.passo);
      return;
    }
    if (evento.target.closest(".guida-chiudi")) nascondi();
    else if (evento.target.closest(".guida-titolo")) {
      const espandi = pannello.classList.contains("ridotto");
      riduci(!espandi);
      // Riaprendo l'elenco dove non c'è posto per entrambi, il fumetto si chiude.
      if (espandi && !fumetto.hidden && !spazioAccanto()) chiudiFumetto();
    }
  });

  fumetto.addEventListener("click", async (evento) => {
    const comando = evento.target.closest("[data-fumetto]")?.dataset.fumetto;
    if (comando === "chiudi") {
      chiudiFumetto();
      return;
    }
    if (comando === "avanti" || comando === "indietro") {
      const elenco = passi();
      const indice = elenco.findIndex((p) => p.id === passoAperto);
      const prossimo = elenco[indice + (comando === "avanti" ? 1 : -1)];
      if (prossimo) apriPasso(prossimo.id);
      return;
    }
    const bottone = evento.target.closest("[data-azione-guida]");
    if (!bottone) return;
    bottone.disabled = true;
    try {
      const azione = bottone.dataset.azioneGuida;
      if (azione === "tratti") await azioni.aggiungiTalenti(trattiLivello1Mancanti(scheda()));
      if (azione === "competenze") await azioni.compilaCompetenze(bottone.dataset.testo);
      if (azione === "livello") azioni.apriLivello();
      if (azione === "sottoclasse") {
        const nome = fumetto.querySelector("#guida-input-sottoclasse").value.trim();
        if (!nome) {
          bottone.disabled = false;
          fumetto.querySelector("#guida-input-sottoclasse").focus();
          return;
        }
        await azioni.impostaSottoclasse(nome);
      }
    } catch (errore) {
      console.error(errore);
    }
    aggiorna({ forza: true });
  });

  // I passi si spuntano guardando la scheda: si ricontrolla dopo ogni
  // interazione con la pagina (i salvataggi aggiornano subito i dati locali).
  let attesa = null;
  function aggiorna({ forza = false } = {}) {
    if (pannello.hidden) return;
    disegnaPannello();
    // Il fumetto si ridisegna solo se non si sta scrivendo dentro.
    if (!fumetto.hidden && (forza || !fumetto.contains(document.activeElement))) disegnaFumetto();
    posizionaFumetto();
  }
  const pianifica = (evento) => {
    if (evento && fumetto.contains(evento.target) && evento.type !== "click") return;
    clearTimeout(attesa);
    attesa = setTimeout(aggiorna, 250);
  };
  ["click", "change", "input"].forEach((tipo) => document.addEventListener(tipo, pianifica));
  window.addEventListener("resize", posizionaFumetto);

  pulsante?.addEventListener("click", () => {
    mostra();
    const primo = passi().find((p) => !p.fatto && !p.facoltativo);
    if (primo) apriPasso(primo.id);
  });

  const daFare = passi().some((p) => !p.fatto && !p.facoltativo);
  if (apri || (daFare && (stato.chiusa === false || (apriSeIncompleta && stato.chiusa !== true)))) {
    mostra();
    if (apri) {
      const primo = passi().find((p) => !p.fatto && !p.facoltativo);
      if (primo) apriPasso(primo.id, { scorri: false });
    }
  } else if (pulsante) {
    pulsante.hidden = false;
  }

  return { aggiorna, mostra };
}
