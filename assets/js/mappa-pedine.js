// Pedine sulla mappa della sessione: dati da disegnare presi dal riepilogo
// del party (personaggi: ritratto, PF, condizioni) o dal tracker (nemici:
// salute, condizioni, PF solo per il DM), posizione presa dai documenti delle
// pedine. Condiviso da pagina Sessione e schermo del tavolo.
import { CONDIZIONI } from "./dati-srd.js";
import { urlImmagine, percorsiRitratto, percorsiImmagineCampagna } from "./immagini.js";
import { caselleTaglia, pedinaSottoNebbia } from "./mappa-calcoli.js";

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

// URL delle immagini già scaricate; "aggiorna" viene chiamato quando
// un'immagine nuova è pronta, per ridisegnare. Le immagini che non si possono
// leggere restano senza (pedina con le iniziali o l'icona generica).
function creaCacheUrl(aggiorna) {
  const pronti = new Map();
  const richiesti = new Set();
  return (percorso) => {
    if (!percorso) return null;
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

export function creaCacheRitratti(aggiorna) {
  const url = creaCacheUrl(aggiorna);
  return (riepilogo) =>
    riepilogo.ritratto && riepilogo.schedaId ? url(percorsiRitratto(riepilogo.uid, riepilogo.schedaId, riepilogo.ritratto).grande) : null;
}

// Immagini della Libreria (miniatura) per i nemici.
export function creaCacheImmagini(campagnaId, aggiorna) {
  const url = creaCacheUrl(aggiorna);
  return (immagineId) => (immagineId ? url(percorsiImmagineCampagna(campagnaId, immagineId).mini) : null);
}

// Salute vaga dei nemici, come barra: quanto è piena e di che colore.
const BARRA_SALUTE = { illeso: 1, ferito: 0.66, grave: 0.33, "a terra": 0 };

// ID del combattente di turno → ID della pedina (i personaggi sono "pg-{uid}").
export function pedinaDiTurno(stato) {
  if (!stato?.attivo || !(stato.round > 0) || !stato.turno) return null;
  return stato.turno.startsWith("pg-") ? stato.turno.slice(3) : stato.turno;
}

// Pedine da disegnare: personaggi (di membri con un personaggio attivo nel
// party) e nemici. "combattimento": { stato, combattenti } del tracker;
// "perDM": PF veri e pedine nascoste. "nebbia": i nemici sotto la nebbia non
// li vedono i giocatori (il DM sì, segnati); i personaggi si vedono sempre.
// "comeGiocatori": il DM guarda la mappa come la vedono i giocatori.
export function costruisciPedine({
  party, pedine, combattimento = null, mioUid = null, perDM = false, ritratto = () => null, immagine = () => null,
  nebbia = null, comeGiocatori = false,
}) {
  const vedeTutto = perDM && !comeGiocatori;
  const turno = pedinaDiTurno(combattimento?.stato);
  const combattenti = new Map((combattimento?.combattenti || []).map((c) => [c.id, c]));
  const giocatori = pedineDaParty({ party, pedine: pedine.filter((p) => p.tipo !== "nemico"), mioUid, ritratto });
  const nemici = pedine
    .filter((p) => p.tipo === "nemico")
    .map((p) => ({ p, sotto: pedinaSottoNebbia(nebbia, p, caselleTaglia(p.taglia)) }))
    .filter(({ p, sotto }) => vedeTutto || (!p.nascosta && !sotto))
    .map(({ p, sotto }) => {
      const c = combattenti.get(p.id);
      const salute = c?.salute || p.salute || "illeso";
      const pf = perDM && c?.dm?.pfMassimi > 0 ? c.dm.pfAttuali / c.dm.pfMassimi : null;
      return {
        id: p.id,
        c: p.c,
        r: p.r,
        caselle: caselleTaglia(p.taglia),
        nome: p.nome,
        iniziali: (p.nome.match(/\d+$/) || [p.nome.slice(0, 2)])[0],
        ritrattoUrl: immagine(p.immagineId),
        quotaPf: pf ?? BARRA_SALUTE[salute] ?? 1,
        aTerra: salute === "a terra",
        condizioni: bolliniCondizioni(c?.condizioni || p.condizioni || []),
        nemico: true,
        nascosta: Boolean(p.nascosta),
        nellaNebbia: sotto,
        inTracker: Boolean(c),
      };
    });
  return [...giocatori, ...nemici].map((p) => ({ ...p, diTurno: p.id === turno }));
}

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
