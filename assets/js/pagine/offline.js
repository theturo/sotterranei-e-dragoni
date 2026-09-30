// Pagina mostrata dal service worker quando manca la connessione: il service
// worker la serve al posto della pagina richiesta, quindi ricaricare riapre
// proprio quella pagina.
const riprova = () => window.location.reload();
document.getElementById("btn-riprova").addEventListener("click", riprova);
window.addEventListener("online", riprova);
