// Script della pagina guida.html: guida e domande frequenti per i giocatori
// (la vede uguale anche il DM). I testi stanno nella pagina; qui ci sono solo
// l'indice, la ricerca, le domande per capitolo sul telefono e le schermate
// ingrandite.
import { proteggiPagina } from "../auth.js";
import { montaMenuUtente } from "../menu-utente.js";

const veil = document.getElementById("veil");
const contenuto = document.getElementById("contenuto");
const cerca = document.getElementById("guida-cerca");
const tendina = document.getElementById("guida-capitolo");
const conteggio = document.getElementById("guida-conteggio");
const capitoli = [...document.querySelectorAll(".guida-capitolo")];
const vociIndice = [...document.querySelectorAll(".guida-indice-voce[data-capitolo]")];
const domande = [...document.querySelectorAll(".guida-domanda")];
const nessunCapitolo = document.getElementById("guida-nessun-capitolo");
const nessunaDomanda = document.getElementById("guida-nessuna-domanda");
const tutteDomande = document.getElementById("guida-tutte-domande");
const etichettaFaq = document.getElementById("guida-faq-etichetta");
const ingrandita = document.getElementById("guida-ingrandita");

// Sul telefono l'indice è la tendina e sotto il capitolo ci sono solo le sue
// domande (con "Mostra tutte le domande").
const telefono = window.matchMedia("(max-width: 760px)");
let scelto = capitoli[0].id;
let tutteSulTelefono = false;

// Minuscole e senza accenti: "perche" trova "Perché".
const normalizza = (testo) => testo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function aggiorna() {
  const q = normalizza(cerca.value.trim());
  const trova = (el) => !q || normalizza(el.textContent).includes(q);
  const domandeTrovate = domande.filter(trova);
  let capitoliTrovati = 0;

  for (const sezione of capitoli) {
    const id = sezione.id;
    const corrisponde = !q || trova(sezione) || domandeTrovate.some((d) => d.dataset.capitolo === id);
    // Con la ricerca si vedono tutti i capitoli che corrispondono, senza: solo quello scelto.
    sezione.hidden = q ? !corrisponde : id !== scelto;
    if (q && corrisponde) capitoliTrovati += 1;
    for (const passo of sezione.querySelectorAll(".guida-passi li")) passo.classList.toggle("evidenziato", Boolean(q) && trova(passo));
    const voce = vociIndice.find((v) => v.dataset.capitolo === id);
    voce.classList.toggle("scelta", !q && id === scelto);
    voce.classList.toggle("spenta", Boolean(q) && !corrisponde);
    if (!q && id === scelto) voce.setAttribute("aria-current", "true");
    else voce.removeAttribute("aria-current");
  }
  nessunCapitolo.hidden = !q || capitoliTrovati > 0;

  const soloCapitolo = !q && telefono.matches && !tutteSulTelefono;
  let domandeVisibili = 0;
  for (const d of domande) {
    const visibile = q ? domandeTrovate.includes(d) : !soloCapitolo || d.dataset.capitolo === scelto;
    d.hidden = !visibile;
    if (visibile) domandeVisibili += 1;
    if (q) d.open = visibile;
  }
  nessunaDomanda.hidden = domandeVisibili > 0;
  tutteDomande.hidden = !soloCapitolo;
  etichettaFaq.textContent = soloCapitolo ? "Domande su questo capitolo" : "Domande frequenti";
  conteggio.textContent = q
    ? `${capitoliTrovati} ${capitoliTrovati === 1 ? "capitolo" : "capitoli"} e ${domandeTrovate.length} ${domandeTrovate.length === 1 ? "domanda" : "domande"} per «${cerca.value.trim()}»`
    : `${capitoli.length} capitoli · ${domande.length} domande frequenti`;
}

function scegli(id, scorri = false) {
  if (!capitoli.some((c) => c.id === id)) return;
  scelto = id;
  tendina.value = id;
  tutteSulTelefono = false;
  if (cerca.value) cerca.value = "";
  aggiorna();
  if (scorri) document.getElementById(id).scrollIntoView({ behavior: "smooth", block: "start" });
}

function daIndirizzo() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id === "domande") {
    tutteSulTelefono = true;
    aggiorna();
    return;
  }
  if (id) scegli(id);
}

for (const voce of vociIndice) {
  voce.addEventListener("click", (e) => {
    e.preventDefault();
    history.replaceState(null, "", `#${voce.dataset.capitolo}`);
    scegli(voce.dataset.capitolo, telefono.matches);
  });
}
tendina.addEventListener("change", () => {
  history.replaceState(null, "", `#${tendina.value}`);
  scegli(tendina.value);
});
cerca.addEventListener("input", aggiorna);
tutteDomande.addEventListener("click", () => {
  tutteSulTelefono = true;
  aggiorna();
});
telefono.addEventListener("change", aggiorna);
window.addEventListener("hashchange", daIndirizzo);

// Schermate: un tocco le ingrandisce, un altro (o Esc) le chiude.
const immagineGrande = ingrandita.querySelector("img");
const chiudiIngrandita = () => {
  ingrandita.hidden = true;
  immagineGrande.removeAttribute("src");
};
for (const pulsante of document.querySelectorAll(".guida-schermata-apri")) {
  pulsante.addEventListener("click", () => {
    const img = pulsante.querySelector("img");
    immagineGrande.src = img.src;
    immagineGrande.alt = img.alt;
    ingrandita.hidden = false;
    ingrandita.querySelector("button").focus();
  });
}
ingrandita.addEventListener("click", chiudiIngrandita);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !ingrandita.hidden) chiudiIngrandita();
});

proteggiPagina((user, profilo) => {
  montaMenuUtente({ contenitore: document.getElementById("slot-utente"), user, profilo });
  daIndirizzo();
  aggiorna();
  veil.style.display = "none";
  contenuto.style.display = "block";
});
