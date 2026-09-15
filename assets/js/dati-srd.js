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
