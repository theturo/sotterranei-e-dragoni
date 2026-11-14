// Sessione ridisegnata (D-031): stato nella testata, pannello senza sessione,
// tre schede sul telefono, pannelli blu e pergamena.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const RADICE = new URL("../../", import.meta.url);
const leggi = (f) => readFileSync(new URL(f, RADICE), "utf8");
const html = leggi("sessione.html");
const js = leggi("assets/js/pagine/sessione.js");
const stili = leggi("assets/css/sessione.css");

test("la testata ha il chip di stato, «Chiudi sessione» e il posto della scheda rapida", () => {
  const testata = html.slice(html.indexOf('<header class="rd-testata-pagina">'), html.indexOf("</header>"));
  for (const id of ["rd-riga-campagna", "badge-stato-sessione", "btn-chiudi-sessione", "slot-scheda-rapida"]) {
    assert.match(testata, new RegExp(`id="${id}"`), id);
  }
  assert.doesNotMatch(html, /id="controlli-dm"/);
  assert.match(leggi("assets/js/scheda-rapida.js"), /getElementById\("slot-scheda-rapida"\) \|\| document\.body\)\.append\(bottone\)/);
});

test("senza sessione c'è il pannello con la prossima e, per il DM, il pulsante per aprirla", () => {
  const intro = html.slice(html.indexOf('id="intro-sessione"'), html.indexOf("</section>", html.indexOf('id="intro-sessione"')));
  for (const id of ["intro-sessione-titolo", "intro-sessione-testo", "btn-apri-sessione", "link-intro-calendario"]) {
    assert.match(intro, new RegExp(`id="${id}"`), id);
  }
  assert.match(js, /hub\.classList\.add\("senza-sessione"\)/);
  assert.match(stili, /\.senza-sessione :is\(\.sessione-pannello-appunti, \.sessione-pannello-contenuti, \.sessione-pannello-musica\)/);
  // Il titolo della sessione in corso arriva da sessioneInCorso.
  assert.match(leggi("assets/js/dati/sessioni.js"), /titolo: dati\.titolo \?\? null/);
});

test("ogni pannello appartiene a una scheda e ha la sua veste", () => {
  const attesi = {
    "sessione-pannello-combattimento": ["rd-blu", "tavolo"],
    "sessione-pannello-mappa": ["rd-blu", "tavolo"],
    "sessione-pannello-dadi": ["rd-blu", "tavolo"],
    "sessione-pannello-appunti": ["rd-perg", "diario"],
    "sessione-pannello-contenuti": ["rd-blu", "diario"],
    "sessione-pannello-party": ["rd-perg", "party"],
    "sessione-pannello-musica": ["rd-blu", "party"],
  };
  for (const [classe, [veste, scheda]] of Object.entries(attesi)) {
    const tag = html.match(new RegExp(`<div class="panel ([a-z-]+) ${classe}"[^>]*>`));
    assert.ok(tag, classe);
    assert.equal(tag[1], veste, classe);
    assert.match(tag[0], new RegExp(`data-scheda="${scheda}"`), classe);
  }
  // Scena a sinistra, tavolo a destra.
  const scena = html.slice(html.indexOf("sessione-scena"), html.indexOf("sessione-tavolo"));
  assert.match(scena, /pannello-combattimento[\s\S]*pannello-mappa[\s\S]*pannello-contenuti[\s\S]*pannello-musica/);
  const tavolo = html.slice(html.indexOf("sessione-tavolo"));
  assert.match(tavolo, /pannello-party[\s\S]*pannello-dadi[\s\S]*pannello-appunti/);
});

test("le schede del telefono mostrano solo i pannelli scelti e segnano le novità", () => {
  for (const scheda of ["tavolo", "diario", "party"]) {
    assert.match(html, new RegExp(`class="sessione-scheda" data-scheda="${scheda}"`));
    assert.match(stili, new RegExp(`\\[data-scheda="${scheda}"\\] \\.panel\\[data-scheda\\]:not\\(\\[data-scheda="${scheda}"\\]\\)`));
  }
  assert.match(js, /segnaNovita\("tavolo"\)/);
  assert.match(js, /segnaNovita\("diario"\)/);
});
