// App installabile (PWA), caricato da ogni pagina:
// - registra il service worker (sw.js) e, quando è pronta una versione nuova
//   del sito, mostra "È disponibile una nuova versione" con "Aggiorna";
// - tiene l'invito a installare l'app: su Android/Chrome la finestra del
//   browser (evento beforeinstallprompt), su iPhone le istruzioni per
//   "Aggiungi alla schermata Home".

const inAppInstallata = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

const suIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// ---------- Aggiornamenti ----------

let bannerMostrato = false;

function mostraBannerAggiornamento(registrazione) {
  if (bannerMostrato) return;
  bannerMostrato = true;
  const banner = document.createElement("div");
  banner.className = "banner-app";
  banner.setAttribute("role", "status");
  const testo = document.createElement("span");
  testo.textContent = "È disponibile una nuova versione.";
  const aggiorna = document.createElement("button");
  aggiorna.type = "button";
  aggiorna.className = "btn-tabella btn-tabella-evidenza";
  aggiorna.textContent = "Aggiorna";
  const chiudi = document.createElement("button");
  chiudi.type = "button";
  chiudi.className = "banner-app-chiudi";
  chiudi.setAttribute("aria-label", "Più tardi");
  chiudi.textContent = "×";
  aggiorna.addEventListener("click", () => {
    aggiorna.disabled = true;
    registrazione.waiting?.postMessage({ tipo: "attiva" });
  });
  chiudi.addEventListener("click", () => banner.remove());
  banner.append(testo, aggiorna, chiudi);
  document.body.append(banner);
}

async function registraServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  let registrazione;
  try {
    registrazione = await navigator.serviceWorker.register("sw.js", { scope: "./" });
  } catch (errore) {
    console.error("Service worker non registrato", errore);
    return;
  }
  if (!registrazione) return;
  // Una versione nuova in attesa conta solo se ce n'è già una attiva
  // (la prima installazione non è un "aggiornamento").
  const controlla = () => {
    if (registrazione.waiting && navigator.serviceWorker.controller) mostraBannerAggiornamento(registrazione);
  };
  controlla();
  registrazione.addEventListener("updatefound", () => {
    const nuovo = registrazione.installing;
    nuovo?.addEventListener("statechange", () => {
      if (nuovo.state === "installed") controlla();
    });
  });
  // Con "Aggiorna" la versione nuova prende il controllo: si ricarica la pagina.
  let ricaricata = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (ricaricata || !bannerMostrato) return;
    ricaricata = true;
    window.location.reload();
  });
  // L'app installata può restare aperta per giorni: si ricontrolla quando torna in primo piano.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") registrazione.update().catch(() => {});
  });
}

// ---------- Installazione ----------

let richiestaInstallazione = null;
const ascoltatori = new Set();
const avvisa = () => ascoltatori.forEach((f) => f(statoInstallazione()));

window.addEventListener("beforeinstallprompt", (evento) => {
  evento.preventDefault();
  richiestaInstallazione = evento;
  avvisa();
});
window.addEventListener("appinstalled", () => {
  richiestaInstallazione = null;
  avvisa();
});

// { installata, possibile }: "possibile" se il browser offre l'installazione
// con un tocco o se siamo su iPhone/iPad (istruzioni a mano).
export function statoInstallazione() {
  const installata = inAppInstallata();
  return { installata, possibile: !installata && (Boolean(richiestaInstallazione) || suIOS()) };
}

export function quandoCambiaInstallazione(callback) {
  ascoltatori.add(callback);
  return () => ascoltatori.delete(callback);
}

export async function installaApp() {
  if (richiestaInstallazione) {
    const evento = richiestaInstallazione;
    richiestaInstallazione = null;
    await evento.prompt();
    await evento.userChoice.catch(() => null);
    avvisa();
    return;
  }
  if (suIOS()) mostraIstruzioniIOS();
}

const ICONA_CONDIVIDI = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5v10h14V11h-1"/></svg>';

function mostraIstruzioniIOS() {
  const sfondo = document.createElement("div");
  sfondo.className = "modal-overlay";
  sfondo.style.display = "flex";
  const finestra = document.createElement("div");
  finestra.className = "modal-card modal-installa";
  finestra.setAttribute("role", "dialog");
  finestra.setAttribute("aria-modal", "true");
  finestra.setAttribute("aria-labelledby", "titolo-installa");
  // Testo fisso, nessun dato inserito dagli utenti.
  finestra.innerHTML = `
    <h2 id="titolo-installa">Installa l'app su iPhone</h2>
    <ol class="passi-installa">
      <li>Apri il sito in <b>Safari</b>.</li>
      <li>Tocca <b>Condividi</b> <span class="icona-condividi">${ICONA_CONDIVIDI}</span> nella barra in basso.</li>
      <li>Scorri e scegli <b>Aggiungi alla schermata Home</b>, poi <b>Aggiungi</b>.</li>
    </ol>
    <p class="card-tagline">L'icona "S&amp;D" comparirà tra le app e si aprirà a schermo intero.</p>
    <div class="azioni-selettore"><button type="button" class="btn-tabella">Ho capito</button></div>`;
  sfondo.append(finestra);
  document.body.append(sfondo);
  const chiudi = () => sfondo.remove();
  finestra.querySelector("button").addEventListener("click", chiudi);
  sfondo.addEventListener("click", (evento) => {
    if (evento.target === sfondo) chiudi();
  });
}

registraServiceWorker();
