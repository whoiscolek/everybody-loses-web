# Everybody Loses Web

## v10.84 Settlement Repair, Scroll Stability, and Protected Admin Release

v10.84 builds on v10.83 and fixes the issues reported after deployment:

- Old opposite-direction ledger rows covered by a prior net settlement no longer show as fake new balances.
- Server maintenance now reconciles older open ledger rows against existing settlement records and reports `ledgerSettlementRepairs`.
- Manual server refresh no longer forces page-scroll restoration while progress messages re-render.
- The active admin/owner account is automatically stamped `protectedAdmin: true` and cannot be revoked or deleted from the admin UI.
- Updated Firestore rules enforce protected admins on the backend; publish `firestore.rules` after deploying for full protection.

After deployment, confirm `/api/health` reports `10.84`, publish the included Firestore rules, open the app as the owner/admin, and run **Admin → Run server refresh now** once.

---

# Everybody Loses

## v10.83 Ledger, Settlement, and Admin Role Release

### v10.83 reliability follow-up

- Firebase Admin is loaded lazily inside each server request so SDK or credential failures return structured JSON instead of crashing the Vercel runtime during module startup.
- Firebase Admin is pinned to the stable 13.10.0 release while the newer 14.x serverless behavior is isolated.
- `/api/admin-health` verifies Firebase Admin, administrator authentication, and a Firestore read before a full maintenance sweep begins.
- Manual maintenance falls back immediately to the browser recovery path when the Firebase server preflight fails instead of waiting through five doomed function calls.
- Admin now includes a read-only complete betting ledger showing every bet, match relationship, settlement state, and financial outcome.
- Profile stats now show real sport, league, pick, odds-tagged, and recent-decision analytics instead of placeholder planned-stat copy.


This release keeps the tested stabilization process in place while adding real Profile analytics on top of the reliable v10.80 baseline.

## Release gates

Every release now runs:

```bash
npm ci --no-audit --no-fund
npm run verify
```

`npm run verify` must complete all three stages:

1. ESLint with undefined and unused code treated as errors.
2. Node regression tests covering maintenance, serverless requests, settlement, UFC merging, racing parsing, security contracts, and repository integrity.
3. A Vite production build.

The same command runs automatically in `.github/workflows/quality.yml` for pushes and pull requests.

## Major stabilization changes

- Settlement logic lives in `api/_settlement.js`; `/api/settle-event` no longer imports the full maintenance pipeline.
- Common serverless parsing and JSON responses live in `api/_http.js`.
- Release and runtime identity are centralized in `api/_version.js`.
- `/api/health` reports the deployed API version and Node runtime without touching Firebase.
- The Admin maintenance card compares the live deployment version with the latest maintenance record.
- Legacy team and UFC matches can reconstruct missing users, picks, and amounts from linked bets.
- Zero-dollar UFC settlements are rejected and reported instead of creating invalid ledger entries.
- UFC source repair data is centralized in `shared/ufc-repairs.js` so the browser and server cannot drift.
- History is retained indefinitely by default and the browser no longer deletes or hides completed events after five days.
- Server history deletion is disabled unless `HISTORY_RETENTION_DAYS` is explicitly set to a positive number.
- Client-side admin unlock credentials were removed.
- Firestore rules prevent a user from approving or promoting their own profile.
- `package-lock.json` is checked to ensure it contains only public npm registry URLs.

See `STABILIZATION_REPORT.md` for the audit findings and test matrix.

## Required deployment steps

1. Confirm the existing owner profile in Firebase `users/<uid>` already has:

   ```text
   approved: true
   isAdmin: true
   ```

2. Replace the repository files and push to GitHub.
3. Publish the included `firestore.rules` in Firebase Console. This step is required for the admin security fix.
4. Deploy on Vercel using Node 22.x.
5. Confirm the same `MAINTENANCE_SECRET` exists in Vercel and GitHub Actions.
6. Open `/api/health` on the production domain and confirm it reports version `10.83` and a Node `v22` runtime.
7. Open Admin and run **Run server refresh now** once. The maintenance card should report the deployed API version and then a fresh v10.83 maintenance record.

## Administrator management

Browser-based admin promotion has been removed. To grant or revoke administrator access, run the audited Admin SDK script with Firebase service-account variables loaded locally:

```bash
npm run admin:manage -- --grant --email user@example.com
npm run admin:manage -- --revoke --email user@example.com
```

A UID can be used instead of an email:

```bash
npm run admin:manage -- --grant --uid FIREBASE_UID
```

## Environment variables

Required for maintenance and secure admin functions:

- `FIREBASE_SERVICE_ACCOUNT_JSON`, or the three split Firebase service-account variables
- `MAINTENANCE_SECRET`

Optional:

- `MAINTENANCE_URL` in GitHub Actions only; the workflow defaults to the production domain
- `HISTORY_RETENTION_DAYS`; leave unset or `0` to retain History indefinitely
- odds and email-provider variables listed in `.env.example`
