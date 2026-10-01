// Logica pura delle Cloud Functions, separata dal collegamento con i servizi
// Google così da poterla testare senza emulatori (vedi test/logica.test.mjs).

// Quante email di notifica al massimo in un'ora: se qualcuno registrasse
// account in massa, la casella dell'admin non verrebbe sommersa (e l'account
// Gmail di appoggio non supererebbe i propri limiti di invio).
export const MASSIMO_EMAIL_ORARIE = 10;
const UN_ORA = 60 * 60 * 1000;

// Dato l'elenco degli invii recenti (in millisecondi) decide se si può inviare
// ancora e restituisce l'elenco aggiornato, ripulito da ciò che è più vecchio
// di un'ora.
export function registraInvio(inviiRecenti, adesso, massimo = MASSIMO_EMAIL_ORARIE) {
  const ultimaOra = (Array.isArray(inviiRecenti) ? inviiRecenti : []).filter(
    (istante) => typeof istante === "number" && istante > adesso - UN_ORA && istante <= adesso
  );
  if (ultimaOra.length >= massimo) return { consentito: false, invii: ultimaOra };
  return { consentito: true, invii: [...ultimaOra, adesso] };
}

// Testo dell'email per un nuovo iscritto. Nome ed email arrivano da chi si è
// registrato: vengono ripuliti da a-capo e accorciati (l'email è in testo
// semplice, quindi non c'è HTML da neutralizzare).
export function emailNuovoIscritto({ nome, email }, urlGestioneUtenti) {
  const pulisci = (valore, massimo) =>
    String(valore ?? "—").replace(/[\r\n\t]+/g, " ").trim().slice(0, massimo) || "—";
  const nomePulito = pulisci(nome, 60);
  return {
    oggetto: `Nuovo iscritto da approvare: ${nomePulito}`,
    testo: [
      "Un nuovo utente si è registrato al portale Sotterranei & Dragoni ed è in attesa di approvazione.",
      "",
      `Nome: ${nomePulito}`,
      `Email: ${pulisci(email, 120)}`,
      "",
      `Per approvarlo (o ignorarlo): ${urlGestioneUtenti}`,
      "",
      "Se non riconosci questa persona, non approvarla: senza approvazione non vede nulla della campagna.",
    ].join("\n"),
  };
}

// Decide se scollegare la fatturazione a partire da un avviso di budget
// (messaggio Pub/Sub di Cloud Billing: { costAmount, budgetAmount, ... }).
// Si blocca solo quando la spesa effettiva raggiunge la soglia scelta, che è
// volutamente più alta del budget: l'avviso email del budget arriva prima e
// lascia il tempo di intervenire a mano.
export function deveBloccare(avviso, soglia) {
  const spesa = Number(avviso?.costAmount);
  const limite = Number(soglia);
  if (!Number.isFinite(spesa) || !Number.isFinite(limite) || limite <= 0) return false;
  return spesa >= limite;
}

// ID del progetto dall'ambiente delle funzioni.
export function idProgetto(ambiente = process.env) {
  if (ambiente.GCLOUD_PROJECT) return ambiente.GCLOUD_PROJECT;
  try {
    return JSON.parse(ambiente.FIREBASE_CONFIG || "{}").projectId || null;
  } catch {
    return null;
  }
}

// ---------- Notifiche push ----------

// "2026-10-03" + "21:00" → "sab 3 ottobre, 21:00" (come nel calendario del sito).
export function dataLeggibile(iso, ora = null) {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [a, m, g] = iso.split("-").map(Number);
  const testo = new Date(Date.UTC(a, m - 1, g)).toLocaleDateString("it-IT", {
    weekday: "short", day: "numeric", month: "long", timeZone: "UTC",
  });
  return ora ? `${testo}, ${ora}` : testo;
}

const breve = (valore, massimo = 80) => String(valore ?? "").replace(/\s+/g, " ").trim().slice(0, massimo);

// Titolo, testo e pagina da aprire per una notifica della campanella
// (users/{uid}/notifiche). null se il tipo non va inviato come push.
// I valori sono tutti stringhe: è il formato dei messaggi "data" di FCM.
export function messaggioPush(notifica) {
  const titolo = notifica?.titolo ? breve(notifica.titolo) : "";
  switch (notifica?.tipo) {
    case "livello_su":
      return {
        titolo: "Sei salito di livello!",
        testo: `Il DM ti ha portato dal livello ${breve(notifica.livelloPrecedente, 4)} al ${breve(notifica.livelloNuovo, 4)}.`,
        url: "dashboard.html",
      };
    case "proposta_sessione": {
      const quante = Number(notifica.date) === 1 ? "una data" : `${breve(notifica.date, 4)} date`;
      return {
        titolo: "Nuove date per la prossima sessione",
        testo: `Il DM propone ${quante}${titolo ? ` (${titolo})` : ""}: rispondi nel calendario.`,
        url: "calendario.html",
      };
    }
    case "sessione_confermata": {
      const quando = dataLeggibile(notifica.data, notifica.ora ? breve(notifica.ora, 5) : null);
      return {
        titolo: `Sessione ${breve(notifica.numero, 6)} confermata`,
        testo: [quando, titolo].filter(Boolean).join(" — ") || "Guarda il calendario.",
        url: "calendario.html",
      };
    }
    case "sessione_iniziata":
      return {
        titolo: "La sessione è iniziata!",
        testo: `Sessione ${breve(notifica.numero, 6)}${titolo ? ` — ${titolo}` : ""}: raggiungi il tavolo.`,
        url: "sessione.html",
      };
    default:
      return null;
  }
}

// Quanti dispositivi al massimo per utente ricevono la notifica (i più recenti).
export const MASSIMO_DISPOSITIVI = 10;

// Errori di FCM per cui il token non tornerà mai valido: il dispositivo si toglie.
export function tokenDaRimuovere(errore) {
  return [
    "messaging/registration-token-not-registered",
    "messaging/invalid-registration-token",
    "messaging/invalid-argument",
  ].includes(errore?.code);
}
