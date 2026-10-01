// Esportazione delle schede: valori calcolati come nella scheda del sito e
// PDF generato con la libreria e i font inclusi nel repo (assets/vendor/pdf,
// assets/fonts/pdf), con o senza ritratto e su più pagine se serve.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RADICE, elencoFile } from "../../strumenti/aggiorna-sw.mjs";
import { vistaScheda, classeArmatura, bonusAttaccoSuggerito } from "../../assets/js/calcoli-scheda.js";
import { creaPdfSchede } from "../../assets/js/pdf-scheda.js";
import { PDFDocument, rgb, fontkit } from "../../assets/vendor/pdf/pdf-lib-fontkit.min.js";

const leggi = (p) => readFileSync(join(RADICE, p));
const font = {
  titolo: leggi("assets/fonts/pdf/cinzel-700.woff"),
  testo: leggi("assets/fonts/pdf/eb-garamond-400.woff"),
  grassetto: leggi("assets/fonts/pdf/eb-garamond-600.woff"),
  corsivo: leggi("assets/fonts/pdf/eb-garamond-400-italic.woff"),
};

const guerriero = () => ({
  id: "s1", proprietarioUid: "u1", nome: "Brunilde", classe: "guerriero", razza: "umano", livello: 3,
  caratteristiche: { forza: 16, destrezza: 14, costituzione: 15, intelligenza: 10, saggezza: 12, carisma: 8 },
  abilitaCompetenti: ["atletica", "percezione"], hp: { massimi: 28, attuali: 28, temporanei: 0 },
  inventario: [
    { chiave: "spada_lunga", nome: "Spada lunga", categoria: "arma", quantita: 1 },
    { chiave: "arco_lungo", nome: "Arco lungo", categoria: "arma", quantita: 1 },
    { chiave: "cotta_di_maglia", nome: "Cotta di maglia", categoria: "armatura", quantita: 1 },
    { chiave: "scudo", nome: "Scudo", categoria: "armatura", quantita: 1 },
  ],
  armaturaIndossata: "cotta_di_maglia", scudoIndossato: true,
  talenti: ["Stile di Combattimento", "Recupero Energie", "Azione Impetuosa", "Archetipo Marziale: Campione"],
  personalita: { tratti: "Parla poco.", ideali: "", legami: "La sua compagnia.", difetti: "" },
  competenzeLinguaggi: "Tutte le armature, scudi; armi semplici e da guerra.\nLinguaggi: Comune, Nanico.",
});

test("valori calcolati come nella scheda: CA, attacchi, tiri salvezza, abilità", () => {
  const scheda = guerriero();
  assert.equal(classeArmatura(scheda), 18); // cotta di maglia 16 + scudo 2
  assert.equal(bonusAttaccoSuggerito(scheda, "spada_lunga"), 5); // For +3, competenza +2
  assert.equal(bonusAttaccoSuggerito(scheda, "arco_lungo"), 4); // Des +2, competenza +2
  const v = vistaScheda(scheda);
  assert.equal(v.ca, 18);
  assert.deepEqual(v.attacchi.map((a) => [a.nome, a.bonus, a.danno]), [
    ["Spada lunga", "+5", "1d8 + 3 taglio"],
    ["Arco lungo", "+4", "1d8 + 2 perforante"],
  ]);
  assert.equal(v.salvezze.find((s) => s.nome === "Forza").valore, "+5");
  assert.equal(v.abilita.find((a) => a.nome === "Atletica").valore, "+5");
  assert.equal(v.percezionePassiva, 13);
  assert.equal(v.incantesimi, null);
  assert.ok(v.privilegi.some((p) => p.nome === "Azione Impetuosa"));
});

test("incantesimi: attacco e CD dalla caratteristica della classe", () => {
  const maga = { ...guerriero(), classe: "mago", caratteristiche: { intelligenza: 16 }, incantesimiConosciuti: [], incantesimiPreparati: [] };
  const v = vistaScheda(maga);
  assert.equal(v.incantesimi.attacco, "+5");
  assert.equal(v.incantesimi.cd, 13);
  assert.equal(v.incantesimi.titoloConosciuti, "Libro degli incantesimi");
});

async function pdf(schede) {
  const byte = await creaPdfSchede(schede, { pdfLib: { PDFDocument, rgb }, fontkit, font, data: new Date("2026-10-04") });
  assert.equal(Buffer.from(byte.slice(0, 5)).toString(), "%PDF-");
  return PDFDocument.load(byte);
}

test("PDF di una scheda: due pagine, con o senza ritratto", async () => {
  const ritratto = { byte: leggi("assets/icone/icona-192.png"), tipo: "png" };
  assert.equal((await pdf([{ vista: vistaScheda(guerriero()), giocatore: "Pia", ritratto }])).getPageCount(), 2);
  assert.equal((await pdf([{ vista: vistaScheda(guerriero()), giocatore: null, ritratto: null }])).getPageCount(), 2);
  // Un ritratto illeggibile non blocca l'esportazione.
  assert.equal((await pdf([{ vista: vistaScheda(guerriero()), ritratto: { byte: new Uint8Array([1, 2, 3]), tipo: "jpg" } }])).getPageCount(), 2);
});

test("PDF del party e testi lunghi: le pagine continuano", async () => {
  const lunga = guerriero();
  lunga.talenti = Array.from({ length: 70 }, (_, i) => `Talento numero ${i + 1} con una descrizione abbastanza lunga da andare a capo nella colonna`);
  lunga.nome = "Nome con emoji 🐉 e accenti àèìòù";
  const documento = await pdf([
    { vista: vistaScheda(guerriero()), giocatore: "Pia" },
    { vista: vistaScheda(lunga), giocatore: "Leo" },
  ]);
  assert.ok(documento.getPageCount() >= 5, `pagine: ${documento.getPageCount()}`);
});

test("librerie e font del PDF non si scaricano all'installazione dell'app", () => {
  const precache = elencoFile();
  assert.ok(!precache.some((f) => f.startsWith("assets/vendor/pdf/") || f.startsWith("assets/fonts/pdf/")));
  assert.match(readFileSync(join(RADICE, "sw.js"), "utf8"), /SU_RICHIESTA = \["\.\/assets\/vendor\/pdf\/", "\.\/assets\/fonts\/pdf\/"\]/);
});
