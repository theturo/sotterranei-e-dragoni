// Descrizioni al tocco e tooltip pergamena.
// - Elementi "con-descrizione" (condizioni, privilegi…): su computer la
//   spiegazione compare passando il mouse (attributo title); sui dispositivi
//   senza mouse si mostra in un fumetto quando si toccano.
// - Elementi "con-pergamena" (incantesimi della scheda, tavola "Tooltip
//   danno/cura" della tela): niente title nativo, ma un popover in stile
//   pergamena con la riga dell'effetto (data-effetto) e la descrizione
//   (data-descrizione). Compare passando il mouse o arrivandoci col tab; sui
//   dispositivi senza mouse al tocco.
// Un altro tocco (anche altrove), lo scorrimento o Esc lo chiudono.
const senzaMouse = window.matchMedia("(hover: none)");

let fumetto = null;
let origine = null;
let apertoIl = 0;

function chiudi() {
  fumetto?.remove();
  fumetto = null;
  origine = null;
}

function creaPergamena(elemento) {
  const box = document.createElement("div");
  box.className = "tooltip-incantesimo";
  if (elemento.dataset.effetto) {
    const effetto = document.createElement("p");
    effetto.className = "tooltip-riga-effetto";
    effetto.textContent = elemento.dataset.effetto;
    box.append(effetto);
  }
  if (elemento.dataset.descrizione) {
    const descrizione = document.createElement("p");
    descrizione.className = "tooltip-descrizione";
    descrizione.textContent = elemento.dataset.descrizione;
    box.append(descrizione);
  }
  return box;
}

function apri(elemento) {
  const pergamena = elemento.classList.contains("con-pergamena");
  const testo = elemento.dataset.descrizione || elemento.title;
  if (!testo && !elemento.dataset.effetto) return;
  chiudi();
  if (pergamena) {
    fumetto = creaPergamena(elemento);
  } else {
    fumetto = document.createElement("div");
    fumetto.className = "fumetto-descrizione";
    fumetto.textContent = testo;
  }
  fumetto.setAttribute("role", "tooltip");
  document.body.append(fumetto);
  origine = elemento;
  apertoIl = Date.now();

  // La pergamena sta sopra l'elemento (con la punta verso il basso), il
  // fumetto sotto; se non c'è spazio si girano. Sempre dentro lo schermo.
  const margine = 12;
  const distanza = pergamena ? 12 : 8;
  const r = elemento.getBoundingClientRect();
  const larghezza = fumetto.offsetWidth;
  const altezza = fumetto.offsetHeight;
  const centro = r.left + r.width / 2;
  const sinistra = Math.min(Math.max(margine, centro - larghezza / 2), window.innerWidth - larghezza - margine);
  const spazioSopra = r.top - distanza - altezza >= margine;
  const spazioSotto = r.bottom + distanza + altezza <= window.innerHeight - margine;
  const sotto = pergamena ? !spazioSopra && spazioSotto : spazioSotto || !spazioSopra;
  fumetto.style.left = `${sinistra}px`;
  fumetto.style.top = `${sotto ? r.bottom + distanza : Math.max(margine, r.top - distanza - altezza)}px`;
  if (pergamena) {
    fumetto.classList.toggle("sotto", sotto);
    fumetto.style.setProperty("--punta", `${Math.min(Math.max(16, centro - sinistra), larghezza - 16)}px`);
  }
}

let attivo = false;
export function attivaDescrizioni() {
  if (attivo) return;
  attivo = true;
  document.addEventListener("click", (evento) => {
    if (!senzaMouse.matches) return;
    const elemento = evento.target.closest?.(".con-descrizione, .con-pergamena");
    if (!elemento || elemento === origine) {
      chiudi();
      return;
    }
    apri(elemento);
  });
  // Con il mouse e la tastiera: la pergamena compare sopra l'elemento.
  document.addEventListener("mouseover", (evento) => {
    if (senzaMouse.matches) return;
    const elemento = evento.target.closest?.(".con-pergamena");
    if (elemento && elemento !== origine) apri(elemento);
  });
  document.addEventListener("mouseout", (evento) => {
    if (senzaMouse.matches || !origine?.classList.contains("con-pergamena")) return;
    if (!origine.contains(evento.relatedTarget)) chiudi();
  });
  // Sui dispositivi touch il tocco mette anche il fuoco sull'elemento: lì
  // apre e chiude solo il tocco (sopra), altrimenti si richiuderebbe subito.
  document.addEventListener("focusin", (evento) => {
    if (senzaMouse.matches) return;
    const elemento = evento.target.closest?.(".con-pergamena");
    if (elemento && elemento !== origine) apri(elemento);
  });
  document.addEventListener("focusout", (evento) => {
    if (origine && evento.target === origine) chiudi();
  });
  // Lo scorrimento chiude il fumetto, tranne quello che arriva subito dopo il
  // tocco (fine di uno scorrimento iniziato prima).
  window.addEventListener("scroll", () => {
    if (fumetto && Date.now() - apertoIl > 400) chiudi();
  }, { passive: true, capture: true });
  window.addEventListener("resize", chiudi);
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") chiudi();
  });
}
