// Guscio ridisegnato: ogni pagina dopo l'accesso (tranne lo schermo del tavolo)
// ha la barra laterale, il velo e il ☰ del cassetto, una voce della barra che
// esiste davvero e il suo modulo che monta il guscio.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { GRUPPI_DM, GRUPPO_ADMIN, GRUPPI_GIOCATORE } from "../../assets/js/cruscotto-calcoli.js";

const RADICE = new URL("../../", import.meta.url);
const leggi = (f) => readFileSync(new URL(f, RADICE), "utf8");
const PAGINE = readdirSync(RADICE).filter((f) => f.endsWith(".html") && leggi(f).includes('id="slot-utente"'));
const VOCI = new Set(["dashboard", ...[...GRUPPI_DM, GRUPPO_ADMIN, ...GRUPPI_GIOCATORE].flatMap((g) => g.voci.map((v) => v.chiave))]);

test("le pagine dopo l'accesso hanno il guscio", () => {
  assert.ok(PAGINE.length >= 16, `trovate solo ${PAGINE.length} pagine`);
  for (const pagina of PAGINE) {
    const html = leggi(pagina);
    const voce = html.match(/<body class="pagina-ridisegnata[^"]*" data-voce="([a-z-]+)">/)?.[1];
    assert.ok(voce, `${pagina}: body senza pagina-ridisegnata e data-voce`);
    assert.ok(VOCI.has(voce), `${pagina}: la voce «${voce}» non è nella barra`);
    for (const pezzo of ['<aside id="rd-barra" class="rd-barra"', '<div id="rd-velo" class="rd-velo" hidden>', 'id="rd-btn-menu"', 'class="rd-principale"']) {
      assert.ok(html.includes(pezzo), `${pagina}: manca ${pezzo}`);
    }
    assert.doesNotMatch(html, /class="link-back"|class="dashboard-header"|class="site-footer"/, `${pagina}: resti della vecchia intestazione`);
    const modulo = leggi(`assets/js/pagine/${pagina.replace(".html", ".js")}`);
    assert.match(modulo, /montaGuscio\(/, `${pagina}: il modulo non monta il guscio`);
    assert.doesNotMatch(modulo, /montaMenuUtente\(/, `${pagina}: usa ancora l'intestazione vecchia`);
  }
});

test("lo schermo del tavolo e le pagine prima dell'accesso restano senza guscio", () => {
  for (const pagina of ["tavolo.html", "index.html", "register.html", "verifica-email.html", "attesa-approvazione.html", "offline.html"]) {
    assert.doesNotMatch(leggi(pagina), /rd-barra|pagina-ridisegnata/, pagina);
  }
});

test("la pagina Sessione ha la barra compatta", () => {
  assert.match(leggi("sessione.html"), /<body class="pagina-ridisegnata pagina-interna rd-barra-compatta"/);
});
