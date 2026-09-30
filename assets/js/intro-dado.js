// Geometria e regia dell'intro dell'app installata (vedi intro.js): un d20
// entra rimbalzando, rotola e si ferma sempre sul 20, con la faccia del 20
// verso lo schermo e il contorno esagonale "a punta in su" come l'icona.
// Qui solo calcoli (niente pagina né Three.js): si può provare con Node.
//
// Coordinate: tavolo sul piano y = 0, camera sopra il tavolo che guarda in
// giù; sullo schermo x va a destra e z verso il basso. Unità = raggio del dado.

export const DURATA = 2.5;          // secondi
export const T_ARRIVO = 1.25;       // il dado si ferma
export const D = 9;                 // distanza della camera dal tavolo
export const RAGGIO_ICONA = 57;     // px: raggio dell'esagono nell'icona da 124 px

const v = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]);
    return [a[0] / l, a[1] / l, a[2] / l];
  },
};

// Quaternioni [w, x, y, z]
export const q = {
  asse: (asse, ang) => {
    const s = Math.sin(ang / 2);
    const n = v.norm(asse);
    return [Math.cos(ang / 2), n[0] * s, n[1] * s, n[2] * s];
  },
  mul: (a, b) => [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ],
  ruota: (qq, p) => {
    const asse = [qq[1], qq[2], qq[3]];
    const t = v.mul(v.cross(asse, p), 2);
    return v.add(v.add(p, v.mul(t, qq[0])), v.cross(asse, t));
  },
  // ruota il versore a sul versore b
  da: (a, b) => {
    const d = v.dot(a, b);
    if (d > 0.999999) return [1, 0, 0, 0];
    if (d < -0.999999) return q.asse(Math.abs(a[0]) < 0.9 ? v.cross(a, [1, 0, 0]) : v.cross(a, [0, 1, 0]), Math.PI);
    const c = v.cross(a, b);
    const qq = [1 + d, c[0], c[1], c[2]];
    const l = Math.hypot(...qq);
    return qq.map((x) => x / l);
  },
};

// ---------- Icosaedro ----------

const PHI = (1 + Math.sqrt(5)) / 2;
export const VERTICI = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
].map(v.norm);

// Facce come terne di vertici, in senso antiorario viste da fuori.
export const FACCE = [];
{
  const lato = Math.min(...VERTICI.slice(1).map((p) => v.len(v.sub(VERTICI[0], p))));
  const adiacenti = (a, b) => Math.abs(v.len(v.sub(VERTICI[a], VERTICI[b])) - lato) < 1e-6;
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let k = j + 1; k < 12; k++) {
    if (!adiacenti(i, j) || !adiacenti(j, k) || !adiacenti(i, k)) continue;
    const n = v.cross(v.sub(VERTICI[j], VERTICI[i]), v.sub(VERTICI[k], VERTICI[i]));
    const esterna = v.dot(n, v.add(v.add(VERTICI[i], VERTICI[j]), VERTICI[k])) > 0;
    FACCE.push(esterna ? [i, j, k] : [i, k, j]);
  }
}

export const normale = (f) => v.norm(v.cross(v.sub(VERTICI[f[1]], VERTICI[f[0]]), v.sub(VERTICI[f[2]], VERTICI[f[0]])));
export const R_INTERNO = v.dot(normale(FACCE[0]), VERTICI[FACCE[0][0]]);

// Numeri: facce opposte sommano 21.
export const NUMERI = new Array(20).fill(0);
{
  const coppie = [[20, 1], [14, 7], [2, 19], [8, 13], [17, 4], [5, 16], [11, 10], [3, 18], [15, 6], [12, 9]];
  const libere = new Set(FACCE.map((_, i) => i));
  for (const [alto, basso] of coppie) {
    const a = [...libere][0];
    const b = [...libere].find((i) => i !== a && v.dot(normale(FACCE[i]), normale(FACCE[a])) < -0.999);
    NUMERI[a] = alto;
    NUMERI[b] = basso;
    libere.delete(a);
    libere.delete(b);
  }
}
export const FACCIA_20 = NUMERI.indexOf(20);
export const etichetta = (n) => (n === 6 || n === 9 ? `${n}.` : String(n));

// Posa finale: il 20 verso la camera (+y) e l'esagono a punta in su (−z).
export let Q_FINALE = q.da(normale(FACCE[FACCIA_20]), [0, 1, 0]);
{
  const anello = VERTICI.map((p) => q.ruota(Q_FINALE, p)).filter((p) => Math.abs(p[1]) < 0.5);
  const primo = anello.reduce((a, b) => (Math.hypot(b[0], b[2]) > Math.hypot(a[0], a[2]) ? b : a));
  Q_FINALE = q.mul(q.asse([0, 1, 0], Math.atan2(primo[0], -primo[2])), Q_FINALE);
  // Sulla faccia del 20 l'apice del triangolo è il vertice più in alto: numero dritto.
  const f = FACCE[FACCIA_20];
  const z = f.map((i) => q.ruota(Q_FINALE, VERTICI[i])[2]);
  const apice = z.indexOf(Math.min(...z));
  FACCE[FACCIA_20] = [f[apice], f[(apice + 1) % 3], f[(apice + 2) % 3]];
}

// ---------- Scena per uno schermo W × H ----------

const DIREZIONE = v.norm([-0.62, 0, -1]);   // arriva dall'alto a sinistra
const ASSE_ROTOLO = v.norm(v.cross([0, 1, 0], v.mul(DIREZIONE, -1)));
const RAGGIO_ROTOLO = 0.72;
// Archi dei rimbalzi: [inizio, fine, altezza]; il primo è la caduta dall'alto.
const ARCHI = [[0.0, 0.34, 3.4], [0.34, 0.74, 1.15], [0.74, 1.0, 0.38], [1.0, 1.14, 0.1], [1.14, 1.22, 0.025]];

function altezza(t) {
  for (const [a, b, h] of ARCHI) {
    if (t < a || t > b) continue;
    const s = (t - a) / (b - a);
    return a === 0 ? h * (1 - s * s) : 4 * h * s * (1 - s);
  }
  return 0;
}

const liscio = (a, b, t) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

// Fasi di luce, logo e titolo al tempo t (valori 0..1).
export function fasi(t) {
  return {
    numero: liscio(1.3, 1.62, t),        // il 20 si accende a dado fermo
    luce: liscio(1.62, 2.0, t) * (1 - 0.72 * liscio(2.05, 2.45, t)),
    brillio: liscio(1.64, 2.0, t),       // poi la luce avvolge tutto il dado
    dado: 1 - liscio(1.84, 2.12, t),
    icona: liscio(1.86, 2.15, t),
    titolo: liscio(2.05, 2.42, t),
    sottotitolo: liscio(2.18, 2.5, t),
  };
}

// Centro del tavolo sullo schermo (cx, cy): il dado si ferma lì, dove poi
// compare l'icona. Restituisce proiezione, scala e posa del dado nel tempo.
export function creaScena(larghezza, altezzaSchermo, cx, cy) {
  const proietta = (p, f) => [cx + (p[0] * f) / (D - p[1]), cy + (p[2] * f) / (D - p[1]), f / (D - p[1])];
  // Scala: nella posa finale il contorno del dado misura quanto l'esagono dell'icona.
  const posFinali = VERTICI.map((p) => v.add(q.ruota(Q_FINALE, p), [0, R_INTERNO, 0]));
  const F = RAGGIO_ICONA / Math.max(...posFinali.map((p) => Math.hypot(p[0], p[2]) / (D - p[1])));
  // Distanza di partenza: abbastanza da cominciare fuori dallo schermo.
  let L0 = 1;
  for (; L0 < 60; L0 += 0.1) {
    const p = proietta(v.add(v.mul(DIREZIONE, L0), [0, 3.4, 0]), F);
    if (p[0] < -90 || p[1] < -90) break;
  }

  function posa(t) {
    const u = Math.min(1, t / T_ARRIVO);
    const resto = L0 * Math.pow(1 - u, 2.2);
    const oscilla = 0.55 * Math.sin(t * 13) * Math.exp(-2.6 * t) * Math.pow(1 - u, 1.5);
    const rot = q.mul(q.asse(ASSE_ROTOLO, (-resto / RAGGIO_ROTOLO) * 1.35), q.mul(q.asse(DIREZIONE, oscilla), Q_FINALE));
    const h = altezza(Math.min(t, T_ARRIVO));
    let minY = Infinity;
    for (const p of VERTICI) minY = Math.min(minY, q.ruota(rot, p)[1]);
    return { pos: v.add(v.mul(DIREZIONE, resto), [0, h - minY, 0]), rot, h };
  }

  // Dove sta il 20 sullo schermo a dado fermo.
  const finale = posa(DURATA);
  const centro20 = v.mul(FACCE[FACCIA_20].map((k) => v.add(q.ruota(finale.rot, VERTICI[k]), finale.pos)).reduce(v.add), 1 / 3);

  return { F, L0, posa, proietta, punto20: proietta(centro20, F), larghezza, altezza: altezzaSchermo, cx, cy };
}
