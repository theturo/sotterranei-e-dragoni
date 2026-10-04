// Dado vita in 3D vero per il tiro dei PF nel passaggio di livello (tavola
// "Tiro dei PF — versione JS" della tela): un ottaedro ruotato con i
// quaternioni, con la stessa tecnica del dado di caricamento. Un solo lancio:
// rotola, rallenta e si ferma con il risultato sulla faccia verso chi guarda.
// Il dado vita della classe può avere 6, 8, 10 o 12 facce: la forma resta
// l'ottaedro, i numeri sulle facce sono quelli possibili per quel dado e la
// faccia frontale mostra sempre il risultato.
// Con "riduci animazioni" il dado compare già fermo.
import { v, q, slerp } from "./geometria-3d.js";
import { suona } from "./suoni.js";

const SVG = "http://www.w3.org/2000/svg";
const CENTRO = 50;
const SCALA = 34;
const TUMBLE = 1900;
const SETTLE = 500;

// ---------- Geometria dell'ottaedro ----------
export const VERTICI = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
export const FACCE = [];
{
  const lato = Math.min(...VERTICI.slice(1).map((p) => v.len(v.sub(VERTICI[0], p))));
  const adiacenti = (a, b) => Math.abs(v.len(v.sub(VERTICI[a], VERTICI[b])) - lato) < 1e-6;
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) for (let k = j + 1; k < 6; k++) {
    if (!adiacenti(i, j) || !adiacenti(j, k) || !adiacenti(i, k)) continue;
    const n = v.cross(v.sub(VERTICI[j], VERTICI[i]), v.sub(VERTICI[k], VERTICI[i]));
    const esterna = v.dot(n, v.add(v.add(VERTICI[i], VERTICI[j]), VERTICI[k])) > 0;
    FACCE.push(esterna ? [i, j, k] : [i, k, j]);
  }
}
export const normale = (f) => v.norm(v.cross(v.sub(VERTICI[f[1]], VERTICI[f[0]]), v.sub(VERTICI[f[2]], VERTICI[f[0]])));
const NORMALI = FACCE.map(normale);
const LUCE = v.norm([-0.4, 0.5, 1]);

// Numeri di un d8 vero: le facce opposte sommano 9.
const NUMERI_D8 = new Array(8).fill(0);
{
  const libere = new Set(FACCE.map((_, i) => i));
  for (const [alto, basso] of [[8, 1], [7, 2], [6, 3], [5, 4]]) {
    const a = [...libere][0];
    const b = [...libere].find((i) => i !== a && v.dot(NORMALI[i], NORMALI[a]) < -0.999);
    NUMERI_D8[a] = alto;
    NUMERI_D8[b] = basso;
    libere.delete(a);
    libere.delete(b);
  }
}

// Numeri sulle facce per un dado da `facce` facce che mostra `risultato`:
// { numeri, finale } con finale = la faccia che va verso chi guarda.
export function numeriDelDado(facce, risultato) {
  if (facce === 8) return { numeri: [...NUMERI_D8], finale: NUMERI_D8.indexOf(risultato) };
  const finale = NUMERI_D8.indexOf(6);
  const altri = Array.from({ length: facce }, (_, i) => i + 1).filter((n) => n !== risultato);
  let k = 0;
  const numeri = FACCE.map((_, i) => (i === finale ? risultato : altri[k++ % altri.length]));
  return { numeri, finale };
}

// Posa finale: la faccia scelta verso chi guarda (+z), con un vertice in alto.
export function posaFinale(faccia) {
  let finale = q.da(NORMALI[faccia], [0, 0, 1]);
  const vertici = FACCE[faccia].map((k) => q.ruota(finale, VERTICI[k]));
  const apice = vertici.reduce((a, b) => (b[1] > a[1] ? b : a));
  finale = q.mul(q.asse([0, 0, 1], Math.PI / 2 - Math.atan2(apice[1], apice[0])), finale);
  return finale;
}

function crea(nome, attributi = {}) {
  const el = document.createElementNS(SVG, nome);
  for (const [k, valore] of Object.entries(attributi)) el.setAttribute(k, valore);
  return el;
}

// Disegna il dado in `palco` e lo lancia. Restituisce una promessa che si
// risolve quando il dado è fermo sul risultato.
export function lanciaDadoPF(palco, { facce = 8, risultato }) {
  const { numeri, finale } = numeriDelDado(facce, risultato);
  const Q_FINALE = posaFinale(finale);
  const svg = crea("svg", { class: "dado-pf", viewBox: "0 0 100 100", "aria-hidden": "true" });
  const poligoni = FACCE.map(() => svg.appendChild(crea("polygon", { stroke: "#150d08", "stroke-width": "0.6" })));
  const testi = FACCE.map((_, i) => {
    const t = svg.appendChild(crea("text", {
      "text-anchor": "middle", "dominant-baseline": "middle", "font-family": "Georgia, serif",
      "font-weight": "700", "font-size": "9", fill: "#150d08",
    }));
    t.textContent = String(numeri[i]);
    return t;
  });
  palco.replaceChildren(svg);

  function disegna(rot) {
    // Facce rivolte verso chi guarda, dalla più lontana alla più vicina.
    const visibili = FACCE.map((f, i) => {
      const punti = f.map((k) => q.ruota(rot, VERTICI[k]));
      const centro = v.mul(punti.reduce(v.add), 1 / 3);
      return { i, punti, centro, n: q.ruota(rot, NORMALI[i]) };
    }).filter((fc) => fc.n[2] > 0.05).sort((a, b) => a.centro[2] - b.centro[2]);
    poligoni.forEach((el) => el.setAttribute("visibility", "hidden"));
    testi.forEach((el) => el.setAttribute("visibility", "hidden"));
    for (const fc of visibili) {
      const xs = fc.punti.map((p) => CENTRO + p[0] * SCALA);
      const ys = fc.punti.map((p) => CENTRO - p[1] * SCALA);
      const el = poligoni[fc.i];
      el.setAttribute("points", xs.map((x, k) => `${x.toFixed(1)},${ys[k].toFixed(1)}`).join(" "));
      const lum = Math.max(0.3, v.dot(fc.n, LUCE));
      el.setAttribute("fill", `rgb(${Math.round(60 + 160 * lum)},${Math.round(40 + 120 * lum)},${Math.round(10 + 50 * lum)})`);
      el.setAttribute("visibility", "visible");
      svg.appendChild(el);
      // Il numero solo sulle facce quasi frontali, al centro del riquadro della
      // faccia proiettata (il baricentro lo farebbe sembrare troppo in basso).
      if (fc.n[2] > 0.4) {
        const t = testi[fc.i];
        t.setAttribute("x", ((Math.min(...xs) + Math.max(...xs)) / 2).toFixed(1));
        t.setAttribute("y", ((Math.min(...ys) + Math.max(...ys)) / 2 + 1).toFixed(1));
        t.setAttribute("visibility", "visible");
        svg.appendChild(t);
      }
    }
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    disegna(Q_FINALE);
    return Promise.resolve();
  }
  // Il suono del dado dura quanto il lancio (rotolata + assestamento).
  suona("dado", (TUMBLE + SETTLE) / 1000);

  return new Promise((fatto) => {
    const asse = v.norm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]);
    const inizio = performance.now();
    let partenza = null;
    let inizioSettle = 0;
    const passo = (ora) => {
      if (!palco.isConnected) return fatto();
      if (!partenza) {
        const rot = q.mul(q.asse(asse, ((ora - inizio) / 1000) * 6.5), [1, 0, 0, 0]);
        disegna(rot);
        if (ora - inizio > TUMBLE) {
          partenza = rot;
          inizioSettle = ora;
        }
      } else {
        const u = Math.min(1, (ora - inizioSettle) / SETTLE);
        disegna(slerp(partenza, Q_FINALE, u * u * (3 - 2 * u)));
        if (u >= 1) return fatto();
      }
      requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  });
}
