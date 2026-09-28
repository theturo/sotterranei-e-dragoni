// Script della pagina i-miei-personaggi.html (spostato fuori dall'HTML per la Content Security Policy:
// la policy consente solo script serviti dal sito stesso, niente script inline).
import {
  proteggiPagina,
  ottieniCampagnaCorrente,
  elencaSchedePersonaggio,
  impostaSchedaAttiva,
  eliminaScheda,
  riordinaSchede,
} from "../auth.js";
import { montaMenuUtente } from "../menu-utente.js";
import { esc } from "../utils.js";
import { CLASSI, ICONA_CLASSE_FALLBACK, nomeRazzaCompleto } from "../dati-srd.js";

const veil = document.getElementById("veil");
const contenuto = document.getElementById("contenuto");
const griglia = document.getElementById("griglia-schede");
const nessunaScheda = document.getElementById("nessuna-scheda");
const toast = document.getElementById("toast");

let uidCorrente = null;
let campagnaIdCorrente = null;
let modoOrdinamento = false;

let toastTimer = null;
function mostraToast(testo, errore = false) {
  toast.textContent = testo;
  toast.className = `toast visibile${errore ? " toast-errore" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = "toast";
  }, 3200);
}

function testoPf(scheda) {
  if (!scheda?.hp) return "—";
  const { massimi, attuali, temporanei } = scheda.hp;
  return temporanei > 0 ? `${attuali} / ${massimi} (+${temporanei})` : `${attuali} / ${massimi}`;
}

function creaCard(scheda) {
  const classe = CLASSI[scheda.classe];
  const div = document.createElement("div");
  div.className = `scheda-card${scheda.attiva ? " scheda-card-attiva" : ""}`;
  div.draggable = modoOrdinamento;
  div.dataset.id = scheda.id;
  div.innerHTML = `
    <div class="scheda-card-header">
      <span class="maniglia-trascina" aria-hidden="true" title="Trascina per riordinare"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.8"/><circle cx="15" cy="6" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="18" r="1.8"/><circle cx="15" cy="18" r="1.8"/></svg></span>
      <span class="icona-classe" aria-hidden="true">${classe?.iconaSvg || ICONA_CLASSE_FALLBACK}</span>
      <div class="scheda-card-titoli">
        <div class="scheda-card-nome">${esc(scheda.nome) || "—"}</div>
        <div class="scheda-card-sub">${esc(nomeRazzaCompleto(scheda.razza, scheda.sottorazza))} · ${esc(classe?.nome) || "—"} ${esc(scheda.livello || 1)}</div>
      </div>
      ${scheda.attiva ? '<span class="role-badge">Attiva</span>' : ""}
    </div>
    <div class="scheda-card-pf">PF ${esc(testoPf(scheda))}</div>
    <div class="scheda-card-azioni">
      <a class="btn-tabella" href="scheda-personaggio.html?id=${esc(encodeURIComponent(scheda.id))}">Apri scheda</a>
      ${scheda.attiva ? "" : `<button class="btn-tabella btn-tabella-evidenza" data-attiva="${esc(scheda.id)}">Rendi attiva</button>`}
      <button class="btn-tabella azione-elimina" data-elimina="${esc(scheda.id)}" data-nome="${esc(scheda.nome || "questo personaggio")}">Elimina</button>
    </div>
  `;
  return div;
}

async function caricaSchede() {
  try {
    const schede = await elencaSchedePersonaggio(uidCorrente, campagnaIdCorrente);
    griglia.innerHTML = "";
    if (schede.length === 0) {
      nessunaScheda.style.display = "block";
    } else {
      nessunaScheda.style.display = "none";
      schede.forEach((scheda) => griglia.appendChild(creaCard(scheda)));
    }
  } catch (errore) {
    mostraToast("Impossibile caricare i personaggi.", true);
    console.error(errore);
  }
}

proteggiPagina(async (user, profilo) => {
  uidCorrente = user.uid;
  montaMenuUtente({
    contenitore: document.getElementById("slot-utente"),
    user,
    profilo,
    onModificaOrdine: (attivo) => {
      modoOrdinamento = attivo;
      griglia.classList.toggle("riordino-attivo", attivo);
      document.getElementById("suggerimento-riordino").hidden = !attivo;
      griglia.querySelectorAll(".scheda-card").forEach((card) => (card.draggable = attivo));
    },
  });

  const campagna = await ottieniCampagnaCorrente(user.uid, profilo?.ruolo);
  if (!campagna) {
    document.getElementById("nessuna-campagna").hidden = false;
    document.getElementById("pannello-schede").hidden = true;
    document.getElementById("link-nuovo-personaggio").hidden = true;
    veil.style.display = "none";
    contenuto.style.display = "block";
    return;
  }
  campagnaIdCorrente = campagna.id;

  await caricaSchede();
  veil.style.display = "none";
  contenuto.style.display = "block";
});

griglia.addEventListener("click", async (evento) => {
  const bottoneAttiva = evento.target.closest("[data-attiva]");
  if (bottoneAttiva) {
    bottoneAttiva.disabled = true;
    try {
      await impostaSchedaAttiva(uidCorrente, campagnaIdCorrente, bottoneAttiva.dataset.attiva);
      await caricaSchede();
      mostraToast("Personaggio reso attivo.");
    } catch (errore) {
      mostraToast("Impossibile rendere attivo il personaggio.", true);
      console.error(errore);
      bottoneAttiva.disabled = false;
    }
    return;
  }

  const bottoneElimina = evento.target.closest("[data-elimina]");
  if (bottoneElimina) {
    schedaDaEliminare = bottoneElimina.dataset.elimina;
    document.getElementById("elimina-scheda-nome").textContent = bottoneElimina.dataset.nome;
    document.getElementById("modal-elimina-scheda").style.display = "flex";
  }
});

let schedaDaEliminare = null;
const modalElimina = document.getElementById("modal-elimina-scheda");
const btnConfermaElimina = document.getElementById("btn-conferma-elimina");

document.getElementById("btn-annulla-elimina").addEventListener("click", () => {
  modalElimina.style.display = "none";
  schedaDaEliminare = null;
});

btnConfermaElimina.addEventListener("click", async () => {
  if (!schedaDaEliminare) return;
  btnConfermaElimina.disabled = true;
  try {
    await eliminaScheda(uidCorrente, campagnaIdCorrente, schedaDaEliminare);
    modalElimina.style.display = "none";
    await caricaSchede();
    mostraToast("Personaggio eliminato.");
  } catch (errore) {
    mostraToast("Impossibile eliminare il personaggio.", true);
    console.error(errore);
  } finally {
    btnConfermaElimina.disabled = false;
    schedaDaEliminare = null;
  }
});

// Riordino delle schede via trascinamento (drag & drop nativo del browser,
// funziona col mouse; il supporto touch/mobile resta una rifinitura futura).
let cardTrascinata = null;

griglia.addEventListener("dragstart", (evento) => {
  // Non avviare il trascinamento se si parte da un bottone o un link della
  // card: deve restare possibile cliccarli normalmente.
  if (evento.target.closest("a, button")) {
    evento.preventDefault();
    return;
  }
  const card = evento.target.closest(".scheda-card");
  if (!card) return;
  cardTrascinata = card;
  evento.dataTransfer.effectAllowed = "move";
  setTimeout(() => card.classList.add("trascinato"), 0);
});

griglia.addEventListener("dragend", () => {
  if (cardTrascinata) cardTrascinata.classList.remove("trascinato");
  cardTrascinata = null;
});

griglia.addEventListener("dragover", (evento) => {
  if (!cardTrascinata) return;
  evento.preventDefault();
  const bersaglio = evento.target.closest(".scheda-card");
  if (!bersaglio || bersaglio === cardTrascinata) return;
  const card = [...griglia.children];
  if (card.indexOf(cardTrascinata) < card.indexOf(bersaglio)) {
    bersaglio.after(cardTrascinata);
  } else {
    bersaglio.before(cardTrascinata);
  }
});

griglia.addEventListener("drop", async (evento) => {
  if (!cardTrascinata) return;
  evento.preventDefault();
  const idsInOrdine = [...griglia.children].map((card) => card.dataset.id);
  try {
    await riordinaSchede(idsInOrdine);
  } catch (errore) {
    mostraToast("Impossibile salvare il nuovo ordine.", true);
    console.error(errore);
    await caricaSchede();
  }
});
