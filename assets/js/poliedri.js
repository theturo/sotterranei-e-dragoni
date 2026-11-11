// I sei dadi come solidi veri: vertici, facce e numeri.
// Solo geometria, niente pagina: si prova con Node (test/pagine/vaschetta.test.mjs).
// Ogni dado ha raggio 1 (il vertice più lontano dal centro) e descrive:
// - vertici, facce (indici dei vertici in senso antiorario visti da fuori), normali;
// - etichette: i numeri dipinti, ognuno con la posizione sulla faccia, il verso
//   «su», il verso «destra» e l'altezza della cifra;
// - valori: il numero di ogni faccia (nel d4, che si legge in cima, ogni
//   vertice ha il suo valore).
// In fondo, le simmetrie che servono a fissare il risultato di un lancio.
import { v, q } from "./geometria-3d.js";

const PHI = (1 + Math.sqrt(5)) / 2;
const media = (punti) => v.mul(punti.reduce(v.add), 1 / punti.length);

// Tutte le combinazioni di segno delle coordinate non nulle.
function piuMeno(p) {
  let esiti = [[]];
  for (const x of p) esiti = esiti.flatMap((r) => (x === 0 ? [[...r, 0]] : [[...r, x], [...r, -x]]));
  return esiti;
}

// Le facce di un solido convesso, date le direzioni delle loro normali: per
// ogni direzione, i vertici più avanti in quel verso, ordinati in senso
// antiorario visti da fuori.
function facceDaNormali(vertici, direzioni) {
  return direzioni.map((d) => {
    const n = v.norm(d);
    const quota = Math.max(...vertici.map((p) => v.dot(p, n)));
    const indici = vertici.map((_, i) => i).filter((i) => v.dot(vertici[i], n) > quota - 1e-6);
    const c = media(indici.map((i) => vertici[i]));
    const a = v.norm(v.sub(vertici[indici[0]], c));
    const b = v.cross(n, a);
    const angolo = (i) => {
      const r = v.sub(vertici[i], c);
      const ang = Math.atan2(v.dot(r, b), v.dot(r, a));
      return ang < -1e-9 ? ang + Math.PI * 2 : ang;
    };
    return indici.sort((i, j) => angolo(i) - angolo(j));
  });
}

const normaleDi = (vertici, f) => v.norm(v.cross(v.sub(vertici[f[1]], vertici[f[0]]), v.sub(vertici[f[2]], vertici[f[0]])));

// Distanza del punto p (sulla faccia) dallo spigolo più vicino: quanto spazio
// ha una cifra scritta lì.
function spazio(vertici, f, p) {
  return Math.min(...f.map((k, i) => {
    const a = vertici[k];
    const b = vertici[f[(i + 1) % f.length]];
    const lato = v.norm(v.sub(b, a));
    const r = v.sub(p, a);
    return v.len(v.sub(r, v.mul(lato, v.dot(r, lato))));
  }));
}

// Numeri con le facce opposte che sommano (facce + 1), come nei dadi veri.
function numeriOpposti(normali) {
  const quante = normali.length;
  const numeri = new Array(quante).fill(0);
  let alto = quante;
  let basso = 1;
  for (let i = 0; i < quante; i++) {
    if (numeri[i]) continue;
    const opposta = normali.findIndex((n, k) => k !== i && !numeri[k] && v.dot(n, normali[i]) < -0.999);
    numeri[i] = alto--;
    numeri[opposta] = basso++;
  }
  return numeri;
}

// Il d20 come quello dipinto dell'intro: attorno al 20 ci sono 2, 8 e 14
// (a sinistra, sotto e a destra con la punta in su); le opposte sommano 21.
function numeriD20(facce, normali) {
  const numeri = new Array(20).fill(0);
  const opposta = (i) => normali.findIndex((n) => v.dot(n, normali[i]) < -0.999);
  const metti = (i, n) => {
    numeri[i] = n;
    numeri[opposta(i)] = 21 - n;
  };
  const [a, b, c] = facce[0];
  const oltre = (x, y) => facce.findIndex((f, i) => i !== 0 && f.includes(x) && f.includes(y));
  metti(0, 20);
  metti(oltre(a, b), 2);
  metti(oltre(b, c), 8);
  metti(oltre(c, a), 14);
  const restanti = [18, 17, 16, 15, 12, 11];
  facce.forEach((_, i) => {
    if (!numeri[i]) metti(i, restanti.shift());
  });
  return numeri;
}

// Sui dadi che hanno sia il 6 sia il 9 un punto dice qual è il verso.
const scritta = (n, facce) => (facce >= 10 && (n === 6 || n === 9) ? `${n}.` : String(n));

// Completa un solido: scala a raggio 1, normali, centri ed etichette.
function completa({ tipo, vertici: grezzi, facce: grezze, numeri, etichetta }) {
  const scala = 1 / Math.max(...grezzi.map(v.len));
  const vertici = grezzi.map((p) => v.mul(p, scala));
  // Tutte le facce in senso antiorario viste da fuori.
  const facce = grezze.map((f) => (v.dot(normaleDi(vertici, f), media(f.map((k) => vertici[k]))) < 0 ? [...f].reverse() : f));
  const normali = facce.map((f) => normaleDi(vertici, f));
  const centri = facce.map((f) => media(f.map((k) => vertici[k])));
  const solido = { tipo, vertici, facce, normali, centri };
  solido.valori = numeri ? numeri(facce, normali) : null;

  const etichette = [];
  facce.forEach((f, i) => {
    for (const e of etichetta(solido, i)) {
      const su = v.norm(v.sub(e.verso, e.pos));
      etichette.push({ faccia: i, pos: e.pos, su, destra: v.cross(su, normali[i]), testo: e.testo, alt: e.alt });
    }
  });
  solido.etichette = etichette;
  return solido;
}

// Dadi «a faccia»: un numero al centro di ogni faccia; il risultato è la
// faccia rivolta in alto.
function aFaccia({ puntoDi, versoDi, quota }) {
  return (s, i) => {
    const pos = puntoDi ? puntoDi(s, i) : s.centri[i];
    const testo = scritta(s.valori[i], s.tipo);
    const alt = spazio(s.vertici, s.facce[i], pos) * quota * (testo.replace(".", "").length > 1 ? 0.76 : 1);
    return [{ pos, verso: versoDi(s, i), testo, alt }];
  };
}

const versoVertice = (s, i) => s.vertici[s.facce[i][0]];
const versoLato = (s, i) => media([s.vertici[s.facce[i][0]], s.vertici[s.facce[i][1]]]);

// ---------- d4: si legge in cima ----------
// Su ogni faccia tre numeri, uno per angolo: ogni vertice ha il suo valore e il
// risultato è il vertice in cima, ripetuto sulle tre facce che lo toccano.
const TETRA = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
const D4 = completa({
  tipo: 4,
  vertici: TETRA,
  facce: facceDaNormali(TETRA, TETRA.map((p) => v.mul(p, -1))),
  etichetta: (s, i) => s.facce[i].map((k) => {
    const pos = v.add(s.centri[i], v.mul(v.sub(s.vertici[k], s.centri[i]), 0.46));
    return { pos, verso: s.vertici[k], testo: String(k + 1), alt: spazio(s.vertici, s.facce[i], s.centri[i]) * 0.5 };
  }),
});

// ---------- d6, d8, d12, d20 ----------
const CUBO = piuMeno([1, 1, 1]);
const ASSI = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].flatMap(piuMeno);
// Icosaedro e dodecaedro sono uno il duale dell'altro: i vertici dell'uno
// danno le normali alle facce dell'altro, a patto di prenderli orientati
// nello stesso modo (per questo ce ne sono due coppie).
const ICOSAEDRO = [[0, 1, PHI], [1, PHI, 0], [PHI, 0, 1]].flatMap(piuMeno);
const NORMALI_ICOSAEDRO = [[1, 1, 1], [1 / PHI, 0, PHI], [0, PHI, 1 / PHI], [PHI, 1 / PHI, 0]].flatMap(piuMeno);
const DODECAEDRO = [[1, 1, 1], [0, 1 / PHI, PHI], [1 / PHI, PHI, 0], [PHI, 0, 1 / PHI]].flatMap(piuMeno);
const NORMALI_DODECAEDRO = [[0, PHI, 1], [1, 0, PHI], [PHI, 1, 0]].flatMap(piuMeno);

const D6 = completa({
  tipo: 6,
  vertici: CUBO,
  facce: facceDaNormali(CUBO, ASSI),
  numeri: (_, normali) => numeriOpposti(normali),
  etichetta: aFaccia({ versoDi: versoLato, quota: 1.05 }),
});

const D8 = completa({
  tipo: 8,
  vertici: ASSI,
  facce: facceDaNormali(ASSI, CUBO),
  numeri: (_, normali) => numeriOpposti(normali),
  etichetta: aFaccia({ versoDi: versoVertice, quota: 1.2 }),
});

const D12 = completa({
  tipo: 12,
  vertici: DODECAEDRO,
  facce: facceDaNormali(DODECAEDRO, NORMALI_DODECAEDRO),
  numeri: (_, normali) => numeriOpposti(normali),
  etichetta: aFaccia({ versoDi: versoVertice, quota: 1.05 }),
});

const D20 = completa({
  tipo: 20,
  vertici: ICOSAEDRO,
  facce: facceDaNormali(ICOSAEDRO, NORMALI_ICOSAEDRO),
  numeri: numeriD20,
  etichetta: aFaccia({ versoDi: versoVertice, quota: 1.25 }),
});

// ---------- d10: dieci aquiloni ----------
// Due punte e una corona di dieci vertici a zig-zag. La quota delle punte è
// quella che rende piatti gli aquiloni.
const COS36 = Math.cos(Math.PI / 5);
const ZIG = 0.1056;
const PUNTA = (ZIG * (1 + COS36)) / (1 - COS36);
const CORONA = Array.from({ length: 10 }, (_, k) => [Math.cos((k * Math.PI) / 5), Math.sin((k * Math.PI) / 5), k % 2 === 0 ? ZIG : -ZIG]);
const VERTICI_D10 = [[0, 0, PUNTA], [0, 0, -PUNTA], ...CORONA];
const corona = (k) => 2 + ((k + 10) % 10);
const FACCE_D10 = Array.from({ length: 10 }, (_, k) => (k % 2 === 1
  ? [0, corona(k - 1), corona(k), corona(k + 1)]
  : [1, corona(k + 1), corona(k), corona(k - 1)]));

const D10 = completa({
  tipo: 10,
  vertici: VERTICI_D10,
  facce: FACCE_D10,
  numeri: (_, normali) => numeriOpposti(normali),
  etichetta: aFaccia({
    // Il numero sta nella parte larga dell'aquilone, con la punta in alto.
    puntoDi: (s, i) => {
      const f = s.facce[i];
      const punta = f.find((k) => k < 2);
      const basso = f[(f.indexOf(punta) + 2) % 4];
      return v.add(s.vertici[punta], v.mul(v.sub(s.vertici[basso], s.vertici[punta]), 0.62));
    },
    versoDi: (s, i) => s.vertici[s.facce[i].find((k) => k < 2)],
    quota: 1.05,
  }),
});

// ---------- Risultato deciso prima del lancio ----------
// La fisica decide come cade il dado, ma il risultato è già stato tirato. I
// dadi sono simmetrici: basta «rinumerarli» con una rotazione che porta la
// faccia voluta al posto di quella finita in alto. La forma non cambia, quindi
// il lancio simulato resta identico: cambia solo quale numero c'è sopra.

// L'elemento che fa il risultato: una faccia, o per il d4 un vertice.
export const elementoDi = (solido, risultato) => (solido.tipo === 4 ? risultato - 1 : solido.valori.indexOf(risultato));
const direzioneDi = (solido, k) => (solido.tipo === 4 ? v.norm(solido.vertici[k]) : solido.normali[k]);
const attornoA = (solido, k) => (solido.tipo === 4 ? [0, 1, 2, 3].filter((i) => i !== k) : solido.facce[k]);

// L'elemento rivolto più in alto (z) con la rotazione `rot`.
export function elementoInAlto(solido, rot) {
  const quanti = solido.tipo === 4 ? 4 : solido.facce.length;
  let migliore = 0;
  let quota = -2;
  for (let k = 0; k < quanti; k++) {
    const z = q.ruota(rot, direzioneDi(solido, k))[2];
    if (z > quota) {
      quota = z;
      migliore = k;
    }
  }
  return migliore;
}

// Vero se la rotazione S rimette ogni vertice al posto di un altro vertice.
export function eSimmetria(solido, S) {
  return solido.vertici.every((p) => {
    const r = q.ruota(S, p);
    return solido.vertici.some((o) => v.len(v.sub(o, r)) < 1e-6);
  });
}

// La simmetria del solido che porta l'elemento `voluto` al posto di `inAlto`.
// Di solito ce n'è più d'una (tre per un triangolo, cinque per un pentagono):
// `gradimento(S)` sceglie, per esempio, quella con il numero più dritto.
export function simmetria(solido, voluto, inAlto, gradimento = () => 0) {
  const arrivo = direzioneDi(solido, inAlto);
  const base = q.da(direzioneDi(solido, voluto), arrivo);
  const sulPiano = (p) => v.sub(p, v.mul(arrivo, v.dot(p, arrivo)));
  const a = sulPiano(q.ruota(base, solido.vertici[attornoA(solido, voluto)[0]]));
  let scelta = null;
  let voto = -Infinity;
  for (const k of attornoA(solido, inAlto)) {
    const b = sulPiano(solido.vertici[k]);
    const angolo = Math.atan2(v.dot(v.cross(a, b), arrivo), v.dot(a, b));
    const S = q.mul(q.asse(arrivo, angolo), base);
    if (!eSimmetria(solido, S)) continue;
    const g = gradimento(S);
    if (g > voto) {
      voto = g;
      scelta = S;
    }
  }
  return scelta;
}

export const POLIEDRI = { 4: D4, 6: D6, 8: D8, 10: D10, 12: D12, 20: D20 };
export const TIPI = [4, 6, 8, 10, 12, 20];

// Il solido per un dado da `facce` facce.
export function poliedro(facce) {
  const solido = POLIEDRI[facce];
  if (!solido) throw new Error(`Dado non previsto: d${facce}`);
  return solido;
}
