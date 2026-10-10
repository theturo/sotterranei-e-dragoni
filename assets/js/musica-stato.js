// Il brano di Spotify è ancora "attuale"? La pagina «Controllo musica» del
// DM rinnova spotifyAggiornatoIl ogni 20 minuti finché è aperta: dopo un'ora
// senza notizie (pagina chiusa, o uno stato rimasto dai test) i giocatori
// vedono «Nessuna musica in riproduzione» invece di un brano fermo da giorni.
// Nessuna dipendenza: lo usano il widget della musica e i test.

export const ETA_MASSIMA_SPOTIFY_MS = 60 * 60 * 1000;

// "quando": Timestamp di Firestore, numero (ms) o null mentre la scrittura è
// ancora in corso (conta come appena aggiornato). Senza il campo (stati
// salvati prima di questa regola) il brano è considerato vecchio.
export function statoSpotifyRecente(stato, ora = Date.now()) {
  if (!stato?.spotify) return false;
  const quando = stato.spotifyAggiornatoIl;
  if (quando === null) return true;
  if (quando === undefined) return false;
  const ms = typeof quando === "number" ? quando : quando?.toMillis?.();
  return Number.isFinite(ms) && ora - ms <= ETA_MASSIMA_SPOTIFY_MS;
}
