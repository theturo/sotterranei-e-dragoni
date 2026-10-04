// Calcoli del cruscotto della dashboard (puri, senza Firebase: si provano in
// Node). Dicono quale sessione mettere in evidenza e quali avvisi "Da fare"
// mostrare al DM e al giocatore.
import { oggiIso, formattaDataOra, distanzaGiorni, etichettaSessione } from "./calendario.js";

// Strumenti della dashboard, raggruppati. "soloDM": solo nella dashboard del DM.
// "icona" = nome di un'icona di icone.js (anche negli avvisi "Da fare").
export const GRUPPI_DM = [
  {
    id: "prepara",
    titolo: "Prepara",
    voci: [
      { chiave: "calendario", icona: "calendario", titolo: "Calendario", testo: "Date e sessioni", link: "calendario.html" },
      { chiave: "libreria", icona: "libreria", titolo: "Libreria", testo: "Mappe, PNG e dispense", link: "libreria.html" },
      { chiave: "bestiario", icona: "bestiario", titolo: "Bestiario", testo: "Mostri e PNG", link: "bestiario.html" },
      { chiave: "impostazioni-campagna", icona: "campagna", titolo: "Gestione campagna", testo: "Giocatori e sessioni", link: "campagna.html" },
    ],
  },
  {
    id: "gioca",
    titolo: "Gioca",
    voci: [
      { chiave: "sessione", icona: "sessione", titolo: "Sessione", testo: "Appunti, mappa, combattimento", link: "sessione.html" },
      { chiave: "musica-dm", icona: "musica", titolo: "Controllo musica", testo: "Spotify o YouTube", link: "controllo-musica.html" },
      { chiave: "tavolo", icona: "tavolo", titolo: "Schermo del tavolo", testo: "La mappa sulla TV", link: "tavolo.html" },
    ],
  },
  {
    id: "consulta",
    titolo: "Consulta",
    voci: [
      { chiave: "party", icona: "party", titolo: "Party e livelli", testo: "Schede e livelli", link: "dm-party.html" },
      { chiave: "glossario-equip", icona: "equipaggiamento", titolo: "Equipaggiamento", testo: "Glossario", link: "glossario-equipaggiamento.html" },
      { chiave: "glossario-incant", icona: "incantesimi", titolo: "Incantesimi", testo: "Glossario", link: "glossario-incantesimi.html" },
      { chiave: "personaggi", icona: "personaggi", titolo: "I miei personaggi", testo: "Se giochi anche tu", link: "i-miei-personaggi.html" },
      { chiave: "guida", icona: "guida", titolo: "Guida e FAQ", testo: "Per te e i giocatori", link: "guida.html" },
    ],
  },
];

export const GRUPPO_ADMIN = {
  id: "admin",
  titolo: "Amministrazione",
  voci: [{ chiave: "utenti", icona: "utenti", titolo: "Gestione utenti", testo: "Iscritti e ruoli", link: "admin-utenti.html" }],
};

export const GRUPPI_GIOCATORE = [
  {
    id: "giocatore",
    titolo: "I tuoi strumenti",
    voci: [
      { chiave: "sessione", icona: "sessione", titolo: "Sessione", testo: "Il tavolo di gioco", link: "sessione.html" },
      { chiave: "calendario", icona: "calendario", titolo: "Calendario", testo: "Date e disponibilità", link: "calendario.html" },
      { chiave: "archivio", icona: "archivio", titolo: "Archivio", testo: "Mappe e documenti", link: "archivio.html" },
      { chiave: "personaggi", icona: "personaggi", titolo: "I miei personaggi", testo: "Schede e ritratti", link: "i-miei-personaggi.html" },
      { chiave: "guida", icona: "guida", titolo: "Guida e FAQ", testo: "Come funziona", link: "guida.html" },
    ],
  },
];

// Ordine personalizzato (per gruppo): le voci salvate per prime, le altre in
// coda nell'ordine predefinito.
export function ordinaVoci(voci, ordineSalvato) {
  if (!ordineSalvato?.length) return voci;
  const indice = (chiave) => {
    const i = ordineSalvato.indexOf(chiave);
    return i === -1 ? ordineSalvato.length + voci.findIndex((v) => v.chiave === chiave) : i;
  };
  return [...voci].sort((a, b) => indice(a.chiave) - indice(b.chiave));
}

const plurale = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;

// La sessione da mettere in evidenza. sessioni: tutte quelle della campagna;
// inCorso: stato/sessione; proposte: le aperte con { risposte: [uid] };
// membri: quanti giocatori ci sono.
export function sessioneInEvidenza({ inCorso = null, sessioni = [], proposte = [], membri = 0, oggi = oggiIso() }) {
  if (inCorso) {
    const s = sessioni.find((x) => x.id === inCorso.sessioneAttivaId);
    return { tipo: "corso", titolo: s ? etichettaSessione(s) : "Sessione in corso", sessione: s || null };
  }
  const programmate = sessioni
    .filter((s) => s.stato === "programmata" && s.dataProgrammata && s.dataProgrammata >= oggi)
    .sort((a, b) => `${a.dataProgrammata} ${a.oraProgrammata || ""}`.localeCompare(`${b.dataProgrammata} ${b.oraProgrammata || ""}`));
  const prossima = programmate[0];
  if (prossima) {
    return {
      tipo: prossima.dataProgrammata === oggi ? "oggi" : "prossima",
      titolo: etichettaSessione(prossima),
      quando: formattaDataOra(prossima.dataProgrammata, prossima.oraProgrammata),
      ora: prossima.oraProgrammata || null,
      distanza: distanzaGiorni(prossima.dataProgrammata),
      sessione: prossima,
    };
  }
  const proposta = proposte[0];
  if (proposta) {
    const date = proposta.opzioni?.length || 0;
    return {
      tipo: "proposta",
      titolo: proposta.titolo ? `Proposta «${proposta.titolo}»` : "Date proposte",
      riga: `${plurale(date, "data proposta", "date proposte")} · hanno risposto ${proposta.risposte?.length || 0} su ${membri}`,
      proposta,
    };
  }
  return { tipo: "nessuna", titolo: "Nessuna sessione in programma" };
}

// Avvisi "Da fare" per il DM: [{ icona, testo, link, etichetta }].
// membri: profili dei giocatori (uid, nome); crediti: Map uid → livelli
// concessi in questa campagna e non ancora spesi; party: i riepiloghi (uid,
// schedaId, nomePersonaggio, livello); proposte aperte con le
// risposte; evidenza: il risultato di sessioneInEvidenza; contenutiProssima:
// quanti contenuti sono collegati alla prossima sessione; inAttesa: iscritti
// da approvare (solo admin).
export function avvisiDM({ membri = [], crediti = new Map(), party = [], proposte = [], evidenza = null, contenutiProssima = null, inAttesa = 0 }) {
  const avvisi = [];
  const riepilogo = new Map(party.map((p) => [p.uid, p]));
  if (inAttesa > 0) {
    avvisi.push({ icona: "utenti", testo: inAttesa === 1 ? "C'è un nuovo iscritto da approvare." : `Ci sono ${inAttesa} nuovi iscritti da approvare.`, link: "admin-utenti.html", etichetta: "Utenti" });
  }
  for (const m of membri) {
    const pg = riepilogo.get(m.uid);
    const nome = m.nome || "Un giocatore";
    if (!pg?.schedaId) {
      avvisi.push({ icona: "personaggi", testo: `${nome} non ha ancora un personaggio attivo.`, link: "campagna.html#giocatori", etichetta: "Giocatori" });
    } else if ((crediti.get(m.uid) || 0) > 0) {
      const chi = pg.nomePersonaggio || nome;
      avvisi.push({ icona: "livello", testo: `${chi} deve completare il passaggio al ${(pg.livello || 1) + crediti.get(m.uid)}° livello.`, link: "dm-party.html", etichetta: "Party" });
    }
  }
  for (const p of proposte) {
    const mancano = membri.filter((m) => !(p.risposte || []).includes(m.uid)).map((m) => m.nome || "un giocatore");
    if (mancano.length) {
      const nomi = mancano.length <= 2 ? mancano.join(" e ") : `${mancano.length} giocatori`;
      avvisi.push({ icona: "calendario", testo: `${nomi} ${mancano.length === 1 ? "non ha" : "non hanno"} risposto alle date${p.titolo ? ` di «${p.titolo}»` : ""}.`, link: "calendario.html", etichetta: "Calendario" });
    }
  }
  if (evidenza && (evidenza.tipo === "oggi" || evidenza.tipo === "prossima") && contenutiProssima === 0) {
    avvisi.push({ icona: "libreria", testo: `Nessun contenuto collegato alla ${evidenza.titolo}.`, link: "campagna.html#sessioni", etichetta: "Contenuti" });
  }
  return avvisi;
}

// Avvisi del giocatore. crediti: livelli concessi dal DM in questa campagna e
// non ancora spesi (si spendono con la scheda attiva).
export function avvisiGiocatore({ crediti = 0, scheda = null, daRispondere = 0 }) {
  const avvisi = [];
  if (!scheda) avvisi.push({ icona: "personaggi", testo: "Non hai ancora un personaggio attivo in questa campagna.", link: "i-miei-personaggi.html", etichetta: "Crealo" });
  if (scheda && crediti > 0) {
    avvisi.push({ icona: "livello", testo: `Sei salito di livello: completa il passaggio al ${(scheda.livello || 1) + 1}° dalla scheda.`, link: `scheda-personaggio.html?id=${encodeURIComponent(scheda.id)}&livello=1`, etichetta: "Scheda" });
  }
  if (daRispondere > 0) {
    avvisi.push({ icona: "calendario", testo: daRispondere === 1 ? "Il DM ha proposto delle date: segna quando puoi esserci." : `Ci sono ${daRispondere} proposte di date a cui rispondere.`, link: "calendario.html", etichetta: "Rispondi" });
  }
  return avvisi;
}

// Barra dei PF: percentuale e colore come nel resto del sito.
export function barraPf(hp) {
  if (!hp?.massimi) return { quota: 0, colore: "#3f8f5a" };
  const quota = Math.max(0, Math.min(1, (hp.attuali || 0) / hp.massimi));
  return { quota, colore: quota > 0.5 ? "#3f8f5a" : quota > 0.25 ? "#c98a27" : "#b8323f" };
}

export function testoPf(hp) {
  if (!hp?.massimi) return "";
  return `${hp.attuali ?? 0}/${hp.massimi}${hp.temporanei ? ` (+${hp.temporanei})` : ""}`;
}
