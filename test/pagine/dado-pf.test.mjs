// Dado vita in 3D (dado-pf.js): l'ottaedro mostra davanti il risultato del
// tiro e sulle facce solo numeri possibili per il dado della classe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FACCE, VERTICI, normale, numeriDelDado, posaFinale } from "../../assets/js/dado-pf.js";
import { q } from "../../assets/js/intro-dado.js";

test("otto facce; nel d8 le facce opposte sommano 9", () => {
  assert.equal(FACCE.length, 8);
  const { numeri } = numeriDelDado(8, 1);
  assert.deepEqual([...numeri].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8]);
  FACCE.forEach((f, i) => {
    const opposta = FACCE.findIndex((g) => normale(g).every((x, k) => Math.abs(x + normale(f)[k]) < 1e-9));
    assert.equal(numeri[i] + numeri[opposta], 9);
  });
});

test("per ogni dado vita e risultato la faccia finale porta il risultato", () => {
  for (const facce of [6, 8, 10, 12]) {
    for (let risultato = 1; risultato <= facce; risultato++) {
      const { numeri, finale } = numeriDelDado(facce, risultato);
      assert.equal(numeri[finale], risultato);
      assert.ok(numeri.every((n) => n >= 1 && n <= facce), `d${facce}: ${numeri}`);
    }
  }
});

test("la posa finale porta quella faccia davanti, con una punta in alto", () => {
  FACCE.forEach((f, i) => {
    const rot = posaFinale(i);
    const n = q.ruota(rot, normale(f));
    assert.ok(n[2] > 0.999, `faccia ${i}`);
    const xs = f.map((k) => q.ruota(rot, VERTICI[k]));
    const apice = xs.reduce((a, b) => (b[1] > a[1] ? b : a));
    assert.ok(Math.abs(apice[0]) < 1e-9);
  });
});

test("il passaggio di livello usa il dado 3D, non più l'animazione CSS", () => {
  const scheda = readFileSync(new URL("../../assets/js/pagine/scheda-personaggio.js", import.meta.url), "utf8");
  assert.match(scheda, /lanciaDadoPF\(document\.getElementById\("dado-pf"\), \{ facce: dadoVita, risultato: tiro \}\)/);
  assert.doesNotMatch(scheda, /classList\.add\("in-lancio"\)/);
  assert.match(readFileSync(new URL("../../scheda-personaggio.html", import.meta.url), "utf8"), /id="dado-pf"/);
});
