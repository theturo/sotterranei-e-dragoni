// Vettori, quaternioni e interpolazione delle rotazioni condivisi dai dadi in
// 3D (intro dell'app, dado di caricamento, dado vita del passaggio di
// livello). Solo calcoli, niente pagina: si può provare con Node.

export const v = {
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

// Interpolazione sferica tra due rotazioni (quaternioni unitari), t da 0 a 1.
export function slerp(a, b, t) {
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b;
  if (dot < 0) {
    dot = -dot;
    bb = b.map((x) => -x);
  }
  if (dot > 0.9995) {
    const r = a.map((x, i) => x + (bb[i] - x) * t);
    const l = Math.hypot(...r);
    return r.map((x) => x / l);
  }
  const theta0 = Math.acos(dot);
  const theta = theta0 * t;
  const s0 = Math.cos(theta) - (dot * Math.sin(theta)) / Math.sin(theta0);
  const s1 = Math.sin(theta) / Math.sin(theta0);
  return a.map((x, i) => x * s0 + bb[i] * s1);
}

// Direzione della luce che illumina i dadi: da sinistra in alto, verso chi guarda.
export const LUCE = v.norm([-0.4, 0.5, 1]);

// Facce rivolte verso chi guarda dopo la rotazione `rot`, dalla più lontana alla
// più vicina (l'ordine in cui vanno disegnate). Ogni voce: { i, punti, centro, n }
// con i = indice della faccia, punti = i suoi vertici ruotati, centro = il
// baricentro e n = la normale ruotata.
export function facceVisibili(rot, facce, vertici, normali) {
  return facce.map((f, i) => {
    const punti = f.map((k) => q.ruota(rot, vertici[k]));
    const centro = v.mul(punti.reduce(v.add), 1 / 3);
    return { i, punti, centro, n: q.ruota(rot, normali[i]) };
  }).filter((fc) => fc.n[2] > 0.05).sort((a, b) => a.centro[2] - b.centro[2]);
}

// Colore di una faccia di normale `n` in base a quanto guarda la luce (mai più
// scura di 0,3).
export function coloreFaccia(n) {
  const lum = Math.max(0.3, v.dot(n, LUCE));
  return `rgb(${Math.round(60 + 160 * lum)},${Math.round(40 + 120 * lum)},${Math.round(10 + 50 * lum)})`;
}
