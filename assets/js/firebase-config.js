// Configurazione Firebase — sostituisci i valori qui sotto con quelli del TUO progetto.
// Li trovi in: Console Firebase > Impostazioni progetto > Le tue app > Configurazione SDK.
// Questi valori NON sono segreti (fanno parte del client pubblico): la sicurezza reale
// è garantita dalle regole di Firestore (vedi firestore.rules), non dal nasconderli.
const firebaseConfig = {
  apiKey: "AIzaSyATPgRfgMb3gkHRryDp-kwsy2L_wZu-tXg",
  authDomain: "sotterranei-e-dragoni.firebaseapp.com",
  projectId: "sotterranei-e-dragoni",
  storageBucket: "sotterranei-e-dragoni.firebasestorage.app",
  messagingSenderId: "473990205377",
  appId: "1:473990205377:web:24438c015fdb55e1416940"
};

// Email che, alla registrazione, ricevono automaticamente il ruolo "admin".
// Aggiungi qui la tua email prima di registrarti la prima volta.
export const ADMIN_EMAILS = ["theturo93@gmail.com"
  // "tuonome@esempio.com"
];

// Chiave del sito reCAPTCHA v3 collegata a questo progetto (per Firebase App Check,
// la protezione anti-bot sulle registrazioni). La trovi in:
// Console Firebase > App Check > Le tue app > app Web > reCAPTCHA v3.
// Finché resta il placeholder, App Check resta semplicemente disattivato (nessun
// errore, nessun danno) — vedi il file di setup privato per la procedura completa.
const RECAPTCHA_SITE_KEY = "INSERISCI_RECAPTCHA_SITE_KEY";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app-check.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const appCheckConfigurato = !RECAPTCHA_SITE_KEY.startsWith("INSERISCI_");

if (appCheckConfigurato) {
  // Su localhost reCAPTCHA v3 non funziona: Firebase genera invece un "debug token"
  // (visibile nella console del browser) da registrare in Console Firebase >
  // App Check > Gestisci i token di debug, solo per lo sviluppo in locale.
  if (["localhost", "127.0.0.1"].includes(location.hostname)) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}
