// Script della pagina verifica-email.html (spostato fuori dall'HTML per la Content Security Policy:
// la policy consente solo script serviti dal sito stesso, niente script inline).
import { proteggiPaginaSenzaVerifica, ricaricaUtente, inviaEmailVerifica, esciUtente } from "../auth.js";
import { mostraAttesa } from "../utils.js";

const messaggio = document.getElementById("messaggio");
const btnControlla = document.getElementById("btn-controlla");
const btnReinvia = document.getElementById("btn-reinvia");

function mostraMessaggio(testo, tipo) {
  messaggio.textContent = testo;
  messaggio.className = `message visible ${tipo}`;
}

let utenteCorrente = null;

proteggiPaginaSenzaVerifica(async (user) => {
  if (user.emailVerified) {
    window.location.href = "dashboard.html";
    return;
  }
  utenteCorrente = user;
  document.getElementById("email-utente").textContent = user.email;

  // Invia davvero l'email a chi arriva qui senza che una registrazione l'abbia
  // appena inviata (es. un account già esistente che fa login senza aver mai
  // verificato). La chiave in sessionStorage evita reinvii ad ogni refresh:
  // Firebase comunque rifiuta con "too-many-requests" gli invii troppo ravvicinati.
  const chiaveSessione = `verificaInviata:${user.uid}`;
  if (!sessionStorage.getItem(chiaveSessione)) {
    try {
      await inviaEmailVerifica(user);
      sessionStorage.setItem(chiaveSessione, "1");
    } catch (errore) {
      if (errore.code === "auth/too-many-requests") {
        sessionStorage.setItem(chiaveSessione, "1");
      } else {
        console.error(errore);
        mostraMessaggio(
          "Non siamo riusciti a inviare l'email automaticamente: prova col pulsante \"Invia di nuovo l'email\" qui sotto.",
          "error"
        );
      }
    }
  }
});

btnControlla.addEventListener("click", async () => {
  if (!utenteCorrente) return;
  btnControlla.disabled = true;
  mostraAttesa(btnControlla, "Controllo…");
  try {
    await ricaricaUtente(utenteCorrente);
    if (utenteCorrente.emailVerified) {
      window.location.href = "dashboard.html";
      return;
    }
    mostraMessaggio("Non risulta ancora verificata. Controlla la posta e riprova.", "error");
  } catch (errore) {
    mostraMessaggio("Impossibile controllare lo stato. Riprova.", "error");
    console.error(errore);
  } finally {
    btnControlla.disabled = false;
    btnControlla.textContent = "Ho verificato, controlla di nuovo";
  }
});

btnReinvia.addEventListener("click", async () => {
  if (!utenteCorrente) return;
  btnReinvia.disabled = true;
  mostraAttesa(btnReinvia, "Invio…");
  try {
    await inviaEmailVerifica(utenteCorrente);
    mostraMessaggio("Email inviata di nuovo. Controlla la posta (anche lo spam).", "success");
  } catch (errore) {
    mostraMessaggio("Impossibile inviare l'email. Riprova tra qualche minuto.", "error");
    console.error(errore);
  } finally {
    btnReinvia.disabled = false;
    btnReinvia.textContent = "Invia di nuovo l'email";
  }
});

document.getElementById("link-esci").addEventListener("click", async (evento) => {
  evento.preventDefault();
  await esciUtente();
  window.location.href = "index.html";
});
