// Forma e misura dell'area degli incantesimi del catalogo che ne hanno una,
// secondo il SRD 5.1 (misure in metri: raggio della sfera, lunghezza di cono
// e linea, lato del cubo; 1,5 m = 5 piedi). Usate dagli strumenti della mappa
// della sessione: il giocatore sceglie un proprio incantesimo e l'area è già
// pronta. Le aree lunghe come i muri sono rese come linee larghe una casella.
import { ottieniIncantesimo } from "./incantesimi-srd.js";

export const AREE_INCANTESIMI = {
  mani_brucianti: { forma: "cono", misura: 4.5 },
  raggio_colorato: { forma: "cono", misura: 4.5 },
  groviglio: { forma: "cubo", misura: 6 },
  fuoco_fatuo: { forma: "cubo", misura: 6 },
  nube_di_nebbia: { forma: "sfera", misura: 6 },
  oscurita: { forma: "sfera", misura: 4.5 },
  ragnatela: { forma: "cubo", misura: 6 },
  silenzio: { forma: "sfera", misura: 6 },
  zona_di_verita: { forma: "sfera", misura: 4.5 },
  palla_di_fuoco: { forma: "sfera", misura: 6 },
  fulmine: { forma: "linea", misura: 30 },
  velo_di_vento: { forma: "linea", misura: 15 },
  crescita_vegetale: { forma: "sfera", misura: 30 },
  barriera_di_fuoco: { forma: "linea", misura: 18 },
  confusione: { forma: "sfera", misura: 3 },
  guardiano_di_fede: { forma: "sfera", misura: 3 },
  tempesta_di_ghiaccio: { forma: "sfera", misura: 6 },
  guarigione_di_massa_delle_ferite: { forma: "sfera", misura: 9 },
  cono_di_freddo: { forma: "cono", misura: 18 },
  immagine_maggiore: { forma: "cubo", misura: 6 },
  globo_di_invulnerabilita: { forma: "sfera", misura: 3 },
  prigione_di_forza: { forma: "cubo", misura: 6 },
  terremoto: { forma: "sfera", misura: 30 },
  campo_antimagia: { forma: "sfera", misura: 3 },
  pioggia_di_meteore: { forma: "sfera", misura: 12 },
};

export const FORME_AREA = [
  { chiave: "sfera", nome: "Sfera" },
  { chiave: "cono", nome: "Cono" },
  { chiave: "cubo", nome: "Cubo" },
  { chiave: "linea", nome: "Linea" },
];

export const MISURE_AREA = [1.5, 3, 4.5, 6, 9, 12, 18, 30];

// Incantesimi con un'area tra quelli conosciuti o preparati di una scheda,
// in ordine di livello: [{ chiave, nome, livello, forma, misura }].
export function areeDellaScheda(scheda) {
  const chiavi = new Set([...(scheda?.incantesimiConosciuti || []), ...(scheda?.incantesimiPreparati || [])]);
  return [...chiavi]
    .filter((chiave) => AREE_INCANTESIMI[chiave])
    .map((chiave) => ({ chiave, ...ottieniIncantesimo(chiave), ...AREE_INCANTESIMI[chiave] }))
    .filter((i) => i.nome)
    .sort((a, b) => a.livello - b.livello || a.nome.localeCompare(b.nome))
    .map(({ chiave, nome, livello, forma, misura }) => ({ chiave, nome, livello, forma, misura }));
}
