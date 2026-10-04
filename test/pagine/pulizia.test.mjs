// Pulizia del codice: avvisi, geometria dei dadi e date in un solo posto,
// niente copie nelle pagine.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dataBreve, oraBreve, dataOraBreve, dataBreveIso } from "../../assets/js/calendario.js";
import { v, q, slerp } from "../../assets/js/geometria-3d.js";

const leggi = (percorso) => readFileSync(new URL(`../../${percorso}`, import.meta.url), "utf8");
const pagine = readdirSync(new URL("../../assets/js/pagine/", import.meta.url)).map((f) => `assets/js/pagine/${f}`);

test("gli avvisi (toast) passano tutti da utils.js", () => {
  for (const file of [...pagine, "assets/js/menu-utente.js"]) {
    const testo = leggi(file);
    assert.doesNotMatch(testo, /getElementById\("toast"\)/, file);
    assert.doesNotMatch(testo, /function mostraToast/, file);
  }
  assert.match(leggi("assets/js/utils.js"), /export function mostraToast\(testo, errore = false, durata = 3200\)/);
});

test("i dadi in 3D usano la geometria comune", () => {
  for (const file of ["assets/js/intro-dado.js", "assets/js/dado-caricamento.js", "assets/js/dado-pf.js"]) {
    const testo = leggi(file);
    assert.match(testo, /from "\.\/geometria-3d\.js"/, file);
    assert.doesNotMatch(testo, /const v = \{|function slerp/, file);
  }
  assert.deepEqual(v.cross([1, 0, 0], [0, 1, 0]), [0, 0, 1]);
  const mezzo = slerp([1, 0, 0, 0], q.asse([0, 0, 1], Math.PI / 2), 0.5);
  const atteso = q.asse([0, 0, 1], Math.PI / 4);
  mezzo.forEach((x, i) => assert.ok(Math.abs(x - atteso[i]) < 1e-9));
});

test("date brevi comuni", () => {
  const ts = { toDate: () => new Date(2026, 9, 10, 21, 5) };
  assert.equal(dataBreve(ts), "10/10/2026");
  assert.equal(oraBreve(ts), "21:05");
  assert.equal(dataOraBreve(ts), "10/10/2026, 21:05");
  assert.equal(dataBreve(null, "—"), "—");
  assert.equal(dataBreveIso("2026-10-10"), "10/10/2026");
  assert.equal(dataBreveIso(null), "");
});
