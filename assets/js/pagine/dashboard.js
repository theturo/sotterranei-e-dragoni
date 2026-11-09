// Script della pagina dashboard.html (spostato fuori dall'HTML per la Content Security Policy:
// la policy consente solo script serviti dal sito stesso, niente script inline).
// Dashboard ridisegnata: barra laterale con la navigazione (computer), testata
// con campagna, targhette e campanella, pannello della sessione sul dipinto,
// riepilogo (party o proprio personaggio, avvisi "Da fare") e strumenti.
import { proteggiPagina, ROLES, ETICHETTE_RUOLO } from "../auth.js";
import { salvaOrdinePannelli, contaUtentiInAttesa } from "../dati/utenti.js";
import { elencaCreditiCampagna, creditiLivello, migraCreditiProfilo } from "../dati/livelli.js";
import { ottieniCampagnaCorrente, elencaMembriCampagna } from "../dati/campagne.js";
import { ottieniSchedaAttiva } from "../dati/schede.js";
import { ascoltaRiepiloghiParty } from "../dati/party.js";
import { ottieniStatoSessione, elencaSessioniCampagna, apriSessione } from "../dati/sessioni.js";
import { riepilogoCalendario, elencaProposteAperte } from "../dati/calendario.js";
import { contaContenutiCollegati } from "../dati/libreria.js";
import { montaWidgetMusica } from "../widget-musica.js";
import { montaMenuUtente, riempiSelettoreCampagna, campagneAttiveConTitolo, apriImpostazioni, esciDalSito } from "../menu-utente.js";
import { statoInstallazione, quandoCambiaInstallazione, installaApp } from "../pwa.js";
import { statoNotifichePush, attivaNotifichePush } from "../notifiche-push.js";
import {
  gruppiStrumenti, colonneStrumenti, titoloCampagnaVisibile, ordinaVoci, sessioneInEvidenza, avvisiDM, avvisiGiocatore, barraPf, testoPf,
} from "../cruscotto-calcoli.js";
import { CLASSI, RAZZE, ICONA_CLASSE_FALLBACK } from "../dati-srd.js";
import { creaChipCondizioni } from "../condizioni.js";
import { privilegiDelPersonaggio } from "../privilegi.js";
import { mostraImmagine, percorsiRitratto } from "../immagini.js";
import { creaElemento } from "../contenuti.js";
import { esc } from "../utils.js";
import { icona, ICONA_HOME, ICONA_MODIFICA, ICONA_SI } from "../icone.js";

const veil = document.getElementById("veil");
const contenuto = document.getElementById("contenuto");
const griglia = document.getElementById("griglia-pannelli");
const nav = document.getElementById("rd-nav");

let uidCorrente = null;
let modoOrdinamento = false;
let gruppiCorrenti = [];
let ordineCorrente = {};
// Iscritti da approvare (solo admin): letti una volta, ridisegnati col riordino.
let promessaIscritti = Promise.resolve(0);

// Icone fisse della pagina (barra laterale, titoli delle pergamene, Riordina).
document.querySelectorAll("[data-rd-icona]").forEach((el) => { el.innerHTML = icona(el.dataset.rdIcona); });
document.getElementById("rd-riordina-icona").innerHTML = ICONA_MODIFICA;

const MANIGLIA = '<span class="maniglia-trascina" aria-hidden="true" title="Trascina per riordinare"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.8"/><circle cx="15" cy="6" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="18" r="1.8"/><circle cx="15" cy="18" r="1.8"/></svg></span>';

// Contatori che alcune voci portano con sé (barra laterale e tessere).
const extraVoce = (chiave) =>
  (chiave === "sessione" ? '<span class="rd-punto-live" data-sessione-live hidden></span>' : "")
  + (chiave === "utenti" ? '<span class="rd-conta" data-conta-utenti hidden></span>' : "");

// Strumenti: Prepara / Gioca / Consulta per il DM (più Amministrazione per
// l'admin), uno solo per il giocatore. L'ordine dentro ogni gruppo si cambia
// trascinando («Riordina» accanto al titolo); al computer le colonne mettono
// Amministrazione sotto Gioca, sul telefono i gruppi tornano in fila.
function renderStrumenti() {
  const giocatore = gruppiCorrenti.length && gruppiCorrenti[0].id === "giocatore";
  griglia.classList.toggle("rd-gruppi-giocatore", giocatore);
  document.getElementById("rd-titolo-strumenti").textContent = giocatore ? "I tuoi strumenti" : "Strumenti della campagna";
  griglia.innerHTML = colonneStrumenti(gruppiCorrenti).map((colonna) => `
    <div class="rd-colonna">${colonna.map((g) => `
      <section class="gruppo-strumenti rd-gruppo" data-gruppo="${esc(g.id)}" aria-label="${esc(g.titolo)}">
        ${giocatore ? "" : `<h3 class="rd-gruppo-titolo">${esc(g.titolo)}</h3>`}
        <div class="strumenti-griglia rd-voci" data-sezione="${esc(g.id)}">
          ${ordinaVoci(g.voci, ordineCorrente[g.id]).map((v) => `
            <a class="strumento rd-tessera" href="${esc(v.link)}" data-chiave="${esc(v.chiave)}">
              ${MANIGLIA}<span class="rd-tessera-icona" aria-hidden="true">${icona(v.icona)}</span>
              <span class="rd-tessera-testo"><b>${esc(v.titolo)}</b><small>${esc(v.testo)}</small></span>
              ${extraVoce(v.chiave)}<span class="rd-tessera-vai" aria-hidden="true">→</span>
            </a>`).join("")}
        </div>
      </section>`).join("")}
    </div>`).join("");
  griglia.querySelectorAll(".strumento").forEach((pannello) => (pannello.draggable = modoOrdinamento));
}

// Barra laterale: le stesse voci e lo stesso ordine delle tessere, così le due
// liste non si disallineano mai. Il title resta per la barra a sole icone.
function renderNavigazione() {
  nav.innerHTML = `
    <a class="rd-voce attiva" href="dashboard.html" aria-current="page" title="Dashboard"><span class="rd-voce-icona" aria-hidden="true">${ICONA_HOME}</span><span class="rd-voce-testo">Dashboard</span></a>
    ${gruppiCorrenti.map((g) => `
      <p class="rd-nav-gruppo">${esc(g.titolo)}</p>
      ${ordinaVoci(g.voci, ordineCorrente[g.id]).map((v) => `
        <a class="rd-voce" href="${esc(v.link)}" title="${esc(v.titolo)}"><span class="rd-voce-icona" aria-hidden="true">${icona(v.icona)}</span><span class="rd-voce-testo">${esc(v.titolo)}</span>${extraVoce(v.chiave)}</a>`).join("")}`).join("")}`;
}

// «● Sessione in corso» nella testata (computer) e accanto a Sessione.
function segnaSessioneInCorso(azione) {
  document.getElementById("rd-live-azione").textContent = azione;
  document.getElementById("rd-live").hidden = false;
  document.querySelectorAll("[data-sessione-live]").forEach((punto) => { punto.hidden = false; });
}

function mostraIscrittiInAttesa(quanti) {
  document.querySelectorAll("[data-conta-utenti]").forEach((conta) => {
    conta.textContent = String(quanti);
    conta.hidden = !quanti;
    conta.title = quanti === 1 ? "1 iscritto da approvare" : `${quanti} iscritti da approvare`;
  });
}

function impostaRiordino(attivo) {
  modoOrdinamento = attivo;
  griglia.classList.toggle("riordino-attivo", attivo);
  griglia.querySelectorAll(".strumento").forEach((pannello) => (pannello.draggable = attivo));
  const bottone = document.getElementById("rd-btn-riordina");
  bottone.setAttribute("aria-pressed", String(attivo));
  bottone.classList.toggle("attivo", attivo);
  document.getElementById("rd-riordina-icona").innerHTML = attivo ? ICONA_SI : ICONA_MODIFICA;
  document.getElementById("rd-riordina-testo").textContent = attivo ? "Fatto" : "Riordina";
}
document.getElementById("rd-btn-riordina").addEventListener("click", () => impostaRiordino(!modoOrdinamento));

// Testata: nome della campagna (su due righe al massimo sul telefono), ruolo
// in questa campagna e, per l'admin, la targhetta del ruolo dell'account.
async function montaCampagna(uid, ruoloAccount, campagna, ruoloCampagna) {
  document.getElementById("rd-targhetta-admin").hidden = ruoloAccount !== ROLES.ADMIN;
  const titolo = document.getElementById("rd-titolo-campagna");
  titolo.textContent = titoloCampagnaVisibile(campagna);
  if (!campagna) return;
  const ruolo = document.getElementById("rd-ruolo-campagna");
  ruolo.textContent = ruoloCampagna === ROLES.PLAYER ? "Giocatore" : "DM";
  ruolo.hidden = false;
  const select = document.getElementById("select-campagna-dashboard");
  const [piuDiUna, attive] = await Promise.all([
    riempiSelettoreCampagna(select, uid, ruoloAccount),
    campagneAttiveConTitolo(uid, ruoloAccount),
  ]);
  // Il DM legge il titolo vero anche quando è ancora provvisorio.
  const conTitolo = attive.find((c) => c.id === campagna.id);
  if (conTitolo?.titolo) titolo.textContent = conTitolo.titolo;
  select.hidden = !piuDiUna;
  document.getElementById("rd-campagna-nome").classList.toggle("rd-con-scelta", piuDiUna);
  document.getElementById("rd-etichetta-campagna").textContent = piuDiUna ? "Campagna attiva" : "Campagna";
}

// ---------- Cruscotto ----------

function bottoneLink(testo, href, classe = "btn-tabella") {
  const a = creaElemento("a", classe, testo);
  a.href = href;
  return a;
}

// Riquadro della sessione: { etichetta, titolo, riga, azioni: [nodi], classe }.
// Nel pannello: il primo comando è quello principale (cremisi, con la freccia),
// gli altri restano sobri.
function disegnaSessione({ etichetta, titolo, riga, azioni = [], classe = "" }) {
  const box = document.getElementById("cruscotto-sessione");
  box.className = `rd-sessione ${classe}`.trim();
  const testi = creaElemento("div", "rd-sessione-testi");
  testi.append(creaElemento("p", "rd-etichetta rd-stato", etichetta), creaElemento("h2", "rd-sessione-titolo", titolo));
  if (riga) testi.append(creaElemento("p", "rd-sessione-riga", riga));
  azioni.forEach((azione, i) => {
    azione.className = i === 0 ? "rd-btn rd-btn-primario" : "rd-btn rd-btn-secondario";
    if (i === 0) azione.append(creaElemento("span", "rd-btn-freccia", "→"));
  });
  const comandi = creaElemento("div", "rd-azioni");
  comandi.append(...azioni);
  box.replaceChildren(testi, comandi);
}

const oraDa = (ts) => (ts?.toDate ? ts.toDate().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : null);

function disegnaAvvisi(avvisi, vuoto) {
  const lista = document.getElementById("lista-avvisi");
  lista.replaceChildren(...(avvisi.length ? avvisi : [{ icona: "tutto-ok", testo: vuoto }]).map((a) => {
    const li = creaElemento("li", "cruscotto-avviso");
    const simbolo = creaElemento("span", "cruscotto-avviso-icona");
    simbolo.setAttribute("aria-hidden", "true");
    simbolo.innerHTML = icona(a.icona);
    li.append(simbolo, creaElemento("span", "cruscotto-avviso-testo", a.testo));
    if (a.link) li.append(bottoneLink(`${a.etichetta} →`, a.link, "cruscotto-avviso-link"));
    return li;
  }));
}

function avatar(riepilogo, classe = "party-avatar") {
  const span = creaElemento("span", classe);
  const datiClasse = CLASSI[riepilogo.classe];
  const simbolo = creaElemento("span", "icona-classe");
  simbolo.setAttribute("aria-hidden", "true");
  simbolo.innerHTML = datiClasse?.iconaSvg || ICONA_CLASSE_FALLBACK;
  span.append(simbolo);
  if (riepilogo.ritratto && riepilogo.schedaId) {
    const img = creaElemento("img", "party-ritratto");
    img.alt = "";
    img.hidden = true;
    simbolo.before(img);
    mostraImmagine(img, percorsiRitratto(riepilogo.uid, riepilogo.schedaId, riepilogo.ritratto).icona, { silenzioso: true })
      .then(() => { simbolo.hidden = !img.hidden; });
  }
  return span;
}

function barra(hp) {
  const contenitore = creaElemento("div", "barra-pf");
  contenitore.setAttribute("aria-hidden", "true");
  const riempimento = creaElemento("span");
  const { quota } = barraPf(hp);
  riempimento.style.width = `${Math.round(quota * 100)}%`;
  riempimento.dataset.livello = quota < 0.35 ? "basso" : quota < 0.6 ? "medio" : "alto";
  contenitore.append(riempimento);
  contenitore.hidden = !hp?.massimi;
  return contenitore;
}

// livelli: Map uid → livelli concessi in questa campagna e non ancora spesi.
function disegnaParty(party, livelli) {
  const lista = document.getElementById("cruscotto-lista-party");
  if (!party.length) {
    lista.replaceChildren(creaElemento("li", "cruscotto-vuoto", "Nessun giocatore nel party: aggiungili da Gestione campagna."));
    return;
  }
  lista.replaceChildren(...party.map((p) => {
    const li = creaElemento("li", `cruscotto-pg${p.schedaId ? "" : " senza"}`);
    const info = creaElemento("div", "cruscotto-pg-info");
    const nome = creaElemento("div", "cruscotto-pg-nome", p.schedaId ? p.nomePersonaggio || "—" : "Nessun personaggio");
    if (p.schedaId && livelli.get(p.uid) > 0) nome.append(" ", creaElemento("span", "cruscotto-pill", "⬆ livello"));
    const sotto = p.schedaId
      ? `${p.nomeGiocatore || "—"} · ${CLASSI[p.classe]?.nome || "—"} ${p.livello || 1}`
      : `${p.nomeGiocatore || "—"} · da creare`;
    info.append(nome, creaElemento("div", "cruscotto-pg-sotto", sotto), barra(p.hp));
    if (p.condizioni?.length || p.esaurimento) info.append(creaChipCondizioni(p.condizioni, p.esaurimento));
    li.append(p.schedaId ? avatar(p) : creaElemento("span", "party-avatar party-avatar-vuoto", "?"), info,
      creaElemento("span", "cruscotto-pg-pf", testoPf(p.hp)));
    return li;
  }));
}

async function cruscottoDM(campagna, promessaInAttesa) {
  document.getElementById("cruscotto-party").hidden = false;
  document.getElementById("titolo-avvisi").textContent = "Da fare";
  const [stato, sessioni, proposte, membri, inAttesa, crediti] = await Promise.all([
    ottieniStatoSessione(campagna.id),
    elencaSessioniCampagna(campagna.id),
    elencaProposteAperte(campagna.id),
    elencaMembriCampagna(campagna.id),
    promessaInAttesa,
    elencaCreditiCampagna(campagna.id).catch(() => new Map()),
  ]);
  const evidenza = sessioneInEvidenza({ inCorso: stato.inCorso ? stato : null, sessioni, proposte, membri: membri.length });
  const contenutiProssima = evidenza.sessione && evidenza.tipo !== "corso"
    ? await contaContenutiCollegati(campagna.id, evidenza.sessione.id).catch(() => null)
    : null;

  if (evidenza.tipo === "corso") {
    const ora = oraDa(evidenza.sessione?.apertaIl);
    segnaSessioneInCorso("Vai alla sessione");
    disegnaSessione({
      classe: "in-corso", etichetta: "● Sessione in corso", titolo: evidenza.titolo, riga: ora ? `Aperta alle ${ora}.` : "",
      azioni: [bottoneLink("Vai alla sessione", "sessione.html"), bottoneLink("Schermo del tavolo", "tavolo.html")],
    });
  } else if (evidenza.tipo === "oggi" || evidenza.tipo === "prossima") {
    const contenuti = contenutiProssima == null ? "" : ` · ${contenutiProssima === 1 ? "1 contenuto collegato" : `${contenutiProssima} contenuti collegati`}`;
    const azioni = [];
    if (evidenza.tipo === "oggi") {
      const apri = creaElemento("button", null, "Apri la sessione di oggi");
      apri.type = "button";
      apri.addEventListener("click", async () => {
        apri.disabled = true;
        try {
          await apriSessione(campagna.id);
          window.location.href = "sessione.html";
        } catch (errore) {
          console.error(errore);
          apri.disabled = false;
        }
      });
      azioni.push(apri);
    } else {
      azioni.push(bottoneLink("Apri il calendario", "calendario.html"));
    }
    azioni.push(bottoneLink("Contenuti della sessione", "campagna.html#sessioni"));
    disegnaSessione({
      classe: evidenza.tipo === "oggi" ? "oggi" : "",
      etichetta: evidenza.tipo === "oggi" ? `Oggi${evidenza.ora ? ` alle ${evidenza.ora}` : ""}` : `Prossima sessione · ${evidenza.distanza}`,
      titolo: evidenza.titolo,
      riga: `${evidenza.quando}${contenuti}`,
      azioni,
    });
  } else if (evidenza.tipo === "proposta") {
    disegnaSessione({
      etichetta: "Nessuna sessione in programma", titolo: evidenza.titolo, riga: evidenza.riga,
      azioni: [bottoneLink("Apri il calendario", "calendario.html")],
    });
  } else {
    disegnaSessione({
      etichetta: "Nessuna sessione in programma", titolo: "Organizza la prossima sessione",
      riga: "Proponi delle date ai giocatori o fissala direttamente.",
      azioni: [bottoneLink("Apri il calendario", "calendario.html")],
    });
  }

  ascoltaRiepiloghiParty(campagna.id, (party) => {
    // Solo i membri attuali, anche se il riepilogo di un ex membro resta.
    const uidMembri = new Set(membri.map((m) => m.uid));
    const delParty = party.filter((p) => uidMembri.has(p.uid));
    const conRiepilogo = new Set(delParty.map((p) => p.uid));
    const senza = membri.filter((m) => !conRiepilogo.has(m.uid)).map((m) => ({ uid: m.uid, nomeGiocatore: m.nome, schedaId: null }));
    const tutti = [...delParty, ...senza].sort((a, b) => (a.nomeGiocatore || "").localeCompare(b.nomeGiocatore || ""));
    disegnaParty(tutti, crediti);
    disegnaAvvisi(avvisiDM({ membri, crediti, party: tutti, proposte, evidenza, contenutiProssima, inAttesa }), "Tutto in ordine: nulla da fare per ora.");
  });
}

function disegnaMioPersonaggio(scheda, uid) {
  const corpo = document.getElementById("cruscotto-mio-pg");
  const link = document.getElementById("link-scheda");
  if (!scheda) {
    link.textContent = "I miei personaggi →";
    link.href = "i-miei-personaggi.html";
    corpo.replaceChildren(creaElemento("p", "cruscotto-vuoto", "Non hai ancora un personaggio attivo in questa campagna: crealo da «I miei personaggi»."));
    return;
  }
  link.href = `scheda-personaggio.html?id=${encodeURIComponent(scheda.id)}`;
  const riepilogo = { ...scheda, uid, schedaId: scheda.id };
  const classe = CLASSI[scheda.classe];
  const razza = RAZZE[scheda.razza];
  const sottorazza = razza?.sottorazze?.[scheda.sottorazza]?.nome;
  const blocco = creaElemento("div", "cruscotto-mio");
  const info = creaElemento("div", "cruscotto-mio-info");
  const nome = creaElemento("h3", null, scheda.nome || "—");
  nome.append(" ", creaElemento("span", "rd-chip-livello", `Liv. ${scheda.livello || 1}`));
  info.append(
    nome,
    creaElemento("p", "cruscotto-pg-sotto", [sottorazza || razza?.nome, `${classe?.nome || "—"} ${scheda.livello || 1}`].filter(Boolean).join(" · ")),
  );
  const pf = creaElemento("div", "cruscotto-mio-pf");
  pf.append(creaElemento("span", null, "Punti ferita"), creaElemento("b", null, testoPf(scheda.hp) || "—"));
  info.append(pf, barra(scheda.hp));
  if (scheda.condizioni?.length || scheda.esaurimento) info.append(creaChipCondizioni(scheda.condizioni, scheda.esaurimento));
  const privilegi = privilegiDelPersonaggio(scheda);
  if (privilegi.length) {
    const riga = creaElemento("div", "cruscotto-contatori");
    privilegi.forEach((p) => riga.append(creaElemento("span", p.rimasti === 0 ? "esaurito" : null,
      Number.isFinite(p.max) ? `${p.nome} ${p.rimasti}/${p.max}` : p.nome)));
    info.append(riga);
  }
  blocco.append(avatar(riepilogo, "party-avatar cruscotto-mio-avatar"), info);
  corpo.replaceChildren(blocco);
}

async function cruscottoGiocatore(campagna, uid, profilo) {
  document.getElementById("cruscotto-personaggio").hidden = false;
  document.getElementById("cruscotto-musica").hidden = false;
  document.getElementById("titolo-avvisi").textContent = "Avvisi";
  montaWidgetMusica(document.getElementById("corpo-musica-giocatore"), campagna.id);
  await migraCreditiProfilo({ uid, ...profilo }).catch((errore) => console.error(errore));
  const [stato, calendario, scheda, crediti] = await Promise.all([
    ottieniStatoSessione(campagna.id),
    riepilogoCalendario(campagna.id, uid),
    ottieniSchedaAttiva(uid, campagna.id),
    creditiLivello(campagna.id, uid).catch(() => 0),
  ]);
  const evidenza = sessioneInEvidenza({ inCorso: stato.inCorso ? stato : null, sessioni: calendario.sessioni });
  if (evidenza.tipo === "corso") {
    segnaSessioneInCorso("Raggiungi il tavolo");
    disegnaSessione({
      classe: "in-corso", etichetta: "● Sessione in corso", titolo: evidenza.titolo, riga: "Il DM ha aperto la sessione: raggiungi il tavolo.",
      azioni: [bottoneLink("Raggiungi il tavolo", "sessione.html")],
    });
  } else if (evidenza.tipo === "oggi" || evidenza.tipo === "prossima") {
    disegnaSessione({
      classe: evidenza.tipo === "oggi" ? "oggi" : "",
      etichetta: evidenza.tipo === "oggi" ? `Oggi${evidenza.ora ? ` alle ${evidenza.ora}` : ""}` : `Prossima sessione · ${evidenza.distanza}`,
      titolo: evidenza.titolo, riga: evidenza.quando,
      azioni: [bottoneLink("Calendario", "calendario.html")],
    });
  } else if (calendario.daRispondere > 0) {
    disegnaSessione({
      etichetta: "Nessuna sessione in programma", titolo: "Il DM ha proposto delle date", riga: "Segna quando puoi esserci.",
      azioni: [bottoneLink("Rispondi alle date", "calendario.html")],
    });
  } else {
    disegnaSessione({
      etichetta: "Nessuna sessione in programma", titolo: "In attesa della prossima data",
      riga: calendario.aperte ? "Hai già risposto alle date proposte." : "Il DM non ha ancora fissato la prossima sessione.",
      azioni: [bottoneLink("Calendario", "calendario.html")],
    });
  }
  disegnaMioPersonaggio(scheda, uid);
  disegnaAvvisi(avvisiGiocatore({ crediti, scheda, daRispondere: calendario.daRispondere }), "Nessun avviso.");
}

async function montaCruscotto(user, profilo, campagna, ruolo, promessaInAttesa) {
  if (!campagna) {
    document.getElementById("rd-etichetta-pannello").textContent = "Sotterranei & Dragoni";
    disegnaSessione(ruolo === ROLES.PLAYER
      ? { etichetta: "Benvenuto", titolo: "Non sei ancora in una campagna", riga: "Chiedi al tuo Dungeon Master di aggiungerti al party." }
      : { etichetta: "Benvenuto", titolo: "Crea la tua prima campagna", riga: "Da lì in poi sessioni, personaggi e registro nasceranno dentro la campagna.",
        azioni: [bottoneLink("Gestione campagna", "campagna.html")] });
    return;
  }
  document.getElementById("cruscotto").hidden = false;
  if (ruolo === ROLES.PLAYER) await cruscottoGiocatore(campagna, user.uid, profilo);
  else await cruscottoDM(campagna, promessaInAttesa);
}

proteggiPagina(async (user, profilo) => {
  uidCorrente = user.uid;
  const nome = profilo?.nome || user.displayName || user.email;
  const ruolo = profilo?.ruolo || ROLES.PLAYER;

  const admin = ruolo === ROLES.ADMIN;
  document.getElementById("nome-utente").textContent = nome;
  document.getElementById("rd-account-nome").textContent = nome;
  document.getElementById("rd-account-iniziale").textContent = (nome || "?").trim().charAt(0).toUpperCase();
  document.getElementById("rd-account-ruolo").textContent = ETICHETTE_RUOLO[ruolo] || ruolo;
  document.getElementById("rd-btn-impostazioni").addEventListener("click", () => apriImpostazioni());
  document.getElementById("rd-btn-esci").addEventListener("click", () => esciDalSito());

  // Cruscotto, strumenti e barra laterale seguono il ruolo nella campagna
  // corrente: DM in quella che guida, giocatore in quella di un altro (anche
  // da admin). Amministrazione segue il ruolo dell'account.
  const campagna = await ottieniCampagnaCorrente(user.uid, ruolo).catch((errore) => {
    console.error(errore);
    return null;
  });
  const ruoloCampagna = campagna ? campagna.mioRuolo : ruolo === ROLES.PLAYER ? ROLES.PLAYER : ROLES.DM;
  gruppiCorrenti = gruppiStrumenti(ruoloCampagna, admin);
  ordineCorrente = { ...(profilo?.ordinePannelli || {}) };
  renderStrumenti();
  renderNavigazione();
  if (admin) promessaIscritti = contaUtentiInAttesa().catch(() => 0);
  promessaIscritti.then(mostraIscrittiInAttesa);
  montaCampagna(user.uid, ruolo, campagna, ruoloCampagna).catch((errore) => console.error(errore));
  montaCruscotto(user, profilo, campagna, ruoloCampagna, promessaIscritti).catch((errore) => console.error(errore));

  const notifiche = await montaMenuUtente({
    contenitore: document.getElementById("slot-utente"),
    user,
    profilo,
    compatto: true,
  });

  const livelliNonLetti = notifiche.filter((n) => !n.letta && n.tipo === "livello_su");
  if (livelliNonLetti.length > 0) {
    const ultima = livelliNonLetti[0];
    const dove = ultima.campagnaTitolo ? ` in «${ultima.campagnaTitolo}»` : "";
    let testo =
      `Il tuo Dungeon Master ti ha fatto salire${dove} dal livello ${ultima.livelloPrecedente} ` +
      `al livello ${ultima.livelloNuovo}. Completa il passaggio dalla scheda del tuo ` +
      `personaggio attivo in quella campagna.`;
    if (livelliNonLetti.length > 1) {
      testo += ` Hai ${livelliNonLetti.length} notifiche di livello non lette: consultale dalla campanella.`;
    }
    document.getElementById("testo-livello").textContent = testo;
    document.getElementById("overlay-livello").style.display = "flex";

    document.getElementById("btn-chiudi-livello").addEventListener(
      "click",
      () => {
        document.getElementById("overlay-livello").style.display = "none";
      },
      { once: true }
    );
  }

  mostraInvitoInstallazione();
  mostraInvitoNotifiche(user.uid);
  veil.style.display = "none";
  contenuto.style.display = "";
});

// Invito a installare l'app: finché non è installata o finché non lo si chiude
// (la scelta resta in questo browser; l'installazione resta nel pannello ⚙️).
const CHIAVE_INVITO_CHIUSO = "sed-invito-installa-chiuso";
function mostraInvitoInstallazione() {
  const invito = document.getElementById("invito-installa");
  let chiuso = false;
  try {
    chiuso = localStorage.getItem(CHIAVE_INVITO_CHIUSO) === "1";
  } catch {
    // Archivio del browser non disponibile: l'invito resta visibile.
  }
  const aggiorna = ({ possibile }) => {
    invito.hidden = chiuso || !possibile;
  };
  aggiorna(statoInstallazione());
  quandoCambiaInstallazione(aggiorna);
  document.getElementById("btn-installa").addEventListener("click", installaApp);
  document.getElementById("btn-chiudi-invito").addEventListener("click", () => {
    chiuso = true;
    invito.hidden = true;
    try {
      localStorage.setItem(CHIAVE_INVITO_CHIUSO, "1");
    } catch {
      // Non salvato: ricomparirà alla prossima apertura.
    }
  });
}

// Invito ad attivare le notifiche push: solo nell'app installata, finché sono
// spente e finché non lo si chiude (restano attivabili dal pannello ⚙️).
const CHIAVE_INVITO_NOTIFICHE_CHIUSO = "sed-invito-notifiche-chiuso";
function mostraInvitoNotifiche(uid) {
  const invito = document.getElementById("invito-notifiche");
  try {
    if (localStorage.getItem(CHIAVE_INVITO_NOTIFICHE_CHIUSO) === "1") return;
  } catch {
    // Archivio del browser non disponibile: l'invito resta visibile.
  }
  if (!statoInstallazione().installata || statoNotifichePush(uid) !== "spente") return;
  invito.hidden = false;
  const bottone = document.getElementById("btn-attiva-notifiche");
  bottone.addEventListener("click", async () => {
    bottone.disabled = true;
    try {
      await attivaNotifichePush(uid);
      // Attivate o rifiutate, l'invito ha fatto il suo lavoro (il pannello ⚙️ dice lo stato).
      invito.hidden = true;
    } catch (errore) {
      console.error(errore);
      invito.querySelector("p").textContent = "Non è stato possibile attivarle: riprova più tardi dal pannello ⚙️.";
      bottone.hidden = true;
    }
  });
  document.getElementById("btn-chiudi-invito-notifiche").addEventListener("click", () => {
    invito.hidden = true;
    try {
      localStorage.setItem(CHIAVE_INVITO_NOTIFICHE_CHIUSO, "1");
    } catch {
      // Non salvato: ricomparirà alla prossima apertura.
    }
  });
}

// Riordino dei pannelli via trascinamento, come per "I miei personaggi": attivo
// solo in modalità modifica («Riordina»), limitato ai pannelli dello stesso
// gruppo. La barra laterale segue lo stesso ordine.
let pannelloTrascinato = null;

griglia.addEventListener("dragstart", (evento) => {
  if (!modoOrdinamento) return;
  const pannello = evento.target.closest(".strumento");
  if (!pannello) return;
  pannelloTrascinato = pannello;
  evento.dataTransfer.effectAllowed = "move";
  setTimeout(() => pannello.classList.add("trascinato"), 0);
});

griglia.addEventListener("dragend", () => {
  if (pannelloTrascinato) pannelloTrascinato.classList.remove("trascinato");
  pannelloTrascinato = null;
});

griglia.addEventListener("dragover", (evento) => {
  if (!pannelloTrascinato) return;
  evento.preventDefault();
  const bersaglio = evento.target.closest(".strumento");
  if (!bersaglio || bersaglio === pannelloTrascinato) return;
  const contenitoreTrascinato = pannelloTrascinato.closest(".rd-voci");
  if (bersaglio.closest(".rd-voci") !== contenitoreTrascinato) return;
  const elementi = [...contenitoreTrascinato.children];
  if (elementi.indexOf(pannelloTrascinato) < elementi.indexOf(bersaglio)) {
    bersaglio.after(pannelloTrascinato);
  } else {
    bersaglio.before(pannelloTrascinato);
  }
});

griglia.addEventListener("drop", async (evento) => {
  if (!pannelloTrascinato) return;
  evento.preventDefault();
  const contenitore = pannelloTrascinato.closest(".rd-voci");
  const ordineChiavi = [...contenitore.children].map((el) => el.dataset.chiave);
  ordineCorrente[contenitore.dataset.sezione] = ordineChiavi;
  const liveAcceso = !document.getElementById("rd-live").hidden;
  renderNavigazione();
  if (liveAcceso) document.querySelectorAll("#rd-nav [data-sessione-live]").forEach((punto) => { punto.hidden = false; });
  promessaIscritti.then(mostraIscrittiInAttesa);
  try {
    await salvaOrdinePannelli(uidCorrente, contenitore.dataset.sezione, ordineChiavi);
  } catch (errore) {
    console.error(errore);
  }
});

// In modalità modifica, i pannelli-link non devono navigare: si sta trascinando,
// non aprendo la pagina.
griglia.addEventListener("click", (evento) => {
  if (!modoOrdinamento) return;
  const pannello = evento.target.closest(".strumento");
  if (pannello) evento.preventDefault();
});
