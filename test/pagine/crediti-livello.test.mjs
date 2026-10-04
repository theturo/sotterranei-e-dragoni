// Crediti di livello per campagna: il DM concede (o annulla) livelli nella
// propria campagna, il giocatore li spende con la scheda attiva di quella
// campagna. Il vecchio contatore del profilo resta solo per la migrazione.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const leggi = (percorso) => readFileSync(new URL(`../../${percorso}`, import.meta.url), "utf8");

test("il vecchio contatore del profilo compare solo nella migrazione", () => {
  const pagine = readdirSync(new URL("../../assets/js/pagine/", import.meta.url)).map((f) => `assets/js/pagine/${f}`);
  for (const file of [...pagine, "assets/js/cruscotto-calcoli.js", "assets/js/menu-utente.js"]) {
    assert.doesNotMatch(leggi(file), /livelliDaSpendere/, file);
  }
  const auth = leggi("assets/js/auth.js");
  assert.doesNotMatch(auth, /segnalaLivelloSu/);
  assert.match(auth, /export async function migraCreditiProfilo/);
});

test("la spesa del credito è atomica e segnata con la scheda", () => {
  const auth = leggi("assets/js/auth.js");
  const spesa = auth.slice(auth.indexOf("export async function applicaPassaggioLivello"), auth.indexOf("export async function migraCreditiProfilo"));
  assert.match(spesa, /writeBatch\(db\)/);
  assert.match(spesa, /riferimentoCrediti\(scheda\.campagnaId, scheda\.proprietarioUid\)/);
  assert.match(spesa, /daSpendere: increment\(-1\), schedaId: scheda\.id/);
});

test("il pulsante di livello compare solo sulla scheda attiva", () => {
  const scheda = leggi("assets/js/pagine/scheda-personaggio.js");
  assert.match(scheda, /!soloLettura && scheda\?\.attiva === true && creditiLivello > 0/);
  assert.match(scheda, /ascoltaCreditiLivello\(scheda\.campagnaId, uidCorrente/);
  const elenco = leggi("assets/js/pagine/i-miei-personaggi.js");
  assert.match(elenco, /scheda\.attiva && crediti > 0/);
  assert.match(elenco, /&livello=1/);
});

test("il party del DM mostra «in attesa» e permette di annullare", () => {
  const party = leggi("assets/js/pagine/dm-party.js");
  assert.match(party, /ascoltaCreditiCampagna\(campagnaIdCorrente/);
  assert.match(party, /in attesa · <button type="button" class="livello-annulla" data-azione="annulla">Annulla<\/button>/);
  assert.match(party, /annullaLivello\(campagnaIdCorrente, uid/);
  assert.match(party, /concediLivelli\(campagnaIdCorrente, uid/);
});
