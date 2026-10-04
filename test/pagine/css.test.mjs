// Fogli di stile divisi per area (assets/css): ogni pagina carica base.css per
// primo e poi solo i file della sua area, nell'ordine base → gioco → area.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const RADICE = new URL("../../", import.meta.url);
const leggi = (f) => readFileSync(new URL(f, RADICE), "utf8");
const PAGINE = readdirSync(RADICE).filter((f) => f.endsWith(".html"));
const ORDINE = ["base", "gioco", "sessione", "scheda", "dm", "dashboard", "calendario", "guida"];

test("style.css non esiste più: ogni pagina carica base.css e la sua area", () => {
  assert.ok(!existsSync(new URL("assets/css/style.css", RADICE)));
  for (const pagina of PAGINE) {
    const fogli = [...leggi(pagina).matchAll(/<link rel="stylesheet" href="assets\/css\/([a-z]+)\.css" \/>/g)].map((m) => m[1]);
    assert.equal(fogli[0], "base", `${pagina}: base.css per primo`);
    assert.ok(fogli.length <= 3, `${pagina}: al massimo base, gioco e un'area`);
    for (const f of fogli) assert.ok(existsSync(new URL(`assets/css/${f}.css`, RADICE)), `${pagina}: ${f}.css non esiste`);
    assert.deepEqual(fogli, [...fogli].sort((a, b) => ORDINE.indexOf(a) - ORDINE.indexOf(b)), `${pagina}: ordine dei fogli`);
  }
});

test("ogni foglio è usato da almeno una pagina e il carattere si carica una volta sola", () => {
  const usati = new Set(PAGINE.flatMap((p) => [...leggi(p).matchAll(/assets\/css\/([a-z]+)\.css/g)].map((m) => m[1])));
  for (const f of readdirSync(new URL("assets/css/", RADICE))) assert.ok(usati.has(f.replace(".css", "")), `${f} non è usato`);
  const conImport = readdirSync(new URL("assets/css/", RADICE)).filter((f) => leggi(`assets/css/${f}`).includes("@import"));
  assert.deepEqual(conImport, ["base.css"]);
  assert.match(leggi("assets/css/base.css"), /^\/\*[^]*?\*\/\n@import url\('https:\/\/fonts\.googleapis\.com/);
});
