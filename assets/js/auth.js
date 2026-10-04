// Accesso, registrazione, ruoli e protezione delle pagine. I dati del sito
// (campagne, schede, sessioni...) sono nei moduli di assets/js/dati/.
import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  verifyBeforeUpdateEmail,
  reload,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { setDoc, doc, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { ottieniProfiloUtente } from "./dati/utenti.js";

export const ROLES = {
  ADMIN: "admin",
  DM: "dm",
  PLAYER: "player",
};

// Etichette leggibili dei ruoli, condivise da dashboard, header e pannelli admin/DM.
export const ETICHETTE_RUOLO = {
  [ROLES.ADMIN]: "Admin",
  [ROLES.DM]: "Dungeon Master",
  [ROLES.PLAYER]: "Giocatore",
};

// Traduce i codici di errore Firebase in messaggi comprensibili in italiano.
export function traduciErrore(codice) {
  const mappa = {
    "auth/email-already-in-use": "Questa email è già registrata. Prova ad accedere.",
    "auth/invalid-email": "L'indirizzo email non è valido.",
    "auth/weak-password": "La password deve avere almeno 6 caratteri.",
    "auth/user-not-found": "Nessun account trovato con questa email.",
    "auth/wrong-password": "Password errata.",
    "auth/invalid-credential": "Email o password non corretti.",
    "auth/too-many-requests": "Troppi tentativi falliti. Riprova più tardi.",
    "auth/missing-password": "Inserisci una password.",
    "auth/requires-recent-login": "Per sicurezza, effettua di nuovo l'accesso e riprova.",
  };
  return mappa[codice] || "Si è verificato un errore. Riprova.";
}

// Crea un nuovo account e il relativo documento utente in Firestore. Chiunque si
// registri nasce "player" in attesa di approvazione: il ruolo admin/DM e
// l'approvazione li assegna solo un admin (le regole di sicurezza rifiutano
// qualsiasi altro valore, anche se qualcuno scrivesse al database a mano).
export async function registraUtente({ nome, email, password }) {
  const credenziali = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credenziali.user, { displayName: nome });
  await sendEmailVerification(credenziali.user);

  await setDoc(doc(db, "users", credenziali.user.uid), {
    nome,
    // L'email normalizzata da Firebase Authentication, che le regole
    // confrontano con quella del token.
    email: credenziali.user.email,
    ruolo: ROLES.PLAYER,
    livello: 1,
    livelliDaSpendere: 0,
    emailVerificata: false,
    approvato: false,
    creatoIl: serverTimestamp(),
  });

  return { uid: credenziali.user.uid, ruolo: ROLES.PLAYER };
}

// Un profilo è approvato se l'admin l'ha approvato, oppure se è stato creato
// prima che esistesse l'approvazione (nessun campo "approvato").
export function profiloApprovato(profilo) {
  return profilo?.approvato !== false;
}

export async function accediUtente({ email, password }) {
  const credenziali = await signInWithEmailAndPassword(auth, email, password);
  return credenziali.user;
}

export async function esciUtente() {
  await signOut(auth);
}

// Invia l'email di reset password all'indirizzo indicato. Firebase Authentication
// stesso decide se l'indirizzo corrisponde a un account esistente: qui non serve (né
// è possibile, prima del login) verificarlo a mano contro Firestore.
export async function inviaResetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

// Ri-autentica l'utente corrente con la password attuale: richiesto da Firebase
// prima di operazioni sensibili come cambio password o email (auth/requires-recent-login).
async function riautenticaUtente(passwordAttuale) {
  const credenziale = EmailAuthProvider.credential(auth.currentUser.email, passwordAttuale);
  await reauthenticateWithCredential(auth.currentUser, credenziale);
}

// Cambia la password dell'utente corrente, dopo essersi ri-autenticato con quella attuale.
export async function cambiaPassword(passwordAttuale, nuovaPassword) {
  await riautenticaUtente(passwordAttuale);
  await updatePassword(auth.currentUser, nuovaPassword);
}

// Invia un'email di conferma alla NUOVA casella: l'indirizzo su Firebase Authentication
// cambia solo dopo che l'utente clicca il link, non subito.
export async function cambiaEmail(passwordAttuale, nuovaEmail) {
  await riautenticaUtente(passwordAttuale);
  await verifyBeforeUpdateEmail(auth.currentUser, nuovaEmail);
}

// Invia (o re-invia) l'email di verifica all'utente indicato.
export async function inviaEmailVerifica(user) {
  await sendEmailVerification(user);
}

// Ricarica i dati dell'utente da Firebase Auth (serve per rileggere emailVerified
// dopo che l'utente ha cliccato il link di verifica in un'altra scheda).
export async function ricaricaUtente(user) {
  await reload(user);
}

// Blocca l'accesso a una pagina finché non si conosce lo stato di autenticazione,
// poi esegue la callback con (user, profilo). Se non autenticato, reindirizza al
// login; se autenticato ma con email non verificata, reindirizza alla pagina di
// verifica (usata da tutte le pagine "vere" dell'app, non da verifica-email.html).
export function proteggiPagina(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    if (!user.emailVerified) {
      window.location.href = "verifica-email.html";
      return;
    }
    // Le regole di sicurezza leggono "email_verified" dal token di accesso, che
    // Firebase aggiorna da solo solo ogni ora: se l'email è stata appena
    // verificata, forziamo subito un token nuovo.
    const token = await user.getIdTokenResult();
    if (token.claims.email_verified !== true) await user.getIdToken(true);

    const profilo = await ottieniProfiloUtente(user.uid);
    // A questo punto sappiamo per certo che l'email è verificata: se il documento
    // Firestore non lo riflette ancora (account creato prima di questa funzione,
    // o verificato in un'altra scheda), lo allineiamo. Non blocca il rendering.
    const allineamenti = [];
    if (profilo && profilo.emailVerificata !== true) {
      profilo.emailVerificata = true;
      allineamenti.push(
        updateDoc(doc(db, "users", user.uid), { emailVerificata: true }).catch((errore) => console.error(errore))
      );
    }
    // Se l'utente ha completato un cambio email (verifyBeforeUpdateEmail), l'indirizzo
    // su Authentication è già aggiornato: allineiamo la copia su Firestore.
    if (profilo && user.email && profilo.email !== user.email) {
      profilo.email = user.email;
      allineamenti.push(
        updateDoc(doc(db, "users", user.uid), { email: user.email }).catch((errore) => console.error(errore))
      );
    }
    // Iscritto non ancora approvato dall'admin: resta nella pagina di attesa
    // (dopo aver completato gli allineamenti, così l'admin vede l'email come
    // verificata prima di approvarlo).
    if (!profiloApprovato(profilo)) {
      await Promise.all(allineamenti);
      window.location.href = "attesa-approvazione.html";
      return;
    }
    callback(user, profilo);
  });
}

// Come proteggiPagina, ma SENZA richiedere l'email verificata: usata solo dalla
// pagina di verifica stessa, che deve restare accessibile a chi non l'ha ancora fatto.
export function proteggiPaginaSenzaVerifica(callback) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    callback(user);
  });
}

// Come proteggiPagina, ma riservata alle sole pagine admin: chi non ha
// ruolo "admin" viene rimandato alla dashboard.
export function proteggiPaginaAdmin(callback) {
  proteggiPagina((user, profilo) => {
    if (profilo?.ruolo !== ROLES.ADMIN) {
      window.location.href = "dashboard.html";
      return;
    }
    callback(user, profilo);
  });
}

// Come proteggiPagina, ma riservata alle pagine del Dungeon Master
// (accessibile anche all'admin). Chi non ha questi ruoli viene rimandato alla dashboard.
export function proteggiPaginaDM(callback) {
  proteggiPagina((user, profilo) => {
    if (profilo?.ruolo !== ROLES.DM && profilo?.ruolo !== ROLES.ADMIN) {
      window.location.href = "dashboard.html";
      return;
    }
    callback(user, profilo);
  });
}
