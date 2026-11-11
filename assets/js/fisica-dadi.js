// Fisica della vaschetta: i dadi sono corpi rigidi che cadono su un fondo,
// urtano le pareti e tra loro, rotolano con l'attrito e si fermano appoggiati
// su una faccia. Solo calcoli, niente pagina: si prova con Node.
// - Il lancio si calcola tutto prima (pochi millisecondi) e si registra a
//   fotogrammi; la pagina poi lo riproduce (vaschetta.js). Così il disegno non
//   aspetta mai i conti, e un lancio finito storto (dado in bilico) o di durata
//   sbagliata si scarta e si rifà.
// - Unità: 1 = raggio del dado. Asse z verso l'alto, fondo a z = 0, interno
//   della vaschetta largo W (x) e profondo D (y), centrato nell'origine.
// - Urti con fondo e pareti: ogni vertice che penetra riceve un impulso
//   (rimbalzo + attrito). Tra dadi: come sfere, basta e non si incastrano.
import { v, q } from "./geometria-3d.js";
import { poliedro } from "./poliedri.js";
import { casuale } from "./movimento.js";

export const FISICA = {
  gravita: 50,
  passo: 1 / 480,          // secondi per passo di calcolo
  ogni: 4,                 // un fotogramma registrato ogni 4 passi (120 al secondo)
  // Il lancio: da quanto in alto, dove atterrano i dadi, con quanto slancio e quanto giro.
  quotaPartenza: 6.8,
  atterraggio: [0.42, 0.34], // primo tocco tra il 42% e il 76% della profondità
  slancio: 1.15,           // quanto la spinta supera quella che basta ad arrivarci
  giro: [25, 16],          // velocità di rotazione: minimo e quanto può crescere
  rimbalzoFondo: 0.56,
  rimbalzoParete: 0.55,
  rimbalzoDadi: 0.45,
  attrito: 0.45,
  sogliaRimbalzo: 1.2,     // sotto questa velocità d'urto non si rimbalza più
  inerzia: 0.26,           // come una sfera piena di raggio 0,8
  raggioUrto: 0.94,        // raggio della sfera usata negli urti tra dadi
  frenoAria: 0.25,
  frenoGiro: 0.28,         // freno alla rotazione mentre il dado tocca il fondo
  frenoStriscio: 0.15,
  tempoMassimo: 5.5,
  durataMinima: 1.3,       // un lancio più breve o più lungo si scarta e si rifà
  durataMassima: 3.6,
};

const GIU = [0, 0, -1];
const normalizza = (a) => {
  const l = Math.hypot(a[0], a[1], a[2], a[3]);
  return [a[0] / l, a[1] / l, a[2] / l, a[3] / l];
};

// Avanza la rotazione di dt con la velocità angolare w (nel mondo).
function gira(rot, w, dt) {
  const d = q.mul([0, w[0], w[1], w[2]], rot);
  return normalizza([rot[0] + 0.5 * dt * d[0], rot[1] + 0.5 * dt * d[1], rot[2] + 0.5 * dt * d[2], rot[3] + 0.5 * dt * d[3]]);
}

// La faccia più rivolta in giù e quanto è piatta (1 = perfettamente appoggiata).
export function facciaSotto(solido, rot) {
  let migliore = 0;
  let quanto = -2;
  solido.normali.forEach((n, i) => {
    const giu = -q.ruota(rot, n)[2];
    if (giu > quanto) {
      quanto = giu;
      migliore = i;
    }
  });
  return { faccia: migliore, piatta: quanto };
}

// La posa esattamente appoggiata sulla faccia: rotazione e quota del centro.
function appoggia(solido, rot, faccia) {
  const n = q.ruota(rot, solido.normali[faccia]);
  return { rot: normalizza(q.mul(q.da(n, GIU), rot)), quota: v.dot(solido.centri[faccia], solido.normali[faccia]) };
}

// Posizioni e spinte di partenza: i dadi partono raccolti, come da una mano,
// in alto sopra il lato vicino (quello di chi lancia), e si aprono a ventaglio
// verso punti diversi della vaschetta. La spinta è quella che li fa atterrare
// dentro, prima della parete di fondo: così rimbalzano sul fondo e sulle
// pareti, non contro il vuoto sopra il bordo. Più la vaschetta è larga, più
// lontano possono andare e più forte è il lancio.
function partenze(solidi, W, D, rnd, P) {
  const perFila = Math.max(1, Math.min(4, Math.floor((W - 1.4) / 2.3)));
  return solidi.map((solido, i) => {
    const fila = Math.floor(i / perFila);
    const inFila = Math.min(perFila, solidi.length - fila * perFila);
    const colonna = i - fila * perFila;
    const asse = v.norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]);
    const p = [(colonna - (inFila - 1) / 2) * 2.3 + (rnd() - 0.5) * 0.3, -D / 2 + 1.25 + rnd() * 0.3, P.quotaPartenza + fila * 2.4 + rnd() * 0.6];
    const giu = 2 + rnd() * 3;
    // Tempo di caduta fino al fondo e punto del primo tocco.
    const caduta = (-giu + Math.sqrt(giu * giu + 2 * P.gravita * (p[2] - 0.9))) / P.gravita;
    const meta = [(rnd() - 0.5) * Math.max(0, W - 3.2), Math.min(D / 2 - 1.4, -D / 2 + D * (P.atterraggio[0] + rnd() * P.atterraggio[1]))];
    return {
      solido,
      p,
      vel: [((meta[0] - p[0]) / caduta) * P.slancio, ((meta[1] - p[1]) / caduta) * P.slancio, -giu],
      rot: q.asse(v.norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]), rnd() * Math.PI * 2),
      w: v.mul(asse, P.giro[0] + rnd() * P.giro[1]),
      fermo: false,
      quieto: 0,
      assesta: null,
      spinte: 0,
      tocca: false,
    };
  });
}

// Un urto del dado contro un piano (normale n, il dado sta dove n·x ≥ d).
function urtaPiano(d, n, quota, rimbalzo, bracci, P) {
  let fondo = 0;
  for (let giro = 0; giro < 2; giro++) {
    for (const r of bracci) {
      const dist = n[0] * (d.p[0] + r[0]) + n[1] * (d.p[1] + r[1]) + n[2] * (d.p[2] + r[2]) - quota;
      if (dist >= 0) continue;
      if (-dist > fondo) fondo = -dist;
      const u = v.add(d.vel, v.cross(d.w, r));
      const un = v.dot(u, n);
      if (un >= 0) continue;
      const rn = v.cross(r, n);
      const j = (-(1 + (-un > P.sogliaRimbalzo ? rimbalzo : 0)) * un) / (1 + v.dot(rn, rn) / P.inerzia);
      d.vel = v.add(d.vel, v.mul(n, j));
      d.w = v.add(d.w, v.mul(rn, j / P.inerzia));
      // Attrito: frena lo strisciare del punto di contatto, fino a mu volte la spinta.
      const u2 = v.add(d.vel, v.cross(d.w, r));
      const ut = v.sub(u2, v.mul(n, v.dot(u2, n)));
      const lt = v.len(ut);
      if (lt < 1e-7) continue;
      const t = v.mul(ut, 1 / lt);
      const rt = v.cross(r, t);
      const jt = Math.min(lt / (1 + v.dot(rt, rt) / P.inerzia), P.attrito * j);
      d.vel = v.sub(d.vel, v.mul(t, jt));
      d.w = v.sub(d.w, v.mul(rt, jt / P.inerzia));
    }
  }
  if (fondo > 0) d.p = v.add(d.p, v.mul(n, fondo));
  return fondo > 0;
}

// Simula un lancio. tipi: [20, 6, 6…]. Restituisce i fotogrammi registrati
// ({ p, r } per ogni dado), la durata e se tutti i dadi sono finiti piatti.
export function simula({ tipi, W, D, seme = 1, parametri = FISICA }) {
  const P = parametri;
  const rnd = casuale(seme);
  const dadi = partenze(tipi.map(poliedro), W, D, rnd, P);
  const piani = [
    { n: [0, 0, 1], quota: 0, rimbalzo: P.rimbalzoFondo, fondo: true },
    { n: [1, 0, 0], quota: -W / 2, rimbalzo: P.rimbalzoParete },
    { n: [-1, 0, 0], quota: -W / 2, rimbalzo: P.rimbalzoParete },
    { n: [0, 1, 0], quota: -D / 2, rimbalzo: P.rimbalzoParete },
    { n: [0, -1, 0], quota: -D / 2, rimbalzo: P.rimbalzoParete },
  ];
  const dt = P.passo;
  const fotogrammi = [];
  const registra = () => fotogrammi.push(dadi.map((d) => ({ p: [...d.p], r: [...d.rot] })));
  registra();

  let t = 0;
  let passi = 0;
  while (t < P.tempoMassimo && dadi.some((d) => !d.fermo)) {
    for (const d of dadi) {
      if (d.fermo) continue;
      if (d.assesta) {
        // Ultimi gradi: scivola sulla posa esattamente appoggiata.
        const u = Math.min(1, (t - d.assesta.da) / 0.09);
        const k = u * u * (3 - 2 * u);
        d.rot = normalizza(d.assesta.rot0.map((x, i) => x + (d.assesta.rot1[i] - x) * k));
        d.p = [d.p[0], d.p[1], d.assesta.z0 + (d.assesta.z1 - d.assesta.z0) * k];
        // Raddrizzandosi accanto a una parete un vertice può sporgere: il dado si scosta.
        for (const b of d.solido.vertici) {
          const r = q.ruota(d.rot, b);
          const fuoriX = Math.abs(d.p[0] + r[0]) - W / 2;
          const fuoriY = Math.abs(d.p[1] + r[1]) - D / 2;
          if (fuoriX > 0) d.p[0] -= Math.sign(d.p[0] + r[0]) * fuoriX;
          if (fuoriY > 0) d.p[1] -= Math.sign(d.p[1] + r[1]) * fuoriY;
        }
        if (u >= 1) d.fermo = true;
        continue;
      }
      d.vel = [d.vel[0], d.vel[1], d.vel[2] - P.gravita * dt];
      d.p = v.add(d.p, v.mul(d.vel, dt));
      d.rot = gira(d.rot, d.w, dt);
      const bracci = d.solido.vertici.map((p) => q.ruota(d.rot, p));
      d.tocca = false;
      for (const piano of piani) {
        const toccato = urtaPiano(d, piano.n, piano.quota, piano.rimbalzo, bracci, P);
        if (toccato && piano.fondo) d.tocca = true;
      }
      const freno = d.tocca ? P.frenoGiro : P.frenoAria;
      d.w = v.mul(d.w, 1 - freno * dt);
      if (d.tocca) d.vel = [d.vel[0] * (1 - P.frenoStriscio * dt), d.vel[1] * (1 - P.frenoStriscio * dt), d.vel[2]];
    }

    // Urti tra dadi, come sfere.
    for (let a = 0; a < dadi.length; a++) {
      for (let b = a + 1; b < dadi.length; b++) {
        const A = dadi[a];
        const B = dadi[b];
        const tra = v.sub(B.p, A.p);
        const dist = v.len(tra);
        const sovrapposti = 2 * P.raggioUrto - dist;
        if (sovrapposti <= 0 || dist < 1e-6) continue;
        const n = v.mul(tra, 1 / dist);
        const mobileA = !A.fermo && !A.assesta;
        const mobileB = !B.fermo && !B.assesta;
        if (!mobileA && !mobileB) continue;
        const quotaA = mobileA ? (mobileB ? 0.5 : 1) : 0;
        A.p = v.sub(A.p, v.mul(n, sovrapposti * quotaA));
        B.p = v.add(B.p, v.mul(n, sovrapposti * (1 - quotaA)));
        const avvicinamento = v.dot(v.sub(B.vel, A.vel), n);
        if (avvicinamento >= 0) continue;
        const j = (-(1 + P.rimbalzoDadi) * avvicinamento) / (mobileA && mobileB ? 2 : 1);
        if (mobileA) A.vel = v.sub(A.vel, v.mul(n, j));
        if (mobileB) B.vel = v.add(B.vel, v.mul(n, j));
        // Un urto fa anche girare un po' i dadi.
        const giro = v.mul(v.cross(n, [0, 0, 1]), j * 0.5);
        if (mobileA) A.w = v.add(A.w, giro);
        if (mobileB) B.w = v.sub(B.w, giro);
      }
    }

    // Chi è quasi fermo e appoggiato si assesta; chi è fermo in bilico riceve una spintarella.
    for (const d of dadi) {
      if (d.fermo || d.assesta) continue;
      const moto = v.dot(d.vel, d.vel) + 0.3 * v.dot(d.w, d.w);
      d.quieto = d.tocca && moto < 0.5 ? d.quieto + dt : 0;
      if (d.quieto < 0.05) continue;
      const { faccia, piatta } = facciaSotto(d.solido, d.rot);
      if (piatta > 0.992) {
        const posa = appoggia(d.solido, d.rot, faccia);
        // Stesso emisfero, per interpolare lungo la via breve.
        const stesso = d.rot.reduce((s, x, i) => s + x * posa.rot[i], 0) >= 0 ? posa.rot : posa.rot.map((x) => -x);
        d.assesta = { da: t, rot0: d.rot, rot1: stesso, z0: d.p[2], z1: posa.quota };
        d.vel = [0, 0, 0];
        d.w = [0, 0, 0];
      } else if (d.quieto > 0.2 && d.spinte < 6) {
        d.w = v.add(d.w, [(rnd() - 0.5) * 5, (rnd() - 0.5) * 5, 0]);
        d.spinte++;
        d.quieto = 0;
      }
    }

    t += dt;
    passi++;
    if (passi % P.ogni === 0) registra();
  }
  registra();

  const valido = dadi.every((d) => d.fermo && facciaSotto(d.solido, d.rot).piatta > 0.9999);
  return { fotogrammi, durata: t, alSecondo: 1 / (dt * P.ogni), valido, finali: dadi.map((d) => ({ p: d.p, rot: d.rot })) };
}

// Prova semi diversi finché il lancio non finisce bene: tutti i dadi piatti e
// una durata né troppo breve né troppo lunga. Se nessuno riesce, o se i conti
// superano il tempo concesso (tanti dadi su un telefono lento), tiene tra i
// provati il migliore: prima i validi, poi la durata più vicina a quella voluta.
export function simulaBene({ tipi, W, D, seme = 1, parametri = FISICA, durataMinima = parametri.durataMinima, durataMassima = parametri.durataMassima, tentativi = 16, tempoConcesso = 90 }) {
  const lontano = (e) => Math.max(0, durataMinima - e.durata, e.durata - durataMassima);
  const inizio = performance.now();
  let scelto = null;
  let fatti = 0;
  for (let k = 0; k < tentativi; k++) {
    const esito = simula({ tipi, W, D, seme: seme + k * 977, parametri });
    fatti = k + 1;
    esito.tentativi = fatti;
    if (esito.valido && lontano(esito) === 0) return esito;
    if (!scelto || (esito.valido && (!scelto.valido || lontano(esito) < lontano(scelto)))) scelto = esito;
    if (performance.now() - inizio > tempoConcesso) break;
  }
  return { ...scelto, tentativi: fatti };
}
