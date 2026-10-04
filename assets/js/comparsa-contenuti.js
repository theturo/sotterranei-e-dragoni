// Comparsa dei contenuti nella Sessione del giocatore (tavola "Comparsa dei
// contenuti in sessione", effetto B scenico, della tela).
// - Un contenuto mostrato dal DM: la riga si apre dall'alto e le altre
//   scivolano giù; la miniatura si "svela" (sfocata e sbiadita → nitida) con
//   un riflesso finale; il titolo si scrive lettera per lettera, poi compare
//   la descrizione; la riga si accende d'oro e si spegne in 3 s.
// - Il sigillo «Nuovo» rimbalza e resta finché il giocatore non apre il
//   contenuto (tocco sulla miniatura).
// - Un contenuto nascosto dal DM: la riga si chiude sfumando e sfocandosi.
// - Lo stato vuoto sfuma. Con "riduci animazioni" nessun movimento (il
//   sigillo «Nuovo» resta, fermo).
// Le righe già presenti si riusano: si animano solo quelle che entrano o escono.
import { creaElemento } from "./contenuti.js";
import { suona } from "./suoni.js";

const ridotto = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const easeOut = "cubic-bezier(0.33, 1, 0.68, 1)";
const molla = (s) => (s <= 0 ? 0 : 1 - Math.exp(-7 * s) * (Math.cos(11 * s) + (7 / 11) * Math.sin(11 * s)));

// lista: <ul> delle righe; vuoto: lo stato vuoto (mostrato quando non c'è nulla).
export function montaComparsaContenuti({ lista, vuoto }) {
  const righe = new Map();      // id → { li, firma }
  const nonVisti = new Set();   // contenuti con il sigillo «Nuovo»
  let primaVolta = true;
  let erano = null;

  function sigillo(li, id, anima) {
    const testata = li.querySelector(".riga-contenuto-testata");
    if (!testata || testata.querySelector(".sigillo-nuovo")) return;
    const s = creaElemento("span", "sigillo-nuovo", "Nuovo");
    testata.append(s);
    if (anima) {
      s.animate(Array.from({ length: 25 }, (_, i) => {
        const t = (i / 24) * 0.9;
        const m = molla(t * 1.1);
        return { transform: `scale(${0.2 + 0.8 * m})`, opacity: Math.min(1, m * 3), offset: i / 24 };
      }), { duration: 900, delay: 600, fill: "backwards" });
    }
    // Aprendo il contenuto il sigillo se ne va.
    li.querySelector(".miniatura-contenuto")?.addEventListener("click", () => {
      nonVisti.delete(id);
      const via = li.querySelector(".sigillo-nuovo");
      if (!via) return;
      if (ridotto()) via.remove();
      else via.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).finished.then(() => via.remove()).catch(() => via.remove());
    }, { once: true });
  }

  function apri(li) {
    const h = li.offsetHeight;
    li.animate([
      { height: "0px", opacity: 0, transform: "translateY(10px)", overflow: "hidden", paddingTop: "0px", paddingBottom: "0px" },
      { height: `${h}px`, opacity: 1, transform: "translateY(0)", overflow: "hidden" },
    ], { duration: 520, easing: easeOut });
    // La riga si accende d'oro e si spegne in 3 s.
    li.animate([
      { backgroundColor: "rgba(201, 162, 39, 0.4)", boxShadow: "inset 0 0 0 0 rgba(201, 162, 39, 0)" },
      { backgroundColor: "rgba(201, 162, 39, 0.38)", boxShadow: "inset 0 0 26px rgba(243, 211, 107, 0.7)", offset: 0.12 },
      { backgroundColor: "rgba(201, 162, 39, 0.3)", boxShadow: "inset 0 0 0 rgba(243, 211, 107, 0)", offset: 0.38 },
      { backgroundColor: "rgba(201, 162, 39, 0)", boxShadow: "inset 0 0 0 rgba(243, 211, 107, 0)" },
    ], { duration: 3300 });
    // La miniatura si svela, poi un riflesso la attraversa.
    const miniatura = li.querySelector(".miniatura-contenuto");
    const img = miniatura?.querySelector("img");
    img?.animate([
      { filter: "blur(10px) brightness(1.35) saturate(0)", transform: "scale(1.08)" },
      { filter: "blur(0) brightness(1) saturate(1)", transform: "scale(1)" },
    ], { duration: 700, delay: 250, easing: easeOut, fill: "backwards" });
    if (miniatura) {
      const lampo = creaElemento("span", "lampo-miniatura");
      miniatura.append(lampo);
      lampo.animate([
        { left: "-40%", opacity: 0 }, { left: "50%", opacity: 1, offset: 0.5 }, { left: "140%", opacity: 0 },
      ], { duration: 450, delay: 700, easing: easeOut, fill: "backwards" }).finished.then(() => lampo.remove()).catch(() => lampo.remove());
    }
    // Il titolo si scrive lettera per lettera (il testo è già tutto lì: lo si scopre).
    const titolo = li.querySelector(".riga-contenuto-titolo");
    const lettere = Math.max(1, (titolo?.textContent || "").length);
    titolo?.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
      { duration: 450, delay: 350, easing: `steps(${lettere}, end)`, fill: "backwards" });
    for (const el of li.querySelectorAll(".riga-contenuto-descrizione")) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 700, fill: "backwards" });
    }
  }

  function chiudi(li) {
    li.dataset.uscente = "1";
    if (ridotto()) {
      li.remove();
      return;
    }
    const h = li.offsetHeight;
    li.animate([
      { height: `${h}px`, opacity: 1, filter: "blur(0)", overflow: "hidden" },
      { height: "0px", opacity: 0, filter: "blur(6px)", overflow: "hidden", paddingTop: "0px", paddingBottom: "0px", borderBottomWidth: "0px" },
    ], { duration: 300, easing: "ease-in-out", fill: "forwards" }).finished.then(() => li.remove()).catch(() => li.remove());
  }

  function statoVuoto(nessuno) {
    if (erano === null || ridotto()) {
      vuoto.hidden = !nessuno;
      return;
    }
    if (nessuno === (erano === 0)) return;
    if (nessuno) {
      vuoto.hidden = false;
      vuoto.animate([{ opacity: 0, height: "0px", overflow: "hidden" }, { opacity: 1, height: `${vuoto.offsetHeight}px`, overflow: "hidden" }], { duration: 350 });
    } else {
      const h = vuoto.offsetHeight;
      vuoto.animate([{ opacity: 1, height: `${h}px`, overflow: "hidden" }, { opacity: 0, height: "0px", overflow: "hidden" }], { duration: 350 })
        .finished.then(() => { vuoto.hidden = true; }).catch(() => { vuoto.hidden = true; });
    }
  }

  // elenco: contenuti visibili (con id); crea(c): la riga; firma(c): cambia
  // quando la riga va rifatta (titolo, descrizione...).
  function aggiorna(elenco, crea, firma) {
    const anima = !primaVolta && !ridotto();
    const presenti = new Set(elenco.map((c) => c.id));
    for (const [id, { li }] of righe) {
      if (presenti.has(id)) continue;
      righe.delete(id);
      nonVisti.delete(id);
      chiudi(li);
    }
    const nuove = [];
    const ordinate = elenco.map((c) => {
      const f = firma(c);
      const esistente = righe.get(c.id);
      if (esistente && esistente.firma === f) return esistente.li;
      const li = crea(c);
      li.dataset.id = c.id;
      if (esistente) esistente.li.replaceWith(li);
      else if (!primaVolta) {
        nuove.push(li);
        nonVisti.add(c.id);
      }
      righe.set(c.id, { li, firma: f });
      if (nonVisti.has(c.id)) sigillo(li, c.id, false);
      return li;
    });
    // Ordine: si spostano solo le righe fuori posto (quelle che escono restano dove sono).
    let cursore = lista.firstElementChild;
    for (const li of ordinate) {
      while (cursore?.dataset.uscente) cursore = cursore.nextElementSibling;
      if (li === cursore) cursore = cursore.nextElementSibling;
      else lista.insertBefore(li, cursore);
    }
    // Pergamena e sigillo (il sigillo cade sul badge «Nuovo», a 0,62 s).
    if (nuove.length) suona("rivela");
    for (const li of nuove) {
      if (!anima) continue;
      li.querySelector(".sigillo-nuovo")?.remove();
      sigillo(li, li.dataset.id, true);
      apri(li);
    }
    statoVuoto(elenco.length === 0);
    erano = elenco.length;
    primaVolta = false;
  }

  return { aggiorna };
}
