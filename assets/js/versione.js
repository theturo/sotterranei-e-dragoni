// Nome leggibile della versione del sito (Impostazioni ⚙️): «V. 09.10.2026 ·
// 5818134d». Codice e data arrivano dal service worker (VERSIONE e
// DATA_VERSIONE in sw.js, generate da strumenti/aggiorna-sw.mjs).
// Nessuna dipendenza: lo usano le Impostazioni e i test.

export const codiceBreve = (versione) => String(versione || "").slice(0, 8);

// "2026-10-09" → "09.10.2026" (null se la data non è valida).
export function dataCompatta(data) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(data || ""));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : null;
}

// { versione, data } → «V. 09.10.2026 · 5818134d» (solo il codice se manca la data).
export function nomeVersione(info) {
  if (!info?.versione) return null;
  const data = dataCompatta(info.data);
  return data ? `V. ${data} · ${codiceBreve(info.versione)}` : `V. ${codiceBreve(info.versione)}`;
}

// La versione in attesa è davvero diversa da quella in uso?
export const versioneNuova = (attuale, inAttesa) => Boolean(inAttesa?.versione) && inAttesa.versione !== attuale?.versione;
