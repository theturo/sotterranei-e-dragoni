// Usi dei privilegi di classe: quanto cambia il conteggio quando si spende o si
// recupera un uso (scheda completa e scheda rapida usano la stessa funzione).
import { test } from "node:test";
import assert from "node:assert/strict";
import { usiDopoVariazione } from "../../assets/js/privilegi.js";

const barbaro = { classe: "barbaro", livello: 3, usiPrivilegi: {} }; // Ira: 3 usi

test("spendere un uso lo aggiunge ai conteggi, lasciando gli altri", () => {
  const scheda = { ...barbaro, usiPrivilegi: { altro: 1 } };
  assert.deepEqual(usiDopoVariazione(scheda, "ira", 1), { altro: 1, ira: 1 });
});

test("il conteggio non supera il massimo né scende sotto zero", () => {
  assert.equal(usiDopoVariazione({ ...barbaro, usiPrivilegi: { ira: 3 } }, "ira", 1), null);
  assert.equal(usiDopoVariazione(barbaro, "ira", -1), null);
  assert.deepEqual(usiDopoVariazione(barbaro, "ira", 5), { ira: 3 });
});

test("tornando a zero la chiave sparisce dai conteggi", () => {
  assert.deepEqual(usiDopoVariazione({ ...barbaro, usiPrivilegi: { ira: 1 } }, "ira", -1), {});
});

test("non modifica la scheda e ignora privilegi sconosciuti o illimitati", () => {
  const scheda = { ...barbaro, usiPrivilegi: { ira: 1 } };
  usiDopoVariazione(scheda, "ira", 1);
  assert.deepEqual(scheda.usiPrivilegi, { ira: 1 });
  assert.equal(usiDopoVariazione(barbaro, "non-esiste", 1), null);
  assert.equal(usiDopoVariazione({ classe: "barbaro", livello: 20, usiPrivilegi: {} }, "ira", 1), null);
});
