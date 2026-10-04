// Script della pagina admin-utenti.html (spostato fuori dall'HTML per la Content Security Policy:
// la policy consente solo script serviti dal sito stesso, niente script inline).
import { proteggiPaginaAdmin, inviaResetPassword, profiloApprovato, ETICHETTE_RUOLO } from "../auth.js";
import {
  elencaUtenti,
  richiediEliminazioneUtente,
  ascoltaRichiestaEliminazione,
  aggiornaRuoloUtente,
  approvaUtente,
} from "../dati/utenti.js";
import { montaMenuUtente } from "../menu-utente.js";
import { esc, mostraAttesa, mostraToast } from "../utils.js";
import { dataBreve } from "../calendario.js";

const veil = document.getElementById("veil");
const contenuto = document.getElementById("contenuto");
const corpoTabella = document.getElementById("corpo-tabella");


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

  tr.dataset.uid = utente.uid;
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
    <td>${dataBreve(utente.creatoIl, "—")}</td>
    <td>
      <div class="azioni-utente">
        <button class="btn-tabella" data-email="${esc(utente.email)}">Reset password</button>
        ${eIlTuoAccount ? "" : `<button class="btn-tabella btn-tabella-pericolo" data-elimina="${esc(utente.uid)}" data-nome="${esc(utente.nome || utente.email || "")}" type="button">Elimina</button>`}
      </div>
    </td>
  `;
  return tr;
}

let uidAdmin = null;

proteggiPaginaAdmin(async (user, profilo) => {
  uidAdmin = user.uid;
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

// Eliminazione di un utente: la richiesta va alla Cloud Function eliminaUtente
// (l'account di accesso si può cancellare solo dal server); la riga resta in
// attesa finché non arriva l'esito.
const ATTESA_MASSIMA = 90000;
corpoTabella.addEventListener("click", async (evento) => {
  const bottone = evento.target.closest("[data-elimina]");
  if (!bottone) return;
  const uid = bottone.dataset.elimina;
  const nome = bottone.dataset.nome;
  const domanda = `Eliminare definitivamente ${nome}?\n\n` +
    "Spariscono account, profilo, personaggi con i ritratti, notifiche; esce dalle campagne. " +
    "Gli appunti scritti in sessione restano, firmati con il suo nome. Non si può annullare.";
  if (!confirm(domanda)) return;
  const riga = bottone.closest("tr");
  riga.querySelectorAll("button, select").forEach((el) => (el.disabled = true));
  mostraAttesa(bottone, "Eliminazione…");
  let smetti = () => {};
  const scadenza = setTimeout(() => {
    smetti();
    mostraToast("Nessuna risposta dalla funzione eliminaUtente: è pubblicata? (vedi docs/funzioni.md)", true);
    riga.querySelectorAll("button, select").forEach((el) => (el.disabled = false));
    bottone.textContent = "Elimina";
  }, ATTESA_MASSIMA);
  try {
    await richiediEliminazioneUtente(uid, uidAdmin);
    smetti = ascoltaRichiestaEliminazione(uid, (richiesta) => {
      if (!richiesta?.stato) return;
      clearTimeout(scadenza);
      smetti();
      if (richiesta.stato === "completata") {
        riga.remove();
        mostraToast(`${nome} è stato eliminato.`);
      } else {
        mostraToast(`Eliminazione non riuscita: ${richiesta.messaggio || "errore"}.`, true);
        riga.querySelectorAll("button, select").forEach((el) => (el.disabled = false));
        bottone.textContent = "Elimina";
      }
    });
  } catch (errore) {
    clearTimeout(scadenza);
    console.error(errore);
    mostraToast("Impossibile inviare la richiesta di eliminazione.", true);
    riga.querySelectorAll("button, select").forEach((el) => (el.disabled = false));
    bottone.textContent = "Elimina";
  }
});
