// Cruscotto della dashboard: sessione in evidenza, avvisi, ordine degli strumenti.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  GRUPPI_DM, GRUPPI_GIOCATORE, GRUPPO_ADMIN, ordinaVoci, sessioneInEvidenza, avvisiDM, avvisiGiocatore, barraPf, testoPf,
} from "../../assets/js/cruscotto-calcoli.js";

const radice = new URL("../../", import.meta.url);
const sessioni = [
  { id: "s3", numero: 3, titolo: "Imboscata", stato: "chiusa", dataProgrammata: "2026-09-26" },
  { id: "s5", numero: 5, titolo: null, stato: "programmata", dataProgrammata: "2026-10-10", oraProgrammata: "21:00" },
  { id: "s4", numero: 4, titolo: "La cripta", stato: "programmata", dataProgrammata: "2026-10-03", oraProgrammata: "21:00" },
];

test("strumenti: link esistenti e chiavi uniche per gruppo", () => {
  for (const g of [...GRUPPI_DM, GRUPPO_ADMIN, ...GRUPPI_GIOCATORE]) {
    assert.equal(new Set(g.voci.map((v) => v.chiave)).size, g.voci.length, g.id);
    for (const v of g.voci) assert.ok(existsSync(new URL(v.link, radice)), v.link);
  }
  assert.deepEqual(GRUPPI_DM.map((g) => g.titolo), ["Prepara", "Gioca", "Consulta"]);
  const voci = GRUPPI_DM[0].voci;
  assert.deepEqual(ordinaVoci(voci, ["bestiario", "calendario"]).map((v) => v.chiave), ["bestiario", "calendario", "libreria", "impostazioni-campagna"]);
  assert.equal(ordinaVoci(voci, null), voci);
});

test("sessione in evidenza: in corso, oggi, prossima, proposta, nessuna", () => {
  const inCorso = sessioneInEvidenza({ inCorso: { sessioneAttivaId: "s4" }, sessioni, oggi: "2026-10-03" });
  assert.deepEqual([inCorso.tipo, inCorso.titolo], ["corso", "Sessione 4 — La cripta"]);
  const oggi = sessioneInEvidenza({ sessioni, oggi: "2026-10-03" });
  assert.deepEqual([oggi.tipo, oggi.ora, oggi.sessione.id], ["oggi", "21:00", "s4"]);
  const prossima = sessioneInEvidenza({ sessioni, oggi: "2026-10-04" });
  assert.deepEqual([prossima.tipo, prossima.sessione.id], ["prossima", "s5"]);
  const proposta = sessioneInEvidenza({ sessioni: [], proposte: [{ titolo: "Il sarcofago", opzioni: [{}, {}, {}], risposte: ["a", "b"] }], membri: 3 });
  assert.deepEqual([proposta.tipo, proposta.titolo, proposta.riga], ["proposta", "Proposta «Il sarcofago»", "3 date proposte · hanno risposto 2 su 3"]);
  assert.equal(sessioneInEvidenza({}).tipo, "nessuna");
});

test("avvisi del DM", () => {
  const membri = [
    { uid: "g", nome: "Giulia", livelliDaSpendere: 0 },
    { uid: "l", nome: "Luca", livelliDaSpendere: 1 },
    { uid: "p", nome: "Paolo" },
  ];
  const party = [
    { uid: "g", schedaId: "elara", nomePersonaggio: "Elara", livello: 3 },
    { uid: "l", schedaId: "thorin", nomePersonaggio: "Thorin", livello: 3 },
    { uid: "p", schedaId: null },
  ];
  const evidenza = sessioneInEvidenza({ sessioni, oggi: "2026-10-03" });
  const avvisi = avvisiDM({ membri, party, proposte: [{ titolo: "Il sarcofago", risposte: ["g"] }], evidenza, contenutiProssima: 0, inAttesa: 2 });
  assert.deepEqual(avvisi.map((a) => a.testo), [
    "Ci sono 2 nuovi iscritti da approvare.",
    "Thorin deve completare il passaggio al 4° livello.",
    "Paolo non ha ancora un personaggio attivo.",
    "Luca e Paolo non hanno risposto alle date di «Il sarcofago».",
    "Nessun contenuto collegato alla Sessione 4 — La cripta.",
  ]);
  assert.deepEqual(avvisiDM({ membri: membri.slice(0, 1), party, evidenza, contenutiProssima: 3 }), []);
});

test("avvisi del giocatore e PF", () => {
  assert.equal(avvisiGiocatore({ scheda: null })[0].link, "i-miei-personaggi.html");
  const a = avvisiGiocatore({ profilo: { livelliDaSpendere: 1 }, scheda: { id: "elara", livello: 3 }, daRispondere: 1 });
  assert.deepEqual(a.map((x) => x.etichetta), ["Scheda", "Rispondi"]);
  assert.match(a[0].testo, /4°/);
  assert.equal(testoPf({ attuali: 24, massimi: 31, temporanei: 5 }), "24/31 (+5)");
  assert.equal(testoPf(null), "");
  assert.deepEqual(barraPf({ attuali: 3, massimi: 17 }), { quota: 3 / 17, colore: "#b8323f" });
});
