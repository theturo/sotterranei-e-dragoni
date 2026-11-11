// Disegna la vaschetta e i dadi su una tela (canvas), in un colpo solo per
// fotogramma: con molti dadi è molto più leggero di un elemento per faccia e
// per numero.
// - La vaschetta è un oggetto: fondo rivestito (materiale a scelta), pareti e
//   cornice di legno. I dadi ci stanno dentro, con l'ombra sul fondo.
// - Vista senza prospettiva, dall'alto o di tre quarti: così il fondo resta un
//   rettangolo e i numeri si adagiano sulle facce con una trasformazione affine.
// - I numeri si dipingono una volta sola (una piccola immagine per cifra) e
//   poi si incollano sulle facce.
// Mondo: 1 = raggio del dado, z verso l'alto, fondo a z = 0 (come fisica-dadi.js).
import { v, q } from "./geometria-3d.js";
import { casuale } from "./movimento.js";
import { lineeCrepe } from "./effetti-dadi.js";
import { MATERIALI, VISTE } from "./vaschetta-scelte.js";

const PARETE = 0.9;    // altezza delle pareti
const BORDO = 0.25;    // spessore della cornice
const BASE = 0.1;      // quanto la vaschetta scende sotto il fondo, davanti
const MARGINE = 2;     // pixel liberi attorno alla vaschetta
// La grandezza dei dadi a schermo si decide su una tela larga al massimo così:
// oltre, i dadi restano uguali e la vaschetta si allarga.
const RIFERIMENTO = 560;
const LUCE = v.norm([-0.35, -0.45, 0.82]);
const CORPO = 72;      // corpo dei numeri dipinti, in pixel

// Quanti raggi di dado stanno nella larghezza di riferimento: più dadi, dadi
// più piccoli a schermo.
export const larghezzaPer = (quanti) => (quanti <= 2 ? 8 : quanti <= 4 ? 10 : quanti <= 8 ? 13 : quanti <= 12 ? 16 : quanti <= 20 ? 19 : 24);

// Involucro convesso di punti 2D (catena monotona).
function involucro(punti) {
  const p = [...punti].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const giro = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const meta = (lista) => {
    const h = [];
    for (const x of lista) {
      while (h.length >= 2 && giro(h[h.length - 2], h[h.length - 1], x) <= 0) h.pop();
      h.push(x);
    }
    h.pop();
    return h;
  };
  return [...meta(p), ...meta(p.reverse())];
}

// Una mattonella con la grana del materiale, da ripetere sul fondo.
function mattonella(grana) {
  const lato = 160;
  const tela = document.createElement("canvas");
  tela.width = tela.height = lato;
  const x = tela.getContext("2d");
  const rnd = casuale(grana.length * 7 + 3);
  if (grana === "feltro") {
    for (let i = 0; i < 3200; i++) {
      x.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.09)";
      x.fillRect(rnd() * lato, rnd() * lato, 1 + rnd(), 1 + rnd());
    }
  } else if (grana === "cuoio") {
    for (let i = 0; i < 110; i++) {
      const cx = rnd() * lato;
      const cy = rnd() * lato;
      const r = 6 + rnd() * 18;
      const sfuma = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      sfuma.addColorStop(0, rnd() < 0.5 ? "rgba(0,0,0,0.10)" : "rgba(255,225,180,0.06)");
      sfuma.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = sfuma;
      x.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    for (let i = 0; i < 700; i++) {
      x.fillStyle = "rgba(0,0,0,0.12)";
      x.fillRect(rnd() * lato, rnd() * lato, 1, 1);
    }
  } else {
    // Legno: venature orizzontali appena ondulate (l'onda si richiude sul bordo).
    for (let i = 0; i < 80; i++) {
      const y0 = rnd() * lato;
      const ampiezza = 0.6 + rnd() * 2.2;
      const onde = 1 + Math.floor(rnd() * 2);
      const fase = rnd() * 6.28;
      x.strokeStyle = rnd() < 0.7 ? `rgba(40,20,5,${(0.05 + rnd() * 0.13).toFixed(3)})` : `rgba(255,220,170,${(0.03 + rnd() * 0.06).toFixed(3)})`;
      x.lineWidth = 0.5 + rnd() * 1.6;
      x.beginPath();
      for (let px = 0; px <= lato; px += 8) {
        const py = y0 + Math.sin((px / lato) * Math.PI * 2 * onde + fase) * ampiezza;
        if (px === 0) x.moveTo(px, py);
        else x.lineTo(px, py);
      }
      x.stroke();
    }
  }
  return tela;
}

export function creaScena(tela) {
  const ctx = tela.getContext("2d");
  const motivi = new Map();
  const glifi = new Map();
  const etichettePerFaccia = new WeakMap();
  const crepe = lineeCrepe();
  let m = null;

  // I numeri vanno dipinti con il Cinzel: si aspetta che sia caricato.
  const pronta = document.fonts?.load ? document.fonts.load(`700 ${CORPO}px Cinzel`).catch(() => {}) : Promise.resolve();

  // Misure della vaschetta e della vista per `quanti` dadi in una tela di
  // larghezza × altezza (pixel CSS). Restituisce anche W e D per la fisica.
  // `sopra`: pixel di tela in più sopra la vaschetta, dove si disegnano i dadi
  // che rimbalzano più in alto del bordo (la vaschetta resta a filo in alto).
  function prepara({ quanti, vista, larghezza, altezza, sopra = 0 }) {
    const angolo = (VISTE[vista] ?? VISTE["tre-quarti"]).angolo;
    const sin = Math.sin(angolo);
    const cos = Math.max(0, Math.cos(angolo));
    // La vaschetta occupa tutta la tela, da un lato all'altro e dall'alto in
    // basso: la scala (pixel per raggio di dado) fissa la grandezza dei dadi,
    // larghezza e profondità interne si prendono lo spazio che resta.
    let s = Math.min(larghezza, RIFERIMENTO) / (larghezzaPer(quanti) + 1.5);
    const utileX = larghezza - 2 * MARGINE;
    const utileY = altezza - 2 * MARGINE;
    const spessore = (PARETE + BASE) * cos;
    let D = (utileY / s - spessore) / sin - 2 * BORDO;
    if (D < 5) {
      D = 5;
      s = utileY / ((D + 2 * BORDO) * sin + spessore);
    }
    const W = utileX / s - 2 * BORDO;
    const su = (D / 2 + BORDO) * sin + PARETE * cos;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    tela.width = Math.round(larghezza * dpr);
    tela.height = Math.round((altezza + sopra) * dpr);
    tela.style.width = `${larghezza}px`;
    tela.style.height = `${altezza + sopra}px`;
    m = { W, D, s, sin, cos, dpr, larghezza, altezza: altezza + sopra, sopra, cx: larghezza / 2, cy: sopra + MARGINE + s * su, verso: [0, -cos, sin] };
    return m;
  }

  const proietta = (p) => [m.cx + m.s * p[0], m.cy - m.s * (p[1] * m.sin + p[2] * m.cos)];

  function traccia(punti3d) {
    ctx.beginPath();
    punti3d.forEach((p, i) => {
      const [x, y] = proietta(p);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.closePath();
  }

  function motivo(grana) {
    if (!motivi.has(grana)) motivi.set(grana, ctx.createPattern(mattonella(grana), "repeat"));
    return motivi.get(grana);
  }

  function legno(chiaro, scuro, daY, aY) {
    const sfuma = ctx.createLinearGradient(0, daY, 0, aY);
    sfuma.addColorStop(0, chiaro);
    sfuma.addColorStop(1, scuro);
    ctx.fillStyle = sfuma;
    ctx.fill("evenodd");
    ctx.save();
    ctx.clip("evenodd");
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = motivo("legno");
    ctx.fillRect(0, 0, m.larghezza, m.altezza);
    ctx.restore();
  }

  // Fondo rivestito, parete di fondo e cornice: tutto ciò che sta dietro ai dadi.
  function vaschetta(materiale) {
    const mat = MATERIALI[materiale] ?? MATERIALI["feltro-notte"];
    const a = m.W / 2;
    const b = m.D / 2;
    const A = a + BORDO;
    const B = b + BORDO;
    const fondo = [[-a, -b, 0], [a, -b, 0], [a, b, 0], [-a, b, 0]];

    traccia(fondo);
    ctx.fillStyle = mat.colore;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = motivo(mat.grana);
    ctx.fillRect(0, 0, m.larghezza, m.altezza);
    // Più luce al centro, più ombra verso le pareti.
    const [x0, y0] = proietta([0, 0, 0]);
    const luce = ctx.createRadialGradient(x0, y0, m.s * Math.min(m.W, m.D) * 0.12, x0, y0, m.s * Math.max(m.W, m.D) * 0.72);
    luce.addColorStop(0, "rgba(255,255,255,0.08)");
    luce.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = luce;
    ctx.fillRect(0, 0, m.larghezza, m.altezza);
    // L'ombra che ogni parete lascia sul fondo.
    const ombraParete = (da, verso) => {
      const [x1, y1] = proietta(da);
      const [x2, y2] = proietta(verso);
      const sfuma = ctx.createLinearGradient(x1, y1, x2, y2);
      sfuma.addColorStop(0, "rgba(0,0,0,0.42)");
      sfuma.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sfuma;
      ctx.fillRect(0, 0, m.larghezza, m.altezza);
    };
    ombraParete([0, b, 0], [0, b - 1.3, 0]);
    ombraParete([0, -b, 0], [0, -b + 1.1, 0]);
    ombraParete([-a, 0, 0], [-a + 1.1, 0, 0]);
    ombraParete([a, 0, 0], [a - 1.1, 0, 0]);
    if (mat.cucitura) {
      const r = 0.42;
      traccia([[-a + r, -b + r, 0], [a - r, -b + r, 0], [a - r, b - r, 0], [-a + r, b - r, 0]]);
      ctx.setLineDash([m.s * 0.2, m.s * 0.15]);
      ctx.strokeStyle = "rgba(237,187,118,0.55)";
      ctx.lineWidth = Math.max(1, m.s * 0.035);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();

    // Parete di fondo, rivestita come il fondo ma in ombra (dall'alto non si vede).
    if (m.cos > 0.02) {
      traccia([[-a, b, 0], [a, b, 0], [a, b, PARETE], [-a, b, PARETE]]);
      ctx.fillStyle = mat.colore;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = motivo(mat.grana);
      ctx.fillRect(0, 0, m.larghezza, m.altezza);
      const [, yBasso] = proietta([0, b, 0]);
      const [, yAlto] = proietta([0, b, PARETE]);
      const sfuma = ctx.createLinearGradient(0, yAlto, 0, yBasso);
      sfuma.addColorStop(0, "rgba(0,0,0,0.3)");
      sfuma.addColorStop(1, "rgba(0,0,0,0.6)");
      ctx.fillStyle = sfuma;
      ctx.fillRect(0, 0, m.larghezza, m.altezza);
      ctx.restore();
    }

    // Cornice di legno, tutta attorno, all'altezza delle pareti.
    ctx.beginPath();
    for (const giro of [[[-A, -B], [A, -B], [A, B], [-A, B]], [[-a, -b], [a, -b], [a, b], [-a, b]]]) {
      giro.forEach(([x, y], i) => {
        const [px, py] = proietta([x, y, PARETE]);
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      });
      ctx.closePath();
    }
    legno("#6b4a2d", "#4a311c", proietta([0, B, PARETE])[1], proietta([0, -B, PARETE])[1]);
    traccia([[-a, -b, PARETE], [a, -b, PARETE], [a, b, PARETE], [-a, b, PARETE]]);
    ctx.strokeStyle = "rgba(237,187,118,0.55)";
    ctx.lineWidth = Math.max(1, m.s * 0.03);
    ctx.stroke();
  }

  // La parete vicina: copre i dadi che le stanno dietro, quindi si disegna dopo.
  function pareteVicina() {
    const a = m.W / 2;
    const b = m.D / 2;
    const A = a + BORDO;
    const B = b + BORDO;
    traccia([[-A, -B, PARETE], [A, -B, PARETE], [A, -b, PARETE], [-A, -b, PARETE]]);
    legno("#6b4a2d", "#553a22", proietta([0, -b, PARETE])[1], proietta([0, -B, PARETE])[1]);
    if (m.cos > 0.02) {
      traccia([[-A, -B, PARETE], [A, -B, PARETE], [A, -B, -BASE], [-A, -B, -BASE]]);
      legno("#42291a", "#22140a", proietta([0, -B, PARETE])[1], proietta([0, -B, -BASE])[1]);
    }
    const [x1, y1] = proietta([-a, -b, PARETE]);
    const [x2, y2] = proietta([a, -b, PARETE]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = "rgba(237,187,118,0.55)";
    ctx.lineWidth = Math.max(1, m.s * 0.03);
    ctx.stroke();
  }

  // Un numero dipinto una volta sola: oro con il contorno scuro.
  function glifo(testo) {
    let g = glifi.get(testo);
    if (g) return g;
    const carattere = `700 ${CORPO}px Cinzel, Georgia, serif`;
    const tavola = document.createElement("canvas");
    let x = tavola.getContext("2d");
    x.font = carattere;
    tavola.width = Math.ceil(x.measureText(testo).width) + 24;
    tavola.height = Math.ceil(CORPO * 1.3);
    x = tavola.getContext("2d");
    x.font = carattere;
    x.textAlign = "center";
    x.lineJoin = "round";
    x.lineWidth = 7;
    x.strokeStyle = "#4a120d";
    x.fillStyle = "#f8d58a";
    // Le cifre maiuscole del Cinzel sono alte circa 0,7 del corpo: centrate.
    const base = tavola.height / 2 + CORPO * 0.35;
    x.strokeText(testo, tavola.width / 2, base);
    x.fillText(testo, tavola.width / 2, base);
    g = { tavola, maiuscola: CORPO * 0.7 };
    glifi.set(testo, g);
    return g;
  }

  function etichetteDi(solido) {
    if (!etichettePerFaccia.has(solido)) {
      etichettePerFaccia.set(solido, solido.facce.map((_, i) => solido.etichette.filter((e) => e.faccia === i)));
    }
    return etichettePerFaccia.get(solido);
  }

  // I vertici del dado nel mondo.
  const verticiDi = (d) => d.solido.vertici.map((b) => v.add(d.p, v.mul(q.ruota(d.rot, b), d.scala ?? 1)));

  function ombra(d, punti) {
    const aTerra = involucro(punti.map((p) => proietta([p[0] + 0.22 * p[2], p[1] + 0.3 * p[2], 0])));
    const cx = aTerra.reduce((s, p) => s + p[0], 0) / aTerra.length;
    const cy = aTerra.reduce((s, p) => s + p[1], 0) / aTerra.length;
    // Più il dado è in alto, più l'ombra è chiara.
    const forza = Math.max(0.25, 1 - Math.max(0, d.p[2] - 1) * 0.16);
    for (const [gonfia, alfa] of [[1.14, 0.13], [1, 0.26]]) {
      ctx.beginPath();
      aTerra.forEach(([x, y], i) => {
        const px = cx + (x - cx) * gonfia;
        const py = cy + (y - cy) * gonfia;
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      });
      ctx.closePath();
      ctx.fillStyle = `rgba(0,0,0,${(alfa * forza).toFixed(3)})`;
      ctx.fill();
    }
  }

  function colore(n, d) {
    let l = (0.2 + 0.8 * Math.max(0, v.dot(n, LUCE))) * (1 - 0.6 * (d.buio ?? 0));
    let r = 58 + 142 * l;
    let g = 10 + 44 * l;
    let b = 14 + 30 * l;
    const spento = 0.72 * (d.spento ?? 0);
    if (spento) {
      const grigio = 46 + 40 * l;
      r += (grigio - r) * spento;
      g += (grigio - g) * spento;
      b += (grigio + 6 - b) * spento;
    }
    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  }

  function dado(d, punti) {
    const { solido } = d;
    const scala = d.scala ?? 1;
    const aSchermo = punti.map(proietta);
    const sagoma = involucro(aSchermo);
    const percorsoSagoma = () => {
      ctx.beginPath();
      sagoma.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
    };
    const opaco = 1 - 0.45 * (d.spento ?? 0);

    // Alone d'oro attorno al dado tenuto o al 20 naturale.
    if (d.bagliore > 0) {
      ctx.save();
      percorsoSagoma();
      ctx.shadowColor = `rgba(255,214,128,${(0.95 * d.bagliore).toFixed(3)})`;
      ctx.shadowBlur = 20 * m.dpr;
      ctx.fillStyle = `rgba(237,187,118,${(0.6 * d.bagliore).toFixed(3)})`;
      ctx.fill();
      ctx.restore();
    }

    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, 0.055 * m.s * scala);
    const perFaccia = etichetteDi(solido);
    solido.facce.forEach((f, i) => {
      const n = q.ruota(d.rot, solido.normali[i]);
      const vista = v.dot(n, m.verso);
      if (vista <= 0.012) return;
      ctx.globalAlpha = opaco;
      ctx.beginPath();
      f.forEach((k, j) => (j ? ctx.lineTo(aSchermo[k][0], aSchermo[k][1]) : ctx.moveTo(aSchermo[k][0], aSchermo[k][1])));
      ctx.closePath();
      ctx.fillStyle = colore(n, d);
      ctx.fill();
      ctx.strokeStyle = d.spento ? `rgb(${Math.round(227 - 90 * d.spento)},${Math.round(169 - 50 * d.spento)},${Math.round(85 + 20 * d.spento)})` : "#e3a955";
      ctx.stroke();
      // I numeri, adagiati sulla faccia; sbiadiscono su quelle viste di taglio.
      const nitido = Math.min(1, Math.max(0, (vista - 0.05) / 0.28));
      if (nitido <= 0) return;
      for (const e of perFaccia[i]) {
        const g = glifo(e.testo);
        const k = (e.alt * scala * m.s) / g.maiuscola;
        const destra = q.ruota(d.rot, e.destra);
        const su = q.ruota(d.rot, e.su);
        const [ox, oy] = proietta(v.add(d.p, v.mul(q.ruota(d.rot, e.pos), scala)));
        ctx.save();
        ctx.globalAlpha = opaco * nitido * (1 - 0.35 * (d.buio ?? 0));
        ctx.transform(k * destra[0], -k * (destra[1] * m.sin + destra[2] * m.cos), -k * su[0], k * (su[1] * m.sin + su[2] * m.cos), ox, oy);
        ctx.drawImage(g.tavola, -g.tavola.width / 2, -g.tavola.height / 2);
        ctx.restore();
      }
    });
    ctx.globalAlpha = 1;

    // Crepe dell'1 naturale: si aprono attorno al numero, ritagliate sul dado.
    if (d.crepe > 0 && d.centroCrepe) {
      const [ox, oy] = proietta(d.centroCrepe);
      const passo = m.s * scala;
      ctx.save();
      percorsoSagoma();
      ctx.clip();
      ctx.lineCap = "round";
      for (const [colore2, spessore] of [["#120404", 0.075], ["rgba(255,154,77,0.85)", 0.02]]) {
        ctx.strokeStyle = colore2;
        ctx.lineWidth = Math.max(1, spessore * passo);
        for (const punti2 of crepe) {
          const fin = d.crepe * (punti2.length - 1);
          ctx.beginPath();
          punti2.forEach(([x, y], i) => {
            if (i > Math.ceil(fin)) return;
            let px = x;
            let py = y;
            if (i > fin) {
              const [xa, ya] = punti2[i - 1];
              const k = fin - (i - 1);
              px = xa + (x - xa) * k;
              py = ya + (y - ya) * k;
            }
            const sx = ox + px * passo;
            const sy = oy + py * passo * m.sin;
            if (i) ctx.lineTo(sx, sy);
            else ctx.moveTo(sx, sy);
          });
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  // Disegna tutto. dadi: [{ solido, p, rot, scala, spento, bagliore, buio, crepe, centroCrepe }]
  function disegna(dadi, materiale) {
    if (!m) return;
    ctx.setTransform(m.dpr, 0, 0, m.dpr, 0, 0);
    ctx.clearRect(0, 0, m.larghezza, m.altezza);
    vaschetta(materiale);
    const conPunti = dadi.map((d) => ({ d, punti: verticiDi(d) }));
    // Le ombre cadono solo sul fondo.
    ctx.save();
    traccia([[-m.W / 2, -m.D / 2, 0], [m.W / 2, -m.D / 2, 0], [m.W / 2, m.D / 2, 0], [-m.W / 2, m.D / 2, 0]]);
    ctx.clip();
    for (const { d, punti } of conPunti) ombra(d, punti);
    ctx.restore();
    // Dal più lontano al più vicino; chi è più in alto della parete vicina le passa davanti.
    conPunti.sort((x, y) => v.dot(x.d.p, m.verso) - v.dot(y.d.p, m.verso));
    const sopra = [];
    for (const voce of conPunti) {
      if (Math.min(...voce.punti.map((p) => p[2])) > PARETE) sopra.push(voce);
      else dado(voce.d, voce.punti);
    }
    pareteVicina();
    for (const voce of sopra) dado(voce.d, voce.punti);
  }

  return { pronta, prepara, disegna, proietta: (p) => proietta(p), misure: () => m };
}
