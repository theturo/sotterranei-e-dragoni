// Script della pagina sessione.html (spostato fuori dall'HTML per la Content Security Policy:
// la policy consente solo script serviti dal sito stesso, niente script inline).
import {
  proteggiPagina,
  ROLES,
  ottieniCampagnaCorrente,
  ottieniStatoSessione,
  apriSessione,
  chiudiSessione,
  aggiungiAppunto,
  ascoltaAppunti,
  elencaRegistroSessioni,
  eliminaSessioni,
  elencaAppuntiSessione,
  elencaSessioniProgrammate,
  rigeneraRiepiloghiParty,
  sincronizzaMioRiepilogo,
  eliminaAppunto,
  elencaMembriCampagna,
  ascoltaLibreriaDM,
  ascoltaContenutiVisibili,
  mostraContenuto,
  collegaContenutiSessione,
  ascoltaRiepiloghiParty,
  aggiornaStatoPersonaggio,
  ottieniScheda,
  applicaRiposoScheda,
  applicaRiposoPersonaggi,
  avviaRiposoBreve,
  terminaRiposoBreve,
  segnaRiposoConcluso,
  ascoltaRiposo,
  annotaRiposo,
  aggiungiTiro,
  ascoltaTiriNascosti,
} from "../auth.js";
import { tira, testoTiro } from "../dadi.js";
import { oggiIso, formattaDataOra, etichettaSessione } from "../calendario.js";
import { montaMenuUtente } from "../menu-utente.js";
import { esc, creaScheletro, mostraAttesa } from "../utils.js";
import { montaWidgetMusica } from "../widget-musica.js";
import { CLASSI, ICONA_CLASSE_FALLBACK, applicaVariazionePf } from "../dati-srd.js";
import { creaChipCondizioni, creaEditorCondizioni } from "../condizioni.js";
import { mostraImmagine, percorsiRitratto } from "../immagini.js";
import {
  CATEGORIE,
  creaElemento,
  creaMiniatura,
  apriLightbox,
  chiudiLightboxSeSparito,
  scegliContenuti,
} from "../contenuti.js";
import { montaCombattimento } from "../combattimento.js";
import { montaMappa } from "../mappa.js";
import { privilegiDelPersonaggio, NOMI_RICARICA } from "../privilegi.js";
import {
  apriRiposoBreve,
  confermaRiposo,
  dadiVitaDisponibili,
  dadoVitaClasse,
  effettiRiposoBreve,
  effettiRiposoLungo,
  testoRiposoBreve,
} from "../riposo.js";

const veil = document.getElementById("veil");
const contenuto = document.getElementById("contenuto");

let uidCorrente = null;
let nomeCorrente = null;
let campagnaIdCorrente = null;
let sessioneAttivaId = null;
let smettiAscolto = null;
// DM/admin: possono eliminare appunti (moderazione).
let puoModerare = false;

function formattaData(timestamp) {
  if (!timestamp?.toDate) return "";
  return timestamp.toDate().toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formattaOrario(timestamp) {
  if (!timestamp?.toDate) return "";
  return timestamp.toDate().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function rigaAppunto(appunto, sessioneId) {
  const collezione = appunto.nascosto ? "tiriNascosti" : "appunti";
  const bottoneElimina = puoModerare
    ? `<button type="button" class="btn-rimuovi-talento" data-elimina-appunto="${esc(appunto.id)}" data-sessione="${esc(sessioneId)}" data-collezione="${collezione}" aria-label="Elimina appunto" title="Elimina appunto">×</button>`
    : "";
  const classi = ["sessione-appunto"];
  if (appunto.tipo === "riposo") classi.push("sessione-appunto-riposo");
  if (appunto.tipo === "tiro") classi.push("sessione-appunto-tiro");
  if (appunto.tiro?.critico) classi.push(`tiro-${appunto.tiro.critico}`);
  if (appunto.nascosto) classi.push("sessione-appunto-nascosto");
  const etichettaNascosto = appunto.nascosto ? '<span class="chip-riposo">Nascosto</span> ' : "";
  return `
    <div class="${classi.join(" ")}">
      <div class="sessione-appunto-meta"><span>${etichettaNascosto}${esc(appunto.autoreNome) || "—"}</span><span>${formattaOrario(appunto.creatoIl)}${bottoneElimina}</span></div>
      <div class="sessione-appunto-testo">${esc(appunto.testo)}</div>
    </div>
  `;
}

// Appunti (con riposi e tiri) più, per il DM, i suoi tiri nascosti, in ordine
// di tempo. Ai presenti arriva un avviso per i tiri degli altri.
let appuntiPubblici = [];
let tiriNascosti = [];
let appuntiGiaVisti = null;
let smettiNascosti = null;

const istante = (a) => a.creatoIl?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;

function riceviAppunti(appunti) {
  if (appuntiGiaVisti) {
    appunti
      .filter((a) => !appuntiGiaVisti.has(a.id) && a.tipo === "tiro" && a.autoreUid !== uidCorrente)
      .forEach((a) => mostraAvvisoContenuto(a.testo));
  }
  appuntiGiaVisti = new Set(appunti.map((a) => a.id));
  appuntiPubblici = appunti;
  renderAppunti();
}

function renderAppunti() {
  const appunti = [...appuntiPubblici, ...tiriNascosti].sort((a, b) => istante(a) - istante(b));
  const lista = document.getElementById("lista-appunti");
  const vuoto = document.getElementById("appunti-vuoto");
  if (appunti.length === 0) {
    lista.innerHTML = "";
    vuoto.hidden = false;
    return;
  }
  vuoto.hidden = true;
  lista.innerHTML = appunti.map((appunto) => rigaAppunto(appunto, sessioneAttivaId)).join("");
  lista.scrollTop = lista.scrollHeight;
}

function testoPf(scheda) {
  if (!scheda?.hp) return "—";
  const { massimi, attuali, temporanei } = scheda.hp;
  return temporanei > 0 ? `${attuali} / ${massimi} (+${temporanei})` : `${attuali} / ${massimi}`;
}

// "riepilogo" = documento di campagne/{id}/party/{uid}: i giocatori non
// leggono le schede complete né i profili (con l'email) degli altri.
function creaRigaParty(riepilogo) {
  const li = document.createElement("li");
  li.className = "party-sessione-riga";
  if (!riepilogo.schedaId) {
    li.innerHTML = `
      <span class="party-avatar party-avatar-vuoto" aria-hidden="true">?</span>
      <div class="party-sessione-info">
        <div class="party-sessione-nome">${esc(riepilogo.nomeGiocatore) || "—"}</div>
        <div class="party-sessione-sub">Nessun personaggio attivo</div>
      </div>
    `;
    return li;
  }
  const classe = CLASSI[riepilogo.classe];
  li.innerHTML = `
    <span class="party-avatar"><span class="icona-classe" aria-hidden="true">${classe?.iconaSvg || ICONA_CLASSE_FALLBACK}</span></span>
    <div class="party-sessione-info">
      <div class="party-sessione-nome">${esc(riepilogo.nomePersonaggio) || "—"}</div>
      <div class="party-sessione-sub">${esc(riepilogo.nomeGiocatore) || "—"} · ${esc(classe?.nome) || "—"} ${esc(riepilogo.livello || 1)}</div>
      <div class="barra-pf" aria-hidden="true"><span></span></div>
    </div>
    <div class="party-sessione-pf">${esc(testoPf(riepilogo))}</div>
  `;
  // Barra dei PF: verde, gialla sotto il 60%, rossa sotto il 35%.
  const { massimi = 0, attuali = 0 } = riepilogo.hp || {};
  const quota = massimi > 0 ? Math.max(0, Math.min(1, attuali / massimi)) : 0;
  const barra = li.querySelector(".barra-pf span");
  barra.style.width = `${Math.round(quota * 100)}%`;
  barra.dataset.livello = quota < 0.35 ? "basso" : quota < 0.6 ? "medio" : "alto";
  if (!riepilogo.hp) li.querySelector(".barra-pf").hidden = true;
  // Con un ritratto, l'icona della classe lascia il posto alla sua miniatura
  // (e ricompare se l'immagine non si può caricare).
  li.querySelector(".party-sessione-info").append(creaChipCondizioni(riepilogo.condizioni, riepilogo.esaurimento));
  const dv = creaElemento("span", "party-sessione-dv",
    `DV ${dadiVitaDisponibili(riepilogo)}/${riepilogo.livello || 1}`);
  dv.title = `Dadi vita disponibili (d${dadoVitaClasse(riepilogo.classe)})`;
  li.querySelector(".party-sessione-pf").append(dv);
  // Privilegi di classe con gli usi rimasti (visibili a tutto il tavolo).
  const privilegi = privilegiDelPersonaggio({
    classe: riepilogo.classe,
    livello: riepilogo.livello,
    usiPrivilegi: riepilogo.usiPrivilegi,
    caratteristiche: { carisma: riepilogo.carisma ?? 10 },
  });
  if (privilegi.length) {
    const riga = creaElemento("div", "party-sessione-privilegi");
    privilegi.forEach((p) => {
      const voce = creaElemento("span", `privilegio-party con-descrizione${p.rimasti === 0 ? " esaurito" : ""}`,
        Number.isFinite(p.max) ? `${p.nome} ${p.rimasti}/${p.max}` : `${p.nome} ∞`);
      voce.title = `${p.descrizione} Si ricarica con un ${NOMI_RICARICA[p.ricarica]}.`;
      riga.append(voce);
    });
    li.querySelector(".party-sessione-info").append(riga);
  }
  const inRiposo = statoRiposoDi(riepilogo.uid);
  if (inRiposo) {
    li.querySelector(".party-sessione-sub").append(" ",
      creaElemento("span", `chip-riposo chip-riposo-${inRiposo}`, inRiposo === "finito" ? "Ha riposato" : "In riposo"));
  }
  if (puoModerare) aggiungiEditorStato(li, riepilogo);
  if (riepilogo.ritratto) {
    const icona = li.querySelector(".icona-classe");
    const img = document.createElement("img");
    img.className = "party-ritratto";
    img.alt = "";
    img.hidden = true;
    icona.before(img);
    mostraImmagine(img, percorsiRitratto(riepilogo.uid, riepilogo.schedaId, riepilogo.ritratto).icona).then(() => {
      icona.hidden = !img.hidden;
    });
  }
  return li;
}

// ---------- Party in tempo reale ----------
// Le righe si ricreano solo se i dati cambiano, e mai mentre il DM sta
// scrivendo al loro interno; il pannello "Stato" aperto resta aperto.
const righeParty = new Map();
const firmeParty = new Map();
const statoAperto = new Set();
let trackerCombattimento = null;
let pannelloMappa = null;

function firma(riepilogo) {
  const { aggiornatoIl, ...dati } = riepilogo;
  return JSON.stringify([dati, statoRiposoDi(riepilogo.uid)]);
}

function renderParty(party) {
  ultimoParty = party;
  const lista = document.getElementById("lista-party");
  document.getElementById("party-vuoto").hidden = party.length > 0;
  const presenti = new Set(party.map((r) => r.uid));
  righeParty.forEach((li, uid) => {
    if (!presenti.has(uid)) {
      li.remove();
      righeParty.delete(uid);
      firmeParty.delete(uid);
    }
  });
  party.forEach((riepilogo) => {
    const vecchia = righeParty.get(riepilogo.uid);
    const nuovaFirma = firma(riepilogo);
    const occupata = vecchia && vecchia.contains(document.activeElement) && document.activeElement.tagName === "INPUT";
    if (!vecchia || (firmeParty.get(riepilogo.uid) !== nuovaFirma && !occupata)) {
      const li = creaRigaParty(riepilogo);
      if (vecchia) vecchia.replaceWith(li);
      righeParty.set(riepilogo.uid, li);
      firmeParty.set(riepilogo.uid, nuovaFirma);
    }
    lista.appendChild(righeParty.get(riepilogo.uid));
  });
  trackerCombattimento?.ridisegna();
  pannelloMappa?.ridisegna();
  renderBannerRiposo();
}

// Pannello "Stato" del DM: danni e cure (i PF temporanei si consumano per
// primi), PF temporanei, condizioni ed esaurimento. Scrive scheda e riepilogo.
function aggiungiEditorStato(li, riepilogo) {
  const uid = riepilogo.uid;
  const attuale = () => ultimoParty.find((r) => r.uid === uid) || riepilogo;
  const salva = async (campi) => {
    try {
      await aggiornaStatoPersonaggio(campagnaIdCorrente, attuale(), campi);
    } catch (errore) {
      console.error(errore);
      mostraAvvisoContenuto("Impossibile aggiornare il personaggio.", true);
    }
  };

  const apri = creaElemento("button", "btn-tabella btn-stato-pg", "Stato");
  apri.type = "button";
  apri.setAttribute("aria-expanded", String(statoAperto.has(uid)));
  apri.setAttribute("aria-label", `Stato di ${riepilogo.nomePersonaggio || "personaggio"}`);
  li.querySelector(".party-sessione-pf").append(apri);

  const pannello = creaElemento("div", "editor-stato-pg");
  pannello.hidden = !statoAperto.has(uid);
  apri.addEventListener("click", () => {
    pannello.hidden = !pannello.hidden;
    apri.setAttribute("aria-expanded", String(!pannello.hidden));
    if (pannello.hidden) statoAperto.delete(uid);
    else statoAperto.add(uid);
  });

  if (riepilogo.hp) {
    const riga = creaElemento("div", "editor-pf");
    const quanto = document.createElement("input");
    quanto.type = "number";
    quanto.min = "0";
    quanto.placeholder = "±";
    quanto.className = "input-pf-nemico";
    quanto.setAttribute("aria-label", `Danni o cure per ${riepilogo.nomePersonaggio}`);
    const danno = creaElemento("button", "btn-tabella", "− Danno");
    const cura = creaElemento("button", "btn-tabella", "+ Cura");
    [danno, cura].forEach((b) => (b.type = "button"));
    const applica = (segno) => {
      const valore = Math.trunc(Number(quanto.value));
      if (!valore || valore < 0) return;
      quanto.value = "";
      salva({ hp: applicaVariazionePf(attuale().hp, segno * valore) });
    };
    danno.addEventListener("click", () => applica(-1));
    cura.addEventListener("click", () => applica(1));
    const temporanei = document.createElement("input");
    temporanei.type = "number";
    temporanei.min = "0";
    temporanei.className = "input-pf-nemico";
    temporanei.value = riepilogo.hp.temporanei || 0;
    temporanei.setAttribute("aria-label", `PF temporanei di ${riepilogo.nomePersonaggio}`);
    temporanei.addEventListener("change", () => {
      const valore = Math.max(0, Math.trunc(Number(temporanei.value)) || 0);
      salva({ hp: { ...attuale().hp, temporanei: valore } });
    });
    riga.append(creaElemento("span", "etichetta-pf", "PF"), quanto, danno, cura, creaElemento("span", "etichetta-pf", "Temp."), temporanei);
    pannello.append(riga);
  }
  pannello.append(creaEditorCondizioni({
    condizioni: riepilogo.condizioni || [],
    esaurimento: riepilogo.esaurimento || 0,
    onCambia: ({ condizioni, esaurimento }) => salva({ condizioni, esaurimento }),
  }));
  const riposoBreve = creaElemento("button", "btn-tabella btn-riposo-pg", "Riposo breve (spendi dadi vita)");
  riposoBreve.type = "button";
  riposoBreve.addEventListener("click", () => riposoBrevePerConto(attuale(), riposoBreve));
  pannello.append(riposoBreve);
  li.append(pannello);
}

// ---------- Riposi ----------
// Il DM avvia un riposo lungo (applicato subito) o breve (invito ai giocatori,
// che spendono i propri dadi vita) per il party; può anche spendere i dadi
// vita al posto di un giocatore. Tutto finisce negli appunti della sessione.
let riposoCorrente = null;

function statoRiposoDi(uid) {
  if (!riposoCorrente?.attivo || !riposoCorrente.partecipanti?.includes(uid)) return null;
  return riposoCorrente.conclusi?.includes(uid) ? "finito" : "in-corso";
}

const nomePg = (riepilogo) => riepilogo.nomePersonaggio || riepilogo.nomeGiocatore || "Personaggio";

function annota(testo) {
  annotaRiposo(campagnaIdCorrente, uidCorrente, nomeCorrente, testo);
}

// Riposo breve di un personaggio a partire dalla sua scheda completa: il DM
// per conto di un giocatore, o il giocatore per sé.
async function riposoBrevePerConto(riepilogo, bottone) {
  if (!riepilogo?.schedaId) return;
  bottone.disabled = true;
  let scheda;
  try {
    scheda = await ottieniScheda(riepilogo.schedaId);
  } catch (errore) {
    console.error(errore);
  } finally {
    bottone.disabled = false;
  }
  if (!scheda) {
    mostraAvvisoContenuto("Impossibile leggere la scheda.", true);
    return;
  }
  const perSe = riepilogo.uid === uidCorrente;
  const esito = await apriRiposoBreve(scheda, perSe ? {} : { sottotitolo: `Per conto di ${riepilogo.nomeGiocatore || "giocatore"}` });
  if (!esito) return;
  const campi = effettiRiposoBreve(scheda, esito);
  try {
    if (perSe) await applicaRiposoScheda(scheda, campi);
    else await applicaRiposoPersonaggi(campagnaIdCorrente, [{ riepilogo, campi }]);
  } catch (errore) {
    console.error(errore);
    mostraAvvisoContenuto("Impossibile salvare il riposo.", true);
    return;
  }
  annota(testoRiposoBreve(nomePg(riepilogo), esito, dadoVitaClasse(scheda.classe)));
  if (statoRiposoDi(riepilogo.uid) === "in-corso") {
    segnaRiposoConcluso(campagnaIdCorrente, riepilogo.uid).catch((errore) => console.error(errore));
  }
}

const personaggiDelParty = () => ultimoParty.filter((r) => r.schedaId);

document.getElementById("btn-riposo-lungo-party").addEventListener("click", async () => {
  const party = personaggiDelParty();
  if (!party.length) {
    mostraAvvisoContenuto("Nessun personaggio nel party.", true);
    return;
  }
  const scelti = await confermaRiposo({
    titolo: "Riposo lungo del party",
    effetti: [
      "PF al massimo, PF temporanei azzerati",
      "Recupero di metà dei dadi vita totali (almeno 1)",
      "Slot incantesimo e incantesimi di razza ripristinati",
      "Tiri salvezza contro la morte azzerati, esaurimento −1",
      "Privilegi di classe ripristinati",
    ],
    personaggi: party.map((r) => ({ id: r.uid, nome: nomePg(r), nota: r.nomeGiocatore })),
    etichettaConferma: "Applica il riposo lungo",
  });
  if (!scelti) return;
  const voci = party.filter((r) => scelti.includes(r.uid)).map((riepilogo) => ({ riepilogo, campi: effettiRiposoLungo(riepilogo) }));
  try {
    await applicaRiposoPersonaggi(campagnaIdCorrente, voci);
  } catch (errore) {
    console.error(errore);
    mostraAvvisoContenuto("Impossibile applicare il riposo lungo.", true);
    return;
  }
  mostraAvvisoContenuto("Riposo lungo applicato.");
  annota(`Riposo lungo: ${voci.map((v) => nomePg(v.riepilogo)).join(", ")}.`);
});

document.getElementById("btn-riposo-breve-party").addEventListener("click", async () => {
  const party = personaggiDelParty();
  if (!party.length) {
    mostraAvvisoContenuto("Nessun personaggio nel party.", true);
    return;
  }
  const scelti = await confermaRiposo({
    titolo: "Riposo breve del party",
    effetti: [
      "Ogni giocatore scelto riceve l'invito a spendere i propri dadi vita",
      "Si ricaricano gli slot del Patto Magico e i privilegi da riposo breve di chi riposa",
      "Puoi spendere tu i dadi vita di chi è assente, dal pannello \"Stato\"",
    ],
    personaggi: party.map((r) => ({ id: r.uid, nome: nomePg(r), nota: r.nomeGiocatore })),
    etichettaConferma: "Avvia il riposo breve",
  });
  if (!scelti) return;
  try {
    await avviaRiposoBreve(campagnaIdCorrente, scelti);
  } catch (errore) {
    console.error(errore);
    mostraAvvisoContenuto("Impossibile avviare il riposo breve.", true);
    return;
  }
  const nomi = party.filter((r) => scelti.includes(r.uid)).map(nomePg);
  annota(`Il DM avvia un riposo breve: ${nomi.join(", ")}.`);
});

function renderBannerRiposo() {
  const banner = document.getElementById("banner-riposo");
  const breveBottone = document.getElementById("btn-riposo-breve-party");
  breveBottone.disabled = Boolean(riposoCorrente?.attivo);
  if (!riposoCorrente?.attivo) {
    banner.hidden = true;
    banner.replaceChildren();
    return;
  }
  const partecipanti = riposoCorrente.partecipanti || [];
  const conclusi = (riposoCorrente.conclusi || []).filter((uid) => partecipanti.includes(uid));
  if (puoModerare) {
    const termina = creaElemento("button", "btn-tabella", "Termina");
    termina.type = "button";
    termina.addEventListener("click", async () => {
      termina.disabled = true;
      try {
        await terminaRiposoBreve(campagnaIdCorrente);
      } catch (errore) {
        console.error(errore);
        termina.disabled = false;
      }
    });
    banner.replaceChildren(
      creaElemento("span", null, `Riposo breve in corso: ${conclusi.length} su ${partecipanti.length} hanno finito.`),
      termina
    );
    banner.hidden = false;
    return;
  }
  const mioStato = statoRiposoDi(uidCorrente);
  if (!mioStato) {
    banner.hidden = true;
    return;
  }
  if (mioStato === "finito") {
    banner.replaceChildren(creaElemento("span", null, "Riposo breve: hai finito, in attesa degli altri."));
  } else {
    const mio = ultimoParty.find((r) => r.uid === uidCorrente);
    const spendi = creaElemento("button", "btn-tabella btn-tabella-evidenza", "Spendi i dadi vita");
    spendi.type = "button";
    spendi.disabled = !mio?.schedaId;
    spendi.addEventListener("click", () => riposoBrevePerConto(mio, spendi));
    banner.replaceChildren(creaElemento("span", null, "Il DM ha avviato un riposo breve."), spendi);
  }
  banner.hidden = false;
}

function avviaAscoltoRiposo() {
  let primo = true;
  ascoltaRiposo(campagnaIdCorrente, (riposo) => {
    const eraInvitato = statoRiposoDi(uidCorrente) === "in-corso";
    riposoCorrente = riposo;
    if (!primo && !puoModerare && !eraInvitato && statoRiposoDi(uidCorrente) === "in-corso") {
      mostraAvvisoContenuto("Il DM ha avviato un riposo breve: spendi i tuoi dadi vita.");
    }
    primo = false;
    renderParty(ultimoParty);
  }, (errore) => console.error(errore));
}

async function caricaParty() {
  try {
    // Il DM riallinea tutti i riepiloghi alle schede vere (e toglie chi
    // non è più membro); un giocatore riallinea solo il proprio.
    if (puoModerare) {
      await rigeneraRiepiloghiParty(campagnaIdCorrente);
    } else {
      await sincronizzaMioRiepilogo(uidCorrente, campagnaIdCorrente);
    }
  } catch (errore) {
    console.error(errore);
  }
  await new Promise((pronto) => {
    ascoltaRiepiloghiParty(campagnaIdCorrente, (party) => {
      renderParty(party);
      pronto();
    }, (errore) => {
      console.error(errore);
      pronto();
    });
  });
}

function aggiornaBadgeStato(inCorso) {
  const badge = document.getElementById("badge-stato-sessione");
  badge.textContent = inCorso ? "Sessione in corso" : "Nessuna sessione in corso";
}

function fermaAscolto() {
  smettiAscolto?.();
  smettiNascosti?.();
  smettiAscolto = smettiNascosti = null;
  appuntiPubblici = [];
  tiriNascosti = [];
  appuntiGiaVisti = null;
}

function attivaAscolto(id) {
  fermaAscolto();
  smettiAscolto = ascoltaAppunti(id, riceviAppunti);
  if (puoModerare) {
    smettiNascosti = ascoltaTiriNascosti(id, (elenco) => {
      tiriNascosti = elenco;
      renderAppunti();
    });
  }
}

function mostraStatoAttivo(id) {
  sessioneAttivaId = id;
  aggiornaBadgeStato(true);
  document.getElementById("btn-apri-sessione").hidden = true;
  document.getElementById("btn-chiudi-sessione").hidden = false;
  document.getElementById("nessuna-sessione-msg").hidden = true;
  document.getElementById("form-appunto").hidden = false;
  attivaAscolto(id);
  renderContenuti();
}

// Apertura guidata: il pulsante dice quale sessione programmata si aprirà
// (la prima in calendario, vedi apriSessione).
async function aggiornaEtichettaApri() {
  const bottone = document.getElementById("btn-apri-sessione");
  if (!puoModerare || !campagnaIdCorrente) return;
  try {
    const [prima] = await elencaSessioniProgrammate(campagnaIdCorrente);
    if (!prima) bottone.textContent = "Apri nuova sessione";
    else if (prima.dataProgrammata === oggiIso()) bottone.textContent = `Apri la sessione di oggi (${etichettaSessione(prima)})`;
    else bottone.textContent = `Apri la ${etichettaSessione(prima)} (programmata per ${formattaDataOra(prima.dataProgrammata, prima.oraProgrammata)})`;
  } catch (errore) {
    console.error(errore);
  }
}

function mostraStatoInattivo() {
  aggiornaEtichettaApri();
  sessioneAttivaId = null;
  aggiornaBadgeStato(false);
  document.getElementById("btn-apri-sessione").hidden = false;
  document.getElementById("btn-chiudi-sessione").hidden = true;
  document.getElementById("form-appunto").hidden = true;
  document.getElementById("nessuna-sessione-msg").hidden = false;
  document.getElementById("appunti-vuoto").hidden = true;
  document.getElementById("lista-appunti").innerHTML = "";
  renderContenuti();
}

// ---------- Contenuti mostrati dal DM ----------
// Il DM vede i contenuti collegati alla sessione in corso e decide a chi
// mostrarli; i giocatori vedono in tempo reale quelli mostrati a loro.
// Alla chiusura della sessione (chiudiSessione) spariscono dalla vista "dal
// vivo" e quelli destinati all'archivio passano nell'archivio di chi li ha visti.

let isDmContenuti = false;
// Ultimo party caricato (usato anche dal tracker di combattimento).
let ultimoParty = [];
let contenuti = [];
let membriCampagna = [];
let contenutiGiaVisti = null;

const nomeMembro = (uid) => membriCampagna.find((m) => m.uid === uid)?.nome || "Giocatore";

// Stato di visibilità: testo ed etichetta colorata (tutti / alcuni / nascosto).
function statoVisibilita(c) {
  const a = c.mostrataA || [];
  if (a.length === 0) return { tipo: "nascosto", testo: "Nascosto ai giocatori" };
  if (membriCampagna.length > 0 && membriCampagna.every((m) => a.includes(m.uid))) {
    return { tipo: "tutti", testo: "Visibile a tutto il party" };
  }
  return { tipo: "alcuni", testo: `Visibile a: ${a.map(nomeMembro).join(", ")}` };
}

// Righe con la scelta "Solo ad alcuni" aperta: restano aperte anche quando
// la lista si aggiorna in tempo reale.
const sceltaAperta = new Set();

async function cambiaVisibilita(c, uids, bottoni) {
  bottoni.forEach((b) => (b.disabled = true));
  try {
    await mostraContenuto(campagnaIdCorrente, c, uids, sessioneAttivaId);
    sceltaAperta.delete(c.id);
    renderContenuti();
  } catch (errore) {
    console.error(errore);
    alert("Impossibile cambiare la visibilità del contenuto.");
  } finally {
    bottoni.forEach((b) => (b.disabled = false));
  }
}

function anteprimaContenuto(c) {
  const anteprima = creaElemento("button", "miniatura-contenuto");
  anteprima.type = "button";
  anteprima.setAttribute("aria-label", `Apri: ${c.titolo}`);
  anteprima.append(creaMiniatura(campagnaIdCorrente, c.id));
  anteprima.addEventListener("click", () => apriLightbox(campagnaIdCorrente, c));
  return anteprima;
}

function bottone(testo, classe = "") {
  const b = creaElemento("button", `btn-azione ${classe}`.trim(), testo);
  b.type = "button";
  return b;
}

// Riga del DM: miniatura | titolo, categoria e stato | bottoni (in colonna).
// I bottoni dipendono dallo stato: nascosto → Mostra a tutti, Solo ad alcuni;
// visibile a tutti → Solo ad alcuni, Nascondi; visibile ad alcuni → tutti e tre.
function rigaContenutoDM(c) {
  const li = creaElemento("li", "riga-contenuto-sessione");
  const info = creaElemento("div", "riga-contenuto-info");
  const stato = statoVisibilita(c);
  info.append(
    creaElemento("div", "riga-contenuto-titolo", c.titolo),
    creaElemento("div", "party-sessione-sub",
      `${CATEGORIE[c.categoria] || "Altro"} · ${c.riservati.archivio ? "per l'archivio" : "solo in sessione"}`),
    creaElemento("span", `pill-stato pill-${stato.tipo}`, stato.testo)
  );

  const azioni = creaElemento("div", "riga-contenuto-azioni");
  const aTutti = bottone("Mostra a tutti", "pieno");
  const scegli = bottone("Solo ad alcuni…");
  const nascondi = bottone("Nascondi");
  if (stato.tipo !== "tutti") azioni.append(aTutti);
  azioni.append(scegli);
  if (stato.tipo !== "nascosto") azioni.append(nascondi);
  const bottoni = [aTutti, scegli, nascondi];

  const scelta = creaElemento("div", "scelta-giocatori");
  scelta.hidden = !sceltaAperta.has(c.id);
  scegli.classList.toggle("attivo", !scelta.hidden);
  membriCampagna.forEach((m) => {
    const etichetta = creaElemento("label", "checkbox-scudo");
    const casella = document.createElement("input");
    casella.type = "checkbox";
    casella.value = m.uid;
    casella.checked = (c.mostrataA || []).includes(m.uid);
    etichetta.append(casella, ` ${m.nome || "Giocatore"}`);
    scelta.append(etichetta);
  });
  const applica = bottone("Applica", "pieno");
  scelta.append(applica);

  aTutti.addEventListener("click", () => cambiaVisibilita(c, membriCampagna.map((m) => m.uid), bottoni));
  nascondi.addEventListener("click", () => cambiaVisibilita(c, [], bottoni));
  scegli.addEventListener("click", () => {
    scelta.hidden = !scelta.hidden;
    scegli.classList.toggle("attivo", !scelta.hidden);
    if (scelta.hidden) sceltaAperta.delete(c.id);
    else sceltaAperta.add(c.id);
  });
  applica.addEventListener("click", () => {
    const uids = [...scelta.querySelectorAll("input:checked")].map((x) => x.value);
    cambiaVisibilita(c, uids, [...bottoni, applica]);
  });

  li.append(anteprimaContenuto(c), info, azioni, scelta);
  return li;
}

function rigaContenutoGiocatore(c) {
  const li = creaElemento("li", "riga-contenuto-sessione riga-contenuto-giocatore");
  const info = creaElemento("div", "riga-contenuto-info");
  info.append(
    creaElemento("div", "riga-contenuto-titolo", c.titolo),
    creaElemento("div", "party-sessione-sub", CATEGORIE[c.categoria] || "Altro")
  );
  if (c.descrizione) info.append(creaElemento("div", "riga-contenuto-descrizione", c.descrizione));
  li.append(anteprimaContenuto(c), info);
  return li;
}

function renderContenuti() {
  if (!campagnaIdCorrente) return;
  pannelloMappa?.ridisegna();
  const lista = document.getElementById("lista-contenuti-sessione");
  const vuoto = document.getElementById("contenuti-vuoto");
  const collega = document.getElementById("btn-collega-contenuti");
  const link = document.getElementById("link-contenuti");
  let elenco;

  if (isDmContenuti) {
    document.getElementById("titolo-contenuti").textContent = "Contenuti";
    link.hidden = false;
    link.href = "libreria.html";
    link.textContent = "Libreria";
    collega.hidden = !sessioneAttivaId;
    // Collegati alla sessione in corso, più quelli ancora visibili (es. da una
    // sessione precedente non chiusa).
    elenco = contenuti.filter((c) =>
      (sessioneAttivaId && c.riservati.sessioniCollegate.includes(sessioneAttivaId)) || (c.mostrataA || []).length > 0);
    vuoto.querySelector("p").textContent = sessioneAttivaId
      ? "Nessun contenuto collegato a questa sessione: collegane dalla libreria."
      : "Nessuna sessione in corso. Prepara i contenuti dalla Libreria o da Gestione campagna, poi mostrali qui durante la sessione.";
    lista.replaceChildren(...elenco.map(rigaContenutoDM));
  } else {
    link.hidden = false;
    link.href = "archivio.html";
    link.textContent = "Archivio";
    elenco = contenuti.filter((c) => (c.mostrataA || []).includes(uidCorrente));
    vuoto.querySelector("p").textContent = "Nulla da mostrare al momento.";
    lista.replaceChildren(...elenco.map(rigaContenutoGiocatore));
    // Avviso quando il DM mostra qualcosa di nuovo.
    const idOra = new Set(elenco.map((c) => c.id));
    if (contenutiGiaVisti) {
      const nuovi = elenco.filter((c) => !contenutiGiaVisti.has(c.id));
      if (nuovi.length) mostraAvvisoContenuto(nuovi.length === 1 ? `Il DM ti mostra: ${nuovi[0].titolo}` : `Il DM ti mostra ${nuovi.length} contenuti`);
    }
    contenutiGiaVisti = idOra;
    chiudiLightboxSeSparito(idOra);
  }
  vuoto.hidden = elenco.length > 0;
}

let timerAvviso = null;
function mostraAvvisoContenuto(testo, errore = false) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = testo;
  toast.className = `toast visibile${errore ? " toast-errore" : ""}`;
  clearTimeout(timerAvviso);
  timerAvviso = setTimeout(() => (toast.className = "toast"), 4000);
}

async function avviaContenuti(isDmOAdmin) {
  isDmContenuti = isDmOAdmin;
  const alErrore = (errore) => console.error(errore);
  if (isDmOAdmin) {
    try {
      membriCampagna = await elencaMembriCampagna(campagnaIdCorrente);
    } catch (errore) {
      console.error(errore);
    }
    ascoltaLibreriaDM(campagnaIdCorrente, (elenco) => {
      contenuti = elenco;
      renderContenuti();
    }, alErrore);
  } else {
    ascoltaContenutiVisibili(campagnaIdCorrente, uidCorrente, (elenco) => {
      contenuti = elenco;
      renderContenuti();
    }, alErrore);
  }
}

document.getElementById("btn-collega-contenuti").addEventListener("click", async () => {
  if (!sessioneAttivaId) return;
  const collegati = new Set(contenuti.filter((c) => c.riservati.sessioniCollegate.includes(sessioneAttivaId)).map((c) => c.id));
  const scelti = await scegliContenuti({
    campagnaId: campagnaIdCorrente,
    titolo: "Contenuti di questa sessione",
    contenuti,
    selezionati: collegati,
  });
  if (!scelti) return;
  try {
    await collegaContenutiSessione(
      campagnaIdCorrente,
      sessioneAttivaId,
      [...scelti].filter((id) => !collegati.has(id)),
      [...collegati].filter((id) => !scelti.has(id))
    );
  } catch (errore) {
    console.error(errore);
    alert("Impossibile collegare i contenuti.");
  }
});

proteggiPagina(async (user, profilo) => {
  uidCorrente = user.uid;
  // Deve coincidere con il nome del profilo: le regole lo verificano.
  nomeCorrente = profilo?.nome ?? null;
  const ruolo = profilo?.ruolo || ROLES.PLAYER;

  montaMenuUtente({ contenitore: document.getElementById("slot-utente"), user, profilo });

  // Si è DM solo della campagna che si guida: in quella di un altro (anche da
  // admin) si gioca come tutti gli altri giocatori.
  const campagna = await ottieniCampagnaCorrente(user.uid, ruolo);
  const isDmOAdmin = campagna ? campagna.mioRuolo === ROLES.DM : ruolo !== ROLES.PLAYER;
  puoModerare = isDmOAdmin;
  if (!campagna) {
    document.getElementById("testo-nessuna-campagna").textContent = isDmOAdmin
      ? "Non hai ancora una campagna attiva: creane una dal pannello Gestione campagna."
      : "Non sei ancora membro di una campagna attiva: chiedi al tuo Dungeon Master di aggiungerti.";
    document.getElementById("nessuna-campagna").hidden = false;
    document.getElementById("hub-sessione").hidden = true;
    veil.style.display = "none";
    contenuto.style.display = "block";
    return;
  }
  campagnaIdCorrente = campagna.id;

  document.getElementById("controlli-dm").hidden = !isDmOAdmin;
  document.getElementById("azioni-riposo-party").hidden = !isDmOAdmin;
  document.getElementById("dadi-nascosto-wrap").hidden = !isDmOAdmin;
  document.getElementById("link-controllo-musica").hidden = !isDmOAdmin;
  montaWidgetMusica(document.getElementById("corpo-musica-sessione"), campagnaIdCorrente);

  let stato;
  try {
    stato = await ottieniStatoSessione(campagnaIdCorrente);
  } catch (errore) {
    console.error(errore);
    stato = { inCorso: false, sessioneAttivaId: null };
  }

  if (stato.inCorso && stato.sessioneAttivaId) {
    mostraStatoAttivo(stato.sessioneAttivaId);
  } else {
    mostraStatoInattivo();
  }

  await Promise.all([caricaParty(), avviaContenuti(isDmOAdmin)]);
  // sessione.html#registro (dalla Gestione campagna) apre subito il registro.
  if (location.hash === "#registro") document.getElementById("btn-apri-registro").click();
  avviaAscoltoRiposo();
  trackerCombattimento = montaCombattimento({
    pannello: document.getElementById("pannello-combattimento"),
    campagnaId: campagnaIdCorrente,
    uid: uidCorrente,
    isDM: isDmOAdmin,
    party: () => ultimoParty,
    libreria: () => contenuti,
    avviso: (testo, errore = false) => mostraAvvisoContenuto(testo, errore),
    // I tiri di iniziativa del DM (per i nemici) restano nascosti.
    registraTiro: (chi, tiro) => registraTiro(chi, tiro, isDmOAdmin),
    mappaInTavola: () => pannelloMappa?.haMappaInTavola() ?? false,
    nomeUtente: () => nomeCorrente,
  });

  pannelloMappa = montaMappa({
    pannello: document.getElementById("pannello-mappa"),
    campagnaId: campagnaIdCorrente,
    uid: uidCorrente,
    isDM: isDmOAdmin,
    party: () => ultimoParty,
    libreria: () => contenuti,
    membri: () => membriCampagna.map((m) => m.uid),
    membriUid: () => campagna.membriUid || [],
    nomeUtente: () => nomeCorrente,
    avviso: (testo, errore = false) => mostraAvvisoContenuto(testo, errore),
  });

  veil.style.display = "none";
  contenuto.style.display = "block";
});

document.getElementById("btn-apri-sessione").addEventListener("click", async (evento) => {
  const bottone = evento.currentTarget;
  bottone.disabled = true;
  try {
    const { id } = await apriSessione(campagnaIdCorrente);
    mostraStatoAttivo(id);
  } catch (errore) {
    console.error(errore);
  } finally {
    bottone.disabled = false;
  }
});

document.getElementById("btn-chiudi-sessione").addEventListener("click", async (evento) => {
  const bottone = evento.currentTarget;
  bottone.disabled = true;
  try {
    await chiudiSessione(campagnaIdCorrente, sessioneAttivaId);
    fermaAscolto();
    mostraStatoInattivo();
  } catch (errore) {
    console.error(errore);
  } finally {
    bottone.disabled = false;
  }
});

document.getElementById("form-appunto").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const campo = document.getElementById("campo-appunto");
  const testo = campo.value.trim();
  if (!testo || !sessioneAttivaId) return;

  const bottone = evento.target.querySelector("button[type=submit]");
  bottone.disabled = true;
  try {
    await aggiungiAppunto(sessioneAttivaId, uidCorrente, nomeCorrente, testo);
    campo.value = "";
  } catch (errore) {
    console.error(errore);
  } finally {
    bottone.disabled = false;
  }
});

// ---------- Lancio dei dadi ----------
// Con una sessione in corso il tiro va nel registro (per il DM, a scelta,
// nascosto); senza, resta solo a chi lo tira.
async function registraTiro(chi, tiro, nascosto = false) {
  if (!sessioneAttivaId) return false;
  try {
    await aggiungiTiro(sessioneAttivaId, uidCorrente, nomeCorrente, testoTiro(chi, tiro), tiro, nascosto);
    return true;
  } catch (errore) {
    console.error(errore);
    mostraAvvisoContenuto("Impossibile registrare il tiro.", true);
    return false;
  }
}

document.getElementById("dadi-facce").addEventListener("change", (evento) => {
  const modo = document.getElementById("dadi-modo");
  modo.disabled = evento.target.value !== "20";
  if (modo.disabled) modo.value = "normale";
});

document.getElementById("lanciatore-dadi").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const valore = (id) => Math.trunc(Number(document.getElementById(id).value)) || 0;
  const tiro = tira({
    etichetta: document.getElementById("dadi-etichetta").value.trim() || "Tiro",
    quanti: Math.max(1, valore("dadi-quanti")),
    facce: valore("dadi-facce"),
    modificatore: valore("dadi-modificatore"),
    modo: document.getElementById("dadi-modo").value,
  });
  const mio = ultimoParty.find((r) => r.uid === uidCorrente);
  const chi = puoModerare ? null : mio?.nomePersonaggio || nomeCorrente;
  const nascosto = puoModerare && document.getElementById("dadi-nascosto").checked;
  const registrato = await registraTiro(chi, tiro, nascosto);
  mostraAvvisoContenuto(`${registrato ? "" : "Solo per te — "}${testoTiro(null, tiro)}`);
  document.getElementById("dadi-etichetta").value = "";
});

// Registro storico: elenco delle sessioni passate, con gli appunti di ognuna
// caricati solo quando la si apre (accordion), per non scaricare tutto lo
// storico in un colpo solo man mano che le sessioni si accumulano.
const modaleRegistro = document.getElementById("modal-registro");

function rigaSessioneProgrammata(sessione) {
  const div = document.createElement("div");
  div.className = "registro-sessione-voce";
  const dataFormattata = sessione.dataProgrammata
    ? sessione.dataProgrammata.split("-").reverse().join("/")
    : "";
  div.innerHTML = `<p style="margin:0; padding:10px 0;">Sessione ${esc(sessione.numero)} — programmata per il ${esc(dataFormattata)}${sessione.titolo ? ` (${esc(sessione.titolo)})` : ""}</p>`;
  return conSelezione(div, sessione);
}

// Eliminazione delle sessioni (solo DM/admin): in modalità selezione ogni
// voce del registro ha una casella; "Elimina selezionate" chiede conferma.
function conSelezione(voce, sessione) {
  if (!puoModerare) return voce;
  const riga = document.createElement("div");
  riga.className = "registro-riga";
  const etichetta = document.createElement("label");
  etichetta.className = "registro-casella";
  etichetta.innerHTML = `<input type="checkbox" data-sessione="${esc(sessione.id)}" data-numero="${esc(sessione.numero ?? "")}" /><span class="sr-only">Seleziona la sessione ${esc(sessione.numero)}</span>`;
  riga.append(etichetta, voce);
  return riga;
}

const listaRegistro = document.getElementById("lista-registro");
const selezionate = () => Array.from(listaRegistro.querySelectorAll("input[data-sessione]:checked"));

function modalitaSelezione(attiva) {
  listaRegistro.classList.toggle("in-selezione", attiva);
  document.getElementById("btn-seleziona-sessioni").hidden = attiva;
  document.getElementById("registro-selezione").hidden = !attiva;
  if (!attiva) listaRegistro.querySelectorAll("input[data-sessione]").forEach((c) => (c.checked = false));
  aggiornaSelezione();
}

function aggiornaSelezione() {
  const n = selezionate().length;
  const bottone = document.getElementById("btn-elimina-selezionate");
  bottone.disabled = n === 0;
  bottone.textContent = n ? `Elimina selezionate (${n})` : "Elimina selezionate";
}

listaRegistro.addEventListener("change", (evento) => {
  if (evento.target.matches("input[data-sessione]")) aggiornaSelezione();
});
document.getElementById("btn-seleziona-sessioni").addEventListener("click", () => modalitaSelezione(true));
document.getElementById("btn-annulla-selezione").addEventListener("click", () => modalitaSelezione(false));
document.getElementById("btn-elimina-selezionate").addEventListener("click", async (evento) => {
  const caselle = selezionate();
  if (caselle.length === 0) return;
  const numeri = caselle.map((c) => c.dataset.numero).filter(Boolean).join(", ");
  const domanda = `Eliminare ${caselle.length === 1 ? "la sessione" : `${caselle.length} sessioni`}${numeri ? ` (n. ${numeri})` : ""} con tutti i loro appunti e tiri? Non si può annullare.`;
  if (!confirm(domanda)) return;
  const bottone = evento.currentTarget;
  bottone.disabled = true;
  mostraAttesa(bottone, "Eliminazione…");
  try {
    await eliminaSessioni(campagnaIdCorrente, caselle.map((c) => c.dataset.sessione));
    mostraAvvisoContenuto(caselle.length === 1 ? "Sessione eliminata." : `${caselle.length} sessioni eliminate.`);
    modalitaSelezione(false);
    await caricaRegistro();
  } catch (errore) {
    console.error(errore);
    mostraAvvisoContenuto("Impossibile eliminare le sessioni.", true);
    aggiornaSelezione();
  }
});

document.getElementById("btn-apri-registro").addEventListener("click", () => {
  modaleRegistro.style.display = "flex";
  document.getElementById("registro-azioni-dm").hidden = !puoModerare;
  modalitaSelezione(false);
  caricaRegistro();
});

async function caricaRegistro() {
  const lista = listaRegistro;
  const vuoto = document.getElementById("registro-vuoto");
  lista.replaceChildren(creaScheletro(3));
  vuoto.hidden = true;

  try {
    const [programmate, sessioni] = await Promise.all([
      elencaSessioniProgrammate(campagnaIdCorrente),
      elencaRegistroSessioni(campagnaIdCorrente),
    ]);
    lista.replaceChildren();
    programmate.forEach((sessione) => lista.appendChild(rigaSessioneProgrammata(sessione)));

    if (sessioni.length === 0) {
      if (programmate.length === 0) vuoto.hidden = false;
      return;
    }
    sessioni.forEach((sessione) => {
      const dettagli = document.createElement("details");
      dettagli.className = "registro-sessione-voce";
      const statoSessione = sessione.chiusaIl ? "" : " (in corso)";
      dettagli.innerHTML = `
        <summary>Sessione ${esc(sessione.numero)} — ${formattaData(sessione.apertaIl)}${statoSessione}</summary>
        <div class="registro-sessione-appunti" data-corpo></div>
      `;
      dettagli.addEventListener("toggle", async () => {
        if (!dettagli.open) return;
        const corpo = dettagli.querySelector("[data-corpo]");
        if (corpo.dataset.caricato) return;
        corpo.dataset.caricato = "true";
        corpo.innerHTML = '<p class="scheda-testo-libero">Caricamento…</p>';
        try {
          const appunti = await elencaAppuntiSessione(sessione.id);
          corpo.innerHTML = appunti.length === 0
            ? '<p class="scheda-testo-libero">Nessun appunto per questa sessione.</p>'
            : appunti.map((appunto) => rigaAppunto(appunto, sessione.id)).join("");
        } catch (errore) {
          console.error(errore);
          corpo.innerHTML = '<p class="scheda-testo-libero">Impossibile caricare gli appunti.</p>';
        }
      });
      lista.appendChild(conSelezione(dettagli, sessione));
    });
  } catch (errore) {
    console.error(errore);
    lista.replaceChildren();
    mostraAvvisoContenuto("Impossibile caricare il registro.", true);
  } finally {
    document.getElementById("btn-seleziona-sessioni").disabled = !lista.querySelector("input[data-sessione]");
  }
}

document.getElementById("chiudi-registro").addEventListener("click", () => {
  modaleRegistro.style.display = "none";
});

// Moderazione (solo DM/admin): elimina un appunto, sia dalla sessione in
// corso (la lista si aggiorna da sola, è in tempo reale) sia dal registro.
document.addEventListener("click", async (evento) => {
  const bottone = evento.target.closest("[data-elimina-appunto]");
  if (!bottone) return;
  if (!confirm("Eliminare questo appunto? Non si potrà recuperare.")) return;
  bottone.disabled = true;
  try {
    await eliminaAppunto(bottone.dataset.sessione, bottone.dataset.eliminaAppunto, bottone.dataset.collezione || "appunti");
    bottone.closest(".sessione-appunto")?.remove();
  } catch (errore) {
    console.error(errore);
    bottone.disabled = false;
  }
});
