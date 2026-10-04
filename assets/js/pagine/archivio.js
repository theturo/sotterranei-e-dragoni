// Script della pagina archivio.html: i contenuti che il DM ha mostrato al
// giocatore e destinato all'archivio, disponibili dopo la sessione in cui sono
// comparsi. Solo consultazione; le regole garantiscono che ognuno legga solo
// il proprio archivio.
import { proteggiPagina, ROLES } from "../auth.js";
import { ottieniCampagnaCorrente } from "../dati/campagne.js";
import { elencaSessioniCampagna } from "../dati/sessioni.js";
import { ascoltaContenutiVisibili } from "../dati/libreria.js";
import { montaMenuUtente } from "../menu-utente.js";
import {
  CATEGORIE,
  riempiCategorie,
  etichettaSessione,
  creaElemento,
  creaMiniatura,
  apriLightbox,
  chiudiLightboxSeSparito,
} from "../contenuti.js";
import { mostraToast } from "../utils.js";

const veil = document.getElementById("veil");
const contenuto = document.getElementById("contenuto");
const griglia = document.getElementById("griglia-archivio");
const vuoto = document.getElementById("archivio-vuoto");
const filtri = {
  testo: document.getElementById("filtro-testo"),
  categoria: document.getElementById("filtro-categoria"),
  sessione: document.getElementById("filtro-sessione"),
  ordine: document.getElementById("filtro-ordine"),
};

let campagnaIdCorrente = null;
let uidCorrente = null;
let sessioni = new Map();
let archivio = [];
let primoCaricamento = true;
const schede = new Map();


// Sessioni in cui il contenuto è comparso, in ordine.
function sessioniDi(c) {
  return (c.sessioniMostrata || [])
    .map((id) => sessioni.get(id))
    .filter(Boolean)
    .sort((a, b) => (a.numero || 0) - (b.numero || 0));
}

function testoComparso(c) {
  const elenco = sessioniDi(c);
  return elenco.length ? `Comparso in: ${elenco.map(etichettaSessione).join(", ")}` : "";
}

// "Più recenti" = comparsi in una sessione più recente.
function chiaveTempo(c) {
  const elenco = sessioniDi(c);
  return elenco.length ? elenco[elenco.length - 1].numero || 0 : 0;
}

function ordina(elenco) {
  const copia = [...elenco];
  if (filtri.ordine.value === "titolo") return copia.sort((a, b) => a.titolo.localeCompare(b.titolo, "it"));
  const verso = filtri.ordine.value === "vecchi" ? 1 : -1;
  return copia.sort((a, b) => verso * (chiaveTempo(a) - chiaveTempo(b)) || a.titolo.localeCompare(b.titolo, "it"));
}

function passaFiltri(c) {
  const testo = filtri.testo.value.trim().toLowerCase();
  if (testo && ![c.titolo, c.descrizione].filter(Boolean).join(" ").toLowerCase().includes(testo)) return false;
  if (filtri.categoria.value && c.categoria !== filtri.categoria.value) return false;
  if (filtri.sessione.value && !(c.sessioniMostrata || []).includes(filtri.sessione.value)) return false;
  return true;
}

function aggiornaFiltroSessioni() {
  const usate = new Set(archivio.flatMap((c) => c.sessioniMostrata || []));
  const scelta = filtri.sessione.value;
  filtri.sessione.length = 1;
  [...sessioni.values()]
    .filter((s) => usate.has(s.id))
    .sort((a, b) => (a.numero || 0) - (b.numero || 0))
    .forEach((s) => filtri.sessione.add(new Option(etichettaSessione(s), s.id)));
  filtri.sessione.value = usate.has(scelta) ? scelta : "";
}

function creaScheda(c) {
  const li = creaElemento("li", "scheda-immagine");
  const apri = creaElemento("button", "scheda-immagine-anteprima");
  apri.type = "button";
  apri.append(creaMiniatura(campagnaIdCorrente, c.id));
  apri.addEventListener("click", () => {
    const attuale = archivio.find((x) => x.id === c.id);
    if (attuale) apriLightbox(campagnaIdCorrente, attuale, testoComparso(attuale));
  });
  const corpo = creaElemento("div", "scheda-immagine-corpo");
  corpo.append(
    creaElemento("div", "scheda-immagine-titolo"),
    creaElemento("div", "scheda-immagine-meta"),
    creaElemento("div", "party-sessione-sub scheda-immagine-comparso")
  );
  li.append(apri, corpo);
  return li;
}

function aggiornaScheda(li, c) {
  li.querySelector(".scheda-immagine-titolo").textContent = c.titolo;
  li.querySelector(".scheda-immagine-anteprima").setAttribute("aria-label", `Apri: ${c.titolo}`);
  li.querySelector(".scheda-immagine-meta").replaceChildren(creaElemento("span", "etichetta-categoria", CATEGORIE[c.categoria] || "Altro"));
  li.querySelector(".scheda-immagine-comparso").textContent = testoComparso(c);
}

function render() {
  const visibili = ordina(archivio.filter(passaFiltri));
  const idPresenti = new Set(archivio.map((c) => c.id));
  schede.forEach((li, id) => {
    if (!idPresenti.has(id)) {
      li.remove();
      schede.delete(id);
    }
  });
  const idVisibili = new Set(visibili.map((c) => c.id));
  schede.forEach((li, id) => {
    if (!idVisibili.has(id)) li.remove();
  });
  visibili.forEach((c) => {
    let li = schede.get(c.id);
    if (!li) {
      li = creaScheda(c);
      schede.set(c.id, li);
    }
    aggiornaScheda(li, c);
    griglia.appendChild(li);
  });
  vuoto.hidden = visibili.length > 0;
  vuoto.textContent = archivio.length === 0
    ? "L'archivio è ancora vuoto: si riempirà con ciò che il Dungeon Master vi mostrerà durante le sessioni."
    : "Nessun contenuto corrisponde ai filtri.";
}

async function riceviContenuti(elenco) {
  // Qui solo l'archivio: ciò che è mostrato ora si vede nella pagina Sessione.
  const nuovoArchivio = elenco.filter((c) => (c.archiviataPer || []).includes(uidCorrente));
  // Contenuti comparsi in sessioni non ancora note (es. appena chiusa).
  const mancanti = nuovoArchivio.some((c) => (c.sessioniMostrata || []).some((id) => !sessioni.has(id)));
  if (mancanti) await caricaSessioni();
  if (!primoCaricamento) {
    const nuovi = nuovoArchivio.filter((c) => !archivio.some((vecchio) => vecchio.id === c.id));
    if (nuovi.length === 1) mostraToast(`Nuovo nell'archivio: ${nuovi[0].titolo}`);
    else if (nuovi.length > 1) mostraToast(`${nuovi.length} nuovi contenuti nell'archivio`);
  }
  primoCaricamento = false;
  archivio = nuovoArchivio;
  aggiornaFiltroSessioni();
  render();
  chiudiLightboxSeSparito(new Set(archivio.map((c) => c.id)));
}

async function caricaSessioni() {
  try {
    const elenco = await elencaSessioniCampagna(campagnaIdCorrente);
    sessioni = new Map(elenco.map((s) => [s.id, s]));
  } catch (errore) {
    console.error(errore);
  }
}

Object.values(filtri).forEach((campo) => campo.addEventListener(campo.type === "search" ? "input" : "change", render));

proteggiPagina(async (user, profilo) => {
  uidCorrente = user.uid;
  montaMenuUtente({ contenitore: document.getElementById("slot-utente"), user, profilo });
  const ruolo = profilo?.ruolo || ROLES.PLAYER;

  const campagna = await ottieniCampagnaCorrente(user.uid, ruolo);
  // Il DM gestisce tutto dalla libreria: qui ci sono solo gli archivi dei
  // giocatori (anche di un DM o admin che gioca nella campagna di un altro).
  if (campagna ? campagna.mioRuolo === ROLES.DM : ruolo !== ROLES.PLAYER) {
    window.location.href = "libreria.html";
    return;
  }
  if (!campagna) {
    document.getElementById("testo-nessuna-campagna").textContent =
      "Non sei ancora membro di una campagna attiva: chiedi al tuo Dungeon Master di aggiungerti.";
    document.getElementById("nessuna-campagna").hidden = false;
    veil.style.display = "none";
    contenuto.style.display = "block";
    return;
  }
  campagnaIdCorrente = campagna.id;
  riempiCategorie(filtri.categoria);
  await caricaSessioni();
  document.getElementById("pannello-archivio").hidden = false;

  ascoltaContenutiVisibili(campagnaIdCorrente, uidCorrente, riceviContenuti, (errore) => {
    console.error(errore);
    mostraToast("Impossibile caricare l'archivio.", true);
  });

  veil.style.display = "none";
  contenuto.style.display = "block";
});
