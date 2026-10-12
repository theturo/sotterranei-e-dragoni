// Dado di caricamento in 3D vero (tavola "Dado di caricamento — versione JS"
// della tela): un icosaedro ruotato con i quaternioni, con la stessa geometria
// dell'intro (intro-dado.js). Gira liberamente, rallenta, si ferma sempre sul
// 20, fa una pausa e ricomincia con un asse nuovo. Sostituisce nel velo di
// caricamento (#veil .die-stage) il dado disegnato in CSS.
// - Anima solo finché il velo è visibile: quando la pagina lo nasconde il
//   ciclo si ferma (e riparte se il velo ricompare).
// - Con "riduci animazioni" il dado resta fermo sul 20.
import { VERTICI, FACCE, NUMERI, FACCIA_20, normale } from "./intro-dado.js";
import { v, q, slerp, facceVisibili, coloreFaccia } from "./geometria-3d.js";

const SVG = "http://www.w3.org/2000/svg";
const CENTRO = 60;
const SCALA = 46;
const TUMBLE = 1700;
const SETTLE = 550;
const PAUSA = 1050;

// Posa finale: il 20 verso chi guarda (+z) e il contorno a punta in su.
const Q_FINALE = (() => {
  let finale = q.da(normale(FACCE[FACCIA_20]), [0, 0, 1]);
  const anello = VERTICI.map((p) => q.ruota(finale, p)).filter((p) => Math.abs(p[2]) < 0.5);
  const primo = anello.reduce((a, b) => (Math.hypot(b[0], b[1]) > Math.hypot(a[0], a[1]) ? b : a));
  finale = q.mul(q.asse([0, 0, 1], Math.PI / 2 - Math.atan2(primo[1], primo[0])), finale);
  return finale;
})();

const NORMALI = FACCE.map(normale);
const asseCasuale = () => v.norm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]);

function crea(nome, attributi = {}) {
  const el = document.createElementNS(SVG, nome);
  for (const [k, valore] of Object.entries(attributi)) el.setAttribute(k, valore);
  return el;
}

export function montaDadoCaricamento(palco) {
  const svg = crea("svg", { class: "palco-dado", viewBox: "0 0 120 120", "aria-hidden": "true" });
  const facce = FACCE.map(() => svg.appendChild(crea("polygon", { stroke: "#150d08", "stroke-width": "0.5" })));
  const numeri = FACCE.map((_, i) => {
    const t = svg.appendChild(crea("text", {
      "text-anchor": "middle", "dominant-baseline": "middle", "font-family": "Cinzel, serif",
      "font-weight": "700", "font-size": "9", fill: "#150d08",
    }));
    t.textContent = String(NUMERI[i]);
    return t;
  });
  palco.replaceChildren(svg);
  palco.classList.add("dado-js");

  function disegna(rot) {
    const visibili = facceVisibili(rot, FACCE, VERTICI, NORMALI);
    facce.forEach((el) => el.setAttribute("visibility", "hidden"));
    numeri.forEach((el) => el.setAttribute("visibility", "hidden"));
    for (const fc of visibili) {
      const el = facce[fc.i];
      el.setAttribute("points", fc.punti.map((p) => `${(CENTRO + p[0] * SCALA).toFixed(1)},${(CENTRO - p[1] * SCALA).toFixed(1)}`).join(" "));
      el.setAttribute("fill", coloreFaccia(fc.n));
      el.setAttribute("visibility", "visible");
      svg.appendChild(el);
      // Il numero solo sulle facce quasi frontali (non segue l'inclinazione).
      if (fc.n[2] > 0.5) {
        const t = numeri[fc.i];
        t.setAttribute("x", (CENTRO + fc.centro[0] * SCALA * 0.98).toFixed(1));
        t.setAttribute("y", (CENTRO - fc.centro[1] * SCALA * 0.98 + 2).toFixed(1));
        t.setAttribute("visibility", "visible");
        svg.appendChild(t);
      }
    }
  }

  const fermo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  disegna(Q_FINALE);
  if (fermo) return;

  const velo = palco.closest("#veil") || palco;
  const visibile = () => velo.isConnected && velo.style.display !== "none" && !velo.hidden;
  let fase = "tumble";
  let q0 = Q_FINALE;
  let asse = asseCasuale();
  let inizio = performance.now();
  let partenza = null;
  let animazione = null;

  function passo(ora) {
    if (!visibile()) {
      animazione = null;
      return;
    }
    let rot;
    if (fase === "tumble") {
      rot = q.mul(q.asse(asse, ((ora - inizio) / 1000) * 5.2), q0);
      if (ora - inizio > TUMBLE) {
        fase = "settle";
        partenza = rot;
        inizio = ora;
      }
    } else if (fase === "settle") {
      const u = Math.min(1, (ora - inizio) / SETTLE);
      rot = slerp(partenza, Q_FINALE, u * u * (3 - 2 * u));
      if (u >= 1) {
        fase = "pausa";
        inizio = ora;
      }
    } else {
      rot = Q_FINALE;
      if (ora - inizio > PAUSA) {
        fase = "tumble";
        q0 = Q_FINALE;
        asse = asseCasuale();
        inizio = ora;
      }
    }
    disegna(rot);
    animazione = requestAnimationFrame(passo);
  }

  const avvia = () => {
    if (animazione || !visibile()) return;
    fase = "tumble";
    q0 = Q_FINALE;
    inizio = performance.now();
    animazione = requestAnimationFrame(passo);
  };
  avvia();
  // Se la pagina mostra di nuovo il velo, il dado riparte.
  new MutationObserver(avvia).observe(velo, { attributes: true, attributeFilter: ["style", "hidden"] });
}
