# Everybody Loses v10.77 Architecture

## Scoped maintenance pipeline

`api/maintenance.js` now exposes three bounded modes:

- `refresh`: refresh existing live, recent, incomplete, or unsettled events.
- `discover`: import one ET calendar date across every supported league.
- `settle`: perform no external source calls and only repair completed matches, bets, and ledger entries.

Each mode uses the same lease and idempotent Firestore writes. Splitting discovery and settlement prevents a large source sweep from consuming the function runtime before ledger work begins.

## Scheduler

`.github/workflows/server-maintenance.yml` runs every five minutes. It calls `refresh`, rotates one discovery offset from 0 through 2, and then calls `settle`. Therefore each date in the 48-hour window is rediscovered every fifteen minutes, while existing live and unsettled events are checked every five minutes.

## Browser recovery

The Admin maintenance button uses a Firebase ID token and runs refresh, all three discovery dates, then settlement. Progress and failures are displayed inside the maintenance card.

If the shared server record is stale, an admin browser also enables the direct Firestore fallback. It performs the full-window source sweep, reloads events/bets/matches/ledger state from Firestore, and retries settlement. This path is intentionally throttled and only active while the server pipeline is stale.

## UFC behavior

The v10.76 detailed UFC refresh remains active. Fight-card status and individual bout status are separate, and completed fights can settle before the complete card finishes.
