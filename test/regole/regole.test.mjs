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
    // Contenuti: nascosto, mostrato ora a tutti, nell'archivio solo di p1.
    const contenuto = (mostrataA = [], archiviataPer = []) => ({
      titolo: "Mappa", descrizione: null, categoria: "mappa", larghezza: 800, altezza: 600,
      mostrataA, vistaDa: mostrataA, archiviataPer, visibileA: [...new Set([...mostrataA, ...archiviataPer])], sessioniMostrata: [],
    });
    await set("campagne/c1/immagini/nascosta", contenuto());
    await set("campagne/c1/immagini/pubblica", contenuto(["p1", "p2"]));
    await set("campagne/c1/immagini/soloP1", contenuto([], ["p1"]));
    await set("campagne/c1/immaginiDM/nascosta", { note: "È il traditore", tag: ["spoiler"], archivio: true, sessioniCollegate: ["r1"] });
    await set("campagne/c1/stato/sessione", { inCorso: true, sessioneAttivaId: "r1" });
    await set("campagne/c1/combattimento/stato", { attivo: true, round: 1, turno: "pgP1" });
    await set("campagne/c1/combattenti/pgP1", { tipo: "pg", nome: "Eroe", uid: "p1", iniziativa: null, bonus: 0, spareggio: 0 });
    await set("campagne/c1/combattenti/pgP2", { tipo: "pg", nome: "Lyra", uid: "p2", iniziativa: 12, bonus: 2, spareggio: 0 });
    await set("campagne/c1/combattenti/goblin1", { tipo: "nemico", nome: "Goblin 1", uid: null, iniziativa: 14, bonus: 2, spareggio: 0, salute: "illeso", immagineId: null });
    await set("campagne/c1/combattentiDM/goblin1", { pfAttuali: 7, pfMassimi: 7, note: null });
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

describe("Ritratti", () => {
  test("il proprietario imposta la versione del ritratto", () =>
    assertSucceeds(updateDoc(doc(come("p1"), "personaggi/s1"), { ritratto: 1790000000000 })));
  test("il proprietario toglie il ritratto", () =>
    assertSucceeds(updateDoc(doc(come("p1"), "personaggi/s1"), { ritratto: null })));
  test("NON si salva un ritratto che non è una versione numerica", () =>
    assertFails(updateDoc(doc(come("p1"), "personaggi/s1"), { ritratto: "https://evil.example/x.png" })));
  test("il riepilogo porta la stessa versione del ritratto della scheda", async () => {
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), "personaggi/s1"), { ritratto: 42 }));
    const base = {
      nomeGiocatore: "Pia", schedaId: "s1", nomePersonaggio: "Eroe", classe: "guerriero", livello: 1,
      hp: { massimi: 12, attuali: 12, temporanei: 0 }, aggiornatoIl: serverTimestamp(),
    };
    await assertFails(setDoc(doc(come("p1"), "campagne/c1/party/p1"), { ...base, ritratto: 43 }));
    await assertSucceeds(setDoc(doc(come("p1"), "campagne/c1/party/p1"), { ...base, ritratto: 42 }));
  });
});

describe("Libreria dei contenuti", () => {
  const nuovo = (extra = {}) => ({
    titolo: "Taverna", descrizione: null, categoria: "luogo", larghezza: 1920, altezza: 1080, caricataIl: serverTimestamp(),
    mostrataA: [], vistaDa: [], archiviataPer: [], visibileA: [], sessioniMostrata: [], ...extra,
  });
  const riservati = (extra = {}) => ({ note: null, tag: [], archivio: false, sessioniCollegate: [], ...extra });
  test("il DM carica un nuovo contenuto", () =>
    assertSucceeds(setDoc(doc(come("dm"), "campagne/c1/immagini/nuova"), nuovo())));
  test("la categoria Nemico è ammessa", () =>
    assertSucceeds(setDoc(doc(come("dm"), "campagne/c1/immagini/nuova"), nuovo({ categoria: "nemico" }))));
  test("un giocatore NON crea contenuti", () =>
    assertFails(setDoc(doc(come("p1"), "campagne/c1/immagini/nuova"), nuovo())));
  test("NON si salva una categoria inventata", () =>
    assertFails(setDoc(doc(come("dm"), "campagne/c1/immagini/nuova"), nuovo({ categoria: "tesoro" }))));
  test("NON si salvano campi extra", () =>
    assertFails(setDoc(doc(come("dm"), "campagne/c1/immagini/nuova"), nuovo({ url: "https://x" }))));
  test("NON si salvano note o tag nel documento leggibile dai giocatori", () =>
    assertFails(setDoc(doc(come("dm"), "campagne/c1/immagini/nuova"), nuovo({ note: "segreto" }))));
  test("'visibileA' deve essere l'unione di mostrati e archivio", () =>
    assertFails(setDoc(doc(come("dm"), "campagne/c1/immagini/nuova"), nuovo({ mostrataA: ["p1"], vistaDa: ["p1"], visibileA: [] }))));
  test("NON si rende visibile a qualcuno di nascosto (fuori da mostrati e archivio)", () =>
    assertFails(setDoc(doc(come("dm"), "campagne/c1/immagini/nuova"), nuovo({ visibileA: ["p2"] }))));
  test("il DM mostra un contenuto a un giocatore", () =>
    assertSucceeds(updateDoc(doc(come("dm"), "campagne/c1/immagini/nascosta"), { mostrataA: ["p2"], vistaDa: ["p2"], visibileA: ["p2"] })));
  test("il DM lo mette nell'archivio di un giocatore", () =>
    assertSucceeds(updateDoc(doc(come("dm"), "campagne/c1/immagini/nascosta"), { archiviataPer: ["p1"], visibileA: ["p1"] })));
  test("il DM vede anche i contenuti nascosti", () => assertSucceeds(getDoc(doc(come("dm"), "campagne/c1/immagini/nascosta"))));
  test("un membro NON vede un contenuto nascosto", () => assertFails(getDoc(doc(come("p1"), "campagne/c1/immagini/nascosta"))));
  test("un membro vede un contenuto mostrato a lui", () => assertSucceeds(getDoc(doc(come("p2"), "campagne/c1/immagini/pubblica"))));
  test("il giocatore vede un contenuto del suo archivio", () => assertSucceeds(getDoc(doc(come("p1"), "campagne/c1/immagini/soloP1"))));
  test("un altro giocatore NON vede l'archivio altrui", () => assertFails(getDoc(doc(come("p2"), "campagne/c1/immagini/soloP1"))));
  test("chi non è membro NON vede nulla, anche se elencato", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      updateDoc(doc(ctx.firestore(), "campagne/c1/immagini/pubblica"), { mostrataA: ["vecchio"], vistaDa: [], visibileA: ["vecchio"] }));
    await assertFails(getDoc(doc(come("vecchio"), "campagne/c1/immagini/pubblica")));
  });
  test("un membro elenca i contenuti visibili a lui", () =>
    assertSucceeds(getDocs(query(collection(come("p1"), "campagne/c1/immagini"), where("visibileA", "array-contains", "p1")))));
  test("un membro NON elenca i contenuti visibili a un altro", () =>
    assertFails(getDocs(query(collection(come("p1"), "campagne/c1/immagini"), where("visibileA", "array-contains", "p2")))));
  test("un membro NON elenca tutta la libreria", () =>
    assertFails(getDocs(collection(come("p1"), "campagne/c1/immagini"))));
  test("un giocatore NON si mostra un contenuto da solo", () =>
    assertFails(updateDoc(doc(come("p1"), "campagne/c1/immagini/nascosta"), { mostrataA: ["p1"], visibileA: ["p1"] })));
  test("il DM elimina un contenuto", () => assertSucceeds(deleteDoc(doc(come("dm"), "campagne/c1/immagini/pubblica"))));

  test("il DM salva note, tag e sessioni collegate", () =>
    assertSucceeds(setDoc(doc(come("dm"), "campagne/c1/immaginiDM/nuova"), riservati({ note: "x", tag: ["a"], archivio: true, sessioniCollegate: ["r1"] }))));
  test("NON si salvano campi extra nei dati riservati", () =>
    assertFails(setDoc(doc(come("dm"), "campagne/c1/immaginiDM/nuova"), riservati({ titolo: "x" }))));
  test("note troppo lunghe rifiutate", () =>
    assertFails(setDoc(doc(come("dm"), "campagne/c1/immaginiDM/nuova"), riservati({ note: "x".repeat(2001) }))));
  test("il DM legge i dati riservati", () => assertSucceeds(getDoc(doc(come("dm"), "campagne/c1/immaginiDM/nascosta"))));
  test("un giocatore NON legge note e tag", () => assertFails(getDoc(doc(come("p1"), "campagne/c1/immaginiDM/nascosta"))));
  test("un giocatore NON elenca i dati riservati", () =>
    assertFails(getDocs(collection(come("p1"), "campagne/c1/immaginiDM"))));
  test("un giocatore NON scrive i dati riservati", () =>
    assertFails(setDoc(doc(come("p1"), "campagne/c1/immaginiDM/nuova"), riservati())));
});

describe("Tracker di combattimento", () => {
  const nemico = (extra = {}) => ({ tipo: "nemico", nome: "Orco", uid: null, iniziativa: 9, bonus: 0, spareggio: 0, salute: "illeso", immagineId: null, ...extra });
  test("un membro legge stato e combattenti", async () => {
    await assertSucceeds(getDoc(doc(come("p2"), "campagne/c1/combattimento/stato")));
    await assertSucceeds(getDocs(collection(come("p2"), "campagne/c1/combattenti")));
  });
  test("chi non è membro NON legge il combattimento", () =>
    assertFails(getDocs(collection(come("vecchio"), "campagne/c1/combattenti"))));
  test("il DM avanza il turno", () =>
    assertSucceeds(setDoc(doc(come("dm"), "campagne/c1/combattimento/stato"), { attivo: true, round: 2, turno: "goblin1" })));
  test("un giocatore NON avanza il turno", () =>
    assertFails(setDoc(doc(come("p1"), "campagne/c1/combattimento/stato"), { attivo: true, round: 2, turno: "pgP1" })));
  test("NON si scrivono altri documenti in combattimento/", () =>
    assertFails(setDoc(doc(come("dm"), "campagne/c1/combattimento/altro"), { attivo: true, round: 1, turno: null })));
  test("il DM aggiunge un nemico", () =>
    assertSucceeds(setDoc(doc(come("dm"), "campagne/c1/combattenti/orco"), nemico())));
  test("NON si aggiunge un nemico con campi extra (es. PF)", () =>
    assertFails(setDoc(doc(come("dm"), "campagne/c1/combattenti/orco"), nemico({ pf: 15 }))));
  test("NON si usa una salute inventata", () =>
    assertFails(setDoc(doc(come("dm"), "campagne/c1/combattenti/orco"), nemico({ salute: "quasi morto" }))));
  test("un giocatore NON aggiunge combattenti", () =>
    assertFails(setDoc(doc(come("p1"), "campagne/c1/combattenti/orco"), nemico())));
  test("il giocatore scrive la propria iniziativa", () =>
    assertSucceeds(updateDoc(doc(come("p1"), "campagne/c1/combattenti/pgP1"), { iniziativa: 17, bonus: 3 })));
  test("il giocatore NON scrive l'iniziativa di un altro", () =>
    assertFails(updateDoc(doc(come("p1"), "campagne/c1/combattenti/pgP2"), { iniziativa: 1 })));
  test("il giocatore NON cambia l'iniziativa dei nemici", () =>
    assertFails(updateDoc(doc(come("p1"), "campagne/c1/combattenti/goblin1"), { iniziativa: 1 })));
  test("il giocatore NON cambia altro della propria riga (es. spareggio)", () =>
    assertFails(updateDoc(doc(come("p1"), "campagne/c1/combattenti/pgP1"), { spareggio: 99 })));
  test("iniziativa fuori scala rifiutata", () =>
    assertFails(updateDoc(doc(come("p1"), "campagne/c1/combattenti/pgP1"), { iniziativa: 1000 })));
  test("il DM corregge l'iniziativa di un giocatore", () =>
    assertSucceeds(updateDoc(doc(come("dm"), "campagne/c1/combattenti/pgP1"), { iniziativa: 5 })));
  test("il DM toglie un combattente", () => assertSucceeds(deleteDoc(doc(come("dm"), "campagne/c1/combattenti/goblin1"))));
  test("un giocatore NON toglie combattenti", () => assertFails(deleteDoc(doc(come("p1"), "campagne/c1/combattenti/goblin1"))));
  test("il DM legge e scrive i PF dei nemici", async () => {
    await assertSucceeds(getDoc(doc(come("dm"), "campagne/c1/combattentiDM/goblin1")));
    await assertSucceeds(updateDoc(doc(come("dm"), "campagne/c1/combattentiDM/goblin1"), { pfAttuali: 3 }));
  });
  test("un giocatore NON legge i PF dei nemici", async () => {
    await assertFails(getDoc(doc(come("p1"), "campagne/c1/combattentiDM/goblin1")));
    await assertFails(getDocs(collection(come("p1"), "campagne/c1/combattentiDM")));
  });
  test("PF dei nemici: campi extra rifiutati", () =>
    assertFails(setDoc(doc(come("dm"), "campagne/c1/combattentiDM/orco"), { pfAttuali: 1, pfMassimi: 1, segreto: "x" })));
});

describe("PF e condizioni", () => {
  const hp = { massimi: 12, attuali: 5, temporanei: 0 };
  test("il giocatore segna condizioni ed esaurimento sulla propria scheda", () =>
    assertSucceeds(updateDoc(doc(come("p1"), "personaggi/s1"), { condizioni: ["prono", "avvelenato"], esaurimento: 2 })));
  test("NON si segna una condizione inventata", () =>
    assertFails(updateDoc(doc(come("p1"), "personaggi/s1"), { condizioni: ["maledetto"] })));
  test("NON si va oltre il 6° livello di esaurimento", () =>
    assertFails(updateDoc(doc(come("p1"), "personaggi/s1"), { esaurimento: 7 })));
  test("il DM della campagna aggiorna PF e condizioni di un personaggio", () =>
    assertSucceeds(updateDoc(doc(come("dm"), "personaggi/s1"), { hp, condizioni: ["stordito"], esaurimento: 1 })));
  test("il DM NON modifica altro della scheda (es. nome)", () =>
    assertFails(updateDoc(doc(come("dm"), "personaggi/s1"), { hp, nome: "Altro" })));
  test("il DM NON modifica il livello", () =>
    assertFails(updateDoc(doc(come("dm"), "personaggi/s1"), { livello: 5 })));
  test("un altro giocatore NON tocca PF o condizioni altrui", () =>
    assertFails(updateDoc(doc(come("p2"), "personaggi/s1"), { hp, condizioni: ["prono"] })));
  test("il riepilogo del party riporta condizioni ed esaurimento della scheda", async () => {
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), "personaggi/s1"), { condizioni: ["prono"], esaurimento: 1 }));
    await assertSucceeds(setDoc(doc(come("p1"), "campagne/c1/party/p1"), {
      nomeGiocatore: "Pia", schedaId: "s1", nomePersonaggio: "Eroe", classe: "guerriero", livello: 1,
      hp: { massimi: 12, attuali: 12, temporanei: 0 }, condizioni: ["prono"], esaurimento: 1, aggiornatoIl: serverTimestamp(),
    }));
  });
  test("NON si pubblicano condizioni diverse dalla scheda", () =>
    assertFails(setDoc(doc(come("p1"), "campagne/c1/party/p1"), {
      nomeGiocatore: "Pia", schedaId: "s1", nomePersonaggio: "Eroe", classe: "guerriero", livello: 1,
      hp: { massimi: 12, attuali: 12, temporanei: 0 }, condizioni: ["invisibile"], esaurimento: 0, aggiornatoIl: serverTimestamp(),
    })));
  test("il DM segna una condizione su un nemico", () =>
    assertSucceeds(updateDoc(doc(come("dm"), "campagne/c1/combattenti/goblin1"), { condizioni: ["prono", "trattenuto"] })));
  test("NON si segna una condizione inventata su un nemico", () =>
    assertFails(updateDoc(doc(come("dm"), "campagne/c1/combattenti/goblin1"), { condizioni: ["arrabbiato"] })));
  test("un giocatore NON segna condizioni sui nemici", () =>
    assertFails(updateDoc(doc(come("p1"), "campagne/c1/combattenti/goblin1"), { condizioni: ["prono"] })));
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

describe("Documenti tecnici delle Cloud Functions", () => {
  test("nemmeno l'admin legge sistema/* dal browser", () =>
    assertFails(getDoc(doc(come("admin"), "sistema/notificheEmail"))));
  test("nessuno azzera il limitatore delle email", () =>
    assertFails(setDoc(doc(come("admin"), "sistema/notificheEmail"), { invii: [] })));
});

describe("Stato condiviso della campagna", () => {
  test("un membro legge lo stato della sessione", () =>
    assertSucceeds(getDoc(doc(come("p1"), "campagne/c1/stato/sessione"))));
  test("un giocatore NON apre la sessione", () =>
    assertFails(setDoc(doc(come("p1"), "campagne/c1/stato/sessione"), { inCorso: false })));
  test("il DM cambia la musica", () =>
    assertSucceeds(setDoc(doc(come("dm"), "campagne/c1/stato/musica"), { sorgente: "youtube" })));
});
