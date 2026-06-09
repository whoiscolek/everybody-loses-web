# Everyone Loses v7.1 — Firebase + Admin Unlock

This version uses the Firebase project config for:

- Firebase Authentication
- Firestore
- Firebase Storage

It also replaces the fake admin email bootstrap with a separate Admin Unlock flow.

## Run locally

```bash
npm install
npm run dev
```

## Firebase already coded in

The Firebase web app config is already in:

```txt
src/firebase.js
```

You do not need `.env` for local testing in this version.

## Firebase Console setup

In Firebase Console for project `everyone-loses`:

1. Authentication → Sign-in method → enable Email/Password.
2. Firestore Database → create database.
3. Storage → get started / enable bucket.
4. Publish rules from:
   - `firestore.rules`
   - `storage.rules`

## Admin unlock

Create a normal account with your real email in the app.

Then open Admin and use:

```txt
Admin code: bitch
Admin password: allmyhomiespackin
```

Change these before deploying by editing `src/main.js`:

```js
const ADMIN_UNLOCK_CODE = "bitch";
const ADMIN_UNLOCK_PASSWORD = "allmyhomiespackin";
```

Important: this is prototype security. Since this is frontend-only, the admin unlock strings are visible in the built app. Before a wider public deployment, admin should move to Firebase custom claims or a Cloud Function.

## First admin steps

1. Sign up with your normal email.
2. Go to Admin.
3. Enter the admin unlock code/password.
4. Click Seed demo events.
5. Create/approve other users from Admin.


## v8 API importer

This version adds a Vercel serverless endpoint:

```txt
/api/espn-events?league=NBA&date=20260608
```

Admin can fetch ESPN scoreboard events from the Admin tab, review the events, and import selected games into Firestore. Manual events remain the fallback and should stay available.

Supported first-pass leagues:

```txt
NBA, NFL, MLB, NHL, NCAA Basketball, NCAA Football, Premier League, MLS, Champions League
```

Local Vite dev may not run Vercel serverless functions by default. The endpoint is intended for the deployed Vercel app or local `vercel dev` testing.


## v8.1 notes

- Removed the old Seed demo events admin card.
- Added API Schedule Sync controls:
  - Sync today across supported leagues
  - Sync tomorrow
  - Manual selected league/date fetch still available
- This is semi-automatic. The next step is a Vercel cron endpoint that runs schedule sync without an admin pressing a button.

## v8.2 notes
- Adds racing leagues to the API sync list: F1, NASCAR, MotoGP.
- Racing imports are ranked-finish events and should be verified in Admin before users bet.
- Adds an Admin button to delete old demo events left in Firestore from earlier builds.


## v8.3 notes

- Racing/Olympics-style ranked events now render as a leaderboard instead of a single arrow-separated result string.
- Team events now render a scoreboard panel with a placeholder for live stats/final stats.
- ESPN remains the default schedule/score source. The Odds API should be treated as an optional paid/limited enhancement later, ideally only after a bet exists on an event so quota is not burned on games nobody is betting.
- NASCAR and MotoGP are still dependent on whether the ESPN endpoints return schedule data for the requested date. If ESPN returns zero events, the app now reports that more cleanly but a second racing-specific source may be needed.


## v8.4 racing endpoint note

NASCAR now uses ESPN's NASCAR Cup Series slug `nascar-premier` instead of the broken `nascar` slug.

MotoGP currently returns a graceful zero-event message because ESPN's scoreboard endpoints used by this app do not expose MotoGP cleanly. Use a manual ranked-finish event for MotoGP until a dedicated MotoGP source is added.


## v8.5 official racing live notes

- NASCAR schedule import still starts from ESPN, but live/final running order is only shown when the NASCAR.com live feed verifies positions. This avoids showing ESPN standings/start-grid data as if it were a live leaderboard.
- IndyCar has been added through ESPN's `racing/irl` league path.
- MotoGP now tries MotoGP PulseLive timing (`/timing-gateway/livetiming-lite`) instead of ESPN. This is live/session-focused, not a full future schedule importer yet.
- API sync now refreshes existing imported events instead of only adding new events, so scores/leaderboards can update when the source updates.


## v8.6.1 league-aware import fix

This fixes an importer bug where an ESPN event ID could be treated as already imported globally even when the existing event was from a different league. API imports now only count as existing when sport + league + source identity match.

This matters for racing because ESPN event IDs can be ambiguous across racing endpoints.


## v8.7 verified F1 results

F1 now prefers Jolpica/Ergast-compatible data for race schedule and final results. ESPN remains a fallback for F1 schedule discovery only.

This prevents ESPN's racing ordering from being displayed as a verified final leaderboard when it is actually not reliable for finishing order.


## v8.8 API duplicate cleanup

Adds an Admin cleanup tool for stale/duplicate API-imported events. This is intended for cases where an older ESPN racing import remains in Firestore after a newer verified source creates the correct race.

The sync/import logic is now race-aware:
- same sport
- same league
- same normalized race title or F1 round
- source confidence keeps verified F1/NASCAR results over unverified ESPN schedule ordering

The cleanup tool will not delete events that already have bets or matches.


## v8.9 safe sync + event maintenance

This build adds safety rules around syncing:
- Sync/refresh never deletes bets, matches, ledger entries, users, or settlements.
- Existing events with bets/matches/ledger keep their betting structure: title, start time, type, short code, and participant list are preserved.
- Sync can still refresh status, score, verified leaderboard/result order, live stats, odds text, source IDs, and intel.
- Admin now has an API event maintenance panel to manually delete stale imported events. Events with bets/matches/ledger are protected and the delete button is disabled.

Use this to remove old broken ESPN/F1 remnants that are not true duplicates by title/source and therefore were not caught by automatic duplicate cleanup.


## v9.0 history + triggered odds

Final events now leave the Today tab and move to History. History renders full event cards, including racing/ranked-finish leaderboards.

Today event stats were cleaned up:
- removed generic Source/Venue display from the main stats row
- shows Status, Odds, Weather, and basic scoreboard/stat state when available

Odds integration:
- Added `/api/odds`
- Odds refresh is triggered after a team bet is created
- Odds failure never blocks, voids, changes, deletes, or settles bets
- Requires `ODDS_API_KEY` in Vercel environment variables to actually call The Odds API
- With no key, it gracefully skips and the app keeps working

The Odds API is intentionally not used for every event by default.


## v9.1 stats/weather + compact history + odds visibility

Today:
- ESPN summary/boxscore data is now attempted for team games.
- Weather is attempted from ESPN first, then from venue city via Open-Meteo when ESPN does not provide it.
- Generic Source/Venue rows are filtered out of the main stat grid.
- Admins get a visible Refresh odds button on team event cards.
- Odds refresh now writes a visible oddsStatus when it skips/fails, instead of failing silently.

History:
- Final events are displayed as compact utility cards.
- Racing/ranked-finish leaderboards remain visible in History.
- History shows matchup/result, game ID, and betting outcome summary.
- It does not repeat the full Today-style odds/weather/stats card.


## v9.2 odds timestamp + repo asset pass

- Fixes The Odds API `commenceTimeFrom` / `commenceTimeTo` formatting by stripping milliseconds from ISO timestamps.
- Keeps v9.1 triggered/manual odds refresh behavior.
- Packages league logo assets under `public/logos/` so the `/logos/...png` references resolve after deployment.
- Polishes the profile picture upload tile so the native browser file input stays hidden and selected filenames display in the app style.
- Keeps `package-lock.json`; do not delete it from the repo.


## v9.3 odds + weather sync fix

- Odds refresh no longer sends `commenceTimeFrom` or `commenceTimeTo` to The Odds API. The app now fetches the league odds board and matches games locally, which avoids the strict timestamp rejection.
- Existing imported events now refresh `weather`, `weatherText`, and `venue` fields during API sync even when bets/matches/ledger records already exist. The protected betting structure is still preserved.
- This should fix live odds refresh still returning `Invalid commenceTimeFrom parameter` and weather not appearing on already-imported cards after sync.


## v9.4 odds/weather display fix

- Live odds refresh now forces the event card display row to read from `oddsLive` instead of stale imported `liveStats` rows.
- Weather display now reads from the refreshed event weather fields instead of stale imported `liveStats` rows.
- Weather geocoding now searches by city first and matches the state when possible, which is more reliable for Open-Meteo than sending `City, State` as the name field.

## v9.5 odds/weather/stats display cleanup

- Odds matching is now stricter. A live odds refresh must match both teams and a nearby start time, preventing the app from showing a spread/total from the wrong game.
- Odds text now labels moneyline, team-specific spread, total, sportsbook, and matched game more clearly.
- Weather now falls back to home-team city/state when ESPN venue weather is missing, so indoor/neutral games can still show outside conditions after sync.
- Today cards no longer show filler rows like "API schedule import," "Weather unavailable," or "Scoreboard active" when better data is unavailable.
- ESPN summary parsing now tries team boxscore stats, player stat leaders, game leaders, and period scoring before falling back to the score.

## v9.6 admin automation + Eastern time

- Adds Admin user management with a delete profile action for dummy accounts. This removes the app user document plus that user's bets, matches, ledger rows, and settlement rows so they disappear from leaderboard/history math.
- Moves display and betting-day logic from Central Time to Eastern Time. The betting day now rolls over at 3:00 AM ET.
- Adds background admin maintenance. When an admin has the app open, the app automatically:
  - syncs today's schedule/scores,
  - syncs tomorrow's schedule,
  - refreshes live odds for active/upcoming team games,
  - cleans duplicate API events,
  - settles final events with matched bets when enough result data is available.
- Manual sync, cleanup, settle, and refresh-odds buttons remain available as backup controls.
- Refresh odds buttons remain admin-only.

## v9.7 ESPN-first odds + protected Odds API automation

- ESPN/imported odds remain the default odds display for schedule browsing.
- The Odds API is no longer automatically called for every active/upcoming event.
- Automatic Odds API refresh now only runs for team events that already have betting interest, meaning at least one bet or match exists.
- Automatic Odds API refresh uses per-event cooldowns:
  - Pregame: roughly once per hour.
  - Live: roughly once every 20 minutes.
- Automatic Odds API refresh has a local admin daily cap of 25 requests per betting day.
- Admin manual Refresh odds buttons remain available as backup controls.
- Schedule syncing, duplicate cleanup, and final settlement automation are unchanged.


## v9.8 Odds API lock

- The board is ESPN/imported-odds first.
- The Odds API cannot be manually or automatically refreshed for an event until that exact event has at least one bet or match.
- Admin refresh odds remains available only after betting interest exists.
- Existing stale Odds API data on unbet events is hidden from the Today card so it does not look like the default source.

## v9.9 browser tab icon

- Adds a thumbs-down favicon as a small browser-tab easter egg.
- Keeps v9.8 odds behavior: ESPN/imported odds by default, Odds API only when an event has betting interest.


## v10.5 double-up

- Adds a live-only Double Up control for matched bets.
- The control only appears to the two users in that specific matched bet.
- It only appears after the game/card has begun and disappears once the event is final.
- Both users must confirm the same match before the amount doubles.
- Double-up state is stored on the match, so multiple matched bets on one event can be doubled independently.


## v10.9 proper IndyCar live timing

- Based on v10.8, not the rejected manual-override version.
- Keeps IndyCar automatic only; no manual racing override UI was added.
- Strengthens the INDYCAR live leaderboard fetcher to try official JSON-style endpoints first, then parse the official leaderboard pages with cache-busting and browser-like headers.
- If the official live leaderboard exposes positions during an active session, the IndyCar card updates from that source.


## v10.26 MLB live sweep

- Adds an MLB-specific automatic live sweep that queries MLB Stats API directly for today plus neighboring date edges.
- This can add active MLB games that were missed by the regular import, instead of only refreshing games already present on the board.
- Keeps v10.25 live-state protection so blank/stale updates do not erase good scores.


## v10.27 Now board window

- Renames the Today tab label to Now.
- Now only displays live/active/non-final events within a 48-hour lookahead window.
- Existing far-future imports stay in Firestore but are hidden from the main board so random June 11+ games do not crowd out the actual slate.


## v10.28 Now window completeness sync

- Adds a real Now-window sync that fetches every supported league/date needed to cover the next 48 hours.
- The app now syncs first, then filters display, instead of merely hiding far-future games after partial imports.
- Manual Admin button added: Sync full Now window.
- Auto-maintenance uses the full Now-window sync instead of disconnected today/tomorrow syncs.


## v10.30 MLB sync stabilization

- MLB now has a dedicated force-sync path instead of relying on the broad multi-league batch.
- Full Now-window sync delegates MLB to that dedicated path.
- Added Admin button: Force MLB live sync.
- Added MLB debug output showing fetched/added/updated/skipped by date.
- Firestore event writes are sanitized to remove undefined values.
- MLB matching now directly keys on mlbGamePk so updates hit the same event reliably.


## v10.31 Automatic source discovery sweeps

- The Force MLB button remains as a backup diagnostic only.
- Automatic maintenance now runs a source sweep for every supported league in the 48-hour Now window.
- MLB's dedicated Stats API sync runs as part of the automatic sweep instead of requiring manual intervention.
- Startup/focus triggers a Now-window discovery sync so missing games can populate without checking Google.
- Admin now shows Source sweep debug in addition to MLB debug.
