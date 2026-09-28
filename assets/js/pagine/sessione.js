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
  elencaAppuntiSessione,
  elencaSessioniProgrammate,
  elencaRiepiloghiParty,
  rigeneraRiepiloghiParty,
  sincronizzaMioRiepilogo,
  eliminaAppunto,
  elencaMembriCampagna,
  ascoltaLibreriaDM,
  ascoltaContenutiVisibili,
  mostraContenuto,
  collegaContenutiSessione,
} from "../auth.js";
import { montaMenuUtente } from "../menu-utente.js";
import { esc } from "../utils.js";
import { montaWidgetMusica } from "../widget-musica.js";
import { CLASSI } from "../dati-srd.js";
import { mostraImmagine, percorsiRitratto } from "../immagini.js";
import {
  CATEGORIE,
  creaElemento,
  creaMiniatura,
  apriLightbox,
  chiudiLightboxSeSparito,
  scegliContenuti,
} from "../contenuti.js";

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
  const bottoneElimina = puoModerare
    ? `<button type="button" class="btn-rimuovi-talento" data-elimina-appunto="${esc(appunto.id)}" data-sessione="${esc(sessioneId)}" aria-label="Elimina appunto" title="Elimina appunto">×</button>`
    : "";
  return `
    <div class="sessione-appunto">
      <div class="sessione-appunto-meta"><span>${esc(appunto.autoreNome) || "—"}</span><span>${formattaOrario(appunto.creatoIl)}${bottoneElimina}</span></div>
      <div class="sessione-appunto-testo">${esc(appunto.testo)}</div>
    </div>
  `;
}

function renderAppunti(appunti) {
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
    <span class="party-avatar"><span class="icona-classe" aria-hidden="true">${classe?.icona || "🎲"}</span></span>
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

async function caricaParty() {
  const lista = document.getElementById("lista-party");
  const vuoto = document.getElementById("party-vuoto");
  try {
    // Il DM riallinea tutti i riepiloghi alle schede vere (e toglie chi
    // non è più membro); un giocatore riallinea solo il proprio.
    if (puoModerare) {
      await rigeneraRiepiloghiParty(campagnaIdCorrente);
    } else {
      await sincronizzaMioRiepilogo(uidCorrente, campagnaIdCorrente);
    }
    const party = await elencaRiepiloghiParty(campagnaIdCorrente);
    if (party.length === 0) {
      vuoto.hidden = false;
      return;
    }
    vuoto.hidden = true;
    lista.innerHTML = "";
    party.forEach((riepilogo) => lista.appendChild(creaRigaParty(riepilogo)));
  } catch (errore) {
    console.error(errore);
  }
}

function aggiornaBadgeStato(inCorso) {
  const badge = document.getElementById("badge-stato-sessione");
  badge.textContent = inCorso ? "Sessione in corso" : "Nessuna sessione in corso";
}

function attivaAscolto(id) {
  if (smettiAscolto) smettiAscolto();
  smettiAscolto = ascoltaAppunti(id, renderAppunti);
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

function mostraStatoInattivo() {
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
    vuoto.textContent = sessioneAttivaId
      ? "Nessun contenuto collegato a questa sessione: collegane dalla libreria."
      : "Nessuna sessione in corso. Prepara i contenuti dalla Libreria o da Gestione campagna, poi mostrali qui durante la sessione.";
    lista.replaceChildren(...elenco.map(rigaContenutoDM));
  } else {
    link.hidden = false;
    link.href = "archivio.html";
    link.textContent = "Archivio";
    elenco = contenuti.filter((c) => (c.mostrataA || []).includes(uidCorrente));
    vuoto.textContent = "Nulla da mostrare al momento.";
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
function mostraAvvisoContenuto(testo) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = testo;
  toast.className = "toast visibile";
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
  const isDmOAdmin = ruolo === ROLES.DM || ruolo === ROLES.ADMIN;
  puoModerare = isDmOAdmin;

  montaMenuUtente({ contenitore: document.getElementById("slot-utente"), user, profilo });

  const campagna = await ottieniCampagnaCorrente(user.uid, ruolo);
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
    if (smettiAscolto) {
      smettiAscolto();
      smettiAscolto = null;
    }
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
  return div;
}

document.getElementById("btn-apri-registro").addEventListener("click", async () => {
  modaleRegistro.style.display = "flex";
  const lista = document.getElementById("lista-registro");
  const vuoto = document.getElementById("registro-vuoto");
  lista.innerHTML = "";
  vuoto.hidden = true;

  try {
    const [programmate, sessioni] = await Promise.all([
      elencaSessioniProgrammate(campagnaIdCorrente),
      elencaRegistroSessioni(campagnaIdCorrente),
    ]);
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
      lista.appendChild(dettagli);
    });
  } catch (errore) {
    console.error(errore);
  }
});

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
    await eliminaAppunto(bottone.dataset.sessione, bottone.dataset.eliminaAppunto);
    bottone.closest(".sessione-appunto")?.remove();
  } catch (errore) {
    console.error(errore);
    bottone.disabled = false;
  }
});
