// La vaschetta dei dadi: un lancio vero dentro un oggetto vero (fondo
// rivestito, pareti e cornice di legno). La usano la finestra del tiro
// (dadi.js) e il riposo breve (riposo.js).
// 1. Il risultato è già deciso: lo tira l'app (dadi-base.js) e va nel registro.
// 2. La fisica (fisica-dadi.js) calcola subito tutto il lancio: i dadi cadono
//    sul fondo, urtano pareti e altri dadi, rotolano e si fermano su una faccia.
// 3. Ogni dado viene «rinumerato» con una simmetria (poliedri.js) in modo che
//    la faccia finita in alto sia proprio il risultato, con il numero il più
//    dritto possibile. Il movimento non cambia.
// 4. La pagina riproduce il lancio registrato sulla tela (scena-dadi.js), poi
//    mostra gli effetti di vantaggio, 20 e 1 naturali (effetti-dadi.js).
// Con «riduci animazioni» i dadi compaiono già fermi nella vaschetta.
// Rivestimento e vista sono quelli scelti in ⚙️ → Dadi (vaschetta-scelte.js).
import { v, q } from "./geometria-3d.js";
import { poliedro, TIPI, elementoDi, elementoInAlto, simmetria } from "./poliedri.js";
import { simulaBene } from "./fisica-dadi.js";
import { creaScena } from "./scena-dadi.js";
import { scelteVaschetta } from "./vaschetta-scelte.js";
import { anima, blocca, curve, ridotto } from "./movimento.js";
import { lampoVenti, schegge, scossa } from "./effetti-dadi.js";

const DURATA_FINALE = 650; // ms: spegnimento dello scartato, alone, crepe
const SOPRA = 40;          // pixel di tela sopra la vaschetta, per i rimbalzi alti

// I dadi che la vaschetta sa lanciare: per gli altri (d100, d3…) chi chiama
// mostra solo il risultato.
export const lanciabili = (dadi) => dadi.length > 0 && dadi.every((d) => TIPI.includes(d.facce));

function el(tag, classe) {
  const nodo = document.createElement(tag);
  nodo.className = classe;
  return nodo;
}

export function creaVaschetta(radice) {
  radice.classList.add("vaschetta");
  const tela = el("canvas", "vaschetta-tela");
  tela.setAttribute("aria-hidden", "true");
  const strato = el("div", "vaschetta-effetti");
  radice.replaceChildren(tela, strato);

  const scena = creaScena(tela);
  let inCorso = null;

  // Un lancio di prova a vuoto appena creata la vaschetta: il primo calcolo è
  // sempre il più lento (il browser non ha ancora ottimizzato il codice), così
  // quel ritardo non cade sul primo tiro vero.
  setTimeout(() => simulaBene({ tipi: [20, 6, 6], W: 12, D: 8, seme: 3, tentativi: 1 }), 0);

  // La posa del dado i al tempo t (secondi), tra due fotogrammi registrati.
  function posa(sim, i, t) {
    const ultimo = sim.fotogrammi.length - 1;
    const f = Math.min(ultimo, Math.max(0, t * sim.alSecondo));
    const a = sim.fotogrammi[Math.floor(f)][i];
    const b = sim.fotogrammi[Math.min(ultimo, Math.floor(f) + 1)][i];
    const k = f - Math.floor(f);
    const stesso = a.r[0] * b.r[0] + a.r[1] * b.r[1] + a.r[2] * b.r[2] + a.r[3] * b.r[3] >= 0 ? 1 : -1;
    const r = a.r.map((x, j) => x + (stesso * b.r[j] - x) * k);
    const l = Math.hypot(...r);
    return { p: a.p.map((x, j) => x + (b.p[j] - x) * k), r: r.map((x) => x / l) };
  }

  // A dadi fermi: quale si tiene con vantaggio o svantaggio, chi ha fatto 20 o 1 naturale.
  function leggi(tiro) {
    const valori = tiro.dadi.map((d) => d.risultato);
    let tenuto = null;
    if (tiro.modo === "vantaggio" || tiro.modo === "svantaggio") {
      tenuto = valori.indexOf(tiro.modo === "vantaggio" ? Math.max(...valori) : Math.min(...valori));
    }
    const soloD20 = tiro.dadi.every((d) => d.facce === 20) && (tiro.dadi.length === 1 || tenuto !== null);
    const mostrato = tenuto !== null ? valori[tenuto] : valori[0];
    const naturale = soloD20 && (mostrato === 20 || mostrato === 1) ? mostrato : null;
    return { tenuto, naturale, protagonista: tenuto ?? 0 };
  }

  // tiro: { dadi: [{ facce, risultato }], modo: "normale" | "vantaggio" | "svantaggio" }
  //   (con vantaggio e svantaggio i dadi sono due d20: quello tenuto e lo scartato).
  // suInizio(durataMs): chiamata quando i dadi partono, con la durata del lancio
  //   (serve al suono). La promessa si risolve a dadi fermi, prima del finale.
  async function lancia(tiro, { suInizio = null, seme = Math.floor(Math.random() * 99991) + 1 } = {}) {
    inCorso?.ferma();
    inCorso = null;
    await scena.pronta;
    strato.replaceChildren();
    radice.classList.remove("vaschetta-venti", "vaschetta-uno");

    const scelte = scelteVaschetta();
    const larghezza = radice.clientWidth || 320;
    const altezza = Math.round(Math.min(400, Math.max(220, larghezza * (scelte.vista === "alto" ? 0.56 : 0.6))));
    // La tela sporge un po' sopra la vaschetta: lì passano i dadi che rimbalzano
    // più in alto del bordo di fondo, senza togliere spazio alla vaschetta.
    const sopra = scelte.vista === "alto" ? 0 : SOPRA;
    const misure = scena.prepara({ quanti: tiro.dadi.length, vista: scelte.vista, larghezza, altezza, sopra });
    tela.style.top = `${-sopra}px`;
    tela.style.marginBottom = `${-sopra}px`;

    const sim = simulaBene({ tipi: tiro.dadi.map((d) => d.facce), W: misure.W, D: misure.D, seme });

    // Ogni dado rinumerato perché in alto ci sia il suo risultato, più dritto possibile.
    const dadi = tiro.dadi.map((d, i) => {
      const solido = poliedro(d.facce);
      const finale = sim.finali[i].rot;
      const voluto = elementoDi(solido, d.risultato);
      const etichetta = solido.tipo === 4 ? null : solido.etichette.find((e) => e.faccia === voluto);
      const S = simmetria(solido, voluto, elementoInAlto(solido, finale), (cand) => (etichetta ? q.ruota(q.mul(finale, cand), etichetta.su)[1] : 0));
      // Il punto in alto del dado fermo: lì nascono crepe ed effetti.
      const cima = solido.tipo === 4 ? solido.vertici[voluto] : solido.centri[voluto];
      return { solido, S, cima: v.add(sim.finali[i].p, q.ruota(q.mul(finale, S), cima)) };
    });
    const lettura = leggi(tiro);

    // Disegna il lancio al tempo t; `fine` (0–1) e `dopo` (secondi) animano il finale.
    function quadro(t, fine = 0, dopo = 0) {
      scena.disegna(dadi.map((d, i) => {
        const { p, r } = posa(sim, i, t);
        const voce = { solido: d.solido, p, rot: q.mul(r, d.S) };
        if (!fine) return voce;
        const e = curve.esce(fine);
        if (lettura.tenuto !== null) {
          if (i === lettura.tenuto) voce.bagliore = 0.6 * e;
          else voce.spento = e;
        }
        if (i === lettura.protagonista && lettura.naturale === 20) {
          voce.bagliore = e;
          voce.scala = 1 + 0.16 * Math.exp(-5 * dopo) * Math.cos(9 * dopo);
        }
        if (i === lettura.protagonista && lettura.naturale === 1) {
          voce.buio = curve.esce(blocca(fine / 0.5));
          voce.crepe = blocca(fine / 0.45);
          voce.centroCrepe = d.cima;
          voce.scala = 1 - 0.06 * Math.exp(-6 * dopo) * Math.cos(10 * dopo);
        }
        return voce;
      }), scelte.materiale);
    }

    radice.classList.toggle("vaschetta-venti", lettura.naturale === 20);
    radice.classList.toggle("vaschetta-uno", lettura.naturale === 1);

    if (ridotto()) {
      suInizio?.(200);
      quadro(sim.durata, 1, 9);
      return true;
    }

    const durata = sim.durata * 1000;
    suInizio?.(durata);
    const corsa = anima(durata, (u) => quadro(u * sim.durata));
    inCorso = corsa;
    if (!(await corsa.finita)) return false;

    const [x, ySuTela] = scena.proietta(dadi[lettura.protagonista].cima);
    const dove = { strato, x, y: ySuTela - sopra, raggio: misure.s };
    if (lettura.naturale === 20) lampoVenti(dove);
    if (lettura.naturale === 1) {
      schegge(dove);
      scossa(radice);
    }
    // Il finale va avanti da solo: chi chiama può già mostrare il risultato.
    if (lettura.tenuto !== null || lettura.naturale) {
      inCorso = anima(DURATA_FINALE, (u, secondi) => quadro(sim.durata, u, secondi));
    }
    return true;
  }

  return { lancia, ferma: () => inCorso?.ferma() };
}
