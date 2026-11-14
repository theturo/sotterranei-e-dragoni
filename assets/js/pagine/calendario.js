// Script della pagina calendario.html (ridisegnata, D-033): in cima la
// prossima sessione in evidenza (il giorno stesso il DM la apre da qui), poi
// il mese in un pannello blu e, in pergamena, le date da scegliere (con le
// disponibilità sì/forse/no) e le altre sessioni con il file .ics. Sul
// telefono il mese diventa compatto: pallini e il dettaglio del giorno
// toccato. Il DM propone o fissa le date dalla finestra «Organizza una
// sessione».
import { proteggiPagina, ROLES } from "../auth.js";
import { ottieniCampagnaCorrente } from "../dati/campagne.js";
import { elencaRiepiloghiParty } from "../dati/party.js";
import {
  elencaSessioniCampagna,
  ottieniStatoSessione,
  apriSessione,
  eliminaSessioneProgrammata,
} from "../dati/sessioni.js";
import {
  ascoltaProposte,
  ascoltaRisposte,
  rispondiProposta,
  creaProposta,
  confermaProposta,
  annullaProposta,
  fissaSessione,
} from "../dati/calendario.js";
import { montaGuscio } from "../guscio.js";
import { creaElemento } from "../contenuti.js";
import { ICONA_SI, ICONA_FORSE, ICONA_NO } from "../icone.js";
import {
  isoGiorno,
  oggiIso,
  dataLocale,
  formattaDataOra,
  distanzaGiorni,
  etichettaSessione,
  scaricaIcs,
} from "../calendario.js";
import { mostraToast } from "../utils.js";

const veil = document.getElementById("veil");
const contenuto = document.getElementById("contenuto");

let campagna = null;
let uidCorrente = null;
let nomeCorrente = null;
let isDM = false;
let sessioni = [];
let proposte = [];
let party = [];
let statoSessione = { inCorso: false };
const risposte = new Map(); // propostaId → [{ uid, nome, risposte }]
const ascoltiRisposte = new Map();
let meseMostrato = new Date();
meseMostrato.setDate(1);
let giornoScelto = null; // giorno toccato nel mese compatto (telefono)

const NOMI_RISPOSTA = { si: "Sì", forse: "Forse", no: "No" };

const avviso = (testo, errore = false) => mostraToast(testo, errore, 3600);

function bottone(testo, classe = "btn-tabella") {
  const b = creaElemento("button", classe, testo);
  b.type = "button";
  return b;
}

// "errore" va in un avviso; con mostraErrore (la finestra del DM, che sta
// sopra agli avvisi) lo si mostra lì.
async function esegui(elementi, azione, errore, mostraErrore = null) {
  elementi.forEach((e) => (e.disabled = true));
  try {
    await azione();
  } catch (e) {
    console.error(e);
    if (mostraErrore) mostraErrore(errore);
    else avviso(errore, true);
  } finally {
    elementi.forEach((e) => (e.disabled = false));
  }
}

async function ricaricaSessioni() {
  [sessioni, statoSessione] = await Promise.all([
    elencaSessioniCampagna(campagna.id),
    ottieniStatoSessione(campagna.id).catch(() => ({ inCorso: false })),
  ]);
  renderTutto();
}

const programmate = () => sessioni
  .filter((s) => s.stato === "programmata" && s.dataProgrammata)
  .sort((a, b) => `${a.dataProgrammata} ${a.oraProgrammata || ""}`.localeCompare(`${b.dataProgrammata} ${b.oraProgrammata || ""}`));
const prossimeProgrammate = () => programmate().filter((s) => s.dataProgrammata >= oggiIso());
// La sessione del pannello in cima: la prima in programma da oggi in poi
// (se non ce n'è una in corso, che ha la precedenza).
const sessioneInEvidenza = () => (statoSessione.inCorso ? null : prossimeProgrammate()[0] || null);
const proposteAperte = () => proposte.filter((p) => p.stato === "aperta")
  .sort((a, b) => (a.creataIl?.toMillis?.() ?? Infinity) - (b.creataIl?.toMillis?.() ?? Infinity));

function renderTutto() {
  renderHero();
  renderMese();
  renderProssime();
  renderProposte();
}

// "lunedì 16 novembre, 21:00"
function dataEstesa(iso, ora = null) {
  const testo = dataLocale(iso).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  return ora ? `${testo}, ${ora}` : testo;
}

// ---------- Prossima sessione (in evidenza) ----------
function renderHero() {
  const hero = document.getElementById("hero-prossima");
  const etichetta = document.getElementById("hero-etichetta");
  const titolo = document.getElementById("hero-titolo");
  const quando = document.getElementById("hero-quando");
  const note = document.getElementById("hero-note");
  const azioni = document.getElementById("hero-azioni");
  azioni.replaceChildren();
  note.hidden = true;
  hero.classList.remove("in-corso", "senza-data", "oggi");

  if (statoSessione.inCorso) {
    const attiva = sessioni.find((s) => s.id === statoSessione.sessioneAttivaId);
    hero.classList.add("in-corso");
    etichetta.textContent = "In corso";
    titolo.textContent = attiva ? etichettaSessione(attiva) : "Sessione in corso";
    quando.textContent = "Il tavolo è aperto: raggiungi gli altri.";
    const vai = creaElemento("a", "rd-btn rd-btn-primario rd-btn-piccolo", "Vai alla sessione");
    vai.href = "sessione.html";
    azioni.append(vai);
    return;
  }

  const sessione = sessioneInEvidenza();
  if (!sessione) {
    hero.classList.add("senza-data");
    const ciSonoProposte = proposteAperte().length > 0;
    etichetta.textContent = "Prossima sessione";
    titolo.textContent = "Nessuna data in programma";
    quando.textContent = isDM
      ? (ciSonoProposte ? "Le date proposte aspettano le risposte dei giocatori." : "Proponi qualche data ai giocatori o fissane una.")
      : (ciSonoProposte ? "Il DM ha proposto delle date: rispondi qui sotto." : "Il DM non ha ancora fissato la prossima sessione.");
    return;
  }

  const oggi = sessione.dataProgrammata === oggiIso();
  hero.classList.toggle("oggi", oggi);
  etichetta.textContent = oggi
    ? `Oggi${sessione.oraProgrammata ? ` alle ${sessione.oraProgrammata}` : ""}`
    : `Prossima sessione · ${distanzaGiorni(sessione.dataProgrammata)}`;
  titolo.textContent = etichettaSessione(sessione);
  quando.textContent = dataEstesa(sessione.dataProgrammata, sessione.oraProgrammata);
  if (sessione.note) {
    note.textContent = sessione.note;
    note.hidden = false;
  }
  if (oggi && isDM) {
    const apri = bottone("Apri la sessione", "rd-btn rd-btn-primario rd-btn-piccolo");
    apri.id = "btn-apri-sessione-oggi";
    apri.addEventListener("click", () => esegui([apri], async () => {
      await apriSessione(campagna.id);
      window.location.href = "sessione.html";
    }, "Impossibile aprire la sessione."));
    azioni.append(apri);
  }
  const ics = bottone("Aggiungi al mio calendario", "rd-btn rd-btn-secondario rd-btn-piccolo");
  ics.title = "Scarica il file .ics per Google Calendar, Apple Calendario…";
  ics.addEventListener("click", () => scaricaIcs(sessione, campagna.titolo || "Sotterranei & Dragoni"));
  azioni.append(ics);
}

// ---------- Vista mensile ----------
// Per ogni evento: il testo breve della cella, il suggerimento (title) e, per
// il dettaglio del giorno sul telefono, una riga e una nota.
function eventiDelGiorno(iso) {
  const eventi = [];
  sessioni.forEach((s) => {
    const numero = `Sessione ${s.numero ?? "?"}`;
    if (s.stato === "programmata" && s.dataProgrammata === iso) {
      eventi.push({
        classe: "evento-programmata",
        testo: `S${s.numero ?? "?"}${s.oraProgrammata ? ` ${s.oraProgrammata}` : ""}`,
        titolo: etichettaSessione(s),
        riga: `${numero}${s.oraProgrammata ? ` · ${s.oraProgrammata}` : ""}`,
        nota: s.titolo || "",
      });
    } else if (s.stato !== "programmata" && s.apertaIl?.toDate && isoGiorno(s.apertaIl.toDate()) === iso) {
      const stato = s.stato === "in-corso" ? "in corso" : "giocata";
      eventi.push({ classe: "evento-giocata", testo: `S${s.numero ?? "?"}`, titolo: `${etichettaSessione(s)} (${stato})`, riga: `${numero} · ${stato}`, nota: s.titolo || "" });
    }
  });
  proposteAperte().forEach((p) => p.opzioni.filter((o) => o.data === iso).forEach((o) => {
    const si = (risposte.get(p.id) || []).filter((r) => r.risposte?.[o.id] === "si").length;
    eventi.push({
      classe: "evento-proposta",
      testo: `? ${o.ora || ""}`.trim(),
      titolo: `Data proposta${p.titolo ? ` (${p.titolo})` : ""}: ${si} sì`,
      riga: `Data proposta${o.ora ? ` · ${o.ora}` : ""}`,
      nota: `${si} sì${p.titolo ? ` · ${p.titolo}` : ""}`,
    });
  }));
  return eventi;
}

// Il giorno acceso nel mese compatto: quello toccato, altrimenti la prossima
// sessione, oggi o il primo giorno con qualcosa (nel mese mostrato).
function giornoPredefinito(giorni) {
  const nelMese = (iso) => iso && giorni.some((g) => g.iso === iso);
  if (nelMese(giornoScelto)) return giornoScelto;
  const candidati = [sessioneInEvidenza()?.dataProgrammata, oggiIso(), giorni.find((g) => g.eventi.length)?.iso];
  return candidati.find(nelMese) || giorni[0].iso;
}

function renderGiornoScelto(iso, eventi) {
  const box = document.getElementById("giorno-scelto");
  const righe = eventi.map((e) => {
    const riga = creaElemento("div", "giorno-scelto-evento");
    riga.append(creaElemento("span", `evento-cal ${e.classe}`, e.riga));
    if (e.nota) riga.append(creaElemento("small", null, e.nota));
    return riga;
  });
  if (!righe.length) righe.push(creaElemento("small", "giorno-scelto-vuoto", "Niente in programma."));
  box.replaceChildren(creaElemento("b", null, dataEstesa(iso)), ...righe);
}

function renderMese() {
  const griglia = document.getElementById("griglia-calendario");
  document.getElementById("titolo-mese").textContent =
    meseMostrato.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const celle = [["Lun", "L"], ["Mar", "M"], ["Mer", "M"], ["Gio", "G"], ["Ven", "V"], ["Sab", "S"], ["Dom", "D"]].map(([nome, iniziale]) => {
    const intestazione = creaElemento("div", "giorno-settimana");
    intestazione.setAttribute("aria-hidden", "true");
    intestazione.append(creaElemento("span", "giorno-settimana-nome", nome), creaElemento("span", "giorno-settimana-iniziale", iniziale));
    return intestazione;
  });
  const primo = new Date(meseMostrato);
  const scarto = (primo.getDay() + 6) % 7;
  const giorniNelMese = new Date(primo.getFullYear(), primo.getMonth() + 1, 0).getDate();
  for (let i = 0; i < scarto; i++) celle.push(creaElemento("div", "giorno-cal vuoto"));
  const giorni = Array.from({ length: giorniNelMese }, (_, i) => {
    const iso = isoGiorno(new Date(primo.getFullYear(), primo.getMonth(), i + 1));
    return { numero: i + 1, iso, eventi: eventiDelGiorno(iso) };
  });
  const oggi = oggiIso();
  const scelto = giornoPredefinito(giorni);
  giorni.forEach(({ numero, iso, eventi }) => {
    const cella = bottone(null, `giorno-cal${iso === oggi ? " oggi" : ""}${iso === scelto ? " scelto" : ""}`);
    cella.dataset.giorno = iso;
    cella.setAttribute("aria-pressed", String(iso === scelto));
    cella.setAttribute("aria-label", [dataEstesa(iso), ...eventi.map((e) => e.titolo)].join(" · "));
    cella.append(creaElemento("span", "numero-giorno", String(numero)));
    eventi.forEach((e) => {
      const chip = creaElemento("span", `evento-cal ${e.classe}`, e.testo);
      chip.title = e.titolo;
      chip.setAttribute("aria-hidden", "true");
      cella.append(chip);
    });
    // Sul telefono: un pallino per tipo di evento al posto delle etichette.
    const pallini = creaElemento("span", "pallini-giorno");
    pallini.setAttribute("aria-hidden", "true");
    [...new Set(eventi.map((e) => e.classe))].forEach((classe) => pallini.append(creaElemento("i", `pallino ${classe}`)));
    cella.append(pallini);
    cella.addEventListener("click", () => {
      giornoScelto = iso;
      renderMese();
      griglia.querySelector(`[data-giorno="${iso}"]`)?.focus();
    });
    celle.push(cella);
  });
  griglia.replaceChildren(...celle);
  renderGiornoScelto(scelto, giorni.find((g) => g.iso === scelto).eventi);
}

// ---------- Prossime sessioni ----------
function renderProssime() {
  const lista = document.getElementById("lista-prossime");
  const inEvidenza = sessioneInEvidenza();
  // La prossima è già nel pannello in cima: qui solo quelle dopo.
  const elenco = prossimeProgrammate().filter((s) => s.id !== inEvidenza?.id);
  const vuoto = document.getElementById("prossime-vuoto");
  vuoto.textContent = inEvidenza ? "Nessun'altra sessione in programma." : "Nessuna sessione in programma.";
  vuoto.hidden = elenco.length > 0;
  lista.replaceChildren(...elenco.map((s) => {
    const li = creaElemento("li", "riga-calendario");
    const info = creaElemento("div", "riga-calendario-info");
    info.append(
      creaElemento("strong", null, etichettaSessione(s)),
      creaElemento("div", "party-sessione-sub", `${formattaDataOra(s.dataProgrammata, s.oraProgrammata)} · ${distanzaGiorni(s.dataProgrammata)}`)
    );
    const azioni = creaElemento("div", "riga-calendario-azioni");
    const ics = bottone(".ics", "btn-tabella btn-calendario-piccolo");
    ics.title = "Aggiungi al mio calendario: scarica il file .ics per Google Calendar, Apple Calendario…";
    ics.setAttribute("aria-label", `Aggiungi la ${etichettaSessione(s)} al mio calendario`);
    ics.addEventListener("click", () => scaricaIcs(s, campagna.titolo || "Sotterranei & Dragoni"));
    azioni.append(ics);
    if (isDM) {
      const annulla = bottone("Annulla", "btn-tabella btn-tabella-pericolo btn-calendario-piccolo");
      annulla.addEventListener("click", () => {
        if (!confirm(`Annullare la ${etichettaSessione(s)}?`)) return;
        esegui([annulla], async () => {
          await eliminaSessioneProgrammata(campagna.id, s.id);
          await ricaricaSessioni();
        }, "Impossibile annullare la sessione.");
      });
      azioni.append(annulla);
    }
    li.append(info, azioni);
    return li;
  }));
}

// ---------- Proposte e disponibilità ----------
function nomiPer(rispostePropose, opzioneId, valore) {
  return rispostePropose.filter((r) => r.risposte?.[opzioneId] === valore).map((r) => r.nome || "—");
}

function rigaOpzione(proposta, opzione, rispostePropose) {
  const li = creaElemento("li", "opzione-proposta");
  li.dataset.opzione = opzione.id;
  const intestazione = creaElemento("div", "opzione-intestazione");
  const quando = creaElemento("strong", null, formattaDataOra(opzione.data, opzione.ora));
  // Conteggi con le icone della tela (sì / forse / no): solo numeri e SVG fissi.
  const [si, forse, no] = ["si", "forse", "no"].map((v) => nomiPer(rispostePropose, opzione.id, v).length);
  const conteggi = creaElemento("span", "conteggi-opzione");
  conteggi.setAttribute("aria-label", `${si} sì, ${forse} forse, ${no} no`);
  conteggi.innerHTML = `<span class="conteggio-si" aria-hidden="true">${ICONA_SI}${si}</span>`
    + `<span class="conteggio-forse" aria-hidden="true">${ICONA_FORSE}${forse}</span>`
    + `<span class="conteggio-no" aria-hidden="true">${ICONA_NO}${no}</span>`;
  intestazione.append(quando, conteggi);
  li.append(intestazione);

  // La mia risposta (i membri; il DM organizza e non risponde).
  if (!isDM) {
    const mia = rispostePropose.find((r) => r.uid === uidCorrente)?.risposte || {};
    const scelta = creaElemento("div", "scelta-disponibilita");
    scelta.setAttribute("role", "group");
    scelta.setAttribute("aria-label", `La tua disponibilità per ${formattaDataOra(opzione.data, opzione.ora)}`);
    Object.entries(NOMI_RISPOSTA).forEach(([valore, testo]) => {
      const b = bottone(testo, `btn-disponibilita disponibilita-${valore}`);
      b.dataset.valore = valore;
      b.setAttribute("aria-pressed", String(mia[opzione.id] === valore));
      b.addEventListener("click", () => esegui([b], () =>
        rispondiProposta(campagna.id, proposta.id, uidCorrente, nomeCorrente, { ...mia, [opzione.id]: valore }),
      "Impossibile salvare la risposta."));
      scelta.append(b);
    });
    li.append(scelta);
  }

  const risposto = new Set(rispostePropose.filter((r) => r.risposte?.[opzione.id]).map((r) => r.uid));
  const mancano = party.filter((m) => !risposto.has(m.uid)).map((m) => m.nomeGiocatore || "—");
  const dettaglio = creaElemento("div", "dettaglio-disponibilita");
  [["si", "Sì"], ["forse", "Forse"], ["no", "No"]].forEach(([valore, etichetta]) => {
    const nomi = nomiPer(rispostePropose, opzione.id, valore);
    if (nomi.length) dettaglio.append(creaElemento("span", `nomi-${valore}`, `${etichetta}: ${nomi.join(", ")}`));
  });
  if (mancano.length) dettaglio.append(creaElemento("span", "nomi-mancano", `Mancano: ${mancano.join(", ")}`));
  li.append(dettaglio);

  if (isDM) {
    const conferma = bottone("Conferma questa data", "rd-btn rd-btn-primario rd-btn-piccolo btn-conferma-data");
    conferma.addEventListener("click", () => {
      if (!confirm(`Confermare ${formattaDataOra(opzione.data, opzione.ora)}? I giocatori riceveranno un avviso.`)) return;
      esegui([conferma], async () => {
        const { numero } = await confermaProposta(campagna.id, proposta, opzione);
        avviso(`Sessione ${numero} confermata.`);
        await ricaricaSessioni();
      }, "Impossibile confermare la data.");
    });
    li.append(conferma);
  }
  return li;
}

function renderProposte() {
  const contenitore = document.getElementById("lista-proposte");
  const aperte = proposteAperte();
  document.getElementById("pannello-proposte").hidden = aperte.length === 0;
  document.getElementById("titolo-proposte").textContent = isDM ? "Date proposte · risposte" : "Date da scegliere";
  contenitore.replaceChildren(...aperte.map((p) => {
    const scheda = creaElemento("div", "scheda-proposta");
    scheda.dataset.proposta = p.id;
    const titolo = creaElemento("div", "proposta-titolo");
    const nome = creaElemento("div", "proposta-nome");
    nome.append(creaElemento("strong", null, p.titolo || "Prossima sessione"));
    if (p.note) nome.append(creaElemento("small", null, p.note));
    titolo.append(nome);
    if (isDM) {
      const annulla = bottone("Annulla proposta", "btn-tabella btn-tabella-pericolo btn-calendario-piccolo");
      annulla.addEventListener("click", () => {
        if (!confirm("Annullare questa proposta?")) return;
        esegui([annulla], () => annullaProposta(campagna.id, p.id), "Impossibile annullare la proposta.");
      });
      titolo.append(annulla);
    }
    scheda.append(titolo);
    const opzioni = creaElemento("ul", "lista-opzioni");
    const rispostePropose = risposte.get(p.id) || [];
    [...p.opzioni]
      .sort((a, b) => `${a.data} ${a.ora || ""}`.localeCompare(`${b.data} ${b.ora || ""}`))
      .forEach((o) => opzioni.append(rigaOpzione(p, o, rispostePropose)));
    scheda.append(opzioni);
    return scheda;
  }));
}

function sincronizzaAscoltiRisposte() {
  const aperte = new Set(proposteAperte().map((p) => p.id));
  ascoltiRisposte.forEach((stop, id) => {
    if (!aperte.has(id)) {
      stop();
      ascoltiRisposte.delete(id);
    }
  });
  aperte.forEach((id) => {
    if (ascoltiRisposte.has(id)) return;
    ascoltiRisposte.set(id, ascoltaRisposte(campagna.id, id, (elenco) => {
      risposte.set(id, elenco);
      renderMese();
      renderProposte();
    }));
  });
}

// ---------- Strumenti del DM: la finestra «Organizza una sessione» ----------
const finestra = document.getElementById("finestra-organizza");
const opzioniForm = document.getElementById("opzioni-proposta");
const erroreFinestra = document.getElementById("errore-organizza");

function mostraErroreFinestra(testo) {
  erroreFinestra.textContent = testo;
  erroreFinestra.hidden = false;
}

function apriFinestra() {
  erroreFinestra.hidden = true;
  if (!opzioniForm.children.length) aggiungiOpzioneForm();
  finestra.showModal();
}

document.getElementById("btn-organizza").addEventListener("click", apriFinestra);
document.getElementById("btn-chiudi-organizza").addEventListener("click", () => finestra.close());
// Un tocco sul velo (fuori dal riquadro) chiude la finestra.
finestra.addEventListener("click", (evento) => {
  if (evento.target === finestra) finestra.close();
});

function aggiungiOpzioneForm(data = "", ora = "21:00") {
  if (opzioniForm.children.length >= 10) return;
  const riga = creaElemento("div", "riga-opzione-form");
  const campoData = document.createElement("input");
  campoData.type = "date";
  campoData.required = true;
  campoData.value = data;
  campoData.min = oggiIso();
  campoData.setAttribute("aria-label", "Data");
  const campoOra = document.createElement("input");
  campoOra.type = "time";
  campoOra.value = ora;
  campoOra.setAttribute("aria-label", "Ora di inizio");
  const togli = bottone("×", "btn-rimuovi-talento");
  togli.setAttribute("aria-label", "Togli questa data");
  togli.addEventListener("click", () => {
    if (opzioniForm.children.length > 1) riga.remove();
  });
  // Una nuova data parte dal giorno dopo l'ultima scelta.
  if (!data) {
    const ultima = [...opzioniForm.querySelectorAll('input[type="date"]')].map((c) => c.value).filter(Boolean).pop();
    if (ultima) {
      const dopo = dataLocale(ultima);
      dopo.setDate(dopo.getDate() + 1);
      campoData.value = isoGiorno(dopo);
    }
  }
  riga.append(campoData, campoOra, togli);
  opzioniForm.append(riga);
}

function leggiOpzioniForm() {
  return [...opzioniForm.children]
    .map((riga, i) => {
      const [data, ora] = riga.querySelectorAll("input");
      return { id: `o${i + 1}`, data: data.value, ora: ora.value || null };
    })
    .filter((o) => o.data);
}

function azzeraForm() {
  document.getElementById("form-proposta").reset();
  opzioniForm.replaceChildren();
  aggiungiOpzioneForm();
}

document.getElementById("btn-aggiungi-opzione").addEventListener("click", () => aggiungiOpzioneForm());

document.getElementById("form-proposta").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const opzioni = leggiOpzioniForm();
  if (!opzioni.length) return;
  const bottoni = [...evento.target.querySelectorAll("button")];
  erroreFinestra.hidden = true;
  esegui(bottoni, async () => {
    await creaProposta(campagna.id, {
      titolo: document.getElementById("proposta-titolo").value.trim(),
      note: document.getElementById("proposta-note").value.trim(),
      opzioni,
    });
    azzeraForm();
    finestra.close();
    avviso("Date proposte ai giocatori.");
  }, "Impossibile creare la proposta.", mostraErroreFinestra);
});

document.getElementById("btn-fissa-data").addEventListener("click", (evento) => {
  const [prima] = leggiOpzioniForm();
  if (!prima) {
    opzioniForm.querySelector('input[type="date"]')?.reportValidity();
    return;
  }
  const bottoni = [...evento.target.closest("form").querySelectorAll("button")];
  erroreFinestra.hidden = true;
  esegui(bottoni, async () => {
    const { numero } = await fissaSessione(campagna.id, {
      titolo: document.getElementById("proposta-titolo").value.trim(),
      note: document.getElementById("proposta-note").value.trim(),
      data: prima.data,
      ora: prima.ora,
    });
    azzeraForm();
    finestra.close();
    avviso(`Sessione ${numero} fissata.`);
    await ricaricaSessioni();
  }, "Impossibile fissare la data.", mostraErroreFinestra);
});

document.getElementById("mese-precedente").addEventListener("click", () => {
  meseMostrato.setMonth(meseMostrato.getMonth() - 1);
  giornoScelto = null;
  renderMese();
});
document.getElementById("mese-successivo").addEventListener("click", () => {
  meseMostrato.setMonth(meseMostrato.getMonth() + 1);
  giornoScelto = null;
  renderMese();
});

proteggiPagina(async (user, profilo) => {
  uidCorrente = user.uid;
  nomeCorrente = profilo?.nome ?? null;
  const ruolo = profilo?.ruolo || ROLES.PLAYER;
  montaGuscio({ user, profilo });

  campagna = await ottieniCampagnaCorrente(user.uid, ruolo).catch(() => null);
  // DM solo della campagna che guida: in quella di un altro si risponde alle date.
  isDM = campagna ? campagna.mioRuolo === ROLES.DM : ruolo !== ROLES.PLAYER;
  if (!campagna) {
    document.getElementById("testo-nessuna-campagna").textContent = isDM
      ? "Non hai ancora una campagna attiva: creane una dal pannello Gestione campagna."
      : "Non sei ancora membro di una campagna attiva: chiedi al tuo Dungeon Master di aggiungerti.";
    document.getElementById("nessuna-campagna").hidden = false;
  } else {
    document.getElementById("corpo-calendario").hidden = false;
    document.getElementById("btn-organizza").hidden = !isDM;
    try {
      party = (await elencaRiepiloghiParty(campagna.id)).filter((m) => m.uid);
    } catch (errore) {
      console.error(errore);
    }
    await ricaricaSessioni().catch((errore) => console.error(errore));
    await new Promise((pronto) => {
      ascoltaProposte(campagna.id, (elenco) => {
        proposte = elenco;
        sincronizzaAscoltiRisposte();
        renderTutto();
        pronto();
      }, (errore) => {
        console.error(errore);
        pronto();
      });
    });
  }
  veil.style.display = "none";
  contenuto.style.display = "block";
});
