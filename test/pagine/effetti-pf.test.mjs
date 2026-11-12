// Danni e cure (effetti-pf.js): i calcoli senza pagina e gli agganci nelle
// parti della Sessione che mostrano i PF.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { quotaDi, leggiCambio, traiettoria } from "../../assets/js/effetti-pf.js";

const leggi = (percorso) => readFileSync(new URL(`../../${percorso}`, import.meta.url), "utf8");

test("quota: dai PF veri o dalla salute vaga, sempre tra 0 e 1", () => {
  assert.equal(quotaDi({ attuali: 22, massimi: 44 }), 0.5);
  assert.equal(quotaDi({ attuali: -3, massimi: 44 }), 0);
  assert.equal(quotaDi({ attuali: 50, massimi: 44 }), 1);
  assert.equal(quotaDi({ attuali: 5, massimi: 0 }), 0);
  assert.equal(quotaDi({ quota: 0.6 }), 0.6);
});

test("nessun effetto alla prima lettura né se i PF non cambiano", () => {
  assert.equal(leggiCambio(undefined, { attuali: 10, massimi: 20 }), null);
  assert.equal(leggiCambio({ attuali: 10, massimi: 20 }, { attuali: 10, massimi: 20 }), null);
  assert.equal(leggiCambio({ quota: 0.6 }, { quota: 0.6 }), null);
});

test("danno e cura: verso, valore e pezzo di barra", () => {
  const danno = leggiCambio({ attuali: 44, massimi: 44 }, { attuali: 35, massimi: 44 });
  assert.equal(danno.tipo, "danno");
  assert.equal(danno.delta, -9);
  assert.ok(Math.abs(danno.da - 1) < 1e-9 && Math.abs(danno.a - 35 / 44) < 1e-9);
  const cura = leggiCambio({ attuali: 20, massimi: 44 }, { attuali: 32, massimi: 44 });
  assert.equal(cura.tipo, "cura");
  assert.equal(cura.delta, 12);
  assert.ok(!cura.aTerra && !cura.inPiedi);
});

test("la forza è in proporzione al colpo: mezzi PF massimi sono il massimo", () => {
  const forza = (da, a) => leggiCambio({ attuali: da, massimi: 40 }, { attuali: a, massimi: 40 }).forza;
  assert.equal(forza(40, 39), 0.2);            // un graffio: il minimo
  assert.equal(forza(40, 30), 0.5);            // un quarto dei PF
  assert.equal(forza(40, 20), 1);              // metà dei PF
  assert.equal(forza(40, 5), 1);               // di più non cresce
  assert.ok(forza(40, 30) < forza(40, 24));
  assert.equal(forza(10, 20), forza(30, 20));  // la cura pesa come il danno
});

test("andare a 0 PF e tornare in piedi sono sempre il massimo", () => {
  const giu = leggiCambio({ attuali: 2, massimi: 40 }, { attuali: 0, massimi: 40 });
  assert.ok(giu.aTerra && giu.forza === 1 && giu.delta === -2);
  const su = leggiCambio({ attuali: 0, massimi: 40 }, { attuali: 1, massimi: 40 });
  assert.ok(su.inPiedi && su.forza === 1 && su.tipo === "cura");
  // Già a terra: un altro colpo non lo rifà cadere.
  assert.equal(leggiCambio({ attuali: 0, massimi: 40 }, { attuali: 0, massimi: 40 }), null);
});

test("salute vaga: l'effetto c'è, il numero no", () => {
  const cambio = leggiCambio({ quota: 1 }, { quota: 0.6 });
  assert.equal(cambio.tipo, "danno");
  assert.equal(cambio.delta, null);
  assert.ok(Math.abs(cambio.forza - 0.8) < 1e-9);
  assert.ok(leggiCambio({ quota: 0.25 }, { quota: 0 }).aTerra);
});

test("il numero sale, ricade, tocca terra e rimbalza una volta senza sprofondare", () => {
  const volo = traiettoria({ vx: 60, vy: -300, suolo: 20 });
  const quote = Array.from({ length: 106 }, (_, i) => volo(i / 100));
  // Parte verso l'alto (y negativo), poi scende.
  assert.ok(quote[5].y < 0);
  const cima = Math.min(...quote.map((p) => p.y));
  assert.ok(cima < -30, "sale abbastanza");
  // Non va mai sotto terra.
  assert.ok(quote.every((p) => p.y <= 20 + 1e-9));
  // Tocca terra e risale: c'è un rimbalzo.
  const primoTocco = quote.findIndex((p) => p.y >= 19.5);
  assert.ok(primoTocco > 0);
  assert.ok(quote.slice(primoTocco + 2).some((p) => p.y < 19), "rimbalza");
  // Si sposta sempre nello stesso verso.
  assert.ok(quote.every((p, i) => i === 0 || p.x >= quote[i - 1].x));
});

test("party, tracker, pedine e scheda rapida dicono i loro PF agli effetti", () => {
  assert.match(leggi("assets/js/pagine/sessione.js"), /effettiPfParty\.aggiorna\(`\$\{riepilogo\.uid\}:\$\{riepilogo\.schedaId\}`/);
  assert.match(leggi("assets/js/scheda-rapida.js"), /effettiPf\.aggiorna\(scheda\.id, \{ attuali, massimi \}/);
  // Nel tracker gli effetti partono dopo che le righe sono state riordinate, non mentre si spostano.
  assert.match(leggi("assets/js/combattimento.js"), /elenco\.append\(li\);\n    \}\);\n[^\n]*\n    for \(const c of ordinati\) \{\n      const voce = pfPerEffetti\(c\);\n      if \(voce\) effettiPf\.aggiorna\(voce\.chiave, voce\.pf, \{ bersaglio: righe\.get\(c\.id\) \}, \{ numeri: voce\.numeri \}\);/);
  assert.match(leggi("assets/js/mappa-vista.js"), /effettiPf\.aggiorna\(p\.id, p\.pfVeri \?\? \{ quota: p\.quotaPf \}/);
});

test("dei nemici i giocatori non vedono numeri: solo la salute vaga", () => {
  // Tracker: i PF veri solo al DM e per gli alleati; altrimenti la quota della salute, senza numero.
  const tracker = leggi("assets/js/combattimento.js");
  assert.match(tracker, /if \(isDM && c\.dm\) return \{ chiave: c\.id, pf: \{ attuali: c\.dm\.pfAttuali, massimi: c\.dm\.pfMassimi \}, numeri: true \};/);
  assert.match(tracker, /return \{ chiave: c\.id, pf: \{ quota: BARRA_SALUTE\[c\.salute \|\| "illeso"\] \?\? 1 \}, numeri: false \};/);
  // Pedine: pfVeri c'è solo dove c'erano già i PF veri (DM, alleati, personaggi).
  const pedine = leggi("assets/js/mappa-pedine.js");
  assert.match(pedine, /const veri = perDM && c\?\.dm\?\.pfMassimi > 0 \? \{ attuali: c\.dm\.pfAttuali, massimi: c\.dm\.pfMassimi \}\s+: alleato && c\?\.pf\?\.massimi > 0 \? \{ attuali: c\.pf\.attuali, massimi: c\.pf\.massimi \} : null;/);
  assert.match(leggi("assets/js/mappa-vista.js"), /\{ numeri: Boolean\(p\.pfVeri\) \}/);
});

test("gli stili degli effetti stanno in gioco.css, sotto le finestre modali", () => {
  const stili = leggi("assets/css/gioco.css");
  for (const classe of [".pf-strato", ".pf-lampo-danno", ".pf-lampo-cura", ".pf-perso", ".pf-guadagnato", ".pf-numero-danno", ".pf-numero-cura", ".pf-goccia"]) {
    assert.ok(stili.includes(`${classe} {`), classe);
  }
  assert.match(stili, /\.pf-strato \{[^}]*z-index: 195;/);
});
