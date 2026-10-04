// Script della pagina libreria.html: la libreria dei contenuti del DM.
// Il DM carica mappe, luoghi, PNG, nemici, oggetti e dispense con note e tag
// privati, li collega alle sessioni e decide se sono destinati all'archivio
// dei giocatori. I giocatori li vedono solo quando il DM li mostra in sessione
// (pagina Sessione) e poi, se destinati all'archivio, nella pagina Archivio.
import { proteggiPaginaDM } from "../auth.js";
import { ottieniCampagnaCorrente, elencaMembriCampagna } from "../dati/campagne.js";
import { elencaSessioniCampagna } from "../dati/sessioni.js";
import {
  nuovoIdImmagine,
  creaContenuto,
  aggiornaContenuto,
  eliminaContenuto,
  ascoltaLibreriaDM,
} from "../dati/libreria.js";
import { montaMenuUtente } from "../menu-utente.js";
import {
  TIPI_ACCETTATI,
  ErroreImmagine,
  ridimensionaImmagine,
  caricaImmagine,
  eliminaImmagine,
  mostraImmagine,
  latoImmagineCampagna,
  LATO_MINIATURA,
  MASSIMO_BYTE_CAMPAGNA,
  percorsiImmagineCampagna,
} from "../immagini.js";
import {
  CATEGORIE,
  riempiCategorie,
  etichettaSessione,
  leggiTag,
  ordinaContenuti,
  creaElemento,
  creaMiniatura,
  apriLightbox,
} from "../contenuti.js";
import { mostraAttesa, mostraToast } from "../utils.js";

const veil = document.getElementById("veil");
const contenuto = document.getElementById("contenuto");
const griglia = document.getElementById("griglia-contenuti");
const libreriaVuota = document.getElementById("libreria-vuota");
const filtri = {
  testo: document.getElementById("filtro-testo"),
  categoria: document.getElementById("filtro-categoria"),
  tag: document.getElementById("filtro-tag"),
  stato: document.getElementById("filtro-stato"),
  sessione: document.getElementById("filtro-sessione"),
  ordine: document.getElementById("filtro-ordine"),
};

let campagnaIdCorrente = null;
let membri = [];
let sessioni = [];
let contenuti = [];
// Schede già create, per ID: si aggiornano sul posto (niente miniature riscaricate).
const schede = new Map();


const nomeMembro = (uid) => membri.find((m) => m.uid === uid)?.nome || "Giocatore";
const sessionePerId = (id) => sessioni.find((s) => s.id === id);

// ---------- Filtri ----------

function passaFiltri(c) {
  const testo = filtri.testo.value.trim().toLowerCase();
  if (testo) {
    const dove = [c.titolo, c.descrizione, c.riservati.note, ...c.riservati.tag].filter(Boolean).join(" ").toLowerCase();
    if (!dove.includes(testo)) return false;
  }
  if (filtri.categoria.value && c.categoria !== filtri.categoria.value) return false;
  if (filtri.tag.value && !c.riservati.tag.includes(filtri.tag.value)) return false;
  const mostrato = (c.sessioniMostrata || []).length > 0 || (c.vistaDa || []).length > 0 || (c.mostrataA || []).length > 0;
  switch (filtri.stato.value) {
    case "mai": if (mostrato) return false; break;
    case "ora": if ((c.mostrataA || []).length === 0) return false; break;
    case "archivio": if ((c.archiviataPer || []).length === 0) return false; break;
    case "attesa": if (!c.riservati.archivio || (c.archiviataPer || []).length > 0) return false; break;
    case "riservati": if (c.riservati.archivio) return false; break;
  }
  const collegate = c.riservati.sessioniCollegate || [];
  if (filtri.sessione.value === "nessuna" && collegate.length > 0) return false;
  if (filtri.sessione.value && filtri.sessione.value !== "nessuna" && !collegate.includes(filtri.sessione.value)) return false;
  return true;
}

function aggiornaOpzioniFiltri() {
  // Tag: tutti quelli usati, in ordine alfabetico (mantiene la scelta attuale).
  const tagUsati = [...new Set(contenuti.flatMap((c) => c.riservati.tag))].sort((a, b) => a.localeCompare(b, "it"));
  const tagScelto = filtri.tag.value;
  filtri.tag.length = 1;
  tagUsati.forEach((t) => filtri.tag.add(new Option(t, t)));
  filtri.tag.value = tagUsati.includes(tagScelto) ? tagScelto : "";

  const sessioneScelta = filtri.sessione.value;
  filtri.sessione.length = 2;
  sessioni.forEach((s) => filtri.sessione.add(new Option(etichettaSessione(s), s.id)));
  filtri.sessione.value = [...filtri.sessione.options].some((o) => o.value === sessioneScelta) ? sessioneScelta : "";
}

// ---------- Schede ----------

function creaScheda(c) {
  const li = creaElemento("li", "scheda-immagine");
  li.dataset.id = c.id;
  const apri = creaElemento("button", "scheda-immagine-anteprima");
  apri.type = "button";
  apri.append(creaMiniatura(campagnaIdCorrente, c.id));
  apri.addEventListener("click", () => apriDettagli(li.dataset.id));
  const corpo = creaElemento("div", "scheda-immagine-corpo");
  corpo.append(
    creaElemento("div", "scheda-immagine-titolo"),
    creaElemento("div", "scheda-immagine-meta"),
    creaElemento("div", "scheda-immagine-tag")
  );
  li.append(apri, corpo);
  return li;
}

function etichetta(testo, tipo) {
  const span = creaElemento("span", "etichetta-visibilita", testo);
  if (tipo) span.dataset.visibilita = tipo;
  return span;
}

function aggiornaScheda(li, c) {
  li.querySelector(".scheda-immagine-titolo").textContent = c.titolo;
  li.querySelector(".scheda-immagine-anteprima").setAttribute("aria-label", `Dettagli: ${c.titolo}`);
  const meta = li.querySelector(".scheda-immagine-meta");
  meta.replaceChildren(creaElemento("span", "etichetta-categoria", CATEGORIE[c.categoria] || "Altro"));
  if ((c.mostrataA || []).length > 0) meta.append(etichetta("Mostrato ora", "tutti"));
  const archiviata = (c.archiviataPer || []).length;
  if (archiviata > 0) meta.append(etichetta(`In archivio (${archiviata})`, "tutti"));
  else if (c.riservati.archivio) meta.append(etichetta("Per l'archivio"));
  else meta.append(etichetta("Solo DM", "dm"));
  const collegate = (c.riservati.sessioniCollegate || []).filter(sessionePerId).length;
  if (collegate > 0) meta.append(etichetta(collegate === 1 ? "1 sessione" : `${collegate} sessioni`));
  li.querySelector(".scheda-immagine-tag").replaceChildren(
    ...c.riservati.tag.map((t) => creaElemento("span", "chip-tag", `#${t}`))
  );
}

function renderLibreria() {
  const visibili = ordinaContenuti(contenuti.filter(passaFiltri), filtri.ordine.value);
  const idPresenti = new Set(contenuti.map((c) => c.id));
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

  document.getElementById("conteggio").textContent =
    contenuti.length === 0 ? "" : `${visibili.length} di ${contenuti.length} contenuti`;
  libreriaVuota.hidden = visibili.length > 0;
  libreriaVuota.textContent =
    contenuti.length === 0 ? "La libreria è vuota: carica il primo contenuto qui sopra." : "Nessun contenuto corrisponde ai filtri.";
}

function riceviContenuti(elenco) {
  contenuti = elenco;
  aggiornaOpzioniFiltri();
  renderLibreria();
  if (idDettagli && !contenuti.some((c) => c.id === idDettagli)) chiudiDettagli();
}

Object.values(filtri).forEach((campo) => campo.addEventListener(campo.type === "search" ? "input" : "change", renderLibreria));

// ---------- Dettagli ----------

const modal = document.getElementById("modal-dettagli");
let idDettagli = null;

function caselle(contenitore, voci, scelti) {
  contenitore.replaceChildren();
  if (voci.length === 0) {
    contenitore.append(creaElemento("span", "party-sessione-sub", "Nessuna."));
    return;
  }
  voci.forEach(({ valore, testo }) => {
    const etichettaCasella = creaElemento("label", "checkbox-scudo");
    const casella = document.createElement("input");
    casella.type = "checkbox";
    casella.value = valore;
    casella.checked = scelti.includes(valore);
    etichettaCasella.append(casella, ` ${testo}`);
    contenitore.append(etichettaCasella);
  });
}

const valoriSpuntati = (contenitore) => [...contenitore.querySelectorAll("input:checked")].map((c) => c.value);

function voceInfo(dl, termine, valore) {
  dl.append(creaElemento("dt", null, termine), creaElemento("dd", null, valore));
}

async function apriDettagli(id) {
  const c = contenuti.find((x) => x.id === id);
  if (!c) return;
  idDettagli = id;
  // Le sessioni potrebbero essere cambiate (es. pianificate da un'altra scheda).
  try {
    sessioni = await caricaSessioni();
  } catch (errore) {
    console.error(errore);
  }
  document.getElementById("dettagli-intestazione").textContent = c.titolo;
  document.getElementById("dettagli-titolo").value = c.titolo;
  document.getElementById("dettagli-categoria").value = c.categoria;
  document.getElementById("dettagli-descrizione").value = c.descrizione || "";
  document.getElementById("dettagli-tag").value = c.riservati.tag.join(", ");
  document.getElementById("dettagli-note").value = c.riservati.note || "";
  document.getElementById("dettagli-archivio").checked = c.riservati.archivio;

  // Si possono collegare le sessioni esistenti; quelle collegate ma poi
  // eliminate spariscono al primo salvataggio.
  caselle(
    document.getElementById("dettagli-sessioni"),
    sessioni.map((s) => ({ valore: s.id, testo: `${etichettaSessione(s)}${s.stato === "chiusa" ? " (chiusa)" : s.stato === "in-corso" ? " (in corso)" : ""}` })),
    c.riservati.sessioniCollegate || []
  );
  // Archivio: il DM può anche aggiungere o togliere a mano.
  caselle(
    document.getElementById("dettagli-archiviata"),
    membri.map((m) => ({ valore: m.uid, testo: m.nome || "Giocatore" })),
    c.archiviataPer || []
  );

  const info = document.getElementById("dettagli-info");
  info.replaceChildren();
  const data = c.caricataIl?.toDate?.();
  if (data) voceInfo(info, "Caricato il", data.toLocaleDateString("it-IT"));
  voceInfo(info, "Dimensioni", `${c.larghezza} × ${c.altezza} px`);
  const comparso = (c.sessioniMostrata || []).map((sid) => etichettaSessione(sessionePerId(sid)));
  voceInfo(info, "Comparso in", comparso.length ? comparso.join(", ") : "mai mostrato");
  if ((c.mostrataA || []).length) voceInfo(info, "Mostrato ora a", c.mostrataA.map(nomeMembro).join(", "));

  const img = document.getElementById("dettagli-img");
  img.hidden = true;
  mostraImmagine(img, percorsiImmagineCampagna(campagnaIdCorrente, c.id).mini);
  modal.style.display = "flex";
  document.getElementById("dettagli-titolo").focus();
}

function chiudiDettagli() {
  idDettagli = null;
  modal.style.display = "none";
}

document.getElementById("btn-chiudi-dettagli").addEventListener("click", chiudiDettagli);
document.getElementById("btn-annulla-dettagli").addEventListener("click", chiudiDettagli);
modal.addEventListener("click", (evento) => {
  if (evento.target === modal) chiudiDettagli();
});
document.addEventListener("keydown", (evento) => {
  // Con la lightbox aperta sopra, Esc chiude prima quella.
  if (evento.key === "Escape" && idDettagli && !document.querySelector(".lightbox[style*='flex']")) chiudiDettagli();
});
document.getElementById("dettagli-apri").addEventListener("click", () => {
  const c = contenuti.find((x) => x.id === idDettagli);
  if (c) apriLightbox(campagnaIdCorrente, c);
});

document.getElementById("form-dettagli").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const c = contenuti.find((x) => x.id === idDettagli);
  if (!c) return;
  const titolo = document.getElementById("dettagli-titolo").value.trim();
  if (!titolo) return;
  const bottone = document.getElementById("btn-salva-dettagli");
  bottone.disabled = true;
  try {
    await aggiornaContenuto(campagnaIdCorrente, c, {
      titolo,
      descrizione: document.getElementById("dettagli-descrizione").value.trim(),
      categoria: document.getElementById("dettagli-categoria").value,
      note: document.getElementById("dettagli-note").value.trim(),
      tag: leggiTag(document.getElementById("dettagli-tag").value),
      archivio: document.getElementById("dettagli-archivio").checked,
      sessioniCollegate: valoriSpuntati(document.getElementById("dettagli-sessioni")),
      archiviataPer: valoriSpuntati(document.getElementById("dettagli-archiviata")),
    });
    mostraToast("Dettagli salvati.");
    chiudiDettagli();
  } catch (errore) {
    console.error(errore);
    mostraToast("Impossibile salvare i dettagli.", true);
  } finally {
    bottone.disabled = false;
  }
});

document.getElementById("btn-elimina-contenuto").addEventListener("click", async () => {
  const c = contenuti.find((x) => x.id === idDettagli);
  if (!c) return;
  const avviso = (c.archiviataPer || []).length > 0 ? " Sparirà anche dagli archivi dei giocatori." : "";
  if (!confirm(`Eliminare definitivamente "${c.titolo}"?${avviso}`)) return;
  const percorsi = percorsiImmagineCampagna(campagnaIdCorrente, c.id);
  try {
    // Prima i documenti (sparisce subito per tutti), poi i file.
    await eliminaContenuto(campagnaIdCorrente, c.id);
    await Promise.all([eliminaImmagine(percorsi.grande), eliminaImmagine(percorsi.mini)]);
    chiudiDettagli();
    mostraToast("Contenuto eliminato.");
  } catch (errore) {
    console.error(errore);
    mostraToast("Impossibile eliminare il contenuto.", true);
  }
});

// ---------- Caricamento ----------

const formCarica = document.getElementById("form-carica");
const inputFile = document.getElementById("carica-file");
inputFile.accept = TIPI_ACCETTATI;

formCarica.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const file = inputFile.files[0];
  const titolo = document.getElementById("carica-titolo").value.trim();
  if (!file || !titolo) return;

  const bottone = document.getElementById("btn-carica");
  bottone.disabled = true;
  mostraAttesa(bottone, "Caricamento…");
  const immagineId = nuovoIdImmagine(campagnaIdCorrente);
  const percorsi = percorsiImmagineCampagna(campagnaIdCorrente, immagineId);
  let fileCaricati = false;
  try {
    const categoria = document.getElementById("carica-categoria").value;
    const grande = await ridimensionaImmagine(file, latoImmagineCampagna(categoria), 0.85, MASSIMO_BYTE_CAMPAGNA);
    const mini = await ridimensionaImmagine(file, LATO_MINIATURA, 0.8);
    // Prima i file, poi i documenti: il contenuto compare solo quando è già scaricabile.
    await Promise.all([caricaImmagine(percorsi.grande, grande.blob), caricaImmagine(percorsi.mini, mini.blob)]);
    fileCaricati = true;
    await creaContenuto(campagnaIdCorrente, immagineId, {
      titolo,
      descrizione: document.getElementById("carica-descrizione").value.trim(),
      categoria,
      larghezza: grande.larghezza,
      altezza: grande.altezza,
      note: document.getElementById("carica-note").value.trim(),
      tag: leggiTag(document.getElementById("carica-tag").value),
      archivio: document.getElementById("carica-archivio").checked,
    });
    formCarica.reset();
    mostraToast("Contenuto aggiunto alla libreria.");
  } catch (errore) {
    console.error(errore);
    if (fileCaricati) {
      await Promise.all([eliminaImmagine(percorsi.grande), eliminaImmagine(percorsi.mini)]).catch(() => {});
    }
    mostraToast(errore instanceof ErroreImmagine ? errore.message : "Caricamento non riuscito.", true);
  } finally {
    bottone.disabled = false;
    bottone.textContent = "Carica";
  }
});

// ---------- Avvio ----------

async function caricaSessioni() {
  const elenco = await elencaSessioniCampagna(campagnaIdCorrente);
  return elenco.sort((a, b) => (a.numero || 0) - (b.numero || 0));
}

proteggiPaginaDM(async (user, profilo) => {
  montaMenuUtente({ contenitore: document.getElementById("slot-utente"), user, profilo });

  const campagna = await ottieniCampagnaCorrente(user.uid, profilo?.ruolo, { soloDM: true });
  if (!campagna) {
    document.getElementById("nessuna-campagna").hidden = false;
    veil.style.display = "none";
    contenuto.style.display = "block";
    return;
  }
  campagnaIdCorrente = campagna.id;

  riempiCategorie(filtri.categoria);
  riempiCategorie(document.getElementById("carica-categoria"));
  riempiCategorie(document.getElementById("dettagli-categoria"));
  try {
    [membri, sessioni] = await Promise.all([elencaMembriCampagna(campagnaIdCorrente), caricaSessioni()]);
  } catch (errore) {
    console.error(errore);
  }
  const pannelloCarica = document.getElementById("pannello-carica");
  pannelloCarica.hidden = false;
  document.getElementById("pannello-libreria").hidden = false;

  let primaVolta = true;
  ascoltaLibreriaDM(campagnaIdCorrente, (elenco) => {
    // Libreria vuota: il modulo di caricamento parte aperto.
    if (primaVolta && elenco.length === 0) pannelloCarica.open = true;
    primaVolta = false;
    riceviContenuti(elenco);
  }, (errore) => {
    console.error(errore);
    mostraToast("Impossibile caricare la libreria.", true);
  });

  veil.style.display = "none";
  contenuto.style.display = "block";
});
