// Inquadratura delle immagini (assets/js/ritaglio.js): calcoli del ritaglio
// quadrato, indipendenti dalla risoluzione.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ritaglioCentrato,
  ritaglioValido,
  limitaRitaglio,
  stileRitaglio,
  rettangoloSorgente,
  spostaRitaglio,
  zoomRitaglio,
} from "../../assets/js/ritaglio.js";

const vicino = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test("centrato: un ritratto alto 3:4 mostra il quadrato centrale", () => {
  const r = ritaglioCentrato(300, 400);
  assert.deepEqual(r, { x: 0.5, y: 0.5, z: 1, r: 0.75 });
  assert.deepEqual(rettangoloSorgente(r, 300, 400), { sx: 0, sy: 50, lato: 300 });
});

test("il quadrato resta dentro l'immagine e lo zoom tra 1 e 4", () => {
  // Immagine alta: in orizzontale non ci si sposta, in verticale fino ai bordi.
  assert.deepEqual(limitaRitaglio({ x: 0.1, y: 0, z: 1, r: 0.75 }), { x: 0.5, y: 0.375, z: 1, r: 0.75 });
  assert.deepEqual(limitaRitaglio({ x: 0.5, y: 1, z: 1, r: 0.75 }), { x: 0.5, y: 0.625, z: 1, r: 0.75 });
  assert.equal(limitaRitaglio({ x: 0.5, y: 0.5, z: 9, r: 1 }).z, 4);
  assert.equal(limitaRitaglio({ x: 0.5, y: 0.5, z: 0.2, r: 1 }).z, 1);
});

test("lo stile CSS mostra nel riquadro proprio il quadrato scelto", () => {
  // Ritratto 3:4 con il viso in alto: quadrato in cima all'immagine.
  const s = stileRitaglio({ x: 0.5, y: 0.375, z: 1, r: 0.75 });
  assert.equal(s.width, "100%");
  assert.equal(s.height, "133.3333%");
  assert.equal(s.left, "0%");
  assert.equal(s.top, "0%");
  // Immagine larga 2:1, zoom 2 sul quarto di destra.
  const l = stileRitaglio({ x: 0.75, y: 0.5, z: 2, r: 2 });
  assert.equal(l.width, "400%");
  assert.equal(l.height, "200%");
  assert.equal(l.left, "-250%");
  assert.equal(l.top, "-50%");
});

test("il ritaglio in pixel coincide con quello mostrato", () => {
  const rit = { x: 0.75, y: 0.5, z: 2, r: 2 };
  // 800×400: quadrato di 200 px centrato in (600, 200).
  assert.deepEqual(rettangoloSorgente(rit, 800, 400), { sx: 500, sy: 100, lato: 200 });
  // Stessa inquadratura sulla miniatura 480×240: stesse proporzioni.
  assert.deepEqual(rettangoloSorgente(rit, 480, 240), { sx: 300, sy: 60, lato: 120 });
});

test("trascinare sposta il centro al contrario, nei limiti", () => {
  const r = ritaglioCentrato(300, 400);
  // Riquadro di 300 px: trascinare giù di 30 px fa salire il centro di 30/400.
  vicino(spostaRitaglio(r, 0, 30, 300).y, 0.5 - 30 / 400);
  // Oltre il bordo si ferma.
  vicino(spostaRitaglio(r, 0, 500, 300).y, 0.375);
  assert.equal(spostaRitaglio(r, 100, 0, 300).x, 0.5);
});

test("lo zoom tiene fermo il punto sotto il dito", () => {
  const r = { x: 0.5, y: 0.5, z: 1, r: 1 };
  const z = zoomRitaglio(r, 2, 0.25, 0.25);
  assert.equal(z.z, 2);
  // Il punto in alto a sinistra (0,25; 0,25) dell'immagine resta allo stesso
  // posto del riquadro: il nuovo centro va a (0,375; 0,375).
  vicino(z.x, 0.375);
  vicino(z.y, 0.375);
  // Al centro il centro non cambia.
  assert.deepEqual(zoomRitaglio(r, 3), { x: 0.5, y: 0.5, z: 3, r: 1 });
});

test("ritaglioValido scarta i dati malformati", () => {
  assert.ok(ritaglioValido({ x: 0.5, y: 0.5, z: 1, r: 0.75 }));
  assert.ok(!ritaglioValido(null));
  assert.ok(!ritaglioValido({ x: 0.5, y: 0.5, z: 5, r: 1 }));
  assert.ok(!ritaglioValido({ x: "0.5", y: 0.5, z: 1, r: 1 }));
  assert.ok(!ritaglioValido({ x: 0.5, y: 0.5, z: 1, r: 0 }));
});
