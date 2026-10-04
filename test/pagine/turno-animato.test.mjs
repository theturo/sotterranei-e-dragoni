// Cambio turno animato nel tracker (turno-animato.js): sobrio per tutti,
// scenico solo per il giocatore di turno, mai per il DM; niente animazioni
// con "riduci animazioni".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leggi = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("il tracker monta la cornice del turno e la scena è solo per chi gioca", () => {
  const tracker = leggi("assets/js/combattimento.js");
  assert.match(tracker, /import \{ montaTurnoAnimato \} from "\.\/turno-animato\.js"/);
  assert.match(tracker, /scenico: !isDM && mioTurno/);
});

test("con riduci animazioni la cornice si sposta senza animare", () => {
  const modulo = leggi("assets/js/turno-animato.js");
  assert.match(modulo, /prefers-reduced-motion: reduce/);
  assert.match(modulo, /if \(stesso \|\| ridotto\(\)\) \{\n\s+posiziona\(arrivo, riga\);/);
  const css = leggi("assets/css/sessione.css");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\n\s+\.turno-cornice\.turno-mio,\n\s+\.banner-turno \{\n\s+animation: none;/);
});
