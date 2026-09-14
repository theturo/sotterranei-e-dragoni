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

// ID della chiave reCAPTCHA Enterprise collegata a QUESTO progetto Firebase/Google
// Cloud (per Firebase App Check, la protezione anti-bot sulle registrazioni).
// Importante: la chiave va creata nel progetto Google Cloud "sotterranei-e-dragoni"
// (lo stesso di Firebase), non in un progetto separato — vedi il file di setup privato.
// Finché resta il placeholder, App Check resta semplicemente disattivato (nessun
// errore, nessun danno).
const RECAPTCHA_ENTERPRISE_KEY_ID = "6Lf9trstAAAAABB6N2k1bHisVpkXja_Y2csy9iwE";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app-check.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const appCheckConfigurato = !RECAPTCHA_ENTERPRISE_KEY_ID.startsWith("INSERISCI_");

if (appCheckConfigurato) {
  // Su localhost reCAPTCHA non funziona: Firebase genera invece un "debug token"
  // (visibile nella console del browser) da registrare in Console Firebase >
  // App Check > Gestisci i token di debug, solo per lo sviluppo in locale.
  if (["localhost", "127.0.0.1"].includes(location.hostname)) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_KEY_ID),
    isTokenAutoRefreshEnabled: true,
  });
}
