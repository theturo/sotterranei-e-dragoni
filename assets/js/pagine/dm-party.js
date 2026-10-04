// Script della pagina dm-party.html (spostato fuori dall'HTML per la Content Security Policy:
// la policy consente solo script serviti dal sito stesso, niente script inline).
import {
  proteggiPaginaDM,
  ottieniCampagnaCorrente,
  elencaMembriCampagna,
  ottieniSchedaAttiva,
  impostaLivelloPartenza,
  concediLivelli,
  annullaLivello,
  ascoltaCreditiCampagna,
} from "../auth.js";
import { montaMenuUtente } from "../menu-utente.js";
import { esc } from "../utils.js";
import { CLASSI, nomeRazzaCompleto } from "../dati-srd.js";
import { mostraImmagine, percorsiRitratto } from "../immagini.js";
import { apriEsportazione, pdfDelleSchede, jsonDelleSchede, nomeFile } from "../esporta-scheda.js";

const veil = document.getElementById("veil");
const contenuto = document.getElementById("contenuto");
const corpoTabella = document.getElementById("corpo-tabella");
const nessunGiocatore = document.getElementById("nessun-giocatore");
const toast = document.getElementById("toast");

let toastTimer = null;
function mostraToast(testo, errore = false) {
  toast.textContent = testo;
  toast.className = `toast visibile${errore ? " toast-errore" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = "toast";
  }, 3200);
}

function creaRiga(giocatore) {
  const tr = document.createElement("tr");
  tr.dataset.uid = giocatore.uid;
  tr.innerHTML = `
    <td>${esc(giocatore.nome || giocatore.email) || "—"}</td>
    <td data-cella="personaggio">—</td>
    <td data-cella="classe">—</td>
    <td class="cella-livello">—</td>
    <td class="cella-pf">—</td>
    <td class="azioni-riga">
      <button class="btn-tabella btn-icona-azione" data-azione="concedi" title="Concedi un livello" aria-label="Concedi un livello" type="button"><svg viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><path d="M12 3 L18.5 10 L14 10 L14 20 L10 20 L10 10 L5.5 10 Z M12 5 L13.1 7.3 L12 9.2 L10.9 7.3 Z M11.55 11 L12.45 11 L12.45 19 L11.55 19 Z"/></svg></button>
      <a class="btn-tabella btn-icona-azione azione-disabilitata" data-cella="visualizza" title="Nessun personaggio attivo" aria-label="Visualizza scheda"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12 C6 7 18 7 22 12 C18 17 6 17 2 12 Z"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/></svg></a>
    </td>
  `;
  return tr;
}

function testoPf(scheda) {
  if (!scheda?.hp) return "—";
  const { massimi, attuali, temporanei } = scheda.hp;
  return temporanei > 0 ? `${attuali} / ${massimi} (+${temporanei})` : `${attuali} / ${massimi}`;
}

// Un'unica lettura della scheda attiva del giocatore alimenta PF, Personaggio,
// Classe e il link "Visualizza scheda" — evita fetch ripetute per la stessa riga.
let campagnaIdCorrente = null;
let campagnaCorrente = null;
// Livello e nome della scheda attiva di ogni membro, e i crediti di livello
// concessi in questa campagna e non ancora spesi (uid → numero).
const schedeAttive = new Map();
let crediti = new Map();

const livelloScheda = (uid) => schedeAttive.get(uid)?.livello || 1;

// Colonna Livello: il livello della scheda attiva più, se ci sono crediti non
// spesi, «↑ al N° in attesa · Annulla».
function disegnaLivello(riga) {
  const uid = riga.dataset.uid;
  const cella = riga.querySelector(".cella-livello");
  const livello = schedeAttive.has(uid) ? livelloScheda(uid) : null;
  const inAttesa = crediti.get(uid) || 0;
  cella.innerHTML = `<span class="livello-numero">${livello ?? "—"}</span>${
    inAttesa > 0
      ? `<span class="livello-attesa">↑ al ${(livello ?? 1) + inAttesa}° in attesa · <button type="button" class="livello-annulla" data-azione="annulla">Annulla</button></span>`
      : ""
  }`;
}

async function caricaDatiRiga(riga) {
  const cellaPersonaggio = riga.querySelector('[data-cella="personaggio"]');
  const cellaClasse = riga.querySelector('[data-cella="classe"]');
  const linkVisualizza = riga.querySelector('[data-cella="visualizza"]');

  try {
    const scheda = await ottieniSchedaAttiva(riga.dataset.uid, campagnaIdCorrente);
    riga.querySelector(".cella-pf").textContent = testoPf(scheda);
    if (scheda) schedeAttive.set(riga.dataset.uid, { livello: scheda.livello || 1, nome: scheda.nome || null });
    disegnaLivello(riga);

    if (scheda) {
      cellaPersonaggio.innerHTML = `${esc(scheda.nome) || "—"}${
        scheda.razza ? `<span class="cella-personaggio-sub">${esc(nomeRazzaCompleto(scheda.razza, scheda.sottorazza))}</span>` : ""
      }`;
      if (scheda.ritratto) {
        const img = document.createElement("img");
        img.className = "icona-ritratto";
        img.alt = "";
        img.hidden = true;
        cellaPersonaggio.classList.add("cella-con-ritratto");
        cellaPersonaggio.prepend(img);
        mostraImmagine(img, percorsiRitratto(riga.dataset.uid, scheda.id, scheda.ritratto).icona);
      }
      const classe = CLASSI[scheda.classe];
      cellaClasse.innerHTML = classe
        ? `<span class="cella-classe"><span class="icona-classe" title="${classe.nome}">${classe.iconaSvg}</span>${classe.nome}</span>`
        : "—";
      linkVisualizza.href = `scheda-personaggio.html?id=${encodeURIComponent(scheda.id)}`;
      linkVisualizza.title = "Visualizza scheda";
      linkVisualizza.classList.remove("azione-disabilitata");
    }
  } catch (errore) {
    console.error(errore);
  }
}

proteggiPaginaDM(async (user, profilo) => {
  montaMenuUtente({ contenitore: document.getElementById("slot-utente"), user, profilo });

  const campagna = await ottieniCampagnaCorrente(user.uid, profilo?.ruolo, { soloDM: true });
  if (!campagna) {
    document.getElementById("nessuna-campagna").hidden = false;
    document.getElementById("pannello-party").hidden = true;
    veil.style.display = "none";
    contenuto.style.display = "block";
    return;
  }
  campagnaIdCorrente = campagna.id;
  campagnaCorrente = campagna;
  preparaLivelloPartenza(campagna.livelloPartenza || 1);

  try {
    const giocatori = await elencaMembriCampagna(campagnaIdCorrente);
    if (giocatori.length === 0) {
      nessunGiocatore.style.display = "block";
    } else {
      corpoTabella.innerHTML = "";
      giocatori.forEach((g) => corpoTabella.appendChild(creaRiga(g)));
      Array.from(corpoTabella.querySelectorAll("tr")).forEach(caricaDatiRiga);
      ascoltaCreditiCampagna(campagnaIdCorrente, (mappa) => {
        crediti = mappa;
        corpoTabella.querySelectorAll("tr[data-uid]").forEach(disegnaLivello);
      });
    }
  } catch (errore) {
    mostraToast("Impossibile caricare il party.", true);
    console.error(errore);
  }

  veil.style.display = "none";
  contenuto.style.display = "block";
});

// Concede un livello al membro di una riga; restituisce true se riuscito. La
// colonna si aggiorna da sola con i crediti (ascoltaCreditiCampagna).
async function concediLivelloRiga(riga) {
  const uid = riga.dataset.uid;
  try {
    await concediLivelli(campagnaIdCorrente, uid, {
      livelloAttuale: livelloScheda(uid) + (crediti.get(uid) || 0),
      personaggio: schedeAttive.get(uid)?.nome || null,
    });
    return true;
  } catch (errore) {
    console.error(errore);
    return false;
  }
}

corpoTabella.addEventListener("click", async (evento) => {
  const bottone = evento.target.closest("[data-azione]");
  if (!bottone) return;
  const riga = bottone.closest("tr");
  const uid = riga.dataset.uid;
  bottone.disabled = true;

  if (bottone.dataset.azione === "annulla") {
    try {
      await annullaLivello(campagnaIdCorrente, uid, { livelloAnnullato: livelloScheda(uid) + (crediti.get(uid) || 0) });
      mostraToast("Passaggio di livello annullato: il giocatore riceve un avviso.");
    } catch (errore) {
      console.error(errore);
      bottone.disabled = false;
      mostraToast("Impossibile annullare: forse il giocatore ha già speso il livello.", true);
    }
    return;
  }

  const riuscito = await concediLivelloRiga(riga);
  mostraToast(
    riuscito
      ? "Livello concesso: il giocatore riceve un avviso e lo spende dalla scheda."
      : "Impossibile concedere il livello.",
    !riuscito
  );
  bottone.disabled = false;
});

document.getElementById("btn-livello-party").addEventListener("click", async (evento) => {
  const righe = Array.from(corpoTabella.querySelectorAll("tr[data-uid]"));
  if (righe.length === 0) {
    mostraToast("Nessun giocatore da aggiornare.", true);
    return;
  }

  const bottoneParty = evento.currentTarget;
  bottoneParty.disabled = true;
  corpoTabella.querySelectorAll('[data-azione="concedi"]').forEach((b) => (b.disabled = true));

  const risultati = await Promise.all(righe.map((riga) => concediLivelloRiga(riga)));
  const successi = risultati.filter(Boolean).length;
  const falliti = risultati.length - successi;

  mostraToast(
    falliti === 0
      ? `Livello concesso a tutto il party (${successi} giocatori).`
      : `Livello concesso a ${successi} giocatori, ${falliti} falliti.`,
    falliti > 0
  );

  bottoneParty.disabled = false;
  corpoTabella.querySelectorAll('[data-azione="concedi"]').forEach((b) => (b.disabled = false));
});

// Livello di partenza: porta tutto il party al livello scelto (vedi
// impostaLivelloPartenza in auth.js) e lo ricorda per la guida della scheda.
function preparaLivelloPartenza(attuale) {
  const select = document.getElementById("select-livello-partenza");
  select.innerHTML = Array.from({ length: 20 }, (_, i) => i + 1)
    .map((n) => `<option value="${n}"${n === attuale ? " selected" : ""}>Livello ${n}</option>`)
    .join("");
  const bottone = document.getElementById("btn-livello-partenza");
  bottone.addEventListener("click", async () => {
    const livello = Number(select.value);
    if (!confirm(`Portare tutto il party al livello ${livello}? Chi è sotto riceverà i livelli mancanti da spendere nella scheda.`)) return;
    bottone.disabled = true;
    try {
      const esiti = await impostaLivelloPartenza(campagnaIdCorrente, livello);
      const falliti = esiti.filter((e) => e.errore).length;
      const aggiornati = esiti.filter((e) => e.concessi > 0);
      mostraToast(
        falliti
          ? `Livello di partenza salvato; ${falliti} giocatori non aggiornati.`
          : aggiornati.length
            ? `Livello ${livello}: livelli concessi a ${aggiornati.length} giocatori.`
            : `Livello di partenza ${livello}: tutti i giocatori ci sono già.`,
        falliti > 0
      );
    } catch (errore) {
      console.error(errore);
      mostraToast("Impossibile impostare il livello di partenza.", true);
    } finally {
      bottone.disabled = false;
    }
  });
}

// Esportazione del party: un solo PDF con le schede attive di tutti i membri
// (una dopo l'altra) e un backup JSON con tutti i dati.
async function schedeDelParty() {
  const membri = await elencaMembriCampagna(campagnaIdCorrente);
  const voci = await Promise.all(membri.map(async (m) => ({ scheda: await ottieniSchedaAttiva(m.uid, campagnaIdCorrente), giocatore: m.nome || null })));
  const schede = voci.filter((v) => v.scheda);
  if (schede.length === 0) throw new Error("Nessuna scheda attiva nel party.");
  return schede;
}

document.getElementById("btn-esporta-party").addEventListener("click", () => {
  const titoloCampagna = campagnaCorrente?.titolo || "party";
  const data = new Date().toISOString().slice(0, 10);
  apriEsportazione({
    titolo: "Esporta il party",
    descrizione: "Le schede attive di tutti i giocatori della campagna, una dopo l'altra.",
    pdf: async () => ({ blob: await pdfDelleSchede(await schedeDelParty(), `Party — ${titoloCampagna}`), nome: nomeFile(`party-${titoloCampagna}-${data}`, "pdf") }),
    json: async () => ({
      blob: jsonDelleSchede(await schedeDelParty(), { campagna: { id: campagnaIdCorrente, titolo: campagnaCorrente?.titolo || null } }),
      nome: nomeFile(`party-${titoloCampagna}-${data}-backup`, "json"),
    }),
  });
});
