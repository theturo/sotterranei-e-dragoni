// Script della pagina immagini.html (galleria della campagna).
// Il DM carica le immagini (nascoste all'inizio) e decide per ciascuna chi la
// vede: nessuno, tutti i membri o solo alcuni giocatori. I giocatori vedono in
// tempo reale solo quelle rivelate a loro; lo stesso filtro è imposto dalle
// regole di Firestore e di Storage, non solo da questa pagina.
import {
  proteggiPagina,
  ROLES,
  ottieniCampagnaCorrente,
  elencaMembriCampagna,
  nuovoIdImmagine,
  salvaImmagineCampagna,
  impostaVisibilitaImmagine,
  eliminaDocumentoImmagine,
  ascoltaImmaginiCampagna,
} from "../auth.js";
import { montaMenuUtente } from "../menu-utente.js";
import {
  TIPI_ACCETTATI,
  ErroreImmagine,
  ridimensionaImmagine,
  caricaImmagine,
  eliminaImmagine,
  mostraImmagine,
  LATO_IMMAGINE_CAMPAGNA,
  LATO_MINIATURA,
  percorsiImmagineCampagna,
} from "../immagini.js";

const CATEGORIE = {
  mappa: "Mappa",
  luogo: "Luogo",
  png: "Personaggio non giocante",
  oggetto: "Oggetto",
  dispensa: "Dispensa",
  altro: "Altro",
};

const VISIBILITA = {
  dm: "Nascosta",
  tutti: "Tutto il party",
  selezionati: "Solo alcuni",
};

const veil = document.getElementById("veil");
const contenuto = document.getElementById("contenuto");
const griglia = document.getElementById("griglia-immagini");
const galleriaVuota = document.getElementById("galleria-vuota");
const filtroCategoria = document.getElementById("filtro-categoria");
const toast = document.getElementById("toast");

let campagnaIdCorrente = null;
let isDM = false;
let membri = [];
let immagini = [];
let primoCaricamento = true;
// Schede già create, per ID: si aggiornano sul posto a ogni cambiamento,
// così le miniature non vengono riscaricate e le caselle non perdono lo stato.
const schede = new Map();

let toastTimer = null;
function mostraToast(testo, errore = false) {
  toast.textContent = testo;
  toast.className = `toast visibile${errore ? " toast-errore" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = "toast";
  }, 3200);
}

function riempiCategorie(select) {
  Object.entries(CATEGORIE).forEach(([valore, nome]) => select.add(new Option(nome, valore)));
}

// ---------- Scheda di un'immagine ----------

function creaScheda(immagine) {
  const li = document.createElement("li");
  li.className = "scheda-immagine";
  li.dataset.id = immagine.id;

  const apri = document.createElement("button");
  apri.type = "button";
  apri.className = "scheda-immagine-anteprima";
  const img = document.createElement("img");
  img.alt = "";
  img.hidden = true;
  img.loading = "lazy";
  apri.append(img);
  apri.addEventListener("click", () => apriLightbox(li.dataset.id));
  mostraImmagine(img, percorsiImmagineCampagna(campagnaIdCorrente, immagine.id).mini);

  const corpo = document.createElement("div");
  corpo.className = "scheda-immagine-corpo";
  corpo.innerHTML = `
    <div class="scheda-immagine-titolo"></div>
    <div class="scheda-immagine-meta"><span class="etichetta-categoria"></span><span class="etichetta-visibilita"></span></div>
  `;
  li.append(apri, corpo);
  if (isDM) corpo.append(creaControlliDM(immagine.id));
  return li;
}

function creaControlliDM(immagineId) {
  const controlli = document.createElement("div");
  controlli.className = "controlli-visibilita";

  const nomeGruppo = `vis-${immagineId}`;
  const opzioni = document.createElement("div");
  opzioni.className = "opzioni-visibilita";
  opzioni.setAttribute("role", "radiogroup");
  opzioni.setAttribute("aria-label", "Chi può vederla");
  Object.entries(VISIBILITA).forEach(([valore, nome]) => {
    const etichetta = document.createElement("label");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = nomeGruppo;
    radio.value = valore;
    etichetta.append(radio, ` ${nome}`);
    opzioni.append(etichetta);
  });

  const lettori = document.createElement("fieldset");
  lettori.className = "lettori-immagine";
  lettori.innerHTML = "<legend>Giocatori che la vedono</legend>";
  if (membri.length === 0) {
    lettori.append("Nessun giocatore nella campagna.");
  }
  membri.forEach((membro) => {
    const etichetta = document.createElement("label");
    etichetta.className = "checkbox-scudo";
    const casella = document.createElement("input");
    casella.type = "checkbox";
    casella.value = membro.uid;
    etichetta.append(casella, ` ${membro.nome || "Giocatore"}`);
    lettori.append(etichetta);
  });

  const elimina = document.createElement("button");
  elimina.type = "button";
  elimina.className = "btn-tabella btn-tabella-pericolo";
  elimina.textContent = "Elimina";
  elimina.addEventListener("click", () => eliminaImmagineCampagna(immagineId));

  const salva = async () => {
    const scelta = opzioni.querySelector("input:checked")?.value || "dm";
    const selezionati = [...lettori.querySelectorAll("input:checked")].map((c) => c.value);
    lettori.hidden = scelta !== "selezionati";
    controlli.classList.add("in-salvataggio");
    try {
      await impostaVisibilitaImmagine(campagnaIdCorrente, immagineId, scelta, selezionati);
    } catch (errore) {
      console.error(errore);
      mostraToast("Impossibile cambiare la visibilità.", true);
      // Ripristina lo stato salvato.
      const attuale = immagini.find((i) => i.id === immagineId);
      if (attuale) aggiornaControlli(controlli, attuale);
    } finally {
      controlli.classList.remove("in-salvataggio");
    }
  };
  opzioni.addEventListener("change", salva);
  lettori.addEventListener("change", salva);

  controlli.append(opzioni, lettori, elimina);
  return controlli;
}

function aggiornaControlli(controlli, immagine) {
  controlli.querySelectorAll(".opzioni-visibilita input").forEach((radio) => {
    radio.checked = radio.value === immagine.visibilita;
  });
  const lettori = controlli.querySelector(".lettori-immagine");
  lettori.hidden = immagine.visibilita !== "selezionati";
  lettori.querySelectorAll("input").forEach((casella) => {
    casella.checked = (immagine.lettori || []).includes(casella.value);
  });
}

function aggiornaScheda(li, immagine) {
  li.querySelector(".scheda-immagine-titolo").textContent = immagine.titolo;
  li.querySelector(".scheda-immagine-anteprima").setAttribute("aria-label", `Apri: ${immagine.titolo}`);
  li.querySelector(".etichetta-categoria").textContent = CATEGORIE[immagine.categoria] || "Altro";
  const visibilita = li.querySelector(".etichetta-visibilita");
  visibilita.hidden = !isDM;
  if (isDM) {
    visibilita.textContent = testoVisibilita(immagine);
    visibilita.dataset.visibilita = immagine.visibilita;
    const controlli = li.querySelector(".controlli-visibilita");
    // Non si tocca un controllo mentre il salvataggio è in corso.
    if (!controlli.classList.contains("in-salvataggio")) aggiornaControlli(controlli, immagine);
  }
}

function testoVisibilita(immagine) {
  if (immagine.visibilita !== "selezionati") return VISIBILITA[immagine.visibilita] || VISIBILITA.dm;
  const nomi = (immagine.lettori || []).map((uid) => membri.find((m) => m.uid === uid)?.nome).filter(Boolean);
  return nomi.length ? `Solo: ${nomi.join(", ")}` : "Solo alcuni (nessuno scelto)";
}

function renderGalleria() {
  const filtro = filtroCategoria.value;
  const visibili = immagini.filter((immagine) => !filtro || immagine.categoria === filtro);

  // Rimuove le schede delle immagini sparite (eliminate o non più visibili).
  const idPresenti = new Set(immagini.map((i) => i.id));
  schede.forEach((li, id) => {
    if (!idPresenti.has(id)) {
      li.remove();
      schede.delete(id);
    }
  });

  visibili.forEach((immagine) => {
    let li = schede.get(immagine.id);
    if (!li) {
      li = creaScheda(immagine);
      schede.set(immagine.id, li);
    }
    aggiornaScheda(li, immagine);
  });
  // Ordine e filtro: appendChild sposta le schede esistenti senza ricrearle.
  const idVisibili = new Set(visibili.map((i) => i.id));
  schede.forEach((li, id) => {
    if (!idVisibili.has(id)) li.remove();
  });
  visibili.forEach((immagine) => griglia.appendChild(schede.get(immagine.id)));

  galleriaVuota.hidden = visibili.length > 0;
  if (immagini.length === 0) {
    galleriaVuota.textContent = isDM
      ? "Nessuna immagine ancora: caricane una qui sopra."
      : "Il Dungeon Master non ti ha ancora mostrato nessuna immagine.";
  } else {
    galleriaVuota.textContent = "Nessuna immagine in questa categoria.";
  }
}

function riceviImmagini(elenco) {
  if (!isDM && !primoCaricamento) {
    const nuove = elenco.filter((i) => !immagini.some((vecchia) => vecchia.id === i.id));
    if (nuove.length === 1) mostraToast(`Nuova immagine: ${nuove[0].titolo}`);
    else if (nuove.length > 1) mostraToast(`${nuove.length} nuove immagini`);
  }
  primoCaricamento = false;
  immagini = elenco;
  renderGalleria();
  // Se l'immagine aperta non è più visibile, si chiude.
  if (idLightbox && !immagini.some((i) => i.id === idLightbox)) chiudiLightbox();
}

// ---------- Lightbox ----------

const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
let idLightbox = null;

function apriLightbox(immagineId) {
  const immagine = immagini.find((i) => i.id === immagineId);
  if (!immagine) return;
  idLightbox = immagineId;
  document.getElementById("lightbox-titolo").textContent = immagine.titolo;
  document.getElementById("lightbox-descrizione").textContent = immagine.descrizione || "";
  lightboxImg.alt = immagine.titolo;
  lightboxImg.hidden = true;
  lightbox.style.display = "flex";
  document.getElementById("btn-chiudi-lightbox").focus();
  mostraImmagine(lightboxImg, percorsiImmagineCampagna(campagnaIdCorrente, immagineId).grande);
}

function chiudiLightbox() {
  idLightbox = null;
  lightbox.style.display = "none";
}

document.getElementById("btn-chiudi-lightbox").addEventListener("click", chiudiLightbox);
lightbox.addEventListener("click", (evento) => {
  if (evento.target === lightbox) chiudiLightbox();
});
document.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape" && idLightbox) chiudiLightbox();
});

// ---------- Azioni del DM ----------

async function eliminaImmagineCampagna(immagineId) {
  const immagine = immagini.find((i) => i.id === immagineId);
  if (!confirm(`Eliminare definitivamente "${immagine?.titolo ?? "questa immagine"}"?`)) return;
  const percorsi = percorsiImmagineCampagna(campagnaIdCorrente, immagineId);
  try {
    // Prima il documento (l'immagine sparisce subito per tutti), poi i file.
    await eliminaDocumentoImmagine(campagnaIdCorrente, immagineId);
    await Promise.all([eliminaImmagine(percorsi.grande), eliminaImmagine(percorsi.mini)]);
    mostraToast("Immagine eliminata.");
  } catch (errore) {
    console.error(errore);
    mostraToast("Impossibile eliminare l'immagine.", true);
  }
}

const formCarica = document.getElementById("form-carica");
const inputFile = document.getElementById("carica-file");
inputFile.accept = TIPI_ACCETTATI;

formCarica.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const file = inputFile.files[0];
  const titolo = document.getElementById("carica-titolo").value.trim();
  const descrizione = document.getElementById("carica-descrizione").value.trim();
  const categoria = document.getElementById("carica-categoria").value;
  if (!file || !titolo) return;

  const bottone = document.getElementById("btn-carica");
  bottone.disabled = true;
  bottone.textContent = "Caricamento…";
  const immagineId = nuovoIdImmagine(campagnaIdCorrente);
  const percorsi = percorsiImmagineCampagna(campagnaIdCorrente, immagineId);
  let fileCaricati = false;
  try {
    const grande = await ridimensionaImmagine(file, LATO_IMMAGINE_CAMPAGNA);
    const mini = await ridimensionaImmagine(file, LATO_MINIATURA, 0.8);
    // Prima i file, poi il documento: così l'immagine compare in galleria
    // solo quando è già scaricabile.
    await Promise.all([caricaImmagine(percorsi.grande, grande.blob), caricaImmagine(percorsi.mini, mini.blob)]);
    fileCaricati = true;
    await salvaImmagineCampagna(campagnaIdCorrente, immagineId, {
      titolo,
      descrizione,
      categoria,
      larghezza: grande.larghezza,
      altezza: grande.altezza,
    });
    formCarica.reset();
    mostraToast("Immagine caricata (nascosta ai giocatori).");
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

filtroCategoria.addEventListener("change", renderGalleria);

// ---------- Avvio ----------

proteggiPagina(async (user, profilo) => {
  montaMenuUtente({ contenitore: document.getElementById("slot-utente"), user, profilo });
  const ruolo = profilo?.ruolo || ROLES.PLAYER;
  isDM = ruolo === ROLES.DM || ruolo === ROLES.ADMIN;

  const campagna = await ottieniCampagnaCorrente(user.uid, ruolo);
  if (!campagna) {
    document.getElementById("testo-nessuna-campagna").textContent = isDM
      ? "Non hai ancora una campagna attiva: creane una dal pannello Gestione campagna."
      : "Non sei ancora membro di una campagna attiva: chiedi al tuo Dungeon Master di aggiungerti.";
    document.getElementById("nessuna-campagna").hidden = false;
    veil.style.display = "none";
    contenuto.style.display = "block";
    return;
  }
  campagnaIdCorrente = campagna.id;

  riempiCategorie(filtroCategoria);
  if (isDM) {
    riempiCategorie(document.getElementById("carica-categoria"));
    document.getElementById("pannello-carica").hidden = false;
    try {
      membri = await elencaMembriCampagna(campagnaIdCorrente);
    } catch (errore) {
      console.error(errore);
    }
  }
  document.getElementById("pannello-galleria").hidden = false;

  ascoltaImmaginiCampagna(campagnaIdCorrente, { dm: isDM, uid: user.uid }, riceviImmagini, (errore) => {
    console.error(errore);
    mostraToast("Impossibile caricare la galleria.", true);
  });

  veil.style.display = "none";
  contenuto.style.display = "block";
});
