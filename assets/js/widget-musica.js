// Widget "Musica di sessione", condiviso da dashboard e pagina Sessione.
// - Spotify: sola lettura (l'audio suona sul dispositivo del DM; qui si vede
//   cosa sta suonando).
// - YouTube: ogni browser ha la propria istanza del player, sincronizzata su
//   contenuto, brano e play/pausa decisi dal DM; volume e muto restano locali.
//   Il player parte muto (i browser bloccano l'audio automatico): il giocatore
//   lo attiva con il pulsante.
import { ascoltaStatoMusica } from "./dati/musica.js";
import { esc, escUrl } from "./utils.js";
import { ICONA_NOTA, ICONA_COPERTINA, ICONA_RIPRODUCI, icona } from "./icone.js";
import { caricaApiYouTube, sorgenteDaStato, messaggioErroreYouTube } from "./youtube.js";

// Monta il widget nel contenitore indicato e resta in ascolto dello stato
// della musica della campagna. Restituisce la funzione per smettere di ascoltare.
export function montaWidgetMusica(contenitore, campagnaId) {
  let player = null;
  let playerPronto = false;
  let statoInAttesa = null;
  let ultimoApplicato = null;
  let modalita = null;
  let audioAttivo = false;

  // Il player deve misurare almeno 200×200 perché YouTube accetti di
  // riprodurre: lo teniamo fuori dallo schermo invece di rimpicciolirlo.
  const ospite = document.createElement("div");
  ospite.style.cssText = "position:fixed; left:-10000px; top:0; width:200px; height:200px;";
  const nodoPlayer = document.createElement("div");
  ospite.appendChild(nodoPlayer);
  document.body.appendChild(ospite);

  async function creaPlayer() {
    if (player) return;
    player = "in-creazione";
    const YT = await caricaApiYouTube();
    player = new YT.Player(nodoPlayer, {
      width: "200",
      height: "200",
      playerVars: { playsinline: 1 },
      events: {
        onReady: () => {
          playerPronto = true;
          player.mute();
          if (statoInAttesa) applicaYouTube(statoInAttesa);
        },
        onStateChange: aggiornaTitoloECopertina,
        onError: (evento) => {
          const titolo = contenitore.querySelector("[data-yt-titolo]");
          if (titolo) titolo.textContent = messaggioErroreYouTube(evento.data);
        },
      },
    });
  }

  function applicaYouTube(yt) {
    if (!playerPronto) {
      statoInAttesa = yt;
      return;
    }
    const sorgente = sorgenteDaStato(yt);
    if (!sorgente) return;
    const indice = yt.indice || 0;
    const cambiato =
      !ultimoApplicato || ultimoApplicato.tipo !== sorgente.tipo || ultimoApplicato.id !== sorgente.id ||
      ultimoApplicato.indice !== indice;
    if (cambiato) {
      if (sorgente.tipo === "playlist") player.loadPlaylist({ list: sorgente.id, index: indice });
      else player.loadVideoById(sorgente.id);
      if (!yt.inRiproduzione) setTimeout(() => player.pauseVideo(), 800);
    } else if (ultimoApplicato.inRiproduzione !== Boolean(yt.inRiproduzione)) {
      yt.inRiproduzione ? player.playVideo() : player.pauseVideo();
    }
    ultimoApplicato = { ...sorgente, indice, inRiproduzione: Boolean(yt.inRiproduzione) };
  }

  function aggiornaTitoloECopertina() {
    if (!playerPronto || typeof player.getVideoData !== "function") return;
    const dati = player.getVideoData();
    const immagine = contenitore.querySelector("[data-yt-copertina]");
    const segnaposto = contenitore.querySelector("[data-yt-segnaposto]");
    const titolo = contenitore.querySelector("[data-yt-titolo]");
    if (!immagine || !titolo) return;
    if (dati?.video_id) {
      immagine.src = `https://img.youtube.com/vi/${encodeURIComponent(dati.video_id)}/hqdefault.jpg`;
      immagine.hidden = false;
      if (segnaposto) segnaposto.hidden = true;
    }
    if (dati?.title) titolo.textContent = dati.title;
  }

  function fermaYouTube() {
    if (playerPronto) player.stopVideo();
    ultimoApplicato = null;
  }

  function mostraSegnaposto(testo) {
    contenitore.innerHTML = `<p class="sessione-placeholder">${esc(testo)}</p>`;
  }

  function render(stato) {
    if (stato.sorgente !== "youtube" && modalita === "youtube") fermaYouTube();

    if (!stato.sorgente) {
      modalita = null;
      contenitore.innerHTML = `<div class="stato-vuoto-riga">${ICONA_NOTA}<p class="sessione-placeholder">Nessuna musica in riproduzione.</p></div>`;
      return;
    }

    if (stato.sorgente === "spotify") {
      modalita = "spotify";
      const s = stato.spotify;
      if (!s) {
        mostraSegnaposto("In attesa che il Dungeon Master avvii la riproduzione…");
        return;
      }
      contenitore.innerHTML = `
        ${
          s.copertinaUrl
            ? `<img src="${escUrl(s.copertinaUrl)}" class="cover-grande" alt="" />`
            : `<div class="cover-grande cover-quadrata">${ICONA_COPERTINA}</div>`
        }
        <div class="musica-titolo-brano">${esc(s.brano)}</div>
        <div class="musica-sottotitolo">${esc(s.artista)}</div>
        <p class="sessione-placeholder" style="margin-top:10px;">
          ${s.inRiproduzione === false ? "In pausa · " : ""}Musica dal dispositivo del Dungeon Master.
        </p>
      `;
      return;
    }

    if (stato.sorgente === "youtube") {
      if (!sorgenteDaStato(stato.youtube)) {
        modalita = null;
        mostraSegnaposto("In attesa che il Dungeon Master scelga cosa riprodurre su YouTube…");
        return;
      }
      // I controlli vengono creati una sola volta: rigenerarli a ogni cambio
      // brano azzererebbe il volume appena regolato dal giocatore.
      if (modalita !== "youtube") {
        modalita = "youtube";
        contenitore.innerHTML = `
          <img data-yt-copertina class="cover-grande" hidden alt="" />
          <div data-yt-segnaposto class="cover-grande cover-quadrata">${ICONA_RIPRODUCI}</div>
          <div data-yt-titolo class="musica-titolo-brano">Caricamento…</div>
          <div class="volume-riga" style="justify-content:center;">
            <button type="button" data-yt-muto aria-label="Attiva l'audio" title="Attiva l'audio">${icona("audio-muto")}</button>
            <input type="range" data-yt-volume min="0" max="100" value="70" style="max-width:140px;" aria-label="Volume" />
          </div>
          <p class="sessione-placeholder" style="margin-top:6px;">L'audio parte disattivato: premi ${icona("audio-muto", "icona-testo")} per ascoltare.</p>
        `;
        contenitore.querySelector("[data-yt-volume]").addEventListener("input", (evento) => {
          if (playerPronto) player.setVolume(Number(evento.target.value));
        });
        contenitore.querySelector("[data-yt-muto]").addEventListener("click", (evento) => {
          audioAttivo = !audioAttivo;
          if (playerPronto) audioAttivo ? player.unMute() : player.mute();
          evento.currentTarget.innerHTML = icona(audioAttivo ? "audio-acceso" : "audio-muto");
          evento.currentTarget.setAttribute("aria-label", audioAttivo ? "Disattiva l'audio" : "Attiva l'audio");
        });
      }
      creaPlayer();
      applicaYouTube(stato.youtube);
      aggiornaTitoloECopertina();
    }
  }

  return ascoltaStatoMusica(campagnaId, render, (errore) => {
    console.error(errore);
    mostraSegnaposto("Impossibile leggere lo stato della musica.");
  });
}
