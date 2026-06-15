# Everybody Loses v10.74 Architecture

## Settlement pipeline

Final-event settlement is intentionally independent from sports discovery.

### Scheduled maintenance

`api/maintenance.js` performs a pre-discovery settlement pass, refreshes sports data, then performs a fresh post-discovery settlement pass. Financial collections are reloaded between passes so the second pass is idempotent and sees writes from the first pass.

### Targeted settlement

`api/settle-event.js` is a short authenticated Vercel function for one final event. It verifies a Firebase ID token and the administrator profile, then invokes the shared settlement engine.

### Browser fallback

The admin client detects final events with unresolved matches. It tries the dedicated endpoint first, then falls back to direct administrator Firestore writes. Snapshot-driven settlement checks are debounced and guarded against concurrent execution.

### Idempotency

Ledger IDs are deterministic from event ID and match ID. A settled match with a valid ledger row is skipped. A settled match missing its ledger row is repaired.

### Legacy records

Team matches can be reconstructed from linked bet records even when old match documents omit type, sides, users, amount, or canonical bet IDs.
