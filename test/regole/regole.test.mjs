// Test delle regole di sicurezza Firestore (firestore.rules) sull'emulatore.
// Ogni test prova un'operazione reale contro il database, con l'identità di un
// certo utente, e verifica che le regole la permettano o la neghino.
// Avvio: vedi test/regole/README.md.
import { before, after, beforeEach, describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where,
  documentId, serverTimestamp, increment, writeBatch, getCountFromServer,
} from "firebase/firestore";

const REGOLE = readFileSync(fileURLToPath(new URL("../../firestore.rules", import.meta.url)), "utf8");
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-sotterranei",
    firestore: { rules: REGOLE, host: "127.0.0.1", port: 8080 },
  });
});
after(() => env.cleanup());

// Dati di partenza: admin, DM, due giocatori approvati (p1 con un credito di
// livello), un profilo "vecchio" senza campo approvato, un iscritto in attesa.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    const set = (percorso, dati) => setDoc(doc(d, percorso), dati);
    await set("users/admin", { nome: "Admin", email: "admin@x.it", ruolo: "admin" });
    await set("users/dm", { nome: "Master", email: "dm@x.it", ruolo: "dm", approvato: true });
    await set("users/p1", { nome: "Pia", email: "p1@x.it", ruolo: "player", livello: 2, livelliDaSpendere: 1, approvato: true });
    await set("users/p2", { nome: "Leo", email: "p2@x.it", ruolo: "player", livello: 1, livelliDaSpendere: 0, approvato: true });
    await set("users/vecchio", { nome: "Vecchio", email: "v@x.it", ruolo: "player", livello: 1, livelliDaSpendere: 0 });
    await set("users/attesa", { nome: "Nuovo", email: "n@x.it", ruolo: "player", livello: 1, livelliDaSpendere: 0, approvato: false });
    await set("campagne/c1", { titolo: null, titoloProvvisorio: true, dmUid: "dm", membriUid: ["p1", "p2"], stato: "attiva" });
    await set("campagne/c1/privato/titolo", { titolo: "La Tomba degli Orrori" });
    await set("campagne/c1/stato/sessione", { inCorso: true, sessioneAttivaId: "r1" });
    await set("personaggi/s1", {
      proprietarioUid: "p1", campagnaId: "c1", attiva: true, nome: "Eroe", classe: "guerriero", livello: 1,
      hp: { massimi: 12, attuali: 12, temporanei: 0 },
    });
    await set("personaggi/s2", { proprietarioUid: "p2", campagnaId: "c1", attiva: true, nome: "Maga", classe: "mago", livello: 1 });
    await set("personaggi/vecchia", { proprietarioUid: "p2", nome: "Senza campagna", livello: 1 });
    await set("registroSessioni/r1", { campagnaId: "c1", numero: 1, stato: "in-corso" });
    await set("registroSessioni/r0", { campagnaId: "c1", numero: 0, stato: "chiusa" });
    await set("registroSessioni/r2", { campagnaId: "c1", numero: 2, stato: "programmata" });
    await set("registroSessioni/r1/appunti/a1", { autoreUid: "p1", autoreNome: "Pia", testo: "Ciao" });
  });
});

const come = (uid, emailVerificata = true, email = `${uid}@x.it`) =>
  env.authenticatedContext(uid, { email_verified: emailVerificata, email }).firestore();

describe("Registrazione e profili", () => {
  const profiloNuovo = (extra = {}) => ({
    nome: "Estraneo", email: "e@x.it", ruolo: "player", livello: 1, livelliDaSpendere: 0,
    emailVerificata: false, approvato: false, creatoIl: serverTimestamp(), ...extra,
  });

  test("ci si registra come giocatore in attesa di approvazione", () =>
    assertSucceeds(setDoc(doc(come("e", false, "e@x.it"), "users/e"), profiloNuovo())));
  test("NON ci si registra come admin", () =>
    assertFails(setDoc(doc(come("e", false, "e@x.it"), "users/e"), profiloNuovo({ ruolo: "admin" }))));
  test("NON ci si registra già approvati", () =>
    assertFails(setDoc(doc(come("e", false, "e@x.it"), "users/e"), profiloNuovo({ approvato: true }))));
  test("NON ci si registra con livelli o crediti", () =>
    assertFails(setDoc(doc(come("e", false, "e@x.it"), "users/e"), profiloNuovo({ livelliDaSpendere: 5 }))));
  test("NON ci si registra con campi extra", () =>
    assertFails(setDoc(doc(come("e", false, "e@x.it"), "users/e"), profiloNuovo({ extra: 1 }))));

  test("un giocatore NON si auto-approva", () =>
    assertFails(updateDoc(doc(come("attesa"), "users/attesa"), { approvato: true })));
  test("un giocatore NON si auto-promuove", () =>
    assertFails(updateDoc(doc(come("p2"), "users/p2"), { ruolo: "dm" })));
  test("un giocatore NON si regala crediti di livello", () =>
    assertFails(updateDoc(doc(come("p2"), "users/p2"), { livelliDaSpendere: 99 })));
  test("un giocatore NON cambia il proprio nome (usato come firma degli appunti)", () =>
    assertFails(updateDoc(doc(come("p2"), "users/p2"), { nome: "Master" })));
  test("un giocatore salva l'ordine dei propri pannelli", () =>
    assertSucceeds(updateDoc(doc(come("p2"), "users/p2"), { "ordinePannelli.player": ["a", "b"] })));
  test("l'admin approva un iscritto", () =>
    assertSucceeds(updateDoc(doc(come("admin"), "users/attesa"), { approvato: true })));
  test("il DM segnala un passaggio di livello (+1)", () =>
    assertSucceeds(updateDoc(doc(come("dm"), "users/p2"), { livello: increment(1), livelliDaSpendere: increment(1) })));
  test("il DM NON regala più livelli in un colpo", () =>
    assertFails(updateDoc(doc(come("dm"), "users/p2"), { livello: 5, livelliDaSpendere: 4 })));

  test("un giocatore NON legge il profilo (e l'email) di un altro", () =>
    assertFails(getDoc(doc(come("p1"), "users/p2"))));
  test("un giocatore NON elenca i giocatori", () =>
    assertFails(getDocs(query(collection(come("p1"), "users"), where("ruolo", "==", "player")))));
  test("l'admin conta gli iscritti in attesa", () =>
    assertSucceeds(getCountFromServer(query(collection(come("admin"), "users"), where("approvato", "==", false)))));
  test("un giocatore NON conta gli iscritti in attesa", () =>
    assertFails(getCountFromServer(query(collection(come("p1"), "users"), where("approvato", "==", false)))));
  test("il DM elenca i membri della campagna", () =>
    assertSucceeds(getDocs(query(collection(come("dm"), "users"), where(documentId(), "in", ["p1", "p2"])))));
});

describe("Accesso di chi non è approvato", () => {
  test("un iscritto in attesa legge il proprio profilo", () =>
    assertSucceeds(getDoc(doc(come("attesa"), "users/attesa"))));
  test("un iscritto in attesa NON legge il registro sessioni", () =>
    assertFails(getDocs(collection(come("attesa"), "registroSessioni"))));
  test("un iscritto in attesa NON scrive appunti", () =>
    assertFails(addDoc(collection(come("attesa"), "registroSessioni/r1/appunti"), {
      autoreUid: "attesa", autoreNome: "Nuovo", testo: "spam", creatoIl: serverTimestamp(),
    })));
  test("un giocatore con email non verificata NON legge nulla", () =>
    assertFails(getDoc(doc(come("p1", false), "personaggi/s1"))));
  test("un profilo creato prima dell'approvazione resta valido", () =>
    assertSucceeds(getDocs(collection(come("vecchio"), "registroSessioni"))));
});

describe("Schede personaggio", () => {
  test("il proprietario legge la propria scheda", () => assertSucceeds(getDoc(doc(come("p1"), "personaggi/s1"))));
  test("un altro giocatore NON legge la scheda completa", () => assertFails(getDoc(doc(come("p2"), "personaggi/s1"))));
  test("il DM legge la scheda", () => assertSucceeds(getDoc(doc(come("dm"), "personaggi/s1"))));

  test("si crea una scheda a livello 1 nella propria campagna", () =>
    assertSucceeds(addDoc(collection(come("p1"), "personaggi"), { proprietarioUid: "p1", campagnaId: "c1", livello: 1 })));
  test("NON si crea una scheda già di livello alto", () =>
    assertFails(addDoc(collection(come("p1"), "personaggi"), { proprietarioUid: "p1", campagnaId: "c1", livello: 10 })));
  test("NON si crea una scheda a nome di altri", () =>
    assertFails(addDoc(collection(come("p1"), "personaggi"), { proprietarioUid: "p2", campagnaId: "c1", livello: 1 })));
  test("chi è in attesa NON crea schede", () =>
    assertFails(addDoc(collection(come("attesa"), "personaggi"), { proprietarioUid: "attesa", campagnaId: "c1", livello: 1 })));

  test("NON si cede la scheda a un altro", () =>
    assertFails(updateDoc(doc(come("p1"), "personaggi/s1"), { proprietarioUid: "p2" })));
  test("NON si sposta la scheda in un'altra campagna", () =>
    assertFails(updateDoc(doc(come("p1"), "personaggi/s1"), { campagnaId: "c2" })));
  test("si modificano i PF", () =>
    assertSucceeds(updateDoc(doc(come("p1"), "personaggi/s1"), { "hp.attuali": 5 })));
  test("NON si alza il livello senza spendere un credito", () =>
    assertFails(updateDoc(doc(come("p1"), "personaggi/s1"), { livello: 2 })));
  test("si sale di livello spendendo un credito nella stessa scrittura", () => {
    const d = come("p1");
    const batch = writeBatch(d);
    batch.update(doc(d, "personaggi/s1"), { livello: 2 });
    batch.update(doc(d, "users/p1"), { livelliDaSpendere: increment(-1) });
    return assertSucceeds(batch.commit());
  });
  test("NON si sale di 2 livelli con un credito solo", () => {
    const d = come("p1");
    const batch = writeBatch(d);
    batch.update(doc(d, "personaggi/s1"), { livello: 3 });
    batch.update(doc(d, "users/p1"), { livelliDaSpendere: increment(-1) });
    return assertFails(batch.commit());
  });
  test("NON si spende un credito che non si ha", () => {
    const d = come("p2");
    const batch = writeBatch(d);
    batch.update(doc(d, "personaggi/s2"), { livello: 2 });
    batch.update(doc(d, "users/p2"), { livelliDaSpendere: increment(-1) });
    return assertFails(batch.commit());
  });

  test("si crea una scheda completa come quella del sito", () =>
    assertSucceeds(addDoc(collection(come("p1"), "personaggi"), {
      proprietarioUid: "p1", campagnaId: "c1", livello: 1, nome: "Nuovo", razza: "umano", sottorazza: null, classe: "mago",
      caratteristiche: { forza: 8, destrezza: 14, costituzione: 12, intelligenza: 15, saggezza: 10, carisma: 13 },
      hp: { massimi: 7, attuali: 7, temporanei: 0 },
      tiriSalvezzaMorte: { successi: [false, false, false], fallimenti: [false, false, false] },
      attiva: false, ordine: 1, creataIl: serverTimestamp(), aggiornatoIl: serverTimestamp(),
    })));
  test("NON si crea una scheda con campi arbitrari", () =>
    assertFails(addDoc(collection(come("p1"), "personaggi"), { proprietarioUid: "p1", campagnaId: "c1", livello: 1, spazzatura: "x" })));
  test("si salvano personalità, talenti e monete", () =>
    assertSucceeds(updateDoc(doc(come("p1"), "personaggi/s1"), {
      personalita: { tratti: "Coraggiosa", ideali: "Giustizia" }, talenti: ["Allerta"],
      monete: { rame: 1, argento: 2, elettro: 0, oro: 3, platino: 0 }, background: "Soldato",
    })));
  test("NON si salva un campo sconosciuto", () =>
    assertFails(updateDoc(doc(come("p1"), "personaggi/s1"), { campoInventato: "x".repeat(1000) })));
  test("NON si salva un testo di personalità enorme", () =>
    assertFails(updateDoc(doc(come("p1"), "personaggi/s1"), { personalita: { tratti: "x".repeat(2001) } })));
  test("NON si salva un nome del personaggio troppo lungo", () =>
    assertFails(updateDoc(doc(come("p1"), "personaggi/s1"), { nome: "x".repeat(61) })));
  test("NON si salvano migliaia di talenti", () =>
    assertFails(updateDoc(doc(come("p1"), "personaggi/s1"), { talenti: Array(101).fill("x") })));
  test("NON si cambia tipo a un campo (PF come testo)", () =>
    assertFails(updateDoc(doc(come("p1"), "personaggi/s1"), { hp: "tanti" })));
  test("il DM assegna la campagna a una scheda che non ne ha (migrazione)", () =>
    assertSucceeds(updateDoc(doc(come("dm"), "personaggi/vecchia"), { campagnaId: "c1" })));
  test("il DM NON modifica altro nelle schede", () =>
    assertFails(updateDoc(doc(come("dm"), "personaggi/s1"), { livello: 20 })));
});

describe("Campagne e titolo provvisorio", () => {
  test("un membro legge la campagna", () => assertSucceeds(getDoc(doc(come("p1"), "campagne/c1"))));
  test("chi non è membro NON legge la campagna", () => assertFails(getDoc(doc(come("vecchio"), "campagne/c1"))));
  test("un membro NON legge il titolo vero (provvisorio)", () =>
    assertFails(getDoc(doc(come("p1"), "campagne/c1/privato/titolo"))));
  test("il DM legge il titolo vero", () => assertSucceeds(getDoc(doc(come("dm"), "campagne/c1/privato/titolo"))));
  test("NON si pubblica un titolo mentre è provvisorio", () =>
    assertFails(updateDoc(doc(come("dm"), "campagne/c1"), { titolo: "La Tomba degli Orrori" })));
  test("il reveal pubblica il titolo", () =>
    assertSucceeds(updateDoc(doc(come("dm"), "campagne/c1"), { titolo: "La Tomba degli Orrori", titoloProvvisorio: false })));
  test("il DM NON cede la campagna a un altro", () =>
    assertFails(updateDoc(doc(come("dm"), "campagne/c1"), { dmUid: "p1" })));
  test("il DM crea una campagna con titolo privato in un'unica scrittura", () => {
    const d = come("dm");
    const batch = writeBatch(d);
    batch.set(doc(d, "campagne/c9"), { titolo: null, titoloProvvisorio: true, dmUid: "dm", membriUid: [], stato: "pianificazione" });
    batch.set(doc(d, "campagne/c9/privato/titolo"), { titolo: "Segreto" });
    return assertSucceeds(batch.commit());
  });
  test("un giocatore NON crea campagne", () =>
    assertFails(setDoc(doc(come("p1"), "campagne/c9"), { titolo: "x", dmUid: "p1", membriUid: [] })));
});

describe("Riepilogo del party", () => {
  const riepilogoS1 = (extra = {}) => ({
    nomeGiocatore: "Pia", schedaId: "s1", nomePersonaggio: "Eroe", classe: "guerriero", livello: 1,
    hp: { massimi: 12, attuali: 12, temporanei: 0 }, aggiornatoIl: serverTimestamp(), ...extra,
  });

  test("un membro pubblica il riepilogo della propria scheda attiva", () =>
    assertSucceeds(setDoc(doc(come("p1"), "campagne/c1/party/p1"), riepilogoS1())));
  test("NON si pubblica un riepilogo falso (livello)", () =>
    assertFails(setDoc(doc(come("p1"), "campagne/c1/party/p1"), riepilogoS1({ livello: 20 }))));
  test("NON si pubblica un riepilogo con un nome giocatore falso", () =>
    assertFails(setDoc(doc(come("p1"), "campagne/c1/party/p1"), riepilogoS1({ nomeGiocatore: "Master" }))));
  test("NON si pubblica il riepilogo di un altro", () =>
    assertFails(setDoc(doc(come("p2"), "campagne/c1/party/p1"), riepilogoS1())));
  test("il DM rigenera il riepilogo di un membro", () =>
    assertSucceeds(setDoc(doc(come("dm"), "campagne/c1/party/p1"), riepilogoS1())));
  test("un membro senza scheda attiva pubblica un riepilogo vuoto", () =>
    assertSucceeds(setDoc(doc(come("p2"), "campagne/c1/party/p2"), {
      nomeGiocatore: "Leo", schedaId: null, nomePersonaggio: null, classe: null, livello: null, hp: null,
      aggiornatoIl: serverTimestamp(),
    })));
  test("un membro legge il party", () => assertSucceeds(getDocs(collection(come("p2"), "campagne/c1/party"))));
  test("chi non è membro NON legge il party", () =>
    assertFails(getDocs(collection(come("vecchio"), "campagne/c1/party"))));
});

describe("Registro sessioni e appunti", () => {
  const appunto = (extra = {}) => ({ autoreUid: "p2", autoreNome: "Leo", testo: "Nota", creatoIl: serverTimestamp(), ...extra });

  test("un giocatore scrive un appunto a proprio nome", () =>
    assertSucceeds(addDoc(collection(come("p2"), "registroSessioni/r1/appunti"), appunto())));
  test("NON si firma un appunto col nome di un altro", () =>
    assertFails(addDoc(collection(come("p2"), "registroSessioni/r1/appunti"), appunto({ autoreNome: "Master" }))));
  test("NON si scrive un appunto oltre i 2000 caratteri", () =>
    assertFails(addDoc(collection(come("p2"), "registroSessioni/r1/appunti"), appunto({ testo: "x".repeat(2001) }))));
  test("NON si scrive un appunto in una sessione chiusa", () =>
    assertFails(addDoc(collection(come("p2"), "registroSessioni/r0/appunti"), appunto())));
  test("NON si modifica un appunto", () =>
    assertFails(updateDoc(doc(come("p1"), "registroSessioni/r1/appunti/a1"), { testo: "altro" })));
  test("un giocatore NON cancella appunti", () =>
    assertFails(deleteDoc(doc(come("p1"), "registroSessioni/r1/appunti/a1"))));
  test("il DM cancella un appunto (moderazione)", () =>
    assertSucceeds(deleteDoc(doc(come("dm"), "registroSessioni/r1/appunti/a1"))));
  test("il DM annulla una sessione programmata", () =>
    assertSucceeds(deleteDoc(doc(come("dm"), "registroSessioni/r2"))));
  test("il DM NON cancella una sessione chiusa", () =>
    assertFails(deleteDoc(doc(come("dm"), "registroSessioni/r0"))));
  test("un giocatore NON crea sessioni", () =>
    assertFails(addDoc(collection(come("p1"), "registroSessioni"), { campagnaId: "c1", numero: 9, stato: "in-corso" })));
});

describe("Stato condiviso della campagna", () => {
  test("un membro legge lo stato della sessione", () =>
    assertSucceeds(getDoc(doc(come("p1"), "campagne/c1/stato/sessione"))));
  test("un giocatore NON apre la sessione", () =>
    assertFails(setDoc(doc(come("p1"), "campagne/c1/stato/sessione"), { inCorso: false })));
  test("il DM cambia la musica", () =>
    assertSucceeds(setDoc(doc(come("dm"), "campagne/c1/stato/musica"), { sorgente: "youtube" })));
});
