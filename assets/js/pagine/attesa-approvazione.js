// Script della pagina attesa-approvazione.html (spostato fuori dall'HTML per la Content Security Policy:
// la policy consente solo script serviti dal sito stesso, niente script inline).
import { proteggiPaginaSenzaVerifica, profiloApprovato, esciUtente } from "../auth.js";
import { ottieniProfiloUtente } from "../dati/utenti.js";
import { mostraAttesa } from "../utils.js";

const messaggio = document.getElementById("messaggio");
const btnControlla = document.getElementById("btn-controlla");

let utenteCorrente = null;

// Se l'utente è già approvato (o non ha ancora verificato l'email) non è
// questa la pagina giusta per lui.
async function verificaStato() {
  if (!utenteCorrente.emailVerified) {
    window.location.href = "verifica-email.html";
    return true;
  }
  const profilo = await ottieniProfiloUtente(utenteCorrente.uid);
  if (profiloApprovato(profilo)) {
    window.location.href = "dashboard.html";
    return true;
  }
  return false;
}

proteggiPaginaSenzaVerifica(async (user) => {
  utenteCorrente = user;
  document.getElementById("email-utente").textContent = user.email;
  try {
    await verificaStato();
  } catch (errore) {
    console.error(errore);
  }
});

btnControlla.addEventListener("click", async () => {
  if (!utenteCorrente) return;
  btnControlla.disabled = true;
  mostraAttesa(btnControlla, "Controllo…");
  try {
    if (!(await verificaStato())) {
      messaggio.textContent = "Non ancora approvato: riprova più tardi.";
      messaggio.className = "message visible error";
    }
  } catch (errore) {
    console.error(errore);
    messaggio.textContent = "Impossibile controllare lo stato. Riprova.";
    messaggio.className = "message visible error";
  } finally {
    btnControlla.disabled = false;
    btnControlla.textContent = "Controlla di nuovo";
  }
});

document.getElementById("link-esci").addEventListener("click", async (evento) => {
  evento.preventDefault();
  await esciUtente();
  window.location.href = "index.html";
});
