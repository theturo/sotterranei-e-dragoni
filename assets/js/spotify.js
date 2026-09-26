// Integrazione Spotify lato client, senza backend: flusso OAuth "Authorization
// Code con PKCE" (nessun Client Secret necessario) più le chiamate dirette alle
// Web API di Spotify per leggere/pilotare la riproduzione. I token restano SOLO
// nel browser del Dungeon Master (localStorage): non vengono mai scritti su
// Firestore, dove sarebbero leggibili da chiunque abbia accesso al documento.
import { SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URI, SPOTIFY_SCOPES } from "./spotify-config.js";

const CHIAVE_ACCESS_TOKEN = "spotify_access_token";
const CHIAVE_REFRESH_TOKEN = "spotify_refresh_token";
const CHIAVE_SCADENZA = "spotify_scadenza";
const CHIAVE_VERIFICATORE = "spotify_verificatore";

function generaStringaCasuale(lunghezza) {
  const possibili = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const valori = crypto.getRandomValues(new Uint8Array(lunghezza));
  return Array.from(valori, (v) => possibili[v % possibili.length]).join("");
}

function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function generaChallenge(verificatore) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verificatore));
  return base64UrlEncode(digest);
}

function salvaToken({ access_token, refresh_token, expires_in }) {
  localStorage.setItem(CHIAVE_ACCESS_TOKEN, access_token);
  if (refresh_token) localStorage.setItem(CHIAVE_REFRESH_TOKEN, refresh_token);
  localStorage.setItem(CHIAVE_SCADENZA, String(Date.now() + expires_in * 1000));
}

// Avvia il login: genera verifier/challenge PKCE e reindirizza a Spotify.
export async function avviaLogin() {
  const verificatore = generaStringaCasuale(64);
  const challenge = await generaChallenge(verificatore);
  sessionStorage.setItem(CHIAVE_VERIFICATORE, verificatore);

  const parametri = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: SPOTIFY_REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SPOTIFY_SCOPES.join(" "),
  });
  window.location.href = `https://accounts.spotify.com/authorize?${parametri}`;
}

// Da chiamare al caricamento di controllo-musica.html: se l'URL contiene
// "?code=" (siamo appena tornati dal login Spotify), scambia il codice con i
// token e ripulisce l'URL. Restituisce true se un login è stato completato ora.
export async function gestisciCallback() {
  const parametri = new URLSearchParams(window.location.search);
  const codice = parametri.get("code");
  if (!codice) return false;

  const verificatore = sessionStorage.getItem(CHIAVE_VERIFICATORE);
  const risposta = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: "authorization_code",
      code: codice,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      code_verifier: verificatore,
    }),
  });
  window.history.replaceState({}, document.title, window.location.pathname);
  if (!risposta.ok) throw new Error("Scambio del codice Spotify non riuscito.");

  salvaToken(await risposta.json());
  sessionStorage.removeItem(CHIAVE_VERIFICATORE);
  return true;
}

async function rinnovaToken() {
  const refreshToken = localStorage.getItem(CHIAVE_REFRESH_TOKEN);
  if (!refreshToken) return null;

  const risposta = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!risposta.ok) return null;

  const dati = await risposta.json();
  salvaToken({ ...dati, refresh_token: dati.refresh_token || refreshToken });
  return dati.access_token;
}

// Restituisce un access token valido, rinnovandolo se scaduto. null se non
// c'è mai stato un login.
async function tokenValido() {
  const scadenza = Number(localStorage.getItem(CHIAVE_SCADENZA) || 0);
  if (Date.now() < scadenza - 5000) return localStorage.getItem(CHIAVE_ACCESS_TOKEN);
  return rinnovaToken();
}

export function spotifyCollegato() {
  return Boolean(localStorage.getItem(CHIAVE_REFRESH_TOKEN));
}

export function scollegaSpotify() {
  localStorage.removeItem(CHIAVE_ACCESS_TOKEN);
  localStorage.removeItem(CHIAVE_REFRESH_TOKEN);
  localStorage.removeItem(CHIAVE_SCADENZA);
}

// Legge cosa sta suonando ora. null se non c'è nulla in riproduzione (o
// nessun dispositivo Spotify attivo) — non richiede Premium.
export async function otteniRiproduzioneCorrente() {
  const token = await tokenValido();
  if (!token) return null;

  const risposta = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (risposta.status === 204 || !risposta.ok) return null;

  const dati = await risposta.json();
  if (!dati?.item) return null;
  return {
    brano: dati.item.name || "—",
    artista: (dati.item.artists || []).map((a) => a.name).join(", ") || "—",
    copertinaUrl: dati.item.album?.images?.[0]?.url || null,
    inRiproduzione: Boolean(dati.is_playing),
  };
}

// Errore dedicato per distinguere "serve Premium" dagli altri errori di rete,
// così la UI può mostrare un messaggio specifico.
export class ErroreSpotifyPremium extends Error {}

async function comando(metodo, endpoint) {
  const token = await tokenValido();
  if (!token) throw new Error("Spotify non collegato.");

  const risposta = await fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (risposta.status === 403) throw new ErroreSpotifyPremium("Questa azione richiede Spotify Premium.");
  if (!risposta.ok && risposta.status !== 204) throw new Error("Comando Spotify non riuscito.");
}

export const spotifyPlay = () => comando("PUT", "play");
export const spotifyPausa = () => comando("PUT", "pause");
export const spotifySuccessivo = () => comando("POST", "next");
export const spotifyPrecedente = () => comando("POST", "previous");
