// Configurazione pubblica dell'app Spotify (Client ID, non è un segreto: il
// flusso di autenticazione usato — Authorization Code con PKCE — non richiede
// un Client Secret, è pensato apposta per app client-only come questa).
// Il redirect URI deve coincidere ESATTAMENTE con quello registrato in
// developer.spotify.com/dashboard per questa app.
export const SPOTIFY_CLIENT_ID = "4c2ba2fc521442d9a90c31bd451210d4";
export const SPOTIFY_REDIRECT_URI = "https://theturo.github.io/sotterranei-e-dragoni/controllo-musica.html";
export const SPOTIFY_SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
];
