// Scheda rapida della Sessione: gli stessi valori della scheda completa (come
// numeri, per i tiri), gli incantesimi pronti, gli slot per «Lancia» e il
// collegamento alla pagina Sessione.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { datiSchedaRapida, livelliDiLancio, tiroIncantesimo, vistaScheda } from "../../assets/js/calcoli-scheda.js";

const elara = {
  nome: "Elara", classe: "mago", livello: 3, razza: "elfo", sottorazza: "alto",
  caratteristiche: { forza: 8, destrezza: 14, costituzione: 13, intelligenza: 16, saggezza: 12, carisma: 10 },
  abilitaCompetenti: ["arcano", "percezione"],
  inventario: [{ chiave: "pugnale", nome: "Pugnale", categoria: "arma" }, { chiave: "corda", nome: "Corda", categoria: "attrezzatura" }],
  incantesimiConosciuti: ["dardo_di_fuoco", "dardo_incantato", "scudo", "sonno"],
  incantesimiPreparati: ["dardo_incantato", "scudo"],
  slotIncantesimoUsati: { 1: 1 },
  hp: { massimi: 17, attuali: 12, temporanei: 0 },
};

test("i valori coincidono con quelli della scheda completa", () => {
  const dati = datiSchedaRapida(elara);
  const vista = vistaScheda(elara);
  assert.equal(dati.ca, vista.ca);
  assert.equal(dati.percezionePassiva, vista.percezionePassiva);
  assert.equal(dati.sottotitolo, "Alto Elfo · Mago 3");
  assert.deepEqual(dati.salvezze.map((s) => s.mod), [-1, 2, 1, 5, 3, 0]);
  assert.equal(dati.abilita.find((a) => a.chiave === "arcano").mod, 5);
  assert.deepEqual(dati.armi.map((a) => [a.nome, a.bonus, a.danno]), [["Pugnale", 4, { quanti: 1, facce: 4, modificatore: 2 }]]);
  assert.equal(dati.armi[0].testoDanno, vista.attacchi[0].danno);
});

test("magia: trucchetti e preparati del mago, slot usati, CD e attacco", () => {
  const { magia } = datiSchedaRapida(elara);
  assert.equal(magia.cd, 13);
  assert.equal(magia.attacco, 5);
  assert.deepEqual(magia.incantesimi.map((i) => i.chiave), ["dardo_di_fuoco", "dardo_incantato", "scudo"]);
  assert.deepEqual(magia.slot.map((s) => [s.chiave, s.max, s.usati]), [["1", 4, 1], ["2", 2, 0]]);
  assert.equal(datiSchedaRapida({ ...elara, classe: "guerriero" }).magia, null);
});

test("«Lancia»: livelli liberi dal base in su; il Warlock solo il Patto", () => {
  assert.deepEqual(livelliDiLancio(elara, "dardo_incantato"), [
    { livello: 1, chiaveSlot: "1", disponibili: 3 },
    { livello: 2, chiaveSlot: "2", disponibili: 2 },
  ]);
  assert.deepEqual(livelliDiLancio({ ...elara, slotIncantesimoUsati: { 1: 4, 2: 2 } }, "dardo_incantato"), []);
  assert.deepEqual(livelliDiLancio(elara, "dardo_di_fuoco"), []);
  const warlock = { classe: "warlock", livello: 3, slotIncantesimoUsati: { patto: 1 } };
  assert.deepEqual(livelliDiLancio(warlock, "colpo_infernale"), [{ livello: 2, chiaveSlot: "patto", disponibili: 1 }]);
});

test("tiri degli incantesimi come nella scheda: i trucchetti crescono", () => {
  assert.deepEqual(tiroIncantesimo(elara, "dardo_di_fuoco", "colpire"), { etichetta: "Dardo di Fuoco: per colpire", modificatore: 5 });
  assert.equal(tiroIncantesimo({ ...elara, livello: 5 }, "dardo_di_fuoco", "danno").quanti, 2);
  assert.equal(tiroIncantesimo({ ...elara, livello: 5, classe: "warlock" }, "saetta_occulta", "danno").quanti, 1);
});

test("incantesimi di razza anche senza classe da incantatore", () => {
  const thorin = { classe: "guerriero", livello: 3, razza: "tiefling", incantesimiRazzaUsati: ["colpo_infernale"] };
  const { magia } = datiSchedaRapida(thorin);
  assert.equal(magia.incantatore, false);
  assert.deepEqual(magia.razziali, [{ chiave: "colpo_infernale", nome: "Colpo Infernale", usato: true }]);
});

test("la Sessione monta la scheda rapida e la ridisegna con il party", () => {
  const sessione = readFileSync(new URL("../../assets/js/pagine/sessione.js", import.meta.url), "utf8");
  assert.match(sessione, /import \{ montaSchedaRapida \} from "\.\.\/scheda-rapida\.js"/);
  assert.match(sessione, /schedaRapida\?\.ridisegna\(\)/);
  const modulo = readFileSync(new URL("../../assets/js/scheda-rapida.js", import.meta.url), "utf8");
  assert.match(modulo, /isDM \|\| !scheda \|\| scheda\.proprietarioUid !== uid/, "il DM e chi non è il proprietario vedono la scheda in sola lettura");
});
