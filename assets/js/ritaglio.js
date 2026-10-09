// Inquadratura di un'immagine in un riquadro quadrato (i ritratti e le pedine
// si mostrano in un cerchio). Il "ritaglio" non dipende dalla risoluzione:
//   { x, y } centro del quadrato, in frazioni di larghezza e altezza (0–1);
//   z        zoom: 1 = il quadrato è grande quanto il lato corto, fino a 4;
//   r        proporzioni dell'immagine (larghezza / altezza).
// Così lo stesso ritaglio vale per la miniatura e per l'immagine grande.
// Nessuna dipendenza: lo usano l'editor, le pagine e i test.

export const ZOOM_MASSIMO = 4;

// Arrotonda per non salvare decimali inutili.
const arrotonda = (n) => Math.round(n * 10000) / 10000;

export function ritaglioCentrato(larghezza, altezza) {
  return { x: 0.5, y: 0.5, z: 1, r: arrotonda(larghezza / altezza) };
}

// Un ritaglio salvato è valido? (dati da Firestore: meglio controllare)
export function ritaglioValido(ritaglio) {
  if (!ritaglio || typeof ritaglio !== "object") return false;
  const { x, y, z, r } = ritaglio;
  return [x, y, z, r].every((n) => typeof n === "number" && Number.isFinite(n))
    && x >= 0 && x <= 1 && y >= 0 && y <= 1 && z >= 1 && z <= ZOOM_MASSIMO && r > 0;
}

// Tiene lo zoom tra 1 e il massimo e il quadrato dentro l'immagine.
export function limitaRitaglio({ x, y, z, r }) {
  const zoom = Math.min(ZOOM_MASSIMO, Math.max(1, z));
  const corto = Math.min(r, 1);
  // Metà del lato del quadrato, in frazioni di larghezza e di altezza.
  const mx = corto / (2 * zoom * r);
  const my = corto / (2 * zoom);
  return {
    x: arrotonda(Math.min(1 - mx, Math.max(mx, x))),
    y: arrotonda(Math.min(1 - my, Math.max(my, y))),
    z: arrotonda(zoom),
    r,
  };
}

// Posizione e misure (in % del riquadro quadrato) dell'immagine intera, perché
// nel riquadro si veda proprio il quadrato scelto. Il riquadro deve avere
// position: relative e overflow: hidden.
export function stileRitaglio({ x, y, z, r }) {
  const scala = z / Math.min(r, 1); // lati del riquadro per unità di altezza
  const larghezza = r * scala;
  const altezza = scala;
  const pc = (n) => `${arrotonda(n * 100)}%`;
  return {
    position: "absolute",
    left: pc(0.5 - x * larghezza),
    top: pc(0.5 - y * altezza),
    width: pc(larghezza),
    height: pc(altezza),
    maxWidth: "none",
    objectFit: "fill",
  };
}

// Applica (o toglie) il ritaglio a un <img> dentro un riquadro tondo/quadrato.
export function applicaRitaglio(img, ritaglio) {
  const stile = ritaglioValido(ritaglio) ? stileRitaglio(limitaRitaglio(ritaglio)) : null;
  for (const proprieta of ["position", "left", "top", "width", "height", "maxWidth", "objectFit"]) {
    img.style[proprieta] = stile ? stile[proprieta] : "";
  }
  img.classList.toggle("img-ritagliata", Boolean(stile));
}

// Il quadrato da ritagliare, in pixel dell'immagine.
export function rettangoloSorgente({ x, y, z, r }, larghezza, altezza) {
  const lato = Math.min(larghezza, altezza) / z;
  const sx = Math.min(larghezza - lato, Math.max(0, x * larghezza - lato / 2));
  const sy = Math.min(altezza - lato, Math.max(0, y * altezza - lato / 2));
  return { sx, sy, lato };
}

// Sposta il ritaglio di (dx, dy) pixel di un riquadro largo "lato" pixel
// (trascinando l'immagine verso destra il centro va a sinistra).
export function spostaRitaglio(ritaglio, dx, dy, lato) {
  const scala = ritaglio.z / Math.min(ritaglio.r, 1);
  return limitaRitaglio({
    ...ritaglio,
    x: ritaglio.x - dx / (lato * ritaglio.r * scala),
    y: ritaglio.y - dy / (lato * scala),
  });
}

// Zoom attorno a un punto del riquadro (px, py in frazioni 0–1 del riquadro;
// al centro di default): quel punto dell'immagine resta fermo.
export function zoomRitaglio(ritaglio, zoom, px = 0.5, py = 0.5) {
  const nuovo = Math.min(ZOOM_MASSIMO, Math.max(1, zoom));
  const prima = ritaglio.z / Math.min(ritaglio.r, 1);
  const dopo = nuovo / Math.min(ritaglio.r, 1);
  // Punto dell'immagine sotto (px, py), in frazioni dell'immagine.
  const ix = ritaglio.x + (px - 0.5) / (ritaglio.r * prima);
  const iy = ritaglio.y + (py - 0.5) / prima;
  return limitaRitaglio({
    ...ritaglio,
    z: nuovo,
    x: ix - (px - 0.5) / (ritaglio.r * dopo),
    y: iy - (py - 0.5) / dopo,
  });
}
