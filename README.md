# Everyone Loses v10.43

Head-to-head sports betting battles for friends.

## Current version

This repo is currently on the v10.x Firebase/Vercel build line.

v10.43 is based on v10.42, which uses the stronger v10.40 frosted topbar styling and discards the v10.41 topbar experiment.

## Core features

- Firebase Authentication
- Firestore-backed users, events, bets, matches, ledger entries, and settlements
- Firebase Storage profile picture uploads
- Admin approval and user/profile management
- Now board with a 48-hour event window
- Automatic source discovery sweeps for supported leagues
- Live score refreshes
- ESPN/imported odds first, with Odds API locked until a matchup has a matched bet
- Double Up requests for live matched bets
- History tiles with event result, bet summary, display code, internal game ID, and external refs
- Profile, stats, ledger, leaderboard, history, about, and admin tabs
- Liquid-glass dark UI styling

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Firebase setup

The Firebase web app config is in:

```txt
src/firebase.js
```

Firebase services used:

- Authentication
- Firestore
- Storage

Publish/update rules from:

```txt
firestore.rules
storage.rules
```

## Vercel environment variables

The app can run without every optional service, but these variables may be used depending on enabled features:

```txt
ODDS_API_KEY
RESEND_API_KEY
NOTIFICATION_FROM_EMAIL
APP_URL
```

`RESEND_API_KEY` is only needed for email notifications.

`ODDS_API_KEY` is only needed for locked/matched-bet Odds API usage. Default event odds should use imported/ESPN-style odds first.

## Admin/security note

This prototype still includes client-side admin unlock logic. That is convenient for private testing but is not ideal for a public app because frontend code can be inspected.

Before wider use, move admin authorization to Firebase custom claims or a trusted server-side function.

Do not publish real admin passwords, API keys, or private credentials in this README.

## Version notes

- v10.33 fixed team-event identity so repeated matchups are no longer merged by title.
- v10.38 rebuilt History into compact glass tiles and improved nav/header styling.
- v10.40 removed the Now-board hero tile and widened/strengthened the desktop topbar.
- v10.42 rolled back to the better v10.40 topbar styling after the v10.41 experiment.
- v10.43 cleans up this README so GitHub no longer says v7.1.


## v10.44 auth palette + mobile nav polish

- Recolors login/signup inputs and auth panel to match the darker glass UI.
- Improves placeholder/readability for auth fields.
- Replaces glitchy mobile tab bouncing with direct active-tab centering after render.
