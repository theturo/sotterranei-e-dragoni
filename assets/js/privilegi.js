// Privilegi di classe con usi limitati (SRD 5.1): quanti usi a ogni livello e
// con quale riposo si ricaricano. Sulla scheda gli usi spesi stanno in
// "usiPrivilegi" ({ chiave: usati }); i riposi li azzerano (vedi riposo.js).
import { modificatore } from "./dati-srd.js";

const ILLIMITATI = Infinity;

// Valore per livello da una tabella a soglie: [[livello minimo, valore], …].
const aSoglie = (soglie) => (livello) => {
  let valore = 0;
  soglie.forEach(([minimo, v]) => {
    if (livello >= minimo) valore = v;
  });
  return valore;
};

const modCarisma = (scheda) => modificatore(scheda.caratteristiche?.carisma ?? 10);

// usi(livello, scheda) → numero massimo (0 = non ancora disponibile).
// ricarica: "breve" (riposo breve o lungo) o "lungo"; può dipendere dal livello.
const PRIVILEGI = {
  barbaro: [
    {
      chiave: "ira", nome: "Ira", ricarica: () => "lungo",
      usi: aSoglie([[1, 2], [3, 3], [6, 4], [12, 5], [17, 6], [20, ILLIMITATI]]),
      descrizione: "Azione bonus: vantaggio alle prove e ai tiri salvezza di Forza, danni extra in mischia, resistenza ai danni contundenti, perforanti e taglienti.",
    },
  ],
  bardo: [
    {
      chiave: "ispirazione-bardica", nome: "Ispirazione Bardica",
      ricarica: (livello) => (livello >= 5 ? "breve" : "lungo"),
      usi: (livello, scheda) => Math.max(1, modCarisma(scheda)),
      descrizione: "Azione bonus: una creatura entro 18 m aggiunge il dado di ispirazione a una prova, un attacco o un tiro salvezza.",
    },
  ],
  chierico: [
    {
      chiave: "incanalare-divinita", nome: "Incanalare Divinità", ricarica: () => "breve",
      usi: aSoglie([[2, 1], [6, 2], [18, 3]]),
      descrizione: "Energia divina per Scacciare Non Morti o per l'effetto del proprio dominio.",
    },
  ],
  druido: [
    {
      chiave: "forma-selvatica", nome: "Forma Selvatica", ricarica: () => "breve",
      usi: aSoglie([[2, 2], [20, ILLIMITATI]]),
      descrizione: "Azione: si trasforma in una bestia già vista.",
    },
  ],
  guerriero: [
    {
      chiave: "recupero-energie", nome: "Recupero Energie", ricarica: () => "breve",
      usi: aSoglie([[1, 1]]),
      descrizione: "Azione bonus: recupera 1d10 + livello da guerriero PF.",
    },
    {
      chiave: "azione-impetuosa", nome: "Azione Impetuosa", ricarica: () => "breve",
      usi: aSoglie([[2, 1], [17, 2]]),
      descrizione: "Un'azione aggiuntiva nel proprio turno (una sola volta per turno).",
    },
    {
      chiave: "indomito", nome: "Indomito", ricarica: () => "lungo",
      usi: aSoglie([[9, 1], [13, 2], [17, 3]]),
      descrizione: "Ripete un tiro salvezza fallito, tenendo il nuovo risultato.",
    },
  ],
  ladro: [
    {
      chiave: "colpo-di-fortuna", nome: "Colpo di Fortuna", ricarica: () => "breve",
      usi: aSoglie([[20, 1]]),
      descrizione: "Trasforma un attacco mancato in un colpo, o una prova fallita in un 20.",
    },
  ],
  mago: [
    {
      chiave: "recupero-arcano", nome: "Recupero Arcano", ricarica: () => "lungo",
      usi: aSoglie([[1, 1]]),
      descrizione: "Dopo un riposo breve recupera slot per un totale di livelli pari a metà del livello da mago (per eccesso), nessuno di 6° o più.",
    },
  ],
  monaco: [
    {
      chiave: "ki", nome: "Punti Ki", ricarica: () => "breve",
      usi: (livello) => (livello >= 2 ? livello : 0),
      descrizione: "Raffica di Colpi, Difesa Paziente, Passo del Vento e gli altri poteri del ki.",
    },
  ],
  paladino: [
    {
      chiave: "percezione-divina", nome: "Percezione Divina", ricarica: () => "lungo",
      usi: (livello, scheda) => Math.max(1, 1 + modCarisma(scheda)),
      descrizione: "Azione: percepisce celestiali, immondi e non morti entro 18 m.",
    },
    {
      chiave: "imposizione-mani", nome: "Imposizione delle Mani", ricarica: () => "lungo",
      usi: (livello) => 5 * livello,
      descrizione: "Riserva di PF da donare con un tocco (5 PF curano anche una malattia o un veleno).",
    },
    {
      chiave: "incanalare-divinita", nome: "Incanalare Divinità", ricarica: () => "breve",
      usi: aSoglie([[3, 1]]),
      descrizione: "Energia divina per l'effetto del proprio giuramento.",
    },
  ],
  stregone: [
    {
      chiave: "punti-stregoneria", nome: "Punti Stregoneria", ricarica: () => "lungo",
      usi: (livello) => (livello >= 2 ? livello : 0),
      descrizione: "Per la Metamagia o per creare slot incantesimo (Magia Flessibile).",
    },
  ],
  warlock: [6, 7, 8, 9].map((cerchio, i) => ({
    chiave: `arcanum-${cerchio}`, nome: `Arcanum Mistico (${cerchio}°)`, ricarica: () => "lungo",
    usi: aSoglie([[11 + 2 * i, 1]]),
    descrizione: `Lancia una volta l'incantesimo di ${cerchio}° livello scelto, senza slot.`,
  })),
};

export const NOMI_RICARICA = { breve: "riposo breve o lungo", lungo: "riposo lungo" };

// Privilegi disponibili a un personaggio (scheda o riepilogo del party con
// classe, livello e, se serve, il Carisma), con usi massimi e rimasti.
// I privilegi illimitati hanno max = Infinity.
export function privilegiDelPersonaggio(personaggio) {
  const livello = personaggio.livello || 1;
  const usati = personaggio.usiPrivilegi || {};
  return (PRIVILEGI[personaggio.classe] || [])
    .map((p) => {
      const max = p.usi(livello, personaggio);
      const spesi = Math.min(usati[p.chiave] || 0, Number.isFinite(max) ? max : 0);
      return {
        chiave: p.chiave,
        nome: p.nome,
        descrizione: p.descrizione,
        ricarica: p.ricarica(livello),
        max,
        usati: spesi,
        rimasti: Number.isFinite(max) ? max - spesi : ILLIMITATI,
      };
    })
    .filter((p) => p.max > 0);
}

// Usi spesi dopo un riposo breve: si azzerano quelli che si ricaricano col breve.
export function usiDopoRiposoBreve(personaggio) {
  const breve = new Set(privilegiDelPersonaggio(personaggio).filter((p) => p.ricarica === "breve").map((p) => p.chiave));
  return Object.fromEntries(Object.entries(personaggio.usiPrivilegi || {}).filter(([chiave]) => !breve.has(chiave)));
}

// Usi spesi dopo aver speso (delta > 0) o recuperato (delta < 0) usi del
// privilegio "chiave", tenendo il conteggio tra 0 e il massimo. Restituisce il
// nuovo oggetto "usiPrivilegi" da salvare, oppure null se non cambia nulla
// (privilegio sconosciuto o illimitato, già al limite).
export function usiDopoVariazione(personaggio, chiave, delta) {
  const privilegio = privilegiDelPersonaggio(personaggio).find((p) => p.chiave === chiave);
  if (!privilegio || !Number.isFinite(privilegio.max)) return null;
  const usati = Math.max(0, Math.min(privilegio.max, privilegio.usati + delta));
  if (usati === privilegio.usati) return null;
  const usi = { ...(personaggio.usiPrivilegi || {}) };
  if (usati) usi[chiave] = usati;
  else delete usi[chiave];
  return usi;
}
