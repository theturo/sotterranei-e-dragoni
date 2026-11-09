// Guscio delle pagine ridisegnate (dashboard e pagine interne): barra laterale
// al computer, che sul telefono diventa un cassetto aperto dal pulsante ☰, e
// testata compatta con campanella e ingranaggio (variante compatta di
// menu-utente.js). La barra ha le stesse voci e lo stesso ordine delle tessere
// della dashboard: segue il ruolo nella campagna corrente, mentre
// «Amministrazione» segue il ruolo dell'account.
//
// Ogni pagina ha nel suo HTML: <aside id="rd-barra" class="rd-barra">, il velo
// #rd-velo, il pulsante #rd-btn-menu e lo #slot-utente nella testata; la voce
// accesa è body[data-voce]. Le pagine sulla campagna corrente hanno anche la
// riga #rd-riga-campagna (nome e ruolo) sopra il titolo.
import { ROLES, ETICHETTE_RUOLO } from "./auth.js";
import { contaUtentiInAttesa } from "./dati/utenti.js";
import { ottieniCampagnaCorrente } from "./dati/campagne.js";
import { montaMenuUtente, apriImpostazioni, esciDalSito, campagneAttiveConTitolo } from "./menu-utente.js";
import { gruppiStrumenti, ordinaVoci, titoloCampagnaVisibile } from "./cruscotto-calcoli.js";
import { icona, ICONA_HOME } from "./icone.js";
import { esc } from "./utils.js";

// Contatori che alcune voci portano con sé (barra laterale e tessere).
export const extraVoce = (chiave) =>
  (chiave === "sessione" ? '<span class="rd-punto-live" data-sessione-live hidden></span>' : "")
  + (chiave === "utenti" ? '<span class="rd-conta" data-conta-utenti hidden></span>' : "");

const stato = { voce: "", gruppi: [], ordine: {}, iscritti: 0, sessioneInCorso: false };

function htmlBarra(nome, ruoloAccount) {
  const iniziale = (nome || "?").trim().charAt(0).toUpperCase();
  return `
    <div class="rd-barra-testa">
      <a class="rd-marchio" href="dashboard.html" aria-label="Sotterranei &amp; Dragoni, dashboard">
        <img src="assets/img/intro/logo_emblema.webp" width="645" height="720" alt="" />
        <span class="rd-marchio-scritta" aria-hidden="true">Sotterranei<br />&amp; Dragoni</span>
      </a>
      <button type="button" class="rd-chiudi-cassetto" data-chiudi-cassetto aria-label="Chiudi il menu">×</button>
    </div>
    <nav class="rd-nav" data-rd-nav aria-label="Pagine"></nav>
    <div class="rd-account">
      <div class="rd-account-chi">
        <span class="rd-avatar" aria-hidden="true">${esc(iniziale)}</span>
        <span class="rd-account-testi"><b>${esc(nome)}</b><small>${esc(ETICHETTE_RUOLO[ruoloAccount] || ruoloAccount)}</small></span>
      </div>
      <div class="rd-account-azioni">
        <button type="button" class="rd-voce" data-rd-impostazioni title="Impostazioni"><span class="rd-voce-icona" aria-hidden="true">${icona("impostazioni")}</span><span class="rd-voce-testo">Impostazioni</span></button>
        <button type="button" class="rd-voce" data-rd-esci title="Esci"><span class="rd-voce-icona" aria-hidden="true">${icona("porta")}</span><span class="rd-voce-testo">Esci</span></button>
      </div>
    </div>`;
}

// Le voci, con la pagina corrente accesa. Il title resta per la barra a sole icone.
function disegnaNavigazione() {
  const nav = document.querySelector("[data-rd-nav]");
  if (!nav) return;
  const voce = (chiave, link, titolo, simbolo, extra = "") => {
    const attiva = chiave === stato.voce;
    return `<a class="rd-voce${attiva ? " attiva" : ""}" href="${esc(link)}" title="${esc(titolo)}"${attiva ? ' aria-current="page"' : ""}><span class="rd-voce-icona" aria-hidden="true">${simbolo}</span><span class="rd-voce-testo">${esc(titolo)}</span>${extra}</a>`;
  };
  nav.innerHTML = voce("dashboard", "dashboard.html", "Dashboard", ICONA_HOME)
    + stato.gruppi.map((g) => `<p class="rd-nav-gruppo">${esc(g.titolo)}</p>${ordinaVoci(g.voci, stato.ordine[g.id])
      .map((v) => voce(v.chiave, v.link, v.titolo, icona(v.icona), extraVoce(v.chiave))).join("")}`).join("");
  mostraIscritti();
  mostraSessioneInCorso();
}

// Iscritti da approvare (solo admin): su «Gestione utenti» nella barra e, nella
// dashboard, sulla tessera.
function mostraIscritti() {
  const quanti = stato.iscritti;
  document.querySelectorAll("[data-conta-utenti]").forEach((conta) => {
    conta.textContent = String(quanti);
    conta.hidden = !quanti;
    conta.title = quanti === 1 ? "1 iscritto da approvare" : `${quanti} iscritti da approvare`;
  });
}

function mostraSessioneInCorso() {
  document.querySelectorAll("[data-sessione-live]").forEach((punto) => { punto.hidden = !stato.sessioneInCorso; });
}

// Pallino accanto a «Sessione» quando il tavolo è aperto (lo sa la dashboard).
export function segnaSessioneInCorso() {
  stato.sessioneInCorso = true;
  mostraSessioneInCorso();
}

// Dopo un riordino delle tessere (dashboard): stesso ordine nella barra.
export function aggiornaOrdineBarra(sezione, chiavi) {
  stato.ordine[sezione] = chiavi;
  disegnaNavigazione();
}

// Riga «nome della campagna · ruolo» sopra il titolo delle pagine che lavorano
// sulla campagna corrente. Il DM legge il titolo vero anche se provvisorio.
async function montaRigaCampagna(uid, ruoloAccount, campagna) {
  const riga = document.getElementById("rd-riga-campagna");
  if (!riga || !campagna) return;
  let titolo = titoloCampagnaVisibile(campagna);
  try {
    const conTitolo = (await campagneAttiveConTitolo(uid, ruoloAccount)).find((c) => c.id === campagna.id);
    if (conTitolo?.titolo) titolo = conTitolo.titolo;
  } catch (errore) {
    console.error(errore);
  }
  riga.innerHTML = `<span class="rd-riga-campagna-nome">${esc(titolo)}</span><span class="rd-targhetta" title="Il tuo ruolo in questa campagna">${campagna.mioRuolo === ROLES.PLAYER ? "Giocatore" : "DM"}</span>`;
  riga.hidden = false;
}

// Cassetto (sotto i 900 px): si apre con ☰ e si chiude toccando il velo, con
// la ×, con Esc o con il tasto Indietro del telefono (lo stato è nella
// cronologia). Mentre è aperto il resto della pagina è inerte e non scorre.
function montaCassetto(barra, chiudiPrimaDi) {
  const bottone = document.getElementById("rd-btn-menu");
  const velo = document.getElementById("rd-velo");
  const principale = document.querySelector(".rd-principale");
  if (!bottone || !velo) return;
  const telefono = window.matchMedia("(max-width: 899px)");
  let aperto = false;
  let destinazione = null;

  const imposta = (si) => {
    aperto = si;
    document.body.classList.toggle("rd-cassetto-aperto", si);
    bottone.setAttribute("aria-expanded", String(si));
    velo.hidden = !si;
    if (principale) principale.inert = si;
    if (si) barra.querySelector(".rd-voce.attiva, .rd-voce")?.focus();
    else if (telefono.matches) bottone.focus({ preventScroll: true });
  };
  const apri = () => {
    if (aperto) return;
    imposta(true);
    history.pushState({ rdCassetto: true }, "");
  };
  const chiudi = () => {
    if (!aperto) return;
    if (history.state?.rdCassetto) history.back();
    else imposta(false);
  };
  chiudiPrimaDi.chiudi = chiudi;

  bottone.addEventListener("click", apri);
  velo.addEventListener("click", chiudi);
  barra.addEventListener("click", (evento) => {
    if (evento.target.closest("[data-chiudi-cassetto]")) chiudi();
    // Una voce scelta dal cassetto: prima si toglie lo stato del cassetto dalla
    // cronologia, poi si cambia pagina (così Indietro non riapre la pagina vecchia).
    const link = evento.target.closest("a[href]");
    if (link && aperto && history.state?.rdCassetto && !evento.ctrlKey && !evento.metaKey) {
      evento.preventDefault();
      destinazione = link.href;
      history.back();
    }
  });
  window.addEventListener("popstate", () => {
    if (aperto) imposta(false);
    if (destinazione) location.href = destinazione;
  });
  window.addEventListener("pageshow", (evento) => { if (evento.persisted && aperto) imposta(false); });
  document.addEventListener("keydown", (evento) => {
    if (!aperto) return;
    if (evento.key === "Escape") chiudi();
    // Il focus resta nel cassetto finché è aperto.
    if (evento.key === "Tab") {
      const fuochi = [...barra.querySelectorAll("a[href], button")].filter((el) => el.offsetParent);
      if (!fuochi.length) return;
      const [primo, ultimo] = [fuochi[0], fuochi[fuochi.length - 1]];
      if (evento.shiftKey && document.activeElement === primo) { evento.preventDefault(); ultimo.focus(); }
      else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primo.focus(); }
    }
  });
  telefono.addEventListener("change", (evento) => { if (!evento.matches && aperto) chiudi(); });
}

// gruppi: quelli già calcolati dalla pagina (la dashboard); altrimenti il
// guscio legge la campagna corrente e ne ricava il ruolo. iscritti: la lettura
// degli iscritti in attesa se la pagina l'ha già avviata.
export async function montaGuscio({ user, profilo, voce = document.body.dataset.voce || "", gruppi = null, iscritti = null } = {}) {
  const ruoloAccount = profilo?.ruolo || ROLES.PLAYER;
  const admin = ruoloAccount === ROLES.ADMIN;
  const barra = document.getElementById("rd-barra");
  stato.voce = voce;
  stato.ordine = { ...(profilo?.ordinePannelli || {}) };
  barra.innerHTML = htmlBarra(profilo?.nome || user.displayName || user.email || "", ruoloAccount);

  const cassetto = {};
  montaCassetto(barra, cassetto);
  const prima = (azione) => () => { cassetto.chiudi?.(); azione(); };
  barra.querySelector("[data-rd-impostazioni]").addEventListener("click", prima(apriImpostazioni));
  barra.querySelector("[data-rd-esci]").addEventListener("click", () => esciDalSito());

  if (gruppi) {
    stato.gruppi = gruppi;
    disegnaNavigazione();
  } else {
    ottieniCampagnaCorrente(user.uid, ruoloAccount)
      .catch(() => null)
      .then((campagna) => {
        const ruoloCampagna = campagna ? campagna.mioRuolo : ruoloAccount === ROLES.PLAYER ? ROLES.PLAYER : ROLES.DM;
        stato.gruppi = gruppiStrumenti(ruoloCampagna, admin);
        disegnaNavigazione();
        return montaRigaCampagna(user.uid, ruoloAccount, campagna);
      })
      .catch((errore) => console.error(errore));
  }

  iscritti ??= admin ? contaUtentiInAttesa().catch(() => 0) : Promise.resolve(0);
  iscritti.then((quanti) => {
    stato.iscritti = quanti;
    mostraIscritti();
  });

  const notifiche = await montaMenuUtente({ contenitore: document.getElementById("slot-utente"), user, profilo, compatto: true });
  return { notifiche, iscritti };
}
