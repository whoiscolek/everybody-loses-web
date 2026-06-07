# Everyone Loses v7.1 — Firebase + Admin Unlock

This version uses the Firebase project config for:

- Firebase Authentication
- Firestore
- Firebase Storage

It also replaces the fake admin email bootstrap with a separate Admin Unlock flow.

## Run locally

```bash
npm install
npm run dev
```

## Firebase already coded in

The Firebase web app config is already in:

```txt
src/firebase.js
```

You do not need `.env` for local testing in this version.

## Firebase Console setup

In Firebase Console for project `everyone-loses`:

1. Authentication → Sign-in method → enable Email/Password.
2. Firestore Database → create database.
3. Storage → get started / enable bucket.
4. Publish rules from:
   - `firestore.rules`
   - `storage.rules`

## Admin unlock

Create a normal account with your real email in the app.

Then open Admin and use:

```txt
Admin code: bitch
Admin password: allmyhomiespackin
```

Change these before deploying by editing `src/main.js`:

```js
const ADMIN_UNLOCK_CODE = "bitch";
const ADMIN_UNLOCK_PASSWORD = "allmyhomiespackin";
```

Important: this is prototype security. Since this is frontend-only, the admin unlock strings are visible in the built app. Before a wider public deployment, admin should move to Firebase custom claims or a Cloud Function.

## First admin steps

1. Sign up with your normal email.
2. Go to Admin.
3. Enter the admin unlock code/password.
4. Click Seed demo events.
5. Create/approve other users from Admin.


## v8 API importer

This version adds a Vercel serverless endpoint:

```txt
/api/espn-events?league=NBA&date=20260608
```

Admin can fetch ESPN scoreboard events from the Admin tab, review the events, and import selected games into Firestore. Manual events remain the fallback and should stay available.

Supported first-pass leagues:

```txt
NBA, NFL, MLB, NHL, NCAA Basketball, NCAA Football, Premier League, MLS, Champions League
```

Local Vite dev may not run Vercel serverless functions by default. The endpoint is intended for the deployed Vercel app or local `vercel dev` testing.


## v8.1 notes

- Removed the old Seed demo events admin card.
- Added API Schedule Sync controls:
  - Sync today across supported leagues
  - Sync tomorrow
  - Manual selected league/date fetch still available
- This is semi-automatic. The next step is a Vercel cron endpoint that runs schedule sync without an admin pressing a button.

## v8.2 notes
- Adds racing leagues to the API sync list: F1, NASCAR, MotoGP.
- Racing imports are ranked-finish events and should be verified in Admin before users bet.
- Adds an Admin button to delete old demo events left in Firestore from earlier builds.
