// Aspetto della vaschetta dei dadi: i rivestimenti del fondo, le viste e la
// scelta di chi gioca, salvata sul dispositivo (come gli effetti sonori).
// Sta in un file a parte, piccolo, perché lo legge anche il pannello ⚙️ di
// tutte le pagine: lì non serve caricare il disegno della vaschetta.

// colore: tinta del fondo; grana: la trama disegnata sopra (scena-dadi.js).
export const MATERIALI = {
  "feltro-notte": { nome: "Feltro blu notte", colore: "#1f4058", grana: "feltro" },
  "feltro-verde": { nome: "Feltro verde", colore: "#1e5a40", grana: "feltro" },
  "feltro-cremisi": { nome: "Feltro cremisi", colore: "#6a2729", grana: "feltro" },
  cuoio: { nome: "Cuoio", colore: "#6e4627", grana: "cuoio", cucitura: true },
  legno: { nome: "Legno", colore: "#7b5632", grana: "legno" },
};

// angolo: quanto si guarda dall'alto (90° = a piombo).
export const VISTE = {
  "tre-quarti": { nome: "Di tre quarti", angolo: (56 * Math.PI) / 180 },
  alto: { nome: "Dall'alto", angolo: Math.PI / 2 },
};

const CHIAVE = "sd-vaschetta";
const PREDEFINITE = { materiale: "feltro-notte", vista: "tre-quarti" };

// Solo valori che esistono: una scelta salvata da una versione diversa non
// deve lasciare la vaschetta senza fondo.
function valide(scelte) {
  return {
    materiale: MATERIALI[scelte?.materiale] ? scelte.materiale : PREDEFINITE.materiale,
    vista: VISTE[scelte?.vista] ? scelte.vista : PREDEFINITE.vista,
  };
}

export function scelteVaschetta() {
  try {
    return valide(JSON.parse(localStorage.getItem(CHIAVE) || "null"));
  } catch {
    return { ...PREDEFINITE };
  }
}

export function salvaScelteVaschetta(campi) {
  const nuove = valide({ ...scelteVaschetta(), ...campi });
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(nuove));
  } catch {
    // Non salvate: valgono finché la pagina resta aperta.
  }
  return nuove;
}
