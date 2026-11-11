// Vaschetta dei dadi: i sei solidi (poliedri.js), le simmetrie che fissano il
// risultato, la fisica del lancio (fisica-dadi.js), la base del movimento
// (movimento.js), le scelte salvate (vaschetta-scelte.js) e gli agganci nelle
// pagine.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { v, q } from "../../assets/js/geometria-3d.js";
import { POLIEDRI, TIPI, poliedro, elementoDi, elementoInAlto, simmetria, eSimmetria } from "../../assets/js/poliedri.js";
import { simula, simulaBene, facciaSotto, FISICA } from "../../assets/js/fisica-dadi.js";
import { molla, curve, fotogrammi, casuale, scintille } from "../../assets/js/movimento.js";
import { MATERIALI, VISTE, scelteVaschetta, salvaScelteVaschetta } from "../../assets/js/vaschetta-scelte.js";
import { tira, dadiPerVaschetta } from "../../assets/js/dadi-base.js";

const leggi = (percorso) => readFileSync(new URL(`../../${percorso}`, import.meta.url), "utf8");

// ---------- I solidi ----------
const LATI = { 4: 3, 6: 4, 8: 3, 10: 4, 12: 5, 20: 3 };
const VERTICI = { 4: 4, 6: 8, 8: 6, 10: 12, 12: 20, 20: 12 };

for (const tipo of TIPI) {
  const s = poliedro(tipo);

  test(`d${tipo}: facce, lati e vertici giusti`, () => {
    assert.equal(s.facce.length, tipo);
    assert.equal(s.vertici.length, VERTICI[tipo]);
    for (const f of s.facce) assert.equal(f.length, LATI[tipo]);
    // Formula di Eulero: vertici − spigoli + facce = 2.
    assert.equal(s.vertici.length - (s.facce.length * LATI[tipo]) / 2 + s.facce.length, 2);
  });

  test(`d${tipo}: raggio 1, facce piatte e rivolte in fuori`, () => {
    assert.ok(Math.abs(Math.max(...s.vertici.map(v.len)) - 1) < 1e-9);
    s.facce.forEach((f, i) => {
      const n = s.normali[i];
      assert.ok(v.dot(n, s.centri[i]) > 0, "normale verso l'esterno");
      for (const k of f) assert.ok(Math.abs(v.dot(v.sub(s.vertici[k], s.vertici[f[0]]), n)) < 1e-6, `faccia ${i} non piatta`);
    });
  });

  test(`d${tipo}: i numeri stanno sulla faccia e non sono specchiati`, () => {
    for (const e of s.etichette) {
      const n = s.normali[e.faccia];
      assert.ok(Math.abs(v.dot(e.su, n)) < 1e-6);
      assert.ok(Math.abs(v.len(e.su) - 1) < 1e-6);
      // destra × su = normale: il numero si legge da fuori.
      assert.ok(v.dot(v.cross(e.destra, e.su), n) > 0.999);
      assert.ok(e.alt > 0.05 && e.alt < 1);
    }
  });
}

for (const tipo of [6, 8, 10, 12, 20]) {
  test(`d${tipo}: numeri da 1 a ${tipo} una volta sola, facce opposte che sommano ${tipo + 1}`, () => {
    const s = POLIEDRI[tipo];
    assert.deepEqual([...s.valori].sort((a, b) => a - b), Array.from({ length: tipo }, (_, i) => i + 1));
    s.normali.forEach((n, i) => {
      const opposta = s.normali.findIndex((m) => v.dot(m, n) < -0.999);
      assert.equal(s.valori[i] + s.valori[opposta], tipo + 1);
    });
  });
}

test("d4: si legge in cima, ogni valore sta sui tre angoli che toccano il suo vertice", () => {
  const s = POLIEDRI[4];
  for (let valore = 1; valore <= 4; valore++) {
    const sue = s.etichette.filter((e) => e.testo === String(valore));
    assert.equal(sue.length, 3);
    for (const e of sue) assert.ok(s.facce[e.faccia].includes(valore - 1));
  }
});

test("d20: attorno al 20 ci sono 2, 8 e 14, come nel dado dipinto dell'intro", () => {
  const s = POLIEDRI[20];
  const venti = s.valori.indexOf(20);
  const vicine = s.facce.map((_, i) => i).filter((i) => i !== venti && s.facce[i].filter((k) => s.facce[venti].includes(k)).length === 2);
  assert.deepEqual(vicine.map((i) => s.valori[i]).sort((a, b) => a - b), [2, 8, 14]);
});

test("il 6 e il 9 hanno il punto solo dove servono (d10, d12, d20)", () => {
  for (const tipo of [10, 12, 20]) {
    const testi = POLIEDRI[tipo].etichette.map((e) => e.testo);
    assert.ok(testi.includes("6.") && testi.includes("9."));
  }
  assert.ok(POLIEDRI[6].etichette.some((e) => e.testo === "6"));
});

// ---------- Il risultato deciso prima ----------
const rotazioneCasuale = (rnd) => q.asse(v.norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]), rnd() * Math.PI * 2);

for (const tipo of TIPI) {
  test(`d${tipo}: una simmetria porta qualunque risultato al posto di qualunque altro`, () => {
    const s = POLIEDRI[tipo];
    for (let voluto = 0; voluto < tipo; voluto++) {
      for (let inAlto = 0; inAlto < tipo; inAlto++) {
        const S = simmetria(s, voluto, inAlto);
        assert.ok(S, `nessuna simmetria da ${voluto} a ${inAlto}`);
        assert.ok(eSimmetria(s, S));
      }
    }
  });

  test(`d${tipo}: comunque cada il dado, in alto finisce il risultato tirato`, () => {
    const s = POLIEDRI[tipo];
    const rnd = casuale(tipo * 11);
    for (let giro = 0; giro < 25; giro++) {
      const rot = rotazioneCasuale(rnd);
      const inAlto = elementoInAlto(s, rot);
      for (let risultato = 1; risultato <= tipo; risultato++) {
        const S = simmetria(s, elementoDi(s, risultato), inAlto);
        assert.equal(elementoInAlto(s, q.mul(rot, S)), elementoDi(s, risultato));
      }
    }
  });
}

test("tra le simmetrie possibili si sceglie quella con il numero più dritto", () => {
  for (const tipo of [6, 12, 20]) {
    const s = POLIEDRI[tipo];
    const rnd = casuale(tipo);
    for (let giro = 0; giro < 30; giro++) {
      // Un dado appoggiato: una faccia in alto, girato a caso attorno alla verticale.
      const rot = q.mul(q.asse([0, 0, 1], rnd() * 7), q.da(s.normali[Math.floor(rnd() * tipo)], [0, 0, 1]));
      const voluto = elementoDi(s, 1 + Math.floor(rnd() * tipo));
      const e = s.etichette.find((x) => x.faccia === voluto);
      const dritto = (S) => q.ruota(q.mul(rot, S), e.su)[1];
      // Mai più storto di mezzo giro di faccia (60° triangolo, 45° quadrato, 36° pentagono).
      const lati = s.facce[0].length;
      assert.ok(dritto(simmetria(s, voluto, elementoInAlto(s, rot), dritto)) >= Math.cos(Math.PI / lati) - 1e-6);
    }
  }
});

test("i dadi di un tiro per la vaschetta: uno per dado, più lo scartato con vantaggio e svantaggio", () => {
  const danni = tira({ etichetta: "Danni", quanti: 2, facce: 6, modificatore: 3, modo: "critico" });
  const voci = dadiPerVaschetta(danni, 6);
  assert.equal(voci.modo, "normale");
  assert.deepEqual(voci.dadi, danni.dadi.map((risultato) => ({ facce: 6, risultato })));
  assert.equal(voci.dadi.length, 4);

  for (const modo of ["vantaggio", "svantaggio"]) {
    const prova = tira({ etichetta: "Prova", modo });
    const due = dadiPerVaschetta(prova, 20);
    assert.equal(due.modo, modo);
    assert.deepEqual(due.dadi.map((d) => d.risultato), [prova.dadi[0], prova.scartato]);
    // Il primo è quello tenuto: il più alto con vantaggio, il più basso con svantaggio.
    const [tenuto, scartato] = due.dadi.map((d) => d.risultato);
    assert.ok(modo === "vantaggio" ? tenuto >= scartato : tenuto <= scartato);
  }
});

// ---------- La fisica ----------
// Larghezza e profondità interne come le calcola scena-dadi.js (finestra larga e telefono).
const LANCI = [
  ["1d20", [20], 11.4, 6.9],
  ["1d4", [4], 11.4, 6.9],
  ["4d6", [6, 6, 6, 6], 14, 8.6],
  ["8d6", Array(8).fill(6), 17.8, 11.2],
  ["uno per tipo", [4, 6, 8, 10, 12, 20], 17.8, 11.2],
  ["8d6 sul telefono", Array(8).fill(6), 14, 12.2],
];

for (const [nome, tipi, W, D] of LANCI) {
  test(`fisica, ${nome}: i dadi restano nella vaschetta e si fermano appoggiati su una faccia`, () => {
    for (let seme = 1; seme <= 8; seme++) {
      // Senza limite di tempo: il risultato del test non deve dipendere dalla velocità della macchina.
      const esito = simulaBene({ tipi, W, D, seme: seme * 101, tempoConcesso: Infinity });
      assert.ok(esito.valido, `seme ${seme}: lancio non valido`);
      assert.ok(esito.durata >= FISICA.durataMinima && esito.durata <= FISICA.durataMassima, `seme ${seme}: durata fuori misura (${esito.durata.toFixed(2)} s)`);
      esito.finali.forEach((d, i) => {
        const s = POLIEDRI[tipi[i]];
        const { faccia, piatta } = facciaSotto(s, d.rot);
        assert.ok(piatta > 0.9999, "faccia non appoggiata");
        // Il centro sta all'altezza giusta sopra il fondo.
        assert.ok(Math.abs(d.p[2] - v.dot(s.centri[faccia], s.normali[faccia])) < 1e-6);
        for (const b of s.vertici) {
          const p = v.add(d.p, q.ruota(d.rot, b));
          assert.ok(p[2] > -1e-3, "vertice sotto il fondo");
          assert.ok(Math.abs(p[0]) < W / 2 + 0.02 && Math.abs(p[1]) < D / 2 + 0.02, "dado fuori dalla vaschetta");
        }
      });
      // I dadi non finiscono uno dentro l'altro.
      for (let a = 0; a < tipi.length; a++) {
        for (let b = a + 1; b < tipi.length; b++) {
          assert.ok(v.len(v.sub(esito.finali[a].p, esito.finali[b].p)) > 2 * FISICA.raggioUrto - 0.02);
        }
      }
      // Durante tutto il lancio nessun dado attraversa il fondo.
      for (const quadro of esito.fotogrammi) {
        quadro.forEach((d, i) => {
          const minimo = Math.min(...POLIEDRI[tipi[i]].vertici.map((b) => d.p[2] + q.ruota(d.r, b)[2]));
          assert.ok(minimo > -0.05, `vertice sotto il fondo: ${minimo.toFixed(3)}`);
        });
      }
    }
  });
}

test("fisica: stesso seme, stesso lancio", () => {
  const a = simula({ tipi: [20, 6, 8], W: 14, D: 8.6, seme: 77 });
  const b = simula({ tipi: [20, 6, 8], W: 14, D: 8.6, seme: 77 });
  assert.equal(a.fotogrammi.length, b.fotogrammi.length);
  assert.deepEqual(a.finali, b.finali);
  assert.notDeepEqual(a.finali, simula({ tipi: [20, 6, 8], W: 14, D: 8.6, seme: 78 }).finali);
});

test("fisica: finito il tempo concesso si tiene il lancio migliore tra quelli provati", () => {
  const esito = simulaBene({ tipi: Array(12).fill(6), W: 21.5, D: 13.7, seme: 5, tempoConcesso: 0 });
  assert.equal(esito.tentativi, 1);
  assert.equal(esito.finali.length, 12);
});

// ---------- Movimento e scelte ----------
test("movimento: molla, curve, fotogrammi e numeri casuali ripetibili", () => {
  assert.equal(molla(0), 0);
  assert.ok(Math.abs(molla(3) - 1) < 1e-3);
  assert.ok(Math.max(...Array.from({ length: 50 }, (_, i) => molla(i / 50))) > 1, "la molla supera 1");
  for (const f of Object.values(curve)) {
    assert.ok(Math.abs(f(0)) < 1e-9);
    assert.ok(Math.abs(f(1) - 1) < 1e-9);
  }
  assert.deepEqual(fotogrammi(1, (t) => ({ opacity: t }), 4).map((f) => f.offset), [0, 0.25, 0.5, 0.75, 1]);
  const a = casuale(42);
  const b = casuale(42);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  assert.deepEqual(scintille(5, 7), scintille(5, 7));
});

test("scelte della vaschetta: predefinite, e mai un rivestimento o una vista che non esistono", () => {
  // In Node non c'è localStorage: valgono le predefinite, come su un dispositivo che non salva.
  assert.deepEqual(scelteVaschetta(), { materiale: "feltro-notte", vista: "tre-quarti" });
  assert.deepEqual(salvaScelteVaschetta({ materiale: "velluto", vista: "da sotto" }), { materiale: "feltro-notte", vista: "tre-quarti" });
  assert.equal(salvaScelteVaschetta({ materiale: "cuoio" }).materiale, "cuoio");
  assert.ok(Object.values(MATERIALI).every((m) => m.nome && /^#[0-9a-f]{6}$/.test(m.colore) && ["feltro", "cuoio", "legno"].includes(m.grana)));
  assert.ok(VISTE["tre-quarti"].angolo < VISTE.alto.angolo);
});

// ---------- Agganci nelle pagine ----------
test("la finestra del tiro e il riposo breve usano la vaschetta, che si scarica solo al bisogno", () => {
  const dadi = leggi("assets/js/dadi.js");
  assert.match(dadi, /import\("\.\/vaschetta\.js"\)/);
  assert.doesNotMatch(dadi, /from "\.\/vaschetta\.js"/);
  assert.match(dadi, /vaschetta\.lancia\(dadiPerVaschetta\(tiro, facce\)/);
  assert.match(leggi("assets/js/riposo.js"), /montaVaschetta\(palco\)/);
  // Niente più animazione CSS del vecchio vassoio.
  assert.doesNotMatch(leggi("assets/css/gioco.css"), /in-lancio|vassoio-lancio/);
});

test("il pannello ⚙️ ha la scelta di rivestimento e vista, senza caricare il disegno della vaschetta", () => {
  const menu = leggi("assets/js/menu-utente.js");
  assert.match(menu, /data-apri="dadi"/);
  assert.match(menu, /id="mu-form-dadi"/);
  assert.match(menu, /from "\.\/vaschetta-scelte\.js"/);
  assert.doesNotMatch(menu, /scena-dadi|vaschetta\.js/);
  assert.doesNotMatch(leggi("assets/js/vaschetta-scelte.js"), /^import /m);
});

test("le schegge dell'1 naturale sono quelle dipinte per l'intro", () => {
  assert.match(leggi("assets/css/gioco.css"), /\.dadi-scheggia \{\s+background-image: url\("\.\.\/img\/intro\/schegge\.webp"\)/);
  assert.ok(existsSync(new URL("../../assets/img/intro/schegge.webp", import.meta.url)));
  assert.match(leggi("assets/js/effetti-dadi.js"), /PEZZI\.schegge\.pezzi/);
});
