# Sotterranei & Dragoni

A web companion app for a Dungeons & Dragons (5th Edition) home campaign, built to be used
by both players and the Dungeon Master during live sessions — character management, party
tools, and (eventually) shared session utilities like music and maps, all in one place.

This is a personal project built for a specific group of friends and their ongoing campaign,
not a general-purpose product. The code is public mostly for transparency and as a build log;
it isn't set up to onboard outside users or accept contributions at this time.

## What it does today

- **Accounts & roles** — players sign themselves up and verify their email; the admin
  approves each new account before it can see anything of the campaign. The campaign
  owner (admin) and the Dungeon Master each get a distinct view and distinct capabilities.
- **Admin tools** — manage registered users, assign roles, trigger password resets.
- **Dungeon Master tools** — a party roster view and level-up controls, for a single player
  or the whole party at once.
- **Images** — each player uploads a portrait for their character, shown on the sheet and
  as an icon in the party. The Dungeon Master keeps a content library (maps, places, NPCs,
  enemies, items, handouts) with private notes and tags, links items to sessions, shows them
  live during play to the whole party or to chosen players, and decides which ones end up in
  each player's campaign archive when the session closes.
- **Combat tracker** — the Dungeon Master starts a fight from the session page; players
  roll or type their own initiative, the DM adds enemies (optionally with a library image),
  tracks their hit points privately and advances turns and rounds, while everyone sees the
  order, whose turn it is and a vague health status for each enemy, live.
- **Guided character creation** — on a new sheet a step-by-step guide, tailored to class
  and race, walks the player through background, skills, class features, equipment,
  spells and level-ups up to the campaign's starting level, which the Dungeon Master sets
  for the whole party in one click.
- **Notifications** — players get notified when their character levels up, when the DM
  proposes dates or confirms a session and when a session starts, with a persistent
  notification history; the same alerts can arrive as push notifications on the phone
  (installed app) or the computer, even with the app closed.
- **Fantasy-themed UI** — designed to feel in-keeping with the tabletop experience, and to
  work on desktop, tablet, and phone alike.
- **Installable app** — the site can be installed on a phone (PWA): its own icon, full
  screen, instant start from the saved copy, an "offline" page and an in-app notice when a
  new version is published. Opening the installed app plays a short 3D intro: a d20 rolls
  in, lands on a natural 20 and turns into the app icon.

## Where it's headed

- Interactive character sheets (5th Edition rules)
- Shared music control for the Dungeon Master (Spotify / YouTube playlists)
- Session notes / lore board for discoveries made during play
- Maps, fog of war, and character tokens

## How it's built

A static site (hosted on GitHub Pages) backed by Firebase for authentication and shared
data — no custom backend server. Plain HTML/CSS/JS, no build step.

Since there is no backend and the Firebase config is public, all access control lives in
`firestore.rules`; the page-level checks are only UI. The rules are covered by an
automated test suite running on the Firestore emulator — see `test/regole/README.md`.
Uploaded images are guarded the same way by `storage.rules`; the Console-side
safeguards against unexpected costs are listed in `docs/sicurezza-e-costi.md`.
Every page also ships a Content Security Policy (no inline scripts: each page's code
lives in `assets/js/pagine/`), checked by `test/pagine`. Both suites run on GitHub
Actions for every pull request.

The service worker (`sw.js`) saves every page and asset of the current version on the
device. After changing any file of the site, run `node strumenti/aggiorna-sw.mjs`: it
refreshes the file list and the version fingerprint in `sw.js`, so installed apps pick up
the new version (`test/pagine` fails if you forget).

Third-party files shipped with the site: Three.js (`assets/vendor/`, MIT license) for the
intro animation and the Cinzel typeface (`assets/fonts/`, SIL Open Font License).

Any Dungeons & Dragons rules content referenced by this project is based on the freely
licensed System Reference Document (SRD); this project is not affiliated with or endorsed
by Wizards of the Coast.
