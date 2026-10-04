// Pannello Mappa della pagina Sessione (sopra gli appunti).
// - DM: sceglie quale mappa della Libreria preparare (categoria "Mappa"), ne
//   regola la griglia (anche con la taratura a due clic), la mette in tavola,
//   piazza il party, muove tutte le pedine e con "Mostra qui a tutti" decide
//   cosa inquadra lo schermo comune (tavolo.html, aperto da "Schermo del tavolo").
//   Nemici (fase 2): quelli del tracker aspettano nel vassoio «Da piazzare» e
//   si trascinano sulla mappa; «+ Pedina» ne mette uno a mano (PNG, statue…)
//   che può entrare in combattimento più tardi. Le pedine nascoste le vede
//   solo il DM finché non le rivela. Durante il combattimento la pedina di
//   turno ha un alone, e lo schermo del tavolo può seguirla.
//   Nebbia di guerra (fase 3, «Nebbia…»): il DM svela e copre a caselle, con
//   pennello o rettangolo, in diretta; la vede come un velo, i giocatori come
//   buio. I nemici sotto la nebbia spariscono per i giocatori.
// - Tutti (fase 4, barra «Strumenti»): righello (gli altri lo vedono mentre si
//   misura), ping (onda e suono; quello del DM porta tutti sul punto) e aree
//   degli incantesimi (dai propri incantesimi o a mano; il DM sempre a mano),
//   con le caselle colpite secondo la regola su griglia: restano finché le
//   toglie chi le ha messe o il DM.
// - Giocatore: vede la mappa in tavola, si sposta e fa zoom, muove solo la
//   propria pedina ("Entra in mappa" se non c'è ancora); al suo turno la mappa
//   si centra su di lui e compare «Tocca a te!».
// Dati e permessi: vedi "Mappe della sessione" in auth.js e firestore.rules.
import {
  ascoltaTavola,
  impostaMappaInTavola,
  impostaInquadratura,
  ascoltaGriglia,
  salvaGriglia,
  ascoltaPedine,
  salvaPedina,
  salvaPedine,
  rimuoviPedina,
  rimuoviPedine,
  ottieniScheda,
  ascoltaCombattimento,
  salvaPedinaNemico,
  aggiornaPedinaNemico,
  nuovoIdPedina,
  impostaSegueTurno,
  rivelaNemici,
  pedinaInCombattimento,
  aggiornaPfNemico,
  ascoltaNebbia,
  salvaNebbia,
  salvaStrumenti,
  creaArea,
  rimuoviArea,
  rimuoviAree,
} from "./auth.js";
import { urlImmagine, percorsiImmagineCampagna } from "./immagini.js";
import { creaElemento } from "./contenuti.js";
import { icona } from "./icone.js";
import { velocitaRazza } from "./dati-srd.js";
import { creaVistaMappa } from "./mappa-vista.js";
import { costruisciPedine, creaCacheRitratti, creaCacheImmagini, pedinaDiTurno } from "./mappa-pedine.js";
import {
  taratura, caselleLibereIntorno, METRI_PER_CASELLA, formattaMetri, TAGLIE, caselleTaglia,
  dimensioniNebbia, creaNebbia, adattaNebbia, cambiaCelle, casellePennello, caselleRettangolo, caselleCerchio,
  centroCasellaDiPunto, verticePiuVicino, caselleArea, pedineInCaselle,
} from "./mappa-calcoli.js";
import { creaStrumentiCondivisi } from "./mappa-strumenti.js";
import { apriSchedaCreatura } from "./bestiario-finestra.js";
import { areeDellaScheda, FORME_AREA, MISURE_AREA } from "./aree-incantesimi.js";

// Immagine di una mappa con le sue dimensioni vere (la griglia è in pixel
// dell'immagine). Le promesse restano in memoria: si scarica una volta sola.
const cacheMappe = new Map();
export function caricaMappa(campagnaId, immagineId) {
  const chiave = `${campagnaId}/${immagineId}`;
  if (!cacheMappe.has(chiave)) {
    const promessa = urlImmagine(percorsiImmagineCampagna(campagnaId, immagineId).grande).then(async (url) => {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { url, larghezza: img.naturalWidth, altezza: img.naturalHeight };
    });
    promessa.catch(() => cacheMappe.delete(chiave));
    cacheMappe.set(chiave, promessa);
  }
  return cacheMappe.get(chiave);
}

const arrotonda = (n) => Math.round(n * 10) / 10;

// "membri": uid dei membri per mettere la mappa in tavola (solo DM);
// "membriUid": uid dei membri dalla campagna (per i colori degli strumenti).
export function montaMappa({ pannello, campagnaId, uid, isDM, party, libreria, membri, membriUid, avviso, nomeUtente = () => null }) {
  const intestazione = creaElemento("div", "sessione-appunti-intestazione mappa-intestazione");
  const titolo = creaElemento("h3", null, "Mappa");
  const nomeMappa = creaElemento("span", "mappa-nome");
  titolo.append(nomeMappa);
  const comandi = creaElemento("div", "azioni-intestazione mappa-comandi");
  intestazione.append(titolo, comandi);
  const nastro = creaElemento("p", "mappa-nastro");
  nastro.hidden = true;
  const area = creaElemento("div", "mappa-area");
  // Stato vuoto (solo il DM: ai giocatori il pannello compare con la mappa).
  const vuoto = creaElemento("div", "mappa-senza-mappa");
  vuoto.innerHTML = icona("bussola-grande");
  const testoVuoto = creaElemento("p");
  vuoto.append(testoVuoto);
  vuoto.hidden = true;
  const sovrapposti = creaElemento("div", "mappa-sovrapposti");
  const piede = creaElemento("div", "mappa-piede");
  pannello.replaceChildren(intestazione, nastro, vuoto, area, piede);

  const bottone = (testo, classe = "btn-tabella") => {
    const b = creaElemento("button", classe, testo);
    b.type = "button";
    return b;
  };

  // ---------- stato ----------
  let tavola = { immagineId: null, inquadratura: null };
  let mappaId = null; // mappa mostrata in questo pannello
  let griglia = null;
  let pedineSalvate = [];
  let selezionata = null;
  let smettiGriglia = null;
  let smettiPedine = null;
  let caricamento = 0;
  let smettiNebbia = null;
  let nebbiaSalvata = null; // come arriva da Firestore
  let nebbia = null; // quella mostrata (adattata alla griglia, con le modifiche in corso)
  let dimensioniMappa = null; // { larghezza, altezza } dell'immagine
  let comeGiocatori = false;
  const velocita = new Map(); // schedaId -> metri
  const ritratto = creaCacheRitratti(() => ridisegnaPedine());
  const immagine = creaCacheImmagini(campagnaId, () => ridisegnaPedine());
  let combattimento = { stato: { attivo: false, round: 0, turno: null }, combattenti: [] };
  const pedinaSalvata = (id) => pedineSalvate.find((p) => p.id === id);

  const vista = creaVistaMappa(area, {
    puoMuovere: (id) => isDM || id === uid,
    velocita: (id) => {
      const r = party().find((x) => x.uid === id);
      return r?.schedaId ? velocita.get(r.schedaId) ?? null : null;
    },
    onSposta: async (id, casella) => {
      const p = pedinaSalvata(id);
      try {
        if (p?.tipo === "nemico") await aggiornaPedinaNemico(campagnaId, mappaId, id, Boolean(p.nascosta), casella);
        else await salvaPedina(campagnaId, mappaId, id, casella);
      } catch (errore) {
        console.error(errore);
        avviso("Impossibile spostare la pedina.", true);
      }
    },
    onSeleziona: (id) => {
      selezionata = id;
      aggiornaPiede();
      aggiornaNemici();
    },
    avviso: (testo) => mostraSuggerimento(testo),
  });
  area.append(sovrapposti);

  // Strumenti di tutti: righelli, ping e aree della mappa mostrata.
  const condivisi = creaStrumentiCondivisi({
    vista,
    campagnaId,
    mioUid: uid,
    membri: membriUid,
    griglia: () => griglia,
    onPing: ({ x, y, delDM }) => {
      // Il ping del DM porta i giocatori sul punto.
      if (isDM || !delDM) return;
      vista.centraPunto({ x, y });
      mostraSuggerimento("Il DM indica un punto della mappa.");
    },
    onAree: () => aggiornaElencoAree(),
  });

  const suggerimento = creaElemento("div", "mappa-suggerimento");
  suggerimento.hidden = true;
  sovrapposti.append(suggerimento);
  let timerSuggerimento = null;
  function mostraSuggerimento(testo, durata = 1800) {
    suggerimento.textContent = testo;
    suggerimento.hidden = false;
    clearTimeout(timerSuggerimento);
    if (durata) timerSuggerimento = setTimeout(() => (suggerimento.hidden = true), durata);
  }

  // Zoom e "centra su di me" sopra la mappa (comodi soprattutto sul telefono).
  const zoom = creaElemento("div", "mappa-zoom");
  const piu = bottone("+", "mappa-tondo");
  piu.setAttribute("aria-label", "Avvicina");
  const meno = bottone("−", "mappa-tondo");
  meno.setAttribute("aria-label", "Allontana");
  piu.addEventListener("click", () => vista.zoom(1.3));
  meno.addEventListener("click", () => vista.zoom(1 / 1.3));
  zoom.append(piu, meno);
  const centra = bottone("", "mappa-centra");
  centra.innerHTML = `${icona("centra")} Centra su di me`;
  centra.addEventListener("click", () => {
    if (!vista.centraSu(uid)) mostraSuggerimento("La tua pedina non è ancora sulla mappa.");
  });
  centra.hidden = isDM;
  sovrapposti.append(zoom, centra);

  // ---------- velocità (per la distanza mostrata mentre si trascina) ----------
  async function caricaVelocita() {
    const daLeggere = party().filter((r) => r.schedaId && !velocita.has(r.schedaId) && (isDM || r.uid === uid));
    await Promise.all(daLeggere.map(async (r) => {
      velocita.set(r.schedaId, null);
      try {
        const scheda = await ottieniScheda(r.schedaId);
        if (scheda) velocita.set(r.schedaId, velocitaRazza(scheda.razza, scheda.sottorazza));
      } catch (errore) {
        console.error(errore);
      }
    }));
  }

  // ---------- mappa mostrata ----------
  const mappeLibreria = () => (isDM ? libreria().filter((c) => c.categoria === "mappa") : []);
  const contenutoMappa = (id) => libreria().find((c) => c.id === id);

  // Giocatore: all'apertura di una mappa la vista parte centrata sulla sua
  // pedina (appena ci sono sia l'immagine sia le pedine).
  let daCentrare = false;
  let pedineMostrate = [];
  function ridisegnaPedine() {
    if (!mappaId) return;
    pedineMostrate = costruisciPedine({
      party: party(), pedine: pedineSalvate, combattimento, mioUid: uid, perDM: isDM, ritratto, immagine,
      nebbia, comeGiocatori,
    });
    vista.impostaPedine(pedineMostrate);
    vista.impostaNebbia(nebbia, isDM && !comeGiocatori ? "velo" : "buio");
    if (daCentrare && vista.centraSu(uid)) daCentrare = false;
    aggiornaPiede();
    aggiornaNemici();
  }

  async function mostraMappa(id) {
    if (id === mappaId) return;
    smettiGriglia?.();
    smettiPedine?.();
    smettiNebbia?.();
    smettiGriglia = smettiPedine = smettiNebbia = null;
    mappaId = id;
    griglia = null;
    condivisi.cambiaMappa(id);
    nebbiaSalvata = nebbia = dimensioniMappa = null;
    storiaNebbia.length = 0;
    pedineSalvate = [];
    selezionata = null;
    daCentrare = !isDM;
    annullaTaratura();
    const turno = ++caricamento;
    if (!id) {
      vista.impostaMappa(null, isDM ? "Scegli una mappa da preparare." : "");
      aggiorna();
      return;
    }
    aggiorna();
    vista.impostaMappa(null, "Caricamento della mappa…");
    smettiGriglia = ascoltaGriglia(campagnaId, id, (g) => {
      griglia = g;
      vista.impostaGriglia(g);
      aggiornaPannelloGriglia();
      ricalcolaNebbia();
      condivisi.ridisegna();
    });
    smettiNebbia = ascoltaNebbia(campagnaId, id, (n) => {
      nebbiaSalvata = n;
      // Durante un tratto conta quello che il DM sta disegnando.
      if (!tracciando) ricalcolaNebbia();
    });
    smettiPedine = ascoltaPedine(campagnaId, id, (elenco) => {
      pedineSalvate = elenco;
      ridisegnaPedine();
    }, undefined, isDM);
    try {
      const immagine = await caricaMappa(campagnaId, id);
      if (turno !== caricamento) return;
      vista.impostaMappa(immagine);
      dimensioniMappa = { larghezza: immagine.larghezza, altezza: immagine.altezza };
      ricalcolaNebbia();
    } catch (errore) {
      console.error(errore);
      if (turno === caricamento) vista.impostaMappa(null, "Impossibile caricare l'immagine della mappa.");
    }
    aggiorna();
  }

  // ---------- comandi del DM ----------
  const scelta = creaElemento("select", "select-dadi mappa-scelta");
  scelta.setAttribute("aria-label", "Mappa da preparare");
  const inTavola = bottone("Metti in tavola", "btn-tabella btn-tabella-evidenza");
  const togli = bottone("Togli dal tavolo");
  const mostraATutti = bottone("Mostra qui a tutti", "btn-tabella btn-tabella-evidenza");
  mostraATutti.title = "Lo schermo del tavolo inquadra quello che vedi ora qui";
  const adatta = bottone("Adatta");
  const apriTavolo = creaElemento("a", "btn-tabella", "Schermo del tavolo");
  apriTavolo.href = "tavolo.html";
  apriTavolo.target = "_blank";
  apriTavolo.rel = "noopener";
  apriTavolo.title = "Apri la vista dei giocatori da mettere a schermo intero sulla TV";
  adatta.addEventListener("click", () => vista.adatta());

  const STORAGE_PREPARATA = `sed-mappa-preparata-${campagnaId}`;
  const leggiPreparata = () => {
    try {
      return localStorage.getItem(STORAGE_PREPARATA);
    } catch {
      return null;
    }
  };
  scelta.addEventListener("change", () => {
    try {
      localStorage.setItem(STORAGE_PREPARATA, scelta.value);
    } catch {
      // Solo una comodità: senza memoria si riparte dalla mappa in tavola.
    }
    mostraMappa(scelta.value || null);
  });

  inTavola.addEventListener("click", async () => {
    const nuova = contenutoMappa(mappaId);
    if (!nuova) return;
    inTavola.disabled = true;
    try {
      await impostaMappaInTavola(campagnaId, {
        nuova,
        precedente: tavola.immagineId ? contenutoMappa(tavola.immagineId) : null,
        membri: membri(),
      });
      avviso(`«${nuova.titolo}» è in tavola.`);
    } catch (errore) {
      console.error(errore);
      avviso("Impossibile mettere in tavola la mappa.", true);
    } finally {
      inTavola.disabled = false;
    }
  });

  togli.addEventListener("click", async () => {
    try {
      await impostaMappaInTavola(campagnaId, { nuova: null, precedente: contenutoMappa(tavola.immagineId), membri: [] });
    } catch (errore) {
      console.error(errore);
      avviso("Impossibile togliere la mappa dal tavolo.", true);
    }
  });

  mostraATutti.addEventListener("click", async () => {
    const r = vista.rettangoloVisibile();
    try {
      await impostaInquadratura(campagnaId, { x: arrotonda(r.x), y: arrotonda(r.y), w: arrotonda(r.w), h: arrotonda(r.h) });
      mostraSuggerimento("Lo schermo del tavolo ora mostra questa inquadratura.");
    } catch (errore) {
      console.error(errore);
      avviso("Impossibile aggiornare lo schermo del tavolo.", true);
    }
  });

  if (isDM) comandi.append(scelta, inTavola, togli, mostraATutti, adatta, apriTavolo);

  // ---------- piede: party, pedina selezionata, griglia ----------
  const piazza = bottone("Piazza il party");
  piazza.title = "Mette al centro della vista i personaggi che non sono ancora sulla mappa";
  const entra = bottone("Entra in mappa", "btn-tabella btn-tabella-evidenza");
  const infoSelezione = creaElemento("span", "mappa-selezione");
  const rimuovi = bottone("Togli dalla mappa", "btn-tabella btn-tabella-pericolo");
  const apriGriglia = bottone("Griglia…");
  apriGriglia.setAttribute("aria-expanded", "false");
  const scala = creaElemento("span", "mappa-scala", `1 casella = ${formattaMetri(METRI_PER_CASELLA)} m`);
  piede.append(piazza, entra, infoSelezione, rimuovi, creaElemento("span", "mappa-spazio"), scala, apriGriglia);

  function senzaPedina() {
    const presenti = new Set(pedineSalvate.map((p) => p.uid || p.id));
    return party().filter((r) => r.schedaId && !presenti.has(r.uid));
  }

  piazza.addEventListener("click", async () => {
    const mancanti = senzaPedina();
    if (!mancanti.length || !griglia) return;
    const caselle = caselleLibereIntorno(vista.casellaAlCentro(), mancanti.length, pedineSalvate);
    try {
      await salvaPedine(campagnaId, mappaId, mancanti.map((r, i) => ({ uid: r.uid, ...caselle[i] })));
    } catch (errore) {
      console.error(errore);
      avviso("Impossibile piazzare il party.", true);
    }
  });

  entra.addEventListener("click", async () => {
    if (!griglia) return;
    const [casella] = caselleLibereIntorno(vista.casellaAlCentro(), 1, pedineSalvate);
    try {
      await salvaPedina(campagnaId, mappaId, uid, casella);
    } catch (errore) {
      console.error(errore);
      avviso("Impossibile entrare in mappa.", true);
    }
  });

  rimuovi.addEventListener("click", async () => {
    if (!selezionata) return;
    try {
      await rimuoviPedina(campagnaId, mappaId, selezionata, Boolean(pedinaSalvata(selezionata)?.nascosta));
    } catch (errore) {
      console.error(errore);
      avviso("Impossibile togliere la pedina.", true);
    }
  });

  function aggiornaPiede() {
    const mancanti = mappaId && griglia ? senzaPedina() : [];
    piazza.hidden = !isDM || mancanti.length === 0;
    piazza.textContent = mancanti.length === 1 ? `Piazza ${mancanti[0].nomePersonaggio || "il personaggio"}` : "Piazza il party";
    const mio = party().find((r) => r.uid === uid);
    entra.hidden = isDM || !mio?.schedaId || !mancanti.some((r) => r.uid === uid);
    const nome = selezionata && (party().find((r) => r.uid === selezionata)?.nomePersonaggio || pedinaSalvata(selezionata)?.nome);
    infoSelezione.hidden = rimuovi.hidden = !isDM || !selezionata;
    infoSelezione.textContent = nome || "";
    apriGriglia.hidden = apriNebbia.hidden = !isDM || !mappaId;
    scala.hidden = !mappaId;
    centra.hidden = isDM || !pedineSalvate.some((p) => (p.uid || p.id) === uid);
  }

  // ---------- nemici (DM): vassoio, «+ Pedina», pedina selezionata ----------
  const SALUTE = { illeso: "Illeso", ferito: "Ferito", grave: "Gravemente ferito", "a terra": "A terra" };
  const ICONA_ARTIGLI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 4 C9 9 9 14 7 20"/><path d="M12 3 C14 9 14 14 12 21"/><path d="M18 4 C20 9 19 14 17 20"/></svg>';
  const barraNemici = creaElemento("div", "mappa-nemici");
  barraNemici.hidden = true;
  const vassoio = creaElemento("div", "mappa-vassoio");
  const segui = creaElemento("label", "mappa-campo");
  const inputSegui = creaElemento("input");
  inputSegui.type = "checkbox";
  segui.append(inputSegui, document.createTextNode(" Il tavolo segue il turno"));
  const rivelaTutti = bottone("Rivela tutti");
  rivelaTutti.title = "Mostra ai giocatori tutte le pedine nascoste di questa mappa";
  const togliSconfitti = bottone("Togli i nemici sconfitti");
  const apriNuova = bottone("+ Pedina");
  apriNuova.title = "Metti a mano una pedina dalla Libreria (PNG, mostri, oggetti)";
  barraNemici.append(creaElemento("span", "mappa-vassoio-titolo", "Da piazzare"), vassoio,
    creaElemento("span", "mappa-spazio"), segui, rivelaTutti, togliSconfitti, apriNuova);
  pannello.insertBefore(barraNemici, area);

  // Modulo «+ Pedina»: immagine dalla Libreria, nome, taglia. La pedina nasce
  // nascosta al centro della vista, fuori dal tracker.
  const formNuova = creaElemento("form", "mappa-nuova-pedina");
  formNuova.hidden = true;
  const sceltaImmagine = creaElemento("select", "select-dadi");
  sceltaImmagine.setAttribute("aria-label", "Immagine dalla Libreria");
  const nomeNuova = creaElemento("input", "input-dadi input-dadi-etichetta");
  Object.assign(nomeNuova, { type: "text", maxLength: 60, placeholder: "Nome", required: true });
  nomeNuova.setAttribute("aria-label", "Nome della pedina");
  const tagliaNuova = creaElemento("select", "select-dadi");
  tagliaNuova.setAttribute("aria-label", "Taglia");
  const opzioniTaglia = () => TAGLIE.map((t) => new Option(`${t.nome}${t.caselle > 1 ? ` (${t.caselle}×${t.caselle})` : ""}`, t.chiave));
  tagliaNuova.replaceChildren(...opzioniTaglia());
  tagliaNuova.value = "media";
  const conferma = creaElemento("button", "btn-tabella btn-tabella-evidenza", "Metti sulla mappa (nascosta)");
  conferma.type = "submit";
  const annullaNuova = bottone("Annulla");
  formNuova.append(sceltaImmagine, nomeNuova, tagliaNuova, conferma, annullaNuova);
  pannello.insertBefore(formNuova, area);

  apriNuova.addEventListener("click", () => {
    const peso = (c) => (c.categoria === "nemico" ? 0 : c.categoria === "png" ? 1 : 2);
    const voci = [...libreria()].filter((c) => c.categoria !== "mappa")
      .sort((a, b) => peso(a) - peso(b) || a.titolo.localeCompare(b.titolo, "it"));
    sceltaImmagine.replaceChildren(new Option("Nessuna immagine", ""), ...voci.map((c) => new Option(c.titolo, c.id)));
    formNuova.hidden = !formNuova.hidden;
    if (!formNuova.hidden) nomeNuova.focus();
  });
  sceltaImmagine.addEventListener("change", () => {
    const c = libreria().find((x) => x.id === sceltaImmagine.value);
    if (c && !nomeNuova.value.trim()) nomeNuova.value = c.titolo.slice(0, 60);
  });
  annullaNuova.addEventListener("click", () => (formNuova.hidden = true));
  formNuova.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const nome = nomeNuova.value.trim();
    if (!nome || !griglia) return;
    const n = caselleTaglia(tagliaNuova.value);
    const centro = vista.casellaAlCentro();
    const id = nuovoIdPedina(campagnaId, mappaId);
    conferma.disabled = true;
    try {
      await salvaPedinaNemico(campagnaId, mappaId, id, {
        nome,
        immagineId: sceltaImmagine.value || null,
        taglia: tagliaNuova.value,
        c: Math.round(centro.c - (n - 1) / 2),
        r: Math.round(centro.r - (n - 1) / 2),
      }, true);
      formNuova.reset();
      formNuova.hidden = true;
      selezionata = id;
      vista.seleziona(id);
    } catch (errore) {
      console.error(errore);
      avviso("Impossibile mettere la pedina.", true);
    } finally {
      conferma.disabled = false;
    }
  });

  inputSegui.addEventListener("change", () =>
    impostaSegueTurno(campagnaId, inputSegui.checked).catch((errore) => {
      console.error(errore);
      avviso("Impossibile cambiare l'impostazione.", true);
    }));
  rivelaTutti.addEventListener("click", () => {
    const ids = pedineSalvate.filter((p) => p.nascosta).map((p) => p.id);
    if (ids.length) rivelaNemici(campagnaId, ids, true, mappaId).catch((errore) => {
      console.error(errore);
      avviso("Impossibile rivelare i nemici.", true);
    });
  });
  togliSconfitti.addEventListener("click", () => {
    const sconfitti = pedineNemici().filter((p) => saluteDi(p) === "a terra");
    if (sconfitti.length) rimuoviPedine(campagnaId, mappaId, sconfitti.map((p) => ({ id: p.id, nascosta: Boolean(p.nascosta) }))).catch((errore) => {
      console.error(errore);
      avviso("Impossibile togliere i nemici.", true);
    });
  });

  const pedineNemici = () => pedineSalvate.filter((p) => p.tipo === "nemico");
  const combattenteDi = (id) => combattimento.combattenti.find((c) => c.id === id);
  const saluteDi = (p) => combattenteDi(p.id)?.salute || p.salute || "illeso";

  // Vassoio: nemici del tracker non ancora sulla mappa, da trascinare.
  let firmaVassoio = "";
  function aggiornaVassoio() {
    const presenti = new Set(pedineSalvate.map((p) => p.id));
    const daPiazzare = combattimento.combattenti.filter((c) => c.tipo === "nemico" && !presenti.has(c.id));
    const firma = JSON.stringify(daPiazzare.map((c) => [c.id, c.nome, c.nascosto, c.taglia, c.immagineId]));
    if (firma === firmaVassoio) return;
    firmaVassoio = firma;
    vassoio.replaceChildren(...daPiazzare.map(creaChipVassoio));
    if (!daPiazzare.length) vassoio.append(creaElemento("span", "mappa-vassoio-vuoto", combattimento.stato.attivo ? "Tutti i nemici sono sulla mappa." : "Nessun combattimento in corso."));
  }

  function creaChipVassoio(c) {
    const chip = creaElemento("span", "mappa-chip-vassoio");
    chip.title = "Trascina sulla mappa";
    const volto = creaElemento("span", "mappa-mini-volto");
    const url = immagine(c.immagineId);
    if (url) {
      const img = creaElemento("img");
      img.alt = "";
      img.src = url;
      volto.append(img);
    } else {
      volto.innerHTML = ICONA_ARTIGLI;
    }
    const taglia = TAGLIE.find((t) => t.chiave === (c.taglia || "media"))?.nome || "Media";
    const testo = creaElemento("span", null, c.nome);
    testo.append(creaElemento("small", null, ` ${taglia}${c.nascosto ? " · nascosto" : ""}`));
    chip.append(volto, testo);
    chip.addEventListener("pointerdown", (evento) => trascinaDalVassoio(evento, c, chip));
    return chip;
  }

  function trascinaDalVassoio(evento, c, chip) {
    if (!mappaId || !griglia) return;
    evento.preventDefault();
    const fantasma = chip.querySelector(".mappa-mini-volto").cloneNode(true);
    fantasma.classList.add("mappa-fantasma");
    document.body.append(fantasma);
    const muovi = (e) => {
      fantasma.style.left = `${e.clientX - 22}px`;
      fantasma.style.top = `${e.clientY - 22}px`;
    };
    muovi(evento);
    const fine = async (e) => {
      window.removeEventListener("pointermove", muovi);
      window.removeEventListener("pointerup", fine);
      window.removeEventListener("pointercancel", fine);
      fantasma.remove();
      const punto = e.type === "pointerup" ? vista.puntoDaClient(e.clientX, e.clientY) : null;
      if (!punto) return;
      const casella = vista.casellaPerPunto(punto, caselleTaglia(c.taglia));
      try {
        await salvaPedinaNemico(campagnaId, mappaId, c.id, {
          nome: c.nome, immagineId: c.immagineId || null, taglia: c.taglia || "media",
          salute: c.salute || "illeso", condizioni: c.condizioni || [], alleato: Boolean(c.alleato), ...casella,
        }, Boolean(c.nascosto));
        selezionata = c.id;
        vista.seleziona(c.id);
      } catch (errore) {
        console.error(errore);
        avviso("Impossibile piazzare il nemico.", true);
      }
    };
    window.addEventListener("pointermove", muovi);
    window.addEventListener("pointerup", fine);
    window.addEventListener("pointercancel", fine);
  }

  // Pedina di nemico selezionata: PF, taglia, rivela, entra in combattimento.
  const dettagli = creaElemento("div", "mappa-dettagli-nemico");
  dettagli.hidden = true;
  pannello.insertBefore(dettagli, piede.nextSibling);

  function aggiornaDettagli() {
    const p = isDM && selezionata ? pedinaSalvata(selezionata) : null;
    if (!p || p.tipo !== "nemico") {
      dettagli.hidden = true;
      delete dettagli.dataset.firma;
      return;
    }
    const c = combattenteDi(p.id);
    const firma = JSON.stringify([p, c?.dm, c?.salute, Boolean(c), combattimento.stato.attivo]);
    if (dettagli.dataset.firma === firma && !dettagli.hidden) return;
    dettagli.dataset.firma = firma;
    dettagli.hidden = false;
    const righe = [creaElemento("strong", null, p.nome)];
    const salute = SALUTE[saluteDi(p)];
    if (c?.dm) {
      const danno = creaElemento("input", "input-dadi mappa-numero");
      Object.assign(danno, { type: "number", min: 0, placeholder: "±" });
      danno.setAttribute("aria-label", `Danni o cure per ${p.nome}`);
      const colpisci = bottone("−");
      colpisci.title = "Sottrai (danno)";
      const cura = bottone("+");
      cura.title = "Aggiungi (cura)";
      const applica = (segno) => {
        const quanto = Math.trunc(Number(danno.value));
        if (!quanto) return;
        const pf = Math.max(-999, Math.min(9999, c.dm.pfAttuali + segno * quanto));
        aggiornaPfNemico(campagnaId, c.id, pf, c.dm.pfMassimi, Boolean(c.nascosto), Boolean(c.alleato)).catch((errore) => {
          console.error(errore);
          avviso("Impossibile aggiornare i PF.", true);
        });
      };
      colpisci.addEventListener("click", () => applica(-1));
      cura.addEventListener("click", () => applica(1));
      righe.push(creaElemento("span", null, `PF ${c.dm.pfAttuali}/${c.dm.pfMassimi}`), danno, colpisci, cura);
      if (c.dm.creatura) {
        const scheda = bottone("");
        scheda.innerHTML = `${icona("scheda")} Scheda`;
        scheda.title = "Scheda dal bestiario, con i tiri";
        scheda.addEventListener("click", () => apriSchedaCreatura({
          campagnaId, rif: c.dm.creatura, nome: c.nome, utente: { uid, nome: nomeUtente() }, avviso,
        }).catch((errore) => {
          console.error(errore);
          avviso("Impossibile aprire la scheda.", true);
        }));
        righe.push(scheda);
      }
    }
    righe.push(creaElemento("span", "mappa-salute-vaga", p.nascosta ? "Nascosto ai giocatori"
      : c?.alleato ? "Alleato: i giocatori vedono i PF" : `I giocatori vedono «${salute}»`));
    const taglia = creaElemento("select", "select-dadi");
    taglia.setAttribute("aria-label", "Taglia");
    taglia.replaceChildren(...opzioniTaglia());
    taglia.value = p.taglia || "media";
    taglia.addEventListener("change", () => aggiornaPedinaNemico(campagnaId, mappaId, p.id, Boolean(p.nascosta), { taglia: taglia.value }).catch((errore) => {
      console.error(errore);
      avviso("Impossibile cambiare la taglia.", true);
    }));
    const rivela = bottone(p.nascosta ? "Rivela" : "Nascondi", p.nascosta ? "btn-tabella btn-tabella-evidenza" : "btn-tabella");
    rivela.addEventListener("click", () => rivelaNemici(campagnaId, [p.id], Boolean(p.nascosta), mappaId).catch((errore) => {
      console.error(errore);
      avviso("Impossibile cambiare la visibilità.", true);
    }));
    righe.push(taglia, rivela);
    if (!c && combattimento.stato.attivo) {
      const pf = creaElemento("input", "input-dadi mappa-numero");
      Object.assign(pf, { type: "number", min: 0, max: 9999, value: 10 });
      pf.setAttribute("aria-label", "PF massimi");
      const entraCombattimento = bottone("Entra in combattimento", "btn-tabella btn-tabella-evidenza");
      entraCombattimento.title = "Aggiunge la pedina al tracker e tira l'iniziativa";
      entraCombattimento.addEventListener("click", () => {
        entraCombattimento.disabled = true;
        pedinaInCombattimento(campagnaId, p, { pfMassimi: Math.max(0, Math.trunc(Number(pf.value)) || 0) }).catch((errore) => {
          console.error(errore);
          entraCombattimento.disabled = false;
          avviso("Impossibile aggiungerla al combattimento.", true);
        });
      });
      righe.push(creaElemento("span", null, "PF"), pf, entraCombattimento);
    }
    dettagli.replaceChildren(...righe);
  }

  function aggiornaNemici() {
    const inTavolaQui = Boolean(mappaId) && mappaId === tavola.immagineId;
    barraNemici.hidden = !isDM || !mappaId;
    if (barraNemici.hidden) {
      dettagli.hidden = true;
      return;
    }
    aggiornaVassoio();
    segui.hidden = !inTavolaQui;
    inputSegui.checked = tavola.segueTurno !== false;
    rivelaTutti.hidden = !pedineSalvate.some((p) => p.nascosta);
    togliSconfitti.hidden = !pedineNemici().some((p) => saluteDi(p) === "a terra");
    aggiornaDettagli();
  }

  // Giocatore: al proprio turno la mappa si centra su di lui e compare l'avviso.
  const tocca = creaElemento("div", "mappa-tocca", "Tocca a te!");
  tocca.hidden = true;
  sovrapposti.append(tocca);
  let ultimoTurno = null;
  function controllaTurno() {
    if (isDM) return;
    const mio = pedinaDiTurno(combattimento.stato) === uid;
    tocca.hidden = !mio || !mappaId;
    const chiave = `${combattimento.stato.round}:${combattimento.stato.turno}`;
    if (mio && chiave !== ultimoTurno) vista.centraSu(uid);
    ultimoTurno = chiave;
  }

  const smettiCombattimento = ascoltaCombattimento(campagnaId, isDM, (dati) => {
    combattimento = dati;
    ridisegnaPedine();
    controllaTurno();
  }, (errore) => console.error(errore));

  // ---------- nebbia di guerra ----------
  const dimensioniNebbiaAttuali = () =>
    griglia && dimensioniMappa ? dimensioniNebbia(griglia, dimensioniMappa.larghezza, dimensioniMappa.altezza) : null;

  function ricalcolaNebbia() {
    const dim = dimensioniNebbiaAttuali();
    nebbia = nebbiaSalvata && dim ? adattaNebbia(nebbiaSalvata, dim) : null;
    ridisegnaPedine();
    aggiornaPannelloNebbia();
  }

  // Salvataggio in diretta: al più ogni 300 ms durante un tratto, e alla fine.
  let timerNebbia = null;
  let tracciando = false;
  function salvaNebbiaOra() {
    clearTimeout(timerNebbia);
    timerNebbia = null;
    if (!nebbia || !mappaId) return;
    salvaNebbia(campagnaId, mappaId, nebbia).catch((errore) => {
      console.error(errore);
      avviso("Impossibile salvare la nebbia.", true);
    });
  }
  function salvaNebbiaPresto() {
    if (!timerNebbia) timerNebbia = setTimeout(salvaNebbiaOra, 300);
  }

  const storiaNebbia = [];
  function memorizzaNebbia() {
    if (!nebbia) return;
    storiaNebbia.push({ attiva: nebbia.attiva, celle: nebbia.celle.slice() });
    if (storiaNebbia.length > 30) storiaNebbia.shift();
  }

  function modificaNebbia(nuova, salva = salvaNebbiaOra) {
    nebbia = nuova;
    ridisegnaPedine();
    aggiornaPannelloNebbia();
    salva();
  }

  let strumento = "mano"; // mano, pennello1, pennello3, rettangolo
  let copri = false;
  const pannelloNebbia = creaElemento("div", "mappa-nebbia-pannello");
  pannelloNebbia.hidden = true;
  const apriNebbia = bottone("Nebbia…");
  apriNebbia.setAttribute("aria-expanded", "false");
  piede.append(apriNebbia);

  const etichettaAttiva = creaElemento("label", "mappa-campo");
  const inputAttiva = creaElemento("input");
  inputAttiva.type = "checkbox";
  etichettaAttiva.append(inputAttiva, document.createTextNode(" Nebbia di guerra"));
  const gruppo = (voci) => {
    const g = creaElemento("span", "mappa-gruppo");
    g.setAttribute("role", "group");
    voci.forEach(([chiave, testo]) => {
      const b = bottone(testo, "btn-tabella");
      b.dataset.voce = chiave;
      g.append(b);
    });
    return g;
  };
  const strumenti = gruppo([["mano", "Mano"], ["pennello1", "Pennello 1×1"], ["pennello3", "Pennello 3×3"], ["rettangolo", "Rettangolo"]]);
  strumenti.setAttribute("aria-label", "Strumento");
  const effetti = gruppo([["svela", "Svela"], ["copri", "Copri"]]);
  effetti.setAttribute("aria-label", "Effetto");
  const annullaNebbia = bottone("Annulla");
  const svelaTutto = bottone("Svela tutto");
  const copriTutto = bottone("Copri tutto");
  const torcia = bottone("Svela attorno ai PG");
  const raggio = creaElemento("select", "select-dadi");
  raggio.setAttribute("aria-label", "Raggio attorno ai personaggi");
  raggio.replaceChildren(...[3, 6, 9].map((n) => new Option(`${n} caselle (${formattaMetri(n * METRI_PER_CASELLA)} m)`, String(n))));
  raggio.value = "6";
  const etichettaCome = creaElemento("label", "mappa-campo");
  const inputCome = creaElemento("input");
  inputCome.type = "checkbox";
  etichettaCome.append(inputCome, document.createTextNode(" Vedi come i giocatori"));
  const aiutoNebbia = creaElemento("p", "mappa-aiuto");
  pannelloNebbia.append(etichettaAttiva, strumenti, effetti, annullaNebbia, svelaTutto, copriTutto, torcia, raggio, etichettaCome, aiutoNebbia);
  pannello.append(pannelloNebbia);

  function aggiornaPannelloNebbia() {
    if (!isDM) return;
    const attiva = Boolean(nebbia?.attiva);
    inputAttiva.checked = attiva;
    inputAttiva.disabled = !dimensioniNebbiaAttuali();
    for (const b of strumenti.querySelectorAll("button")) {
      b.classList.toggle("btn-tabella-evidenza", b.dataset.voce === strumento);
      b.setAttribute("aria-pressed", String(b.dataset.voce === strumento));
      b.disabled = !attiva && b.dataset.voce !== "mano";
    }
    for (const b of effetti.querySelectorAll("button")) {
      const scelto = (b.dataset.voce === "copri") === copri;
      b.classList.toggle("btn-tabella-evidenza", scelto);
      b.setAttribute("aria-pressed", String(scelto));
      b.disabled = !attiva;
    }
    annullaNebbia.disabled = storiaNebbia.length === 0;
    svelaTutto.disabled = copriTutto.disabled = torcia.disabled = !attiva;
    inputCome.checked = comeGiocatori;
    aiutoNebbia.textContent = !attiva
      ? "Nebbia spenta: i giocatori vedono tutta la mappa. Accendila per partire con la mappa tutta coperta."
      : strumento === "mano"
        ? "Mano: trascina lo sfondo per spostarti e le pedine per muoverle. Scegli un pennello o il rettangolo per disegnare la nebbia."
        : strumento === "rettangolo"
          ? `Rettangolo: trascina da un angolo all'altro per ${copri ? "coprire una zona" : "svelare una stanza"}.`
          : `Pennello: trascina sulla mappa per ${copri ? "coprire" : "svelare"}. I giocatori vedono subito.`;
    if (strumento !== "mano" && !attiva) scegliStrumento("mano");
  }

  function scegliStrumento(nuovo) {
    strumento = nuovo;
    if (nuovo !== "mano" && strumentoMappa !== "mano") scegliStrumentoMappa("mano");
    if (nuovo === "mano") {
      vista.modoNebbia(null);
      vista.anteprimaRettangolo(null);
    } else {
      annullaTaratura();
      vista.modoNebbia(nuovo === "rettangolo" ? gestoriRettangolo() : gestoriPennello(nuovo === "pennello3" ? 3 : 1));
    }
    aggiornaPannelloNebbia();
  }

  function gestoriPennello(lato) {
    const dipingi = (casella) => modificaNebbia(cambiaCelle(nebbia, casellePennello(casella, lato), copri), salvaNebbiaPresto);
    return {
      inizio(casella) {
        if (!nebbia) return;
        tracciando = true;
        memorizzaNebbia();
        dipingi(casella);
      },
      muovi(casella) {
        if (nebbia) dipingi(casella);
      },
      fine() {
        tracciando = false;
        salvaNebbiaOra();
      },
    };
  }

  function gestoriRettangolo() {
    let inizio = null;
    return {
      inizio(casella) {
        inizio = casella;
        vista.anteprimaRettangolo(casella, casella, copri);
      },
      muovi(casella) {
        if (inizio) vista.anteprimaRettangolo(inizio, casella, copri);
      },
      fine(casella) {
        vista.anteprimaRettangolo(null);
        if (!inizio || !nebbia) return;
        memorizzaNebbia();
        modificaNebbia(cambiaCelle(nebbia, caselleRettangolo(inizio, casella), copri));
        inizio = null;
      },
    };
  }

  apriNebbia.addEventListener("click", () => {
    pannelloNebbia.hidden = !pannelloNebbia.hidden;
    apriNebbia.setAttribute("aria-expanded", String(!pannelloNebbia.hidden));
    if (pannelloNebbia.hidden) scegliStrumento("mano");
    else aggiornaPannelloNebbia();
  });
  strumenti.addEventListener("click", (evento) => {
    const voce = evento.target.closest("button")?.dataset.voce;
    if (voce) scegliStrumento(voce);
  });
  effetti.addEventListener("click", (evento) => {
    const voce = evento.target.closest("button")?.dataset.voce;
    if (!voce) return;
    copri = voce === "copri";
    if (strumento !== "mano") scegliStrumento(strumento);
    else aggiornaPannelloNebbia();
  });
  inputAttiva.addEventListener("change", () => {
    const dim = dimensioniNebbiaAttuali();
    if (!dim) return;
    memorizzaNebbia();
    // Prima accensione: mappa tutta coperta; poi si conserva quanto svelato.
    modificaNebbia(nebbia ? { ...nebbia, attiva: inputAttiva.checked } : creaNebbia(dim, true, inputAttiva.checked));
  });
  annullaNebbia.addEventListener("click", () => {
    const precedente = storiaNebbia.pop();
    if (precedente && nebbia) modificaNebbia({ ...nebbia, ...precedente });
  });
  svelaTutto.addEventListener("click", () => {
    if (!nebbia) return;
    memorizzaNebbia();
    modificaNebbia({ ...nebbia, celle: nebbia.celle.slice().fill(0) });
  });
  copriTutto.addEventListener("click", () => {
    if (!nebbia) return;
    memorizzaNebbia();
    modificaNebbia({ ...nebbia, celle: nebbia.celle.slice().fill(1) });
  });
  torcia.addEventListener("click", () => {
    if (!nebbia) return;
    const r = Number(raggio.value) || 6;
    const caselle = pedineSalvate.filter((p) => p.tipo !== "nemico").flatMap((p) => caselleCerchio({ c: Math.round(p.c), r: Math.round(p.r) }, r));
    if (!caselle.length) {
      mostraSuggerimento("Nessun personaggio sulla mappa.");
      return;
    }
    memorizzaNebbia();
    modificaNebbia(cambiaCelle(nebbia, caselle, false));
  });
  inputCome.addEventListener("change", () => {
    comeGiocatori = inputCome.checked;
    ridisegnaPedine();
  });

  // Pannello della griglia (DM): visibile, aggancio, lato e scarto, taratura.
  const pannelloGriglia = creaElemento("div", "mappa-griglia-pannello");
  pannelloGriglia.hidden = true;
  const casella = (testo) => {
    const label = creaElemento("label", "mappa-campo");
    const input = creaElemento("input");
    input.type = "checkbox";
    label.append(input, document.createTextNode(` ${testo}`));
    return { label, input };
  };
  const cursore = (testo, min, max, passo) => {
    const label = creaElemento("label", "mappa-campo");
    const range = creaElemento("input");
    Object.assign(range, { type: "range", min, max, step: passo });
    const numero = creaElemento("input", "input-dadi mappa-numero");
    Object.assign(numero, { type: "number", min, max, step: passo });
    numero.setAttribute("aria-label", testo);
    label.append(document.createTextNode(`${testo} `), range, numero);
    return { label, range, numero };
  };
  const visibile = casella("Mostra la griglia");
  const snap = casella("Aggancia le pedine");
  const lato = cursore("Lato (px)", 10, 300, 0.5);
  const scartoX = cursore("Scarto X", 0, 300, 0.5);
  const scartoY = cursore("Scarto Y", 0, 300, 0.5);
  const tara = creaElemento("div", "mappa-taratura");
  const bottoneTara = bottone("Taratura con due clic");
  const quanteCaselle = creaElemento("input", "input-dadi mappa-numero");
  Object.assign(quanteCaselle, { type: "number", min: 1, max: 30, value: 1 });
  quanteCaselle.setAttribute("aria-label", "Caselle per lato del blocco misurato");
  const testoTara = creaElemento("span", "mappa-taratura-testo", "su un blocco di");
  const testoCaselle = creaElemento("span", "mappa-taratura-testo", "× stesse caselle");
  const annullaTara = bottone("Annulla");
  annullaTara.hidden = true;
  tara.append(bottoneTara, testoTara, quanteCaselle, testoCaselle, annullaTara);
  const aiuto = creaElemento("p", "mappa-aiuto",
    "Taratura: clicca un angolo di una casella disegnata sulla mappa, poi l'angolo opposto (di quella casella o di un blocco più grande, indicando quante caselle per lato). Lato e scarto si calcolano da soli.");
  pannelloGriglia.append(visibile.label, snap.label, lato.label, scartoX.label, scartoY.label, tara, aiuto);
  pannello.append(pannelloGriglia);

  apriGriglia.addEventListener("click", () => {
    pannelloGriglia.hidden = !pannelloGriglia.hidden;
    apriGriglia.setAttribute("aria-expanded", String(!pannelloGriglia.hidden));
    if (pannelloGriglia.hidden) annullaTaratura();
  });

  let timerSalva = null;
  function cambiaGriglia(modifiche) {
    if (!griglia || !mappaId) return;
    griglia = { ...griglia, ...modifiche };
    griglia.ox = Math.min(griglia.ox, griglia.lato);
    griglia.oy = Math.min(griglia.oy, griglia.lato);
    ricalcolaNebbia();
    vista.impostaGriglia(griglia);
    condivisi.ridisegna();
    aggiornaPannelloGriglia();
    clearTimeout(timerSalva);
    const id = mappaId;
    const daSalvare = { ...griglia };
    timerSalva = setTimeout(() => {
      salvaGriglia(campagnaId, id, daSalvare).catch((errore) => {
        console.error(errore);
        avviso("Impossibile salvare la griglia.", true);
      });
    }, 400);
  }

  visibile.input.addEventListener("change", () => cambiaGriglia({ visibile: visibile.input.checked }));
  snap.input.addEventListener("change", () => cambiaGriglia({ snap: snap.input.checked }));
  for (const [campo, controllo] of [["lato", lato], ["ox", scartoX], ["oy", scartoY]]) {
    const leggi = (input) => {
      const valore = Number(input.value);
      if (Number.isFinite(valore) && valore >= 0) cambiaGriglia({ [campo]: campo === "lato" ? Math.max(10, valore) : valore });
    };
    controllo.range.addEventListener("input", () => leggi(controllo.range));
    controllo.numero.addEventListener("change", () => leggi(controllo.numero));
  }

  function aggiornaPannelloGriglia() {
    if (!griglia) return;
    visibile.input.checked = griglia.visibile;
    snap.input.checked = griglia.snap;
    const imposta = (controllo, valore, massimo) => {
      controllo.range.max = massimo;
      controllo.numero.max = massimo;
      controllo.range.value = valore;
      if (document.activeElement !== controllo.numero) controllo.numero.value = valore;
    };
    imposta(lato, griglia.lato, Math.max(300, griglia.lato));
    imposta(scartoX, griglia.ox, griglia.lato);
    imposta(scartoY, griglia.oy, griglia.lato);
  }

  let primoPunto = null;
  function annullaTaratura() {
    primoPunto = null;
    vista.modoTaratura(null);
    bottoneTara.hidden = false;
    annullaTara.hidden = true;
    suggerimento.hidden = true;
  }
  annullaTara.addEventListener("click", annullaTaratura);
  bottoneTara.addEventListener("click", () => {
    bottoneTara.hidden = true;
    annullaTara.hidden = false;
    mostraSuggerimento("Clicca un angolo di una casella della mappa.", 0);
    vista.modoTaratura((punto) => {
      if (!primoPunto) {
        primoPunto = punto;
        const n = Number(quanteCaselle.value) || 1;
        mostraSuggerimento(n > 1 ? `Ora clicca l'angolo opposto del blocco di ${n}×${n} caselle.` : "Ora clicca l'angolo opposto della stessa casella.", 0);
        return;
      }
      const risultato = taratura(primoPunto, punto, Number(quanteCaselle.value) || 1);
      annullaTaratura();
      if (!risultato) {
        mostraSuggerimento("Punti troppo vicini: riprova.");
        return;
      }
      cambiaGriglia(risultato);
      mostraSuggerimento(`Griglia tarata: lato ${formattaMetri(risultato.lato)} px.`);
    });
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && primoPunto !== null) annullaTaratura();
  });

  // ---------- strumenti di tutti: righello, ping, aree ----------
  let strumentoMappa = "mano"; // mano, righello, ping, area
  const barraStrumenti = creaElemento("div", "mappa-strumenti-barra");
  barraStrumenti.hidden = true;
  const gruppoStrumenti = gruppo([["mano", "Mano"], ["righello", "Righello"], ["ping", "Ping"], ["area", "Area"]]);
  gruppoStrumenti.setAttribute("aria-label", "Strumenti della mappa");
  const opzioniArea = creaElemento("span", "mappa-area-opzioni");
  opzioniArea.hidden = true;
  const sceltaIncantesimo = creaElemento("select", "select-dadi");
  sceltaIncantesimo.setAttribute("aria-label", "Incantesimo");
  const sceltaForma = creaElemento("select", "select-dadi");
  sceltaForma.setAttribute("aria-label", "Forma dell'area");
  sceltaForma.replaceChildren(...FORME_AREA.map((f) => new Option(f.nome, f.chiave)));
  const sceltaMisura = creaElemento("select", "select-dadi");
  sceltaMisura.setAttribute("aria-label", "Misura dell'area");
  sceltaMisura.replaceChildren(...MISURE_AREA.map((m) => new Option(`${formattaMetri(m)} m`, String(m))));
  sceltaMisura.value = "6";
  opzioniArea.append(sceltaIncantesimo, sceltaForma, sceltaMisura);
  const mioColore = creaElemento("span", "mappa-campo");
  const aiutoStrumenti = creaElemento("p", "mappa-aiuto");
  barraStrumenti.append(gruppoStrumenti, opzioniArea, creaElemento("span", "mappa-spazio"), mioColore, aiutoStrumenti);
  const elencoAree = creaElemento("div", "mappa-aree-elenco");
  elencoAree.hidden = true;
  pannello.insertBefore(barraStrumenti, area);
  pannello.insertBefore(elencoAree, area);

  // Incantesimi con un'area del proprio personaggio (giocatori).
  let mieAree = [];
  let schedaAree = null;
  async function caricaMieAree() {
    if (isDM) return;
    const schedaId = party().find((r) => r.uid === uid)?.schedaId || null;
    if (schedaId === schedaAree) return;
    schedaAree = schedaId;
    mieAree = [];
    if (schedaId) {
      try {
        mieAree = areeDellaScheda(await ottieniScheda(schedaId));
      } catch (errore) {
        console.error(errore);
      }
    }
    aggiornaSceltaIncantesimo();
  }
  function aggiornaSceltaIncantesimo() {
    const prima = sceltaIncantesimo.value;
    sceltaIncantesimo.replaceChildren(
      ...mieAree.map((i) => new Option(`${i.nome} (${FORME_AREA.find((f) => f.chiave === i.forma)?.nome.toLowerCase()} ${formattaMetri(i.misura)} m)`, i.chiave)),
      new Option("A mano…", ""),
    );
    // Si parte dal primo incantesimo, finché il giocatore non sceglie altro.
    const tenuta = mieAree.some((i) => i.chiave === prima) || (prima === "" && sceltaIncantesimo.dataset.scelto);
    sceltaIncantesimo.value = tenuta ? prima : mieAree[0]?.chiave || "";
    aggiornaBarraStrumenti();
  }

  const nomeForma = (forma) => FORME_AREA.find((f) => f.chiave === forma)?.nome || forma;
  function areaScelta() {
    const incantesimo = !isDM && mieAree.find((i) => i.chiave === sceltaIncantesimo.value);
    if (incantesimo) return { nome: incantesimo.nome, forma: incantesimo.forma, misura: incantesimo.misura };
    const misura = Number(sceltaMisura.value) || 6;
    return { nome: `${nomeForma(sceltaForma.value)} ${formattaMetri(misura)} m`, forma: sceltaForma.value, misura };
  }

  const AIUTI_STRUMENTI = {
    mano: "Mano: trascina lo sfondo per spostarti e la tua pedina per muoverla.",
    righello: "Righello: trascina da una casella all'altra. Tutti vedono la misura finché tieni premuto.",
    ping: "Ping: tocca un punto per dire «guardate qui!».",
    area: "Area: premi su un incrocio della griglia e trascina per orientarla (la sfera si sposta). Le caselle colpite si illuminano per tutti.",
  };
  function aggiornaBarraStrumenti() {
    barraStrumenti.hidden = !mappaId;
    for (const b of gruppoStrumenti.querySelectorAll("button")) {
      const scelto = b.dataset.voce === strumentoMappa;
      b.classList.toggle("btn-tabella-evidenza", scelto);
      b.setAttribute("aria-pressed", String(scelto));
    }
    opzioniArea.hidden = strumentoMappa !== "area";
    sceltaIncantesimo.hidden = isDM;
    const aMano = isDM || !sceltaIncantesimo.value;
    sceltaForma.hidden = sceltaMisura.hidden = !aMano;
    const pallino = creaElemento("span", "mappa-colore");
    pallino.style.setProperty("--colore", condivisi.colore(uid));
    mioColore.replaceChildren(pallino, document.createTextNode("Il tuo colore"));
    aiutoStrumenti.textContent = AIUTI_STRUMENTI[strumentoMappa];
  }

  function scegliStrumentoMappa(nuovo) {
    strumentoMappa = nuovo;
    if (nuovo !== "mano") {
      if (strumento !== "mano") scegliStrumento("mano");
      annullaTaratura();
    }
    vista.modoPunti(nuovo === "righello" ? gestoriRighello() : nuovo === "ping" ? gestoriPing() : nuovo === "area" ? gestoriArea() : null);
    aggiornaBarraStrumenti();
  }

  const tondo = (n) => Math.round(n * 10) / 10;
  function errore(testo) {
    return (e) => {
      console.error(e);
      avviso(testo, true);
    };
  }

  // Righello: da centro a centro delle caselle; gli altri lo ricevono al più
  // ogni 150 ms mentre si trascina, e sparisce al rilascio.
  let righelloInCorso = null;
  let timerRighello = null;
  function inviaRighello() {
    clearTimeout(timerRighello);
    timerRighello = null;
    if (!mappaId) return;
    salvaStrumenti(campagnaId, mappaId, uid, { righello: righelloInCorso }).catch(errore("Impossibile condividere il righello."));
  }
  function gestoriRighello() {
    const centro = (p) => {
      const c = centroCasellaDiPunto(griglia, p);
      return { x: tondo(c.x), y: tondo(c.y) };
    };
    return {
      inizio(p) {
        if (!griglia) return;
        const da = centro(p);
        righelloInCorso = { x1: da.x, y1: da.y, x2: da.x, y2: da.y };
        condivisi.impostaMioRighello(righelloInCorso);
        inviaRighello();
      },
      muovi(p) {
        if (!righelloInCorso) return;
        const a = centro(p);
        if (a.x === righelloInCorso.x2 && a.y === righelloInCorso.y2) return;
        righelloInCorso = { ...righelloInCorso, x2: a.x, y2: a.y };
        condivisi.impostaMioRighello(righelloInCorso);
        if (!timerRighello) timerRighello = setTimeout(inviaRighello, 150);
      },
      fine() {
        if (!righelloInCorso) return;
        righelloInCorso = null;
        condivisi.impostaMioRighello(null);
        inviaRighello();
      },
    };
  }
  window.addEventListener("pagehide", () => {
    if (righelloInCorso) {
      righelloInCorso = null;
      inviaRighello();
    }
  });

  function gestoriPing() {
    return {
      inizio(p) {
        if (!mappaId) return;
        const punto = { x: tondo(p.x), y: tondo(p.y) };
        condivisi.mioPing(punto);
        salvaStrumenti(campagnaId, mappaId, uid, { ping: { ...punto, n: Date.now() } }).catch(errore("Impossibile inviare il ping."));
      },
      muovi() {},
      fine() {},
    };
  }

  // Area: origine su un incrocio della griglia; trascinando si orienta (o si
  // sposta, la sfera). Al rilascio si salva e la vedono tutti.
  function gestoriArea() {
    let bozza = null;
    const vertice = (p) => {
      const v = verticePiuVicino(griglia, p);
      return { x: tondo(v.x), y: tondo(v.y) };
    };
    return {
      inizio(p) {
        if (!griglia) return;
        bozza = { ...areaScelta(), ...vertice(p), angolo: 0 };
        condivisi.impostaBozza(bozza);
      },
      muovi(p) {
        if (!bozza) return;
        if (bozza.forma === "sfera") bozza = { ...bozza, ...vertice(p) };
        else if (Math.hypot(p.x - bozza.x, p.y - bozza.y) > griglia.lato * 0.3) {
          bozza = { ...bozza, angolo: Math.round(Math.atan2(p.y - bozza.y, p.x - bozza.x) * 1000) / 1000 };
        }
        condivisi.impostaBozza(bozza);
      },
      fine(_p, annullato) {
        const finita = bozza;
        bozza = null;
        if (!finita || annullato || !mappaId) {
          condivisi.impostaBozza(null);
          return;
        }
        const dentro = pedineInCaselle(pedineMostrate, caselleArea(finita, griglia)).map((x) => x.nome);
        creaArea(campagnaId, mappaId, uid, finita).catch(errore("Impossibile mettere l'area sulla mappa."));
        condivisi.impostaBozza(null);
        mostraSuggerimento(dentro.length ? `${finita.nome}: dentro ${dentro.join(", ")}.` : `${finita.nome}: nessuno dentro.`, 3000);
      },
    };
  }

  gruppoStrumenti.addEventListener("click", (evento) => {
    const voce = evento.target.closest("button")?.dataset.voce;
    if (voce) scegliStrumentoMappa(voce);
  });
  sceltaIncantesimo.addEventListener("change", () => (sceltaIncantesimo.dataset.scelto = "1"));
  for (const s of [sceltaIncantesimo, sceltaForma, sceltaMisura]) s.addEventListener("change", aggiornaBarraStrumenti);

  // Elenco delle aree sulla mappa: chi le ha messe (o il DM) le toglie.
  const togliTutte = bottone("Togli tutte", "btn-tabella btn-tabella-pericolo");
  togliTutte.addEventListener("click", () => {
    if (mappaId) rimuoviAree(campagnaId, mappaId).catch(errore("Impossibile togliere le aree."));
  });
  function aggiornaElencoAree() {
    const aree = condivisi.aree();
    elencoAree.hidden = !mappaId || aree.length === 0;
    const voci = aree.map((a) => {
      const voce = creaElemento("span", "mappa-area-voce");
      voce.style.setProperty("--colore", condivisi.colore(a.autoreUid));
      const pallino = creaElemento("span", "mappa-colore");
      pallino.style.setProperty("--colore", condivisi.colore(a.autoreUid));
      voce.append(pallino, document.createTextNode(a.nome));
      if (isDM || a.autoreUid === uid) {
        const x = bottone("×", "");
        x.setAttribute("aria-label", `Togli ${a.nome}`);
        x.addEventListener("click", () => rimuoviArea(campagnaId, mappaId, a.id).catch(errore("Impossibile togliere l'area.")));
        voce.append(x);
      }
      return voce;
    });
    elencoAree.replaceChildren(creaElemento("span", "mappa-vassoio-titolo", "Aree"), ...voci);
    if (isDM && aree.length > 1) elencoAree.append(togliTutte);
  }

  // ---------- aggiornamento generale ----------
  function aggiornaScelta() {
    const mappe = mappeLibreria();
    const voci = [new Option(mappe.length ? "Scegli una mappa…" : "Nessuna mappa nella Libreria", "")];
    mappe.forEach((m) => voci.push(new Option(`${m.titolo}${m.id === tavola.immagineId ? " (in tavola)" : ""}`, m.id)));
    scelta.replaceChildren(...voci);
    scelta.value = mappaId && mappe.some((m) => m.id === mappaId) ? mappaId : "";
  }

  function aggiorna() {
    const contenuto = mappaId ? contenutoMappa(mappaId) : null;
    if (isDM) {
      aggiornaScelta();
      const preparazione = mappaId && mappaId !== tavola.immagineId;
      inTavola.hidden = !mappaId || !preparazione;
      togli.hidden = !tavola.immagineId || preparazione;
      mostraATutti.hidden = adatta.hidden = !mappaId;
      mostraATutti.disabled = Boolean(preparazione);
      apriTavolo.hidden = !tavola.immagineId;
      vuoto.hidden = Boolean(mappaId);
      testoVuoto.textContent = mappeLibreria().length
        ? "Nessuna mappa al tavolo: scegline una dall'elenco."
        : "Carica una mappa nella Libreria (categoria «Mappa») per usarla qui.";
      if (preparazione) {
        const titoloTavola = contenutoMappa(tavola.immagineId)?.titolo;
        nastro.hidden = false;
        nastro.textContent = titoloTavola
          ? `In preparazione: al tavolo c'è «${titoloTavola}». I giocatori non vedono questa mappa.`
          : "In preparazione: nessuna mappa al tavolo. I giocatori non vedono questa mappa.";
      } else {
        nastro.hidden = true;
      }
      // Riquadro di ciò che mostra lo schermo del tavolo.
      vista.impostaCornice(mappaId && mappaId === tavola.immagineId && tavola.inquadratura ? tavola.inquadratura : null);
    }
    nomeMappa.textContent = contenuto?.titolo ? ` · ${contenuto.titolo}` : "";
    area.hidden = !mappaId;
    pannello.hidden = !isDM && !tavola.immagineId;
    aggiornaPiede();
    aggiornaNemici();
    aggiornaBarraStrumenti();
    aggiornaElencoAree();
  }

  const smettiTavola = ascoltaTavola(campagnaId, (dati) => {
    const precedente = tavola.immagineId;
    tavola = dati;
    if (isDM) {
      // All'inizio (o se la mappa preparata non esiste più) si parte dalla
      // mappa in tavola; poi il DM resta su quella che sta preparando.
      const esiste = (id) => id && mappeLibreria().some((m) => m.id === id);
      if (mappaId === null) {
        const memorizzata = leggiPreparata();
        mostraMappa(esiste(memorizzata) ? memorizzata : tavola.immagineId || null);
      } else if (precedente !== tavola.immagineId && mappaId === precedente && tavola.immagineId) {
        mostraMappa(tavola.immagineId);
      }
    } else {
      mostraMappa(tavola.immagineId || null);
    }
    aggiorna();
  });

  caricaVelocita();
  caricaMieAree();
  aggiorna();

  return {
    // Chiamato quando cambiano party o Libreria.
    ridisegna() {
      caricaVelocita();
      caricaMieAree();
      ridisegnaPedine();
      condivisi.ridisegna();
      aggiorna();
    },
    // Per il tracker: i nemici nuovi partono nascosti se c'è una mappa in tavola.
    haMappaInTavola: () => Boolean(tavola.immagineId),
    stop() {
      smettiTavola();
      smettiCombattimento();
      smettiNebbia?.();
      smettiGriglia?.();
      smettiPedine?.();
      condivisi.stop();
    },
  };
}
