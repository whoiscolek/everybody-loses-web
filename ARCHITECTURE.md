# Everybody Loses v10.79 Architecture

## Runtime boundaries

### Browser application

`src/main.js` renders the UI and maintains Firestore subscriptions. It may run an authenticated admin fallback when shared maintenance is stale, but canonical unattended refresh and settlement run server-side.

### Source adapter

`api/espn-events.js` normalizes ESPN and supported motorsport feeds into the application event schema. UFC card repair metadata is imported from `shared/ufc-repairs.js` rather than duplicated in browser and server files.

### Maintenance orchestration

`api/maintenance.js` exposes bounded modes:

- `refresh`: update existing live, recent, incomplete, and financially active events.
- `discover`: import one ET date across supported leagues.
- `settle`: perform no external source calls and settle available results only.

The GitHub workflow invokes these as separate requests so source discovery cannot consume the runtime before settlement begins.

### Settlement engine

`api/_settlement.js` owns canonical settlement transitions. It is imported by both maintenance and `api/settle-event.js`. The dedicated settlement endpoint does not import maintenance, preventing an unrelated source or orchestration failure from disabling settlement.

Canonical transitions are idempotent:

```text
pregame -> live -> final
open bet -> matched bet -> settled or void
matched match -> settled or void
settled match -> deterministic ledger entry
```

A completed UFC fight can settle while the containing card remains live.

### Shared server utilities

- `api/_admin.js`: Firebase Admin initialization and credential validation
- `api/_http.js`: request query/body/token parsing and JSON responses
- `api/_event-utils.js`: event identity and result helpers
- `api/_version.js`: application version and server user agent
- `api/health.js`: dependency-free deployment/runtime health response

## Data safety

- Deterministic ledger IDs make settlement retries safe.
- Source refresh protects final status from regressing to live or pregame.
- Partial UFC feeds cannot shrink a previously complete card.
- History retention is indefinite unless the operator explicitly configures positive retention days.
- Firestore profile rules separate ordinary profile edits from privileged `approved` and `isAdmin` fields.
- Browser admin promotion is not supported.

## Quality system

`npm run verify` is the local and CI release gate. Tests use an in-memory Firestore double for deterministic settlement state-transition tests and direct handler tests for serverless request shapes.

The current application remains a large browser module. Decomposing `src/main.js` into domain modules is the next maintainability phase, but v10.79 intentionally avoids a high-risk wholesale rewrite during stabilization.
