// App installabile (PWA): manifest, icone, collegamenti in ogni pagina e
// service worker allineato ai file del sito.
// Se fallisce "sw.js è aggiornato": lancia node strumenti/aggiorna-sw.mjs e
// fai il commit di sw.js (serve a far arrivare la versione nuova a chi ha
// l'app installata).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { RADICE, swAggiornato, impronta, suRichiesta } from "../../strumenti/aggiorna-sw.mjs";

const leggi = (percorso) => readFileSync(join(RADICE, percorso), "utf8");
const PAGINE = readdirSync(RADICE).filter((f) => f.endsWith(".html"));

test("il manifest è valido e le sue icone esistono", () => {
  const manifest = JSON.parse(leggi("manifest.webmanifest"));
  assert.equal(manifest.short_name, "S&D");
  assert.equal(manifest.display, "standalone");
  assert.ok(existsSync(join(RADICE, manifest.start_url)), `start_url ${manifest.start_url} non esiste`);
  assert.ok(manifest.icons.some((i) => i.sizes === "192x192"), "manca l'icona 192x192");
  assert.ok(manifest.icons.some((i) => i.sizes === "512x512" && i.purpose === "maskable"), "manca l'icona maskable 512x512");
  for (const icona of manifest.icons) assert.ok(existsSync(join(RADICE, icona.src)), `${icona.src} non esiste`);
});

test("ogni pagina collega manifest, icone e pwa.js", () => {
  for (const pagina of PAGINE) {
    const html = leggi(pagina);
    assert.match(html, /<link rel="manifest" href="manifest.webmanifest" \/>/, `${pagina}: manca il manifest`);
    assert.match(html, /<link rel="apple-touch-icon" href="assets\/icone\/apple-touch-icon.png" \/>/, `${pagina}: manca l'icona per iPhone`);
    assert.match(html, /<meta name="theme-color" content="#150d08" \/>/, `${pagina}: manca il theme-color`);
    assert.match(html, /<script type="module" src="assets\/js\/pwa.js"><\/script>/, `${pagina}: manca pwa.js`);
  }
});

test("sw.js è aggiornato (node strumenti/aggiorna-sw.mjs)", () => {
  const sorgente = leggi("sw.js");
  assert.equal(sorgente, swAggiornato(sorgente), "sw.js non è aggiornato: lancia node strumenti/aggiorna-sw.mjs");
});

test("i file salvati dal service worker esistono tutti, ognuno con la sua impronta", () => {
  const blocco = leggi("sw.js").match(/const FILE = \{([\s\S]*?)\};/)[1];
  const voci = [...blocco.matchAll(/"\.\/([^"]+)": "([0-9a-f]{12})"/g)];
  assert.equal(voci.length, blocco.trim().split("\n").length, "ogni riga è «file: impronta»");
  const file = voci.map((m) => m[1]);
  assert.ok(file.includes("offline.html"), "manca offline.html");
  for (const [, f, h] of voci) {
    assert.ok(existsSync(join(RADICE, f)), `${f} non esiste`);
    assert.equal(h, impronta(f), `${f}: impronta vecchia`);
  }
});

test("a una versione nuova si riscaricano solo i file cambiati", () => {
  const sw = leggi("sw.js");
  // Copia dalla versione precedente se l'impronta coincide, altrimenti scarica.
  assert.match(sw, /if \(impronte\[f\] !== impronta\) continue;/);
  assert.match(sw, /cache\.put\(IMPRONTE, new Response\(JSON\.stringify\(FILE\)/);
  // I mostri del SRD (solo per il DM) si salvano al primo uso.
  assert.ok(suRichiesta("assets/js/mostri-srd.js") && !suRichiesta("assets/vendor/three.module.min.js"));
  assert.match(sw, /"\.\/assets\/js\/mostri-srd\.js"\]/);
});
