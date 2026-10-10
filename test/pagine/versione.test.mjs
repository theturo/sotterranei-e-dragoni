// Versione dell'app nelle Impostazioni (assets/js/versione.js) e data della
// versione generata in sw.js (strumenti/aggiorna-sw.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nomeVersione, dataCompatta, codiceBreve, versioneNuova } from "../../assets/js/versione.js";
import { RADICE, swAggiornato, INIZIO } from "../../strumenti/aggiorna-sw.mjs";

test("nome compatto: «V. 09.10.2026 · 5818134d»", () => {
  assert.equal(nomeVersione({ versione: "5818134d8efa", data: "2026-10-09" }), "V. 09.10.2026 · 5818134d");
  assert.equal(nomeVersione({ versione: "5818134d8efa", data: null }), "V. 5818134d");
  assert.equal(nomeVersione(null), null);
  assert.equal(dataCompatta("09/10/2026"), null);
  assert.equal(codiceBreve("abc"), "abc");
});

test("versione nuova solo se il codice cambia", () => {
  const a = { versione: "aaa", data: "2026-10-09" };
  assert.equal(versioneNuova(a, { versione: "bbb", data: "2026-10-12" }), true);
  assert.equal(versioneNuova(a, { versione: "aaa", data: "2026-10-09" }), false);
  assert.equal(versioneNuova(a, null), false);
});

test("sw.js porta la data della versione (AAAA-MM-GG)", () => {
  const sw = readFileSync(join(RADICE, "sw.js"), "utf8");
  assert.match(sw, /const DATA_VERSIONE = "\d{4}-\d{2}-\d{2}";/);
  assert.match(sw, /tipo === "versione"/, "il service worker risponde al messaggio «versione»");
});

test("la data cambia solo quando cambia la versione", () => {
  const sw = readFileSync(join(RADICE, "sw.js"), "utf8");
  const data = sw.match(/const DATA_VERSIONE = "([\d-]+)";/)[1];
  // Stesso sito, un altro giorno: la data resta quella di prima.
  assert.equal(swAggiornato(sw, "2099-01-01"), sw);
  // Versione diversa (sito cambiato): prende la data di oggi.
  const vecchio = sw.replace(/const VERSIONE = "[0-9a-f]+";/, 'const VERSIONE = "000000000000";');
  const rigenerato = swAggiornato(vecchio, "2099-01-01");
  assert.match(rigenerato, /const DATA_VERSIONE = "2099-01-01";/);
  assert.notEqual(data, "2099-01-01");
  assert.ok(rigenerato.includes(INIZIO));
});
