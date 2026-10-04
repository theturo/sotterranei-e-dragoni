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
    // Mappe: "pubblica" è in tavola, "nascosta" è in preparazione.
    await set("campagne/c1/stato/tavola", { immagineId: "pubblica", inquadratura: null });
    const griglia = { lato: 50, ox: 0, oy: 0, visibile: true, snap: true };
    await set("campagne/c1/mappe/pubblica", griglia);
    await set("campagne/c1/mappe/nascosta", griglia);
    await set("campagne/c1/mappe/pubblica/pedine/p1", { tipo: "pg", uid: "p1", c: 3, r: 4 });
    await set("campagne/c1/mappe/nascosta/pedine/p1", { tipo: "pg", uid: "p1", c: 1, r: 1 });
    // Nemici: "ombra" è nascosta (tracker e mappa), "goblin1" è rivelato.
    const nemico = { tipo: "nemico", nome: "Ombra", immagineId: null, taglia: "media", salute: "illeso", condizioni: [], c: 6, r: 6 };
    await set("campagne/c1/combattentiNascosti/ombra", { tipo: "nemico", nome: "Ombra", uid: null, iniziativa: 16, bonus: 2, spareggio: 0, salute: "illeso", immagineId: null, taglia: "media" });
    await set("campagne/c1/mappe/pubblica/pedineDM/ombra", nemico);
    await set("campagne/c1/mappe/pubblica/pedine/goblin1", { ...nemico, nome: "Goblin 1", taglia: "piccola" });
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
  test("il DM concede più livelli in un colpo (livello di partenza)", () =>
    assertSucceeds(updateDoc(doc(come("dm"), "users/p2"), { livello: increment(2), livelliDaSpendere: increment(2) })));
  test("il DM NON concede livelli e crediti diversi", () =>
    assertFails(updateDoc(doc(come("dm"), "users/p2"), { livello: 5, livelliDaSpendere: 3 })));
  test("il DM NON toglie livelli", () =>
    assertFails(updateDoc(doc(come("dm"), "users/p1"), { livello: increment(-1), livelliDaSpendere: increment(-1) })));
  test("il DM concede livelli anche all'admin (che può giocare nella sua campagna)", () =>
    assertSucceeds(updateDoc(doc(come("dm"), "users/admin"), { livello: increment(1), livelliDaSpendere: increment(1) })));
  test("il DM NON concede livelli a sé stesso né a un altro DM", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "users/dm2"), { nome: "Altro", email: "dm2@x.it", ruolo: "dm", approvato: true }));
    await assertFails(updateDoc(doc(come("dm"), "users/dm"), { livello: increment(1), livelliDaSpendere: increment(1) }));
    await assertFails(updateDoc(doc(come("dm"), "users/dm2"), { livello: increment(1), livelliDaSpendere: increment(1) }));
  });
  test("il DM imposta il livello di partenza della campagna", () =>
    assertSucceeds(updateDoc(doc(come("dm"), "campagne/c1"), { livelloPartenza: 3 })));
  test("un giocatore NON imposta il livello di partenza", () =>
    assertFails(updateDoc(doc(come("p1"), "campagne/c1"), { livelloPartenza: 3 })));

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
  test("il DM salva i suoi link YouTube nella zona privata", () =>
    assertSucceeds(setDoc(doc(come("dm"), "campagne/c1/privato/musica"), { youtube: [{ tipo: "playlist", id: "PLabc", nome: "Boss finale" }] })));
  test("un membro NON legge i link YouTube del DM", () =>
    assertFails(getDoc(doc(come("p1"), "campagne/c1/privato/musica"))));
  test("un membro NON scrive i link YouTube del DM", () =>
    assertFails(setDoc(doc(come("p1"), "campagne/c1/privato/musica"), { youtube: [] })));
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
  test("il DM della campagna elimina una sessione chiusa (es. di prova)", () =>
    assertSucceeds(deleteDoc(doc(come("dm"), "registroSessioni/r0"))));
  test("il DM elimina gli appunti di una sessione chiusa", () =>
    assertSucceeds(deleteDoc(doc(come("dm"), "registroSessioni/r1/appunti/a1"))));
  test("un altro DM NON elimina le sessioni di una campagna non sua", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "users/dm2"), { nome: "Altro", email: "dm2@x.it", ruolo: "dm", approvato: true }));
    await assertFails(deleteDoc(doc(come("dm2"), "registroSessioni/r0")));
  });
  test("un giocatore NON elimina sessioni", () =>
    assertFails(deleteDoc(doc(come("p1"), "registroSessioni/r0"))));
  test("un giocatore NON crea sessioni", () =>
    assertFails(addDoc(collection(come("p1"), "registroSessioni"), { campagnaId: "c1", numero: 9, stato: "in-corso" })));
});

describe("Dispositivi per le notifiche push", () => {
  const dispositivo = (extra = {}) => ({ token: "tok-123", piattaforma: "Android", aggiornatoIl: serverTimestamp(), ...extra });

  test("un giocatore registra il proprio dispositivo", () =>
    assertSucceeds(setDoc(doc(come("p1"), "users/p1/dispositivi/d1"), dispositivo())));
  test("un giocatore aggiorna il token e poi toglie il dispositivo", async () => {
    await assertSucceeds(setDoc(doc(come("p1"), "users/p1/dispositivi/d1"), dispositivo()));
    await assertSucceeds(setDoc(doc(come("p1"), "users/p1/dispositivi/d1"), dispositivo({ token: "tok-456" })));
    await assertSucceeds(getDoc(doc(come("p1"), "users/p1/dispositivi/d1")));
    await assertSucceeds(deleteDoc(doc(come("p1"), "users/p1/dispositivi/d1")));
  });
  test("NON si registra un dispositivo a nome di un altro", () =>
    assertFails(setDoc(doc(come("p2"), "users/p1/dispositivi/d1"), dispositivo())));
  test("il DM NON legge i dispositivi di un giocatore", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "users/p1/dispositivi/d1"), { token: "t" }));
    await assertFails(getDoc(doc(come("dm"), "users/p1/dispositivi/d1")));
  });
  test("NON si registra un dispositivo con campi extra o token vuoto", async () => {
    await assertFails(setDoc(doc(come("p1"), "users/p1/dispositivi/d1"), dispositivo({ extra: 1 })));
    await assertFails(setDoc(doc(come("p1"), "users/p1/dispositivi/d1"), dispositivo({ token: "" })));
    await assertFails(setDoc(doc(come("p1"), "users/p1/dispositivi/d1"), dispositivo({ token: "x".repeat(5000) })));
  });
  test("un iscritto in attesa NON registra dispositivi", () =>
    assertFails(setDoc(doc(come("attesa"), "users/attesa/dispositivi/d1"), dispositivo())));
});

describe("Eliminazione degli utenti", () => {
  const richiesta = (da) => ({ richiestaDa: da, richiestaIl: serverTimestamp() });
  test("l'admin chiede di eliminare un utente", () =>
    assertSucceeds(setDoc(doc(come("admin"), "richiesteEliminazione/p2"), richiesta("admin"))));
  test("l'admin NON chiede di eliminare sé stesso", () =>
    assertFails(setDoc(doc(come("admin"), "richiesteEliminazione/admin"), richiesta("admin"))));
  test("l'admin NON firma la richiesta a nome di altri", () =>
    assertFails(setDoc(doc(come("admin"), "richiesteEliminazione/p2"), richiesta("dm"))));
  test("il DM NON chiede di eliminare un utente", () =>
    assertFails(setDoc(doc(come("dm"), "richiesteEliminazione/p2"), richiesta("dm"))));
  test("un giocatore NON legge le richieste", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "richiesteEliminazione/p2"), { richiestaDa: "admin", stato: "completata" }));
    await assertFails(getDoc(doc(come("p1"), "richiesteEliminazione/p2")));
    await assertSucceeds(getDoc(doc(come("admin"), "richiesteEliminazione/p2")));
  });
  test("nessuno modifica l'esito scritto dalla funzione", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "richiesteEliminazione/p2"), { richiestaDa: "admin", stato: "errore" }));
    await assertFails(updateDoc(doc(come("admin"), "richiesteEliminazione/p2"), { stato: "completata" }));
    await assertSucceeds(deleteDoc(doc(come("admin"), "richiesteEliminazione/p2")));
  });
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

describe("Riposi e dadi vita", () => {
  const riepilogoS1 = (extra = {}) => ({
    nomeGiocatore: "Pia", schedaId: "s1", nomePersonaggio: "Eroe", classe: "guerriero", livello: 1,
    hp: { massimi: 12, attuali: 12, temporanei: 0 }, condizioni: [], esaurimento: 0, dadiVitaSpesi: 0,
    aggiornatoIl: serverTimestamp(), ...extra,
  });
  const riposo = (extra = {}) => ({ tipo: "breve", attivo: true, partecipanti: ["p1", "p2"], conclusi: [], avviatoIl: serverTimestamp(), ...extra });
  const avviaRiposo = () => env.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), "campagne/c1/stato/riposo"), { tipo: "breve", attivo: true, partecipanti: ["p1"], conclusi: [] }));

  test("un giocatore spende un dado vita (PF e dadi spesi)", () =>
    assertSucceeds(updateDoc(doc(come("p1"), "personaggi/s1"), { dadiVitaSpesi: 1, hp: { massimi: 12, attuali: 12, temporanei: 0 } })));
  test("NON si spendono più dadi vita del livello", () =>
    assertFails(updateDoc(doc(come("p1"), "personaggi/s1"), { dadiVitaSpesi: 2 })));
  test("NON si segnano dadi vita spesi negativi", () =>
    assertFails(updateDoc(doc(come("p1"), "personaggi/s1"), { dadiVitaSpesi: -1 })));
  test("il DM applica un riposo lungo alla scheda e al riepilogo insieme", async () => {
    const d = come("dm");
    const batch = writeBatch(d);
    const campi = {
      hp: { massimi: 12, attuali: 12, temporanei: 0 }, dadiVitaSpesi: 0, esaurimento: 0,
      slotIncantesimoUsati: {}, incantesimiRazzaUsati: [],
      tiriSalvezzaMorte: { successi: [false, false, false], fallimenti: [false, false, false] },
    };
    batch.update(doc(d, "personaggi/s1"), { ...campi, aggiornatoIl: serverTimestamp() });
    batch.set(doc(d, "campagne/c1/party/p1"), riepilogoS1());
    await assertSucceeds(batch.commit());
  });
  test("il DM NON tocca altri campi della scheda con un riposo", () =>
    assertFails(updateDoc(doc(come("dm"), "personaggi/s1"), { dadiVitaSpesi: 0, livello: 5 })));
  test("NON si pubblica un riepilogo con dadi vita diversi dalla scheda", () =>
    assertFails(setDoc(doc(come("p1"), "campagne/c1/party/p1"), riepilogoS1({ dadiVitaSpesi: 1 }))));

  test("il DM avvia un riposo breve per il party", () =>
    assertSucceeds(setDoc(doc(come("dm"), "campagne/c1/stato/riposo"), riposo())));
  test("il DM NON scrive un riposo con campi estranei", () =>
    assertFails(setDoc(doc(come("dm"), "campagne/c1/stato/riposo"), riposo({ extra: 1 }))));
  test("un giocatore NON avvia un riposo breve", () =>
    assertFails(setDoc(doc(come("p1"), "campagne/c1/stato/riposo"), riposo())));
  test("un giocatore invitato segna di aver finito", async () => {
    await avviaRiposo();
    await assertSucceeds(updateDoc(doc(come("p1"), "campagne/c1/stato/riposo"), { conclusi: ["p1"] }));
  });
  test("un giocatore NON segna la fine per un altro", async () => {
    await avviaRiposo();
    await assertFails(updateDoc(doc(come("p1"), "campagne/c1/stato/riposo"), { conclusi: ["p1", "p2"] }));
  });
  test("un giocatore non invitato NON si aggiunge", async () => {
    await avviaRiposo();
    await assertFails(updateDoc(doc(come("p2"), "campagne/c1/stato/riposo"), { conclusi: ["p2"] }));
  });
  test("un giocatore NON chiude il riposo breve", async () => {
    await avviaRiposo();
    await assertFails(updateDoc(doc(come("p1"), "campagne/c1/stato/riposo"), { attivo: false }));
  });

  test("un giocatore annota un riposo negli appunti", () =>
    assertSucceeds(addDoc(collection(come("p2"), "registroSessioni/r1/appunti"), {
      autoreUid: "p2", autoreNome: "Leo", testo: "Maga: riposo lungo", tipo: "riposo", creatoIl: serverTimestamp(),
    })));
  test("NON si annota un appunto di tipo inventato", () =>
    assertFails(addDoc(collection(come("p2"), "registroSessioni/r1/appunti"), {
      autoreUid: "p2", autoreNome: "Leo", testo: "x", tipo: "sistema", creatoIl: serverTimestamp(),
    })));
});

describe("Privilegi di classe", () => {
  const riepilogoS1 = (extra = {}) => ({
    nomeGiocatore: "Pia", schedaId: "s1", nomePersonaggio: "Eroe", classe: "guerriero", livello: 1,
    hp: { massimi: 12, attuali: 12, temporanei: 0 }, condizioni: [], esaurimento: 0, dadiVitaSpesi: 0,
    usiPrivilegi: {}, carisma: null, aggiornatoIl: serverTimestamp(), ...extra,
  });

  test("un giocatore segna l'uso di un privilegio", () =>
    assertSucceeds(updateDoc(doc(come("p1"), "personaggi/s1"), { usiPrivilegi: { "recupero-energie": 1 } })));
  test("NON si salvano usi dei privilegi che non sono una mappa", () =>
    assertFails(updateDoc(doc(come("p1"), "personaggi/s1"), { usiPrivilegi: ["ira"] })));
  test("il DM ripristina i privilegi con un riposo", () =>
    assertSucceeds(updateDoc(doc(come("dm"), "personaggi/s1"), { usiPrivilegi: {} })));
  test("un altro giocatore NON tocca i privilegi altrui", () =>
    assertFails(updateDoc(doc(come("p2"), "personaggi/s1"), { usiPrivilegi: { ira: 3 } })));
  test("il riepilogo pubblica usi dei privilegi e Carisma della scheda", async () => {
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), "personaggi/s1"), {
      usiPrivilegi: { "azione-impetuosa": 1 }, caratteristiche: { carisma: 14 },
    }));
    await assertSucceeds(setDoc(doc(come("p1"), "campagne/c1/party/p1"),
      riepilogoS1({ usiPrivilegi: { "azione-impetuosa": 1 }, carisma: 14 })));
  });
  test("NON si pubblica un riepilogo con privilegi diversi dalla scheda", () =>
    assertFails(setDoc(doc(come("p1"), "campagne/c1/party/p1"), riepilogoS1({ usiPrivilegi: { ira: 1 } }))));
  test("NON si pubblica un Carisma falso nel riepilogo", () =>
    assertFails(setDoc(doc(come("p1"), "campagne/c1/party/p1"), riepilogoS1({ carisma: 20 }))));
});

describe("Lancio dei dadi condiviso", () => {
  const tiroP2 = (extra = {}) => ({
    autoreUid: "p2", autoreNome: "Leo", testo: "Lyra — Atletica: 17 (1d20+3: 14)", tipo: "tiro",
    tiro: { etichetta: "Atletica", formula: "1d20+3", dadi: [14], modificatore: 3, modo: "normale", totale: 17 },
    creatoIl: serverTimestamp(), ...extra,
  });
  const tiroDM = (extra = {}) => ({ ...tiroP2({ autoreUid: "dm", autoreNome: "Master", testo: "Percezione del drago: 22" }), ...extra });

  test("un giocatore annota un tiro negli appunti", () =>
    assertSucceeds(addDoc(collection(come("p2"), "registroSessioni/r1/appunti"), tiroP2())));
  test("NON si allega un tiro a un appunto normale", () =>
    assertFails(addDoc(collection(come("p2"), "registroSessioni/r1/appunti"), tiroP2({ tipo: null }))));
  test("NON si annota un tiro in una sessione chiusa", () =>
    assertFails(addDoc(collection(come("p2"), "registroSessioni/r0/appunti"), tiroP2())));
  test("il DM fa un tiro nascosto", () =>
    assertSucceeds(addDoc(collection(come("dm"), "registroSessioni/r1/tiriNascosti"), tiroDM())));
  test("un giocatore NON fa tiri nascosti", () =>
    assertFails(addDoc(collection(come("p2"), "registroSessioni/r1/tiriNascosti"), tiroP2())));
  test("un giocatore NON legge i tiri nascosti del DM", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "registroSessioni/r1/tiriNascosti/t1"), tiroDM()));
    await assertFails(getDocs(collection(come("p1"), "registroSessioni/r1/tiriNascosti")));
  });
  test("il DM legge i propri tiri nascosti", () =>
    assertSucceeds(getDocs(collection(come("dm"), "registroSessioni/r1/tiriNascosti"))));
});

describe("Calendario: proposte e disponibilità", () => {
  const proposta = (extra = {}) => ({
    titolo: "Sessione 3", note: null, opzioni: [{ id: "a", data: "2026-10-10", ora: "21:00" }, { id: "b", data: "2026-10-11", ora: "20:30" }],
    stato: "aperta", creataIl: serverTimestamp(), ...extra,
  });
  const risposta = (extra = {}) => ({ nome: "Pia", risposte: { a: "si", b: "forse" }, aggiornatoIl: serverTimestamp(), ...extra });
  const creaProposta = (stato = "aperta") => env.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), "campagne/c1/proposte/p1"), { ...proposta({ stato }), creataIl: new Date() }));

  test("il DM propone delle date", () =>
    assertSucceeds(setDoc(doc(come("dm"), "campagne/c1/proposte/p1"), proposta())));
  test("NON si propone senza date", () =>
    assertFails(setDoc(doc(come("dm"), "campagne/c1/proposte/p1"), proposta({ opzioni: [] }))));
  test("un giocatore NON propone date", () =>
    assertFails(setDoc(doc(come("p1"), "campagne/c1/proposte/p1"), proposta())));
  test("un membro legge le proposte", async () => {
    await creaProposta();
    await assertSucceeds(getDoc(doc(come("p2"), "campagne/c1/proposte/p1")));
  });
  test("chi non è membro NON legge le proposte", async () => {
    await creaProposta();
    await assertFails(getDoc(doc(come("vecchio"), "campagne/c1/proposte/p1")));
  });
  test("un membro risponde a proprio nome", async () => {
    await creaProposta();
    await assertSucceeds(setDoc(doc(come("p1"), "campagne/c1/proposte/p1/risposte/p1"), risposta()));
  });
  test("NON si risponde per un altro", async () => {
    await creaProposta();
    await assertFails(setDoc(doc(come("p2"), "campagne/c1/proposte/p1/risposte/p1"), risposta({ nome: "Leo" })));
  });
  test("NON si firma una risposta con un nome falso", async () => {
    await creaProposta();
    await assertFails(setDoc(doc(come("p1"), "campagne/c1/proposte/p1/risposte/p1"), risposta({ nome: "Master" })));
  });
  test("NON si risponde a una proposta già confermata", async () => {
    await creaProposta("confermata");
    await assertFails(setDoc(doc(come("p1"), "campagne/c1/proposte/p1/risposte/p1"), risposta()));
  });
  test("gli altri membri leggono le risposte", async () => {
    await creaProposta();
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "campagne/c1/proposte/p1/risposte/p1"), { ...risposta(), aggiornatoIl: new Date() }));
    await assertSucceeds(getDocs(collection(come("p2"), "campagne/c1/proposte/p1/risposte")));
  });
  test("il DM conferma una data", async () => {
    await creaProposta();
    await assertSucceeds(updateDoc(doc(come("dm"), "campagne/c1/proposte/p1"), { stato: "confermata", confermata: { opzioneId: "a", sessioneId: "r9" } }));
  });
});

describe("Mappe della sessione", () => {
  const pedina = (uid, c = 5, r = 6) => ({ tipo: "pg", uid, c, r, aggiornatoIl: serverTimestamp() });
  const griglia = (extra = {}) => ({ lato: 62.5, ox: 20, oy: 10.5, visibile: true, snap: false, aggiornatoIl: serverTimestamp(), ...extra });

  test("un membro sa quale mappa è in tavola", () => assertSucceeds(getDoc(doc(come("p1"), "campagne/c1/stato/tavola"))));
  test("il DM mette in tavola una mappa e inquadra lo schermo", () =>
    assertSucceeds(setDoc(doc(come("dm"), "campagne/c1/stato/tavola"), {
      immagineId: "nascosta", inquadratura: { x: -10, y: 0, w: 640.5, h: 360 }, aggiornatoIl: serverTimestamp(),
    })));
  test("il DM toglie la mappa dal tavolo", () =>
    assertSucceeds(setDoc(doc(come("dm"), "campagne/c1/stato/tavola"), { immagineId: null, inquadratura: null })));
  test("il DM NON salva un'inquadratura senza larghezza", () =>
    assertFails(setDoc(doc(come("dm"), "campagne/c1/stato/tavola"), { immagineId: "nascosta", inquadratura: { x: 0, y: 0, w: 0, h: 10 } })));
  test("un giocatore NON cambia la mappa in tavola", () =>
    assertFails(setDoc(doc(come("p1"), "campagne/c1/stato/tavola"), { immagineId: "nascosta", inquadratura: null })));

  test("un membro legge la griglia della mappa in tavola", () => assertSucceeds(getDoc(doc(come("p1"), "campagne/c1/mappe/pubblica"))));
  test("un membro NON legge una mappa in preparazione", () => assertFails(getDoc(doc(come("p1"), "campagne/c1/mappe/nascosta"))));
  test("chi non è membro NON legge la mappa in tavola", () => assertFails(getDoc(doc(come("vecchio"), "campagne/c1/mappe/pubblica"))));
  test("il DM salva la griglia di una mappa", () => assertSucceeds(setDoc(doc(come("dm"), "campagne/c1/mappe/nascosta"), griglia())));
  test("il DM NON salva uno scarto più grande della casella", () =>
    assertFails(setDoc(doc(come("dm"), "campagne/c1/mappe/nascosta"), griglia({ ox: 80 }))));
  test("il DM NON salva campi estranei nella griglia", () =>
    assertFails(setDoc(doc(come("dm"), "campagne/c1/mappe/nascosta"), griglia({ nebbia: [] }))));
  test("un giocatore NON cambia la griglia", () => assertFails(setDoc(doc(come("p1"), "campagne/c1/mappe/pubblica"), griglia())));

  test("un membro legge le pedine della mappa in tavola", () =>
    assertSucceeds(getDocs(collection(come("p2"), "campagne/c1/mappe/pubblica/pedine"))));
  test("un membro NON legge le pedine di una mappa in preparazione", () =>
    assertFails(getDocs(collection(come("p2"), "campagne/c1/mappe/nascosta/pedine"))));
  test("il giocatore muove la propria pedina sulla mappa in tavola", () =>
    assertSucceeds(setDoc(doc(come("p1"), "campagne/c1/mappe/pubblica/pedine/p1"), pedina("p1", 7.4, 2))));
  test("il giocatore entra in mappa con la propria pedina", () =>
    assertSucceeds(setDoc(doc(come("p2"), "campagne/c1/mappe/pubblica/pedine/p2"), pedina("p2"))));
  test("il giocatore NON muove la pedina di un altro", () =>
    assertFails(setDoc(doc(come("p2"), "campagne/c1/mappe/pubblica/pedine/p1"), pedina("p1"))));
  test("il giocatore NON muove la propria pedina su una mappa in preparazione", () =>
    assertFails(setDoc(doc(come("p1"), "campagne/c1/mappe/nascosta/pedine/p1"), pedina("p1"))));
  test("il giocatore NON toglie la propria pedina", () =>
    assertFails(deleteDoc(doc(come("p1"), "campagne/c1/mappe/pubblica/pedine/p1"))));
  test("NON si salva una pedina con l'uid sbagliato", () =>
    assertFails(setDoc(doc(come("dm"), "campagne/c1/mappe/pubblica/pedine/p1"), pedina("p2"))));
  test("il DM muove e toglie qualsiasi pedina", async () => {
    await assertSucceeds(setDoc(doc(come("dm"), "campagne/c1/mappe/nascosta/pedine/p2"), pedina("p2")));
    await assertSucceeds(deleteDoc(doc(come("dm"), "campagne/c1/mappe/pubblica/pedine/p1")));
  });

  test("il DM rende visibile la mappa in tavola ai membri", () =>
    assertSucceeds(updateDoc(doc(come("dm"), "campagne/c1/immagini/nascosta"), { inTavolaPer: ["p1", "p2"], visibileA: ["p1", "p2"] })));
  test("NON si rende visibile la mappa in tavola senza aggiornare visibileA", () =>
    assertFails(updateDoc(doc(come("dm"), "campagne/c1/immagini/nascosta"), { inTavolaPer: ["p1"] })));
});

describe("Nemici nascosti e pedine dei nemici", () => {
  const pedinaNemico = (extra = {}) => ({
    tipo: "nemico", nome: "Ogre", immagineId: null, taglia: "grande", salute: "illeso", condizioni: [],
    c: 8, r: 3, aggiornatoIl: serverTimestamp(), ...extra,
  });
  const combattente = (extra = {}) => ({
    tipo: "nemico", nome: "Ogre", uid: null, iniziativa: 9, bonus: -1, spareggio: 0, salute: "illeso",
    immagineId: null, taglia: "grande", creatoIl: serverTimestamp(), ...extra,
  });

  test("un giocatore NON vede i nemici nascosti del tracker", async () => {
    await assertFails(getDoc(doc(come("p1"), "campagne/c1/combattentiNascosti/ombra")));
    await assertFails(getDocs(collection(come("p1"), "campagne/c1/combattentiNascosti")));
  });
  test("un giocatore NON vede le pedine nascoste della mappa in tavola", async () => {
    await assertFails(getDoc(doc(come("p1"), "campagne/c1/mappe/pubblica/pedineDM/ombra")));
    await assertFails(getDocs(collection(come("p1"), "campagne/c1/mappe/pubblica/pedineDM")));
  });
  test("un giocatore vede i nemici rivelati sulla mappa in tavola", () =>
    assertSucceeds(getDoc(doc(come("p1"), "campagne/c1/mappe/pubblica/pedine/goblin1"))));
  test("il DM aggiunge un nemico nascosto, con la taglia", () =>
    assertSucceeds(setDoc(doc(come("dm"), "campagne/c1/combattentiNascosti/ogre"), combattente())));
  test("il DM NON mette un personaggio tra i nascosti", () =>
    assertFails(setDoc(doc(come("dm"), "campagne/c1/combattentiNascosti/pg"), combattente({ tipo: "pg", uid: "p1" }))));
  test("NON si salva una taglia inventata", () =>
    assertFails(setDoc(doc(come("dm"), "campagne/c1/combattenti/ogre"), combattente({ taglia: "colossale" }))));
  test("il DM rivela un nemico: dai nascosti ai visibili, tracker e mappa insieme", async () => {
    const d = come("dm");
    const batch = writeBatch(d);
    batch.delete(doc(d, "campagne/c1/combattentiNascosti/ombra"));
    batch.set(doc(d, "campagne/c1/combattenti/ombra"), { tipo: "nemico", nome: "Ombra", uid: null, iniziativa: 16, bonus: 2, spareggio: 0, salute: "illeso", immagineId: null, taglia: "media" });
    batch.delete(doc(d, "campagne/c1/mappe/pubblica/pedineDM/ombra"));
    batch.set(doc(d, "campagne/c1/mappe/pubblica/pedine/ombra"), pedinaNemico({ nome: "Ombra", taglia: "media" }));
    await assertSucceeds(batch.commit());
  });
  test("il DM piazza un nemico nascosto e uno visibile", async () => {
    await assertSucceeds(setDoc(doc(come("dm"), "campagne/c1/mappe/pubblica/pedineDM/ogre"), pedinaNemico()));
    await assertSucceeds(setDoc(doc(come("dm"), "campagne/c1/mappe/pubblica/pedine/ogre"), pedinaNemico({ condizioni: ["prono"], salute: "grave" })));
  });
  test("NON si salva una pedina nemico con salute o campi sbagliati", async () => {
    await assertFails(setDoc(doc(come("dm"), "campagne/c1/mappe/pubblica/pedine/ogre"), pedinaNemico({ salute: "morto" })));
    await assertFails(setDoc(doc(come("dm"), "campagne/c1/mappe/pubblica/pedineDM/ogre"), pedinaNemico({ pf: 59 })));
    await assertFails(setDoc(doc(come("dm"), "campagne/c1/mappe/pubblica/pedineDM/ogre"), { ...pedinaNemico(), tipo: "pg", uid: "ogre" }));
  });
  test("un giocatore NON piazza né muove nemici", async () => {
    await assertFails(setDoc(doc(come("p1"), "campagne/c1/mappe/pubblica/pedine/p1"), pedinaNemico()));
    await assertFails(updateDoc(doc(come("p1"), "campagne/c1/mappe/pubblica/pedine/goblin1"), { c: 1, aggiornatoIl: serverTimestamp() }));
    await assertFails(setDoc(doc(come("p1"), "campagne/c1/mappe/pubblica/pedineDM/x"), pedinaNemico()));
  });
  test("il tavolo segue il turno (scelta del DM)", async () => {
    await assertSucceeds(updateDoc(doc(come("dm"), "campagne/c1/stato/tavola"), { segueTurno: false }));
    await assertFails(updateDoc(doc(come("dm"), "campagne/c1/stato/tavola"), { segueTurno: "sì" }));
  });
});

describe("Nebbia di guerra", () => {
  const nebbia = (extra = {}) => ({ attiva: true, c0: 0, r0: -1, colonne: 24, righe: 17, celle: "AAAA//8=", aggiornatoIl: serverTimestamp(), ...extra });
  test("il DM salva la nebbia di una mappa", () =>
    assertSucceeds(setDoc(doc(come("dm"), "campagne/c1/mappe/nascosta/nebbia/stato"), nebbia())));
  test("il DM NON salva una nebbia con campi sbagliati", async () => {
    await assertFails(setDoc(doc(come("dm"), "campagne/c1/mappe/nascosta/nebbia/stato"), nebbia({ c0: 3 })));
    await assertFails(setDoc(doc(come("dm"), "campagne/c1/mappe/nascosta/nebbia/stato"), nebbia({ extra: 1 })));
    await assertFails(setDoc(doc(come("dm"), "campagne/c1/mappe/nascosta/nebbia/altro"), nebbia()));
  });
  test("un membro legge la nebbia della mappa in tavola, non delle altre", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "campagne/c1/mappe/pubblica/nebbia/stato"), nebbia());
      await setDoc(doc(ctx.firestore(), "campagne/c1/mappe/nascosta/nebbia/stato"), nebbia());
    });
    await assertSucceeds(getDoc(doc(come("p1"), "campagne/c1/mappe/pubblica/nebbia/stato")));
    await assertFails(getDoc(doc(come("p1"), "campagne/c1/mappe/nascosta/nebbia/stato")));
  });
  test("un giocatore NON cambia la nebbia", () =>
    assertFails(setDoc(doc(come("p1"), "campagne/c1/mappe/pubblica/nebbia/stato"), nebbia({ attiva: false }))));
});


describe("Strumenti della mappa: righello, ping e aree", () => {
  const strumenti = (extra = {}) => ({ righello: { x1: 10, y1: 20.5, x2: 300, y2: 40 }, ping: null, aggiornatoIl: serverTimestamp(), ...extra });
  const area = (autoreUid, extra = {}) => ({
    autoreUid, nome: "Palla di Fuoco", forma: "sfera", misura: 6, x: 500, y: 400, angolo: 0, aggiornatoIl: serverTimestamp(), ...extra,
  });
  test("un giocatore misura e fa un ping sulla mappa in tavola", async () => {
    await assertSucceeds(setDoc(doc(come("p1"), "campagne/c1/mappe/pubblica/strumenti/p1"), strumenti()));
    await assertSucceeds(setDoc(doc(come("p1"), "campagne/c1/mappe/pubblica/strumenti/p1"),
      { righello: null, ping: { x: 4, y: 5, n: 1727950000000 }, aggiornatoIl: serverTimestamp() }, { merge: true }));
    await assertSucceeds(getDocs(collection(come("p2"), "campagne/c1/mappe/pubblica/strumenti")));
  });
  test("un giocatore NON scrive il righello di un altro né su una mappa in preparazione", async () => {
    await assertFails(setDoc(doc(come("p1"), "campagne/c1/mappe/pubblica/strumenti/p2"), strumenti()));
    await assertFails(setDoc(doc(come("p1"), "campagne/c1/mappe/nascosta/strumenti/p1"), strumenti()));
    await assertFails(getDocs(collection(come("p1"), "campagne/c1/mappe/nascosta/strumenti")));
    await assertFails(setDoc(doc(come("vecchio"), "campagne/c1/mappe/pubblica/strumenti/vecchio"), strumenti()));
  });
  test("strumenti con campi sbagliati NON passano", async () => {
    await assertFails(setDoc(doc(come("p1"), "campagne/c1/mappe/pubblica/strumenti/p1"), strumenti({ extra: 1 })));
    await assertFails(setDoc(doc(come("p1"), "campagne/c1/mappe/pubblica/strumenti/p1"), strumenti({ righello: { x1: 1, y1: 2 } })));
    await assertFails(setDoc(doc(come("p1"), "campagne/c1/mappe/pubblica/strumenti/p1"), strumenti({ ping: { x: 1, y: 2, n: "a" } })));
  });
  test("il DM usa gli strumenti anche sulla mappa in preparazione", () =>
    assertSucceeds(setDoc(doc(come("dm"), "campagne/c1/mappe/nascosta/strumenti/dm"), strumenti())));

  test("un giocatore mette un'area a proprio nome e la toglie", async () => {
    const rif = doc(come("p1"), "campagne/c1/mappe/pubblica/aree/a1");
    await assertSucceeds(setDoc(rif, area("p1")));
    await assertSucceeds(getDocs(collection(come("p2"), "campagne/c1/mappe/pubblica/aree")));
    await assertSucceeds(deleteDoc(rif));
  });
  test("un giocatore NON mette aree a nome d'altri o sbagliate", async () => {
    await assertFails(setDoc(doc(come("p1"), "campagne/c1/mappe/pubblica/aree/a1"), area("p2")));
    await assertFails(setDoc(doc(come("p1"), "campagne/c1/mappe/pubblica/aree/a1"), area("p1", { forma: "stella" })));
    await assertFails(setDoc(doc(come("p1"), "campagne/c1/mappe/pubblica/aree/a1"), area("p1", { misura: 500 })));
    await assertFails(setDoc(doc(come("p1"), "campagne/c1/mappe/pubblica/aree/a1"), area("p1", { nome: "" })));
    await assertFails(setDoc(doc(come("p1"), "campagne/c1/mappe/nascosta/aree/a1"), area("p1")));
  });
  test("un giocatore NON toglie né modifica l'area di un altro; il DM la toglie", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "campagne/c1/mappe/pubblica/aree/a2"), area("p2"));
    });
    await assertFails(deleteDoc(doc(come("p1"), "campagne/c1/mappe/pubblica/aree/a2")));
    await assertFails(updateDoc(doc(come("p2"), "campagne/c1/mappe/pubblica/aree/a2"), { x: 10 }));
    await assertSucceeds(deleteDoc(doc(come("dm"), "campagne/c1/mappe/pubblica/aree/a2")));
  });
});

describe("Bestiario del DM", () => {
  const creatura = (extra = {}) => ({
    nome: "Capitano Varro", taglia: "media", tipo: "umanoide", allineamento: "qualsiasi allineamento", ca: "17 (corazza a strisce)",
    caValore: 17, pf: 58, dadiPf: "9d8+18", velocita: "9 m", car: [16, 13, 14, 10, 11, 10], sensi: "Percezione passiva 12", lingue: "Comune",
    gs: "3", pe: 700, tratti: [], azioni: [{ nome: "Spada Lunga", testo: "Colpisce.", colpire: 5, danni: [{ dadi: "1d8+3", tipo: "taglienti" }] }],
    base: "veteran", indole: "alleata", unico: true, note: "Capitano della guardia.", immagineId: null,
    stato: { pfAttuali: 41, condizioni: ["avvelenato"], risorse: [{ nome: "Grido", max: 1, usati: 1 }], equip: ["Spada lunga"], diario: [] },
    aggiornatoIl: serverTimestamp(), ...extra,
  });
  test("il DM crea, aggiorna ed elimina una creatura", async () => {
    const rif = doc(come("dm"), "campagne/c1/bestiario/varro");
    await assertSucceeds(setDoc(rif, creatura()));
    await assertSucceeds(updateDoc(rif, { stato: { pfAttuali: 31, condizioni: [], risorse: [], equip: [], diario: [{ sessione: "Sessione 12", testo: "Ferito." }] }, aggiornatoIl: serverTimestamp() }));
    await assertSucceeds(getDocs(collection(come("dm"), "campagne/c1/bestiario")));
    await assertSucceeds(deleteDoc(rif));
  });
  test("una creatura con campi sbagliati NON passa", async () => {
    const rif = doc(come("dm"), "campagne/c1/bestiario/x");
    await assertFails(setDoc(rif, creatura({ indole: "amica" })));
    await assertFails(setDoc(rif, creatura({ taglia: "gigantesca" })));
    await assertFails(setDoc(rif, creatura({ car: [10, 10] })));
    await assertFails(setDoc(rif, creatura({ nome: "" })));
    await assertFails(setDoc(rif, creatura({ extra: 1 })));
    await assertFails(setDoc(rif, creatura({ stato: { pfAttuali: 3, condizioni: ["ubriaco"], risorse: [], equip: [], diario: [] } })));
  });
  test("i giocatori NON vedono né scrivono il bestiario", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "campagne/c1/bestiario/segreto"), creatura());
    });
    await assertFails(getDoc(doc(come("p1"), "campagne/c1/bestiario/segreto")));
    await assertFails(getDocs(collection(come("p1"), "campagne/c1/bestiario")));
    await assertFails(setDoc(doc(come("p1"), "campagne/c1/bestiario/mio"), creatura()));
  });
});

describe("Bestiario in combattimento", () => {
  const nemico = (extra = {}) => ({ tipo: "nemico", nome: "Capitano Varro", uid: null, iniziativa: 12, bonus: 1, spareggio: 0, salute: "illeso", ...extra });
  test("il DM aggiunge un alleato con i PF visibili e il collegamento alla scheda", async () => {
    await assertSucceeds(setDoc(doc(come("dm"), "campagne/c1/combattenti/varro"), nemico({ alleato: true, pf: { attuali: 41, massimi: 58 }, condizioni: ["avvelenato"] })));
    await assertSucceeds(setDoc(doc(come("dm"), "campagne/c1/combattentiDM/varro"), { pfAttuali: 41, pfMassimi: 58, note: null, creatura: { fonte: "dm", id: "abc" } }));
    await assertSucceeds(setDoc(doc(come("dm"), "campagne/c1/combattentiDM/goblin"), { pfAttuali: 7, pfMassimi: 7, note: null, creatura: { fonte: "srd", id: "goblin" } }));
    await assertSucceeds(getDoc(doc(come("p1"), "campagne/c1/combattenti/varro")));
  });
  test("dati sbagliati NON passano", async () => {
    await assertFails(setDoc(doc(come("dm"), "campagne/c1/combattenti/x"), nemico({ alleato: "sì" })));
    await assertFails(setDoc(doc(come("dm"), "campagne/c1/combattenti/x"), nemico({ pf: { attuali: 1, massimi: 2, extra: 3 } })));
    await assertFails(setDoc(doc(come("dm"), "campagne/c1/combattentiDM/x"), { pfAttuali: 7, pfMassimi: 7, note: null, creatura: { fonte: "web", id: "x" } }));
    await assertFails(setDoc(doc(come("dm"), "campagne/c1/combattentiDM/x"), { pfAttuali: 7, pfMassimi: 7, note: null, creatura: { fonte: "dm", id: "x", altro: 1 } }));
  });
  test("pedina di un alleato sulla mappa", async () => {
    const pedina = (extra = {}) => ({ tipo: "nemico", nome: "Varro", immagineId: null, taglia: "media", salute: "illeso", condizioni: [], c: 3, r: 4, aggiornatoIl: serverTimestamp(), ...extra });
    await assertSucceeds(setDoc(doc(come("dm"), "campagne/c1/mappe/pubblica/pedine/varro"), pedina({ alleato: true })));
    await assertFails(setDoc(doc(come("dm"), "campagne/c1/mappe/pubblica/pedine/varro2"), pedina({ alleato: 1 })));
  });
  test("i giocatori NON leggono il collegamento alla scheda", () =>
    assertFails(getDoc(doc(come("p1"), "campagne/c1/combattentiDM/varro"))));
});

describe("Ruolo per campagna: l'admin che gioca nella campagna di un altro", () => {
  const entraAdmin = () => env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, "campagne/c1"), { titolo: null, titoloProvvisorio: true, dmUid: "dm", membriUid: ["p1", "p2", "admin"], stato: "attiva" });
    await setDoc(doc(d, "registroSessioni/r1/tiriNascosti/t1"), { autoreUid: "dm", autoreNome: "Master", testo: "Furtività 18", tipo: "tiro", creatoIl: new Date() });
  });
  test("fuori dal party l'admin NON legge la campagna", () => assertFails(getDoc(doc(come("admin"), "campagne/c1"))));
  test("da membro legge la campagna, il party e i contenuti mostrati", async () => {
    await entraAdmin();
    await assertSucceeds(getDoc(doc(come("admin"), "campagne/c1")));
    await assertSucceeds(getDoc(doc(come("admin"), "campagne/c1/combattenti/goblin1")));
  });
  test("da membro NON vede nemici nascosti, note, tiri segreti né il titolo vero", async () => {
    await entraAdmin();
    await assertFails(getDoc(doc(come("admin"), "campagne/c1/combattentiNascosti/ombra")));
    await assertFails(getDoc(doc(come("admin"), "campagne/c1/mappe/pubblica/pedineDM/ombra")));
    await assertFails(getDoc(doc(come("admin"), "campagne/c1/immaginiDM/nascosta")));
    await assertFails(getDoc(doc(come("admin"), "campagne/c1/combattentiDM/goblin1")));
    await assertFails(getDoc(doc(come("admin"), "campagne/c1/privato/titolo")));
    await assertFails(getDoc(doc(come("admin"), "registroSessioni/r1/tiriNascosti/t1")));
  });
  test("da membro NON fa il DM: sessioni, stato, membri", async () => {
    await entraAdmin();
    await assertFails(updateDoc(doc(come("admin"), "registroSessioni/r1"), { stato: "chiusa" }));
    await assertFails(setDoc(doc(come("admin"), "campagne/c1/stato/sessione"), { inCorso: false, sessioneAttivaId: null }));
    await assertFails(updateDoc(doc(come("admin"), "campagne/c1"), { membriUid: ["admin"] }));
  });
  test("il DM manda avvisi anche all'admin che gioca", async () => {
    await entraAdmin();
    await assertSucceeds(addDoc(collection(come("dm"), "users/admin/notifiche"), { tipo: "sessione_iniziata", letta: false }));
  });
  test("l'admin guida la propria campagna come un DM", async () => {
    await assertSucceeds(setDoc(doc(come("admin"), "campagne/c9"), { titolo: "Altra", titoloProvvisorio: false, dmUid: "admin", membriUid: [], stato: "attiva" }));
    await assertSucceeds(setDoc(doc(come("admin"), "campagne/c9/privato/titolo"), { titolo: "Altra" }));
    await assertSucceeds(setDoc(doc(come("admin"), "campagne/c9/stato/sessione"), { inCorso: false, sessioneAttivaId: null }));
    await assertSucceeds(setDoc(doc(come("admin"), "registroSessioni/a1"), { campagnaId: "c9", numero: 1, stato: "programmata" }));
    await assertFails(setDoc(doc(come("admin"), "campagne/c8"), { titolo: "Rubata", titoloProvvisorio: false, dmUid: "dm", membriUid: [], stato: "attiva" }));
  });
  test("un DM NON scrive le sessioni della campagna di un altro", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "users/dm2"), { nome: "Altro", email: "dm2@x.it", ruolo: "dm", approvato: true }));
    await assertFails(updateDoc(doc(come("dm2"), "registroSessioni/r1"), { stato: "chiusa" }));
    await assertFails(setDoc(doc(come("dm2"), "registroSessioni/x1"), { campagnaId: "c1", numero: 9, stato: "programmata" }));
    await assertFails(getDoc(doc(come("dm2"), "registroSessioni/r1/tiriNascosti/t1")));
  });
});

describe("Notifiche: «Tocca a te» e preferenze", () => {
  const preferenze = { tipi: { sessione: true, date: false, livello: true, turno: true }, silenzio: { attivo: true, da: "23:00", a: "08:00" }, fuso: "Europe/Rome" };
  test("il giocatore salva le proprie preferenze delle push", () =>
    assertSucceeds(updateDoc(doc(come("p1"), "users/p1"), { preferenzeNotifiche: preferenze })));
  test("NON salva preferenze con campi estranei o tipi sconosciuti", async () => {
    await assertFails(updateDoc(doc(come("p1"), "users/p1"), { preferenzeNotifiche: { ...preferenze, altro: 1 } }));
    await assertFails(updateDoc(doc(come("p1"), "users/p1"), { preferenzeNotifiche: { tipi: { spam: true } } }));
    await assertFails(updateDoc(doc(come("p1"), "users/p1"), { preferenzeNotifiche: { silenzio: { attivo: "sì" } } }));
  });
  test("NON salva le preferenze di un altro", () =>
    assertFails(updateDoc(doc(come("p2"), "users/p1"), { preferenzeNotifiche: preferenze })));
  test("il DM avvisa il giocatore di turno", () =>
    assertSucceeds(addDoc(collection(come("dm"), "users/p1/notifiche"), { tipo: "turno", nome: "Eroe", round: 2, letta: false })));
  test("un giocatore NON manda avvisi a un altro", () =>
    assertFails(addDoc(collection(come("p2"), "users/p1/notifiche"), { tipo: "turno", nome: "Eroe", round: 2, letta: false })));
});
