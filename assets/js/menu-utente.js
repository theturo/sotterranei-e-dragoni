// Header condiviso: campanella notifiche, badge ruolo, ingranaggio impostazioni
// e uscita. Ogni pagina autenticata chiama montaMenuUtente() passando il proprio
// contenitore (un elemento vuoto nell'intestazione) e i dati di user/profilo già
// ottenuti da proteggiPagina.
import {
  esciUtente,
  elencaNotifiche,
  segnaNotificaLetta,
  cambiaPassword,
  cambiaEmail,
  traduciErrore,
  ETICHETTE_RUOLO,
} from "./auth.js";

const HTML_MENU = `
  <a href="dashboard.html" class="btn-campanella" aria-label="Torna alla dashboard" title="Torna alla dashboard">🏠</a>
  <button id="mu-btn-modifica-ordine" class="btn-campanella" aria-label="Modifica ordinamento" title="Modifica ordinamento" type="button" hidden>✏️</button>
  <div class="notifiche-wrap">
    <button id="mu-btn-campanella" class="btn-campanella" aria-label="Notifiche" type="button">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
      </svg>
      <span id="mu-badge-non-lette" class="badge-non-lette" hidden></span>
    </button>
    <div id="mu-dropdown-notifiche" class="dropdown-notifiche" hidden>
      <div class="dropdown-notifiche-titolo">Notifiche</div>
      <div id="mu-lista-notifiche"></div>
      <p id="mu-nessuna-notifica" class="dropdown-notifiche-vuoto" hidden>Nessuna notifica.</p>
    </div>
  </div>
  <span id="mu-badge-ruolo" class="role-badge"></span>
  <button id="mu-btn-impostazioni" class="btn-campanella" aria-label="Impostazioni" title="Impostazioni" type="button">⚙</button>
  <button id="mu-btn-logout" class="btn btn-ghost" type="button">Esci</button>
`;

const HTML_MODALE = `
  <div id="mu-modal-impostazioni" class="modal-overlay" style="display:none;">
    <div class="modal-card">
      <button id="mu-chiudi-impostazioni" class="btn-chiudi-modal" aria-label="Chiudi" type="button">×</button>

      <div id="mu-schermata-scelta" class="impostazioni-schermata">
        <h2>Impostazioni account</h2>
        <div class="impostazioni-opzioni">
          <button class="btn-tabella" data-apri="password" type="button">Cambia password</button>
          <button class="btn-tabella" data-apri="email" type="button">Cambia email</button>
        </div>
      </div>

      <form id="mu-form-password" class="impostazioni-schermata" hidden novalidate>
        <h2>Cambia password</h2>
        <p class="card-tagline">Inserisci la password attuale e quella nuova.</p>
        <div class="field"><label for="mu-password-attuale-1">Password attuale</label><input type="password" id="mu-password-attuale-1" autocomplete="current-password" required /></div>
        <div class="field"><label for="mu-password-nuova">Nuova password</label><input type="password" id="mu-password-nuova" autocomplete="new-password" required /></div>
        <div class="field"><label for="mu-password-nuova-conferma">Ripeti la nuova password</label><input type="password" id="mu-password-nuova-conferma" autocomplete="new-password" required /></div>
        <div id="mu-messaggio-password" class="message"></div>
        <div class="impostazioni-azioni">
          <button type="button" class="btn btn-ghost" data-indietro>Indietro</button>
          <button type="submit" class="btn" id="mu-btn-salva-password">Salva</button>
        </div>
      </form>

      <form id="mu-form-email" class="impostazioni-schermata" hidden novalidate>
        <h2>Cambia email</h2>
        <p class="card-tagline">Riceverai un'email di conferma al nuovo indirizzo: il cambio sarà effettivo solo dopo averla confermata.</p>
        <div class="field"><label for="mu-password-attuale-2">Password attuale</label><input type="password" id="mu-password-attuale-2" autocomplete="current-password" required /></div>
        <div class="field"><label for="mu-email-nuova">Nuova email</label><input type="email" id="mu-email-nuova" autocomplete="email" required /></div>
        <div id="mu-messaggio-email" class="message"></div>
        <div class="impostazioni-azioni">
          <button type="button" class="btn btn-ghost" data-indietro>Indietro</button>
          <button type="submit" class="btn" id="mu-btn-salva-email">Invia conferma</button>
        </div>
      </form>
    </div>
  </div>
`;

function testoNotifica(notifica) {
  if (notifica.tipo === "livello_su") {
    return `Passaggio di livello: ${notifica.livelloPrecedente} → ${notifica.livelloNuovo}`;
  }
  return "Notifica";
}

function formattaDataNotifica(timestamp) {
  if (!timestamp?.toDate) return "";
  return timestamp.toDate().toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function aggiornaBadgeNonLette(count) {
  const badge = document.getElementById("mu-badge-non-lette");
  if (count > 0) {
    badge.textContent = String(count);
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

function renderNotifiche(notifiche, uid) {
  const lista = document.getElementById("mu-lista-notifiche");
  const vuoto = document.getElementById("mu-nessuna-notifica");

  if (notifiche.length === 0) {
    lista.innerHTML = "";
    vuoto.hidden = false;
  } else {
    vuoto.hidden = true;
    lista.innerHTML = notifiche
      .map(
        (n) => `
      <div class="notifica-riga ${n.letta ? "" : "non-letta"}" data-id="${n.id}">
        <span class="notifica-testo">${testoNotifica(n)}</span>
        <span class="notifica-data">${formattaDataNotifica(n.creataIl)}</span>
      </div>`
      )
      .join("");
  }

  aggiornaBadgeNonLette(notifiche.filter((n) => !n.letta).length);

  lista.querySelectorAll(".notifica-riga.non-letta").forEach((riga) => {
    riga.addEventListener(
      "click",
      async () => {
        riga.classList.remove("non-letta");
        try {
          await segnaNotificaLetta(uid, riga.dataset.id);
        } catch (errore) {
          console.error(errore);
        }
        aggiornaBadgeNonLette(document.querySelectorAll("#mu-lista-notifiche .notifica-riga.non-letta").length);
      },
      { once: true }
    );
  });
}

async function inizializzaNotifiche(uid) {
  const btnCampanella = document.getElementById("mu-btn-campanella");
  const dropdown = document.getElementById("mu-dropdown-notifiche");

  btnCampanella.addEventListener("click", (evento) => {
    evento.stopPropagation();
    dropdown.hidden = !dropdown.hidden;
  });
  document.addEventListener("click", (evento) => {
    if (!dropdown.hidden && !dropdown.contains(evento.target) && evento.target !== btnCampanella) {
      dropdown.hidden = true;
    }
  });

  try {
    const notifiche = await elencaNotifiche(uid);
    renderNotifiche(notifiche, uid);
    return notifiche;
  } catch (errore) {
    console.error(errore);
    renderNotifiche([], uid);
    return [];
  }
}

function mostraMessaggio(elemento, testo, tipo) {
  elemento.textContent = testo;
  elemento.className = `message visible ${tipo}`;
}

function nascondiMessaggio(elemento) {
  elemento.textContent = "";
  elemento.className = "message";
}

function mostraSchermata(nome) {
  document.querySelectorAll("#mu-modal-impostazioni .impostazioni-schermata").forEach((schermata) => {
    schermata.hidden = schermata.id !== nome;
  });
}

function resetForm(form, messaggio) {
  form.reset();
  nascondiMessaggio(messaggio);
}

function inizializzaImpostazioni() {
  const modale = document.getElementById("mu-modal-impostazioni");
  const formPassword = document.getElementById("mu-form-password");
  const formEmail = document.getElementById("mu-form-email");
  const msgPassword = document.getElementById("mu-messaggio-password");
  const msgEmail = document.getElementById("mu-messaggio-email");

  document.getElementById("mu-btn-impostazioni").addEventListener("click", () => {
    mostraSchermata("mu-schermata-scelta");
    modale.style.display = "flex";
  });

  document.getElementById("mu-chiudi-impostazioni").addEventListener("click", () => {
    modale.style.display = "none";
    resetForm(formPassword, msgPassword);
    resetForm(formEmail, msgEmail);
  });

  modale.querySelectorAll("[data-apri]").forEach((bottone) => {
    bottone.addEventListener("click", () => mostraSchermata(`mu-form-${bottone.dataset.apri}`));
  });

  modale.querySelectorAll("[data-indietro]").forEach((bottone) => {
    bottone.addEventListener("click", () => {
      resetForm(formPassword, msgPassword);
      resetForm(formEmail, msgEmail);
      mostraSchermata("mu-schermata-scelta");
    });
  });

  formPassword.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const attuale = document.getElementById("mu-password-attuale-1").value;
    const nuova = document.getElementById("mu-password-nuova").value;
    const conferma = document.getElementById("mu-password-nuova-conferma").value;

    if (nuova !== conferma) {
      mostraMessaggio(msgPassword, "Le due password non coincidono.", "error");
      return;
    }
    if (nuova.length < 6) {
      mostraMessaggio(msgPassword, "La nuova password deve avere almeno 6 caratteri.", "error");
      return;
    }

    const bottone = document.getElementById("mu-btn-salva-password");
    bottone.disabled = true;
    try {
      await cambiaPassword(attuale, nuova);
      mostraMessaggio(msgPassword, "Password aggiornata.", "success");
      formPassword.reset();
    } catch (errore) {
      mostraMessaggio(msgPassword, traduciErrore(errore.code), "error");
    } finally {
      bottone.disabled = false;
    }
  });

  formEmail.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const attuale = document.getElementById("mu-password-attuale-2").value;
    const nuovaEmail = document.getElementById("mu-email-nuova").value.trim();

    const bottone = document.getElementById("mu-btn-salva-email");
    bottone.disabled = true;
    try {
      await cambiaEmail(attuale, nuovaEmail);
      mostraMessaggio(msgEmail, "Controlla la nuova casella di posta e clicca il link per confermare il cambio.", "success");
      formEmail.reset();
    } catch (errore) {
      mostraMessaggio(msgEmail, traduciErrore(errore.code), "error");
    } finally {
      bottone.disabled = false;
    }
  });
}

// Disegna l'header condiviso dentro `contenitore` e prepara il pannello impostazioni.
// { contenitore, user, profilo, onModificaOrdine } — profilo può essere null (schede non
// ancora normalizzate). onModificaOrdine, se passata, fa comparire la matita che attiva/
// disattiva il riordinamento sulla pagina corrente (trasformandosi in una spunta):
// riceve true quando si entra in modalità modifica, false quando si conferma.
export async function montaMenuUtente({ contenitore, user, profilo, onModificaOrdine }) {
  contenitore.innerHTML = HTML_MENU;

  if (!document.getElementById("mu-modal-impostazioni")) {
    document.body.insertAdjacentHTML("beforeend", HTML_MODALE);
    inizializzaImpostazioni();
  }

  const ruolo = profilo?.ruolo || "player";
  document.getElementById("mu-badge-ruolo").textContent = ETICHETTE_RUOLO[ruolo] || ruolo;

  document.getElementById("mu-btn-logout").addEventListener("click", async () => {
    await esciUtente();
    window.location.href = "index.html";
  });

  const btnModificaOrdine = document.getElementById("mu-btn-modifica-ordine");
  if (onModificaOrdine) {
    btnModificaOrdine.hidden = false;
    let attivo = false;
    btnModificaOrdine.addEventListener("click", () => {
      attivo = !attivo;
      btnModificaOrdine.textContent = attivo ? "✓" : "✏️";
      const etichetta = attivo ? "Conferma ordinamento" : "Modifica ordinamento";
      btnModificaOrdine.title = etichetta;
      btnModificaOrdine.setAttribute("aria-label", etichetta);
      onModificaOrdine(attivo);
    });
  }

  // Restituisce l'elenco notifiche già recuperato, così una pagina come la
  // dashboard (che ne mostra un riepilogo a parte) non deve rileggerlo due volte.
  return inizializzaNotifiche(user.uid);
}
