// Guida e FAQ (guida.html): indice, tendina, capitoli, domande e schermate coerenti.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const radice = new URL("../../", import.meta.url);
const html = readFileSync(new URL("guida.html", radice), "utf8");
const tutti = (re) => [...html.matchAll(re)].map((m) => m[1]);

test("guida: ogni capitolo è nell'indice, nella tendina e ha passi", () => {
  const capitoli = tutti(/<section id="([^"]+)" class="panel-wide guida-capitolo"/g);
  assert.equal(capitoli.length, 7);
  assert.deepEqual(tutti(/class="guida-indice-voce" href="#([^"]+)"/g), capitoli);
  assert.deepEqual(tutti(/<option value="([^"]+)">/g), capitoli);
  for (const id of capitoli) {
    const sezione = html.slice(html.indexOf(`<section id="${id}"`), html.indexOf("</section>", html.indexOf(`<section id="${id}"`)));
    assert.match(sezione, /<ol class="guida-passi">\s*<li>/, `${id}: nessun passo`);
  }
});

test("guida: le domande rimandano a capitoli esistenti", () => {
  const capitoli = new Set(tutti(/<section id="([^"]+)" class="panel-wide guida-capitolo"/g));
  const domande = tutti(/<details class="guida-domanda" data-capitolo="([^"]+)"/g);
  assert.ok(domande.length >= 10);
  for (const c of domande) assert.ok(capitoli.has(c), c);
});

test("guida: le schermate esistono, hanno un testo alternativo e sono leggere", () => {
  const immagini = [...html.matchAll(/<img src="(assets\/img\/guida\/[^"]+)" alt="([^"]+)"/g)];
  assert.equal(immagini.length, 5);
  for (const [, percorso] of immagini) {
    const file = new URL(percorso, radice);
    assert.ok(existsSync(file), percorso);
    assert.ok(readFileSync(file).length < 120 * 1024, `${percorso}: troppo pesante per il service worker`);
  }
});

test("guida: raggiungibile da dashboard e pannello ⚙️", () => {
  const dashboard = readFileSync(new URL("assets/js/cruscotto-calcoli.js", radice), "utf8");
  const menu = readFileSync(new URL("assets/js/menu-utente.js", radice), "utf8");
  assert.match(dashboard, /link: "guida\.html"/);
  assert.match(menu, /href="guida\.html"/);
});
