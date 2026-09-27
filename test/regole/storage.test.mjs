// Test delle regole di Cloud Storage (storage.rules) sull'emulatore.
// Le regole leggono profili e campagne da Firestore: i dati di prova vengono
// scritti nell'emulatore di Firestore, che quello di Storage consulta.
import { before, after, beforeEach, describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getBytes, deleteObject } from "firebase/storage";

const leggiFile = (percorso) => readFileSync(fileURLToPath(new URL(percorso, import.meta.url)), "utf8");
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-sotterranei",
    firestore: { rules: leggiFile("../../firestore.rules"), host: "127.0.0.1", port: 8080 },
    storage: { rules: leggiFile("../../storage.rules"), host: "127.0.0.1", port: 9199 },
  });
});
after(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, "users/admin"), { nome: "Admin", ruolo: "admin" });
    await setDoc(doc(d, "users/dm"), { nome: "Master", ruolo: "dm", approvato: true });
    await setDoc(doc(d, "users/p1"), { nome: "Pia", ruolo: "player", approvato: true });
    await setDoc(doc(d, "users/esterno"), { nome: "Esterno", ruolo: "player", approvato: true });
    await setDoc(doc(d, "users/attesa"), { nome: "Nuovo", ruolo: "player", approvato: false });
    await setDoc(doc(d, "campagne/c1"), { dmUid: "dm", membriUid: ["p1", "p2"], titolo: "x" });
    await setDoc(doc(d, "users/p2"), { nome: "Leo", ruolo: "player", approvato: true });
    const descrizione = (visibilita, lettori = []) => ({ titolo: "x", categoria: "mappa", visibilita, lettori, larghezza: 1, altezza: 1 });
    await setDoc(doc(d, "campagne/c1/immagini/nascosta"), descrizione("dm"));
    await setDoc(doc(d, "campagne/c1/immagini/pubblica"), descrizione("tutti"));
    await setDoc(doc(d, "campagne/c1/immagini/soloP1"), descrizione("selezionati", ["p1"]));
    const s = ctx.storage();
    await uploadBytes(ref(s, "ritratti/p1/volto.png"), new Uint8Array([1, 2, 3]), { contentType: "image/png" });
    for (const nome of ["nascosta", "pubblica", "pubblica-mini", "soloP1"]) {
      await uploadBytes(ref(s, `campagne/c1/${nome}`), new Uint8Array([1, 2, 3]), { contentType: "image/webp" });
    }
  });
});

const come = (uid, emailVerificata = true) =>
  env.authenticatedContext(uid, { email_verified: emailVerificata }).storage();
const png = (byte = 1000) => new Uint8Array(byte);
const MB = 1024 * 1024;

describe("Ritratti", () => {
  test("un utente carica il proprio ritratto", () =>
    assertSucceeds(uploadBytes(ref(come("p1"), "ritratti/p1/nuovo.png"), png(), { contentType: "image/png" })));
  test("NON si carica nella cartella di un altro", () =>
    assertFails(uploadBytes(ref(come("p1"), "ritratti/dm/nuovo.png"), png(), { contentType: "image/png" })));
  test("NON si carica un file che non è un'immagine", () =>
    assertFails(uploadBytes(ref(come("p1"), "ritratti/p1/virus.png"), png(), { contentType: "application/octet-stream" })));
  test("NON si carica un'immagine oltre i 2 MB", () =>
    assertFails(uploadBytes(ref(come("p1"), "ritratti/p1/enorme.png"), png(2 * MB + 1), { contentType: "image/png" })));
  test("NON si usa un nome file strano", () =>
    assertFails(uploadBytes(ref(come("p1"), "ritratti/p1/<script>.png"), png(), { contentType: "image/png" })));
  test("un utente approvato vede i ritratti", () => assertSucceeds(getBytes(ref(come("esterno"), "ritratti/p1/volto.png"))));
  test("chi è in attesa NON vede i ritratti", () => assertFails(getBytes(ref(come("attesa"), "ritratti/p1/volto.png"))));
  test("chi non ha verificato l'email NON vede i ritratti", () => assertFails(getBytes(ref(come("p1", false), "ritratti/p1/volto.png"))));
  test("chi non ha fatto l'accesso NON vede i ritratti", () =>
    assertFails(getBytes(ref(env.unauthenticatedContext().storage(), "ritratti/p1/volto.png"))));
  test("chi è in attesa NON carica nulla", () =>
    assertFails(uploadBytes(ref(come("attesa"), "ritratti/attesa/a.png"), png(), { contentType: "image/png" })));
  test("un altro giocatore NON cancella il ritratto altrui", () =>
    assertFails(deleteObject(ref(come("esterno"), "ritratti/p1/volto.png"))));
  test("il proprietario cancella il proprio ritratto", () => assertSucceeds(deleteObject(ref(come("p1"), "ritratti/p1/volto.png"))));
});

describe("Immagini della campagna", () => {
  test("il DM carica una mappa", () =>
    assertSucceeds(uploadBytes(ref(come("dm"), "campagne/c1/nuova.jpg"), png(), { contentType: "image/jpeg" })));
  test("il DM NON carica oltre i 5 MB", () =>
    assertFails(uploadBytes(ref(come("dm"), "campagne/c1/enorme.jpg"), png(5 * MB + 1), { contentType: "image/jpeg" })));
  test("un giocatore NON carica immagini della campagna", () =>
    assertFails(uploadBytes(ref(come("p1"), "campagne/c1/x.png"), png(), { contentType: "image/png" })));
  test("il DM vede anche le immagini nascoste", () => assertSucceeds(getBytes(ref(come("dm"), "campagne/c1/nascosta"))));
  test("il DM vede un'immagine appena caricata, prima che esista la sua descrizione", async () => {
    await uploadBytes(ref(come("dm"), "campagne/c1/appena"), png(), { contentType: "image/webp" });
    await assertSucceeds(getBytes(ref(come("dm"), "campagne/c1/appena")));
  });
  test("un membro NON scarica un'immagine nascosta", () => assertFails(getBytes(ref(come("p1"), "campagne/c1/nascosta"))));
  test("un membro scarica un'immagine visibile a tutti", () => assertSucceeds(getBytes(ref(come("p2"), "campagne/c1/pubblica"))));
  test("un membro scarica anche la miniatura", () => assertSucceeds(getBytes(ref(come("p2"), "campagne/c1/pubblica-mini"))));
  test("il giocatore scelto scarica la sua immagine", () => assertSucceeds(getBytes(ref(come("p1"), "campagne/c1/soloP1"))));
  test("un altro giocatore NON la scarica", () => assertFails(getBytes(ref(come("p2"), "campagne/c1/soloP1"))));
  test("chi non è membro NON scarica nemmeno quelle per tutti", () =>
    assertFails(getBytes(ref(come("esterno"), "campagne/c1/pubblica"))));
  test("un giocatore NON cancella le immagini della campagna", () =>
    assertFails(deleteObject(ref(come("p1"), "campagne/c1/pubblica"))));
});

describe("Percorsi non previsti", () => {
  test("NON si carica fuori dalle cartelle previste", () =>
    assertFails(uploadBytes(ref(come("admin"), "varie/file.png"), png(), { contentType: "image/png" })));
  test("NON si leggono file fuori dalle cartelle previste", () =>
    assertFails(getBytes(ref(come("admin"), "varie/file.png"))));
});
