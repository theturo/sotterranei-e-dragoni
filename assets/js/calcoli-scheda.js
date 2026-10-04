// Valori calcolati di una scheda (gli stessi che mostra scheda-personaggio.js):
// usati dall'esportazione in PDF, anche per le schede che non sono aperte
// nella pagina (il DM esporta tutto il party). Solo calcoli: si prova con Node.
import {
  CLASSI,
  CARATTERISTICHE,
  ABILITA,
  ABBREVIAZIONI_CARATTERISTICHE,
  CARATTERISTICA_INCANTESIMI,
  TIPO_LANCIATORE,
  modificatore,
  formattaModificatore,
  nomeRazzaCompleto,
  nomeAllineamento,
  velocitaRazza,
  slotIncantesimoAlLivello,
  incantesimiRazzialiAlLivello,
  CLASSI_CONOSCENZA_FISSA,
  CLASSI_PREPARAZIONE,
  CONDIZIONI,
} from "./dati-srd.js";
import { ARMI, ARMATURE } from "./equipaggiamento-srd.js";
import { ottieniIncantesimo, TIRI_INCANTESIMI } from "./incantesimi-srd.js";
import { leggiFormula } from "./dadi-base.js";
import { privilegiDelPersonaggio, NOMI_RICARICA } from "./privilegi.js";

export const bonusCompetenza = (livello) => 2 + Math.floor(((livello || 1) - 1) / 4);
const punteggio = (scheda, chiave) => scheda.caratteristiche?.[chiave] ?? 10;
const mod = (scheda, chiave) => modificatore(punteggio(scheda, chiave));

export function classeArmatura(scheda) {
  const modDes = mod(scheda, "destrezza");
  const armatura = scheda.armaturaIndossata ? ARMATURE[scheda.armaturaIndossata] : null;
  let ca = 10 + modDes;
  if (armatura) {
    const des = armatura.usaDestrezza ? (armatura.desMax != null ? Math.min(modDes, armatura.desMax) : modDes) : 0;
    ca = armatura.caBase + des;
  }
  const haScudo = (scheda.inventario || []).some((v) => v.categoria === "armatura" && ARMATURE[v.chiave]?.sottocategoria === "scudo");
  if (scheda.scudoIndossato && haScudo) ca += ARMATURE.scudo.bonusScudo;
  return ca;
}

export function bonusAttaccoSuggerito(scheda, chiaveArma) {
  const arma = ARMI[chiaveArma];
  if (!arma) return 0;
  const forza = mod(scheda, "forza");
  const destrezza = mod(scheda, "destrezza");
  const pertinente = arma.proprieta?.includes("Finezza") ? Math.max(forza, destrezza) : arma.tipo === "a distanza" ? destrezza : forza;
  return pertinente + bonusCompetenza(scheda.livello);
}

export function modDannoArma(scheda, arma) {
  const forza = mod(scheda, "forza");
  const destrezza = mod(scheda, "destrezza");
  if (arma.tipo === "a distanza") return destrezza;
  if ((arma.proprieta || []).includes("Finezza")) return Math.max(forza, destrezza);
  return forza;
}

export function attacchi(scheda) {
  return (scheda.inventario || []).filter((v) => v.categoria === "arma").map((voce) => {
    const arma = ARMI[voce.chiave];
    const bonus = voce.bonusAttacco ?? bonusAttaccoSuggerito(scheda, voce.chiave);
    if (!arma) return { nome: voce.nome, bonus: formattaModificatore(bonus), danno: "—", proprieta: "" };
    const extra = modDannoArma(scheda, arma);
    return {
      nome: voce.nome,
      bonus: formattaModificatore(bonus),
      danno: `${arma.danno}${extra ? ` ${extra > 0 ? "+" : "−"} ${Math.abs(extra)}` : ""} ${arma.tipoDanno}`,
      proprieta: (arma.proprieta || []).join(", "),
    };
  });
}

// Tutto ciò che serve per stampare una scheda, già formattato.
export function vistaScheda(scheda) {
  const livello = scheda.livello || 1;
  const bonus = bonusCompetenza(livello);
  const classe = CLASSI[scheda.classe];
  const competenti = new Set(scheda.abilitaCompetenti || []);
  const caratteristiche = CARATTERISTICHE.map(({ chiave, nome }) => ({
    chiave, nome, abbr: ABBREVIAZIONI_CARATTERISTICHE[chiave], punteggio: punteggio(scheda, chiave),
    mod: formattaModificatore(mod(scheda, chiave)),
  }));
  const salvezze = CARATTERISTICHE.map(({ chiave, nome }) => {
    const competente = Boolean(classe?.salvezze?.includes(chiave));
    return { nome, competente, valore: formattaModificatore(mod(scheda, chiave) + (competente ? bonus : 0)) };
  });
  const abilita = ABILITA.map(({ chiave, nome, caratteristica }) => ({
    nome, abbr: ABBREVIAZIONI_CARATTERISTICHE[caratteristica], competente: competenti.has(chiave),
    valore: formattaModificatore(mod(scheda, caratteristica) + (competenti.has(chiave) ? bonus : 0)),
  }));
  const hp = scheda.hp || { massimi: 0, attuali: 0, temporanei: 0 };
  const dadoVita = classe?.dadoVita || 8;

  // Incantesimi: statistiche, slot e liste per livello.
  let incantesimi = null;
  const caratteristicaMagia = CARATTERISTICA_INCANTESIMI[scheda.classe];
  if (caratteristicaMagia) {
    const attacco = mod(scheda, caratteristicaMagia) + bonus;
    const tipo = TIPO_LANCIATORE[scheda.classe];
    const slot = slotIncantesimoAlLivello(scheda.classe, livello);
    let testoSlot = "—";
    if (tipo === "patto" && slot?.slot > 0) testoSlot = `${slot.slot} slot di ${slot.livelloSlot}° livello (Patto Magico)`;
    else if (Array.isArray(slot)) testoSlot = slot.map((n, i) => (n > 0 ? `${i + 1}°: ${n}` : null)).filter(Boolean).join(" · ") || "—";
    const descrivi = (chiavi) => chiavi.map((c) => ottieniIncantesimo(c)).filter(Boolean)
      .sort((a, b) => a.livello - b.livello || a.nome.localeCompare(b.nome))
      .map((i) => ({ nome: i.nome, livello: i.livello }));
    const conosciuti = descrivi(scheda.incantesimiConosciuti || []);
    incantesimi = {
      caratteristica: CARATTERISTICHE.find((c) => c.chiave === caratteristicaMagia)?.nome,
      attacco: formattaModificatore(attacco),
      cd: 8 + attacco,
      slot: testoSlot,
      trucchetti: conosciuti.filter((i) => i.livello === 0),
      conosciuti: conosciuti.filter((i) => i.livello > 0),
      preparati: descrivi(scheda.incantesimiPreparati || []),
      titoloConosciuti: scheda.classe === "mago" ? "Libro degli incantesimi" : "Incantesimi conosciuti",
    };
  }

  const armatura = scheda.armaturaIndossata ? ARMATURE[scheda.armaturaIndossata]?.nome : null;
  return {
    nome: scheda.nome || "—",
    classe: classe?.nome || "—",
    livello,
    razza: nomeRazzaCompleto(scheda.razza, scheda.sottorazza) || "—",
    background: scheda.background || "—",
    allineamento: scheda.allineamento ? nomeAllineamento(scheda.allineamento) : "—",
    bonusCompetenza: `+${bonus}`,
    caratteristiche,
    salvezze,
    abilita,
    percezionePassiva: 10 + mod(scheda, "saggezza") + (competenti.has("percezione") ? bonus : 0),
    ca: classeArmatura(scheda),
    iniziativa: formattaModificatore(mod(scheda, "destrezza")),
    velocita: `${String(velocitaRazza(scheda.razza, scheda.sottorazza)).replace(".", ",")} m`,
    pf: { massimi: hp.massimi, attuali: hp.attuali, temporanei: hp.temporanei || 0 },
    dadiVita: `${Math.max(0, livello - (scheda.dadiVitaSpesi || 0))} / ${livello} (d${dadoVita})`,
    attacchi: attacchi(scheda),
    privilegi: privilegiDelPersonaggio(scheda).map((p) => ({
      nome: p.nome,
      usi: Number.isFinite(p.max) ? `${p.rimasti}/${p.max}` : "illimitati",
      ricarica: NOMI_RICARICA[p.ricarica] || "",
    })),
    talenti: scheda.talenti || [],
    incantesimi,
    monete: scheda.monete || {},
    inventario: (scheda.inventario || []).map((v) => ({ nome: v.nome, quantita: v.quantita || 1 })),
    indossati: [armatura ? `Armatura: ${armatura}` : "Senza armatura", scheda.scudoIndossato ? "scudo imbracciato" : null].filter(Boolean).join(", "),
    personalita: scheda.personalita || {},
    competenzeLinguaggi: scheda.competenzeLinguaggi || "",
    condizioni: (scheda.condizioni || []).map((c) => CONDIZIONI.find((x) => x.chiave === c)?.nome || c),
    esaurimento: scheda.esaurimento || 0,
  };
}

// ---------- Scheda rapida della Sessione (scheda-rapida.js) ----------
// Gli stessi valori della scheda completa, ma come numeri: servono per i tiri.

const moltiplicatoreTrucchetto = (livello) => 1 + (livello >= 5) + (livello >= 11) + (livello >= 17);

// Incantesimi che si possono lanciare in gioco: i trucchetti più i conosciuti
// (bardo, ranger, stregone, warlock) o i preparati (mago, chierico, druido,
// paladino), in ordine di livello e di nome.
function incantesimiInGioco(scheda) {
  const classe = scheda.classe;
  const conosciuti = scheda.incantesimiConosciuti || [];
  const trucchetti = conosciuti.filter((c) => ottieniIncantesimo(c)?.livello === 0);
  const altri = CLASSI_CONOSCENZA_FISSA.includes(classe)
    ? conosciuti.filter((c) => ottieniIncantesimo(c)?.livello > 0)
    : classe === "mago" || CLASSI_PREPARAZIONE.includes(classe) ? scheda.incantesimiPreparati || [] : [];
  return [...new Set([...trucchetti, ...altri])]
    .map((chiave) => ({ chiave, dati: ottieniIncantesimo(chiave) }))
    .filter((x) => x.dati)
    .sort((a, b) => a.dati.livello - b.dati.livello || a.dati.nome.localeCompare(b.dati.nome))
    .map(({ chiave, dati }) => {
      const tiri = TIRI_INCANTESIMI[chiave] || {};
      return { chiave, nome: dati.nome, livello: dati.livello, colpire: Boolean(tiri.attacco), danno: Boolean(tiri.danno), cura: Boolean(tiri.cura) };
    });
}

// Slot da mostrare a pallini: [{ chiave: "1".."9" | "patto", etichetta, max, usati }].
function slotInGioco(scheda) {
  const tipo = TIPO_LANCIATORE[scheda.classe];
  const slot = slotIncantesimoAlLivello(scheda.classe, scheda.livello || 1);
  const usati = scheda.slotIncantesimoUsati || {};
  if (!tipo || !slot) return [];
  if (tipo === "patto") {
    return slot.slot > 0 ? [{ chiave: "patto", etichetta: `Patto ${slot.livelloSlot}°`, max: slot.slot, usati: Math.min(usati.patto || 0, slot.slot) }] : [];
  }
  return slot
    .map((max, i) => ({ chiave: String(i + 1), etichetta: `${i + 1}°`, max, usati: Math.min(usati[i + 1] || 0, max) }))
    .filter((s) => s.max > 0);
}

export function datiSchedaRapida(scheda) {
  const livello = scheda.livello || 1;
  const bonus = bonusCompetenza(livello);
  const classe = CLASSI[scheda.classe];
  const competenti = new Set(scheda.abilitaCompetenti || []);
  const caratteristiche = CARATTERISTICHE.map(({ chiave, nome }) => ({
    chiave, nome, abbr: ABBREVIAZIONI_CARATTERISTICHE[chiave], punteggio: punteggio(scheda, chiave), mod: mod(scheda, chiave),
  }));
  const salvezze = CARATTERISTICHE.map(({ chiave, nome }) => {
    const competente = Boolean(classe?.salvezze?.includes(chiave));
    return { chiave, nome, competente, mod: mod(scheda, chiave) + (competente ? bonus : 0) };
  });
  const abilita = ABILITA.map(({ chiave, nome, caratteristica }) => ({
    chiave, nome, abbr: ABBREVIAZIONI_CARATTERISTICHE[caratteristica], competente: competenti.has(chiave),
    mod: mod(scheda, caratteristica) + (competenti.has(chiave) ? bonus : 0),
  }));
  const armi = (scheda.inventario || []).filter((v) => v.categoria === "arma").map((voce) => {
    const arma = ARMI[voce.chiave];
    const formula = arma && leggiFormula(arma.danno);
    const extra = arma ? modDannoArma(scheda, arma) : 0;
    return {
      chiave: voce.chiave,
      nome: voce.nome,
      bonus: voce.bonusAttacco ?? bonusAttaccoSuggerito(scheda, voce.chiave),
      danno: formula ? { ...formula, modificatore: formula.modificatore + extra } : null,
      testoDanno: arma ? `${arma.danno}${extra ? ` ${extra > 0 ? "+" : "−"} ${Math.abs(extra)}` : ""} ${arma.tipoDanno}` : "",
      tipoDanno: arma?.tipoDanno || "",
    };
  });
  const caratteristicaMagia = CARATTERISTICA_INCANTESIMI[scheda.classe];
  const attaccoMagia = caratteristicaMagia ? mod(scheda, caratteristicaMagia) + bonus : 0;
  const razziali = incantesimiRazzialiAlLivello(scheda.razza, scheda.sottorazza, livello)
    .map((chiave) => ({ chiave, nome: ottieniIncantesimo(chiave)?.nome, usato: (scheda.incantesimiRazzaUsati || []).includes(chiave) }))
    .filter((x) => x.nome);
  const magia = caratteristicaMagia || razziali.length
    ? {
      incantatore: Boolean(caratteristicaMagia),
      attacco: attaccoMagia,
      cd: 8 + attaccoMagia,
      slot: caratteristicaMagia ? slotInGioco(scheda) : [],
      incantesimi: caratteristicaMagia ? incantesimiInGioco(scheda) : [],
      razziali,
    }
    : null;
  return {
    nome: scheda.nome || "—",
    sottotitolo: `${nomeRazzaCompleto(scheda.razza, scheda.sottorazza) || "—"} · ${classe?.nome || "—"} ${livello}`,
    ca: classeArmatura(scheda),
    iniziativa: mod(scheda, "destrezza"),
    velocita: `${String(velocitaRazza(scheda.razza, scheda.sottorazza)).replace(".", ",")} m`,
    competenza: bonus,
    percezionePassiva: 10 + mod(scheda, "saggezza") + (competenti.has("percezione") ? bonus : 0),
    hp: { massimi: scheda.hp?.massimi || 0, attuali: scheda.hp?.attuali || 0, temporanei: scheda.hp?.temporanei || 0 },
    caratteristiche,
    salvezze,
    abilita,
    armi,
    magia,
    privilegi: privilegiDelPersonaggio(scheda),
  };
}

// Opzioni di apriTiro per un incantesimo ("colpire" | "danno" | "cura"), come
// nella scheda completa: i trucchetti crescono con il livello.
export function tiroIncantesimo(scheda, chiave, tipo) {
  const dati = ottieniIncantesimo(chiave);
  const tiri = TIRI_INCANTESIMI[chiave];
  if (!dati || !tiri) return null;
  const caratteristica = CARATTERISTICA_INCANTESIMI[scheda.classe];
  const modMagia = caratteristica ? mod(scheda, caratteristica) : 0;
  if (tipo === "colpire") return { etichetta: `${dati.nome}: per colpire`, modificatore: modMagia + bonusCompetenza(scheda.livello) };
  const formula = leggiFormula(tipo === "cura" ? tiri.cura : tiri.danno);
  if (!formula) return null;
  const quanti = dati.livello === 0 && !tiri.perRaggio ? formula.quanti * moltiplicatoreTrucchetto(scheda.livello || 1) : formula.quanti;
  const dettaglio = tipo === "cura" ? "cura" : `danni${tiri.tipo ? ` (${tiri.tipo})` : ""}${tiri.perRaggio ? ", per raggio" : ""}`;
  return {
    etichetta: `${dati.nome}: ${dettaglio}`,
    quanti,
    facce: formula.facce,
    modificatore: formula.modificatore + (tiri.piuMod ? modMagia : 0),
    tipo: tipo === "cura" ? "libero" : "danno",
  };
}

// Livelli di slot con cui si può lanciare un incantesimo: il Warlock solo
// quello del Patto Magico, gli altri il livello base o superiori (upcasting).
// [{ livello, chiaveSlot, disponibili }], vuoto se non c'è nessuno slot libero.
export function livelliDiLancio(scheda, chiave) {
  const dati = ottieniIncantesimo(chiave);
  if (!dati || dati.livello === 0) return [];
  const tipo = TIPO_LANCIATORE[scheda.classe];
  const slot = slotIncantesimoAlLivello(scheda.classe, scheda.livello || 1);
  const usati = scheda.slotIncantesimoUsati || {};
  if (!tipo || !slot) return [];
  if (tipo === "patto") {
    const disponibili = (slot.slot || 0) - (usati.patto || 0);
    return dati.livello <= slot.livelloSlot && disponibili > 0 ? [{ livello: slot.livelloSlot, chiaveSlot: "patto", disponibili }] : [];
  }
  const risultato = [];
  for (let i = dati.livello; i <= slot.length; i++) {
    const disponibili = (slot[i - 1] || 0) - (usati[i] || 0);
    if (disponibili > 0) risultato.push({ livello: i, chiaveSlot: String(i), disponibili });
  }
  return risultato;
}
