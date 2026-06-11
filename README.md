# Everyone Loses v10.43

Head-to-head sports betting battles for friends.

## Current version

This repo is currently on the v10.x Firebase/Vercel build line.

v10.43 is based on v10.42, which uses the stronger v10.40 frosted topbar styling and discards the v10.41 topbar experiment.

## Core features

- Firebase Authentication
- Firestore-backed users, events, bets, matches, ledger entries, and settlements
- Firebase Storage profile picture uploads
- Admin approval and user/profile management
- Now board with a 48-hour event window
- Automatic source discovery sweeps for supported leagues
- Live score refreshes
- ESPN/imported odds first, with Odds API locked until a matchup has a matched bet
- Double Up requests for live matched bets
- History tiles with event result, bet summary, display code, internal game ID, and external refs
- Profile, stats, ledger, leaderboard, history, about, and admin tabs
- Liquid-glass dark UI styling

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Firebase setup

The Firebase web app config is in:

```txt
src/firebase.js
```

Firebase services used:

- Authentication
- Firestore
- Storage

Publish/update rules from:

```txt
firestore.rules
storage.rules
```

## Vercel environment variables

The app can run without every optional service, but these variables may be used depending on enabled features:

```txt
ODDS_API_KEY
RESEND_API_KEY
NOTIFICATION_FROM_EMAIL
APP_URL
```

`RESEND_API_KEY` is only needed for email notifications.

`ODDS_API_KEY` is only needed for locked/matched-bet Odds API usage. Default event odds should use imported/ESPN-style odds first.

## Admin/security note

This prototype still includes client-side admin unlock logic. That is convenient for private testing but is not ideal for a public app because frontend code can be inspected.

Before wider use, move admin authorization to Firebase custom claims or a trusted server-side function.

Do not publish real admin passwords, API keys, or private credentials in this README.

## Version notes

- v10.33 fixed team-event identity so repeated matchups are no longer merged by title.
- v10.38 rebuilt History into compact glass tiles and improved nav/header styling.
- v10.40 removed the Now-board hero tile and widened/strengthened the desktop topbar.
- v10.42 rolled back to the better v10.40 topbar styling after the v10.41 experiment.
- v10.43 cleans up this README so GitHub no longer says v7.1.


## v10.44 auth palette + mobile nav polish

- Recolors login/signup inputs and auth panel to match the darker glass UI.
- Improves placeholder/readability for auth fields.
- Replaces glitchy mobile tab bouncing with direct active-tab centering after render.


## v10.45 mobile topbar compaction

- Moves the mobile logout button into the title row on the right when logged in.
- Keeps the profile pill below the title row without forcing logout onto its own full line.
- Reduces mobile topbar height while keeping the same glass styling.


## v10.46 double-up challenge window

- Double-up is now a 5-minute challenge instead of an indefinite request.
- Only the opponent can accept a pending double-up request.
- Everyone can see the pending challenge and countdown on the event activity card.
- If the timer expires, either involved bettor can initiate a new double-up challenge.
- Adds an opponent email notification endpoint for double-up requests.


## v10.47 double-up settlement repair

- Final settlement now uses the effective match amount, including accepted double-ups.
- Team settlement is now idempotent/repairable: it creates or updates one ledger row per match.
- Existing final events with settled matches but missing/wrong ledger rows are included in automatic settlement repair.
- History can display winner/loser from settled matches even if a ledger row has not loaded yet.
- Ledger rows now store matchId, settledAmount context, and doubledUp metadata.


## v10.48 My Bets active-only cleanup

- Renames “My bet entries” to “Current Bet Entries.”
- Filters Current Bet Entries to active non-settled bets only.
- Filters My Matched Battles to current active matched battles only.
- Settled/final-event history remains in Ledger and History instead of duplicating on My Bets.

## v10.49 notification diagnostics + scoped matchup emails

- Adds Admin notification diagnostics with a manual test email button.
- New bet notifications still go to all opted-in approved users except the bettor.
- Matchup accepted notifications now go only to the user whose open bet was matched.
- Double-up notifications remain scoped only to the opponent involved.
- Notification requests now show last sent/skipped/failed details in Admin so Resend/profile-toggle problems are visible.


## v10.50 immediate settlement UI

- Settlement now optimistically updates local ledger/match state immediately after Firestore write success.
- Ledger, leaderboard, profile, and history no longer need to wait for the snapshot round trip in the admin browser.
- Adds a visible settlement sync notice so a successful post does not look like a missing ledger entry.
- Admin manual settlement now passes the real Firestore event id when available.


## v10.51 F1 verified race imports

- F1 now uses Jolpica/Ergast schedule/results only instead of falling back to ESPN racing schedule data.
- F1 imports the actual Grand Prix race date when syncing the race-weekend lead-in window, preventing Friday practice/session dates from appearing as the race.
- Pregame F1 entries now use the current driver standings entry list/fallback full grid instead of the old 10-driver placeholder list.


## v10.52 desktop odds placement

- Moves team-game odds into the desktop event header next to the matchup details.
- Removes the separate odds box from the desktop scoreboard panel to shorten cards.
- Leaves the mobile odds layout unchanged.


## v10.53 root-cause Now-board render isolation

- Replaces the discarded guessed v10.53.
- Based directly on v10.52.
- The only v10.52 JavaScript change on the Now board was header odds rendering.
- Makes header odds rendering non-fatal and wraps each event card render independently, so one malformed event/odds payload cannot blank the entire active MLB board.
- Does not add new MLB sync/self-heal assumptions.


## v10.55 F1 stale-event repair + desktop density

- Repairs the stale F1 Friday/session event problem by matching verified Jolpica F1 races to older ESPN-style race-weekend imports and updating that existing event instead of leaving the stale event visible.
- Allows trusted Jolpica F1 refreshes to correct title/start time/participants even if the stale event has betting records.
- Keeps desktop odds in the event header, but makes odds text smaller and less bold.
- Moves desktop team stats/weather lower in the scoreboard area and moves the admin Refresh odds button next to Clear my bets.
