// Icone SVG dei lotti cruscotto/tracker e guida/bestiario/mappa/musica: ogni
// nome usato nel codice esiste in icone.js, e al loro posto non restano le
// vecchie emoji.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { icona } from "../../assets/js/icone.js";
import { GRUPPI_DM, GRUPPO_ADMIN, GRUPPI_GIOCATORE, avvisiDM, avvisiGiocatore } from "../../assets/js/cruscotto-calcoli.js";

const leggi = (percorso) => readFileSync(new URL(`../../${percorso}`, import.meta.url), "utf8");
const script = [
  ...readdirSync(new URL("../../assets/js/", import.meta.url)).filter((f) => f.endsWith(".js")).map((f) => `assets/js/${f}`),
  ...readdirSync(new URL("../../assets/js/pagine/", import.meta.url)).filter((f) => f.endsWith(".js")).map((f) => `assets/js/pagine/${f}`),
];

test("ogni icona(\"…\") ed elementoIcona(\"…\") del codice esiste", () => {
  for (const file of script) {
    for (const [, nome] of leggi(file).matchAll(/(?:icona|elementoIcona)\("([a-z-]+)"/g)) {
      assert.ok(icona(nome), `${file}: icona sconosciuta «${nome}»`);
    }
  }
});

test("le icone a tratto restano a tratto anche nei pulsanti", () => {
  assert.match(icona("dado"), /style="fill:none"/);
  assert.match(icona("riproduci"), /fill="currentColor"/);
  assert.match(icona("dado", "extra"), /^<svg class="icona extra" aria-hidden="true" data-icona="dado"/);
  assert.equal(icona("inesistente"), "");
});

test("strumenti e avvisi della dashboard usano nomi di icone", () => {
  const voci = [...GRUPPI_DM, GRUPPO_ADMIN, ...GRUPPI_GIOCATORE].flatMap((g) => g.voci);
  for (const v of voci) assert.ok(icona(v.icona), `${v.chiave}: «${v.icona}»`);
  const avvisi = [
    ...avvisiDM({ membri: [{ uid: "a", nome: "Pia" }, { uid: "b", nome: "Ugo" }], crediti: new Map([["a", 1]]), party: [{ uid: "a", schedaId: "s", livello: 2 }],
      proposte: [{ risposte: [] }], evidenza: { tipo: "oggi", titolo: "Sessione 4" }, contenutiProssima: 0, inAttesa: 1 }),
    ...avvisiGiocatore({ crediti: 1, scheda: { id: "s", livello: 2 }, daRispondere: 2 }),
    ...avvisiGiocatore({ scheda: null }),
  ];
  for (const a of avvisi) assert.ok(icona(a.icona), `avviso «${a.testo}»: «${a.icona}»`);
});

test("al posto delle vecchie emoji restano solo le icone", () => {
  const combattimento = leggi("assets/js/combattimento.js");
  assert.doesNotMatch(combattimento, /bottone\("(🎲|📜|▲|▼|▾|◀)"/);
  assert.doesNotMatch(combattimento, /"(Inizia|Turno successivo) ▶"/);
  assert.doesNotMatch(leggi("assets/js/mappa.js"), /"(◎ Centra su di me|📜 Scheda)"/);
  assert.doesNotMatch(leggi("assets/js/mappa-vista.js"), /"✚"/);
  assert.doesNotMatch(leggi("assets/js/bestiario-scheda.js"), /`🎲|"🎲/);
  assert.doesNotMatch(leggi("assets/js/widget-musica.js"), /🔈|🔊/);
  assert.doesNotMatch(leggi("controllo-musica.html"), /☆|★/);
  const guida = leggi("guida.html");
  assert.doesNotMatch(guida, /🗝️|🛡️|📜|🧭|⚔️|📅|📱|❓|🎲|⚙️|◎/);
  assert.equal((guida.match(/data-icona="/g) || []).length >= 17, true);
});
