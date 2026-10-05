// Script della pagina campagna.html (spostato fuori dall'HTML per la Content Security Policy:
// la policy consente solo script serviti dal sito stesso, niente script inline).
import { proteggiPaginaDM, ETICHETTE_RUOLO, ROLES } from "../auth.js";
import { elencaUtentiApprovati, ottieniProfiloUtente } from "../dati/utenti.js";
import {
  elencaCampagneDMConTitolo,
  creaCampagna,
  aggiornaCampagna,
  aggiornaTitoloCampagna,
  impostaCampagnaAttiva,
  mettiInPausaCampagna,
  campagnaScelta,
  scegliCampagna,
  aggiungiMembroCampagna,
  rimuoviMembroCampagna,
  migraDatiEsistenti,
} from "../dati/campagne.js";
import { elencaRiepiloghiParty } from "../dati/party.js";
import { elencaSessioniProgrammate, eliminaSessioneProgrammata, elencaSessioniCampagna } from "../dati/sessioni.js";
import { elencaProposteAperte } from "../dati/calendario.js";
import { ascoltaLibreriaDM, collegaContenutiSessione } from "../dati/libreria.js";
import { ascoltaBestiario } from "../dati/bestiario.js";
import { formattaDataOra, distanzaGiorni, etichettaSessione, dataBreveIso } from "../calendario.js";
import { CLASSI } from "../dati-srd.js";
import { montaMenuUtente } from "../menu-utente.js";
import { esc, mostraToast } from "../utils.js";
import { scegliContenuti } from "../contenuti.js";

const veil = document.getElementById("veil");
const contenuto = document.getElementById("contenuto");

let uidCorrente = null;
let campagne = [];
let campagnaAttiva = null;
// Libreria dei contenuti della campagna attiva (per collegarli alle sessioni).
let libreria = [];
let smettiLibreria = null;
let smettiBestiario = null;
let creatureDM = 0;

const collegatiA = (sessioneId) => libreria.filter((c) => c.riservati.sessioniCollegate.includes(sessioneId));

function ascoltaLibreria() {
  if (smettiLibreria) smettiLibreria();
  smettiLibreria = null;
  libreria = [];
  if (!campagnaAttiva) return;
  smettiLibreria = ascoltaLibreriaDM(campagnaAttiva.id, (elenco) => {
    libreria = elenco;
    aggiornaConteggiContenuti();
    renderNumeri();
  });
  smettiBestiario?.();
  smettiBestiario = ascoltaBestiario(campagnaAttiva.id, (elenco) => {
    creatureDM = elenco.length;
    renderNumeri();
  });
}

function aggiornaConteggiContenuti() {
  document.querySelectorAll("[data-contenuti-sessione]").forEach((bottone) => {
    const n = collegatiA(bottone.dataset.contenutiSessione).length;
    bottone.textContent = n ? `Contenuti (${n})` : "Contenuti";
  });
}


async function ricaricaTutto() {
  // Con il titolo vero (anche se provvisorio), letto dal documento privato.
  campagne = await elencaCampagneDMConTitolo(uidCorrente);
  const idPrecedente = campagnaAttiva?.id;
  // La campagna su cui si lavora: quella scelta (se attiva), altrimenti la prima attiva.
  const attive = campagne.filter((c) => c.stato === "attiva");
  campagnaAttiva = attive.find((c) => c.id === campagnaScelta(uidCorrente)) || attive[0] || null;
  if (campagnaAttiva?.id !== idPrecedente || !smettiLibreria) ascoltaLibreria();

  const nessunaCampagna = campagne.length === 0;
  document.getElementById("pannello-benvenuto").hidden = !nessunaCampagna;
  document.getElementById("pannelli-gestione").hidden = nessunaCampagna;
  if (nessunaCampagna) return;

  renderCampagnaAttiva();
  await Promise.all([renderMembri(), renderProgrammate(), renderSessioni()]);
  renderNumeri();
  renderAltreCampagne();
}

function renderCampagnaAttiva() {
  const corpo = document.getElementById("corpo-campagna-attiva");
  if (!campagnaAttiva) {
    corpo.innerHTML = `
      <p class="scheda-testo-libero">
        Nessuna campagna attiva al momento: scegline una dalla scheda "Altre campagne", oppure creane una nuova.
      </p>
    `;
    document.getElementById("azioni-campagna-attiva").innerHTML = "";
    return;
  }
  corpo.innerHTML = `
    <h3 class="campagna-pannello-titolo">${esc(campagnaAttiva.titolo)} <span class="campagna-stato">${campagnaAttiva.titoloProvvisorio ? "Attiva · titolo provvisorio" : "Attiva"}</span></h3>
    <form id="form-titolo-campagna" class="field-riga" style="align-items:flex-end;">
      <div class="field" style="flex:1; margin-bottom:0;">
        <label for="campo-titolo-attiva">Titolo</label>
        <input type="text" id="campo-titolo-attiva" value="${esc(campagnaAttiva.titolo)}" maxlength="120" required />
      </div>
      <button type="submit" class="btn-tabella">Salva titolo</button>
    </form>
    <label class="checkbox-scudo" style="margin-top:6px;">
      <input type="checkbox" id="campo-provvisorio-attiva" ${campagnaAttiva.titoloProvvisorio ? "checked" : ""} />
      Titolo provvisorio (non ancora rivelato ai giocatori)
    </label>
  `;
  document.getElementById("azioni-campagna-attiva").innerHTML = `
    <button type="button" id="btn-pausa-campagna" class="btn-tabella">Metti in pausa</button>
    <button type="button" id="btn-concludi-campagna" class="btn-tabella btn-tabella-pericolo">Concludi questa campagna</button>
  `;

  document.getElementById("form-titolo-campagna").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const titolo = document.getElementById("campo-titolo-attiva").value.trim();
    if (!titolo) return;
    try {
      await aggiornaTitoloCampagna(campagnaAttiva.id, {
        titolo,
        titoloProvvisorio: campagnaAttiva.titoloProvvisorio,
      });
      mostraToast("Titolo aggiornato.");
      await ricaricaTutto();
    } catch (errore) {
      console.error(errore);
      mostraToast("Impossibile salvare il titolo.", true);
    }
  });

  document.getElementById("campo-provvisorio-attiva").addEventListener("change", async (evento) => {
    try {
      // Togliere la spunta = "reveal": il titolo diventa visibile ai giocatori.
      await aggiornaTitoloCampagna(campagnaAttiva.id, {
        titolo: campagnaAttiva.titolo,
        titoloProvvisorio: evento.target.checked,
      });
      campagnaAttiva.titoloProvvisorio = evento.target.checked;
      mostraToast(evento.target.checked ? "Titolo segnato come provvisorio." : "Titolo rivelato ai giocatori.");
    } catch (errore) {
      console.error(errore);
      mostraToast("Impossibile aggiornare.", true);
      evento.target.checked = !evento.target.checked;
    }
  });

  document.getElementById("btn-pausa-campagna").addEventListener("click", async () => {
    if (!confirm(`Mettere in pausa "${campagnaAttiva.titolo}"? Sparirà dal selettore dei giocatori finché non la riattivi.`)) return;
    try {
      await mettiInPausaCampagna(campagnaAttiva.id);
      mostraToast("Campagna in pausa.");
      await ricaricaTutto();
    } catch (errore) {
      console.error(errore);
      mostraToast("Impossibile mettere in pausa la campagna.", true);
    }
  });

  document.getElementById("btn-concludi-campagna").addEventListener("click", async () => {
    if (!confirm(`Concludere "${campagnaAttiva.titolo}"? Resterà nello storico, ma nessuno la vedrà più come campagna in corso.`)) return;
    try {
      await aggiornaCampagna(campagnaAttiva.id, { stato: "conclusa" });
      mostraToast("Campagna conclusa.");
      await ricaricaTutto();
    } catch (errore) {
      console.error(errore);
      mostraToast("Impossibile concludere la campagna.", true);
    }
  });
}

async function renderMembri() {
  const lista = document.getElementById("lista-membri");
  const vuoto = document.getElementById("nessun-giocatore-membri");
  lista.innerHTML = "";

  if (!campagnaAttiva) {
    vuoto.hidden = false;
    vuoto.textContent = "Attiva prima una campagna per poterne gestire i membri.";
    return;
  }

  try {
    const membriUid = campagnaAttiva.membriUid || [];
    const [utenti, party] = await Promise.all([elencaUtentiApprovati(uidCorrente), elencaRiepiloghiParty(campagnaAttiva.id)]);
    // I membri compaiono sempre, qualunque ruolo o stato abbiano, così si
    // possono togliere: anche chi non è (più) approvato o non ha più un profilo.
    const perUid = new Map(utenti.map((u) => [u.uid, u]));
    const mancanti = membriUid.filter((uid) => !perUid.has(uid));
    const profili = await Promise.all(mancanti.map((uid) => ottieniProfiloUtente(uid).catch(() => null)));
    mancanti.forEach((uid, i) => perUid.set(uid, profili[i] ? { uid, ...profili[i] } : { uid, nome: "Utente non più registrato" }));
    const giocatori = [...perUid.values()];
    if (giocatori.length === 0) {
      vuoto.hidden = false;
      vuoto.textContent = "Nessun giocatore registrato ancora.";
      return;
    }
    vuoto.hidden = true;
    const riepiloghi = new Map(party.map((p) => [p.uid, p]));
    // Prima chi è nel party, poi gli altri.
    const ordinati = [...giocatori].sort((a, b) => Number(membriUid.includes(b.uid)) - Number(membriUid.includes(a.uid)));
    ordinati.forEach((giocatore) => {
      const dentro = membriUid.includes(giocatore.uid);
      const pg = riepiloghi.get(giocatore.uid);
      const stato = !dentro
        ? "non fa parte del party"
        : pg?.schedaId
          ? `${pg.nomePersonaggio || "—"} · ${CLASSI[pg.classe]?.nome || "—"} ${pg.livello || 1}`
          : "nessun personaggio attivo";
      // Il ruolo sul sito si mostra solo se non è "giocatore" (es. un DM che gioca qui).
      const note = [
        giocatore.ruolo && giocatore.ruolo !== ROLES.PLAYER ? ETICHETTE_RUOLO[giocatore.ruolo] || giocatore.ruolo : "",
        giocatore.approvato === false ? "in attesa di approvazione" : "",
      ].filter(Boolean);
      const sotto = [...note, stato].join(" · ");
      const li = document.createElement("li");
      li.className = `campagna-riga${dentro ? "" : " fuori"}`;
      li.innerHTML = `
        <div>
          <strong>${esc(giocatore.nome || giocatore.email) || "—"}</strong>
          <div class="party-sessione-sub">${esc(sotto)}</div>
        </div>
        <button type="button" class="btn-tabella${dentro ? "" : " btn-tabella-evidenza"}" data-membro="${esc(giocatore.uid)}" data-dentro="${dentro ? "1" : ""}"
          aria-label="${dentro ? "Togli dal party" : "Aggiungi al party"}: ${esc(giocatore.nome || giocatore.email)}">${dentro ? "✓ Nel party · togli" : "+ Aggiungi al party"}</button>
      `;
      lista.appendChild(li);
    });
  } catch (errore) {
    console.error(errore);
    mostraToast("Impossibile caricare i giocatori.", true);
  }
}

// Numeri della Panoramica e prossima sessione.
let sessioniCampagna = [];
function renderNumeri() {
  const contenitore = document.getElementById("numeri-campagna");
  const prossima = document.getElementById("prossima-campagna");
  if (!campagnaAttiva) {
    contenitore.innerHTML = "";
    prossima.textContent = "";
    return;
  }
  const giocate = sessioniCampagna.filter((s) => s.stato === "chiusa").length;
  const numeri = [
    [giocate, giocate === 1 ? "sessione giocata" : "sessioni giocate"],
    [(campagnaAttiva.membriUid || []).length, (campagnaAttiva.membriUid || []).length === 1 ? "giocatore" : "giocatori"],
    [libreria.length, libreria.length === 1 ? "contenuto in libreria" : "contenuti in libreria"],
    [creatureDM, creatureDM === 1 ? "creatura tua" : "creature tue"],
  ];
  contenitore.innerHTML = numeri.map(([n, t]) => `<div class="campagna-numero"><b>${esc(n)}</b><span>${esc(t)}</span></div>`).join("");
  const programmata = sessioniCampagna
    .filter((s) => s.stato === "programmata" && s.dataProgrammata)
    .sort((a, b) => a.dataProgrammata.localeCompare(b.dataProgrammata))[0];
  const inCorso = sessioniCampagna.find((s) => s.stato === "in-corso");
  prossima.innerHTML = inCorso
    ? `In corso: <b>${esc(etichettaSessione(inCorso))}</b> · <a href="sessione.html">vai alla sessione</a>`
    : programmata
      ? `Prossima: <b>${esc(etichettaSessione(programmata))}</b>, ${esc(formattaDataOra(programmata.dataProgrammata, programmata.oraProgrammata))} (${esc(distanzaGiorni(programmata.dataProgrammata))}).`
      : `Nessuna sessione in programma: <a href="calendario.html">organizzala dal Calendario</a>.`;
}

// Proposte aperte e sessioni giocate (scheda Sessioni).
async function renderSessioni() {
  const listaProposte = document.getElementById("lista-proposte");
  const listaGiocate = document.getElementById("lista-giocate");
  listaProposte.innerHTML = "";
  listaGiocate.innerHTML = "";
  if (!campagnaAttiva) return;
  try {
    const [sessioni, proposte] = await Promise.all([elencaSessioniCampagna(campagnaAttiva.id), elencaProposteAperte(campagnaAttiva.id)]);
    sessioniCampagna = sessioni;
    const membri = (campagnaAttiva.membriUid || []).length;
    document.getElementById("nessuna-proposta").hidden = proposte.length > 0;
    proposte.forEach((p) => {
      const riga = document.createElement("div");
      riga.className = "sessione-programmata-riga";
      const date = p.opzioni?.length || 0;
      riga.innerHTML = `
        <div>
          <strong>${p.titolo ? `«${esc(p.titolo)}»` : "Date proposte"}</strong>
          <div class="party-sessione-sub">${esc(date === 1 ? "1 data" : `${date} date`)} · hanno risposto ${esc(p.risposte.length)} su ${esc(membri)}</div>
        </div>
        <div class="azioni-riga"><a class="btn-tabella" href="calendario.html">Apri nel calendario</a></div>
      `;
      listaProposte.appendChild(riga);
    });
    const giocate = sessioni.filter((s) => s.stato !== "programmata").sort((a, b) => (b.numero || 0) - (a.numero || 0));
    document.getElementById("nessuna-giocata").hidden = giocate.length > 0;
    giocate.forEach((s) => {
      const quando = s.apertaIl?.toDate?.() || (s.dataProgrammata ? new Date(`${s.dataProgrammata}T12:00`) : null);
      const riga = document.createElement("div");
      riga.className = "sessione-programmata-riga";
      riga.innerHTML = `
        <div>
          <strong>${esc(etichettaSessione(s))}</strong>
          <div class="party-sessione-sub">${quando ? esc(quando.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })) : ""}${s.stato === "in-corso" ? " · in corso" : ""}</div>
        </div>
        <div class="azioni-riga"><a class="btn-tabella" href="sessione.html#registro">Registro</a></div>
      `;
      listaGiocate.appendChild(riga);
    });
  } catch (errore) {
    console.error(errore);
    mostraToast("Impossibile caricare le sessioni.", true);
  }
}

async function renderProgrammate() {
  const lista = document.getElementById("lista-programmate");
  const vuoto = document.getElementById("nessuna-programmata");
  lista.innerHTML = "";

  if (!campagnaAttiva) {
    vuoto.hidden = false;
    vuoto.textContent = "Attiva prima una campagna per poter pianificare sessioni.";
    return;
  }

  try {
    const programmate = await elencaSessioniProgrammate(campagnaAttiva.id);
    if (programmate.length === 0) {
      vuoto.hidden = false;
      vuoto.textContent = "Nessuna sessione pianificata.";
      return;
    }
    vuoto.hidden = true;
    programmate.forEach((sessione) => {
      const riga = document.createElement("div");
      riga.className = "sessione-programmata-riga";
      riga.innerHTML = `
        <div>
          <strong>Sessione ${esc(sessione.numero)}</strong>${sessione.titolo ? ` — ${esc(sessione.titolo)}` : ""}
          <div class="party-sessione-sub">${esc(dataBreveIso(sessione.dataProgrammata))}${sessione.oraProgrammata ? `, ${esc(sessione.oraProgrammata)}` : ""}</div>
        </div>
        <div class="azioni-riga">
          <button type="button" class="btn-tabella" data-contenuti-sessione="${esc(sessione.id)}" data-etichetta="${esc(`Sessione ${sessione.numero}`)}">Contenuti</button>
          <button type="button" class="btn-tabella btn-tabella-pericolo" data-elimina-programmata="${esc(sessione.id)}">Annulla</button>
        </div>
      `;
      lista.appendChild(riga);
    });
    aggiornaConteggiContenuti();
  } catch (errore) {
    console.error(errore);
    mostraToast("Impossibile caricare le sessioni pianificate.", true);
  }
}

function renderAltreCampagne() {
  const lista = document.getElementById("lista-altre-campagne");
  const vuoto = document.getElementById("nessuna-altra-campagna");
  const altre = campagne.filter((c) => c.id !== campagnaAttiva?.id);
  lista.innerHTML = "";

  if (altre.length === 0) {
    vuoto.hidden = false;
    return;
  }
  vuoto.hidden = true;
  altre.forEach((campagna) => {
    const riga = document.createElement("div");
    riga.className = "sessione-programmata-riga";
    riga.innerHTML = `
      <div>
        <strong>${esc(campagna.titolo)}</strong>
        <div class="party-sessione-sub">${esc(campagna.stato)}${campagna.titoloProvvisorio ? " · titolo provvisorio" : ""}</div>
      </div>
      ${campagna.stato === "attiva"
        ? `<button type="button" class="btn-tabella btn-tabella-evidenza" data-scegli="${esc(campagna.id)}">Lavora su questa</button>`
        : `<button type="button" class="btn-tabella btn-tabella-evidenza" data-rendi-attiva="${esc(campagna.id)}">Rendi attiva</button>`}
    `;
    lista.appendChild(riga);
  });
}

document.getElementById("form-benvenuto").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const titolo = document.getElementById("benvenuto-titolo").value.trim();
  const provvisorio = document.getElementById("benvenuto-provvisorio").checked;
  const migra = document.getElementById("benvenuto-migra").checked;
  if (!titolo) return;

  const bottone = evento.target.querySelector("button[type=submit]");
  bottone.disabled = true;
  try {
    const id = await creaCampagna(uidCorrente, { titolo, titoloProvvisorio: provvisorio });
    await impostaCampagnaAttiva(uidCorrente, id);
    if (migra) {
      // Solo i dati: i membri li aggiunge il DM a mano (Giocatori).
      await migraDatiEsistenti(id);
    }
    mostraToast("Campagna creata.");
    await ricaricaTutto();
  } catch (errore) {
    console.error(errore);
    mostraToast("Impossibile creare la campagna.", true);
  } finally {
    bottone.disabled = false;
  }
});

document.getElementById("lista-membri").addEventListener("click", async (evento) => {
  const bottone = evento.target.closest("[data-membro]");
  if (!bottone || !campagnaAttiva) return;
  const uid = bottone.dataset.membro;
  const dentro = Boolean(bottone.dataset.dentro);
  if (dentro && !confirm("Togliere questo giocatore dal party? Non vedrà più la campagna (la sua scheda resta).")) return;
  bottone.disabled = true;
  try {
    if (dentro) await rimuoviMembroCampagna(campagnaAttiva.id, uid);
    else await aggiungiMembroCampagna(campagnaAttiva.id, uid);
    campagnaAttiva.membriUid = dentro
      ? (campagnaAttiva.membriUid || []).filter((x) => x !== uid)
      : [...(campagnaAttiva.membriUid || []), uid];
    await renderMembri();
    renderNumeri();
  } catch (errore) {
    console.error(errore);
    mostraToast("Impossibile aggiornare i membri.", true);
    bottone.disabled = false;
  }
});

document.getElementById("lista-programmate").addEventListener("click", async (evento) => {
  const bottoneContenuti = evento.target.closest("[data-contenuti-sessione]");
  if (bottoneContenuti) {
    await scegliContenutiSessione(bottoneContenuti.dataset.contenutiSessione, bottoneContenuti.dataset.etichetta);
    return;
  }
  const bottone = evento.target.closest("[data-elimina-programmata]");
  if (!bottone) return;
  if (!confirm("Annullare questa sessione pianificata?")) return;
  bottone.disabled = true;
  try {
    const sessioneId = bottone.dataset.eliminaProgrammata;
    // I contenuti restano in libreria: si toglie solo il collegamento.
    const collegati = collegatiA(sessioneId).map((c) => c.id);
    if (collegati.length) await collegaContenutiSessione(campagnaAttiva.id, sessioneId, [], collegati);
    await eliminaSessioneProgrammata(campagnaAttiva.id, sessioneId);
    mostraToast("Sessione pianificata annullata.");
    await renderProgrammate();
  } catch (errore) {
    console.error(errore);
    mostraToast("Impossibile annullare la sessione.", true);
    bottone.disabled = false;
  }
});

// Il DM sceglie dalla libreria i contenuti da collegare a una sessione
// pianificata (i contenuti si caricano prima, nella Libreria).
async function scegliContenutiSessione(sessioneId, etichetta) {
  if (!campagnaAttiva) return;
  if (libreria.length === 0) {
    mostraToast("La libreria è vuota: carica prima i contenuti dalla pagina Libreria.");
    return;
  }
  const collegati = new Set(collegatiA(sessioneId).map((c) => c.id));
  const scelti = await scegliContenuti({
    campagnaId: campagnaAttiva.id,
    titolo: `Contenuti — ${etichetta}`,
    contenuti: libreria,
    selezionati: collegati,
  });
  if (!scelti) return;
  try {
    await collegaContenutiSessione(
      campagnaAttiva.id,
      sessioneId,
      [...scelti].filter((id) => !collegati.has(id)),
      [...collegati].filter((id) => !scelti.has(id))
    );
    mostraToast("Contenuti della sessione aggiornati.");
  } catch (errore) {
    console.error(errore);
    mostraToast("Impossibile collegare i contenuti.", true);
  }
}

document.getElementById("form-nuova-campagna").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const titolo = document.getElementById("nuova-campagna-titolo").value.trim();
  const provvisorio = document.getElementById("nuova-campagna-provvisorio").checked;
  if (!titolo) return;

  const bottone = evento.target.querySelector("button[type=submit]");
  bottone.disabled = true;
  try {
    await creaCampagna(uidCorrente, { titolo, titoloProvvisorio: provvisorio });
    evento.target.reset();
    mostraToast("Nuova campagna creata (in pianificazione). Rendila attiva quando vuoi iniziare a usarla.");
    await ricaricaTutto();
  } catch (errore) {
    console.error(errore);
    mostraToast("Impossibile creare la campagna.", true);
  } finally {
    bottone.disabled = false;
  }
});

document.getElementById("lista-altre-campagne").addEventListener("click", async (evento) => {
  const scegli = evento.target.closest("[data-scegli]");
  if (scegli) {
    scegliCampagna(uidCorrente, scegli.dataset.scegli);
    window.location.reload();
    return;
  }
  const bottone = evento.target.closest("[data-rendi-attiva]");
  if (!bottone) return;
  bottone.disabled = true;
  try {
    await impostaCampagnaAttiva(uidCorrente, bottone.dataset.rendiAttiva);
    // Si ricarica la pagina: anche intestazione e selettore passano alla nuova campagna.
    window.location.reload();
  } catch (errore) {
    console.error(errore);
    mostraToast("Impossibile attivare la campagna.", true);
    bottone.disabled = false;
  }
});

// Schede della pagina (Panoramica, Giocatori, Sessioni, Altre campagne):
// la scelta resta nell'indirizzo (campagna.html#sessioni).
const SCHEDE = ["panoramica", "giocatori", "sessioni", "altre"];
function mostraScheda(nome, metti = false) {
  const scelta = SCHEDE.includes(nome) ? nome : "panoramica";
  for (const s of SCHEDE) {
    const tab = document.getElementById(`tab-${s}`);
    tab.setAttribute("aria-selected", String(s === scelta));
    tab.tabIndex = s === scelta ? 0 : -1;
    tab.classList.toggle("scelta", s === scelta);
    document.getElementById(`pannello-${s}`).hidden = s !== scelta;
  }
  if (metti) history.replaceState(null, "", `#${scelta}`);
}
document.querySelector(".campagna-schede").addEventListener("click", (evento) => {
  const tab = evento.target.closest("[data-tab]");
  if (tab) mostraScheda(tab.dataset.tab, true);
});
document.querySelector(".campagna-schede").addEventListener("keydown", (evento) => {
  if (evento.key !== "ArrowRight" && evento.key !== "ArrowLeft") return;
  const attuale = SCHEDE.indexOf(document.querySelector(".campagna-scheda.scelta")?.dataset.tab);
  const prossima = SCHEDE[(attuale + (evento.key === "ArrowRight" ? 1 : SCHEDE.length - 1)) % SCHEDE.length];
  mostraScheda(prossima, true);
  document.getElementById(`tab-${prossima}`).focus();
});
window.addEventListener("hashchange", () => mostraScheda(location.hash.slice(1)));
mostraScheda(location.hash.slice(1));

proteggiPaginaDM(async (user, profilo) => {
  uidCorrente = user.uid;
  montaMenuUtente({ contenitore: document.getElementById("slot-utente"), user, profilo });

  try {
    await ricaricaTutto();
  } catch (errore) {
    console.error(errore);
    mostraToast("Impossibile caricare le campagne.", true);
  }

  veil.style.display = "none";
  contenuto.style.display = "block";
});
