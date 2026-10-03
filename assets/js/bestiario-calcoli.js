// Calcoli del Bestiario (senza DOM, provati in Node): descrizione della
// creatura, modificatori, tiri delle azioni, filtri dell'elenco, copie dei
// mostri del SRD e stato dei personaggi unici.
// Una creatura ha la forma dei mostri di mostri-srd.js; quelle del DM
// (campagne/{c}/bestiario) hanno in più: base (chiave del mostro SRD da cui
// sono partite), indole ("ostile" | "neutrale" | "alleata"), unico, note,
// immagineId e, se uniche, lo stato che continua tra le sessioni.
import { tira, leggiFormula, conSegno } from "./dadi-base.js";

export const INDOLI = [
  { chiave: "ostile", nome: "Ostile" },
  { chiave: "neutrale", nome: "Neutrale" },
  { chiave: "alleata", nome: "Alleata" },
];

export const TAGLIE_CREATURA = ["minuscola", "piccola", "media", "grande", "enorme", "mastodontica"];
const TAGLIA_AGGETTIVO = {
  minuscola: ["Minuscolo", "Minuscola"], piccola: ["Piccolo", "Piccola"], media: ["Medio", "Media"],
  grande: ["Grande", "Grande"], enorme: ["Enorme", "Enorme"], mastodontica: ["Mastodontico", "Mastodontica"],
};
const TIPI_FEMMINILI = new Set(["aberrazione", "bestia", "mostruosità", "melma"]);
export const TIPI_CREATURA = [
  "aberrazione", "bestia", "celestiale", "costrutto", "drago", "elementale", "folletto", "gigante", "immondo", "melma",
  "mostruosità", "non morto", "umanoide", "vegetale", "sciame di bestie Minuscole",
];

export const CARATTERISTICHE = [
  { chiave: "for", sigla: "FOR", nome: "Forza" },
  { chiave: "des", sigla: "DES", nome: "Destrezza" },
  { chiave: "cos", sigla: "COS", nome: "Costituzione" },
  { chiave: "int", sigla: "INT", nome: "Intelligenza" },
  { chiave: "sag", sigla: "SAG", nome: "Saggezza" },
  { chiave: "car", sigla: "CAR", nome: "Carisma" },
];

export const modificatore = (valore) => Math.floor((Number(valore) - 10) / 2);
export const testoModificatore = (n) => (n >= 0 ? `+${n}` : `−${-n}`);
export const bonusIniziativa = (creatura) => modificatore(creatura.car?.[1] ?? 10);

// "Umanoide Piccolo (goblinoide), neutrale malvagio"
export function descrizioneTipo(c) {
  const tipo = c.tipo || "creatura";
  const femminile = TIPI_FEMMINILI.has(tipo);
  const taglia = TAGLIA_AGGETTIVO[c.taglia]?.[femminile ? 1 : 0] || "";
  const iniziale = tipo.startsWith("sciame") ? `Sciame ${taglia} di bestie Minuscole` : `${tipo[0].toUpperCase()}${tipo.slice(1)} ${taglia}`;
  return `${iniziale.trim()}${c.sottotipo ? ` (${c.sottotipo})` : ""}${c.allineamento ? `, ${c.allineamento}` : ""}`;
}

// Grado di sfida come numero (per ordinare e filtrare): "1/4" → 0.25.
export function numeroGs(gs) {
  const testo = String(gs ?? "").trim();
  const frazione = /^(\d+)\/(\d+)$/.exec(testo);
  if (frazione) return Number(frazione[1]) / Number(frazione[2]);
  const n = Number(testo);
  return Number.isFinite(n) ? n : 0;
}

// Media di un'espressione di dadi ("2d6+3" → 10), come nei blocchi 5e.
export function mediaDadi(espressione) {
  if (/^\d+$/.test(String(espressione))) return Number(espressione);
  const f = leggiFormula(espressione);
  if (!f) return null;
  return Math.floor((f.quanti * (f.facce + 1)) / 2) + f.modificatore;
}

// [{ dadi, tipo }] → "5 (1d6 + 2) taglienti più 7 (2d6) fuoco"
export function testoDanni(danni = []) {
  return danni.map(({ dadi, tipo }) => (/^\d+$/.test(dadi) ? `${dadi} ${tipo}` : `${mediaDadi(dadi) ?? "?"} (${dadi.replace(/([+-])/, " $1 ")}) ${tipo}`)).join(" più ");
}

const NOMI_CAR = Object.fromEntries(CARATTERISTICHE.map((c) => [c.chiave, c.nome]));

// L'azione si può tirare se ha un tiro per colpire, una CD o dei danni.
export const azioneTirabile = (a) => a && (Number.isFinite(a.colpire) || Boolean(a.ts) || Boolean(a.danni?.length));

// Tiro di un'azione: { testo, tiro } per il registro della sessione.
// "tiro" è il d20 (o il primo dado dei danni) nel formato di dadi.js.
// opzioni.critico: raddoppia i dadi dei danni (colpo critico già noto).
export function tiraAzione(creatura, azione, { modo = "normale" } = {}) {
  const parti = [];
  let tiro = null;
  let critico = false;
  if (Number.isFinite(azione.colpire)) {
    tiro = tira({ etichetta: `${azione.nome}`, quanti: 1, facce: 20, modificatore: azione.colpire, modo });
    critico = tiro.critico === "successo";
    const esito = tiro.critico === "successo" ? " — 20 naturale, critico!" : tiro.critico === "fallimento" ? " — 1 naturale" : "";
    parti.push(`${tiro.totale} per colpire (d20 ${tiro.dadi[0]}${conSegno(azione.colpire)})${esito}`);
  }
  if (azione.ricarica) {
    const d6 = tira({ etichetta: "Ricarica", quanti: 1, facce: 6 });
    const pronta = d6.totale >= azione.ricarica;
    parti.unshift(`ricarica d6 = ${d6.totale}${pronta ? ", pronta" : ", non pronta"}`);
    if (!tiro) tiro = d6;
  }
  if (azione.ts) {
    parti.push(`TS su ${NOMI_CAR[azione.ts.car] || azione.ts.car} CD ${azione.ts.cd}`);
  }
  if (azione.danni?.length) {
    const danni = azione.danni.map(({ dadi, tipo }) => {
      if (/^\d+$/.test(dadi)) return `${dadi} ${tipo}`; // danno fisso (es. 1 perforante)
      const f = leggiFormula(dadi);
      if (!f) return null;
      const t = tira({ etichetta: tipo, quanti: f.quanti, facce: f.facce, modificatore: f.modificatore, modo: critico ? "critico" : "normale" });
      if (!tiro) tiro = t;
      return `${t.totale} ${tipo}`;
    }).filter(Boolean);
    if (danni.length) parti.push(`${danni.join(" + ")}${azione.ts?.meta ? " (metà se lo supera)" : ""}`);
  }
  return { testo: `${creatura.nome} — ${azione.nome}: ${parti.join(" · ")}`, tiro };
}

// ---------- elenco ----------

export const FASCE_GS = [
  { chiave: "", nome: "Tutti i GS" },
  { chiave: "0-1", nome: "GS 0–1", da: 0, a: 1 },
  { chiave: "2-4", nome: "GS 2–4", da: 2, a: 4 },
  { chiave: "5-10", nome: "GS 5–10", da: 5, a: 10 },
  { chiave: "11-16", nome: "GS 11–16", da: 11, a: 16 },
  { chiave: "17-30", nome: "GS 17+", da: 17, a: 30 },
];

const normalizza = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// filtri: { testo, fonte: "" | "srd" | "dm", gs (chiave di FASCE_GS), tipo, taglia }
export function filtraCreature(elenco, { testo = "", fonte = "", gs = "", tipo = "", taglia = "" } = {}) {
  const cerca = normalizza(testo.trim());
  const fascia = FASCE_GS.find((f) => f.chiave === gs);
  return elenco
    .filter((c) => !fonte || c.fonte === fonte)
    .filter((c) => !cerca || normalizza(c.nome).includes(cerca))
    .filter((c) => !fascia?.chiave || (numeroGs(c.gs) >= fascia.da && numeroGs(c.gs) <= fascia.a))
    .filter((c) => !tipo || c.tipo === tipo)
    .filter((c) => !taglia || c.taglia === taglia)
    .sort((a, b) => (a.fonte === b.fonte ? 0 : a.fonte === "dm" ? -1 : 1) || a.nome.localeCompare(b.nome, "it"));
}

// ---------- creature del DM ----------

const CAMPI_BLOCCO = [
  "nome", "taglia", "tipo", "sottotipo", "allineamento", "ca", "caValore", "pf", "dadiPf", "velocita", "car", "ts", "abilita",
  "vulnerabilita", "resistenze", "immunita", "immunitaCondizioni", "sensi", "lingue", "gs", "pe", "tratti", "azioni", "reazioni", "leggendarie",
];

export const statoIniziale = (creatura) => ({ pfAttuali: creatura.pf, condizioni: [], risorse: [], equip: [], diario: [] });

// Copia modificabile di un mostro (SRD o del DM): «Usa come base».
export function copiaCreatura(base) {
  const copia = {};
  for (const k of CAMPI_BLOCCO) if (base[k] !== undefined) copia[k] = structuredClone(base[k]);
  copia.nome = `${base.nome} (copia)`.slice(0, 60);
  copia.base = base.fonte === "srd" ? base.chiave : base.base || null;
  copia.indole = base.indole || "ostile";
  copia.unico = false;
  copia.note = "";
  copia.immagineId = base.immagineId || null;
  return copia;
}

// Creatura vuota per «+ Nuova creatura» (un PNG comune).
export function creaturaVuota() {
  return {
    nome: "Nuova creatura", taglia: "media", tipo: "umanoide", allineamento: "qualsiasi allineamento",
    ca: "10", caValore: 10, pf: 4, dadiPf: "1d8", velocita: "9 m", car: [10, 10, 10, 10, 10, 10],
    sensi: "Percezione passiva 10", lingue: "Comune", gs: "0", pe: 10,
    tratti: [], azioni: [], reazioni: [], leggendarie: [],
    base: null, indole: "neutrale", unico: false, note: "", immagineId: null,
  };
}

// "1d6+2 taglienti; 2d6 fuoco" ↔ [{ dadi: "1d6+2", tipo: "taglienti" }, { dadi: "2d6", tipo: "fuoco" }]
export const danniDaTesto = (testo) => String(testo || "").split(";").map((p) => p.trim()).filter(Boolean).map((p) => {
  const [dadi, ...tipo] = p.split(/\s+/);
  return leggiFormula(dadi) || /^\d+$/.test(dadi) ? { dadi: dadi.replace(/\s/g, ""), tipo: tipo.join(" ") || "danni" } : null;
}).filter(Boolean);
export const testoDaDanni = (danni = []) => danni.map(({ dadi, tipo }) => `${dadi} ${tipo}`).join("; ");

// Voce del diario: "Sessione 12" se ce n'è una in corso, altrimenti la data.
export function etichettaDiario(numeroSessione, data = new Date()) {
  if (numeroSessione) return `Sessione ${numeroSessione}`;
  return data.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

// Riposo lungo di un personaggio unico: PF pieni e risorse ripristinate.
export function riposoLungo(creatura, stato, etichetta) {
  return {
    ...stato,
    pfAttuali: creatura.pf,
    risorse: (stato.risorse || []).map((r) => ({ ...r, usati: 0 })),
    diario: [...(stato.diario || []), { sessione: etichetta, testo: "Riposo lungo: PF e risorse ripristinati." }].slice(-50),
  };
}

// Pallino di una risorsa: cliccare un pallino usato lo libera (con quelli
// dopo), cliccarne uno libero lo usa (con quelli prima).
export function cambiaUsi(risorsa, indice) {
  const usati = indice < risorsa.usati ? indice : indice + 1;
  return { ...risorsa, usati: Math.max(0, Math.min(risorsa.max, usati)) };
}
