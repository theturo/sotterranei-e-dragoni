// Script di tavolo.html: lo schermo comune del tavolo (TV o monitor). Mostra
// la mappa in tavola come la vedono i giocatori, con le pedine del party, e
// segue l'inquadratura scelta dal DM ("Mostra qui a tutti" nella Sessione);
// durante il combattimento, se il DM lo lascia attivo, segue la pedina di turno.
// Si apre dall'account del DM ma mostra solo ciò che vedono i giocatori: niente
// nemici nascosti, niente PF dei nemici, nebbia di guerra nera (con i nemici
// che ci stanno sotto). Non ha comandi di gioco. Mostra anche gli strumenti di
// tutti (righelli in corso, ping, aree degli incantesimi); il ping del DM
// porta l'inquadratura sul punto.
import {
  proteggiPaginaDM, ottieniCampagnaCorrente, ascoltaTavola, ascoltaGriglia, ascoltaPedine, ascoltaRiepiloghiParty,
  ascoltaCombattimento, ascoltaNebbia,
} from "../auth.js";
import { dimensioniNebbia, adattaNebbia } from "../mappa-calcoli.js";
import { creaVistaMappa } from "../mappa-vista.js";
import { costruisciPedine, creaCacheRitratti, creaCacheImmagini, pedinaDiTurno } from "../mappa-pedine.js";
import { caricaMappa } from "../mappa.js";
import { creaStrumentiCondivisi } from "../mappa-strumenti.js";

const veil = document.getElementById("veil");
const contenuto = document.getElementById("contenuto");
const comandi = document.getElementById("tavolo-comandi");
const bottoneSchermoIntero = document.getElementById("btn-schermo-intero");

// Il pulsante per lo schermo intero sparisce quando non serve.
bottoneSchermoIntero.hidden = !document.documentElement.requestFullscreen;
bottoneSchermoIntero.addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});
document.addEventListener("fullscreenchange", () => {
  bottoneSchermoIntero.textContent = document.fullscreenElement ? "Esci dallo schermo intero" : "Schermo intero";
});
let timerComandi = null;
function mostraComandi() {
  comandi.classList.remove("nascosti");
  clearTimeout(timerComandi);
  timerComandi = setTimeout(() => comandi.classList.add("nascosti"), 3000);
}
document.addEventListener("pointermove", mostraComandi);
mostraComandi();

proteggiPaginaDM(async (user, profilo) => {
  const campagna = await ottieniCampagnaCorrente(user.uid, profilo?.ruolo);
  veil.style.display = "none";
  contenuto.style.display = "block";
  const vista = creaVistaMappa(document.getElementById("tavolo-mappa"), { interattiva: false });
  vista.mostraRettangolo(null);
  if (!campagna) {
    vista.impostaMappa(null, "Nessuna campagna attiva.");
    return;
  }

  let party = [];
  let pedine = [];
  let mappaId; // undefined finché non arriva il primo stato del tavolo
  let smettiGriglia = null;
  let smettiPedine = null;
  let smettiNebbia = null;
  let caricamento = 0;
  let griglia = null;
  let dimensioniMappa = null;
  let nebbiaSalvata = null;
  let nebbia = null;
  let tavola = { inquadratura: null, segueTurno: true };
  const condivisi = creaStrumentiCondivisi({
    vista,
    campagnaId: campagna.id,
    membri: () => campagna.membriUid || [],
    griglia: () => griglia,
    onPing: ({ x, y, delDM }) => {
      if (delDM) vista.centraPunto({ x, y });
    },
  });
  // Lettura come un giocatore (false): solo i combattenti già rivelati.
  let combattimento = { stato: { attivo: false }, combattenti: [] };
  const ritratto = creaCacheRitratti(() => disegnaPedine());
  const immagine = creaCacheImmagini(campagna.id, () => disegnaPedine());
  const disegnaPedine = () => {
    vista.impostaPedine(costruisciPedine({ party, pedine, combattimento, ritratto, immagine, nebbia }));
    vista.impostaNebbia(nebbia, "buio");
    inquadra();
  };
  function ricalcolaNebbia() {
    nebbia = nebbiaSalvata && griglia && dimensioniMappa
      ? adattaNebbia(nebbiaSalvata, dimensioniNebbia(griglia, dimensioniMappa.larghezza, dimensioniMappa.altezza))
      : null;
    disegnaPedine();
  }
  // Pedina di turno (se visibile e se il DM lo vuole), altrimenti l'inquadratura del DM.
  let ultimaInquadratura = "";
  function inquadra() {
    const id = tavola.segueTurno !== false ? pedinaDiTurno(combattimento.stato) : null;
    const rettangolo = (id && vista.rettangoloIntorno(id)) || tavola.inquadratura || null;
    const chiave = JSON.stringify(rettangolo);
    if (chiave === ultimaInquadratura) return;
    ultimaInquadratura = chiave;
    vista.mostraRettangolo(rettangolo);
  }

  ascoltaCombattimento(campagna.id, false, (dati) => {
    combattimento = dati;
    disegnaPedine();
  });

  ascoltaRiepiloghiParty(campagna.id, (elenco) => {
    party = elenco;
    disegnaPedine();
  });

  ascoltaTavola(campagna.id, async (dati) => {
    tavola = dati;
    inquadra();
    if (tavola.immagineId === mappaId) return;
    mappaId = tavola.immagineId;
    smettiGriglia?.();
    smettiPedine?.();
    smettiNebbia?.();
    smettiGriglia = smettiPedine = smettiNebbia = null;
    pedine = [];
    griglia = dimensioniMappa = nebbiaSalvata = nebbia = null;
    condivisi.cambiaMappa(mappaId || null);
    const turno = ++caricamento;
    if (!mappaId) {
      vista.impostaMappa(null, "In attesa che il Dungeon Master metta una mappa in tavola…");
      return;
    }
    vista.impostaMappa(null, "Caricamento della mappa…");
    smettiGriglia = ascoltaGriglia(campagna.id, mappaId, (g) => {
      griglia = g;
      vista.impostaGriglia(g);
      ricalcolaNebbia();
      condivisi.ridisegna();
    });
    smettiNebbia = ascoltaNebbia(campagna.id, mappaId, (n) => {
      nebbiaSalvata = n;
      ricalcolaNebbia();
    });
    smettiPedine = ascoltaPedine(campagna.id, mappaId, (elenco) => {
      pedine = elenco;
      disegnaPedine();
    });
    try {
      const datiMappa = await caricaMappa(campagna.id, mappaId);
      if (turno !== caricamento) return;
      vista.impostaMappa(datiMappa);
      dimensioniMappa = { larghezza: datiMappa.larghezza, altezza: datiMappa.altezza };
      ultimaInquadratura = "";
      ricalcolaNebbia();
    } catch (errore) {
      console.error(errore);
      if (turno === caricamento) vista.impostaMappa(null, "Impossibile caricare l'immagine della mappa.");
    }
  });
});
