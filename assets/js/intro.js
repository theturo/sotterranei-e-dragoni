// Intro dell'app installata: un d20 di resina avorio con i numeri rossi entra
// rimbalzando, si ferma sul 20, il 20 si accende d'oro, la luce avvolge il
// dado e al suo posto resta l'icona dell'app con il titolo (2,5 secondi).
// La lancia pwa.js una volta per sessione, solo nell'app installata.
// - Un tocco la salta; con "riduci animazioni" compaiono solo icona e titolo.
// - Three.js (assets/vendor, MIT) e il Cinzel dei numeri (assets/fonts, OFL)
//   stanno nel sito: l'intro funziona anche senza rete.
// - Senza WebGL, o se qualcosa va storto, mostra la versione ferma.
import {
  DURATA, D, VERTICI, FACCE, NUMERI, FACCIA_20, etichetta, fasi, creaScena,
} from "./intro-dado.js";

const FONT = "Cinzel Intro";
const AVORIO = "rgb(239,228,204)";
const ICONA_SVG = `<svg class="intro-icona" viewBox="0 0 100 100" fill="none" aria-hidden="true">
  <path d="M50 4 L90 27 L90 73 L50 96 L10 73 L10 27 Z" stroke="#e8c65a" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M50 4 L50 46 M10 27 L50 46 M90 27 L50 46 M50 46 L10 73 M50 46 L90 73 M50 46 L50 96" stroke="#e8c65a" stroke-width="1.1" opacity="0.5"/>
  <text x="50" y="54" text-anchor="middle" font-family="${FONT}, Cinzel, serif" font-weight="700" font-size="22" fill="#e8c65a">20</text>
</svg>`;

let inCorso = false;

async function caricaCarattere() {
  try {
    const carattere = new FontFace(FONT, "url(assets/fonts/cinzel-700.woff2)", { weight: "700" });
    await carattere.load();
    document.fonts.add(carattere);
    return true;
  } catch {
    return false;
  }
}

function creaSovrapposizione(cx, cy) {
  const intro = document.createElement("div");
  intro.className = "intro-app";
  intro.setAttribute("aria-hidden", "true");
  // Contenuto fisso (nessun dato inserito dagli utenti).
  intro.innerHTML = `
    <div class="intro-livello"></div>
    <div class="intro-bagliore"></div>
    <div class="intro-alone20"></div>
    <div class="intro-brace20">20</div>
    ${ICONA_SVG}
    <div class="intro-titolo">Sotterranei<br>&amp; Dragoni</div>
    <div class="intro-sottotitolo">Il portale della campagna</div>`;
  intro.style.setProperty("--cx", `${cx}px`);
  intro.style.setProperty("--cy", `${cy}px`);
  document.body.append(intro);
  const $ = (classe) => intro.querySelector(`.${classe}`);
  return {
    intro,
    livello: $("intro-livello"),
    bagliore: $("intro-bagliore"),
    alone20: $("intro-alone20"),
    brace20: $("intro-brace20"),
    icona: $("intro-icona"),
    titolo: $("intro-titolo"),
    sottotitolo: $("intro-sottotitolo"),
  };
}

function aggiornaSovrapposizioni(el, fs) {
  el.bagliore.style.opacity = String(fs.luce);
  el.bagliore.style.transform = `scale(${0.35 + 0.9 * fs.luce})`;
  el.alone20.style.opacity = String(fs.numero * (1 - fs.brillio));
  el.alone20.style.transform = `scale(${0.7 + 0.5 * fs.numero})`;
  el.brace20.style.opacity = String(fs.numero * (1 - fs.icona));
  el.icona.style.opacity = String(fs.icona);
  el.icona.style.filter = `drop-shadow(0 0 ${14 * fs.luce}px rgba(255, 220, 140, ${0.9 * fs.luce}))`;
  el.titolo.style.opacity = String(fs.titolo);
  el.titolo.style.transform = `translateY(${(1 - fs.titolo) * 12}px)`;
  el.sottotitolo.style.opacity = String(fs.sottotitolo);
  el.sottotitolo.style.transform = `translateY(${(1 - fs.sottotitolo) * 10}px)`;
}

// La scena 3D. Restituisce { disegna(t), chiudi() }.
function creaDado(THREE, livello, scena3d) {
  const { larghezza: W, altezza: H, cy: CY, F, posa } = scena3d;
  const canvas = document.createElement("canvas");
  livello.append(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera((2 * Math.atan(H / 2 / F) * 180) / Math.PI, W / H, 0.1, 100);
  camera.position.set(0, D, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  // Il centro del tavolo cade su (cx, cy), dove poi compare l'icona.
  camera.setViewOffset(W, H, 0, H / 2 - CY, W, H);

  // Ambiente per i riflessi: gradiente caldo con due "finestre" luminose.
  const env = document.createElement("canvas");
  env.width = 512;
  env.height = 256;
  const ec = env.getContext("2d");
  const gradiente = ec.createLinearGradient(0, 0, 0, 256);
  gradiente.addColorStop(0, "#6e5638");
  gradiente.addColorStop(0.35, "#8a6a40");
  gradiente.addColorStop(0.55, "#5a4228");
  gradiente.addColorStop(1, "#1a0f06");
  ec.fillStyle = gradiente;
  ec.fillRect(0, 0, 512, 256);
  ec.fillStyle = "rgba(255,248,230,0.95)";
  ec.fillRect(60, 70, 90, 34);
  ec.fillRect(330, 84, 60, 26);
  const texEnv = new THREE.CanvasTexture(env);
  texEnv.mapping = THREE.EquirectangularReflectionMapping;
  texEnv.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scena.environment = pmrem.fromEquirectangular(texEnv).texture;

  // Texture: 20 celle (5×4), triangolo avorio con spigoli chiari e numero rosso
  // inciso. A parte una mappa di luce: solo il 20 (e poi tutto il dado) brilla.
  const LATO = 256, COL = 5, RIG = 4;
  const atlante = document.createElement("canvas");
  atlante.width = LATO * COL;
  atlante.height = LATO * RIG;
  const luce = document.createElement("canvas");
  luce.width = atlante.width / 2;
  luce.height = atlante.height / 2;
  const ac = atlante.getContext("2d");
  const lc = luce.getContext("2d");
  ac.fillStyle = AVORIO;
  ac.fillRect(0, 0, atlante.width, atlante.height);
  const cella = (i) => [(i % COL) * LATO, Math.floor(i / COL) * LATO];
  const tri = (ox, oy) => {
    const m = LATO * 0.04, s = LATO - 2 * m;
    return [[ox + LATO / 2, oy + m], [ox + m, oy + m + s * 0.866], [ox + LATO - m, oy + m + s * 0.866]];
  };
  const carattere = (px) => `700 ${px}px "${FONT}", Cinzel, Georgia, serif`;
  let posto20 = [0, 0, 0];
  FACCE.forEach((f, i) => {
    const [ox, oy] = cella(i);
    const [A, B, C] = tri(ox, oy);
    const gr = ac.createLinearGradient(A[0], A[1], B[0], B[1]);
    gr.addColorStop(0, "#f6eedb");
    gr.addColorStop(1, "#e7d9bb");
    ac.fillStyle = gr;
    ac.beginPath();
    ac.moveTo(...A);
    ac.lineTo(...B);
    ac.lineTo(...C);
    ac.closePath();
    ac.fill();
    ac.strokeStyle = "rgba(255,252,240,0.9)";
    ac.lineWidth = 5;
    ac.stroke();
    const x = ox + LATO / 2;
    const y = oy + LATO * 0.04 + (LATO * 0.92 * 0.866 * 2) / 3;
    const testo = etichetta(NUMERI[i]);
    ac.font = carattere(LATO * 0.3);
    ac.textAlign = "center";
    ac.textBaseline = "middle";
    // inciso: ombra in alto a sinistra, riflesso in basso a destra
    ac.fillStyle = "rgba(60,20,10,0.45)";
    ac.fillText(testo, x - 1.5, y - 1.5);
    ac.fillStyle = "rgba(255,248,232,0.8)";
    ac.fillText(testo, x + 1.5, y + 2);
    ac.fillStyle = "#8e1b22";
    ac.fillText(testo, x, y);
    if (i === FACCIA_20) posto20 = [x / 2, y / 2, LATO * 0.15];
  });
  const mappa = new THREE.CanvasTexture(atlante);
  mappa.colorSpace = THREE.SRGBColorSpace;
  mappa.anisotropy = 8;
  const mappaLuce = new THREE.CanvasTexture(luce);
  let ultimaLuce = "";
  function aggiornaLuce(numero, corpo) {
    const chiave = `${numero.toFixed(2)}|${corpo.toFixed(2)}`;
    if (chiave === ultimaLuce) return;
    ultimaLuce = chiave;
    const g = Math.round(255 * corpo * 0.42);
    lc.fillStyle = `rgb(${g},${g},${g})`;
    lc.fillRect(0, 0, luce.width, luce.height);
    const [x, y, dim] = posto20;
    const n = Math.round(255 * Math.max(numero * 0.3, corpo * 0.42));
    lc.font = carattere(dim);
    lc.textAlign = "center";
    lc.textBaseline = "middle";
    lc.shadowColor = `rgba(${n},${n},${n},0.9)`;
    lc.shadowBlur = 6 * numero;
    lc.fillStyle = `rgb(${n},${n},${n})`;
    lc.fillText("20", x, y);
    lc.shadowBlur = 0;
    mappaLuce.needsUpdate = true;
  }

  const posizioni = [], uv = [];
  FACCE.forEach((f, i) => {
    const [ox, oy] = cella(i);
    f.forEach((k) => posizioni.push(...VERTICI[k]));
    tri(ox, oy).forEach(([x, y]) => uv.push(x / atlante.width, 1 - y / atlante.height));
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(posizioni, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const materiale = new THREE.MeshPhysicalMaterial({
    map: mappa, metalness: 0, roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.22,
    emissive: new THREE.Color(1, 0.6, 0.18), emissiveMap: mappaLuce, emissiveIntensity: 2.4,
    transparent: true,
  });
  const dado = new THREE.Mesh(geo, materiale);
  dado.castShadow = true;
  scena.add(dado);

  const pavimento = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.6 }));
  pavimento.rotation.x = -Math.PI / 2;
  pavimento.receiveShadow = true;
  scena.add(pavimento);

  scena.add(new THREE.HemisphereLight(0xfff1d6, 0x2a1a0c, 0.55));
  const chiave = new THREE.DirectionalLight(0xfff0d0, 2.4);
  chiave.position.set(-2.6, 10, -2.2);
  chiave.castShadow = true;
  chiave.shadow.mapSize.set(1024, 1024);
  Object.assign(chiave.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
  chiave.shadow.radius = 14;
  chiave.shadow.blurSamples = 20;
  chiave.shadow.bias = -0.0008;
  scena.add(chiave);
  const controluce = new THREE.DirectionalLight(0xffd79a, 0.9);
  controluce.position.set(5, 4, 6);
  scena.add(controluce);

  return {
    disegna(t) {
      const { pos, rot } = posa(t);
      const fs = fasi(t);
      dado.position.set(pos[0], pos[1], pos[2]);
      dado.quaternion.set(rot[1], rot[2], rot[3], rot[0]);
      aggiornaLuce(fs.numero, fs.brillio);
      materiale.opacity = fs.dado;
      dado.visible = fs.dado > 0.001;
      renderer.render(scena, camera);
    },
    chiudi() {
      renderer.dispose();
      geo.dispose();
      materiale.dispose();
      mappa.dispose();
      mappaLuce.dispose();
      texEnv.dispose();
      pmrem.dispose();
    },
  };
}

export async function mostraIntro() {
  if (inCorso) return;
  inCorso = true;
  const W = window.innerWidth, H = window.innerHeight;
  const cx = W / 2, cy = Math.round(H * 0.42);
  const scena3d = creaScena(W, H, cx, cy);
  const el = creaSovrapposizione(cx, cy);
  el.alone20.style.left = el.brace20.style.left = `${scena3d.punto20[0]}px`;
  el.alone20.style.top = el.brace20.style.top = `${scena3d.punto20[1]}px`;

  let dado = null;
  let fotogramma = 0;
  let finita = false;
  const fine = () => {
    if (finita) return;
    finita = true;
    performance.mark("intro-fine");
    cancelAnimationFrame(fotogramma);
    el.intro.classList.add("intro-uscita");
    setTimeout(() => {
      dado?.chiudi();
      el.intro.remove();
      inCorso = false;
    }, 350);
  };
  el.intro.addEventListener("pointerdown", fine);

  // Versione ferma: icona e titolo, poi via.
  const ferma = () => {
    aggiornaSovrapposizioni(el, fasi(DURATA));
    setTimeout(fine, 900);
  };

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    ferma();
    return;
  }
  try {
    const [THREE] = await Promise.all([import("../vendor/three.module.min.js"), caricaCarattere()]);
    performance.mark("intro-caricata");
    if (finita) return;
    dado = creaDado(THREE, el.livello, scena3d);
    dado.disegna(0);   // compila i materiali prima di far partire il tempo
    performance.mark("intro-pronta");
  } catch (errore) {
    console.warn("Intro: versione ferma", errore);
    ferma();
    return;
  }
  const inizio = performance.now();
  const ciclo = (ora) => {
    if (finita) return;
    const t = Math.min(DURATA, (ora - inizio) / 1000);
    dado.disegna(t);
    aggiornaSovrapposizioni(el, fasi(t));
    if (t < DURATA) fotogramma = requestAnimationFrame(ciclo);
    else setTimeout(fine, 350);
  };
  fotogramma = requestAnimationFrame(ciclo);
}
