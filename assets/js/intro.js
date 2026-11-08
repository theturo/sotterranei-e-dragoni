// Intro dell'app: il drago rosso entra da sinistra, gira attorno al D20, lo colpisce e tutto
// esplode in una spirale di luce che diventa bianca e lascia il logo (160 frame a 24 fps).
// Copre il caricamento della pagina sotto (la dashboard): si entra quando l'animazione è
// finita E la pagina è pronta (il velo #veil sparisce); se la pagina è lenta, il logo resta
// sul bianco finché non lo è. Un tocco salta al logo, o entra subito se la pagina è pronta.
// La lancia pwa.js: all'avvio a freddo dell'app installata e subito dopo il login.
// Con "riduci animazioni" compare solo il logo fermo. Pezzi dipinti in assets/img/intro/.
import { creaMotore } from "./intro-motore.js";

const ATTESA_MASSIMA = 20000; // oltre, si entra comunque
const ATTESA_IMMAGINI = 4000; // se i pezzi non arrivano in tempo, niente intro

// Promessa risolta quando la pagina sotto è pronta: il velo di caricamento sparisce.
function paginaPronta() {
  return new Promise((risolvi) => {
    const velo = document.getElementById("veil");
    const nascosto = () => !velo || !velo.isConnected || velo.hidden || getComputedStyle(velo).display === "none";
    if (nascosto()) {
      risolvi();
      return;
    }
    const osservatore = new MutationObserver(() => {
      if (nascosto()) {
        osservatore.disconnect();
        risolvi();
      }
    });
    osservatore.observe(velo, { attributes: true, attributeFilter: ["style", "class", "hidden"] });
    setTimeout(() => {
      osservatore.disconnect();
      risolvi();
    }, ATTESA_MASSIMA);
  });
}

function dimensioni() {
  const dpr = window.devicePixelRatio || 1;
  let W = window.innerWidth * dpr, H = window.innerHeight * dpr;
  const k = Math.min(1, 1920 / Math.max(W, H));
  return { W: Math.max(2, Math.round(W * k)), H: Math.max(2, Math.round(H * k)) };
}

// Il worker c'è davvero (moduli nei worker, OffscreenCanvas)? Risponde "vivo" appena caricato.
function preparaWorker() {
  if (typeof OffscreenCanvas === "undefined" || !("transferControlToOffscreen" in HTMLCanvasElement.prototype)) {
    return Promise.resolve(null);
  }
  return new Promise((risolvi) => {
    let worker;
    try {
      worker = new Worker(new URL("./intro-worker.js", import.meta.url), { type: "module" });
    } catch {
      risolvi(null);
      return;
    }
    const scaduto = setTimeout(() => {
      worker.terminate();
      risolvi(null);
    }, 1500);
    worker.onmessage = ({ data }) => {
      if (data.tipo !== "vivo") return;
      clearTimeout(scaduto);
      risolvi(worker);
    };
    worker.onerror = () => {
      clearTimeout(scaduto);
      worker.terminate();
      risolvi(null);
    };
  });
}

function logoFermo(intro) {
  intro.classList.add("intro-ferma");
  const logo = document.createElement("div");
  logo.className = "intro-logo";
  for (const nome of ["logo_emblema", "logo_titolo"]) {
    const img = document.createElement("img");
    img.src = new URL(`../img/intro/${nome}.webp`, import.meta.url).href;
    img.alt = "";
    logo.append(img);
  }
  intro.append(logo);
}

export async function mostraIntro() {
  const intro = document.createElement("div");
  intro.className = "intro-app";
  intro.setAttribute("role", "img");
  intro.setAttribute("aria-label", "Sotterranei & Dragoni");
  document.body.append(intro);
  const pronta = paginaPronta();

  let chiusa = false;
  const esci = (subito = false) => {
    if (chiusa) return;
    chiusa = true;
    intro.classList.add("intro-uscita");
    setTimeout(() => intro.remove(), subito ? 0 : 600);
  };

  // "riduci animazioni": solo il logo, finché la pagina non è pronta (almeno un attimo)
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    logoFermo(intro);
    const minimo = new Promise((r) => setTimeout(r, 900));
    Promise.all([pronta, minimo]).then(() => esci());
    intro.addEventListener("click", () => pronta.then(() => esci()));
    return;
  }

  const fondo = document.createElement("canvas");
  const scena = document.createElement("canvas");
  intro.append(fondo, scena);
  let { W, H } = dimensioni();

  let comanda;
  let fine = () => {};
  const partenza = setTimeout(() => esci(true), ATTESA_IMMAGINI);
  const ricevi = (tipo) => {
    if (tipo === "partita") {
      clearTimeout(partenza);
      intro.classList.add("intro-partita");
    } else if (tipo === "finita") {
      fine();
      esci();
    } else if (tipo === "errore") {
      fine();
      esci(true);
    }
  };

  const worker = await preparaWorker();
  if (worker) {
    const offFondo = fondo.transferControlToOffscreen();
    const offScena = scena.transferControlToOffscreen();
    worker.onmessage = ({ data }) => {
      if (data.tipo === "errore") console.warn("Intro:", data.messaggio);
      ricevi(data.tipo);
    };
    worker.postMessage({ tipo: "avvia", fondo: offFondo, scena: offScena, W, H }, [offFondo, offScena]);
    comanda = (tipo, extra = {}) => worker.postMessage({ tipo, ...extra });
    fine = () => setTimeout(() => worker.terminate(), 700);
  } else {
    const motore = creaMotore({ fondo, scena, avvisa: ricevi });
    motore.dimensiona(W, H);
    motore.avvia().catch((errore) => {
      console.warn("Intro non avviata", errore);
      esci(true);
    });
    comanda = (tipo, extra = {}) => (tipo === "dimensiona" ? motore.dimensiona(extra.W, extra.H) : motore[tipo]());
    fine = () => setTimeout(() => motore.ferma(), 700);
  }

  pronta.then(() => comanda("pronta"));
  intro.addEventListener("click", () => comanda("salta"));
  window.addEventListener("resize", () => {
    ({ W, H } = dimensioni());
    if (!chiusa) comanda("dimensiona", { W, H });
  });
}
