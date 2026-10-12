// Parti comuni dei dadi in 3D (geometria-3d.js): quali facce guardano chi
// osserva, in che ordine si disegnano e di che colore sono.
import { test } from "node:test";
import assert from "node:assert/strict";
import { q, LUCE, facceVisibili, coloreFaccia } from "../../assets/js/geometria-3d.js";
import { FACCE, VERTICI, normale } from "../../assets/js/dado-pf.js";

const NORMALI = FACCE.map(normale);
const FERMO = [1, 0, 0, 0];

test("la luce è un versore", () => {
  assert.ok(Math.abs(Math.hypot(...LUCE) - 1) < 1e-12);
});

test("senza rotazione l'ottaedro mostra le quattro facce rivolte verso chi guarda", () => {
  const visibili = facceVisibili(FERMO, FACCE, VERTICI, NORMALI);
  assert.equal(visibili.length, 4);
  visibili.forEach((fc) => {
    assert.ok(fc.n[2] > 0.05);
    assert.equal(fc.punti.length, 3);
    assert.deepEqual(fc.n, NORMALI[fc.i]);
  });
});

test("le facce visibili vanno dalla più lontana alla più vicina, qualunque sia la rotazione", () => {
  for (const angolo of [0.4, 1.3, 2.9, 4.1]) {
    const rot = q.mul(q.asse([0.3, 1, -0.5], angolo), q.asse([1, 0.2, 0.7], angolo / 2));
    const visibili = facceVisibili(rot, FACCE, VERTICI, NORMALI);
    assert.ok(visibili.length > 0);
    visibili.forEach((fc, k) => {
      assert.ok(fc.n[2] > 0.05);
      if (k > 0) assert.ok(visibili[k - 1].centro[2] <= fc.centro[2]);
    });
  }
});

test("il colore di una faccia: più chiaro se guarda la luce, mai sotto il minimo", () => {
  assert.equal(coloreFaccia([0, 0, -1]), "rgb(108,76,25)"); // di spalle alla luce: luminosità minima 0,3
  assert.equal(coloreFaccia(LUCE), "rgb(220,160,60)"); // rivolta verso la luce: luminosità 1
  assert.equal(coloreFaccia([0, 0, 1]), "rgb(195,141,52)");
});
