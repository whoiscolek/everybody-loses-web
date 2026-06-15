# Everybody Loses v10.76 Architecture

## UFC source pipeline

`api/espn-events.js` discovers UFC events through ESPN scoreboard data, then requests detailed FightCenter/Core event data. Known incomplete cards can be repaired without changing existing fight IDs. Detailed refresh remains active for live cards even after the expected fight count has been reached.

Card status and bout status are separate. A completed early bout does not mark the whole event final. Each fight stores its own `status` and `winner`, while the event remains `live` until the card-level source or all bouts indicate completion.

## UFC settlement pipeline

`api/maintenance.js` processes a UFC event whenever at least one fight has a winner, even if the card is still live. It settles only matches associated with completed fights and expires only unmatched bets tied to those completed fights. Later-fight bets remain untouched.

`api/settle-event.js` provides the same targeted behavior for an authenticated administrator. Ledger IDs are deterministic from event ID and match ID, making repeated settlement requests idempotent.

The browser fallback mirrors this behavior and can settle completed fights without requiring the entire card to be final.
