// Script della pagina index.html (spostato fuori dall'HTML per la Content Security Policy:
// la policy consente solo script serviti dal sito stesso, niente script inline).
import { accediUtente, inviaResetPassword, traduciErrore } from "../auth.js";

const form = document.getElementById("form-login");
const messaggio = document.getElementById("messaggio");
const bottone = document.getElementById("btn-login");

function mostraMessaggio(testo, tipo) {
  messaggio.textContent = testo;
  messaggio.className = `message visible ${tipo}`;
}

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  messaggio.className = "message";
  bottone.disabled = true;
  bottone.textContent = "Accesso in corso…";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await accediUtente({ email, password });
    window.location.href = "dashboard.html";
  } catch (errore) {
    mostraMessaggio(traduciErrore(errore.code), "error");
    bottone.disabled = false;
    bottone.textContent = "Accedi";
  }
});

const linkPasswordDimenticata = document.getElementById("link-password-dimenticata");
const linkTornaLoginWrap = document.getElementById("link-torna-login");
const linkTornaLogin = document.getElementById("link-torna-login-azione");
const formReset = document.getElementById("form-reset");
const bottoneReset = document.getElementById("btn-reset");

function mostraSchermataReset(mostra) {
  messaggio.className = "message";
  form.hidden = mostra;
  linkPasswordDimenticata.parentElement.hidden = mostra;
  formReset.hidden = !mostra;
  linkTornaLoginWrap.hidden = !mostra;
}

linkPasswordDimenticata.addEventListener("click", (evento) => {
  evento.preventDefault();
  mostraSchermataReset(true);
});

linkTornaLogin.addEventListener("click", (evento) => {
  evento.preventDefault();
  mostraSchermataReset(false);
});

formReset.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  messaggio.className = "message";
  bottoneReset.disabled = true;
  bottoneReset.textContent = "Invio in corso…";

  const email = document.getElementById("email-reset").value.trim();

  try {
    await inviaResetPassword(email);
    mostraMessaggio("Se l'indirizzo è registrato, riceverai a breve un'email con le istruzioni per reimpostare la password.", "success");
    formReset.reset();
  } catch (errore) {
    // Messaggio neutro anche in caso di errore "account non trovato", per non
    // rivelare quali indirizzi sono registrati sul sito.
    if (errore.code === "auth/user-not-found") {
      mostraMessaggio("Se l'indirizzo è registrato, riceverai a breve un'email con le istruzioni per reimpostare la password.", "success");
      formReset.reset();
    } else {
      mostraMessaggio(traduciErrore(errore.code), "error");
    }
  } finally {
    bottoneReset.disabled = false;
    bottoneReset.textContent = "Invia link";
  }
});
