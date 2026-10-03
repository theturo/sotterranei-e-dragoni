// Supporto YouTube condiviso da Controllo musica (DM) e dal widget dei giocatori.

// Carica una sola volta la IFrame API di YouTube e risolve quando "YT" è pronto.
// Più moduli possono chiamarla: la callback globale di YouTube è una sola.
let apiPronta = null;
export function caricaApiYouTube() {
  if (!apiPronta) {
    apiPronta = new Promise((risolvi) => {
      if (window.YT?.Player) return risolvi(window.YT);
      const precedente = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof precedente === "function") precedente();
        risolvi(window.YT);
      };
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    });
  }
  return apiPronta;
}

const ID_VALIDO = /^[A-Za-z0-9_-]+$/;
const ID_VIDEO = /^[A-Za-z0-9_-]{11}$/;

// Capisce cosa è stato incollato: link a una playlist, a un singolo video
// (watch, youtu.be, shorts, embed, music.youtube.com) o direttamente un ID.
// Restituisce { tipo: "playlist" | "video", id } oppure null se non valido.
export function interpretaLinkYouTube(testo) {
  const valore = (testo || "").trim();
  if (!valore) return null;

  let url = null;
  try {
    url = new URL(valore);
  } catch {
    // Non è un URL: un ID "nudo" di video (11 caratteri) o di playlist.
    if (ID_VIDEO.test(valore)) return { tipo: "video", id: valore };
    if (ID_VALIDO.test(valore) && valore.length > 11) return { tipo: "playlist", id: valore };
    return null;
  }

  const host = url.hostname.replace(/^www\.|^m\.|^music\./, "");
  if (host !== "youtube.com" && host !== "youtu.be" && host !== "youtube-nocookie.com") return null;

  const lista = url.searchParams.get("list");
  if (lista && ID_VALIDO.test(lista)) return { tipo: "playlist", id: lista };

  let video = url.searchParams.get("v");
  if (!video && host === "youtu.be") video = url.pathname.slice(1);
  if (!video) video = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1] ?? null;
  return video && ID_VIDEO.test(video) ? { tipo: "video", id: video } : null;
}

// Stato YouTube salvato su Firestore → { tipo, id }. Accetta anche il formato
// precedente ({ playlistId }), per le campagne che l'hanno già salvato.
export function sorgenteDaStato(yt) {
  if (!yt) return null;
  if (yt.tipo && yt.id) return { tipo: yt.tipo, id: yt.id };
  if (yt.playlistId) return { tipo: "playlist", id: yt.playlistId };
  return null;
}

// Messaggi leggibili per gli errori del player (codici della IFrame API).
export function messaggioErroreYouTube(codice) {
  if (codice === 101 || codice === 150 || codice === 153) {
    return "Il proprietario di questo video non ne consente la riproduzione su altri siti: prova con un altro video o una playlist diversa.";
  }
  if (codice === 100) return "Video non trovato (rimosso o privato).";
  if (codice === 2) return "Link o ID non valido.";
  return "Impossibile riprodurre questo contenuto.";
}

// ---------- Elenco dei link salvati dal DM ----------
// Voci { tipo, id, nome } (al massimo 50). Lo stesso contenuto compare una
// volta sola: si riconosce da tipo e id.
export const MASSIMO_LINK_SALVATI = 50;
export const stessoLink = (a, b) => Boolean(a && b) && a.tipo === b.tipo && a.id === b.id;

export function aggiungiLinkSalvato(lista, sorgente, nome) {
  const pulito = (nome || "").trim().slice(0, 80) || (sorgente.tipo === "playlist" ? "Playlist" : "Video");
  const senza = lista.filter((x) => !stessoLink(x, sorgente));
  return [...senza, { tipo: sorgente.tipo, id: sorgente.id, nome: pulito }].slice(-MASSIMO_LINK_SALVATI);
}

export function rinominaLinkSalvato(lista, sorgente, nome) {
  const pulito = (nome || "").trim().slice(0, 80);
  return pulito ? lista.map((x) => (stessoLink(x, sorgente) ? { ...x, nome: pulito } : x)) : lista;
}

export const togliLinkSalvato = (lista, sorgente) => lista.filter((x) => !stessoLink(x, sorgente));

// Dati letti da Firestore → elenco pulito (scarta voci malformate).
export function linkSalvatiDa(dati) {
  return (Array.isArray(dati?.youtube) ? dati.youtube : [])
    .filter((x) => x && (x.tipo === "video" || x.tipo === "playlist") && typeof x.id === "string" && typeof x.nome === "string")
    .slice(-MASSIMO_LINK_SALVATI);
}
