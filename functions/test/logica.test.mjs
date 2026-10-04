import { test } from "node:test";
import assert from "node:assert/strict";
import {
  registraInvio, emailNuovoIscritto, deveBloccare, idProgetto, MASSIMO_EMAIL_ORARIE,
  messaggioPush, dataLeggibile, tokenDaRimuovere, motivoRifiutoEliminazione, CATEGORIA_PUSH,
} from "../logica.js";

const ORA = 60 * 60 * 1000;

test("limitatore: consente e registra gli invii", () => {
  const esito = registraInvio([], 1_000_000);
  assert.equal(esito.consentito, true);
  assert.deepEqual(esito.invii, [1_000_000]);
});

test("limitatore: blocca oltre il massimo orario", () => {
  const adesso = 10 * ORA;
  const pieni = Array.from({ length: MASSIMO_EMAIL_ORARIE }, (_, i) => adesso - i * 1000);
  assert.equal(registraInvio(pieni, adesso).consentito, false);
});

test("limitatore: dimentica gli invii più vecchi di un'ora e i valori non validi", () => {
  const adesso = 10 * ORA;
  const vecchi = Array.from({ length: MASSIMO_EMAIL_ORARIE }, (_, i) => adesso - ORA - 1 - i);
  const esito = registraInvio([...vecchi, "x", null, adesso + 5 * ORA], adesso);
  assert.equal(esito.consentito, true);
  assert.deepEqual(esito.invii, [adesso]);
  assert.equal(registraInvio(undefined, adesso).consentito, true);
});

test("email: contiene nome, email e link, senza a-capo iniettati", () => {
  const { oggetto, testo } = emailNuovoIscritto({ nome: "Pia\r\nBcc: spam@x.it", email: "pia@x.it" }, "https://esempio/admin");
  assert.doesNotMatch(oggetto, /[\r\n]/);
  assert.match(oggetto, /^Nuovo iscritto da approvare: Pia Bcc/);
  assert.match(testo, /Email: pia@x\.it/);
  assert.match(testo, /https:\/\/esempio\/admin/);
});

test("email: accorcia i nomi lunghi e gestisce i campi mancanti", () => {
  const { oggetto, testo } = emailNuovoIscritto({ nome: "x".repeat(500) }, "u");
  assert.ok(oggetto.length < 100);
  assert.match(testo, /Email: —/);
});

test("blocco spese: scatta solo dalla soglia in su", () => {
  assert.equal(deveBloccare({ costAmount: 4.99, budgetAmount: 5 }, 10), false);
  assert.equal(deveBloccare({ costAmount: 9.99, budgetAmount: 5 }, 10), false);
  assert.equal(deveBloccare({ costAmount: 10, budgetAmount: 5 }, 10), true);
  assert.equal(deveBloccare({ costAmount: 250, budgetAmount: 5 }, 10), true);
});

test("blocco spese: messaggi strani o soglia non valida non bloccano nulla", () => {
  assert.equal(deveBloccare({}, 10), false);
  assert.equal(deveBloccare(null, 10), false);
  assert.equal(deveBloccare({ costAmount: "tanti" }, 10), false);
  assert.equal(deveBloccare({ costAmount: 100 }, 0), false);
  assert.equal(deveBloccare({ costAmount: 100 }, undefined), false);
});

test("ID del progetto dall'ambiente", () => {
  assert.equal(idProgetto({ GCLOUD_PROJECT: "p1" }), "p1");
  assert.equal(idProgetto({ FIREBASE_CONFIG: '{"projectId":"p2"}' }), "p2");
  assert.equal(idProgetto({ FIREBASE_CONFIG: "rotto" }), null);
  assert.equal(idProgetto({}), null);
});

test("push: testo per ogni tipo di notifica, con la pagina da aprire", () => {
  const livello = messaggioPush({ tipo: "livello_su", livelloPrecedente: 2, livelloNuovo: 3 });
  assert.equal(livello.titolo, "Sei salito di livello!");
  assert.match(livello.testo, /dal livello 2 al 3/);
  assert.equal(livello.url, "dashboard.html");
  const conCampagna = messaggioPush({ tipo: "livello_su", livelloPrecedente: 3, livelloNuovo: 4, personaggio: "Lyra", campagnaTitolo: "La cripta" });
  assert.equal(conCampagna.testo, "Lyra sale dal livello 3 al 4 in «La cripta»: completa il passaggio dalla scheda.");
  const annullato = messaggioPush({ tipo: "livello_annullato", livelloAnnullato: 4, campagnaTitolo: "La cripta" });
  assert.equal(annullato.testo, "Il DM ha annullato il passaggio al 4° livello in «La cripta».");
  assert.equal(CATEGORIA_PUSH.livello_annullato, "livello");

  const proposta = messaggioPush({ tipo: "proposta_sessione", titolo: "La Tomba", date: 3 });
  assert.match(proposta.testo, /propone 3 date \(La Tomba\)/);
  assert.equal(messaggioPush({ tipo: "proposta_sessione", date: 1 }).testo, "Il DM propone una data: rispondi nel calendario.");

  const confermata = messaggioPush({ tipo: "sessione_confermata", numero: 4, data: "2026-10-03", ora: "21:00", titolo: null });
  assert.equal(confermata.titolo, "Sessione 4 confermata");
  assert.equal(confermata.testo, "sab 3 ottobre, 21:00");
  assert.equal(confermata.url, "calendario.html");

  const iniziata = messaggioPush({ tipo: "sessione_iniziata", numero: 5 });
  assert.equal(iniziata.url, "sessione.html");
  assert.match(iniziata.testo, /^Sessione 5: raggiungi il tavolo/);

  for (const m of [livello, proposta, confermata, iniziata]) {
    for (const valore of Object.values(m)) assert.equal(typeof valore, "string");
  }
});

test("push: tipi sconosciuti non partono, testi lunghi e a-capo ripuliti", () => {
  assert.equal(messaggioPush({ tipo: "boh" }), null);
  assert.equal(messaggioPush(null), null);
  const m = messaggioPush({ tipo: "sessione_iniziata", numero: 1, titolo: "a\nb".padEnd(500, "x") });
  assert.doesNotMatch(m.testo, /\n/);
  assert.ok(m.testo.length < 130);
  assert.equal(dataLeggibile("non una data"), "");
});

test("push: si tolgono solo i token che non torneranno validi", () => {
  assert.equal(tokenDaRimuovere({ code: "messaging/registration-token-not-registered" }), true);
  assert.equal(tokenDaRimuovere({ code: "messaging/internal-error" }), false);
  assert.equal(tokenDaRimuovere(undefined), false);
});

test("eliminazione utente: solo un admin, mai il proprio account", () => {
  assert.equal(motivoRifiutoEliminazione({ richiestaDa: "a1" }, "u1", { ruolo: "admin" }), null);
  assert.match(motivoRifiutoEliminazione({ richiestaDa: "d1" }, "u1", { ruolo: "dm" }), /solo un admin/);
  assert.match(motivoRifiutoEliminazione({ richiestaDa: "a1" }, "a1", { ruolo: "admin" }), /proprio account/);
  assert.match(motivoRifiutoEliminazione({}, "u1", { ruolo: "admin" }), /senza autore/);
  assert.match(motivoRifiutoEliminazione({ richiestaDa: "x" }, "u1", undefined), /solo un admin/);
});

test("eliminazione utente: non chi guida una campagna", () => {
  assert.equal(motivoRifiutoEliminazione({ richiestaDa: "a1" }, "u1", { ruolo: "admin" }, []), null);
  assert.match(motivoRifiutoEliminazione({ richiestaDa: "a1" }, "u1", { ruolo: "admin" }, ["La cripta"]), /DM di una campagna \(«La cripta»\)/);
  assert.match(motivoRifiutoEliminazione({ richiestaDa: "a1" }, "u1", { ruolo: "admin" }, ["A", null]), /alcune campagne \(«A», «senza titolo»\)/);
});

test("push «Tocca a te»: testo, pagina e niente push con la Sessione già davanti", async () => {
  const { messaggioPush } = await import("../logica.js");
  const m = messaggioPush({ tipo: "turno", nome: "Kael", round: 2 });
  assert.deepEqual(m, { titolo: "Tocca a te!", testo: "Kael, è il tuo turno (round 2).", url: "sessione.html", nascondiSe: "sessione.html" });
  assert.equal(messaggioPush({ tipo: "turno" }).testo, "Il tuo personaggio, è il tuo turno.");
});

test("preferenze: tipi spenti e fascia «non disturbare» (anche a cavallo della mezzanotte)", async () => {
  const { pushConsentita, inSilenzio, minutiLocali } = await import("../logica.js");
  // 21:40 e 23:30 ora di Roma (in ottobre UTC+2).
  const sera = new Date("2026-10-03T19:40:00Z");
  const notte = new Date("2026-10-03T21:30:00Z");
  const mattina = new Date("2026-10-04T05:30:00Z"); // 7:30 a Roma
  assert.equal(minutiLocali(sera, "Europe/Rome"), 21 * 60 + 40);
  assert.equal(minutiLocali(sera, "Fuso/Inventato"), 21 * 60 + 40);
  const silenzio = { attivo: true, da: "23:00", a: "08:00" };
  assert.equal(inSilenzio(silenzio, sera, "Europe/Rome"), false);
  assert.equal(inSilenzio(silenzio, notte, "Europe/Rome"), true);
  assert.equal(inSilenzio(silenzio, mattina, "Europe/Rome"), true);
  assert.equal(inSilenzio({ attivo: true, da: "13:00", a: "15:00" }, new Date("2026-10-03T12:00:00Z"), "Europe/Rome"), true);
  assert.equal(inSilenzio({ ...silenzio, attivo: false }, notte, "Europe/Rome"), false);
  assert.equal(inSilenzio({ attivo: true, da: "boh", a: "08:00" }, notte, "Europe/Rome"), false);
  assert.deepEqual(pushConsentita("turno", undefined, notte), { consentita: true, motivo: null });
  assert.deepEqual(pushConsentita("turno", { tipi: { turno: false } }, sera), { consentita: false, motivo: "tipo spento" });
  assert.deepEqual(pushConsentita("proposta_sessione", { tipi: { turno: false } }, sera), { consentita: true, motivo: null });
  assert.deepEqual(pushConsentita("sessione_confermata", { tipi: { date: false } }, sera).motivo, "tipo spento");
  assert.deepEqual(pushConsentita("livello_su", { silenzio, fuso: "Europe/Rome" }, notte), { consentita: false, motivo: "non disturbare" });
});
