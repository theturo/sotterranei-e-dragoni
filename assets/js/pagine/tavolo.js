// Script di tavolo.html: lo schermo comune del tavolo (TV o monitor). Mostra
// la mappa in tavola come la vedono i giocatori, con le pedine del party, e
// segue l'inquadratura scelta dal DM ("Mostra qui a tutti" nella Sessione).
// Si apre dall'account del DM; non ha comandi di gioco.
import { proteggiPaginaDM, ottieniCampagnaCorrente, ascoltaTavola, ascoltaGriglia, ascoltaPedine, ascoltaRiepiloghiParty } from "../auth.js";
import { creaVistaMappa } from "../mappa-vista.js";
import { pedineDaParty, creaCacheRitratti } from "../mappa-pedine.js";
import { caricaMappa } from "../mappa.js";

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
  let caricamento = 0;
  const ritratto = creaCacheRitratti(() => disegnaPedine());
  const disegnaPedine = () => vista.impostaPedine(pedineDaParty({ party, pedine, ritratto }));

  ascoltaRiepiloghiParty(campagna.id, (elenco) => {
    party = elenco;
    disegnaPedine();
  });

  ascoltaTavola(campagna.id, async (tavola) => {
    vista.mostraRettangolo(tavola.inquadratura || null);
    if (tavola.immagineId === mappaId) return;
    mappaId = tavola.immagineId;
    smettiGriglia?.();
    smettiPedine?.();
    smettiGriglia = smettiPedine = null;
    pedine = [];
    const turno = ++caricamento;
    if (!mappaId) {
      vista.impostaMappa(null, "In attesa che il Dungeon Master metta una mappa in tavola…");
      return;
    }
    vista.impostaMappa(null, "Caricamento della mappa…");
    smettiGriglia = ascoltaGriglia(campagna.id, mappaId, (griglia) => vista.impostaGriglia(griglia));
    smettiPedine = ascoltaPedine(campagna.id, mappaId, (elenco) => {
      pedine = elenco;
      disegnaPedine();
    });
    try {
      const immagine = await caricaMappa(campagna.id, mappaId);
      if (turno !== caricamento) return;
      vista.impostaMappa(immagine);
      vista.mostraRettangolo(tavola.inquadratura || null);
    } catch (errore) {
      console.error(errore);
      if (turno === caricamento) vista.impostaMappa(null, "Impossibile caricare l'immagine della mappa.");
    }
  });
});
