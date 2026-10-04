// Effetti sonori del sito (tavola "Kit di suoni per il sito" della tela):
// nove suoni sintetizzati nel browser con WebAudio, nessun file audio.
// - Un interruttore e un volume, salvati su questo dispositivo
//   (localStorage, "sd-suoni"); predefinito: attivi, volume 60%. Il volume
//   agisce su un unico nodo master con un compressore leggero.
// - Mai sullo schermo del tavolo e mai a pagina nascosta (lì ci pensano le
//   notifiche push).
// - Il browser lascia suonare solo dopo il primo tocco sulla pagina: il
//   contesto audio nasce lì, e prima nessun suono parte.
// Uso: suona("tocca"), suona("dado", 2.4), suonaTiro(tiro, ritardoMs).

// ---------- Ricette ----------
function bufferRumore(c) {
  if (!c.__rumore) {
    const n = Math.floor(c.sampleRate * 1.5);
    const b = c.createBuffer(1, n, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    c.__rumore = b;
  }
  return c.__rumore;
}

// Un tono con attacco e decadimento esponenziali; "a" = frequenza finale (glissando).
function tono(c, out, t, f, dur, vol, tipo = "sine", o = {}) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(f, t);
  if (o.a) osc.frequency.exponentialRampToValueAtTime(o.a, t + dur);
  const att = o.att ?? 0.01;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

// Un soffio di rumore filtrato (fruscio, click, brillio).
function rumore(c, out, t, dur, vol, o = {}) {
  const src = c.createBufferSource();
  src.buffer = bufferRumore(c);
  src.loop = true;
  const filtro = c.createBiquadFilter();
  filtro.type = o.tipo || "bandpass";
  filtro.frequency.value = o.f || 3000;
  filtro.Q.value = o.q || 1;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + (o.att ?? 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filtro).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

// Campana: parziali non armonici, quelli alti si spengono prima.
function campana(c, out, t, f, dur, vol) {
  [[1, 1], [2.76, 0.5], [5.4, 0.22], [8.93, 0.1]].forEach(([r, a], i) => tono(c, out, t, f * r, dur / (1 + i * 0.6), vol * a, "sine", { att: 0.004 }));
}

export const KIT = {
  // Già nel sito (mappa): riferimento per il volume e il timbro.
  ping(c, out, t) {
    [880, 1320].forEach((f, i) => tono(c, out, t + i * 0.12, f, 0.35, 0.12, "sine", { att: 0.02 }));
    return 0.5;
  },
  // «Tocca a te!»: due campane che salgono (mi5 → si5), calde, non stridule.
  tocca(c, out, t) {
    campana(c, out, t, 659.25, 0.9, 0.2);
    campana(c, out, t + 0.15, 987.77, 1.2, 0.18);
    return 1.4;
  },
  // Nuovo round: gong morbido e basso.
  round(c, out, t) {
    [[1, 1], [2.0, 0.55], [2.76, 0.4], [4.07, 0.2], [5.4, 0.1]].forEach(([r, a], i) => tono(c, out, t, 98 * r, 2.2 / (1 + i * 0.5), 0.28 * a, "sine", { att: 0.015 }));
    rumore(c, out, t, 0.9, 0.08, { tipo: "lowpass", f: 500, q: 0.7, att: 0.02 });
    return 2.3;
  },
  // Contenuto rivelato: pergamena che si srotola piano, in tre tratti con piccole pause
  // (crepitii di carta medio-gravi e radi), poi il sigillo che si imprime con un tonfo
  // ovattato in coincidenza con il badge «Nuovo» (0,62 s), e la carta che si assesta.
  // Nessuna campana.
  rivela(c, out, t) {
    [[0.0, 0.22], [0.26, 0.5], [0.54, 0.76]].forEach(([da, a]) => {
      rumore(c, out, t + da, a - da + 0.04, 0.045, { f: 1000, q: 0.6, att: 0.08 });
      const quanti = 7 + Math.round(Math.random() * 2);
      for (let i = 0; i < quanti; i++) {
        const u = (Math.random() + Math.random()) / 2;
        rumore(c, out, t + da + u * (a - da), 0.02 + Math.random() * 0.025, 0.04 + Math.random() * 0.06, { f: 600 + Math.random() * 1100, q: 1.2, att: 0.004 });
      }
    });
    rumore(c, out, t, 0.7, 0.035, { tipo: "lowpass", f: 400, q: 0.7, att: 0.2 });
    const ts = t + 0.62;
    tono(c, out, ts, 100, 0.26, 0.3, "sine", { a: 50, att: 0.014 });
    tono(c, out, ts + 0.04, 70, 0.22, 0.12, "sine", { a: 45, att: 0.02 });
    rumore(c, out, ts, 0.12, 0.14, { tipo: "lowpass", f: 220, q: 0.7, att: 0.01 });
    // La carta si assesta: due crepitii radi e bassi dopo il sigillo.
    rumore(c, out, ts + 0.14, 0.03, 0.04, { f: 700, q: 1.2, att: 0.004 });
    rumore(c, out, ts + 0.27, 0.04, 0.03, { f: 600, q: 1.2, att: 0.004 });
    return 1.2;
  },
  // Dado che rotola: tanti piccoli colpi sempre più radi, poi due tonfi. Dura quanto l'animazione.
  dado(c, out, t, durata = 2.4) {
    const n = Math.round(10 + durata * 6);
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const tt = t + (durata - 0.45) * Math.pow(u, 1.7);
      rumore(c, out, tt, 0.03, 0.14 * (1 - 0.5 * u) + Math.random() * 0.04, { f: 1800 + Math.random() * 1600, q: 1.2, att: 0.002 });
      tono(c, out, tt, 260 + Math.random() * 160, 0.05, 0.06 * (1 - 0.5 * u), "sine", { att: 0.002 });
    }
    const ts = t + durata - 0.3;
    tono(c, out, ts, 120, 0.12, 0.3, "sine", { a: 70, att: 0.003 });
    rumore(c, out, ts, 0.08, 0.1, { tipo: "lowpass", f: 900, att: 0.003 });
    tono(c, out, ts + 0.11, 100, 0.09, 0.16, "sine", { a: 60, att: 0.003 });
    return durata + 0.3;
  },
  // Passaggio di livello: arpeggio ascendente, accordo che risuona, brillio.
  livello(c, out, t) {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tono(c, out, t + i * 0.1, f, 0.5, 0.11, "triangle", { att: 0.01 }));
    campana(c, out, t + 0.5, 1046.5, 1.2, 0.1);
    campana(c, out, t + 0.5, 783.99, 1.2, 0.08);
    rumore(c, out, t + 0.4, 0.7, 0.035, { tipo: "highpass", f: 7000, att: 0.3 });
    return 1.9;
  },
  // 20 naturale: scala di campanelle acute.
  critico(c, out, t) {
    [1318.5, 1760, 2093, 2637].forEach((f, i) => campana(c, out, t + i * 0.07, f, 0.7, 0.09));
    campana(c, out, t + 0.3, 3520, 0.45, 0.03);
    return 1.1;
  },
  // 1 naturale: nota che scende e tonfo sordo.
  fallito(c, out, t) {
    tono(c, out, t, 196, 0.5, 0.16, "triangle", { a: 130, att: 0.01 });
    tono(c, out, t + 0.12, 90, 0.22, 0.3, "sine", { a: 50, att: 0.004 });
    tono(c, out, t + 0.42, 110, 0.3, 0.1, "triangle", { a: 73, att: 0.01 });
    return 0.9;
  },
};

// Taratura: porta tutti i suoni (tranne il ping, già nel sito) a un picco di circa 0,3,
// così nessuno copre gli altri. Misurata rendendo ogni ricetta offline.
export const TRIM = { ping: 1, tocca: 0.8, round: 0.55, rivela: 0.97, dado: 1.05, dadoRapido: 1.15, livello: 1.1, critico: 1.45, fallito: 1.1 };

const CHIAVE = "sd-suoni";
const PREDEFINITE = { attivi: true, volume: 0.6 };

export function impostazioniSuoni() {
  try {
    const salvate = JSON.parse(localStorage.getItem(CHIAVE) || "null");
    return { ...PREDEFINITE, ...(salvate || {}) };
  } catch {
    return { ...PREDEFINITE };
  }
}

export function salvaImpostazioniSuoni(campi) {
  const nuove = { ...impostazioniSuoni(), ...campi };
  nuove.volume = Math.max(0, Math.min(1, Number(nuove.volume) || 0));
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(nuove));
  } catch {
    // Non salvate: valgono finché la pagina resta aperta.
  }
  if (master) master.gain.value = nuove.volume;
  return nuove;
}

let audio = null;
let master = null;
function preparaAudio() {
  try {
    if (!audio) {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      master = audio.createGain();
      const compressore = audio.createDynamicsCompressor();
      compressore.threshold.value = -14;
      compressore.knee.value = 12;
      compressore.ratio.value = 4;
      compressore.attack.value = 0.004;
      compressore.release.value = 0.2;
      master.connect(compressore).connect(audio.destination);
      master.gain.value = impostazioniSuoni().volume;
    }
    if (audio.state === "suspended") audio.resume().catch(() => {});
  } catch {
    audio = null;
  }
}
const sulTavolo = () => /\/tavolo\.html$/.test(window.location.pathname);
if (typeof document !== "undefined" && !sulTavolo()) {
  for (const evento of ["pointerdown", "keydown"]) document.addEventListener(evento, preparaAudio, { capture: true });
}

// Suona un effetto del kit (id di TRIM: ping, tocca, round, rivela, dado,
// dadoRapido, livello, critico, fallito). Restituisce la durata in secondi,
// o 0 se non ha suonato.
export function suona(id, ...argomenti) {
  if (!audio || audio.state !== "running" || document.hidden || sulTavolo()) return 0;
  if (!impostazioniSuoni().attivi) return 0;
  const ricetta = KIT[id === "dadoRapido" ? "dado" : id];
  if (!ricetta) return 0;
  try {
    const uscita = audio.createGain();
    uscita.gain.value = TRIM[id] ?? 1;
    uscita.connect(master);
    if (id === "dadoRapido" && !argomenti.length) argomenti = [0.9];
    const durata = ricetta(audio, uscita, audio.currentTime + 0.02, ...argomenti);
    // Segnale per le prove nel browser (quale suono è partito).
    document.dispatchEvent(new CustomEvent("sd-suono", { detail: id }));
    return durata;
  } catch {
    return 0;
  }
}

// Un tiro dal lanciatore di dadi o dalla scheda: il dado che rotola e, quando
// compare il risultato (dopo ritardo ms), 20 o 1 naturale.
export function suonaTiro(tiro, ritardo = 900) {
  suona("dadoRapido", Math.max(0.5, ritardo / 1000));
  if (tiro?.critico === "successo" || tiro?.critico === "fallimento") {
    setTimeout(() => suona(tiro.critico === "successo" ? "critico" : "fallito"), ritardo);
  }
}

// Prova dal pannello ⚙️: suona anche se il contesto è appena nato dal tocco.
export function provaSuono() {
  preparaAudio();
  setTimeout(() => suona("tocca"), 60);
}
