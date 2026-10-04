// Cloud Functions di Sotterranei & Dragoni (piano Blaze).
// - notificaNuovoIscritto: email all'admin quando qualcuno si registra ed è in
//   attesa di approvazione.
// - inviaNotificaPush: ogni avviso della campanella (users/{uid}/notifiche)
//   parte anche come notifica push verso i dispositivi dell'utente.
// - eliminaUtente: esegue le richieste dell'admin in
//   "richiesteEliminazione/{uid}" (account, profilo, personaggi, ritratti…).
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
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import nodemailer from "nodemailer";
import { CloudBillingClient } from "@google-cloud/billing";
import {
  registraInvio, emailNuovoIscritto, deveBloccare, idProgetto, messaggioPush, pushConsentita, tokenDaRimuovere, MASSIMO_DISPOSITIVI,
  motivoRifiutoEliminazione,
} from "./logica.js";

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
      from: `Portale Sotterranei & Dragoni <${EMAIL_MITTENTE.value()}>`,
      to: EMAIL_ADMIN.value(),
      subject: oggetto,
      text: testo,
    };
    await trasporto.sendMail(messaggio);
    if (IN_EMULATORE) await db.doc("sistema/ultimaEmailEmulatore").set(messaggio);
    logger.info("Notifica di nuovo iscritto inviata.", { uid: evento.params.uid });
  }
);

// I dispositivi si registrano dalla pagina (pannello ⚙️, vedi
// assets/js/notifiche-push.js). Il messaggio è di soli dati: a mostrarlo è il
// service worker del sito (sw.js, evento "push"), con titolo, testo e la
// pagina da aprire al tocco.
export const inviaNotificaPush = onDocumentCreated("users/{uid}/notifiche/{notificaId}", async (evento) => {
  const notifica = evento.data?.data();
  const messaggio = messaggioPush(notifica);
  if (!messaggio) return;
  const { uid, notificaId } = evento.params;
  // "Tocca a te" serve solo come push: non resta nella campanella.
  if (notifica.tipo === "turno") await evento.data.ref.delete().catch(() => {});
  // Preferenze del giocatore (pannello ⚙️ → Notifiche): tipi spenti e "non disturbare".
  const profilo = await db.doc(`users/${uid}`).get();
  const permesso = pushConsentita(notifica.tipo, profilo.get("preferenzeNotifiche"));
  if (!permesso.consentita) {
    logger.info("Notifica push non inviata.", { uid, tipo: notifica.tipo, motivo: permesso.motivo });
    return;
  }
  const dispositivi = (await db.collection(`users/${uid}/dispositivi`).get()).docs
    .filter((d) => typeof d.get("token") === "string" && d.get("token"))
    .sort((a, b) => (b.get("aggiornatoIl")?.toMillis?.() ?? 0) - (a.get("aggiornatoIl")?.toMillis?.() ?? 0))
    .slice(0, MASSIMO_DISPOSITIVI);
  if (dispositivi.length === 0) return;

  const esito = await getMessaging().sendEach(dispositivi.map((d) => ({
    token: d.get("token"),
    data: { ...messaggio, tag: notificaId },
    // Consegna subito anche col telefono a riposo; dopo un giorno non serve più.
    webpush: { headers: { Urgency: "high", TTL: "86400" } },
  })));
  const scaduti = dispositivi.filter((_, i) => tokenDaRimuovere(esito.responses[i]?.error));
  await Promise.all(scaduti.map((d) => d.ref.delete()));
  logger.info("Notifica push inviata.", {
    uid, tipo: evento.data.get("tipo"), inviate: esito.successCount, fallite: esito.failureCount, rimossi: scaduti.length,
  });
});

// L'admin elimina un utente dalla pagina Gestione utenti scrivendo
// "richiesteEliminazione/{uid}" (solo lui può, vedi firestore.rules). Si
// eliminano: account di accesso, profilo con notifiche e dispositivi,
// personaggi con i ritratti, posto tra i membri, nel party e crediti di
// livello delle campagne, combattente nel tracker e pedina sulle mappe. Chi guida una campagna non
// si elimina (la campagna resterebbe senza DM).
// Gli appunti e i tiri scritti in sessione restano, firmati con il nome.
// L'esito torna nella richiesta ("stato": completata | errore).
export const eliminaUtente = onDocumentCreated("richiesteEliminazione/{uid}", async (evento) => {
  const { uid } = evento.params;
  const richiesta = evento.data?.data();
  const riferimento = evento.data.ref;
  const richiedente = richiesta?.richiestaDa ? (await db.doc(`users/${richiesta.richiestaDa}`).get()).data() : null;
  const guidate = await db.collection("campagne").where("dmUid", "==", uid).get();
  const motivo = motivoRifiutoEliminazione(richiesta, uid, richiedente, guidate.docs.map((c) => c.get("titolo")));
  if (motivo) {
    logger.warn("Eliminazione rifiutata.", { uid, motivo });
    await riferimento.update({ stato: "errore", messaggio: motivo });
    return;
  }
  try {
    const personaggi = await db.collection("personaggi").where("proprietarioUid", "==", uid).get();
    await Promise.all(personaggi.docs.map((d) => d.ref.delete()));
    await getStorage().bucket().deleteFiles({ prefix: `ritratti/${uid}/` }).catch((errore) => {
      logger.warn("Ritratti non eliminati.", { uid, errore: errore.message });
    });

    const campagne = await db.collection("campagne").where("membriUid", "array-contains", uid).get();
    await Promise.all(campagne.docs.map(async (c) => {
      const batch = db.batch();
      batch.update(c.ref, { membriUid: FieldValue.arrayRemove(uid) });
      batch.delete(c.ref.collection("party").doc(uid));
      batch.delete(c.ref.collection("livelli").doc(uid));
      // Il suo personaggio esce anche dal tracker e dalle mappe (pedina,
      // righello e ping).
      const combattenti = await c.ref.collection("combattenti").where("uid", "==", uid).get();
      combattenti.docs.forEach((d) => batch.delete(d.ref));
      const mappe = await c.ref.collection("mappe").listDocuments();
      mappe.forEach((m) => {
        batch.delete(m.collection("pedine").doc(uid));
        batch.delete(m.collection("strumenti").doc(uid));
      });
      await batch.commit();
    }));

    await db.recursiveDelete(db.doc(`users/${uid}`));
    await getAuth().deleteUser(uid).catch((errore) => {
      if (errore.code !== "auth/user-not-found") throw errore;
    });
    await riferimento.update({
      stato: "completata",
      completataIl: FieldValue.serverTimestamp(),
      personaggi: personaggi.size,
      campagne: campagne.size,
    });
    logger.info("Utente eliminato.", { uid, personaggi: personaggi.size, campagne: campagne.size });
  } catch (errore) {
    logger.error("Eliminazione non riuscita.", { uid, errore: errore.message });
    await riferimento.update({ stato: "errore", messaggio: "eliminazione non riuscita: riprova" });
  }
});

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
