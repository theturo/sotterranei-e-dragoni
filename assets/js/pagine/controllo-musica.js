// Script della pagina controllo-musica.html (spostato fuori dall'HTML per la Content Security Policy:
// la policy consente solo script serviti dal sito stesso, niente script inline).
import { proteggiPaginaDM, ottieniStatoMusica, salvaStatoMusica, ottieniCampagnaCorrente } from "../auth.js";
import { montaMenuUtente } from "../menu-utente.js";
import { esc, escUrl } from "../utils.js";
import * as Spotify from "../spotify.js";

const veil = document.getElementById("veil");
const contenuto = document.getElementById("contenuto");
const toast = document.getElementById("toast");

let toastTimer = null;
function mostraToast(testo, errore = false) {
  toast.textContent = testo;
  toast.className = `toast visibile${errore ? " toast-errore" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.className = "toast"), 3200);
}

let sorgenteCorrente = null;
let campagnaIdCorrente = null;

function aggiornaPulsantiSorgente() {
  document.querySelectorAll("[data-sorgente-btn]").forEach((bottone) => {
    bottone.classList.toggle("attivo", bottone.dataset.sorgenteBtn === sorgenteCorrente);
  });
}

document.querySelectorAll("[data-sorgente-btn]").forEach((bottone) => {
  bottone.addEventListener("click", async () => {
    sorgenteCorrente = bottone.dataset.sorgenteBtn;
    aggiornaPulsantiSorgente();
    try {
      await salvaStatoMusica(campagnaIdCorrente, { sorgente: sorgenteCorrente });
    } catch (errore) {
      console.error(errore);
      mostraToast("Impossibile aggiornare la sorgente trasmessa.", true);
    }
  });
});

// ---------- Spotify ----------

function renderSpotifyNowPlaying(stato) {
  const box = document.getElementById("spotify-now-playing");
  if (!stato) {
    box.innerHTML = '<p class="sessione-placeholder">Nessuna riproduzione rilevata.</p>';
    return;
  }
  box.dataset.inRiproduzione = String(stato.inRiproduzione);
  box.innerHTML = `
    <div style="display:flex; gap:16px; align-items:center;">
      ${
        stato.copertinaUrl
          ? `<img src="${escUrl(stato.copertinaUrl)}" class="cover-quadrata-img" alt="" />`
          : '<div class="cover-quadrata">🎵</div>'
      }
      <div style="flex:1; min-width:0;">
        <div class="musica-titolo-brano">${esc(stato.brano)}</div>
        <div class="musica-sottotitolo">${esc(stato.artista)}</div>
        <div class="trasporto" style="margin-top:10px;">
          <button type="button" data-azione="precedente">⏮</button>
          <button type="button" data-azione="play-pausa">${stato.inRiproduzione ? "⏸" : "▶"}</button>
          <button type="button" data-azione="successivo">⏭</button>
        </div>
      </div>
    </div>
  `;
}

async function aggiornaSchermataSpotify() {
  const collegato = Spotify.spotifyCollegato();
  document.getElementById("spotify-non-collegato").hidden = collegato;
  document.getElementById("spotify-collegato").hidden = !collegato;
  if (!collegato) return;

  try {
    const stato = await Spotify.otteniRiproduzioneCorrente();
    renderSpotifyNowPlaying(stato);
    if (sorgenteCorrente === "spotify" && stato) {
      await salvaStatoMusica(campagnaIdCorrente, { spotify: stato });
    }
  } catch (errore) {
    console.error(errore);
  }
}

document.getElementById("btn-connetti-spotify").addEventListener("click", () => {
  Spotify.avviaLogin().catch((errore) => {
    console.error(errore);
    mostraToast("Impossibile avviare il login Spotify.", true);
  });
});

document.getElementById("btn-disconnetti-spotify").addEventListener("click", (evento) => {
  evento.preventDefault();
  Spotify.scollegaSpotify();
  aggiornaSchermataSpotify();
});

document.getElementById("spotify-now-playing").addEventListener("click", async (evento) => {
  const bottone = evento.target.closest("[data-azione]");
  if (!bottone) return;
  const box = document.getElementById("spotify-now-playing");
  const inRiproduzione = box.dataset.inRiproduzione === "true";
  try {
    if (bottone.dataset.azione === "precedente") await Spotify.spotifyPrecedente();
    if (bottone.dataset.azione === "successivo") await Spotify.spotifySuccessivo();
    if (bottone.dataset.azione === "play-pausa") {
      await (inRiproduzione ? Spotify.spotifyPausa() : Spotify.spotifyPlay());
    }
    setTimeout(aggiornaSchermataSpotify, 400);
  } catch (errore) {
    console.error(errore);
    mostraToast(
      errore instanceof Spotify.ErroreSpotifyPremium
        ? "Serve Spotify Premium per controllare la riproduzione."
        : "Comando Spotify non riuscito.",
      true
    );
  }
});

// ---------- YouTube ----------

let playerYouTube = null;
let playlistIdCorrente = null;

window.onYouTubeIframeAPIReady = () => {
  playerYouTube = new YT.Player("yt-player", {
    height: "90",
    width: "160",
    events: { onStateChange: alCambioStatoYouTube },
  });
};

const tagYouTube = document.createElement("script");
tagYouTube.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(tagYouTube);

function renderYouTubeNowPlaying() {
  if (!playerYouTube || typeof playerYouTube.getVideoData !== "function") return;
  const dati = playerYouTube.getVideoData();
  if (!dati?.video_id) return;
  const indice = playerYouTube.getPlaylistIndex ? playerYouTube.getPlaylistIndex() : 0;
  const lista = playerYouTube.getPlaylist ? playerYouTube.getPlaylist() || [] : [];
  const inRiproduzione = playerYouTube.getPlayerState() === YT.PlayerState.PLAYING;

  document.getElementById("yt-now-playing").innerHTML = `
    <div style="display:flex; gap:16px; align-items:center;">
      <img src="https://img.youtube.com/vi/${esc(encodeURIComponent(dati.video_id))}/hqdefault.jpg" class="cover-quadrata-img" alt="" />
      <div style="flex:1; min-width:0;">
        <div class="musica-titolo-brano">${esc(dati.title) || "—"}</div>
        <div class="musica-sottotitolo">${lista.length ? `Brano ${indice + 1} di ${lista.length}` : ""}</div>
        <div class="trasporto" style="margin-top:10px;">
          <button type="button" data-azione="precedente">⏮</button>
          <button type="button" data-azione="play-pausa">${inRiproduzione ? "⏸" : "▶"}</button>
          <button type="button" data-azione="successivo">⏭</button>
        </div>
      </div>
    </div>
  `;
}

function alCambioStatoYouTube(evento) {
  renderYouTubeNowPlaying();
  if (sorgenteCorrente !== "youtube" || !playlistIdCorrente) return;
  salvaStatoMusica(campagnaIdCorrente, {
    youtube: {
      playlistId: playlistIdCorrente,
      indice: playerYouTube.getPlaylistIndex ? playerYouTube.getPlaylistIndex() : 0,
      inRiproduzione: evento.data === YT.PlayerState.PLAYING,
    },
  }).catch((errore) => console.error(errore));
}

function estraiPlaylistId(testo) {
  const valore = testo.trim();
  try {
    const url = new URL(valore);
    return url.searchParams.get("list") || valore;
  } catch {
    return valore;
  }
}

document.getElementById("form-youtube").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const campo = document.getElementById("campo-youtube-link");
  const playlistId = estraiPlaylistId(campo.value);
  if (!playlistId || !playerYouTube) return;
  playlistIdCorrente = playlistId;
  playerYouTube.loadPlaylist({ list: playlistId });
});

document.getElementById("yt-now-playing").addEventListener("click", (evento) => {
  const bottone = evento.target.closest("[data-azione]");
  if (!bottone || !playerYouTube) return;
  if (bottone.dataset.azione === "precedente") playerYouTube.previousVideo();
  if (bottone.dataset.azione === "successivo") playerYouTube.nextVideo();
  if (bottone.dataset.azione === "play-pausa") {
    playerYouTube.getPlayerState() === YT.PlayerState.PLAYING
      ? playerYouTube.pauseVideo()
      : playerYouTube.playVideo();
  }
});

// ---------- Avvio pagina ----------

proteggiPaginaDM(async (user, profilo) => {
  montaMenuUtente({ contenitore: document.getElementById("slot-utente"), user, profilo });

  const campagna = await ottieniCampagnaCorrente(user.uid, profilo?.ruolo);
  if (!campagna) {
    document.getElementById("nessuna-campagna").hidden = false;
    document.getElementById("pannello-musica").hidden = true;
    veil.style.display = "none";
    contenuto.style.display = "block";
    return;
  }
  campagnaIdCorrente = campagna.id;

  try {
    const loginAppenaFatto = await Spotify.gestisciCallback();
    if (loginAppenaFatto) mostraToast("Spotify collegato.");
  } catch (errore) {
    console.error(errore);
    mostraToast("Impossibile completare il collegamento a Spotify.", true);
  }

  let stato;
  try {
    stato = await ottieniStatoMusica(campagnaIdCorrente);
  } catch (errore) {
    console.error(errore);
    stato = { sorgente: null };
  }
  sorgenteCorrente = stato.sorgente || null;
  aggiornaPulsantiSorgente();

  await aggiornaSchermataSpotify();
  setInterval(aggiornaSchermataSpotify, 10000);

  veil.style.display = "none";
  contenuto.style.display = "block";
});
