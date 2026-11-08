// Scena dell'intro «drago e D20»: traiettoria, drago fatto di pezzi dipinti (corpo a nastro,
// testa, ali, zampe, coda), D20, collisione ed esplosione, logo sul bianco.
// Tutto è funzione del frame (0…159 a 24 fps, anche frazionario; oltre il 159 è l'attesa del
// caricamento): niente stato, quindi è testabile in Node (test/pagine/intro.test.mjs).
// Gira sia nel worker dell'intro (OffscreenCanvas) sia nella pagina: non tocca il DOM.
import { PEZZI as P } from "./intro-pezzi.js";

export const FPS = 24;
export const FRAMES = 160;
// Beat (frame) ricavati dal montaggio approvato
export const F = { virata: 26, orbita: 46, spirale: 100, urto: 131, finale: 140 };

const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
const rad = (d) => (d * Math.PI) / 180;
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function beat(f) {
  if (f < F.virata) return "Ingresso da sinistra";
  if (f < F.orbita) return "Virata in alto a destra";
  if (f < F.spirale) return "Prima orbita oraria";
  if (f < F.urto) return "Spirale verso il dado";
  if (f < F.finale) return "Collisione";
  return "Finale (spazio per il logo)";
}

// ---------- Geometria adattiva: ellisse larga in orizzontale, alta in verticale ----------
export function geometria(W, H) {
  const u = Math.min(W, H), a = W / H;
  const allunga = (x) => 0.36 * u * (1 + 0.55 * Math.min(1, Math.max(0, x) / 0.78));
  return {
    W, H, u, cx: W / 2, cy: H / 2,
    rx: a >= 1 ? allunga(a - 1) : 0.36 * u,
    ry: a >= 1 ? 0.36 * u : allunga(1 / a - 1),
  };
}

// ---------- Traiettoria della testa: parametro = frame ----------
// WB e W1 scelti perché l'urto cada in alto (θ ≈ 275°): lì, in un'orbita oraria, il drago vola
// da sinistra a destra ed è dritto rispetto allo schermo, come nel montaggio.
const TH0 = rad(-80), WA = rad(2.6), WB = rad(3.77), RAMPA = 36, W1 = rad(2.5), K_FINE = 0.22, T_MIN = -90, PASSO = 0.25;

// virata lenta che accelera (come nel montaggio), poi giro costante, poi spirale che rallenta
function theta(t) {
  const d = t - F.virata;
  if (d <= RAMPA) return TH0 + WA * d + ((WB - WA) * d * d) / (2 * RAMPA);
  const th = TH0 + WA * RAMPA + ((WB - WA) * RAMPA) / 2 + WB * (Math.min(t, F.spirale) - F.virata - RAMPA);
  if (t <= F.spirale) return th;
  const s = t - F.spirale, D = F.urto - F.spirale;
  return th + WB * s + ((W1 - WB) * s * s) / (2 * D);
}
function raggio(t) {
  if (t <= F.spirale) return 1;
  // discesa morbida: all'urto il drago scende in diagonale, non in picchiata verticale
  const s = clamp01((t - F.spirale) / (F.urto - F.spirale));
  return 1 - (1 - K_FINE) * (0.35 * s + 0.65 * smooth(s));
}
export function zoom(f) {
  return 1 + 0.2 * smooth((f - F.spirale) / (F.urto - F.spirale)); // il resto lo fa la camera
}

export function creaTraiettoria(g) {
  const orbita = (t) => {
    const th = theta(t), k = raggio(t);
    return [g.cx + g.rx * k * Math.cos(th), g.cy + g.ry * k * Math.sin(th)];
  };
  const J = orbita(F.virata);
  const dJ = [-g.rx * Math.sin(TH0) * WA, g.ry * Math.cos(TH0) * WA];
  const vel = Math.hypot(dJ[0], dJ[1]);
  const P0 = [-0.16 * g.u, g.cy - 0.02 * g.u];
  const v0 = [vel * 0.98, -vel * 0.22];
  const k3 = F.virata / 3;
  const P1 = [P0[0] + v0[0] * k3, P0[1] + v0[1] * k3];
  const P2 = [J[0] - dJ[0] * k3, J[1] - dJ[1] * k3];
  const pos = (t) => {
    if (t < 0) return [P0[0] + v0[0] * t, P0[1] + v0[1] * t];
    if (t < F.virata) {
      const s = t / F.virata, m = 1 - s;
      const b = (i) => m * m * m * P0[i] + 3 * m * m * s * P1[i] + 3 * m * s * s * P2[i] + s * s * s * J[i];
      return [b(0), b(1)];
    }
    return orbita(t);
  };
  const n = Math.ceil((F.urto - T_MIN) / PASSO) + 1;
  const X = new Float64Array(n), Y = new Float64Array(n), S = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const [x, y] = pos(T_MIN + i * PASSO);
    X[i] = x; Y[i] = y;
    S[i] = i ? S[i - 1] + Math.hypot(x - X[i - 1], y - Y[i - 1]) : 0;
  }
  const sAt = (t) => {
    const fi = (Math.min(t, F.urto) - T_MIN) / PASSO, i = Math.floor(fi);
    return i >= n - 1 ? S[n - 1] : S[i] + (S[i + 1] - S[i]) * (fi - i);
  };
  const tangente = (i) => {
    const a = Math.max(0, i - 2), b = Math.min(n - 1, i + 3);
    const dx = X[b] - X[a], dy = Y[b] - Y[a], l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  };
  // punto a lunghezza d'arco s: [x, y, tx, ty]
  const punto = (s) => {
    if (s <= 0) {
      const [tx, ty] = tangente(0);
      return [X[0] + tx * s, Y[0] + ty * s, tx, ty];
    }
    let lo = 0, hi = n - 1;
    if (s >= S[hi]) { const [tx, ty] = tangente(hi); return [X[hi], Y[hi], tx, ty]; }
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
    const fr = (s - S[lo]) / (S[hi] - S[lo] || 1);
    const [tx, ty] = tangente(lo);
    return [X[lo] + (X[hi] - X[lo]) * fr, Y[lo] + (Y[hi] - Y[lo]) * fr, tx, ty];
  };
  return { sAt, punto, X, Y, n };
}

// ---------- Corpo ----------
function larghezza(x) { // x = 0 collo … 1 attacco della punta della coda
  if (x < 0.1) return 0.72 + 0.28 * smooth(x / 0.1);
  if (x < 0.35) return 1 - 0.1 * smooth((x - 0.1) / 0.25);
  return 0.9 - 0.62 * smooth((x - 0.35) / 0.65);
}

const N_CORPO = 120;
function campionaCorpo(g, tr, f) {
  const z = zoom(f), L = 0.95 * g.u * z, Wmax = 0.075 * g.u * z;
  const sh = tr.sAt(f), pts = [];
  for (let i = 0; i <= N_CORPO; i++) {
    const x = i / N_CORPO;
    const [px, py, tx, ty] = tr.punto(sh - x * L);
    pts.push({ x, px, py, tx, ty, ox: ty, oy: -tx, hw: (Wmax * larghezza(x)) / 2 });
  }
  return { pts, z, L, Wmax };
}
const aX = (pts, x) => pts[Math.min(N_CORPO, Math.max(0, Math.round(x * N_CORPO)))];

const SCAGLIE = ["#8a2416", "#a8321a", "#c4481f", "#7a1d13", "#d0602a", "#b13c1c", "#e07a35"];

// La striscia dipinta viene avvolta lungo la traiettoria a fette sottili: in alto le creste
// (verso l'esterno dell'orbita), in basso il ventre (verso il dado). Le scaglie sono legate al
// corpo (coordinata dalla testa), quindi non scivolano.
function disegnaCorpo(ctx, c, tex) {
  const { pts } = c, m = P.corpo, f0 = m.fascia[0], f1 = m.fascia[1], Wt = tex.width, Ht = tex.height;
  let U = 0;
  for (let i = 0; i < N_CORPO; i++) {
    const p = pts[i], q = pts[i + 1];
    const dx = p.px - q.px, dy = p.py - q.py, len = Math.hypot(dx, dy);
    if (len < 0.01) continue;
    const hw = (p.hw + q.hw) / 2, sy = (2 * hw) / (f1 - f0);
    const du = len / sy;
    U += du;
    let sx = ((-U % Wt) + Wt) % Wt;
    const w = Math.min(du, Wt - sx);
    ctx.save();
    ctx.translate(q.px, q.py);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.drawImage(tex, sx, 0, w, Ht, 0, -hw - f0 * sy, (w / du) * len * 1.12 + 0.6, Ht * sy);
    if (w < du) ctx.drawImage(tex, 0, 0, du - w, Ht, (w / du) * len, -hw - f0 * sy, ((du - w) / du) * len * 1.12 + 0.6, Ht * sy);
    ctx.restore();
  }
}

function disegnaCoda(ctx, c, tex) {
  const e = c.pts[N_CORPO], m = P.coda;
  const s = (2 * e.hw * 1.15) / m.attacco;
  ctx.save();
  ctx.translate(e.px + e.tx * e.hw * 0.4, e.py + e.ty * e.hw * 0.4);
  ctx.rotate(Math.atan2(e.ty, e.tx));
  ctx.scale(s, s);
  ctx.drawImage(tex, -m.ancora[0], -m.ancora[1]);
  ctx.restore();
}

function disegnaZampa(ctx, g, c, img, nome, x, fase) {
  const p = aX(c.pts, x), m = P[nome];
  const s = (0.085 * g.u * c.z) / m.h;
  ctx.save();
  ctx.translate(p.px - p.ox * p.hw * 0.35, p.py - p.oy * p.hw * 0.35);
  ctx.rotate(Math.atan2(p.ty, p.tx) + rad(32 + 6 * Math.sin(fase)));
  ctx.scale(s, s);
  ctx.drawImage(img[nome], -m.ancora[0], -m.ancora[1]);
  ctx.restore();
}

// battito: le pose dipinte si alternano (1 alta → 3 distesa → 1), più una piccola oscillazione
const CICLO_ALA = [1, 2, 3, 4, 5, 4, 3, 2];
function poseAla(f, ritardo = 0) {
  const t = ((f - ritardo) / 13) % 1;
  const fase = 2 * Math.PI * ((f - ritardo) / 13);
  let i = CICLO_ALA[Math.floor((t < 0 ? t + 1 : t) * CICLO_ALA.length)];
  if (f > F.spirale + 16) i = 6; // ali ripiegate nella picchiata finale
  return { nome: `ala_${i}`, oscilla: rad(6 * Math.sin(fase)) };
}

function disegnaAla(ctx, g, c, img, x, posa, scala, lontana) {
  const p = aX(c.pts, x), m = P[posa.nome];
  const s = (0.4 * g.u * c.z * scala) / P.ala_rif;
  ctx.save();
  ctx.translate(p.px + p.ox * p.hw * 0.45, p.py + p.oy * p.hw * 0.45);
  ctx.rotate(Math.atan2(p.ty, p.tx) + posa.oscilla - (lontana ? rad(10) : 0));
  ctx.scale(s, s);
  // l'ala lontana è una copia scurita (preparata dal motore: Safari non ha ctx.filter)
  ctx.drawImage(img[lontana ? `${posa.nome}_scura` : posa.nome], -m.ancora[0], -m.ancora[1]);
  ctx.restore();
}

// testa: chiusa in volo, fauci aperte nella spirale, di tre quarti nell'ultimo affondo
function teste(f) {
  const a = smooth((f - 108) / 4), b = smooth((f - 121) / 4);
  return [["testa_chiusa", 1 - a], ["testa_aperta", a * (1 - b)], ["testa_tre_quarti", b]].filter(([, w]) => w > 0.001);
}

function disegnaTesta(ctx, g, c, img, f) {
  const h = c.pts[0];
  const lungh = 0.17 * g.u * c.z;
  for (const [nome, peso] of teste(f)) {
    const m = P[nome];
    const s = (nome === "testa_tre_quarti" ? 0.94 : 1) * lungh / m.w;
    const incl = Math.atan2(m.punta[1] - m.ancora[1], m.punta[0] - m.ancora[0]);
    ctx.save();
    ctx.globalAlpha *= peso;
    ctx.translate(h.px - h.tx * 0.012 * g.u, h.py - h.ty * 0.012 * g.u);
    ctx.rotate(Math.atan2(h.ty, h.tx) - incl * 0.6);
    ctx.scale(s, s);
    ctx.drawImage(img[nome], -m.ancora[0], -m.ancora[1]);
    ctx.restore();
  }
}

export function disegnaDrago(ctx, g, tr, f, img, alfa = 1) {
  const c = campionaCorpo(g, tr, f);
  const fase = (2 * Math.PI * f) / 13;
  ctx.save();
  ctx.globalAlpha = alfa;
  disegnaAla(ctx, g, c, img, 0.09, poseAla(f, 1.5), 0.82, true);
  disegnaZampa(ctx, g, c, img, "zampa_post", 0.4, fase + 1);
  disegnaZampa(ctx, g, c, img, "zampa_ant", 0.13, fase);
  disegnaCoda(ctx, c, img.coda);
  disegnaCorpo(ctx, c, img.corpo);
  disegnaAla(ctx, g, c, img, 0.14, poseAla(f), 1, false);
  disegnaTesta(ctx, g, c, img, f);
  ctx.restore();
  return c;
}

// ---------- D20 ----------
function dimDado(g) { return (0.17 * g.u) / P.d20.h; }

function vortica(g, x, y, ang) {
  const dx = x - g.cx, dy = y - g.cy, c = Math.cos(ang), s = Math.sin(ang);
  return [g.cx + dx * c - dy * s, g.cy + dx * s + dy * c];
}
// rotazione del vortice per un punto: più forte vicino al centro
const giroVortice = (g, x, y, t) => (0.045 * t * 0.35 * g.u) / (Math.hypot(x - g.cx, y - g.cy) + 0.15 * g.u);

function disegnaDado(ctx, g, f, img) {
  if (f >= F.urto) return;
  const sd = dimDado(g), C = P.d20.centro;
  ctx.drawImage(img.d20, g.cx - C[0] * sd, g.cy - C[1] * sd, img.d20.width * sd, img.d20.height * sd);
}

// ---------- Collisione: tutto è fatto di pezzi dipinti ----------
let SVANISCE = 1; // i detriti si sciolgono nel bianco

// atlante: disegna il rettangolo r centrato in (0,0), larghezza w (unità mondo)
function pezzo(ctx, atl, r, w) {
  const h = (w * r[3]) / r[2];
  ctx.drawImage(atl, r[0], r[1], r[2], r[3], -w / 2, -h / 2, w, h);
}

// 1) schegge dipinte del D20: partono dalla loro posizione nel grappolo e si allargano
function disegnaSchegge(ctx, g, f, img) {
  const tau = f - F.urto;
  if (tau < 0) return;
  const m = P.schegge, sc = (0.17 * g.u * 1.08) / m.diametro;
  m.pezzi.forEach((p, k) => {
    const vita = 20 + rnd(k * 1.7) * 8, a = 1 - tau / vita;
    if (a <= 0) return;
    const allarga = 0.62 + 0.09 * tau + 0.004 * tau * tau * (0.7 + 0.6 * rnd(k * 3.1));
    let x = g.cx + p.c[0] * sc * allarga, y = g.cy + p.c[1] * sc * allarga;
    [x, y] = vortica(g, x, y, giroVortice(g, x, y, tau) * 0.6);
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 1.5) * SVANISCE;
    ctx.translate(x, y);
    ctx.rotate((rnd(k * 9.1) - 0.5) * 0.18 * tau);
    pezzo(ctx, img.schegge, p.r, p.r[2] * sc * (1 + 0.03 * tau));
    ctx.restore();
  });
}

// 2) pennellate dipinte: schizzi dall'urto e dal corpo che si sfalda
const CALDE = [0, 2, 3, 4, 6, 7, 9, 11, 12, 14];
const PEN_CORPO = [3, 7, 9, 11, 14, 0];
function pennellataDipinta(ctx, img, k, x, y, ang, larg, alfa) {
  const r = P.pennellate.r[k];
  ctx.save();
  ctx.globalAlpha = alfa * SVANISCE;
  ctx.translate(x, y);
  ctx.rotate(ang);
  pezzo(ctx, img.pennellate, r, larg);
  ctx.restore();
}

function disegnaSchizzi(ctx, g, f, img) {
  const tau = f - F.urto;
  if (tau < 0) return;
  const u = g.u;
  for (let i = 0; i < 46; i++) {
    const vita = 11 + rnd(i * 3.7) * 12, a = 1 - tau / vita;
    if (a <= 0) continue;
    const dir = rnd(i * 1.3) * Math.PI * 2, v = (0.012 + rnd(i * 5.9) * 0.03) * u;
    const d = v * tau * (1 - tau / (2.4 * vita)) + 0.07 * u;
    let x = g.cx + Math.cos(dir) * d, y = g.cy + Math.sin(dir) * d;
    const giro = giroVortice(g, x, y, tau);
    [x, y] = vortica(g, x, y, giro);
    const k = i % 5 === 0 ? i % 16 : CALDE[i % CALDE.length];
    pennellataDipinta(ctx, img, k, x, y, dir + giro + 0.35, (0.05 + rnd(i * 7.7) * 0.09) * u, Math.pow(a, 1.2) * smooth((tau - rnd(i * 2.9) * 2) / 2.5));
  }
}

// 3) il drago si sfalda dalla testa alla coda: le fette della sua striscia dipinta si staccano,
//    ruotano e il vortice le porta via; testa, ali e zampe svaniscono subito dopo l'urto
function disegnaCorpoInFrantumi(ctx, g, c, img, tau) {
  const { pts } = c, m = P.corpo, f0 = m.fascia[0], f1 = m.fascia[1], tex = img.corpo, Wt = tex.width, Ht = tex.height;
  let U = 0;
  for (let i = 0; i < N_CORPO; i++) {
    const p = pts[i], q = pts[i + 1];
    const dx = p.px - q.px, dy = p.py - q.py, len = Math.hypot(dx, dy);
    if (len < 0.01) continue;
    const hw = (p.hw + q.hw) / 2, sy = (2 * hw) / (f1 - f0), du = len / sy;
    U += du;
    // le fette si staccano a blocchi rigidi di 8 (pezzi di corpo, non strisce sottili)
    const b = Math.floor(i / 8), mezzo = pts[Math.min(N_CORPO, b * 8 + 4)];
    const t = tau - 8 * ((b * 8) / N_CORPO);    // l'onda parte dalla testa
    const vita = 9 + rnd(b * 2.3) * 6;
    if (t >= vita) continue;
    let x = q.px, y = q.py, ang = Math.atan2(dy, dx), alfa = 1;
    if (t > 0) {
      const vt = (0.004 + 0.006 * rnd(b * 2.2)) * g.u, vo = (rnd(b * 4.4) - 0.3) * 0.009 * g.u;
      const R = (rnd(b * 6.1) - 0.5) * 0.12 * t;
      let cx = mezzo.px + (mezzo.tx * vt + mezzo.ox * vo) * t, cy = mezzo.py + (mezzo.ty * vt + mezzo.oy * vo) * t;
      const giro = giroVortice(g, cx, cy, t);
      [cx, cy] = vortica(g, cx, cy, giro);
      const rx = q.px - mezzo.px, ry = q.py - mezzo.py, cr = Math.cos(R + giro), sr = Math.sin(R + giro);
      x = cx + rx * cr - ry * sr; y = cy + rx * sr + ry * cr;
      ang += R + giro;
      alfa = 1 - t / vita;
      if (i % 8 === 4 && t < 7) {
        pennellataDipinta(ctx, img, PEN_CORPO[b % PEN_CORPO.length], x, y, ang + Math.PI, hw * 5, (1 - t / 7) * 0.9);
      }
    }
    const sx = ((-U % Wt) + Wt) % Wt, w = Math.min(du, Wt - sx);
    ctx.save();
    ctx.globalAlpha = alfa * SVANISCE;
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.drawImage(tex, sx, 0, w, Ht, 0, -hw - f0 * sy, (w / du) * len * 1.12 + 0.6, Ht * sy);
    ctx.restore();
  }
}

function disegnaDragoInFrantumi(ctx, g, tr, f, img) {
  const tau = f - F.urto;
  if (tau < 0 || tau > 18) return;
  const c = campionaCorpo(g, tr, F.urto);
  const a = 1 - smooth(tau / 6);
  if (a > 0) {
    ctx.save();
    ctx.globalAlpha = a;
    const fase = (2 * Math.PI * F.urto) / 13;
    disegnaAla(ctx, g, c, img, 0.09, poseAla(F.urto, 1.5), 0.82, true);
    disegnaZampa(ctx, g, c, img, "zampa_post", 0.4, fase + 1);
    disegnaZampa(ctx, g, c, img, "zampa_ant", 0.13, fase);
    disegnaCoda(ctx, c, img.coda);
    ctx.restore();
  }
  disegnaCorpoInFrantumi(ctx, g, c, img, tau);
  if (a > 0) {
    ctx.save();
    ctx.globalAlpha = a;
    disegnaAla(ctx, g, c, img, 0.14, poseAla(F.urto), 1, false);
    // la testa affonda nella luce
    const h = c.pts[0];
    ctx.translate(h.tx * tau * 0.006 * g.u, h.ty * tau * 0.006 * g.u);
    disegnaTesta(ctx, g, c, img, F.urto);
    ctx.restore();
  }
}

// 4) onda di luce a spirale dipinta: nasce dal dado, si allarga girando e porta al bianco
function disegnaOnda(ctx, g, f, img) {
  const tau = f - F.urto;
  if (tau < 0) return;
  const a = smooth(tau / 3) * (1 - smooth((tau - 9) / 11));
  if (a <= 0) return;
  const lato = g.u * (0.22 + 0.17 * tau);
  const m = P.esplosione_spirale;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(g.cx, g.cy);
  ctx.rotate(0.06 * tau);
  ctx.drawImage(img.esplosione_spirale, -lato / 2, -(lato * m.h) / m.w / 2, lato, (lato * m.h) / m.w);
  ctx.restore();
}

function disegnaLampo(ctx, g, f) {
  const tau = f - F.urto;
  if (tau < -1.5 || tau > 10) return;
  const a = tau < 0 ? ((tau + 1.5) / 1.5) * 0.5 : Math.exp(-tau / 3);
  const r = g.u * (0.2 + 0.03 * Math.max(0, tau));
  const gr = ctx.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, r);
  gr.addColorStop(0, `rgba(255,250,232,${0.95 * a})`);
  gr.addColorStop(0.4, `rgba(255,222,160,${0.55 * a})`);
  gr.addColorStop(1, "rgba(255,190,110,0)");
  ctx.fillStyle = gr;
  ctx.fillRect(g.cx - r, g.cy - r, r * 2, r * 2);
}

// ---------- Camera: carrellata verso la testa mentre il drago punta il dado ----------
// Dopo l'urto torna sul centro e continua a entrare nell'esplosione.
const CAM = { inizio: 102, zoomUrto: 1.85, zoomFine: 2.7 };
export const FINE_BIANCO = 154; // da qui il fondo è bianco e può comparire il logo

export function camera(g, tr, f) {
  const w = smooth((f - CAM.inizio) / (F.urto - CAM.inizio));
  if (w <= 0) return { s: 1, fx: g.cx, fy: g.cy };
  const fh = Math.min(f, F.urto);
  const [nx, ny, tx, ty] = tr.punto(tr.sAt(fh));
  const avanti = 0.08 * g.u * zoom(fh);
  const mx = (nx + tx * avanti + g.cx) / 2, my = (ny + ty * avanti + g.cy) / 2;
  let fx = g.cx + (mx - g.cx) * w, fy = g.cy + (my - g.cy) * w;
  let s = 1 + (CAM.zoomUrto - 1) * w;
  const tau = f - F.urto;
  if (tau > 0) {
    const k = smooth(tau / 12);
    fx += (g.cx - fx) * k; fy += (g.cy - fy) * k;
    s += (CAM.zoomFine - CAM.zoomUrto) * smooth(tau / 24);
  }
  return { s, fx, fy };
}

// ---------- Parametri del vortice per frame ----------
// Oltre il frame 159 (attesa del caricamento) resta tutto fermo sul bianco e il vortice gira piano.
export function parametriFondo(g, f, cam) {
  const fe = Math.min(f, FRAMES - 1), oltre = Math.max(0, f - (FRAMES - 1));
  const tau = fe - F.urto, sp = fe - F.spirale;
  return {
    ellX: (g.rx / g.u) * 1.25,
    ellY: (g.ry / g.u) * 1.25,
    camS: cam.s, camX: (cam.fx - g.cx) / g.u, camY: (cam.fy - g.cy) / g.u,
    rot: 0.01 * fe + (sp > 0 ? 0.0005 * sp * sp : 0) + (tau > 0 ? 0.0012 * tau * tau : 0) + 0.03 * oltre,
    twist: 1.5 + 0.6 * smooth(sp / 31) + 2.2 * smooth(tau / 16),
    glow: 0.3 + 0.25 * smooth((fe - 112) / 18) + 0.4 * smooth(tau / 10),
    glowR: 0.16 + 0.04 * smooth(sp / 31) + 0.3 * smooth(tau / 22),
    warm: 0.15 * smooth(sp / 30) + 0.75 * smooth(tau / 14),
    flash: tau >= 0 ? 0.8 * Math.exp(-tau / 5) : 0,
    bianco: smooth(tau / (FINE_BIANCO - F.urto)),
  };
}

// ---------- Logo (cartella «sotterranei-e-dragoni logo»): prima l'emblema, poi il titolo ----------
const LOGO = { emblema: 147, titolo: 153 };
function disegnaLogo(ctx, g, f, img) {
  const te = f - LOGO.emblema, tt = f - LOGO.titolo;
  if (te <= 0 || !img.logo_emblema) return;
  const respiro = f > FRAMES - 1 ? 1 + 0.02 * Math.sin(((f - FRAMES + 1) / FPS) * Math.PI * 1.2) : 1;
  const ae = smooth(te / 7);
  const h = 0.64 * g.u * respiro, w = (h * P.logo.w) / P.logo.h;
  // l'emblema si forma dalla luce: entra un po' più grande e si assesta
  const se = 1.06 - 0.06 * smooth(te / 9);
  ctx.save();
  ctx.translate(g.cx, g.cy);
  ctx.globalAlpha = ae;
  ctx.drawImage(img.logo_emblema, (-w / 2) * se, (-h / 2) * se, w * se, h * se);
  if (tt > 0) {
    ctx.globalAlpha = smooth(tt / 6);
    ctx.drawImage(img.logo_titolo, -w / 2, -h / 2 + (1 - smooth(tt / 6)) * 0.015 * g.u, w, h);
  }
  ctx.restore();
}

// ---------- Scena completa ----------
export function disegnaScena(ctx, g, tr, f, img, cam) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, g.W, g.H);
  // mondo, visto dalla camera
  ctx.setTransform(cam.s, 0, 0, cam.s, g.cx - cam.s * cam.fx, g.cy - cam.s * cam.fy);
  SVANISCE = 1 - smooth((f - (F.urto + 4)) / 9);
  disegnaDado(ctx, g, f, img);
  if (f < F.urto) disegnaDrago(ctx, g, tr, f, img);
  disegnaOnda(ctx, g, f, img);
  disegnaSchegge(ctx, g, f, img);
  disegnaDragoInFrantumi(ctx, g, tr, f, img);
  disegnaSchizzi(ctx, g, f, img);
  disegnaLampo(ctx, g, f);
  // schermo
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  disegnaLogo(ctx, g, f, img);
}
