# Everybody Loses v10.68

Head-to-head sports betting battles for friends.

## What v10.68 fixes

### 1. Vercel repair and maintenance crashes

v10.67 installed `firebase-admin` 14 while still pinning the project to Node 20. Firebase Admin 14 requires Node 22 or newer, so Vercel could terminate `/api/repair-matchup` and `/api/maintenance` before either handler returned its own diagnostic JSON.

v10.68:

- pins the repository and Vercel functions to Node `22.x`
- includes `.nvmrc` with Node 22
- keeps `firebase-admin` 14
- reports the runtime version in maintenance and repair responses
- retains the browser-side admin repair path as a fallback

A game being live does not prevent an administrator from repairing its matchup.

### 2. Completed World Cup games remaining in Now

v10.68 strengthens the entire finalization path:

- recognizes ESPN `Full Time`, `FT`, `completed`, `state: post`, common final status, and soccer status ID 28
- bypasses browser and CDN caches on score requests
- refreshes the current deployment rather than trusting a potentially stale `APP_URL`
- matches legacy events by league, scheduled date/time, and both teams when source IDs differ
- checks adjacent dates for live events and events with unsettled matches
- moves a verified final event to History immediately
- settles win/loss matchups idempotently
- voids both the match and its matched bet records when a game ends in a draw
- expires unmatched bets after the final result

### 3. World Cup weather

ESPN soccer venues sometimes provide locations as one field such as `Arlington, Texas`, or provide a city and country without a US state. v10.68 separates city/state and uses country-aware Open-Meteo geocoding. When weather genuinely cannot be resolved, the card now says `Weather unavailable for this venue` instead of telling the user to sync repeatedly.

### 4. Matchup repair

The Admin repair action first writes directly through the signed-in administrator. It can reuse existing bets or create a missing bet record under the included v10.68 Firestore rules. The secure Vercel endpoint remains available as a fallback and now runs under the compatible Node runtime.

## Required deployment steps

### 1. Replace the repository files and push to GitHub

Use the complete v10.68 package, including:

- `package.json`
- `package-lock.json`
- `.nvmrc`
- `api/`
- `src/`
- `firestore.rules`
- `.github/workflows/server-maintenance.yml`

### 2. Confirm Node 22 in Vercel

The repository requests Node `22.x`. In Vercel, also check:

**Project → Settings → Build and Deployment → Node.js Version**

If the project has a manual override, set it to **22.x**. Then redeploy the latest commit. A cache-free redeploy is appropriate after changing the runtime.

### 3. Keep Firebase Admin credentials in Vercel

Preferred variable:

```txt
FIREBASE_SERVICE_ACCOUNT_JSON=<complete service-account JSON>
```

Alternative split variables:

```txt
FIREBASE_PROJECT_ID=everyone-loses
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
```

Do not commit the service-account file or private key.

### 4. Deploy the included Firestore rules

Pushing to Vercel does not publish Firebase rules. Publish `firestore.rules` once through Firebase Console, or run:

```bash
firebase deploy --only firestore:rules
```

The v10.68 rule change permits an approved administrator to create a missing bet record during matchup repair.

### 5. Verify the GitHub Actions maintenance secret

The workflow now falls back to the repository's confirmed production domain:

```txt
https://everybody-loses.vercel.app
```

In GitHub repository settings, keep:

```txt
MAINTENANCE_SECRET=<same value stored in Vercel>
```

`MAINTENANCE_URL` is optional and can override the fallback if the production domain changes. The previous workflow fallback used `everybody-loses-web.vercel.app`, which was not the production domain linked by this repository.

### 6. Verify after deployment

While signed in as admin:

1. Open **Admin**.
2. Press **Run server refresh now**.
3. Confirm the Server maintenance card reports version `10.68` and a Node `v22...` runtime.
4. Confirm the completed World Cup event moves to History.
5. Confirm its match is settled, or voided with no ledger debt if it ended in a draw.
6. Retry **Repair/create match** for the ongoing game. Live status is allowed and should not block repair.

## Maintenance design

The scheduled pipeline runs every five minutes and:

1. discovers the Now window
2. refreshes existing live/upcoming/recent events
3. updates scores, clocks, stats, weather, dates, and result order
4. moves final events to History
5. settles matched bets idempotently
6. closes matched and unmatched bet records
7. writes deterministic ledger entries
8. removes old final event records after the retention period while preserving ledger history

Scheduled/full request:

```txt
GET /api/maintenance?mode=auto
Authorization: Bearer <MAINTENANCE_SECRET>
```

Foreground quick request:

```txt
POST /api/maintenance?mode=quick
```

## Settlement behavior

- Team win/loss: loser owes winner the effective matched amount.
- Accepted Double Up: settlement uses the doubled amount.
- Draw/tie: match and matched bets are voided; no ledger debt is created.
- Unmatched bets on a final event: expired.
- Ledger IDs are deterministic by event and match, preventing duplicate debt entries.

## Local development

Use Node 22:

```bash
npm ci
npm run dev
```

Production build:

```bash
npm run build
```

## Optional integrations

```txt
ODDS_API_KEY
RESEND_API_KEY
NOTIFICATION_FROM_EMAIL
APP_URL
```

`APP_URL` is now only a fallback. Maintenance normally derives the host of the deployment that received the request.
