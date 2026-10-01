// Impaginazione della scheda in PDF (A4), nello stile dell'app ma leggibile
// anche stampata in bianco e nero: fondo bianco, riquadri color pergamena
// chiara, titoli in Cinzel e testo in EB Garamond. Riceve le librerie
// (pdf-lib, fontkit) e i font già caricati: così funziona sia nella pagina
// (esporta-scheda.js) sia con Node, per le prove.
// schede: [{ vista (calcoli-scheda.js), giocatore, ritratto: { byte, tipo: "png"|"jpg" } | null }]

const A4 = [595.28, 841.89];
const MARGINE = 36;
const LARGHEZZA = A4[0] - 2 * MARGINE;
const FONDO = MARGINE + 22;

export async function creaPdfSchede(schede, { pdfLib, fontkit, font, titoloDocumento = "Scheda personaggio", data = new Date() }) {
  const { PDFDocument, rgb } = pdfLib;
  const C = {
    inchiostro: rgb(0.17, 0.11, 0.06),
    tenue: rgb(0.36, 0.27, 0.18),
    bordeaux: rgb(0.48, 0.12, 0.17),
    oro: rgb(0.6, 0.47, 0.11),
    linea: rgb(0.8, 0.7, 0.48),
    carta: rgb(0.98, 0.95, 0.88),
    bianco: rgb(1, 1, 1),
  };
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(titoloDocumento);
  pdf.setCreator("Sotterranei & Dragoni");
  pdf.setProducer("Sotterranei & Dragoni");
  const F = {
    titolo: await pdf.embedFont(font.titolo, { subset: true }),
    testo: await pdf.embedFont(font.testo, { subset: true }),
    grassetto: await pdf.embedFont(font.grassetto, { subset: true }),
    corsivo: await pdf.embedFont(font.corsivo, { subset: true }),
  };
  // I caratteri che un font non ha (emoji, simboli) non si stampano.
  const caratteri = new Map(Object.entries(F).map(([k, f]) => [k, new Set(f.getCharacterSet())]));
  const pulisci = (testo, chiave) => {
    const insieme = caratteri.get(chiave);
    return Array.from(String(testo ?? "")).map((c) => (c === "\n" || insieme.has(c.codePointAt(0)) ? c : "")).join("");
  };
  const dataTesto = data.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

  let pagina = null;
  let y = 0;
  let numeroPagina = 0;
  const pagine = [];

  function nuovaPagina(intestazione) {
    pagina = pdf.addPage(A4);
    pagine.push({ pagina, intestazione });
    numeroPagina += 1;
    y = A4[1] - MARGINE;
    return pagina;
  }

  function scrivi(testo, x, yy, { font = "testo", size = 10.5, colore = C.inchiostro, allinea = "sinistra", larghezza = 0 } = {}) {
    const t = pulisci(testo, font);
    const f = F[font];
    const w = f.widthOfTextAtSize(t, size);
    const xx = allinea === "centro" ? x + (larghezza - w) / 2 : allinea === "destra" ? x + larghezza - w : x;
    pagina.drawText(t, { x: xx, y: yy, size, font: f, color: colore });
    return w;
  }

  // Spezza il testo in righe che stanno nella larghezza data.
  function righe(testo, larghezza, { font = "testo", size = 10.5 } = {}) {
    const f = F[font];
    const risultato = [];
    for (const paragrafo of pulisci(testo, font).split("\n")) {
      let riga = "";
      for (const parola of paragrafo.split(/\s+/).filter(Boolean)) {
        const prova = riga ? `${riga} ${parola}` : parola;
        if (f.widthOfTextAtSize(prova, size) <= larghezza) riga = prova;
        else {
          if (riga) risultato.push(riga);
          riga = parola;
        }
      }
      risultato.push(riga);
    }
    return risultato;
  }

  function riquadro(x, yAlto, larghezza, altezza, { riempi = C.carta } = {}) {
    pagina.drawRectangle({ x, y: yAlto - altezza, width: larghezza, height: altezza, color: riempi, borderColor: C.linea, borderWidth: 0.8 });
  }

  function titoloSezione(testo, x, yy, larghezza) {
    scrivi(testo.toUpperCase(), x, yy, { font: "titolo", size: 8.5, colore: C.bordeaux });
    pagina.drawLine({ start: { x, y: yy - 4 }, end: { x: x + larghezza, y: yy - 4 }, thickness: 0.6, color: C.oro });
  }

  function pallino(x, yy, pieno) {
    pagina.drawCircle({ x, y: yy + 3.2, size: 2.8, borderColor: C.bordeaux, borderWidth: 0.8, color: pieno ? C.bordeaux : undefined });
  }

  // ---------- Pagina 1 ----------

  async function intestazione(v, giocatore, ritratto) {
    scrivi("SOTTERRANEI & DRAGONI", MARGINE, y - 8, { font: "titolo", size: 8.5, colore: C.oro });
    scrivi(`Scheda personaggio · ${dataTesto}`, MARGINE, y - 8, { size: 9, colore: C.tenue, allinea: "destra", larghezza: LARGHEZZA });
    pagina.drawLine({ start: { x: MARGINE, y: y - 14 }, end: { x: MARGINE + LARGHEZZA, y: y - 14 }, thickness: 0.8, color: C.oro });
    y -= 22;
    const lato = 76;
    let larghezzaTesto = LARGHEZZA;
    if (ritratto) {
      try {
        const immagine = ritratto.tipo === "png" ? await pdf.embedPng(ritratto.byte) : await pdf.embedJpg(ritratto.byte);
        const xR = MARGINE + LARGHEZZA - lato;
        pagina.drawImage(immagine, { x: xR, y: y - lato, width: lato, height: lato });
        pagina.drawRectangle({ x: xR, y: y - lato, width: lato, height: lato, borderColor: C.oro, borderWidth: 1.2 });
        larghezzaTesto -= lato + 12;
      } catch {
        // Ritratto non leggibile: la scheda si stampa senza.
      }
    }
    const nome = righe(v.nome, larghezzaTesto, { font: "titolo", size: 24 })[0];
    scrivi(nome, MARGINE, y - 24, { font: "titolo", size: 24, colore: C.bordeaux });
    scrivi(`${v.classe} ${v.livello} · ${v.razza}`, MARGINE, y - 44, { font: "grassetto", size: 12.5 });
    scrivi(`Background: ${v.background} · Allineamento: ${v.allineamento}`, MARGINE, y - 60, { size: 10.5, colore: C.tenue });
    if (giocatore) scrivi(`Giocatore: ${giocatore}`, MARGINE, y - 74, { size: 10.5, colore: C.tenue });
    y -= ritratto ? Math.max(lato, 80) + 10 : 88;
  }

  function caratteristiche(v) {
    const gap = 8;
    const w = (LARGHEZZA - gap * 5) / 6;
    const h = 62;
    v.caratteristiche.forEach((c, i) => {
      const x = MARGINE + i * (w + gap);
      riquadro(x, y, w, h);
      scrivi(c.nome.toUpperCase(), x, y - 13, { font: "titolo", size: 7, colore: C.bordeaux, allinea: "centro", larghezza: w });
      scrivi(c.mod, x, y - 38, { font: "grassetto", size: 21, allinea: "centro", larghezza: w });
      pagina.drawEllipse({ x: x + w / 2, y: y - 51, xScale: 13, yScale: 7.5, color: C.bianco, borderColor: C.oro, borderWidth: 0.7 });
      scrivi(String(c.punteggio), x, y - 54.5, { size: 9.5, allinea: "centro", larghezza: w });
    });
    y -= h + 10;
  }

  function combattimento(v) {
    const valori = [
      ["Classe Armatura", String(v.ca)],
      ["Iniziativa", v.iniziativa],
      ["Velocità", v.velocita],
      ["Punti Ferita", `${v.pf.attuali} / ${v.pf.massimi}${v.pf.temporanei ? ` (+${v.pf.temporanei})` : ""}`],
      ["Dadi Vita", v.dadiVita],
      ["Competenza", v.bonusCompetenza],
      ["Perc. passiva", String(v.percezionePassiva)],
    ];
    const gap = 6;
    const w = (LARGHEZZA - gap * (valori.length - 1)) / valori.length;
    const h = 42;
    valori.forEach(([etichetta, valore], i) => {
      const x = MARGINE + i * (w + gap);
      riquadro(x, y, w, h);
      const size = F.grassetto.widthOfTextAtSize(valore, 15) > w - 6 ? 11 : 15;
      scrivi(valore, x, y - 21, { font: "grassetto", size, allinea: "centro", larghezza: w });
      scrivi(etichetta.toUpperCase(), x, y - 35, { font: "titolo", size: 5.8, colore: C.bordeaux, allinea: "centro", larghezza: w });
    });
    y -= h + 14;
  }

  function colonnaSinistra(v, x, w) {
    let yy = y;
    titoloSezione("Tiri salvezza", x, yy, w);
    yy -= 17;
    v.salvezze.forEach((s) => {
      pallino(x + 3, yy, s.competente);
      scrivi(s.nome, x + 11, yy, { size: 10 });
      scrivi(s.valore, x, yy, { font: "grassetto", size: 10, allinea: "destra", larghezza: w });
      yy -= 13.5;
    });
    yy -= 8;
    titoloSezione("Abilità", x, yy, w);
    yy -= 17;
    v.abilita.forEach((a) => {
      pallino(x + 3, yy, a.competente);
      scrivi(`${a.nome} (${a.abbr})`, x + 11, yy, { size: 10 });
      scrivi(a.valore, x, yy, { font: "grassetto", size: 10, allinea: "destra", larghezza: w });
      yy -= 13.5;
    });
    return yy;
  }

  // Blocchi a flusso (colonna destra della prima pagina e pagine seguenti):
  // ognuno è un titolo e una lista di righe; ciò che non entra va avanti.
  function blocchiDestra(v) {
    const blocchi = [];
    if (v.attacchi.length) {
      blocchi.push({ titolo: "Attacchi", tabella: v.attacchi.map((a) => [a.nome, a.bonus, a.danno]) });
    }
    if (v.privilegi.length) {
      blocchi.push({ titolo: "Privilegi di classe", voci: v.privilegi.map((p) => `${p.nome}: ${p.usi}${p.ricarica ? ` (${p.ricarica})` : ""}`) });
    }
    if (v.talenti.length) blocchi.push({ titolo: "Caratteristiche e talenti", voci: v.talenti });
    const stato = [];
    if (v.condizioni.length) stato.push(`Condizioni: ${v.condizioni.join(", ")}`);
    if (v.esaurimento) stato.push(`Esaurimento: livello ${v.esaurimento}`);
    if (stato.length) blocchi.push({ titolo: "Stato", voci: stato });
    return blocchi;
  }

  // Disegna un blocco tra yInizio e yMinimo; restituisce { y, resto } dove
  // resto è il blocco con le voci che non sono entrate (o null).
  function disegnaBlocco(blocco, x, w, yInizio, yMinimo) {
    let yy = yInizio;
    if (yy - 30 < yMinimo) return { y: yy, resto: blocco };
    titoloSezione(blocco.titolo, x, yy, w);
    yy -= 17;
    if (blocco.tabella) {
      const col = [w * 0.46, w * 0.16, w * 0.38];
      scrivi("Nome", x, yy, { font: "corsivo", size: 9, colore: C.tenue });
      scrivi("Attacco", x + col[0], yy, { font: "corsivo", size: 9, colore: C.tenue });
      scrivi("Danno", x + col[0] + col[1], yy, { font: "corsivo", size: 9, colore: C.tenue });
      yy -= 14;
      for (let i = 0; i < blocco.tabella.length; i++) {
        if (yy < yMinimo) return { y: yy, resto: { ...blocco, titolo: `${blocco.titolo} (segue)`, tabella: blocco.tabella.slice(i) } };
        const [nome, bonus, danno] = blocco.tabella[i];
        scrivi(righe(nome, col[0] - 6, { size: 10 })[0], x, yy, { size: 10 });
        scrivi(bonus, x + col[0], yy, { font: "grassetto", size: 10 });
        scrivi(righe(danno, col[2], { size: 10 })[0], x + col[0] + col[1], yy, { size: 10 });
        yy -= 13.5;
      }
      return { y: yy - 8, resto: null };
    }
    for (let i = 0; i < blocco.voci.length; i++) {
      const linee = righe(blocco.voci[i], w - 10, { size: 10 });
      if (yy - (linee.length - 1) * 12.5 < yMinimo) return { y: yy, resto: { ...blocco, titolo: `${blocco.titolo} (segue)`, voci: blocco.voci.slice(i) } };
      linee.forEach((linea, j) => {
        if (j === 0) pagina.drawCircle({ x: x + 2.5, y: yy + 3.4, size: 1.4, color: C.oro });
        scrivi(linea, x + 10, yy, { size: 10 });
        yy -= 12.5;
      });
      yy -= 1.5;
    }
    return { y: yy - 8, resto: null };
  }

  // ---------- Pagine seguenti: blocchi a tutta larghezza ----------

  function blocchiSeguenti(v) {
    const blocchi = [];
    const i = v.incantesimi;
    if (i) {
      const lista = (elenco) => elenco.map((x) => (x.livello ? `${x.nome} (${x.livello}°)` : x.nome));
      blocchi.push({
        titolo: "Incantesimi",
        voci: [`Caratteristica: ${i.caratteristica} · Attacco con incantesimi ${i.attacco} · CD dei tiri salvezza ${i.cd}`, `Slot incantesimo: ${i.slot}`],
        semplice: true,
      });
      if (i.trucchetti.length) blocchi.push({ titolo: "Trucchetti", colonne: lista(i.trucchetti) });
      if (i.conosciuti.length) blocchi.push({ titolo: i.titoloConosciuti, colonne: lista(i.conosciuti) });
      if (i.preparati.length) blocchi.push({ titolo: "Preparati", colonne: lista(i.preparati) });
    }
    const m = v.monete;
    blocchi.push({
      titolo: "Equipaggiamento",
      voci: [`Monete: ${m.platino || 0} mp · ${m.oro || 0} mo · ${m.elettro || 0} me · ${m.argento || 0} ma · ${m.rame || 0} mr`, v.indossati],
      semplice: true,
    });
    if (v.inventario.length) blocchi.push({ titolo: "Inventario", colonne: v.inventario.map((o) => (o.quantita > 1 ? `${o.nome} ×${o.quantita}` : o.nome)) });
    const p = v.personalita;
    blocchi.push({
      titolo: "Personalità",
      riquadri: [["Tratti", p.tratti], ["Ideali", p.ideali], ["Legami", p.legami], ["Difetti", p.difetti]],
    });
    if (v.competenzeLinguaggi.trim()) blocchi.push({ titolo: "Competenze e linguaggi", testo: v.competenzeLinguaggi });
    return blocchi;
  }

  function spazio(altezza) {
    if (y - altezza < FONDO) {
      nuovaPagina(true);
      intestazioneBreve();
    }
  }

  let vistaCorrente = null;
  function intestazioneBreve() {
    scrivi(vistaCorrente.nome, MARGINE, y - 8, { font: "titolo", size: 11, colore: C.bordeaux });
    scrivi(`${vistaCorrente.classe} ${vistaCorrente.livello} · ${vistaCorrente.razza}`, MARGINE, y - 8, { size: 9.5, colore: C.tenue, allinea: "destra", larghezza: LARGHEZZA });
    pagina.drawLine({ start: { x: MARGINE, y: y - 14 }, end: { x: MARGINE + LARGHEZZA, y: y - 14 }, thickness: 0.8, color: C.oro });
    y -= 32;
  }

  function disegnaSeguente(blocco) {
    if (blocco.colonne) {
      const colonne = 3;
      const w = (LARGHEZZA - 16) / colonne;
      const perColonna = Math.ceil(blocco.colonne.length / colonne);
      spazio(30 + Math.min(perColonna, 4) * 13);
      titoloSezione(blocco.titolo, MARGINE, y, LARGHEZZA);
      y -= 17;
      for (let r = 0; r < perColonna; r++) {
        spazio(14);
        for (let c = 0; c < colonne; c++) {
          const voce = blocco.colonne[c * perColonna + r];
          if (!voce) continue;
          const x = MARGINE + c * (w + 8);
          pagina.drawCircle({ x: x + 2.5, y: y + 3.4, size: 1.4, color: C.oro });
          scrivi(righe(voce, w - 12, { size: 10 })[0], x + 10, y, { size: 10 });
        }
        y -= 13;
      }
      y -= 10;
      return;
    }
    if (blocco.riquadri) {
      spazio(30);
      titoloSezione(blocco.titolo, MARGINE, y, LARGHEZZA);
      y -= 12;
      const w = (LARGHEZZA - 10) / 2;
      for (let r = 0; r < blocco.riquadri.length; r += 2) {
        const coppia = blocco.riquadri.slice(r, r + 2).map(([titolo, testo]) => ({ titolo, linee: righe(testo || "—", w - 16, { size: 10 }) }));
        const h = 26 + Math.max(...coppia.map((c) => c.linee.length)) * 12.5;
        spazio(h + 8);
        coppia.forEach((c, i) => {
          const x = MARGINE + i * (w + 10);
          riquadro(x, y, w, h);
          scrivi(c.titolo.toUpperCase(), x + 8, y - 13, { font: "titolo", size: 7, colore: C.bordeaux });
          c.linee.forEach((linea, j) => scrivi(linea, x + 8, y - 27 - j * 12.5, { size: 10, colore: linea === "—" ? C.tenue : C.inchiostro }));
        });
        y -= h + 8;
      }
      y -= 6;
      return;
    }
    const linee = blocco.testo != null ? righe(blocco.testo, LARGHEZZA, { size: 10 }) : blocco.voci.flatMap((v) => righe(v, LARGHEZZA, { size: 10 }));
    spazio(30 + Math.min(linee.length, 3) * 12.5);
    titoloSezione(blocco.titolo, MARGINE, y, LARGHEZZA);
    y -= 17;
    for (const linea of linee) {
      spazio(13);
      scrivi(linea, MARGINE, y, { size: 10 });
      y -= 12.5;
    }
    y -= 10;
  }

  // ---------- Una scheda ----------
  for (const { vista: v, giocatore, ritratto } of schede) {
    vistaCorrente = v;
    nuovaPagina(false);
    await intestazione(v, giocatore, ritratto);
    caratteristiche(v);
    combattimento(v);
    const wSinistra = 178;
    const xDestra = MARGINE + wSinistra + 22;
    const wDestra = LARGHEZZA - wSinistra - 22;
    colonnaSinistra(v, MARGINE, wSinistra);
    let yDestra = y;
    const rimasti = [];
    for (const blocco of blocchiDestra(v)) {
      if (rimasti.length) {
        rimasti.push(blocco);
        continue;
      }
      const esito = disegnaBlocco(blocco, xDestra, wDestra, yDestra, FONDO);
      yDestra = esito.y;
      if (esito.resto) rimasti.push(esito.resto);
    }
    nuovaPagina(true);
    intestazioneBreve();
    for (const blocco of rimasti) {
      // I blocchi rimasti dalla prima pagina, a tutta larghezza.
      if (blocco.tabella) disegnaSeguente({ titolo: blocco.titolo, voci: blocco.tabella.map(([n, b, d]) => `${n}: ${b}, ${d}`) });
      else disegnaSeguente(blocco);
    }
    for (const blocco of blocchiSeguenti(v)) disegnaSeguente(blocco);
  }

  // Piè di pagina con il numero di pagina.
  pagine.forEach(({ pagina: p }, i) => {
    pagina = p;
    scrivi(`Sotterranei & Dragoni · esportata il ${dataTesto}`, MARGINE, MARGINE - 8, { size: 8, colore: C.tenue });
    scrivi(`${i + 1} / ${pagine.length}`, MARGINE, MARGINE - 8, { size: 8, colore: C.tenue, allinea: "destra", larghezza: LARGHEZZA });
  });
  return pdf.save();
}
