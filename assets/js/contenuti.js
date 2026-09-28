// Elementi condivisi dalle pagine che mostrano i contenuti della campagna
// (libreria del DM, archivio dei giocatori, sessione, gestione campagna):
// categorie, miniature, visualizzazione a tutto schermo e selettore.
// Tutto il testo inserito dagli utenti passa da textContent, mai da innerHTML.
import { mostraImmagine, percorsiImmagineCampagna } from "./immagini.js";

export const CATEGORIE = {
  mappa: "Mappa",
  luogo: "Luogo",
  png: "PNG",
  nemico: "Nemico",
  oggetto: "Oggetto",
  dispensa: "Dispensa",
  altro: "Altro",
};

export function riempiCategorie(select) {
  Object.entries(CATEGORIE).forEach(([valore, nome]) => select.add(new Option(nome, valore)));
}

export function etichettaSessione(sessione) {
  if (!sessione) return "Sessione eliminata";
  return `Sessione ${sessione.numero ?? "?"}${sessione.titolo ? ` — ${sessione.titolo}` : ""}`;
}

// "Palude, Traditore , palude" → ["palude", "traditore"]
export function leggiTag(testo) {
  return [...new Set(testo.split(",").map((t) => t.trim().toLowerCase().slice(0, 30)).filter(Boolean))].slice(0, 20);
}

// Ordina i contenuti per le pagine con filtri.
export function ordinaContenuti(elenco, ordine) {
  const istante = (c) => c.caricataIl?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
  const copia = [...elenco];
  if (ordine === "vecchi") return copia.sort((a, b) => istante(a) - istante(b));
  if (ordine === "titolo") return copia.sort((a, b) => a.titolo.localeCompare(b.titolo, "it"));
  return copia.sort((a, b) => istante(b) - istante(a));
}

export function creaElemento(tag, classe, testo) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (testo != null) elemento.textContent = testo;
  return elemento;
}

// <img> con la miniatura del contenuto (nascosta finché non è caricata).
export function creaMiniatura(campagnaId, contenutoId) {
  const img = document.createElement("img");
  img.alt = "";
  img.hidden = true;
  img.loading = "lazy";
  mostraImmagine(img, percorsiImmagineCampagna(campagnaId, contenutoId).mini);
  return img;
}

// ---------- Visualizzazione a tutto schermo ----------

let lightbox = null;

function preparaLightbox() {
  if (lightbox) return lightbox;
  const sfondo = creaElemento("div", "modal-overlay lightbox");
  sfondo.style.display = "none";
  sfondo.setAttribute("role", "dialog");
  sfondo.setAttribute("aria-modal", "true");
  const figura = creaElemento("figure", "lightbox-figura");
  const chiudi = creaElemento("button", "btn-chiudi-modal", "×");
  chiudi.type = "button";
  chiudi.setAttribute("aria-label", "Chiudi");
  const img = document.createElement("img");
  img.alt = "";
  const didascalia = document.createElement("figcaption");
  const titolo = document.createElement("strong");
  const descrizione = document.createElement("span");
  const extra = creaElemento("span", "lightbox-extra");
  didascalia.append(titolo, descrizione, extra);
  figura.append(chiudi, img, didascalia);
  sfondo.append(figura);
  document.body.append(sfondo);

  const nascondi = () => {
    sfondo.style.display = "none";
    lightbox.idAperto = null;
  };
  chiudi.addEventListener("click", nascondi);
  sfondo.addEventListener("click", (evento) => {
    if (evento.target === sfondo) nascondi();
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && sfondo.style.display !== "none") nascondi();
  });
  lightbox = { sfondo, img, titolo, descrizione, extra, chiudi, nascondi, idAperto: null };
  return lightbox;
}

// Apre il contenuto a tutto schermo; "righeExtra" è testo aggiuntivo
// (es. "Comparso in: Sessione 1, Sessione 4").
export function apriLightbox(campagnaId, contenuto, righeExtra = "") {
  const l = preparaLightbox();
  l.idAperto = contenuto.id;
  l.titolo.textContent = contenuto.titolo;
  l.descrizione.textContent = contenuto.descrizione || "";
  l.extra.textContent = righeExtra;
  l.img.alt = contenuto.titolo;
  l.img.hidden = true;
  l.sfondo.style.display = "flex";
  l.chiudi.focus();
  mostraImmagine(l.img, percorsiImmagineCampagna(campagnaId, contenuto.id).grande);
}

// Chiude la lightbox se mostra un contenuto non più visibile.
export function chiudiLightboxSeSparito(idVisibili) {
  if (lightbox?.idAperto && !idVisibili.has(lightbox.idAperto)) lightbox.nascondi();
}

// ---------- Selettore di contenuti (per collegarli a una sessione) ----------

// Apre una finestra con la libreria e le caselle da spuntare. Restituisce il
// nuovo insieme degli ID scelti, oppure null se si annulla.
export function scegliContenuti({ campagnaId, titolo, contenuti, selezionati }) {
  return new Promise((risolvi) => {
    const scelti = new Set(selezionati);
    const sfondo = creaElemento("div", "modal-overlay");
    const scheda = creaElemento("div", "modal-card modal-selettore");
    const intestazione = creaElemento("h2", null, titolo);
    const filtri = creaElemento("div", "galleria-barra");
    const cerca = document.createElement("input");
    cerca.type = "search";
    cerca.placeholder = "Cerca per titolo o tag";
    cerca.className = "select-galleria";
    const categoria = creaElemento("select", "select-galleria");
    categoria.add(new Option("Tutte le categorie", ""));
    riempiCategorie(categoria);
    const soloScelti = creaElemento("label", "checkbox-scudo");
    const casellaScelti = document.createElement("input");
    casellaScelti.type = "checkbox";
    soloScelti.append(casellaScelti, " Solo quelli collegati");
    filtri.append(cerca, categoria, soloScelti);

    const lista = creaElemento("ul", "griglia-immagini griglia-selettore");
    const vuoto = creaElemento("p", "scheda-testo-libero", "Nessun contenuto nella libreria.");
    const azioni = creaElemento("div", "azioni-selettore");
    const annulla = creaElemento("button", "btn-tabella", "Annulla");
    annulla.type = "button";
    const conferma = creaElemento("button", "btn-tabella btn-tabella-evidenza", "Salva");
    conferma.type = "button";
    azioni.append(annulla, conferma);
    scheda.append(intestazione, filtri, lista, vuoto, azioni);
    sfondo.append(scheda);
    document.body.append(sfondo);

    const voci = contenuti.map((contenuto) => {
      const li = creaElemento("li", "scheda-immagine scheda-selezionabile");
      const etichetta = document.createElement("label");
      const casella = document.createElement("input");
      casella.type = "checkbox";
      casella.checked = scelti.has(contenuto.id);
      casella.addEventListener("change", () => {
        if (casella.checked) scelti.add(contenuto.id);
        else scelti.delete(contenuto.id);
        li.classList.toggle("selezionata", casella.checked);
      });
      li.classList.toggle("selezionata", casella.checked);
      const anteprima = creaElemento("span", "scheda-immagine-anteprima");
      anteprima.append(creaMiniatura(campagnaId, contenuto.id));
      const corpo = creaElemento("span", "scheda-immagine-corpo");
      corpo.append(
        casella,
        creaElemento("span", "scheda-immagine-titolo", contenuto.titolo),
        creaElemento("span", "etichetta-categoria", CATEGORIE[contenuto.categoria] || "Altro")
      );
      etichetta.append(anteprima, corpo);
      li.append(etichetta);
      lista.append(li);
      const testoRicerca = [contenuto.titolo, ...(contenuto.riservati?.tag || [])].join(" ").toLowerCase();
      return { li, contenuto, casella, testoRicerca };
    });

    const filtra = () => {
      const testo = cerca.value.trim().toLowerCase();
      let visibili = 0;
      voci.forEach(({ li, contenuto, casella, testoRicerca }) => {
        const mostra = (!testo || testoRicerca.includes(testo))
          && (!categoria.value || contenuto.categoria === categoria.value)
          && (!casellaScelti.checked || casella.checked);
        li.hidden = !mostra;
        if (mostra) visibili += 1;
      });
      vuoto.hidden = visibili > 0;
      vuoto.textContent = contenuti.length === 0 ? "Nessun contenuto nella libreria." : "Nessun contenuto corrisponde ai filtri.";
    };
    cerca.addEventListener("input", filtra);
    categoria.addEventListener("change", filtra);
    casellaScelti.addEventListener("change", filtra);
    filtra();

    const chiudi = (risultato) => {
      sfondo.remove();
      document.removeEventListener("keydown", tasto);
      risolvi(risultato);
    };
    const tasto = (evento) => {
      if (evento.key === "Escape") chiudi(null);
    };
    document.addEventListener("keydown", tasto);
    annulla.addEventListener("click", () => chiudi(null));
    conferma.addEventListener("click", () => chiudi(scelti));
    cerca.focus();
  });
}
