// Calcoli della mappa della sessione (assets/js/mappa-calcoli.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  camAdatta,
  camPerRettangolo,
  rettangoloVisibile,
  zoomIntorno,
  centroCasella,
  casellaDaCentro,
  aggancia,
  caselleTra,
  testoDistanza,
  taratura,
  caselleLibereIntorno,
  righeGriglia,
  caselleTaglia,
} from "../../assets/js/mappa-calcoli.js";

const griglia = { lato: 60, ox: 20, oy: 10 };

test("centro di una casella e ritorno", () => {
  assert.deepEqual(centroCasella(griglia, { c: 2, r: 1 }), { x: 170, y: 100 });
  assert.deepEqual(casellaDaCentro(griglia, { x: 170, y: 100 }), { c: 2, r: 1 });
  assert.deepEqual(aggancia({ c: 2.4, r: 0.6 }), { c: 2, r: 1 });
});

test("distanza: la diagonale vale una casella", () => {
  assert.equal(caselleTra({ c: 0, r: 0 }, { c: 3, r: 2 }), 3);
  assert.equal(caselleTra({ c: 4, r: 4 }, { c: 4, r: -1 }), 5);
  assert.equal(caselleTra({ c: 0, r: 0 }, { c: 0.4, r: 0.3 }), 0);
});

test("testo della distanza in metri rispetto alla velocità", () => {
  assert.deepEqual(testoDistanza(5, 9), { metri: 7.5, testo: "7,5 m di 9 m", oltre: false });
  assert.equal(testoDistanza(7, 9).oltre, true);
  assert.equal(testoDistanza(4, 7.5).testo, "6 m di 7,5 m");
  assert.equal(testoDistanza(2, null).testo, "3 m");
});

test("taratura con due clic, anche su più caselle e in qualsiasi ordine", () => {
  assert.deepEqual(taratura({ x: 80, y: 70 }, { x: 140, y: 130 }), { lato: 60, ox: 20, oy: 10 });
  assert.deepEqual(taratura({ x: 320, y: 310 }, { x: 80, y: 70 }, 4), { lato: 60, ox: 20, oy: 10 });
  assert.equal(taratura({ x: 0, y: 0 }, { x: 1, y: 1 }), null);
});

test("telecamera: adatta, inquadratura e zoom attorno a un punto", () => {
  const cam = camAdatta(800, 400, 1200, 800);
  assert.ok(Math.abs(cam.z - 0.48) < 1e-9);
  const r = rettangoloVisibile(496, 279, camPerRettangolo(496, 279, { x: 100, y: 50, w: 320, h: 180 }));
  assert.ok(Math.abs(r.x - 100) < 1e-9 && Math.abs(r.w - 320) < 1e-9);
  const z = zoomIntorno({ x: 0, y: 0, z: 1 }, 100, 50, 2, 0.5, 3);
  assert.deepEqual(z, { x: -100, y: -50, z: 2 });
  assert.equal(zoomIntorno({ x: 0, y: 0, z: 1 }, 0, 0, 10, 0.5, 3).z, 3);
});

test("caselle libere per piazzare il party", () => {
  const libere = caselleLibereIntorno({ c: 5, r: 5 }, 4, [{ c: 5, r: 5 }]);
  assert.equal(libere.length, 4);
  assert.ok(libere.every((p) => Math.max(Math.abs(p.c - 5), Math.abs(p.r - 5)) === 1));
  assert.equal(new Set(libere.map((p) => `${p.c},${p.r}`)).size, 4);
  assert.ok(caselleLibereIntorno({ c: 0, r: 0 }, 3).every((p) => p.c >= 0 && p.r >= 0));
});

test("righe della griglia", () => {
  const { verticali, orizzontali } = righeGriglia(griglia, 200, 100);
  assert.deepEqual(verticali, [20, 80, 140, 200]);
  assert.deepEqual(orizzontali, [10, 70]);
});

test("taglie: le creature grandi occupano più caselle e il centro segue", () => {
  assert.equal(caselleTaglia("media"), 1);
  assert.equal(caselleTaglia("grande"), 2);
  assert.equal(caselleTaglia("mastodontica"), 4);
  assert.equal(caselleTaglia("sconosciuta"), 1);
  assert.deepEqual(centroCasella(griglia, { c: 2, r: 1 }, 2), { x: 200, y: 130 });
  assert.deepEqual(casellaDaCentro(griglia, { x: 200, y: 130 }, 2), { c: 2, r: 1 });
});


test("nebbia: dimensioni, codifica e ritorno", async () => {
  const { dimensioniNebbia, creaNebbia, codificaCelle, decodificaCelle, cambiaCelle, cellaCoperta } = await import("../../assets/js/mappa-calcoli.js");
  const dim = dimensioniNebbia({ lato: 60, ox: 20, oy: 10 }, 1080, 720);
  assert.deepEqual(dim, { c0: -1, r0: -1, colonne: 19, righe: 13 });
  const nebbia = cambiaCelle(creaNebbia(dim), [[0, 0], [3, 4], [-1, -1]], false);
  const ritorno = decodificaCelle(codificaCelle(nebbia.celle), nebbia.celle.length);
  assert.deepEqual([...ritorno], [...nebbia.celle]);
  assert.equal(cellaCoperta(nebbia, 3, 4), false);
  assert.equal(cellaCoperta(nebbia, 3, 5), true);
  assert.equal(cellaCoperta(nebbia, 99, 0), true, "fuori dalla mappa conta come coperta");
  assert.equal(cellaCoperta({ ...nebbia, attiva: false }, 3, 5), false, "nebbia spenta: tutto visibile");
  assert.equal(decodificaCelle("@@non valida@@", 4).every((v) => v === 1), true);
});

test("nebbia: pennello, rettangolo, torcia e pedine sotto la nebbia", async () => {
  const { creaNebbia, cambiaCelle, casellePennello, caselleRettangolo, caselleCerchio, pedinaSottoNebbia, strisceNebbia } = await import("../../assets/js/mappa-calcoli.js");
  assert.equal(casellePennello({ c: 5, r: 5 }, 3).length, 9);
  assert.equal(caselleRettangolo({ c: 4, r: 2 }, { c: 1, r: 3 }).length, 8);
  assert.ok(caselleCerchio({ c: 0, r: 0 }, 6).some(([c, r]) => c === 6 && r === 0));
  assert.ok(!caselleCerchio({ c: 0, r: 0 }, 6).some(([c, r]) => c === 6 && r === 6));
  const nebbia = cambiaCelle(creaNebbia({ c0: 0, r0: 0, colonne: 10, righe: 10 }), caselleRettangolo({ c: 0, r: 0 }, { c: 4, r: 9 }), false);
  assert.equal(pedinaSottoNebbia(nebbia, { c: 2, r: 2 }), false);
  assert.equal(pedinaSottoNebbia(nebbia, { c: 6, r: 2 }), true);
  assert.equal(pedinaSottoNebbia(nebbia, { c: 4, r: 2 }, 2), true, "Grande: conta la casella al centro");
  const strisce = strisceNebbia(nebbia, { lato: 50, ox: 0, oy: 0 }, 0);
  assert.equal(strisce.length, 10);
  assert.deepEqual(strisce[0], { x: 250, y: 0, w: 250, h: 50 });
});

test("aree degli incantesimi su griglia (regole 5e)", async () => {
  const { caselleArea, contornoArea, pedineInCaselle, verticePiuVicino, metriTraPunti } = await import("../../assets/js/mappa-calcoli.js");
  const g = { lato: 50, ox: 0, oy: 0 };
  // Sfera di 6 m (4 caselle) dal vertice (500, 400): il cerchio delle caselle.
  const sfera = caselleArea({ forma: "sfera", misura: 6, x: 500, y: 400 }, g);
  assert.equal(sfera.length, 52);
  assert.ok(sfera.some(({ c, r }) => c === 9 && r === 7) && !sfera.some(({ c, r }) => c === 6 && r === 4));
  // Cono di 4,5 m verso destra: largo quanto è lungo, a ventaglio (1, 1, 3 caselle).
  const cono = caselleArea({ forma: "cono", misura: 4.5, x: 0, y: 25, angolo: 0 }, g);
  assert.deepEqual(cono.map(({ c, r }) => `${c},${r}`).sort(), ["0,0", "1,0", "2,-1", "2,0", "2,1"].sort());
  // Linea di 30 m verso il basso: 20 caselle in colonna.
  assert.equal(caselleArea({ forma: "linea", misura: 30, x: 25, y: 0, angolo: Math.PI / 2 }, g).length, 20);
  // Cubo di 6 m verso l'alto a sinistra: 4×4.
  const cubo = caselleArea({ forma: "cubo", misura: 6, x: 400, y: 400, angolo: -2.4 }, g);
  assert.equal(cubo.length, 16);
  assert.ok(cubo.every(({ c, r }) => c >= 4 && c <= 7 && r >= 4 && r <= 7));
  assert.equal(contornoArea({ forma: "cono", misura: 4.5, x: 0, y: 0, angolo: 0 }, g).punti.length, 3);
  assert.equal(pedineInCaselle([{ id: "a", c: 8, r: 8 }, { id: "b", c: 3, r: 3, caselle: 2 }], cubo).map((p) => p.id).join(), "b");
  assert.deepEqual(verticePiuVicino({ lato: 60, ox: 20, oy: 10 }, { x: 95, y: 30 }), { x: 80, y: 10 });
  assert.equal(metriTraPunti(g, { x: 10, y: 10 }, { x: 160, y: 60 }), 4.5);
});

test("aree degli incantesimi: catalogo e scheda", async () => {
  const { AREE_INCANTESIMI, areeDellaScheda } = await import("../../assets/js/aree-incantesimi.js");
  const { ottieniIncantesimo } = await import("../../assets/js/incantesimi-srd.js");
  for (const [chiave, { forma, misura }] of Object.entries(AREE_INCANTESIMI)) {
    assert.ok(ottieniIncantesimo(chiave), `${chiave} non è nel catalogo`);
    assert.ok(["sfera", "cono", "cubo", "linea"].includes(forma) && misura > 0 && misura <= 150);
  }
  const aree = areeDellaScheda({ incantesimiConosciuti: ["palla_di_fuoco", "dardo_incantato", "mani_brucianti"], incantesimiPreparati: ["palla_di_fuoco"] });
  assert.deepEqual(aree.map((a) => `${a.chiave}:${a.forma}:${a.misura}`), ["mani_brucianti:cono:4.5", "palla_di_fuoco:sfera:6"]);
  assert.deepEqual(areeDellaScheda(null), []);
});
