// Header condiviso: campanella notifiche, badge ruolo, ingranaggio impostazioni
// e uscita. Ogni pagina autenticata chiama montaMenuUtente() passando il proprio
// contenitore (un elemento vuoto nell'intestazione) e i dati di user/profilo già
// ottenuti da proteggiPagina.
import { esciUtente, cambiaPassword, cambiaEmail, traduciErrore, ETICHETTE_RUOLO, ROLES } from "./auth.js";
import { elencaNotifiche, segnaNotificaLetta, salvaPreferenzeNotifiche } from "./dati/utenti.js";
import {
  ottieniCampagnaCorrente,
  elencaCampagneAttive,
  elencaCampagneDMConTitolo,
  scegliCampagna,
} from "./dati/campagne.js";
import { ottieniStatoSessione } from "./dati/sessioni.js";
import { esc } from "./utils.js";
import { ICONA_HOME, ICONA_MODIFICA, ICONA_SESSIONE, ICONA_CALENDARIO, ICONA_SI } from "./icone.js";
import { formattaDataOra, dataOraBreve } from "./calendario.js";
import { attivaDescrizioni } from "./descrizioni.js";
import {
  statoInstallazione,
  quandoCambiaInstallazione,
  installaApp,
  infoVersione,
  cercaAggiornamenti,
  applicaAggiornamento,
  quandoCambiaVersione,
} from "./pwa.js";
import { nomeVersione, versioneNuova } from "./versione.js";
import {
  statoNotifichePush,
  attivaNotifichePush,
  disattivaNotifichePush,
  riconfermaNotifichePush,
} from "./notifiche-push.js";
import { impostazioniSuoni, salvaImpostazioniSuoni, provaSuono } from "./suoni.js";

const HTML_MENU = `
  <a href="dashboard.html" class="btn-campanella" aria-label="Torna alla dashboard" title="Torna alla dashboard">${ICONA_HOME}</a>
  <button id="mu-btn-modifica-ordine" class="btn-campanella" aria-label="Modifica ordinamento" title="Modifica ordinamento" type="button" hidden>${ICONA_MODIFICA}</button>
  <a id="mu-link-sessione" href="sessione.html" class="btn-campanella" aria-label="Sessione" title="Sessione" hidden>${ICONA_SESSIONE}</a>
  <a href="calendario.html" class="btn-campanella" aria-label="Calendario" title="Calendario">${ICONA_CALENDARIO}</a>
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
  <span id="mu-badge-ruolo" class="role-badge nascosto-telefono"></span>
  <button id="mu-btn-impostazioni" class="btn-campanella" aria-label="Impostazioni" title="Impostazioni" type="button">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="6.3" fill="none" stroke="currentColor" stroke-width="3.5"/>
      <rect x="10.36" y="1.63" width="3.29" height="3.29" transform="rotate(0 12 12)"/>
      <rect x="10.36" y="1.63" width="3.29" height="3.29" transform="rotate(45 12 12)"/>
      <rect x="10.36" y="1.63" width="3.29" height="3.29" transform="rotate(90 12 12)"/>
      <rect x="10.36" y="1.63" width="3.29" height="3.29" transform="rotate(135 12 12)"/>
      <rect x="10.36" y="1.63" width="3.29" height="3.29" transform="rotate(180 12 12)"/>
      <rect x="10.36" y="1.63" width="3.29" height="3.29" transform="rotate(225 12 12)"/>
      <rect x="10.36" y="1.63" width="3.29" height="3.29" transform="rotate(270 12 12)"/>
      <rect x="10.36" y="1.63" width="3.29" height="3.29" transform="rotate(315 12 12)"/>
    </svg>
  </button>
  <button id="mu-btn-logout" class="btn btn-ghost nascosto-telefono" type="button">Esci</button>
`;

const HTML_MODALE = `
  <div id="mu-modal-impostazioni" class="modal-overlay" style="display:none;">
    <div class="modal-card">
      <button id="mu-chiudi-impostazioni" class="btn-chiudi-modal" aria-label="Chiudi" type="button">×</button>

      <div id="mu-schermata-scelta" class="impostazioni-schermata">
        <h2>Impostazioni account</h2>
        <p class="impostazioni-account solo-telefono"><span id="mu-nome-account"></span> <span id="mu-ruolo-account" class="role-badge"></span></p>
        <div class="field selettore-campagna-impostazioni" hidden>
          <label for="mu-select-campagna">Campagna</label>
          <select id="mu-select-campagna" class="select-campagna"></select>
        </div>
        <div class="impostazioni-opzioni">
          <button class="btn-tabella" data-apri="password" type="button">Cambia password</button>
          <button class="btn-tabella" data-apri="email" type="button">Cambia email</button>
          <button id="mu-btn-installa" class="btn-tabella" type="button" hidden>Installa l'app</button>
          <button class="btn-tabella" data-apri="notifiche" type="button">Notifiche</button>
          <button class="btn-tabella" data-apri="suoni" type="button">Effetti sonori</button>
          <a class="btn-tabella" href="guida.html">Guida e FAQ</a>
          <button id="mu-btn-logout-menu" class="btn-tabella btn-tabella-pericolo solo-telefono" type="button">Esci</button>
        </div>
        <div class="versione-app" id="mu-versione">
          <div class="versione-app-riga">
            <span class="versione-app-nome" id="mu-versione-nome">V. …</span>
            <span class="versione-app-stato" id="mu-versione-stato" role="status"></span>
          </div>
          <p class="versione-app-disponibile" id="mu-versione-nuova" hidden></p>
          <button type="button" class="btn-tabella" id="mu-versione-azione">Cerca aggiornamenti</button>
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
          <button type="submit" class="btn azione-salva" id="mu-btn-salva-password">Salva</button>
        </div>
      </form>

      <form id="mu-form-notifiche" class="impostazioni-schermata" hidden novalidate>
        <h2>Notifiche</h2>
        <div class="preferenza-riga">
          <div><b>Notifiche push</b><small id="mu-stato-push">Su questo dispositivo</small></div>
          <button id="mu-btn-notifiche" class="btn-tabella" type="button" hidden>Attiva le notifiche</button>
        </div>
        <p id="mu-nota-notifiche" class="impostazioni-nota" hidden></p>
        <h3 class="preferenze-titolo">Cosa ricevere</h3>
        <label class="preferenza-riga"><span><b>Sessione iniziata</b><small>Quando il DM apre la sessione</small></span><input type="checkbox" class="interruttore" data-tipo="sessione" /></label>
        <label class="preferenza-riga"><span><b>Date e sessioni</b><small>Date proposte e sessione confermata</small></span><input type="checkbox" class="interruttore" data-tipo="date" /></label>
        <label class="preferenza-riga"><span><b>Passaggi di livello</b><small>Quando il DM ti fa salire di livello</small></span><input type="checkbox" class="interruttore" data-tipo="livello" /></label>
        <label class="preferenza-riga"><span><b>Tocca a te</b><small>Quando arriva il turno del tuo personaggio in combattimento</small></span><input type="checkbox" class="interruttore" data-tipo="turno" /></label>
        <h3 class="preferenze-titolo">Non disturbare</h3>
        <label class="preferenza-riga"><span><b>Pausa notturna</b><small>Nessuna push in questa fascia; gli avvisi restano nella campanella</small></span><input type="checkbox" class="interruttore" id="mu-silenzio" /></label>
        <div class="preferenze-orari" id="mu-orari-silenzio">
          <label>dalle <input type="time" id="mu-silenzio-da" value="23:00" /></label>
          <label>alle <input type="time" id="mu-silenzio-a" value="08:00" /></label>
        </div>
        <p class="impostazioni-nota">Le scelte valgono per le push su tutti i tuoi dispositivi; la campanella mostra comunque tutto. Il silenzioso e la full immersion del telefono valgono sempre.</p>
        <div id="mu-messaggio-notifiche" class="message"></div>
        <div class="impostazioni-azioni">
          <button type="button" class="btn btn-ghost" data-indietro>Indietro</button>
          <button type="submit" class="btn" id="mu-btn-salva-notifiche">Salva</button>
        </div>
      </form>

      <form id="mu-form-suoni" class="impostazioni-schermata" hidden novalidate>
        <h2>Effetti sonori</h2>
        <label class="preferenza-riga"><span><b>Effetti sonori</b><small>Turno, dadi, contenuti, livello</small></span><input type="checkbox" class="interruttore" id="mu-suoni-attivi" /></label>
        <label class="preferenza-riga"><span><b>Volume</b><small id="mu-suoni-percentuale">60%</small></span><input type="range" class="volume-suoni" id="mu-suoni-volume" min="0" max="100" step="5" /></label>
        <div class="preferenza-riga">
          <span><b>Prova</b><small>Il suono di «Tocca a te»</small></span>
          <button type="button" class="btn-tabella" id="mu-suoni-prova">Prova</button>
        </div>
        <p class="impostazioni-nota">Valgono per questo dispositivo. Nessun suono sullo schermo del tavolo né a pagina nascosta.</p>
        <div class="impostazioni-azioni">
          <button type="button" class="btn btn-ghost" data-indietro>Indietro</button>
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
    const chi = notifica.personaggio ? `${esc(notifica.personaggio)}: ` : "";
    const dove = notifica.campagnaTitolo ? ` in «${esc(notifica.campagnaTitolo)}»` : "";
    return `Passaggio di livello${dove}: ${chi}${esc(notifica.livelloPrecedente)} → ${esc(notifica.livelloNuovo)}`;
  }
  if (notifica.tipo === "livello_annullato") {
    const quale = notifica.livelloAnnullato ? ` al ${esc(notifica.livelloAnnullato)}° livello` : " di livello";
    return `Il DM ha annullato il passaggio${quale}${notifica.campagnaTitolo ? ` in «${esc(notifica.campagnaTitolo)}»` : ""}`;
  }
  if (notifica.tipo === "proposta_sessione") {
    const quante = notifica.date === 1 ? "una data" : `${esc(notifica.date)} date`;
    return `Il DM propone ${quante} per la prossima sessione${notifica.titolo ? ` (${esc(notifica.titolo)})` : ""}: <a href="calendario.html">rispondi nel calendario</a>`;
  }
  if (notifica.tipo === "sessione_iniziata") {
    return `La sessione ${esc(notifica.numero)} è iniziata${notifica.titolo ? ` — ${esc(notifica.titolo)}` : ""}: <a href="sessione.html">raggiungi il tavolo</a>`;
  }
  if (notifica.tipo === "sessione_confermata") {
    return `Sessione ${esc(notifica.numero)} confermata: ${esc(formattaDataOra(notifica.data, notifica.ora))}${notifica.titolo ? ` — ${esc(notifica.titolo)}` : ""} · <a href="calendario.html">calendario</a>`;
  }
  return "Notifica";
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

function renderNotifiche(tutte, uid) {
  // "Tocca a te" è solo una push: non resta nella campanella.
  const notifiche = tutte.filter((n) => n.tipo !== "turno");
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
      <div class="notifica-riga ${n.letta ? "" : "non-letta"}" data-id="${esc(n.id)}">
        <span class="notifica-testo">${testoNotifica(n)}</span>
        <span class="notifica-data">${dataOraBreve(n.creataIl)}</span>
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

// Riquadro «Versione» in fondo alle Impostazioni (tavola "Versione dell'app"):
// «V. 09.10.2026 · codice», lo stato e «Cerca aggiornamenti» / «Aggiorna ora».
function montaVersione() {
  const nome = document.getElementById("mu-versione-nome");
  const stato = document.getElementById("mu-versione-stato");
  const nuova = document.getElementById("mu-versione-nuova");
  const azione = document.getElementById("mu-versione-azione");
  let pronta = false; // c'è una versione nuova in attesa
  let occupato = false;

  function mostraStato(testo, tipo, icona = false) {
    stato.className = `versione-app-stato${tipo ? ` versione-app-${tipo}` : ""}`;
    stato.innerHTML = icona ? ICONA_SI : "";
    stato.append(testo);
  }

  function disegna({ supportato, attuale, inAttesa }, messaggio = null) {
    nome.textContent = nomeVersione(attuale) || (supportato ? "V. precedente" : "V. —");
    pronta = versioneNuova(attuale, inAttesa);
    nuova.hidden = !pronta;
    if (pronta) {
      nuova.textContent = "";
      const b = document.createElement("b");
      b.textContent = nomeVersione(inAttesa);
      nuova.append("Disponibile la ", b);
      mostraStato("Da aggiornare", "nuova");
    } else if (messaggio) {
      mostraStato(messaggio.testo, messaggio.tipo, messaggio.tipo === "ok");
    } else {
      mostraStato("Aggiornata", "ok", true);
    }
    azione.textContent = pronta ? "Aggiorna ora" : "Cerca aggiornamenti";
    azione.classList.toggle("btn-tabella-evidenza", pronta);
    azione.disabled = !supportato;
  }

  async function aggiorna(messaggio) {
    disegna(await infoVersione(), messaggio);
  }

  azione.addEventListener("click", async () => {
    if (occupato) return;
    if (pronta) {
      azione.disabled = true;
      azione.textContent = "Aggiorno…";
      if (!(await applicaAggiornamento())) aggiorna();
      return;
    }
    occupato = true;
    azione.disabled = true;
    azione.textContent = "Cerco…";
    mostraStato("Controllo…", "cerca");
    try {
      const info = await cercaAggiornamenti();
      disegna(info, { testo: "Nessun aggiornamento", tipo: "ok" });
    } catch (errore) {
      console.warn("Aggiornamenti non controllati", errore);
      await aggiorna({ testo: "Impossibile controllare ora", tipo: "errore" });
    } finally {
      occupato = false;
    }
  });
  quandoCambiaVersione(() => aggiorna());
  return { aggiorna };
}

function inizializzaImpostazioni() {
  const modale = document.getElementById("mu-modal-impostazioni");
  const formPassword = document.getElementById("mu-form-password");
  const formEmail = document.getElementById("mu-form-email");
  const msgPassword = document.getElementById("mu-messaggio-password");
  const msgEmail = document.getElementById("mu-messaggio-email");

  const versione = montaVersione();
  document.getElementById("mu-btn-impostazioni").addEventListener("click", () => {
    mostraSchermata("mu-schermata-scelta");
    modale.style.display = "flex";
    versione.aggiorna();
  });

  document.getElementById("mu-chiudi-impostazioni").addEventListener("click", () => {
    modale.style.display = "none";
    resetForm(formPassword, msgPassword);
    resetForm(formEmail, msgEmail);
  });

  modale.querySelectorAll("[data-apri]").forEach((bottone) => {
    bottone.addEventListener("click", () => mostraSchermata(`mu-form-${bottone.dataset.apri}`));
  });

  // Effetti sonori (suoni.js): valgono subito, salvati sul dispositivo.
  const attivi = document.getElementById("mu-suoni-attivi");
  const volume = document.getElementById("mu-suoni-volume");
  const percentuale = document.getElementById("mu-suoni-percentuale");
  const mostraSuoni = () => {
    const { attivi: si, volume: v } = impostazioniSuoni();
    attivi.checked = si;
    volume.value = String(Math.round(v * 100));
    volume.disabled = !si;
    percentuale.textContent = `${Math.round(v * 100)}%`;
  };
  mostraSuoni();
  attivi.addEventListener("change", () => { salvaImpostazioniSuoni({ attivi: attivi.checked }); mostraSuoni(); });
  volume.addEventListener("input", () => { salvaImpostazioniSuoni({ volume: Number(volume.value) / 100 }); mostraSuoni(); });
  document.getElementById("mu-suoni-prova").addEventListener("click", provaSuono);

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

// Preferenze delle push (pannello ⚙️ → Notifiche): tipi accesi o spenti e
// fascia "non disturbare". Le applica la Cloud Function inviaNotificaPush.
function inizializzaPreferenzeNotifiche(uid, preferenze = {}) {
  const form = document.getElementById("mu-form-notifiche");
  const messaggio = document.getElementById("mu-messaggio-notifiche");
  const silenzio = document.getElementById("mu-silenzio");
  const orari = document.getElementById("mu-orari-silenzio");
  const caselle = [...form.querySelectorAll("[data-tipo]")];
  const riempi = (p) => {
    caselle.forEach((c) => (c.checked = p?.tipi?.[c.dataset.tipo] !== false));
    silenzio.checked = Boolean(p?.silenzio?.attivo);
    document.getElementById("mu-silenzio-da").value = p?.silenzio?.da || "23:00";
    document.getElementById("mu-silenzio-a").value = p?.silenzio?.a || "08:00";
    orari.hidden = !silenzio.checked;
  };
  riempi(preferenze);
  silenzio.onchange = () => (orari.hidden = !silenzio.checked);
  form.onsubmit = async (evento) => {
    evento.preventDefault();
    const nuove = {
      tipi: Object.fromEntries(caselle.map((c) => [c.dataset.tipo, c.checked])),
      silenzio: {
        attivo: silenzio.checked,
        da: document.getElementById("mu-silenzio-da").value || "23:00",
        a: document.getElementById("mu-silenzio-a").value || "08:00",
      },
      fuso: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Rome",
    };
    const bottone = document.getElementById("mu-btn-salva-notifiche");
    bottone.disabled = true;
    try {
      await salvaPreferenzeNotifiche(uid, nuove);
      preferenze = nuove;
      mostraMessaggio(messaggio, "Preferenze salvate.", "success");
    } catch (errore) {
      console.error(errore);
      mostraMessaggio(messaggio, "Impossibile salvare le preferenze: riprova.", "error");
    } finally {
      bottone.disabled = false;
    }
  };
  // Tornando indietro senza salvare si ritrovano le scelte salvate.
  form.querySelector("[data-indietro]").addEventListener("click", () => {
    riempi(preferenze);
    nascondiMessaggio(messaggio);
  });
}

// Notifiche push nel pannello ⚙️: un pulsante per attivarle o spegnerle su
// questo dispositivo, oppure una nota se non si possono avere (vedi
// notifiche-push.js).
const NOTE_NOTIFICHE = {
  "attive": "Su questo dispositivo ricevi gli avvisi della campanella anche ad app chiusa.",
  "bloccate": "Le notifiche sono bloccate: riattivale dalle impostazioni del browser o del telefono per questo sito.",
  "serve-installazione": "Su iPhone e iPad le notifiche arrivano solo all'app installata: installala e attivale da lì.",
};

function inizializzaNotifichePush(uid) {
  const bottone = document.getElementById("mu-btn-notifiche");
  const nota = document.getElementById("mu-nota-notifiche");
  const aggiorna = (stato = statoNotifichePush(uid)) => {
    bottone.hidden = stato !== "attive" && stato !== "spente";
    bottone.textContent = stato === "attive" ? "Disattiva le notifiche" : "Attiva le notifiche";
    nota.textContent = NOTE_NOTIFICHE[stato] || "";
    nota.hidden = !nota.textContent;
  };
  aggiorna();
  quandoCambiaInstallazione(() => aggiorna());
  bottone.onclick = async () => {
    bottone.disabled = true;
    try {
      if (statoNotifichePush(uid) === "attive") {
        await disattivaNotifichePush(uid);
        aggiorna();
      } else {
        aggiorna(await attivaNotifichePush(uid));
      }
    } catch (errore) {
      console.error(errore);
      aggiorna();
      nota.textContent = "Non è stato possibile attivare le notifiche: riprova più tardi.";
      nota.hidden = false;
    } finally {
      bottone.disabled = false;
    }
  };
  riconfermaNotifichePush(uid).then(() => aggiorna());
}

// Selettore della campagna: compare solo a chi ha più di una campagna attiva
// (DM con più gruppi, giocatore in più tavoli). La scelta resta in questo
// browser e la pagina si ricarica sulla campagna scelta.
let campagneAttive = null;
async function caricaCampagneAttive(uid, ruolo) {
  if (!campagneAttive) {
    // Il DM vede il titolo vero anche delle campagne con titolo provvisorio.
    // Un DM o admin può anche giocare nella campagna di un altro: le vede tutte.
    campagneAttive = ruolo === ROLES.PLAYER
      ? elencaCampagneAttive(uid, ruolo)
      : Promise.all([elencaCampagneAttive(uid, ruolo), elencaCampagneDMConTitolo(uid)]).then(([attive, mie]) => {
        const titoli = new Map(mie.map((c) => [c.id, c.titolo]));
        return attive.map((c) => (titoli.has(c.id) ? { ...c, titolo: titoli.get(c.id) } : c));
      });
  }
  return campagneAttive;
}

export async function riempiSelettoreCampagna(select, uid, ruolo) {
  const [attive, corrente] = await Promise.all([caricaCampagneAttive(uid, ruolo), ottieniCampagnaCorrente(uid, ruolo)]);
  if (attive.length < 2) return false;
  // Accanto al titolo il proprio ruolo, se si è DM di una e giocatori di un'altra.
  const misto = new Set(attive.map((c) => c.mioRuolo)).size > 1;
  select.innerHTML = attive
    .map((c, i) => {
      const titolo = c.titolo || `Campagna ${i + 1} (titolo ancora segreto)`;
      const ruoloTesto = misto ? ` — ${c.mioRuolo === ROLES.DM ? "DM" : "giocatore"}` : "";
      return `<option value="${esc(c.id)}"${c.id === corrente?.id ? " selected" : ""}>${esc(titolo + ruoloTesto)}</option>`;
    })
    .join("");
  select.onchange = () => {
    scegliCampagna(uid, select.value);
    window.location.reload();
  };
  return true;
}

// Link "Sessione" nell'header: porta alla pagina dedicata (sessione.html), non
// più a una modale. Sempre visibile al DM/admin; a un giocatore compare SOLO
// quando la sua campagna attiva ha una sessione segnata "in corso" — stato
// letto una sola volta al caricamento della pagina (come le notifiche), quindi
// un giocatore già sulla pagina non lo vede comparire in tempo reale se il DM
// la apre nel frattempo.
async function inizializzaLinkSessione(uid, ruolo) {
  const link = document.getElementById("mu-link-sessione");
  if (ruolo === ROLES.DM || ruolo === ROLES.ADMIN) {
    link.hidden = false;
    return;
  }
  try {
    const campagna = await ottieniCampagnaCorrente(uid, ruolo);
    if (!campagna) {
      link.hidden = true;
      return;
    }
    const stato = await ottieniStatoSessione(campagna.id);
    link.hidden = !stato.inCorso;
  } catch (errore) {
    console.error(errore);
  }
}

// Disegna l'header condiviso dentro `contenitore` e prepara il pannello impostazioni.
// { contenitore, user, profilo, onModificaOrdine } — profilo può essere null (schede non
// ancora normalizzate). onModificaOrdine, se passata, fa comparire la matita che attiva/
// disattiva il riordinamento sulla pagina corrente (trasformandosi in una spunta):
// riceve true quando si entra in modalità modifica, false quando si conferma.
export async function montaMenuUtente({ contenitore, user, profilo, onModificaOrdine }) {
  contenitore.innerHTML = HTML_MENU;
  attivaDescrizioni();

  if (!document.getElementById("mu-modal-impostazioni")) {
    document.body.insertAdjacentHTML("beforeend", HTML_MODALE);
    inizializzaImpostazioni();
  }

  const ruolo = profilo?.ruolo || "player";
  const elementoBadgeRuolo = document.getElementById("mu-badge-ruolo");
  elementoBadgeRuolo.textContent = ETICHETTE_RUOLO[ruolo] || ruolo;
  elementoBadgeRuolo.dataset.ruolo = ruolo;

  // Sui telefoni ruolo ed "Esci" stanno nel pannello delle impostazioni.
  const ruoloAccount = document.getElementById("mu-ruolo-account");
  ruoloAccount.textContent = elementoBadgeRuolo.textContent;
  ruoloAccount.dataset.ruolo = ruolo;
  document.getElementById("mu-nome-account").textContent = profilo?.nome || user.email || "";

  const esci = async () => {
    await disattivaNotifichePush(user.uid).catch(() => {});
    await esciUtente();
    window.location.href = "index.html";
  };
  document.getElementById("mu-btn-logout").addEventListener("click", esci);
  document.getElementById("mu-btn-logout-menu").onclick = esci;

  const btnInstalla = document.getElementById("mu-btn-installa");
  const aggiornaInstalla = ({ possibile }) => {
    btnInstalla.hidden = !possibile;
  };
  aggiornaInstalla(statoInstallazione());
  quandoCambiaInstallazione(aggiornaInstalla);
  btnInstalla.onclick = installaApp;
  inizializzaNotifichePush(user.uid);
  inizializzaPreferenzeNotifiche(user.uid, profilo?.preferenzeNotifiche);

  const btnModificaOrdine = document.getElementById("mu-btn-modifica-ordine");
  if (onModificaOrdine) {
    btnModificaOrdine.hidden = false;
    let attivo = false;
    btnModificaOrdine.addEventListener("click", () => {
      attivo = !attivo;
      btnModificaOrdine.innerHTML = attivo ? ICONA_SI : ICONA_MODIFICA;
      const etichetta = attivo ? "Conferma ordinamento" : "Modifica ordinamento";
      btnModificaOrdine.title = etichetta;
      btnModificaOrdine.setAttribute("aria-label", etichetta);
      onModificaOrdine(attivo);
    });
  }

  riempiSelettoreCampagna(document.getElementById("mu-select-campagna"), user.uid, ruolo)
    .then((mostra) => {
      document.querySelector(".selettore-campagna-impostazioni").hidden = !mostra;
    })
    .catch((errore) => console.error(errore));

  await inizializzaLinkSessione(user.uid, ruolo);

  // Restituisce l'elenco notifiche già recuperato, così una pagina come la
  // dashboard (che ne mostra un riepilogo a parte) non deve rileggerlo due volte.
  return inizializzaNotifiche(user.uid);
}
