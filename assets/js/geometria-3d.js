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
