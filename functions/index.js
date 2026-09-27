// Cloud Functions di Sotterranei e Dragoni (piano Blaze).
// - notificaNuovoIscritto: email all'admin quando qualcuno si registra ed è in
//   attesa di approvazione.
// - bloccaSpeseOltreSoglia: "interruttore" di sicurezza. Riceve gli avvisi del
//   budget via Pub/Sub e, se la spesa raggiunge la soglia scelta, scollega la
//   fatturazione dal progetto (tutti i servizi a pagamento si fermano finché
//   non la si ricollega a mano).
// Pubblicazione e configurazione: docs/funzioni.md.
import { setGlobalOptions, logger } from "firebase-functions/v2";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onMessagePublished } from "firebase-functions/v2/pubsub";
import { defineString, defineInt, defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import nodemailer from "nodemailer";
import { CloudBillingClient } from "@google-cloud/billing";
import { registraInvio, emailNuovoIscritto, deveBloccare, idProgetto } from "./logica.js";

initializeApp();
const db = getFirestore();
const IN_EMULATORE = process.env.FUNCTIONS_EMULATOR === "true";

// europe-west1: la regione corrispondente al database Firestore (eur3).
// Una sola istanza al massimo e poca memoria: niente scalate inattese dei costi.
setGlobalOptions({ region: "europe-west1", maxInstances: 1, memory: "256MiB", timeoutSeconds: 60 });

// Parametri chiesti dalla CLI al primo deploy e salvati fuori dal repo
// (functions/.env.<progetto>, escluso da git); la password in Secret Manager.
const EMAIL_MITTENTE = defineString("EMAIL_MITTENTE", {
  description: "Indirizzo Gmail di appoggio da cui partono le notifiche",
});
const EMAIL_ADMIN = defineString("EMAIL_ADMIN", { description: "Indirizzo a cui inviare le notifiche per l'admin" });
const PASSWORD_APP_GMAIL = defineSecret("PASSWORD_APP_GMAIL");
const SOGLIA_BLOCCO_SPESA = defineInt("SOGLIA_BLOCCO_SPESA", {
  default: 10,
  description: "Spesa (nella valuta dell'account di fatturazione) oltre la quale scollegare la fatturazione",
});
const URL_GESTIONE_UTENTI = "https://theturo.github.io/sotterranei-e-dragoni/admin-utenti.html";

// Documenti tecnici in "sistema/*": le regole di Firestore non li rendono
// accessibili ai client (nessuna regola li consente), solo a queste funzioni.
const docLimitatore = () => db.doc("sistema/notificheEmail");

export const notificaNuovoIscritto = onDocumentCreated(
  { document: "users/{uid}", secrets: [PASSWORD_APP_GMAIL] },
  async (evento) => {
    const profilo = evento.data?.data();
    if (!profilo || profilo.approvato !== false) return;

    // Limite di invii orari, conteggiato in modo atomico.
    const consentito = await db.runTransaction(async (transazione) => {
      const snapshot = await transazione.get(docLimitatore());
      const esito = registraInvio(snapshot.data()?.invii, Date.now());
      if (esito.consentito) transazione.set(docLimitatore(), { invii: esito.invii });
      return esito.consentito;
    });
    if (!consentito) {
      logger.warn("Troppe registrazioni nell'ultima ora: notifica email saltata.", { uid: evento.params.uid });
      return;
    }

    const { oggetto, testo } = emailNuovoIscritto(profilo, URL_GESTIONE_UTENTI);
    const trasporto = IN_EMULATORE
      ? nodemailer.createTransport({ jsonTransport: true })
      : nodemailer.createTransport({
          service: "gmail",
          auth: { user: EMAIL_MITTENTE.value(), pass: PASSWORD_APP_GMAIL.value() },
        });
    const messaggio = {
      from: `Portale Sotterranei e Dragoni <${EMAIL_MITTENTE.value()}>`,
      to: EMAIL_ADMIN.value(),
      subject: oggetto,
      text: testo,
    };
    await trasporto.sendMail(messaggio);
    if (IN_EMULATORE) await db.doc("sistema/ultimaEmailEmulatore").set(messaggio);
    logger.info("Notifica di nuovo iscritto inviata.", { uid: evento.params.uid });
  }
);

// Account di servizio dedicato, l'unico con il permesso di gestire la
// fatturazione (vedi docs/funzioni.md): le altre funzioni non lo hanno.
const ACCOUNT_BLOCCO_SPESE = "blocco-spese@sotterranei-e-dragoni.iam.gserviceaccount.com";

export const bloccaSpeseOltreSoglia = onMessagePublished(
  { topic: "avvisi-budget", ...(IN_EMULATORE ? {} : { serviceAccount: ACCOUNT_BLOCCO_SPESE }) },
  async (evento) => {
    const avviso = evento.data.message.json;
    const soglia = SOGLIA_BLOCCO_SPESA.value();
    logger.info("Avviso di budget ricevuto.", {
      spesa: avviso?.costAmount,
      budget: avviso?.budgetAmount,
      valuta: avviso?.currencyCode,
      soglia,
    });
    if (!deveBloccare(avviso, soglia)) return;

    const progetto = idProgetto();
    if (IN_EMULATORE) {
      await db.doc("sistema/ultimoBloccoEmulatore").set({ progetto, spesa: avviso.costAmount, soglia });
      return;
    }

    const fatturazione = new CloudBillingClient();
    const nome = `projects/${progetto}`;
    const [info] = await fatturazione.getProjectBillingInfo({ name: nome });
    if (!info.billingEnabled) {
      logger.info("Fatturazione già scollegata.");
      return;
    }
    await fatturazione.updateProjectBillingInfo({ name: nome, projectBillingInfo: { billingAccountName: "" } });
    logger.error(`Spesa ${avviso.costAmount} oltre la soglia di ${soglia}: fatturazione SCOLLEGATA dal progetto ${progetto}.`);
  }
);
