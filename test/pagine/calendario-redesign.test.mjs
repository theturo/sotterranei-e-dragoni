// Calendario ridisegnato (D-033): prossima sessione in evidenza, mese blu,
// liste in pergamena, mese compatto sul telefono, finestra del DM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const RADICE = new URL("../../", import.meta.url);
const leggi = (f) => readFileSync(new URL(f, RADICE), "utf8");
const html = leggi("calendario.html");
const js = leggi("assets/js/pagine/calendario.js");
const stili = leggi("assets/css/calendario.css");
const base = leggi("assets/css/base.css");

test("in cima la prossima sessione, al posto dell'avviso del giorno", () => {
  const hero = html.slice(html.indexOf('id="hero-prossima"'), html.indexOf("</section>", html.indexOf('id="hero-prossima"')));
  for (const id of ["hero-etichetta", "hero-titolo", "hero-quando", "hero-note", "hero-azioni"]) {
    assert.match(hero, new RegExp(`id="${id}"`), id);
  }
  assert.doesNotMatch(html, /id="banner-oggi"/);
  assert.doesNotMatch(js, /banner-oggi|renderBannerOggi/);
  // Il giorno stesso il DM apre la sessione da qui; se è già in corso, ci si va.
  assert.match(js, /if \(oggi && isDM\)[\s\S]*?apriSessione\(campagna\.id\)/);
  assert.match(js, /statoSessione\.inCorso[\s\S]*?"Vai alla sessione"/);
});

test("mese in blu a sinistra, date da scegliere sopra le altre sessioni in pergamena", () => {
  assert.match(html, /<section class="panel rd-blu calendario-mese"/);
  const colonna = html.slice(html.indexOf('class="calendario-colonna"'));
  assert.match(colonna, /<section id="pannello-proposte" class="panel rd-perg calendario-proposte"[\s\S]*<section class="panel rd-perg calendario-prossime"/);
  // La sessione in evidenza non si ripete nell'elenco «Poi in calendario».
  assert.match(html, />Poi in calendario</);
  assert.match(js, /prossimeProgrammate\(\)\.filter\(\(s\) => s\.id !== inEvidenza\?\.id\)/);
});

test("i pannelli blu e pergamena sono comuni, in base.css", () => {
  assert.match(base, /Pannelli del redesign[\s\S]*\.pagina-ridisegnata \.panel\.rd-blu \{[\s\S]*\.pagina-ridisegnata \.panel\.rd-perg \{/);
  assert.doesNotMatch(leggi("assets/css/sessione.css"), /\.pagina-ridisegnata \.panel\.rd-blu \{/);
});

test("sul telefono prima ciò che chiede una risposta e il mese compatto in fondo", () => {
  const unaColonna = stili.slice(stili.indexOf("@media (max-width: 899px)"));
  assert.match(unaColonna, /\.calendario-colonna \{\s*display: contents;/);
  assert.match(unaColonna, /\.calendario-proposte \{\s*order: 1;[\s\S]*\.calendario-prossime \{\s*order: 2;[\s\S]*\.calendario-mese \{\s*order: 3;/);
  const compatto = stili.slice(stili.indexOf("@media (max-width: 640px)"));
  assert.match(compatto, /\.giorno-cal \.evento-cal \{\s*display: none;/);
  assert.match(compatto, /\.pallini-giorno \{\s*display: flex;/);
  assert.match(compatto, /\.calendario-giorno-scelto \{\s*display: flex;/);
  // I giorni sono pulsanti: toccandone uno compare il dettaglio sotto il mese.
  assert.match(js, /const cella = bottone\(null, `giorno-cal/);
  assert.match(js, /giornoScelto = iso;\s*renderMese\(\);/);
  assert.match(js, /renderGiornoScelto\(scelto,/);
});

test("il DM organizza da una finestra aperta dal pulsante nella testata", () => {
  const testata = html.slice(html.indexOf('<header class="rd-testata-pagina">'), html.indexOf("</header>"));
  assert.match(testata, /id="btn-organizza"[^>]*aria-controls="finestra-organizza"[^>]*hidden/);
  const finestra = html.slice(html.indexOf('<dialog id="finestra-organizza"'), html.indexOf("</dialog>"));
  for (const id of ["form-proposta", "proposta-titolo", "proposta-note", "opzioni-proposta", "btn-aggiungi-opzione", "btn-fissa-data", "btn-chiudi-organizza", "errore-organizza"]) {
    assert.match(finestra, new RegExp(`id="${id}"`), id);
  }
  assert.doesNotMatch(html, /id="strumenti-dm"/);
  assert.match(js, /getElementById\("btn-organizza"\)\.hidden = !isDM/);
  assert.match(js, /finestra\.showModal\(\)/);
  // Gli errori si vedono nella finestra, che sta sopra agli avvisi.
  assert.match(js, /"Impossibile creare la proposta\.", mostraErroreFinestra\)/);
  assert.match(js, /"Impossibile fissare la data\.", mostraErroreFinestra\)/);
  // Per i giocatori la riga dei comandi sparisce.
  assert.match(stili, /\.rd-comandi-pagina:not\(:has\(> :not\(\[hidden\]\)\)\) \{\s*display: none;/);
});

test("le note per i giocatori restano nella sessione programmata", () => {
  const sessioni = leggi("assets/js/dati/sessioni.js");
  const calendario = leggi("assets/js/dati/calendario.js");
  assert.match(sessioni, /creaSessioneProgrammata\(campagnaId, \{ titolo, note = null,/);
  assert.match(sessioni, /note: note \|\| null,/);
  assert.match(calendario, /note: proposta\.note,/);
  assert.match(calendario, /fissaSessione\(campagnaId, \{ titolo, note = null, data, ora \}\)/);
  assert.match(js, /if \(sessione\.note\)/);
});
