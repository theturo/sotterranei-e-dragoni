// Script della pagina crea-personaggio.html (spostato fuori dall'HTML per la Content Security Policy:
// la policy consente solo script serviti dal sito stesso, niente script inline).
import { proteggiPagina, ottieniCampagnaCorrente, creaScheda } from "../auth.js";
import { esc } from "../utils.js";
import { montaMenuUtente } from "../menu-utente.js";
import {
  RAZZE,
  CLASSI,
  CARATTERISTICHE,
  ARRAY_STANDARD,
  modificatore,
  formattaModificatore,
  puntiVitaIniziali,
  nomeRazzaCompleto,
  velocitaRazza,
} from "../dati-srd.js";

const veil = document.getElementById("veil");
const contenuto = document.getElementById("contenuto");
const messaggioWizard = document.getElementById("messaggio-wizard");
const btnIndietro = document.getElementById("btn-indietro");
const btnAvanti = document.getElementById("btn-avanti");
const btnCrea = document.getElementById("btn-crea");
const badgePasso = document.getElementById("badge-passo");

const TOTALE_PASSI = 5;
let passoCorrente = 1;
let uidCorrente = null;
let campagnaIdCorrente = null;

const stato = {
  nome: "",
  razza: "",
  sottorazza: "",
  bonusScelta: ["", ""],
  classe: "",
  punteggi: { forza: "", destrezza: "", costituzione: "", intelligenza: "", saggezza: "", carisma: "" },
};

function mostraErrore(testo) {
  messaggioWizard.textContent = testo;
  messaggioWizard.className = "message visible error";
}
function nascondiErrore() {
  messaggioWizard.className = "message";
}

// ---------- Passo 2: razza ----------
const selectRazza = document.getElementById("select-razza");
const campoSottorazza = document.getElementById("campo-sottorazza");
const selectSottorazza = document.getElementById("select-sottorazza");
const campoBonusScelta = document.getElementById("campo-bonus-scelta");
const selectBonus1 = document.getElementById("select-bonus-1");
const selectBonus2 = document.getElementById("select-bonus-2");

Object.entries(RAZZE).forEach(([chiave, razza]) => {
  const opzione = document.createElement("option");
  opzione.value = chiave;
  opzione.textContent = razza.nome;
  selectRazza.appendChild(opzione);
});
selectRazza.value = "";
selectRazza.insertAdjacentHTML("afterbegin", '<option value="" disabled selected>— Scegli una razza —</option>');

function aggiornaSottorazza() {
  const razza = RAZZE[stato.razza];
  const haSottorazze = Boolean(razza?.sottorazze);
  campoSottorazza.hidden = !haSottorazze;
  selectSottorazza.innerHTML = "";
  stato.sottorazza = "";
  if (haSottorazze) {
    selectSottorazza.insertAdjacentHTML("beforeend", '<option value="" disabled selected>— Scegli —</option>');
    Object.entries(razza.sottorazze).forEach(([chiave, sotto]) => {
      const opzione = document.createElement("option");
      opzione.value = chiave;
      opzione.textContent = sotto.nome;
      selectSottorazza.appendChild(opzione);
    });
  }

  const haBonusScelta = Boolean(razza?.bonusScelta);
  campoBonusScelta.hidden = !haBonusScelta;
  stato.bonusScelta = ["", ""];
  if (haBonusScelta) {
    popolaSelectBonusScelta();
  }
}

function popolaSelectBonusScelta() {
  const razza = RAZZE[stato.razza];
  const disponibili = CARATTERISTICHE.filter((c) => c.chiave !== razza.bonusScelta.esclusa);
  [selectBonus1, selectBonus2].forEach((select, indice) => {
    const valoreAttuale = stato.bonusScelta[indice];
    const altroValore = stato.bonusScelta[1 - indice];
    select.innerHTML = '<option value="" disabled selected>— Scegli —</option>';
    disponibili
      .filter((c) => c.chiave !== altroValore)
      .forEach((c) => {
        const opzione = document.createElement("option");
        opzione.value = c.chiave;
        opzione.textContent = c.nome;
        if (c.chiave === valoreAttuale) opzione.selected = true;
        select.appendChild(opzione);
      });
  });
}

selectRazza.addEventListener("change", () => {
  stato.razza = selectRazza.value;
  aggiornaSottorazza();
});
selectSottorazza.addEventListener("change", () => {
  stato.sottorazza = selectSottorazza.value;
});
selectBonus1.addEventListener("change", () => {
  stato.bonusScelta[0] = selectBonus1.value;
  popolaSelectBonusScelta();
});
selectBonus2.addEventListener("change", () => {
  stato.bonusScelta[1] = selectBonus2.value;
  popolaSelectBonusScelta();
});

// ---------- Passo 3: classe ----------
const selectClasse = document.getElementById("select-classe");
selectClasse.insertAdjacentHTML("beforeend", '<option value="" disabled selected>— Scegli una classe —</option>');
Object.entries(CLASSI).forEach(([chiave, classe]) => {
  const opzione = document.createElement("option");
  opzione.value = chiave;
  opzione.textContent = `${classe.icona} ${classe.nome}`;
  selectClasse.appendChild(opzione);
});
selectClasse.addEventListener("change", () => {
  stato.classe = selectClasse.value;
});

// ---------- Passo 4: punteggi ----------
function bonusRazzaCaratteristica(chiave) {
  const razza = RAZZE[stato.razza];
  if (!razza) return 0;
  let bonus = razza.bonusFissi?.[chiave] || 0;
  const sottorazza = razza.sottorazze?.[stato.sottorazza];
  bonus += sottorazza?.bonusFissi?.[chiave] || 0;
  if (razza.bonusScelta && stato.bonusScelta.includes(chiave)) {
    bonus += razza.bonusScelta.valore;
  }
  return bonus;
}

const corpoPunteggi = document.getElementById("corpo-punteggi");
CARATTERISTICHE.forEach(({ chiave, nome }) => {
  const tr = document.createElement("tr");
  tr.dataset.chiave = chiave;
  tr.innerHTML = `
    <td>${nome}</td>
    <td><select class="select-punteggio" data-chiave="${chiave}"></select></td>
    <td class="cella-bonus-razza"></td>
    <td class="cella-totale"></td>
    <td class="cella-mod"></td>
  `;
  corpoPunteggi.appendChild(tr);
});

function renderSelectPunteggi() {
  const usati = Object.values(stato.punteggi).filter((v) => v !== "");
  document.querySelectorAll(".select-punteggio").forEach((select) => {
    const chiave = select.dataset.chiave;
    const valoreAttuale = stato.punteggi[chiave];
    select.innerHTML = '<option value="" disabled selected>—</option>';
    ARRAY_STANDARD.forEach((valore) => {
      if (valore !== valoreAttuale && usati.includes(valore)) return;
      const opzione = document.createElement("option");
      opzione.value = valore;
      opzione.textContent = valore;
      if (valore === valoreAttuale) opzione.selected = true;
      select.appendChild(opzione);
    });
  });
  renderTotaliPunteggi();
}

function renderTotaliPunteggi() {
  CARATTERISTICHE.forEach(({ chiave }) => {
    const riga = corpoPunteggi.querySelector(`tr[data-chiave="${chiave}"]`);
    const base = stato.punteggi[chiave];
    const bonus = bonusRazzaCaratteristica(chiave);
    riga.querySelector(".cella-bonus-razza").textContent = bonus ? `+${bonus}` : "—";
    if (base === "") {
      riga.querySelector(".cella-totale").textContent = "—";
      riga.querySelector(".cella-mod").textContent = "—";
    } else {
      const totale = base + bonus;
      riga.querySelector(".cella-totale").textContent = totale;
      riga.querySelector(".cella-mod").textContent = formattaModificatore(modificatore(totale));
    }
  });
}

corpoPunteggi.addEventListener("change", (evento) => {
  const select = evento.target.closest(".select-punteggio");
  if (!select) return;
  stato.punteggi[select.dataset.chiave] = Number(select.value);
  renderSelectPunteggi();
});

// ---------- Passo 5: riepilogo ----------
function puntiVitaMassimi() {
  const modCostituzione = modificatore(stato.punteggi.costituzione + bonusRazzaCaratteristica("costituzione"));
  return puntiVitaIniziali(stato.classe, modCostituzione);
}

function renderRiepilogo() {
  const classe = CLASSI[stato.classe];
  const righeCaratteristiche = CARATTERISTICHE.map(({ chiave, nome }) => {
    const totale = stato.punteggi[chiave] + bonusRazzaCaratteristica(chiave);
    return `<li>${nome}: <b>${totale}</b> (${formattaModificatore(modificatore(totale))})</li>`;
  }).join("");

  document.getElementById("riepilogo").innerHTML = `
    <p><label>Nome</label> <b>${esc(stato.nome)}</b></p>
    <p><label>Razza</label> <b>${nomeRazzaCompleto(stato.razza, stato.sottorazza)}</b></p>
    <p><label>Classe</label> <b><span class="icona-classe">${classe.iconaSvg}</span>${classe.nome}</b></p>
    <p><label>Velocità</label> <b>${String(velocitaRazza(stato.razza, stato.sottorazza)).replace(".", ",")} m</b></p>
    <p><label>Punti Ferita massimi</label> <b>${puntiVitaMassimi()}</b></p>
    <ul class="lista-competenze">${righeCaratteristiche}</ul>
  `;
}

// ---------- Navigazione passi ----------
function validaPasso() {
  switch (passoCorrente) {
    case 1:
      return document.getElementById("input-nome").value.trim().length > 0 || "Inserisci un nome per il personaggio.";
    case 2: {
      const razza = RAZZE[stato.razza];
      if (!razza) return "Scegli una razza.";
      if (razza.sottorazze && !stato.sottorazza) return "Scegli una sottorazza.";
      if (razza.bonusScelta && (!stato.bonusScelta[0] || !stato.bonusScelta[1])) {
        return "Scegli le due caratteristiche da migliorare.";
      }
      return true;
    }
    case 3:
      return Boolean(stato.classe) || "Scegli una classe.";
    case 4:
      return Object.values(stato.punteggi).every((v) => v !== "") || "Assegna tutti e sei i valori.";
    default:
      return true;
  }
}

function mostraPasso(numero) {
  for (let i = 1; i <= TOTALE_PASSI; i++) {
    document.getElementById(`passo-${i}`).hidden = i !== numero;
  }
  badgePasso.textContent = `Passo ${numero} di ${TOTALE_PASSI}`;
  btnIndietro.style.visibility = numero === 1 ? "hidden" : "visible";
  btnAvanti.hidden = numero === TOTALE_PASSI;
  btnCrea.hidden = numero !== TOTALE_PASSI;
  nascondiErrore();

  if (numero === 4) renderSelectPunteggi();
  if (numero === 5) renderRiepilogo();
}

btnAvanti.addEventListener("click", () => {
  if (passoCorrente === 1) stato.nome = document.getElementById("input-nome").value.trim();
  const esito = validaPasso();
  if (esito !== true) {
    mostraErrore(esito);
    return;
  }
  passoCorrente += 1;
  mostraPasso(passoCorrente);
});

btnIndietro.addEventListener("click", () => {
  passoCorrente = Math.max(1, passoCorrente - 1);
  mostraPasso(passoCorrente);
});

btnCrea.addEventListener("click", async () => {
  btnCrea.disabled = true;
  btnCrea.textContent = "Creazione in corso…";
  try {
    const modCostituzione = modificatore(stato.punteggi.costituzione + bonusRazzaCaratteristica("costituzione"));
    const massimi = puntiVitaIniziali(stato.classe, modCostituzione);
    const caratteristicheFinali = {};
    CARATTERISTICHE.forEach(({ chiave }) => {
      caratteristicheFinali[chiave] = stato.punteggi[chiave] + bonusRazzaCaratteristica(chiave);
    });

    const id = await creaScheda(uidCorrente, campagnaIdCorrente, {
      nome: stato.nome,
      razza: stato.razza,
      sottorazza: stato.sottorazza || null,
      classe: stato.classe,
      livello: 1,
      caratteristiche: caratteristicheFinali,
      hp: { massimi, attuali: massimi, temporanei: 0 },
      tiriSalvezzaMorte: { successi: [false, false, false], fallimenti: [false, false, false] },
    });

    window.location.href = `scheda-personaggio.html?id=${id}`;
  } catch (errore) {
    mostraErrore("Impossibile creare il personaggio. Riprova.");
    console.error(errore);
    btnCrea.disabled = false;
    btnCrea.textContent = "Crea personaggio";
  }
});

proteggiPagina(async (user, profilo) => {
  uidCorrente = user.uid;
  montaMenuUtente({ contenitore: document.getElementById("slot-utente"), user, profilo });

  const campagna = await ottieniCampagnaCorrente(user.uid, profilo?.ruolo);
  if (!campagna) {
    window.location.href = "i-miei-personaggi.html";
    return;
  }
  campagnaIdCorrente = campagna.id;

  mostraPasso(1);
  veil.style.display = "none";
  contenuto.style.display = "block";
});
