// Vista di una mappa della sessione: immagine, griglia e pedine dentro una
// finestra in cui ci si sposta (trascinando lo sfondo) e si fa zoom (rotella,
// due dita o i metodi zoom/adatta). Usata dal pannello Mappa della pagina
// Sessione (DM e giocatori) e dallo schermo del tavolo (tavolo.html, solo
// visione). Mentre si trascina una pedina compare la distanza percorsa
// rispetto alla velocità; al rilascio "onSposta" salva la nuova casella.
// Sopra la griglia c'è la nebbia di guerra: velo grigio per il DM, buio con
// il bordo sfumato per i giocatori (impostaNebbia); il DM la disegna con
// modoNebbia (pennello o rettangolo, a caselle). Sopra la nebbia gli strumenti
// di tutti (fase 4): aree degli incantesimi con le caselle colpite, righelli
// in corso e onde dei ping (impostaStrumenti, ping); con modoPunti i tocchi
// arrivano come punti della mappa invece di spostare la vista.
import {
  camAdatta,
  camPerRettangolo,
  camCentrata,
  rettangoloVisibile,
  daSchermo,
  zoomIntorno,
  centroCasella,
  casellaDaCentro,
  aggancia,
  caselleTra,
  testoDistanza,
  righeGriglia,
  coloreSalute,
  strisceNebbia,
  casellaDiPunto,
  caselleArea,
  contornoArea,
  pedineInCaselle,
} from "./mappa-calcoli.js";
import { icona } from "./icone.js";
import { applicaRitaglio } from "./ritaglio.js";

let contatoreViste = 0;

const SVG = "http://www.w3.org/2000/svg";
// Icone fisse (nessun dato degli utenti): artigli per i nemici senza
// immagine, occhio barrato per le pedine nascoste ai giocatori.
const ICONA_ARTIGLI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 4 C9 9 9 14 7 20"/><path d="M12 3 C14 9 14 14 12 21"/><path d="M18 4 C20 9 19 14 17 20"/></svg>';
const ICONA_NASCOSTA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M2 12 C5 7 9 5 12 5 C15 5 19 7 22 12 C19 17 15 19 12 19 C9 19 5 17 2 12 Z"/><circle cx="12" cy="12" r="3"/><line x1="4" y1="20" x2="20" y2="4"/></svg>';
const SOGLIA_TRASCINAMENTO = 5;

function crea(tag, classe, testo) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (testo != null) el.textContent = testo;
  return el;
}

function creaSvg(tag, attributi = {}) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attributi)) el.setAttribute(k, v);
  return el;
}

// opzioni:
// - interattiva: false per lo schermo del tavolo (niente tocchi né rotella)
// - puoMuovere(id): se la pedina si può trascinare da qui
// - velocita(id): metri di movimento (null se non noti)
// - onSposta(id, { c, r }): pedina lasciata in una nuova casella
// - onSeleziona(id | null): tocco su una pedina (o sullo sfondo)
// - avviso(testo): messaggio breve (es. pedina di un altro giocatore)
export function creaVistaMappa(contenitore, opzioni = {}) {
  const {
    interattiva = true,
    puoMuovere = () => false,
    velocita = () => null,
    onSposta = () => {},
    onSeleziona = () => {},
    avviso = () => {},
  } = opzioni;

  const finestra = crea("div", "mappa-finestra");
  if (!interattiva) finestra.classList.add("solo-visione");
  const mondo = crea("div", "mappa-mondo");
  const immagine = crea("img", "mappa-immagine");
  immagine.alt = "";
  immagine.draggable = false;
  const svgGriglia = creaSvg("svg", { class: "mappa-griglia", "aria-hidden": "true" });
  const gruppoGriglia = creaSvg("g", { stroke: "rgba(10, 6, 3, 0.45)" });
  svgGriglia.append(gruppoGriglia);
  const cornice = crea("div", "mappa-cornice-tavolo");
  cornice.append(crea("span", null, "Schermo del tavolo"));
  cornice.hidden = true;
  const svgMisura = creaSvg("svg", { class: "mappa-misura", "aria-hidden": "true" });
  const cerchioPartenza = creaSvg("circle", { fill: "rgba(232, 198, 90, 0.12)" });
  const lineaMisura = creaSvg("line", {});
  svgMisura.append(cerchioPartenza, lineaMisura);
  svgMisura.style.display = "none";
  const etichettaMisura = crea("div", "mappa-etichetta-misura");
  etichettaMisura.hidden = true;
  // Nebbia: ID unici per filtro e motivo (più viste nella stessa pagina).
  const idVista = ++contatoreViste;
  const svgNebbia = creaSvg("svg", { class: "mappa-nebbia", "aria-hidden": "true" });
  const defs = creaSvg("defs");
  const sfuma = creaSvg("filter", { id: `nebbia-sfuma-${idVista}`, x: "-5%", y: "-5%", width: "110%", height: "110%" });
  const sfocatura = creaSvg("feGaussianBlur", { stdDeviation: "16" });
  sfuma.append(sfocatura);
  const motivo = creaSvg("pattern", { id: `nebbia-velo-${idVista}`, width: "14", height: "14", patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
  motivo.append(
    creaSvg("rect", { width: "14", height: "14", fill: "rgba(18, 16, 30, 0.55)" }),
    creaSvg("line", { x1: "0", y1: "0", x2: "0", y2: "14", stroke: "rgba(200, 200, 230, 0.18)", "stroke-width": "3" }),
  );
  defs.append(sfuma, motivo);
  const gruppoNebbia = creaSvg("g");
  svgNebbia.append(defs, gruppoNebbia);
  const anteprimaNebbia = crea("div", "mappa-nebbia-anteprima");
  anteprimaNebbia.hidden = true;
  // Strumenti: aree e righelli (SVG), onde dei ping, etichette sopra le pedine.
  const svgStrumenti = creaSvg("svg", { class: "mappa-strumenti", "aria-hidden": "true" });
  const gruppoAree = creaSvg("g");
  const gruppoRighelli = creaSvg("g");
  svgStrumenti.append(gruppoAree, gruppoRighelli);
  const stratoPing = crea("div", "mappa-ping");
  const stratoEtichette = crea("div", "mappa-etichette-strumenti");
  const strato = crea("div", "mappa-pedine");
  mondo.append(immagine, svgGriglia, svgNebbia, svgStrumenti, stratoPing, cornice, svgMisura, strato, anteprimaNebbia, etichettaMisura, stratoEtichette);
  const vuoto = crea("div", "mappa-vuota");
  vuoto.hidden = true;
  finestra.append(mondo, vuoto);
  contenitore.append(finestra);

  let mappa = null; // { larghezza, altezza }
  let griglia = { lato: 50, ox: 0, oy: 0, visibile: true, snap: true };
  let pedine = [];
  let selezionata = null;
  let cam = { x: 0, y: 0, z: 1 };
  let rettangoloFisso = null; // tavolo: rettangolo da mostrare (null = tutta la mappa)
  let segueRettangolo = false;
  let presa = null; // trascinamento di una pedina in corso
  let taraturaCallback = null;
  let nebbia = null;
  let modoNebbiaVisto = "buio"; // "velo" (DM) o "buio" (giocatori)
  let disegnoNebbia = null; // { inizio, muovi, fine } quando il DM disegna
  let tratto = null;
  let gestoriPunti = null; // { inizio, muovi, fine } con punti della mappa (strumenti)
  let strumenti = { aree: [], righelli: [] };
  let colpite = new Set(); // ID delle pedine dentro un'area
  const puntatori = new Map();

  const dimensioni = () => ({ w: finestra.clientWidth || 1, h: finestra.clientHeight || 1 });
  // Finestra ancora nascosta (dimensioni zero): si adatta quando compare.
  let daAdattare = false;
  const haDimensioni = () => finestra.clientWidth > 0 && finestra.clientHeight > 0;
  const camIniziale = () => {
    const { w, h } = dimensioni();
    return camAdatta(w, h, mappa.larghezza, mappa.altezza);
  };
  const limitiZoom = () => {
    const base = camIniziale().z;
    return { min: base * 0.5, max: Math.max(base * 2, 320 / (griglia.lato || 50)) };
  };

  function applicaCamera() {
    mondo.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.z})`;
    gruppoGriglia.setAttribute("stroke-width", String(1.2 / cam.z));
    lineaMisura.setAttribute("stroke-width", String(2.5 / cam.z));
    lineaMisura.setAttribute("stroke-dasharray", `${8 / cam.z} ${6 / cam.z}`);
    cerchioPartenza.setAttribute("stroke-width", String(2.5 / cam.z));
    cerchioPartenza.setAttribute("stroke-dasharray", `${8 / cam.z} ${6 / cam.z}`);
    etichettaMisura.style.fontSize = `${13 / cam.z}px`;
    cornice.style.borderWidth = `${2 / cam.z}px`;
    cornice.firstChild.style.fontSize = `${11 / cam.z}px`;
    cornice.firstChild.style.padding = `${2 / cam.z}px ${7 / cam.z}px`;
    svgStrumenti.style.setProperty("--tratto", `${2.5 / cam.z}px`);
    stratoEtichette.style.fontSize = `${12 / cam.z}px`;
    disegnaRighelli();
  }

  function disegnaGriglia() {
    gruppoGriglia.replaceChildren();
    if (!mappa || !griglia.visibile) return;
    const { verticali, orizzontali } = righeGriglia(griglia, mappa.larghezza, mappa.altezza);
    verticali.forEach((x) => gruppoGriglia.append(creaSvg("line", { x1: x, y1: 0, x2: x, y2: mappa.altezza })));
    orizzontali.forEach((y) => gruppoGriglia.append(creaSvg("line", { x1: 0, y1: y, x2: mappa.larghezza, y2: y })));
  }

  function posizioneDi(p) {
    return presa && presa.id === p.id ? presa.a : { c: p.c, r: p.r };
  }

  function disegnaPedina(p) {
    const n = p.caselle || 1;
    const lato = griglia.lato * n * (n > 1 ? 0.92 : 0.86);
    const centro = centroCasella(griglia, posizioneDi(p), n);
    const el = crea("div", "pedina-mappa");
    el.dataset.pedina = p.id;
    el.title = p.nascosta ? `${p.nome} (nascosto ai giocatori)` : p.nome;
    if (puoMuovere(p.id) && interattiva) el.classList.add("mobile");
    for (const [classe, attiva] of [["mia", p.mia], ["a-terra", p.aTerra], ["nemico", p.nemico], ["nascosta", p.nascosta],
      ["di-turno", p.diTurno], ["nella-nebbia", p.nellaNebbia], ["selezionata", selezionata === p.id], ["presa", presa?.id === p.id],
      ["colpita", colpite.has(p.id)], ["alleato", p.alleato]]) {
      if (attiva) el.classList.add(classe);
    }
    Object.assign(el.style, {
      left: `${centro.x - lato / 2}px`,
      top: `${centro.y - lato / 2}px`,
      width: `${lato}px`,
      height: `${lato}px`,
      fontSize: `${griglia.lato * 0.24 * Math.min(n, 2)}px`,
    });
    const volto = crea("div", "pedina-volto");
    if (p.ritrattoUrl) {
      const img = crea("img");
      img.alt = "";
      img.draggable = false;
      img.src = p.ritrattoUrl;
      applicaRitaglio(img, p.ritaglio);
      volto.append(img);
    } else if (p.nemico) {
      const artigli = crea("span", "pedina-artigli");
      artigli.innerHTML = ICONA_ARTIGLI;
      volto.append(artigli);
    } else {
      volto.textContent = p.iniziali || "?";
      if (p.colore) volto.style.background = p.colore;
    }
    el.append(volto);
    if (p.nemico && /^\d+$/.test(p.iniziali || "")) el.append(crea("span", "pedina-numero", p.iniziali));
    if (p.nascosta) {
      const occhio = crea("span", "pedina-occhio");
      occhio.innerHTML = ICONA_NASCOSTA;
      el.append(occhio);
    }
    if (p.aTerra) {
      const croce = crea("div", "pedina-croce");
      croce.innerHTML = icona("a-terra");
      el.append(croce, crea("div", "pedina-terra", "A terra"));
    } else if (p.quotaPf != null) {
      const pf = crea("div", "pedina-pf");
      const barra = crea("div", "pedina-pf-barra");
      barra.style.width = `${Math.max(0, Math.min(1, p.quotaPf)) * 100}%`;
      barra.style.background = coloreSalute(p.quotaPf);
      pf.append(barra);
      el.append(pf);
    }
    if (p.condizioni?.length) {
      const lista = crea("div", "pedina-condizioni");
      p.condizioni.slice(0, 4).forEach((c) => {
        const chip = crea("span", "pedina-condizione", c.sigla);
        chip.title = c.nome;
        chip.style.background = c.colore;
        lista.append(chip);
      });
      el.append(lista);
    }
    el.append(crea("div", "pedina-nome", p.nome));
    return el;
  }

  function disegnaPedine() {
    strato.replaceChildren(...(mappa ? pedine.map(disegnaPedina) : []));
  }

  function disegnaMisura() {
    if (!presa || !presa.mosso) {
      svgMisura.style.display = "none";
      etichettaMisura.hidden = true;
      return;
    }
    const da = centroCasella(griglia, presa.da, presa.n);
    const a = centroCasella(griglia, presa.a, presa.n);
    const { testo, oltre } = testoDistanza(caselleTra(presa.da, presa.a), velocita(presa.id));
    const colore = oltre ? "#e0525f" : "#e8c65a";
    svgMisura.style.display = "";
    for (const [k, v] of Object.entries({ cx: da.x, cy: da.y, r: griglia.lato * presa.n * 0.43, stroke: colore })) cerchioPartenza.setAttribute(k, v);
    for (const [k, v] of Object.entries({ x1: da.x, y1: da.y, x2: a.x, y2: a.y, stroke: colore })) lineaMisura.setAttribute(k, v);
    etichettaMisura.hidden = false;
    etichettaMisura.textContent = testo;
    etichettaMisura.classList.toggle("oltre", oltre);
    etichettaMisura.style.left = `${a.x}px`;
    etichettaMisura.style.top = `${a.y - griglia.lato * (presa.n / 2 + 0.12)}px`;
  }

  function disegnaNebbia() {
    gruppoNebbia.replaceChildren();
    if (!mappa || !nebbia?.attiva) return;
    const velo = modoNebbiaVisto === "velo";
    gruppoNebbia.setAttribute("filter", velo ? "" : `url(#nebbia-sfuma-${idVista})`);
    gruppoNebbia.setAttribute("fill", velo ? `url(#nebbia-velo-${idVista})` : "#050302");
    sfocatura.setAttribute("stdDeviation", String(griglia.lato * 0.32));
    strisceNebbia(nebbia, griglia).forEach(({ x, y, w, h }) => gruppoNebbia.append(creaSvg("rect", { x, y, width: w, height: h })));
  }

  // Aree: caselle colpite e contorno nel colore di chi le ha messe; le pedine
  // dentro un'area sono "colpite". Righelli: linea tratteggiata e misura.
  function disegnaAree() {
    gruppoAree.replaceChildren();
    const etichette = [];
    const tutteColpite = [];
    if (mappa) {
      strumenti.aree.forEach((a) => {
        const g = creaSvg("g", { class: a.bozza ? "area bozza" : "area", style: `--colore: ${a.colore}` });
        const caselle = caselleArea(a, griglia);
        tutteColpite.push(...caselle);
        caselle.forEach(({ c, r }) => g.append(creaSvg("rect", {
          class: "area-casella", x: griglia.ox + c * griglia.lato, y: griglia.oy + r * griglia.lato, width: griglia.lato, height: griglia.lato,
        })));
        const contorno = contornoArea(a, griglia);
        g.append(contorno.cerchio
          ? creaSvg("circle", { class: "area-contorno", cx: contorno.cerchio.cx, cy: contorno.cerchio.cy, r: contorno.cerchio.r })
          : creaSvg("polygon", { class: "area-contorno", points: contorno.punti.map((p) => p.join(",")).join(" ") }));
        g.append(creaSvg("circle", { class: "area-origine", cx: a.x, cy: a.y, r: griglia.lato * 0.1 }));
        gruppoAree.append(g);
        if (a.nome) {
          const e = crea("div", "mappa-etichetta-area", a.nome);
          e.style.left = `${a.x}px`;
          e.style.top = `${a.y}px`;
          e.style.borderColor = a.colore;
          etichette.push(e);
        }
      });
    }
    colpite = new Set(pedineInCaselle(pedine, tutteColpite).map((p) => p.id));
    stratoEtichette.querySelectorAll(".mappa-etichetta-area").forEach((e) => e.remove());
    stratoEtichette.append(...etichette);
  }

  function disegnaRighelli() {
    gruppoRighelli.replaceChildren();
    stratoEtichette.querySelectorAll(".mappa-etichetta-righello").forEach((e) => e.remove());
    if (!mappa) return;
    strumenti.righelli.forEach((r) => {
      const g = creaSvg("g", { class: "righello", style: `--colore: ${r.colore}` });
      g.append(
        creaSvg("line", { x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2, "stroke-dasharray": `${8 / cam.z} ${6 / cam.z}` }),
        creaSvg("circle", { cx: r.x1, cy: r.y1, r: 5 / cam.z }),
        creaSvg("circle", { cx: r.x2, cy: r.y2, r: 5 / cam.z }),
      );
      gruppoRighelli.append(g);
      const e = crea("div", "mappa-etichetta-righello", r.testo);
      e.style.left = `${r.x2}px`;
      e.style.top = `${r.y2}px`;
      e.style.borderColor = r.colore;
      stratoEtichette.append(e);
    });
  }

  function disegnaStrumenti() {
    disegnaAree();
    disegnaRighelli();
    disegnaPedine();
  }

  function adattaDimensioni() {
    if (!mappa) return;
    for (const svg of [svgNebbia, svgStrumenti]) {
      svg.setAttribute("width", mappa.larghezza);
      svg.setAttribute("height", mappa.altezza);
      svg.setAttribute("viewBox", `0 0 ${mappa.larghezza} ${mappa.altezza}`);
    }
    svgGriglia.setAttribute("width", mappa.larghezza);
    svgGriglia.setAttribute("height", mappa.altezza);
    svgGriglia.setAttribute("viewBox", `0 0 ${mappa.larghezza} ${mappa.altezza}`);
    svgMisura.setAttribute("width", mappa.larghezza);
    svgMisura.setAttribute("height", mappa.altezza);
    mondo.style.width = `${mappa.larghezza}px`;
    mondo.style.height = `${mappa.altezza}px`;
  }

  // ---------- puntatore ----------
  function puntoSchermo(evento) {
    const r = finestra.getBoundingClientRect();
    const k = r.width / (finestra.offsetWidth || r.width || 1) || 1;
    return { sx: (evento.clientX - r.left) / k, sy: (evento.clientY - r.top) / k };
  }

  function giu(evento) {
    if (!mappa || evento.button > 0) return;
    const { sx, sy } = puntoSchermo(evento);
    const punto = daSchermo(cam, sx, sy);
    if (taraturaCallback) {
      evento.preventDefault();
      taraturaCallback(punto);
      return;
    }
    if (gestoriPunti && puntatori.size === 0) {
      evento.preventDefault();
      tratto = { puntatore: evento.pointerId, punti: true, ultimo: punto };
      finestra.setPointerCapture?.(evento.pointerId);
      gestoriPunti.inizio(punto);
      return;
    }
    if (disegnoNebbia && puntatori.size === 0) {
      evento.preventDefault();
      const casella = casellaDiPunto(griglia, punto);
      tratto = { puntatore: evento.pointerId, ultima: casella };
      finestra.setPointerCapture?.(evento.pointerId);
      disegnoNebbia.inizio(casella);
      return;
    }
    const id = evento.target.closest?.("[data-pedina]")?.dataset.pedina;
    const p = id && pedine.find((x) => x.id === id);
    if (p && puntatori.size === 0) {
      evento.preventDefault();
      const n = p.caselle || 1;
      const centro = centroCasella(griglia, p, n);
      presa = {
        id, n, puntatore: evento.pointerId, sx, sy, mosso: false, mobile: puoMuovere(id),
        dx: centro.x - punto.x, dy: centro.y - punto.y, da: { c: p.c, r: p.r }, a: { c: p.c, r: p.r },
      };
      finestra.setPointerCapture?.(evento.pointerId);
      return;
    }
    puntatori.set(evento.pointerId, { sx, sy, inizio: { sx, sy } });
    finestra.setPointerCapture?.(evento.pointerId);
  }

  function muovi(evento) {
    const { sx, sy } = puntoSchermo(evento);
    if (tratto?.punti && evento.pointerId === tratto.puntatore) {
      tratto.ultimo = daSchermo(cam, sx, sy);
      gestoriPunti?.muovi(tratto.ultimo);
      return;
    }
    if (tratto && evento.pointerId === tratto.puntatore) {
      const casella = casellaDiPunto(griglia, daSchermo(cam, sx, sy));
      if (casella.c !== tratto.ultima.c || casella.r !== tratto.ultima.r) {
        tratto.ultima = casella;
        disegnoNebbia?.muovi(casella);
      }
      return;
    }
    if (presa && evento.pointerId === presa.puntatore) {
      if (!presa.mosso && Math.hypot(sx - presa.sx, sy - presa.sy) < SOGLIA_TRASCINAMENTO) return;
      if (!presa.mobile) {
        // Pedina altrui: il gesto diventa uno spostamento della mappa.
        if (!presa.avvisato) avviso("Puoi muovere solo la tua pedina.");
        presa.avvisato = true;
        cam = { ...cam, x: cam.x + sx - presa.sx, y: cam.y + sy - presa.sy };
        presa.sx = sx;
        presa.sy = sy;
        presa.mosso = true;
        applicaCamera();
        return;
      }
      presa.mosso = true;
      const punto = daSchermo(cam, sx, sy);
      const x = Math.min(mappa.larghezza, Math.max(0, punto.x + presa.dx));
      const y = Math.min(mappa.altezza, Math.max(0, punto.y + presa.dy));
      presa.a = casellaDaCentro(griglia, { x, y }, presa.n);
      disegnaPedine();
      disegnaMisura();
      return;
    }
    if (!puntatori.has(evento.pointerId)) return;
    const prima = [...puntatori.values()].map((p) => ({ ...p }));
    const vecchio = puntatori.get(evento.pointerId);
    puntatori.set(evento.pointerId, { ...vecchio, sx, sy });
    if (puntatori.size === 1) {
      cam = { ...cam, x: cam.x + sx - vecchio.sx, y: cam.y + sy - vecchio.sy };
    } else if (puntatori.size === 2) {
      const dopo = [...puntatori.values()];
      const distanza = (a) => Math.hypot(a[0].sx - a[1].sx, a[0].sy - a[1].sy) || 1;
      const mezzo = (a) => ({ x: (a[0].sx + a[1].sx) / 2, y: (a[0].sy + a[1].sy) / 2 });
      const m0 = mezzo(prima);
      const m1 = mezzo(dopo);
      const { min, max } = limitiZoom();
      const z = Math.min(max, Math.max(min, cam.z * (distanza(dopo) / distanza(prima))));
      const k = z / cam.z;
      cam = { x: m1.x - (m0.x - cam.x) * k, y: m1.y - (m0.y - cam.y) * k, z };
    }
    applicaCamera();
  }

  function su(evento) {
    if (tratto && evento.pointerId === tratto.puntatore) {
      const finito = tratto;
      tratto = null;
      if (finito.punti) gestoriPunti?.fine(finito.ultimo, evento.type === "pointercancel");
      else disegnoNebbia?.fine(finito.ultima);
      return;
    }
    if (presa && evento.pointerId === presa.puntatore) {
      const finita = presa;
      presa = null;
      if (!finita.mosso) {
        selezionata = selezionata === finita.id ? null : finita.id;
        onSeleziona(selezionata);
      } else if (finita.mobile) {
        const arrivo = griglia.snap ? aggancia(finita.a) : {
          c: Math.round(finita.a.c * 100) / 100,
          r: Math.round(finita.a.r * 100) / 100,
        };
        const p = pedine.find((x) => x.id === finita.id);
        if (p) Object.assign(p, arrivo);
        onSposta(finita.id, arrivo);
      }
      disegnaPedine();
      disegnaMisura();
      return;
    }
    const puntatore = puntatori.get(evento.pointerId);
    puntatori.delete(evento.pointerId);
    if (puntatore && puntatori.size === 0 && Math.hypot(puntatore.sx - puntatore.inizio.sx, puntatore.sy - puntatore.inizio.sy) < SOGLIA_TRASCINAMENTO && selezionata) {
      selezionata = null;
      onSeleziona(null);
      disegnaPedine();
    }
  }

  if (interattiva) {
    finestra.addEventListener("pointerdown", giu);
    finestra.addEventListener("pointermove", muovi);
    finestra.addEventListener("pointerup", su);
    finestra.addEventListener("pointercancel", su);
    finestra.addEventListener("wheel", (evento) => {
      if (!mappa) return;
      evento.preventDefault();
      const { sx, sy } = puntoSchermo(evento);
      const { min, max } = limitiZoom();
      cam = zoomIntorno(cam, sx, sy, Math.exp(-evento.deltaY * 0.0015), min, max);
      applicaCamera();
    }, { passive: false });
  }

  // Lo schermo del tavolo segue le dimensioni della finestra.
  const osservatore = new ResizeObserver(() => {
    if (!mappa || !haDimensioni()) return;
    if (segueRettangolo) mostraRettangolo(rettangoloFisso);
    else if (daAdattare) {
      daAdattare = false;
      cam = camIniziale();
      applicaCamera();
    }
  });
  osservatore.observe(finestra);

  function mostraRettangolo(rettangolo) {
    rettangoloFisso = rettangolo;
    segueRettangolo = true;
    if (!mappa) return;
    const { w, h } = dimensioni();
    cam = rettangolo ? camPerRettangolo(w, h, rettangolo) : camIniziale();
    applicaCamera();
  }

  return {
    elemento: finestra,
    // { url, larghezza, altezza } oppure null (nessuna mappa: "messaggio").
    impostaMappa(dati, messaggio = "") {
      const nuova = dati && (!mappa || mappa.url !== dati.url || mappa.larghezza !== dati.larghezza);
      mappa = dati ? { ...dati } : null;
      mondo.hidden = !mappa;
      vuoto.hidden = Boolean(mappa);
      vuoto.textContent = messaggio;
      if (!mappa) return;
      if (immagine.getAttribute("src") !== dati.url) immagine.src = dati.url;
      adattaDimensioni();
      disegnaGriglia();
      disegnaNebbia();
      disegnaStrumenti();
      if (nuova) {
        selezionata = null;
        if (segueRettangolo) mostraRettangolo(rettangoloFisso);
        else {
          cam = camIniziale();
          daAdattare = !haDimensioni();
          applicaCamera();
        }
      }
    },
    impostaGriglia(nuova) {
      griglia = { ...griglia, ...nuova };
      disegnaGriglia();
      disegnaNebbia();
      disegnaStrumenti();
      disegnaMisura();
    },
    impostaPedine(elenco) {
      pedine = elenco.map((p) => ({ ...p }));
      if (selezionata && !pedine.some((p) => p.id === selezionata)) {
        selezionata = null;
        onSeleziona(null);
      }
      disegnaAree();
      disegnaPedine();
    },
    seleziona(id) {
      selezionata = id;
      disegnaPedine();
    },
    adatta() {
      segueRettangolo = false;
      if (!mappa) return;
      cam = camIniziale();
      applicaCamera();
    },
    zoom(fattore) {
      if (!mappa) return;
      const { w, h } = dimensioni();
      const { min, max } = limitiZoom();
      cam = zoomIntorno(cam, w / 2, h / 2, fattore, min, max);
      applicaCamera();
    },
    centraSu(id, zMinimo = 0) {
      const p = pedine.find((x) => x.id === id);
      if (!p || !mappa) return false;
      daAdattare = false;
      const { w, h } = dimensioni();
      const { max } = limitiZoom();
      const z = Math.min(max, Math.max(cam.z, zMinimo || 0.9 * (64 / griglia.lato)));
      cam = camCentrata(w, h, centroCasella(griglia, p, p.caselle || 1), z);
      applicaCamera();
      return true;
    },
    // Tavolo: mostra sempre questo rettangolo (null = tutta la mappa).
    mostraRettangolo,
    rettangoloVisibile() {
      const { w, h } = dimensioni();
      return rettangoloVisibile(w, h, cam);
    },
    // Centro della parte visibile, come casella (per piazzare pedine).
    casellaAlCentro() {
      const r = this.rettangoloVisibile();
      return casellaDaCentro(griglia, { x: r.x + r.w / 2, y: r.y + r.h / 2 });
    },
    // Rettangolo di "caselle" × (caselle × 9/16) caselle attorno a una pedina
    // (lo schermo del tavolo che segue il turno), o null se non c'è.
    rettangoloIntorno(id, caselle = 14) {
      const p = pedine.find((x) => x.id === id);
      if (!p || !mappa) return null;
      const centro = centroCasella(griglia, p, p.caselle || 1);
      const w = caselle * griglia.lato;
      const h = w * 9 / 16;
      return { x: centro.x - w / 2, y: centro.y - h / 2, w, h };
    },
    // Punto della mappa sotto un punto dello schermo (clientX/Y), o null se
    // è fuori dalla finestra: per il rilascio dal vassoio dei nemici.
    puntoDaClient(clientX, clientY) {
      if (!mappa) return null;
      const r = finestra.getBoundingClientRect();
      if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null;
      const { sx, sy } = puntoSchermo({ clientX, clientY });
      return daSchermo(cam, sx, sy);
    },
    // Casella (angolo in alto a sinistra) per una pedina larga "n" centrata nel punto.
    casellaPerPunto(punto, n = 1) {
      return aggancia(casellaDaCentro(griglia, punto, n));
    },
    // DM: riquadro tratteggiato di ciò che mostra lo schermo del tavolo.
    impostaCornice(rettangolo) {
      cornice.hidden = !rettangolo;
      if (!rettangolo) return;
      Object.assign(cornice.style, {
        left: `${rettangolo.x}px`,
        top: `${rettangolo.y}px`,
        width: `${rettangolo.w}px`,
        height: `${rettangolo.h}px`,
      });
    },
    // Nebbia da disegnare (null = nessuna) e come mostrarla: "velo" per il
    // DM (ci vede attraverso), "buio" per i giocatori.
    impostaNebbia(nuova, modo = "buio") {
      nebbia = nuova;
      modoNebbiaVisto = modo;
      disegnaNebbia();
    },
    // Disegno della nebbia (DM): con { inizio, muovi, fine } i tocchi sulla
    // mappa arrivano come caselle invece di spostare la vista; null per smettere.
    modoNebbia(gestori) {
      disegnoNebbia = gestori;
      tratto = null;
      finestra.classList.toggle("in-taratura", Boolean(gestori) || Boolean(taraturaCallback));
    },
    // Riquadro del rettangolo che il DM sta tracciando (null per toglierlo).
    anteprimaRettangolo(a, b, copri = false) {
      anteprimaNebbia.hidden = !a;
      if (!a) return;
      const L = griglia.lato;
      Object.assign(anteprimaNebbia.style, {
        left: `${griglia.ox + Math.min(a.c, b.c) * L}px`,
        top: `${griglia.oy + Math.min(a.r, b.r) * L}px`,
        width: `${(Math.abs(b.c - a.c) + 1) * L}px`,
        height: `${(Math.abs(b.r - a.r) + 1) * L}px`,
        borderWidth: `${2 / cam.z}px`,
      });
      anteprimaNebbia.classList.toggle("copri", copri);
    },
    // Strumenti di tutti: { aree: [{ forma, misura, x, y, angolo, colore,
    // nome, bozza }], righelli: [{ x1, y1, x2, y2, colore, testo }] }.
    impostaStrumenti(nuovi) {
      strumenti = { aree: nuovi.aree || [], righelli: nuovi.righelli || [] };
      disegnaStrumenti();
    },
    // Onda di un ping nel punto (in pixel della mappa), poi sparisce.
    ping({ x, y }, colore) {
      if (!mappa) return;
      const onda = crea("div", "mappa-onda");
      Object.assign(onda.style, { left: `${x}px`, top: `${y}px`, width: `${griglia.lato * 3}px`, height: `${griglia.lato * 3}px` });
      onda.style.setProperty("--colore", colore);
      onda.append(crea("span"), crea("span"), crea("span"));
      stratoPing.append(onda);
      setTimeout(() => onda.remove(), 2600);
    },
    // Porta il punto al centro della vista, senza cambiare lo zoom.
    centraPunto({ x, y }) {
      if (!mappa) return;
      daAdattare = false;
      const { w, h } = dimensioni();
      cam = camCentrata(w, h, { x, y }, cam.z);
      applicaCamera();
    },
    // Strumenti (DM e giocatori): con { inizio, muovi, fine(punto, annullato) }
    // i tocchi arrivano come punti della mappa; null per tornare alla mano.
    modoPunti(gestori) {
      gestoriPunti = gestori;
      tratto = null;
      finestra.classList.toggle("in-strumento", Boolean(gestori));
    },
    // Taratura: i prossimi tocchi arrivano a "callback" (null per smettere).
    modoTaratura(callback) {
      taraturaCallback = callback;
      finestra.classList.toggle("in-taratura", Boolean(callback));
    },
    distruggi() {
      osservatore.disconnect();
      finestra.remove();
    },
  };
}
