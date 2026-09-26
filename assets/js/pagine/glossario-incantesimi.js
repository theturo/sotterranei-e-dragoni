// Script della pagina glossario-incantesimi.html (spostato fuori dall'HTML per la Content Security Policy:
// la policy consente solo script serviti dal sito stesso, niente script inline).
import { proteggiPaginaDM } from "../auth.js";
import { montaMenuUtente } from "../menu-utente.js";
import { INCANTESIMI, cercaIncantesimi } from "../incantesimi-srd.js";

const veil = document.getElementById("veil");
const contenuto = document.getElementById("contenuto");
const inputRicerca = document.getElementById("ricerca-glossario");
const selectClasse = document.getElementById("filtro-classe");
const selectLivello = document.getElementById("filtro-livello");
const risultati = document.getElementById("risultati-glossario");
const vuoto = document.getElementById("glossario-vuoto");
const suggerimento = document.getElementById("glossario-suggerimento");

function tuttiGliIncantesimi() {
  return Object.entries(INCANTESIMI)
    .map(([chiave, dati]) => ({ chiave, ...dati }))
    .sort((a, b) => a.livello - b.livello || a.nome.localeCompare(b.nome));
}

function dettagliVoce(voce) {
  const etichettaLivello = voce.livello === 0 ? "Trucchetto" : `${voce.livello}° livello`;
  const bandierine = [voce.concentrazione ? "Concentrazione" : null, voce.rituale ? "Rituale" : null].filter(Boolean).join(" · ");
  const rigaEffetto = voce.danno
    ? `<p class="glossario-riga-effetto"><label>Danno</label> ${voce.danno}</p>`
    : voce.cura
    ? `<p class="glossario-riga-effetto"><label>Cura</label> ${voce.cura}</p>`
    : "";
  return `
    <p><label>Livello</label> ${etichettaLivello} · ${voce.scuola}${bandierine ? ` · ${bandierine}` : ""}</p>
    <p><label>Tempo di lancio</label> ${voce.tempoLancio} · <label>Gittata</label> ${voce.gittata}</p>
    <p><label>Componenti</label> ${voce.componenti} · <label>Durata</label> ${voce.durata}</p>
    <p><label>Classi</label> ${voce.classi.map((c) => c[0].toUpperCase() + c.slice(1)).join(", ")}</p>
    ${rigaEffetto}
    <p>${voce.descrizione}</p>
  `;
}

function renderRisultati(voci) {
  if (voci.length === 0) {
    risultati.innerHTML = "";
    vuoto.hidden = false;
    return;
  }
  vuoto.hidden = true;
  risultati.innerHTML = voci
    .map(
      (voce) => `
    <div class="glossario-card">
      <div class="glossario-card-header">
        <h3>${voce.nome}</h3>
        <span class="role-badge">${voce.livello === 0 ? "Trucchetto" : `${voce.livello}° liv.`}</span>
      </div>
      ${dettagliVoce(voce)}
    </div>`
    )
    .join("");
}

function aggiorna() {
  const testo = inputRicerca.value.trim();
  const classe = selectClasse.value;
  const livello = selectLivello.value === "" ? undefined : Number(selectLivello.value);

  if (!testo && !classe && livello === undefined) {
    risultati.innerHTML = "";
    vuoto.hidden = true;
    suggerimento.hidden = false;
    return;
  }
  suggerimento.hidden = true;

  const voci = testo
    ? cercaIncantesimi(testo, { classe: classe || undefined, livello })
    : tuttiGliIncantesimi()
        .filter((v) => !classe || v.classi.includes(classe))
        .filter((v) => livello === undefined || v.livello === livello);

  renderRisultati(voci);
}

inputRicerca.addEventListener("input", aggiorna);
selectClasse.addEventListener("change", aggiorna);
selectLivello.addEventListener("change", aggiorna);

proteggiPaginaDM((user, profilo) => {
  montaMenuUtente({ contenitore: document.getElementById("slot-utente"), user, profilo });
  veil.style.display = "none";
  contenuto.style.display = "block";
});
