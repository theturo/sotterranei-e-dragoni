// Script della pagina campagna.html (spostato fuori dall'HTML per la Content Security Policy:
// la policy consente solo script serviti dal sito stesso, niente script inline).
import {
  proteggiPaginaDM,
  elencaCampagneDMConTitolo,
  creaCampagna,
  aggiornaCampagna,
  aggiornaTitoloCampagna,
  impostaCampagnaAttiva,
  aggiungiMembroCampagna,
  rimuoviMembroCampagna,
  elencaGiocatori,
  elencaSessioniProgrammate,
  creaSessioneProgrammata,
  eliminaSessioneProgrammata,
  migraDatiEsistenti,
} from "../auth.js";
import { montaMenuUtente } from "../menu-utente.js";
import { esc } from "../utils.js";

const veil = document.getElementById("veil");
const contenuto = document.getElementById("contenuto");
const toast = document.getElementById("toast");

let uidCorrente = null;
let campagne = [];
let campagnaAttiva = null;

let toastTimer = null;
function mostraToast(testo, errore = false) {
  toast.textContent = testo;
  toast.className = `toast visibile${errore ? " toast-errore" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.className = "toast"), 3200);
}

function formattaData(dataIso) {
  if (!dataIso) return "";
  const [anno, mese, giorno] = dataIso.split("-");
  return `${giorno}/${mese}/${anno}`;
}

async function ricaricaTutto() {
  // Con il titolo vero (anche se provvisorio), letto dal documento privato.
  campagne = await elencaCampagneDMConTitolo(uidCorrente);
  campagnaAttiva = campagne.find((c) => c.stato === "attiva") || null;

  const nessunaCampagna = campagne.length === 0;
  document.getElementById("pannello-benvenuto").hidden = !nessunaCampagna;
  document.getElementById("pannelli-gestione").hidden = nessunaCampagna;
  if (nessunaCampagna) return;

  renderCampagnaAttiva();
  await renderMembri();
  await renderProgrammate();
  renderAltreCampagne();
}

function renderCampagnaAttiva() {
  const corpo = document.getElementById("corpo-campagna-attiva");
  if (!campagnaAttiva) {
    corpo.innerHTML = `
      <p class="scheda-testo-libero">
        Nessuna campagna attiva al momento: scegline una da "Altre campagne" più sotto, oppure creane una nuova.
      </p>
    `;
    return;
  }
  corpo.innerHTML = `
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
    <div style="margin-top:16px;">
      <button type="button" id="btn-concludi-campagna" class="btn-tabella btn-tabella-pericolo">Concludi questa campagna</button>
    </div>
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
    const giocatori = await elencaGiocatori();
    if (giocatori.length === 0) {
      vuoto.hidden = false;
      vuoto.textContent = "Nessun giocatore registrato ancora.";
      return;
    }
    vuoto.hidden = true;
    const membriUid = campagnaAttiva.membriUid || [];
    giocatori.forEach((giocatore) => {
      const label = document.createElement("label");
      label.className = "checkbox-scudo";
      label.innerHTML = `
        <input type="checkbox" data-membro="${esc(giocatore.uid)}" ${membriUid.includes(giocatore.uid) ? "checked" : ""} />
        ${esc(giocatore.nome || giocatore.email) || "—"}
      `;
      lista.appendChild(label);
    });
  } catch (errore) {
    console.error(errore);
    mostraToast("Impossibile caricare i giocatori.", true);
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
          <div class="party-sessione-sub">${esc(formattaData(sessione.dataProgrammata))}</div>
        </div>
        <button type="button" class="btn-tabella btn-tabella-pericolo" data-elimina-programmata="${esc(sessione.id)}">Annulla</button>
      `;
      lista.appendChild(riga);
    });
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
      <button type="button" class="btn-tabella btn-tabella-evidenza" data-rendi-attiva="${esc(campagna.id)}">Rendi attiva</button>
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
      const giocatori = await elencaGiocatori();
      await Promise.all(giocatori.map((g) => aggiungiMembroCampagna(id, g.uid)));
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

document.getElementById("lista-membri").addEventListener("change", async (evento) => {
  const checkbox = evento.target.closest("[data-membro]");
  if (!checkbox || !campagnaAttiva) return;
  checkbox.disabled = true;
  try {
    if (checkbox.checked) {
      await aggiungiMembroCampagna(campagnaAttiva.id, checkbox.dataset.membro);
    } else {
      await rimuoviMembroCampagna(campagnaAttiva.id, checkbox.dataset.membro);
    }
    campagnaAttiva.membriUid = checkbox.checked
      ? [...(campagnaAttiva.membriUid || []), checkbox.dataset.membro]
      : (campagnaAttiva.membriUid || []).filter((uid) => uid !== checkbox.dataset.membro);
  } catch (errore) {
    console.error(errore);
    mostraToast("Impossibile aggiornare i membri.", true);
    checkbox.checked = !checkbox.checked;
  } finally {
    checkbox.disabled = false;
  }
});

document.getElementById("form-programma-sessione").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (!campagnaAttiva) return;
  const titolo = document.getElementById("programma-titolo").value.trim();
  const dataProgrammata = document.getElementById("programma-data").value;
  if (!dataProgrammata) return;

  const bottone = evento.target.querySelector("button[type=submit]");
  bottone.disabled = true;
  try {
    await creaSessioneProgrammata(campagnaAttiva.id, { titolo, dataProgrammata });
    evento.target.reset();
    mostraToast("Sessione pianificata.");
    await renderProgrammate();
  } catch (errore) {
    console.error(errore);
    mostraToast("Impossibile pianificare la sessione.", true);
  } finally {
    bottone.disabled = false;
  }
});

document.getElementById("lista-programmate").addEventListener("click", async (evento) => {
  const bottone = evento.target.closest("[data-elimina-programmata]");
  if (!bottone) return;
  if (!confirm("Annullare questa sessione pianificata?")) return;
  bottone.disabled = true;
  try {
    await eliminaSessioneProgrammata(bottone.dataset.eliminaProgrammata);
    mostraToast("Sessione pianificata annullata.");
    await renderProgrammate();
  } catch (errore) {
    console.error(errore);
    mostraToast("Impossibile annullare la sessione.", true);
    bottone.disabled = false;
  }
});

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
  const bottone = evento.target.closest("[data-rendi-attiva]");
  if (!bottone) return;
  bottone.disabled = true;
  try {
    await impostaCampagnaAttiva(uidCorrente, bottone.dataset.rendiAttiva);
    mostraToast("Campagna attivata.");
    await ricaricaTutto();
  } catch (errore) {
    console.error(errore);
    mostraToast("Impossibile attivare la campagna.", true);
    bottone.disabled = false;
  }
});

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
