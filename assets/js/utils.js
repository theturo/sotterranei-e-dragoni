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
