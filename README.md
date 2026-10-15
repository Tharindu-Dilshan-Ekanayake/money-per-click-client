# +1 Money Per Click 💸

A Bloxity web game inspired by Roblox's **"+1 Money Per Click"**: click and walk to earn
money, pay your way through stage gates for Wins, level up from a skinny **Brokie** into
a **bodybuilder**, rebirth for permanent multipliers, hatch pets, and AFK at training
tables — with up to 8 players per lobby. Built with React Three Fiber, Rapier physics, the
Bloxity SDK and a Colyseus server hosted on Boxity Legion.

## Quick start

```bash
# 1. Game server (multiplayer lobbies + leaderboard)
cd money-per-click-server
npm install
npm run dev                 # http://localhost:2567

# 2. Client (the game)
cd ../money-per-click-client
npm install
npm run dev                 # http://localhost:5173
```

`.env.development` points the dev client at the local server. Without a server the game
still runs: you just play alone and the leaderboard boards show only your own stats.
Open a second browser tab to see two players in the same lobby.

> **Singlish quick guide:** mulinma `money-per-click-server` eke `npm install` saha
> `npm run dev`. Ita passe `money-per-click-client` eke `npm install` saha `npm run dev`
> karala browser eke `http://localhost:5173` open karanna. Tab dekak open kalama players
> dennek ekama lobby eke penawa. Game eke numbers (prices, speed, pets...) okkoma
> `src/game/core/config.js` eke thiyenne.

## How the game plays

| System | What it does |
| --- | --- |
| **Click** | Click / tap anywhere: `cash × boosts × Multiplier` money + XP. Fast clicks build a combo (up to +25%), and 4% of clicks are a **CRIT x5** (gold burst, sound, screen shake). |
| **Walk** | Every 1.6 units walked pays half a click. |
| **Multiplier** | Like the original: **only from rebirths** — x1, then x2, x4, x8 … Pets, the Wins Shop and 2x boosts are separate bonuses. |
| **Stage gates** | Indoor, roofed corridor. See-through glass doors: **green** when you can afford the next one, **red** when you can't, price written on the next door. Walk into it: the price is deducted and the door opens. Not enough money = the door stays shut. |
| **WIN pads** | One per room. Step on it for Wins (deeper rooms pay more); you're sent back to spawn and the gates close. |
| **Level + MAX** | Clicks, steps and AFK give XP. Levels cap at **MAX 25**, then 32, 40, 49, 59 … — reach MAX to rebirth. |
| **Rebirth** | At MAX level. Resets level, money and money boosts; **doubles the Multiplier**, raises MAX level, +10% XP, +50% Wins and unlocks training tables. |
| **Body** | Grows with **lifetime** levels (all levels ever, across rebirths), so rebirth never shrinks you. A stick-thin poor Brokie (standing upright, arms a little out) → a rich gym-built V-taper bodybuilder (about 2–3 h). You show your cash off held up in your right hand; buff players flex when idle. Speed grows the same way. Limbs are thinned on the mesh, not by scaling bones, so bent elbows and knees never squash. |
| **Titles** | Brokie → Penny Pincher → Hustler → Rich Kid → Baller → Millionaire → … → Richest In The World. |
| **Better Cash** | 15 pedestals (+1, +3, +15, +52.5 … +900M Money per click), bought with Wins (the first costs 1), kept forever. Walk onto one to unlock/equip; you hold the equipped cash in your hand. |
| **Money boosts** | Click / Walk / AFK +10% per level, bought with money (+15% price each). Stand on the boost pads to keep buying. Reset on rebirth. |
| **Wins Shop** | Permanent Money / XP / Wins / Speed / Egg Luck boosts and extra pet slots. |
| **Training tables** | A ring of tables around a golden dumbbell. Stand on a rug to earn every second (x3 free, x6 at 1 rebirth, x12 at 3 … x500 at 13). 10 minutes at a table gives 5 minutes of 2x money. |
| **Multiplayer** | Lobbies of up to 8 players: everyone's avatar, body, held cash, pets, trail, name tag, emotes, chat bubbles and clicks (you see their cash-pump and flying bills, they see yours). When someone levels up, gets a title, rebirths, unlocks better cash or wins a stage, it pops up over their head (and they cheer). One copy per player: a reload or second tab replaces the old one, and a closed tab disappears at once. No connection messages are ever shown. |
| **AFK** | AFK means logged in but not playing: no moving, clicking or keys. Your own HUD shows "💤 AFK - 2x money in m:ss" (nobody else sees it); every 10 minutes of AFK pays 5 minutes of 2x money. Closing the game is not AFK — that pays offline earnings instead. |
| **One tab** | Every tab of a browser shares the same guest/account and save, so only one plays at a time: opening the game in a new tab pauses the old one ("Play here" takes it back). |
| **Pets** | 5 eggs (Common → Legendary) bought with Wins, 20 pets, Golden/Rainbow evolutions (3 → 1). They follow you around. |
| **Trails** | Speed trails bought with Wins. |
| **Rewards** | **Daily gift** (pops up when you join, 7-day streak ending in a Rare pet), playtime gifts, lucky money bags, offline earnings while the game is closed (50% of your training table's income, max 8 hours). Wins and rebirths fly from your character into the counters (top-left) and you cheer. |
| **Money rain** | Every hour on the hour (UTC, so everyone online sees it together) cash rains around you in the lobby for 45 s: walk over bills for a small bonus each. A HUD chip counts down from 10 minutes before, with a heads-up a minute before. |
| **Weekly leaderboards** | The four boards (Money, Levels, Rebirths, Wins) rank what players earned **this week** and reset every Monday 00:00 UTC; each board shows when it resets. |
| **Account** | No log in / log out buttons: the game signs in with the account you're logged in to on the Bloxity site as it loads, or plays you as a guest. Locally a name tag (top-right) shows your picture, name and title; on bloxity.io the portal shows your name, so ours is hidden. |
| **First-time guide** | 5 steps with glowing arrows along the ground (routed through the corridor mouth and gate openings) and a marker over each goal: go to the training table → train to $100 → go through the $100 gate → step on the WIN pad → unlock +3 Money. Then +10 Wins and the guide ends; a "next goal" banner takes over. |
| **HUD** | Left: Rebirths + Wins counters, then Shop (cash, boosts, Wins Shop, speed and pets all inside), Rebirth and Rewards - icon buttons with key hints. Top-right: Music and Settings. The top band is always kept free for the Bloxity portal's own logo/menu (left) and username/Friends/Avatar/Bux (right), so the layout is the same locally and on bloxity.io; on phones the joystick and JUMP sit beside a compact level bar. |

## Controls

| Desktop | Mobile |
| --- | --- |
| W / S (or ↑ / ↓) walk · A / D (or ← / →) turn the camera · Space jump | Joystick + JUMP button |
| Left click earn money | Tap to earn |
| Right-drag rotate camera · scroll zoom | Drag to look |
| B Shop · R Rebirth · G Rewards · M music | Tap the buttons |
| E / R open eggs (x1 / x3) at an egg · Esc close windows | On-screen Open buttons |

## Project map

```
src/
  game/
    core/        config.js (ALL balance numbers) · formulas.js (pure math) · store.js
                 (zustand game state + actions) · save.js (localStorage + offline)
                 layout.js (world positions, shared by visuals and triggers) · format.js
    world/       blocky map: Terrain, StageCorridor (gates + WIN pads), UpgradeArea,
                 TrainingArea, PetArea, Leaderboards, shared materials/models
    systems/     ZoneSystem (per-frame triggers) · GameLoop (timers, autosave, save slots)
    net/         multiplayer (Colyseus via the Boxity matchmaker) · remote players ·
                 leaderboard API · endpoints (which backend this build talks to)
    fx/          money bursts, shockwaves, guide arrows, lucky bags, trail, nameplate, held cash
    pets/        procedural pet models + followers
    audio/       synthesized sound effects + background music (Web Audio, no files)
    avatarRig.js physique (body transformation) + procedural animation
  ui/            HUD, icons (SVG), panels (Shop with Cash/Boosts/Wins/Speed/Pets tabs, Rebirth,
                 Rewards, Settings), overlays (daily gift, offline, tab paused, hatch)
```

## Tuning the game

Everything lives in [`src/game/core/config.js`](src/game/core/config.js): stage prices
and Wins, upgrade costs, XP curve, rebirth cost, table unlocks, pets and odds, trails,
daily rewards, tutorial steps.

The current balance was checked with a simulated player (~3 clicks/s, idle 40% of the time):
first rebirth (level 25) at ~9 min, then ~13, 18, 23, 32, 43 … minutes apart; Better Cash
+15 at ~13 min and +2.4M at ~1 h 45 min; full bodybuilder at ~2 h 20 min. Big changes can
make the economy explode (or stall), so re-check pacing after editing.

## Boxity SDK features

- Login, guest identity, avatar (with face/shirt/pants skin texture, hair, masks, neck/chest/waist
  items, gloves and shoes) and live body proportions.
- **Emotes:** registered on boot; Boxity draws the picker and the game plays the clip on your
  avatar (moving cancels it).
- **Portal settings** (when embedded on bloxity.io): master/music volume, graphics quality,
  camera sensitivity and an FPS counter.
- Portal **respawn** button, **chat bubbles** above your name tag, loading screen and
  `gameplayStart`/`gameplayEnd`.
- **Multiplayer:** `net.resolveEndpoint` (matchmaker seat, a new Colyseus client per
  resolve, backoff retries) and `game.updateRoom` with the joined room id.
- Not used yet: parties UI, CrazyGames instant join, Gems purchases and profile stats (they
  need SKUs / server-owned progress).

## Hosting on Boxity

`.github/workflows/deploy.yml` builds the game and uploads `dist` as a zip on every push:

| Branch | Channel | URL |
| --- | --- | --- |
| `dev` | dev | https://1-money-per-click.dev.play.bloxity.io |
| `main` | prod | https://1-money-per-click.play.bloxity.io |

Add the repository secret `LEGION_DEPLOY_TOKEN` (same token as the server repo). The build
bakes in no server URLs: on `*.play.bloxity.io` the game uses the matching
`*.host.bloxity.io` backend for HTTP and joins lobbies through the matchmaker. The server
deploy is described in `money-per-click-server/README.md`.

## Performance (low-end PCs and phones)

- Static world geometry is merged into one mesh per material (`StaticBatch`): about
  1000 draw calls per frame went down to under 300 with no visual change, and shadow
  casters from 514 to ~100.
- Far-away stage rooms (labels, trophies, doors) are hidden by distance (`DistanceCull`).
- Repeated props are pre-merged or instanced: cash stacks, trophies, eggs, clouds,
  wall trees, flowers, money-rain bills.
- Leaderboard tables are two text objects per board (per-row colors), not two per row.
- Adaptive resolution: only when a device can't hold ~45 FPS does it render fewer
  pixels, and never below the screen's normal resolution. The camera far plane stops
  just past where the fog already hides everything.

## Notes

- **Saves** are per account in `localStorage` (Bloxity has no cloud save). A guest's
  progress moves to their account the first time they log in.
- **Leaderboard trust:** the player is identified by their verified Boxity token (guests
  aren't ranked in production), but the stats themselves are still client-reported.
- **Audio** is generated in code, so there are no sound files to license.
