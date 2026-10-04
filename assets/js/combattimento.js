// Tracker di iniziativa e combattimento (pannello della pagina Sessione).
// Il DM avvia il combattimento (entrano i personaggi attivi del party),
// aggiunge i nemici, corregge l'ordine e fa avanzare i turni; ogni giocatore
// tira o scrive l'iniziativa del proprio personaggio. Tutti vedono in tempo
// reale l'ordine, il round e di chi è il turno; dei nemici i giocatori vedono
// solo una salute vaga (i PF restano al DM, vedi firestore.rules).
// I nemici possono entrare nascosti: i giocatori non li vedono finché il DM
// non li rivela (dal tracker o dalla mappa), e allora compaiono al loro posto.
// Dal bestiario: «Aggiungi nemici» compila nome, iniziativa, PF, taglia e
// immagine dalla creatura scelta; la riga ha l'icona «scheda» per aprirne la scheda con i
// tiri. Gli alleati hanno il bordo verde e tutti ne vedono i PF; i personaggi
// unici entrano con il loro stato, una volta sola (vedi terminaCombattimento).
import { ottieniSchedaAttiva } from "./dati/schede.js";
import { ascoltaBestiario } from "./dati/bestiario.js";
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
  impostaCondizioniCombattente,
  rivelaNemici,
  creatureInCombattimento,
  avvisaTurno,
} from "./dati/combattimento.js";
import { apriSchedaCreatura, caricaMostriSrd } from "./bestiario-finestra.js";
import { bonusIniziativa } from "./bestiario-calcoli.js";
import { TAGLIE } from "./mappa-calcoli.js";
import { tira as tiraDadi } from "./dadi.js";
import { mostraImmagine, percorsiRitratto, percorsiImmagineCampagna } from "./immagini.js";
import { creaElemento } from "./contenuti.js";
import { CLASSI, ICONA_CLASSE_FALLBACK } from "./dati-srd.js";
import { ICONA_MASCHERA, icona, elementoIcona } from "./icone.js";
import { creaChipCondizioni, creaEditorCondizioni } from "./condizioni.js";
import { montaTurnoAnimato } from "./turno-animato.js";

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

// registraTiro(chi, tiro): facoltativo, annota i tiri di iniziativa nel registro.
// mappaInTavola(): se c'è una mappa in tavola i nemici nuovi partono nascosti
// (si piazzano dal vassoio della mappa); senza mappa partono visibili.
export function montaCombattimento({
  pannello, campagnaId, uid, isDM, party, libreria, avviso, registraTiro = null, mappaInTavola = () => false, nomeUtente = () => null,
}) {
  const elenco = creaElemento("ol", "lista-combattimento");
  const intestazione = creaElemento("div", "sessione-appunti-intestazione");
  const titolo = creaElemento("h3", null, "Combattimento");
  const comandi = creaElemento("div", "azioni-intestazione comandi-combattimento");
  intestazione.append(titolo, comandi);
  const sottotitolo = creaElemento("p", "combattimento-sottotitolo");
  const bannerTurno = creaElemento("div", "banner-turno", "Tocca a te!");
  bannerTurno.hidden = true;
  const vuoto = creaElemento("p", "scheda-testo-libero", "Nessun combattimento in corso.");
  // Contenitore dell'elenco: ospita la cornice del turno (turno-animato.js).
  const contenitore = creaElemento("div", "lista-combattimento-contenitore");
  contenitore.append(elenco);
  pannello.replaceChildren(intestazione, sottotitolo, bannerTurno, contenitore, vuoto);
  const animazioneTurno = montaTurnoAnimato({ contenitore, sottotitolo, banner: bannerTurno });

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
  const btnPrecedente = bottone("");
  btnPrecedente.innerHTML = icona("turno-precedente");
  btnPrecedente.title = "Turno precedente";
  btnPrecedente.setAttribute("aria-label", "Turno precedente");
  const btnSuccessivo = bottone("", "btn-tabella btn-tabella-evidenza");
  // Testo del pulsante seguito dall'icona (si riscrive solo quando cambia).
  const testoSuccessivo = (testo) => {
    if (btnSuccessivo.dataset.testo === testo) return;
    btnSuccessivo.dataset.testo = testo;
    btnSuccessivo.replaceChildren(`${testo} `, elementoIcona("turno-successivo"));
  };
  testoSuccessivo("Turno successivo");
  const btnTermina = bottone("Termina", "btn-tabella btn-tabella-pericolo");
  const btnRivelaTutti = bottone("Rivela tutti");
  btnRivelaTutti.title = "Rivela ai giocatori tutti i nemici nascosti";
  // Dove si trova un combattente (i dati più recenti: può essere stato rivelato).
  const nascosto = (id) => Boolean(combattenti.find((x) => x.id === id)?.nascosto);

  let formNemici = null;
  let mieCreature = [];
  let smettiBestiario = () => {};
  if (isDM) {
    smettiBestiario = ascoltaBestiario(campagnaId, (elenco) => (mieCreature = elenco), (errore) => console.error(errore));
    comandi.append(btnAvvia, btnRivelaTutti, btnPrecedente, btnSuccessivo, btnTermina);
    btnRivelaTutti.addEventListener("click", () => esegui([btnRivelaTutti], () =>
      rivelaNemici(campagnaId, combattenti.filter((c) => c.nascosto).map((c) => c.id), true)));
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
      if (!confirm("Terminare il combattimento? L'elenco dei combattenti verrà svuotato (le pedine sulla mappa restano).")) return;
      esegui([btnTermina], () => terminaCombattimento(campagnaId));
    });
  }

  // Push «Tocca a te» al giocatore del personaggio di turno (non a sé stessi).
  function avvisaDiTurno(combattente, round) {
    if (combattente?.tipo === "pg" && combattente.uid && combattente.uid !== uid) {
      avvisaTurno(combattente.uid, { nome: combattente.nome, round });
    }
  }

  function avanza(verso) {
    if (ordinati.length === 0) return Promise.resolve();
    const indice = ordinati.findIndex((c) => c.id === stato.turno);
    // Prima mossa: si parte dal primo, round 1.
    if (stato.round === 0 || indice === -1) {
      if (verso < 0) return Promise.resolve();
      return impostaTurno(campagnaId, Math.max(1, stato.round), ordinati[0].id)
        .then(() => avvisaDiTurno(ordinati[0], Math.max(1, stato.round)));
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
    return impostaTurno(campagnaId, round, ordinati[nuovo].id)
      .then(() => verso > 0 && avvisaDiTurno(ordinati[nuovo], round));
  }

  function creaFormNemici() {
    const dettagli = creaElemento("details", "form-nemici");
    const riassunto = creaElemento("summary", null, "Aggiungi nemici");
    const form = document.createElement("form");
    form.innerHTML = `
      <label class="campo-bestiario">Dal bestiario<input type="search" name="bestiario" list="bestiario-${campagnaId}" placeholder="Cerca un mostro o una tua creatura…" autocomplete="off" /></label>
      <datalist id="bestiario-${campagnaId}"></datalist>
      <p class="nota-bestiario" hidden></p>
      <div class="griglia-form-nemici">
        <label>Nome<input type="text" name="nome" maxlength="50" required placeholder="Es. Goblin" /></label>
        <label>Quanti<input type="number" name="quantita" min="1" max="20" value="1" required /></label>
        <label>Bonus iniz.<input type="number" name="bonus" min="-10" max="20" value="0" /></label>
        <label>PF<input type="number" name="pf" min="0" max="9999" value="7" /></label>
        <label>Iniziativa<input type="number" name="iniziativa" min="-20" max="99" placeholder="vuoto = tiro" /></label>
        <label>Taglia<select name="taglia">${TAGLIE.map((t) => `<option value="${t.chiave}"${t.chiave === "media" ? " selected" : ""}>${t.nome}${t.caselle > 1 ? ` (${t.caselle}×${t.caselle})` : ""}</option>`).join("")}</select></label>
        <label class="campo-largo">Immagine dalla Libreria<select name="immagine"><option value="">Nessuna</option></select></label>
      </div>
      <label class="checkbox-scudo"><input type="checkbox" name="comune" checked /> Stessa iniziativa per tutti</label>
      <label class="checkbox-scudo"><input type="checkbox" name="nascosti" /> Nascosti finché non li riveli</label>
      <button type="submit" class="btn-tabella azione-aggiungi">Aggiungi</button>
    `;
    const selectImmagine = form.querySelector('select[name="immagine"]');
    const cercaBestiario = form.querySelector('input[name="bestiario"]');
    const elencoBestiario = form.querySelector("datalist");
    const notaBestiario = form.querySelector(".nota-bestiario");
    const invia = form.querySelector('button[type="submit"]');
    let srd = [];
    let scelta = null; // creatura del bestiario scelta (o null: a mano)
    let giaInCombattimento = new Set();
    const etichettaVoce = (c) => (c.fonte === "dm" ? `${c.nome} (tua${c.unico ? ", unica" : ""})` : `${c.nome} (SRD, GS ${c.gs})`);
    const voci = () => [...mieCreature, ...srd];
    function riempiBestiario() {
      elencoBestiario.replaceChildren(...voci().map((c) => new Option(etichettaVoce(c), etichettaVoce(c))));
    }
    function applicaScelta() {
      const testo = cercaBestiario.value.trim();
      scelta = voci().find((c) => etichettaVoce(c) === testo) || null;
      const campo = (nome) => form.elements[nome];
      campo("quantita").disabled = false;
      invia.disabled = false;
      notaBestiario.hidden = !scelta;
      if (!scelta) return;
      const unico = scelta.fonte === "dm" && scelta.unico;
      const stato = unico ? scelta.stato : null;
      campo("nome").value = scelta.nome.slice(0, 50);
      campo("bonus").value = String(bonusIniziativa(scelta));
      campo("pf").value = String(scelta.pf);
      campo("taglia").value = scelta.taglia || "media";
      if (scelta.immagineId && [...selectImmagine.options].some((o) => o.value === scelta.immagineId)) selectImmagine.value = scelta.immagineId;
      if (scelta.indole === "alleata") campo("nascosti").checked = false;
      if (unico) {
        campo("quantita").value = "1";
        campo("quantita").disabled = true;
      }
      const parti = [];
      if (scelta.indole === "alleata") parti.push("Alleato: bordo verde, i giocatori vedono i PF.");
      if (unico) parti.push(`Personaggio unico: entra con ${stato?.pfAttuali ?? scelta.pf}/${scelta.pf} PF${stato?.condizioni?.length ? " e le sue condizioni" : ""}.`);
      if (unico && giaInCombattimento.has(scelta.id)) {
        parti.push("È già in combattimento.");
        invia.disabled = true;
      }
      notaBestiario.textContent = parti.join(" ") || `PF ${scelta.pf} (media), iniziativa ${conSegno(bonusIniziativa(scelta))} dalla Destrezza.`;
    }
    cercaBestiario.addEventListener("input", applicaScelta);
    // Elenco delle immagini aggiornato a ogni apertura (nemici e PNG prima).
    dettagli.addEventListener("toggle", () => {
      if (!dettagli.open) return;
      form.querySelector('input[name="nascosti"]').checked = mappaInTavola();
      riempiBestiario();
      caricaMostriSrd().then((m) => {
        srd = m;
        riempiBestiario();
      }).catch((errore) => console.error(errore));
      creatureInCombattimento(campagnaId).then((ids) => {
        giaInCombattimento = ids;
        applicaScelta();
      }).catch((errore) => console.error(errore));
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
      const unico = scelta?.fonte === "dm" && scelta.unico;
      const daBestiario = scelta
        ? {
          creatura: { fonte: scelta.fonte, id: scelta.fonte === "srd" ? scelta.chiave : scelta.id },
          alleato: scelta.indole === "alleata",
          ...(unico ? {
            pfAttuali: Math.min(pf, scelta.stato?.pfAttuali ?? pf),
            condizioni: scelta.stato?.condizioni || [],
          } : {}),
        }
        : {};
      esegui([invia], async () => {
        await aggiungiNemici(campagnaId, {
          ...daBestiario,
          nome,
          quantita: unico ? 1 : Math.min(20, Math.max(1, numero("quantita", 1))),
          bonus: numero("bonus", 0),
          pfMassimi: pf,
          iniziativa: numero("iniziativa", null),
          iniziativaComune: dati.get("comune") === "on",
          immagineId: dati.get("immagine") || null,
          taglia: dati.get("taglia") || "media",
          nascosti: dati.get("nascosti") === "on" && !daBestiario.alleato,
        });
        if (unico) giaInCombattimento.add(scelta.id);
        scelta = null;
        notaBestiario.hidden = true;
        form.elements.quantita.disabled = false;
        form.reset();
        form.querySelector('input[name="nascosti"]').checked = mappaInTavola();
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
    const simbolo = creaElemento("span", "combattente-icona icona-classe");
    simbolo.setAttribute("aria-hidden", "true");
    // SVG fissi (dati-srd.js, icone.js), nessun dato inserito dagli utenti.
    simbolo.innerHTML = c.tipo === "pg" ? classe?.iconaSvg || ICONA_CLASSE_FALLBACK : ICONA_MASCHERA;
    avatar.append(img, simbolo);
    caricaAvatar(c, img, simbolo);

    const info = creaElemento("div", "combattente-info");
    info.append(
      creaElemento("div", "combattente-nome"),
      creaElemento("div", "party-sessione-sub combattente-sub"),
      creaElemento("div", "combattente-condizioni")
    );
    // Comandi del DM sul nemico: su computer sotto il nome, sul telefono nel
    // pannello che si apre toccando la freccia (lì la riga mostra solo "PF x/y").
    const controlli = creaElemento("div", "combattente-controlli");
    if (isDM && c.tipo === "nemico") {
      info.append(creaElemento("div", "combattente-pf-breve"));
      controlli.append(creaEditorPf(c));
      // Condizioni del nemico: le segna il DM, le vedono tutti.
      const apri = bottone("Condizioni", "btn-tabella btn-condizioni-nemico");
      apri.setAttribute("aria-expanded", "false");
      const editor = creaEditorCondizioni({
        condizioni: c.condizioni || [],
        conEsaurimento: false,
        onCambia: ({ condizioni }) => esegui([], () => impostaCondizioniCombattente(campagnaId, c.id, condizioni, nascosto(c.id))),
      });
      editor.hidden = true;
      apri.addEventListener("click", () => {
        editor.hidden = !editor.hidden;
        apri.setAttribute("aria-expanded", String(!editor.hidden));
      });
      controlli.append(apri, editor);
    }

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
        esegui([input], () => impostaIniziativa(campagnaId, c.id, Math.trunc(Number(v)), undefined, nascosto(c.id)));
      });
      const tira = bottone("", "btn-tabella btn-tira");
      tira.innerHTML = icona("dado");
      tira.title = "Tira d20 + bonus";
      tira.setAttribute("aria-label", `Tira l'iniziativa per ${c.nome}`);
      tira.addEventListener("click", () => esegui([tira], async () => {
        const attuale = combattenti.find((x) => x.id === c.id);
        const bonus = c.tipo === "pg" && c.uid === uid ? await bonusPersonaggio() : attuale?.bonus || 0;
        const tiro = tiraDadi({ etichetta: "Iniziativa", modificatore: bonus });
        await impostaIniziativa(campagnaId, c.id, tiro.totale, bonus, nascosto(c.id));
        avviso(`${c.nome}: ${tiro.dadi[0]} ${conSegno(bonus)} = ${tiro.totale}`);
        registraTiro?.(c.nome, tiro);
      }));
      const editor = creaElemento("div", "iniziativa-editor");
      editor.append(creaElemento("span", "etichetta-pf etichetta-iniziativa", "Iniziativa"), input, tira);
      iniziativa.classList.add("modificabile");
      iniziativa.append(editor);
    }

    const azioni = creaElemento("div", "combattente-azioni");
    if (isDM) {
      const su = bottone("", "btn-tabella btn-spareggio");
      su.innerHTML = icona("su");
      su.title = "Prima, a pari iniziativa";
      su.setAttribute("aria-label", `Sposta ${c.nome} prima`);
      const giu = bottone("", "btn-tabella btn-spareggio");
      giu.innerHTML = icona("giu");
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
          return rimuoviCombattente(campagnaId, c.id, turnoDopo, nascosto(c.id));
        });
      });
      azioni.append(su, giu);
      if (c.tipo === "nemico") {
        const scheda = bottone("", "btn-tabella btn-scheda-creatura");
        scheda.innerHTML = icona("scheda");
        scheda.title = "Scheda dal bestiario";
        scheda.setAttribute("aria-label", `Scheda di ${c.nome}`);
        scheda.hidden = true;
        scheda.addEventListener("click", () => {
          const attuale = combattenti.find((x) => x.id === c.id);
          apriSchedaCreatura({
            campagnaId, rif: attuale?.dm?.creatura, nome: attuale?.nome || c.nome, utente: { uid, nome: nomeUtente() }, avviso,
          }).catch((errore) => {
            console.error(errore);
            avviso("Impossibile aprire la scheda.", true);
          });
        });
        azioni.append(scheda);
        const rivela = bottone("Rivela", "btn-tabella btn-rivela");
        rivela.addEventListener("click", () => esegui([rivela], () => rivelaNemici(campagnaId, [c.id], nascosto(c.id))));
        azioni.append(rivela);
      }
      azioni.append(togli);
    }

    li.append(posizione, avatar, info, iniziativa);
    // Sul telefono la riga resta compatta: la freccia apre iniziativa e comandi.
    if (modificabile) {
      const espandi = bottone("", "btn-tabella btn-apri-combattente");
      espandi.innerHTML = icona("giu");
      espandi.setAttribute("aria-expanded", "false");
      espandi.setAttribute("aria-label", `Comandi per ${c.nome}`);
      espandi.addEventListener("click", () => {
        li.dataset.toccata = "1";
        apriRiga(li, !li.classList.contains("aperta"));
      });
      li.append(espandi);
    }
    li.append(azioni, controlli);
    return li;
  }

  function apriRiga(li, aperta) {
    li.classList.toggle("aperta", aperta);
    const espandi = li.querySelector(".btn-apri-combattente");
    if (!espandi) return;
    espandi.innerHTML = icona(aperta ? "su" : "giu");
    espandi.setAttribute("aria-expanded", String(aperta));
  }

  function caricaAvatar(c, img, simbolo) {
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
      simbolo.hidden = !img.hidden;
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
      const alleato = Boolean(combattenti.find((x) => x.id === c.id)?.alleato);
      esegui([colpisci, cura, attuali], () => aggiornaPfNemico(campagnaId, c.id, pf, dm.pfMassimi, nascosto(c.id), alleato));
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
    return impostaSpareggi(campagnaId, gruppo.map((x) => ({ id: x, nascosto: nascosto(x) })));
  }

  function aggiornaRiga(li, c, indice) {
    const diTurno = stato.turno === c.id && stato.round > 0;
    li.classList.toggle("di-turno", diTurno);
    li.classList.toggle("mio", c.tipo === "pg" && c.uid === uid);
    li.classList.toggle("a-terra", c.salute === "a terra");
    li.classList.toggle("nascosto", Boolean(c.nascosto));
    li.classList.toggle("alleato", Boolean(c.alleato));
    const scheda = li.querySelector(".btn-scheda-creatura");
    if (scheda) scheda.hidden = !c.dm?.creatura;
    const rivela = li.querySelector(".btn-rivela");
    if (rivela) {
      rivela.textContent = c.nascosto ? "Rivela" : "Nascondi";
      rivela.title = c.nascosto ? "Mostra ai giocatori (nel tracker e sulla mappa)" : "Nascondi ai giocatori";
    }
    const posizione = li.querySelector(".combattente-posizione");
    if (diTurno) {
      if (!posizione.querySelector("svg")) posizione.innerHTML = icona("turno-corrente");
    } else {
      posizione.textContent = String(indice + 1);
    }
    li.querySelector(".combattente-nome").textContent = c.nome;

    let sotto;
    if (c.tipo === "pg") {
      const r = party().find((x) => x.uid === c.uid);
      sotto = r?.nomeGiocatore ? `Giocatore: ${r.nomeGiocatore}` : "Personaggio";
    } else if (c.alleato) {
      sotto = c.pf ? `Alleato · PF ${c.pf.attuali}/${c.pf.massimi}` : "Alleato";
    } else if (isDM && c.dm) {
      sotto = `${c.nascosto ? "Nascosto ai giocatori" : "Nemico"} · ${SALUTE[c.salute] || "Illeso"}`;
    } else {
      sotto = SALUTE[c.salute] || "Nemico";
    }
    const sub = li.querySelector(".combattente-sub");
    sub.textContent = sotto;
    sub.dataset.salute = c.tipo === "nemico" ? c.salute || "illeso" : "";

    // Condizioni: dei PG dal riepilogo del party (tempo reale), dei nemici
    // dalla riga del tracker.
    const riepilogo = c.tipo === "pg" ? party().find((x) => x.uid === c.uid) : null;
    const chip = c.tipo === "pg"
      ? creaChipCondizioni(riepilogo?.condizioni || [], riepilogo?.esaurimento || 0)
      : creaChipCondizioni(c.condizioni || [], 0);
    li.querySelector(".combattente-condizioni").replaceChildren(chip);

    const input = li.querySelector(".input-iniziativa");
    li.querySelector(".valore-iniziativa").textContent = c.iniziativa ?? "—";
    if (input) {
      if (document.activeElement !== input) input.value = c.iniziativa ?? "";
      input.placeholder = "—";
    }
    // Il proprio personaggio senza iniziativa: comandi già aperti (finché il
    // giocatore non apre o chiude la riga da sé).
    if (c.tipo === "pg" && c.uid === uid && !li.dataset.toccata) apriRiga(li, c.iniziativa == null);

    if (isDM && c.tipo === "nemico" && c.dm) {
      const [attuali] = li.querySelectorAll(".input-pf-nemico");
      if (document.activeElement !== attuali) attuali.value = c.dm.pfAttuali;
      li.querySelector(".pf-massimi").textContent = `/ ${c.dm.pfMassimi}`;
      li.querySelector(".combattente-pf-breve").textContent = `PF ${c.dm.pfAttuali} / ${c.dm.pfMassimi}`;
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
    contenitore.hidden = !attivo;
    vuoto.hidden = attivo;

    const diTurno = attivo && stato.round > 0 ? ordinati.find((c) => c.id === stato.turno) : null;
    const testi = !attivo ? { testoRound: "", round: "", resto: "" }
      : stato.round === 0 ? { testoRound: "In preparazione: tirate l'iniziativa.", round: "", resto: "" }
        : { testoRound: "Round ", round: stato.round, resto: diTurno ? ` · turno di ${diTurno.nome}` : "" };

    if (isDM) {
      btnAvvia.hidden = attivo;
      btnPrecedente.hidden = !attivo || stato.round === 0;
      btnSuccessivo.hidden = !attivo;
      testoSuccessivo(stato.round === 0 ? "Inizia" : "Turno successivo");
      btnTermina.hidden = !attivo;
      btnRivelaTutti.hidden = !attivo || !combattenti.some((c) => c.nascosto);
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
    // Cornice del turno: sobria per tutti, scenica per chi gioca il turno.
    animazioneTurno.aggiorna({
      riga: diTurno ? righe.get(diTurno.id) : null, id: diTurno?.id ?? null, round: stato.round, sottotitolo: testi,
      scenico: !isDM && mioTurno, ordine: ordinati.map((c) => c.id),
    });
    if (!isDM && eraAttivo === false && attivo) avviso("Combattimento! Tira l'iniziativa.");
    if (!isDM && mioTurno && turnoPrecedente !== `${stato.round}:${stato.turno}`) avviso("Tocca a te!");
    eraAttivo = attivo;
    turnoPrecedente = `${stato.round}:${stato.turno}`;
  }

  let datiRicevuti = false;
  const stop = ascoltaCombattimento(campagnaId, isDM, (dati) => {
    stato = dati.stato;
    combattenti = dati.combattenti;
    datiRicevuti = true;
    render();
  }, (errore) => console.error(errore));

  // "ridisegna": quando cambia il party (PF, condizioni, ritratti).
  return {
    stop: () => {
      stop();
      animazioneTurno.stop();
      smettiBestiario();
    },
    ridisegna: () => {
      if (datiRicevuti) render();
    },
  };
}
