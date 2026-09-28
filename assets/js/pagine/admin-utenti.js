// Script della pagina admin-utenti.html (spostato fuori dall'HTML per la Content Security Policy:
// la policy consente solo script serviti dal sito stesso, niente script inline).
import {
  proteggiPaginaAdmin,
  elencaUtenti,
  aggiornaRuoloUtente,
  inviaResetPassword,
  approvaUtente,
  profiloApprovato,
  ETICHETTE_RUOLO,
} from "../auth.js";
import { montaMenuUtente } from "../menu-utente.js";
import { esc, mostraAttesa } from "../utils.js";

const veil = document.getElementById("veil");
const contenuto = document.getElementById("contenuto");
const corpoTabella = document.getElementById("corpo-tabella");
const toast = document.getElementById("toast");

let toastTimer = null;
function mostraToast(testo, errore = false) {
  toast.textContent = testo;
  toast.className = `toast visibile${errore ? " toast-errore" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = "toast";
  }, 3200);
}

function formattaData(timestamp) {
  if (!timestamp?.toDate) return "—";
  return timestamp.toDate().toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function creaRiga(utente, uidCorrente) {
  const tr = document.createElement("tr");
  const eIlTuoAccount = utente.uid === uidCorrente;

  const opzioniRuolo = Object.entries(ETICHETTE_RUOLO)
    .map(
      ([valore, etichetta]) =>
        `<option value="${esc(valore)}" ${utente.ruolo === valore ? "selected" : ""}>${esc(etichetta)}</option>`
    )
    .join("");

  const verificata = utente.emailVerificata === true;
  const simboloVerifica = verificata
    ? '<span class="simbolo-verifica" title="Email verificata" aria-label="Email verificata">✓</span>'
    : '<span class="simbolo-verifica" title="Email non verificata" aria-label="Email non verificata">✗</span>';

  // Nuovi iscritti in attesa: pulsante per approvarli (entrano nella
  // campagna solo dopo). Gli account già approvati mostrano solo lo stato.
  const cellaAccesso = profiloApprovato(utente)
    ? '<span class="simbolo-verifica" title="Approvato" aria-label="Approvato">✓</span>'
    : `<button class="btn-tabella btn-tabella-evidenza" data-approva="${esc(utente.uid)}">Approva</button>`;

  tr.innerHTML = `
    <td>${esc(utente.nome) || "—"}${eIlTuoAccount ? '<span class="badge-tu">(tu)</span>' : ""}</td>
    <td class="cella-email">${esc(utente.email) || "—"}</td>
    <td>${simboloVerifica}</td>
    <td>${cellaAccesso}</td>
    <td>
      <select class="select-ruolo" data-uid="${esc(utente.uid)}" ${eIlTuoAccount ? "disabled" : ""}>
        ${opzioniRuolo}
      </select>
    </td>
    <td>${formattaData(utente.creatoIl)}</td>
    <td>
      <button class="btn-tabella" data-email="${esc(utente.email)}">Reset password</button>
    </td>
  `;
  return tr;
}

proteggiPaginaAdmin(async (user, profilo) => {
  montaMenuUtente({ contenitore: document.getElementById("slot-utente"), user, profilo });
  try {
    const utenti = await elencaUtenti();
    // Chi è in attesa di approvazione in cima, così non passa inosservato.
    utenti.sort((a, b) => Number(profiloApprovato(a)) - Number(profiloApprovato(b)));
    corpoTabella.innerHTML = "";
    utenti.forEach((utente) => {
      corpoTabella.appendChild(creaRiga(utente, user.uid));
    });
  } catch (errore) {
    mostraToast("Impossibile caricare l'elenco utenti.", true);
    console.error(errore);
  }

  veil.style.display = "none";
  contenuto.style.display = "block";
});

// Cambio ruolo
corpoTabella.addEventListener("change", async (evento) => {
  const select = evento.target.closest(".select-ruolo");
  if (!select) return;

  const uid = select.dataset.uid;
  const nuovoRuolo = select.value;
  select.disabled = true;

  try {
    await aggiornaRuoloUtente(uid, nuovoRuolo);
    mostraToast(`Ruolo aggiornato a "${ETICHETTE_RUOLO[nuovoRuolo]}".`);
  } catch (errore) {
    mostraToast("Impossibile aggiornare il ruolo.", true);
    console.error(errore);
  } finally {
    select.disabled = false;
  }
});

// Approvazione di un nuovo iscritto
corpoTabella.addEventListener("click", async (evento) => {
  const bottone = evento.target.closest("[data-approva]");
  if (!bottone) return;
  bottone.disabled = true;
  try {
    await approvaUtente(bottone.dataset.approva);
    bottone.outerHTML = '<span class="simbolo-verifica" title="Approvato" aria-label="Approvato">✓</span>';
    mostraToast("Utente approvato: ora può entrare nella campagna.");
  } catch (errore) {
    mostraToast("Impossibile approvare l'utente.", true);
    console.error(errore);
    bottone.disabled = false;
  }
});

// Reset password
corpoTabella.addEventListener("click", async (evento) => {
  const bottone = evento.target.closest(".btn-tabella[data-email]");
  if (!bottone) return;

  const email = bottone.dataset.email;
  if (!email) return;

  bottone.disabled = true;
  const testoOriginale = bottone.textContent;
  mostraAttesa(bottone, "Invio…");

  try {
    await inviaResetPassword(email);
    mostraToast(`Email di reset inviata a ${email}.`);
  } catch (errore) {
    mostraToast("Impossibile inviare l'email di reset.", true);
    console.error(errore);
  } finally {
    bottone.disabled = false;
    bottone.textContent = testoOriginale;
  }
});
