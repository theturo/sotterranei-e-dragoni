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
} from "../auth.js";
import { montaMenuUtente } from "../menu-utente.js";
import { esc } from "../utils.js";
import { montaWidgetMusica } from "../widget-musica.js";
import { CLASSI } from "../dati-srd.js";
import { mostraImmagine, percorsiRitratto } from "../immagini.js";

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
      <div class="party-sessione-info">
        <div class="party-sessione-nome">${esc(riepilogo.nomeGiocatore) || "—"}</div>
        <div class="party-sessione-sub">Nessun personaggio attivo</div>
      </div>
    `;
    return li;
  }
  const classe = CLASSI[riepilogo.classe];
  li.innerHTML = `
    <span class="icona-classe" aria-hidden="true">${classe?.icona || "🎲"}</span>
    <div class="party-sessione-info">
      <div class="party-sessione-nome">${esc(riepilogo.nomePersonaggio) || "—"}</div>
      <div class="party-sessione-sub">${esc(riepilogo.nomeGiocatore) || "—"} · ${esc(classe?.nome) || "—"} ${esc(riepilogo.livello || 1)}</div>
    </div>
    <div class="party-sessione-pf">${esc(testoPf(riepilogo))}</div>
  `;
  // Con un ritratto, l'icona della classe lascia il posto alla sua miniatura
  // (e ricompare se l'immagine non si può caricare).
  if (riepilogo.ritratto) {
    const icona = li.querySelector(".icona-classe");
    const img = document.createElement("img");
    img.className = "icona-ritratto";
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
}

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

  await caricaParty();

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
