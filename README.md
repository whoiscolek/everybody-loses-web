# Everyone Loses v10.60

Head-to-head sports betting battles for friends.

## v10.65 interaction stability

- Stops the Double Up countdown from rebuilding the entire application every second.
- Preserves active form values, focus, text selection, page position, and navigation scroll during unavoidable live-data renders.
- Defers passive Firestore renders while a user is actively editing a field, then applies them when editing ends.
- Hardens navigation tab clicks so Admin and other tabs respond consistently during live updates.

## What changed in v10.60

v10.60 replaces the browser-dependent refresh/settlement system with one server-side maintenance pipeline.

The sport feeds are still league-specific:

- MLB: MLB Stats API, with ESPN only for supplemental weather/odds
- F1: Jolpica/Ergast
- NASCAR: NASCAR official live data when available
- IndyCar: INDYCAR official live timing when available
- MotoGP: MotoGP PulseLive when available
- NBA, NHL, NFL, NCAA, soccer, World Cup, MLS, Champions League, UFC: ESPN league-specific endpoints

The shared server pipeline now handles what happens after retrieval:

1. Discover the full Now window.
2. Refresh existing live/upcoming events.
3. Correct status, scores, clocks, stats, dates, and result order.
4. Remove stale events from Now when their source no longer verifies them.
5. Mark final events as History.
6. Settle matched bets idempotently.
7. Close matched and unmatched bet entries for final events.
8. Write deterministic ledger entries so all users receive the same result.
9. Update Profile and Leaderboard through Firestore listeners.
10. Clean final event/bet/match records after five days while preserving ledger history.

The browser no longer performs routine finalization or settlement writes. Opening an approved account triggers a quick server refresh, but scheduled maintenance is what makes the app work when nobody has it open.

## Required one-time setup

### 1. Firebase Admin credentials in Vercel

In Firebase Console:

1. Open **Project settings**.
2. Open **Service accounts**.
3. Generate a new private key.
4. Copy the JSON into a Vercel environment variable named:

```txt
FIREBASE_SERVICE_ACCOUNT_JSON
```

Store it as one JSON string. Do not commit the service-account file to GitHub.

Alternative split variables are supported:

```txt
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

### 2. Maintenance secret in Vercel

Generate a long random value and add:

```txt
MAINTENANCE_SECRET
```

Also keep:

```txt
APP_URL=https://everybody-loses-web.vercel.app
```

or replace it with the production domain.

### 3. Scheduled trigger

This repo includes:

```txt
.github/workflows/server-maintenance.yml
```

In GitHub repository settings, add these Actions secrets:

```txt
MAINTENANCE_URL=https://everybody-loses-web.vercel.app
MAINTENANCE_SECRET=<same value used in Vercel>
```

The workflow calls the maintenance endpoint every five minutes. It can also be run manually from the GitHub Actions page.

### 4. Deploy Firestore rules

Publish the included:

```txt
firestore.rules
```

The new rules make routine event and ledger writes server-controlled. Users can still place and match bets, accept double-ups, and read their own ledger.

### 5. Redeploy Vercel

Redeploy after adding the environment variables.

## Maintenance endpoint

Scheduled/full run:

```txt
GET /api/maintenance?mode=auto
Authorization: Bearer <MAINTENANCE_SECRET>
```

Quick refresh for already-known events:

```txt
POST /api/maintenance?mode=quick
```

Approved clients call the quick mode on startup and when returning to the app. A Firestore lease prevents overlapping runs.

## Admin health monitor

Admin now includes a **Server maintenance** card showing:

- whether maintenance is healthy or stale
- how long ago the last successful run occurred
- source request totals
- ledger writes from the last run
- the most recent server error
- a manual **Run server refresh now** button

## Important settlement behavior

- Team win/loss: loser owes winner the effective matched amount.
- Accepted double-up: settlement uses the doubled amount.
- Draw/tie: matched bets are voided and no ledger debt is created.
- Unmatched bets on final events: marked expired so they disappear from My Bets.
- Ledger IDs are deterministic by event + match, preventing duplicate settlement rows.
- Existing event IDs and source IDs are normalized during settlement.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Other optional environment variables

```txt
ODDS_API_KEY
RESEND_API_KEY
NOTIFICATION_FROM_EMAIL
APP_URL
```

`ODDS_API_KEY` remains limited to matched-bet odds workflows. ESPN/imported odds remain the default display.
## v10.62 changes

- Added a Now-tab bet activity filter with All games, bets placed, active matched bets, and no bets.
- Team and country matchups now display full names instead of abbreviations whenever imported source data provides them.
- Refreshing an existing team event updates its display names even when bet structure is protected.

