// Kit di suoni (suoni.js): nove ricette WebAudio, interruttore e volume sul
// dispositivo, mai sullo schermo del tavolo, «Tocca a te» mai per il DM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { KIT, TRIM, impostazioniSuoni } from "../../assets/js/suoni.js";

const leggi = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("nove suoni, ognuno con la sua taratura", () => {
  assert.deepEqual(Object.keys(TRIM).sort(), ["critico", "dado", "dadoRapido", "fallito", "livello", "ping", "rivela", "round", "tocca"]);
  for (const id of Object.keys(TRIM)) assert.equal(typeof KIT[id === "dadoRapido" ? "dado" : id], "function", id);
});

test("predefiniti: attivi, volume 60%", () => {
  assert.deepEqual(impostazioniSuoni(), { attivi: true, volume: 0.6 });
});

test("i suoni sono agganciati dove dice la tela", () => {
  const tracker = leggi("assets/js/combattimento.js");
  assert.match(tracker, /if \(!isDM && mioTurno && turnoPrecedente !== [^\n]*\{\n\s+avviso\("Tocca a te!"\);\n\s+if \(turnoPrecedente\) suona\("tocca"\);/);
  assert.match(tracker, /suona\("round"\)/);
  assert.match(leggi("assets/js/comparsa-contenuti.js"), /suona\("rivela"\)/);
  assert.match(leggi("assets/js/dado-pf.js"), /suona\("dado", \(TUMBLE \+ SETTLE\) \/ 1000\)/);
  assert.match(leggi("assets/js/dadi.js"), /suonaTiro\(tiro, durata\)/);
  assert.match(leggi("assets/js/pagine/sessione.js"), /suonaTiro\(tiro\)/);
  assert.match(leggi("assets/js/pagine/scheda-personaggio.js"), /suona\("livello"\)/);
  assert.match(leggi("assets/js/mappa-strumenti.js"), /suona\("ping"\)/);
  assert.doesNotMatch(leggi("assets/js/mappa-strumenti.js"), /AudioContext/);
  assert.match(leggi("assets/js/suoni.js"), /tavolo\\\.html/);
});
