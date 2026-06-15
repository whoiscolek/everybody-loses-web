import { getAdminServices } from "./_admin.js";

export const maxDuration = 60;

const DISPLAY_TIME_ZONE = "America/New_York";
const SUPPORTED_LEAGUES = [
  "NBA", "NFL", "MLB", "NHL", "NCAA Basketball", "NCAA Football",
  "Premier League", "MLS", "Champions League", "World Cup",
  "F1", "NASCAR", "IndyCar", "MotoGP", "UFC"
];
const EVENT_TYPES = {
  TEAM: "TEAM_HEAD_TO_HEAD",
  RANKED: "RANKED_FINISH",
  FIGHT_CARD: "FIGHT_CARD"
};
const FULL_DISCOVERY_INTERVAL_MS = 15 * 60 * 1000;
const LEASE_MS = 75 * 1000;
const NOW_LOOKAHEAD_MS = 48 * 60 * 60 * 1000;
const PREGAME_LOOKBACK_MS = 4 * 60 * 60 * 1000;
const HISTORY_RETENTION_MS = 5 * 24 * 60 * 60 * 1000;
const MAINTENANCE_VERSION = "10.75";
const UFC_EXPECTED_MAIN_CARD_COUNTS = { "600058854": 7 };

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function clean(value) {
  if (Array.isArray(value)) return value.map(clean).filter(item => item !== undefined);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out = {};
    for (const [key, inner] of Object.entries(value)) {
      const next = clean(inner);
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

function hasScore(score) {
  return score && Number.isFinite(Number(score.away)) && Number.isFinite(Number(score.home));
}

function placeholderOdds(value) {
  return !value || /^(unavailable|api schedule import|odds unavailable|live odds unavailable|espn odds pending|odds pending)$/i.test(String(value).trim());
}

function eventIdentityValues(event = {}) {
  const ids = [
    event.firestoreId,
    event.id,
    event.apiEventId,
    event.externalIds?.espnEventId,
    event.externalIds?.mlbGamePk,
    event.externalIds?.apiEventId,
    event.externalIds?.eventId,
    event.externalIds?.f1Round,
    event.externalIds?.indyCarEventId,
    event.externalIds?.nascarEventId,
    event.externalIds?.motogpEventId
  ];
  return [...new Set(ids.map(v => String(v || "").trim()).filter(Boolean))];
}

function normalizeTitle(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeTeamToken(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
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

function sanitizeId(value) {
  return String(value || "event")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 140) || "event";
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

function effectiveAmount(match = {}, betA = null, betB = null) {
  const doubled = Boolean(match.doubleUp?.applied || match.doubledUp);
  const explicit = Number(match.doubleUpAmount || match.doubledAmount);
  if (doubled && Number.isFinite(explicit) && explicit > 0) return explicit;

  const candidates = [
    match.amount,
    match.exposure,
    match.matchedAmount,
    match.wagerAmount,
    match.stake,
    match.doubleUp?.originalAmount
  ].map(Number).filter(value => Number.isFinite(value) && value > 0);

  const betAmounts = [betA?.amount, betA?.exposure, betB?.amount, betB?.exposure]
    .map(Number)
    .filter(value => Number.isFinite(value) && value > 0);

  let amount = candidates[0] || (betAmounts.length ? Math.min(...betAmounts) : 0);
  if (doubled && !match.amount && !match.exposure && match.doubleUp?.originalAmount && !explicit) amount *= 2;
  return amount;
}

function teamSelectionAliases(team = {}) {
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
  ].map(normalizeTeamToken).filter(Boolean));
}

function normalizeTeamSide(value, event = {}) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (["home", "h", "host"].includes(raw)) return "home";
  if (["away", "a", "visitor", "road"].includes(raw)) return "away";

  const token = normalizeTeamToken(value);
  if (!token) return "";
  if (teamSelectionAliases(event.home).has(token)) return "home";
  if (teamSelectionAliases(event.away).has(token)) return "away";
  return "";
}

function matchBet(betsById, eventBets, match, slot) {
  const betId = String(slot === "A" ? (match.betA || match.bet1 || "") : (match.betB || match.bet2 || ""));
  if (betId && betsById.has(betId)) return betsById.get(betId);

  const userId = String(slot === "A"
    ? (match.userA || match.bettorA || match.playerA || "")
    : (match.userB || match.bettorB || match.playerB || ""));
  if (!userId) return null;
  return eventBets.find(bet => String(bet.userId || bet.user || bet.bettorId || "") === userId) || null;
}

function resolvedMatchFields(match, event, eventBets, betsById) {
  const betA = matchBet(betsById, eventBets, match, "A");
  const betB = matchBet(betsById, eventBets, match, "B");
  const sideA = normalizeTeamSide(
    match.sideA || match.pickA || match.selectionA || match.teamA || match.awayOrHomeA || betA?.side || betA?.pick || betA?.selection || betA?.team,
    event
  );
  const sideB = normalizeTeamSide(
    match.sideB || match.pickB || match.selectionB || match.teamB || match.awayOrHomeB || betB?.side || betB?.pick || betB?.selection || betB?.team,
    event
  );
  const userA = String(match.userA || match.bettorA || match.playerA || betA?.userId || betA?.user || betA?.bettorId || "");
  const userB = String(match.userB || match.bettorB || match.playerB || betB?.userId || betB?.user || betB?.bettorId || "");
  const betAId = String(match.betA || match.bet1 || betA?.firestoreId || betA?.id || "");
  const betBId = String(match.betB || match.bet2 || betB?.firestoreId || betB?.id || "");
  const amount = effectiveAmount(match, betA, betB);
  return { betA, betB, betAId, betBId, sideA, sideB, userA, userB, amount };
}

function ledgerId(eventId, matchId) {
  return sanitizeId(`LEDGER-${eventId}-${matchId}`).toUpperCase();
}

function pairLedgerId(eventId, a, b) {
  return sanitizeId(`LEDGER-RANKED-${eventId}-${[a, b].sort().join("-")}`).toUpperCase();
}

function eventReferences(event) {
  return new Set(eventIdentityValues(event));
}

function recordBelongs(record, event) {
  return eventReferences(event).has(String(record?.eventId || ""));
}

function requestAuthorized(req) {
  const secret = process.env.MAINTENANCE_SECRET || process.env.CRON_SECRET || "";
  if (!secret) return false;
  const auth = String(req.headers.authorization || "");
  return auth === `Bearer ${secret}`;
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
        "User-Agent": "Everyone-Loses-Maintenance/10.75",
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
        "User-Agent": "Everyone-Loses-Maintenance/10.75",
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

function mergeUfcFights(existingFights = [], incomingFights = []) {
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
  return clean(merged);
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
      maintenanceVersion: MAINTENANCE_VERSION
    }, { merge: true });
    return { acquired: true, state: data };
  });
}

export async function settleFinalEvents(db, FieldValue, events, bets, matches, ledgerEntries) {
  const summary = { events: 0, matches: 0, ledgerWrites: 0, betsClosed: 0, tiesVoided: 0, deferred: 0, repairedLegacyMatches: 0, unresolved: [] };
  const ledgerByMatch = new Map();
  const betsById = new Map();
  for (const bet of bets) {
    for (const id of [bet.firestoreId, bet.id].map(value => String(value || "")).filter(Boolean)) betsById.set(id, bet);
  }
  for (const entry of ledgerEntries) {
    if (entry.matchId) ledgerByMatch.set(String(entry.matchId), entry);
  }

  for (const event of events.filter(e => e.status === "final")) {
    const eventId = event.firestoreId || event.id;
    const eventType = event.type || (event.away && event.home ? EVENT_TYPES.TEAM : (Array.isArray(event.fights) ? EVENT_TYPES.FIGHT_CARD : ""));
    if (!eventId) continue;
    const eventMatches = matches.filter(match => recordBelongs(match, event));
    const eventBets = bets.filter(bet => recordBelongs(bet, event));
    let changed = false;
    let eventDeferred = 0;
    const batch = db.batch();

    if (eventType === EVENT_TYPES.TEAM) {
      if (!hasScore(event.score)) {
        summary.deferred += eventMatches.filter(m => m.status === "matched").length;
        continue;
      }
      const away = Number(event.score.away);
      const home = Number(event.score.home);
      const winningSide = home > away ? "home" : away > home ? "away" : null;

      for (const match of eventMatches) {
        const matchStatus = String(match.status || "").toLowerCase();
        if (["cancelled", "void"].includes(matchStatus)) continue;
        const matchId = match.firestoreId || match.id;
        if (!matchId) continue;
        const resolved = resolvedMatchFields(match, event, eventBets, betsById);
        const existingMatchLedger = ledgerByMatch.get(String(matchId));
        if (matchStatus === "settled" && existingMatchLedger && match.winner && match.loser && effectiveAmount(match, resolved.betA, resolved.betB) > 0) continue;
        const { sideA, sideB, userA, userB, betAId, betBId, amount } = resolved;

        if (!winningSide) {
          batch.set(db.collection("matches").doc(matchId), {
            eventId,
            betA: betAId || match.betA || null,
            betB: betBId || match.betB || null,
            userA: userA || match.userA || null,
            userB: userB || match.userB || null,
            sideA: sideA || match.sideA || null,
            sideB: sideB || match.sideB || null,
            status: "void",
            result: "draw",
            settlementIssue: null,
            settledAmount: 0,
            winner: null,
            loser: null,
            settledAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
          const staleLedger = ledgerByMatch.get(matchId) || ledgerEntries.find(entry =>
            recordBelongs(entry, event) && String(entry.matchId || "") === String(matchId)
          );
          if (staleLedger) {
            batch.delete(db.collection("ledgerEntries").doc(staleLedger.firestoreId || staleLedger.id));
          }
          summary.tiesVoided += 1;
        } else {
          const winner = sideA === winningSide
            ? userA
            : sideB === winningSide
              ? userB
              : String(match.winner || "");
          const loser = winner === userA ? userB : winner === userB ? userA : String(match.loser || "");
          const unresolved = [];
          if (!userA || !userB) unresolved.push("missing users");
          if (!winner || !loser) {
            if (!sideA || !sideB || (sideA !== winningSide && sideB !== winningSide)) unresolved.push("missing or unrecognized winning pick");
            unresolved.push("winner could not be mapped to a bettor");
          }
          if (!Number.isFinite(amount) || amount <= 0) unresolved.push("missing wager amount");

          if (unresolved.length) {
            const issue = unresolved.join(", ");
            batch.set(db.collection("matches").doc(matchId), {
              eventId,
              betA: betAId || match.betA || null,
              betB: betBId || match.betB || null,
              userA: userA || match.userA || null,
              userB: userB || match.userB || null,
              sideA: sideA || match.sideA || null,
              sideB: sideB || match.sideB || null,
              settlementIssue: issue,
              settlementCheckedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });
            summary.deferred += 1;
            eventDeferred += 1;
            summary.unresolved.push({ eventId, matchId: String(matchId), issue });
            changed = true;
            continue;
          }

          const legacyRepaired = sideA !== match.sideA || sideB !== match.sideB || userA !== match.userA || userB !== match.userB || betAId !== String(match.betA || "") || betBId !== String(match.betB || "") || Number(match.amount || 0) !== amount;
          if (legacyRepaired) summary.repairedLegacyMatches += 1;

          const existingLedger = ledgerByMatch.get(matchId) || ledgerEntries.find(entry =>
            recordBelongs(entry, event)
            && entry.fromUser === loser
            && entry.toUser === winner
            && Number(entry.amount || 0) === amount
          );
          const ledgerRef = existingLedger
            ? db.collection("ledgerEntries").doc(existingLedger.firestoreId || existingLedger.id)
            : db.collection("ledgerEntries").doc(ledgerId(eventId, matchId));
          batch.set(ledgerRef, {
            id: ledgerRef.id,
            eventId,
            matchId,
            fromUser: loser,
            toUser: winner,
            amount,
            originalAmount: Number(match.doubleUp?.originalAmount || match.amount || amount),
            doubledUp: Boolean(match.doubleUp?.applied || match.doubledUp),
            note: `Auto-settled: ${event.title || eventId}${match.doubleUp?.applied || match.doubledUp ? " · doubled up" : ""}`,
            settled: Boolean(existingLedger?.settled || false),
            createdAt: existingLedger?.createdAt || FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
          batch.set(db.collection("matches").doc(matchId), {
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
            settledAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
          summary.ledgerWrites += 1;
        }

        for (const betId of [betAId, betBId].filter(Boolean)) {
          batch.set(db.collection("bets").doc(String(betId)), {
            eventId,
            status: winningSide ? "settled" : "void",
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
          summary.betsClosed += 1;
        }
        summary.matches += 1;
        changed = true;
      }
    } else if (eventType === EVENT_TYPES.FIGHT_CARD) {
      const resultMap = event.fightResults || Object.fromEntries((event.fights || []).map(f => [f.id, f.winner]).filter(([, winner]) => winner));
      for (const match of eventMatches) {
        if (match.status === "cancelled" || match.status === "void") continue;
        const fight = (event.fights || []).find(f => String(f.id) === String(match.fightId));
        const winnerName = String(resultMap[match.fightId] || "").toLowerCase();
        if (!fight || !winnerName) { summary.deferred += 1; eventDeferred += 1; continue; }
        const sideAName = String(match.sideA === "fighterA" ? fight.fighterA : fight.fighterB).toLowerCase();
        const sideBName = String(match.sideB === "fighterA" ? fight.fighterA : fight.fighterB).toLowerCase();
        const winner = winnerName === sideAName ? match.userA : winnerName === sideBName ? match.userB : null;
        if (!winner) { summary.deferred += 1; eventDeferred += 1; continue; }
        const loser = winner === match.userA ? match.userB : match.userA;
        const matchId = match.firestoreId || match.id;
        const amount = effectiveAmount(match);
        const existingLedger = ledgerByMatch.get(matchId) || ledgerEntries.find(entry =>
          recordBelongs(entry, event)
          && entry.fromUser === loser
          && entry.toUser === winner
          && Number(entry.amount || 0) === amount
        );
        const ledgerRef = existingLedger
          ? db.collection("ledgerEntries").doc(existingLedger.firestoreId || existingLedger.id)
          : db.collection("ledgerEntries").doc(ledgerId(eventId, matchId));
        batch.set(ledgerRef, {
          id: ledgerRef.id, eventId, matchId, fromUser: loser, toUser: winner, amount,
          originalAmount: Number(match.doubleUp?.originalAmount || match.amount || amount),
          doubledUp: Boolean(match.doubleUp?.applied || match.doubledUp),
          note: `UFC settled: ${event.title || eventId} · ${fight.label || match.fightId}`,
          settled: Boolean(existingLedger?.settled || false),
          createdAt: existingLedger?.createdAt || FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        batch.set(db.collection("matches").doc(matchId), {
          eventId, status: "settled", settledAmount: amount, winner, loser,
          settledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        for (const betId of [match.betA, match.betB].filter(Boolean)) {
          batch.set(db.collection("bets").doc(String(betId)), { eventId, status: "settled", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          summary.betsClosed += 1;
        }
        summary.matches += 1;
        summary.ledgerWrites += 1;
        changed = true;
      }
    } else if (event.type === EVENT_TYPES.RANKED && Array.isArray(event.resultOrder) && event.resultOrder.length) {
      const rank = new Map(event.resultOrder.map((name, index) => [String(name).toLowerCase(), index + 1]));
      const unsettledBets = eventBets.filter(b => !["settled", "expired", "cancelled"].includes(b.status));
      for (let i = 0; i < unsettledBets.length; i += 1) {
        for (let j = i + 1; j < unsettledBets.length; j += 1) {
          const a = unsettledBets[i];
          const b = unsettledBets[j];
          if (a.userId === b.userId) continue;
          const rankA = rank.get(String(a.participant || "").toLowerCase()) ?? Number.POSITIVE_INFINITY;
          const rankB = rank.get(String(b.participant || "").toLowerCase()) ?? Number.POSITIVE_INFINITY;
          if (rankA === rankB) continue;
          const winner = rankA < rankB ? a.userId : b.userId;
          const loser = winner === a.userId ? b.userId : a.userId;
          const amount = Math.min(Number(a.amount || 0), Number(b.amount || 0));
          if (!amount) continue;
          const aId = a.firestoreId || a.id;
          const bId = b.firestoreId || b.id;
          const ref = db.collection("ledgerEntries").doc(pairLedgerId(eventId, aId, bId));
          batch.set(ref, {
            id: ref.id, eventId, fromUser: loser, toUser: winner, amount,
            note: `Ranked finish: ${event.title || eventId}`,
            settled: false, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
          summary.ledgerWrites += 1;
          changed = true;
        }
      }
      for (const bet of unsettledBets) {
        const betId = bet.firestoreId || bet.id;
        if (!betId) continue;
        batch.set(db.collection("bets").doc(betId), { eventId, status: "settled", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        summary.betsClosed += 1;
      }
    }

    const matchedBetIds = new Set(eventMatches.flatMap(m => [m.betA, m.betB]).filter(Boolean).map(String));
    for (const bet of eventBets) {
      const betId = String(bet.firestoreId || bet.id || "");
      if (!betId || matchedBetIds.has(betId) || ["settled", "expired", "void", "cancelled"].includes(bet.status)) continue;
      batch.set(db.collection("bets").doc(betId), {
        eventId,
        status: "expired",
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      summary.betsClosed += 1;
      changed = true;
    }

    if (changed) {
      const eventIssues = summary.unresolved.filter(item => item.eventId === String(eventId));
      batch.set(db.collection("events").doc(eventId), {
        boardState: "history",
        hiddenFromNow: true,
        settlementStatus: eventDeferred ? "partial" : "complete",
        settlementIssue: eventDeferred ? eventIssues.map(item => item.issue).join(" | ") : null,
        settlementCheckedAt: FieldValue.serverTimestamp(),
        ...(eventDeferred ? {} : { settledAt: FieldValue.serverTimestamp() }),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      await batch.commit();
      summary.events += 1;
    }
  }
  return summary;
}

async function cleanupHistory(db, FieldValue, events, bets, matches) {
  const old = events.filter(event => event.status === "final" && Date.now() - dateMs(event.startTime) > HISTORY_RETENTION_MS);
  let removed = 0;
  for (const event of old) {
    const eventId = event.firestoreId || event.id;
    const eventMatches = matches.filter(m => recordBelongs(m, event));
    if (eventMatches.some(m => !["settled", "void", "cancelled"].includes(m.status))) continue;
    const batch = db.batch();
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

async function runMaintenance(req, mode) {
  const { db, FieldValue } = getAdminServices();
  const lease = await acquireLease(db, FieldValue, mode);
  if (!lease.acquired) return { skipped: true, reason: "maintenance already running", state: lease.state || {} };

  const started = Date.now();
  const origin = inferOrigin(req);
  const errors = [];
  try {
    const [eventsSnap, betsSnap, matchesSnap, ledgerSnap] = await Promise.all([
      db.collection("events").get(),
      db.collection("bets").get(),
      db.collection("matches").get(),
      db.collection("ledgerEntries").get()
    ]);
    const toRows = snap => snap.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
    let events = toRows(eventsSnap);
    const bets = toRows(betsSnap);
    const matches = toRows(matchesSnap);
    const ledgerEntries = toRows(ledgerSnap);

    // Settle already-final events before any network discovery. This guarantees
    // ledger work is not starved when a long source sweep approaches the
    // serverless time limit after scores have already been saved.
    const preSettlement = await settleFinalEvents(db, FieldValue, events, bets, matches, ledgerEntries);

    const state = lease.state || {};
    const fullDiscovery = mode === "full" || mode === "auto" && Date.now() - dateMs(state.lastFullDiscoveryAt) >= FULL_DISCOVERY_INTERVAL_MS;
    const plan = buildFetchPlan(events, matches, fullDiscovery);
    let sourceResults = await mapLimit(plan, 12, async item => fetchSource(origin, item.league, item.dateISO));

    const targetedUfcRepairs = events
      .filter(ufcCardNeedsRepair)
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
    const settlement = mergeSettlementSummaries(preSettlement, postSettlement);
    const historyRemoved = await cleanupHistory(db, FieldValue, events, freshBets, freshMatches);
    const summary = {
      version: MAINTENANCE_VERSION,
      runtime: process.version,
      mode,
      fullDiscovery,
      durationMs: Date.now() - started,
      sourceRequests: plan.length,
      sourceSuccesses: sourceResults.filter(r => r && !r.error).length,
      added,
      updated,
      archivedStale: events.filter(e => e.boardState === "archived" && e.status !== "final").length,
      settlement,
      historyRemoved,
      errors: errors.slice(0, 20),
      sourceSummary: sourceSummary.slice(0, 100)
    };
    await db.collection("system").doc("maintenance").set({
      running: false,
      leaseUntil: new Date(0),
      lastRunAt: FieldValue.serverTimestamp(),
      lastSuccessAt: FieldValue.serverTimestamp(),
      ...(fullDiscovery ? { lastFullDiscoveryAt: FieldValue.serverTimestamp() } : {}),
      lastSummary: summary,
      lastError: errors.length ? errors.join(" | ").slice(0, 4000) : "",
      maintenanceVersion: MAINTENANCE_VERSION
    }, { merge: true });
    return summary;
  } catch (error) {
    await db.collection("system").doc("maintenance").set({
      running: false,
      leaseUntil: new Date(0),
      lastRunAt: FieldValue.serverTimestamp(),
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

  const mode = String(req.query.mode || "quick").toLowerCase();
  const protectedMode = mode === "auto" || mode === "full";
  if (protectedMode && !requestAuthorized(req)) return json(res, 401, { error: "Maintenance authorization required" });

  try {
    const result = await runMaintenance(req, ["quick", "auto", "full"].includes(mode) ? mode : "quick");
    return json(res, result.skipped ? 202 : 200, result);
  } catch (error) {
    return json(res, 500, { error: error?.message || String(error), stack: process.env.NODE_ENV === "development" ? error?.stack : undefined });
  }
}
