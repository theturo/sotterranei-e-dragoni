// Cambio turno nel tracker (tavola "Cambio turno nel tracker — sobrio per
// tutti, scenico per chi gioca" della tela).
// - Per tutti: una cornice dorata scorre dalla riga di prima a quella di
//   turno (0,4 s), il ▶ la segue, il sottotitolo cambia in dissolvenza e il
//   numero del round si ingrandisce con un bagliore a ogni round nuovo.
// - Solo per il giocatore il cui personaggio è di turno: la cornice arriva a
//   molla con una scia, un'onda dorata, un riflesso, le scintille e il ▶ che
//   si imprime come un sigillo; il banner «Tocca a te!» entra con un lampo e
//   la riga pulsa finché dura il turno.
// - Il DM vede sempre la versione sobria. Con "riduci animazioni" il cambio
//   è istantaneo. Tutto si decide sul dispositivo: nessun dato nuovo.
// Le posizioni si misurano sulle righe vere (cambiano altezza sul telefono)
// e si anima con transform (Web Animations API).
import { creaElemento } from "./contenuti.js";

const ridotto = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const easeOut = (u) => 1 - Math.pow(1 - u, 3);
const molla = (s) => (s <= 0 ? 0 : 1 - Math.exp(-7 * s) * (Math.cos(11 * s) + (7 / 11) * Math.sin(11 * s)));

// Fotogrammi di una funzione del tempo: f(t) → proprietà CSS, t in secondi.
function fotogrammi(durata, f, passi = 36) {
  return Array.from({ length: passi + 1 }, (_, i) => ({ ...f((durata * i) / passi), offset: i / passi }));
}

// Scintille: semi fissi, così la resa è sempre la stessa.
const SEMI = (() => {
  let seme = 7;
  const rnd = () => ((seme = (seme * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 22 }, () => {
    const ang = rnd() * Math.PI * 2;
    const vel = 70 + rnd() * 130;
    return { vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel - 50, r: 7 + rnd() * 5, vita: 0.55 + rnd() * 0.45 };
  });
})();

// contenitore: elemento con position: relative che contiene l'elenco delle
// righe; sottotitolo e banner sono quelli del tracker.
export function montaTurnoAnimato({ contenitore, sottotitolo, banner }) {
  const cornice = creaElemento("div", "turno-cornice");
  cornice.setAttribute("aria-hidden", "true");
  const marcatore = creaElemento("span", "turno-marcatore", "▶");
  const lampo = creaElemento("span", "turno-lampo");
  cornice.append(marcatore, lampo);
  cornice.hidden = true;
  const effetti = creaElemento("div", "turno-effetti");
  effetti.setAttribute("aria-hidden", "true");
  contenitore.append(effetti, cornice);
  contenitore.classList.add("con-cornice");
  const lampoBanner = creaElemento("span", "banner-lampo");
  banner.append(lampoBanner);

  // Il testo che esce resta in un "fantasma" accanto al sottotitolo, così il
  // sottotitolo contiene sempre solo il testo vero.
  const fantasma = creaElemento("p", "combattimento-sottotitolo sottotitolo-uscente");
  fantasma.setAttribute("aria-hidden", "true");
  sottotitolo.after(fantasma);
  fantasma.hidden = true;

  let precedente = null;    // { id, round, y, h }
  let movimento = null;     // animazione in corso della cornice
  let testoPrecedente = null;
  let roundPrecedente = null;

  const misura = (riga) => ({ y: riga.offsetTop, h: riga.offsetHeight });
  const posiziona = ({ y, h }, riga) => {
    cornice.style.transform = `translateY(${y}px)`;
    cornice.style.height = `${h}px`;
    // Il ▶ sopra la colonna della posizione (più stretta sul telefono).
    const posizione = riga?.querySelector(".combattente-posizione");
    if (posizione) {
      const bordo = cornice.clientLeft;
      Object.assign(marcatore.style, { left: `${posizione.offsetLeft - riga.offsetLeft - bordo}px`, width: `${posizione.offsetWidth}px` });
    }
  };

  // Riallinea la cornice se le righe cambiano altezza (riga aperta, telefono).
  let rigaCorrente = null;
  const osservatore = new ResizeObserver(() => {
    if (!rigaCorrente || cornice.hidden || movimento?.playState === "running") return;
    const m = misura(rigaCorrente);
    posiziona(m, rigaCorrente);
    if (precedente) Object.assign(precedente, m);
  });
  osservatore.observe(contenitore);

  function sottotitoloNuovo({ testoRound, round, resto, cambiaRound }) {
    const testo = `${testoRound}${round}${resto}`;
    const vecchio = testoPrecedente;
    sottotitolo.replaceChildren(...[testoRound, round !== "" ? creaElemento("b", "sottotitolo-round", String(round)) : "", resto].filter((x) => x !== ""));
    testoPrecedente = testo;
    if (ridotto() || vecchio === null || vecchio === testo || !vecchio) return;
    fantasma.textContent = vecchio;
    fantasma.hidden = false;
    // Sopra al sottotitolo (stesso contenitore posizionato).
    Object.assign(fantasma.style, { top: `${sottotitolo.offsetTop}px`, left: `${sottotitolo.offsetLeft}px`, width: `${sottotitolo.offsetWidth}px` });
    fantasma.animate([{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(-8px)" }], { duration: 300, easing: "ease-out" })
      .finished.then(() => { fantasma.hidden = true; }).catch(() => {});
    sottotitolo.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 300, easing: "ease-out" });
    if (cambiaRound) {
      const b = sottotitolo.querySelector(".sottotitolo-round");
      b?.animate(fotogrammi(0.9, (t) => {
        const g = Math.max(0, 1 - t / 0.9);
        return { transform: `scale(${1 + 0.9 * Math.exp(-6 * t) * Math.cos(8 * t)})`, textShadow: `0 0 ${12 * g}px rgba(201,162,39,${g})` };
      }), { duration: 900 });
    }
  }

  // Effetti scenici all'arrivo sulla riga (t0: secondi dall'inizio).
  function scenico(riga, arrivo, da, t0) {
    const { y, h } = arrivo;
    const larghezza = contenitore.clientWidth;
    const ritardo = t0 * 1000;
    // Il ▶ piccolo e inclinato durante il viaggio, poi si imprime come un sigillo.
    marcatore.animate(fotogrammi(t0 + 0.6, (t) => {
      const dt = t - t0;
      if (dt < 0) return { transform: "scale(0.5) rotate(-22deg)", filter: "none" };
      const p = molla(Math.min(1, dt / 0.5) * 0.9);
      const scala = 0.5 + 0.5 * p + (dt < 0.18 ? 0.25 : 0);
      const glow = Math.max(0, 1 - dt / 0.6);
      return { transform: `scale(${scala}) rotate(${-22 * (1 - Math.min(1, p))}deg)`, filter: `drop-shadow(0 0 ${6 * glow}px rgba(243,211,107,${glow}))` };
    }, 48), { duration: (t0 + 0.6) * 1000 });
    // Riflesso che attraversa la riga.
    lampo.animate([
      { left: "-30%", opacity: 0 }, { left: "45%", opacity: 1, offset: 0.5 }, { left: "120%", opacity: 0 },
    ], { duration: 600, delay: ritardo, easing: "cubic-bezier(0.33, 1, 0.68, 1)", fill: "backwards" });
    // Bagliore sul nome.
    riga.querySelector(".combattente-nome")?.animate(fotogrammi(0.9, (t) => {
      const g = 1 - t / 0.9;
      return { textShadow: `0 0 ${10 * g}px rgba(201,162,39,${g})`, letterSpacing: `${0.8 * g}px` };
    }), { duration: 900, delay: ritardo });
    // Scia dorata del viaggio (non nel salto di fine giro).
    if (da) {
      const scia = creaElemento("div", "turno-scia");
      const giu = y >= da.y;
      Object.assign(scia.style, {
        top: `${Math.min(da.y, y)}px`, height: `${Math.abs(y - da.y) + h}px`,
        background: `linear-gradient(${giu ? "to bottom" : "to top"}, rgba(201,162,39,0), rgba(243,211,107,0.5))`,
      });
      effetti.append(scia);
      scia.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 750 }).finished.then(() => scia.remove()).catch(() => scia.remove());
    }
    // Onda dorata che si allarga dalla riga.
    const onda = creaElemento("div", "turno-onda");
    Object.assign(onda.style, { top: `${y}px`, height: `${h}px` });
    effetti.append(onda);
    onda.animate([
      { transform: "scale(1, 1)", opacity: 0.85 },
      { transform: `scale(${(larghezza + 16) / larghezza}, ${(h + 16) / h})`, opacity: 0 },
    ], { duration: 700, delay: ritardo, easing: "cubic-bezier(0.33, 1, 0.68, 1)", fill: "backwards" })
      .finished.then(() => onda.remove()).catch(() => onda.remove());
    // Scintille dal ▶.
    for (const s of SEMI) {
      const sc = creaElemento("span", "turno-scintilla");
      Object.assign(sc.style, { left: "24px", top: `${y + h / 2}px`, width: `${s.r}px`, height: `${s.r}px` });
      effetti.append(sc);
      sc.animate(fotogrammi(s.vita, (t) => {
        const vivo = 1 - t / s.vita;
        return { transform: `translate(${s.vx * t}px, ${s.vy * t + 110 * t * t}px) scale(${0.5 + 0.5 * vivo})`, opacity: vivo };
      }, 12), { duration: s.vita * 1000, delay: ritardo, fill: "backwards" })
        .finished.then(() => sc.remove()).catch(() => sc.remove());
    }
  }

  function bannerEntra() {
    banner.animate(fotogrammi(0.8, (t) => {
      const m = molla(t);
      return { opacity: Math.min(1, t / 0.3 * 1.4), transform: `translateY(${-18 * (1 - m)}px) scale(${0.8 + 0.2 * m})` };
    }), { duration: 800, delay: 200, fill: "backwards" });
    lampoBanner.animate([
      { left: "-100%", opacity: 0 }, { left: "0%", opacity: 1, offset: 0.5 }, { left: "100%", opacity: 0 },
    ], { duration: 700, delay: 200, fill: "backwards" });
  }

  // riga: la riga di turno (o null); round: numero del round; testi del
  // sottotitolo; scenico: true se è il turno del proprio personaggio (mai per il DM).
  function aggiorna({ riga, id, round, sottotitolo: testi, scenico: mio, ordine }) {
    sottotitoloNuovo({ ...testi, cambiaRound: roundPrecedente !== null && round > 0 && round !== roundPrecedente });
    const eraMio = cornice.classList.contains("turno-mio");
    cornice.classList.toggle("turno-mio", Boolean(riga && mio));
    rigaCorrente = riga;
    if (!riga) {
      cornice.hidden = true;
      precedente = null;
      roundPrecedente = round || null;
      return;
    }
    const arrivo = misura(riga);
    const stesso = precedente && precedente.id === id && precedente.round === round;
    const primo = cornice.hidden || !precedente;
    cornice.hidden = false;
    if (stesso || ridotto()) {
      posiziona(arrivo, riga);
      if (!stesso && mio && !eraMio && !ridotto()) bannerEntra();
      precedente = { id, round, ...arrivo };
      roundPrecedente = round;
      return;
    }
    movimento?.cancel();
    const da = precedente;
    // Verso: avanti se cresce il round o la posizione (fine giro = salto).
    const indiceDa = da ? ordine.indexOf(da.id) : -1;
    const indiceA = ordine.indexOf(id);
    const fineGiro = da && round !== da.round;
    const verso = !da ? 1 : fineGiro ? Math.sign(round - da.round) : Math.sign(indiceA - indiceDa) || 1;
    posiziona(arrivo, riga);
    const h0 = da ? da.h : arrivo.h;
    let durata;
    let arrivoT;
    let f;
    if (primo) {
      // Primo turno del combattimento: la cornice compare sulla riga.
      durata = 0.3;
      arrivoT = 0.15;
      f = (t) => ({ transform: `translateY(${arrivo.y}px)`, opacity: Math.min(1, t / 0.3), height: `${arrivo.h}px` });
    } else if (!fineGiro) {
      durata = mio ? 1.0 : 0.42;
      arrivoT = mio ? 0.2 : 0.42;
      f = (t) => {
        const k = mio ? molla(t) : easeInOut(Math.min(1, t / 0.42));
        return { transform: `translateY(${da.y + (arrivo.y - da.y) * k}px)`, height: `${h0 + (arrivo.h - h0) * Math.min(1, k)}px`, opacity: 1 };
      };
    } else {
      const uscita = mio ? 0.22 : 0.18;
      durata = mio ? uscita + 0.9 : uscita + 0.26;
      arrivoT = uscita + (mio ? 0.2 : 0.26);
      const passo = arrivo.h + 6;
      f = (t) => {
        if (t < uscita) {
          const u = t / uscita;
          return { transform: `translateY(${da.y + verso * passo * (mio ? 1.2 : 0.5) * u * u}px)`, opacity: 1 - u, height: `${h0}px` };
        }
        const t2 = t - uscita;
        if (!mio) {
          const e = easeOut(Math.min(1, t2 / 0.26));
          return { transform: `translateY(${arrivo.y - verso * passo * 0.5 * (1 - e)}px)`, opacity: e, height: `${arrivo.h}px` };
        }
        const s0 = arrivo.y - verso * passo * 1.6;
        return { transform: `translateY(${s0 + (arrivo.y - s0) * molla(t2)}px)`, opacity: Math.min(1, t2 / 0.08), height: `${arrivo.h}px` };
      };
    }
    movimento = cornice.animate(fotogrammi(durata, f, 48), { duration: durata * 1000 });
    if (mio) {
      scenico(riga, arrivo, primo || fineGiro ? null : da, arrivoT);
      if (!eraMio) bannerEntra();
    }
    precedente = { id, round, ...arrivo };
    roundPrecedente = round;
  }

  return {
    aggiorna,
    stop: () => osservatore.disconnect(),
  };
}
