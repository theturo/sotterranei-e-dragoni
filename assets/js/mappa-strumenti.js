// Strumenti della mappa che vedono tutti (fase 4), condivisi da pagina
// Sessione e schermo del tavolo: righelli in corso, ping e aree degli
// incantesimi della mappa mostrata, ognuno nel colore di chi li usa (oro per
// il DM). Il proprio righello e la propria area in preparazione si vedono
// subito, senza aspettare Firestore.
import { ascoltaStrumenti, ascoltaAree } from "./auth.js";
import { metriTraPunti, formattaMetri } from "./mappa-calcoli.js";

export const COLORE_DM = "#e8c65a";
const COLORI_GIOCATORI = ["#4fa3e0", "#5cc46a", "#c77dff", "#ff7a5c", "#3fd0c9", "#ff6fb1", "#a3d14a", "#f08a3c"];
// Un righello rimasto acceso (pagina chiusa mentre si misurava) dopo un po' sparisce.
const RIGHELLO_SCADUTO_MS = 2 * 60 * 1000;
// Un ping arrivato in ritardo (per esempio riaprendo la pagina) non si anima.
const PING_RECENTE_MS = 15 * 1000;

// Colore fisso di ognuno: i membri in ordine di uid, chi non è membro (il DM) in oro.
export function colorePersona(membriUid, uid) {
  const ordinati = [...membriUid].sort();
  const i = ordinati.indexOf(uid);
  return i < 0 ? COLORE_DM : COLORI_GIOCATORI[i % COLORI_GIOCATORI.length];
}

export const testoRighello = (griglia, r) => `${formattaMetri(metriTraPunti(griglia, { x: r.x1, y: r.y1 }, { x: r.x2, y: r.y2 }))} m`;

// Suono leggero del ping (WebAudio, nessun file). Il browser lo lascia
// suonare solo dopo che si è toccata la pagina almeno una volta.
let audio = null;
function preparaAudio() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume().catch(() => {});
  } catch {
    audio = null;
  }
}
if (typeof document !== "undefined") document.addEventListener("pointerdown", preparaAudio, { once: true, capture: true });

export function suonaPing() {
  if (!audio || audio.state !== "running") return;
  const ora = audio.currentTime;
  [880, 1320].forEach((frequenza, i) => {
    const osc = audio.createOscillator();
    const volume = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = frequenza;
    const t = ora + i * 0.12;
    volume.gain.setValueAtTime(0.0001, t);
    volume.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(volume).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  });
}

// opzioni:
// - vista: la vista della mappa (impostaStrumenti, ping)
// - campagnaId, mioUid (null sullo schermo del tavolo)
// - membri(): uid dei membri (per i colori: chi non è membro è il DM)
// - griglia(): griglia della mappa mostrata (per le misure)
// - onPing({ uid, x, y, delDM }): ping arrivato da un altro
// - onAree(aree): elenco delle aree cambiato
export function creaStrumentiCondivisi({ vista, campagnaId, mioUid = null, membri, griglia, onPing = () => {}, onAree = () => {} }) {
  let mappaId = null;
  let smetti = [];
  let documenti = [];
  let aree = [];
  let ultimiPing = new Map(); // uid -> n
  let primoArrivo = true;
  let mioRighello = null;
  let bozza = null;

  const colore = (uid) => colorePersona(membri(), uid);

  function ridisegna() {
    const g = griglia();
    if (!g) return;
    const ora = Date.now();
    const righelli = documenti
      .filter((d) => d.uid !== mioUid && d.righello && ora - d.aggiornatoIl < RIGHELLO_SCADUTO_MS)
      .map((d) => ({ uid: d.uid, ...d.righello }));
    if (mioRighello) righelli.push({ uid: mioUid, ...mioRighello });
    const elenco = aree.map((a) => ({ ...a, colore: colore(a.autoreUid) }));
    if (bozza) elenco.push({ ...bozza, colore: colore(mioUid), bozza: true });
    vista.impostaStrumenti({
      aree: elenco,
      righelli: righelli.map((r) => ({ ...r, colore: colore(r.uid), testo: testoRighello(g, r) })),
    });
  }

  function arrivoStrumenti(elenco) {
    const ora = Date.now();
    elenco.forEach((d) => {
      if (!d.ping) return;
      const nuovo = ultimiPing.get(d.uid) !== d.ping.n;
      ultimiPing.set(d.uid, d.ping.n);
      if (primoArrivo || !nuovo || d.uid === mioUid || ora - d.aggiornatoIl > PING_RECENTE_MS) return;
      vista.ping(d.ping, colore(d.uid));
      suonaPing();
      onPing({ uid: d.uid, x: d.ping.x, y: d.ping.y, delDM: !membri().includes(d.uid) });
    });
    primoArrivo = false;
    documenti = elenco;
    ridisegna();
  }

  function cambiaMappa(id) {
    if (id === mappaId) return;
    smetti.forEach((f) => f());
    smetti = [];
    mappaId = id;
    documenti = [];
    aree = [];
    ultimiPing = new Map();
    primoArrivo = true;
    mioRighello = bozza = null;
    onAree(aree);
    if (!id) return;
    smetti = [
      ascoltaStrumenti(campagnaId, id, arrivoStrumenti),
      ascoltaAree(campagnaId, id, (elenco) => {
        aree = elenco;
        onAree(aree);
        ridisegna();
      }),
    ];
  }

  return {
    cambiaMappa,
    ridisegna,
    colore,
    aree: () => aree,
    // Il proprio righello ({ x1, y1, x2, y2 } o null) e la propria area in preparazione.
    impostaMioRighello(r) {
      mioRighello = r;
      ridisegna();
    },
    impostaBozza(area) {
      bozza = area;
      ridisegna();
    },
    // Il proprio ping: si vede subito.
    mioPing(punto) {
      vista.ping(punto, colore(mioUid));
      suonaPing();
    },
    stop() {
      cambiaMappa(null);
    },
  };
}
