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

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
