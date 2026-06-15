# Everybody Loses v10.69 Architecture

## Client

- Vite single-page application in `src/main.js`
- Firebase Web SDK for authentication and real-time Firestore listeners
- Approved admins retain a foreground refresh and settlement fallback
- Admin matchup repair first attempts one atomic Firestore batch

## Server functions

- `api/espn-events.js`: league-specific event retrieval and enrichment
- `api/maintenance.js`: shared discovery, refresh, finalization, settlement, and cleanup pipeline
- `api/repair-matchup.js`: authenticated server-side repair fallback
- `api/_admin.js`: Firebase Admin initialization and credential normalization
- notification and odds functions remain independent

## Runtime

`firebase-admin` 14 requires Node 22 or newer. The repository pins:

```json
"engines": { "node": "22.x" }
```

and includes `.nvmrc` with `22`.

## Finalization flow

1. GitHub Actions calls `/api/maintenance?mode=auto` every five minutes.
2. Maintenance derives the current deployment origin from the request host.
3. It fetches source data with cache bypassing.
4. Events are matched by stable source IDs, canonical keys, and a team/date fallback for legacy records.
5. ESPN final states include completed/state-post/text signals and soccer Full Time status ID 28.
6. Final events are written with `boardState: history` and `hiddenFromNow: true`.
7. Match and bet records are settled or voided.
8. Deterministic ledger IDs make retries idempotent.

## Browser fallback

An approved admin browser independently refreshes active/recent events if the server route is unavailable. It checks adjacent dates for live events or any event with an unsettled match. Its settlement logic mirrors the server, including draw voids and closing matched bet records.

## Weather

ESPN summary weather is preferred. Otherwise, venue city/state/country are normalized and sent to Open-Meteo. Combined city/state strings are split before geocoding, and country is used to disambiguate international World Cup venues.

## Matchup repair

The browser path:

1. resolves the event by internal ID or short code
2. validates team/UFC picks
3. reuses or creates the selected users' bet records
4. removes conflicting unsettled matches
5. reopens displaced bets
6. creates the intended match atomically

The included Firestore rules authorize approved admins to create a missing bet record. If direct repair is denied, the client calls the Node 22 Firebase Admin endpoint.

## Required external configuration

Vercel:

- Firebase Admin credentials
- `MAINTENANCE_SECRET`
- Node 22.x if a dashboard override exists

GitHub Actions:

- matching `MAINTENANCE_SECRET`
- optional `MAINTENANCE_URL` override; otherwise the workflow uses `https://everybody-loses.vercel.app`

Firebase:

- publish the included `firestore.rules`

## Settlement compatibility layer

Team settlement normalizes legacy match data before deciding the winner. It can derive each side and bettor from the match itself or its linked bet documents, accepts home/away aliases plus team names/codes/IDs, and derives the wager from legacy amount fields or the two bet amounts. Unresolvable matches are explicitly marked partial with `settlementIssue`; they are never silently treated as complete. Draws use `status: void`, create no ledger entry, and are displayed as voided rather than pending.
