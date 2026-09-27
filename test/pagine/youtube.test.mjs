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
