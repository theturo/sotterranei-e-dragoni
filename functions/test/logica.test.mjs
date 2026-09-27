import { test } from "node:test";
import assert from "node:assert/strict";
import { registraInvio, emailNuovoIscritto, deveBloccare, idProgetto, MASSIMO_EMAIL_ORARIE } from "../logica.js";

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
