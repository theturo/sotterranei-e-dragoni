// Motore dell'intro: carica i pezzi dipinti (assets/img/intro/), prepara le ali scure e fa
// girare l'animazione su due tele: il vortice (WebGL, a mezza risoluzione) e la scena (2D).
// Gira nel worker dell'intro (intro-worker.js, con OffscreenCanvas) così il disegno non
// rallenta il caricamento della pagina; dove il worker non si può usare, gira nella pagina.
// Il tempo è quello dell'orologio: se il dispositivo è lento si saltano frame, non si rallenta.
import * as S from "./intro-scena.js";
import { FILE } from "./intro-pezzi.js";
import { creaVortice } from "./intro-vortice.js";

const BASE_IMMAGINI = new URL("../img/intro/", import.meta.url).href;
// dopo il frame 159 il logo resta ancora un attimo prima di entrare nell'app
const FRAME_FINE = S.FRAMES + 6;

async function caricaImmagine(nome) {
  const risposta = await fetch(`${BASE_IMMAGINI}${nome}.webp`);
  if (!risposta.ok) throw new Error(`Intro: ${nome} non trovato`);
  return createImageBitmap(await risposta.blob());
}

function nuovaTela(w, h) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const tela = document.createElement("canvas");
  tela.width = w;
  tela.height = h;
  return tela;
}

// l'ala lontana è la stessa ala, più scura
function scurisci(immagine) {
  const tela = nuovaTela(immagine.width, immagine.height);
  const c = tela.getContext("2d");
  c.drawImage(immagine, 0, 0);
  c.globalCompositeOperation = "source-atop";
  c.fillStyle = "rgba(24, 7, 4, 0.5)";
  c.fillRect(0, 0, tela.width, tela.height);
  return tela;
}

const pianifica = typeof requestAnimationFrame === "function"
  ? (cb) => requestAnimationFrame(cb)
  : (cb) => setTimeout(() => cb(performance.now()), 16);

// avvisa(tipo): "partita" (immagini pronte, l'animazione è iniziata), "finita" (si può entrare)
export function creaMotore({ fondo, scena, avvisa }) {
  const ctx = scena.getContext("2d");
  let vortice = null;
  try {
    vortice = creaVortice(fondo);
  } catch (errore) {
    console.warn("Intro: vortice WebGL non disponibile", errore);
  }
  const ctxFondo = vortice ? null : fondo.getContext("2d");
  let img = null, g = null, tr = null;
  let t0 = null, salto = 0, f = 0;
  let pronta = false, finita = false, fermo = false;

  // senza WebGL: il vortice dipinto ruota intero e il bianco dipinto lo copre
  function fondo2D(p) {
    const c = ctxFondo, W = fondo.width, H = fondo.height, L = Math.hypot(W, H) * p.camS;
    c.save();
    c.translate(W / 2, H / 2);
    c.rotate(p.rot);
    c.drawImage(img.vortice_quadrato, -L / 2, -L / 2, L, L);
    c.restore();
    if (p.bianco > 0) {
      const lato = Math.max(W, H);
      c.globalAlpha = Math.min(1, p.bianco * 1.2);
      c.drawImage(img.bianco_finale, (W - lato) / 2, (H - lato) / 2, lato, lato);
      c.globalAlpha = 1;
    }
  }

  function disegna() {
    const cam = S.camera(g, tr, f);
    const p = S.parametriFondo(g, f, cam);
    if (vortice) vortice.disegna(p);
    else fondo2D(p);
    S.disegnaScena(ctx, g, tr, f, img, cam);
  }

  function passo(ora) {
    if (fermo) return;
    if (t0 === null) t0 = ora;
    f = ((ora - t0) / 1000) * S.FPS + salto;
    disegna();
    if (!finita && pronta && f >= FRAME_FINE) {
      finita = true;
      avvisa("finita");
    }
    pianifica(passo);
  }

  return {
    async avvia() {
      const immagini = await Promise.all(FILE.map(caricaImmagine));
      img = {};
      FILE.forEach((nome, i) => { img[nome] = immagini[i]; });
      for (let k = 1; k <= 6; k++) img[`ala_${k}_scura`] = scurisci(img[`ala_${k}`]);
      if (vortice) vortice.texture(img.vortice_quadrato, img.bianco_finale);
      avvisa("partita");
      pianifica(passo);
    },
    dimensiona(W, H) {
      scena.width = W;
      scena.height = H;
      fondo.width = Math.max(2, Math.round(W / 2));
      fondo.height = Math.max(2, Math.round(H / 2));
      g = S.geometria(W, H);
      tr = S.creaTraiettoria(g);
    },
    // la pagina sotto è pronta: a fine animazione si entra
    pronta() {
      pronta = true;
    },
    // un tocco: se la pagina è pronta si entra subito, altrimenti si salta al logo
    salta() {
      if (finita) return;
      if (pronta) {
        finita = true;
        avvisa("finita");
      } else if (f < S.FINE_BIANCO) {
        salto += S.FINE_BIANCO - f;
      }
    },
    ferma() {
      fermo = true;
    },
  };
}
