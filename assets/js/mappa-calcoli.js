// Calcoli della mappa della sessione: griglia, caselle, distanze, telecamera
// (spostamento e zoom), taratura con due clic. Niente DOM: si prova con Node.
//
// Coordinate: "mappa" = pixel dell'immagine; "schermo" = pixel CSS dentro la
// finestra della mappa. La telecamera { x, y, z } porta la mappa sullo
// schermo: schermo = mappa × z + (x, y).
// Le pedine stanno in caselle { c, r } (colonna e riga, da 0; decimali se la
// pedina non è agganciata alla griglia).

export const METRI_PER_CASELLA = 1.5;

// Telecamera che mostra tutto il rettangolo (in pixel della mappa) dentro una
// finestra larga "vw" e alta "vh", centrato.
export function camPerRettangolo(vw, vh, { x, y, w, h }, margine = 1) {
  const z = Math.min(vw / w, vh / h) * margine;
  return { x: (vw - w * z) / 2 - x * z, y: (vh - h * z) / 2 - y * z, z };
}

export const camAdatta = (vw, vh, larghezza, altezza) =>
  camPerRettangolo(vw, vh, { x: 0, y: 0, w: larghezza, h: altezza }, 0.96);

// Il rettangolo della mappa visibile con una certa telecamera.
export const rettangoloVisibile = (vw, vh, cam) => ({ x: -cam.x / cam.z, y: -cam.y / cam.z, w: vw / cam.z, h: vh / cam.z });

export const daSchermo = (cam, sx, sy) => ({ x: (sx - cam.x) / cam.z, y: (sy - cam.y) / cam.z });

// Zoom attorno a un punto dello schermo, che resta fermo sotto il dito.
export function zoomIntorno(cam, sx, sy, fattore, minimo, massimo) {
  const z = Math.min(massimo, Math.max(minimo, cam.z * fattore));
  const k = z / cam.z;
  return { x: sx - (sx - cam.x) * k, y: sy - (sy - cam.y) * k, z };
}

// Telecamera con quel punto della mappa al centro della finestra.
export const camCentrata = (vw, vh, punto, z) => ({ x: vw / 2 - punto.x * z, y: vh / 2 - punto.y * z, z });

// Taglie delle creature e caselle per lato che occupano (Manuale dei Mostri).
export const TAGLIE = [
  { chiave: "minuscola", nome: "Minuscola", caselle: 1 },
  { chiave: "piccola", nome: "Piccola", caselle: 1 },
  { chiave: "media", nome: "Media", caselle: 1 },
  { chiave: "grande", nome: "Grande", caselle: 2 },
  { chiave: "enorme", nome: "Enorme", caselle: 3 },
  { chiave: "mastodontica", nome: "Mastodontica", caselle: 4 },
];

export const caselleTaglia = (chiave) => TAGLIE.find((t) => t.chiave === chiave)?.caselle || 1;

// Una pedina grande "n" caselle sta con l'angolo in alto a sinistra in { c, r }:
// il centro è a metà del suo quadrato.
export const centroCasella = (griglia, { c, r }, n = 1) => ({
  x: griglia.ox + (c + n / 2) * griglia.lato,
  y: griglia.oy + (r + n / 2) * griglia.lato,
});

// Casella (con decimali) di una pedina larga "n" il cui centro è nel punto indicato.
export const casellaDaCentro = (griglia, { x, y }, n = 1) => ({
  c: (x - griglia.ox) / griglia.lato - n / 2,
  r: (y - griglia.oy) / griglia.lato - n / 2,
});

export const aggancia = ({ c, r }) => ({ c: Math.round(c), r: Math.round(r) });

// Distanza in caselle come nel Manuale del Giocatore: ogni passo, anche in
// diagonale, vale una casella. Si misura tra le caselle più vicine.
export function caselleTra(da, a) {
  const p = aggancia(da);
  const q = aggancia(a);
  return Math.max(Math.abs(q.c - p.c), Math.abs(q.r - p.r));
}

export const formattaMetri = (metri) => String(Math.round(metri * 10) / 10).replace(".", ",");

// "7,5 m di 9 m" (o solo "7,5 m" se la velocità non è nota).
export function testoDistanza(caselle, velocita) {
  const metri = caselle * METRI_PER_CASELLA;
  const testo = velocita ? `${formattaMetri(metri)} m di ${formattaMetri(velocita)} m` : `${formattaMetri(metri)} m`;
  return { metri, testo, oltre: Boolean(velocita) && metri > velocita };
}

// Taratura con due clic: due angoli opposti di un blocco di "caselle" ×
// "caselle" caselle (punti in pixel della mappa). Il lato è la media dei due
// lati misurati; lo scarto è la posizione dell'angolo riportata dentro una
// casella.
export function taratura(p1, p2, caselle = 1) {
  const n = Math.max(1, Math.round(caselle));
  const lato = (Math.abs(p2.x - p1.x) + Math.abs(p2.y - p1.y)) / 2 / n;
  if (!(lato >= 4)) return null;
  const resto = (v) => ((v % lato) + lato) % lato;
  const arrotonda = (v) => Math.round(v * 10) / 10;
  const latoFinale = arrotonda(lato);
  return {
    lato: latoFinale,
    ox: Math.min(arrotonda(resto(Math.min(p1.x, p2.x))), latoFinale),
    oy: Math.min(arrotonda(resto(Math.min(p1.y, p2.y))), latoFinale),
  };
}

// Caselle libere attorno a "centro", dalla più vicina (per piazzare il party
// senza sovrapporre le pedine).
export function caselleLibereIntorno(centro, quante, occupate = []) {
  const prese = new Set(occupate.map((p) => `${Math.round(p.c)},${Math.round(p.r)}`));
  const valido = Number.isFinite(centro?.c) && Number.isFinite(centro?.r);
  const base = valido ? aggancia(centro) : { c: 0, r: 0 };
  const risultato = [];
  for (let raggio = 0; risultato.length < quante && raggio < 50; raggio += 1) {
    for (let dr = -raggio; dr <= raggio && risultato.length < quante; dr += 1) {
      for (let dc = -raggio; dc <= raggio && risultato.length < quante; dc += 1) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== raggio) continue;
        const cella = { c: base.c + dc, r: base.r + dr };
        const chiave = `${cella.c},${cella.r}`;
        if (cella.c < 0 || cella.r < 0 || prese.has(chiave)) continue;
        prese.add(chiave);
        risultato.push(cella);
      }
    }
  }
  return risultato;
}

// Righe della griglia da disegnare sopra una mappa larga "larghezza" e alta "altezza".
export function righeGriglia(griglia, larghezza, altezza) {
  const verticali = [];
  const orizzontali = [];
  if (!(griglia.lato >= 4)) return { verticali, orizzontali };
  for (let x = griglia.ox; x <= larghezza; x += griglia.lato) verticali.push(x);
  for (let y = griglia.oy; y <= altezza; y += griglia.lato) orizzontali.push(y);
  return { verticali, orizzontali };
}

export const coloreSalute = (quota) => (quota > 0.5 ? "#3f8f5a" : quota > 0.25 ? "#c98a27" : "#b8323f");

// ---------- Nebbia di guerra ----------
// La nebbia copre caselle della griglia della mappa: { attiva, c0, r0,
// colonne, righe, celle } con "celle" un Uint8Array (1 = coperta) riga per
// riga, a partire dalla casella (c0, r0). c0/r0 valgono -1 quando lo scarto
// della griglia lascia una casella parziale sul bordo sinistro/alto.

export function dimensioniNebbia(griglia, larghezza, altezza) {
  const c0 = griglia.ox > 0 ? -1 : 0;
  const r0 = griglia.oy > 0 ? -1 : 0;
  return {
    c0,
    r0,
    colonne: Math.max(1, Math.ceil((larghezza - griglia.ox) / griglia.lato) - c0),
    righe: Math.max(1, Math.ceil((altezza - griglia.oy) / griglia.lato) - r0),
  };
}

export function creaNebbia(dimensioni, coperta = true, attiva = true) {
  return { attiva, ...dimensioni, celle: new Uint8Array(dimensioni.colonne * dimensioni.righe).fill(coperta ? 1 : 0) };
}

// Riporta una nebbia salvata sulle dimensioni attuali (la griglia può essere
// stata ritarata): le caselle in comune restano, le nuove sono coperte.
export function adattaNebbia(salvata, dimensioni) {
  const uguali = salvata.c0 === dimensioni.c0 && salvata.r0 === dimensioni.r0
    && salvata.colonne === dimensioni.colonne && salvata.righe === dimensioni.righe;
  if (uguali) return salvata;
  const nuova = creaNebbia(dimensioni, true, salvata.attiva);
  for (let j = 0; j < nuova.righe; j += 1) {
    for (let i = 0; i < nuova.colonne; i += 1) {
      const c = i + nuova.c0;
      const r = j + nuova.r0;
      const si = c - salvata.c0;
      const sj = r - salvata.r0;
      if (si >= 0 && sj >= 0 && si < salvata.colonne && sj < salvata.righe) {
        nuova.celle[j * nuova.colonne + i] = salvata.celle[sj * salvata.colonne + si];
      }
    }
  }
  return nuova;
}

export function cellaCoperta(nebbia, c, r) {
  if (!nebbia?.attiva) return false;
  const i = c - nebbia.c0;
  const j = r - nebbia.r0;
  if (i < 0 || j < 0 || i >= nebbia.colonne || j >= nebbia.righe) return true;
  return nebbia.celle[j * nebbia.colonne + i] === 1;
}

// Nuova nebbia con le caselle indicate ([[c, r], …]) coperte o svelate.
export function cambiaCelle(nebbia, caselle, coperta) {
  const celle = nebbia.celle.slice();
  for (const [c, r] of caselle) {
    const i = c - nebbia.c0;
    const j = r - nebbia.r0;
    if (i >= 0 && j >= 0 && i < nebbia.colonne && j < nebbia.righe) celle[j * nebbia.colonne + i] = coperta ? 1 : 0;
  }
  return { ...nebbia, celle };
}

export const casellaDiPunto = (griglia, { x, y }) => ({
  c: Math.floor((x - griglia.ox) / griglia.lato),
  r: Math.floor((y - griglia.oy) / griglia.lato),
});

export function casellePennello({ c, r }, lato = 1) {
  const m = Math.floor(lato / 2);
  const caselle = [];
  for (let dr = -m; dr <= m; dr += 1) for (let dc = -m; dc <= m; dc += 1) caselle.push([c + dc, r + dr]);
  return caselle;
}

export function caselleRettangolo(a, b) {
  const caselle = [];
  for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r += 1) {
    for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c += 1) caselle.push([c, r]);
  }
  return caselle;
}

// Caselle entro "raggio" caselle dal centro (una torcia).
export function caselleCerchio({ c, r }, raggio) {
  const caselle = [];
  for (let dr = -raggio; dr <= raggio; dr += 1) {
    for (let dc = -raggio; dc <= raggio; dc += 1) if (dc * dc + dr * dr <= raggio * raggio + 0.5) caselle.push([c + dc, r + dr]);
  }
  return caselle;
}

// Casella al centro di una pedina larga "n": decide se è sotto la nebbia.
export const pedinaSottoNebbia = (nebbia, { c, r }, n = 1) =>
  cellaCoperta(nebbia, Math.floor(c + n / 2), Math.floor(r + n / 2));

// Strisce orizzontali di caselle coperte, in pixel della mappa (meno
// rettangoli da disegnare). "margine" allarga di poco per non lasciare fessure.
export function strisceNebbia(nebbia, griglia, margine = 1) {
  const strisce = [];
  if (!nebbia?.attiva) return strisce;
  const L = griglia.lato;
  for (let j = 0; j < nebbia.righe; j += 1) {
    let inizio = null;
    for (let i = 0; i <= nebbia.colonne; i += 1) {
      const coperta = i < nebbia.colonne && nebbia.celle[j * nebbia.colonne + i] === 1;
      if (coperta && inizio === null) inizio = i;
      if (!coperta && inizio !== null) {
        strisce.push({
          x: griglia.ox + (inizio + nebbia.c0) * L - margine,
          y: griglia.oy + (j + nebbia.r0) * L - margine,
          w: (i - inizio) * L + 2 * margine,
          h: L + 2 * margine,
        });
        inizio = null;
      }
    }
  }
  return strisce;
}

// Codifica compatta per Firestore: un bit per casella, in base64.
export function codificaCelle(celle) {
  const byte = new Uint8Array(Math.ceil(celle.length / 8));
  celle.forEach((v, i) => {
    if (v) byte[i >> 3] |= 1 << (i & 7);
  });
  let testo = "";
  byte.forEach((b) => (testo += String.fromCharCode(b)));
  return btoa(testo);
}

export function decodificaCelle(testo, quante) {
  const celle = new Uint8Array(quante);
  let byte;
  try {
    byte = atob(testo || "");
  } catch {
    return celle.fill(1);
  }
  for (let i = 0; i < quante; i += 1) celle[i] = (byte.charCodeAt(i >> 3) >> (i & 7)) & 1;
  return celle;
}

// ---------- Strumenti: righello e aree degli incantesimi ----------
// Area: { forma: "sfera" | "cono" | "cubo" | "linea", misura (metri), x, y
// (origine, in pixel della mappa), angolo (radianti, direzione) }. Regola su
// griglia: una casella è colpita se il suo centro è dentro la forma. Sfera:
// raggio dall'origine. Cono: largo in ogni punto quanto è distante
// dall'origine. Linea: larga una casella. Cubo: un angolo nell'origine, verso
// il quadrante della direzione.

export const pixelDaMetri = (metri, griglia) => (metri / METRI_PER_CASELLA) * griglia.lato;

export const verticePiuVicino = (griglia, { x, y }) => ({
  x: griglia.ox + Math.round((x - griglia.ox) / griglia.lato) * griglia.lato,
  y: griglia.oy + Math.round((y - griglia.oy) / griglia.lato) * griglia.lato,
});

export const centroCasellaDiPunto = (griglia, punto) => centroCasella(griglia, casellaDiPunto(griglia, punto));

export function puntoInArea(area, griglia, px, py) {
  const R = pixelDaMetri(area.misura, griglia);
  const dx = px - area.x;
  const dy = py - area.y;
  const tolleranza = 0.5;
  if (area.forma === "sfera") return dx * dx + dy * dy <= R * R + tolleranza;
  const ux = Math.cos(area.angolo || 0);
  const uy = Math.sin(area.angolo || 0);
  if (area.forma === "cubo") {
    const sx = ux >= 0 ? 1 : -1;
    const sy = uy >= 0 ? 1 : -1;
    return dx * sx >= 0 && dx * sx <= R && dy * sy >= 0 && dy * sy <= R;
  }
  const lungo = dx * ux + dy * uy;
  const largo = -dx * uy + dy * ux;
  if (area.forma === "cono") return lungo > 0 && lungo <= R + tolleranza && Math.abs(largo) <= lungo / 2 + tolleranza;
  return lungo >= 0 && lungo <= R + tolleranza && Math.abs(largo) <= griglia.lato / 2;
}

// Caselle colpite da un'area ([{ c, r }]).
export function caselleArea(area, griglia) {
  const R = pixelDaMetri(area.misura, griglia) + griglia.lato;
  const da = casellaDiPunto(griglia, { x: area.x - R, y: area.y - R });
  const a = casellaDiPunto(griglia, { x: area.x + R, y: area.y + R });
  const caselle = [];
  for (let r = da.r; r <= a.r; r += 1) {
    for (let c = da.c; c <= a.c; c += 1) {
      const centro = centroCasella(griglia, { c, r });
      if (puntoInArea(area, griglia, centro.x, centro.y)) caselle.push({ c, r });
    }
  }
  return caselle;
}

// Contorno da disegnare: { cerchio: { cx, cy, r } } oppure { punti: [[x, y], …] }.
export function contornoArea(area, griglia) {
  const R = pixelDaMetri(area.misura, griglia);
  if (area.forma === "sfera") return { cerchio: { cx: area.x, cy: area.y, r: R } };
  const ux = Math.cos(area.angolo || 0);
  const uy = Math.sin(area.angolo || 0);
  const p = (lungo, largo) => [area.x + lungo * ux - largo * uy, area.y + lungo * uy + largo * ux];
  if (area.forma === "cono") return { punti: [p(0, 0), p(R, R / 2), p(R, -R / 2)] };
  if (area.forma === "linea") {
    const m = griglia.lato / 2;
    return { punti: [p(0, m), p(R, m), p(R, -m), p(0, -m)] };
  }
  const sx = ux >= 0 ? 1 : -1;
  const sy = uy >= 0 ? 1 : -1;
  return { punti: [[area.x, area.y], [area.x + R * sx, area.y], [area.x + R * sx, area.y + R * sy], [area.x, area.y + R * sy]] };
}

// Pedine dentro un insieme di caselle (una pedina grande basta che ne tocchi una).
export function pedineInCaselle(pedine, caselle) {
  const colpite = new Set(caselle.map(({ c, r }) => `${c},${r}`));
  return pedine.filter((p) => {
    const n = p.caselle || 1;
    const c0 = Math.round(p.c);
    const r0 = Math.round(p.r);
    for (let dr = 0; dr < n; dr += 1) for (let dc = 0; dc < n; dc += 1) if (colpite.has(`${c0 + dc},${r0 + dr}`)) return true;
    return false;
  });
}

// Righello: metri tra le caselle di due punti (la diagonale vale una casella).
export const metriTraPunti = (griglia, da, a) =>
  caselleTra(casellaDiPunto(griglia, da), casellaDiPunto(griglia, a)) * METRI_PER_CASELLA;
