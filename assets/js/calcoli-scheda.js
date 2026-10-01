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
  CONDIZIONI,
} from "./dati-srd.js";
import { ARMI, ARMATURE } from "./equipaggiamento-srd.js";
import { ottieniIncantesimo } from "./incantesimi-srd.js";
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

function modDannoArma(scheda, arma) {
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
