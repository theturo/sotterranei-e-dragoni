// Scheda rapida ridisegnata: testata blu come la scheda completa, sezioni in
// pergamena, cassetto a destra sul computer e foglio dal basso sul telefono.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const RADICE = new URL("../../", import.meta.url);
const leggi = (f) => readFileSync(new URL(f, RADICE), "utf8");
const js = leggi("assets/js/scheda-rapida.js");
const stili = leggi("assets/css/sessione.css");
const blocco = stili.slice(stili.indexOf("/* ---------- Scheda rapida nella Sessione"), stili.indexOf(".btn-tira > .icona {"));

test("testata blu con ritratto, numeri e PF; corpo in pergamena", () => {
  for (const classe of ["scheda-rapida-testa", "scheda-rapida-ritratto", "scheda-rapida-numeri", "scheda-rapida-pf", "scheda-rapida-schede", "scheda-rapida-corpo", "scheda-rapida-piede"]) {
    assert.match(js, new RegExp(`class="${classe}"`), classe);
  }
  assert.match(js, /corpo\.innerHTML = `<div class="scheda-rapida-pergamena">\$\{html\}<\/div>`/);
  assert.match(blocco, /\.scheda-rapida-testa \{[^}]*background: linear-gradient/);
  assert.match(blocco, /\.scheda-rapida-pergamena \{[^}]*background: var\(--rd-pergamena\)/);
  // Il pannello non è più un .panel del vecchio stile.
  assert.match(js, /pannello\.className = "scheda-rapida";/);
});

test("le stesse quattro sezioni, con l'iniziativa da toccare", () => {
  assert.match(js, /\["combattimento", "Combattimento"\],\s*\["prove", "Prove"\],\s*\["magia", "Magia"\],\s*\["privilegi", "Privilegi"\]/);
  assert.match(js, /scheda-rapida-numero\$\{attributi \? " tira" : ""\}/);
  assert.match(blocco, /\.scheda-rapida-numero\.tira::after \{/);
});

test("«Lancia» con più livelli di slot sceglie su una riga sua", () => {
  assert.match(js, /function sceltaSlot\(chiave\)/);
  assert.match(blocco, /\.scheda-rapida-scelta-slot \{\s*flex-basis: 100%;/);
  // Lo stato del pallino sta nel dato, non nella classe.
  assert.match(js, /data-libero="\$\{libero\}"/);
  assert.match(js, /bottoneAzione\.dataset\.libero === "true"/);
});

test("il DM sceglie il personaggio e vede «Sola lettura»", () => {
  assert.match(js, /class="scheda-rapida-chip-pg" data-azione="scegli"/);
  assert.match(js, /<span class="scheda-rapida-sola">Sola lettura<\/span>/);
});

test("computer: cassetto a destra; telefono: foglio dal basso con barra compatta", () => {
  assert.match(blocco, /\.scheda-rapida \{[^}]*width: min\(470px, 100vw\);[^}]*border-left: 1px solid var\(--rd-bronzo\);/);
  const telefono = blocco.slice(blocco.indexOf("@media (max-width: 760px)"));
  assert.match(telefono, /\.scheda-rapida \{[^}]*top: max\(28px, env\(safe-area-inset-top\)\);[^}]*overflow-y: auto;[^}]*box-shadow: 0 0 0 100vmax/);
  assert.match(telefono, /\.scheda-rapida-compatta \{[^}]*position: sticky;[^}]*margin-bottom: -48px;[^}]*visibility: hidden;/);
  assert.match(telefono, /\.scheda-rapida\.testa-fuori \.scheda-rapida-compatta \{\s*visibility: visible;/);
  assert.match(telefono, /\.scheda-rapida-abilita \{\s*grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(js, /new IntersectionObserver\(/);
  assert.match(js, /pannello\.classList\.toggle\("testa-fuori"/);
  // Il trascinamento chiude solo con il foglio in cima.
  assert.match(js, /pannello\.scrollTop > 0\) return;/);
});

test("gli stili della scheda rapida stanno tutti in sessione.css", () => {
  assert.doesNotMatch(leggi("assets/css/gioco.css"), /\.scheda-rapida\b/);
  assert.equal((stili.match(/^\.scheda-rapida \{/gm) || []).length, 1);
});
