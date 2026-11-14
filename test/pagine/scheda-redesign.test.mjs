// Scheda personaggio ridisegnata (D-032): testata blu con i numeri chiave,
// barra fissa, schede e riquadri in pergamena.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const RADICE = new URL("../../", import.meta.url);
const leggi = (f) => readFileSync(new URL(f, RADICE), "utf8");
const html = leggi("scheda-personaggio.html");
const js = leggi("assets/js/pagine/scheda-personaggio.js");
const stili = leggi("assets/css/scheda.css");

test("la testata ha ritratto, nome e i numeri chiave, PF compresi", () => {
  const testata = html.slice(html.indexOf('id="scheda-testata"'), html.indexOf('class="scheda-fissa"'));
  for (const id of ["ritratto-img", "scheda-nome-valore", "scheda-classe-livello", "btn-livello-su", "input-background", "btn-allineamento", "valore-ca", "valore-iniziativa", "valore-velocita", "testata-pf", "testata-pf-barra"]) {
    assert.match(testata, new RegExp(`id="${id}"`), id);
  }
  assert.match(js, /document\.getElementById\("box-iniziativa"\)\.addEventListener\("click"/);
  // La targhetta compare solo in sola lettura.
  assert.match(html, /id="badge-stato" class="scheda-sola-lettura" hidden>Sola lettura</);
  assert.doesNotMatch(js, /Alcuni campi non sono ancora modificabili/);
});

test("cinque schede, una per sezione, e Magia solo per chi ha incantesimi", () => {
  for (const nome of ["comb", "car", "magia", "zaino", "storia"]) {
    assert.match(html, new RegExp(`data-scheda-vai="${nome}"`), nome);
    assert.match(html, new RegExp(`data-pannello="${nome}"`), nome);
    assert.match(stili, new RegExp(`\\.scheda-pannelli\\[data-scheda="${nome}"\\] > \\[data-pannello\\]:not\\(\\[data-pannello="${nome}"\\]\\)`), nome);
  }
  const sezione = (nome) => html.slice(html.indexOf(`data-pannello="${nome}"`), html.indexOf("</section>", html.indexOf(`data-pannello="${nome}"`)));
  assert.match(sezione("comb"), /id="hp-attuali"[\s\S]*id="corpo-attacchi"[\s\S]*id="box-privilegi"/);
  assert.match(sezione("car"), /id="griglia-caratteristiche"[\s\S]*id="lista-salvezze"[\s\S]*id="lista-abilita"/);
  assert.match(html.slice(html.indexOf('data-pannello="magia"')), /id="sezione-incantesimi"[\s\S]*id="sezione-incantesimi-razza"/);
  assert.match(sezione("zaino"), /id="moneta-oro"[\s\S]*id="equip-indossato-wrap"[\s\S]*id="lista-inventario"/);
  assert.match(sezione("storia"), /id="personalita-tratti"[\s\S]*id="lista-talenti"[\s\S]*id="competenze-linguaggi"/);
  assert.match(js, /function aggiornaSchedaMagia\(\)/);
  // La guida apre la scheda dove sta la sezione che indica.
  assert.match(leggi("assets/js/guida-personaggio.js"), /closest\("\[data-pannello\]"\)/);
});

test("la barra fissa segue la testata e cambia i PF di uno alla volta", () => {
  for (const id of ["scheda-barra-fissa", "barra-fissa-nome", "barra-fissa-pf", "barra-fissa-ca", "btn-pf-meno", "btn-pf-piu"]) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  assert.match(js, /new IntersectionObserver\(/);
  assert.match(js, /addEventListener\("click", \(\) => cambiaPf\(-1\)\)/);
  assert.match(stili, /\.scheda-fissa \{\s+position: sticky;/);
});
