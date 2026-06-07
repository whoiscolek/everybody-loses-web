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
