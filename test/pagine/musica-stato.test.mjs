// Brano di Spotify "attuale" o vecchio (assets/js/musica-stato.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { statoSpotifyRecente, ETA_MASSIMA_SPOTIFY_MS } from "../../assets/js/musica-stato.js";

const ora = Date.UTC(2026, 9, 10, 20, 0);
const brano = { brano: "Tema", artista: "Bardo", inRiproduzione: false };
const ts = (ms) => ({ toMillis: () => ms });

test("stato rimasto dai test, senza ora: vecchio", () => {
  assert.equal(statoSpotifyRecente({ sorgente: "spotify", spotify: brano }, ora), false);
});

test("aggiornato da poco: si mostra", () => {
  assert.equal(statoSpotifyRecente({ spotify: brano, spotifyAggiornatoIl: ts(ora - 5 * 60 * 1000) }, ora), true);
  assert.equal(statoSpotifyRecente({ spotify: brano, spotifyAggiornatoIl: ora - ETA_MASSIMA_SPOTIFY_MS }, ora), true);
});

test("più di un'ora senza notizie: vecchio", () => {
  assert.equal(statoSpotifyRecente({ spotify: brano, spotifyAggiornatoIl: ts(ora - ETA_MASSIMA_SPOTIFY_MS - 1) }, ora), false);
});

test("scrittura in corso (null) conta come appena aggiornato; senza brano è falso", () => {
  assert.equal(statoSpotifyRecente({ spotify: brano, spotifyAggiornatoIl: null }, ora), true);
  assert.equal(statoSpotifyRecente({ spotify: null, spotifyAggiornatoIl: ts(ora) }, ora), false);
});
