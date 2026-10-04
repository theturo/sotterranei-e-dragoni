// Comparsa dei contenuti nella Sessione del giocatore (comparsa-contenuti.js):
// righe riusate, animate solo quelle che entrano o escono, sigillo «Nuovo»
// fino all'apertura, niente movimento con "riduci animazioni".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leggi = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("la Sessione del giocatore usa la comparsa animata, il DM no", () => {
  const sessione = leggi("assets/js/pagine/sessione.js");
  assert.match(sessione, /import \{ montaComparsaContenuti \} from "\.\.\/comparsa-contenuti\.js"/);
  assert.match(sessione, /comparsaContenuti\.aggiorna\(elenco, rigaContenutoGiocatore/);
  assert.match(sessione, /lista\.replaceChildren\(\.\.\.elenco\.map\(rigaContenutoDM\)\)/);
  // Prima dei dati non si disegna: i contenuti già mostrati non sembrano nuovi.
  assert.match(sessione, /if \(!contenutiRicevuti\) return;/);
});

test("riduci animazioni: niente movimento, il sigillo resta", () => {
  const modulo = leggi("assets/js/comparsa-contenuti.js");
  assert.match(modulo, /prefers-reduced-motion: reduce/);
  assert.match(modulo, /const anima = !primaVolta && !ridotto\(\);/);
  assert.match(modulo, /if \(nonVisti\.has\(c\.id\)\) sigillo\(li, c\.id, false\);/);
});
