// Script della pagina controllo-musica.html (spostato fuori dall'HTML per la Content Security Policy:
// la policy consente solo script serviti dal sito stesso, niente script inline).
import { proteggiPaginaDM, ottieniStatoMusica, salvaStatoMusica, ottieniCampagnaCorrente, ottieniLinkMusica, salvaLinkMusica } from "../auth.js";
import { montaMenuUtente } from "../menu-utente.js";
import { esc, escUrl } from "../utils.js";
import { ICONA_COPERTINA, ICONA_PRECEDENTE, ICONA_PAUSA, ICONA_RIPRODUCI, ICONA_SUCCESSIVO } from "../icone.js";
import * as Spotify from "../spotify.js";
import {
  caricaApiYouTube, interpretaLinkYouTube, sorgenteDaStato, messaggioErroreYouTube,
  stessoLink, aggiungiLinkSalvato, rinominaLinkSalvato, togliLinkSalvato, linkSalvatiDa,
} from "../youtube.js";

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
    bottone.classList.toggle("attivo", (bottone.dataset.sorgenteBtn || null) === sorgenteCorrente);
  });
  const testi = {
    spotify: "I giocatori vedono il brano di Spotify in riproduzione sul tuo dispositivo (tieni aperta questa pagina: si aggiorna ogni 10 secondi).",
    youtube: "I giocatori ascoltano il contenuto YouTube caricato qui, sincronizzato con play/pausa e cambi brano.",
  };
  document.getElementById("sorgente-stato").textContent =
    testi[sorgenteCorrente] || "Nessuna sorgente trasmessa: i giocatori non vedono né sentono nulla.";
}

async function impostaSorgente(sorgente) {
  sorgenteCorrente = sorgente || null;
  aggiornaPulsantiSorgente();
  try {
    await salvaStatoMusica(campagnaIdCorrente, { sorgente: sorgenteCorrente });
    // Pubblica subito lo stato aggiornato della sorgente scelta, senza
    // aspettare il prossimo aggiornamento periodico.
    if (sorgenteCorrente === "spotify") await aggiornaSchermataSpotify();
    if (sorgenteCorrente === "youtube") pubblicaStatoYouTube();
  } catch (errore) {
    console.error(errore);
    mostraToast("Impossibile aggiornare la sorgente trasmessa.", true);
  }
}

document.querySelectorAll("[data-sorgente-btn]").forEach((bottone) => {
  bottone.addEventListener("click", () => impostaSorgente(bottone.dataset.sorgenteBtn));
});

// ---------- Spotify ----------

let ultimaFirmaSpotify = null;

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
          : `<div class="cover-quadrata">${ICONA_COPERTINA}</div>`
      }
      <div style="flex:1; min-width:0;">
        <div class="musica-titolo-brano">${esc(stato.brano)}</div>
        <div class="musica-sottotitolo">${esc(stato.artista)}</div>
        <div class="trasporto" style="margin-top:10px;">
          <button type="button" data-azione="precedente" aria-label="Brano precedente" title="Brano precedente">${ICONA_PRECEDENTE}</button>
          <button type="button" data-azione="play-pausa" aria-label="${stato.inRiproduzione ? "Pausa" : "Riproduci"}" title="${stato.inRiproduzione ? "Pausa" : "Riproduci"}">${stato.inRiproduzione ? ICONA_PAUSA : ICONA_RIPRODUCI}</button>
          <button type="button" data-azione="successivo" aria-label="Brano successivo" title="Brano successivo">${ICONA_SUCCESSIVO}</button>
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
    // Lo stato di Spotify viene pubblicato sempre (non solo quando è la
    // sorgente scelta), così passando a Spotify i giocatori lo vedono subito;
    // si scrive solo quando cambia, per non consumare scritture inutili.
    const firma = JSON.stringify(stato);
    if (firma !== ultimaFirmaSpotify) {
      await salvaStatoMusica(campagnaIdCorrente, { spotify: stato });
      ultimaFirmaSpotify = firma;
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
let playerYouTubePronto = false;
let youtubeCorrente = null; // { tipo: "playlist" | "video", id }
let youtubeDaRipristinare = null;

function mostraMessaggioYouTube(testo) {
  const messaggio = document.getElementById("yt-messaggio");
  messaggio.textContent = testo || "";
  messaggio.hidden = !testo;
}

caricaApiYouTube().then((YT) => {
  playerYouTube = new YT.Player("yt-player", {
    width: "356",
    height: "200",
    playerVars: { playsinline: 1 },
    events: {
      onReady: () => {
        playerYouTubePronto = true;
        // Ripristina (senza avviarlo) il contenuto trasmesso l'ultima volta.
        if (youtubeDaRipristinare) carica(youtubeDaRipristinare, { avvia: false });
      },
      onStateChange: () => {
        renderYouTubeNowPlaying();
        pubblicaStatoYouTube();
      },
      onError: (evento) => mostraMessaggioYouTube(messaggioErroreYouTube(evento.data)),
    },
  });
});

function carica(sorgente, { avvia }) {
  youtubeCorrente = sorgente;
  mostraMessaggioYouTube("");
  chiudiSalva();
  renderElencoLink();
  if (sorgente.tipo === "playlist") {
    avvia ? playerYouTube.loadPlaylist({ list: sorgente.id }) : playerYouTube.cuePlaylist({ list: sorgente.id });
  } else {
    avvia ? playerYouTube.loadVideoById(sorgente.id) : playerYouTube.cueVideoById(sorgente.id);
  }
}

function renderYouTubeNowPlaying() {
  if (!playerYouTubePronto || typeof playerYouTube.getVideoData !== "function") return;
  const dati = playerYouTube.getVideoData();
  if (!dati?.video_id) return;
  const indice = playerYouTube.getPlaylistIndex?.() ?? 0;
  const lista = playerYouTube.getPlaylist?.() || [];
  const inRiproduzione = playerYouTube.getPlayerState() === YT.PlayerState.PLAYING;

  document.getElementById("yt-now-playing").innerHTML = `
    <div style="display:flex; gap:16px; align-items:center;">
      <img src="https://img.youtube.com/vi/${esc(encodeURIComponent(dati.video_id))}/hqdefault.jpg" class="cover-quadrata-img" alt="" />
      <div style="flex:1; min-width:0;">
        <div class="musica-titolo-brano">${esc(dati.title) || "—"}</div>
        <div class="musica-sottotitolo">${lista.length ? `Brano ${indice + 1} di ${lista.length}` : ""}</div>
        <div class="trasporto" style="margin-top:10px;">
          <button type="button" data-azione="precedente" aria-label="Brano precedente" title="Brano precedente">${ICONA_PRECEDENTE}</button>
          <button type="button" data-azione="play-pausa" aria-label="${inRiproduzione ? "Pausa" : "Riproduci"}" title="${inRiproduzione ? "Pausa" : "Riproduci"}">${inRiproduzione ? ICONA_PAUSA : ICONA_RIPRODUCI}</button>
          <button type="button" data-azione="successivo" aria-label="Brano successivo" title="Brano successivo">${ICONA_SUCCESSIVO}</button>
        </div>
      </div>
    </div>
  `;
}

// Pubblica sempre lo stato del player (contenuto, brano, play/pausa): i
// giocatori lo applicano solo quando la sorgente trasmessa è YouTube.
function pubblicaStatoYouTube() {
  if (!playerYouTubePronto || !youtubeCorrente) return;
  const stato = playerYouTube.getPlayerState();
  salvaStatoMusica(campagnaIdCorrente, {
    youtube: {
      tipo: youtubeCorrente.tipo,
      id: youtubeCorrente.id,
      indice: playerYouTube.getPlaylistIndex?.() ?? 0,
      inRiproduzione: stato === YT.PlayerState.PLAYING || stato === YT.PlayerState.BUFFERING,
    },
  }).catch((errore) => console.error(errore));
}

document.getElementById("form-youtube").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const sorgente = interpretaLinkYouTube(document.getElementById("campo-youtube-link").value);
  if (!sorgente) {
    mostraMessaggioYouTube("Link non riconosciuto: incolla l'indirizzo di un video o di una playlist di YouTube.");
    return;
  }
  if (!playerYouTubePronto) {
    mostraMessaggioYouTube("Il player di YouTube non è ancora pronto: riprova tra un istante.");
    return;
  }
  carica(sorgente, { avvia: true });
  // Caricare un contenuto YouTube significa volerlo trasmettere.
  if (sorgenteCorrente !== "youtube") impostaSorgente("youtube");
});

document.getElementById("yt-now-playing").addEventListener("click", (evento) => {
  const bottone = evento.target.closest("[data-azione]");
  if (!bottone || !playerYouTubePronto) return;
  if (bottone.dataset.azione === "precedente") playerYouTube.previousVideo();
  if (bottone.dataset.azione === "successivo") playerYouTube.nextVideo();
  if (bottone.dataset.azione === "play-pausa") {
    playerYouTube.getPlayerState() === YT.PlayerState.PLAYING ? playerYouTube.pauseVideo() : playerYouTube.playVideo();
  }
});

// ---------- Elenco dei link salvati ----------
// Solo il DM lo vede (privato/musica). Un tocco sul nome carica il link e lo
// trasmette; ✎ rinomina; × toglie, con "Annulla" per qualche secondo.

let linkSalvati = [];
let tolto = null; // { voce, indice, timer }
let rinominaAperta = null;

const elencoLink = document.getElementById("yt-elenco");
const boxSalva = document.getElementById("yt-salva");
const formSalva = document.getElementById("form-yt-salva");
const campoNome = document.getElementById("campo-yt-nome");

async function salvaElenco(nuova, messaggioErrore) {
  const prima = linkSalvati;
  linkSalvati = nuova;
  renderElencoLink();
  try {
    await salvaLinkMusica(campagnaIdCorrente, linkSalvati);
  } catch (errore) {
    console.error(errore);
    linkSalvati = prima;
    renderElencoLink();
    mostraToast(messaggioErrore, true);
  }
}

function chiudiSalva() {
  formSalva.hidden = true;
}

function renderElencoLink() {
  const salvato = linkSalvati.some((x) => stessoLink(x, youtubeCorrente));
  boxSalva.hidden = !youtubeCorrente;
  document.getElementById("btn-yt-salva").hidden = salvato || !formSalva.hidden;
  document.getElementById("yt-gia-salvato").hidden = !salvato;
  document.getElementById("yt-elenco-vuoto").hidden = linkSalvati.length > 0 || Boolean(tolto);

  const righe = linkSalvati.map((voce) => {
    const li = document.createElement("li");
    const inOnda = stessoLink(voce, youtubeCorrente);
    li.className = `yt-voce${inOnda ? " in-onda" : ""}`;
    const chiave = `${voce.tipo}:${voce.id}`;
    if (rinominaAperta === chiave) {
      li.innerHTML = `
        <form class="yt-rinomina" data-chiave="${esc(chiave)}">
          <input type="text" maxlength="80" value="${esc(voce.nome)}" aria-label="Nuovo nome" />
          <button type="submit" class="btn-tabella btn-tabella-evidenza">OK</button>
          <button type="button" class="btn-tabella" data-annulla-rinomina>Annulla</button>
        </form>`;
      return li;
    }
    li.innerHTML = `
      <button type="button" class="yt-voce-nome" data-suona="${esc(chiave)}" title="Carica e trasmetti">
        <b>▶ ${esc(voce.nome)}</b>
        <small>${inOnda ? "● in onda" : voce.tipo === "playlist" ? "Playlist" : "Video"}</small>
      </button>
      <button type="button" class="yt-voce-azione" data-rinomina="${esc(chiave)}" aria-label="Rinomina «${esc(voce.nome)}»" title="Rinomina">✎</button>
      <button type="button" class="yt-voce-azione" data-togli="${esc(chiave)}" aria-label="Togli «${esc(voce.nome)}» dall'elenco" title="Togli dall'elenco">×</button>`;
    return li;
  });
  if (tolto) {
    const li = document.createElement("li");
    li.className = "yt-voce yt-tolto";
    li.innerHTML = `<span>«${esc(tolto.voce.nome)}» tolto dall'elenco.</span> <button type="button" class="btn-tabella" data-ripristina>Annulla</button>`;
    righe.splice(Math.min(tolto.indice, righe.length), 0, li);
  }
  elencoLink.replaceChildren(...righe);
  const campo = elencoLink.querySelector(".yt-rinomina input");
  if (campo) {
    campo.focus();
    campo.select();
  }
}

const daChiave = (chiave) => {
  const [tipo, ...resto] = chiave.split(":");
  return { tipo, id: resto.join(":") };
};

document.getElementById("btn-yt-salva").addEventListener("click", () => {
  if (!youtubeCorrente) return;
  const dati = playerYouTubePronto ? playerYouTube.getVideoData?.() : null;
  // Per le playlist il titolo è quello del brano: meglio lasciarlo scegliere.
  campoNome.value = youtubeCorrente.tipo === "video" ? (dati?.title || "").slice(0, 80) : "";
  campoNome.placeholder = youtubeCorrente.tipo === "playlist" ? "Es. Combattimento" : "Es. Taverna";
  formSalva.hidden = false;
  renderElencoLink();
  campoNome.focus();
});

document.getElementById("btn-yt-salva-annulla").addEventListener("click", () => {
  chiudiSalva();
  renderElencoLink();
});

formSalva.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (!youtubeCorrente) return;
  chiudiSalva();
  await salvaElenco(aggiungiLinkSalvato(linkSalvati, youtubeCorrente, campoNome.value), "Impossibile salvare il link.");
});

elencoLink.addEventListener("click", async (evento) => {
  const suona = evento.target.closest("[data-suona]");
  if (suona) {
    if (!playerYouTubePronto) {
      mostraMessaggioYouTube("Il player di YouTube non è ancora pronto: riprova tra un istante.");
      return;
    }
    const sorgente = daChiave(suona.dataset.suona);
    document.getElementById("campo-youtube-link").value = sorgente.tipo === "playlist"
      ? `https://www.youtube.com/playlist?list=${sorgente.id}`
      : `https://www.youtube.com/watch?v=${sorgente.id}`;
    carica(sorgente, { avvia: true });
    if (sorgenteCorrente !== "youtube") impostaSorgente("youtube");
    return;
  }
  const rinomina = evento.target.closest("[data-rinomina]");
  if (rinomina) {
    rinominaAperta = rinomina.dataset.rinomina;
    renderElencoLink();
    return;
  }
  if (evento.target.closest("[data-annulla-rinomina]")) {
    rinominaAperta = null;
    renderElencoLink();
    return;
  }
  const togli = evento.target.closest("[data-togli]");
  if (togli) {
    const sorgente = daChiave(togli.dataset.togli);
    const indice = linkSalvati.findIndex((x) => stessoLink(x, sorgente));
    if (indice === -1) return;
    if (tolto) clearTimeout(tolto.timer);
    tolto = { voce: linkSalvati[indice], indice, timer: setTimeout(() => { tolto = null; renderElencoLink(); }, 6000) };
    await salvaElenco(togliLinkSalvato(linkSalvati, sorgente), "Impossibile togliere il link.");
    return;
  }
  if (evento.target.closest("[data-ripristina]") && tolto) {
    clearTimeout(tolto.timer);
    const { voce, indice } = tolto;
    tolto = null;
    const nuova = [...linkSalvati];
    nuova.splice(Math.min(indice, nuova.length), 0, voce);
    await salvaElenco(nuova, "Impossibile ripristinare il link.");
  }
});

elencoLink.addEventListener("submit", async (evento) => {
  const form = evento.target.closest(".yt-rinomina");
  if (!form) return;
  evento.preventDefault();
  const sorgente = daChiave(form.dataset.chiave);
  const nome = form.querySelector("input").value;
  rinominaAperta = null;
  await salvaElenco(rinominaLinkSalvato(linkSalvati, sorgente, nome), "Impossibile rinominare il link.");
});

elencoLink.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape" && rinominaAperta) {
    rinominaAperta = null;
    renderElencoLink();
  }
});

// ---------- Avvio pagina ----------

proteggiPaginaDM(async (user, profilo) => {
  montaMenuUtente({ contenitore: document.getElementById("slot-utente"), user, profilo });

  const campagna = await ottieniCampagnaCorrente(user.uid, profilo?.ruolo, { soloDM: true });
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

  // Ultimo contenuto YouTube trasmesso: lo ripresenta nel campo e nel player.
  const ultimoYouTube = sorgenteDaStato(stato.youtube);
  if (ultimoYouTube) {
    document.getElementById("campo-youtube-link").value =
      ultimoYouTube.tipo === "playlist"
        ? `https://www.youtube.com/playlist?list=${ultimoYouTube.id}`
        : `https://www.youtube.com/watch?v=${ultimoYouTube.id}`;
    if (playerYouTubePronto) carica(ultimoYouTube, { avvia: false });
    else youtubeDaRipristinare = ultimoYouTube;
  }

  try {
    linkSalvati = linkSalvatiDa(await ottieniLinkMusica(campagnaIdCorrente));
  } catch (errore) {
    console.error(errore);
  }
  renderElencoLink();

  await aggiornaSchermataSpotify();
  setInterval(aggiornaSchermataSpotify, 10000);

  veil.style.display = "none";
  contenuto.style.display = "block";
});
