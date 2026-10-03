// Riconoscimento dei link YouTube incollati dal DM in Controllo musica.
import { test } from "node:test";
import assert from "node:assert/strict";
import { interpretaLinkYouTube, sorgenteDaStato } from "../../assets/js/youtube.js";

const video = (id) => ({ tipo: "video", id });
const playlist = (id) => ({ tipo: "playlist", id });

test("link a un singolo video, in tutte le forme comuni", () => {
  assert.deepEqual(interpretaLinkYouTube("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), video("dQw4w9WgXcQ"));
  assert.deepEqual(interpretaLinkYouTube("https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s"), video("dQw4w9WgXcQ"));
  assert.deepEqual(interpretaLinkYouTube("https://m.youtube.com/watch?v=dQw4w9WgXcQ"), video("dQw4w9WgXcQ"));
  assert.deepEqual(interpretaLinkYouTube("https://music.youtube.com/watch?v=dQw4w9WgXcQ"), video("dQw4w9WgXcQ"));
  assert.deepEqual(interpretaLinkYouTube("https://youtu.be/dQw4w9WgXcQ?si=abc"), video("dQw4w9WgXcQ"));
  assert.deepEqual(interpretaLinkYouTube("https://www.youtube.com/shorts/dQw4w9WgXcQ"), video("dQw4w9WgXcQ"));
  assert.deepEqual(interpretaLinkYouTube("https://www.youtube.com/embed/dQw4w9WgXcQ"), video("dQw4w9WgXcQ"));
  assert.deepEqual(interpretaLinkYouTube("  dQw4w9WgXcQ  "), video("dQw4w9WgXcQ"));
});

test("link a una playlist (anche aperta da un video della playlist)", () => {
  const id = "PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG";
  assert.deepEqual(interpretaLinkYouTube(`https://www.youtube.com/playlist?list=${id}`), playlist(id));
  assert.deepEqual(interpretaLinkYouTube(`https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=${id}&index=3`), playlist(id));
  assert.deepEqual(interpretaLinkYouTube(id), playlist(id));
});

test("rifiuta link di altri siti e testo non valido", () => {
  assert.equal(interpretaLinkYouTube("https://evil.example/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(interpretaLinkYouTube("https://www.youtube.com/watch?v=<script>"), null);
  assert.equal(interpretaLinkYouTube("javascript:alert(1)"), null);
  assert.equal(interpretaLinkYouTube("ciao a tutti"), null);
  assert.equal(interpretaLinkYouTube(""), null);
});

test("legge lo stato salvato, anche nel formato precedente", () => {
  assert.deepEqual(sorgenteDaStato({ tipo: "video", id: "dQw4w9WgXcQ", indice: 0 }), video("dQw4w9WgXcQ"));
  assert.deepEqual(sorgenteDaStato({ playlistId: "PLabc123456789" }), playlist("PLabc123456789"));
  assert.equal(sorgenteDaStato(null), null);
});

test("elenco dei link salvati: aggiungi, rinomina, togli, niente doppioni", async () => {
  const { aggiungiLinkSalvato, rinominaLinkSalvato, togliLinkSalvato, linkSalvatiDa, MASSIMO_LINK_SALVATI } = await import("../../assets/js/youtube.js");
  let lista = aggiungiLinkSalvato([], playlist("PLabc"), "  Cripta  ");
  lista = aggiungiLinkSalvato(lista, video("dQw4w9WgXcQ"), "");
  assert.deepEqual(lista, [{ tipo: "playlist", id: "PLabc", nome: "Cripta" }, { tipo: "video", id: "dQw4w9WgXcQ", nome: "Video" }]);
  lista = aggiungiLinkSalvato(lista, playlist("PLabc"), "Cripta 2");
  assert.equal(lista.length, 2);
  assert.equal(lista[1].nome, "Cripta 2");
  assert.equal(rinominaLinkSalvato(lista, video("dQw4w9WgXcQ"), "Taverna")[0].nome, "Taverna");
  assert.equal(rinominaLinkSalvato(lista, video("dQw4w9WgXcQ"), "   "), lista);
  assert.deepEqual(togliLinkSalvato(lista, playlist("PLabc")).map((x) => x.id), ["dQw4w9WgXcQ"]);
  assert.deepEqual(linkSalvatiDa({ youtube: [{ tipo: "video", id: "a", nome: "x" }, { tipo: "altro", id: "b", nome: "y" }, null] }), [{ tipo: "video", id: "a", nome: "x" }]);
  assert.deepEqual(linkSalvatiDa(undefined), []);
  let molti = [];
  for (let i = 0; i < MASSIMO_LINK_SALVATI + 5; i += 1) molti = aggiungiLinkSalvato(molti, video(`v${i}`), `n${i}`);
  assert.equal(molti.length, MASSIMO_LINK_SALVATI);
});
