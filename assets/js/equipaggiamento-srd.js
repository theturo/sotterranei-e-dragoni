// Catalogo di equipaggiamento D&D 5e (2014) tratto dal SRD 5.1: armi, armature,
// oggetti da avventura, strumenti, pacchi e cavalcature. Solo dati di
// regolamento (costi, statistiche, pesi), niente testo narrativo protetto.
// Costi: mr = monete di rame, ma = argento, me = elettro, mo = oro, mp = platino.
// Pesi in libbre (lb), come da SRD.

export const ARMI = {
  clava: { nome: "Clava", sottocategoria: "semplice", tipo: "mischia", danno: "1d4", tipoDanno: "contundente", proprieta: ["Leggera"], costo: "1 ma", peso: 2 },
  pugnale: { nome: "Pugnale", sottocategoria: "semplice", tipo: "mischia", danno: "1d4", tipoDanno: "perforante", proprieta: ["Leggera", "Finezza", "Da lancio (6/18 m)"], costo: "2 mo", peso: 1 },
  randello_grande: { nome: "Randello grande", sottocategoria: "semplice", tipo: "mischia", danno: "1d8", tipoDanno: "contundente", proprieta: ["A due mani"], costo: "2 ma", peso: 10 },
  ascia_da_lancio: { nome: "Ascia da lancio", sottocategoria: "semplice", tipo: "mischia", danno: "1d6", tipoDanno: "taglio", proprieta: ["Leggera", "Da lancio (6/18 m)"], costo: "5 mo", peso: 2 },
  giavellotto: { nome: "Giavellotto", sottocategoria: "semplice", tipo: "mischia", danno: "1d6", tipoDanno: "perforante", proprieta: ["Da lancio (9/36 m)"], costo: "5 ma", peso: 2 },
  martello_leggero: { nome: "Martello leggero", sottocategoria: "semplice", tipo: "mischia", danno: "1d4", tipoDanno: "contundente", proprieta: ["Leggera", "Da lancio (6/18 m)"], costo: "2 mo", peso: 2 },
  mazza: { nome: "Mazza", sottocategoria: "semplice", tipo: "mischia", danno: "1d6", tipoDanno: "contundente", proprieta: [], costo: "5 mo", peso: 4 },
  bastone_ferrato: { nome: "Bastone ferrato", sottocategoria: "semplice", tipo: "mischia", danno: "1d6", tipoDanno: "contundente", proprieta: ["Versatile (1d8)"], costo: "2 ma", peso: 4 },
  falcetto: { nome: "Falcetto", sottocategoria: "semplice", tipo: "mischia", danno: "1d4", tipoDanno: "taglio", proprieta: ["Leggera"], costo: "1 mo", peso: 2 },
  lancia: { nome: "Lancia", sottocategoria: "semplice", tipo: "mischia", danno: "1d6", tipoDanno: "perforante", proprieta: ["Da lancio (6/18 m)", "Versatile (1d8)"], costo: "1 mo", peso: 3 },
  balestra_leggera: { nome: "Balestra leggera", sottocategoria: "semplice", tipo: "a distanza", danno: "1d8", tipoDanno: "perforante", proprieta: ["Munizioni (24/96 m)", "Caricamento", "A due mani"], costo: "25 mo", peso: 5 },
  freccetta: { nome: "Freccetta", sottocategoria: "semplice", tipo: "a distanza", danno: "1d4", tipoDanno: "perforante", proprieta: ["Finezza", "Da lancio (6/18 m)"], costo: "5 mr", peso: 0.25 },
  arco_corto: { nome: "Arco corto", sottocategoria: "semplice", tipo: "a distanza", danno: "1d6", tipoDanno: "perforante", proprieta: ["Munizioni (24/96 m)", "A due mani"], costo: "25 mo", peso: 2 },
  fionda: { nome: "Fionda", sottocategoria: "semplice", tipo: "a distanza", danno: "1d4", tipoDanno: "contundente", proprieta: ["Munizioni (9/36 m)"], costo: "1 ma", peso: 0 },
  ascia_da_battaglia: { nome: "Ascia da battaglia", sottocategoria: "marziale", tipo: "mischia", danno: "1d8", tipoDanno: "taglio", proprieta: ["Versatile (1d10)"], costo: "10 mo", peso: 4 },
  flagello: { nome: "Flagello", sottocategoria: "marziale", tipo: "mischia", danno: "1d8", tipoDanno: "contundente", proprieta: [], costo: "10 mo", peso: 2 },
  glaive: { nome: "Glaive", sottocategoria: "marziale", tipo: "mischia", danno: "1d10", tipoDanno: "taglio", proprieta: ["Pesante", "Portata", "A due mani"], costo: "20 mo", peso: 6 },
  ascia_bipenne: { nome: "Ascia bipenne", sottocategoria: "marziale", tipo: "mischia", danno: "1d12", tipoDanno: "taglio", proprieta: ["Pesante", "A due mani"], costo: "30 mo", peso: 7 },
  spadone: { nome: "Spadone", sottocategoria: "marziale", tipo: "mischia", danno: "2d6", tipoDanno: "taglio", proprieta: ["Pesante", "A due mani"], costo: "50 mo", peso: 6 },
  alabarda: { nome: "Alabarda", sottocategoria: "marziale", tipo: "mischia", danno: "1d10", tipoDanno: "taglio", proprieta: ["Pesante", "Portata", "A due mani"], costo: "20 mo", peso: 6 },
  lancia_da_cavalleria: { nome: "Lancia da cavalleria", sottocategoria: "marziale", tipo: "mischia", danno: "1d12", tipoDanno: "perforante", proprieta: ["Portata", "Speciale"], costo: "10 mo", peso: 6 },
  spada_lunga: { nome: "Spada lunga", sottocategoria: "marziale", tipo: "mischia", danno: "1d8", tipoDanno: "taglio", proprieta: ["Versatile (1d10)"], costo: "15 mo", peso: 3 },
  martello_da_guerra_pesante: { nome: "Martello da guerra pesante", sottocategoria: "marziale", tipo: "mischia", danno: "2d6", tipoDanno: "contundente", proprieta: ["Pesante", "A due mani"], costo: "10 mo", peso: 10 },
  stella_del_mattino: { nome: "Stella del mattino", sottocategoria: "marziale", tipo: "mischia", danno: "1d8", tipoDanno: "perforante", proprieta: [], costo: "15 mo", peso: 4 },
  picca: { nome: "Picca", sottocategoria: "marziale", tipo: "mischia", danno: "1d10", tipoDanno: "perforante", proprieta: ["Pesante", "Portata", "A due mani"], costo: "5 mo", peso: 18 },
  rapier: { nome: "Rapier", sottocategoria: "marziale", tipo: "mischia", danno: "1d8", tipoDanno: "perforante", proprieta: ["Finezza"], costo: "25 mo", peso: 2 },
  scimitarra: { nome: "Scimitarra", sottocategoria: "marziale", tipo: "mischia", danno: "1d6", tipoDanno: "taglio", proprieta: ["Finezza", "Leggera"], costo: "25 mo", peso: 3 },
  spada_corta: { nome: "Spada corta", sottocategoria: "marziale", tipo: "mischia", danno: "1d6", tipoDanno: "perforante", proprieta: ["Finezza", "Leggera"], costo: "10 mo", peso: 2 },
  tridente: { nome: "Tridente", sottocategoria: "marziale", tipo: "mischia", danno: "1d6", tipoDanno: "perforante", proprieta: ["Da lancio (6/18 m)", "Versatile (1d8)"], costo: "5 mo", peso: 4 },
  piccone_da_guerra: { nome: "Piccone da guerra", sottocategoria: "marziale", tipo: "mischia", danno: "1d8", tipoDanno: "perforante", proprieta: [], costo: "5 mo", peso: 2 },
  martello_da_guerra: { nome: "Martello da guerra", sottocategoria: "marziale", tipo: "mischia", danno: "1d8", tipoDanno: "contundente", proprieta: ["Versatile (1d10)"], costo: "15 mo", peso: 2 },
  frusta: { nome: "Frusta", sottocategoria: "marziale", tipo: "mischia", danno: "1d4", tipoDanno: "taglio", proprieta: ["Finezza", "Portata"], costo: "2 mo", peso: 3 },
  cerbottana: { nome: "Cerbottana", sottocategoria: "marziale", tipo: "a distanza", danno: "1", tipoDanno: "perforante", proprieta: ["Munizioni (7,5/30 m)", "Caricamento"], costo: "10 mo", peso: 1 },
  balestra_a_mano: { nome: "Balestra a mano", sottocategoria: "marziale", tipo: "a distanza", danno: "1d6", tipoDanno: "perforante", proprieta: ["Munizioni (9/36 m)", "Leggera", "Caricamento"], costo: "75 mo", peso: 3 },
  balestra_pesante: { nome: "Balestra pesante", sottocategoria: "marziale", tipo: "a distanza", danno: "1d10", tipoDanno: "perforante", proprieta: ["Munizioni (30/120 m)", "Pesante", "Caricamento", "A due mani"], costo: "50 mo", peso: 18 },
  arco_lungo: { nome: "Arco lungo", sottocategoria: "marziale", tipo: "a distanza", danno: "1d8", tipoDanno: "perforante", proprieta: ["Munizioni (45/180 m)", "Pesante", "A due mani"], costo: "50 mo", peso: 2 },
  rete: { nome: "Rete", sottocategoria: "marziale", tipo: "a distanza", danno: "—", tipoDanno: "speciale", proprieta: ["Speciale", "Da lancio (1,5/4,5 m)"], costo: "1 mo", peso: 3 },
};

// caBase/usaDestrezza/desMax servono al calcolo automatico della CA sulla
// scheda personaggio; "ca" resta la stringa leggibile usata dal glossario.
export const ARMATURE = {
  imbottita: { nome: "Imbottita", sottocategoria: "leggera", ca: "11 + Des", caBase: 11, usaDestrezza: true, desMax: null, forzaRichiesta: null, svantaggioFurtivita: true, costo: "5 mo", peso: 8 },
  cuoio: { nome: "Cuoio", sottocategoria: "leggera", ca: "11 + Des", caBase: 11, usaDestrezza: true, desMax: null, forzaRichiesta: null, svantaggioFurtivita: false, costo: "10 mo", peso: 10 },
  cuoio_borchiato: { nome: "Cuoio borchiato", sottocategoria: "leggera", ca: "12 + Des", caBase: 12, usaDestrezza: true, desMax: null, forzaRichiesta: null, svantaggioFurtivita: false, costo: "45 mo", peso: 13 },
  pelle: { nome: "Pelle", sottocategoria: "media", ca: "12 + Des (max 2)", caBase: 12, usaDestrezza: true, desMax: 2, forzaRichiesta: null, svantaggioFurtivita: false, costo: "10 mo", peso: 12 },
  usbergo_maglia: { nome: "Usbergo di maglia", sottocategoria: "media", ca: "13 + Des (max 2)", caBase: 13, usaDestrezza: true, desMax: 2, forzaRichiesta: null, svantaggioFurtivita: false, costo: "50 mo", peso: 20 },
  corazza_a_scaglie: { nome: "Corazza a scaglie", sottocategoria: "media", ca: "14 + Des (max 2)", caBase: 14, usaDestrezza: true, desMax: 2, forzaRichiesta: null, svantaggioFurtivita: true, costo: "50 mo", peso: 45 },
  corazza: { nome: "Corazza", sottocategoria: "media", ca: "14 + Des (max 2)", caBase: 14, usaDestrezza: true, desMax: 2, forzaRichiesta: null, svantaggioFurtivita: false, costo: "400 mo", peso: 20 },
  mezza_piastra: { nome: "Mezza piastra", sottocategoria: "media", ca: "15 + Des (max 2)", caBase: 15, usaDestrezza: true, desMax: 2, forzaRichiesta: null, svantaggioFurtivita: true, costo: "750 mo", peso: 40 },
  usbergo_anelli: { nome: "Usbergo ad anelli", sottocategoria: "pesante", ca: "14", caBase: 14, usaDestrezza: false, desMax: 0, forzaRichiesta: null, svantaggioFurtivita: true, costo: "30 mo", peso: 40 },
  cotta_di_maglia: { nome: "Cotta di maglia", sottocategoria: "pesante", ca: "16", caBase: 16, usaDestrezza: false, desMax: 0, forzaRichiesta: 13, svantaggioFurtivita: true, costo: "75 mo", peso: 55 },
  armatura_lamellare: { nome: "Armatura lamellare", sottocategoria: "pesante", ca: "17", caBase: 17, usaDestrezza: false, desMax: 0, forzaRichiesta: 15, svantaggioFurtivita: true, costo: "200 mo", peso: 60 },
  armatura_a_piastre: { nome: "Armatura a piastre", sottocategoria: "pesante", ca: "18", caBase: 18, usaDestrezza: false, desMax: 0, forzaRichiesta: 15, svantaggioFurtivita: true, costo: "1500 mo", peso: 65 },
  scudo: { nome: "Scudo", sottocategoria: "scudo", ca: "+2", bonusScudo: 2, forzaRichiesta: null, svantaggioFurtivita: false, costo: "10 mo", peso: 6 },
};

export const OGGETTI = {
  abaco: { nome: "Abaco", costo: "2 mo", peso: 2 },
  acido_fiala: { nome: "Acido (fiala)", costo: "25 mo", peso: 1 },
  fuoco_alchemico_fiasca: { nome: "Fuoco alchemico (fiasca)", costo: "50 mo", peso: 1 },
  frecce_20: { nome: "Frecce (20)", costo: "1 mo", peso: 1 },
  dardi_balestra_20: { nome: "Dardi da balestra (20)", costo: "1 mo", peso: 1.5 },
  proiettili_fionda_20: { nome: "Proiettili da fionda (20)", costo: "4 mr", peso: 1.5 },
  aghi_cerbottana_50: { nome: "Aghi da cerbottana (50)", costo: "1 mo", peso: 1 },
  antitossina_fiala: { nome: "Antitossina (fiala)", costo: "50 mo", peso: null },
  zaino: { nome: "Zaino", costo: "2 mo", peso: 5 },
  cuscinetti_sfera_1000: { nome: "Cuscinetti a sfera (sacco da 1000)", costo: "1 mo", peso: 2 },
  barile: { nome: "Barile", costo: "2 mo", peso: 70 },
  cesta: { nome: "Cesta", costo: "4 ma", peso: 2 },
  sacco_a_pelo: { nome: "Sacco a pelo", costo: "1 mo", peso: 7 },
  campanella: { nome: "Campanella", costo: "1 mo", peso: null },
  coperta: { nome: "Coperta", costo: "5 ma", peso: 3 },
  paranco: { nome: "Paranco", costo: "1 mo", peso: 5 },
  libro: { nome: "Libro", costo: "25 mo", peso: 5 },
  bottiglia_vetro: { nome: "Bottiglia di vetro", costo: "2 mo", peso: 2 },
  secchio: { nome: "Secchio", costo: "5 mr", peso: 2 },
  borseggiatore_kit: { nome: "Attrezzi da scasso (kit)", costo: "25 mo", peso: 1 },
  tribolo_sacco_20: { nome: "Tribolo (sacco da 20)", costo: "1 mo", peso: 2 },
  candela: { nome: "Candela", costo: "1 mr", peso: null },
  faretra: { nome: "Faretra", costo: "1 mo", peso: 1 },
  custodia_mappe_pergamene: { nome: "Custodia per mappe o pergamene", costo: "1 mo", peso: 1 },
  catena_3m: { nome: "Catena (3 metri)", costo: "5 mo", peso: 10 },
  gesso: { nome: "Gesso (1 pezzo)", costo: "1 mr", peso: null },
  baule: { nome: "Baule", costo: "5 mo", peso: 25 },
  kit_scalatore: { nome: "Kit da scalatore", costo: "25 mo", peso: 12 },
  abiti_comuni: { nome: "Abiti comuni", costo: "5 ma", peso: 3 },
  abiti_costume: { nome: "Abiti da scena", costo: "5 mo", peso: 4 },
  abiti_eleganti: { nome: "Abiti eleganti", costo: "15 mo", peso: 6 },
  abiti_viaggio: { nome: "Abiti da viaggio", costo: "2 mo", peso: 4 },
  sacchetto_componenti: { nome: "Sacchetto per componenti", costo: "25 mo", peso: 2 },
  piede_di_porco: { nome: "Piede di porco", costo: "2 mo", peso: 5 },
  kit_travestimento: { nome: "Kit da travestimento", costo: "25 mo", peso: 3 },
  attrezzi_da_pesca: { nome: "Attrezzi da pesca", costo: "1 mo", peso: 4 },
  fiasco_boccale: { nome: "Fiasco o boccale", costo: "2 mr", peso: 1 },
  rampino: { nome: "Rampino", costo: "2 mo", peso: 4 },
  martello: { nome: "Martello", costo: "1 mo", peso: 3 },
  martello_da_fabbro: { nome: "Martello da fabbro (mazzuolo)", costo: "2 mo", peso: 10 },
  kit_guaritore: { nome: "Kit da guaritore", costo: "5 mo", peso: 3 },
  kit_erborista: { nome: "Kit da erborista", costo: "5 mo", peso: 3 },
  acqua_santa_fiasco: { nome: "Acqua santa (fiasco)", costo: "25 mo", peso: 1 },
  clessidra: { nome: "Clessidra", costo: "25 mo", peso: 1 },
  tagliola: { nome: "Tagliola da caccia", costo: "5 mo", peso: 25 },
  inchiostro_boccetta: { nome: "Inchiostro (boccetta da 30 ml)", costo: "10 mo", peso: null },
  penna_inchiostro: { nome: "Penna a inchiostro", costo: "2 mr", peso: null },
  brocca: { nome: "Brocca", costo: "2 mr", peso: 4 },
  scala_3m: { nome: "Scala (3 metri)", costo: "1 ma", peso: 25 },
  lampada: { nome: "Lampada", costo: "5 ma", peso: 1 },
  lanterna_a_fascio: { nome: "Lanterna a fascio", costo: "10 mo", peso: 2 },
  lanterna_cieca: { nome: "Lanterna cieca", costo: "5 mo", peso: 2 },
  lucchetto: { nome: "Lucchetto", costo: "10 mo", peso: 1 },
  lente_ingrandimento: { nome: "Lente d'ingrandimento", costo: "100 mo", peso: null },
  manette: { nome: "Manette", costo: "2 mo", peso: 6 },
  kit_da_pasto: { nome: "Kit da pasto", costo: "2 ma", peso: 1 },
  specchio_acciaio: { nome: "Specchio d'acciaio", costo: "5 mo", peso: 0.5 },
  olio_fiasca: { nome: "Olio (fiasca)", costo: "1 ma", peso: 1 },
  carta_foglio: { nome: "Carta (1 foglio)", costo: "2 ma", peso: null },
  pergamena_foglio: { nome: "Pergamena (1 foglio)", costo: "1 ma", peso: null },
  profumo_fiala: { nome: "Profumo (fiala)", costo: "5 mo", peso: null },
  piccone_da_minatore: { nome: "Piccone da minatore", costo: "2 mo", peso: 10 },
  piolo: { nome: "Piolo di ferro", costo: "5 mr", peso: 0.25 },
  veleno_base_fiala: { nome: "Veleno di base (fiala)", costo: "100 mo", peso: null },
  palo_3m: { nome: "Palo (3 metri)", costo: "5 mr", peso: 7 },
  pentola_ferro: { nome: "Pentola di ferro", costo: "2 mo", peso: 10 },
  pozione_di_cura: { nome: "Pozione di cura", costo: "50 mo", peso: 0.5 },
  borsa: { nome: "Borsa", costo: "5 ma", peso: 1 },
  ariete_portatile: { nome: "Ariete portatile", costo: "4 mo", peso: 35 },
  razioni_da_viaggio_1g: { nome: "Razioni da viaggio (1 giorno)", costo: "5 ma", peso: 2 },
  tuniche: { nome: "Tuniche", costo: "1 mo", peso: 4 },
  corda_canapa_15m: { nome: "Corda di canapa (15 metri)", costo: "1 mo", peso: 10 },
  corda_seta_15m: { nome: "Corda di seta (15 metri)", costo: "10 mo", peso: 5 },
  sacco: { nome: "Sacco", costo: "1 mr", peso: 0.5 },
  bilancia_mercante: { nome: "Bilancia da mercante", costo: "5 mo", peso: 3 },
  ceralacca: { nome: "Ceralacca", costo: "5 ma", peso: null },
  vanga: { nome: "Vanga", costo: "2 mo", peso: 5 },
  fischietto_segnale: { nome: "Fischietto da segnalazione", costo: "5 mr", peso: null },
  anello_con_sigillo: { nome: "Anello con sigillo", costo: "5 mo", peso: null },
  sapone: { nome: "Sapone", costo: "2 mr", peso: null },
  libro_degli_incantesimi: { nome: "Libro degli incantesimi", costo: "50 mo", peso: 3 },
  cannocchiale: { nome: "Cannocchiale", costo: "1000 mo", peso: 1 },
  tenda_2_persone: { nome: "Tenda (2 persone)", costo: "2 mo", peso: 20 },
  acciarino: { nome: "Acciarino", costo: "5 ma", peso: 1 },
  torcia: { nome: "Torcia", costo: "1 mr", peso: 1 },
  fiala_vuota: { nome: "Fiala (vuota)", costo: "1 mo", peso: null },
  otre: { nome: "Otre", costo: "2 ma", peso: 5 },
  pietra_per_affilare: { nome: "Pietra per affilare", costo: "1 mr", peso: 1 },
};

export const PACCHI = {
  pacco_scassinatore: {
    nome: "Pacco da scassinatore",
    costo: "16 mo",
    contenuto: [
      "Un sacco grande", "1000 monete di rame", "2 kg di ferro incrociate a mo' di rampino", "10 candele",
      "1 acciarino", "1 lanterna cieca con 2 fiaschi d'olio", "5 pietre da fuoco (danno 1d4 fuoco)",
      "Corda di seta (15 metri)", "1 martello", "12 pioli di ferro",
    ],
  },
  pacco_diplomatico: {
    nome: "Pacco da diplomatico",
    costo: "39 mo",
    contenuto: [
      "1 custodia per mappe e pergamene", "2 casse per documenti", "Set da scrittura fine",
      "1 lampada", "2 fiaschi d'olio", "5 fogli di pergamena", "1 profumo",
      "Ceralacca", "1 completo di abiti eleganti",
    ],
  },
  pacco_dungeon: {
    nome: "Pacco da sotterranei (dungeon)",
    costo: "12 mo",
    contenuto: [
      "1 zaino", "1 piede di porco", "1 martello", "10 pioli di ferro", "10 torce",
      "1 acciarino", "10 razioni da viaggio", "Otre", "Corda di canapa (15 metri)",
    ],
  },
  pacco_intrattenitore: {
    nome: "Pacco da intrattenitore",
    costo: "40 mo",
    contenuto: [
      "1 zaino", "1 sacco a pelo", "2 costumi", "5 candele", "5 razioni da viaggio",
      "1 otre", "Kit da travestimento",
    ],
  },
  pacco_esploratore: {
    nome: "Pacco da esploratore",
    costo: "10 mo",
    contenuto: [
      "1 zaino", "1 sacco a pelo", "1 kit da pasto", "1 acciarino",
      "10 torce", "10 razioni da viaggio", "1 otre", "Corda di canapa (15 metri)",
    ],
  },
  pacco_sacerdote: {
    nome: "Pacco da sacerdote",
    costo: "19 mo",
    contenuto: [
      "1 zaino", "1 coperta", "10 candele", "1 acciarino", "1 turibolo",
      "Incenso", "1 veste", "10 razioni da viaggio", "Otre", "2 fiale di acqua santa",
    ],
  },
  pacco_studioso: {
    nome: "Pacco da studioso",
    costo: "40 mo",
    contenuto: [
      "1 zaino", "1 libro (di storia)", "1 boccetta di inchiostro", "1 penna a inchiostro",
      "10 fogli di pergamena", "1 piccola sacca di sabbia", "1 coltellino",
    ],
  },
};

export const STRUMENTI = {
  attrezzi_alchimista: { nome: "Attrezzi da alchimista", sottocategoria: "artigiano", costo: "50 mo", peso: 8 },
  attrezzi_birraio: { nome: "Attrezzi da birraio", sottocategoria: "artigiano", costo: "20 mo", peso: 9 },
  attrezzi_calligrafo: { nome: "Attrezzi da calligrafo", sottocategoria: "artigiano", costo: "10 mo", peso: 5 },
  attrezzi_falegname: { nome: "Attrezzi da falegname", sottocategoria: "artigiano", costo: "8 mo", peso: 6 },
  attrezzi_cartografo: { nome: "Attrezzi da cartografo", sottocategoria: "artigiano", costo: "15 mo", peso: 6 },
  attrezzi_calzolaio: { nome: "Attrezzi da calzolaio", sottocategoria: "artigiano", costo: "5 mo", peso: 5 },
  utensili_cuoco: { nome: "Utensili da cuoco", sottocategoria: "artigiano", costo: "1 mo", peso: 8 },
  attrezzi_vetraio: { nome: "Attrezzi da vetraio", sottocategoria: "artigiano", costo: "30 mo", peso: 5 },
  attrezzi_gioielliere: { nome: "Attrezzi da gioielliere", sottocategoria: "artigiano", costo: "25 mo", peso: 2 },
  attrezzi_conciatore: { nome: "Attrezzi da conciatore", sottocategoria: "artigiano", costo: "5 mo", peso: 5 },
  attrezzi_muratore: { nome: "Attrezzi da muratore", sottocategoria: "artigiano", costo: "10 mo", peso: 8 },
  forniture_pittore: { nome: "Forniture da pittore", sottocategoria: "artigiano", costo: "10 mo", peso: 5 },
  attrezzi_vasaio: { nome: "Attrezzi da vasaio", sottocategoria: "artigiano", costo: "10 mo", peso: 3 },
  attrezzi_fabbro: { nome: "Attrezzi da fabbro", sottocategoria: "artigiano", costo: "20 mo", peso: 8 },
  attrezzi_tessitore: { nome: "Attrezzi da tessitore", sottocategoria: "artigiano", costo: "1 mo", peso: 5 },
  attrezzi_intagliatore: { nome: "Attrezzi da intagliatore", sottocategoria: "artigiano", costo: "1 mo", peso: 5 },
  attrezzi_meccanico: { nome: "Attrezzi da meccanico (tinker's tools)", sottocategoria: "artigiano", costo: "50 mo", peso: 10 },
  set_di_dadi: { nome: "Set di dadi", sottocategoria: "gioco", costo: "1 ma", peso: null },
  mazzo_di_carte: { nome: "Mazzo di carte da gioco", sottocategoria: "gioco", costo: "5 ma", peso: null },
  cornamusa: { nome: "Cornamusa", sottocategoria: "musica", costo: "30 mo", peso: 6 },
  tamburo: { nome: "Tamburo", sottocategoria: "musica", costo: "6 mo", peso: 3 },
  dulcimer: { nome: "Dulcimer", sottocategoria: "musica", costo: "25 mo", peso: 10 },
  flauto_traverso: { nome: "Flauto", sottocategoria: "musica", costo: "2 mo", peso: 1 },
  liuto: { nome: "Liuto", sottocategoria: "musica", costo: "35 mo", peso: 2 },
  lira: { nome: "Lira", sottocategoria: "musica", costo: "30 mo", peso: 2 },
  corno: { nome: "Corno", sottocategoria: "musica", costo: "3 mo", peso: 2 },
  flauto_di_pan: { nome: "Flauto di Pan", sottocategoria: "musica", costo: "12 mo", peso: 2 },
  piffero: { nome: "Piffero", sottocategoria: "musica", costo: "2 mo", peso: 1 },
  viola: { nome: "Viola", sottocategoria: "musica", costo: "30 mo", peso: 1 },
  kit_falsario: { nome: "Kit da falsario", sottocategoria: "altro", costo: "15 mo", peso: 5 },
  attrezzi_da_navigatore: { nome: "Attrezzi da navigatore", sottocategoria: "altro", costo: "25 mo", peso: 2 },
  kit_avvelenatore: { nome: "Kit da avvelenatore", sottocategoria: "altro", costo: "50 mo", peso: 2 },
  attrezzi_da_scasso: { nome: "Arnesi da scasso (thieves' tools)", sottocategoria: "altro", costo: "25 mo", peso: 1 },
};

export const MONTATURE = {
  cammello: { nome: "Cammello", costo: "50 mo", note: "Velocità 15 m" },
  asino_mulo: { nome: "Asino o mulo", costo: "8 mo", note: "Velocità 12 m" },
  elefante: { nome: "Elefante", costo: "200 mo", note: "Velocità 12 m" },
  cavallo_da_tiro: { nome: "Cavallo da tiro", costo: "50 mo", note: "Velocità 18 m" },
  cavallo_da_sella: { nome: "Cavallo da sella", costo: "75 mo", note: "Velocità 18 m" },
  mastino: { nome: "Mastino", costo: "25 mo", note: "Velocità 12 m" },
  pony: { nome: "Pony", costo: "30 mo", note: "Velocità 12 m" },
  cavallo_da_guerra: { nome: "Cavallo da guerra pesante", costo: "400 mo", note: "Velocità 18 m" },
  sella: { nome: "Sella (da cavalcatura)", costo: "10 mo", note: "Necessaria per cavalcare in combattimento" },
  bardatura: { nome: "Morso e briglie", costo: "2 mo", note: "" },
};

// Indice unico e ricercabile su tutte le categorie del catalogo.
export function tuttiGliOggetti() {
  const risultato = [];
  Object.entries(ARMI).forEach(([chiave, dati]) => risultato.push({ chiave, categoria: "arma", ...dati }));
  Object.entries(ARMATURE).forEach(([chiave, dati]) => risultato.push({ chiave, categoria: "armatura", ...dati }));
  Object.entries(OGGETTI).forEach(([chiave, dati]) => risultato.push({ chiave, categoria: "oggetto", ...dati }));
  Object.entries(STRUMENTI).forEach(([chiave, dati]) => risultato.push({ chiave, categoria: "strumento", ...dati }));
  Object.entries(PACCHI).forEach(([chiave, dati]) => risultato.push({ chiave, categoria: "pacco", ...dati }));
  Object.entries(MONTATURE).forEach(([chiave, dati]) => risultato.push({ chiave, categoria: "montatura", ...dati }));
  return risultato;
}

export const ETICHETTE_CATEGORIA = {
  arma: "Arma",
  armatura: "Armatura",
  oggetto: "Oggetto",
  strumento: "Strumento",
  pacco: "Pacco equipaggiamento",
  montatura: "Cavalcatura",
};

// Ricerca per nome (case-insensitive, ignora gli accenti) su tutto il catalogo.
export function cercaEquipaggiamento(testo, { categoria } = {}) {
  const normalizza = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const query = normalizza((testo || "").trim());
  if (!query) return [];
  return tuttiGliOggetti()
    .filter((voce) => !categoria || voce.categoria === categoria)
    .filter((voce) => normalizza(voce.nome).includes(query))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}
