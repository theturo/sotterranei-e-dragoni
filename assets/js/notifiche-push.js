// Notifiche push: gli avvisi della campanella (users/{uid}/notifiche) arrivano
// anche come notifiche del telefono o del computer, ad app chiusa.
// - Chi le attiva (pannello ⚙️ o invito in dashboard) registra questo browser
//   come "dispositivo": users/{uid}/dispositivi/{id}, con il token di Firebase
//   Cloud Messaging. L'id è casuale e resta in questo browser (localStorage).
// - A inviarle è la Cloud Function inviaNotificaPush; a mostrarle e ad aprire
//   la pagina giusta al tocco è il service worker (sw.js, eventi "push" e
//   "notificationclick").
// - Su iPhone e iPad esistono solo nell'app installata (iOS 16.4 o successivi).
// - Uscendo dall'account il dispositivo si toglie: chi accede dopo sullo stesso
//   telefono non riceve gli avvisi di un altro.
import { app, db } from "./firebase-config.js";
import { doc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { statoInstallazione } from "./pwa.js";

const SDK_MESSAGING = "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";
// Chiave pubblica "Certificati push web" (Console Firebase > Impostazioni
// progetto > Cloud Messaging). Facoltativa: se resta null si usa quella
// predefinita di Firebase.
const CHIAVE_VAPID = null;
const CHIAVE_LOCALE = "sed-notifiche-push";
// Il token si riconferma almeno ogni settimana (Firebase lo considera
// abbandonato dopo un paio di mesi senza aggiornamenti).
const RINNOVO = 7 * 24 * 60 * 60 * 1000;

const suIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function leggiLocale() {
  try {
    return JSON.parse(localStorage.getItem(CHIAVE_LOCALE) || "null");
  } catch {
    return null;
  }
}

function scriviLocale(valore) {
  try {
    if (valore) localStorage.setItem(CHIAVE_LOCALE, JSON.stringify(valore));
    else localStorage.removeItem(CHIAVE_LOCALE);
  } catch {
    // Archivio non disponibile: si riproverà alla prossima apertura.
  }
}

// "attive" | "spente" | "bloccate" (permesso negato nel browser) |
// "serve-installazione" (iPhone fuori dall'app) | "non-supportate".
export function statoNotifichePush(uid) {
  const supportate = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supportate) return suIOS() && !statoInstallazione().installata ? "serve-installazione" : "non-supportate";
  if (Notification.permission === "denied") return "bloccate";
  const locale = leggiLocale();
  return Notification.permission === "granted" && locale?.uid === uid ? "attive" : "spente";
}

async function messaggistica() {
  const { getMessaging, getToken, deleteToken, isSupported } = await import(SDK_MESSAGING);
  if (!(await isSupported())) throw new Error("Notifiche push non supportate da questo browser.");
  return { messaging: getMessaging(app), getToken, deleteToken };
}

function nomePiattaforma() {
  const ua = navigator.userAgent;
  const sistema = /android/i.test(ua) ? "Android" : suIOS() ? "iPhone/iPad" : /windows/i.test(ua) ? "Windows"
    : /mac os/i.test(ua) ? "Mac" : /linux/i.test(ua) ? "Linux" : "Altro";
  return `${sistema}${statoInstallazione().installata ? " (app)" : " (browser)"}`;
}

async function salvaToken(uid, forza = false) {
  const { messaging, getToken, deleteToken } = await messaggistica();
  const registrazione = await navigator.serviceWorker.ready;
  // Il token è del browser, non dell'account: se prima le aveva attivate un
  // altro utente (senza uscire), se ne chiede uno nuovo. Quello vecchio non
  // vale più e la Cloud Function toglierà il suo dispositivo.
  const precedente = leggiLocale();
  if (precedente && precedente.uid !== uid) {
    scriviLocale(null);
    await deleteToken(messaging).catch(() => {});
  }
  const token = await getToken(messaging, {
    serviceWorkerRegistration: registrazione,
    ...(CHIAVE_VAPID ? { vapidKey: CHIAVE_VAPID } : {}),
  });
  if (!token) throw new Error("Token non ottenuto.");
  const locale = leggiLocale();
  const id = locale?.uid === uid && locale.id ? locale.id : crypto.randomUUID();
  if (forza || locale?.token !== token || locale?.id !== id || Date.now() - (locale?.salvatoIl || 0) > RINNOVO) {
    await setDoc(doc(db, "users", uid, "dispositivi", id), {
      token,
      piattaforma: nomePiattaforma(),
      aggiornatoIl: serverTimestamp(),
    });
    scriviLocale({ uid, id, token, salvatoIl: Date.now() });
  }
}

// Va chiamata direttamente dal tocco su un pulsante: i browser chiedono il
// permesso solo in risposta a un gesto dell'utente.
export async function attivaNotifichePush(uid) {
  const permesso = await Notification.requestPermission();
  if (permesso !== "granted") return statoNotifichePush(uid);
  await salvaToken(uid, true);
  return "attive";
}

export async function disattivaNotifichePush(uid) {
  const locale = leggiLocale();
  scriviLocale(null);
  if (!locale) return;
  await Promise.allSettled([
    locale.uid === uid ? deleteDoc(doc(db, "users", uid, "dispositivi", locale.id)) : Promise.resolve(),
    messaggistica().then(({ messaging, deleteToken }) => deleteToken(messaging)),
  ]);
}

// A ogni apertura del sito: se le notifiche sono attive per questo utente si
// riconferma il token (cambia ogni tanto, e il permesso può essere stato tolto
// dalle impostazioni del telefono). Mai bloccante.
export async function riconfermaNotifichePush(uid) {
  const locale = leggiLocale();
  if (!locale || locale.uid !== uid) return;
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      await disattivaNotifichePush(uid);
      return;
    }
    await salvaToken(uid);
  } catch (errore) {
    console.warn("Notifiche push non riconfermate", errore);
  }
}
