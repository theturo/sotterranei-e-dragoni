// Script della pagina calendario.html: vista mensile delle sessioni
// (programmate, giocate, date proposte), prossime sessioni con file .ics e
// proposte di date con le disponibilità dei giocatori (sì/forse/no). Il DM
// propone date, fissa una data, conferma una proposta e, il giorno della
// sessione, la apre da qui.
import {
  proteggiPagina,
  ROLES,
  ottieniCampagnaCorrente,
  elencaSessioniCampagna,
  ottieniStatoSessione,
  apriSessione,
  eliminaSessioneProgrammata,
  elencaRiepiloghiParty,
  ascoltaProposte,
  ascoltaRisposte,
  rispondiProposta,
  creaProposta,
  confermaProposta,
  annullaProposta,
  fissaSessione,
} from "../auth.js";
import { montaMenuUtente } from "../menu-utente.js";
import { creaElemento } from "../contenuti.js";
import {
  isoGiorno,
  oggiIso,
  formattaDataOra,
  distanzaGiorni,
  etichettaSessione,
  scaricaIcs,
} from "../calendario.js";

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

const NOMI_RISPOSTA = { si: "Sì", forse: "Forse", no: "No" };

function avviso(testo, errore = false) {
  const toast = document.getElementById("toast");
  toast.textContent = testo;
  toast.className = `toast visibile${errore ? " toast-errore" : ""}`;
  setTimeout(() => (toast.className = "toast"), 3600);
}

function bottone(testo, classe = "btn-tabella") {
  const b = creaElemento("button", classe, testo);
  b.type = "button";
  return b;
}

async function esegui(elementi, azione, errore) {
  elementi.forEach((e) => (e.disabled = true));
  try {
    await azione();
  } catch (e) {
    console.error(e);
    avviso(errore, true);
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
const proposteAperte = () => proposte.filter((p) => p.stato === "aperta")
  .sort((a, b) => (a.creataIl?.toMillis?.() ?? Infinity) - (b.creataIl?.toMillis?.() ?? Infinity));

function renderTutto() {
  renderBannerOggi();
  renderMese();
  renderProssime();
  renderProposte();
}

// ---------- Oggi (apertura guidata per il DM) ----------
function renderBannerOggi() {
  const banner = document.getElementById("banner-oggi");
  const oggi = programmate().find((s) => s.dataProgrammata === oggiIso());
  if (!oggi) {
    banner.hidden = true;
    return;
  }
  const testo = creaElemento("span", null,
    `Oggi${oggi.oraProgrammata ? ` alle ${oggi.oraProgrammata}` : ""}: ${etichettaSessione(oggi)}.`);
  banner.replaceChildren(testo);
  if (statoSessione.inCorso) {
    const vai = creaElemento("a", "btn-tabella btn-tabella-evidenza", "Vai alla sessione in corso");
    vai.href = "sessione.html";
    banner.append(vai);
  } else if (isDM) {
    const apri = bottone("Apri la sessione di oggi", "btn-tabella btn-tabella-evidenza");
    apri.addEventListener("click", () => esegui([apri], async () => {
      await apriSessione(campagna.id);
      window.location.href = "sessione.html";
    }, "Impossibile aprire la sessione."));
    banner.append(apri);
  }
  banner.hidden = false;
}

// ---------- Vista mensile ----------
function eventiDelGiorno(iso) {
  const eventi = [];
  sessioni.forEach((s) => {
    if (s.stato === "programmata" && s.dataProgrammata === iso) {
      eventi.push({ classe: "evento-programmata", testo: `S${s.numero ?? "?"}${s.oraProgrammata ? ` ${s.oraProgrammata}` : ""}`, titolo: etichettaSessione(s) });
    } else if (s.stato !== "programmata" && s.apertaIl?.toDate && isoGiorno(s.apertaIl.toDate()) === iso) {
      eventi.push({ classe: "evento-giocata", testo: `S${s.numero ?? "?"}`, titolo: `${etichettaSessione(s)} (giocata)` });
    }
  });
  proposteAperte().forEach((p) => p.opzioni.filter((o) => o.data === iso).forEach((o) => {
    const si = (risposte.get(p.id) || []).filter((r) => r.risposte?.[o.id] === "si").length;
    eventi.push({ classe: "evento-proposta", testo: `? ${o.ora || ""}`.trim(), titolo: `Data proposta${p.titolo ? ` (${p.titolo})` : ""}: ${si} sì` });
  }));
  return eventi;
}

function renderMese() {
  const griglia = document.getElementById("griglia-calendario");
  document.getElementById("titolo-mese").textContent =
    meseMostrato.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const celle = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((g) => creaElemento("div", "giorno-settimana", g));
  const primo = new Date(meseMostrato);
  const scarto = (primo.getDay() + 6) % 7;
  const giorniNelMese = new Date(primo.getFullYear(), primo.getMonth() + 1, 0).getDate();
  for (let i = 0; i < scarto; i++) celle.push(creaElemento("div", "giorno-cal vuoto"));
  const oggi = oggiIso();
  for (let g = 1; g <= giorniNelMese; g++) {
    const iso = isoGiorno(new Date(primo.getFullYear(), primo.getMonth(), g));
    const cella = creaElemento("div", `giorno-cal${iso === oggi ? " oggi" : ""}`);
    cella.dataset.giorno = iso;
    cella.append(creaElemento("span", "numero-giorno", String(g)));
    eventiDelGiorno(iso).forEach((e) => {
      const chip = creaElemento("span", `evento-cal ${e.classe}`, e.testo);
      chip.title = e.titolo;
      cella.append(chip);
    });
    celle.push(cella);
  }
  griglia.replaceChildren(...celle);
}

// ---------- Prossime sessioni ----------
function renderProssime() {
  const lista = document.getElementById("lista-prossime");
  const elenco = programmate().filter((s) => s.dataProgrammata >= oggiIso());
  document.getElementById("prossime-vuoto").hidden = elenco.length > 0;
  lista.replaceChildren(...elenco.map((s) => {
    const li = creaElemento("li", "riga-calendario");
    const info = creaElemento("div", "riga-calendario-info");
    info.append(
      creaElemento("strong", null, etichettaSessione(s)),
      creaElemento("div", "party-sessione-sub", `${formattaDataOra(s.dataProgrammata, s.oraProgrammata)} · ${distanzaGiorni(s.dataProgrammata)}`)
    );
    const azioni = creaElemento("div", "riga-calendario-azioni");
    const ics = bottone("Aggiungi al mio calendario");
    ics.title = "Scarica il file .ics per Google Calendar, Apple Calendario…";
    ics.addEventListener("click", () => scaricaIcs(s, campagna.titolo || "Sotterranei & Dragoni"));
    azioni.append(ics);
    if (isDM) {
      const annulla = bottone("Annulla", "btn-tabella btn-tabella-pericolo");
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
  const conteggi = creaElemento("span", "conteggi-opzione",
    `✓ ${nomiPer(rispostePropose, opzione.id, "si").length} · ? ${nomiPer(rispostePropose, opzione.id, "forse").length} · ✗ ${nomiPer(rispostePropose, opzione.id, "no").length}`);
  intestazione.append(quando, conteggi);
  li.append(intestazione);

  // La mia risposta (i membri; il DM organizza e non risponde).
  if (!isDM) {
    const mia = rispostePropose.find((r) => r.uid === uidCorrente)?.risposte || {};
    const scelta = creaElemento("div", "scelta-disponibilita");
    scelta.setAttribute("role", "group");
    scelta.setAttribute("aria-label", `La tua disponibilità per ${formattaDataOra(opzione.data, opzione.ora)}`);
    Object.entries(NOMI_RISPOSTA).forEach(([valore, testo]) => {
      const b = bottone(testo, `btn-tabella btn-disponibilita disponibilita-${valore}`);
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
    const conferma = bottone("Conferma questa data", "btn-tabella btn-tabella-evidenza");
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
  document.getElementById("proposte-vuoto").hidden = aperte.length > 0;
  contenitore.replaceChildren(...aperte.map((p) => {
    const scheda = creaElemento("div", "scheda-proposta");
    scheda.dataset.proposta = p.id;
    const titolo = creaElemento("div", "proposta-titolo");
    titolo.append(creaElemento("strong", null, p.titolo || "Prossima sessione"));
    if (isDM) {
      const annulla = bottone("Annulla proposta", "btn-tabella btn-tabella-pericolo");
      annulla.addEventListener("click", () => {
        if (!confirm("Annullare questa proposta?")) return;
        esegui([annulla], () => annullaProposta(campagna.id, p.id), "Impossibile annullare la proposta.");
      });
      titolo.append(annulla);
    }
    scheda.append(titolo);
    if (p.note) scheda.append(creaElemento("p", "scheda-testo-libero", p.note));
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

// ---------- Strumenti del DM ----------
const opzioniForm = document.getElementById("opzioni-proposta");

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
  esegui(bottoni, async () => {
    await creaProposta(campagna.id, {
      titolo: document.getElementById("proposta-titolo").value.trim(),
      note: document.getElementById("proposta-note").value.trim(),
      opzioni,
    });
    azzeraForm();
    avviso("Date proposte ai giocatori.");
  }, "Impossibile creare la proposta.");
});

document.getElementById("btn-fissa-data").addEventListener("click", (evento) => {
  const [prima] = leggiOpzioniForm();
  if (!prima) {
    opzioniForm.querySelector('input[type="date"]')?.reportValidity();
    return;
  }
  const bottoni = [...evento.target.closest("form").querySelectorAll("button")];
  esegui(bottoni, async () => {
    const { numero } = await fissaSessione(campagna.id, {
      titolo: document.getElementById("proposta-titolo").value.trim(),
      data: prima.data,
      ora: prima.ora,
    });
    azzeraForm();
    avviso(`Sessione ${numero} fissata.`);
    await ricaricaSessioni();
  }, "Impossibile fissare la data.");
});

document.getElementById("mese-precedente").addEventListener("click", () => {
  meseMostrato.setMonth(meseMostrato.getMonth() - 1);
  renderMese();
});
document.getElementById("mese-successivo").addEventListener("click", () => {
  meseMostrato.setMonth(meseMostrato.getMonth() + 1);
  renderMese();
});

proteggiPagina(async (user, profilo) => {
  uidCorrente = user.uid;
  nomeCorrente = profilo?.nome ?? null;
  const ruolo = profilo?.ruolo || ROLES.PLAYER;
  isDM = ruolo === ROLES.DM || ruolo === ROLES.ADMIN;
  montaMenuUtente({ contenitore: document.getElementById("slot-utente"), user, profilo });

  campagna = await ottieniCampagnaCorrente(user.uid, ruolo).catch(() => null);
  if (!campagna) {
    document.getElementById("testo-nessuna-campagna").textContent = isDM
      ? "Non hai ancora una campagna attiva: creane una dal pannello Gestione campagna."
      : "Non sei ancora membro di una campagna attiva: chiedi al tuo Dungeon Master di aggiungerti.";
    document.getElementById("nessuna-campagna").hidden = false;
  } else {
    document.getElementById("corpo-calendario").hidden = false;
    document.getElementById("strumenti-dm").hidden = !isDM;
    if (isDM) aggiungiOpzioneForm();
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
