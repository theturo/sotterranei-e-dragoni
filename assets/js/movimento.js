// Base comune del movimento: curve, molla, fotogrammi, numeri casuali
// ripetibili, particelle e ciclo di animazione. Nasce con la vaschetta dei
// dadi; le animazioni nuove partono da qui, così parlano tutte la stessa lingua.
// Solo calcoli (tranne `anima` e `ridotto`, che toccano la pagina): si prova con Node.

// Durate in millisecondi.
export const DURATE = { breve: 150, media: 300, lunga: 600 };

// «Riduci animazioni», l'impostazione del dispositivo.
export const ridotto = () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

export const blocca = (u) => Math.min(1, Math.max(0, u));

// Curve: u da 0 a 1 → avanzamento da 0 a 1.
export const curve = {
  lineare: (u) => u,
  entra: (u) => u * u * u,
  esce: (u) => 1 - Math.pow(1 - u, 3),
  esceForte: (u) => 1 - Math.pow(1 - u, 5),
  entraEsce: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
};

// Molla smorzata: parte da 0, supera 1 e ci torna. s in secondi.
export const molla = (s) => (s <= 0 ? 0 : 1 - Math.exp(-7 * s) * (Math.cos(11 * s) + (7 / 11) * Math.sin(11 * s)));

// Fotogrammi per la Web Animations API da una funzione del tempo:
// f(t) → proprietà CSS, t in secondi.
export function fotogrammi(durata, f, passi = 36) {
  return Array.from({ length: passi + 1 }, (_, i) => ({ ...f((durata * i) / passi), offset: i / passi }));
}

// Numeri casuali ripetibili: stesso seme, stessa sequenza (tra 0 e 1).
export function casuale(seme = 7) {
  let stato = Math.max(1, Math.floor(seme) % 2147483647);
  return () => (stato = (stato * 16807) % 2147483647) / 2147483647;
}

// Particelle che partono da un punto: velocità (px/s), raggio e durata (s).
export function scintille(quante, seme, { velMin = 70, velMax = 200, spinta = 50 } = {}) {
  const rnd = casuale(seme);
  return Array.from({ length: quante }, () => {
    const ang = rnd() * Math.PI * 2;
    const vel = velMin + rnd() * (velMax - velMin);
    return { vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel - spinta, r: 4 + rnd() * 5, vita: 0.5 + rnd() * 0.5, giro: (rnd() - 0.5) * 720 };
  });
}

// Ciclo di animazione: chiama passo(u, secondi) a ogni fotogramma, con u da 0 a 1.
// Restituisce { finita, ferma }: la promessa vale true se è arrivata in fondo.
export function anima(durata, passo) {
  let id = 0;
  let fermata = false;
  let risolvi;
  const finita = new Promise((r) => { risolvi = r; });
  const inizio = performance.now();
  const giro = (ora) => {
    if (fermata) return;
    const trascorso = Math.max(0, ora - inizio);
    const u = Math.min(1, trascorso / durata);
    passo(u, trascorso / 1000);
    if (u >= 1) {
      risolvi(true);
      return;
    }
    id = requestAnimationFrame(giro);
  };
  id = requestAnimationFrame(giro);
  return {
    finita,
    ferma() {
      if (fermata) return;
      fermata = true;
      cancelAnimationFrame(id);
      risolvi(false);
    },
  };
}
