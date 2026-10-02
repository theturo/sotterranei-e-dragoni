// Icone SVG della tela di design "Grafica di Base e Caricamento" (stati vuoti
// della pagina Sessione), usate dagli script. Testo fisso, nessun dato utente:
// si possono inserire con innerHTML.
export const ICONA_MASCHERA =
  '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 26 C14 14 22 8 32 8 C42 8 50 14 50 26 L50 34 C50 46 42 54 32 54 C22 54 14 46 14 34 Z"/><path d="M20 28 C22 25 26 25 28 28"/><path d="M36 28 C38 25 42 25 44 28"/><path d="M26 40 C29 43 35 43 38 40"/></svg>';
export const ICONA_NOTA =
  '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="22" cy="46" r="7" fill="currentColor" stroke="none"/><line x1="29" y1="46" x2="29" y2="12"/><path d="M29 12 C40 12 46 18 46 28"/></svg>';

// ---------- Controllo musica (tavola "Icone per il controllo musica") ----------
// Riempite con il colore del testo (fill="currentColor").
export const ICONA_COPERTINA =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="7.5" cy="18" r="3.3"/><rect x="9.8" y="4" width="1.8" height="14.6"/><path d="M11.6 4 C15.5 4 18 6.2 18 9.4 L16.2 9.4 C16.2 7.2 14.4 5.8 11.6 5.8 Z"/></svg>';
export const ICONA_PRECEDENTE =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="4" y="4" width="2.6" height="16" rx="1"/><path d="M20 4 L20 20 L8 12 Z"/></svg>';
export const ICONA_PAUSA =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4.5" height="16" rx="1.2"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.2"/></svg>';
export const ICONA_RIPRODUCI =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4 L20 12 L7 20 Z"/></svg>';
export const ICONA_SUCCESSIVO =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 4 L4 20 L16 12 Z"/><rect x="17.4" y="4" width="2.6" height="16" rx="1"/></svg>';

// ---------- Header condiviso (tavola "Icone per l'header condiviso") ----------
export const ICONA_HOME =
  '<svg viewBox="0 0 24 24" fill-rule="evenodd" aria-hidden="true"><path d="M12 3 L21 11 L18.5 11 L18.5 20 L5.5 20 L5.5 11 L3 11 Z M10 20 L10 13.5 L14 13.5 L14 20 Z"/></svg>';
export const ICONA_MODIFICA =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25 L3 21 L6.75 21 L17.81 9.94 L14.06 6.19 Z M20.71 7.04 C21.1 6.65 21.1 6.02 20.71 5.63 L18.37 3.29 C17.98 2.9 17.35 2.9 16.96 3.29 L15.13 5.12 L18.88 8.87 Z"/></svg>';
export const ICONA_SESSIONE =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="2.5" width="16" height="7" rx="3.5"/><rect x="4" y="14.5" width="16" height="7" rx="3.5"/><rect x="6.5" y="8" width="11" height="8"/></svg>';
export const ICONA_CALENDARIO =
  '<svg viewBox="0 0 24 24" fill-rule="evenodd" aria-hidden="true"><path d="M5 2 L7 2 L7 3.5 L17 3.5 L17 2 L19 2 L19 3.5 L20 3.5 C21.1 3.5 22 4.4 22 5.5 L22 19.5 C22 20.6 21.1 21.5 20 21.5 L4 21.5 C2.9 21.5 2 20.6 2 19.5 L2 5.5 C2 4.4 2.9 3.5 4 3.5 L5 3.5 Z M4 8.5 L20 8.5 L20 8.8 L4 8.8 Z M6.5 11.5 L9 11.5 L9 14 L6.5 14 Z M11 11.5 L13.5 11.5 L13.5 14 L11 14 Z M15.5 11.5 L18 11.5 L18 14 L15.5 14 Z M6.5 15.5 L9 15.5 L9 18 L6.5 18 Z M11 15.5 L13.5 15.5 L13.5 18 L11 18 Z"/></svg>';

// ---------- Disponibilità nel calendario (tavola "Icone per il conteggio") ----------
// A tratto: il riempimento è disattivato anche nello stile (style="fill:none"),
// così restano a tratto pure dentro i pulsanti che riempiono gli SVG.
export const ICONA_SI =
  '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 13 L9 18 L20 5"/></svg>';
export const ICONA_FORSE =
  '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 8.2 C8.5 5.6 10.2 3.8 12 3.8 C14.2 3.8 16 5.5 16 7.4 C16 9.6 14 10.2 12.6 11.8 C12.1 12.4 12 13.1 12 13.8"/><circle cx="12" cy="18" r="1.3" style="fill:currentColor" stroke="none"/></svg>';
export const ICONA_NO =
  '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5 L19 19 M19 5 L5 19"/></svg>';
