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

// ---------- Icone dei lotti «cruscotto e tracker» e «guida, bestiario, mappa e
// musica» ----------
// 24×24 (la bussola grande 64×64), a tratto (stroke=currentColor, 1.7) o piene,
// colore dal testo. Quelle a tratto hanno style="fill:none", così restano a
// tratto anche dentro i pulsanti che riempiono gli SVG. Nome = data-icona delle
// tavole di design.
const ICONE = {
  "calendario":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2"/><line x1="3.5" y1="10" x2="20.5" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/><g fill="currentColor" stroke="none"><circle cx="8" cy="14" r="1"/><circle cx="12" cy="14" r="1"/><circle cx="16" cy="14" r="1"/><circle cx="8" cy="17.2" r="1"/><circle cx="12" cy="17.2" r="1"/></g></svg>',
  "libreria":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M3.5 17 L9 12 L13 15.5 L16 13 L20.5 17"/></svg>',
  "bestiario":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6.8 9 C4 8 3 5.5 3.6 3.4 C6 4 7.5 5.5 8.5 7.5"/><path d="M17.2 9 C20 8 21 5.5 20.4 3.4 C18 4 16.5 5.5 15.5 7.5"/><path d="M7 8 C9 7 15 7 17 8 C18 11 17.5 15 15.5 18 L14 20.5 L12 19.5 L10 20.5 L8.5 18 C6.5 15 6 11 7 8 Z"/><path d="M9 11.5 L11 12.4 M15 11.5 L13 12.4"/><path d="M10.6 16.6 L11 18 M13.4 16.6 L13 18"/></svg>',
  "campagna":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="6.2"/><circle cx="12" cy="12" r="2.4"/><line x1="12" y1="2.8" x2="12" y2="5.4" transform="rotate(0 12 12)"/><line x1="12" y1="2.8" x2="12" y2="5.4" transform="rotate(45 12 12)"/><line x1="12" y1="2.8" x2="12" y2="5.4" transform="rotate(90 12 12)"/><line x1="12" y1="2.8" x2="12" y2="5.4" transform="rotate(135 12 12)"/><line x1="12" y1="2.8" x2="12" y2="5.4" transform="rotate(180 12 12)"/><line x1="12" y1="2.8" x2="12" y2="5.4" transform="rotate(225 12 12)"/><line x1="12" y1="2.8" x2="12" y2="5.4" transform="rotate(270 12 12)"/><line x1="12" y1="2.8" x2="12" y2="5.4" transform="rotate(315 12 12)"/></svg>',
  "sessione":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4 C4.5 4 3.5 5 3.5 6.5 C3.5 8 4.5 9 6 9 L6 19 C6 20.5 7 21.5 8.5 21.5 L18 21.5 C19.5 21.5 20.5 20.5 20.5 19 L20.5 17"/><path d="M18 4 C19.5 4 20.5 5 20.5 6.5 L20.5 17 L15.5 17 L15.5 21.5"/><line x1="6" y1="4" x2="18" y2="4"/><line x1="9" y1="12" x2="17" y2="12" opacity="0.5"/><line x1="9" y1="15.5" x2="14" y2="15.5" opacity="0.5"/></svg>',
  "musica":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><g fill="currentColor" stroke="none"><circle cx="7" cy="18" r="2.7"/><circle cx="17" cy="16" r="2.7"/></g><path d="M9.7 18 L9.7 6.5"/><path d="M19.7 16 L19.7 4.5"/><path d="M9.7 6.5 L19.7 4.5" stroke-width="2.6"/></svg>',
  "tavolo":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4.5" width="19" height="12.5" rx="2"/><line x1="8" y1="20.5" x2="16" y2="20.5"/><line x1="12" y1="17" x2="12" y2="20.5"/><path d="M9.5 7 L9.5 14.5 M12 7 L12 14.5 M14.5 7 L14.5 14.5 M7 9.5 L17 9.5 M7 12 L17 12" opacity="0.5"/></svg>',
  "party":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 L19 5 V11 C19 15.5 16 19 12 21 C8 19 5 15.5 5 11 V5 Z"/><path d="M9 12 L12 9 L15 12"/><path d="M9 16 L12 13 L15 16"/></svg>',
  "equipaggiamento":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8 C7 5.5 9 4 12 4 C15 4 17 5.5 17 8 L18 18.5 C18 20 17 21 15.5 21 L8.5 21 C7 21 6 20 6 18.5 Z"/><path d="M7 11.2 C9.5 12.7 14.5 12.7 17 11.2"/><rect x="9" y="15" width="6" height="4" rx="1"/><path d="M10 4.2 C10 2.8 14 2.8 14 4.2"/></svg>',
  "incantesimi":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3 C10.6 8 12 9.4 17 10 C12 10.6 10.6 12 10 17 C9.4 12 8 10.6 3 10 C8 9.4 9.4 8 10 3 Z"/><path d="M18 13 C18.3 15 19 15.7 21 16 C19 16.3 18.3 17 18 19 C17.7 17 17 16.3 15 16 C17 15.7 17.7 15 18 13 Z"/><circle cx="17.5" cy="5" r="0.9" fill="currentColor" stroke="none"/></svg>',
  "personaggi":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 2.5 C14 7 16 12 18.2 16.2 M13.5 2.5 C11.2 6 8.8 11 5.8 16.2"/><path d="M13.5 2.5 C15.5 2.2 17 3.2 17.4 4.6"/><ellipse cx="12" cy="18.2" rx="9.8" ry="2.8"/><path d="M8 13.4 C10.4 14.6 14 14.6 16.2 13.4" opacity="0.6"/></svg>',
  "guida":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="3" x2="12" y2="21"/><path d="M12 5 L19 5 L21 7.5 L19 10 L12 10"/><path d="M12 12 L5 12 L3 14.5 L5 17 L12 17"/></svg>',
  "archivio":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1.2"/><path d="M4.5 9 L4.5 19 C4.5 20 5.3 20.8 6.3 20.8 L17.7 20.8 C18.7 20.8 19.5 20 19.5 19 L19.5 9"/><line x1="10" y1="13" x2="14" y2="13"/></svg>',
  "utenti":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="12" r="4"/><circle cx="8" cy="12" r="1.2" fill="currentColor" stroke="none"/><path d="M12 12 L21 12 M18 12 L18 15.5 M21 12 L21 14.5"/></svg>',
  "livello":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12 L12 6 L18 12"/><path d="M6 18 L12 12 L18 18"/></svg>',
  "tutto-ok":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 L19 5 V11 C19 15.5 16 19 12 21 C8 19 5 15.5 5 11 V5 Z"/><path d="M8.5 11.5 L11 14 L16 8"/></svg>',
  "turno-successivo":
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4 L4 20 L16 12 Z"/><rect x="17.4" y="4" width="2.6" height="16" rx="1"/></svg>',
  "turno-corrente":
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4 L20 12 L7 20 Z"/></svg>',
  "dado":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5 L20.5 7.2 L20.5 16.8 L12 21.5 L3.5 16.8 L3.5 7.2 Z"/><path d="M12 7.6 L16.4 15.4 L7.6 15.4 Z"/></svg>',
  "su":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15 L12 9 L18 15"/></svg>',
  "giu":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9 L12 15 L18 9"/></svg>',
  "scheda":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><line x1="8.5" y1="8" x2="15.5" y2="8" stroke-width="2"/><line x1="8.5" y1="12" x2="15.5" y2="12" opacity="0.6"/><line x1="8.5" y1="15" x2="15.5" y2="15" opacity="0.6"/><line x1="8.5" y1="18" x2="12.5" y2="18" opacity="0.6"/></svg>',
  "porta":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21 L5 10 C5 6 8 3.5 12 3.5 C16 3.5 19 6 19 10 L19 21"/><line x1="3" y1="21" x2="21" y2="21"/><circle cx="12" cy="12.5" r="1.6"/><line x1="12" y1="14.1" x2="12" y2="17.5"/></svg>',
  "bussola":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2"/><path d="M12 5.8 L14.4 12 L9.6 12 Z" fill="currentColor"/><path d="M12 18.2 L14.4 12 L9.6 12 Z"/></svg>',
  "spade":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="20" x2="20" y2="4"/><line x1="15" y1="7" x2="18" y2="10"/><circle cx="20" cy="4" r="1.2" fill="currentColor" stroke="none"/><line x1="20" y1="20" x2="4" y2="4"/><line x1="9" y1="7" x2="6" y2="10"/><circle cx="4" cy="4" r="1.2" fill="currentColor" stroke="none"/></svg>',
  "telefono":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2.2"/><line x1="10.5" y1="5.6" x2="13.5" y2="5.6"/><circle cx="12" cy="18.4" r="0.9" fill="currentColor" stroke="none"/></svg>',
  "faq":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2"/><path d="M9.7 9.6 C9.7 8 10.7 6.9 12 6.9 C13.4 6.9 14.5 8 14.5 9.3 C14.5 10.9 12.9 11.3 12.4 12.5 L12.4 13.4"/><circle cx="12.4" cy="16.4" r="0.95" fill="currentColor" stroke="none"/></svg>',
  "centra":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><path d="M12 2.8 L12 6.6 M12 17.4 L12 21.2 M2.8 12 L6.6 12 M17.4 12 L21.2 12"/></svg>',
  "impostazioni":
    '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6.3" fill="none" stroke="currentColor" stroke-width="3.5"/><rect x="10.36" y="1.63" width="3.29" height="3.29" transform="rotate(0 12 12)"/><rect x="10.36" y="1.63" width="3.29" height="3.29" transform="rotate(45 12 12)"/><rect x="10.36" y="1.63" width="3.29" height="3.29" transform="rotate(90 12 12)"/><rect x="10.36" y="1.63" width="3.29" height="3.29" transform="rotate(135 12 12)"/><rect x="10.36" y="1.63" width="3.29" height="3.29" transform="rotate(180 12 12)"/><rect x="10.36" y="1.63" width="3.29" height="3.29" transform="rotate(225 12 12)"/><rect x="10.36" y="1.63" width="3.29" height="3.29" transform="rotate(270 12 12)"/><rect x="10.36" y="1.63" width="3.29" height="3.29" transform="rotate(315 12 12)"/></svg>',
  "fatto":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2"/><path d="M7.8 12.4 L10.7 15.3 L16.4 8.8"/></svg>',
  "prossimo":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2"/><path d="M10 8 L16 12 L10 16 Z" fill="currentColor"/></svg>',
  "da-fare":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2" opacity="0.5"/></svg>',
  "lucchetto":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5 L8 8 C8 5.8 9.8 4 12 4 C14.2 4 16 5.8 16 8 L16 10.5"/><circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none"/></svg>',
  "occhio":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12 C6 7 18 7 22 12 C18 17 6 17 2 12 Z"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/></svg>',
  "turno-precedente":
    '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="2.6" height="16" rx="1"/><path d="M20 4 L20 20 L8 12 Z"/></svg>',
  "a-terra":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6 L18 18 M18 6 L6 18" stroke="#150d08" stroke-width="6.2" opacity="0.7"/><path d="M6 6 L18 18 M18 6 L6 18" stroke="#e0525f" stroke-width="3.4"/></svg>',
  "bussola-grande":
    '<svg viewBox="0 0 64 64" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="22"/><path d="M32 14 L37 30 L32 34 L27 30 Z" fill="currentColor" stroke="none"/><path d="M32 50 L27 34 L32 30 L37 34 Z"/><circle cx="32" cy="32" r="2" fill="currentColor" stroke="none"/><line x1="32" y1="8" x2="32" y2="12" stroke-width="1.4"/><line x1="32" y1="52" x2="32" y2="56" stroke-width="1.4"/><line x1="8" y1="32" x2="12" y2="32" stroke-width="1.4"/><line x1="52" y1="32" x2="56" y2="32" stroke-width="1.4"/></svg>',
  "riproduci":
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4 L20 12 L7 20 Z"/></svg>',
  "rinomina":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20 L4.8 16.2 L16.5 4.5 C17.3 3.7 18.7 3.7 19.5 4.5 C20.3 5.3 20.3 6.7 19.5 7.5 L7.8 19.2 Z"/><line x1="14.5" y1="6.5" x2="17.5" y2="9.5"/></svg>',
  "stella":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 L14.6 8.9 L21 9.5 L16.2 13.8 L17.6 20.2 L12 17 L6.4 20.2 L7.8 13.8 L3 9.5 L9.4 8.9 Z"/></svg>',
  "stella-piena":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 L14.6 8.9 L21 9.5 L16.2 13.8 L17.6 20.2 L12 17 L6.4 20.2 L7.8 13.8 L3 9.5 L9.4 8.9 Z" fill="currentColor"/></svg>',
  "audio-muto":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5 L8 9.5 L13 5.5 L13 18.5 L8 14.5 L4 14.5 Z" fill="currentColor"/><path d="M16.5 9.5 L21 14.5 M21 9.5 L16.5 14.5"/></svg>',
  "audio-acceso":
    '<svg viewBox="0 0 24 24" fill="none" style="fill:none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5 L8 9.5 L13 5.5 L13 18.5 L8 14.5 L4 14.5 Z" fill="currentColor"/><path d="M16 9 C17.6 10.5 17.6 13.5 16 15"/><path d="M18.8 6.5 C21.8 9.5 21.8 14.5 18.8 17.5"/></svg>',
};

// L'SVG dell'icona come testo (per innerHTML), con la classe "icona" più
// quelle date. Nome sconosciuto: stringa vuota.
export function icona(nome, classe = "") {
  const svg = ICONE[nome];
  if (!svg) return "";
  return svg.replace("<svg ", `<svg class="icona${classe ? ` ${classe}` : ""}" aria-hidden="true" data-icona="${nome}" `);
}

// L'icona come elemento, per chi costruisce il DOM con createElement.
export function elementoIcona(nome, classe = "") {
  const modello = document.createElement("template");
  modello.innerHTML = icona(nome, classe);
  return modello.content.firstElementChild;
}
