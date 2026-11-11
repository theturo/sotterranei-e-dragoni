// Effetti scenici del d20 nella vaschetta: il 20 naturale (lampo d'oro,
// anello, scintille) e l'1 naturale (schegge dipinte che saltano via, scossa
// della vaschetta). Tutto con la Web Animations API, come il cambio turno; gli
// elementi si tolgono da soli a effetto finito. L'alone, le crepe e il
// sussulto del dado li disegna scena-dadi.js sulla tela.
import { fotogrammi, scintille, casuale } from "./movimento.js";
import { PEZZI } from "./intro-pezzi.js";

const MORBIDA = "cubic-bezier(0.33, 1, 0.68, 1)";

// Le schegge senza numero tra quelle dipinte per l'intro (stessa immagine,
// assets/img/intro/schegge.webp): [x, y, larghezza, altezza] nell'immagine.
const SCHEGGE = [1, 2, 7, 12].map((i) => PEZZI.schegge.pezzi[i].r);

function div(classe, stile = {}) {
  const d = document.createElement("div");
  d.className = classe;
  Object.assign(d.style, stile);
  return d;
}

const via = (animazione, nodo) => animazione.finished.then(() => nodo.remove()).catch(() => nodo.remove());

// ---------- 20 naturale ----------
// strato: livello degli effetti sopra la tela; x, y: centro del dado; raggio in pixel.
export function lampoVenti({ strato, x, y, raggio }) {
  const centro = { left: `${x}px`, top: `${y}px` };
  const lato = { width: `${raggio * 2}px`, height: `${raggio * 2}px` };

  const alone = div("dadi-alone", { ...centro, ...lato });
  strato.append(alone);
  via(alone.animate([
    { transform: "translate(-50%, -50%) scale(0.4)", opacity: 0.95 },
    { transform: "translate(-50%, -50%) scale(2.7)", opacity: 0 },
  ], { duration: 750, easing: MORBIDA }), alone);

  const anello = div("dadi-anello", { ...centro, ...lato });
  strato.append(anello);
  via(anello.animate([
    { transform: "translate(-50%, -50%) scale(0.7)", opacity: 1 },
    { transform: "translate(-50%, -50%) scale(2.2)", opacity: 0 },
  ], { duration: 650, easing: MORBIDA }), anello);

  for (const s of scintille(28, 20, { velMin: 90, velMax: 270, spinta: 80 })) {
    const sc = div("dadi-scintilla", { ...centro, width: `${s.r}px`, height: `${s.r}px` });
    strato.append(sc);
    via(sc.animate(fotogrammi(s.vita, (t) => {
      const vivo = 1 - t / s.vita;
      return {
        transform: `translate(-50%, -50%) translate(${(s.vx * t).toFixed(1)}px, ${(s.vy * t + 190 * t * t).toFixed(1)}px) rotate(${(45 + s.giro * t).toFixed(0)}deg) scale(${(0.4 + 0.6 * vivo).toFixed(2)})`,
        opacity: vivo,
      };
    }, 14), { duration: s.vita * 1000 }), sc);
  }
}

// ---------- 1 naturale ----------
// Schegge dipinte che saltano via dal dado e cadono.
export function schegge({ strato, x, y, raggio }) {
  const rnd = casuale(31);
  for (let i = 0; i < 9; i++) {
    const [sx, sy, sw, sh] = SCHEGGE[i % SCHEGGE.length];
    const scala = (raggio * (0.2 + rnd() * 0.22)) / Math.max(sw, sh);
    const ang = rnd() * Math.PI * 2;
    const vel = 60 + rnd() * 150;
    const vx = Math.cos(ang) * vel;
    const vy = Math.sin(ang) * vel - 90;
    const giro = (rnd() - 0.5) * 900;
    const vita = 0.6 + rnd() * 0.4;
    const scheggia = div("dadi-scheggia", {
      left: `${x}px`, top: `${y}px`, width: `${sw}px`, height: `${sh}px`, backgroundPosition: `${-sx}px ${-sy}px`,
    });
    strato.append(scheggia);
    via(scheggia.animate(fotogrammi(vita, (t) => ({
      transform: `translate(-50%, -50%) translate(${(vx * t).toFixed(1)}px, ${(vy * t + 420 * t * t).toFixed(1)}px) rotate(${(giro * t).toFixed(0)}deg) scale(${scala.toFixed(3)})`,
      opacity: Math.min(1, (1 - t / vita) * 2.2),
    }), 16), { duration: vita * 1000, delay: 60, fill: "backwards" }), scheggia);
  }
}

// Una scossa breve di tutta la vaschetta.
export function scossa(contenitore) {
  contenitore.animate(fotogrammi(0.36, (t) => ({ transform: `translateX(${(5 * Math.exp(-9 * t) * Math.sin(58 * t)).toFixed(2)}px)` }), 24), { duration: 360 });
}

// Il disegno delle crepe: tre linee spezzate che partono attorno al numero
// (non dal centro, così l'1 resta leggibile). Punti in raggi del dado, attorno
// all'origine.
export function lineeCrepe(seme = 13) {
  const rnd = casuale(seme);
  return [-0.5, 1.7, 3.6].map((partenza) => {
    let ang = partenza + (rnd() - 0.5) * 0.5;
    let x = Math.cos(ang) * 0.27;
    let y = Math.sin(ang) * 0.27;
    const punti = [[x, y]];
    for (let i = 0; i < 6; i++) {
      ang += (rnd() - 0.5) * 0.9;
      const passo = 0.13 + rnd() * 0.11;
      x += Math.cos(ang) * passo;
      y += Math.sin(ang) * passo;
      punti.push([x, y]);
    }
    return punti;
  });
}
