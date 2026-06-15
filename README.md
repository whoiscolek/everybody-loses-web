# Everybody Loses

## v10.76

v10.76 fixes UFC cards that contain all fights but stop receiving fight-by-fight updates after the early bouts.

### UFC live refresh

- A complete seven-fight card remains eligible for the detailed ESPN FightCenter/Core refresh while it is live or still has unresolved fights.
- UFC card status is determined from the card-level state and all bout states rather than incorrectly treating the first completed bout as the entire card being final.
- Winner/status parsing accepts additional ESPN result shapes.
- The verified UFC Freedom 250 fallback now marks the first six confirmed results without falsely finalizing the still-live main event.
- Browser and server refresh paths merge updated fight statuses and winners into the existing Firestore event while preserving fight IDs used by bets.

### Fight-by-fight settlement

- Completed UFC fights can settle while the overall card is still live.
- Only bets tied to a completed fight are closed; bets on later fights remain open.
- Ledger IDs are deterministic, preventing duplicate debts during retries.
- The dedicated settlement endpoint accepts a live UFC card when at least one fight result is available.
- The event stays in Now until the card itself is final.

No Firebase rules change is required.

## Deployment

Replace the repository files, push to GitHub, and deploy on Vercel with Node 22.x. Open the site as admin or run **Admin → Run server refresh now** once to refresh the current UFC card and settle completed-fight matches.

## Local checks

```bash
npm ci
npm run build
```
