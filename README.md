# Everybody Loses v10.69

Head-to-head sports betting battles for friends.

## What v10.69 fixes

### Final events that reached History without settling

The old settlement path only understood a match when `sideA`, `sideB`, `userA`, `userB`, `betA`, `betB`, and `amount` were all present in the newest schema. Older or repaired matches could instead keep the pick/user/amount on their linked bet documents or use team codes/names. The event would move to History, but the match could be skipped silently and remain `matched`.

v10.69 now:

- resolves home/away from literal sides, country/team codes, full names, IDs, and linked bet records
- recovers missing users, bet IDs, and wager amounts from the matched bet documents
- backfills the canonical match fields while settling
- writes the deterministic ledger entry and closes both bets in the same batch
- marks genuinely unrepairable matches as `partial` with a visible reason instead of silently skipping them
- reports legacy repairs and unresolved settlements in the Admin maintenance card

### Draw/void history wording

A drawn team game correctly creates no ledger debt. The old History summary treated every non-`settled` match as unfinished, so a correctly voided draw appeared as `not settled yet`.

History now distinguishes:

- settled win/loss with the amount owed
- voided draw with `no money owed`
- cancelled matches
- genuinely unresolved settlement records with the exact repair reason

The automatic browser fallback also stops repeatedly retrying already-voided matches.

## Required deployment steps

### 1. Replace the repository files and push to GitHub

Use the complete v10.69 package, including:

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
