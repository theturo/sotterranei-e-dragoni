// Intro dell'app (assets/js/intro-dado.js): il d20 è un d20 vero, finisce
// sempre sul 20 rivolto allo schermo, parte fuori campo e si ferma dove poi
// compare l'icona, alla stessa misura.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  VERTICI, FACCE, NUMERI, FACCIA_20, Q_FINALE, R_INTERNO, RAGGIO_ICONA, DURATA, normale, q, fasi, creaScena,
} from "../../assets/js/intro-dado.js";

const vicino = (a, b, tolleranza = 1e-6) => Math.abs(a - b) <= tolleranza;

test("icosaedro con i numeri da 1 a 20 e facce opposte che sommano 21", () => {
  assert.equal(VERTICI.length, 12);
  assert.equal(FACCE.length, 20);
  assert.deepEqual([...NUMERI].sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 1));
  FACCE.forEach((f, i) => {
    const opposta = FACCE.findIndex((g) => {
      const [a, b] = [normale(f), normale(g)];
      return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] < -0.999;
    });
    assert.equal(NUMERI[i] + NUMERI[opposta], 21);
  });
});

test("nella posa finale il 20 guarda lo schermo e l'esagono ha la punta in su", () => {
  const n = q.ruota(Q_FINALE, normale(FACCE[FACCIA_20]));
  assert.ok(vicino(n[1], 1, 1e-9), `normale del 20: ${n}`);
  const anello = VERTICI.map((p) => q.ruota(Q_FINALE, p)).filter((p) => Math.abs(p[1]) < 0.5);
  assert.ok(anello.some((p) => vicino(p[0], 0, 1e-9) && p[2] < 0), "nessun vertice dell'esagono in alto");
});

for (const [larghezza, altezza] of [[320, 568], [390, 844], [430, 932], [768, 1024]]) {
  test(`schermo ${larghezza}×${altezza}: parte fuori campo e si ferma sotto l'icona`, () => {
    const cx = larghezza / 2, cy = Math.round(altezza * 0.42);
    const scena = creaScena(larghezza, altezza, cx, cy);
    const inizio = scena.proietta(scena.posa(0).pos, scena.F);
    assert.ok(inizio[0] < -60 || inizio[1] < -60, `all'inizio il dado è visibile: ${inizio}`);
    const fine = scena.posa(DURATA);
    assert.ok(vicino(fine.pos[0], 0) && vicino(fine.pos[1], R_INTERNO) && vicino(fine.pos[2], 0), `dado fermo in ${fine.pos}`);
    // il 20 al centro dell'icona, il contorno grande quanto l'esagono dell'icona
    assert.ok(vicino(scena.punto20[0], cx, 0.5) && vicino(scena.punto20[1], cy, 0.5), `20 in ${scena.punto20}`);
    const raggio = Math.max(...VERTICI.map((p) => {
      const s = scena.proietta([...q.ruota(fine.rot, p)].map((x, i) => x + fine.pos[i]), scena.F);
      return Math.hypot(s[0] - cx, s[1] - cy);
    }));
    assert.ok(vicino(raggio, RAGGIO_ICONA, 0.5), `raggio ${raggio}`);
  });
}

test("prima si ferma, poi brilla il 20, poi compaiono icona e titolo", () => {
  assert.equal(fasi(1.25).numero, 0);
  assert.equal(fasi(1.62).numero, 1);
  assert.equal(fasi(1.62).brillio, 0);
  const finale = fasi(DURATA);
  assert.equal(finale.dado, 0);
  assert.equal(finale.icona, 1);
  assert.equal(finale.titolo, 1);
  assert.equal(finale.sottotitolo, 1);
});
