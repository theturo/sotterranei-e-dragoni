// Date e orari delle sessioni: formattazione in italiano, "oggi", conto alla
// rovescia e file .ics da importare nel calendario del telefono.

const due = (n) => String(n).padStart(2, "0");

// "2026-10-10" del giorno indicato (ora locale).
export function isoGiorno(data = new Date()) {
  return `${data.getFullYear()}-${due(data.getMonth() + 1)}-${due(data.getDate())}`;
}

export const oggiIso = () => isoGiorno(new Date());

export function dataLocale(iso, ora = null) {
  const [a, m, g] = String(iso).split("-").map(Number);
  const [h, min] = ora ? ora.split(":").map(Number) : [0, 0];
  return new Date(a, m - 1, g, h, min);
}

// "ven 10 ottobre, 21:00"
export function formattaDataOra(iso, ora = null, { anno = false } = {}) {
  if (!iso) return "";
  const testo = dataLocale(iso).toLocaleDateString("it-IT", {
    weekday: "short", day: "numeric", month: "long", ...(anno ? { year: "numeric" } : {}),
  });
  return ora ? `${testo}, ${ora}` : testo;
}

// "oggi", "domani", "tra 3 giorni", "3 giorni fa"
export function distanzaGiorni(iso) {
  const giorni = Math.round((dataLocale(iso) - dataLocale(oggiIso())) / 86400000);
  if (giorni === 0) return "oggi";
  if (giorni === 1) return "domani";
  if (giorni === -1) return "ieri";
  return giorni > 0 ? `tra ${giorni} giorni` : `${-giorni} giorni fa`;
}

export function etichettaSessione(sessione) {
  return `Sessione ${sessione.numero ?? "?"}${sessione.titolo ? ` — ${sessione.titolo}` : ""}`;
}

// Prossima sessione programmata (oggi compreso), o null.
export function prossimaSessione(sessioni) {
  const oggi = oggiIso();
  return sessioni
    .filter((s) => s.stato === "programmata" && s.dataProgrammata && s.dataProgrammata >= oggi)
    .sort((a, b) => `${a.dataProgrammata} ${a.oraProgrammata || ""}`.localeCompare(`${b.dataProgrammata} ${b.oraProgrammata || ""}`))[0] || null;
}

// ---------- File .ics ----------

const ics = (testo) => String(testo).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
const timbro = (data) => `${data.getFullYear()}${due(data.getMonth() + 1)}${due(data.getDate())}T${due(data.getHours())}${due(data.getMinutes())}00`;

// Evento in ora locale "fluttuante" (quella del telefono), 4 ore se c'è
// l'orario, altrimenti tutto il giorno.
export function testoIcs(sessione, nomeCampagna = "Sotterranei & Dragoni") {
  const inizio = dataLocale(sessione.dataProgrammata, sessione.oraProgrammata);
  const righe = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sotterranei & Dragoni//Calendario//IT", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${sessione.id}@sotterranei-e-dragoni`,
    `DTSTAMP:${timbro(new Date())}`,
  ];
  if (sessione.oraProgrammata) {
    const fine = new Date(inizio.getTime() + 4 * 3600000);
    righe.push(`DTSTART:${timbro(inizio)}`, `DTEND:${timbro(fine)}`);
  } else {
    const dopo = new Date(inizio.getTime() + 86400000);
    righe.push(`DTSTART;VALUE=DATE:${sessione.dataProgrammata.replaceAll("-", "")}`, `DTEND;VALUE=DATE:${isoGiorno(dopo).replaceAll("-", "")}`);
  }
  righe.push(`SUMMARY:${ics(`${nomeCampagna} — ${etichettaSessione(sessione)}`)}`, "END:VEVENT", "END:VCALENDAR");
  return righe.join("\r\n");
}

export function scaricaIcs(sessione, nomeCampagna) {
  const url = URL.createObjectURL(new Blob([testoIcs(sessione, nomeCampagna)], { type: "text/calendar" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `sessione-${sessione.numero ?? ""}.ics`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
