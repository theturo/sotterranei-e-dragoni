// Pannello Mappa della pagina Sessione (sopra gli appunti).
// - DM: sceglie quale mappa della Libreria preparare (categoria "Mappa"), ne
//   regola la griglia (anche con la taratura a due clic), la mette in tavola,
//   piazza il party, muove tutte le pedine e con "Mostra qui a tutti" decide
//   cosa inquadra lo schermo comune (tavolo.html, aperto da "Schermo del tavolo").
// - Giocatore: vede la mappa in tavola, si sposta e fa zoom, muove solo la
//   propria pedina ("Entra in mappa" se non c'è ancora).
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
  ottieniScheda,
} from "./auth.js";
import { urlImmagine, percorsiImmagineCampagna } from "./immagini.js";
import { creaElemento } from "./contenuti.js";
import { velocitaRazza } from "./dati-srd.js";
import { creaVistaMappa } from "./mappa-vista.js";
import { pedineDaParty, creaCacheRitratti } from "./mappa-pedine.js";
import { taratura, caselleLibereIntorno, METRI_PER_CASELLA, formattaMetri } from "./mappa-calcoli.js";

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

export function montaMappa({ pannello, campagnaId, uid, isDM, party, libreria, membri, avviso }) {
  const intestazione = creaElemento("div", "sessione-appunti-intestazione mappa-intestazione");
  const titolo = creaElemento("h3", null, "Mappa");
  const nomeMappa = creaElemento("span", "mappa-nome");
  titolo.append(nomeMappa);
  const comandi = creaElemento("div", "azioni-intestazione mappa-comandi");
  intestazione.append(titolo, comandi);
  const nastro = creaElemento("p", "mappa-nastro");
  nastro.hidden = true;
  const area = creaElemento("div", "mappa-area");
  const sovrapposti = creaElemento("div", "mappa-sovrapposti");
  const piede = creaElemento("div", "mappa-piede");
  pannello.replaceChildren(intestazione, nastro, area, piede);

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
  const velocita = new Map(); // schedaId -> metri
  const ritratto = creaCacheRitratti(() => ridisegnaPedine());

  const vista = creaVistaMappa(area, {
    puoMuovere: (id) => isDM || id === uid,
    velocita: (id) => {
      const r = party().find((x) => x.uid === id);
      return r?.schedaId ? velocita.get(r.schedaId) ?? null : null;
    },
    onSposta: async (id, casella) => {
      try {
        await salvaPedina(campagnaId, mappaId, id, casella);
      } catch (errore) {
        console.error(errore);
        avviso("Impossibile spostare la pedina.", true);
      }
    },
    onSeleziona: (id) => {
      selezionata = id;
      aggiornaPiede();
    },
    avviso: (testo) => mostraSuggerimento(testo),
  });
  area.append(sovrapposti);

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
  const centra = bottone("◎ Centra su di me", "mappa-centra");
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
  function ridisegnaPedine() {
    if (!mappaId) return;
    vista.impostaPedine(pedineDaParty({ party: party(), pedine: pedineSalvate, mioUid: uid, ritratto }));
    if (daCentrare && vista.centraSu(uid)) daCentrare = false;
    aggiornaPiede();
  }

  async function mostraMappa(id) {
    if (id === mappaId) return;
    smettiGriglia?.();
    smettiPedine?.();
    smettiGriglia = smettiPedine = null;
    mappaId = id;
    griglia = null;
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
    });
    smettiPedine = ascoltaPedine(campagnaId, id, (elenco) => {
      pedineSalvate = elenco;
      ridisegnaPedine();
    });
    try {
      const immagine = await caricaMappa(campagnaId, id);
      if (turno !== caricamento) return;
      vista.impostaMappa(immagine);
      ridisegnaPedine();
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
      await rimuoviPedina(campagnaId, mappaId, selezionata);
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
    const nome = selezionata && party().find((r) => r.uid === selezionata)?.nomePersonaggio;
    infoSelezione.hidden = rimuovi.hidden = !isDM || !selezionata;
    infoSelezione.textContent = nome || "";
    apriGriglia.hidden = !isDM || !mappaId;
    scala.hidden = !mappaId;
    centra.hidden = isDM || !pedineSalvate.some((p) => (p.uid || p.id) === uid);
  }

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
    vista.impostaGriglia(griglia);
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
      if (!mappeLibreria().length) {
        nastro.hidden = false;
        nastro.textContent = "Carica una mappa nella Libreria (categoria «Mappa») per usarla qui.";
      } else if (preparazione) {
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
  aggiorna();

  return {
    // Chiamato quando cambiano party o Libreria.
    ridisegna() {
      caricaVelocita();
      ridisegnaPedine();
      aggiorna();
    },
    stop() {
      smettiTavola();
      smettiGriglia?.();
      smettiPedine?.();
    },
  };
}
