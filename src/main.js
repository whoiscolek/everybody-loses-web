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
  where,
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

const DISPLAY_TIME_ZONE = "America/New_York";
const TIME_ZONE_LABEL = "ET";
const BETTING_DAY_RESET_HOUR = 3;
const AUTO_SYNC_INTERVAL_MS = 10 * 60 * 1000;
const DISCOVERY_SYNC_INTERVAL_MS = 2 * 60 * 1000;
const SPORT_SOURCE_SWEEP_INTERVAL_MS = 60 * 1000;
const LIVE_SCORE_SYNC_INTERVAL_MS = 30 * 1000;
const DOUBLE_UP_ACCEPT_WINDOW_MS = 5 * 60 * 1000;
const AUTO_ODDS_INTERVAL_MS = 15 * 60 * 1000;
const ODDS_AUTO_PREGAME_COOLDOWN_MS = 60 * 60 * 1000;
const ODDS_AUTO_LIVE_COOLDOWN_MS = 20 * 60 * 1000;
const ODDS_DAILY_AUTO_REQUEST_LIMIT = 25;
const AUTO_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
const AUTO_SETTLE_INTERVAL_MS = 10 * 60 * 1000;
const NOW_WINDOW_SYNC_LABEL = "full 48-hour Now window";
const NOW_BOARD_LOOKAHEAD_MS = 48 * 60 * 60 * 1000;
const NOW_BOARD_LOOKBACK_MS = 4 * 60 * 60 * 1000;
const HISTORY_RETENTION_MS = 5 * 24 * 60 * 60 * 1000;

const SPORT_GROUPS = {
  basketball: ["NBA", "NCAA Basketball"],
  football: ["NFL", "NCAA Football"],
  baseball: ["MLB"],
  hockey: ["NHL"],
  soccer: ["Champions League", "Premier League", "MLS", "World Cup"],
  racing: ["F1", "NASCAR", "IndyCar", "MotoGP"],
  combat: ["UFC"],
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
  IndyCar: "IND",
  MotoGP: "MGP",
  UFC: "UFC",
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
  combat: "🥊",
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
  IndyCar: "🏁",
  MotoGP: "🏍️",
  UFC: "🥊",
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
  "World Cup": { url: "/logos/world-cup.png", text: "WC" },
  F1: { url: "/logos/f1.png", text: "F1" },
  NASCAR: { url: "/logos/nascar.png", text: "NASCAR" },
  IndyCar: { url: "/logos/indycar.png", text: "INDYCAR" },
  MotoGP: { url: "/logos/motogp.png", text: "MotoGP" },
  UFC: { url: "/logos/ufc.png", text: "UFC" },
  "Summer Olympics": { url: "/logos/olympics.png", text: "OLY" },
  "Winter Olympics": { url: "/logos/olympics.png", text: "OLY" },
  Custom: { text: "CUS" }
};

const EVENT_TYPES = {
  TEAM: "TEAM_HEAD_TO_HEAD",
  RANKED: "RANKED_FINISH",
  FIGHT_CARD: "FIGHT_CARD"
};

const API_IMPORT_LEAGUES = ["NBA", "NFL", "MLB", "NHL", "NCAA Basketball", "NCAA Football", "Premier League", "MLS", "Champions League", "World Cup", "F1", "NASCAR", "IndyCar", "MotoGP", "UFC"];

const AVATAR_CHOICES = ["😀", "😎", "🔥", "🧠", "🎯", "🏁", "⚡", "👑", "🐐", "💸", "🎲", "🦈"];

let activeTab = "today";
let authMode = "login";
let filters = { sport: "all", league: "all", betState: "all" };
let historyFilters = { sport: "all", league: "all", betState: "all" };
let apiImportResults = [];
let apiImportMessage = "";
let apiSyncRunning = false;
let autoMaintenanceRunning = false;
let autoMaintenanceTimer = null;
let settlementMaintenanceTimer = null;
let approvedLiveRefreshRunning = false;
let autoMaintenanceMessage = "";
let mlbSyncDebug = "";
let sourceSweepDebug = "";
let notificationDebug = localStorage.getItem("notificationDebug") || "";
let doubleUpCountdownTimer = null;
let settlementSyncMessage = "";
let settlementRepairRunning = false;
let immediateSettlementTimer = null;
let authUser = null;
let loading = true;
let dataReady = false;
let passiveRenderPending = false;
let passiveRenderTimer = null;
let repairMatchupRunning = false;
let repairMatchupMessage = "";
let repairMatchupMessageType = "";

let state = {
  currentUserId: null,
  users: {},
  events: {},
  bets: {},
  matches: {},
  ledgerEntries: {},
  settlements: {},
  maintenance: {}
};

let unsubscribeAll = [];

function isEditableElement(element = document.activeElement) {
  if (!element || !(element instanceof HTMLElement)) return false;
  return element.matches("input, select, textarea, [contenteditable='true']");
}

function requestPassiveRender() {
  if (isEditableElement()) {
    passiveRenderPending = true;
    return;
  }

  passiveRenderPending = false;
  renderApp();
}

function flushPassiveRenderWhenIdle() {
  if (!passiveRenderPending) return;
  clearTimeout(passiveRenderTimer);
  passiveRenderTimer = setTimeout(() => {
    if (passiveRenderPending && !isEditableElement()) {
      passiveRenderPending = false;
      renderApp();
    }
  }, 0);
}

function installInteractionGuards() {
  document.addEventListener("focusout", flushPassiveRenderWhenIdle);
}

function startApp() {
  installInteractionGuards();
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
        settlements: {},
        maintenance: {}
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

function subscribeToUserScopedCollection(collectionName, stateKey) {
  const uid = authUser?.uid;
  if (!uid) return [];

  const fromMap = {};
  const toMap = {};

  function mergeAndRender() {
    state[stateKey] = { ...fromMap, ...toMap };
    requestPassiveRender();
  }

  const fromUnsub = onSnapshot(
    query(collection(db, collectionName), where("fromUser", "==", uid)),
    snapshot => {
      Object.keys(fromMap).forEach(key => delete fromMap[key]);
      Object.assign(fromMap, snapToMap(snapshot));
      mergeAndRender();
    },
    () => {
      // Keep the app usable if one side of a scoped listener fails.
    }
  );

  const toUnsub = onSnapshot(
    query(collection(db, collectionName), where("toUser", "==", uid)),
    snapshot => {
      Object.keys(toMap).forEach(key => delete toMap[key]);
      Object.assign(toMap, snapToMap(snapshot));
      mergeAndRender();
    },
    () => {
      // Keep the app usable if one side of a scoped listener fails.
    }
  );

  return [fromUnsub, toUnsub];
}

function subscribeLedgerLikeCollection(collectionName, stateKey) {
  let fellBack = false;

  const allUnsub = onSnapshot(
    collection(db, collectionName),
    snapshot => {
      if (fellBack) return;
      state[stateKey] = snapToMap(snapshot);
      requestPassiveRender();
    },
    () => {
      // Non-admin users are not allowed to list every ledger/settlement doc.
      // Fall back to two security-rule-compatible queries: docs they owe and docs owed to them.
      fellBack = true;
      state[stateKey] = {};
      const scoped = subscribeToUserScopedCollection(collectionName, stateKey);
      unsubscribeAll.push(...scoped);
    }
  );

  return allUnsub;
}

function subscribeToData() {
  const subscriptions = [
    onSnapshot(collection(db, "users"), snapshot => {
      state.users = snapToMap(snapshot);
      dataReady = true;
      requestPassiveRender();
      scheduleImmediateFinalSettlementCheck();
    }),
    onSnapshot(collection(db, "events"), snapshot => {
      state.events = snapToMap(snapshot);
      requestPassiveRender();
      scheduleImmediateFinalSettlementCheck();
    }),
    onSnapshot(collection(db, "bets"), snapshot => {
      state.bets = snapToMap(snapshot);
      requestPassiveRender();
    }),
    onSnapshot(collection(db, "matches"), snapshot => {
      state.matches = snapToMap(snapshot);
      requestPassiveRender();
      scheduleImmediateFinalSettlementCheck();
    }),
    subscribeLedgerLikeCollection("ledgerEntries", "ledgerEntries"),
    subscribeLedgerLikeCollection("settlements", "settlements"),
    onSnapshot(doc(db, "system", "maintenance"), snapshot => {
      state.maintenance = snapshot.exists() ? snapshot.data() : {};
      requestPassiveRender();
    }, () => {
      // Maintenance health is supplemental; the board still renders without it.
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

function removeUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value
      .map(item => removeUndefinedDeep(item))
      .filter(item => item !== undefined);
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out = {};
    for (const [key, inner] of Object.entries(value)) {
      const cleaned = removeUndefinedDeep(inner);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }

  return value === undefined ? undefined : value;
}

function mergeExternalIds(existing = {}, incoming = {}) {
  return removeUndefinedDeep({ ...existing, ...incoming });
}

function mlbDebugLine(prefix, data = {}) {
  const parts = Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${value}`);
  return `${prefix}${parts.length ? ` (${parts.join(", ")})` : ""}`;
}

function currentUser() {
  return state.currentUserId ? state.users[state.currentUserId] : null;
}

function eventIdCandidates(eventOrId) {
  if (!eventOrId || typeof eventOrId === "string") return new Set([String(eventOrId || "")].filter(Boolean));
  return new Set([
    eventOrId.firestoreId,
    eventOrId.id,
    eventOrId.apiEventId,
    eventOrId.externalIds?.espnEventId,
    eventOrId.externalIds?.mlbGamePk,
    eventOrId.externalIds?.apiEventId,
    eventOrId.externalIds?.eventId,
    eventOrId.externalIds?.f1Round,
    eventOrId.externalIds?.indyCarEventId,
    eventOrId.externalIds?.nascarEventId,
    eventOrId.externalIds?.motogpEventId
  ].map(value => String(value || "").trim()).filter(Boolean));
}

function recordMatchesEvent(record, eventOrId) {
  const ids = eventIdCandidates(eventOrId);
  return ids.has(String(record?.eventId || ""));
}

function eventBetCount(eventId) {
  return Object.values(state.bets || {}).filter(bet => recordMatchesEvent(bet, eventId)).length;
}

function eventMatchCount(eventId) {
  return Object.values(state.matches || {}).filter(match => recordMatchesEvent(match, eventId)).length;
}

function eventLedgerCount(eventId) {
  return Object.values(state.ledgerEntries || {}).filter(entry => recordMatchesEvent(entry, eventId)).length;
}

function eventHasFinancialRecords(eventId) {
  return eventBetCount(eventId) > 0 || eventMatchCount(eventId) > 0 || eventLedgerCount(eventId) > 0;
}

function eventBetActivity(event) {
  const bets = Object.values(state.bets || {}).filter(bet => recordMatchesEvent(bet, event));
  const matches = Object.values(state.matches || {}).filter(match => recordMatchesEvent(match, event));
  const hasPlacedBets = bets.length > 0 || matches.length > 0;
  const hasActiveBets = matches.some(match => String(match.status || "").toLowerCase() === "matched");

  return { hasPlacedBets, hasActiveBets };
}

function eventMatchesBetStateFilter(event, betState = filters.betState) {
  const { hasPlacedBets, hasActiveBets } = eventBetActivity(event);

  if (betState === "placed") return hasPlacedBets;
  if (betState === "active") return hasActiveBets;
  if (betState === "none") return !hasPlacedBets;
  return true;
}

function eventIsComplete(event) {
  return event?.status === "final";
}

function eventHistoryAgeMs(event) {
  const start = new Date(event?.startTime || 0).getTime();
  if (!Number.isFinite(start)) return 0;
  return Date.now() - start;
}

function eventIsExpiredHistory(event) {
  return event?.status === "final" && eventHistoryAgeMs(event) > HISTORY_RETENTION_MS;
}

function eventIsWithinHistoryWindow(event) {
  return event?.status === "final" && !eventIsExpiredHistory(event);
}

function functionSafeEventId(event) {
  return event?.firestoreId || event?.id || "";
}

function eventCanBeHistoryCleaned(event) {
  if (!eventIsExpiredHistory(event)) return false;
  const eventId = functionSafeEventId(event);
  if (!eventId) return false;

  const unsettledMatches = Object.values(state.matches || {}).some(match =>
    match.eventId === eventId && match.status !== "settled"
  );

  return !unsettledMatches;
}

function functionHistoryCleanupCandidateCount() {
  return Object.values(state.events || {}).filter(eventCanBeHistoryCleaned).length;
}

function maxLiveAgeMs(event) {
  if (event?.type === EVENT_TYPES.FIGHT_CARD || event?.type === EVENT_TYPES.RANKED) return 14 * 60 * 60 * 1000;
  if (event?.league === "MLB") return 10 * 60 * 60 * 1000;
  return 8 * 60 * 60 * 1000;
}

function eventIsWithinNowWindow(event) {
  if (!event || event.status === "final") return false;
  if (event.hiddenFromNow || ["archived", "history"].includes(event.boardState)) return false;

  const start = new Date(event.startTime || 0).getTime();
  if (!Number.isFinite(start)) return false;

  const now = Date.now();
  if (event.status === "live") return now - start <= maxLiveAgeMs(event);
  return start >= now - NOW_BOARD_LOOKBACK_MS && start <= now + NOW_BOARD_LOOKAHEAD_MS;
}

function eventIsFutureOverflow(event) {
  const start = new Date(event?.startTime || 0).getTime();
  return Number.isFinite(start) && start > Date.now() + NOW_BOARD_LOOKAHEAD_MS;
}

function hiddenFutureImportedEventCount() {
  return Object.values(state.events || {})
    .filter(event => !eventIsComplete(event))
    .filter(eventIsFutureOverflow)
    .length;
}

function eventShouldBeAutoSavedForNowWindow(event) {
  if (!event) return false;
  if (event.status === "live") return true;

  const start = new Date(event.startTime || 0).getTime();
  if (!Number.isFinite(start)) return false;

  const now = Date.now();
  return start >= now - NOW_BOARD_LOOKBACK_MS && start <= now + NOW_BOARD_LOOKAHEAD_MS;
}

function nowWindowDateISOs() {
  const dates = new Set();

  // The Now board shows events from a lookback window through a lookahead window.
  // Discovery must fetch that exact same date span. The old version started at
  // "right now", which missed late West Coast games after midnight ET because
  // those games belonged to yesterday's MLB schedule date.
  const windowStart = new Date(Date.now() - NOW_BOARD_LOOKBACK_MS);
  const windowEnd = new Date(Date.now() + NOW_BOARD_LOOKAHEAD_MS);

  const startISO = dateISOInDisplayTimeZone(windowStart);
  const endISO = dateISOInDisplayTimeZone(windowEnd);

  dates.add(startISO);
  dates.add(dateISOInDisplayTimeZone(new Date()));
  dates.add(endISO);

  const cursor = new Date(`${startISO}T12:00:00Z`);
  const endDate = new Date(`${endISO}T12:00:00Z`);

  while (cursor <= endDate) {
    dates.add(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return Array.from(dates).sort();
}

function eventHasActiveBetInterest(eventId) {
  const event = state.events[eventId] || findEventByIdOrCode(eventId) || eventId;
  return Object.values(state.bets || {}).some(bet => recordMatchesEvent(bet, event) && bet.status !== "settled")
    || Object.values(state.matches || {}).some(match => recordMatchesEvent(match, event) && match.status !== "settled");
}

function eventWeatherText(event) {
  const text = event?.weather?.summary || event?.weatherText || "";
  return text || "Weather unavailable for this venue.";
}

function eventHasMatchedOddsInterest(eventId) {
  const event = state.events[eventId] || findEventByIdOrCode(eventId) || eventId;
  return Object.values(state.matches || {}).some(match => recordMatchesEvent(match, event) && match.status !== "settled");
}

function eventCanUseOddsApi(event, forceMatched = false) {
  const eventId = event?.firestoreId || event?.id;
  return Boolean(eventId && event?.type === EVENT_TYPES.TEAM && event?.status !== "final" && (forceMatched || eventHasMatchedOddsInterest(eventId)));
}

function cleanOddsText(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function isPlaceholderOdds(value) {
  const text = cleanOddsText(value);
  return !text || /^(unavailable|api schedule import|odds unavailable|live odds unavailable|espn odds pending|odds pending)$/i.test(text);
}

function eventOddsText(event) {
  // ESPN/imported odds are the default for the board. The Odds API is only allowed
  // to display once this exact event has a matched bet tied to it.
  if (eventCanUseOddsApi(event) && event?.oddsLive) {
    const liveParts = [
      cleanOddsText(event.oddsLive.summary),
      cleanOddsText(event.oddsLive.moneyline) ? `ML ${cleanOddsText(event.oddsLive.moneyline)}` : "",
      cleanOddsText(event.oddsLive.spread) ? `Spread ${cleanOddsText(event.oddsLive.spread)}` : "",
      cleanOddsText(event.oddsLive.total)
    ].filter(Boolean);

    const preferred = liveParts.find(part => !/^(odds unavailable|live odds unavailable)$/i.test(part));
    if (preferred) return preferred;
  }

  return cleanOddsText(event?.odds) || "Unavailable";
}

function shouldShowOddsText(event) {
  const text = eventOddsText(event);
  return Boolean(text && !/^(unavailable|api schedule import|odds unavailable|live odds unavailable)$/i.test(text));
}

function renderOddsDisplay(event) {
  if (event?.type !== EVENT_TYPES.TEAM) return "";
  const text = eventOddsText(event);
  const canShow = shouldShowOddsText(event);
  const pending = event?.status !== "final" ? "Odds pending" : "Odds unavailable";
  return `
    <div class="odds-display ${canShow ? "" : "pending"}">
      <strong>Odds</strong>
      <span>${escapeHtml(canShow ? text : pending)}</span>
    </div>
  `;
}

function renderHeaderOddsDisplay(event) {
  try {
    if (event?.type !== EVENT_TYPES.TEAM) return "";
    const text = eventOddsText(event);
    const canShow = shouldShowOddsText(event);
    const pending = event?.status !== "final" ? "Odds pending" : "Odds unavailable";
    return `
      <div class="header-odds ${canShow ? "" : "pending"}">
        <strong>Odds</strong>
        <span>${escapeHtml(canShow ? text : pending)}</span>
      </div>
    `;
  } catch (error) {
    console.error("Header odds render failed", event, error);
    return "";
  }
}

function eventOddsMeta(event) {
  if (!eventCanUseOddsApi(event) || !event?.oddsLive) return "";
  const book = event.oddsLive.bookmaker ? `Book: ${event.oddsLive.bookmaker}` : "";
  const matched = event.oddsLive.matchedGame ? `Matched: ${event.oddsLive.matchedGame}` : "";
  const fetched = event.oddsLive.fetchedAt ? `${TIME_ZONE_LABEL} updated ${formatTime(event.oddsLive.fetchedAt)}` : "";
  return [book, matched, fetched].filter(Boolean).join(" · ");
}

function renderAdminOddsButton(event) {
  if (!isAdmin() || event.type !== EVENT_TYPES.TEAM || event.status === "final") return "";
  if (!eventCanUseOddsApi(event)) return "";
  return `<button class="ghost tiny-action" data-refresh-odds="${escapeHtml(event.firestoreId || event.id)}">Refresh odds</button>`;
}


function scoreHasValue(score) {
  if (!score || typeof score !== "object") return false;
  const away = Number(score.away);
  const home = Number(score.home);
  return Number.isFinite(away) && Number.isFinite(home);
}

function incomingWouldDowngradeLiveState(incoming, existing) {
  if (!existing) return false;
  const existingHasScore = scoreHasValue(existing.score);
  const incomingHasScore = scoreHasValue(incoming.score);
  const existingStatus = String(existing.status || "");
  const incomingStatus = String(incoming.status || "");

  if ((existingStatus === "live" || existingStatus === "final") && incomingStatus === "pregame") return true;
  if (existingHasScore && !incomingHasScore && (existingStatus === "live" || existingStatus === "final")) return true;
  return false;
}

function chooseProtectedStatus(incoming, existing) {
  if (!existing) return incoming.status;
  const existingStatus = String(existing.status || "");
  const incomingStatus = String(incoming.status || "");

  if ((existingStatus === "live" || existingStatus === "final") && incomingStatus === "pregame") return existing.status;
  if (existingStatus === "final" && incomingStatus !== "final") return existing.status;
  return incoming.status || existing.status || "pregame";
}

function chooseProtectedScore(incoming, existing) {
  if (scoreHasValue(incoming.score)) return incoming.score;
  if (scoreHasValue(existing?.score) && (existing?.status === "live" || existing?.status === "final")) return existing.score;
  return incoming.score || existing?.score || null;
}

function chooseProtectedStats(incomingStats, existingStats, incoming, existing) {
  const incomingRows = Array.isArray(incomingStats) ? incomingStats : [];
  const existingRows = Array.isArray(existingStats) ? existingStats : [];

  if (!incomingRows.length) return existingRows;
  if (incomingWouldDowngradeLiveState(incoming, existing) && existingRows.length) return existingRows;
  return incomingRows;
}

function liveContextFromStats(event) {
  const statusRow = (event.liveStats || []).find(row => /^status$/i.test(String(row.label || "")));
  const value = String(statusRow?.value || "").trim();
  if (!value || /^(pregame|scheduled|final|live)$/i.test(value)) return "";
  return value;
}

function normalizedFightIdentityPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function fightIdentityKey(fight = {}) {
  const names = [normalizedFightIdentityPart(fight.fighterA), normalizedFightIdentityPart(fight.fighterB)]
    .filter(Boolean)
    .sort();
  return names.length === 2 ? names.join("::") : "";
}

function mergeImportedUfcFights(existingFights = [], incomingFights = []) {
  const existing = Array.isArray(existingFights) ? existingFights.filter(Boolean) : [];
  const incoming = Array.isArray(incomingFights) ? incomingFights.filter(Boolean) : [];
  if (!incoming.length) return existing;

  const existingById = new Map(existing.map(fight => [String(fight.id || ""), fight]).filter(([id]) => id));
  const existingByPair = new Map(existing.map(fight => [fightIdentityKey(fight), fight]).filter(([key]) => key));
  const usedExistingIds = new Set();

  const merged = incoming.map((fight, index) => {
    const incomingId = String(fight.id || "");
    const prior = existingById.get(incomingId) || existingByPair.get(fightIdentityKey(fight)) || null;
    if (prior?.id) usedExistingIds.add(String(prior.id));
    return {
      ...(prior || {}),
      ...fight,
      // Preserve the original ID when the same matchup was already bet on.
      id: prior?.id || fight.id,
      order: index + 1
    };
  });

  for (const fight of existing) {
    if (fight?.id && usedExistingIds.has(String(fight.id))) continue;
    const pair = fightIdentityKey(fight);
    if (pair && merged.some(item => fightIdentityKey(item) === pair)) continue;
    merged.push({ ...fight, order: merged.length + 1 });
  }

  return merged;
}

function fightResultsFromFightList(fights = []) {
  return Object.fromEntries((fights || [])
    .filter(fight => fight?.id && fight?.winner)
    .map(fight => [fight.id, fight.winner]));
}

function liveContextText(event) {
  if (!event) return "";
  if (event.liveContext) return String(event.liveContext);
  if (event.gameContext) return String(event.gameContext);

  const fromStats = liveContextFromStats(event);
  if (fromStats) return fromStats;

  if (event.type === EVENT_TYPES.RANKED) {
    const firstDetail = (event.leaderboard || []).map(row => row?.detail).find(Boolean);
    if (firstDetail && event.status !== "pregame") return String(firstDetail);
    return event.status === "pregame" ? "Starts soon" : label(event.status);
  }

  return "";
}

function safeRefreshFieldsForEvent(event, existing = null) {
  const existingId = existing?.firestoreId || existing?.id || "";
  const hasFinancials = existingId && eventHasFinancialRecords(existingId);
  const trustedF1Refresh = event?.league === "F1" && event?.externalIds?.source === "jolpica-f1";

  const incomingOdds = event.odds || "Unavailable";
  const existingOdds = existing?.odds || "";
  const preservedOdds = isPlaceholderOdds(incomingOdds) && !isPlaceholderOdds(existingOdds) ? existingOdds : incomingOdds;
  const incomingWeatherText = event.weatherText || event.weather?.summary || "";
  const preservedWeatherText = incomingWeatherText || existing?.weatherText || existing?.weather?.summary || "";
  const incomingStats = Array.isArray(event.liveStats) ? event.liveStats : [];
  const existingStats = Array.isArray(existing?.liveStats) ? existing.liveStats : [];
  const protectedStatus = chooseProtectedStatus(event, existing);
  const protectedScore = chooseProtectedScore(event, existing);
  const preservedStats = chooseProtectedStats(incomingStats, existingStats, event, existing);
  const protectedLiveContext = event.liveContext || event.gameContext || existing?.liveContext || existing?.gameContext || liveContextFromStats({ liveStats: preservedStats });

  const fields = {
    status: protectedStatus,
    score: protectedScore,
    liveContext: protectedLiveContext || "",
    odds: preservedOdds,
    leaderboard: event.leaderboard?.length ? event.leaderboard : existing?.leaderboard || [],
    leaderboardSource: event.leaderboardSource || existing?.leaderboardSource || "Imported event data",
    leaderboardVerified: event.leaderboardVerified !== undefined ? !!event.leaderboardVerified : !!existing?.leaderboardVerified,
    liveStats: preservedStats,
    weather: event.weather || existing?.weather || null,
    weatherText: preservedWeatherText,
    venue: event.venue || existing?.venue || "",
    resultOrder: event.resultOrder?.length ? event.resultOrder : existing?.resultOrder || [],
    fightResults: { ...(existing?.fightResults || {}), ...(event.fightResults || {}) },
    intel: event.intel || existing?.intel || "",
    externalIds: mergeExternalIds(existing?.externalIds || {}, event.externalIds || {}),
    updatedAt: serverTimestamp()
  };

  if (event?.type === EVENT_TYPES.TEAM) {
    fields.away = {
      ...(existing?.away || {}),
      ...(event.away || {}),
      code: existing?.away?.code || event.away?.code || "AWAY",
      name: event.away?.name || existing?.away?.name || existing?.away?.code || event.away?.code || "Away team"
    };
    fields.home = {
      ...(existing?.home || {}),
      ...(event.home || {}),
      code: existing?.home?.code || event.home?.code || "HOME",
      name: event.home?.name || existing?.home?.name || existing?.home?.code || event.home?.code || "Home team"
    };
  }

  if (event?.type === EVENT_TYPES.FIGHT_CARD) {
    const mergedFights = mergeImportedUfcFights(existing?.fights || [], event.fights || []);
    fields.fights = mergedFights;
    fields.fightResults = {
      ...(existing?.fightResults || {}),
      ...(event.fightResults || {}),
      ...fightResultsFromFightList(mergedFights)
    };
  }

  if (!hasFinancials || trustedF1Refresh) {
    fields.title = event.title;
    fields.startTime = event.startTime;
    fields.participants = event.participants || [];
    if (event?.type !== EVENT_TYPES.FIGHT_CARD) fields.fights = event.fights || [];
  }

  if (hasFinancials && !trustedF1Refresh) {
    fields.lockedStructurePreserved = true;
    fields.structurePreservedReason = event?.type === EVENT_TYPES.FIGHT_CARD
      ? "Existing UFC bets/matches were preserved; sync retained existing fight IDs while merging newly discovered fights, statuses, and results."
      : "Existing bets/matches/ledger records present; sync did not change title, start time, event type, short code, or participant list.";
  }

  return fields;
}

function isAdmin() {
  const user = currentUser();
  return Boolean(user?.approved && user?.isAdmin);
}

function canBet() {
  const user = currentUser();
  return Boolean(user?.approved);
}

function canSettleFinalEvents() {
  // Routine settlement is server-side in v10.60. Keep this permission only for
  // explicit admin repair tools.
  return isAdmin();
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

function teamDisplayName(event, side) {
  const team = event?.[side] || {};
  const name = String(team.name || "").trim();
  const code = String(team.code || "").trim();

  if (name && name.toUpperCase() !== code.toUpperCase()) return name;
  return name || code || (side === "away" ? "Away team" : "Home team");
}

function eventDisplayTitle(event) {
  if (event?.type !== EVENT_TYPES.TEAM) return event?.title || event?.id || "Event";
  const separator = event?.sport === "soccer" ? "vs" : "at";
  return `${teamDisplayName(event, "away")} ${separator} ${teamDisplayName(event, "home")}`;
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

function formatExternalRefs(externalIds) {
  if (!externalIds || typeof externalIds !== "object") return "";

  const labelMap = {
    source: "Source",
    espnEventId: "ESPN",
    apiEventId: "API",
    oddsApiEventId: "Odds",
    shortCode: "Code"
  };

  const preferredKeys = ["source", "espnEventId", "apiEventId", "oddsApiEventId", "shortCode"];
  const orderedKeys = [
    ...preferredKeys.filter(key => key in externalIds),
    ...Object.keys(externalIds).filter(key => !preferredKeys.includes(key))
  ];

  return orderedKeys
    .map(key => {
      const value = externalIds[key];
      if (value === undefined || value === null || value === "") return "";
      const label = labelMap[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, char => char.toUpperCase());
      const shortValue = String(value).trim();
      if (!shortValue) return "";
      return `${label}: ${shortValue}`;
    })
    .filter(Boolean)
    .join(" · ");
}


function normalizeFightId(value, fallback = "fight") {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || fallback;
}

function fighterCode(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "TBD";
  const last = parts[parts.length - 1] || parts[0];
  return last.replace(/[^a-z0-9]/gi, "").slice(0, 10).toUpperCase() || "TBD";
}

function parseFightLine(line, index) {
  const raw = String(line || "").trim();
  if (!raw) return null;

  const parts = raw
    .split(/\s+(?:vs\.?|v\.?|versus)\s+|\s*\|\s*|\s+\/\s+/i)
    .map(part => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return null;

  const fighterA = parts[0];
  const fighterB = parts.slice(1).join(" vs ");
  const id = normalizeFightId(`${index + 1}-${fighterA}-${fighterB}`, `fight-${index + 1}`);

  return {
    id,
    order: index + 1,
    fighterA,
    fighterB,
    label: `${fighterA} vs ${fighterB}`,
    status: "pregame",
    winner: ""
  };
}

function parseFightCardInput(value) {
  return String(value || "")
    .split(/\n|,/)
    .map((line, index) => parseFightLine(line, index))
    .filter(Boolean)
    .slice(0, 8);
}

function fightById(event, fightId) {
  return (event?.fights || []).find(fight => fight.id === fightId) || null;
}

function fightPickName(fight, side) {
  if (!fight) return side;
  return side === "fighterB" ? fight.fighterB : fight.fighterA;
}

function fightResultWinner(event, fightId) {
  const fight = fightById(event, fightId);
  return event?.fightResults?.[fightId] || fight?.winner || "";
}

function getBettingDayISO(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const lookup = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const easternHour = Number(lookup.hour);
  const base = new Date(`${lookup.year}-${lookup.month}-${lookup.day}T12:00:00Z`);

  if (easternHour < BETTING_DAY_RESET_HOUR) base.setUTCDate(base.getUTCDate() - 1);
  return base.toISOString().slice(0, 10);
}

function mmddFromDate(dateLike) {
  const d = new Date(dateLike);
  if (!Number.isNaN(d.getTime())) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: DISPLAY_TIME_ZONE,
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
    timeZone: DISPLAY_TIME_ZONE,
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

function fightResultText(event, fight) {
  return fightResultWinner(event, fight?.id) || fight?.winner || "";
}

function fightStatusText(event, fight) {
  const raw = String(fight?.status || "").trim().toLowerCase();
  if (fightResultText(event, fight)) return "Final";
  if (["final", "complete", "completed", "closed", "settled"].includes(raw)) return "Final";
  if (["live", "in_progress", "in progress", "active"].includes(raw)) return "Live";
  if (event?.status === "final") return "Final";
  if (event?.status === "live") return "Open until fight starts/finalizes";
  return "Open";
}

function fightIsLocked(event, fight) {
  if (!event || !fight) return true;
  if (event.status === "final") return true;
  const raw = String(fight.status || "").trim().toLowerCase();
  if (fightResultText(event, fight)) return true;
  return ["live", "in_progress", "in progress", "final", "complete", "completed", "closed", "settled", "cancelled", "canceled"].includes(raw);
}

function fightCanTakeBets(event, fight) {
  return !fightIsLocked(event, fight);
}

function eventHasBegun(event) {
  const start = new Date(event?.startTime);
  if (!event || event.status === "final") return false;
  if (event.status === "live") return true;
  return !Number.isNaN(start.getTime()) && Date.now() >= start.getTime();
}

function doubleUpRequestedBy(match) {
  const requested = match?.doubleUp?.requestedBy || [];
  return Array.isArray(requested) ? requested.filter(Boolean) : [];
}

function matchUserRequestedDouble(match, userId) {
  return doubleUpRequestedBy(match).includes(userId);
}

function matchIsDoubled(match) {
  return Boolean(match?.doubleUp?.applied || match?.doubledUp);
}

function matchEffectiveAmount(match, betA = null, betB = null) {
  const doubledAmount = Number(match?.doubleUpAmount || match?.doubledAmount);
  if (matchIsDoubled(match) && Number.isFinite(doubledAmount) && doubledAmount > 0) return doubledAmount;

  const candidates = [
    match?.amount,
    match?.exposure,
    match?.matchedAmount,
    match?.wagerAmount,
    match?.stake,
    match?.doubleUp?.originalAmount
  ].map(Number).filter(value => Number.isFinite(value) && value > 0);

  const betAmounts = [betA?.amount, betA?.exposure, betB?.amount, betB?.exposure]
    .map(Number)
    .filter(value => Number.isFinite(value) && value > 0);

  let amount = candidates[0] || (betAmounts.length ? Math.min(...betAmounts) : 0);
  if (matchIsDoubled(match) && !match?.amount && !match?.exposure && match?.doubleUp?.originalAmount && !doubledAmount) amount *= 2;
  return amount;
}

function normalizedTeamSelectionToken(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function teamSelectionTokens(team = {}) {
  return new Set([
    team.side,
    team.id,
    team.teamId,
    team.uid,
    team.code,
    team.abbreviation,
    team.name,
    team.displayName,
    team.shortDisplayName,
    team.location,
    [team.location, team.name].filter(Boolean).join(" ")
  ].map(normalizedTeamSelectionToken).filter(Boolean));
}

function normalizeTeamSideForEvent(value, event = {}) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (["home", "h", "host"].includes(raw)) return "home";
  if (["away", "a", "visitor", "road"].includes(raw)) return "away";
  const token = normalizedTeamSelectionToken(value);
  if (!token) return "";
  if (teamSelectionTokens(event.home).has(token)) return "home";
  if (teamSelectionTokens(event.away).has(token)) return "away";
  return "";
}

function betForMatchSlot(match, event, slot) {
  const directId = String(slot === "A" ? (match.betA || match.bet1 || "") : (match.betB || match.bet2 || ""));
  if (directId) {
    const direct = state.bets[directId] || Object.values(state.bets || {}).find(bet => String(bet.firestoreId || bet.id || "") === directId);
    if (direct) return direct;
  }
  const userId = String(slot === "A"
    ? (match.userA || match.bettorA || match.playerA || "")
    : (match.userB || match.bettorB || match.playerB || ""));
  return Object.values(state.bets || {}).find(bet => recordMatchesEvent(bet, event) && String(bet.userId || bet.user || bet.bettorId || "") === userId) || null;
}

function resolvedTeamMatch(match, event) {
  const betA = betForMatchSlot(match, event, "A");
  const betB = betForMatchSlot(match, event, "B");
  const sideA = normalizeTeamSideForEvent(match.sideA || match.pickA || match.selectionA || match.teamA || betA?.side || betA?.pick || betA?.selection || betA?.team, event);
  const sideB = normalizeTeamSideForEvent(match.sideB || match.pickB || match.selectionB || match.teamB || betB?.side || betB?.pick || betB?.selection || betB?.team, event);
  const userA = String(match.userA || match.bettorA || match.playerA || betA?.userId || betA?.user || betA?.bettorId || "");
  const userB = String(match.userB || match.bettorB || match.playerB || betB?.userId || betB?.user || betB?.bettorId || "");
  const betAId = String(match.betA || match.bet1 || betA?.firestoreId || betA?.id || "");
  const betBId = String(match.betB || match.bet2 || betB?.firestoreId || betB?.id || "");
  const amount = matchEffectiveAmount(match, betA, betB);
  return { betA, betB, betAId, betBId, sideA, sideB, userA, userB, amount };
}

function matchLedgerId(eventId, matchId) {
  return `LEDGER-${String(eventId || "EVENT").replace(/[^a-z0-9-]/gi, "-")}-${String(matchId || "MATCH").replace(/[^a-z0-9-]/gi, "-")}`.toUpperCase();
}

function findLedgerForMatch(eventId, matchId, fromUser, toUser) {
  const ids = eventIdCandidates(eventId);
  return Object.values(state.ledgerEntries || {}).find(entry =>
    (entry.matchId && entry.matchId === matchId) ||
    (
      ids.has(String(entry.eventId || "")) &&
      entry.fromUser === fromUser &&
      entry.toUser === toUser &&
      !entry.settled
    )
  ) || null;
}

function doubleUpRequestStartedMs(match) {
  return toDateValue(match?.doubleUp?.requestedAt);
}

function doubleUpExpiresAtMs(match) {
  const started = doubleUpRequestStartedMs(match);
  return started ? started + DOUBLE_UP_ACCEPT_WINDOW_MS : 0;
}

function doubleUpTimeLeftMs(match) {
  const expiresAt = doubleUpExpiresAtMs(match);
  if (!expiresAt) return 0;
  return Math.max(0, expiresAt - Date.now());
}

function doubleUpIsPending(match) {
  if (!match || matchIsDoubled(match)) return false;
  const requested = doubleUpRequestedBy(match);
  return requested.length === 1 && doubleUpTimeLeftMs(match) > 0;
}

function doubleUpIsExpired(match) {
  if (!match || matchIsDoubled(match)) return false;
  const requested = doubleUpRequestedBy(match);
  return requested.length === 1 && doubleUpRequestStartedMs(match) > 0 && doubleUpTimeLeftMs(match) <= 0;
}

function doubleUpRequesterId(match) {
  return doubleUpRequestedBy(match)[0] || "";
}

function doubleUpOpponentId(match, userId) {
  if (match?.userA === userId) return match.userB;
  if (match?.userB === userId) return match.userA;
  return "";
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function hasActiveDoubleUpCountdowns() {
  return Object.values(state.matches || {}).some(match => doubleUpIsPending(match));
}

function updateDoubleUpCountdownDom() {
  document.querySelectorAll("[data-double-up-countdown]").forEach(node => {
    const matchId = node.dataset.doubleUpCountdown;
    const match = Object.values(state.matches || {}).find(item => (item.firestoreId || item.id) === matchId);
    if (!match || !doubleUpIsPending(match)) return;
    node.textContent = formatCountdown(doubleUpTimeLeftMs(match));
  });
}

function ensureDoubleUpCountdownTimer() {
  const hasCountdown = hasActiveDoubleUpCountdowns();
  if (hasCountdown && !doubleUpCountdownTimer) {
    updateDoubleUpCountdownDom();
    doubleUpCountdownTimer = setInterval(() => {
      if (!hasActiveDoubleUpCountdowns()) {
        clearInterval(doubleUpCountdownTimer);
        doubleUpCountdownTimer = null;
        requestPassiveRender();
        return;
      }
      updateDoubleUpCountdownDom();
    }, 1000);
  }

  if (!hasCountdown && doubleUpCountdownTimer) {
    clearInterval(doubleUpCountdownTimer);
    doubleUpCountdownTimer = null;
  }
}

function renderDoubleUpControl(event, match) {
  const user = currentUser();
  const matchId = match.firestoreId || match.id;
  if (!matchId) return "";
  if (!eventHasBegun(event)) return "";
  if (event.status === "final" || match.status !== "matched") return "";

  const involved = user?.approved && (match.userA === user.id || match.userB === user.id);
  const requesterId = doubleUpRequesterId(match);
  const accepterId = requesterId ? doubleUpOpponentId(match, requesterId) : "";
  const requesterName = requesterId ? userName(requesterId) : "";
  const accepterName = accepterId ? userName(accepterId) : "";

  if (matchIsDoubled(match)) {
    return `<span class="double-up-status doubled">Doubled up · ${money(Number(match.amount || 0))}</span>`;
  }

  if (doubleUpIsPending(match)) {
    const countdown = formatCountdown(doubleUpTimeLeftMs(match));

    if (involved && user.id === accepterId) {
      return `
        <div class="double-up-challenge">
          <span class="double-up-status waiting">${escapeHtml(requesterName)} requested double up · <span data-double-up-countdown="${escapeHtml(matchId)}">${countdown}</span></span>
          <button class="danger double-up-btn accept" data-double-up="${escapeHtml(matchId)}">Accept double up</button>
        </div>
      `;
    }

    if (involved && user.id === requesterId) {
      return `<span class="double-up-status waiting">Double up requested — waiting for ${escapeHtml(accepterName)} · <span data-double-up-countdown="${escapeHtml(matchId)}">${countdown}</span></span>`;
    }

    return `<span class="double-up-status waiting">${escapeHtml(requesterName)} challenged ${escapeHtml(accepterName)} to double up · <span data-double-up-countdown="${escapeHtml(matchId)}">${countdown}</span></span>`;
  }

  if (doubleUpIsExpired(match)) {
    if (involved) {
      return `<button class="danger double-up-btn" data-double-up="${escapeHtml(matchId)}">Double up again</button>`;
    }
    return `<span class="double-up-status expired">Double up request expired</span>`;
  }

  if (!involved) return "";

  return `<button class="danger double-up-btn" data-double-up="${escapeHtml(matchId)}">Double up</button>`;
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

function captureTransientUiState() {
  const app = document.querySelector("#app");
  if (!app) return null;

  const fields = {};
  app.querySelectorAll("input[id], select[id], textarea[id]").forEach(field => {
    const type = String(field.type || "").toLowerCase();
    if (type === "file" || type === "password") return;
    fields[field.id] = {
      value: field.value,
      checked: "checked" in field ? field.checked : undefined
    };
  });

  const active = document.activeElement;
  const activeId = active?.id || "";
  const selection = activeId && typeof active?.selectionStart === "number"
    ? { start: active.selectionStart, end: active.selectionEnd }
    : null;

  return {
    fields,
    activeId,
    selection,
    pageX: window.scrollX,
    pageY: window.scrollY,
    navScrollLeft: document.querySelector(".navbar")?.scrollLeft || 0
  };
}

function restoreTransientUiState(snapshot) {
  if (!snapshot) return;

  Object.entries(snapshot.fields || {}).forEach(([id, saved]) => {
    const field = document.getElementById(id);
    if (!field) return;
    const type = String(field.type || "").toLowerCase();
    if (type === "checkbox" || type === "radio") {
      field.checked = !!saved.checked;
    } else {
      field.value = saved.value;
    }
  });

  const nav = document.querySelector(".navbar");
  if (nav) nav.scrollLeft = snapshot.navScrollLeft;

  const active = snapshot.activeId ? document.getElementById(snapshot.activeId) : null;
  if (active && !active.disabled) {
    active.focus({ preventScroll: true });
    if (snapshot.selection && typeof active.setSelectionRange === "function") {
      try {
        active.setSelectionRange(snapshot.selection.start, snapshot.selection.end);
      } catch {
        // Some input types do not support text selection.
      }
    }
  }

  requestAnimationFrame(() => window.scrollTo(snapshot.pageX, snapshot.pageY));
}

function renderApp() {
  const transientUi = captureTransientUiState();
  document.querySelector("#app").innerHTML = `
    <main class="app-shell">
      ${renderTopbar()}
      ${renderFirebaseNotice()}
      ${renderSettlementSyncNotice()}
      ${renderHero()}
      ${renderViews()}
    </main>
  `;
  wireUi();
  restoreTransientUiState(transientUi);
  keepActiveNavVisible();
  maybeStartAutoMaintenance();
  maybeStartSettlementMaintenance();
  ensureDoubleUpCountdownTimer();
}

function keepActiveNavVisible() {
  requestAnimationFrame(() => {
    const nav = document.querySelector(".navbar");
    const active = nav?.querySelector(".nav-btn.active");
    if (!nav || !active) return;

    const targetLeft = active.offsetLeft - ((nav.clientWidth - active.clientWidth) / 2);
    nav.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
  });
}

function renderSettlementSyncNotice() {
  if (!settlementSyncMessage) return "";
  return `<section class="panel settlement-sync-notice">${escapeHtml(settlementSyncMessage)}</section>`;
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
        ${renderNavButton("today", "Now")}
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
  if (activeTab === "today") return "";

  const text = {
    mybets: ["My Bets", "Open bets, matched battles, and active entries."],
    ledger: ["Ledger", "What you owe, what others owe you, and settled balances."],
    leaderboard: ["Leaderboard", "Approved users ranked by net profit."],
    history: ["History", "Final events, game IDs, results, and betting outcomes."],
    profile: ["Profile", "Account, picture, and notification settings."],
    stats: ["Stats", "Personal betting performance and opponent breakdowns."],
    about: ["About", "How bets, matching, ledger entries, and settlements work."],
    admin: ["Admin", "Approve users, sync events, settle results, and repair the ledger."]
  }[activeTab] || ["Everyone Loses", "Head-to-head sports betting battles."];

  return `
    <section class="page-hero compact-hero no-signin-hero">
      <h2>${escapeHtml(text[0])}</h2>
      ${text[1] ? `<p>${escapeHtml(text[1])}</p>` : ""}
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
  const allVisibleEvents = Object.values(state.events)
    .filter(event => !eventIsComplete(event))
    .filter(eventIsWithinNowWindow);

  const events = allVisibleEvents
    .filter(event => filters.sport === "all" || event.sport === filters.sport)
    .filter(event => filters.league === "all" || event.league === filters.league)
    .filter(eventMatchesBetStateFilter)
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  const leagues = filters.sport === "all" ? Object.values(SPORT_GROUPS).flat() : SPORT_GROUPS[filters.sport] || [];

  return `
    <div class="toolbar panel today-filters">
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
      <div class="bet-state-filter">
        <label>Bet activity</label>
        <select id="betStateFilter">
          <option value="all" ${filters.betState === "all" ? "selected" : ""}>All Games</option>
          <option value="placed" ${filters.betState === "placed" ? "selected" : ""}>Games with Bets Placed</option>
          <option value="active" ${filters.betState === "active" ? "selected" : ""}>Games with Active Bets</option>
          <option value="none" ${filters.betState === "none" ? "selected" : ""}>Games with No Bets at All</option>
        </select>
      </div>
    </div>
    <div class="grid">
      ${events.length ? events.map(renderEventCardSafe).join("") : `<div class="panel empty-state">No active/upcoming events match these filters within the Now window. Final events move to History.</div>`}
    </div>
  `;
}

function renderEventCardSafe(event) {
  try {
    return renderEventCard(event);
  } catch (error) {
    console.error("Event card render failed", event, error);
    const eventId = event?.firestoreId || event?.id || "unknown-event";
    const title = event?.title || eventId;
    return `
      <article class="event-card event-render-error">
        <div class="event-top">
          <div class="event-main">
            <div class="sport-icon">!</div>
            <div>
              <div class="kicker">Render issue</div>
              <h3 class="event-title">${escapeHtml(title)}</h3>
              <p class="muted small">This event could not render, but the rest of the board is still shown. Event ID: ${escapeHtml(eventId)}</p>
            </div>
          </div>
        </div>
      </article>
    `;
  }
}

function renderEventCard(event) {
  const locked = eventIsLocked(event);
  const externalRefs = formatExternalRefs(event.externalIds);

  return `
    <article class="event-card">
      <div class="event-top">
        <div class="event-main">
          <div class="sport-icon">${renderLeagueLogo(event.sport, event.league)}</div>
          <div>
            <div class="kicker">${escapeHtml(event.league)} · ${event.type === EVENT_TYPES.TEAM ? "Head-to-head" : event.type === EVENT_TYPES.FIGHT_CARD ? "Fight card" : "Ranked finish"}</div>
            <h3 class="event-title">${escapeHtml(eventDisplayTitle(event))}</h3>
            <div class="meta-line">
              <span class="status-badge ${escapeHtml(event.status)}">${escapeHtml(label(event.status))}</span>
              <span class="badge">${escapeHtml(formatTime(event.startTime))} ET</span>
            </div>
            <div class="logo-stack">
              ${event.type === EVENT_TYPES.TEAM
                ? `<span class="soft-badge team-name-badge">${escapeHtml(teamDisplayName(event, "away"))}</span><span class="soft-badge">vs</span><span class="soft-badge team-name-badge">${escapeHtml(teamDisplayName(event, "home"))}</span>`
                : event.type === EVENT_TYPES.FIGHT_CARD
                  ? `<span class="soft-badge">${(event.fights || []).length} fights</span>`
                  : `<span class="soft-badge">${event.participants.length} participants</span>`}
            </div>
          </div>
        </div>
        ${event.type === EVENT_TYPES.TEAM ? renderHeaderOddsDisplay(event) : ""}
      </div>
      ${renderScoreLine(event)}
      <div class="bet-box compact-bet-box">
        <h4>Quick bet</h4>
        ${event.type === EVENT_TYPES.TEAM ? renderTeamBetForm(event, locked) : event.type === EVENT_TYPES.FIGHT_CARD ? renderFightCardBetForm(event, locked) : renderRankedBetForm(event, locked)}
      </div>
      ${renderEventQueues(event)}
    </article>
  `;
}

function toOrdinal(number) {
  const n = Number(number);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

function normalizedRacingRows(event) {
  const rows = [];
  const seen = new Set();

  for (const row of event.leaderboard || []) {
    const name = row?.name || row?.driver || row?.participant;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    rows.push({
      position: Number(row.position || row.rank || rows.length + 1),
      name,
      detail: row.detail || row.laps || row.time || row.status || ""
    });
  }

  for (const name of event.resultOrder || []) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    rows.push({ position: rows.length + 1, name, detail: "Final" });
  }

  if (!rows.length) {
    for (const name of event.participants || []) {
      if (!name || seen.has(name)) continue;
      seen.add(name);
      rows.push({ position: rows.length + 1, name, detail: event.status === "pregame" ? "Entry" : "Position pending" });
    }
  }

  return rows
    .filter(row => row.name)
    .sort((a, b) => {
      const ap = Number.isFinite(Number(a.position)) ? Number(a.position) : 999;
      const bp = Number.isFinite(Number(b.position)) ? Number(b.position) : 999;
      return ap - bp;
    })
    .slice(0, 18);
}


function renderLiveStats(stats = [], fallback = [], event = null) {
  const sourceRows = Array.isArray(stats) && stats.length ? stats : fallback;
  const awayCode = String(event?.away?.code || "").toUpperCase();
  const homeCode = String(event?.home?.code || "").toUpperCase();
  const teamCodes = [awayCode, homeCode].filter(Boolean);

  function cleanRow(stat) {
    if (!stat) return null;
    const labelText = String(stat.label || "").trim();
    const statLabel = labelText;
    let value = String(stat.value ?? "").trim();

    if (!labelText || /^(source|venue|odds|status)$/i.test(labelText)) return null;
    if (event && /^weather$/i.test(statLabel)) value = eventWeatherText(event);
    if (!value) return null;
    if (/^(unavailable|api schedule import|scoreboard active|detailed boxscore unavailable)$/i.test(value)) return null;
    if (/^(away scoring|home scoring)$/i.test(labelText)) return null;
    if (/\bby period\b|^\d+(?:-\d+)+$/i.test(value)) return null;

    const labelUpper = labelText.toUpperCase();
    const teamCode = teamCodes.find(code => labelUpper === code || labelUpper.startsWith(`${code} `)) || "";
    return { ...stat, label: labelText, value, teamCode };
  }

  function statImportance(row) {
    const label = `${row.label} ${row.value}`.toLowerCase();
    if (/^weather$/i.test(row.label)) return 995;
    if (/runs?|hits?|errors?|left on base|lob|pitch|strikeout|\bso\b|era|whip|shots?|possession|saves?|rebounds?|assists?|turnovers?|yards?|first downs?|power play/i.test(label)) return 90;
    if (/leader|goal|rbi|hr|pts|reb|ast|yds|td|sog|sv/i.test(label)) return 70;
    return 40;
  }

  const rows = sourceRows.map(cleanRow).filter(Boolean);
  const pinned = [];
  for (const name of ["Weather"]) {
    const found = rows.find(row => row.label.toLowerCase() === name.toLowerCase());
    if (found) pinned.push(found);
  }

  const usedKeys = new Set(pinned.map(row => `${row.label}|${row.value}`));
  const teamRows = new Map(teamCodes.map(code => [code, []]));
  const generalRows = [];

  for (const row of rows) {
    const key = `${row.label}|${row.value}`;
    if (usedKeys.has(key)) continue;
    if (row.teamCode && teamRows.has(row.teamCode)) teamRows.get(row.teamCode).push(row);
    else generalRows.push(row);
  }

  for (const code of teamCodes) {
    teamRows.get(code)?.sort((a, b) => statImportance(b) - statImportance(a));
  }
  generalRows.sort((a, b) => statImportance(b) - statImportance(a));

  const selected = [...pinned];
  const teamCounts = new Map(teamCodes.map(code => [code, 0]));
  const maxRows = 6;
  const perTeamCap = 2;

  function add(row) {
    if (!row || selected.length >= maxRows) return false;
    const key = `${row.label}|${row.value}`;
    if (usedKeys.has(key)) return false;
    if (row.teamCode) {
      if ((teamCounts.get(row.teamCode) || 0) >= perTeamCap) return false;
      teamCounts.set(row.teamCode, (teamCounts.get(row.teamCode) || 0) + 1);
    }
    usedKeys.add(key);
    selected.push(row);
    return true;
  }

  // Reserve visible space for both sides. This prevents old/stale ESPN rows from
  // filling the whole stat box with only the first team returned by the API.
  for (let round = 0; round < perTeamCap && selected.length < maxRows; round += 1) {
    for (const code of teamCodes) {
      add((teamRows.get(code) || [])[round]);
    }
  }

  for (const row of generalRows) add(row);

  if (!selected.length && event?.type === EVENT_TYPES.TEAM && event?.status !== "final") {
    selected.push({ label: "Weather", value: eventWeatherText(event) });
  }

  if (!selected.length) return "";
  return `
    <div class="mini-stat-grid">
      ${selected.slice(0, maxRows).map(stat => `
        <span><strong>${escapeHtml(stat.label || "Stat")}</strong>${escapeHtml(String(stat.value ?? "Unavailable"))}</span>
      `).join("")}
    </div>
  `;
}

function renderScoreLine(event) {
  if (event.type === EVENT_TYPES.TEAM) {
    const hasScore = !!event.score;
    const awayScore = hasScore ? event.score.away : "—";
    const homeScore = hasScore ? event.score.home : "—";
    const winner = event.status === "final" && hasScore
      ? Number(event.score.away) > Number(event.score.home)
        ? teamDisplayName(event, "away")
        : Number(event.score.home) > Number(event.score.away)
          ? teamDisplayName(event, "home")
          : "Draw"
      : "";

    return `
      <div class="score-card event-center team-center">
        <div class="event-center-label">${event.status === "final" ? "Final scoreboard" : event.status === "live" ? "Live scoreboard" : "Scoreboard"}</div>
        ${liveContextText(event) ? `<div class="score-sub live-context">${escapeHtml(liveContextText(event))}</div>` : ""}
        <div class="team-score-row">
          <div class="team-score-cell">
            <span class="team-code team-full-name">${escapeHtml(teamDisplayName(event, "away"))}</span>
            <strong>${escapeHtml(String(awayScore))}</strong>
          </div>
          <span class="score-divider">vs</span>
          <div class="team-score-cell right">
            <span class="team-code team-full-name">${escapeHtml(teamDisplayName(event, "home"))}</span>
            <strong>${escapeHtml(String(homeScore))}</strong>
          </div>
        </div>
        ${renderLiveStats(event.liveStats, [
          { label: "Status", value: label(event.status) },
          { label: "Weather", value: eventWeatherText(event) },
          { label: event.status === "final" ? "Winner" : "Live", value: winner || "Scoreboard active" }
        ], event)}
        ${renderOddsDisplay(event)}
        ${eventOddsMeta(event) ? `<div class="score-sub odds-line">${escapeHtml(eventOddsMeta(event))}</div>` : ""}
      </div>
    `;
  }


  if (event.type === EVENT_TYPES.FIGHT_CARD) {
    const fights = event.fights || [];
    return `
      <div class="score-card fight-card-score">
        <div class="event-center-label">Main card</div>
        <div class="fight-list">
          ${fights.length ? fights.map(fight => {
            const winner = fightResultText(event, fight);
            const locked = fightIsLocked(event, fight);
            return `
            <div class="fight-row ${locked ? "fight-locked" : "fight-open"}">
              <span class="fight-number">#${escapeHtml(fight.order || "")}${fight.cardRole === "main-event" ? " · Main" : fight.cardRole === "co-main" ? " · Co-main" : ""}</span>
              <strong>${escapeHtml(fight.fighterA)}</strong>
              <span class="score-divider">vs</span>
              <strong>${escapeHtml(fight.fighterB)}</strong>
              <span class="fight-status-pill ${locked ? "locked" : "open"}">${escapeHtml(fightStatusText(event, fight))}</span>
              ${winner ? `<em>Winner: ${escapeHtml(winner)}</em>` : ""}
            </div>
          `;
          }).join("") : `<div class="record">No fights listed yet.</div>`}
        </div>
        <div class="score-sub odds-line">Fight odds: ${escapeHtml(shouldShowOddsText(event) ? eventOddsText(event) : "Unavailable unless a supported sportsbook feed returns UFC markets")}</div>
      </div>
    `;
  }

  const rows = normalizedRacingRows(event);
  const heading = event.status === "final" ? "Final leaderboard" : event.status === "live" ? "Live leaderboard" : "Entry list";
  const sourceLabel = event.leaderboardSource || "Imported event data";
  const sub = event.leaderboardVerified
    ? `Verified positions from ${sourceLabel}.`
    : event.status === "pregame"
      ? "Entry list now; live positions appear when a verified feed is available."
      : "Leaderboard pending verification so we do not show misleading standings as live positions.";

  return `
    <div class="score-card event-center racing-center">
      <div class="event-center-head">
        <div>
          <div class="event-center-label">${escapeHtml(heading)}</div>
          ${liveContextText(event) ? `<div class="score-sub live-context">${escapeHtml(liveContextText(event))}</div>` : ""}
          <div class="score-sub">${escapeHtml(sub)}</div>
        </div>
        <span class="soft-badge">${escapeHtml(event.league)}</span>
      </div>
      <div class="race-leaderboard">
        ${rows.map((row, index) => `
          <div class="race-leaderboard-row ${index < 3 ? "podium" : ""}">
            <span class="race-position">${escapeHtml(toOrdinal(row.position || index + 1))}</span>
            <strong>${escapeHtml(row.name)}</strong>
            <span>${escapeHtml(row.detail || "")}</span>
          </div>
        `).join("")}
      </div>
      ${renderLiveStats(event.liveStats, [
        { label: "Source", value: sourceLabel },
        { label: "Status", value: label(event.status) },
        { label: "Entries", value: String(rows.length) }
      ], event)}
      <div class="score-sub odds-line">Odds: ${escapeHtml(eventOddsText(event))}</div>
    </div>
  `;
}

function renderTeamBetForm(event, locked) {
  return `
    ${!canBet() ? `<p class="warning small">Log in with an approved account to place bets.</p>` : ""}
    <div class="money-row">
      <div>
        <label>Bet amount</label>
        <input id="amount-${escapeHtml(event.id)}" type="number" min="1" step="1" value="1" ${locked ? "disabled" : ""} />
      </div>
      <button class="primary" data-bet-team="${escapeHtml(event.id)}" data-side="away" ${locked || !canBet() ? "disabled" : ""}>Pick ${escapeHtml(teamDisplayName(event, "away"))}</button>
      <button class="primary" data-bet-team="${escapeHtml(event.id)}" data-side="home" ${locked || !canBet() ? "disabled" : ""}>Pick ${escapeHtml(teamDisplayName(event, "home"))}</button>
    </div>
    <p class="footer-note small">${locked ? "This event is locked." : "Multiple bets are allowed, but all of your bets on one event must stay on the same side."}</p>
    ${(canBet() && !locked) || renderAdminOddsButton(event) ? `
      <div class="bet-actions">
        ${canBet() && !locked ? `<button class="ghost" data-clear-event-bets="${escapeHtml(event.id)}">Clear my bets for this event</button>` : ""}
        ${renderAdminOddsButton(event)}
      </div>
    ` : ""}
  `;
}


function renderFightCardBetForm(event, locked) {
  const fights = event.fights || [];
  const cardFinal = event.status === "final";
  const openFightCount = fights.filter(fight => fightCanTakeBets(event, fight)).length;

  return `
    ${!canBet() ? `<p class="warning small">Log in with an approved account to place bets.</p>` : ""}
    <div class="fight-bet-list">
      ${fights.length ? fights.map(fight => {
        const fightLocked = fightIsLocked(event, fight);
        const winner = fightResultText(event, fight);
        const disabled = fightLocked || !canBet();
        return `
        <div class="fight-bet-row ${fightLocked ? "fight-locked" : "fight-open"}">
          <div>
            <strong>${escapeHtml(fight.label || `${fight.fighterA} vs ${fight.fighterB}`)}</strong>
            <span class="muted tiny">${fight.cardRole === "main-event" ? "Main event" : fight.cardRole === "co-main" ? "Co-main event" : `Fight ${escapeHtml(fight.order || "")}`} · ${escapeHtml(fightStatusText(event, fight))}${winner ? ` · Winner: ${escapeHtml(winner)}` : ""}</span>
          </div>
          <input id="amount-${escapeHtml(event.id)}-${escapeHtml(fight.id)}" type="number" min="1" step="1" value="1" ${disabled ? "disabled" : ""} />
          <button class="primary" data-bet-fight="${escapeHtml(event.id)}" data-fight-id="${escapeHtml(fight.id)}" data-side="fighterA" ${disabled ? "disabled" : ""}>Pick ${escapeHtml(fighterCode(fight.fighterA))}</button>
          <button class="primary" data-bet-fight="${escapeHtml(event.id)}" data-fight-id="${escapeHtml(fight.id)}" data-side="fighterB" ${disabled ? "disabled" : ""}>Pick ${escapeHtml(fighterCode(fight.fighterB))}</button>
        </div>
      `;
      }).join("") : `<div class="record">No UFC fights have been added yet.</div>`}
    </div>
    <p class="footer-note small">${cardFinal ? "This fight card is final." : openFightCount ? `Card is ${label(event.status)}. ${openFightCount} fight${openFightCount === 1 ? "" : "s"} still open for bets.` : "All listed fights are locked."} UFC locks by individual fight, not by the whole card going live.</p>
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
  const openBets = Object.values(state.bets).filter(bet => recordMatchesEvent(bet, event) && bet.status === "open");
  const matched = Object.values(state.matches).filter(match => recordMatchesEvent(match, event));

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
            <span class="muted small">${escapeHtml(userName(match.userA))} vs ${escapeHtml(userName(match.userB))} · ${money(matchEffectiveAmount(match))} · ${escapeHtml(label(match.status))}</span>
            ${renderDoubleUpControl(event, match)}
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function displayPick(event, bet) {
  if (event?.type === EVENT_TYPES.TEAM) return bet.side === "home" ? teamDisplayName(event, "home") : teamDisplayName(event, "away");
  if (event?.type === EVENT_TYPES.FIGHT_CARD) {
    const fight = fightById(event, bet.fightId);
    return `${fight?.label || "Fight"} · ${fightPickName(fight, bet.side)}`;
  }
  return bet.participant || "Unknown";
}

function betIsCurrent(bet) {
  const event = state.events[bet?.eventId] || findEventByIdOrCode(bet?.eventId);
  if (!bet || bet.status === "settled" || bet.status === "cancelled") return false;
  if (event?.status === "final") return false;
  return true;
}

function matchIsCurrent(match) {
  const event = state.events[match?.eventId] || findEventByIdOrCode(match?.eventId);
  if (!match || match.status !== "matched") return false;
  if (event?.status === "final") return false;
  return true;
}

function renderMyBets() {
  const user = currentUser();
  if (!user) return `<div class="panel empty-state">Log in to see your bets.</div>`;
  if (!user.approved) return `<div class="panel empty-state">Your account is pending admin approval.</div>`;

  const bets = Object.values(state.bets)
    .filter(bet => bet.userId === user.id)
    .filter(betIsCurrent)
    .sort(sortNewest);

  const matches = Object.values(state.matches)
    .filter(match => match.userA === user.id || match.userB === user.id)
    .filter(matchIsCurrent)
    .sort(sortNewest);

  return `
    <div class="two-col">
      <div class="panel"><h3>Current Bet Entries</h3><div class="history-list">${bets.length ? bets.map(renderBetRecord).join("") : `<div class="record">No current bet entries.</div>`}</div></div>
      <div class="panel"><h3>My matched battles</h3><div class="history-list">${matches.length ? matches.map(renderMatchRecord).join("") : `<div class="record">No current matched battles.</div>`}</div></div>
    </div>
  `;
}

function renderBetRecord(bet) {
  const event = state.events[bet.eventId] || findEventByIdOrCode(bet.eventId);
  return `<div class="record"><strong>${escapeHtml(event ? eventDisplayTitle(event) : bet.eventId)}</strong><br><span class="muted small">${escapeHtml(displayPick(event, bet))} · ${money(bet.amount)} · ${escapeHtml(label(bet.status))}</span><br><span class="tiny muted">${escapeHtml(event?.shortCode || bet.eventId)}</span></div>`;
}

function renderMatchRecord(match) {
  const event = state.events[match.eventId] || findEventByIdOrCode(match.eventId);
  const doubleText = matchIsDoubled(match)
    ? " · Doubled up"
    : doubleUpIsPending(match)
      ? ` · Double up pending ${formatCountdown(doubleUpTimeLeftMs(match))}`
      : doubleUpIsExpired(match)
        ? " · Double up expired"
        : "";
  return `<div class="record"><strong>${escapeHtml(event ? eventDisplayTitle(event) : match.eventId)}</strong><br><span class="muted small">${escapeHtml(userName(match.userA))} vs ${escapeHtml(userName(match.userB))} · ${escapeHtml(label(match.status))} · ${money(matchEffectiveAmount(match))}${escapeHtml(doubleText)}</span><br><span class="tiny muted">${escapeHtml(event?.shortCode || match.eventId)}</span></div>`;
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
  const allHistoryEvents = Object.values(state.events)
    .filter(eventIsWithinHistoryWindow);

  const events = allHistoryEvents
    .filter(event => historyFilters.sport === "all" || event.sport === historyFilters.sport)
    .filter(event => historyFilters.league === "all" || event.league === historyFilters.league)
    .filter(event => eventMatchesBetStateFilter(event, historyFilters.betState))
    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

  const leagues = historyFilters.sport === "all"
    ? Object.values(SPORT_GROUPS).flat()
    : SPORT_GROUPS[historyFilters.sport] || [];

  return `
    <div class="toolbar panel today-filters history-filters">
      <div>
        <label>Sport</label>
        <select id="historySportFilter">
          <option value="all">All sports</option>
          ${Object.keys(SPORT_GROUPS).map(sport => `<option value="${sport}" ${historyFilters.sport === sport ? "selected" : ""}>${escapeHtml(label(sport))}</option>`).join("")}
        </select>
      </div>
      <div>
        <label>League / origin</label>
        <select id="historyLeagueFilter">
          <option value="all">All leagues</option>
          ${leagues.map(league => `<option value="${league}" ${historyFilters.league === league ? "selected" : ""}>${escapeHtml(league)}</option>`).join("")}
        </select>
      </div>
      <div class="bet-state-filter">
        <label>Bet activity</label>
        <select id="historyBetStateFilter">
          <option value="all" ${historyFilters.betState === "all" ? "selected" : ""}>All Games</option>
          <option value="placed" ${historyFilters.betState === "placed" ? "selected" : ""}>Games with Bets Placed</option>
          <option value="active" ${historyFilters.betState === "active" ? "selected" : ""}>Games with Active Bets</option>
          <option value="none" ${historyFilters.betState === "none" ? "selected" : ""}>Games with No Bets at All</option>
        </select>
      </div>
    </div>
    <div class="history-list compact-history-list">
      ${events.length ? events.map(renderHistoryEventCard).join("") : `<div class="panel empty-state">No final event history matches these filters from the last 5 days.</div>`}
    </div>
  `;
}

function historyBetSummary(event) {
  const bets = Object.values(state.bets || {}).filter(bet => recordMatchesEvent(bet, event));
  const matches = Object.values(state.matches || {}).filter(match => recordMatchesEvent(match, event));
  const ledger = Object.values(state.ledgerEntries || {}).filter(entry => recordMatchesEvent(entry, event));

  if (ledger.length) {
    return ledger.map(entry => `${userName(entry.fromUser)} owes ${userName(entry.toUser)} ${money(entry.amount)}${entry.doubledUp ? " · doubled up" : ""}`).join(" · ");
  }

  const settledMatches = matches.filter(match => match.status === "settled" && match.winner && match.loser);
  if (settledMatches.length) {
    return settledMatches.map(match => `${userName(match.loser)} owes ${userName(match.winner)} ${money(match.settledAmount || matchEffectiveAmount(match))}${matchIsDoubled(match) ? " · doubled up" : ""}`).join(" · ");
  }

  const voidMatches = matches.filter(match => String(match.status || "").toLowerCase() === "void");
  if (voidMatches.length) {
    const draw = voidMatches.some(match => String(match.result || "").toLowerCase() === "draw")
      || (event.type === EVENT_TYPES.TEAM && Number(event.score?.away) === Number(event.score?.home));
    return `${voidMatches.length} matched bet${voidMatches.length === 1 ? "" : "s"} · ${draw ? "voided because the game ended in a draw" : "voided"} · no money owed`;
  }

  const cancelledMatches = matches.filter(match => String(match.status || "").toLowerCase() === "cancelled");
  const unresolvedMatches = matches.filter(match => !["settled", "void", "cancelled"].includes(String(match.status || "").toLowerCase()));
  if (unresolvedMatches.length) {
    const issue = unresolvedMatches.map(match => match.settlementIssue).filter(Boolean)[0] || event.settlementIssue || "automatic settlement has not completed";
    return `${unresolvedMatches.length} matched bet${unresolvedMatches.length === 1 ? "" : "s"} · settlement needs attention: ${issue}`;
  }

  if (cancelledMatches.length) {
    return `${cancelledMatches.length} matched bet${cancelledMatches.length === 1 ? "" : "s"} · cancelled`;
  }

  if (bets.length) {
    const closed = bets.every(bet => ["settled", "void", "expired", "cancelled"].includes(String(bet.status || "").toLowerCase()));
    return closed
      ? `${bets.length} bet entr${bets.length === 1 ? "y" : "ies"} · closed with no ledger balance`
      : `${bets.length} open/unmatched bet${bets.length === 1 ? "" : "s"}`;
  }

  return "No bets on this event";
}

function renderCompactLeaderboard(event) {
  if (event.type !== EVENT_TYPES.RANKED) return "";
  const rows = normalizedRacingRows(event).slice(0, 10);
  if (!rows.length) return "";
  return `
    <div class="compact-leaderboard">
      ${rows.map(row => `
        <div class="compact-leaderboard-row">
          <span>${escapeHtml(toOrdinal(row.position))}</span>
          <strong>${escapeHtml(row.name)}</strong>
          <em>${escapeHtml(row.detail || "")}</em>
        </div>
      `).join("")}
    </div>
  `;
}

function renderHistoryResultLine(event) {
  if (event.type === EVENT_TYPES.TEAM) {
    const away = teamDisplayName(event, "away");
    const home = teamDisplayName(event, "home");
    const awayScore = event.score?.away ?? "—";
    const homeScore = event.score?.home ?? "—";
    return `${away} ${awayScore} · ${home} ${homeScore}`;
  }

  const winner = normalizedRacingRows(event)[0]?.name || event.resultOrder?.[0] || "Winner unavailable";
  return `Winner: ${winner}`;
}

function renderHistoryEventCard(event) {
  const eventId = event.firestoreId || event.id;
  const externalRefs = formatExternalRefs(event.externalIds);
  const matchup = event.type === EVENT_TYPES.TEAM
    ? `${teamDisplayName(event, "away")} vs ${teamDisplayName(event, "home")}`
    : `${(event.participants || []).length} entries`;
  const displayCode = event.shortCode || nextEventDisplayCode(event.league, event.startTime);
  const betSummary = historyBetSummary(event);
  const resultLine = renderHistoryResultLine(event);

  return `
    <article class="compact-history-card history-tile">
      <div class="compact-history-head">
        <div class="sport-icon">${renderLeagueLogo(event.sport, event.league)}</div>
        <div>
          <div class="kicker">${escapeHtml(event.league)} · ${escapeHtml(formatTime(event.startTime))} ET</div>
          <h3>${escapeHtml(eventDisplayTitle(event))}</h3>
          <p class="muted small">${escapeHtml(matchup)}</p>
        </div>
      </div>

      <div class="history-result-line">
        <strong>Result</strong>
        <span>${escapeHtml(resultLine)}</span>
      </div>

      ${renderCompactLeaderboard(event)}

      <div class="compact-history-foot">
        <span>${escapeHtml(betSummary)}</span>
      </div>

      <div class="history-id-grid">
        <div><span class="code-label">Code</span><strong>${escapeHtml(displayCode)}</strong></div>
        <div><span class="code-label">Game ID</span><span class="code-value">${escapeHtml(eventId)}</span></div>
        ${externalRefs ? `<div class="wide"><span class="code-label">External refs</span><span class="code-value">${escapeHtml(externalRefs)}</span></div>` : ""}
      </div>
    </article>
  `;
}

function renderProfile() {
  const user = currentUser();
  if (!user) return `<div class="panel empty-state">Log in to edit your profile.</div>`;

  const stats = getUserStats(user.id);

  return `
    <div class="profile-grid profile-grid-v2">
      <div class="profile-block profile-overview-block">
        <div class="profile-header">
          ${renderAvatar(user, "large")}
          <div>
            <h3>${escapeHtml(user.displayName)}</h3>
            <p class="muted">${escapeHtml(user.email)}</p>
            <p class="${stats.net >= 0 ? "good" : "bad"}"><strong>Lifetime net: ${money(stats.net)}</strong></p>
            ${!user.approved ? `<p class="warning">Pending admin approval</p>` : ""}
          </div>
        </div>

        <div class="profile-summary-inline">
          <h3>Lifetime summary</h3>
          <div class="stat-list">
            <div class="stat-line"><span>Gross won</span><strong>${money(stats.grossWon)}</strong></div>
            <div class="stat-line"><span>Gross lost</span><strong>${money(stats.grossLost)}</strong></div>
            <div class="stat-line"><span>Ledger win rate</span><strong>${stats.winRate}%</strong></div>
            <div class="stat-line"><span>Ledger decisions</span><strong>${stats.total}</strong></div>
          </div>
        </div>
      </div>

      <div class="profile-block profile-edit-block">
        <h3>Edit profile</h3>
        <label>Display name</label>
        <input id="profileDisplayName" value="${escapeHtml(user.displayName)}" />
        <label>Emoji avatar</label>
        <select id="profileAvatar">${AVATAR_CHOICES.map(choice => `<option value="${choice}" ${user.avatar === choice ? "selected" : ""}>${choice}</option>`).join("")}</select>
        <label>Profile picture URL</label>
        <input id="profileImageUrl" value="${escapeHtml(user.profileImageUrl || "")}" placeholder="Paste an image URL, or leave blank for emoji" />

        <label>Upload custom profile picture</label>
        <input id="profileImageUpload" class="hidden-file-input" type="file" accept="image/*" />
        <label for="profileImageUpload" class="upload-tile" id="profileUploadTile">
          <span class="upload-icon">＋</span>
          <span class="upload-text">
            <strong id="profileUploadTitle">Choose image</strong>
            <small id="profileUploadHint">PNG, JPG, GIF, or WebP</small>
          </span>
        </label>

        <label class="settings-toggle">
          <input id="profileEmailBetNotifications" type="checkbox" ${user.emailBetNotifications ? "checked" : ""} />
          <span>
            <strong>Email me when someone places a bet</strong>
            <small>Useful when someone posts an open bet you might want to match. You will not get emailed for your own bets.</small>
          </span>
        </label>

        <button class="primary" data-action="save-profile">Save profile</button>
        <p class="footer-note small">Uploads go to Firebase Storage. Email notifications require the app owner to set a mail provider key in Vercel.</p>
      </div>

      <div class="profile-block profile-rivals-block">
        <h3>Rivals</h3>
        <div class="stat-list rival-grid">
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
        <h3>Planned stats</h3>
        <div class="record">
          <strong>Odds-based performance</strong><br>
          <span class="muted small">This will populate after more settled bets have reliable odds attached.</span>
        </div>
        <div class="record">
          <strong>Sport and pick splits</strong><br>
          <span class="muted small">This will populate after more settled events accumulate across sports/leagues.</span>
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


function renderApiEventMaintenance() {
  const apiEvents = Object.values(state.events || {})
    .filter(event => event.externalIds?.source || event.leaderboardSource || event.odds === "API schedule import")
    .sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0));

  if (!apiEvents.length) {
    return `<div class="record muted small">No API-imported events found.</div>`;
  }

  return apiEvents.slice(0, 40).map(event => {
    const eventId = event.firestoreId || event.id;
    const bets = eventBetCount(eventId);
    const matches = eventMatchCount(eventId);
    const ledger = eventLedgerCount(eventId);
    const protectedLabel = bets || matches || ledger
      ? `${bets} bets · ${matches} matches · ${ledger} ledger`
      : "No bets/matches/ledger";
    const source = event.externalIds?.source || event.leaderboardSource || "unknown";
    return `
      <div class="record api-maintenance-row">
        <div class="api-maintenance-main">
          <strong>${escapeHtml(eventDisplayTitle(event))}</strong><br />
          <span class="muted small api-maintenance-meta">${escapeHtml(event.league || "Unknown")} · ${escapeHtml(formatTime(event.startTime))} ET · ${escapeHtml(event.shortCode || eventId)}</span><br />
          <span class="small api-maintenance-meta">Source: ${escapeHtml(source)} · ${escapeHtml(protectedLabel)}</span>
        </div>
        <button class="danger" data-delete-api-event="${escapeHtml(eventId)}" ${bets || matches || ledger ? "disabled" : ""}>Delete</button>
      </div>
    `;
  }).join("");
}

function renderAdminUserManagement() {
  const users = Object.values(state.users || {})
    .sort((a, b) => String(a.displayName || "").localeCompare(String(b.displayName || "")));

  if (!users.length) return `<div class="record">No users found.</div>`;

  return users.map(user => {
    const id = user.firestoreId || user.id;
    const isSelf = id === state.currentUserId;
    const betCount = Object.values(state.bets || {}).filter(bet => bet.userId === id).length;
    const matchCount = Object.values(state.matches || {}).filter(match => match.userA === id || match.userB === id).length;
    const ledgerCount = Object.values(state.ledgerEntries || {}).filter(entry => entry.fromUser === id || entry.toUser === id).length;
    const settlementCount = Object.values(state.settlements || {}).filter(item => item.fromUser === id || item.toUser === id).length;

    return `
      <div class="pending-user admin-user-row">
        <div class="avatar-row">
          ${renderAvatar(user)}
          <div>
            <strong>${escapeHtml(user.displayName || "Unnamed user")}</strong><br>
            <span class="muted small">${escapeHtml(user.email || "No email")} · ${user.approved ? "Approved" : "Pending"}${user.isAdmin ? " · Admin" : ""}</span><br>
            <span class="muted tiny">${betCount} bets · ${matchCount} matches · ${ledgerCount} ledger · ${settlementCount} settlements</span>
          </div>
        </div>
        <button class="danger" data-delete-user="${escapeHtml(id)}" ${isSelf ? "disabled" : ""}>Delete profile</button>
      </div>
    `;
  }).join("");
}

function renderMaintenanceHealth() {
  const maintenance = state.maintenance || {};
  const summary = maintenance.lastSummary || {};
  const lastSuccessMs = toDateValue(maintenance.lastSuccessAt);
  const ageMinutes = lastSuccessMs ? Math.max(0, Math.round((Date.now() - lastSuccessMs) / 60000)) : null;
  const healthy = ageMinutes !== null && ageMinutes <= 12 && !maintenance.lastError;
  const status = maintenance.running ? "Running now" : healthy ? "Healthy" : ageMinutes === null ? "Not configured" : "Stale / needs attention";
  const runtimeDetail = [summary.version ? `v${summary.version}` : "", summary.runtime || ""].filter(Boolean).join(" · ");
  const unresolvedSettlements = Number(summary.settlement?.unresolved?.length || 0);
  const repairedLegacyMatches = Number(summary.settlement?.repairedLegacyMatches || 0);
  const settlementDetail = [
    `${summary.settlement?.ledgerWrites || 0} ledger write${summary.settlement?.ledgerWrites === 1 ? "" : "s"}`,
    repairedLegacyMatches ? `${repairedLegacyMatches} legacy match repair${repairedLegacyMatches === 1 ? "" : "s"}` : "",
    unresolvedSettlements ? `${unresolvedSettlements} unresolved settlement${unresolvedSettlements === 1 ? "" : "s"}` : ""
  ].filter(Boolean).join(" · ");
  const detail = lastSuccessMs
    ? `Last successful server run ${ageMinutes} minute${ageMinutes === 1 ? "" : "s"} ago · ${summary.sourceSuccesses || 0}/${summary.sourceRequests || 0} source requests · ${settlementDetail}${runtimeDetail ? ` · ${runtimeDetail}` : ""}`
    : "No server maintenance run has been recorded yet. Configure the scheduled maintenance workflow before relying on unattended updates.";
  return `
    <div class="admin-card maintenance-health ${healthy ? "healthy" : "warning"}">
      <div class="maintenance-health-head">
        <div><h3>Server maintenance</h3><p class="muted small">One shared pipeline refreshes every sport, removes stale Now cards, settles finished bets, and writes all users’ ledgers.</p></div>
        <span class="status-badge ${healthy ? "live" : "pregame"}">${escapeHtml(status)}</span>
      </div>
      <div class="record"><strong>${escapeHtml(detail)}</strong>${maintenance.lastError ? `<br><span class="bad small">${escapeHtml(String(maintenance.lastError).slice(0, 800))}</span>` : ""}</div>
      <button class="ghost" data-action="run-server-maintenance">Run server refresh now</button>
    </div>
  `;
}

function renderAdmin() {
  if (!isAdmin()) return renderAdminUnlock();

  const pendingUsers = Object.values(state.users).filter(user => !user.approved);
  const approvedUsers = Object.values(state.users).filter(user => user.approved);

  return `
    ${renderAdminStats()}
    ${renderMaintenanceHealth()}
    <div class="admin-grid">
      <div class="admin-card">
        <h3>User approvals</h3>
        ${pendingUsers.length ? pendingUsers.map(user => `<div class="pending-user"><div class="avatar-row">${renderAvatar(user)}<div><strong>${escapeHtml(user.displayName)}</strong><br><span class="muted small">${escapeHtml(user.email)}</span></div></div><button class="primary" data-approve="${escapeHtml(user.id)}">Approve</button></div>`).join("") : `<div class="record">No pending users.</div>`}
      </div>

      <div class="admin-card">
        <h3>User management</h3>
        <p class="muted small">Delete dummy profiles here. Deleting a profile also removes that user’s bets, matches, ledger rows, and settlements so they disappear from the leaderboard and history math.</p>
        <div class="api-results">
          ${renderAdminUserManagement()}
        </div>
      </div>

      <div class="admin-card">
        <h3>Notification diagnostics</h3>
        <p class="muted small">New bet emails go to all opted-in approved users except the bettor. Matchup-accepted and double-up emails only go to the opponent involved.</p>
        <label>Send test notification to</label>
        <select id="notificationTestUser">
          ${approvedUsers.map(user => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.displayName)} · ${escapeHtml(user.email || "no email")}${user.emailBetNotifications ? " · opted in" : " · opt-in off"}</option>`).join("")}
        </select>
        <button class="ghost" data-action="test-notification">Send test email</button>
        ${notificationDebug ? `<p class="footer-note small debug-line">Last notification: ${escapeHtml(notificationDebug)}</p>` : `<p class="footer-note small">No notification attempt logged in this browser yet.</p>`}
      </div>

      <div class="admin-card api-import-card">
        <h3>API schedule sync</h3>
        <p class="muted small">Pull real schedule/score data into Firestore. ESPN is the default free source; NASCAR live order uses NASCAR.com when available; MotoGP uses PulseLive timing when available. Manual events stay available as the fallback.</p>
        <div class="button-row">
          <button class="primary" data-action="sync-api-now-window" ${apiSyncRunning ? "disabled" : ""}>Sync full Now window</button>
          <button class="ghost" data-action="force-mlb-sync">Force MLB live sync</button>
          <button class="ghost" data-action="sync-api-today" ${apiSyncRunning ? "disabled" : ""}>Sync today only</button>
          <button class="ghost" data-action="sync-api-tomorrow" ${apiSyncRunning ? "disabled" : ""}>Sync tomorrow only</button>
          <button class="ghost" data-action="delete-demo-events">Delete old demo events</button>
          <button class="ghost" data-action="cleanup-api-events">Clean duplicate API events</button>
          <button class="ghost" data-action="cleanup-history-events">Clean history older than 5 days${functionHistoryCleanupCandidateCount() ? ` (${functionHistoryCleanupCandidateCount()})` : ""}</button>
        </div>
        <p class="footer-note small">Automatic event refresh and settlement now run through the server maintenance pipeline rather than whichever browser happens to be open. These buttons are diagnostics/manual backup controls. ESPN/imported odds remain the default display until someone actually bets. Backup buttons stay here as manual controls.</p>
        ${hiddenFutureImportedEventCount() ? `<div class="record admin-window-note"><strong>Now window</strong><span>Hiding ${hiddenFutureImportedEventCount()} far-future imported event${hiddenFutureImportedEventCount() === 1 ? "" : "s"}. The public Now board only shows live/active events through the next 48 hours.</span></div>` : ""}
        <label>Manual league/date fetch</label>
        <select id="apiLeague">
          ${API_IMPORT_LEAGUES.map(league => `<option value="${escapeHtml(league)}">${escapeHtml(league)}</option>`).join("")}
        </select>
        <label>Date</label>
        <input id="apiDate" type="date" value="${escapeHtml(getBettingDayISO())}" />
        <div class="button-row">
          <button class="primary" data-action="fetch-api-events">Fetch selected</button>
          <button class="ghost" data-action="import-all-api-events" ${apiImportResults.length ? "" : "disabled"}>Import fetched</button>
        </div>
        ${apiImportMessage ? `<p class="footer-note small">${escapeHtml(apiImportMessage)}</p>` : ""}
        ${mlbSyncDebug ? `<p class="footer-note small debug-line">MLB debug: ${escapeHtml(mlbSyncDebug)}</p>` : ""}
        ${sourceSweepDebug ? `<p class="footer-note small debug-line">Source sweep: ${escapeHtml(sourceSweepDebug)}</p>` : ""}
        ${autoMaintenanceMessage ? `<p class="footer-note small">Auto: ${escapeHtml(autoMaintenanceMessage)}</p>` : ""}
        <div class="api-results">
          ${renderApiImportResults()}
        </div>
      </div>

      <div class="admin-card api-maintenance-card">
        <h3>API event maintenance</h3>
        <p class="muted small">Use this to remove stale imported events. Events with bets, matches, or ledger entries are protected and cannot be deleted here.</p>
        <div class="api-results">
          ${renderApiEventMaintenance()}
        </div>
      </div>

      <div class="admin-card">
        <h3>Create manual event</h3>
        <label>Event type</label>
        <select id="adminEventType"><option value="${EVENT_TYPES.TEAM}">Two-option head-to-head</option><option value="${EVENT_TYPES.RANKED}">Ranked finish</option><option value="${EVENT_TYPES.FIGHT_CARD}">UFC fight card</option></select>
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
        <label>Away option / Participants / UFC fights</label>
        <textarea id="adminAway" placeholder="BOS or Option A or Verstappen,Norris,Leclerc\nFor UFC: Fighter A vs Fighter B, Fighter C vs Fighter D"></textarea>
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
        <label>Ranked result order / UFC winners</label>
        <input id="adminResult" placeholder="Norris,Piastri,Verstappen or fight-1-name:winner, fight-2-name:winner" />
        <button class="primary" data-action="update-event">Update event</button>
        <button class="ghost" data-action="settle-event">Settle final event</button>
      </div>


      <div class="admin-card">
        <h3>Matchup repair</h3>
        <p class="muted small">Use this when automatic matching paired the wrong people. It removes unsettled matches involving these two users for the selected event, reopens displaced bets, and creates the intended match.</p>
        <label>Event ID / display code</label>
        <input id="repairEventId" placeholder="MLB0607-1 or UFC0607-1" />
        <label>Fight ID/order (UFC only)</label>
        <input id="repairFightId" placeholder="1 or fight-1-name; leave blank for team games" />
        <div class="input-row">
          <div>
            <label>User A</label>
            <select id="repairUserA">${approvedUsers.map(user => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.displayName)}</option>`).join("")}</select>
          </div>
          <div>
            <label>User B</label>
            <select id="repairUserB">${approvedUsers.map(user => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.displayName)}</option>`).join("")}</select>
          </div>
        </div>
        <div class="input-row">
          <div>
            <label>User A pick</label>
            <input id="repairPickA" placeholder="away/home or fighterA/fighterB" />
          </div>
          <div>
            <label>User B pick</label>
            <input id="repairPickB" placeholder="home/away or fighterB/fighterA" />
          </div>
        </div>
        <label>Amount</label>
        <input id="repairAmount" type="number" min="1" step="1" value="1" />
        <button class="primary" type="button" data-action="repair-matchup" ${repairMatchupRunning ? "disabled" : ""}>${repairMatchupRunning ? "Repairing match…" : "Repair/create match"}</button>
        <p id="repairMatchupStatus" class="repair-matchup-status ${escapeHtml(repairMatchupMessageType)}" role="status" aria-live="polite">${escapeHtml(repairMatchupMessage)}</p>
        <p class="footer-note small">For team games use away/home. For UFC use fighterA/fighterB and provide the fight number or fight ID.</p>
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

function centerActiveNavTab() {
  const nav = document.querySelector(".navbar");
  const active = nav?.querySelector(".nav-btn.active");
  if (!nav || !active) return;

  const target = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
  const max = nav.scrollWidth - nav.clientWidth;
  nav.scrollLeft = Math.max(0, Math.min(target, max));
}

function wireUi() {
  centerActiveNavTab();

  document.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    const nextTab = button.dataset.tab;
    if (!nextTab) return;
    activeTab = nextTab;
    passiveRenderPending = false;
    renderApp();
    requestAnimationFrame(centerActiveNavTab);
  }));
  document.querySelector("[data-action='toggle-auth']")?.addEventListener("click", () => { authMode = authMode === "login" ? "signup" : "login"; renderApp(); });
  document.querySelector("[data-action='login']")?.addEventListener("click", login);
  document.querySelector("[data-action='signup']")?.addEventListener("click", signup);
  document.querySelector("[data-action='logout']")?.addEventListener("click", logout);
  document.querySelector("#sportFilter")?.addEventListener("change", event => { filters.sport = event.target.value; filters.league = "all"; renderApp(); });
  document.querySelector("#leagueFilter")?.addEventListener("change", event => { filters.league = event.target.value; renderApp(); });
  document.querySelector("#betStateFilter")?.addEventListener("change", event => { filters.betState = event.target.value; renderApp(); });
  document.querySelector("#historySportFilter")?.addEventListener("change", event => { historyFilters.sport = event.target.value; historyFilters.league = "all"; renderApp(); });
  document.querySelector("#historyLeagueFilter")?.addEventListener("change", event => { historyFilters.league = event.target.value; renderApp(); });
  document.querySelector("#historyBetStateFilter")?.addEventListener("change", event => { historyFilters.betState = event.target.value; renderApp(); });
  document.querySelectorAll("[data-bet-team]").forEach(button => button.addEventListener("click", () => placeTeamBet(button.dataset.betTeam, button.dataset.side)));
  document.querySelectorAll("[data-bet-ranked]").forEach(button => button.addEventListener("click", () => placeRankedBet(button.dataset.betRanked)));
  document.querySelectorAll("[data-bet-fight]").forEach(button => button.addEventListener("click", () => placeFightCardBet(button.dataset.betFight, button.dataset.fightId, button.dataset.side)));
  document.querySelectorAll("[data-clear-event-bets]").forEach(button => button.addEventListener("click", () => clearCurrentUserEventBets(button.dataset.clearEventBets)));
  document.querySelectorAll("[data-double-up]").forEach(button => button.addEventListener("click", () => requestDoubleUp(button.dataset.doubleUp)));
  document.querySelectorAll("[data-settle]").forEach(button => button.addEventListener("click", () => settleBalance(button.dataset.settle, Number(button.dataset.amount))));
  document.querySelectorAll("[data-approve]").forEach(button => button.addEventListener("click", () => approveUser(button.dataset.approve)));
  document.querySelectorAll("[data-delete-user]").forEach(button => button.addEventListener("click", () => deleteUserProfile(button.dataset.deleteUser)));
  document.querySelector("[data-action='test-notification']")?.addEventListener("click", sendTestNotification);
  document.querySelector("[data-action=\'run-server-maintenance\']")?.addEventListener("click", () => triggerServerMaintenance("manual"));
  document.querySelector("[data-action='save-profile']")?.addEventListener("click", saveProfile);
  document.querySelector("#profileImageUpload")?.addEventListener("change", updateProfileUploadTile);
  document.querySelector("[data-action='admin-unlock']")?.addEventListener("click", adminUnlock);
  document.querySelector("[data-action='fetch-api-events']")?.addEventListener("click", fetchApiEvents);
  document.querySelector("[data-action='sync-api-now-window']")?.addEventListener("click", () => syncNowWindowSchedule());
  document.querySelector("[data-action='force-mlb-sync']")?.addEventListener("click", () => forceSyncMlbNowWindow());
  document.querySelector("[data-action='sync-api-today']")?.addEventListener("click", () => syncApiSchedule(0));
  document.querySelector("[data-action='sync-api-tomorrow']")?.addEventListener("click", () => syncApiSchedule(1));
  document.querySelector("[data-action='delete-demo-events']")?.addEventListener("click", deleteDemoEvents);
  document.querySelector("[data-action='cleanup-api-events']")?.addEventListener("click", cleanupDuplicateApiEvents);
  document.querySelector("[data-action='cleanup-history-events']")?.addEventListener("click", () => cleanupOldHistoryEvents());
  document.querySelector("[data-action='import-all-api-events']")?.addEventListener("click", importAllApiEvents);
  document.querySelectorAll("[data-import-api-event]").forEach(button => button.addEventListener("click", () => importApiEvent(button.dataset.importApiEvent)));
  document.querySelectorAll("[data-delete-api-event]").forEach(button => button.addEventListener("click", () => deleteApiEvent(button.dataset.deleteApiEvent)));
  document.querySelectorAll("[data-refresh-odds]").forEach(button => button.addEventListener("click", () => refreshOddsForEvent(button.dataset.refreshOdds, "manual-admin-refresh", true)));
  document.querySelector("[data-action='create-event']")?.addEventListener("click", createEvent);
  document.querySelector("[data-action='update-event']")?.addEventListener("click", updateEvent);
  document.querySelector("[data-action='settle-event']")?.addEventListener("click", settleEventFromAdmin);
  document.querySelector("[data-action='manual-ledger']")?.addEventListener("click", manualLedgerAdd);
  document.querySelector("[data-action='repair-matchup']")?.addEventListener("click", repairAdminMatchup);
}

function updateProfileUploadTile() {
  const input = document.querySelector("#profileImageUpload");
  const title = document.querySelector("#profileUploadTitle");
  const hint = document.querySelector("#profileUploadHint");
  const tile = document.querySelector("#profileUploadTile");
  const file = input?.files?.[0];

  if (!file) {
    if (title) title.textContent = "Choose image";
    if (hint) hint.textContent = "PNG, JPG, GIF, or WebP";
    tile?.classList.remove("has-file");
    return;
  }

  if (title) title.textContent = file.name;
  if (hint) hint.textContent = `${Math.max(1, Math.round(file.size / 1024))} KB selected`;
  tile?.classList.add("has-file");
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
    const emailBetNotifications = !!document.querySelector("#profileEmailBetNotifications")?.checked;
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
      emailBetNotifications,
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

async function deleteUserProfile(userId) {
  if (!isAdmin()) return;
  if (!userId) return alert("Could not identify that user.");
  if (userId === state.currentUserId) return alert("You cannot delete your own active admin profile.");

  const user = state.users[userId];
  if (!user) return alert("Could not find that user profile.");

  const relatedBets = Object.values(state.bets || {}).filter(bet => bet.userId === userId);
  const relatedBetIds = new Set(relatedBets.map(bet => bet.firestoreId || bet.id));
  const relatedMatches = Object.values(state.matches || {}).filter(match =>
    match.userA === userId ||
    match.userB === userId ||
    relatedBetIds.has(match.betA) ||
    relatedBetIds.has(match.betB)
  );
  const relatedLedger = Object.values(state.ledgerEntries || {}).filter(entry => entry.fromUser === userId || entry.toUser === userId);
  const relatedSettlements = Object.values(state.settlements || {}).filter(item => item.fromUser === userId || item.toUser === userId);

  const ok = confirm(`Delete ${user.displayName || user.email || "this profile"}? This removes the profile plus ${relatedBets.length} bet(s), ${relatedMatches.length} match(es), ${relatedLedger.length} ledger row(s), and ${relatedSettlements.length} settlement(s). This cannot be undone.`);
  if (!ok) return;

  const batch = writeBatch(db);
  for (const match of relatedMatches) batch.delete(doc(db, "matches", match.firestoreId || match.id));
  for (const bet of relatedBets) batch.delete(doc(db, "bets", bet.firestoreId || bet.id));
  for (const entry of relatedLedger) batch.delete(doc(db, "ledgerEntries", entry.firestoreId || entry.id));
  for (const settlement of relatedSettlements) batch.delete(doc(db, "settlements", settlement.firestoreId || settlement.id));
  batch.delete(doc(db, "users", userId));

  await batch.commit();
  alert(`Deleted ${user.displayName || user.email || "profile"}.`);
}

function getUserEventBets(eventId, userId) {
  return Object.values(state.bets).filter(bet => bet.eventId === eventId && bet.userId === userId);
}

function getBetSelection(event, bet) {
  if (!event || !bet) return "";
  if (event.type === EVENT_TYPES.TEAM) return bet.side || "";
  if (event.type === EVENT_TYPES.FIGHT_CARD) return `${bet.fightId || ""}:${bet.side || ""}`;
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


async function refreshOddsForEvent(eventId, reason = "bet-matched", showFeedback = false, forceMatched = false) {
  const event = state.events[eventId];
  if (!event || event.type !== EVENT_TYPES.TEAM) {
    if (showFeedback) alert("Odds refresh only works for team games right now.");
    return;
  }
  if (event.status === "final") {
    if (showFeedback) alert("Odds refresh skipped because this event is final.");
    return;
  }

  if (!eventCanUseOddsApi(event, forceMatched)) {
    const reasonText = "Odds API locked until this exact matchup has a matched bet. Showing ESPN/imported odds only.";
    if (showFeedback) alert(`Odds not updated: ${reasonText}`);
    return;
  }

  try {
    const response = await fetch("/api/odds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, reason })
    });

    const data = await response.json();

    if (!response.ok || !data?.odds) {
      const requestNote = data?.requestWindow?.note ? ` (${data.requestWindow.note})` : "";
      const reasonText = `${data?.reason || data?.error || "No matching live odds were returned."}${requestNote}`;
      await setDoc(doc(db, "events", eventId), {
        oddsStatus: reasonText,
        updatedAt: serverTimestamp()
      }, { merge: true });
      state.events[eventId] = { ...event, oddsStatus: reasonText };
      renderApp();
      if (showFeedback) alert(`Odds not updated: ${reasonText}`);
      return;
    }

    const oddsLive = {
      ...data.odds,
      fetchedAt: new Date().toISOString(),
      reason
    };

    await setDoc(doc(db, "events", eventId), {
      oddsLive,
      oddsStatus: "Live odds updated",
      odds: data.odds.summary || data.odds.moneyline || event.odds || "Live odds unavailable",
      updatedAt: serverTimestamp()
    }, { merge: true });

    state.events[eventId] = {
      ...event,
      oddsLive,
      oddsStatus: "Live odds updated",
      odds: data.odds.summary || data.odds.moneyline || event.odds
    };

    renderApp();
    if (showFeedback) alert("Live odds updated.");
  } catch (error) {
    const reasonText = error.message || "Odds refresh failed.";
    await setDoc(doc(db, "events", eventId), {
      oddsStatus: reasonText,
      updatedAt: serverTimestamp()
    }, { merge: true });
    state.events[eventId] = { ...event, oddsStatus: reasonText };
    renderApp();
    if (showFeedback) alert(`Odds not updated: ${reasonText}`);
  }
}


async function requestDoubleUp(matchId) {
  const user = currentUser();
  const match = state.matches[matchId];
  const event = state.events[match?.eventId];

  if (!user?.approved) return alert("Approved login required.");
  if (!match || !event) return alert("Matched bet not found.");
  if (match.status !== "matched") return alert("Only active matched bets can be doubled.");
  if (event.status === "final" || !eventHasBegun(event)) return alert("Double up is only available after the game starts and before it ends.");
  if (match.userA !== user.id && match.userB !== user.id) return alert("Only the two users in this matched bet can double it.");
  if (matchIsDoubled(match)) return alert("This matched bet is already doubled.");

  const otherUserId = match.userA === user.id ? match.userB : match.userA;
  const originalAmount = Number(match.doubleUp?.originalAmount || match.amount || match.exposure || 0);
  if (!Number.isFinite(originalAmount) || originalAmount <= 0) return alert("Cannot double this match because the amount is invalid.");

  const nowIso = new Date().toISOString();
  const pending = doubleUpIsPending(match);
  const expired = doubleUpIsExpired(match);
  const requesterId = doubleUpRequesterId(match);

  if (pending && requesterId === user.id) {
    return alert(`Double up is already pending. Waiting for ${userName(otherUserId)} to accept.`);
  }

  if (pending && requesterId !== user.id) {
    const patch = {
      doubleUp: {
        requestedBy: [requesterId, user.id],
        requestedAt: match.doubleUp?.requestedAt || nowIso,
        expiresAt: match.doubleUp?.expiresAt || new Date(doubleUpExpiresAtMs(match)).toISOString(),
        originalAmount,
        applied: true,
        appliedAt: nowIso,
        acceptedBy: user.id
      },
      amount: originalAmount * 2,
      doubleUpAmount: originalAmount * 2,
      doubledUp: true,
      updatedAt: serverTimestamp()
    };

    await updateDoc(doc(db, "matches", matchId), patch);
    alert(`Double up confirmed. This matched bet is now ${money(originalAmount * 2)}.`);
    return;
  }

  // No pending request, or old request expired: start a fresh 5-minute challenge.
  const expiresAt = new Date(Date.now() + DOUBLE_UP_ACCEPT_WINDOW_MS).toISOString();
  await updateDoc(doc(db, "matches", matchId), {
    doubleUp: {
      requestedBy: [user.id],
      requestedAt: nowIso,
      expiresAt,
      originalAmount,
      applied: false,
      appliedAt: "",
      acceptedBy: ""
    },
    updatedAt: serverTimestamp()
  });

  await notifyDoubleUpRequested(event, match, {
    matchId,
    requesterId: user.id,
    recipientId: otherUserId,
    originalAmount,
    doubleAmount: originalAmount * 2,
    expiresAt
  });

  alert(`Double up requested. ${userName(otherUserId)} has 5 minutes to accept.`);
}



function setNotificationDebug(label, result = {}) {
  const stamp = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
  const detail = typeof result === "string"
    ? result
    : [
        result.sent !== undefined ? `sent=${result.sent}` : "",
        result.failed !== undefined ? `failed=${result.failed}` : "",
        result.skipped ? "skipped" : "",
        result.reason || result.error || "",
        Array.isArray(result.results) ? result.results.map(item => `${item.email || "email"}:${item.ok ? "ok" : item.error || "failed"}`).join(", ") : ""
      ].filter(Boolean).join(" · ");
  notificationDebug = `${stamp} ${label}: ${detail || "done"}`;
  try { localStorage.setItem("notificationDebug", notificationDebug); } catch {}
}

async function postNotification(path, payload, label) {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    setNotificationDebug(label, result);
    return result;
  } catch (error) {
    setNotificationDebug(label, error.message || "request failed");
    return { sent: 0, failed: 1, error: error.message || "request failed" };
  }
}

function betNotificationRecipients(bettorId) {
  return Object.values(state.users || {})
    .filter(user => user?.approved && user?.emailBetNotifications && user?.email && user.id !== bettorId)
    .map(user => ({ id: user.id, email: user.email, displayName: user.displayName || "User" }));
}

function formatBetPickForNotification(event, bet = {}) {
  if (!event) return "Unknown pick";
  if (event.type === EVENT_TYPES.TEAM) return bet.side === "home" ? teamDisplayName(event, "home") : teamDisplayName(event, "away");
  if (event.type === EVENT_TYPES.FIGHT_CARD) {
    const fight = fightById(event, bet.fightId);
    return `${fight?.label || bet.fightLabel || "Fight"} · ${fightPickName(fight, bet.side)}`;
  }
  if (event.type === EVENT_TYPES.RANKED) return bet.participant || "Ranked pick";
  return "Unknown pick";
}

async function notifyBetPlaced(event, bet = {}) {
  const bettor = currentUser();
  if (!bettor?.approved || !event) return;

  const recipients = betNotificationRecipients(bettor.id);
  if (!recipients.length) return;

  const payload = {
    recipients,
    bettor: {
      id: bettor.id,
      displayName: bettor.displayName || bettor.email || "Someone"
    },
    event: {
      id: event.id,
      shortCode: event.shortCode || "",
      title: eventDisplayTitle(event),
      league: event.league || "",
      startTime: event.startTime || ""
    },
    bet: {
      id: bet.firestoreId || bet.id || "",
      amount: Number(bet.amount || 0),
      pick: formatBetPickForNotification(event, bet)
    }
  };

  await postNotification("/api/bet-email-notification", payload, "New bet notification");
}


async function notifyDoubleUpRequested(event, match, challenge = {}) {
  const requester = currentUser();
  const recipient = state.users?.[challenge.recipientId];

  if (!requester?.approved || !event || !recipient?.approved || !recipient?.emailBetNotifications || !recipient?.email) return;

  const payload = {
    recipient: {
      id: recipient.id,
      email: recipient.email,
      displayName: recipient.displayName || "User"
    },
    requester: {
      id: requester.id,
      displayName: requester.displayName || requester.email || "Someone"
    },
    event: {
      id: event.firestoreId || event.id,
      shortCode: event.shortCode || "",
      title: eventDisplayTitle(event),
      league: event.league || "",
      startTime: event.startTime || ""
    },
    match: {
      id: challenge.matchId || match?.firestoreId || match?.id || "",
      originalAmount: Number(challenge.originalAmount || match?.amount || 0),
      doubleAmount: Number(challenge.doubleAmount || 0),
      expiresAt: challenge.expiresAt || ""
    }
  };

  await postNotification("/api/double-up-email-notification", payload, "Double-up notification");
}


async function notifyMatchAccepted(event, match = {}, acceptedById = "", recipientId = "") {
  const accepter = state.users?.[acceptedById] || currentUser();
  const recipient = state.users?.[recipientId];
  if (!accepter?.approved || !event || !recipient?.approved || !recipient?.emailBetNotifications || !recipient?.email) {
    setNotificationDebug("Matchup notification", `skipped; recipient=${recipient?.email || "none"}; optedIn=${Boolean(recipient?.emailBetNotifications)}`);
    return;
  }

  const payload = {
    recipient: {
      id: recipient.id,
      email: recipient.email,
      displayName: recipient.displayName || "User"
    },
    accepter: {
      id: accepter.id,
      displayName: accepter.displayName || accepter.email || "Someone"
    },
    event: {
      id: event.firestoreId || event.id,
      shortCode: event.shortCode || "",
      title: eventDisplayTitle(event),
      league: event.league || "",
      startTime: event.startTime || ""
    },
    match: {
      id: match.id || match.firestoreId || "",
      amount: Number(match.amount || match.exposure || 0),
      pick: match.pick || ""
    }
  };

  await postNotification("/api/matchup-email-notification", payload, "Matchup notification");
}

async function sendTestNotification() {
  if (!isAdmin()) return;
  const userId = document.querySelector("#notificationTestUser")?.value;
  const recipient = state.users?.[userId];
  const sender = currentUser();
  if (!recipient?.email) return alert("Pick a user with an email address.");

  const payload = {
    recipients: [{ id: recipient.id, email: recipient.email, displayName: recipient.displayName || "User" }],
    bettor: { id: sender?.id || "admin", displayName: sender?.displayName || "Admin test" },
    event: { id: "TEST", shortCode: "TEST", title: "Notification test", league: "Everyone Loses", startTime: new Date().toISOString() },
    bet: { id: "TEST", amount: 1, pick: "test notification" }
  };

  const result = await postNotification("/api/bet-email-notification", payload, "Test notification");
  renderApp();
  alert(result.sent ? `Test sent to ${recipient.email}.` : `Test did not send: ${result.reason || result.error || "check diagnostics"}`);
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

  await notifyBetPlaced(event, { firestoreId: betRef.id, eventId, userId: user.id, side, amount });
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
    doubleUp: { requestedBy: [], applied: false, originalAmount: Number(newBet.amount) },
    status: "matched",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await batch.commit();
  const event = state.events[newBet.eventId];
  await notifyMatchAccepted(event, {
    id: matchRef.id,
    amount: newBet.amount,
    pick: formatBetPickForNotification(event, newBet)
  }, newBet.userId, candidate.userId);
  await refreshOddsForEvent(newBet.eventId, "team-bet-matched", false, true);
}


async function placeFightCardBet(eventId, fightId, side) {
  const user = currentUser();
  const event = state.events[eventId];
  const fight = fightById(event, fightId);
  const amount = Number(document.querySelector(`#amount-${CSS.escape(eventId)}-${CSS.escape(fightId)}`)?.value);

  if (!user?.approved) return alert("Approved login required.");
  if (!event || event.type !== EVENT_TYPES.FIGHT_CARD) return alert("Invalid UFC fight card.");
  if (!fight) return alert("Fight not found on this card.");
  if (fightIsLocked(event, fight)) return alert("Bets are locked for this fight.");
  if (!Number.isFinite(amount) || amount <= 0) return alert("Enter a valid amount.");

  const existingDifferentFightPick = getUserEventBets(eventId, user.id)
    .some(bet => bet.fightId === fightId && bet.side && bet.side !== side);

  if (existingDifferentFightPick) {
    await removeUserFightBets(eventId, user.id, fightId);
  }

  const betRef = await addDoc(collection(db, "bets"), {
    eventId,
    userId: user.id,
    type: EVENT_TYPES.FIGHT_CARD,
    fightId,
    fightLabel: fight.label || `${fight.fighterA} vs ${fight.fighterB}`,
    side,
    pickName: fightPickName(fight, side),
    amount,
    status: "open",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await notifyBetPlaced(event, { firestoreId: betRef.id, eventId, userId: user.id, fightId, fightLabel: fight.label, side, amount });
  await tryMatchFightCardBet({ firestoreId: betRef.id, eventId, userId: user.id, fightId, side, amount });
}

async function tryMatchFightCardBet(newBet) {
  const opposite = newBet.side === "fighterA" ? "fighterB" : "fighterA";
  const candidate = Object.values(state.bets)
    .filter(
      bet =>
        (bet.firestoreId || bet.id) !== newBet.firestoreId &&
        bet.eventId === newBet.eventId &&
        bet.fightId === newBet.fightId &&
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
    type: EVENT_TYPES.FIGHT_CARD,
    eventId: newBet.eventId,
    fightId: newBet.fightId,
    betA: candidateId,
    betB: newBet.firestoreId,
    userA: candidate.userId,
    userB: newBet.userId,
    sideA: candidate.side,
    sideB: newBet.side,
    amount: newBet.amount,
    doubleUp: { requestedBy: [], applied: false, originalAmount: Number(newBet.amount) },
    status: "matched",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await batch.commit();
  const event = state.events[newBet.eventId];
  await notifyMatchAccepted(event, {
    id: matchRef.id,
    amount: newBet.amount,
    pick: formatBetPickForNotification(event, newBet)
  }, newBet.userId, candidate.userId);
}

async function removeUserFightBets(eventId, userId, fightId) {
  const userBets = getUserEventBets(eventId, userId).filter(bet => bet.fightId === fightId);
  const userBetIds = new Set(userBets.map(bet => bet.firestoreId || bet.id));
  const batch = writeBatch(db);

  for (const match of Object.values(state.matches)) {
    if (match.eventId !== eventId || match.fightId !== fightId) continue;
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

  const betRef = await addDoc(collection(db, "bets"), {
    eventId,
    userId: user.id,
    participant,
    amount,
    status: "open",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await notifyBetPlaced(event, { firestoreId: betRef.id, eventId, userId: user.id, participant, amount });
}

async function settleEvent(eventId, options = {}) {
  if (!canSettleFinalEvents()) return;
  const event = state.events[eventId] || findEventByIdOrCode(eventId);
  if (!event) { if (!options.silent) alert("Event not found."); return; }
  if (event.status !== "final") { if (!options.silent) alert("Set event status to final before settling."); return; }
  if (event.type === EVENT_TYPES.TEAM) return settleTeamEvent(event, options);
  if (event.type === EVENT_TYPES.RANKED) return settleRankedEvent(event, options);
  if (event.type === EVENT_TYPES.FIGHT_CARD) return settleFightCardEvent(event, options);
}

async function settleTeamEvent(event, options = {}) {
  if (!event.score) { if (!options.silent) alert("Team/custom event needs a final score first."); return 0; }

  const eventId = event.firestoreId || event.id;
  const eventIds = eventIdCandidates(event);
  const homeScore = Number(event.score.home);
  const awayScore = Number(event.score.away);
  const winningSide = homeScore > awayScore ? "home" : awayScore > homeScore ? "away" : null;
  const matches = Object.values(state.matches)
    .filter(match => eventIds.has(String(match.eventId || "")) && !match.fightId);
  const eventBets = Object.values(state.bets || {}).filter(bet => eventIds.has(String(bet.eventId || "")));
  const batch = writeBatch(db);
  const optimisticLedger = {};
  const optimisticMatches = {};
  const optimisticBets = {};
  let changed = 0;
  let writes = 0;
  const localNow = new Date().toISOString();

  if (!options.silent) {
    settlementSyncMessage = winningSide
      ? `Posting settlement for ${eventDisplayTitle(event)}…`
      : `Voiding matched bets for the ${eventDisplayTitle(event)} draw…`;
    renderApp();
  }

  const matchedBetIds = new Set(matches.flatMap(match => {
    const resolved = resolvedTeamMatch(match, event);
    return [resolved.betAId, resolved.betBId, match.betA, match.betB, match.bet1, match.bet2];
  }).filter(Boolean).map(String));

  if (!winningSide) {
    for (const match of matches) {
      if (["cancelled", "void"].includes(String(match.status || ""))) continue;
      const matchId = match.firestoreId || match.id;
      if (!matchId) continue;
      const resolved = resolvedTeamMatch(match, event);
      const { sideA, sideB, userA, userB, betAId, betBId, amount } = resolved;

      batch.set(doc(db, "matches", matchId), {
        eventId,
        betA: betAId || match.betA || null,
        betB: betBId || match.betB || null,
        userA: userA || match.userA || null,
        userB: userB || match.userB || null,
        sideA: sideA || match.sideA || null,
        sideB: sideB || match.sideB || null,
        amount: amount || match.amount || null,
        status: "void",
        result: "draw",
        settledAmount: 0,
        winner: null,
        loser: null,
        settledAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      optimisticMatches[matchId] = {
        ...match,
        eventId,
        betA: betAId || match.betA || null,
        betB: betBId || match.betB || null,
        userA: userA || match.userA || null,
        userB: userB || match.userB || null,
        sideA: sideA || match.sideA || null,
        sideB: sideB || match.sideB || null,
        amount: amount || match.amount || null,
        status: "void",
        result: "draw",
        settledAmount: 0,
        winner: null,
        loser: null,
        updatedAt: localNow
      };
      writes += 1;
      changed += 1;

      for (const betId of [betAId, betBId].filter(Boolean).map(String)) {
        const bet = state.bets[betId] || Object.values(state.bets || {}).find(item => String(item.firestoreId || item.id) === betId);
        batch.set(doc(db, "bets", betId), {
          eventId,
          status: "void",
          updatedAt: serverTimestamp()
        }, { merge: true });
        optimisticBets[betId] = { ...(bet || {}), eventId, status: "void", updatedAt: localNow };
        writes += 1;
      }

      const staleLedger = Object.values(state.ledgerEntries || {}).find(entry =>
        eventIds.has(String(entry.eventId || ""))
        && String(entry.matchId || "") === String(matchId)
      );
      if (staleLedger) {
        batch.delete(doc(db, "ledgerEntries", staleLedger.firestoreId || staleLedger.id));
        optimisticLedger[staleLedger.firestoreId || staleLedger.id] = null;
        writes += 1;
      }
    }

    // Unmatched offers did not win or lose; close them as expired so no stale
    // World Cup bets remain active after the final whistle.
    for (const bet of eventBets) {
      const betId = String(bet.firestoreId || bet.id || "");
      if (!betId || matchedBetIds.has(betId) || ["settled", "expired", "void", "cancelled"].includes(String(bet.status || ""))) continue;
      batch.set(doc(db, "bets", betId), { eventId, status: "expired", updatedAt: serverTimestamp() }, { merge: true });
      optimisticBets[betId] = { ...bet, eventId, status: "expired", updatedAt: localNow };
      writes += 1;
    }

    batch.set(doc(db, "events", eventId), {
      boardState: "history",
      hiddenFromNow: true,
      settlementStatus: "complete",
      settledAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    writes += 1;

    await batch.commit();
    state.matches = { ...state.matches, ...optimisticMatches };
    state.bets = { ...state.bets, ...optimisticBets };
    for (const [ledgerId, ledgerValue] of Object.entries(optimisticLedger)) {
      if (ledgerValue === null) delete state.ledgerEntries[ledgerId];
    }
    state.events[eventId] = {
      ...event,
      boardState: "history",
      hiddenFromNow: true,
      settlementStatus: "complete",
      updatedAt: localNow,
      firestoreId: eventId
    };
    settlementSyncMessage = `Draw confirmed for ${eventDisplayTitle(event)}. Matched bets were voided and no ledger debt was created.`;
    renderApp();

    if (!options.silent) alert(`Voided ${changed} matched bet${changed === 1 ? "" : "s"} because ${eventDisplayTitle(event)} ended in a draw.`);
    return changed;
  }

  let unresolvedCount = 0;
  const unresolvedIssues = [];

  for (const match of matches) {
    if (["cancelled", "void"].includes(String(match.status || ""))) continue;
    const matchId = match.firestoreId || match.id;
    if (!matchId) continue;

    const resolved = resolvedTeamMatch(match, event);
    const { sideA, sideB, userA, userB, betAId, betBId, amount } = resolved;
    const winner = sideA === winningSide
      ? userA
      : sideB === winningSide
        ? userB
        : String(match.winner || "");
    const loser = winner === userA ? userB : winner === userB ? userA : String(match.loser || "");

    const issues = [];
    if (!userA || !userB) issues.push("missing users");
    if (!winner || !loser) {
      if (!sideA || !sideB || (sideA !== winningSide && sideB !== winningSide)) issues.push("missing or unrecognized winning pick");
      issues.push("winner could not be mapped to a bettor");
    }
    if (!Number.isFinite(amount) || amount <= 0) issues.push("missing wager amount");

    if (issues.length) {
      const issue = issues.join(", ");
      batch.set(doc(db, "matches", matchId), {
        eventId,
        betA: betAId || match.betA || null,
        betB: betBId || match.betB || null,
        userA: userA || match.userA || null,
        userB: userB || match.userB || null,
        sideA: sideA || match.sideA || null,
        sideB: sideB || match.sideB || null,
        settlementIssue: issue,
        settlementCheckedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      optimisticMatches[matchId] = { ...match, settlementIssue: issue, updatedAt: localNow };
      writes += 1;
      unresolvedCount += 1;
      unresolvedIssues.push(issue);
      continue;
    }

    const existingLedger = findLedgerForMatch(eventId, matchId, loser, winner);
    const ledgerRef = existingLedger
      ? doc(db, "ledgerEntries", existingLedger.firestoreId || existingLedger.id)
      : doc(db, "ledgerEntries", matchLedgerId(eventId, matchId));
    const ledgerPayload = {
      id: existingLedger?.id || ledgerRef.id,
      firestoreId: existingLedger?.firestoreId || ledgerRef.id,
      eventId,
      matchId,
      fromUser: loser,
      toUser: winner,
      amount,
      originalAmount: Number(match.doubleUp?.originalAmount || match.exposure || amount),
      doubledUp: matchIsDoubled(match),
      note: `Auto-settled: ${eventDisplayTitle(event)}${matchIsDoubled(match) ? " · doubled up" : ""}`,
      settled: Boolean(existingLedger?.settled || false),
      createdAt: existingLedger?.createdAt || localNow,
      updatedAt: localNow
    };

    batch.set(ledgerRef, {
      ...ledgerPayload,
      createdAt: existingLedger?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    batch.set(doc(db, "matches", matchId), {
      eventId,
      betA: betAId,
      betB: betBId,
      userA,
      userB,
      sideA,
      sideB,
      amount,
      status: "settled",
      result: winningSide,
      settlementIssue: null,
      settledAmount: amount,
      winner,
      loser,
      settledAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    writes += 2;

    for (const betId of [betAId, betBId].filter(Boolean).map(String)) {
      const bet = state.bets[betId] || Object.values(state.bets || {}).find(item => String(item.firestoreId || item.id) === betId);
      batch.set(doc(db, "bets", betId), { eventId, status: "settled", updatedAt: serverTimestamp() }, { merge: true });
      optimisticBets[betId] = { ...(bet || {}), eventId, status: "settled", updatedAt: localNow };
      writes += 1;
    }

    optimisticLedger[ledgerPayload.firestoreId] = ledgerPayload;
    optimisticMatches[matchId] = {
      ...match,
      eventId,
      betA: betAId,
      betB: betBId,
      userA,
      userB,
      sideA,
      sideB,
      amount,
      status: "settled",
      result: winningSide,
      settlementIssue: null,
      settledAmount: amount,
      winner,
      loser,
      updatedAt: localNow
    };
    changed += 1;
  }

  for (const bet of eventBets) {
    const betId = String(bet.firestoreId || bet.id || "");
    if (!betId || matchedBetIds.has(betId) || ["settled", "expired", "void", "cancelled"].includes(String(bet.status || ""))) continue;
    batch.set(doc(db, "bets", betId), { eventId, status: "expired", updatedAt: serverTimestamp() }, { merge: true });
    optimisticBets[betId] = { ...bet, eventId, status: "expired", updatedAt: localNow };
    writes += 1;
  }

  batch.set(doc(db, "events", eventId), {
    boardState: "history",
    hiddenFromNow: true,
    settlementStatus: unresolvedCount ? "partial" : "complete",
    settlementIssue: unresolvedCount ? unresolvedIssues.join(" | ") : null,
    settlementCheckedAt: serverTimestamp(),
    ...(unresolvedCount ? {} : { settledAt: serverTimestamp() }),
    updatedAt: serverTimestamp()
  }, { merge: true });
  writes += 1;

  if (writes) await batch.commit();

  state.ledgerEntries = { ...state.ledgerEntries, ...optimisticLedger };
  state.matches = { ...state.matches, ...optimisticMatches };
  state.bets = { ...state.bets, ...optimisticBets };
  state.events[eventId] = {
    ...event,
    boardState: "history",
    hiddenFromNow: true,
    settlementStatus: unresolvedCount ? "partial" : "complete",
    settlementIssue: unresolvedCount ? unresolvedIssues.join(" | ") : null,
    updatedAt: localNow,
    firestoreId: eventId
  };
  settlementSyncMessage = unresolvedCount
    ? `Settlement needs repair for ${eventDisplayTitle(event)}: ${unresolvedIssues.join(" | ")}.`
    : `Settlement posted for ${eventDisplayTitle(event)}. Ledger/profile/leaderboard updated locally; syncing server confirmation…`;
  renderApp();

  setTimeout(() => {
    if (settlementSyncMessage.includes(eventDisplayTitle(event))) {
      settlementSyncMessage = "";
      renderApp();
    }
  }, 6500);

  if (!options.silent) {
    if (unresolvedCount) alert(`Settled ${changed} matched bet${changed === 1 ? "" : "s"}; ${unresolvedCount} still need repair. ${unresolvedIssues.join(" | ")}`);
    else alert(`Settled/repaired ${changed} matched bet${changed === 1 ? "" : "s"} for ${eventDisplayTitle(event)}.`);
  }
  return changed;
}

async function settleRankedEvent(event, options = {}) {
  if (!event.resultOrder?.length) { if (!options.silent) alert("Ranked event needs a result order first."); return; }

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


async function settleFightCardEvent(event, options = {}) {
  const resultMap = event.fightResults || Object.fromEntries((event.fights || []).map(fight => [fight.id, fight.winner]).filter(([, winner]) => winner));
  if (!Object.keys(resultMap).length) {
    if (!options.silent) alert("UFC fight card needs winners first. Use fightId:winner in Ranked result order, separated by commas.");
    return;
  }

  const batch = writeBatch(db);

  Object.values(state.matches)
    .filter(match => match.eventId === event.id && match.type === EVENT_TYPES.FIGHT_CARD && match.status !== "settled")
    .forEach(match => {
      const fight = fightById(event, match.fightId);
      const winnerName = String(resultMap[match.fightId] || "").toLowerCase();
      if (!fight || !winnerName) return;

      const sideAName = fightPickName(fight, match.sideA).toLowerCase();
      const sideBName = fightPickName(fight, match.sideB).toLowerCase();
      const winner = winnerName === sideAName ? match.userA : winnerName === sideBName ? match.userB : null;
      if (!winner) return;

      const loser = winner === match.userA ? match.userB : match.userA;
      const ledgerRef = doc(collection(db, "ledgerEntries"));

      batch.set(ledgerRef, {
        id: ledgerRef.id,
        eventId: event.id,
        fromUser: loser,
        toUser: winner,
        amount: matchEffectiveAmount(match),
        matchId: match.firestoreId || match.id,
        originalAmount: Number(match.doubleUp?.originalAmount || match.amount || 0),
        doubledUp: matchIsDoubled(match),
        note: `UFC settled: ${event.title} · ${fight.label}${matchIsDoubled(match) ? " · doubled up" : ""}`,
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
  const raw = String(input || "").trim();
  const value = raw.toUpperCase();
  if (!value) return null;
  return state.events[raw]
    || state.events[value]
    || Object.values(state.events).find(event =>
      String(event.shortCode || "").toUpperCase() === value
      || eventIdCandidates(event).has(raw)
      || eventIdCandidates(event).has(value)
    )
    || null;
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

function normalizeTeamIdentityText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function teamIdentityAliases(team = {}) {
  return [...new Set([
    team.code,
    team.name,
    team.displayName,
    team.shortDisplayName,
    team.location
  ].map(normalizeTeamIdentityText).filter(Boolean))];
}

function teamEventsLikelySame(saved, incoming) {
  if (saved?.type !== EVENT_TYPES.TEAM || incoming?.type !== EVENT_TYPES.TEAM) return false;
  if (normalizeTeamIdentityText(saved.league) !== normalizeTeamIdentityText(incoming.league)) return false;

  const savedStart = new Date(saved.startTime || 0).getTime();
  const incomingStart = new Date(incoming.startTime || 0).getTime();
  const startsClose = Number.isFinite(savedStart)
    && Number.isFinite(incomingStart)
    && Math.abs(savedStart - incomingStart) <= 12 * 60 * 60 * 1000;
  const sameDisplayDate = dateISOInDisplayTimeZone(saved.startTime || 0) === dateISOInDisplayTimeZone(incoming.startTime || 0);
  if (!startsClose && !sameDisplayDate) return false;

  const intersects = (left, right) => left.some(value => right.includes(value));
  return intersects(teamIdentityAliases(saved.away), teamIdentityAliases(incoming.away))
    && intersects(teamIdentityAliases(saved.home), teamIdentityAliases(incoming.home));
}

function eventMatchesApiImport(saved, apiEvent) {
  if (!saved || !apiEvent) return false;

  const sameLeague = String(saved.league || "") === String(apiEvent.league || "");
  const sameSport = String(saved.sport || "") === String(apiEvent.sport || "");
  if (!sameLeague || !sameSport) return false;

  const savedMlbGamePk = saved.externalIds?.mlbGamePk || "";
  const apiMlbGamePk = apiEvent.externalIds?.mlbGamePk || (apiEvent.externalIds?.source === "mlb-statsapi" ? apiEvent.apiEventId : "");
  if (savedMlbGamePk && apiMlbGamePk && String(savedMlbGamePk) === String(apiMlbGamePk)) return true;

  const savedEspn = saved.externalIds?.espnEventId || saved.externalIds?.eventId || "";
  const apiEspn = apiEvent.externalIds?.espnEventId || apiEvent.externalIds?.eventId || "";
  if (savedEspn && apiEspn && String(savedEspn) === String(apiEspn)) return true;

  // Older imports sometimes lost or changed source IDs when team names were
  // expanded from abbreviations. Match the same scheduled teams as a fallback
  // so final scores cannot create a second event while the original stays live.
  if (teamEventsLikelySame(saved, apiEvent)) return true;

  const savedTitle = String(saved.title || "").trim().toLowerCase();
  const apiTitle = String(apiEvent.title || "").trim().toLowerCase();
  const savedStart = new Date(saved.startTime || 0).getTime();
  const apiStart = new Date(apiEvent.startTime || 0).getTime();
  const startsClose = Number.isFinite(savedStart) && Number.isFinite(apiStart) && Math.abs(savedStart - apiStart) < 60 * 60 * 1000;

  return !!savedTitle && savedTitle === apiTitle && startsClose;
}

function normalizeEventTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/grand prix|gp|race|presented by.*$/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function eventSourceConfidence(event) {
  const source = String(event?.externalIds?.source || event?.apiSource || "").toLowerCase();
  if (event?.leaderboardVerified) return 100;
  if (source.includes("jolpica") || source.includes("ergast")) return 95;
  if (source.includes("nascar")) return 95;
  if (source.includes("mlb-statsapi")) return 95;
  if (source.includes("motogp")) return 90;
  if (source.includes("espn")) return 45;
  return 10;
}

function canonicalApiKey(event) {
  const league = String(event?.league || "").trim().toLowerCase();
  const sport = String(event?.sport || "").trim().toLowerCase();
  const type = String(event?.type || "").trim();
  const ids = event?.externalIds || {};

  // Team games must include a stable source id or the schedule date + teams.
  // The old title-only key made repeated series games like HOU @ LAA collide
  // across multiple dates, which caused refreshes to mutate/hide the wrong game.
  if (type === EVENT_TYPES.TEAM) {
    const sourceId = ids.mlbGamePk || ids.espnEventId || ids.eventId || "";
    if (sourceId) return `${sport}|${league}|team|${sourceId}`;

    const date = dateISOInDisplayTimeZone(event?.startTime || Date.now());
    const away = String(event?.away?.code || "away").toLowerCase();
    const home = String(event?.home?.code || "home").toLowerCase();
    return `${sport}|${league}|team|${date}|${away}|${home}`;
  }

  if (type === EVENT_TYPES.FIGHT_CARD) {
    const sourceId = ids.espnEventId || ids.eventId || event?.id || "";
    const date = dateISOInDisplayTimeZone(event?.startTime || Date.now());
    return `${sport}|${league}|fight|${sourceId || `${date}|${normalizeEventTitle(event?.title || "")}`}`;
  }

  const title = normalizeEventTitle(event?.title || "");
  const f1Round = event?.externalIds?.f1Round ? `round-${event.externalIds.f1Round}` : "";
  const sourceRound = f1Round || title;
  return `${sport}|${league}|ranked|${sourceRound}`;
}

function eventLooksSameRace(saved, apiEvent) {
  if (!saved || !apiEvent) return false;
  if (String(saved.sport || "") !== String(apiEvent.sport || "")) return false;
  if (String(saved.league || "") !== String(apiEvent.league || "")) return false;

  // This fallback is only safe for ranked/racing-style events where the event
  // title is the event identity. It is unsafe for team sports because the same
  // matchup can repeat on consecutive dates.
  if (saved.type !== EVENT_TYPES.RANKED || apiEvent.type !== EVENT_TYPES.RANKED) return false;

  const savedKey = canonicalApiKey(saved);
  const apiKey = canonicalApiKey(apiEvent);
  if (savedKey && apiKey && savedKey === apiKey) return true;

  const savedTitle = normalizeEventTitle(saved.title || "");
  const apiTitle = normalizeEventTitle(apiEvent.title || "");
  return !!savedTitle && !!apiTitle && savedTitle === apiTitle;
}

function findExistingF1RaceWeekendEvent(apiEvent) {
  if (!apiEvent || apiEvent.league !== "F1" || apiEvent.type !== EVENT_TYPES.RANKED) return null;
  if (apiEvent.externalIds?.source !== "jolpica-f1") return null;

  const apiStart = new Date(apiEvent.startTime || 0).getTime();
  if (!Number.isFinite(apiStart)) return null;

  const leadInStart = apiStart - (3 * 24 * 60 * 60 * 1000);
  const leadInEnd = apiStart + (6 * 60 * 60 * 1000);
  const apiRound = String(apiEvent.externalIds?.f1Round || "");

  return Object.values(state.events || {}).find(saved => {
    if (!saved || saved.league !== "F1" || saved.type !== EVENT_TYPES.RANKED) return false;
    if (saved.status === "final") return false;

    const savedRound = String(saved.externalIds?.f1Round || "");
    if (apiRound && savedRound && apiRound === savedRound) return true;

    const savedStart = new Date(saved.startTime || 0).getTime();
    if (!Number.isFinite(savedStart)) return false;

    const savedSource = String(saved.externalIds?.source || saved.apiSource || "").toLowerCase();
    const staleOrUnverified = !savedSource.includes("jolpica") || !saved.leaderboardVerified || !saved.externalIds?.f1Round;

    // Legacy ESPN F1 imports often created the race as a Friday/session item
    // with a partial top-10 list. If that stale event sits inside the race-week
    // lead-in window, refresh that same Firestore event instead of leaving it
    // visible next to the verified Jolpica race.
    return staleOrUnverified && savedStart >= leadInStart && savedStart <= leadInEnd;
  }) || null;
}

function findExistingApiEvent(apiEvent) {
  const docId = apiEventDocId(apiEvent);
  if (state.events[docId]) return state.events[docId];

  const exactSourceMatch = Object.values(state.events || {}).find(saved => eventMatchesApiImport(saved, apiEvent));
  if (exactSourceMatch) return exactSourceMatch;

  const f1WeekendMatch = findExistingF1RaceWeekendEvent(apiEvent);
  if (f1WeekendMatch) return f1WeekendMatch;

  return Object.values(state.events || {}).find(saved => eventLooksSameRace(saved, apiEvent));
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
    const existing = findExistingApiEvent(event);
    const scoreText = event.type === EVENT_TYPES.RANKED
      ? `${(event.participants || []).slice(0, 6).join(", ")}${(event.participants || []).length > 6 ? "..." : ""}`
      : event.score
        ? `${teamDisplayName(event, "away")} ${event.score.away} · ${teamDisplayName(event, "home")} ${event.score.home}`
        : `${teamDisplayName(event, "away")} vs ${teamDisplayName(event, "home")}`;
    return `
      <div class="record api-result-row">
        <div>
          <strong>${escapeHtml(eventDisplayTitle(event))}</strong><br />
          <span class="muted small">${escapeHtml(event.league)} · ${escapeHtml(formatTime(event.startTime))} ET · ${escapeHtml(label(event.status))}</span><br />
          <span class="small">${escapeHtml(scoreText)} · Odds: ${escapeHtml(event.odds || "Unavailable")}</span>
        </div>
        <button class="${existing ? "ghost" : "primary"}" data-import-api-event="${escapeHtml(event.apiEventId)}">${existing ? "Refresh" : "Import"}</button>
      </div>
    `;
  }).join("");
}



async function cleanupOldHistoryEvents(options = {}) {
  if (!isAdmin()) return 0;

  const candidates = Object.values(state.events || {}).filter(eventCanBeHistoryCleaned);
  const protectedCount = Object.values(state.events || {}).filter(event =>
    eventIsExpiredHistory(event) && !eventCanBeHistoryCleaned(event)
  ).length;

  if (!candidates.length) {
    if (!options.silent) {
      apiImportMessage = protectedCount
        ? `No old history could be cleaned. ${protectedCount} old final event${protectedCount === 1 ? "" : "s"} still have unsettled matches and were protected.`
        : "No history older than 5 days found.";
      renderApp();
    }
    return 0;
  }

  if (!options.silent) {
    const ok = confirm(`Delete ${candidates.length} final history event${candidates.length === 1 ? "" : "s"} older than 5 days from Firebase? Ledger entries and settlements are preserved.`);
    if (!ok) return 0;
  }

  const batch = writeBatch(db);
  let deleted = 0;
  const ids = new Set(candidates.map(event => functionSafeEventId(event)).filter(Boolean));

  for (const bet of Object.values(state.bets || {})) {
    if (ids.has(bet.eventId)) {
      const betId = bet.firestoreId || bet.id;
      if (betId) {
        batch.delete(doc(db, "bets", betId));
        delete state.bets[betId];
        deleted += 1;
      }
    }
  }

  for (const match of Object.values(state.matches || {})) {
    if (ids.has(match.eventId)) {
      const matchId = match.firestoreId || match.id;
      if (matchId) {
        batch.delete(doc(db, "matches", matchId));
        delete state.matches[matchId];
        deleted += 1;
      }
    }
  }

  for (const event of candidates) {
    const eventId = functionSafeEventId(event);
    if (!eventId) continue;
    batch.delete(doc(db, "events", eventId));
    delete state.events[eventId];
    deleted += 1;
  }

  await batch.commit();

  if (!options.silent) {
    apiImportMessage = `Cleaned ${candidates.length} history event${candidates.length === 1 ? "" : "s"} older than 5 days from Firebase. Ledger/profile/leaderboard records were preserved.`;
    renderApp();
  }

  return candidates.length;
}

async function cleanupDuplicateApiEvents(options = {}) {
  if (!isAdmin()) return;

  const events = Object.values(state.events || {}).filter(event => event.externalIds?.source || event.leaderboardSource || event.odds === "API schedule import");
  const groups = new Map();

  for (const event of events) {
    const key = canonicalApiKey(event);
    if (!key || key.includes("||")) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }

  const batch = writeBatch(db);
  let removed = 0;

  for (const group of groups.values()) {
    if (group.length <= 1) continue;

    const sorted = [...group].sort((a, b) => {
      const confidenceDiff = eventSourceConfidence(b) - eventSourceConfidence(a);
      if (confidenceDiff !== 0) return confidenceDiff;
      return toDateValue(b.updatedAt || b.createdAt) - toDateValue(a.updatedAt || a.createdAt);
    });

    const keep = sorted[0];
    for (const duplicate of sorted.slice(1)) {
      const duplicateId = duplicate.firestoreId || duplicate.id;
      if (!duplicateId) continue;

      const hasBets = Object.values(state.bets || {}).some(bet => bet.eventId === duplicateId);
      const hasMatches = Object.values(state.matches || {}).some(match => match.eventId === duplicateId);
      if (hasBets || hasMatches) continue;

      // Extra safety: team games are only removable as duplicates when their
      // canonical key includes an actual source identifier/date+teams. This
      // prevents repeated series matchups from being treated as stale clones.
      if (duplicate.type === EVENT_TYPES.TEAM && canonicalApiKey(duplicate) !== canonicalApiKey(keep)) continue;

      batch.delete(doc(db, "events", duplicateId));
      delete state.events[duplicateId];
      removed += 1;
    }

    const keepId = keep.firestoreId || keep.id;
    if (keepId) {
      batch.set(doc(db, "events", keepId), {
        duplicateCleanedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  }

  if (!removed) {
    if (!options.silent) {
      apiImportMessage = "No removable duplicate API events found. Events with bets/matches are preserved.";
      renderApp();
    }
    return 0;
  }

  await batch.commit();
  if (!options.silent) {
    apiImportMessage = `Removed ${removed} duplicate/stale API event${removed === 1 ? "" : "s"}. Events with bets/matches were preserved.`;
    renderApp();
  }
  return removed;
}


async function deleteApiEvent(eventId) {
  if (!isAdmin()) return;
  const event = state.events[eventId];
  if (!event) return alert("Could not find that event.");

  if (eventHasFinancialRecords(eventId)) {
    return alert("Protected: this event has bets, matches, or ledger records, so the app will not delete it.");
  }

  const ok = confirm(`Delete imported event "${event.title || eventId}"? This only deletes the event, not users/bets/ledger.`);
  if (!ok) return;

  await deleteDoc(doc(db, "events", eventId));
  delete state.events[eventId];
  apiImportMessage = `Deleted stale imported event: ${event.title || eventId}.`;
  renderApp();
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
    apiImportMessage = `Fetched ${apiImportResults.length} ${league} event${apiImportResults.length === 1 ? "" : "s"}. ${data.note ? data.note + " " : ""}Review before importing.`;
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
  const existing = findExistingApiEvent(event);

  if (existing) {
    const existingDocId = existing.firestoreId || existing.id || id;
    const refreshFields = safeRefreshFieldsForEvent(event, existing);

    await setDoc(doc(db, "events", existingDocId), refreshFields, { merge: true });

    state.events[existingDocId] = {
      ...existing,
      ...event,
      ...refreshFields,
      firestoreId: existingDocId,
      id: existing.id || existingDocId,
      shortCode: existing.shortCode,
      startTime: refreshFields.startTime || existing.startTime,
      title: refreshFields.title || existing.title,
      participants: refreshFields.participants || existing.participants,
      updatedAt: new Date()
    };

    const safetyNote = eventHasFinancialRecords(existingDocId) ? " Betting structure was preserved because this event has bets/matches/ledger records." : "";
    apiImportMessage = `Refreshed existing ${event.title}. It is saved as ${existing.shortCode || existingDocId}.${safetyNote}`;
    activeTab = "today";
    filters = { sport: event.sport || "all", league: event.league || "all", betState: "all" };
    renderApp();
    return;
  }

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

  state.events[id] = {
    firestoreId: id,
    ...savedEvent,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  apiImportMessage = `Imported ${event.title}. It is now saved as ${savedEvent.shortCode}.`;
  activeTab = "today";
  filters = { sport: event.sport || "all", league: event.league || "all", betState: "all" };
  renderApp();
}

function dateISOInDisplayTimeZone(value = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return getBettingDayISO();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function dateISOOffset(daysFromToday = 0) {
  const date = new Date(`${getBettingDayISO()}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

async function saveApiEventToBatch(batch, event, usedCodes) {
  const id = apiEventDocId(event);
  const existing = findExistingApiEvent(event);

  if (existing) {
    const existingId = existing.firestoreId || existing.id || id;
    const liveFields = removeUndefinedDeep(safeRefreshFieldsForEvent(event, existing));
    batch.set(doc(db, "events", existingId), liveFields, { merge: true });
    return "updated";
  }

  const savedEvent = {
    ...event,
    id,
    shortCode: nextAvailableDisplayCode(event.league, event.startTime, usedCodes),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  delete savedEvent.apiSource;
  delete savedEvent.apiEventId;

  batch.set(doc(db, "events", id), removeUndefinedDeep(savedEvent), { merge: true });
  return "added";
}

async function importAllApiEvents() {
  if (!isAdmin() || !apiImportResults.length) return;

  const batch = writeBatch(db);
  let added = 0;
  let updated = 0;
  const usedCodes = new Set(Object.values(state.events || {}).map(event => event.shortCode).filter(Boolean));

  for (const event of apiImportResults) {
    const result = await saveApiEventToBatch(batch, event, usedCodes);
    if (result === "added") added += 1;
    if (result === "updated") updated += 1;
  }

  if (!added && !updated) {
    apiImportMessage = "No events to import or refresh.";
    renderApp();
    return;
  }

  await batch.commit();
  apiImportMessage = `Imported ${added} new event${added === 1 ? "" : "s"}; refreshed ${updated} existing event${updated === 1 ? "" : "s"}.`;
  renderApp();
}

async function fetchApiEventsForLeagueDate(league, dateISO) {
  const date = dateISO.replace(/-/g, "");
  const response = await fetch(`/api/espn-events?league=${encodeURIComponent(league)}&date=${encodeURIComponent(date)}&fresh=${Date.now()}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `${league} failed with ${response.status}`);
  return data.events || [];
}

async function syncNowWindowSchedule(options = {}) {
  if (!isAdmin() || apiSyncRunning) return { added: 0, updated: 0, fetched: 0 };

  const silent = !!options.silent;
  const dates = nowWindowDateISOs();
  apiSyncRunning = true;
  apiImportResults = [];

  if (!silent) {
    apiImportMessage = `Syncing ${NOW_WINDOW_SYNC_LABEL} (${dates.join(", ")}) across supported leagues...`;
    renderApp();
  }

  try {
    const sweep = await syncSportSourceSweeps({ silent: true });
    const totals = sweep.results.reduce((acc, item) => {
      acc.added += item.added || 0;
      acc.updated += item.updated || 0;
      acc.fetched += item.fetched || 0;
      acc.skipped += item.skipped || 0;
      acc.errors += item.errors?.length || 0;
      return acc;
    }, { added: 0, updated: 0, fetched: 0, skipped: 0, errors: 0 });

    if (!silent) {
      apiImportMessage = `Synced ${NOW_WINDOW_SYNC_LABEL}. Fetched ${totals.fetched}; saved ${totals.added + totals.updated}; skipped ${totals.skipped}; source errors ${totals.errors}.`;
      renderApp();
    }

    return { ...totals, results: sweep.results };
  } catch (error) {
    if (!silent) {
      apiImportMessage = error.message || "Now window sync failed.";
      renderApp();
    }
    return { added: 0, updated: 0, fetched: 0, error: error.message || "Now window sync failed." };
  } finally {
    apiSyncRunning = false;
  }
}

async function syncApiSchedule(daysFromToday = 0, options = {}) {
  if (!isAdmin() || apiSyncRunning) return { added: 0, updated: 0, fetched: 0 };

  const silent = !!options.silent;
  const dateISO = dateISOOffset(daysFromToday);
  apiSyncRunning = true;
  apiImportResults = [];
  if (!silent) {
    apiImportMessage = `Syncing ${dateISO} across supported leagues...`;
    renderApp();
  }

  try {
    const batch = writeBatch(db);
    const usedCodes = new Set(Object.values(state.events || {}).map(event => event.shortCode).filter(Boolean));
    const counts = [];
    let added = 0;
    let updated = 0;
    let fetched = 0;

    for (const league of API_IMPORT_LEAGUES) {
      try {
        const events = await fetchApiEventsForLeagueDate(league, dateISO);
        fetched += events.length;
        let leagueAdded = 0;
        for (const event of events) {
          const existing = findExistingApiEvent(event);
          if (!existing && !eventShouldBeAutoSavedForNowWindow(event)) continue;

          const result = await saveApiEventToBatch(batch, event, usedCodes);
          if (result === "added") {
            added += 1;
            leagueAdded += 1;
          }
          if (result === "updated") updated += 1;
        }
        if (events.length || leagueAdded) counts.push(`${league}: ${leagueAdded}/${events.length}`);
      } catch (error) {
        const cleanError = String(error.message || "error").replace(/^ESPN request failed with /, "");
        counts.push(`${league}: ${cleanError}`);
      }
    }

    if (added || updated) await batch.commit();

    if (!silent) apiImportMessage = `Synced ${dateISO}. Fetched ${fetched}; imported ${added} new event${added === 1 ? "" : "s"}; refreshed ${updated} existing event${updated === 1 ? "" : "s"}. ${counts.join(" · ")}`;
    return { added, updated, fetched };
  } catch (error) {
    if (!silent) apiImportMessage = error.message || "Schedule sync failed.";
    return { added: 0, updated: 0, fetched: 0, error: error.message || "Schedule sync failed." };
  } finally {
    apiSyncRunning = false;
    if (!silent) renderApp();
  }
}

function liveRefreshCandidateEvents() {
  const now = Date.now();
  const soonMs = 20 * 60 * 1000;
  const recentMs = 36 * 60 * 60 * 1000;

  return Object.values(state.events || {}).filter(event => {
    if (!event || event.status === "final") return false;
    if (![EVENT_TYPES.TEAM, EVENT_TYPES.RANKED, EVENT_TYPES.FIGHT_CARD].includes(event.type)) return false;
    const start = new Date(event.startTime || 0).getTime();
    if (!Number.isFinite(start)) return event.status === "live";
    return event.status === "live" || (start <= now + soonMs && start >= now - recentMs);
  });
}

async function syncLiveScoreEvents(options = {}) {
  // Firestore event writes are admin-only. This browser path is an explicit
  // fallback when the shared server maintenance function is unavailable.
  if (!isAdmin()) return { updated: 0, fetched: 0 };

  const candidates = liveRefreshCandidateEvents();
  if (!candidates.length) return { updated: 0, fetched: 0 };

  const candidateIds = new Set(candidates.flatMap(event => eventIdentityValues(event)));
  const leaguesByDate = new Map();
  for (const event of candidates) {
    const league = event.league;
    if (!API_IMPORT_LEAGUES.includes(league)) continue;
    const displayDate = dateISOInDisplayTimeZone(event.startTime || Date.now());
    const datesToTry = new Set([displayDate]);

    const eventIds = eventIdCandidates(event);
    const hasUnsettledMatch = Object.values(state.matches || {}).some(match =>
      eventIds.has(String(match.eventId || ""))
      && !["settled", "void", "cancelled"].includes(String(match.status || ""))
    );
    if (event.status === "live" || hasUnsettledMatch) {
      const d = new Date(`${displayDate}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      datesToTry.add(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 2);
      datesToTry.add(d.toISOString().slice(0, 10));
    }

    for (const date of datesToTry) {
      const key = `${league}|${date}`;
      leaguesByDate.set(key, { league, date });
    }
  }

  if (!leaguesByDate.size) return { updated: 0, fetched: 0 };

  const batch = writeBatch(db);
  let fetched = 0;
  let updated = 0;

  for (const { league, date } of leaguesByDate.values()) {
    try {
      const incomingEvents = await fetchApiEventsForLeagueDate(league, date);
      fetched += incomingEvents.length;

      for (const incoming of incomingEvents) {
        const existing = findExistingApiEvent(incoming);
        if (!existing) continue; // approved refreshes never create unrelated events

        const existingIds = eventIdentityValues(existing);
        if (!existingIds.some(id => candidateIds.has(id))) continue;

        const existingId = existing.firestoreId || existing.id;
        if (!existingId) continue;

        const refresh = safeRefreshFieldsForEvent(incoming, existing);
        const approvedRefresh = {
          status: refresh.status,
          score: refresh.score || null,
          liveStats: refresh.liveStats || [],
          weather: refresh.weather || existing.weather || null,
          liveContext: refresh.liveContext || "",
          gameContext: refresh.gameContext || "",
          leaderboard: refresh.leaderboard || existing.leaderboard || [],
          resultOrder: refresh.resultOrder || existing.resultOrder || [],
          leaderboardVerified: Boolean(refresh.leaderboardVerified),
          leaderboardSource: refresh.leaderboardSource || existing.leaderboardSource || "",
          updatedAt: serverTimestamp()
        };

        batch.set(doc(db, "events", existingId), approvedRefresh, { merge: true });
        state.events[existingId] = {
          ...existing,
          ...approvedRefresh,
          updatedAt: new Date(),
          firestoreId: existingId
        };
        updated += 1;
      }
    } catch {
      // A single source failure must not block other leagues or settlement repair.
    }
  }

  if (updated) await batch.commit();
  return { updated, fetched };
}

async function syncLeagueNowWindow(league, options = {}) {
  if (!isAdmin()) return { added: 0, updated: 0, fetched: 0, skipped: 0, league };

  if (league === "MLB") {
    const mlb = await forceSyncMlbNowWindow({ silent: true, ...options });
    return { ...mlb, league: "MLB" };
  }

  const dates = nowWindowDateISOs();
  const usedCodes = new Set(Object.values(state.events || {}).map(event => event.shortCode).filter(Boolean));
  let fetched = 0;
  let added = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  for (const dateISO of dates) {
    const batch = writeBatch(db);
    let dateAdded = 0;
    let dateUpdated = 0;

    try {
      const events = await fetchApiEventsForLeagueDate(league, dateISO);
      fetched += events.length;

      for (const event of events) {
        const existing = findExistingApiEvent(event);
        if (!existing && !eventShouldBeAutoSavedForNowWindow(event)) {
          skipped += 1;
          continue;
        }

        const result = await saveApiEventToBatch(batch, event, usedCodes);
        if (result === "added") {
          added += 1;
          dateAdded += 1;
        }
        if (result === "updated") {
          updated += 1;
          dateUpdated += 1;
        }
      }

      if (dateAdded || dateUpdated) await batch.commit();
    } catch (error) {
      errors.push(`${dateISO}: ${error?.message || String(error)}`);
    }
  }

  return { league, added, updated, fetched, skipped, errors };
}

async function syncSportSourceSweeps(options = {}) {
  if (!isAdmin()) return { results: [] };

  const leagues = options.leagues || API_IMPORT_LEAGUES;
  const results = [];
  for (const league of leagues) {
    try {
      const result = await syncLeagueNowWindow(league, { silent: true });
      results.push(result);
    } catch (error) {
      results.push({ league, added: 0, updated: 0, fetched: 0, skipped: 0, errors: [error?.message || String(error)] });
    }
  }

  const important = results
    .filter(item => (item.added || item.updated || item.errors?.length || item.league === "MLB"))
    .map(item => `${item.league}: f${item.fetched || 0}/+${item.added || 0}/~${item.updated || 0}${item.errors?.length ? "/err" : ""}`);

  sourceSweepDebug = important.join(" · ");
  return { results };
}

async function forceSyncMlbNowWindow(options = {}) {
  if (!isAdmin()) return { added: 0, updated: 0, fetched: 0, errors: [] };

  const silent = !!options.silent;
  const dates = nowWindowDateISOs();
  const usedCodes = new Set(Object.values(state.events || {}).map(event => event.shortCode).filter(Boolean));
  const debug = [];
  const errors = [];
  let fetched = 0;
  let added = 0;
  let updated = 0;
  let skipped = 0;

  if (!silent) {
    apiImportMessage = `Force syncing MLB from MLB Stats API for ${dates.join(", ")}...`;
    mlbSyncDebug = "";
    renderApp();
  }

  for (const dateISO of dates) {
    try {
      const events = await fetchApiEventsForLeagueDate("MLB", dateISO);
      fetched += events.length;

      let dateAdded = 0;
      let dateUpdated = 0;
      let dateSkipped = 0;
      const batch = writeBatch(db);

      for (const event of events) {
        const existing = findExistingApiEvent(event);
        const shouldSave = existing || eventShouldBeAutoSavedForNowWindow(event);

        if (!shouldSave) {
          skipped += 1;
          dateSkipped += 1;
          continue;
        }

        const result = await saveApiEventToBatch(batch, event, usedCodes);
        if (result === "added") {
          added += 1;
          dateAdded += 1;
        }
        if (result === "updated") {
          updated += 1;
          dateUpdated += 1;
        }
      }

      if (dateAdded || dateUpdated) await batch.commit();
      debug.push(mlbDebugLine(dateISO, { fetched: events.length, added: dateAdded, updated: dateUpdated, skipped: dateSkipped }));
    } catch (error) {
      const message = error?.message || String(error);
      errors.push(`${dateISO}: ${message}`);
      debug.push(mlbDebugLine(dateISO, { error: message }));
    }
  }

  mlbSyncDebug = [...debug, ...errors.map(error => `Error ${error}`)].join(" · ");

  if (!silent) {
    apiImportMessage = `MLB force sync complete. Fetched ${fetched}; added ${added}; updated ${updated}; skipped ${skipped}.`;
    renderApp();
  }

  return { added, updated, fetched, skipped, errors };
}

async function syncMlbLiveSweep(options = {}) {
  // Use the same dedicated MLB path for automatic refreshes and manual repair.
  // This avoids the old candidate-only refresh problem where missing MLB games
  // could not update because they were never on the board.
  return forceSyncMlbNowWindow({ silent: true, ...options });
}

function autoKey(name) {
  return `everyoneLoses:auto:${name}`;
}

function shouldRunAutoTask(name, intervalMs) {
  try {
    const key = autoKey(name);
    const last = Number(localStorage.getItem(key) || 0);
    if (Date.now() - last < intervalMs) return false;
    localStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

function oddsAutoDailyKey() {
  return autoKey(`odds-daily:${getBettingDayISO()}`);
}

function getAutoOddsRequestCount() {
  try {
    return Number(localStorage.getItem(oddsAutoDailyKey()) || 0);
  } catch {
    return 0;
  }
}

function reserveAutoOddsRequestSlot() {
  try {
    const key = oddsAutoDailyKey();
    const current = Number(localStorage.getItem(key) || 0);
    if (current >= ODDS_DAILY_AUTO_REQUEST_LIMIT) return false;
    localStorage.setItem(key, String(current + 1));
    return true;
  } catch {
    return true;
  }
}

function oddsRefreshCooldownMs(event) {
  return event?.status === "live" ? ODDS_AUTO_LIVE_COOLDOWN_MS : ODDS_AUTO_PREGAME_COOLDOWN_MS;
}

function eventHasFreshAutoOdds(event) {
  const fetchedAt = toDateValue(event?.oddsLive?.fetchedAt);
  if (!fetchedAt) return false;
  return Date.now() - fetchedAt < oddsRefreshCooldownMs(event);
}

function activeTeamEventsForOdds() {
  const now = Date.now();
  const nearWindowMs = 36 * 60 * 60 * 1000;

  return Object.values(state.events || {}).filter(event => {
    if (event.type !== EVENT_TYPES.TEAM || event.status === "final") return false;

    const eventId = event.firestoreId || event.id;
    if (!eventHasMatchedOddsInterest(eventId)) return false;
    if (eventHasFreshAutoOdds(event)) return false;

    const start = new Date(event.startTime || 0).getTime();
    if (!Number.isFinite(start)) return event.status === "live";

    return event.status === "live" || Math.abs(start - now) <= nearWindowMs;
  });
}

function finalEventsNeedingSettlement() {
  return Object.values(state.events || {}).filter(event => {
    if (!eventIsComplete(event)) return false;
    const ids = eventIdCandidates(event);
    return Object.values(state.matches || {}).some(match => {
      if (!ids.has(String(match.eventId || ""))) return false;
      const status = String(match.status || "").toLowerCase();
      if (["void", "cancelled"].includes(status)) return false;
      if (status !== "settled") return true;

      const resolved = event.type === EVENT_TYPES.TEAM ? resolvedTeamMatch(match, event) : null;
      const amount = resolved?.amount || matchEffectiveAmount(match);
      const matchId = match.firestoreId || match.id;
      const maybeLedger = Object.values(state.ledgerEntries || {}).find(entry =>
        ids.has(String(entry.eventId || "")) &&
        (String(entry.matchId || "") === String(matchId || "") || (!entry.matchId && Number(entry.amount) === amount))
      );
      return !maybeLedger || Number(maybeLedger.amount || 0) !== amount;
    });
  });
}

async function requestDedicatedEventSettlement(event) {
  if (!auth.currentUser) throw new Error("Admin login is required for settlement.");
  const token = await auth.currentUser.getIdToken();
  const eventId = event.firestoreId || event.id;
  const response = await fetch(`/api/settle-event?fresh=${Date.now()}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store"
    },
    body: JSON.stringify({ eventId })
  });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
  if (!response.ok) {
    const detail = [data.error, data.code, data.stage].filter(Boolean).join(" · ");
    throw new Error(detail || raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300) || `Settlement returned ${response.status}`);
  }
  return data;
}

function scheduleImmediateFinalSettlementCheck() {
  if (!isAdmin() || settlementRepairRunning) return;
  clearTimeout(immediateSettlementTimer);
  immediateSettlementTimer = setTimeout(() => {
    if (isAdmin() && finalEventsNeedingSettlement().length) autoSettleFinalEvents("snapshot");
  }, 900);
}

async function autoSettleFinalEvents(reason = "automatic") {
  if (!isAdmin() || settlementRepairRunning) return 0;
  settlementRepairRunning = true;
  let settled = 0;
  try {
    for (const event of finalEventsNeedingSettlement()) {
      let serverCompleted = false;
      let serverError = null;
      try {
        const result = await requestDedicatedEventSettlement(event);
        const summary = result?.settlement || {};
        const completedWrites = Number(summary.matches || 0) + Number(summary.ledgerWrites || 0) + Number(summary.tiesVoided || 0) + Number(summary.betsClosed || 0);
        const unresolved = Array.isArray(summary.unresolved) ? summary.unresolved : [];
        if (unresolved.length) {
          settlementSyncMessage = `Settlement still needs repair for ${eventDisplayTitle(event)}: ${unresolved.map(item => item.issue).filter(Boolean).join(" | ")}`;
        }
        serverCompleted = completedWrites > 0 || Number(summary.events || 0) > 0;
        if (serverCompleted) settled += 1;
      } catch (error) {
        serverError = error;
      }

      // The signed-in admin fallback is intentionally independent from the
      // maintenance function. It also handles legacy matches that never stored
      // a type or side fields by reconstructing them from the linked bets.
      if (!serverCompleted) {
        try {
          const changed = await settleEvent(event.firestoreId || event.id, { silent: true });
          if (Number(changed || 0) > 0) settled += 1;
        } catch (fallbackError) {
          const detail = fallbackError?.message || String(fallbackError);
          autoMaintenanceMessage = `Settlement repair failed for ${event.title || event.id}: ${detail}${serverError ? ` · Server: ${serverError.message}` : ""}`;
        }
      }
    }
  } finally {
    settlementRepairRunning = false;
  }
  return settled;
}

async function autoRefreshOddsForActiveEvents() {
  let refreshed = 0;

  for (const event of activeTeamEventsForOdds()) {
    if (!reserveAutoOddsRequestSlot()) break;

    try {
      await refreshOddsForEvent(event.firestoreId || event.id, "auto-maintenance-bet-interest-only", false);
      refreshed += 1;
    } catch {
      // odds should never block the app
    }
  }

  return refreshed;
}

async function runAutoMaintenance(reason = "timer") {
  if (!isAdmin() || autoMaintenanceRunning) return;
  autoMaintenanceRunning = true;

  const notes = [];
  try {
    if (shouldRunAutoTask("live-score", LIVE_SCORE_SYNC_INTERVAL_MS)) {
      const live = await syncLiveScoreEvents({ silent: true });
      if (live.updated) notes.push(`live refreshed ${live.updated}`);
    }

    if (shouldRunAutoTask("source-sweeps", SPORT_SOURCE_SWEEP_INTERVAL_MS)) {
      const sweep = await syncSportSourceSweeps({ silent: true });
      const totals = sweep.results.reduce((acc, item) => {
        acc.added += item.added || 0;
        acc.updated += item.updated || 0;
        acc.fetched += item.fetched || 0;
        return acc;
      }, { added: 0, updated: 0, fetched: 0 });
      if (totals.added || totals.updated) notes.push(`source sweep ${totals.fetched} fetched, +${totals.added}/~${totals.updated}`);
    }

    if (shouldRunAutoTask("sync-now-window", DISCOVERY_SYNC_INTERVAL_MS)) {
      const nowWindow = await syncNowWindowSchedule({ silent: true });
      notes.push(`Now discovery ${nowWindow.fetched || 0} fetched, ${((nowWindow.added || 0) + (nowWindow.updated || 0))} saved`);
    }

    if (shouldRunAutoTask("cleanup", AUTO_CLEANUP_INTERVAL_MS)) {
      const removed = await cleanupDuplicateApiEvents({ silent: true });
      const historyRemoved = await cleanupOldHistoryEvents({ silent: true });
      notes.push(`cleanup removed ${removed || 0} duplicate/stale event(s), ${historyRemoved || 0} old history item(s)`);
    }

    if (shouldRunAutoTask("settle", AUTO_SETTLE_INTERVAL_MS)) {
      const settled = await autoSettleFinalEvents();
      notes.push(`settled ${settled}`);
    }

    if (shouldRunAutoTask("odds", AUTO_ODDS_INTERVAL_MS)) {
      const odds = await autoRefreshOddsForActiveEvents();
      notes.push(`Odds API refreshed ${odds} bet-interest event(s); auto cap ${getAutoOddsRequestCount()}/${ODDS_DAILY_AUTO_REQUEST_LIMIT}`);
    }

    if (notes.length) {
      autoMaintenanceMessage = `${formatTime(new Date().toISOString())} ${TIME_ZONE_LABEL}: ${notes.join(" · ")}.`;
    }
  } finally {
    autoMaintenanceRunning = false;
  }
}

async function runAdminForegroundMaintenanceFallback() {
  if (!isAdmin()) return { updated: 0, fetched: 0, settled: 0 };
  const live = await syncLiveScoreEvents({ silent: true });
  const settled = await autoSettleFinalEvents();
  return { ...live, settled };
}

async function triggerServerMaintenance(reason = "foreground") {
  if (!currentUser()?.approved || approvedLiveRefreshRunning) return null;
  approvedLiveRefreshRunning = true;
  let serverResult = null;
  let serverError = null;
  let fallback = { updated: 0, fetched: 0, settled: 0 };

  try {
    const response = await fetch(`/api/maintenance?mode=quick&reason=${encodeURIComponent(reason)}&fresh=${Date.now()}`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" }
    });
    const rawBody = await response.text();
    try {
      serverResult = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      serverResult = {};
    }
    if (!response.ok && response.status !== 202) {
      throw new Error(serverResult.error || rawBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 280) || `Maintenance returned ${response.status}`);
    }
  } catch (error) {
    serverError = error;
  }

  try {
    // Admin browsers independently verify active/recent events and settle any
    // newly final games. This prevents a broken server credential or scheduler
    // from leaving a completed event stuck on the Now board.
    fallback = await runAdminForegroundMaintenanceFallback();
  } catch (fallbackError) {
    if (!serverError) serverError = fallbackError;
  }

  if (reason === "manual") {
    if (serverError && !fallback.updated && !fallback.settled) {
      apiImportMessage = `Server maintenance failed and browser fallback could not repair it: ${serverError?.message || String(serverError)}`;
    } else {
      const serverText = serverResult?.skipped
        ? "Server maintenance was already running"
        : `Server: ${serverResult?.updated || 0} updated, ${serverResult?.added || 0} added, ${serverResult?.settlement?.ledgerWrites || 0} ledger write(s), ${serverResult?.settlement?.repairedLegacyMatches || 0} legacy match repair(s), ${serverResult?.settlement?.unresolved?.length || 0} unresolved settlement(s)`;
      apiImportMessage = `${serverText}. Browser verification: ${fallback.updated || 0} event update(s), ${fallback.settled || 0} settlement repair(s).${serverError ? ` Server warning: ${serverError.message}` : ""}`;
    }
    renderApp();
  }

  approvedLiveRefreshRunning = false;
  return serverResult || (fallback.updated || fallback.settled ? { browserFallback: true, ...fallback } : null);
}

function maybeStartSettlementMaintenance() {
  if (!currentUser()?.approved) return;
  if (!settlementMaintenanceTimer) {
    setTimeout(() => triggerServerMaintenance("startup"), 800);
    settlementMaintenanceTimer = setInterval(() => {
      if (document.visibilityState !== "hidden") triggerServerMaintenance("interval");
    }, 2 * 60 * 1000);

    const refreshOnReturn = () => {
      if (currentUser()?.approved && document.visibilityState !== "hidden") triggerServerMaintenance("foreground");
    };
    window.addEventListener("focus", refreshOnReturn);
    window.addEventListener("pageshow", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);
  }
}

function maybeStartAutoMaintenance() {
  // Automatic discovery/finalization is server-side in v10.60. Admin browsers
  // no longer run a second competing maintenance implementation.
}

async function deleteDemoEvents() {
  if (!isAdmin()) return;

  const demoEvents = Object.values(state.events).filter(event => {
    const id = String(event.id || "");
    return event.externalIds?.source === "demo"
      || event.odds === "Demo odds placeholder"
      || id.includes("SAS-OKC")
      || id.includes("MONACO-GP")
      || id.includes("COFFEE-TEA");
  });

  if (!demoEvents.length) {
    alert("No old demo events found.");
    return;
  }

  const ok = confirm(`Delete ${demoEvents.length} old demo event${demoEvents.length === 1 ? "" : "s"}? This also removes bets and matches attached to those demo events.`);
  if (!ok) return;

  const demoIds = new Set(demoEvents.map(event => event.firestoreId || event.id));
  const batch = writeBatch(db);
  let deleted = 0;

  for (const match of Object.values(state.matches)) {
    if (demoIds.has(match.eventId)) {
      batch.delete(doc(db, "matches", match.firestoreId || match.id));
      deleted += 1;
    }
  }

  for (const bet of Object.values(state.bets)) {
    if (demoIds.has(bet.eventId)) {
      batch.delete(doc(db, "bets", bet.firestoreId || bet.id));
      deleted += 1;
    }
  }

  for (const event of demoEvents) {
    batch.delete(doc(db, "events", event.firestoreId || event.id));
    deleted += 1;
  }

  await batch.commit();
  apiImportMessage = `Deleted ${demoEvents.length} old demo event${demoEvents.length === 1 ? "" : "s"}.`;
  renderApp();
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
  } else if (type === EVENT_TYPES.FIGHT_CARD) {
    const fights = parseFightCardInput(away);
    if (fights.length < 1) return alert("UFC fight cards need at least one fight like Fighter A vs Fighter B.");
    event = {
      ...base,
      sport: "combat",
      league: leagueInput || "UFC",
      type: EVENT_TYPES.FIGHT_CARD,
      fights,
      fightResults: {},
      odds: "UFC card",
      intel: "UFC main-card event. Bet each fight independently inside this card."
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

  if (resultInput && event.type === EVENT_TYPES.FIGHT_CARD) {
    const resultPairs = resultInput.split(",").map(item => item.trim()).filter(Boolean);
    const fightResults = { ...(event.fightResults || {}) };
    const fights = [...(event.fights || [])];

    for (const pair of resultPairs) {
      const [rawFightId, rawWinner] = pair.split(":").map(item => item?.trim());
      if (!rawFightId || !rawWinner) continue;
      const fight = fights.find(item => item.id === rawFightId || String(item.order) === rawFightId || item.label === rawFightId);
      if (!fight) continue;
      fightResults[fight.id] = rawWinner;
      fight.winner = rawWinner;
      fight.status = "final";
    }

    patch.fightResults = fightResults;
    patch.fights = fights;
  }

  await updateDoc(doc(db, "events", event.id), patch);
}

async function settleEventFromAdmin() {
  const id = document.querySelector("#adminEditEventId")?.value.trim().toUpperCase();
  if (!id) return alert("Enter event ID/code.");
  const event = findEventByIdOrCode(id);
  if (!event) return alert("Event not found.");
  if (!eventIsComplete(event)) return alert("This event is not final yet.");

  settlementSyncMessage = `Posting settlement for ${eventDisplayTitle(event)}…`;
  renderApp();
  try {
    const result = await requestDedicatedEventSettlement(event);
    const summary = result?.settlement || {};
    const unresolved = Array.isArray(summary.unresolved) ? summary.unresolved : [];
    if (unresolved.length) {
      settlementSyncMessage = `Settlement needs repair: ${unresolved.map(item => item.issue).filter(Boolean).join(" | ")}`;
      renderApp();
      return alert(settlementSyncMessage);
    }
    settlementSyncMessage = `Settlement completed for ${eventDisplayTitle(event)}. Ledger/profile/leaderboard updates are syncing now.`;
    renderApp();
    return alert(settlementSyncMessage);
  } catch (serverError) {
    try {
      const changed = await settleEvent(event.firestoreId || event.id);
      if (!changed) throw serverError;
    } catch (fallbackError) {
      settlementSyncMessage = `Settlement failed: ${fallbackError?.message || serverError?.message || String(fallbackError)}`;
      renderApp();
      alert(settlementSyncMessage);
    }
  }
}



function normalizedRepairPick(value, eventType) {
  const pick = String(value || "").trim().toLowerCase();
  if (eventType === EVENT_TYPES.TEAM) return ["away", "home"].includes(pick) ? pick : "";
  if (eventType === EVENT_TYPES.FIGHT_CARD) {
    if (pick === "fightera") return "fighterA";
    if (pick === "fighterb") return "fighterB";
  }
  return "";
}

function repairFightForEvent(event, rawFightId) {
  const needle = String(rawFightId || "").trim();
  if (!needle) return null;
  return (event.fights || []).find(fight =>
    String(fight.id || "") === needle
    || String(fight.order || "") === needle
    || String(fight.label || "") === needle
  ) || null;
}

function reusableRepairBet(event, userId, fightId = "") {
  const blocked = new Set(["settled", "void", "cancelled", "expired"]);
  return Object.values(state.bets || {})
    .filter(bet => recordMatchesEvent(bet, event))
    .filter(bet => String(bet.userId || "") === String(userId || ""))
    .filter(bet => event.type !== EVENT_TYPES.FIGHT_CARD || String(bet.fightId || "") === String(fightId || ""))
    .filter(bet => !blocked.has(String(bet.status || "")))
    .sort((a, b) => toDateValue(b.updatedAt || b.createdAt) - toDateValue(a.updatedAt || a.createdAt))[0] || null;
}

async function repairMatchupDirectlyInBrowser({ eventId, userA, userB, pickA, pickB, amount, fightId }) {
  if (!isAdmin()) throw new Error("Admin access is required for direct matchup repair.");

  const event = findEventByIdOrCode(String(eventId || "").trim().toUpperCase());
  if (!event) throw new Error("Event not found. Check the internal event ID or display code.");
  if (![EVENT_TYPES.TEAM, EVENT_TYPES.FIGHT_CARD].includes(event.type)) {
    throw new Error("Matchup repair currently supports team games and UFC fights.");
  }

  let canonicalFightId = "";
  if (event.type === EVENT_TYPES.FIGHT_CARD) {
    const fight = repairFightForEvent(event, fightId);
    if (!fight) throw new Error("Enter a valid UFC fight number or fight ID.");
    canonicalFightId = String(fight.id || "");
  }

  const sideA = normalizedRepairPick(pickA, event.type);
  const sideB = normalizedRepairPick(pickB, event.type);
  if (!sideA || !sideB) {
    throw new Error(event.type === EVENT_TYPES.TEAM
      ? "Team picks must be away and home."
      : "UFC picks must be fighterA and fighterB.");
  }
  if (sideA === sideB) throw new Error("The two users must have opposite picks.");

  const betA = reusableRepairBet(event, userA, canonicalFightId);
  const betB = reusableRepairBet(event, userB, canonicalFightId);
  const eventDocId = event.firestoreId || event.id;
  if (!eventDocId) throw new Error("The event is missing a Firestore document ID.");

  // Reuse an existing bet when possible. If one side never created a bet, an
  // approved admin can create the missing record directly under the v10.70
  // Firestore rules; older rules will reject this and trigger the server fallback.
  const betARef = betA
    ? doc(db, "bets", betA.firestoreId || betA.id)
    : doc(collection(db, "bets"));
  const betBRef = betB
    ? doc(db, "bets", betB.firestoreId || betB.id)
    : doc(collection(db, "bets"));
  const betAId = betARef.id;
  const betBId = betBRef.id;

  const conflicts = Object.values(state.matches || {}).filter(match => {
    if (!recordMatchesEvent(match, event)) return false;
    if (["settled", "void", "cancelled"].includes(String(match.status || ""))) return false;
    if (event.type === EVENT_TYPES.FIGHT_CARD && String(match.fightId || "") !== canonicalFightId) return false;
    return [match.userA, match.userB].some(id => String(id || "") === String(userA) || String(id || "") === String(userB));
  });

  const batch = writeBatch(db);
  const selectedBetIds = new Set([String(betAId), String(betBId)]);
  const displacedBetIds = new Set();

  for (const match of conflicts) {
    if (match.betA) displacedBetIds.add(String(match.betA));
    if (match.betB) displacedBetIds.add(String(match.betB));
    const matchId = match.firestoreId || match.id;
    if (matchId) batch.delete(doc(db, "matches", matchId));
  }

  for (const displacedId of displacedBetIds) {
    if (selectedBetIds.has(displacedId)) continue;
    const displaced = state.bets[displacedId] || Object.values(state.bets || {}).find(bet => String(bet.firestoreId || bet.id) === displacedId);
    if (!displaced) continue;
    const displacedDocId = displaced.firestoreId || displaced.id;
    if (displacedDocId) batch.set(doc(db, "bets", displacedDocId), { status: "open", updatedAt: serverTimestamp() }, { merge: true });
  }

  const sharedBetPatch = {
    eventId: eventDocId,
    amount,
    fightId: canonicalFightId,
    status: "matched",
    adminRepaired: true,
    repairedBy: authUser?.uid || state.currentUserId || "admin",
    doubleUp: { requestedBy: [], applied: false, originalAmount: amount },
    updatedAt: serverTimestamp()
  };

  batch.set(betARef, {
    id: betAId,
    type: event.type,
    userId: userA,
    ...sharedBetPatch,
    side: sideA,
    createdAt: betA?.createdAt || serverTimestamp()
  }, { merge: true });
  batch.set(betBRef, {
    id: betBId,
    type: event.type,
    userId: userB,
    ...sharedBetPatch,
    side: sideB,
    createdAt: betB?.createdAt || serverTimestamp()
  }, { merge: true });

  const matchRef = doc(collection(db, "matches"));
  batch.set(matchRef, {
    id: matchRef.id,
    type: event.type,
    eventId: eventDocId,
    fightId: canonicalFightId,
    betA: betAId,
    betB: betBId,
    userA,
    userB,
    sideA,
    sideB,
    amount,
    doubleUp: { requestedBy: [], applied: false, originalAmount: amount },
    status: "matched",
    adminRepaired: true,
    repairedBy: authUser?.uid || state.currentUserId || "admin",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await batch.commit();
  return {
    ok: true,
    message: `Match repaired directly in Firestore. Removed ${conflicts.length} conflicting match${conflicts.length === 1 ? "" : "es"}, ${betA && betB ? "reused both bets" : "created the missing bet record"}, and created the intended match.`
  };
}

async function repairAdminMatchup() {
  if (repairMatchupRunning) return;

  const statusNode = document.querySelector("#repairMatchupStatus");
  const button = document.querySelector("[data-action='repair-matchup']");
  const setStatus = (message, type = "") => {
    repairMatchupMessage = message;
    repairMatchupMessageType = type;
    if (statusNode) {
      statusNode.textContent = message;
      statusNode.className = `repair-matchup-status ${type}`.trim();
    }
  };

  if (!isAdmin()) {
    setStatus("Your account is not currently authorized as an admin. Refresh your sign-in or unlock Admin again.", "error");
    return;
  }

  const eventId = document.querySelector("#repairEventId")?.value.trim();
  const userA = document.querySelector("#repairUserA")?.value;
  const userB = document.querySelector("#repairUserB")?.value;
  const pickA = document.querySelector("#repairPickA")?.value.trim();
  const pickB = document.querySelector("#repairPickB")?.value.trim();
  const amount = Number(document.querySelector("#repairAmount")?.value);
  const fightId = document.querySelector("#repairFightId")?.value.trim();

  if (!eventId) return setStatus("Enter an event ID or display code.", "error");
  if (!userA || !userB || userA === userB) return setStatus("Choose two different users.", "error");
  if (!pickA || !pickB) return setStatus("Enter both users’ picks.", "error");
  if (!Number.isFinite(amount) || amount <= 0) return setStatus("Enter a valid amount greater than zero.", "error");
  if (!authUser) return setStatus("Your sign-in session is missing. Sign out and back in, then retry.", "error");

  repairMatchupRunning = true;
  if (button) {
    button.disabled = true;
    button.textContent = "Repairing match…";
  }
  setStatus("Checking the event and writing the repaired matchup…", "working");

  try {
    const requestBody = { eventId, userA, userB, pickA, pickB, amount, fightId };

    try {
      const direct = await repairMatchupDirectlyInBrowser(requestBody);
      setStatus(direct.message || "Match repaired successfully.", "success");
      return;
    } catch (directError) {
      const canUseServerFallback = directError?.needsServer || directError?.code === "permission-denied";
      if (!canUseServerFallback) throw directError;
      setStatus(`${directError.message} Trying secure server repair…`, "working");
    }

    const token = await authUser.getIdToken(true);
    const response = await fetch("/api/repair-matchup", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache"
      },
      body: JSON.stringify(requestBody)
    });

    const rawBody = await response.text();
    let payload = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const serverDetail = payload.error
        || payload.message
        || rawBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 280)
        || "The server returned no diagnostic body.";
      const stage = payload.stage ? ` Stage: ${payload.stage}.` : "";
      throw new Error(`Secure repair failed (${response.status}). ${serverDetail}${stage}`);
    }

    setStatus(payload.message || "Match repaired successfully.", "success");
  } catch (error) {
    console.error("Matchup repair failed", error);
    setStatus(error.message || "Matchup repair failed. Check the browser console and try again.", "error");
  } finally {
    repairMatchupRunning = false;
    if (button) {
      button.disabled = false;
      button.textContent = "Repair/create match";
    }
  }
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
