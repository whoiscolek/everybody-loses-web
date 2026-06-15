# v10.60 Event Lifecycle Audit

## Root causes in v10.59

The repeated failures were not primarily caused by MLB, NHL, World Cup, or any individual source.

The shared lifecycle had four architectural defects:

1. **Browser-dependent maintenance**
   - Discovery, score refresh, finalization, and settlement ran in client browsers.
   - Full discovery was admin-only.
   - If no qualifying browser was open, Firestore stayed stale indefinitely.

2. **Multiple competing maintenance loops**
   - Admin discovery, approved-user live refresh, settlement repair, cleanup, and localStorage throttles ran separately.
   - The system could refresh an event without settling it, or attempt settlement before the final status arrived.

3. **Stale Now visibility was too permissive**
   - Pregame events remained visible for a 12-hour lookback.
   - Events marked `live` could remain visible indefinitely.
   - There was no central server state declaring an event verified, stale, archived, or final.

4. **Settlement did not fully close the lifecycle**
   - Team settlement could write a match/ledger result without updating both underlying bet documents.
   - Already-settled matches with missing ledger rows or still-matched bet documents were not always repaired.
   - Event IDs could differ between Firestore document IDs and source IDs.

## v10.60 lifecycle

```text
sport-specific source
        ↓
server maintenance lease
        ↓
discovery + stable identity matching
        ↓
canonical Firestore event
        ↓
boardState: now / history / archived
        ↓
final event settlement
        ↓
match + both bet docs + deterministic ledger row
        ↓
Firestore listeners update every user
```

## Source independence

Each sport keeps its preferred source. The maintenance layer consumes the normalized output from `/api/espn-events` and does not require every league to share one provider.

## Idempotency

- Only one maintenance run holds the Firestore lease at a time.
- Team/fight ledger IDs are deterministic by event and match.
- Ranked ledger IDs are deterministic by event and bet pair.
- Re-running maintenance repairs missing fields instead of adding duplicate debts.

## Stale-event handling

- Pregame cards disappear after a strict four-hour past-start fallback unless a source verifies them.
- Live cards have sport-aware hard maximum ages.
- A source-successful lookup that no longer returns an old event archives it from Now.
- Archived events are retained for diagnosis unless final-history cleanup applies.

## Scheduling

The included GitHub Actions workflow calls `/api/maintenance?mode=auto` every five minutes. Opening the app also requests a quick server refresh, but browser activity is no longer the primary scheduler.

## Admin matchup repair (v10.66)

`POST /api/repair-matchup` performs matchup repair with the Firebase Admin SDK. The client supplies a fresh Firebase ID token; the endpoint verifies that the signed-in user's Firestore profile is approved and administrative before writing. This avoids client Firestore create-rule conflicts when an admin needs to create or reuse bets owned by other users.
