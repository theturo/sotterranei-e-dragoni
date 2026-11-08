// Intro «drago e D20» (assets/js/intro-scena.js): i beat approvati del montaggio.
// Il drago entra da sinistra, gira in senso orario attorno al D20 fermo al centro, scende
// sul dado arrivando dritto (in alto, da sinistra verso destra), la camera stringe sulla
// testa, poi il bianco copre tutto e resta finché la pagina non è pronta.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FPS, FRAMES, F, FINE_BIANCO, beat, geometria, creaTraiettoria, camera, parametriFondo,
} from "../../assets/js/intro-scena.js";
import { PEZZI, FILE } from "../../assets/js/intro-pezzi.js";
import { existsSync } from "node:fs";

const FORMATI = [[1920, 1080], [1080, 1920], [1366, 768], [390, 844]];
const testa = (tr, f) => tr.punto(tr.sAt(f));

test("160 frame a 24 fps, beat nell'ordine del montaggio", () => {
  assert.equal(FPS, 24);
  assert.equal(FRAMES, 160);
  assert.ok(F.virata < F.orbita && F.orbita < F.spirale && F.spirale < F.urto && F.urto < FINE_BIANCO);
  assert.equal(beat(0), "Ingresso da sinistra");
  assert.equal(beat(F.urto), "Collisione");
  assert.equal(beat(159), "Finale (spazio per il logo)");
});

test("ellisse larga in orizzontale, alta in verticale", () => {
  const o = geometria(1920, 1080), v = geometria(1080, 1920);
  assert.ok(o.rx > o.ry);
  assert.ok(v.ry > v.rx);
});

for (const [W, H] of FORMATI) {
  test(`${W}×${H}: ingresso da sinistra, orbita oraria, urto dritto sul dado`, () => {
    const g = geometria(W, H), tr = creaTraiettoria(g);
    // all'inizio la testa è fuori campo a sinistra e va verso destra
    const [x0, , tx0] = testa(tr, 0);
    assert.ok(x0 < 0, `testa visibile al frame 0: ${x0}`);
    assert.ok(tx0 > 0);
    // orbita: l'angolo attorno al dado cresce sempre (orario sullo schermo, y verso il basso)
    let prima = null, giro = 0;
    for (let f = F.virata; f <= F.spirale; f += 1) {
      const [x, y] = testa(tr, f);
      const a = Math.atan2(y - g.cy, x - g.cx);
      if (prima !== null) {
        let d = a - prima;
        if (d < -Math.PI) d += 2 * Math.PI;
        if (d > Math.PI) d -= 2 * Math.PI;
        assert.ok(d > 0, `al frame ${f} gira al contrario`);
        giro += d;
      }
      prima = a;
    }
    assert.ok(giro > 1.4 * Math.PI, `meno di un giro ampio prima della spirale: ${giro}`);
    // urto: vicino al dado, sopra di lui, diretto verso destra (testa dritta, non capovolta)
    const [xu, yu, txu] = testa(tr, F.urto);
    assert.ok(Math.hypot(xu - g.cx, yu - g.cy) < 0.15 * g.u, "all'urto la testa è lontana dal dado");
    assert.ok(yu < g.cy, "all'urto la testa non arriva dall'alto");
    assert.ok(txu > 0, "all'urto il drago va verso sinistra: sarebbe capovolto");
  });
}

test("la camera stringe sulla testa solo nella spirale e poi entra nell'esplosione", () => {
  const g = geometria(1920, 1080), tr = creaTraiettoria(g);
  assert.deepEqual(camera(g, tr, 60), { s: 1, fx: g.cx, fy: g.cy });
  assert.ok(camera(g, tr, F.urto).s > 1.5);
  assert.ok(camera(g, tr, 159).s > camera(g, tr, F.urto).s);
});

test("il bianco arriva dopo l'urto e resta durante l'attesa", () => {
  const g = geometria(1920, 1080), tr = creaTraiettoria(g);
  const p = (f) => parametriFondo(g, f, camera(g, tr, f));
  assert.equal(p(F.urto - 1).bianco, 0);
  assert.equal(p(FINE_BIANCO).bianco, 1);
  assert.equal(p(400).bianco, 1);
  assert.ok(p(400).rot > p(200).rot, "nell'attesa il vortice gira ancora");
});

test("i pezzi dipinti elencati esistono e hanno le misure", () => {
  for (const nome of FILE) {
    assert.ok(existsSync(new URL(`../../assets/img/intro/${nome}.webp`, import.meta.url)), nome);
  }
  for (const nome of ["testa_chiusa", "testa_aperta", "testa_tre_quarti", "corpo", "coda", "d20", "schegge", "pennellate", "logo"]) {
    assert.ok(PEZZI[nome], nome);
  }
  assert.equal(PEZZI.schegge.pezzi.length, 13);
  assert.equal(PEZZI.pennellate.r.length, 16);
});
