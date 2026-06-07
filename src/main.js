import "./styles.css";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "firebase/auth";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "firebase/firestore";

import {
  getDownloadURL,
  ref,
  uploadBytes
} from "firebase/storage";

import { auth, db, storage, hasFirebaseConfig } from "./firebase.js";

const ADMIN_UNLOCK_CODE = "bitch";
const ADMIN_UNLOCK_PASSWORD = "allmyhomiespackin";

const SPORT_GROUPS = {
  basketball: ["NBA", "NCAA Basketball"],
  football: ["NFL", "NCAA Football"],
  baseball: ["MLB"],
  hockey: ["NHL"],
  soccer: ["Champions League", "Premier League", "MLS", "World Cup"],
  racing: ["F1", "NASCAR", "MotoGP"],
  olympics: ["Summer Olympics", "Winter Olympics"],
  custom: ["Custom"]
};

const SPORT_PREFIX = {
  NBA: "NBA",
  "NCAA Basketball": "NCB",
  NFL: "NFL",
  "NCAA Football": "NCF",
  MLB: "MLB",
  NHL: "NHL",
  "Champions League": "UCL",
  "Premier League": "EPL",
  MLS: "MLS",
  "World Cup": "WC",
  F1: "F1",
  NASCAR: "NAS",
  MotoGP: "MGP",
  "Summer Olympics": "OLY",
  "Winter Olympics": "WOLY",
  Custom: "CUS"
};

const SPORT_ICONS = {
  basketball: "🏀",
  football: "🏈",
  baseball: "⚾",
  hockey: "🏒",
  soccer: "⚽",
  racing: "🏎️",
  olympics: "🏅",
  custom: "🎲"
};

const LEAGUE_ICONS = {
  NBA: "🏀",
  "NCAA Basketball": "🎓",
  NFL: "🏈",
  "NCAA Football": "🎓",
  MLB: "⚾",
  NHL: "🏒",
  "Champions League": "⭐",
  "Premier League": "👑",
  MLS: "🇺🇸",
  "World Cup": "🌍",
  F1: "🏎️",
  NASCAR: "🚗",
  MotoGP: "🏍️",
  "Summer Olympics": "☀️",
  "Winter Olympics": "❄️",
  Custom: "🎲"
};

const LEAGUE_LOGO_MARKS = {
  NBA: { url: "/logos/nba.png", text: "NBA" },
  "NCAA Basketball": { url: "/logos/ncaa-basketball.png", text: "NCAA" },
  NFL: { url: "/logos/nfl.png", text: "NFL" },
  "NCAA Football": { url: "/logos/ncaa-football.png", text: "NCAA" },
  MLB: { url: "/logos/mlb.png", text: "MLB" },
  NHL: { url: "/logos/nhl.png", text: "NHL" },
  "Champions League": { url: "/logos/ucl.png", text: "UCL" },
  "Premier League": { url: "/logos/premier-league.png", text: "EPL" },
  MLS: { url: "/logos/mls.png", text: "MLS" },
  "World Cup": { text: "WC" },
  F1: { url: "/logos/f1.png", text: "F1" },
  NASCAR: { url: "/logos/nascar.png", text: "NASCAR" },
  MotoGP: { url: "/logos/motogp.png", text: "MotoGP" },
  "Summer Olympics": { url: "/logos/olympics.png", text: "OLY" },
  "Winter Olympics": { url: "/logos/olympics.png", text: "OLY" },
  Custom: { text: "CUS" }
};

const EVENT_TYPES = {
  TEAM: "TEAM_HEAD_TO_HEAD",
  RANKED: "RANKED_FINISH"
};

const AVATAR_CHOICES = ["😀", "😎", "🔥", "🧠", "🎯", "🏁", "⚡", "👑", "🐐", "💸", "🎲", "🦈"];

let activeTab = "today";
let authMode = "login";
let filters = { sport: "all", league: "all" };
let apiImportResults = [];
let apiImportMessage = "";
let authUser = null;
let loading = true;
let dataReady = false;

let state = {
  currentUserId: null,
  users: {},
  events: {},
  bets: {},
  matches: {},
  ledgerEntries: {},
  settlements: {}
};

let unsubscribeAll = [];

function startApp() {
  if (!hasFirebaseConfig) {
    loading = false;
    renderApp();
    return;
  }

  onAuthStateChanged(auth, async user => {
    authUser = user;
    state.currentUserId = user?.uid || null;
    clearSubscriptions();

    if (user) {
      await ensureUserProfile(user);
      subscribeToData();
    } else {
      state = {
        currentUserId: null,
        users: {},
        events: {},
        bets: {},
        matches: {},
        ledgerEntries: {},
        settlements: {}
      };
      dataReady = false;
    }

    loading = false;
    renderApp();
  });
}

function clearSubscriptions() {
  for (const unsub of unsubscribeAll) {
    try {
      unsub();
    } catch {
      // ignore
    }
  }
  unsubscribeAll = [];
}

async function ensureUserProfile(user) {
  const userRef = doc(db, "users", user.uid);
  const existing = await getDoc(userRef);

  if (existing.exists()) {
    await setDoc(userRef, {
      displayName: existing.data().displayName || user.displayName || user.email?.split("@")[0] || "User",
      email: user.email || existing.data().email || "",
      profileImageUrl: existing.data().profileImageUrl || user.photoURL || "",
      updatedAt: serverTimestamp()
    }, { merge: true });
    return;
  }

  await setDoc(userRef, {
    id: user.uid,
    displayName: user.displayName || user.email?.split("@")[0] || "User",
    email: user.email || "",
    avatar: "😀",
    profileImageUrl: user.photoURL || "",
    approved: false,
    isAdmin: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

function subscribeToData() {
  const subscriptions = [
    onSnapshot(collection(db, "users"), snapshot => {
      state.users = snapToMap(snapshot);
      dataReady = true;
      renderApp();
    }),
    onSnapshot(collection(db, "events"), snapshot => {
      state.events = snapToMap(snapshot);
      renderApp();
    }),
    onSnapshot(collection(db, "bets"), snapshot => {
      state.bets = snapToMap(snapshot);
      renderApp();
    }),
    onSnapshot(collection(db, "matches"), snapshot => {
      state.matches = snapToMap(snapshot);
      renderApp();
    }),
    onSnapshot(collection(db, "ledgerEntries"), snapshot => {
      state.ledgerEntries = snapToMap(snapshot);
      renderApp();
    }),
    onSnapshot(collection(db, "settlements"), snapshot => {
      state.settlements = snapToMap(snapshot);
      renderApp();
    })
  ];

  unsubscribeAll = subscriptions;
}

function snapToMap(snapshot) {
  const result = {};
  snapshot.forEach(item => {
    result[item.id] = {
      firestoreId: item.id,
      ...item.data()
    };
  });
  return result;
}

function currentUser() {
  return state.currentUserId ? state.users[state.currentUserId] : null;
}

function isAdmin() {
  const user = currentUser();
  return Boolean(user?.approved && user?.isAdmin);
}

function canBet() {
  const user = currentUser();
  return Boolean(user?.approved);
}

function money(value) {
  const num = Number(value || 0);
  return `${num < 0 ? "-" : ""}$${Math.abs(num).toFixed(2).replace(/\.00$/, "")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function label(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase());
}

function userName(id) {
  return state.users[id]?.displayName || "Unknown user";
}

function getUserInitials(user) {
  return String(user?.displayName || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("") || "?";
}

function renderAvatar(userOrId, size = "") {
  const user = typeof userOrId === "string" ? state.users[userOrId] : userOrId;
  const className = `avatar ${size}`.trim();

  if (user?.profileImageUrl) {
    return `<div class="${className}"><img src="${escapeHtml(user.profileImageUrl)}" alt="${escapeHtml(user.displayName || "Profile")}" onerror="this.remove();" /></div>`;
  }

  return `<div class="${className}">${escapeHtml(user?.avatar || getUserInitials(user))}</div>`;
}

function getSportIcon(sport, league) {
  return LEAGUE_ICONS[league] || SPORT_ICONS[sport] || "🎯";
}

function renderLeagueLogo(sport, league) {
  const logo = LEAGUE_LOGO_MARKS[league];

  if (logo?.url) {
    return `<img class="sport-logo-img" src="${escapeHtml(logo.url)}" alt="${escapeHtml(league)} logo" />`;
  }

  if (logo?.text) {
    return `<span class="sport-logo-fallback">${escapeHtml(logo.text)}</span>`;
  }

  return escapeHtml(getSportIcon(sport, league));
}

function getBettingDayISO(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const lookup = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const chicagoHour = Number(lookup.hour);
  const base = new Date(`${lookup.year}-${lookup.month}-${lookup.day}T12:00:00Z`);

  if (chicagoHour < 2) base.setUTCDate(base.getUTCDate() - 1);
  return base.toISOString().slice(0, 10);
}

function mmddFromDate(dateLike) {
  const d = new Date(dateLike);
  if (!Number.isNaN(d.getTime())) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Chicago",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(d);
    const lookup = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${lookup.month}${lookup.day}`;
  }

  const iso = String(dateLike || getBettingDayISO());
  const match = iso.match(/\d{4}-(\d{2})-(\d{2})/);
  return match ? `${match[1]}${match[2]}` : "0000";
}

function makeDisplayCode(league, dateLike, sequence) {
  const prefix = SPORT_PREFIX[league] || SPORT_PREFIX.Custom;
  return `${prefix}${mmddFromDate(dateLike)}-${sequence}`;
}

function nextEventDisplayCode(league, startTime) {
  const prefix = SPORT_PREFIX[league] || SPORT_PREFIX.Custom;
  const mmdd = mmddFromDate(startTime);
  const used = Object.values(state.events || {})
    .map(event => event.shortCode)
    .filter(code => String(code || "").startsWith(`${prefix}${mmdd}-`))
    .map(code => Number(String(code).split("-")[1]))
    .filter(Number.isFinite);

  const next = used.length ? Math.max(...used) + 1 : 1;
  return `${prefix}${mmdd}-${next}`;
}

function formatTime(value) {
  if (!value) return "TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function eventIsLocked(event) {
  const start = new Date(event.startTime);
  return event.status !== "pregame" || (!Number.isNaN(start.getTime()) && Date.now() >= start.getTime());
}

function toDateValue(value) {
  if (!value) return 0;
  if (typeof value === "string") return new Date(value).getTime() || 0;
  if (value?.toDate) return value.toDate().getTime() || 0;
  if (value?.seconds) return value.seconds * 1000;
  return 0;
}

function sortNewest(a, b) {
  return toDateValue(b.createdAt) - toDateValue(a.createdAt);
}

function renderApp() {
  document.querySelector("#app").innerHTML = `
    <main class="app-shell">
      ${renderTopbar()}
      ${renderFirebaseNotice()}
      ${renderHero()}
      ${renderViews()}
    </main>
  `;
  wireUi();
}

function renderFirebaseNotice() {
  if (hasFirebaseConfig) return "";

  return `
    <section class="panel warning-strip">
      Firebase is not configured yet. Copy <strong>.env.example</strong> to <strong>.env</strong> and add your Firebase web app values.
    </section>
  `;
}

function renderTopbar() {
  return `
    <section class="topbar">
      <div class="topbar-main">
        <div>
          <h1 class="brand-title">Everyone Loses</h1>
          <p class="brand-subtitle">Head-to-head sports betting battles.</p>
        </div>
        ${renderAuthArea()}
      </div>
      <nav class="navbar">
        ${renderNavButton("today", "Today")}
        ${renderNavButton("mybets", "My Bets")}
        ${renderNavButton("ledger", "Ledger")}
        ${renderNavButton("leaderboard", "Leaderboard")}
        ${renderNavButton("history", "History")}
        ${renderNavButton("profile", "Profile")}
        ${renderNavButton("stats", "Stats")}
        ${renderNavButton("about", "About")}
        ${renderNavButton("admin", "Admin")}
      </nav>
    </section>
  `;
}

function renderNavButton(id, text) {
  return `<button class="nav-btn ${activeTab === id ? "active" : ""}" data-tab="${id}">${escapeHtml(text)}</button>`;
}

function renderAuthArea() {
  const user = currentUser();

  if (loading) {
    return `<div class="auth-mini muted">Loading…</div>`;
  }

  if (authUser && user) {
    return `
      <div class="auth-mini">
        <div class="auth-pill profile-card">
          ${renderAvatar(user)}
          <div class="profile-meta">
            <strong>${escapeHtml(user.displayName)}</strong>
            <span class="tiny muted">${escapeHtml(user.email)} · ${user.approved ? "Approved" : "Pending"}${user.isAdmin ? " · Admin" : ""}</span>
          </div>
        </div>
        <button class="ghost" data-action="logout">Log out</button>
      </div>
    `;
  }

  if (!hasFirebaseConfig) {
    return `<div class="auth-mini"><span class="tiny muted">Firebase config needed</span></div>`;
  }

  return `
    <div class="auth-mini">
      <form id="authForm">
        ${authMode === "signup" ? `<input id="displayName" placeholder="Display name" />` : ""}
        ${authMode === "signup" ? `
          <select id="avatarChoice" aria-label="Avatar">${AVATAR_CHOICES.map(choice => `<option value="${choice}">${choice}</option>`).join("")}</select>
        ` : ""}
        <input id="email" placeholder="Email" />
        <input id="password" type="password" placeholder="Password" />
        <button class="primary" type="button" data-action="${authMode}">${authMode === "login" ? "Log in" : "Sign up"}</button>
        <button class="ghost" type="button" data-action="toggle-auth">${authMode === "login" ? "Sign up" : "Back to login"}</button>
      </form>
    </div>
  `;
}

function renderHero() {
  const user = currentUser();
  const text = {
    today: ["Today’s board", "Browse the slate by sport and league, place team or ranked-finish bets, and keep the board focused on the actual action."],
    mybets: ["My Bets", "Your open bets, matched battles, and active entries."],
    ledger: ["Ledger", "A personal view of what you owe, what others owe you, and settled balances."],
    leaderboard: ["Leaderboard", "Approved users ranked by net profit, with gross wins and losses for context."],
    history: ["History", "A full trail of events, bets, matches, and ledger items for recovery and review."],
    profile: ["Profile", "Update your display name, profile picture, and account look."],
    stats: ["Stats", "Personal betting statistics: who you beat, who beats you, and how your results break down."],
    about: ["About", "How team events, custom bets, ranked-finish events, matching, ledger entries, and settlements work."],
    admin: ["Admin", "Approve users, create events, update results, settle events, and repair the ledger."]
  }[activeTab] || ["Everyone Loses", "Head-to-head sports betting battles."];

  const signInNote = user
    ? `Signed in as <strong>${escapeHtml(user.displayName)}</strong>.`
    : "Not signed in. Create a normal email/password account, then use Admin Unlock if you are the owner.";

  return `
    <section class="page-hero">
      <h2>${escapeHtml(text[0])}</h2>
      <p>${escapeHtml(text[1])}</p>
      <p class="footer-note">${signInNote}</p>
    </section>
  `;
}

function renderViews() {
  if (loading) {
    return `<section class="section active"><div class="panel empty-state">Loading Everyone Loses…</div></section>`;
  }

  if (!hasFirebaseConfig) {
    return `<section class="section active">${renderSetupInstructions()}</section>`;
  }

  if (!authUser) {
    return `<section class="section active"><div class="panel empty-state">Log in or sign up to continue.</div></section>`;
  }

  const user = currentUser();

  if (!user) {
    return `<section class="section active"><div class="panel empty-state">Preparing your account…</div></section>`;
  }

  if (!user.approved && activeTab !== "profile" && activeTab !== "about" && activeTab !== "admin") {
    return `
      <section class="section active">
        <div class="panel empty-state">
          Your account is pending admin approval. You can still edit your profile while you wait.
        </div>
      </section>
    `;
  }

  return `
    <section class="section ${activeTab === "today" ? "active" : ""}">${renderToday()}</section>
    <section class="section ${activeTab === "mybets" ? "active" : ""}">${renderMyBets()}</section>
    <section class="section ${activeTab === "ledger" ? "active" : ""}">${renderLedger()}</section>
    <section class="section ${activeTab === "leaderboard" ? "active" : ""}">${renderLeaderboard()}</section>
    <section class="section ${activeTab === "history" ? "active" : ""}">${renderHistory()}</section>
    <section class="section ${activeTab === "profile" ? "active" : ""}">${renderProfile()}</section>
    <section class="section ${activeTab === "stats" ? "active" : ""}">${renderStats()}</section>
    <section class="section ${activeTab === "about" ? "active" : ""}">${renderAbout()}</section>
    <section class="section ${activeTab === "admin" ? "active" : ""}">${renderAdmin()}</section>
  `;
}

function renderSetupInstructions() {
  return `
    <div class="panel">
      <h3>Firebase setup needed</h3>
      <p class="muted">This v7 build no longer uses localStorage. It needs your Firebase web app config.</p>
      <ol class="muted">
        <li>Create a Firebase project.</li>
        <li>Enable Authentication → Email/password.</li>
        <li>Create a Firestore database.</li>
        <li>Enable Storage.</li>
        <li>Copy <strong>.env.example</strong> to <strong>.env</strong> and fill in the values.</li>
        <li>Restart <strong>npm run dev</strong>.</li>
      </ol>
    </div>
  `;
}

function renderToday() {
  const events = Object.values(state.events)
    .filter(event => filters.sport === "all" || event.sport === filters.sport)
    .filter(event => filters.league === "all" || event.league === filters.league)
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  const leagues = filters.sport === "all" ? Object.values(SPORT_GROUPS).flat() : SPORT_GROUPS[filters.sport] || [];

  return `
    <div class="toolbar panel">
      <div>
        <label>Sport</label>
        <select id="sportFilter">
          <option value="all">All sports</option>
          ${Object.keys(SPORT_GROUPS).map(sport => `<option value="${sport}" ${filters.sport === sport ? "selected" : ""}>${escapeHtml(label(sport))}</option>`).join("")}
        </select>
      </div>
      <div>
        <label>League / origin</label>
        <select id="leagueFilter">
          <option value="all">All leagues</option>
          ${leagues.map(league => `<option value="${league}" ${filters.league === league ? "selected" : ""}>${escapeHtml(league)}</option>`).join("")}
        </select>
      </div>
    </div>
    <div class="grid">
      ${events.length ? events.map(renderEventCard).join("") : `<div class="panel empty-state">No events match these filters. Admin can seed demo events or create manual events.</div>`}
    </div>
  `;
}

function renderEventCard(event) {
  const locked = eventIsLocked(event);

  return `
    <article class="event-card">
      <div class="event-top">
        <div class="event-main">
          <div class="sport-icon">${renderLeagueLogo(event.sport, event.league)}</div>
          <div>
            <div class="kicker">${escapeHtml(event.league)} · ${event.type === EVENT_TYPES.TEAM ? "Head-to-head" : "Ranked finish"}</div>
            <h3 class="event-title">${escapeHtml(event.title)}</h3>
            <div class="meta-line">
              <span class="status-badge ${escapeHtml(event.status)}">${escapeHtml(label(event.status))}</span>
              <span class="badge">${escapeHtml(formatTime(event.startTime))} CT</span>
            </div>
            <div class="logo-stack">
              ${event.type === EVENT_TYPES.TEAM
                ? `<span class="soft-badge">${escapeHtml(event.away.code)}</span><span class="soft-badge">vs</span><span class="soft-badge">${escapeHtml(event.home.code)}</span>`
                : `<span class="soft-badge">${event.participants.length} participants</span>`}
            </div>
          </div>
        </div>
      </div>
      ${renderScoreLine(event)}
      <div class="event-desc">${escapeHtml(event.intel || "No event intel configured yet.")}</div>
      <div class="bet-box">
        <h4>Quick bet panel</h4>
        ${event.type === EVENT_TYPES.TEAM ? renderTeamBetForm(event, locked) : renderRankedBetForm(event, locked)}
      </div>
      ${renderEventQueues(event)}
      <div class="event-code">
        Code: <strong>${escapeHtml(event.shortCode || nextEventDisplayCode(event.league, event.startTime))}</strong>
        · Internal ID: ${escapeHtml(event.id)}
        ${event.externalIds && Object.keys(event.externalIds).length ? `· External refs: ${escapeHtml(JSON.stringify(event.externalIds))}` : ""}
      </div>
    </article>
  `;
}

function renderScoreLine(event) {
  if (event.type === EVENT_TYPES.TEAM) {
    const text = event.score
      ? `${event.away.code} ${event.score.away} · ${event.home.code} ${event.score.home}`
      : `${event.away.code} vs ${event.home.code}`;
    return `<div class="score-card"><div class="score-big">${escapeHtml(text)}</div><div class="score-sub">Odds: ${escapeHtml(event.odds || "Unavailable")}</div></div>`;
  }

  if (event.resultOrder?.length) {
    return `<div class="score-card"><div class="score-big">Result: ${event.resultOrder.map(escapeHtml).join(" → ")}</div><div class="score-sub">Odds: ${escapeHtml(event.odds || "Unavailable")}</div></div>`;
  }

  return `<div class="score-card"><div class="score-big">${event.participants.map(escapeHtml).join(", ")}</div><div class="score-sub">Odds: ${escapeHtml(event.odds || "Unavailable")}</div></div>`;
}

function renderTeamBetForm(event, locked) {
  return `
    ${!canBet() ? `<p class="warning small">Log in with an approved account to place bets.</p>` : ""}
    <div class="money-row">
      <div>
        <label>Bet amount</label>
        <input id="amount-${escapeHtml(event.id)}" type="number" min="1" step="1" value="1" ${locked ? "disabled" : ""} />
      </div>
      <button class="primary" data-bet-team="${escapeHtml(event.id)}" data-side="away" ${locked || !canBet() ? "disabled" : ""}>Pick ${escapeHtml(event.away.code)}</button>
      <button class="primary" data-bet-team="${escapeHtml(event.id)}" data-side="home" ${locked || !canBet() ? "disabled" : ""}>Pick ${escapeHtml(event.home.code)}</button>
    </div>
    <p class="footer-note small">${locked ? "This event is locked." : "Multiple bets are allowed, but all of your bets on one event must stay on the same side."}</p>
    ${canBet() && !locked ? `<div class="bet-actions"><button class="ghost" data-clear-event-bets="${escapeHtml(event.id)}">Clear my bets for this event</button></div>` : ""}
  `;
}

function renderRankedBetForm(event, locked) {
  return `
    ${!canBet() ? `<p class="warning small">Log in with an approved account to place bets.</p>` : ""}
    <label>Pick a participant</label>
    <select id="participant-${escapeHtml(event.id)}" ${locked ? "disabled" : ""}>
      ${event.participants.map(participant => `<option value="${escapeHtml(participant)}">${escapeHtml(participant)}</option>`).join("")}
    </select>
    <div class="money-row single">
      <div>
        <label>Max exposure</label>
        <input id="amount-${escapeHtml(event.id)}" type="number" min="1" step="1" value="1" ${locked ? "disabled" : ""} />
      </div>
      <button class="primary" data-bet-ranked="${escapeHtml(event.id)}" ${locked || !canBet() ? "disabled" : ""}>Enter ranked bet</button>
    </div>
    <p class="footer-note small">Different amounts are allowed, but all of your bets on this event must stay on the same participant.</p>
    ${canBet() && !locked ? `<div class="bet-actions"><button class="ghost" data-clear-event-bets="${escapeHtml(event.id)}">Clear my bets for this event</button></div>` : ""}
  `;
}

function renderEventQueues(event) {
  const openBets = Object.values(state.bets).filter(bet => bet.eventId === event.id && bet.status === "open");
  const matched = Object.values(state.matches).filter(match => match.eventId === event.id);

  if (!openBets.length && !matched.length) return "";

  return `
    <div class="bet-box">
      <h4>Event activity</h4>
      <div class="stack">
        ${openBets.map(bet => `
          <div class="record">
            <strong>Waiting</strong><br />
            <span class="muted small">${renderAvatar(bet.userId)} ${escapeHtml(userName(bet.userId))} · ${escapeHtml(displayPick(event, bet))} · ${money(bet.amount)}</span>
          </div>
        `).join("")}
        ${matched.map(match => `
          <div class="record">
            <strong>Matched</strong><br />
            <span class="muted small">${escapeHtml(userName(match.userA))} vs ${escapeHtml(userName(match.userB))} · ${money(match.amount || match.exposure || 0)} · ${escapeHtml(label(match.status))}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function displayPick(event, bet) {
  if (event?.type === EVENT_TYPES.TEAM) return bet.side === "home" ? event.home.code : event.away.code;
  return bet.participant || "Unknown";
}

function renderMyBets() {
  const user = currentUser();
  if (!user) return `<div class="panel empty-state">Log in to see your bets.</div>`;
  if (!user.approved) return `<div class="panel empty-state">Your account is pending admin approval.</div>`;

  const bets = Object.values(state.bets).filter(bet => bet.userId === user.id).sort(sortNewest);
  const matches = Object.values(state.matches).filter(match => match.userA === user.id || match.userB === user.id).sort(sortNewest);

  return `
    <div class="two-col">
      <div class="panel"><h3>My bet entries</h3><div class="history-list">${bets.length ? bets.map(renderBetRecord).join("") : `<div class="record">No bets yet.</div>`}</div></div>
      <div class="panel"><h3>My matched battles</h3><div class="history-list">${matches.length ? matches.map(renderMatchRecord).join("") : `<div class="record">No matched battles yet.</div>`}</div></div>
    </div>
  `;
}

function renderBetRecord(bet) {
  const event = state.events[bet.eventId];
  return `<div class="record"><strong>${escapeHtml(event?.title || bet.eventId)}</strong><br><span class="muted small">${escapeHtml(displayPick(event, bet))} · ${money(bet.amount)} · ${escapeHtml(label(bet.status))}</span><br><span class="tiny muted">${escapeHtml(event?.shortCode || bet.eventId)}</span></div>`;
}

function renderMatchRecord(match) {
  const event = state.events[match.eventId];
  return `<div class="record"><strong>${escapeHtml(event?.title || match.eventId)}</strong><br><span class="muted small">${escapeHtml(userName(match.userA))} vs ${escapeHtml(userName(match.userB))} · ${escapeHtml(label(match.status))} · ${money(match.amount || match.exposure || 0)}</span><br><span class="tiny muted">${escapeHtml(event?.shortCode || match.eventId)}</span></div>`;
}

function renderLedger() {
  const user = currentUser();
  if (!user) return `<div class="panel empty-state">Log in to see your ledger.</div>`;

  const balances = getBalancesByCounterparty(user.id);
  const entries = Object.values(state.ledgerEntries).filter(entry => entry.fromUser === user.id || entry.toUser === user.id).sort(sortNewest);
  const settlements = Object.values(state.settlements).filter(item => item.fromUser === user.id || item.toUser === user.id).sort(sortNewest);

  return `
    <div class="two-col">
      <div class="panel">
        <h3>Open balances</h3>
        <div class="ledger-list">${Object.entries(balances).map(([otherId, amount]) => renderBalance(otherId, amount)).filter(Boolean).join("") || `<div class="record">No open balances.</div>`}</div>
      </div>
      <div class="panel">
        <h3>Ledger history</h3>
        <div class="ledger-list">${entries.length ? entries.map(entry => `<div class="record"><strong>${money(entry.amount)}</strong> ${escapeHtml(userName(entry.fromUser))} owes ${escapeHtml(userName(entry.toUser))}<br><span class="muted small">${escapeHtml(entry.eventId)} · ${escapeHtml(entry.note || "")}</span></div>`).join("") : `<div class="record">No ledger items yet.</div>`}</div>
        <h3 style="margin-top:18px;">Settlement history</h3>
        <div class="ledger-list">${settlements.length ? settlements.map(settlement => `<div class="record"><strong>${money(settlement.amount)}</strong> settled from ${escapeHtml(userName(settlement.fromUser))} to ${escapeHtml(userName(settlement.toUser))}</div>`).join("") : `<div class="record">No settlements yet.</div>`}</div>
      </div>
    </div>
  `;
}

function renderBalance(otherId, amount) {
  if (amount === 0) return "";
  const owedToCurrent = amount > 0;

  return `
    <div class="record">
      <div class="avatar-row">
        ${renderAvatar(otherId)}
        <div>
          <strong>${owedToCurrent ? `${escapeHtml(userName(otherId))} owes you ${money(amount)}` : `You owe ${escapeHtml(userName(otherId))} ${money(Math.abs(amount))}`}</strong><br>
          <span class="muted small">Only the person owed money can mark the balance settled.</span>
        </div>
      </div>
      <div style="margin-top:10px;">
        ${owedToCurrent ? `<button class="primary" data-settle="${escapeHtml(otherId)}" data-amount="${amount}">Mark settled</button>` : `<button class="ghost" disabled>Waiting for ${escapeHtml(userName(otherId))} to settle</button>`}
      </div>
    </div>
  `;
}

function getBalancesByCounterparty(userId) {
  const balances = {};
  for (const entry of Object.values(state.ledgerEntries)) {
    if (entry.settled) continue;
    if (entry.toUser === userId) balances[entry.fromUser] = (balances[entry.fromUser] || 0) + Number(entry.amount);
    if (entry.fromUser === userId) balances[entry.toUser] = (balances[entry.toUser] || 0) - Number(entry.amount);
  }
  return balances;
}

function getUserStats(userId) {
  const ledger = Object.values(state.ledgerEntries).filter(entry => entry.fromUser === userId || entry.toUser === userId);
  const wins = ledger.filter(entry => entry.toUser === userId);
  const losses = ledger.filter(entry => entry.fromUser === userId);
  const grossWon = wins.reduce((sum, entry) => sum + Number(entry.amount), 0);
  const grossLost = losses.reduce((sum, entry) => sum + Number(entry.amount), 0);
  const total = wins.length + losses.length;
  const winRate = total ? Math.round((wins.length / total) * 100) : 0;

  const byOpponent = {};
  for (const entry of ledger) {
    const otherId = entry.toUser === userId ? entry.fromUser : entry.toUser;
    if (!byOpponent[otherId]) byOpponent[otherId] = { won: 0, lost: 0, amountWon: 0, amountLost: 0 };
    if (entry.toUser === userId) {
      byOpponent[otherId].won += 1;
      byOpponent[otherId].amountWon += Number(entry.amount);
    } else {
      byOpponent[otherId].lost += 1;
      byOpponent[otherId].amountLost += Number(entry.amount);
    }
  }

  const rivals = Object.entries(byOpponent).map(([id, data]) => ({ id, ...data, net: data.amountWon - data.amountLost }));
  const bestAgainst = rivals.length ? [...rivals].sort((a, b) => b.net - a.net)[0] : null;
  const worstAgainst = rivals.length ? [...rivals].sort((a, b) => a.net - b.net)[0] : null;

  const buckets = [
    { name: "$1–$5", min: 0, max: 5 },
    { name: "$6–$10", min: 5, max: 10 },
    { name: "$11+", min: 10, max: Infinity }
  ].map(bucket => {
    const relevant = ledger.filter(entry => Number(entry.amount) > bucket.min && Number(entry.amount) <= bucket.max);
    const bucketWins = relevant.filter(entry => entry.toUser === userId).length;
    return { ...bucket, count: relevant.length, winRate: relevant.length ? Math.round((bucketWins / relevant.length) * 100) : 0 };
  });

  return { ledger, wins, losses, grossWon, grossLost, net: grossWon - grossLost, total, winRate, bestAgainst, worstAgainst, buckets };
}

function renderLeaderboard() {
  const rows = Object.values(state.users)
    .filter(user => user.approved)
    .map(user => ({ user, stats: getUserStats(user.id) }))
    .sort((a, b) => b.stats.net - a.stats.net);

  return `
    <div class="panel">
      <h3>Leaderboard</h3>
      <div class="leaderboard-list">
        ${rows.map((row, index) => `<div class="record"><div class="avatar-row">${renderAvatar(row.user)}<div><strong>#${index + 1} ${escapeHtml(row.user.displayName)}</strong><br><span class="muted small">Net: ${money(row.stats.net)} · Gross won: ${money(row.stats.grossWon)} · Gross lost: ${money(row.stats.grossLost)}</span></div></div></div>`).join("")}
      </div>
    </div>
  `;
}

function renderHistory() {
  const events = Object.values(state.events).sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

  return `
    <div class="panel">
      <h3>History</h3>
      <p class="muted">Events, short codes, bets, matches, and ledger activity stay visible here for review and recovery.</p>
      <div class="history-list">
        ${events.map(event => {
          const betCount = Object.values(state.bets).filter(bet => bet.eventId === event.id).length;
          const matchCount = Object.values(state.matches).filter(match => match.eventId === event.id).length;
          const ledgerCount = Object.values(state.ledgerEntries).filter(entry => entry.eventId === event.id).length;
          return `<div class="record"><strong>${escapeHtml(event.shortCode || event.id)}</strong> · ${escapeHtml(event.title)}<br><span class="muted small">${escapeHtml(event.league)} · ${escapeHtml(label(event.status))} · Bets: ${betCount} · Matches: ${matchCount} · Ledger items: ${ledgerCount}</span><br><span class="tiny muted">${escapeHtml(event.id)}</span></div>`;
        }).join("") || `<div class="record">No event history yet.</div>`}
      </div>
    </div>
  `;
}

function renderProfile() {
  const user = currentUser();
  if (!user) return `<div class="panel empty-state">Log in to edit your profile.</div>`;

  const stats = getUserStats(user.id);

  return `
    <div class="profile-grid">
      <div class="profile-block">
        <div class="profile-header">
          ${renderAvatar(user, "large")}
          <div>
            <h3>${escapeHtml(user.displayName)}</h3>
            <p class="muted">${escapeHtml(user.email)}</p>
            <p class="${stats.net >= 0 ? "good" : "bad"}"><strong>Lifetime net: ${money(stats.net)}</strong></p>
            ${!user.approved ? `<p class="warning">Pending admin approval</p>` : ""}
          </div>
        </div>
      </div>

      <div class="profile-block">
        <h3>Edit profile</h3>
        <label>Display name</label>
        <input id="profileDisplayName" value="${escapeHtml(user.displayName)}" />
        <label>Emoji avatar</label>
        <select id="profileAvatar">${AVATAR_CHOICES.map(choice => `<option value="${choice}" ${user.avatar === choice ? "selected" : ""}>${choice}</option>`).join("")}</select>
        <label>Profile picture URL</label>
        <input id="profileImageUrl" value="${escapeHtml(user.profileImageUrl || "")}" placeholder="Paste an image URL, or leave blank for emoji" />

        <label>Upload custom profile picture</label>
        <input id="profileImageUpload" class="hidden-file-input" type="file" accept="image/*" />
        <label for="profileImageUpload" class="upload-tile">
          <span class="upload-icon">＋</span>
          <span class="upload-text">
            <strong>Choose image</strong>
            <small>PNG, JPG, GIF, or WebP</small>
          </span>
        </label>

        <button class="primary" data-action="save-profile">Save profile</button>
        <p class="footer-note small">Uploads now go to Firebase Storage and save to your account.</p>
      </div>

      <div class="profile-block">
        <h3>Lifetime summary</h3>
        <div class="stat-list">
          <div class="stat-line"><span>Gross won</span><strong>${money(stats.grossWon)}</strong></div>
          <div class="stat-line"><span>Gross lost</span><strong>${money(stats.grossLost)}</strong></div>
          <div class="stat-line"><span>Ledger win rate</span><strong>${stats.winRate}%</strong></div>
          <div class="stat-line"><span>Ledger decisions</span><strong>${stats.total}</strong></div>
        </div>
      </div>

      <div class="profile-block">
        <h3>Rivals</h3>
        <div class="stat-list">
          <div class="stat-line"><span>Best matchup</span><strong>${stats.bestAgainst ? `${escapeHtml(userName(stats.bestAgainst.id))} (${money(stats.bestAgainst.net)})` : "N/A"}</strong></div>
          <div class="stat-line"><span>Toughest matchup</span><strong>${stats.worstAgainst ? `${escapeHtml(userName(stats.worstAgainst.id))} (${money(stats.worstAgainst.net)})` : "N/A"}</strong></div>
        </div>
      </div>
    </div>
  `;
}

function renderStats() {
  const user = currentUser();
  if (!user) return `<div class="panel empty-state">Log in to see your stats.</div>`;

  const stats = getUserStats(user.id);
  const opponentRows = Object.entries(
    stats.ledger.reduce((acc, entry) => {
      const otherId = entry.toUser === user.id ? entry.fromUser : entry.toUser;
      if (!acc[otherId]) acc[otherId] = { won: 0, lost: 0, amountWon: 0, amountLost: 0 };
      if (entry.toUser === user.id) {
        acc[otherId].won += 1;
        acc[otherId].amountWon += Number(entry.amount);
      } else {
        acc[otherId].lost += 1;
        acc[otherId].amountLost += Number(entry.amount);
      }
      return acc;
    }, {})
  ).map(([id, data]) => ({ id, ...data, net: data.amountWon - data.amountLost }));

  return `
    <div class="two-col">
      <div class="panel">
        <h3>Core stats</h3>
        <div class="stat-list">
          <div class="stat-line"><span>Net profit</span><strong>${money(stats.net)}</strong></div>
          <div class="stat-line"><span>Gross won</span><strong>${money(stats.grossWon)}</strong></div>
          <div class="stat-line"><span>Gross lost</span><strong>${money(stats.grossLost)}</strong></div>
          <div class="stat-line"><span>Win rate by ledger item</span><strong>${stats.winRate}%</strong></div>
        </div>
      </div>

      <div class="panel">
        <h3>Win rate by amount</h3>
        <div class="stat-list">
          ${stats.buckets.map(bucket => `<div class="stat-line"><span>${escapeHtml(bucket.name)}</span><strong>${bucket.count ? `${bucket.winRate}% (${bucket.count})` : "N/A"}</strong></div>`).join("")}
        </div>
        <p class="footer-note small">Odds-percentage stats will appear once real odds data is attached to bets.</p>
      </div>

      <div class="panel">
        <h3>Opponent breakdown</h3>
        <div class="history-list">
          ${opponentRows.length ? opponentRows.sort((a,b)=>b.net-a.net).map(row => `<div class="record"><strong>${escapeHtml(userName(row.id))}</strong><br><span class="muted small">Net: ${money(row.net)} · Wins: ${row.won} · Losses: ${row.lost}</span></div>`).join("") : `<div class="record">No opponent stats yet.</div>`}
        </div>
      </div>

      <div class="panel">
        <h3>Coming stats</h3>
        <div class="record">
          <strong>Odds-based performance</strong><br>
          <span class="muted small">Once API odds are attached to each bet, this can show record as favorite/underdog and performance by implied win percentage.</span>
        </div>
        <div class="record">
          <strong>Sport and pick splits</strong><br>
          <span class="muted small">Once more event data accumulates, this can show sport, league, team, player, and ranked-event performance.</span>
        </div>
      </div>
    </div>
  `;
}

function renderAbout() {
  return `
    <div class="about-grid">
      <div class="panel about-block">
        <h3>Team and custom bets</h3>
        <p>Pick one of two sides and choose an amount. Your bet stays open until a different approved user takes the opposite side for the same amount.</p>
        <ul><li>Multiple bets per event are allowed.</li><li>Same-side bets wait in the queue.</li><li>Custom bets use the same two-option format.</li></ul>
      </div>
      <div class="panel about-block">
        <h3>Ranked-finish bets</h3>
        <p>For racing and Olympic-style events, pick the participant you think will finish highest among all selected participants.</p>
        <ul><li>Different amounts are allowed.</li><li>Each bettor is compared pairwise.</li><li>The winner of each pair wins the smaller of the two entered amounts.</li></ul>
      </div>
      <div class="panel about-block">
        <h3>Ledger and settlements</h3>
        <p>Each user sees a personal ledger. If someone owes you money, only you can mark that balance settled.</p>
      </div>
      <div class="panel about-block">
        <h3>Event codes</h3>
        <p>Events use readable display codes like <strong>NBA0607-1</strong>, <strong>F10607-1</strong>, or <strong>CUS0607-1</strong>. The full internal ID remains saved in the background.</p>
      </div>
    </div>
  `;
}

function renderAdminStats() {
  const approved = Object.values(state.users).filter(user => user.approved).length;
  const pending = Object.values(state.users).filter(user => !user.approved).length;
  const openBets = Object.values(state.bets).filter(bet => bet.status === "open").length;
  const ledger = Object.values(state.ledgerEntries).length;

  return `
    <div class="admin-stats">
      <div class="stat-card"><div class="stat-label">Approved users</div><div class="stat-value">${approved}</div></div>
      <div class="stat-card"><div class="stat-label">Pending users</div><div class="stat-value">${pending}</div></div>
      <div class="stat-card"><div class="stat-label">Open bets</div><div class="stat-value">${openBets}</div></div>
      <div class="stat-card"><div class="stat-label">Ledger items</div><div class="stat-value">${ledger}</div></div>
    </div>
  `;
}


function renderAdminUnlock() {
  return `
    <div class="panel">
      <h3>Admin unlock</h3>
      <p class="muted">
        Sign in with your normal user account first, then unlock admin tools with the separate owner code.
      </p>
      <label>Admin code</label>
      <input id="adminUnlockCode" placeholder="Admin code" />
      <label>Admin password</label>
      <input id="adminUnlockPassword" type="password" placeholder="Admin password" />
      <button class="primary" data-action="admin-unlock">Unlock admin tools</button>
      <p class="footer-note small">
        Prototype note: this is a client-side owner unlock. Before public deployment, move admin control to Firebase custom claims or a Cloud Function.
      </p>
    </div>
  `;
}

async function adminUnlock() {
  const user = currentUser();

  if (!authUser || !user) {
    alert("Sign in with your normal account first.");
    return;
  }

  const code = document.querySelector("#adminUnlockCode")?.value.trim();
  const password = document.querySelector("#adminUnlockPassword")?.value;

  if (code !== ADMIN_UNLOCK_CODE || password !== ADMIN_UNLOCK_PASSWORD) {
    alert("Admin unlock failed.");
    return;
  }

  await setDoc(doc(db, "users", authUser.uid), {
    approved: true,
    isAdmin: true,
    updatedAt: serverTimestamp()
  }, { merge: true });

  alert("Admin unlocked for this account.");
}

function renderAdmin() {
  if (!isAdmin()) return renderAdminUnlock();

  const pendingUsers = Object.values(state.users).filter(user => !user.approved);
  const approvedUsers = Object.values(state.users).filter(user => user.approved);

  return `
    ${renderAdminStats()}
    <div class="admin-grid">
      <div class="admin-card">
        <h3>User approvals</h3>
        ${pendingUsers.length ? pendingUsers.map(user => `<div class="pending-user"><div class="avatar-row">${renderAvatar(user)}<div><strong>${escapeHtml(user.displayName)}</strong><br><span class="muted small">${escapeHtml(user.email)}</span></div></div><button class="primary" data-approve="${escapeHtml(user.id)}">Approve</button></div>`).join("") : `<div class="record">No pending users.</div>`}
      </div>

      <div class="admin-card">
        <h3>Demo setup</h3>
        <p class="muted small">Use this during Firebase testing to create a few events in Firestore.</p>
        <button class="primary" data-action="seed-demo-events">Seed demo events</button>
      </div>

      <div class="admin-card api-import-card">
        <h3>API event importer</h3>
        <p class="muted small">Fetch real schedule data, review it, then import selected games into Firestore. Manual events stay available as the fallback.</p>
        <label>League</label>
        <select id="apiLeague">
          ${["NBA", "NFL", "MLB", "NHL", "NCAA Basketball", "NCAA Football", "Premier League", "MLS", "Champions League"].map(league => `<option value="${escapeHtml(league)}">${escapeHtml(league)}</option>`).join("")}
        </select>
        <label>Date</label>
        <input id="apiDate" type="date" value="${escapeHtml(getBettingDayISO())}" />
        <div class="button-row">
          <button class="primary" data-action="fetch-api-events">Fetch games</button>
          <button class="ghost" data-action="import-all-api-events" ${apiImportResults.length ? "" : "disabled"}>Import all fetched</button>
        </div>
        ${apiImportMessage ? `<p class="footer-note small">${escapeHtml(apiImportMessage)}</p>` : ""}
        <div class="api-results">
          ${renderApiImportResults()}
        </div>
      </div>

      <div class="admin-card">
        <h3>Create manual event</h3>
        <label>Event type</label>
        <select id="adminEventType"><option value="${EVENT_TYPES.TEAM}">Two-option head-to-head</option><option value="${EVENT_TYPES.RANKED}">Ranked finish</option></select>
        <label>Sport</label>
        <select id="adminSport">${Object.keys(SPORT_GROUPS).map(sport => `<option value="${sport}">${escapeHtml(label(sport))}</option>`).join("")}</select>
        <label>League / origin</label>
        <input id="adminLeague" placeholder="NBA, F1, Custom..." />
        <label>Internal event ID</label>
        <input id="adminEventId" placeholder="NBA0607-1 or CUS0607-1" />
        <label>Title</label>
        <input id="adminTitle" placeholder="Away at Home, driver event, or custom title" />
        <label>Start time</label>
        <input id="adminStart" type="datetime-local" />
        <label>Away option / Participants</label>
        <input id="adminAway" placeholder="BOS or Option A or Verstappen,Norris,Leclerc" />
        <label>Home option</label>
        <input id="adminHome" placeholder="DAL or Option B; leave blank for ranked events" />
        <button class="primary" data-action="create-event">Create event</button>
        <p class="footer-note small">Display code is generated automatically, for example NBA0607-1 or CUS0607-1.</p>
      </div>

      <div class="admin-card">
        <h3>Event / result editor</h3>
        <label>Internal event ID or display code</label>
        <input id="adminEditEventId" placeholder="NBA0607-1" />
        <label>Status</label>
        <select id="adminStatus"><option value="pregame">Pregame</option><option value="live">Live</option><option value="final">Final</option></select>
        <label>Team/custom score: away,home</label>
        <input id="adminScore" placeholder="104,99" />
        <label>Ranked result order</label>
        <input id="adminResult" placeholder="Norris,Piastri,Verstappen" />
        <button class="primary" data-action="update-event">Update event</button>
        <button class="ghost" data-action="settle-event">Settle final event</button>
      </div>

      <div class="admin-card">
        <h3>Manual ledger editor</h3>
        <p class="muted small">Use this to add or repair ledger items directly. Positive flow is from loser to winner.</p>
        <label>Event ID / Manual note ID</label>
        <input id="manualEventId" placeholder="NBA0607-1 or MANUAL" />
        <label>Loser owes</label>
        <select id="manualFrom">${approvedUsers.map(user => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.displayName)}</option>`).join("")}</select>
        <label>Winner receives</label>
        <select id="manualTo">${approvedUsers.map(user => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.displayName)}</option>`).join("")}</select>
        <label>Amount</label>
        <input id="manualAmount" type="number" min="0.01" step="0.01" />
        <label>Admin note</label>
        <textarea id="manualNote" placeholder="Why this was added or corrected"></textarea>
        <button class="primary" data-action="manual-ledger">Add ledger item</button>
      </div>
    </div>
  `;
}

function wireUi() {
  document.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", () => { activeTab = button.dataset.tab; renderApp(); }));
  document.querySelector("[data-action='toggle-auth']")?.addEventListener("click", () => { authMode = authMode === "login" ? "signup" : "login"; renderApp(); });
  document.querySelector("[data-action='login']")?.addEventListener("click", login);
  document.querySelector("[data-action='signup']")?.addEventListener("click", signup);
  document.querySelector("[data-action='logout']")?.addEventListener("click", logout);
  document.querySelector("#sportFilter")?.addEventListener("change", event => { filters.sport = event.target.value; filters.league = "all"; renderApp(); });
  document.querySelector("#leagueFilter")?.addEventListener("change", event => { filters.league = event.target.value; renderApp(); });
  document.querySelectorAll("[data-bet-team]").forEach(button => button.addEventListener("click", () => placeTeamBet(button.dataset.betTeam, button.dataset.side)));
  document.querySelectorAll("[data-bet-ranked]").forEach(button => button.addEventListener("click", () => placeRankedBet(button.dataset.betRanked)));
  document.querySelectorAll("[data-clear-event-bets]").forEach(button => button.addEventListener("click", () => clearCurrentUserEventBets(button.dataset.clearEventBets)));
  document.querySelectorAll("[data-settle]").forEach(button => button.addEventListener("click", () => settleBalance(button.dataset.settle, Number(button.dataset.amount))));
  document.querySelectorAll("[data-approve]").forEach(button => button.addEventListener("click", () => approveUser(button.dataset.approve)));
  document.querySelector("[data-action='save-profile']")?.addEventListener("click", saveProfile);
  document.querySelector("[data-action='admin-unlock']")?.addEventListener("click", adminUnlock);
  document.querySelector("[data-action='seed-demo-events']")?.addEventListener("click", seedDemoEvents);
  document.querySelector("[data-action='fetch-api-events']")?.addEventListener("click", fetchApiEvents);
  document.querySelector("[data-action='import-all-api-events']")?.addEventListener("click", importAllApiEvents);
  document.querySelectorAll("[data-import-api-event]").forEach(button => button.addEventListener("click", () => importApiEvent(button.dataset.importApiEvent)));
  document.querySelector("[data-action='create-event']")?.addEventListener("click", createEvent);
  document.querySelector("[data-action='update-event']")?.addEventListener("click", updateEvent);
  document.querySelector("[data-action='settle-event']")?.addEventListener("click", settleEventFromAdmin);
  document.querySelector("[data-action='manual-ledger']")?.addEventListener("click", manualLedgerAdd);
}

async function login() {
  try {
    const email = document.querySelector("#email")?.value.trim().toLowerCase();
    const password = document.querySelector("#password")?.value;
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert(error.message || "Login failed.");
  }
}

async function signup() {
  try {
    const displayName = document.querySelector("#displayName")?.value.trim();
    const email = document.querySelector("#email")?.value.trim().toLowerCase();
    const password = document.querySelector("#password")?.value;
    const avatar = document.querySelector("#avatarChoice")?.value || "😀";

    if (!displayName || !email || !password) return alert("Need display name, email, and password.");

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    await setDoc(doc(db, "users", cred.user.uid), {
      id: cred.user.uid,
      displayName,
      email,
      avatar,
      profileImageUrl: "",
      approved: false,
      isAdmin: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    alert(error.message || "Signup failed.");
  }
}

async function logout() {
  await signOut(auth);
}

async function saveProfile() {
  const user = currentUser();
  if (!user || !authUser) return;

  try {
    const displayName = document.querySelector("#profileDisplayName")?.value.trim();
    const avatar = document.querySelector("#profileAvatar")?.value || user.avatar;
    const profileImageUrlInput = document.querySelector("#profileImageUrl")?.value.trim() || "";
    const upload = document.querySelector("#profileImageUpload")?.files?.[0];

    if (!displayName) return alert("Display name cannot be blank.");

    let profileImageUrl = profileImageUrlInput;

    if (upload) {
      const storageRef = ref(storage, `profilePictures/${authUser.uid}/${Date.now()}-${upload.name}`);
      await uploadBytes(storageRef, upload);
      profileImageUrl = await getDownloadURL(storageRef);
    }

    await updateProfile(authUser, {
      displayName,
      photoURL: profileImageUrl || null
    });

    await setDoc(doc(db, "users", authUser.uid), {
      displayName,
      avatar,
      profileImageUrl,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    alert(error.message || "Could not save profile.");
  }
}

async function approveUser(userId) {
  if (!isAdmin()) return;
  await updateDoc(doc(db, "users", userId), {
    approved: true,
    updatedAt: serverTimestamp()
  });
}

function getUserEventBets(eventId, userId) {
  return Object.values(state.bets).filter(bet => bet.eventId === eventId && bet.userId === userId);
}

function getBetSelection(event, bet) {
  if (!event || !bet) return "";
  if (event.type === EVENT_TYPES.TEAM) return bet.side || "";
  return bet.participant || "";
}

function userHasDifferentEventSelection(event, userId, nextSelection) {
  return getUserEventBets(event.id, userId).some(bet => getBetSelection(event, bet) !== nextSelection);
}

async function removeUserEventBets(eventId, userId) {
  const userBets = getUserEventBets(eventId, userId);
  const userBetIds = new Set(userBets.map(bet => bet.firestoreId || bet.id));
  const batch = writeBatch(db);

  for (const match of Object.values(state.matches)) {
    if (match.eventId !== eventId) continue;
    if (!userBetIds.has(match.betA) && !userBetIds.has(match.betB)) continue;

    const otherBetId = userBetIds.has(match.betA) ? match.betB : match.betA;
    if (state.bets[otherBetId]) {
      batch.update(doc(db, "bets", otherBetId), { status: "open", updatedAt: serverTimestamp() });
    }

    batch.delete(doc(db, "matches", match.firestoreId || match.id));
  }

  for (const bet of userBets) {
    batch.delete(doc(db, "bets", bet.firestoreId || bet.id));
  }

  await batch.commit();
}

async function clearCurrentUserEventBets(eventId) {
  const user = currentUser();
  const event = state.events[eventId];

  if (!user?.approved || !event) return;
  if (eventIsLocked(event)) return alert("Bets are locked for this event.");

  await removeUserEventBets(eventId, user.id);
}

async function placeTeamBet(eventId, side) {
  const user = currentUser();
  const event = state.events[eventId];
  const amount = Number(document.querySelector(`#amount-${CSS.escape(eventId)}`)?.value);

  if (!user?.approved) return alert("Approved login required.");
  if (!event || event.type !== EVENT_TYPES.TEAM) return alert("Invalid event.");
  if (eventIsLocked(event)) return alert("Bets are locked for this event.");
  if (!Number.isFinite(amount) || amount <= 0) return alert("Enter a valid amount.");

  if (userHasDifferentEventSelection(event, user.id, side)) {
    await removeUserEventBets(eventId, user.id);
  }

  const betRef = await addDoc(collection(db, "bets"), {
    eventId,
    userId: user.id,
    side,
    amount,
    status: "open",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await tryMatchTeamBet({ firestoreId: betRef.id, eventId, userId: user.id, side, amount });
}

async function tryMatchTeamBet(newBet) {
  const opposite = newBet.side === "home" ? "away" : "home";
  const candidate = Object.values(state.bets)
    .filter(
      bet =>
        (bet.firestoreId || bet.id) !== newBet.firestoreId &&
        bet.eventId === newBet.eventId &&
        bet.status === "open" &&
        bet.side === opposite &&
        Number(bet.amount) === Number(newBet.amount) &&
        bet.userId !== newBet.userId
    )
    .sort((a, b) => toDateValue(a.createdAt) - toDateValue(b.createdAt))[0];

  if (!candidate) return;

  const candidateId = candidate.firestoreId || candidate.id;
  const batch = writeBatch(db);

  batch.update(doc(db, "bets", candidateId), { status: "matched", updatedAt: serverTimestamp() });
  batch.update(doc(db, "bets", newBet.firestoreId), { status: "matched", updatedAt: serverTimestamp() });

  const matchRef = doc(collection(db, "matches"));
  batch.set(matchRef, {
    id: matchRef.id,
    type: EVENT_TYPES.TEAM,
    eventId: newBet.eventId,
    betA: candidateId,
    betB: newBet.firestoreId,
    userA: candidate.userId,
    userB: newBet.userId,
    sideA: candidate.side,
    sideB: newBet.side,
    amount: newBet.amount,
    status: "matched",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await batch.commit();
}

async function placeRankedBet(eventId) {
  const user = currentUser();
  const event = state.events[eventId];
  const amount = Number(document.querySelector(`#amount-${CSS.escape(eventId)}`)?.value);
  const participant = document.querySelector(`#participant-${CSS.escape(eventId)}`)?.value;

  if (!user?.approved) return alert("Approved login required.");
  if (!event || event.type !== EVENT_TYPES.RANKED) return alert("Invalid ranked event.");
  if (eventIsLocked(event)) return alert("Bets are locked for this event.");
  if (!Number.isFinite(amount) || amount <= 0) return alert("Enter a valid amount.");
  if (!participant) return alert("Pick a participant.");

  if (userHasDifferentEventSelection(event, user.id, participant)) {
    await removeUserEventBets(eventId, user.id);
  }

  await addDoc(collection(db, "bets"), {
    eventId,
    userId: user.id,
    participant,
    amount,
    status: "open",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

async function settleEvent(eventId) {
  const event = state.events[eventId];
  if (!event || event.status !== "final") return;
  if (event.type === EVENT_TYPES.TEAM) await settleTeamEvent(event);
  if (event.type === EVENT_TYPES.RANKED) await settleRankedEvent(event);
}

async function settleTeamEvent(event) {
  if (!event.score) return alert("Team/custom event needs a final score first.");

  const winningSide = Number(event.score.home) > Number(event.score.away)
    ? "home"
    : Number(event.score.away) > Number(event.score.home)
      ? "away"
      : null;

  if (!winningSide) return alert("Tie settlement is not implemented yet.");

  const batch = writeBatch(db);

  Object.values(state.matches)
    .filter(match => match.eventId === event.id && match.type === EVENT_TYPES.TEAM && match.status !== "settled")
    .forEach(match => {
      const winner = match.sideA === winningSide ? match.userA : match.userB;
      const loser = winner === match.userA ? match.userB : match.userA;
      const ledgerRef = doc(collection(db, "ledgerEntries"));

      batch.set(ledgerRef, {
        id: ledgerRef.id,
        eventId: event.id,
        fromUser: loser,
        toUser: winner,
        amount: Number(match.amount),
        note: `Auto-settled: ${event.title}`,
        settled: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      batch.update(doc(db, "matches", match.firestoreId || match.id), {
        status: "settled",
        updatedAt: serverTimestamp()
      });
    });

  await batch.commit();
}

async function settleRankedEvent(event) {
  if (!event.resultOrder?.length) return alert("Ranked event needs a result order first.");

  const rank = new Map(event.resultOrder.map((participant, index) => [participant.toLowerCase(), index + 1]));
  const bets = Object.values(state.bets).filter(bet => bet.eventId === event.id && bet.status !== "settled");
  const batch = writeBatch(db);

  for (let i = 0; i < bets.length; i += 1) {
    for (let j = i + 1; j < bets.length; j += 1) {
      const a = bets[i];
      const b = bets[j];
      if (a.userId === b.userId) continue;

      const rankA = rank.get(String(a.participant).toLowerCase()) ?? Number.POSITIVE_INFINITY;
      const rankB = rank.get(String(b.participant).toLowerCase()) ?? Number.POSITIVE_INFINITY;
      if (rankA === rankB) continue;

      const winner = rankA < rankB ? a.userId : b.userId;
      const loser = winner === a.userId ? b.userId : a.userId;
      const exposure = Math.min(Number(a.amount), Number(b.amount));
      const ledgerRef = doc(collection(db, "ledgerEntries"));

      batch.set(ledgerRef, {
        id: ledgerRef.id,
        eventId: event.id,
        fromUser: loser,
        toUser: winner,
        amount: exposure,
        note: `Ranked finish: ${event.title}`,
        settled: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  }

  bets.forEach(bet => {
    batch.update(doc(db, "bets", bet.firestoreId || bet.id), {
      status: "settled",
      updatedAt: serverTimestamp()
    });
  });

  await batch.commit();
}

async function settleBalance(otherUserId, amount) {
  const user = currentUser();
  if (!user) return;

  const target = Number(amount);
  const affected = Object.values(state.ledgerEntries)
    .filter(entry => !entry.settled && entry.fromUser === otherUserId && entry.toUser === user.id)
    .sort((a, b) => toDateValue(a.createdAt) - toDateValue(b.createdAt));

  const batch = writeBatch(db);
  let remaining = target;

  for (const entry of affected) {
    if (remaining <= 0) break;
    batch.update(doc(db, "ledgerEntries", entry.firestoreId || entry.id), {
      settled: true,
      settledAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    remaining -= Number(entry.amount);
  }

  const settlementRef = doc(collection(db, "settlements"));
  batch.set(settlementRef, {
    id: settlementRef.id,
    fromUser: otherUserId,
    toUser: user.id,
    amount: target,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await batch.commit();
}

function findEventByIdOrCode(input) {
  const value = String(input || "").trim().toUpperCase();
  if (!value) return null;
  return state.events[value] || Object.values(state.events).find(event => String(event.shortCode || "").toUpperCase() === value) || null;
}

function apiEventDocId(event) {
  const date = new Date(event.startTime).toISOString().slice(0, 10);
  const away = event.away?.code || "AWAY";
  const home = event.home?.code || "HOME";
  const sourceId = event.apiEventId || event.externalIds?.espnEventId || `${away}-${home}`;
  return `${SPORT_PREFIX[event.league] || "API"}-${date}-${away}-${home}-${sourceId}`
    .replace(/[^a-z0-9-]/gi, "-")
    .replace(/-+/g, "-")
    .toUpperCase();
}

function nextAvailableDisplayCode(league, startTime, usedCodes = null) {
  const prefix = SPORT_PREFIX[league] || SPORT_PREFIX.Custom;
  const mmdd = mmddFromDate(startTime);
  const used = usedCodes || new Set(Object.values(state.events || {}).map(event => event.shortCode).filter(Boolean));
  let sequence = 1;
  let code = makeDisplayCode(league, startTime, sequence);

  while (used.has(code) || !String(code).startsWith(`${prefix}${mmdd}-`)) {
    sequence += 1;
    code = makeDisplayCode(league, startTime, sequence);
  }

  used.add(code);
  return code;
}

function renderApiImportResults() {
  if (!apiImportResults.length) {
    return `<div class="record muted small">No fetched games yet.</div>`;
  }

  return apiImportResults.map(event => {
    const docId = apiEventDocId(event);
    const existing = state.events[docId] || Object.values(state.events).find(saved => saved.externalIds?.espnEventId === event.apiEventId);
    const scoreText = event.score ? `${event.away.code} ${event.score.away} · ${event.home.code} ${event.score.home}` : `${event.away.code} vs ${event.home.code}`;
    return `
      <div class="record api-result-row">
        <div>
          <strong>${escapeHtml(event.title)}</strong><br />
          <span class="muted small">${escapeHtml(event.league)} · ${escapeHtml(formatTime(event.startTime))} CT · ${escapeHtml(label(event.status))}</span><br />
          <span class="small">${escapeHtml(scoreText)} · Odds: ${escapeHtml(event.odds || "Unavailable")}</span>
        </div>
        <button class="${existing ? "ghost" : "primary"}" data-import-api-event="${escapeHtml(event.apiEventId)}" ${existing ? "disabled" : ""}>${existing ? "Imported" : "Import"}</button>
      </div>
    `;
  }).join("");
}

async function fetchApiEvents() {
  if (!isAdmin()) return;

  const league = document.querySelector("#apiLeague")?.value || "NBA";
  const dateRaw = document.querySelector("#apiDate")?.value || getBettingDayISO();
  const date = dateRaw.replace(/-/g, "");

  apiImportMessage = `Fetching ${league} for ${dateRaw}...`;
  apiImportResults = [];
  renderApp();

  try {
    const response = await fetch(`/api/espn-events?league=${encodeURIComponent(league)}&date=${encodeURIComponent(date)}`);
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || `API request failed with ${response.status}`);

    apiImportResults = data.events || [];
    apiImportMessage = `Fetched ${apiImportResults.length} ${league} event${apiImportResults.length === 1 ? "" : "s"}. Review before importing.`;
    renderApp();
  } catch (error) {
    apiImportResults = [];
    apiImportMessage = error.message || "Could not fetch API events.";
    renderApp();
  }
}

async function importApiEvent(apiEventId) {
  if (!isAdmin()) return;

  const event = apiImportResults.find(item => String(item.apiEventId) === String(apiEventId));
  if (!event) return alert("Could not find fetched event to import.");

  const id = apiEventDocId(event);
  const existing = state.events[id] || Object.values(state.events).find(saved => saved.externalIds?.espnEventId === event.apiEventId);
  if (existing) return alert("This event already appears to be imported.");

  const savedEvent = {
    ...event,
    id,
    shortCode: nextAvailableDisplayCode(event.league, event.startTime),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  delete savedEvent.apiSource;
  delete savedEvent.apiEventId;

  await setDoc(doc(db, "events", id), savedEvent, { merge: true });
  apiImportMessage = `Imported ${event.title}.`;
  renderApp();
}

async function importAllApiEvents() {
  if (!isAdmin() || !apiImportResults.length) return;

  const batch = writeBatch(db);
  let added = 0;
  const usedCodes = new Set(Object.values(state.events || {}).map(event => event.shortCode).filter(Boolean));

  for (const event of apiImportResults) {
    const id = apiEventDocId(event);
    const existing = state.events[id] || Object.values(state.events).find(saved => saved.externalIds?.espnEventId === event.apiEventId);
    if (existing) continue;

    const savedEvent = {
      ...event,
      id,
      shortCode: nextAvailableDisplayCode(event.league, event.startTime, usedCodes),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    delete savedEvent.apiSource;
    delete savedEvent.apiEventId;

    batch.set(doc(db, "events", id), savedEvent, { merge: true });
    added += 1;
  }

  if (!added) {
    apiImportMessage = "No new events to import.";
    renderApp();
    return;
  }

  await batch.commit();
  apiImportMessage = `Imported ${added} new event${added === 1 ? "" : "s"}.`;
  renderApp();
}

async function seedDemoEvents() {
  if (!isAdmin()) return;

  const today = getBettingDayISO();
  const demoEvents = [
    {
      id: `NBA-${today}-SAS-OKC`,
      shortCode: makeDisplayCode("NBA", today, 1),
      sport: "basketball",
      league: "NBA",
      type: EVENT_TYPES.TEAM,
      title: "San Antonio Spurs at Oklahoma City Thunder",
      away: { code: "SAS", name: "San Antonio Spurs" },
      home: { code: "OKC", name: "Oklahoma City Thunder" },
      startTime: `${today}T20:30:00-05:00`,
      status: "pregame",
      score: null,
      odds: "Demo odds placeholder",
      externalIds: { source: "demo" },
      intel: "Demo event intel. Live/API versions can show odds movement, matchup notes, news, and pregame updates here.",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    {
      id: `F1-${today}-MONACO-GP`,
      shortCode: makeDisplayCode("F1", today, 1),
      sport: "racing",
      league: "F1",
      type: EVENT_TYPES.RANKED,
      title: "Monaco Grand Prix",
      startTime: `${today}T09:00:00-05:00`,
      status: "pregame",
      participants: ["Verstappen", "Norris", "Leclerc", "Piastri", "Hamilton", "Russell"],
      resultOrder: [],
      odds: "Demo odds placeholder",
      externalIds: { source: "demo" },
      intel: "Demo event intel. Live/API versions can show qualifying, news, and event-specific notes here.",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    {
      id: `CUS-${today}-COFFEE-TEA`,
      shortCode: makeDisplayCode("Custom", today, 1),
      sport: "custom",
      league: "Custom",
      type: EVENT_TYPES.TEAM,
      title: "Office argument: coffee vs tea",
      away: { code: "COFFEE", name: "Coffee" },
      home: { code: "TEA", name: "Tea" },
      startTime: `${today}T23:30:00-05:00`,
      status: "pregame",
      score: null,
      odds: "Custom bet",
      externalIds: { source: "demo" },
      intel: "Custom bets are for internal fun: create any title, two options, and let users match against opposite picks.",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
  ];

  const batch = writeBatch(db);
  for (const event of demoEvents) {
    batch.set(doc(db, "events", event.id), event, { merge: true });
  }
  await batch.commit();
}

async function createEvent() {
  if (!isAdmin()) return;

  const type = document.querySelector("#adminEventType")?.value;
  const sport = document.querySelector("#adminSport")?.value;
  const leagueInput = document.querySelector("#adminLeague")?.value.trim();
  let id = document.querySelector("#adminEventId")?.value.trim().toUpperCase();
  const title = document.querySelector("#adminTitle")?.value.trim();
  const startRaw = document.querySelector("#adminStart")?.value;
  const away = document.querySelector("#adminAway")?.value.trim();
  const home = document.querySelector("#adminHome")?.value.trim();
  const league = leagueInput || (sport === "custom" ? "Custom" : "Manual");

  if (!type || !sport || !title || !startRaw || !away) return alert("Fill in event type, sport, title, start, and away/participants.");

  const shortCode = id || nextEventDisplayCode(league, startRaw);
  if (!id) {
    id = `${SPORT_PREFIX[league] || "CUS"}-${new Date(startRaw).toISOString().slice(0, 10)}-${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toUpperCase()}`;
  }

  const base = {
    id,
    shortCode,
    sport,
    league,
    type,
    title,
    startTime: new Date(startRaw).toISOString(),
    status: "pregame",
    odds: sport === "custom" ? "Custom bet" : "Manual event",
    externalIds: {},
    intel: sport === "custom" ? "Custom internal bet created by admin." : "Manual event created by admin. Add better live data later.",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  let event;

  if (type === EVENT_TYPES.TEAM) {
    if (!home) return alert("Two-option events need a home/second option.");
    event = {
      ...base,
      away: { code: away.toUpperCase(), name: away },
      home: { code: home.toUpperCase(), name: home },
      score: null
    };
  } else {
    const participants = away.split(",").map(item => item.trim()).filter(Boolean);
    if (participants.length < 2) return alert("Ranked events need at least two participants.");
    event = { ...base, participants, resultOrder: [] };
  }

  await setDoc(doc(db, "events", event.id), event, { merge: true });
}

async function updateEvent() {
  if (!isAdmin()) return;

  const id = document.querySelector("#adminEditEventId")?.value.trim().toUpperCase();
  const event = findEventByIdOrCode(id);
  if (!event) return alert("Event ID/code not found.");

  const patch = {
    status: document.querySelector("#adminStatus")?.value || event.status,
    updatedAt: serverTimestamp()
  };

  const scoreInput = document.querySelector("#adminScore")?.value.trim();
  if (scoreInput && event.type === EVENT_TYPES.TEAM) {
    const [away, home] = scoreInput.split(",").map(Number);
    if (!Number.isFinite(away) || !Number.isFinite(home)) return alert("Score must be away,home like 104,99.");
    patch.score = { away, home };
  }

  const resultInput = document.querySelector("#adminResult")?.value.trim();
  if (resultInput && event.type === EVENT_TYPES.RANKED) {
    patch.resultOrder = resultInput.split(",").map(item => item.trim()).filter(Boolean);
  }

  await updateDoc(doc(db, "events", event.id), patch);
}

async function settleEventFromAdmin() {
  const id = document.querySelector("#adminEditEventId")?.value.trim().toUpperCase();
  if (!id) return alert("Enter event ID/code.");
  const event = findEventByIdOrCode(id);
  if (!event) return alert("Event not found.");
  await settleEvent(event.id);
}

async function manualLedgerAdd() {
  if (!isAdmin()) return;

  const manualInput = document.querySelector("#manualEventId")?.value.trim() || "MANUAL";
  const eventId = findEventByIdOrCode(manualInput)?.id || manualInput;
  const fromUser = document.querySelector("#manualFrom")?.value;
  const toUser = document.querySelector("#manualTo")?.value;
  const amount = Number(document.querySelector("#manualAmount")?.value);
  const note = document.querySelector("#manualNote")?.value.trim();

  if (!fromUser || !toUser || fromUser === toUser || !Number.isFinite(amount) || amount <= 0) return alert("Choose different users and a valid amount.");

  await addDoc(collection(db, "ledgerEntries"), {
    eventId,
    fromUser,
    toUser,
    amount,
    note: `Admin manual ledger: ${note}`,
    settled: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

startApp();
