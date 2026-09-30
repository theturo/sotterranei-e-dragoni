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
