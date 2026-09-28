// Script della pagina register.html (spostato fuori dall'HTML per la Content Security Policy:
// la policy consente solo script serviti dal sito stesso, niente script inline).
import { registraUtente, traduciErrore } from "../auth.js";
import { mostraAttesa } from "../utils.js";

const form = document.getElementById("form-registrazione");
const messaggio = document.getElementById("messaggio");
const bottone = document.getElementById("btn-registrazione");

function mostraMessaggio(testo, tipo) {
  messaggio.textContent = testo;
  messaggio.className = `message visible ${tipo}`;
}

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  messaggio.className = "message";

  const nome = document.getElementById("nome").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confermaPassword = document.getElementById("conferma-password").value;

  if (password !== confermaPassword) {
    mostraMessaggio("Le due password non coincidono.", "error");
    return;
  }

  bottone.disabled = true;
  mostraAttesa(bottone, "Creazione in corso…");

  try {
    const { uid } = await registraUtente({ nome, email, password });
    // registraUtente ha già inviato l'email di verifica: evita che
    // verifica-email.html ne invii subito una seconda al primo caricamento.
    sessionStorage.setItem(`verificaInviata:${uid}`, "1");
    window.location.href = "verifica-email.html";
  } catch (errore) {
    mostraMessaggio(traduciErrore(errore.code), "error");
    bottone.disabled = false;
    bottone.textContent = "Crea account";
  }
});
