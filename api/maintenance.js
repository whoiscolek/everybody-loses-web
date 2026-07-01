import { getAdminServices } from "./_admin.js";
import {
  EVENT_TYPES,
  eventIdentityValues,
  hasScore,
  normalizeTeamToken,
  recordBelongs,
  sanitizeId,
  ufcFightHasResult
} from "./_event-utils.js";
import { bearerToken, requestQuery, sendJson as json } from "./_http.js";
import { settleFinalEvents } from "./_settlement.js";
import { APP_VERSION, USER_AGENT } from "./_version.js";
import { UFC_EXPECTED_MAIN_CARD_COUNTS } from "../shared/ufc-repairs.js";

export const maxDuration = 60;

const DISPLAY_TIME_ZONE = "America/New_York";
const SUPPORTED_LEAGUES = [
  "NBA", "NFL", "MLB", "NHL", "NCAA Basketball", "NCAA Football",
  "Premier League", "MLS", "Champions League", "World Cup",
  "F1", "NASCAR", "IndyCar", "MotoGP", "UFC"
];
const LEASE_MS = 75 * 1000;
const NOW_LOOKAHEAD_MS = 48 * 60 * 60 * 1000;
const PREGAME_LOOKBACK_MS = 4 * 60 * 60 * 1000;
const ORPHAN_OPEN_BET_GRACE_MS = 36 * 60 * 60 * 1000;
const MAINTENANCE_VERSION = APP_VERSION;

export function cleanForFirestore(value) {
  if (Array.isArray(value)) return value.map(cleanForFirestore).filter(item => item !== undefined);
  if (value && typeof value === "object") {
    if (value instanceof Date || typeof value.toDate === "function") return value;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return value;
    const out = {};
    for (const [key, inner] of Object.entries(value)) {
      const next = cleanForFirestore(inner);
      if (next !== undefined) out[key] = next;
    }
    return out;
  }
  return value === undefined ? undefined : value;
}

function dateMs(value) {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return new Date(value).getTime() || 0;
  if (value?.toDate) return value.toDate().getTime() || 0;
  if (value?.seconds) return value.seconds * 1000;
  return 0;
}

function dateISOInZone(value = new Date()) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

function datesForNowWindow(now = Date.now()) {
  const dates = new Set();
  const start = new Date(now - 18 * 60 * 60 * 1000);
  const end = new Date(now + NOW_LOOKAHEAD_MS);
  const startISO = dateISOInZone(start);
  const endISO = dateISOInZone(end);
  const cursor = new Date(`${startISO}T12:00:00Z`);
  const last = new Date(`${endISO}T12:00:00Z`);
  while (cursor <= last) {
    dates.add(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return [...dates].sort();
}

function dateForEvent(event) {
  return dateISOInZone(event?.startTime || Date.now());
}

function addAdjacentDate(set, iso, offset) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  set.add(d.toISOString().slice(0, 10));
}

function statusRank(status) {
  if (status === "final") return 3;
  if (status === "live") return 2;
  return 1;
}

function protectedStatus(existing, incoming) {
  const current = String(existing?.status || "pregame");
  const next = String(incoming?.status || "pregame");
  return statusRank(current) > statusRank(next) ? current : next;
}

function placeholderOdds(value) {
  return !value || /^(unavailable|api schedule import|odds unavailable|live odds unavailable|espn odds pending|odds pending)$/i.test(String(value).trim());
}

function normalizeTitle(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function teamAliases(team = {}) {
  return [...new Set([
    team.code,
    team.name,
    team.displayName,
    team.shortDisplayName,
    team.location
  ].map(normalizeTeamToken).filter(Boolean))];
}

function teamIdentityKeys(event = {}) {
  if (event.type !== EVENT_TYPES.TEAM) return [];
  const league = normalizeTeamToken(event.league);
  const day = dateForEvent(event);
  const away = teamAliases(event.away);
  const home = teamAliases(event.home);
  const keys = [];
  for (const awayKey of away) {
    for (const homeKey of home) keys.push(`${league}|${day}|${awayKey}|${homeKey}`);
  }
  return [...new Set(keys)];
}

function teamEventsLookSame(saved = {}, incoming = {}) {
  if (saved.type !== EVENT_TYPES.TEAM || incoming.type !== EVENT_TYPES.TEAM) return false;
  if (normalizeTeamToken(saved.league) !== normalizeTeamToken(incoming.league)) return false;

  const savedStart = dateMs(saved.startTime);
  const incomingStart = dateMs(incoming.startTime);
  const startsClose = savedStart && incomingStart && Math.abs(savedStart - incomingStart) <= 12 * 60 * 60 * 1000;
  const sameDay = dateForEvent(saved) === dateForEvent(incoming);
  if (!startsClose && !sameDay) return false;

  const intersects = (left, right) => left.some(value => right.includes(value));
  return intersects(teamAliases(saved.away), teamAliases(incoming.away))
    && intersects(teamAliases(saved.home), teamAliases(incoming.home));
}

function canonicalKey(event = {}) {
  const league = String(event.league || "").toLowerCase();
  const type = String(event.type || "");
  const sourceId = event.externalIds?.mlbGamePk
    || event.externalIds?.espnEventId
    || event.apiEventId
    || event.externalIds?.apiEventId
    || event.externalIds?.eventId
    || "";
  if (sourceId) return `${league}|${type}|source|${sourceId}`;

  const day = dateForEvent(event);
  if (type === EVENT_TYPES.TEAM) {
    return `${league}|${type}|${day}|${String(event.away?.code || "away").toLowerCase()}|${String(event.home?.code || "home").toLowerCase()}`;
  }
  return `${league}|${type}|${day}|${normalizeTitle(event.title)}`;
}

function deterministicEventId(event) {
  const sourceId = event.externalIds?.mlbGamePk
    || event.externalIds?.espnEventId
    || event.apiEventId
    || event.externalIds?.apiEventId
    || canonicalKey(event);
  return sanitizeId(`${event.league || "event"}-${sourceId}`);
}

function boardStateFor(event, now = Date.now()) {
  if (event.status === "final") return "history";
  const start = dateMs(event.startTime);
  if (event.status === "live") {
    if (start && now - start > staleThresholdMs(event)) return "archived";
    return "now";
  }
  if (!start) return "archived";
  if (start >= now - PREGAME_LOOKBACK_MS && start <= now + NOW_LOOKAHEAD_MS) return "now";
  return "archived";
}

function staleThresholdMs(event) {
  if (event.type === EVENT_TYPES.FIGHT_CARD || event.type === EVENT_TYPES.RANKED) return 14 * 60 * 60 * 1000;
  if (event.league === "MLB") return 10 * 60 * 60 * 1000;
  return 8 * 60 * 60 * 1000;
}

async function authorizeMaintenanceRequest(req, services) {
  const token = bearerToken(req);
  const secret = process.env.MAINTENANCE_SECRET || process.env.CRON_SECRET || "";
  if (secret && token === secret) return { kind: "scheduler" };
  if (!token) return null;

  try {
    const decoded = await services.auth.verifyIdToken(token);
    const profileSnap = await services.db.collection("users").doc(decoded.uid).get();
    const profile = profileSnap.exists ? profileSnap.data() : {};
    if (profile.approved === true && profile.isAdmin === true) {
      return { kind: "admin", uid: decoded.uid };
    }
  } catch {
    // Invalid or expired Firebase token.
  }
  return null;
}

function scopedDiscoveryDate(req) {
  const query = requestQuery(req);
  const explicit = String(query.date || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;
  if (/^\d{8}$/.test(explicit)) return `${explicit.slice(0, 4)}-${explicit.slice(4, 6)}-${explicit.slice(6, 8)}`;

  const offset = Math.max(-1, Math.min(3, Number.parseInt(String(query.offset ?? "0"), 10) || 0));
  const base = new Date(`${dateISOInZone()}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + offset);
  return base.toISOString().slice(0, 10);
}

function inferOrigin(req) {
  // Always call the API on the same deployment that invoked maintenance. An old
  // or mistyped APP_URL previously sent refreshes to a different Vercel domain,
  // leaving live/final events stale even though maintenance itself was running.
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim() || "https";
  if (host) return `${proto}://${host}`;

  const configured = String(process.env.APP_URL || "").replace(/\/$/, "");
  if (configured) return configured.startsWith("http") ? configured : `https://${configured}`;
  throw new Error("Could not determine the deployment origin for source refreshes.");
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = await mapper(items[index], index);
      } catch (error) {
        results[index] = { error: error?.message || String(error), item: items[index] };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, worker));
  return results;
}

async function fetchSource(origin, league, dateISO) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22000);
  try {
    const url = `${origin}/api/espn-events?league=${encodeURIComponent(league)}&date=${dateISO.replace(/-/g, "")}&fresh=${Date.now()}`;
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent": USER_AGENT,
        "Cache-Control": "no-cache, no-store, max-age=0",
        Pragma: "no-cache"
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `${league} ${dateISO} source returned ${response.status}`);
    return { league, dateISO, events: Array.isArray(data.events) ? data.events : [], source: data.source || "unknown", note: data.note || "" };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTargetedUfcSource(origin, eventId, dateISO) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22000);
  try {
    const url = `${origin}/api/espn-events?league=UFC&eventId=${encodeURIComponent(eventId)}&date=${dateISO.replace(/-/g, "")}&fresh=${Date.now()}`;
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent": USER_AGENT,
        "Cache-Control": "no-cache, no-store, max-age=0",
        Pragma: "no-cache"
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `UFC event ${eventId} source returned ${response.status}`);
    return { league: "UFC", dateISO, events: Array.isArray(data.events) ? data.events : [], source: data.source || "espn-ufc-direct", note: data.note || "", targetedEventId: eventId };
  } finally {
    clearTimeout(timer);
  }
}

function chooseExisting(candidates, refsByEventId) {
  const referenceCount = event => eventIdentityValues(event).reduce((sum, id) => sum + (refsByEventId.get(id) || 0), 0);
  return [...candidates].sort((a, b) => {
    const refDiff = referenceCount(b) - referenceCount(a);
    if (refDiff) return refDiff;
    return dateMs(b.updatedAt || b.createdAt) - dateMs(a.updatedAt || a.createdAt);
  })[0] || null;
}

function normalizedFightIdentityPart(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function fightIdentityKey(fight = {}) {
  const names = [normalizedFightIdentityPart(fight.fighterA), normalizedFightIdentityPart(fight.fighterB)]
    .filter(Boolean)
    .sort();
  return names.length === 2 ? names.join("::") : "";
}

export function mergeUfcFights(existingFights = [], incomingFights = []) {
  const existing = Array.isArray(existingFights) ? existingFights.filter(Boolean) : [];
  const incoming = Array.isArray(incomingFights) ? incomingFights.filter(Boolean) : [];
  if (!incoming.length) return existing;

  const existingById = new Map(existing.map(fight => [String(fight.id || ""), fight]).filter(([id]) => id));
  const existingByPair = new Map(existing.map(fight => [fightIdentityKey(fight), fight]).filter(([key]) => key));
  const used = new Set();
  const merged = incoming.map((fight, index) => {
    const prior = existingById.get(String(fight.id || "")) || existingByPair.get(fightIdentityKey(fight)) || null;
    if (prior?.id) used.add(String(prior.id));
    return { ...(prior || {}), ...fight, id: prior?.id || fight.id, order: index + 1 };
  });

  for (const fight of existing) {
    if (fight?.id && used.has(String(fight.id))) continue;
    const pair = fightIdentityKey(fight);
    if (pair && merged.some(item => fightIdentityKey(item) === pair)) continue;
    merged.push({ ...fight, order: merged.length + 1 });
  }
  return merged;
}

function mergeIncoming(existing, incoming, nowIso) {
  const status = protectedStatus(existing, incoming);
  const incomingScore = hasScore(incoming.score) ? incoming.score : null;
  const score = incomingScore || (hasScore(existing?.score) ? existing.score : null);
  const incomingOdds = incoming.odds;
  const odds = placeholderOdds(incomingOdds) && !placeholderOdds(existing?.odds) ? existing.odds : incomingOdds || existing?.odds || "Unavailable";
  const mergedFights = incoming?.type === EVENT_TYPES.FIGHT_CARD || existing?.type === EVENT_TYPES.FIGHT_CARD
    ? mergeUfcFights(existing?.fights || [], incoming?.fights || [])
    : (incoming?.fights || existing?.fights || []);
  const mergedFightResults = {
    ...(existing?.fightResults || {}),
    ...(incoming?.fightResults || {}),
    ...Object.fromEntries(mergedFights.filter(fight => fight?.id && fight?.winner).map(fight => [fight.id, fight.winner]))
  };
  const merged = {
    ...existing,
    ...incoming,
    status,
    fights: mergedFights,
    fightResults: mergedFightResults,
    score,
    odds,
    liveStats: Array.isArray(incoming.liveStats) && incoming.liveStats.length ? incoming.liveStats : (existing?.liveStats || []),
    leaderboard: Array.isArray(incoming.leaderboard) && incoming.leaderboard.length ? incoming.leaderboard : (existing?.leaderboard || []),
    participants: Array.isArray(incoming.participants) && incoming.participants.length ? incoming.participants : (existing?.participants || []),
    resultOrder: Array.isArray(incoming.resultOrder) && incoming.resultOrder.length ? incoming.resultOrder : (status === "final" ? (existing?.resultOrder || []) : []),
    weather: incoming.weather || existing?.weather || null,
    weatherText: incoming.weatherText || existing?.weatherText || "",
    liveContext: incoming.liveContext || (status === "final" ? "Final" : existing?.liveContext || ""),
    gameContext: incoming.gameContext || existing?.gameContext || "",
    externalIds: { ...(existing?.externalIds || {}), ...(incoming.externalIds || {}) },
    boardState: boardStateFor({ ...existing, ...incoming, status }, Date.now()),
    hiddenFromNow: status === "final" ? true : boardStateFor({ ...existing, ...incoming, status }, Date.now()) !== "now",
    staleReason: "",
    sourceMissCount: 0,
    lastVerifiedAt: nowIso,
    sourceUpdatedAt: nowIso,
    maintenanceVersion: MAINTENANCE_VERSION
  };
  delete merged.apiSource;
  delete merged.apiEventId;
  delete merged.firestoreId;
  return cleanForFirestore(merged);
}

function ufcRepairEventId(event = {}) {
  const candidates = [
    event?.externalIds?.espnFightCenterEventId,
    event?.externalIds?.espnEventId,
    event?.externalIds?.ufcOverrideEventId,
    event?.apiEventId,
    event?.id,
    event?.firestoreId
  ].map(value => String(value || ""));
  const direct = candidates.find(value => UFC_EXPECTED_MAIN_CARD_COUNTS[value]);
  if (direct) return direct;
  if (/ufc\s+freedom\s+250/i.test(String(event?.title || ""))) return "600058854";
  return "";
}

function ufcCardNeedsRepair(event = {}) {
  if (event?.type !== EVENT_TYPES.FIGHT_CARD && event?.league !== "UFC") return false;
  const eventId = ufcRepairEventId(event);
  const expected = UFC_EXPECTED_MAIN_CARD_COUNTS[eventId] || 0;
  return Boolean(expected && (event.fights || []).length < expected);
}

function ufcNeedsTargetedRefresh(event = {}, matches = []) {
  if (event?.type !== EVENT_TYPES.FIGHT_CARD && event?.league !== "UFC") return false;
  if (!ufcRepairEventId(event)) return false;

  const hasUnresolvedFight = (event.fights || []).some(fight => {
    const status = String(fight?.status || "").toLowerCase();
    return !ufcFightHasResult(event, fight)
      && !["final", "complete", "completed", "closed", "settled", "cancelled", "canceled"].includes(status);
  });
  const hasUnsettledMatch = matches.some(match =>
    recordBelongs(match, event)
    && !["settled", "void", "cancelled"].includes(String(match.status || "").toLowerCase())
  );
  const start = dateMs(event.startTime);
  const recent = Boolean(start && Date.now() - start < 48 * 60 * 60 * 1000);

  return ufcCardNeedsRepair(event)
    || event.status === "live"
    || (recent && hasUnresolvedFight)
    || (hasUnsettledMatch && hasUnresolvedFight);
}

function buildFetchPlan(events, matches, fullDiscovery) {
  const plan = new Map();
  const add = (league, dateISO) => {
    if (!SUPPORTED_LEAGUES.includes(league) || !dateISO) return;
    plan.set(`${league}|${dateISO}`, { league, dateISO });
  };

  const unsettledEventIds = new Set(matches.filter(m => !["settled", "void", "cancelled"].includes(m.status)).map(m => String(m.eventId || "")));
  for (const event of events) {
    const ids = eventIdentityValues(event);
    const hasUnsettled = ids.some(id => unsettledEventIds.has(id));
    const start = dateMs(event.startTime);
    const relevant = hasUnsettled || ufcCardNeedsRepair(event) || (event.status !== "final" && (
      event.status === "live" || !start || start >= Date.now() - 36 * 60 * 60 * 1000
    ));
    if (!relevant) continue;
    const dateISO = dateForEvent(event);
    add(event.league, dateISO);
    if (event.status === "live" || hasUnsettled) {
      const set = new Set([dateISO]);
      addAdjacentDate(set, dateISO, -1);
      addAdjacentDate(set, dateISO, 1);
      for (const date of set) add(event.league, date);
    }
  }

  if (fullDiscovery) {
    for (const dateISO of datesForNowWindow()) {
      for (const league of SUPPORTED_LEAGUES) add(league, dateISO);
    }
  }

  return [...plan.values()];
}

async function acquireLease(db, FieldValue, requestedMode) {
  const ref = db.collection("system").doc("maintenance");
  const now = Date.now();
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const leaseUntil = dateMs(data.leaseUntil);
    if (leaseUntil > now) return { acquired: false, state: data };
    tx.set(ref, {
      running: true,
      requestedMode,
      leaseUntil: new Date(now + LEASE_MS),
      startedAt: FieldValue.serverTimestamp(),
      lastAttemptAt: FieldValue.serverTimestamp(),
      lastAttemptMode: requestedMode,
      lastAttemptVersion: MAINTENANCE_VERSION,
      maintenanceVersion: MAINTENANCE_VERSION
    }, { merge: true });
    return { acquired: true, state: data };
  });
}


function teamNameForSnapshot(event = {}, side) {
  const team = event[side] || {};
  return team.name || team.displayName || team.shortDisplayName || team.code || team.abbreviation || (side === "away" ? "Away" : "Home");
}

function eventTitleForSnapshot(event = {}, eventId = "") {
  if (event.type === EVENT_TYPES.TEAM || (event.away && event.home)) {
    const separator = event.sport === "soccer" ? "vs" : "at";
    return `${teamNameForSnapshot(event, "away")} ${separator} ${teamNameForSnapshot(event, "home")}`;
  }
  return event.title || event.shortCode || event.id || eventId || "Unknown event";
}

function eventSnapshotForLedger(event = {}, eventId = "") {
  const id = event.firestoreId || event.id || eventId || "";
  return {
    id,
    firestoreId: event.firestoreId || "",
    eventId: id,
    shortCode: event.shortCode || "",
    title: eventTitleForSnapshot(event, id),
    sport: event.sport || "",
    league: event.league || "",
    type: event.type || "",
    startTime: event.startTime || "",
    away: event.away ? { name: event.away.name || event.away.displayName || "", code: event.away.code || event.away.abbreviation || "" } : null,
    home: event.home ? { name: event.home.name || event.home.displayName || "", code: event.home.code || event.home.abbreviation || "" } : null,
    externalIds: event.externalIds || null
  };
}


function linkedEventForRecord(events, record) {
  return events.find(event => recordBelongs(record, event)) || null;
}

function closedBetStatus(status) {
  return ["settled", "expired", "void", "voided", "cancelled", "canceled"].includes(String(status || "").toLowerCase());
}

function openBetIsStale(event, bet, now = Date.now()) {
  if (event) {
    if (event.status === "final") return true;
    if (event.hiddenFromNow || ["archived", "history"].includes(String(event.boardState || "").toLowerCase())) return true;
    const start = dateMs(event.startTime);
    return Boolean(start && now - start > staleThresholdMs(event));
  }

  const lastSeen = dateMs(bet?.createdAt) || dateMs(bet?.updatedAt);
  return !lastSeen || now - lastSeen > ORPHAN_OPEN_BET_GRACE_MS;
}

export async function expireStaleOpenBets(db, FieldValue, events, bets, now = Date.now()) {
  const stale = bets.filter(bet => {
    const betId = bet.firestoreId || bet.id;
    if (!betId || closedBetStatus(bet.status)) return false;
    if (String(bet.status || "open").toLowerCase() === "matched") return false;
    return openBetIsStale(linkedEventForRecord(events, bet), bet, now);
  });

  if (!stale.length) return 0;
  const batch = db.batch();
  for (const bet of stale) {
    batch.set(db.collection("bets").doc(bet.firestoreId || bet.id), {
      status: "expired",
      staleReason: "Expired by maintenance because the linked event is final, archived, stale, or no longer available.",
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
  await batch.commit();
  return stale.length;
}

function ledgerEntryHasSettledFlag(entry = {}) {
  const status = String(entry.status || "").toLowerCase();
  return entry.settled === true
    || entry.settled === "true"
    || status === "settled"
    || Boolean(entry.settlementId);
}

function usersMatchSettlement(entry = {}, settlement = {}) {
  return (entry.fromUser === settlement.fromUser && entry.toUser === settlement.toUser)
    || (entry.fromUser === settlement.toUser && entry.toUser === settlement.fromUser);
}

function settlementCoversLedgerEntry(entry = {}, settlement = {}) {
  if (!usersMatchSettlement(entry, settlement)) return false;
  const settlementTime = dateMs(settlement.createdAt) || dateMs(settlement.updatedAt) || dateMs(settlement.settledAt);
  if (!settlementTime) return false;
  const entryTime = dateMs(entry.createdAt) || dateMs(entry.updatedAt);
  return !entryTime || entryTime <= settlementTime + 2000;
}

export async function reconcileSettledLedgerRows(db, FieldValue, ledgerEntries = [], settlements = []) {
  const repairs = [];
  for (const entry of ledgerEntries) {
    const id = entry.firestoreId || entry.id;
    if (!id || ledgerEntryHasSettledFlag(entry)) continue;
    const covering = settlements
      .filter(settlement => settlementCoversLedgerEntry(entry, settlement))
      .sort((a, b) => (dateMs(b.createdAt) || dateMs(b.updatedAt) || 0) - (dateMs(a.createdAt) || dateMs(a.updatedAt) || 0))[0];
    if (!covering) continue;
    repairs.push({ entry, settlement: covering });
  }

  if (!repairs.length) return 0;
  let repaired = 0;
  for (let i = 0; i < repairs.length; i += 450) {
    const batch = db.batch();
    for (const { entry, settlement } of repairs.slice(i, i + 450)) {
      batch.set(db.collection("ledgerEntries").doc(entry.firestoreId || entry.id), {
        settled: true,
        settlementId: settlement.firestoreId || settlement.id || entry.settlementId || null,
        settledAt: settlement.createdAt || settlement.updatedAt || FieldValue.serverTimestamp(),
        settlementRepairReason: "Reconciled by maintenance because an existing settle-up covered this older open ledger row.",
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      repaired += 1;
    }
    await batch.commit();
  }
  return repaired;
}

export async function cleanupHistory(db, FieldValue, events, bets, matches, ledgerEntries = []) {
  const retentionDays = Number(process.env.HISTORY_RETENTION_DAYS || 0);
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return 0;
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
  const old = events.filter(event => event.status === "final" && Date.now() - dateMs(event.startTime) > retentionMs);
  let removed = 0;
  for (const event of old) {
    const eventId = event.firestoreId || event.id;
    const eventMatches = matches.filter(m => recordBelongs(m, event));
    if (eventMatches.some(m => !["settled", "void", "cancelled"].includes(m.status))) continue;
    const batch = db.batch();
    for (const entry of ledgerEntries.filter(row => recordBelongs(row, event))) {
      const id = entry.firestoreId || entry.id;
      if (id) {
        batch.set(db.collection("ledgerEntries").doc(id), {
          eventTitle: eventTitleForSnapshot(event, eventId),
          eventSport: event.sport || "",
          eventLeague: event.league || "",
          eventShortCode: event.shortCode || "",
          eventSnapshot: eventSnapshotForLedger(event, eventId),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }
    }
    for (const bet of bets.filter(b => recordBelongs(b, event))) {
      const id = bet.firestoreId || bet.id;
      if (id) batch.delete(db.collection("bets").doc(id));
    }
    for (const match of eventMatches) {
      const id = match.firestoreId || match.id;
      if (id) batch.delete(db.collection("matches").doc(id));
    }
    batch.delete(db.collection("events").doc(eventId));
    await batch.commit();
    removed += 1;
  }
  return removed;
}

function mergeSettlementSummaries(...items) {
  const out = { events: 0, matches: 0, ledgerWrites: 0, betsClosed: 0, tiesVoided: 0, deferred: 0, repairedLegacyMatches: 0, unresolved: [] };
  const unresolvedSeen = new Set();
  for (const item of items.filter(Boolean)) {
    for (const key of ["events", "matches", "ledgerWrites", "betsClosed", "tiesVoided", "deferred", "repairedLegacyMatches"]) {
      out[key] += Number(item[key] || 0);
    }
    for (const issue of item.unresolved || []) {
      const key = `${issue.eventId || ""}|${issue.matchId || ""}|${issue.issue || ""}`;
      if (unresolvedSeen.has(key)) continue;
      unresolvedSeen.add(key);
      out.unresolved.push(issue);
    }
  }
  return out;
}

async function runMaintenance(req, mode, services = null) {
  const resolvedServices = services || await getAdminServices();
  const { db, FieldValue } = resolvedServices;
  const lease = await acquireLease(db, FieldValue, mode);
  if (!lease.acquired) return { skipped: true, reason: "maintenance already running", state: lease.state || {} };

  const started = Date.now();
  const origin = mode === "settle" ? "" : inferOrigin(req);
  const errors = [];
  try {
    const [eventsSnap, betsSnap, matchesSnap, ledgerSnap, settlementsSnap] = await Promise.all([
      db.collection("events").get(),
      db.collection("bets").get(),
      db.collection("matches").get(),
      db.collection("ledgerEntries").get(),
      db.collection("settlements").get()
    ]);
    const toRows = snap => snap.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
    let events = toRows(eventsSnap);
    const bets = toRows(betsSnap);
    const matches = toRows(matchesSnap);
    const ledgerEntries = toRows(ledgerSnap);
    const settlements = toRows(settlementsSnap);

    // Settle already-final events before any network discovery. This guarantees
    // ledger work is not starved when a long source sweep approaches the
    // serverless time limit after scores have already been saved.
    const preSettlement = await settleFinalEvents(db, FieldValue, events, bets, matches, ledgerEntries);

    const discoveryDate = mode === "discover" ? scopedDiscoveryDate(req) : "";
    const fullDiscovery = mode === "discover";
    const plan = mode === "settle"
      ? []
      : mode === "discover"
        ? SUPPORTED_LEAGUES.map(league => ({ league, dateISO: discoveryDate }))
        : buildFetchPlan(events, matches, false);
    let sourceResults = await mapLimit(plan, 15, async item => fetchSource(origin, item.league, item.dateISO));

    const targetedUfcRepairs = mode === "settle"
      ? []
      : events
          .filter(event => ufcNeedsTargetedRefresh(event, matches))
          .map(event => ({
            eventId: ufcRepairEventId(event),
            dateISO: dateForEvent(event)
          }))
          .filter(item => item.eventId && item.dateISO);

    if (targetedUfcRepairs.length) {
      const directResults = await mapLimit(targetedUfcRepairs, 3, item => fetchTargetedUfcSource(origin, item.eventId, item.dateISO));
      sourceResults = [...sourceResults, ...directResults];
    }

    const refsByEventId = new Map();
    for (const record of [...bets, ...matches]) {
      const id = String(record.eventId || "");
      refsByEventId.set(id, (refsByEventId.get(id) || 0) + 1);
    }

    const byIdentity = new Map();
    const byCanonical = new Map();
    const byTeamIdentity = new Map();
    const indexEvent = event => {
      for (const id of eventIdentityValues(event)) {
        if (!byIdentity.has(id)) byIdentity.set(id, []);
        byIdentity.get(id).push(event);
      }
      const key = canonicalKey(event);
      if (!byCanonical.has(key)) byCanonical.set(key, []);
      byCanonical.get(key).push(event);
      for (const teamKey of teamIdentityKeys(event)) {
        if (!byTeamIdentity.has(teamKey)) byTeamIdentity.set(teamKey, []);
        byTeamIdentity.get(teamKey).push(event);
      }
    };
    events.forEach(indexEvent);

    const successfulKeys = new Set();
    const seenEventDocs = new Set();
    const sourceSummary = [];
    const writer = db.bulkWriter();
    let added = 0;
    let updated = 0;

    for (const result of sourceResults) {
      if (!result || result.error) {
        errors.push(result?.error || "unknown source error");
        continue;
      }
      successfulKeys.add(`${result.league}|${result.dateISO}`);
      sourceSummary.push({ league: result.league, date: result.dateISO, count: result.events.length, source: result.source });
      for (const incoming of result.events) {
        const identityCandidates = eventIdentityValues(incoming).flatMap(id => byIdentity.get(id) || []);
        const canonicalCandidates = byCanonical.get(canonicalKey(incoming)) || [];
        const teamKeyCandidates = teamIdentityKeys(incoming).flatMap(key => byTeamIdentity.get(key) || []);
        const nearbyTeamCandidates = incoming.type === EVENT_TYPES.TEAM
          ? events.filter(saved => teamEventsLookSame(saved, incoming))
          : [];
        const candidates = [...new Set([
          ...identityCandidates,
          ...canonicalCandidates,
          ...teamKeyCandidates,
          ...nearbyTeamCandidates
        ])];
        const existing = chooseExisting(candidates, refsByEventId);
        const docId = existing?.firestoreId || existing?.id || deterministicEventId(incoming);
        const nowIso = new Date().toISOString();
        const payload = mergeIncoming(existing || {}, incoming, nowIso);
        payload.id = existing?.id || docId;
        payload.shortCode = existing?.shortCode || incoming.shortCode || `${String(incoming.league || "EVT").replace(/[^A-Z0-9]/gi, "").slice(0, 4).toUpperCase()}-${dateForEvent(incoming).replace(/-/g, "").slice(4)}`;
        payload.updatedAt = FieldValue.serverTimestamp();
        if (!existing) payload.createdAt = FieldValue.serverTimestamp();
        writer.set(db.collection("events").doc(docId), payload, { merge: true });
        seenEventDocs.add(docId);
        const local = { ...existing, ...payload, firestoreId: docId, updatedAt: nowIso };
        if (existing) {
          const index = events.findIndex(e => (e.firestoreId || e.id) === docId);
          if (index >= 0) events[index] = local;
          updated += 1;
        } else {
          events.push(local);
          indexEvent(local);
          added += 1;
        }
      }
    }

    for (const event of events) {
      if (mode === "settle") break;
      if (event.status === "final") continue;
      const eventId = event.firestoreId || event.id;
      if (!eventId || seenEventDocs.has(eventId)) continue;
      const key = `${event.league}|${dateForEvent(event)}`;
      const start = dateMs(event.startTime);
      const tooOld = start && Date.now() - start > staleThresholdMs(event);
      const sourceChecked = successfulKeys.has(key);
      if (!tooOld && !sourceChecked) continue;
      const missCount = Number(event.sourceMissCount || 0) + (sourceChecked ? 1 : 0);
      const hide = tooOld && (sourceChecked || missCount >= 2);
      writer.set(db.collection("events").doc(eventId), {
        sourceMissCount: missCount,
        lastSourceMissAt: sourceChecked ? FieldValue.serverTimestamp() : (event.lastSourceMissAt || null),
        boardState: hide ? "archived" : (event.boardState || boardStateFor(event)),
        hiddenFromNow: hide || Boolean(event.hiddenFromNow),
        staleReason: hide ? "Event is past its maximum live window and the source did not verify it as active." : (event.staleReason || ""),
        maintenanceVersion: MAINTENANCE_VERSION,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      if (hide) {
        event.boardState = "archived";
        event.hiddenFromNow = true;
      }
    }

    await writer.close();

    // Reload financial records after the pre-pass so the second pass is
    // idempotent and sees any newly-final event written by the source refresh.
    const [freshBetsSnap, freshMatchesSnap, freshLedgerSnap] = await Promise.all([
      db.collection("bets").get(),
      db.collection("matches").get(),
      db.collection("ledgerEntries").get()
    ]);
    const freshBets = toRows(freshBetsSnap);
    const freshMatches = toRows(freshMatchesSnap);
    const freshLedger = toRows(freshLedgerSnap);
    const postSettlement = await settleFinalEvents(db, FieldValue, events, freshBets, freshMatches, freshLedger);
    const staleOpenBetsExpired = await expireStaleOpenBets(db, FieldValue, events, freshBets);
    const ledgerSettlementRepairs = await reconcileSettledLedgerRows(db, FieldValue, freshLedger, settlements);
    const settlement = mergeSettlementSummaries(preSettlement, postSettlement);
    const historyRemoved = await cleanupHistory(db, FieldValue, events, freshBets, freshMatches, freshLedger);
    const summary = {
      version: MAINTENANCE_VERSION,
      runtime: process.version,
      mode,
      fullDiscovery,
      durationMs: Date.now() - started,
      sourceRequests: sourceResults.length,
      sourceSuccesses: sourceResults.filter(r => r && !r.error).length,
      discoveryDate: discoveryDate || null,
      added,
      updated,
      archivedStale: events.filter(e => e.boardState === "archived" && e.status !== "final").length,
      settlement,
      staleOpenBetsExpired,
      ledgerSettlementRepairs,
      historyRemoved,
      errors: errors.slice(0, 20),
      sourceSummary: sourceSummary.slice(0, 100)
    };
    await db.collection("system").doc("maintenance").set({
      running: false,
      leaseUntil: new Date(0),
      lastRunAt: FieldValue.serverTimestamp(),
      lastSuccessAt: FieldValue.serverTimestamp(),
      lastAttemptAt: FieldValue.serverTimestamp(),
      lastAttemptMode: mode,
      lastAttemptVersion: MAINTENANCE_VERSION,
      ...(fullDiscovery ? { lastFullDiscoveryAt: FieldValue.serverTimestamp(), lastDiscoveryDate: discoveryDate } : {}),
      lastSummary: summary,
      ...(mode === "refresh" ? { lastRefreshSummary: summary } : {}),
      ...(mode === "discover" ? { lastDiscoverySummary: summary } : {}),
      ...(mode === "settle" ? { lastSettlementSummary: summary } : {}),
      lastError: errors.length ? errors.join(" | ").slice(0, 4000) : "",
      maintenanceVersion: MAINTENANCE_VERSION
    }, { merge: true });
    return summary;
  } catch (error) {
    await db.collection("system").doc("maintenance").set({
      running: false,
      leaseUntil: new Date(0),
      lastRunAt: FieldValue.serverTimestamp(),
      lastFailureAt: FieldValue.serverTimestamp(),
      lastAttemptAt: FieldValue.serverTimestamp(),
      lastAttemptMode: mode,
      lastAttemptVersion: MAINTENANCE_VERSION,
      lastError: error?.stack || error?.message || String(error),
      maintenanceVersion: MAINTENANCE_VERSION
    }, { merge: true }).catch(() => {});
    throw error;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (!["GET", "POST"].includes(req.method)) return json(res, 405, { error: "Method not allowed" });

  try {
    const query = requestQuery(req);
    const requestedMode = String(query.mode || "refresh").toLowerCase();
    const normalizedMode = requestedMode === "quick" || requestedMode === "auto" || requestedMode === "full"
      ? "refresh"
      : requestedMode;
    if (!["refresh", "discover", "settle"].includes(normalizedMode)) {
      return json(res, 400, { error: "Unsupported maintenance mode", mode: requestedMode });
    }

    const services = await getAdminServices();
    const authorization = await authorizeMaintenanceRequest(req, services);
    if (!authorization) return json(res, 401, { error: "Maintenance authorization required" });

    const result = await runMaintenance(req, normalizedMode, services);
    return json(res, result.skipped ? 202 : 200, { ...result, authorizedAs: authorization.kind });
  } catch (error) {
    return json(res, 500, {
      error: error?.message || String(error),
      code: error?.code || "MAINTENANCE_FAILED",
      runtime: process.version,
      version: MAINTENANCE_VERSION,
      stack: process.env.NODE_ENV === "development" ? error?.stack : undefined
    });
  }
}
