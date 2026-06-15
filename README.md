# Everybody Loses

## v10.75

v10.75 fixes the incomplete UFC Freedom 250 card at the saved-event layer rather than relying only on another ESPN refresh. The UI renders every stored fight and has no five-fight display cap; if only five fights appear, the Firestore event still contains five. This release identifies the card by ESPN ID, title, or multiple known fighter pairings, immediately renders the verified seven-fight card, and—when an administrator is signed in—writes the merged seven-fight array back to the existing event while preserving fight IDs used by existing bets. Maintenance also recognizes the card by title when old source IDs are missing.

## v10.74

### Guaranteed repair for incomplete UFC cards

v10.73 could still leave the existing card at five fights because it depended on a successful ESPN FightCenter response, and its ordinary browser refresh omitted the `fights` field. A final event could also fall outside the current-date sync window.

v10.74 fixes all three paths:

- compares ESPN Scoreboard, FightCenter, and Core Event competition data
- recursively recognizes changed FightCenter card shapes
- tries alternate ESPN event IDs found in links, UIDs, GUIDs, and competition metadata
- adds a targeted `/api/espn-events?league=UFC&eventId=...` repair mode that does not depend on today's date
- includes UFC fights and fight results in foreground refresh writes
- keeps incomplete recent/final UFC cards eligible for repair
- makes server maintenance issue a targeted event-ID refresh for known incomplete cards
- preserves existing fight IDs by fighter-pair matching so existing bets remain attached
- includes source diagnostics on the event
- includes a narrowly scoped verified fallback for ESPN event `600058854` when ESPN still returns fewer than the confirmed seven fights

No Firebase rules change is required.

## Previous release notes
## v10.72

UFC cards are no longer truncated to five fights. The importer keeps every fight ESPN identifies as part of the main card, excludes fights explicitly labeled as prelims, and supports special main cards containing six, seven, or more fights.

Refreshing an existing UFC event can now append newly discovered fights even when bets already exist. Existing fight IDs are preserved by fighter-pair matching so current bets and matches remain attached to the same fights.

Main-event and co-main-event labels are shown when available or inferred from source order. No Firestore rules change is required.

## v10.71

History now has independent Sport, League/origin, and Bet Activity filters matching the Now tab.
 v10.70

Head-to-head sports betting battles for friends.

## What v10.70 fixes

v10.70 separates event settlement from the long score-discovery request. A final score can no longer be saved while its matched bets remain indefinitely untouched because the maintenance function ran out of time before reaching settlement.

### Dedicated final-event settlement

A new authenticated endpoint, `/api/settle-event`, settles one specific final event. It:

- verifies the signed-in user is an approved administrator
- loads the final event and all related financial records
- reconstructs legacy matches from their linked bets
- writes the match result, both bet statuses, and deterministic ledger entry
- returns exact unresolved reasons instead of a generic history warning

Admin browsers call this endpoint immediately whenever Firestore contains a final event with an unresolved match. If the endpoint fails, the existing signed-in admin Firestore fallback runs independently.

### Maintenance ordering

Server maintenance now runs settlement twice:

1. before any external sports-source requests, for events that were already final
2. after score refresh, for events that just became final

This prevents score discovery from starving ledger work. Final events with unsettled matches remain in the source refresh plan so a missing score or incomplete final record can be repaired.

### Legacy match compatibility

The browser fallback no longer requires a team match to already contain `type`, `sideA`, and `sideB`. It accepts any non-UFC match linked to the final team event and reconstructs users, picks, bet IDs, and amount from the linked bet records.

### Immediate retry

Changes to users, events, or matches schedule a short debounced settlement check for an administrator. This removes the previous ten-minute wait and repairs stuck final matches shortly after the relevant Firestore snapshot arrives.

## Deployment

Replace the repository files with this package and push to GitHub. Keep Node 22.x and the existing Firebase Admin credentials in Vercel. No new Firestore rule change is required for v10.70.

After deployment, sign in as admin and open the site. Final unresolved matches should trigger the dedicated settlement request automatically. You can also enter the event ID in Admin and press **Settle final event** for an immediate explicit run.

## Required environment

- Node 22.x
- Firebase web configuration for the browser
- Firebase Admin credentials in Vercel
- `MAINTENANCE_SECRET` for protected scheduled maintenance

## Local checks

```bash
npm ci
npm run build
```
