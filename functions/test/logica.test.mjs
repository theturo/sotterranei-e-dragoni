import { test } from "node:test";
import assert from "node:assert/strict";
import {
  registraInvio, emailNuovoIscritto, deveBloccare, idProgetto, MASSIMO_EMAIL_ORARIE,
  messaggioPush, dataLeggibile, tokenDaRimuovere,
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
