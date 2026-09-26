// Script della pagina glossario-equipaggiamento.html (spostato fuori dall'HTML per la Content Security Policy:
// la policy consente solo script serviti dal sito stesso, niente script inline).
import { proteggiPaginaDM } from "../auth.js";
import { montaMenuUtente } from "../menu-utente.js";
import { tuttiGliOggetti, ETICHETTE_CATEGORIA, cercaEquipaggiamento } from "../equipaggiamento-srd.js";

const veil = document.getElementById("veil");
const contenuto = document.getElementById("contenuto");
const inputRicerca = document.getElementById("ricerca-glossario");
const selectCategoria = document.getElementById("filtro-categoria");
const risultati = document.getElementById("risultati-glossario");
const vuoto = document.getElementById("glossario-vuoto");
const suggerimento = document.getElementById("glossario-suggerimento");

function dettagliVoce(voce) {
  switch (voce.categoria) {
    case "arma":
      return `
        <p><label>Tipo</label> Arma ${voce.sottocategoria} · ${voce.tipo}</p>
        <p><label>Danno</label> ${voce.danno} ${voce.tipoDanno}</p>
        ${voce.proprieta?.length ? `<p><label>Proprietà</label> ${voce.proprieta.join(", ")}</p>` : ""}
        <p><label>Costo</label> ${voce.costo} · <label>Peso</label> ${voce.peso} lb</p>
      `;
    case "armatura":
      return `
        <p><label>Tipo</label> Armatura ${voce.sottocategoria}</p>
        <p><label>Classe Armatura</label> ${voce.ca}</p>
        ${voce.forzaRichiesta ? `<p><label>Forza richiesta</label> ${voce.forzaRichiesta}</p>` : ""}
        <p><label>Svantaggio in Furtività</label> ${voce.svantaggioFurtivita ? "Sì" : "No"}</p>
        <p><label>Costo</label> ${voce.costo} · <label>Peso</label> ${voce.peso} lb</p>
      `;
    case "oggetto":
      return `<p><label>Costo</label> ${voce.costo}${voce.peso ? ` · <label>Peso</label> ${voce.peso} lb` : ""}</p>`;
    case "strumento":
      return `
        <p><label>Tipo</label> ${voce.sottocategoria}</p>
        <p><label>Costo</label> ${voce.costo}${voce.peso ? ` · <label>Peso</label> ${voce.peso} lb` : ""}</p>
      `;
    case "pacco":
      return `
        <p><label>Costo</label> ${voce.costo}</p>
        <p><label>Contenuto</label></p>
        <ul class="lista-competenze">${voce.contenuto.map((c) => `<li>${c}</li>`).join("")}</ul>
      `;
    case "montatura":
      return `<p><label>Costo</label> ${voce.costo}${voce.note ? ` · ${voce.note}` : ""}</p>`;
    default:
      return "";
  }
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
        <span class="role-badge">${ETICHETTE_CATEGORIA[voce.categoria]}</span>
      </div>
      ${dettagliVoce(voce)}
    </div>`
    )
    .join("");
}

function aggiorna() {
  const testo = inputRicerca.value.trim();
  const categoria = selectCategoria.value;

  if (!testo && !categoria) {
    risultati.innerHTML = "";
    vuoto.hidden = true;
    suggerimento.hidden = false;
    return;
  }
  suggerimento.hidden = true;

  const voci = testo
    ? cercaEquipaggiamento(testo, { categoria: categoria || undefined })
    : tuttiGliOggetti()
        .filter((v) => v.categoria === categoria)
        .sort((a, b) => a.nome.localeCompare(b.nome));

  renderRisultati(voci);
}

inputRicerca.addEventListener("input", aggiorna);
selectCategoria.addEventListener("change", aggiorna);

proteggiPaginaDM((user, profilo) => {
  montaMenuUtente({ contenitore: document.getElementById("slot-utente"), user, profilo });
  veil.style.display = "none";
  contenuto.style.display = "block";
});
