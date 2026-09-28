// Tracker di iniziativa e combattimento (pannello della pagina Sessione).
// Il DM avvia il combattimento (entrano i personaggi attivi del party),
// aggiunge i nemici, corregge l'ordine e fa avanzare i turni; ogni giocatore
// tira o scrive l'iniziativa del proprio personaggio. Tutti vedono in tempo
// reale l'ordine, il round e di chi è il turno; dei nemici i giocatori vedono
// solo una salute vaga (i PF restano al DM, vedi firestore.rules).
import {
  ascoltaCombattimento,
  avviaCombattimento,
  aggiungiNemici,
  impostaIniziativa,
  impostaSpareggi,
  aggiornaPfNemico,
  impostaTurno,
  rimuoviCombattente,
  terminaCombattimento,
  ottieniSchedaAttiva,
  tiraD20,
} from "./auth.js";
import { mostraImmagine, percorsiRitratto, percorsiImmagineCampagna } from "./immagini.js";
import { creaElemento } from "./contenuti.js";
import { CLASSI } from "./dati-srd.js";

const SALUTE = {
  illeso: "Illeso",
  ferito: "Ferito",
  grave: "Gravemente ferito",
  "a terra": "A terra",
};

// Ordine dei turni: iniziativa più alta prima; a pari iniziativa decide lo
// spareggio scelto dal DM, poi il bonus, poi il nome. Chi non ha ancora
// l'iniziativa va in fondo.
export function ordinaCombattenti(elenco) {
  const valore = (c) => (c.iniziativa == null ? -Infinity : c.iniziativa);
  return [...elenco].sort((a, b) =>
    valore(b) - valore(a)
    || (b.spareggio || 0) - (a.spareggio || 0)
    || (b.bonus || 0) - (a.bonus || 0)
    || a.nome.localeCompare(b.nome, "it"));
}

const modificatore = (punteggio) => Math.floor(((punteggio ?? 10) - 10) / 2);
const conSegno = (n) => (n >= 0 ? `+${n}` : `${n}`);

export function montaCombattimento({ pannello, campagnaId, uid, isDM, party, libreria, avviso }) {
  const elenco = creaElemento("ol", "lista-combattimento");
  const intestazione = creaElemento("div", "sessione-appunti-intestazione");
  const titolo = creaElemento("h3", null, "Combattimento");
  const comandi = creaElemento("div", "azioni-intestazione comandi-combattimento");
  intestazione.append(titolo, comandi);
  const sottotitolo = creaElemento("p", "combattimento-sottotitolo");
  const bannerTurno = creaElemento("div", "banner-turno", "Tocca a te!");
  bannerTurno.hidden = true;
  const vuoto = creaElemento("p", "scheda-testo-libero", "Nessun combattimento in corso.");
  pannello.replaceChildren(intestazione, sottotitolo, bannerTurno, elenco, vuoto);

  let stato = { attivo: false, round: 0, turno: null };
  let combattenti = [];
  let ordinati = [];
  const righe = new Map();
  let bonusMio = null;
  let turnoPrecedente = null;
  let eraAttivo = null;

  const bottone = (testo, classe = "btn-tabella") => {
    const b = creaElemento("button", classe, testo);
    b.type = "button";
    return b;
  };

  async function esegui(bottoni, azione) {
    bottoni.forEach((b) => (b.disabled = true));
    try {
      await azione();
    } catch (errore) {
      console.error(errore);
      avviso("Operazione non riuscita.", true);
    } finally {
      bottoni.forEach((b) => (b.disabled = false));
    }
  }

  // ---------- Comandi del DM ----------
  const btnAvvia = bottone("Avvia combattimento", "btn-tabella btn-tabella-evidenza");
  const btnPrecedente = bottone("◀");
  btnPrecedente.title = "Turno precedente";
  btnPrecedente.setAttribute("aria-label", "Turno precedente");
  const btnSuccessivo = bottone("Turno successivo ▶", "btn-tabella btn-tabella-evidenza");
  const btnTermina = bottone("Termina", "btn-tabella btn-tabella-pericolo");

  let formNemici = null;
  if (isDM) {
    comandi.append(btnAvvia, btnPrecedente, btnSuccessivo, btnTermina);
    formNemici = creaFormNemici();
    pannello.append(formNemici);

    btnAvvia.addEventListener("click", () => esegui([btnAvvia], async () => {
      const personaggi = party()
        .filter((r) => r.schedaId)
        .map((r) => ({ uid: r.uid, nome: r.nomePersonaggio || r.nomeGiocatore }));
      await avviaCombattimento(campagnaId, personaggi);
    }));
    btnSuccessivo.addEventListener("click", () => esegui([btnSuccessivo, btnPrecedente], () => avanza(1)));
    btnPrecedente.addEventListener("click", () => esegui([btnSuccessivo, btnPrecedente], () => avanza(-1)));
    btnTermina.addEventListener("click", () => {
      if (!confirm("Terminare il combattimento? L'elenco dei combattenti verrà svuotato.")) return;
      esegui([btnTermina], () => terminaCombattimento(campagnaId));
    });
  }

  function avanza(verso) {
    if (ordinati.length === 0) return Promise.resolve();
    const indice = ordinati.findIndex((c) => c.id === stato.turno);
    // Prima mossa: si parte dal primo, round 1.
    if (stato.round === 0 || indice === -1) {
      if (verso < 0) return Promise.resolve();
      return impostaTurno(campagnaId, Math.max(1, stato.round), ordinati[0].id);
    }
    let nuovo = indice + verso;
    let round = stato.round;
    if (nuovo >= ordinati.length) {
      nuovo = 0;
      round += 1;
    } else if (nuovo < 0) {
      if (round <= 1) return Promise.resolve();
      nuovo = ordinati.length - 1;
      round -= 1;
    }
    return impostaTurno(campagnaId, round, ordinati[nuovo].id);
  }

  function creaFormNemici() {
    const dettagli = creaElemento("details", "form-nemici");
    const riassunto = creaElemento("summary", null, "Aggiungi nemici");
    const form = document.createElement("form");
    form.innerHTML = `
      <div class="griglia-form-nemici">
        <label>Nome<input type="text" name="nome" maxlength="50" required placeholder="Es. Goblin" /></label>
        <label>Quanti<input type="number" name="quantita" min="1" max="20" value="1" required /></label>
        <label>Bonus iniz.<input type="number" name="bonus" min="-10" max="20" value="0" /></label>
        <label>PF<input type="number" name="pf" min="0" max="9999" value="7" /></label>
        <label>Iniziativa<input type="number" name="iniziativa" min="-20" max="99" placeholder="vuoto = tiro" /></label>
        <label class="campo-largo">Immagine dalla Libreria<select name="immagine"><option value="">Nessuna</option></select></label>
      </div>
      <label class="checkbox-scudo"><input type="checkbox" name="comune" checked /> Stessa iniziativa per tutti</label>
      <button type="submit" class="btn-tabella btn-tabella-evidenza">Aggiungi</button>
    `;
    const selectImmagine = form.querySelector('select[name="immagine"]');
    // Elenco delle immagini aggiornato a ogni apertura (nemici e PNG prima).
    dettagli.addEventListener("toggle", () => {
      if (!dettagli.open) return;
      const scelta = selectImmagine.value;
      selectImmagine.length = 1;
      const peso = (c) => (c.categoria === "nemico" ? 0 : c.categoria === "png" ? 1 : 2);
      [...libreria()]
        .sort((a, b) => peso(a) - peso(b) || a.titolo.localeCompare(b.titolo, "it"))
        .forEach((c) => selectImmagine.add(new Option(c.titolo, c.id)));
      selectImmagine.value = scelta;
    });
    form.addEventListener("submit", (evento) => {
      evento.preventDefault();
      const dati = new FormData(form);
      const nome = String(dati.get("nome")).trim();
      if (!nome) return;
      const numero = (campo, predefinito) => {
        const v = String(dati.get(campo) ?? "").trim();
        return v === "" ? predefinito : Math.trunc(Number(v));
      };
      const pf = Math.max(0, numero("pf", 0));
      const invia = form.querySelector('button[type="submit"]');
      esegui([invia], async () => {
        await aggiungiNemici(campagnaId, {
          nome,
          quantita: Math.min(20, Math.max(1, numero("quantita", 1))),
          bonus: numero("bonus", 0),
          pfMassimi: pf,
          iniziativa: numero("iniziativa", null),
          iniziativaComune: dati.get("comune") === "on",
          immagineId: dati.get("immagine") || null,
        });
        form.reset();
      });
    });
    dettagli.append(riassunto, form);
    return dettagli;
  }

  // ---------- Righe ----------
  function creaRiga(c) {
    const li = creaElemento("li", "riga-combattente");
    li.dataset.id = c.id;
    const posizione = creaElemento("span", "combattente-posizione");
    const avatar = creaElemento("span", "party-avatar combattente-avatar");
    const img = document.createElement("img");
    img.className = "party-ritratto";
    img.alt = "";
    img.hidden = true;
    const classe = c.tipo === "pg" ? CLASSI[party().find((x) => x.uid === c.uid)?.classe] : null;
    const icona = creaElemento("span", "combattente-icona", c.tipo === "pg" ? classe?.icona || "🛡️" : "💀");
    avatar.append(img, icona);
    caricaAvatar(c, img, icona);

    const info = creaElemento("div", "combattente-info");
    info.append(creaElemento("div", "combattente-nome"), creaElemento("div", "party-sessione-sub combattente-sub"));
    if (isDM && c.tipo === "nemico") info.append(creaEditorPf(c));

    const iniziativa = creaElemento("div", "combattente-iniziativa");
    const valore = creaElemento("span", "valore-iniziativa");
    iniziativa.append(valore);
    const modificabile = isDM || (c.tipo === "pg" && c.uid === uid);
    if (modificabile) {
      const input = document.createElement("input");
      input.type = "number";
      input.min = "-20";
      input.max = "99";
      input.className = "input-iniziativa";
      input.setAttribute("aria-label", `Iniziativa di ${c.nome}`);
      input.addEventListener("change", () => {
        const v = input.value.trim();
        if (v === "") return;
        esegui([input], () => impostaIniziativa(campagnaId, c.id, Math.trunc(Number(v))));
      });
      const tira = bottone("🎲", "btn-tabella btn-tira");
      tira.title = "Tira d20 + bonus";
      tira.setAttribute("aria-label", `Tira l'iniziativa per ${c.nome}`);
      tira.addEventListener("click", () => esegui([tira], async () => {
        const attuale = combattenti.find((x) => x.id === c.id);
        const bonus = c.tipo === "pg" && c.uid === uid ? await bonusPersonaggio() : attuale?.bonus || 0;
        const tiro = tiraD20();
        await impostaIniziativa(campagnaId, c.id, tiro + bonus, bonus);
        avviso(`${c.nome}: ${tiro} ${conSegno(bonus)} = ${tiro + bonus}`);
      }));
      iniziativa.replaceChildren(input, tira);
    }

    const azioni = creaElemento("div", "combattente-azioni");
    if (isDM) {
      const su = bottone("▲", "btn-tabella btn-spareggio");
      su.title = "Prima, a pari iniziativa";
      su.setAttribute("aria-label", `Sposta ${c.nome} prima`);
      const giu = bottone("▼", "btn-tabella btn-spareggio");
      giu.title = "Dopo, a pari iniziativa";
      giu.setAttribute("aria-label", `Sposta ${c.nome} dopo`);
      const togli = bottone("×", "btn-rimuovi-talento");
      togli.title = "Togli dal combattimento";
      togli.setAttribute("aria-label", `Togli ${c.nome}`);
      su.addEventListener("click", () => esegui([su, giu], () => spareggio(c.id, -1)));
      giu.addEventListener("click", () => esegui([su, giu], () => spareggio(c.id, 1)));
      togli.addEventListener("click", () => {
        if (!confirm(`Togliere ${c.nome} dal combattimento?`)) return;
        esegui([togli], () => {
          let turnoDopo;
          if (stato.turno === c.id) {
            const altri = ordinati.filter((x) => x.id !== c.id);
            const indice = ordinati.findIndex((x) => x.id === c.id);
            turnoDopo = altri.length ? altri[indice % altri.length].id : null;
          }
          return rimuoviCombattente(campagnaId, c.id, turnoDopo);
        });
      });
      azioni.append(su, giu, togli);
    }

    li.append(posizione, avatar, info, iniziativa, azioni);
    return li;
  }

  function caricaAvatar(c, img, icona) {
    let percorso = null;
    if (c.tipo === "pg") {
      const r = party().find((x) => x.uid === c.uid);
      if (r?.ritratto && r.schedaId) percorso = percorsiRitratto(r.uid, r.schedaId, r.ritratto).icona;
    } else if (c.immagineId) {
      percorso = percorsiImmagineCampagna(campagnaId, c.immagineId).mini;
    }
    if (!percorso) return;
    // Per i giocatori l'immagine di un nemico si vede solo se il DM l'ha
    // mostrata o archiviata per loro; altrimenti resta l'icona.
    mostraImmagine(img, percorso, { silenzioso: true }).then(() => {
      icona.hidden = !img.hidden;
    });
  }

  function creaEditorPf(c) {
    const box = creaElemento("div", "editor-pf");
    const attuali = document.createElement("input");
    attuali.type = "number";
    attuali.className = "input-pf-nemico";
    attuali.setAttribute("aria-label", `PF attuali di ${c.nome}`);
    const massimi = creaElemento("span", "pf-massimi");
    const danno = document.createElement("input");
    danno.type = "number";
    danno.min = "0";
    danno.placeholder = "±";
    danno.className = "input-pf-nemico";
    danno.setAttribute("aria-label", `Danni o cure per ${c.nome}`);
    const colpisci = bottone("−", "btn-tabella");
    colpisci.title = "Sottrai (danno)";
    const cura = bottone("+", "btn-tabella");
    cura.title = "Aggiungi (cura)";
    const salva = (nuovi) => {
      const dm = combattenti.find((x) => x.id === c.id)?.dm;
      if (!dm) return;
      const pf = Math.max(-999, Math.min(9999, nuovi));
      esegui([colpisci, cura, attuali], () => aggiornaPfNemico(campagnaId, c.id, pf, dm.pfMassimi));
    };
    attuali.addEventListener("change", () => {
      if (attuali.value.trim() !== "") salva(Math.trunc(Number(attuali.value)));
    });
    const applica = (segno) => {
      const quanto = Math.trunc(Number(danno.value));
      const dm = combattenti.find((x) => x.id === c.id)?.dm;
      if (!quanto || !dm) return;
      danno.value = "";
      salva(dm.pfAttuali + segno * quanto);
    };
    colpisci.addEventListener("click", () => applica(-1));
    cura.addEventListener("click", () => applica(1));
    box.append(creaElemento("span", "etichetta-pf", "PF"), attuali, massimi, danno, colpisci, cura);
    return box;
  }

  async function bonusPersonaggio() {
    if (bonusMio != null) return bonusMio;
    try {
      const scheda = await ottieniSchedaAttiva(uid, campagnaId);
      bonusMio = modificatore(scheda?.caratteristiche?.destrezza);
    } catch (errore) {
      console.error(errore);
      bonusMio = 0;
    }
    return bonusMio;
  }

  // Spareggio: sposta il combattente prima/dopo il vicino con la stessa iniziativa.
  function spareggio(id, verso) {
    const indice = ordinati.findIndex((c) => c.id === id);
    const vicino = ordinati[indice + verso];
    if (!vicino || vicino.iniziativa !== ordinati[indice].iniziativa) return Promise.resolve();
    const gruppo = ordinati.filter((c) => c.iniziativa === ordinati[indice].iniziativa).map((c) => c.id);
    const a = gruppo.indexOf(id);
    const b = gruppo.indexOf(vicino.id);
    [gruppo[a], gruppo[b]] = [gruppo[b], gruppo[a]];
    return impostaSpareggi(campagnaId, gruppo);
  }

  function aggiornaRiga(li, c, indice) {
    const diTurno = stato.turno === c.id && stato.round > 0;
    li.classList.toggle("di-turno", diTurno);
    li.classList.toggle("mio", c.tipo === "pg" && c.uid === uid);
    li.classList.toggle("a-terra", c.salute === "a terra");
    li.querySelector(".combattente-posizione").textContent = diTurno ? "▶" : String(indice + 1);
    li.querySelector(".combattente-nome").textContent = c.nome;

    let sotto;
    if (c.tipo === "pg") {
      const r = party().find((x) => x.uid === c.uid);
      sotto = r?.nomeGiocatore ? `Giocatore: ${r.nomeGiocatore}` : "Personaggio";
    } else if (isDM && c.dm) {
      sotto = `Nemico · ${SALUTE[c.salute] || "Illeso"}`;
    } else {
      sotto = SALUTE[c.salute] || "Nemico";
    }
    const sub = li.querySelector(".combattente-sub");
    sub.textContent = sotto;
    sub.dataset.salute = c.tipo === "nemico" ? c.salute || "illeso" : "";

    const input = li.querySelector(".input-iniziativa");
    const valore = li.querySelector(".valore-iniziativa");
    if (input) {
      if (document.activeElement !== input) input.value = c.iniziativa ?? "";
      input.placeholder = "—";
    } else if (valore) {
      valore.textContent = c.iniziativa ?? "—";
    }

    if (isDM && c.tipo === "nemico" && c.dm) {
      const [attuali] = li.querySelectorAll(".input-pf-nemico");
      if (document.activeElement !== attuali) attuali.value = c.dm.pfAttuali;
      li.querySelector(".pf-massimi").textContent = `/ ${c.dm.pfMassimi}`;
    }
    if (isDM) {
      const pari = (altro) => altro && altro.iniziativa === c.iniziativa && c.iniziativa != null;
      const [su, giu] = li.querySelectorAll(".btn-spareggio");
      su.hidden = !pari(ordinati[indice - 1]);
      giu.hidden = !pari(ordinati[indice + 1]);
    }
  }

  function render() {
    ordinati = ordinaCombattenti(combattenti);
    const attivo = stato.attivo;
    pannello.hidden = !isDM && !attivo;
    elenco.hidden = !attivo;
    vuoto.hidden = attivo;

    if (!attivo) {
      sottotitolo.textContent = "";
    } else if (stato.round === 0) {
      sottotitolo.textContent = "In preparazione: tirate l'iniziativa.";
    } else {
      const diTurno = ordinati.find((c) => c.id === stato.turno);
      sottotitolo.textContent = `Round ${stato.round}${diTurno ? ` · turno di ${diTurno.nome}` : ""}`;
    }

    if (isDM) {
      btnAvvia.hidden = attivo;
      btnPrecedente.hidden = !attivo || stato.round === 0;
      btnSuccessivo.hidden = !attivo;
      btnSuccessivo.textContent = stato.round === 0 ? "Inizia ▶" : "Turno successivo ▶";
      btnTermina.hidden = !attivo;
      formNemici.hidden = !attivo;
    }

    // Righe: create una volta, aggiornate sul posto (non si perde quello che
    // si sta scrivendo), riordinate spostandole.
    const presenti = new Set(ordinati.map((c) => c.id));
    righe.forEach((li, id) => {
      if (!presenti.has(id)) {
        li.remove();
        righe.delete(id);
      }
    });
    ordinati.forEach((c, indice) => {
      let li = righe.get(c.id);
      if (!li) {
        li = creaRiga(c);
        righe.set(c.id, li);
      }
      aggiornaRiga(li, c, indice);
      elenco.append(li);
    });

    // Avvisi per il giocatore: inizio combattimento e proprio turno.
    const mioTurno = attivo && stato.round > 0 && ordinati.find((c) => c.id === stato.turno)?.uid === uid;
    bannerTurno.hidden = !mioTurno;
    if (!isDM && eraAttivo === false && attivo) avviso("Combattimento! Tira l'iniziativa.");
    if (!isDM && mioTurno && turnoPrecedente !== `${stato.round}:${stato.turno}`) avviso("Tocca a te!");
    eraAttivo = attivo;
    turnoPrecedente = `${stato.round}:${stato.turno}`;
  }

  return ascoltaCombattimento(campagnaId, isDM, (dati) => {
    stato = dati.stato;
    combattenti = dati.combattenti;
    render();
  }, (errore) => console.error(errore));
}
