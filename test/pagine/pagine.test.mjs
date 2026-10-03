// Controlli statici sulle pagine HTML e sui moduli JS (nessun emulatore: basta Node).
//
// Content Security Policy: ogni pagina dichiara nel <head> un
// <meta http-equiv="Content-Security-Policy">, identico in tutte le pagine, che
// dice al browser da dove può caricare script, stili, immagini, iframe e
// connessioni. È la seconda linea di difesa contro l'XSS: anche se un testo
// malevolo sfuggisse all'escape, il browser rifiuterebbe di eseguire script
// inline o caricati da domini non elencati.
// Conseguenze pratiche per chi modifica le pagine:
// - niente <script> inline né attributi onclick="..." e simili: il codice di
//   una pagina va in assets/js/pagine/<pagina>.js;
// - un nuovo servizio esterno (immagini, API, iframe...) va aggiunto alla
//   policy in TUTTE le pagine (questo test verifica che siano identiche).
// Avvio: node --test test/pagine
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const RADICE = fileURLToPath(new URL("../../", import.meta.url));
const PAGINE = readdirSync(RADICE).filter((f) => f.endsWith(".html"));
const leggi = (percorso) => readFileSync(join(RADICE, percorso), "utf8");

function moduliJs(cartella = "assets/js") {
  return readdirSync(join(RADICE, cartella), { withFileTypes: true }).flatMap((voce) =>
    voce.isDirectory() ? moduliJs(join(cartella, voce.name)) : voce.name.endsWith(".js") ? [join(cartella, voce.name)] : []
  );
}

function csp(html) {
  return html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/)?.[1] ?? null;
}

test("ogni pagina ha la Content Security Policy, uguale in tutte", () => {
  const riferimento = csp(leggi("index.html"));
  assert.ok(riferimento, "index.html non ha la CSP");
  for (const pagina of PAGINE) assert.equal(csp(leggi(pagina)), riferimento, `${pagina}: CSP assente o diversa`);
});

test("la CSP non consente script inline, eval o plugin", () => {
  const politica = csp(leggi("index.html"));
  const scriptSrc = politica.match(/script-src([^;]*)/)[1];
  assert.doesNotMatch(scriptSrc, /'unsafe-inline'|'unsafe-eval'|\*/);
  assert.match(politica, /object-src 'none'/);
  assert.match(politica, /base-uri 'self'/);
});

test("nessuna pagina contiene script inline", () => {
  for (const pagina of PAGINE) {
    const tag = leggi(pagina).match(/<script\b[^>]*>/g) || [];
    for (const t of tag) assert.match(t, /\ssrc="/, `${pagina}: script inline (${t}) — spostalo in assets/js/pagine/`);
  }
});

test("nessun gestore di eventi inline né URL javascript:", () => {
  for (const pagina of PAGINE) {
    const html = leggi(pagina);
    assert.doesNotMatch(html, /<[^>]+\son[a-z]+\s*=/i, `${pagina}: attributo on...= inline`);
    assert.doesNotMatch(html, /javascript:/i, `${pagina}: URL javascript:`);
  }
});

test("gli script delle pagine esistono", () => {
  for (const pagina of PAGINE) {
    for (const [, src] of leggi(pagina).matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) {
      if (/^https?:/.test(src)) continue;
      assert.ok(existsSync(join(RADICE, src)), `${pagina}: ${src} non esiste`);
    }
  }
});

test("ogni nome importato tra moduli locali è davvero esportato", () => {
  const esportazioni = new Map();
  const esportiDi = (file) => {
    if (!esportazioni.has(file)) {
      const codice = readFileSync(file, "utf8");
      const nomi = [...codice.matchAll(/export (?:async )?(?:function|const|let|class) (\w+)/g)].map((m) => m[1]);
      // Anche le riesportazioni: export { a, b as c };
      for (const [, elenco] of codice.matchAll(/export\s*\{([^}]*)\}/g)) {
        nomi.push(...elenco.split(",").map((n) => n.trim().split(/\s+as\s+/).pop()).filter(Boolean));
      }
      esportazioni.set(file, new Set(nomi));
    }
    return esportazioni.get(file);
  };
  for (const modulo of moduliJs()) {
    const percorso = join(RADICE, modulo);
    for (const [, nomi, origine] of readFileSync(percorso, "utf8").matchAll(/import\s*\{([^}]*)\}\s*from\s*"(\.{1,2}\/[^"]+)"/g)) {
      const bersaglio = resolve(dirname(percorso), origine);
      assert.ok(existsSync(bersaglio), `${modulo}: importa ${origine}, che non esiste`);
      for (const nome of nomi.split(",").map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean)) {
        assert.ok(esportiDi(bersaglio).has(nome), `${modulo}: "${nome}" non è esportato da ${origine}`);
      }
    }
  }
});
