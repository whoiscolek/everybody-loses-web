# v10.80 Stabilization Report

## Scope

The audit covered event discovery, live refresh, UFC card merging, settlement, ledger writes, maintenance scheduling, serverless request parsing, History retention, administrator authorization, build reproducibility, and release verification.

## Defects found and corrected

### Release safety

- The repository had no automated tests or lint gate.
- Undefined browser helpers could reach production because a successful Vite build does not detect runtime-only name failures.
- Package lockfiles could contain environment-specific internal registry URLs.

**Correction:** ESLint, 37 regression/contract tests, CI verification, and a public-registry lockfile contract are now release blockers.

### Settlement isolation and correctness

- `/api/settle-event` imported the full maintenance module, coupling settlement startup to unrelated maintenance code.
- Legacy UFC matches could not always recover users, picks, or amounts from linked bets.
- A completed UFC fight could reach an invalid zero-dollar ledger path.

**Correction:** settlement was extracted into `api/_settlement.js`; legacy reconstruction and amount validation are tested; ledger IDs remain deterministic.

### Maintenance observability

- A stale maintenance record could make it unclear whether the current API deployment was new or old.

**Correction:** `/api/health` reports version/runtime without Firebase, and the Admin card compares deployment health with the recorded maintenance version.

### History retention

- The browser hid final events after five days and automatically deleted old event, bet, and match records.
- Server maintenance also had a retention path that could be enabled implicitly.

**Correction:** the browser no longer hides or deletes History by age. Server deletion is disabled by default and requires an explicit positive `HISTORY_RETENTION_DAYS` value.

### Authorization

- The browser contained hard-coded admin unlock credentials.
- User documents could be created or updated in ways that allowed self-approval or self-promotion.

**Correction:** browser admin unlock was removed; user creation must begin unapproved/non-admin; ordinary user updates are restricted to profile fields. Users may only create and delete their own bets. Because the existing browser matcher must claim another user's compatible open bet, approved users may change only the `status` and `updatedAt` fields of open/matched bets; ownership, event, amount, and selection remain immutable. Users may only modify or delete matches in which they participate. Full repair and settlement authority remains administrator-only. Administrator management is performed through an Admin SDK script.

### UFC source consistency

- Known UFC repair information was duplicated in browser and server source adapters, creating drift risk.

**Correction:** the data is centralized in `shared/ufc-repairs.js`, and partial updates are tested not to shrink a complete card.

### Additional static defects

- Removed dead functions, unused variables, duplicate object keys, malformed regex escaping, and an unused React Vite plugin.
- Preserved Firestore Timestamp-like objects during sanitization.
- Corrected an imported venue field that was computed but not returned.

## Automated verification matrix

The v10.80 suite covers:

- raw serverless URLs when `req.query` is absent
- malformed request-body handling
- structured maintenance startup failures
- authenticated matchup repair creating missing bets and the intended match
- matchup repair preserving existing bet IDs while replacing a conflicting match
- release/runtime health identity
- public npm registry lockfile integrity
- settlement endpoint isolation
- admin-secret removal and Firestore privilege contracts
- indefinite browser History retention
- Timestamp-safe Firestore sanitization
- retention opt-in behavior
- normal team settlement
- legacy team settlement repair
- draw/void behavior
- multiple matches on one final event
- deterministic ledger retry behavior
- live UFC per-fight settlement
- legacy UFC match reconstruction
- zero-dollar UFC settlement rejection
- five-to-seven UFC card expansion
- protection against card shrinkage
- ESPN UFC winner/status parsing
- main-card/prelim separation
- card-level status remaining live until all fights finish
- IndyCar multi-word driver parsing

## Verification results

Final release verification must show:

```text
ESLint: 0 errors
Node tests: 37 passed, 0 failed
Vite production build: passed
Clean npm ci: passed
```

## Dependency audit

The production dependency audit reports no high or critical findings. Six moderate transitive findings remain inside the current Firebase Admin / Google Cloud Storage dependency tree. npm offers no non-breaking full remediation and incorrectly proposes a major Firebase Admin downgrade for the remaining chain, so the release does not force incompatible transitive overrides. This should be rechecked when upstream Firebase Admin dependencies update.

## Known remaining engineering work

- `src/main.js` is still a large monolithic browser module. It should be decomposed gradually behind the new regression suite rather than rewritten all at once.
- Bet matching is still orchestrated in the browser. For a public or adversarial deployment, matching should move to a transactional server endpoint and Firestore bet/match rules should be narrowed further.
- External live-data correctness cannot be completely proven offline. Deployment smoke checks and structured source diagnostics remain necessary.
- The main client bundle is slightly above Vite's default 500 kB warning threshold before gzip; code splitting is a future performance improvement, not a functional release blocker.
