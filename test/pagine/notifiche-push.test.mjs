// Notifiche push: ogni tipo di avviso creato dal sito nella campanella ha il
// suo testo nella campanella (menu-utente.js) e il suo messaggio push (Cloud
// Function, functions/logica.js); il service worker le mostra e le apre.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { RADICE } from "../../strumenti/aggiorna-sw.mjs";
import { messaggioPush } from "../../functions/logica.js";

const leggi = (percorso) => readFileSync(join(RADICE, percorso), "utf8");

// Tipi scritti dal sito in auth.js: addDoc(... "notifiche"), { tipo } e notificaMembri(..., { tipo }).
const TIPI = [...new Set([...leggi("assets/js/auth.js")
  .matchAll(/(?:"notifiche"\), \{|notificaMembri\(campagnaId, \{)\s*tipo: "([a-z_]+)"/g)].map((m) => m[1]))];

test("i tipi di notifica del sito sono quelli attesi", () => {
  assert.deepEqual(TIPI.sort(), ["livello_su", "proposta_sessione", "sessione_confermata", "sessione_iniziata", "turno"]);
});

test("ogni tipo ha il testo della campanella e il messaggio push", () => {
  const menu = leggi("assets/js/menu-utente.js");
  // "turno" («Tocca a te») è solo una push: la campanella lo scarta.
  assert.match(menu, /n\.tipo !== "turno"/);
  for (const tipo of TIPI) {
    if (tipo !== "turno") assert.match(menu, new RegExp(`notifica\\.tipo === "${tipo}"`), `${tipo}: manca il testo nella campanella`);
    const messaggio = messaggioPush({ tipo, numero: 1, date: 2, data: "2026-10-03", livelloPrecedente: 1, livelloNuovo: 2, nome: "Kael", round: 1 });
    assert.ok(messaggio, `${tipo}: manca il messaggio push`);
    assert.ok(existsSync(join(RADICE, messaggio.url)), `${tipo}: la pagina ${messaggio.url} non esiste`);
  }
});

test("il service worker mostra le notifiche e le icone esistono", () => {
  const sw = leggi("sw.js");
  assert.match(sw, /addEventListener\("push"/);
  assert.match(sw, /addEventListener\("notificationclick"/);
  for (const [, icona] of sw.matchAll(/_NOTIFICA = "\.\/([^"]+)"/g)) {
    assert.ok(existsSync(join(RADICE, icona)), `${icona} non esiste`);
    assert.match(sw, new RegExp(`"\\./${icona.replace(/[.]/g, "\\.")}"`), `${icona} non è tra i file salvati`);
  }
});
