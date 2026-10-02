// Pedine dei personaggi sulla mappa della sessione: dati da disegnare
// (ritratto, PF, condizioni) presi dal riepilogo del party, e posizione presa
// dai documenti delle pedine. Condiviso da pagina Sessione e schermo del tavolo.
import { CONDIZIONI } from "./dati-srd.js";
import { urlImmagine, percorsiRitratto } from "./immagini.js";

const NOMI_CONDIZIONI = new Map(CONDIZIONI.map((c) => [c.chiave, c.nome]));

// Sigla e colore del bollino di ogni condizione sulla pedina.
const BOLLINI = {
  accecato: ["Ac", "#5a5a66"],
  affascinato: ["Af", "#b0477e"],
  afferrato: ["Ag", "#8a6a3a"],
  assordato: ["As", "#5a5a66"],
  avvelenato: ["Av", "#3f7a2f"],
  incapacitato: ["In", "#7a1f2b"],
  invisibile: ["Iv", "#3a6a8a"],
  paralizzato: ["Pa", "#a5293a"],
  pietrificato: ["Pt", "#6f6f68"],
  "privo-di-sensi": ["PS", "#7a1f2b"],
  prono: ["Pr", "#8a6a3a"],
  spaventato: ["Sp", "#7a4fa8"],
  stordito: ["St", "#a86a1f"],
  trattenuto: ["Tr", "#8a6a3a"],
};

export function bolliniCondizioni(condizioni = [], esaurimento = 0) {
  const bollini = condizioni
    .filter((c) => BOLLINI[c])
    .map((c) => ({ sigla: BOLLINI[c][0], colore: BOLLINI[c][1], nome: NOMI_CONDIZIONI.get(c) || c }));
  if (esaurimento > 0) bollini.push({ sigla: `E${esaurimento}`, colore: "#4a3624", nome: `Esaurimento ${esaurimento}` });
  return bollini;
}

const iniziali = (nome = "") => nome.trim().slice(0, 2) || "?";

// URL dei ritratti già scaricati (per uid); "aggiorna" viene chiamato quando
// un ritratto nuovo è pronto, per ridisegnare.
export function creaCacheRitratti(aggiorna) {
  const pronti = new Map();
  const richiesti = new Set();
  return (riepilogo) => {
    if (!riepilogo.ritratto || !riepilogo.schedaId) return null;
    const percorso = percorsiRitratto(riepilogo.uid, riepilogo.schedaId, riepilogo.ritratto).grande;
    if (pronti.has(percorso)) return pronti.get(percorso);
    if (!richiesti.has(percorso)) {
      richiesti.add(percorso);
      urlImmagine(percorso)
        .then((url) => {
          pronti.set(percorso, url);
          aggiorna();
        })
        .catch(() => {});
    }
    return null;
  };
}

// Pedine da disegnare: una per ogni documento di pedina di un membro che ha
// un personaggio attivo nel party.
export function pedineDaParty({ party, pedine, mioUid = null, ritratto = () => null }) {
  const perUid = new Map(party.filter((r) => r.schedaId).map((r) => [r.uid, r]));
  return pedine
    .filter((p) => perUid.has(p.uid || p.id))
    .map((p) => {
      const r = perUid.get(p.uid || p.id);
      const massimi = r.hp?.massimi || 0;
      const attuali = r.hp?.attuali ?? massimi;
      return {
        id: p.id,
        c: p.c,
        r: p.r,
        nome: r.nomePersonaggio || r.nomeGiocatore || "Personaggio",
        iniziali: iniziali(r.nomePersonaggio || r.nomeGiocatore),
        ritrattoUrl: ritratto(r),
        quotaPf: massimi > 0 ? attuali / massimi : null,
        aTerra: massimi > 0 && attuali <= 0,
        condizioni: bolliniCondizioni(r.condizioni, r.esaurimento),
        mia: (p.uid || p.id) === mioUid,
      };
    });
}
