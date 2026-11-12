// Danni e cure: quello che si vede quando cambiano i punti ferita, nel party
// e nel tracker della Sessione, sulle pedine della mappa e nella scheda
// rapida. Chi mostra dei PF, dopo ogni ridisegno, dice a `aggiorna` quanto
// valgono ora: il modulo ricorda il valore di prima e, se è cambiato, fa
// reagire gli elementi che ha davanti.
// - Danno: il bersaglio ha una scossa e un lampo rosso, la barra scatta al
//   nuovo valore e il pezzo perso resta chiaro un attimo prima di consumarsi,
//   il numero («−7») schizza fuori, ricade, rimbalza e svanisce.
// - Cura: alone verde, la parte di barra guadagnata entra con un'onda di
//   luce, il numero («+5») salta fuori allo stesso modo.
// - La forza è in proporzione al colpo: mezzi PF massimi in un colpo solo
//   sono il massimo. Andare a 0 PF (o tornare in piedi) è sempre il massimo.
// - Dove i PF veri non si conoscono (nemici visti dai giocatori: solo salute
//   vaga) non compare nessun numero.
// - Con «riduci animazioni»: niente scosse né voli; il numero compare fermo e
//   svanisce.
// Alcune parti della pagina ridisegnano righe e pedine da capo a ogni
// aggiornamento, altre le aggiornano sul posto. Se arriva un ridisegno mentre
// un effetto è in corso (due colpi ravvicinati, una pedina trascinata) e gli
// elementi sono nuovi, l'effetto riprende lì dal punto in cui era, invece di
// sparire; se sono gli stessi, continua da solo.
import { fotogrammi, scintille, ridotto, blocca } from "./movimento.js";

const GRAVITA = 900;       // px/s² per i numeri che ricadono
const VITA_NUMERO = 1.05;  // secondi
const RIPRESA = 750;       // ms: entro questo tempo un ridisegno riprende l'effetto in corso

// ---------- Solo calcoli (provati con Node) ----------

// Quota di PF tra 0 e 1, dai PF veri o da una quota già pronta (salute vaga).
export function quotaDi(pf) {
  if (pf?.quota != null) return blocca(pf.quota);
  return pf?.massimi > 0 ? blocca(pf.attuali / pf.massimi) : 0;
}

// Che cosa è successo tra due letture dei PF: null se niente, altrimenti
// { tipo: "danno" | "cura", delta (null se i PF veri non si conoscono), forza
// 0,2–1, aTerra, inPiedi, da, a (quote della barra) }.
export function leggiCambio(prima, dopo) {
  if (!prima || !dopo) return null;
  const da = quotaDi(prima);
  const a = quotaDi(dopo);
  const veri = prima.quota == null && dopo.quota == null;
  const delta = veri ? dopo.attuali - prima.attuali : null;
  if (veri ? delta === 0 : Math.abs(a - da) < 1e-6) return null;
  const danno = veri ? delta < 0 : a < da;
  const aTerra = danno && a <= 0 && da > 0;
  const inPiedi = !danno && da <= 0 && a > 0;
  // Mezza barra in un colpo solo = forza piena.
  const peso = veri && dopo.massimi > 0 ? Math.abs(delta) / (dopo.massimi * 0.5) : Math.abs(a - da) / 0.5;
  const forza = aTerra || inPiedi ? 1 : Math.min(1, Math.max(0.2, peso));
  return { tipo: danno ? "danno" : "cura", delta, forza, aTerra, inPiedi, da, a };
}

// La traiettoria del numero: parte con una spinta, ricade per gravità, tocca
// «terra» (suolo px sotto la partenza), rimbalza una volta. Restituisce la
// funzione t → { x, y } in pixel dalla partenza.
export function traiettoria({ vx, vy, suolo, rimbalzo = 0.38 }) {
  // Tempo del primo tocco: suolo = vy·t + g·t²/2
  const tocco = (-vy + Math.sqrt(vy * vy + 2 * GRAVITA * suolo)) / GRAVITA;
  const vyDopo = -rimbalzo * (vy + GRAVITA * tocco);
  return (t) => {
    if (t <= tocco) return { x: vx * t, y: vy * t + (GRAVITA * t * t) / 2 };
    const s = t - tocco;
    // Dopo il rimbalzo va più piano di lato e non scende sotto terra.
    return { x: vx * tocco + vx * 0.45 * s, y: Math.min(suolo, suolo + vyDopo * s + (GRAVITA * s * s) / 2) };
  };
}

// ---------- Sulla pagina ----------

// Lo strato dove volano numeri e schizzi: uno solo, sopra tutto, che non
// prende tocchi.
function stratoComune() {
  let strato = document.querySelector(".pf-strato");
  if (!strato) {
    strato = document.createElement("div");
    strato.className = "pf-strato";
    strato.setAttribute("aria-hidden", "true");
    document.body.append(strato);
  }
  return strato;
}

const via = (animazione, nodo) => animazione.finished.then(() => nodo.remove()).catch(() => nodo.remove());

// Il bersaglio è davvero in vista? Non lo è se è fuori dallo schermo o coperto
// (per esempio dalla scheda rapida aperta sopra il tracker): in quel caso il
// numero, che vola in uno strato sopra tutto, spunterebbe dal nulla.
function inVista(bersaglio) {
  const r = bersaglio.getBoundingClientRect();
  const sopra = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return Boolean(sopra) && (bersaglio.contains(sopra) || sopra.contains(bersaglio));
}

// Un velo colorato sopra il bersaglio, che svanisce.
function lampo(bersaglio, classe, forza) {
  if (getComputedStyle(bersaglio).position === "static") bersaglio.style.position = "relative";
  const velo = document.createElement("div");
  velo.className = `pf-lampo ${classe}`;
  velo.style.borderRadius = getComputedStyle(bersaglio).borderRadius;
  bersaglio.append(velo);
  const animazione = velo.animate([{ opacity: 0.35 + 0.5 * forza }, { opacity: 0 }], { duration: 380 + 260 * forza, easing: "ease-out" });
  via(animazione, velo);
  return animazione;
}

function scossa(bersaglio, forza) {
  const ampiezza = 2 + 8 * forza;
  return bersaglio.animate(fotogrammi(0.42, (t) => ({ transform: `translateX(${(ampiezza * Math.exp(-8 * t) * Math.sin(50 * t)).toFixed(2)}px)` }), 26), { duration: 420 });
}

function sollievo(bersaglio, forza) {
  return bersaglio.animate(fotogrammi(0.5, (t) => ({ transform: `scale(${(1 + 0.05 * forza * Math.exp(-6 * t) * Math.cos(10 * t)).toFixed(4)})` }), 20), { duration: 500 });
}

// Il pezzo di barra perso (o guadagnato), sopra la barra già al nuovo valore.
function fantasma(barra, cambio) {
  if (getComputedStyle(barra).position === "static") barra.style.position = "relative";
  const pezzo = document.createElement("i");
  const danno = cambio.tipo === "danno";
  pezzo.className = `pf-fantasma ${danno ? "pf-perso" : "pf-guadagnato"}`;
  pezzo.style.left = `${(Math.min(cambio.da, cambio.a) * 100).toFixed(2)}%`;
  pezzo.style.width = `${(Math.abs(cambio.da - cambio.a) * 100).toFixed(2)}%`;
  barra.append(pezzo);
  const animazione = danno
    // Resta chiaro un attimo, poi si consuma verso il nuovo valore.
    ? pezzo.animate([
      { transform: "scaleX(1)", opacity: 1 },
      { transform: "scaleX(1)", opacity: 1, offset: 0.34 },
      { transform: "scaleX(0)", opacity: 0.7 },
    ], { duration: 700, easing: "ease-in" })
    // Entra da sinistra come un'onda di luce, poi lascia la barra vera.
    : pezzo.animate([
      { transform: "scaleX(0)", opacity: 1 },
      { transform: "scaleX(1)", opacity: 1, offset: 0.45 },
      { transform: "scaleX(1)", opacity: 0 },
    ], { duration: 750, easing: "ease-out" });
  via(animazione, pezzo);
  return animazione;
}

// Il numero che schizza fuori dal bersaglio, ricade e rimbalza.
let giro = 0;
function numero(bersaglio, cambio) {
  const strato = stratoComune();
  const r = bersaglio.getBoundingClientRect();
  const danno = cambio.tipo === "danno";
  const el = document.createElement("span");
  el.className = `pf-numero ${danno ? "pf-numero-danno" : "pf-numero-cura"}`;
  el.textContent = `${danno ? "−" : "+"}${Math.abs(cambio.delta)}`;
  el.style.fontSize = `${(1.05 + 0.95 * cambio.forza).toFixed(2)}rem`;
  // Parte da tre quarti della larghezza (per le righe: verso i PF), a metà altezza.
  el.style.left = `${(r.left + r.width * (r.width > 120 ? 0.72 : 0.5)).toFixed(1)}px`;
  el.style.top = `${(r.top + r.height * 0.45).toFixed(1)}px`;
  strato.append(el);

  if (ridotto()) {
    via(el.animate([{ opacity: 1, transform: "translate(-50%, -120%)" }, { opacity: 1, offset: 0.7, transform: "translate(-50%, -120%)" }, { opacity: 0, transform: "translate(-50%, -120%)" }], { duration: 1100 }), el);
    return;
  }
  // Ogni numero prende una direzione un po' diversa, alternando i lati.
  const lato = giro++ % 2 ? -1 : 1;
  const semi = scintille(1, 31 + giro)[0];
  const volo = traiettoria({
    vx: lato * (40 + 60 * Math.abs(semi.vx) / 200),
    vy: -(210 + 150 * cambio.forza),
    suolo: Math.max(14, r.height * 0.5),
  });
  via(el.animate(fotogrammi(VITA_NUMERO, (t) => {
    const { x, y } = volo(t);
    const nascita = Math.min(1, t / 0.09);
    return {
      transform: `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(0.5 + 0.5 * nascita).toFixed(2)}) rotate(${(lato * 10 * Math.min(1, t / 0.5)).toFixed(1)}deg)`,
      opacity: Math.min(1, (VITA_NUMERO - t) / 0.3),
    };
  }, 42), { duration: VITA_NUMERO * 1000 }), el);
}

// Sui colpi forti qualche goccia schizza via con il numero.
function schizzi(bersaglio, cambio) {
  if (ridotto() || cambio.forza < 0.6) return;
  const strato = stratoComune();
  const r = bersaglio.getBoundingClientRect();
  const x = r.left + r.width * (r.width > 120 ? 0.72 : 0.5);
  const y = r.top + r.height * 0.45;
  for (const s of scintille(Math.round(4 + 8 * cambio.forza), 9, { velMin: 60, velMax: 230, spinta: 110 })) {
    const g = document.createElement("i");
    g.className = `pf-goccia ${cambio.tipo === "danno" ? "pf-goccia-danno" : "pf-goccia-cura"}`;
    Object.assign(g.style, { left: `${x}px`, top: `${y}px`, width: `${s.r * 0.8}px`, height: `${s.r * 0.8}px` });
    strato.append(g);
    via(g.animate(fotogrammi(s.vita, (t) => ({
      transform: `translate(-50%, -50%) translate(${(s.vx * t).toFixed(1)}px, ${(s.vy * t + (GRAVITA * 0.7 * t * t) / 2).toFixed(1)}px)`,
      opacity: 1 - t / s.vita,
    }), 14), { duration: s.vita * 1000 }), g);
  }
}

// La pedina (o il ritratto) che cade a 0 PF o si rialza: il sito la disegna
// già inclinata e in grigio; qui ci arriva con un tonfo.
function caduta(volto, cambio) {
  if (!volto || ridotto()) return null;
  if (cambio.aTerra) {
    return volto.animate([
      { transform: "rotate(0deg) scale(1)", filter: "grayscale(0) brightness(1)" },
      { transform: "rotate(-26deg) scale(0.94)", filter: "grayscale(0.7) brightness(0.75)", offset: 0.55 },
      { transform: "rotate(-15deg) scale(1)", offset: 0.78 },
      { transform: "rotate(-18deg) scale(1)", filter: "grayscale(1) brightness(0.6)" },
    ], { duration: 520, easing: "ease-in" });
  }
  if (cambio.inPiedi) {
    return volto.animate([
      { transform: "rotate(-18deg) scale(1)", filter: "grayscale(1) brightness(0.6)" },
      { transform: "rotate(4deg) scale(1.08)", filter: "grayscale(0) brightness(1.15)", offset: 0.6 },
      { transform: "rotate(0deg) scale(1)", filter: "grayscale(0) brightness(1)" },
    ], { duration: 560, easing: "ease-out" });
  }
  return null;
}

// Un registro dei PF per un posto della pagina (il party, il tracker, la
// mappa, la scheda): ognuno ricorda i suoi valori.
export function creaEffettiPf() {
  const noti = new Map();

  // chiave: chi è (uid, id del combattente, id della pedina).
  // pf: { attuali, massimi } oppure { quota } dove i PF veri non si conoscono.
  // elementi: { bersaglio, barra, volto } appena disegnati (barra e volto facoltativi).
  // numeri: false per non mostrare il valore (nemici visti dai giocatori).
  function aggiorna(chiave, pf, { bersaglio, barra = null, volto = null } = {}, { numeri = true } = {}) {
    const prima = noti.get(chiave);
    const ora = performance.now();
    const cambio = leggiCambio(prima?.pf, pf);
    // Senza un cambio nuovo resta in memoria l'ultimo, per poterlo riprendere.
    const voce = cambio
      ? { pf: { ...pf }, cambio, quando: ora, bersaglio }
      : { pf: { ...pf }, cambio: prima?.cambio ?? null, quando: prima?.quando ?? 0, bersaglio };
    noti.set(chiave, voce);
    // Un pannello chiuso o nascosto non ha misure: il numero partirebbe dall'angolo.
    if (!voce.cambio || !bersaglio?.isConnected || bersaglio.getClientRects().length === 0) return cambio;
    const trascorso = cambio ? 0 : ora - voce.quando;
    // Niente da riprendere se l'effetto è finito o sta già girando su questo stesso elemento.
    if (trascorso > RIPRESA || (!cambio && prima?.bersaglio === bersaglio)) return cambio;

    // Gli effetti sugli elementi appena disegnati, dal punto in cui erano.
    const danno = voce.cambio.tipo === "danno";
    const animazioni = [
      lampo(bersaglio, danno ? "pf-lampo-danno" : "pf-lampo-cura", voce.cambio.forza),
      ridotto() ? null : (danno ? scossa : sollievo)(bersaglio, voce.cambio.forza),
      barra ? fantasma(barra, voce.cambio) : null,
      caduta(volto, voce.cambio),
    ];
    if (trascorso > 0) for (const a of animazioni) if (a) a.currentTime = trascorso;
    // Numero e schizzi volano in uno strato a parte: partono una volta sola.
    if (cambio && numeri && cambio.delta != null && inVista(bersaglio)) {
      numero(bersaglio, cambio);
      schizzi(bersaglio, cambio);
    }
    return cambio;
  }

  return { aggiorna, dimentica: (chiave) => noti.delete(chiave) };
}
