# Sotterranei e Dragoni

A web companion app for a Dungeons & Dragons (5th Edition) home campaign, built to be used
by both players and the Dungeon Master during live sessions — character management, party
tools, and (eventually) shared session utilities like music and maps, all in one place.

This is a personal project built for a specific group of friends and their ongoing campaign,
not a general-purpose product. The code is public mostly for transparency and as a build log;
it isn't set up to onboard outside users or accept contributions at this time.

## What it does today

- **Accounts & roles** — players sign themselves up; the campaign owner (admin) and the
  Dungeon Master each get a distinct view and distinct capabilities.
- **Admin tools** — manage registered users, assign roles, trigger password resets.
- **Dungeon Master tools** — a party roster view and level-up controls, for a single player
  or the whole party at once.
- **Notifications** — players get notified in-app when their character levels up, with a
  persistent notification history.
- **Fantasy-themed UI** — designed to feel in-keeping with the tabletop experience, and to
  work on desktop, tablet, and phone alike.

## Where it's headed

- Interactive character sheets (5th Edition rules)
- Shared music control for the Dungeon Master (Spotify / YouTube playlists)
- Session notes / lore board for discoveries made during play
- Maps, fog of war, and character tokens

## How it's built

A static site (hosted on GitHub Pages) backed by Firebase for authentication and shared
data — no custom backend server. Plain HTML/CSS/JS, no build step.

Any Dungeons & Dragons rules content referenced by this project is based on the freely
licensed System Reference Document (SRD); this project is not affiliated with or endorsed
by Wizards of the Coast.
