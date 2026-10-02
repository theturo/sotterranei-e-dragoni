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
