// Guida alla creazione del personaggio: dati completi per ogni classe e
// razza, coerenti con le tabelle del SRD, e passi che si spuntano da soli.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CLASSI, RAZZE, ABILITA, TRATTI_PER_LIVELLO } from "../../assets/js/dati-srd.js";
import { cercaIncantesimi } from "../../assets/js/incantesimi-srd.js";
import {
  ABILITA_CLASSE, ABILITA_RAZZA, COMPETENZE_CLASSE, LINGUAGGI_RAZZA, TRATTI_LIVELLO_1, SOTTOCLASSI,
  EQUIPAGGIAMENTO_INIZIALE, passiGuida, abilitaAttese, incantesimiAttesi, trattiLivello1Mancanti,
  talentiConSottoclasse, sottoclasseScelta,
} from "../../assets/js/guida-personaggio-dati.js";

const CHIAVI_ABILITA = new Set(ABILITA.map((a) => a.chiave));

test("ogni classe ha abilità, competenze, privilegi, sottoclasse ed equipaggiamento", () => {
  for (const classe of Object.keys(CLASSI)) {
    const abilita = ABILITA_CLASSE[classe];
    assert.ok(abilita?.numero > 0, `${classe}: abilità`);
    for (const a of abilita.scelta || []) assert.ok(CHIAVI_ABILITA.has(a), `${classe}: abilità ${a} sconosciuta`);
    assert.ok(COMPETENZE_CLASSE[classe], `${classe}: competenze`);
    assert.ok(TRATTI_LIVELLO_1[classe]?.length, `${classe}: privilegi di 1° livello`);
    assert.ok(EQUIPAGGIAMENTO_INIZIALE[classe]?.length, `${classe}: equipaggiamento`);
    const sotto = SOTTOCLASSI[classe];
    assert.ok(sotto && sotto.srd, `${classe}: sottoclasse`);
    // Il segnaposto della sottoclasse compare al livello giusto, dove il
    // passaggio di livello (o la guida, al 1°) lo aggiunge ai talenti.
    const tratti = sotto.livello === 1 ? TRATTI_LIVELLO_1[classe] : TRATTI_PER_LIVELLO[classe][sotto.livello];
    assert.ok(tratti.includes(`${sotto.etichetta} (sottoclasse)`), `${classe}: segnaposto della sottoclasse al livello ${sotto.livello}`);
    for (const [livello, voci] of Object.entries(TRATTI_PER_LIVELLO[classe])) {
      if (Number(livello) !== sotto.livello) assert.ok(!voci.some((v) => v.includes("(sottoclasse)")), `${classe}: sottoclasse fuori posto al ${livello}`);
    }
  }
});

test("ogni razza ha i linguaggi; le abilità di razza esistono", () => {
  for (const razza of Object.keys(RAZZE)) assert.ok(LINGUAGGI_RAZZA[razza], `${razza}: linguaggi`);
  for (const { fisse } of Object.values(ABILITA_RAZZA)) for (const a of fisse) assert.ok(CHIAVI_ABILITA.has(a));
});

const nuovoGuerriero = () => ({
  id: "s1", classe: "guerriero", razza: "umano", livello: 1, caratteristiche: { forza: 16 },
  talenti: [], abilitaCompetenti: [], inventario: [], personalita: {},
});

test("guerriero umano dal livello 1 al 3: i passi e il loro ordine", () => {
  const scheda = nuovoGuerriero();
  const passi = passiGuida(scheda, { livelloObiettivo: 3 });
  assert.deepEqual(passi.map((p) => p.id), [
    "background", "abilita", "allineamento", "tratti", "equipaggiamento", "competenze", "personalita",
    "livello-2", "livello-3", "sottoclasse", "ritratto",
  ]);
  assert.ok(passi.every((p) => !p.fatto));
  assert.equal(passi.find((p) => p.id === "ritratto").facoltativo, true);
});

test("i passi si spuntano guardando la scheda", () => {
  const scheda = nuovoGuerriero();
  Object.assign(scheda, {
    background: "Soldato",
    abilitaCompetenti: ["atletica", "percezione", "intimidire", "sopravvivenza"],
    allineamento: "LB",
    inventario: [{ chiave: "spada_lunga" }],
    competenzeLinguaggi: "Tutte le armature",
    personalita: { tratti: "a", ideali: "b", legami: "c", difetti: "d" },
  });
  assert.equal(abilitaAttese(scheda), 4);
  assert.deepEqual(trattiLivello1Mancanti(scheda), ["Stile di Combattimento", "Recupero Energie"]);
  scheda.talenti = [...TRATTI_LIVELLO_1.guerriero];
  scheda.livello = 3;
  scheda.talenti.push(...TRATTI_PER_LIVELLO.guerriero[2], ...TRATTI_PER_LIVELLO.guerriero[3]);
  let passi = passiGuida(scheda, { livelloObiettivo: 3 });
  assert.deepEqual(passi.filter((p) => !p.fatto).map((p) => p.id), ["sottoclasse", "ritratto"]);
  scheda.talenti = talentiConSottoclasse(scheda, "Campione");
  assert.ok(scheda.talenti.includes("Archetipo Marziale: Campione"));
  assert.ok(!scheda.talenti.some((t) => t.includes("(sottoclasse)")));
  assert.equal(sottoclasseScelta(scheda), "Campione");
  passi = passiGuida(scheda, { livelloObiettivo: 3 });
  assert.deepEqual(passi.filter((p) => !p.fatto).map((p) => p.id), ["ritratto"]);
});

test("chierico: la sottoclasse si sceglie al 1° livello, prima dei passaggi", () => {
  const scheda = { ...nuovoGuerriero(), classe: "chierico" };
  const ids = passiGuida(scheda, { livelloObiettivo: 3 }).map((p) => p.id);
  assert.ok(ids.indexOf("sottoclasse") < ids.indexOf("livello-2"));
  assert.ok(ids.includes("incantesimi"));
  scheda.talenti = ["Incantesimi", "Dominio Divino: Dominio della Vita"];
  assert.deepEqual(trattiLivello1Mancanti(scheda), []);
});

test("incantesimi attesi: mago alto elfo, paladino prima e dopo il 2° livello", () => {
  const mago = { classe: "mago", razza: "elfo", sottorazza: "alto", livello: 1, caratteristiche: { intelligenza: 16 } };
  assert.deepEqual(incantesimiAttesi(mago), { modo: "libro", trucchetti: 4, conosciuti: 0, libro: 6, preparati: 4 });
  const paladino = { classe: "paladino", razza: "umano", livello: 1, caratteristiche: { carisma: 14 } };
  assert.equal(incantesimiAttesi(paladino), null);
  assert.ok(passiGuida(paladino, { livelloObiettivo: 3 }).some((p) => p.id === "incantesimi"));
  assert.ok(!passiGuida(paladino, { livelloObiettivo: 1 }).some((p) => p.id === "incantesimi"));
  assert.equal(incantesimiAttesi({ ...paladino, livello: 2 }).preparati, 3);
  const guerriero = nuovoGuerriero();
  assert.ok(!passiGuida(guerriero, { livelloObiettivo: 3 }).some((p) => p.id === "incantesimi"));
});

test("il passo incantesimi si spunta con trucchetti e libro completi", () => {
  const trucchetti = cercaIncantesimi("", { classe: "mago", livello: 0 }).slice(0, 3);
  const primo = cercaIncantesimi("", { classe: "mago", livello: 1 }).slice(0, 6);
  assert.equal(trucchetti.length, 3);
  assert.equal(primo.length, 6);
  const mago = {
    ...nuovoGuerriero(), classe: "mago", caratteristiche: { intelligenza: 10 },
    incantesimiConosciuti: [...trucchetti, ...primo].map((i) => i.chiave),
    incantesimiPreparati: [primo[0].chiave],
  };
  assert.equal(passiGuida(mago).find((p) => p.id === "incantesimi").fatto, true);
  mago.incantesimiConosciuti.pop();
  assert.equal(passiGuida(mago).find((p) => p.id === "incantesimi").fatto, false);
});
