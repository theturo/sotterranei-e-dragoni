// Finestra con la scheda di una creatura del bestiario, aperta durante il
// combattimento dal tracker o dalla pedina sulla mappa (solo DM). I tiri vanno
// nel registro della sessione in corso, nascosti ai giocatori a meno che il DM
// non li renda visibili (la scelta vale anche nella pagina Bestiario).
// I mostri del SRD si caricano solo quando servono (il file è grande).
import { ottieniCreatura, sessioneInCorso, aggiungiTiro } from "./auth.js";
import { creaElemento } from "./contenuti.js";
import { elementoIcona } from "./icone.js";
import { creaBloccoStatistiche } from "./bestiario-scheda.js";
import { descrizioneTipo, tiraAzione } from "./bestiario-calcoli.js";

const CHIAVE_VISIBILI = "sed-bestiario-tiri-visibili";
let catalogo = null;

export function caricaMostriSrd() {
  catalogo ??= import("./mostri-srd.js").then((m) => m.MOSTRI.map((x) => ({ ...x, id: `srd:${x.chiave}`, fonte: "srd", indole: "ostile" })));
  return catalogo;
}

// rif: { fonte: "srd" | "dm", id } (id = chiave SRD o ID del bestiario).
export async function trovaCreatura(campagnaId, rif) {
  if (!rif) return null;
  if (rif.fonte === "srd") return (await caricaMostriSrd()).find((m) => m.chiave === rif.id) || null;
  return ottieniCreatura(campagnaId, rif.id);
}

const leggiVisibili = () => {
  try {
    return localStorage.getItem(CHIAVE_VISIBILI) === "1";
  } catch {
    return false;
  }
};

// nome: quello del combattente (es. "Goblin 2"); utente: { uid, nome }.
export async function apriSchedaCreatura({ campagnaId, rif, nome, utente, avviso = () => {} }) {
  const creatura = await trovaCreatura(campagnaId, rif);
  if (!creatura) {
    avviso("Scheda non trovata nel bestiario.", true);
    return;
  }
  const sfondo = creaElemento("div", "modal-overlay");
  const finestra = creaElemento("div", "modal-card finestra-creatura");
  finestra.setAttribute("role", "dialog");
  finestra.setAttribute("aria-modal", "true");
  finestra.setAttribute("aria-label", `Scheda: ${nome || creatura.nome}`);
  const chiudi = creaElemento("button", "btn-tabella finestra-creatura-chiudi", "Chiudi");
  chiudi.type = "button";
  const testa = creaElemento("div", "finestra-creatura-testa");
  const titoli = creaElemento("div");
  titoli.append(
    creaElemento("h2", null, nome || creatura.nome),
    creaElemento("p", "bestiario-sottotitolo", `${nome && nome !== creatura.nome ? `${creatura.nome} · ` : ""}${descrizioneTipo(creatura)}`),
  );
  testa.append(titoli, chiudi);
  const etichetta = creaElemento("label", "checkbox-scudo");
  const visibili = creaElemento("input");
  visibili.type = "checkbox";
  visibili.checked = leggiVisibili();
  visibili.addEventListener("change", () => {
    try {
      localStorage.setItem(CHIAVE_VISIBILI, visibili.checked ? "1" : "0");
    } catch {
      // Solo una comodità.
    }
  });
  etichetta.append(visibili, document.createTextNode(" Tiri visibili ai giocatori"));
  const tiri = creaElemento("ul", "bestiario-tiri-elenco");
  const conNome = { ...creatura, nome: nome || creatura.nome };
  const tira = async (azione) => {
    const { testo, tiro } = tiraAzione(conNome, azione);
    const li = creaElemento("li", null, testo);
    tiri.prepend(li);
    try {
      const sessione = await sessioneInCorso(campagnaId);
      if (!sessione) return;
      await aggiungiTiro(sessione.id, utente.uid, utente.nome, testo, tiro, !visibili.checked);
      const tag = creaElemento("span", `bestiario-tag${visibili.checked ? " visibile" : ""}`);
      tag.append(elementoIcona(visibili.checked ? "occhio" : "lucchetto"), visibili.checked ? "a tutti" : "solo DM");
      li.append(tag);
    } catch (errore) {
      console.error(errore);
      avviso("Impossibile scrivere il tiro nel registro.", true);
    }
  };
  const corpo = creaElemento("div", "finestra-creatura-corpo");
  corpo.append(creaBloccoStatistiche(creatura, { onTira: tira }));
  if (creatura.note) {
    const note = creaElemento("div", "bestiario-note");
    note.append(creaElemento("b", null, "Note del DM: "), document.createTextNode(creatura.note));
    corpo.append(note);
  }
  finestra.append(testa, etichetta, tiri, corpo);
  sfondo.append(finestra);
  document.body.append(sfondo);
  const prima = document.activeElement;
  const esci = () => {
    sfondo.remove();
    document.removeEventListener("keydown", tasto);
    prima?.focus?.();
  };
  const tasto = (e) => {
    if (e.key === "Escape") esci();
  };
  chiudi.addEventListener("click", esci);
  sfondo.addEventListener("click", (e) => {
    if (e.target === sfondo) esci();
  });
  document.addEventListener("keydown", tasto);
  chiudi.focus();
}
