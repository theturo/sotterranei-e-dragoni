// Dati meccanici D&D 5e (2014) tratti dal SRD 5.1: razze, classi e caratteristiche.
// Solo dati di regolamento (numeri, tratti meccanici), niente testo narrativo protetto.

export const CARATTERISTICHE = [
  { chiave: "forza", nome: "Forza" },
  { chiave: "destrezza", nome: "Destrezza" },
  { chiave: "costituzione", nome: "Costituzione" },
  { chiave: "intelligenza", nome: "Intelligenza" },
  { chiave: "saggezza", nome: "Saggezza" },
  { chiave: "carisma", nome: "Carisma" },
];

// Array standard 5e: da assegnare liberamente, un valore per caratteristica.
export const ARRAY_STANDARD = [15, 14, 13, 12, 10, 8];

export const ABBREVIAZIONI_CARATTERISTICHE = {
  forza: "For",
  destrezza: "Des",
  costituzione: "Cos",
  intelligenza: "Int",
  saggezza: "Sag",
  carisma: "Car",
};

// Le 18 abilità del SRD 5.1, con la caratteristica di riferimento.
export const ABILITA = [
  { chiave: "acrobazia", nome: "Acrobazia", caratteristica: "destrezza" },
  { chiave: "addestrare_animali", nome: "Addestrare Animali", caratteristica: "saggezza" },
  { chiave: "arcano", nome: "Arcano", caratteristica: "intelligenza" },
  { chiave: "atletica", nome: "Atletica", caratteristica: "forza" },
  { chiave: "furtivita", nome: "Furtività", caratteristica: "destrezza" },
  { chiave: "indagare", nome: "Indagare", caratteristica: "intelligenza" },
  { chiave: "inganno", nome: "Inganno", caratteristica: "carisma" },
  { chiave: "intimidire", nome: "Intimidire", caratteristica: "carisma" },
  { chiave: "intrattenere", nome: "Intrattenere", caratteristica: "carisma" },
  { chiave: "intuizione", nome: "Intuizione", caratteristica: "saggezza" },
  { chiave: "medicina", nome: "Medicina", caratteristica: "saggezza" },
  { chiave: "natura", nome: "Natura", caratteristica: "intelligenza" },
  { chiave: "percezione", nome: "Percezione", caratteristica: "saggezza" },
  { chiave: "persuasione", nome: "Persuasione", caratteristica: "carisma" },
  { chiave: "religione", nome: "Religione", caratteristica: "intelligenza" },
  { chiave: "rapidita_di_mano", nome: "Rapidità di Mano", caratteristica: "destrezza" },
  { chiave: "sopravvivenza", nome: "Sopravvivenza", caratteristica: "saggezza" },
  { chiave: "storia", nome: "Storia", caratteristica: "intelligenza" },
];

export const RAZZE = {
  umano: {
    nome: "Umano",
    velocita: 9,
    taglia: "Media",
    bonusFissi: { forza: 1, destrezza: 1, costituzione: 1, intelligenza: 1, saggezza: 1, carisma: 1 },
    sottorazze: null,
  },
  elfo: {
    nome: "Elfo",
    velocita: 9,
    taglia: "Media",
    bonusFissi: { destrezza: 2 },
    sottorazze: {
      alto: { nome: "Alto Elfo", bonusFissi: { intelligenza: 1 } },
      boschi: { nome: "Elfo dei Boschi", bonusFissi: { saggezza: 1 }, velocita: 10.5 },
      drow: { nome: "Elfo Nero (Drow)", bonusFissi: { carisma: 1 } },
    },
  },
  nano: {
    nome: "Nano",
    velocita: 7.5,
    taglia: "Media",
    bonusFissi: { costituzione: 2 },
    sottorazze: {
      colline: { nome: "Nano delle Colline", bonusFissi: { saggezza: 1 } },
      montagne: { nome: "Nano delle Montagne", bonusFissi: { forza: 2 } },
    },
  },
  halfling: {
    nome: "Halfling",
    velocita: 7.5,
    taglia: "Piccola",
    bonusFissi: { destrezza: 2 },
    sottorazze: {
      piedeleggero: { nome: "Halfling Piè Leggero", bonusFissi: { carisma: 1 } },
      tarchiato: { nome: "Halfling Tarchiato", bonusFissi: { costituzione: 1 } },
    },
  },
  gnomo: {
    nome: "Gnomo",
    velocita: 7.5,
    taglia: "Piccola",
    bonusFissi: { intelligenza: 2 },
    sottorazze: {
      roccia: { nome: "Gnomo delle Rocce", bonusFissi: { costituzione: 1 } },
      boschi: { nome: "Gnomo dei Boschi", bonusFissi: { destrezza: 1 } },
    },
  },
  mezzelfo: {
    nome: "Mezzelfo",
    velocita: 9,
    taglia: "Media",
    bonusFissi: { carisma: 2 },
    // Due caratteristiche a scelta (non Carisma) ricevono +1: gestito dal wizard.
    bonusScelta: { quantita: 2, valore: 1, esclusa: "carisma" },
    sottorazze: null,
  },
  mezzorco: {
    nome: "Mezzorco",
    velocita: 9,
    taglia: "Media",
    bonusFissi: { forza: 2, costituzione: 1 },
    sottorazze: null,
  },
  dragonide: {
    nome: "Dragonide",
    velocita: 9,
    taglia: "Media",
    bonusFissi: { forza: 2, carisma: 1 },
    sottorazze: null,
  },
  tiefling: {
    nome: "Tiefling",
    velocita: 9,
    taglia: "Media",
    bonusFissi: { intelligenza: 1, carisma: 2 },
    sottorazze: null,
  },
};

export const CLASSI = {
  barbaro: { nome: "Barbaro", dadoVita: 12, salvezze: ["forza", "costituzione"], icona: "🪓" },
  bardo: { nome: "Bardo", dadoVita: 8, salvezze: ["destrezza", "carisma"], icona: "🎵" },
  chierico: { nome: "Chierico", dadoVita: 8, salvezze: ["saggezza", "carisma"], icona: "✨" },
  druido: { nome: "Druido", dadoVita: 8, salvezze: ["intelligenza", "saggezza"], icona: "🌿" },
  guerriero: { nome: "Guerriero", dadoVita: 10, salvezze: ["forza", "costituzione"], icona: "⚔️" },
  ladro: { nome: "Ladro", dadoVita: 8, salvezze: ["destrezza", "intelligenza"], icona: "🗡️" },
  mago: { nome: "Mago", dadoVita: 6, salvezze: ["intelligenza", "saggezza"], icona: "📖" },
  monaco: { nome: "Monaco", dadoVita: 8, salvezze: ["forza", "destrezza"], icona: "🥋" },
  paladino: { nome: "Paladino", dadoVita: 10, salvezze: ["saggezza", "carisma"], icona: "🛡️" },
  ranger: { nome: "Ranger", dadoVita: 10, salvezze: ["forza", "destrezza"], icona: "🏹" },
  stregone: { nome: "Stregone", dadoVita: 6, salvezze: ["costituzione", "carisma"], icona: "🔥" },
  warlock: { nome: "Warlock", dadoVita: 8, salvezze: ["saggezza", "carisma"], icona: "👁️" },
};

// Nome completo di una razza, comprensivo di sottorazza se presente.
export function nomeRazzaCompleto(razzaChiave, sottorazzaChiave) {
  const razza = RAZZE[razzaChiave];
  if (!razza) return "—";
  const sottorazza = razza.sottorazze?.[sottorazzaChiave];
  return sottorazza ? sottorazza.nome : razza.nome;
}

// Velocità di movimento (in metri) di una razza, comprensiva di eventuale
// variazione data dalla sottorazza.
export function velocitaRazza(razzaChiave, sottorazzaChiave) {
  const razza = RAZZE[razzaChiave];
  if (!razza) return 9;
  const sottorazza = razza.sottorazze?.[sottorazzaChiave];
  return sottorazza?.velocita ?? razza.velocita;
}

// I 9 allineamenti del SRD 5.1. "angolo" posiziona la voce sulla ruota a
// spicchi (0°=in alto, in senso orario); la voce senza angolo (Neutrale
// Puro) occupa il fulcro centrale della ruota.
export const ALLINEAMENTI = [
  { chiave: "NB", nome: "Neutrale Buono", angolo: 0, blurb: "Fa il possibile per aiutare gli altri, senza legarsi rigidamente a ordine o libertà." },
  { chiave: "CB", nome: "Caotico Buono", angolo: 45, blurb: "Segue la coscienza più delle regole, ribellandosi quando le leggi opprimono il bene." },
  { chiave: "CN", nome: "Caotico Neutrale", angolo: 90, blurb: "Segue il proprio istinto e la libertà individuale: imprevedibile più che crudele." },
  { chiave: "CM", nome: "Caotico Malvagio", angolo: 135, blurb: "Agisce per capriccio e violenza, mosso da avidità, odio o sete di distruzione." },
  { chiave: "NM", nome: "Neutrale Malvagio", angolo: 180, blurb: "Persegue i propri interessi senza scrupoli, pronto a tradire se conviene." },
  { chiave: "LM", nome: "Legale Malvagio", angolo: 225, blurb: "Sfrutta regole e gerarchie con metodo spietato per ottenere potere e controllo." },
  { chiave: "LN", nome: "Legale Neutrale", angolo: 270, blurb: "Crede nell'ordine, nella tradizione o in un codice personale, senza schierarsi tra bene e male." },
  { chiave: "LB", nome: "Legale Buono", angolo: 315, blurb: "Agisce secondo un codice d'onore, cercando il bene in modo affidabile e organizzato." },
  { chiave: "N", nome: "Neutrale Puro", angolo: null, blurb: "Agisce secondo le circostanze, senza forti convinzioni su moralità o ordine costituito." },
];

export function nomeAllineamento(chiave) {
  return ALLINEAMENTI.find((a) => a.chiave === chiave)?.nome || "—";
}

export function modificatore(punteggio) {
  return Math.floor((punteggio - 10) / 2);
}

export function formattaModificatore(mod) {
  return mod >= 0 ? `+${mod}` : `−${Math.abs(mod)}`;
}

// PF massimi al 1° livello: dado vita al massimo + modificatore di Costituzione.
export function puntiVitaIniziali(classeChiave, modCostituzione) {
  const classe = CLASSI[classeChiave];
  return classe.dadoVita + modCostituzione;
}

// Livelli in cui si guadagna un Aumento del Punteggio di Caratteristica.
// Semplificazione: usiamo la progressione standard per tutte le classi (alcune,
// come Guerriero e Ladro, ne hanno in SRD di aggiuntivi a livelli specifici).
export const LIVELLI_ASI = [4, 8, 12, 16, 19];

// PF guadagnati salendo di livello, per il metodo "valore medio" (arrotondato
// per eccesso, come da regola SRD) o "tiro" (un valore casuale 1..dadoVita).
// In entrambi i casi il minimo è 1 PF, anche con Costituzione molto bassa.
export function puntiVitaMedi(classeChiave, modCostituzione) {
  const classe = CLASSI[classeChiave];
  return Math.max(1, Math.floor(classe.dadoVita / 2) + 1 + modCostituzione);
}

export function tiraPuntiVitaLivello(classeChiave, modCostituzione) {
  const classe = CLASSI[classeChiave];
  const tiro = 1 + Math.floor(Math.random() * classe.dadoVita);
  return { tiro, totale: Math.max(1, tiro + modCostituzione) };
}

// ---------- Progressione di classe (Fase 2 del passaggio di livello) ----------

// Tipo di lanciatore per classe: "pieno" (Bardo/Chierico/Druido/Mago/Stregone),
// "mezzo" (Paladino/Ranger, incantesimi da 2° livello, max 5° cerchio) o
// "patto" (Warlock, slot Patto Magico). Le classi assenti non lanciano incantesimi.
export const TIPO_LANCIATORE = {
  bardo: "pieno", chierico: "pieno", druido: "pieno", mago: "pieno", stregone: "pieno",
  paladino: "mezzo", ranger: "mezzo",
  warlock: "patto",
};

const SLOT_LANCIATORE_PIENO = [
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

const SLOT_LANCIATORE_MEZZO = [
  [0, 0, 0, 0, 0],
  [2, 0, 0, 0, 0],
  [3, 0, 0, 0, 0],
  [3, 0, 0, 0, 0],
  [4, 2, 0, 0, 0],
  [4, 2, 0, 0, 0],
  [4, 3, 0, 0, 0],
  [4, 3, 0, 0, 0],
  [4, 3, 2, 0, 0],
  [4, 3, 2, 0, 0],
  [4, 3, 3, 0, 0],
  [4, 3, 3, 0, 0],
  [4, 3, 3, 1, 0],
  [4, 3, 3, 1, 0],
  [4, 3, 3, 2, 0],
  [4, 3, 3, 2, 0],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2],
];

// Patto Magico del Warlock: numero di slot e loro livello (sempre uguale tra loro).
const SLOT_PATTO_WARLOCK = [
  { slot: 1, livelloSlot: 1 }, { slot: 2, livelloSlot: 1 }, { slot: 2, livelloSlot: 2 }, { slot: 2, livelloSlot: 2 },
  { slot: 2, livelloSlot: 3 }, { slot: 2, livelloSlot: 3 }, { slot: 2, livelloSlot: 4 }, { slot: 2, livelloSlot: 4 },
  { slot: 2, livelloSlot: 5 }, { slot: 2, livelloSlot: 5 }, { slot: 3, livelloSlot: 5 }, { slot: 3, livelloSlot: 5 },
  { slot: 3, livelloSlot: 5 }, { slot: 3, livelloSlot: 5 }, { slot: 3, livelloSlot: 5 }, { slot: 3, livelloSlot: 5 },
  { slot: 4, livelloSlot: 5 }, { slot: 4, livelloSlot: 5 }, { slot: 4, livelloSlot: 5 }, { slot: 4, livelloSlot: 5 },
];

// Restituisce gli slot incantesimo disponibili al dato livello: un array
// [slotLiv1, slotLiv2, ...] per lanciatori pieno/mezzo, o { slot, livelloSlot }
// per il Warlock (Patto Magico), oppure null se la classe non lancia incantesimi.
export function slotIncantesimoAlLivello(classeChiave, livello) {
  const tipo = TIPO_LANCIATORE[classeChiave];
  if (!tipo) return null;
  const indice = Math.max(0, Math.min(19, livello - 1));
  if (tipo === "pieno") return SLOT_LANCIATORE_PIENO[indice];
  if (tipo === "mezzo") return SLOT_LANCIATORE_MEZZO[indice];
  if (tipo === "patto") return SLOT_PATTO_WARLOCK[indice];
  return null;
}

// Tratti guadagnati a un livello, per classe — solo nomi brevi (non il testo
// regolistico completo): al passaggio di livello vengono aggiunti in automatico
// a "Caratteristiche e talenti". Quando è coinvolta una sottoclasse non ancora
// scelta dal giocatore, compare come voce generica da specificare a mano.
// ---------- Incantesimi conosciuti / preparati (limiti per classe) ----------

// Caratteristica da incantatore per classe (usata per calcolare i preparati).
export const CARATTERISTICA_INCANTESIMI = {
  bardo: "carisma", chierico: "saggezza", druido: "saggezza", mago: "intelligenza",
  paladino: "carisma", ranger: "saggezza", stregone: "carisma", warlock: "carisma",
};

// Classi "a conoscenza fissa": ciò che sanno è sempre utilizzabile, senza preparazione.
export const CLASSI_CONOSCENZA_FISSA = ["bardo", "ranger", "stregone", "warlock"];
// Classi "a preparazione": conoscono l'intera lista della classe, ma ne preparano
// solo un sottoinsieme ogni giorno secondo una formula.
export const CLASSI_PREPARAZIONE = ["chierico", "druido", "paladino"];
// Il Mago è un caso ibrido: il libro degli incantesimi è il pool di "conosciuti"
// (qui senza limite, per semplicità), da cui ogni giorno prepara un sottoinsieme.

// Trucchetti conosciuti per livello (soglie 1/4/10, valide per tutte le classi
// incantatrici con trucchetti; Paladino e Ranger nel SRD non ne hanno).
const TRUCCHETTI_CONOSCIUTI = {
  bardo: [2, 3, 4], chierico: [3, 4, 5], druido: [2, 3, 4],
  mago: [3, 4, 5], stregone: [4, 5, 6], warlock: [2, 3, 4],
};

export function trucchettiConosciutiAlLivello(classeChiave, livello) {
  const tabella = TRUCCHETTI_CONOSCIUTI[classeChiave];
  if (!tabella) return 0;
  if (livello >= 10) return tabella[2];
  if (livello >= 4) return tabella[1];
  return tabella[0];
}

// Bonus di trucchetti conosciuti garantito da alcune razze/sottorazze SRD
// (Alto Elfo, Elfo Nero, Tiefling): un trucchetto extra scelto liberamente,
// per semplicità, invece di vincolarlo a una lista di classe specifica.
export function trucchettoBonusRazza(razzaChiave, sottorazzaChiave) {
  if (razzaChiave === "elfo" && (sottorazzaChiave === "alto" || sottorazzaChiave === "drow")) return 1;
  if (razzaChiave === "tiefling") return 1;
  return 0;
}

// Incantesimi innati garantiti da alcune razze/sottorazze SRD (oltre al
// trucchetto bonus), lanciabili una volta al giorno senza consumare slot,
// a partire da un certo livello di personaggio. "chiave" fa riferimento a
// una voce del catalogo in incantesimi-srd.js.
export const INCANTESIMI_RAZZIALI = {
  tiefling: [
    { livello: 3, chiave: "colpo_infernale" },
    { livello: 5, chiave: "oscurita" },
  ],
};

export const INCANTESIMI_RAZZIALI_SOTTORAZZA = {
  elfo: {
    drow: [
      { livello: 3, chiave: "fuoco_fatuo" },
      { livello: 5, chiave: "oscurita" },
    ],
  },
};

export function incantesimiRazzialiAlLivello(razzaChiave, sottorazzaChiave, livello) {
  const risultato = [];
  (INCANTESIMI_RAZZIALI[razzaChiave] || []).forEach((voce) => {
    if (livello >= voce.livello) risultato.push(voce.chiave);
  });
  (INCANTESIMI_RAZZIALI_SOTTORAZZA[razzaChiave]?.[sottorazzaChiave] || []).forEach((voce) => {
    if (livello >= voce.livello) risultato.push(voce.chiave);
  });
  return risultato;
}

// Incantesimi (non trucchetti) conosciuti per livello — solo per le classi a
// conoscenza fissa. Indice 0 = livello personaggio 1.
const INCANTESIMI_CONOSCIUTI_TABELLA = {
  bardo: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
  ranger: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
  stregone: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
  warlock: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
};

export function incantesimiConosciutiAlLivello(classeChiave, livello) {
  const tabella = INCANTESIMI_CONOSCIUTI_TABELLA[classeChiave];
  if (!tabella) return 0;
  return tabella[Math.max(0, Math.min(19, livello - 1))];
}

// Incantesimi preparati al giorno per le classi "a preparazione" (e per il
// Mago, che prepara dal proprio libro): mod. caratteristica + livello (metà
// livello, arrotondato per difetto, per il Paladino), minimo 1.
export function incantesimiPreparatiAlLivello(classeChiave, livello, punteggioCaratteristica) {
  if (!CLASSI_PREPARAZIONE.includes(classeChiave) && classeChiave !== "mago") return null;
  const mod = modificatore(punteggioCaratteristica);
  if (classeChiave === "paladino") return Math.max(1, mod + Math.floor(livello / 2));
  return Math.max(1, mod + livello);
}

export const TRATTI_PER_LIVELLO = {
  barbaro: {
    2: ["Attacco Fatidico", "Percezione del Pericolo"], 3: ["Cammino Primordiale (sottoclasse)"],
    5: ["Attacco Extra", "Movimento Veloce"], 7: ["Istinto Ferino"], 9: ["Critico Brutale (1 dado)"],
    11: ["Furia Implacabile"], 13: ["Critico Brutale (2 dadi)"], 15: ["Ira Persistente"],
    17: ["Critico Brutale (3 dadi)"], 18: ["Forza Indomabile"], 20: ["Campione Primordiale"],
  },
  bardo: {
    2: ["Ispirazione Bardica (d8)", "Jack of All Trades"], 3: ["Collegio Bardico (sottoclasse)", "Competenza"],
    5: ["Fonte di Ispirazione", "Ispirazione Bardica (d10)"], 10: ["Ispirazione Bardica (d12)", "Segreti Magici", "Competenza"],
    14: ["Segreti Magici"], 18: ["Ispirazione Illimitata"], 20: ["Superiorità Ispiratrice"],
  },
  chierico: {
    2: ["Incanalare Divinità", "Potere del Dominio Divino"], 5: ["Distruggere non Morti (GS 1/2)"],
    6: ["Potere del Dominio Divino", "Incanalare Divinità (2 usi)"], 8: ["Percosse Divine", "Distruggere non Morti (GS 1)"],
    10: ["Intervento Divino"], 11: ["Distruggere non Morti (GS 2)"], 14: ["Distruggere non Morti (GS 3)"],
    17: ["Potere del Dominio Divino", "Distruggere non Morti (GS 4)"], 20: ["Intervento Divino Migliorato"],
  },
  druido: {
    2: ["Forma Selvatica", "Circolo Druidico (sottoclasse)"], 4: ["Discepolo del Wild Shape"],
    18: ["Corpo Senza Tempo"], 20: ["Arcidruido"],
  },
  guerriero: {
    2: ["Recupero Energie", "Stile di Combattimento"], 3: ["Archetipo Marziale (sottoclasse)"],
    5: ["Attacco Extra"], 9: ["Indomito"], 11: ["Attacco Extra (2)"], 13: ["Indomito (2 usi)"],
    17: ["Attacco Extra (3)", "Indomito (3 usi)"],
  },
  ladro: {
    2: ["Azione Scaltra"], 3: ["Archetipo Ladresco (sottoclasse)"], 5: ["Elusione"],
    7: ["Eludere le Insidie"], 11: ["Talento Affidabile"], 14: ["Percezione Cieca"],
    15: ["Mente Sfuggente"], 18: ["Fortuna del Ladro"], 20: ["Colpo di Fortuna"],
  },
  mago: {
    2: ["Tradizione Arcana (sottoclasse)"], 18: ["Recupero degli Incantesimi Avanzato"], 20: ["Padronanza Arcana"],
  },
  monaco: {
    2: ["Ki", "Movimento senza Armatura"], 3: ["Tradizione Monastica (sottoclasse)", "Deviare Proiettili"],
    4: ["Caduta Lenta"], 5: ["Attacco Extra", "Colpo Frastornante"], 6: ["Colpi Potenziati dal Ki"],
    7: ["Mente Vuota", "Scatto"], 9: ["Purezza del Corpo"], 10: ["Immunità alla Malattia"],
    13: ["Lingua degli Spiriti"], 14: ["Anima Diamantina"], 15: ["Corpo Senza Tempo"],
    18: ["Corpo Vuoto"], 20: ["Perfezione dell'Essere"],
  },
  paladino: {
    2: ["Punizione Divina", "Sentire il Male e il Bene"], 3: ["Giuramento Sacro (sottoclasse)", "Incanalare Divinità", "Salute Divina"],
    5: ["Attacco Extra"], 6: ["Aura di Protezione"], 10: ["Aura di Coraggio"], 11: ["Colpi Radiosi"],
    14: ["Tocco Purificatore"], 18: ["Aura Migliorata"], 20: ["Potere del Giuramento Sacro (finale)"],
  },
  ranger: {
    2: ["Stile di Combattimento", "Magia del Ranger"], 3: ["Archetipo del Ranger (sottoclasse)", "Nemico Prescelto", "Esploratore Nato"],
    5: ["Attacco Extra"], 8: ["Andatura Terrestre"], 10: ["Occultarsi nella Natura"],
    14: ["Sparire"], 18: ["Sensi Selvaggi"], 20: ["Massacro di Mostri"],
  },
  stregone: {
    2: ["Metamagia (1 opzione)"], 3: ["Origine Stregonesca (sottoclasse)"], 10: ["Metamagia (2 opzioni)"],
    17: ["Metamagia (3 opzioni)"], 20: ["Restauro Stregonesco"],
  },
  warlock: {
    2: ["Invocazioni Occulte"], 3: ["Patto Occulto (sottoclasse)"], 7: ["Invocazioni Occulte aggiuntive"],
    9: ["Recupero Magico"], 11: ["Arcanum Mistico (6° livello)"], 13: ["Arcanum Mistico (7° livello)"],
    15: ["Arcanum Mistico (8° livello)"], 17: ["Arcanum Mistico (9° livello)"], 20: ["Padronanza del Patto"],
  },
};
