// Descrizioni al tocco. Su computer le spiegazioni di condizioni, privilegi e
// incantesimi compaiono passando il mouse (attributo title); sui dispositivi
// senza mouse gli elementi con classe "con-descrizione" le mostrano in un
// fumetto quando si toccano. Un altro tocco (anche altrove) lo chiude.
const senzaMouse = window.matchMedia("(hover: none)");

let fumetto = null;
let origine = null;

function chiudi() {
  fumetto?.remove();
  fumetto = null;
  origine = null;
}

function apri(elemento) {
  const testo = elemento.dataset.descrizione || elemento.title;
  if (!testo) return;
  chiudi();
  fumetto = document.createElement("div");
  fumetto.className = "fumetto-descrizione";
  fumetto.setAttribute("role", "tooltip");
  fumetto.textContent = testo;
  document.body.append(fumetto);
  origine = elemento;

  // Sotto l'elemento, o sopra se sotto non c'è spazio; sempre dentro lo schermo.
  const margine = 12;
  const r = elemento.getBoundingClientRect();
  const larghezza = fumetto.offsetWidth;
  const altezza = fumetto.offsetHeight;
  const sinistra = Math.min(Math.max(margine, r.left + r.width / 2 - larghezza / 2), window.innerWidth - larghezza - margine);
  const sotto = r.bottom + 8 + altezza <= window.innerHeight - margine;
  fumetto.style.left = `${sinistra}px`;
  fumetto.style.top = `${sotto ? r.bottom + 8 : Math.max(margine, r.top - 8 - altezza)}px`;
}

let attivo = false;
export function attivaDescrizioni() {
  if (attivo) return;
  attivo = true;
  document.addEventListener("click", (evento) => {
    if (!senzaMouse.matches) return;
    const elemento = evento.target.closest?.(".con-descrizione");
    if (!elemento || elemento === origine) {
      chiudi();
      return;
    }
    apri(elemento);
  });
  window.addEventListener("scroll", chiudi, { passive: true, capture: true });
  window.addEventListener("resize", chiudi);
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") chiudi();
  });
}
