// Bestiario: catalogo dei mostri SRD in italiano e calcoli della pagina.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MOSTRI } from "../../assets/js/mostri-srd.js";
import {
  descrizioneTipo, numeroGs, mediaDadi, testoDanni, tiraAzione, azioneTirabile, filtraCreature, copiaCreatura, creaturaVuota,
  danniDaTesto, testoDaDanni, cambiaUsi, riposoLungo, statoIniziale, bonusIniziativa, etichettaDiario, TAGLIE_CREATURA, TIPI_CREATURA,
} from "../../assets/js/bestiario-calcoli.js";
import { leggiFormula } from "../../assets/js/dadi-base.js";

const goblin = MOSTRI.find((m) => m.chiave === "goblin");

test("catalogo SRD: tutti i 334 mostri, completi e in italiano", () => {
  assert.equal(MOSTRI.length, 334);
  assert.equal(new Set(MOSTRI.map((m) => m.chiave)).size, 334);
  const inglese = /\b(the|and|damage|feet|ft|with|its|creature's|saving throw)\b/i;
  for (const m of MOSTRI) {
    assert.ok(m.nome && m.ca && m.pf > 0 && m.velocita && m.sensi && m.lingue && m.gs !== undefined, m.chiave);
    assert.ok(TAGLIE_CREATURA.includes(m.taglia), `${m.chiave}: taglia ${m.taglia}`);
    assert.ok(TIPI_CREATURA.includes(m.tipo), `${m.chiave}: tipo ${m.tipo}`);
    assert.equal(m.car.length, 6);
    for (const lista of [m.tratti, m.azioni, m.reazioni, m.leggendarie]) {
      for (const a of lista || []) {
        assert.ok(a.nome && a.testo, `${m.chiave}: voce vuota`);
        assert.ok(!inglese.test(a.testo) && !/\{/.test(a.testo), `${m.chiave} · ${a.nome}: ${a.testo.slice(0, 80)}`);
        // Articoli a metà frase in minuscolo ("affascinato dall'aboleth").
        assert.doesNotMatch(a.testo, /[a-zà-ù,] (Il|Lo|La|L'|Del|Dello|Della|Dell'|Dal|Dallo|Dalla|Dall'|Al|Allo|Alla|All')[a-z ]/, `${m.chiave} · ${a.nome}`);
        for (const { dadi } of a.danni || []) assert.ok(/^\d+$/.test(dadi) || leggiFormula(dadi), `${m.chiave} · ${a.nome}: dadi ${dadi}`);
        if (a.ts) assert.ok(["for", "des", "cos", "int", "sag", "car"].includes(a.ts.car) && a.ts.cd > 0);
      }
    }
  }
  assert.equal(goblin.nome, "Goblin");
  assert.equal(goblin.azioni[0].testo, "Attacco con arma da mischia: +4 al tiro per colpire, portata 1,5 m, un bersaglio. Colpito: 5 (1d6 + 2) danni taglienti.");
  assert.deepEqual(goblin.azioni[0].danni, [{ dadi: "1d6+2", tipo: "taglienti" }]);
  const drago = MOSTRI.find((m) => m.chiave === "adult-red-dragon");
  const soffio = drago.azioni.find((a) => a.nome.startsWith("Soffio di Fuoco"));
  assert.equal(soffio.nome, "Soffio di Fuoco (Ricarica 5–6)");
  assert.deepEqual([soffio.ricarica, soffio.ts], [5, { cd: 21, car: "des", meta: true }]);
  assert.equal(drago.leggendarie.length, 3);
});

test("descrizione del tipo, GS e dadi", () => {
  assert.equal(descrizioneTipo(goblin), "Umanoide Piccolo (goblinoide), neutrale malvagio");
  assert.equal(descrizioneTipo(MOSTRI.find((m) => m.chiave === "wolf")), "Bestia Media, senza allineamento");
  assert.equal(descrizioneTipo(MOSTRI.find((m) => m.chiave === "swarm-of-rats")), "Sciame Medio di bestie Minuscole, senza allineamento");
  assert.deepEqual(["1/8", "1/4", "1/2", "3", "17"].map(numeroGs), [0.125, 0.25, 0.5, 3, 17]);
  assert.equal(mediaDadi("2d6+3"), 10);
  assert.equal(mediaDadi("19d12+133"), 256);
  assert.equal(testoDanni([{ dadi: "2d10+8", tipo: "perforanti" }, { dadi: "2d6", tipo: "fuoco" }]), "19 (2d10 + 8) perforanti più 7 (2d6) fuoco");
  assert.equal(bonusIniziativa(goblin), 2);
});

test("tiri delle azioni", (t) => {
  t.mock.method(Math, "random", () => 0.5); // ogni dado dà la metà + 1
  const att = tiraAzione(goblin, goblin.azioni[0]);
  assert.equal(att.testo, "Goblin — Scimitarra: 15 per colpire (d20 11+4) · 6 taglienti");
  assert.equal(att.tiro.facce === undefined ? att.tiro.formula : att.tiro.formula, "1d20+4");
  const drago = MOSTRI.find((m) => m.chiave === "adult-red-dragon");
  const soffio = tiraAzione(drago, drago.azioni.find((a) => a.ricarica));
  assert.equal(soffio.testo, "Drago Rosso Adulto — Soffio di Fuoco (Ricarica 5–6): ricarica d6 = 4, non pronta · TS su Destrezza CD 21 · 72 fuoco (metà se lo supera)");
  assert.equal(azioneTirabile(goblin.tratti[0]), false);
  t.mock.method(Math, "random", () => 0.99); // 20 naturale: critico, dadi dei danni raddoppiati
  const critico = tiraAzione(goblin, goblin.azioni[0]);
  assert.equal(critico.testo, "Goblin — Scimitarra: 24 per colpire (d20 20+4) — 20 naturale, critico! · 14 taglienti");
});

test("elenco: filtri e ordine", () => {
  const mie = [{ ...copiaCreatura(goblin), id: "g", fonte: "dm" }];
  const elenco = [...MOSTRI.map((m) => ({ ...m, fonte: "srd" })), ...mie];
  assert.equal(filtraCreature(elenco, { testo: "goblin" }).map((c) => c.nome).join(), "Goblin (copia),Goblin,Hobgoblin");
  assert.equal(filtraCreature(elenco, { fonte: "dm" }).length, 1);
  assert.ok(filtraCreature(elenco, { gs: "17-30" }).every((c) => numeroGs(c.gs) >= 17));
  assert.ok(filtraCreature(elenco, { tipo: "drago", taglia: "enorme" }).every((c) => c.tipo === "drago" && c.taglia === "enorme"));
  assert.equal(filtraCreature(elenco, { testo: "verita" }).length, 0);
  assert.ok(filtraCreature(elenco, { testo: "melma" }).length > 0);
});

test("creature del DM: copia, nuova, danni, risorse e riposo", () => {
  const copia = copiaCreatura({ ...goblin, fonte: "srd" });
  assert.equal(copia.nome, "Goblin (copia)");
  assert.equal(copia.base, "goblin");
  assert.deepEqual([copia.indole, copia.unico, copia.chiave], ["ostile", false, undefined]);
  copia.azioni[0].nome = "Altro";
  assert.equal(goblin.azioni[0].nome, "Scimitarra");
  assert.equal(creaturaVuota().pf, 4);
  assert.deepEqual(danniDaTesto("1d6+2 taglienti; 2d6 fuoco; boh"), [{ dadi: "1d6+2", tipo: "taglienti" }, { dadi: "2d6", tipo: "fuoco" }]);
  assert.equal(testoDaDanni([{ dadi: "1d6+2", tipo: "taglienti" }]), "1d6+2 taglienti");
  const r = { nome: "Grido", max: 3, usati: 1 };
  assert.equal(cambiaUsi(r, 2).usati, 3);
  assert.equal(cambiaUsi(r, 0).usati, 0);
  const varro = { ...copiaCreatura(MOSTRI.find((m) => m.chiave === "veteran")), unico: true };
  const stato = { ...statoIniziale(varro), pfAttuali: 20, risorse: [r] };
  const dopo = riposoLungo(varro, stato, "Sessione 12");
  assert.deepEqual([dopo.pfAttuali, dopo.risorse[0].usati, dopo.diario[0].sessione], [58, 0, "Sessione 12"]);
  assert.equal(etichettaDiario(12), "Sessione 12");
  assert.match(etichettaDiario(null, new Date(2026, 9, 3)), /3 ott 2026/);
});
