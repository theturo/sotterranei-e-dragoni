// Accesso ai dati diviso per argomento (assets/js/dati/): auth.js tiene solo
// accesso, ruoli e protezione delle pagine, e ogni pagina carica solo i
// moduli che usa.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = fileURLToPath(new URL("../../", import.meta.url));
const leggi = (f) => readFileSync(join(RADICE, f), "utf8");

function moduli(file, visti = new Set()) {
  if (visti.has(file) || !existsSync(file)) return visti;
  visti.add(file);
  for (const m of readFileSync(file, "utf8").matchAll(/(?:from\s*|import\s+)["'](\.{1,2}\/[^"']+\.js)["']/g)) moduli(join(dirname(file), m[1]), visti);
  return visti;
}
const caricatiDa = (pagina) => {
  const visti = new Set();
  for (const m of leggi(pagina).matchAll(/<script[^>]*src="([^"]+\.js)"/g)) moduli(join(RADICE, m[1]), visti);
  return [...visti].map((f) => f.slice(RADICE.length));
};

test("auth.js contiene solo accesso, ruoli e protezione delle pagine", () => {
  const esportati = [...leggi("assets/js/auth.js").matchAll(/^export (?:async )?(?:function|const) (\w+)/gm)].map((m) => m[1]).sort();
  assert.deepEqual(esportati, ["ETICHETTE_RUOLO", "ROLES", "accediUtente", "cambiaEmail", "cambiaPassword", "esciUtente", "inviaEmailVerifica",
    "inviaResetPassword", "profiloApprovato", "proteggiPagina", "proteggiPaginaAdmin", "proteggiPaginaDM", "proteggiPaginaSenzaVerifica",
    "registraUtente", "ricaricaUtente", "traduciErrore"]);
});

test("ogni modulo dei dati si presenta in testa", () => {
  for (const f of readdirSync(join(RADICE, "assets/js/dati"))) {
    assert.match(leggi(`assets/js/dati/${f}`), /^\/\/ \S/, `${f}: manca il commento iniziale`);
  }
});

test("le pagine leggere non caricano mappa, combattimento e libreria", () => {
  assert.deepEqual(caricatiDa("index.html").filter((f) => f.includes("/dati/")), ["assets/js/dati/utenti.js"]);
  for (const pagina of ["dashboard.html", "calendario.html", "guida.html", "campagna.html", "i-miei-personaggi.html"]) {
    const dati = caricatiDa(pagina);
    for (const pesante of ["mappa", "combattimento"]) assert.ok(!dati.includes(`assets/js/dati/${pesante}.js`), `${pagina} carica ${pesante}.js`);
  }
  assert.ok(caricatiDa("sessione.html").includes("assets/js/dati/combattimento.js"));
});
