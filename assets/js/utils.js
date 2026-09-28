// Funzioni di utilità condivise dalle pagine.

// Neutralizza un valore prima di inserirlo in HTML (innerHTML o template):
// qualsiasi testo che arrivi dal database o da servizi esterni (nomi, appunti,
// titoli, brani...) va SEMPRE passato di qui, altrimenti chi lo scrive
// potrebbe far eseguire codice nel browser di chi lo legge (XSS). Sicuro sia
// nel contenuto sia dentro gli attributi tra virgolette.
const SOSTITUZIONI = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function esc(valore) {
  if (valore === null || valore === undefined) return "";
  return String(valore).replace(/[&<>"']/g, (carattere) => SOSTITUZIONI[carattere]);
}

// Per gli URL da usare in src/href: accetta solo http(s), altrimenti stringa
// vuota (evita "javascript:" e simili), poi applica l'escape.
export function escUrl(valore) {
  try {
    const url = new URL(String(valore), window.location.href);
    return url.protocol === "https:" || url.protocol === "http:" ? esc(url.href) : "";
  } catch {
    return "";
  }
}

// Spinner a forma di dado nei pulsanti in attesa (tela di design, "Elementi
// decorativi di base"). Si toglie da solo quando il testo del pulsante viene
// ripristinato con textContent.
const SPINNER_DADO =
  '<svg class="spinner-dado" viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M50 4 L90 27 L90 73 L50 96 L10 73 L10 27 Z" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/></svg>';

export function mostraAttesa(bottone, testo) {
  bottone.innerHTML = `${SPINNER_DADO}${esc(testo)}`;
}

// Righe segnaposto animate per i caricamenti piccoli ("Caricamento leggero").
export function creaScheletro(righe = 3) {
  const griglia = document.createElement("div");
  griglia.className = "griglia-risultati-scheletro";
  griglia.setAttribute("aria-label", "Caricamento in corso");
  griglia.setAttribute("role", "status");
  griglia.innerHTML = Array.from({ length: righe }, () => `
    <div class="riga-scheletro">
      <div class="scheletro-icona"></div>
      <div class="scheletro-linee"><div class="scheletro-linea"></div><div class="scheletro-linea corta"></div></div>
    </div>`).join("");
  return griglia;
}
