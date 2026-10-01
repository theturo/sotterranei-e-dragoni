// Dati e passi della guida alla creazione del personaggio (vedi
// guida-personaggio.js per il pannello nella scheda). Solo calcoli, niente
// pagina: si prova con Node (test/pagine/guida-personaggio.test.mjs).
// Regole e nomi dal SRD 5.1 (licenza Creative Commons), come dati-srd.js.
import {
  CLASSI,
  ABILITA,
  RAZZE,
  CLASSI_CONOSCENZA_FISSA,
  CLASSI_PREPARAZIONE,
  CARATTERISTICA_INCANTESIMI,
  trucchettiConosciutiAlLivello,
  trucchettoBonusRazza,
  incantesimiConosciutiAlLivello,
  incantesimiPreparatiAlLivello,
  TRATTI_PER_LIVELLO,
} from "./dati-srd.js";
import { ottieniIncantesimo } from "./incantesimi-srd.js";

// Abilità da scegliere con la classe: quante e tra quali (null = qualsiasi).
export const ABILITA_CLASSE = {
  barbaro: { numero: 2, scelta: ["addestrare_animali", "atletica", "intimidire", "natura", "percezione", "sopravvivenza"] },
  bardo: { numero: 3, scelta: null },
  chierico: { numero: 2, scelta: ["storia", "intuizione", "medicina", "persuasione", "religione"] },
  druido: { numero: 2, scelta: ["arcano", "addestrare_animali", "intuizione", "medicina", "natura", "percezione", "religione", "sopravvivenza"] },
  guerriero: { numero: 2, scelta: ["acrobazia", "addestrare_animali", "atletica", "storia", "intuizione", "intimidire", "percezione", "sopravvivenza"] },
  ladro: { numero: 4, scelta: ["acrobazia", "atletica", "inganno", "intuizione", "intimidire", "indagare", "percezione", "intrattenere", "persuasione", "rapidita_di_mano", "furtivita"] },
  mago: { numero: 2, scelta: ["arcano", "storia", "intuizione", "indagare", "medicina", "religione"] },
  monaco: { numero: 2, scelta: ["acrobazia", "atletica", "storia", "intuizione", "religione", "furtivita"] },
  paladino: { numero: 2, scelta: ["atletica", "intuizione", "intimidire", "medicina", "persuasione", "religione"] },
  ranger: { numero: 3, scelta: ["addestrare_animali", "atletica", "intuizione", "indagare", "natura", "percezione", "furtivita", "sopravvivenza"] },
  stregone: { numero: 2, scelta: ["arcano", "inganno", "intuizione", "intimidire", "persuasione", "religione"] },
  warlock: { numero: 2, scelta: ["arcano", "inganno", "storia", "intimidire", "indagare", "natura", "religione"] },
};

// Abilità date dalla razza: fisse o a scelta libera.
export const ABILITA_RAZZA = {
  elfo: { fisse: ["percezione"], libere: 0 },
  mezzorco: { fisse: ["intimidire"], libere: 0 },
  mezzelfo: { fisse: [], libere: 2 },
};

// Il background dà sempre 2 abilità.
export const ABILITA_BACKGROUND = 2;

// Competenze di classe (armature, armi, strumenti) e linguaggi di razza.
export const COMPETENZE_CLASSE = {
  barbaro: "Armature leggere e medie, scudi; armi semplici e da guerra.",
  bardo: "Armature leggere; armi semplici, balestre a mano, spade lunghe, stocchi, spade corte; tre strumenti musicali a scelta.",
  chierico: "Armature leggere e medie, scudi; armi semplici.",
  druido: "Armature leggere e medie, scudi (non di metallo); bastoni ferrati, dardi, falcetti, fionde, giavellotti, lance, mazze, pugnali, randelli, scimitarre; borsa da erborista.",
  guerriero: "Tutte le armature, scudi; armi semplici e da guerra.",
  ladro: "Armature leggere; armi semplici, balestre a mano, spade lunghe, stocchi, spade corte; arnesi da scasso.",
  mago: "Nessuna armatura; bastoni ferrati, balestre leggere, dardi, fionde, pugnali.",
  monaco: "Nessuna armatura; armi semplici, spade corte; uno strumento da artigiano o musicale a scelta.",
  paladino: "Tutte le armature, scudi; armi semplici e da guerra.",
  ranger: "Armature leggere e medie, scudi; armi semplici e da guerra.",
  stregone: "Nessuna armatura; balestre leggere, bastoni ferrati, dardi, fionde, pugnali.",
  warlock: "Armature leggere; armi semplici.",
};

export const LINGUAGGI_RAZZA = {
  umano: "Comune e un linguaggio a scelta.",
  elfo: "Comune ed Elfico.",
  nano: "Comune e Nanico.",
  halfling: "Comune e Halfling.",
  gnomo: "Comune e Gnomesco.",
  mezzelfo: "Comune, Elfico e un linguaggio a scelta.",
  mezzorco: "Comune e Orchesco.",
  dragonide: "Comune e Draconico.",
  tiefling: "Comune e Infernale.",
};

// Competenze in armi date da razza e sottorazza.
export const COMPETENZE_RAZZA = {
  nano: "Asce da battaglia, asce, martelli leggeri, martelli da guerra; uno strumento da artigiano a scelta (da fabbro, da birraio o da muratore).",
  "elfo/alto": "Spade lunghe, spade corte, archi corti, archi lunghi; un linguaggio in più a scelta.",
  "elfo/boschi": "Spade lunghe, spade corte, archi corti, archi lunghi.",
  "elfo/drow": "Stocchi, spade corte, balestre a mano.",
};

// Privilegi di 1° livello (i successivi li aggiunge il passaggio di livello,
// da TRATTI_PER_LIVELLO). Nomi come in privilegi.js dove ci sono contatori.
export const TRATTI_LIVELLO_1 = {
  barbaro: ["Ira", "Difesa senza Armatura"],
  bardo: ["Incantesimi", "Ispirazione Bardica (d6)"],
  chierico: ["Incantesimi", "Dominio Divino (sottoclasse)"],
  druido: ["Druidico", "Incantesimi"],
  guerriero: ["Stile di Combattimento", "Recupero Energie"],
  ladro: ["Maestria", "Attacco Furtivo", "Gergo Ladresco"],
  mago: ["Incantesimi", "Recupero Arcano"],
  monaco: ["Difesa senza Armatura", "Arti Marziali"],
  paladino: ["Percezione Divina", "Imposizione delle Mani"],
  ranger: ["Nemico Prescelto", "Esploratore Nato"],
  stregone: ["Incantesimi", "Origine Stregonesca (sottoclasse)"],
  warlock: ["Patrono Ultraterreno (sottoclasse)", "Magia del Patto"],
};

// Sottoclasse: a che livello si sceglie, come si chiama per la classe e
// quella del SRD (le altre, dal Manuale del Giocatore, se il DM le ammette).
export const SOTTOCLASSI = {
  barbaro: { livello: 3, etichetta: "Cammino Primordiale", srd: "Cammino del Berserker" },
  bardo: { livello: 3, etichetta: "Collegio Bardico", srd: "Collegio della Sapienza" },
  chierico: { livello: 1, etichetta: "Dominio Divino", srd: "Dominio della Vita" },
  druido: { livello: 2, etichetta: "Circolo Druidico", srd: "Circolo della Terra" },
  guerriero: { livello: 3, etichetta: "Archetipo Marziale", srd: "Campione" },
  ladro: { livello: 3, etichetta: "Archetipo Ladresco", srd: "Furfante" },
  mago: { livello: 2, etichetta: "Tradizione Arcana", srd: "Scuola di Invocazione" },
  monaco: { livello: 3, etichetta: "Tradizione Monastica", srd: "Via della Mano Aperta" },
  paladino: { livello: 3, etichetta: "Giuramento Sacro", srd: "Giuramento di Devozione" },
  ranger: { livello: 3, etichetta: "Archetipo del Ranger", srd: "Cacciatore" },
  stregone: { livello: 1, etichetta: "Origine Stregonesca", srd: "Discendenza Draconica" },
  warlock: { livello: 1, etichetta: "Patrono Ultraterreno", srd: "l'Immondo" },
};

// Equipaggiamento iniziale di classe (si sceglie un'opzione per riga), in
// aggiunta a quello del background.
export const EQUIPAGGIAMENTO_INIZIALE = {
  barbaro: ["un'ascia bipenne oppure un'arma da guerra da mischia", "due asce oppure un'arma semplice", "una dotazione da esploratore e quattro giavellotti"],
  bardo: ["uno stocco, una spada lunga oppure un'arma semplice", "una dotazione da diplomatico oppure da intrattenitore", "un liuto oppure un altro strumento musicale", "armatura di cuoio e un pugnale"],
  chierico: ["una mazza oppure un martello da guerra (se competente)", "una corazza a scaglie, un'armatura di cuoio oppure una cotta di maglia (se competente)", "una balestra leggera e 20 quadrelli oppure un'arma semplice", "una dotazione da sacerdote oppure da esploratore", "uno scudo e un simbolo sacro"],
  druido: ["uno scudo di legno oppure un'arma semplice", "una scimitarra oppure un'arma semplice da mischia", "armatura di cuoio, una dotazione da esploratore e un focus druidico"],
  guerriero: ["una cotta di maglia oppure armatura di cuoio, arco lungo e 20 frecce", "un'arma da guerra e uno scudo oppure due armi da guerra", "una balestra leggera e 20 quadrelli oppure due asce", "una dotazione da avventuriero oppure da esploratore"],
  ladro: ["uno stocco oppure una spada corta", "un arco corto e 20 frecce oppure una spada corta", "una dotazione da scassinatore, da avventuriero oppure da esploratore", "armatura di cuoio, due pugnali e arnesi da scasso"],
  mago: ["un bastone ferrato oppure un pugnale", "una borsa per componenti oppure un focus arcano", "una dotazione da studioso oppure da esploratore", "un libro degli incantesimi"],
  monaco: ["una spada corta oppure un'arma semplice", "una dotazione da avventuriero oppure da esploratore", "10 dardi"],
  paladino: ["un'arma da guerra e uno scudo oppure due armi da guerra", "cinque giavellotti oppure un'arma semplice da mischia", "una dotazione da sacerdote oppure da esploratore", "una cotta di maglia e un simbolo sacro"],
  ranger: ["una corazza a scaglie oppure un'armatura di cuoio", "due spade corte oppure due armi semplici da mischia", "una dotazione da avventuriero oppure da esploratore", "un arco lungo e 20 frecce"],
  stregone: ["una balestra leggera e 20 quadrelli oppure un'arma semplice", "una borsa per componenti oppure un focus arcano", "una dotazione da avventuriero oppure da esploratore", "due pugnali"],
  warlock: ["una balestra leggera e 20 quadrelli oppure un'arma semplice", "una borsa per componenti oppure un focus arcano", "una dotazione da studioso oppure da avventuriero", "armatura di cuoio, un'arma semplice e due pugnali"],
};

export const nomeAbilita = (chiave) => ABILITA.find((a) => a.chiave === chiave)?.nome || chiave;

// Abilità attese in tutto: classe + background + razza.
export function abilitaAttese(scheda) {
  const classe = ABILITA_CLASSE[scheda.classe];
  const razza = ABILITA_RAZZA[scheda.razza];
  return (classe?.numero || 0) + ABILITA_BACKGROUND + (razza ? razza.fisse.length + razza.libere : 0);
}

export function modoIncantatore(classe) {
  if (CLASSI_CONOSCENZA_FISSA.includes(classe)) return "fisso";
  if (classe === "mago") return "libro";
  if (CLASSI_PREPARAZIONE.includes(classe)) return "preparazione";
  return null;
}

// Cosa deve esserci tra gli incantesimi al livello attuale: { trucchetti,
// conosciuti, libro, preparati } (0 = non richiesto). null se la classe non
// lancia ancora incantesimi (Paladino e Ranger dal 2° livello).
export function incantesimiAttesi(scheda) {
  const classe = scheda.classe;
  const livello = scheda.livello || 1;
  const modo = modoIncantatore(classe);
  if (!modo || ((classe === "paladino" || classe === "ranger") && livello < 2)) return null;
  const trucchettiClasse = trucchettiConosciutiAlLivello(classe, livello);
  const punteggio = scheda.caratteristiche?.[CARATTERISTICA_INCANTESIMI[classe]] ?? 10;
  return {
    modo,
    trucchetti: trucchettiClasse ? trucchettiClasse + trucchettoBonusRazza(scheda.razza, scheda.sottorazza) : 0,
    conosciuti: modo === "fisso" ? incantesimiConosciutiAlLivello(classe, livello) : 0,
    libro: modo === "libro" ? 6 + 2 * (livello - 1) : 0,
    preparati: modo === "fisso" ? 0 : incantesimiPreparatiAlLivello(classe, livello, punteggio) || 0,
  };
}

export function incantesimiPresenti(scheda) {
  const conosciuti = scheda.incantesimiConosciuti || [];
  const trucchetti = conosciuti.filter((c) => ottieniIncantesimo(c)?.livello === 0).length;
  return {
    trucchetti,
    conosciuti: conosciuti.length - trucchetti,
    preparati: (scheda.incantesimiPreparati || []).length,
  };
}

// Il placeholder della sottoclasse (es. "Archetipo Marziale (sottoclasse)")
// si sostituisce con "Archetipo Marziale: Campione".
export function sottoclasseScelta(scheda) {
  const info = SOTTOCLASSI[scheda.classe];
  if (!info) return null;
  const voce = (scheda.talenti || []).find((t) => t.startsWith(info.etichetta) && !t.includes("(sottoclasse)"));
  return voce ? voce.slice(info.etichetta.length).replace(/^[\s:–—-]+/, "") || voce : null;
}

export function testoSottoclasse(classe, nome) {
  return `${SOTTOCLASSI[classe].etichetta}: ${nome.trim()}`;
}

// Talenti con la sottoclasse impostata: sostituisce il placeholder (o una
// scelta precedente) oppure la aggiunge.
export function talentiConSottoclasse(scheda, nome) {
  const info = SOTTOCLASSI[scheda.classe];
  const nuova = testoSottoclasse(scheda.classe, nome);
  const talenti = [...(scheda.talenti || [])];
  const indice = talenti.findIndex((t) => t.startsWith(info.etichetta));
  if (indice >= 0) talenti[indice] = nuova;
  else talenti.push(nuova);
  return talenti;
}

// Privilegi di 1° livello non ancora tra i talenti.
export function trattiLivello1Mancanti(scheda) {
  const presenti = (scheda.talenti || []).map((t) => t.toLowerCase());
  const etichetta = SOTTOCLASSI[scheda.classe]?.etichetta;
  return (TRATTI_LIVELLO_1[scheda.classe] || []).filter((tratto) => {
    // La sottoclasse conta anche se è già stata scelta ("Dominio Divino: …").
    if (etichetta && tratto.startsWith(etichetta)) return !presenti.some((t) => t.startsWith(etichetta.toLowerCase()));
    return !presenti.some((t) => t.startsWith(tratto.toLowerCase().replace(/ \(.*\)$/, "")));
  });
}

const pieno = (testo) => typeof testo === "string" && testo.trim().length > 0;

// Passi della guida, nell'ordine: { id, titolo, fatto, facoltativo, livello }.
// livelloObiettivo: livello di partenza della campagna (o quello raggiungibile
// con i crediti concessi dal DM).
export function passiGuida(scheda, { livelloObiettivo = 1 } = {}) {
  const livello = scheda.livello || 1;
  const passi = [];
  const aggiungi = (id, titolo, fatto, extra = {}) => passi.push({ id, titolo, fatto: Boolean(fatto), facoltativo: false, ...extra });

  aggiungi("background", "Background", pieno(scheda.background));
  aggiungi("abilita", "Abilità", (scheda.abilitaCompetenti || []).length >= abilitaAttese(scheda));
  aggiungi("allineamento", "Allineamento", Boolean(scheda.allineamento));
  aggiungi("tratti", "Privilegi di 1° livello", trattiLivello1Mancanti(scheda).length === 0);
  const sottoclasse = SOTTOCLASSI[scheda.classe];
  if (sottoclasse?.livello === 1) aggiungi("sottoclasse", sottoclasse.etichetta, Boolean(sottoclasseScelta(scheda)));
  aggiungi("equipaggiamento", "Equipaggiamento", (scheda.inventario || []).length > 0);
  aggiungi("competenze", "Competenze e linguaggi", pieno(scheda.competenzeLinguaggi));
  const p = scheda.personalita || {};
  aggiungi("personalita", "Personalità", pieno(p.tratti) && pieno(p.ideali) && pieno(p.legami) && pieno(p.difetti));

  const fineLivelli = Math.max(livelloObiettivo, livello);
  for (let l = 2; l <= fineLivelli; l++) {
    aggiungi(`livello-${l}`, `Livello ${l}`, livello >= l, { livello: l });
    if (sottoclasse?.livello === l) aggiungi("sottoclasse", sottoclasse.etichetta, livello >= l && Boolean(sottoclasseScelta(scheda)), { livello: l });
  }

  // Gli incantesimi si completano dopo i passaggi di livello (ne arrivano di nuovi).
  const attesi = incantesimiAttesi(scheda);
  const caster = modoIncantatore(scheda.classe);
  if (attesi || (caster && fineLivelli >= 2)) {
    const presenti = incantesimiPresenti(scheda);
    const fatto = Boolean(attesi)
      && presenti.trucchetti >= attesi.trucchetti
      && presenti.conosciuti >= Math.max(attesi.conosciuti, attesi.libro)
      && presenti.preparati >= attesi.preparati;
    aggiungi("incantesimi", "Incantesimi", fatto);
  }

  aggiungi("ritratto", "Ritratto", Boolean(scheda.ritratto), { facoltativo: true });
  return passi;
}

// Nomi per i testi della guida.
export const nomeClasse = (classe) => CLASSI[classe]?.nome || classe;
export const nomeRazza = (razza) => RAZZE[razza]?.nome || razza;
export const trattiAlLivello = (classe, livello) => TRATTI_PER_LIVELLO[classe]?.[livello] || [];
