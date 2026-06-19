# Everybody Loses

## v10.77

v10.77 repairs the unattended maintenance pipeline that imports the Now window, refreshes live events, and settles completed bets.

### What changed

- Server maintenance is split into short `refresh`, `discover`, and `settle` requests instead of one oversized request that could time out after saving only part of the work.
- The GitHub Actions workflow runs those phases separately every five minutes and rotates discovery across today, tomorrow, and the following day.
- Every maintenance route accepts either the scheduler secret or an authenticated approved administrator token.
- **Run server refresh now** shows immediate progress, disables itself while running, and reports exact warnings instead of appearing unresponsive.
- A manual run discovers the entire 48-hour Now window and then runs settlement after the newly saved event data is available.
- When server maintenance is stale or unavailable, an admin browser automatically runs the known-working full-window import, refreshes Firestore state, and attempts settlement.
- Maintenance health now distinguishes the last successful run from the last request that reached the app and reports the current maintenance version.
- The existing v10.76 UFC detailed refresh and fight-by-fight settlement changes remain included.

No Firebase rules change is required.

## Deployment

Replace the repository files, including `.github/workflows/server-maintenance.yml`, then push to GitHub and deploy on Vercel with Node 22.x.

Confirm these secrets still exist:

- Vercel: `MAINTENANCE_SECRET`
- GitHub Actions: `MAINTENANCE_SECRET`
- Optional GitHub Actions: `MAINTENANCE_URL=https://everybody-loses.vercel.app`

## Local checks

```bash
npm ci
npm run build
```
