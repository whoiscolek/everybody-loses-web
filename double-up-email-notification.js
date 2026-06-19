const LEAGUE_MAP = {
  NBA: { sport: "basketball", league: "NBA", espnPath: "basketball/nba", appSport: "basketball", eventType: "TEAM_HEAD_TO_HEAD" },
  NFL: { sport: "football", league: "NFL", espnPath: "football/nfl", appSport: "football", eventType: "TEAM_HEAD_TO_HEAD" },
  MLB: { sport: "baseball", league: "MLB", espnPath: "baseball/mlb", appSport: "baseball", eventType: "TEAM_HEAD_TO_HEAD" },
  NHL: { sport: "hockey", league: "NHL", espnPath: "hockey/nhl", appSport: "hockey", eventType: "TEAM_HEAD_TO_HEAD" },
  "NCAA Basketball": { sport: "basketball", league: "NCAA Basketball", espnPath: "basketball/mens-college-basketball", appSport: "basketball", groups: 100, eventType: "TEAM_HEAD_TO_HEAD" },
  "NCAA Football": { sport: "football", league: "NCAA Football", espnPath: "football/college-football", appSport: "football", groups: 100, eventType: "TEAM_HEAD_TO_HEAD" },
  "Premier League": { sport: "soccer", league: "Premier League", espnPath: "soccer/eng.1", appSport: "soccer", eventType: "TEAM_HEAD_TO_HEAD" },
  MLS: { sport: "soccer", league: "MLS", espnPath: "soccer/usa.1", appSport: "soccer", eventType: "TEAM_HEAD_TO_HEAD" },
  "Champions League": { sport: "soccer", league: "Champions League", espnPath: "soccer/uefa.champions", appSport: "soccer", eventType: "TEAM_HEAD_TO_HEAD" },
  "World Cup": { sport: "soccer", league: "World Cup", espnPath: "soccer/fifa.world", appSport: "soccer", eventType: "TEAM_HEAD_TO_HEAD" },
  F1: { sport: "racing", league: "F1", espnPath: "racing/f1", appSport: "racing", eventType: "RANKED_FINISH", leagueKey: "f1", useJolpicaF1: true },
  NASCAR: { sport: "racing", league: "NASCAR", espnPath: "racing/nascar-premier", appSport: "racing", eventType: "RANKED_FINISH", leagueKey: "nascar-premier", useOfficialLive: true },
  IndyCar: { sport: "racing", league: "IndyCar", espnPath: "racing/irl", appSport: "racing", eventType: "RANKED_FINISH", leagueKey: "irl", useIndyCarOfficialLive: true },
  MotoGP: { sport: "racing", league: "MotoGP", espnPath: "", appSport: "racing", eventType: "RANKED_FINISH", leagueKey: "motogp", useMotoGpPulseLive: true },
  UFC: { sport: "mma", league: "UFC", espnPath: "mma/ufc", appSport: "combat", eventType: "FIGHT_CARD", useUfcFightCard: true }
};

const TEAM_LOCATION_FALLBACKS = {
  ATL: ["Atlanta", "GA"], BOS: ["Boston", "MA"], BKN: ["Brooklyn", "NY"], CHA: ["Charlotte", "NC"], CHI: ["Chicago", "IL"],
  CLE: ["Cleveland", "OH"], DAL: ["Dallas", "TX"], DEN: ["Denver", "CO"], DET: ["Detroit", "MI"], GSW: ["San Francisco", "CA"],
  HOU: ["Houston", "TX"], IND: ["Indianapolis", "IN"], LAC: ["Los Angeles", "CA"], LAL: ["Los Angeles", "CA"], MEM: ["Memphis", "TN"],
  MIA: ["Miami", "FL"], MIL: ["Milwaukee", "WI"], MIN: ["Minneapolis", "MN"], NOP: ["New Orleans", "LA"], NYK: ["New York", "NY"],
  OKC: ["Oklahoma City", "OK"], ORL: ["Orlando", "FL"], PHI: ["Philadelphia", "PA"], PHX: ["Phoenix", "AZ"], POR: ["Portland", "OR"],
  SAC: ["Sacramento", "CA"], SAS: ["San Antonio", "TX"], TOR: ["Toronto", "ON"], UTA: ["Salt Lake City", "UT"], WAS: ["Washington", "DC"],
  ARI: ["Phoenix", "AZ"], BAL: ["Baltimore", "MD"], BUF: ["Buffalo", "NY"], CAR: ["Charlotte", "NC"], CIN: ["Cincinnati", "OH"],
  GB: ["Green Bay", "WI"], JAX: ["Jacksonville", "FL"], KC: ["Kansas City", "MO"], LV: ["Las Vegas", "NV"], NE: ["Foxborough", "MA"],
  NO: ["New Orleans", "LA"], PIT: ["Pittsburgh", "PA"], SEA: ["Seattle", "WA"], SF: ["San Francisco", "CA"], TB: ["Tampa", "FL"], TEN: ["Nashville", "TN"],
  CHC: ["Chicago", "IL"], CWS: ["Chicago", "IL"], NYY: ["New York", "NY"], NYM: ["New York", "NY"], LAD: ["Los Angeles", "CA"], LAA: ["Anaheim", "CA"],
  SD: ["San Diego", "CA"], COL: ["Denver", "CO"], OAK: ["West Sacramento", "CA"], ATH: ["West Sacramento", "CA"], TEX: ["Arlington", "TX"], HOU: ["Houston", "TX"],
  STL: ["St. Louis", "MO"], MIN: ["Minneapolis", "MN"], DET: ["Detroit", "MI"], CLE: ["Cleveland", "OH"], TOR: ["Toronto", "ON"], PHI: ["Philadelphia", "PA"],
  WSH: ["Washington", "DC"], MIA: ["Miami", "FL"], MIL: ["Milwaukee", "WI"], ARI: ["Phoenix", "AZ"], SEA: ["Seattle", "WA"], CIN: ["Cincinnati", "OH"],
  KC: ["Kansas City", "MO"], BAL: ["Baltimore", "MD"], BOS: ["Boston", "MA"], ATL: ["Atlanta", "GA"], PIT: ["Pittsburgh", "PA"]
};


const MLB_TEAM_IDS = {
  ARI: 109,
  ATL: 144,
  BAL: 110,
  BOS: 111,
  CHC: 112,
  CWS: 145,
  CHW: 145,
  CIN: 113,
  CLE: 114,
  COL: 115,
  DET: 116,
  HOU: 117,
  KC: 118,
  KCR: 118,
  LAA: 108,
  LAD: 119,
  MIA: 146,
  MIL: 158,
  MIN: 142,
  NYM: 121,
  NYY: 147,
  OAK: 133,
  ATH: 133,
  PHI: 143,
  PIT: 134,
  SD: 135,
  SDP: 135,
  SEA: 136,
  SF: 137,
  SFG: 137,
  STL: 138,
  TB: 139,
  TBR: 139,
  TEX: 140,
  TOR: 141,
  WSH: 120,
  WSN: 120
};


const MLB_ID_TO_CODE = Object.fromEntries(Object.entries(MLB_TEAM_IDS).map(([code, id]) => [String(id), code]));
const MLB_PRIMARY_CODES_BY_ID = {
  108: "LAA", 109: "ARI", 110: "BAL", 111: "BOS", 112: "CHC", 113: "CIN", 114: "CLE", 115: "COL", 116: "DET", 117: "HOU",
  118: "KC", 119: "LAD", 120: "WSH", 121: "NYM", 133: "ATH", 134: "PIT", 135: "SD", 136: "SEA", 137: "SF", 138: "STL",
  139: "TB", 140: "TEX", 141: "TOR", 142: "MIN", 143: "PHI", 144: "ATL", 145: "CWS", 146: "MIA", 147: "NYY", 158: "MIL"
};

function mlbCodeFromTeam(team = {}) {
  const id = String(team.id || "");
  return MLB_PRIMARY_CODES_BY_ID[id] || MLB_ID_TO_CODE[id] || cleanCode(team.abbreviation || team.teamCode || team.fileCode || team.shortName || team.name, "MLB");
}

function mlbStatusFromGame(game = {}) {
  const abstract = String(game.status?.abstractGameState || "").toLowerCase();
  const coded = String(game.status?.codedGameState || "").toUpperCase();
  if (abstract === "final" || ["F", "O"].includes(coded)) return "final";
  if (abstract === "live" || ["I", "M", "N"].includes(coded)) return "live";
  return "pregame";
}

function mlbStatusLine(game = {}) {
  const detailed = game.status?.detailedState || "";
  const inning = game.linescore?.currentInningOrdinal || "";
  const half = game.linescore?.inningHalf || "";
  if (inning || half) return [half, inning].filter(Boolean).join(" ");
  return detailed;
}

function mlbScore(game = {}, status = "pregame") {
  if (status === "pregame") return null;
  return {
    away: Number(game.teams?.away?.score ?? 0),
    home: Number(game.teams?.home?.score ?? 0)
  };
}

function mlbProbablePitcherLine(game = {}, awayCode = "AWAY", homeCode = "HOME") {
  const awayPitcher = game.teams?.away?.probablePitcher?.fullName || "";
  const homePitcher = game.teams?.home?.probablePitcher?.fullName || "";
  const parts = [];
  if (awayPitcher) parts.push(`${awayCode}: ${awayPitcher}`);
  if (homePitcher) parts.push(`${homeCode}: ${homePitcher}`);
  return parts.join(" · ");
}

function matchEspnEventForMlbGame(game, espnEvents = []) {
  const awayId = String(game.teams?.away?.team?.id || "");
  const homeId = String(game.teams?.home?.team?.id || "");
  const awayCode = MLB_PRIMARY_CODES_BY_ID[awayId] || "";
  const homeCode = MLB_PRIMARY_CODES_BY_ID[homeId] || "";
  const start = new Date(game.gameDate || 0).getTime();

  return espnEvents.find(raw => {
    const mapped = mapTeamEvent(raw, LEAGUE_MAP.MLB);
    const sameTeams = mapped?.away?.code === awayCode && mapped?.home?.code === homeCode;
    const mappedStart = new Date(mapped?.startTime || 0).getTime();
    const closeStart = Number.isFinite(start) && Number.isFinite(mappedStart) && Math.abs(start - mappedStart) < 4 * 60 * 60 * 1000;
    return sameTeams && closeStart;
  }) || null;
}

function mapMlbStatsApiGame(game, espnRaw = null) {
  const awayTeam = game.teams?.away?.team || {};
  const homeTeam = game.teams?.home?.team || {};
  const awayCode = mlbCodeFromTeam(awayTeam);
  const homeCode = mlbCodeFromTeam(homeTeam);
  const status = mlbStatusFromGame(game);
  const score = mlbScore(game, status);
  const espnMapped = espnRaw ? mapTeamEvent(espnRaw, LEAGUE_MAP.MLB) : null;
  const odds = espnMapped?.odds && !/^api schedule import$/i.test(String(espnMapped.odds)) ? espnMapped.odds : "API schedule import";
  const statusText = mlbStatusLine(game) || labelStatus(status);
  const liveContext = status === "live" ? statusText : status === "final" ? "Final" : "";
  const pitcherLine = mlbProbablePitcherLine(game, awayCode, homeCode);
  const awayName = awayTeam.name || awayTeam.teamName || awayCode;
  const homeName = homeTeam.name || homeTeam.teamName || homeCode;

  return {
    apiSource: "mlb-statsapi",
    apiEventId: String(game.gamePk),
    sport: "baseball",
    league: "MLB",
    type: "TEAM_HEAD_TO_HEAD",
    title: `${awayName} at ${homeName}`,
    away: {
      code: awayCode,
      name: awayName
    },
    home: {
      code: homeCode,
      name: homeName
    },
    startTime: game.gameDate || new Date().toISOString(),
    status,
    score,
    liveContext,
    liveStats: [
      { label: "Status", value: statusText },
      ...(pitcherLine ? [{ label: "Probable pitchers", value: pitcherLine }] : [])
    ],
    weather: espnMapped?.weather || null,
    weatherText: espnMapped?.weather?.summary || "",
    odds,
    externalIds: {
      source: "mlb-statsapi",
      mlbGamePk: String(game.gamePk),
      espnEventId: espnRaw?.id ? String(espnRaw.id) : "",
      espnUid: espnRaw?.uid || "",
      espnGuid: espnRaw?.guid || ""
    },
    intel: "MLB event imported from MLB Stats API for live score/status with ESPN used for schedule odds when available."
  };
}

async function fetchMlbStatsApiEvents(dateYYYYMMDD, espnRawEvents = []) {
  const iso = `${dateYYYYMMDD.slice(0, 4)}-${dateYYYYMMDD.slice(4, 6)}-${dateYYYYMMDD.slice(6, 8)}`;
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${encodeURIComponent(iso)}&hydrate=team,probablePitcher,linescore`;
  const data = await fetchJsonUrl(url, "MLB schedule");
  const games = (data?.dates || []).flatMap(day => day.games || []);
  return games.map(game => mapMlbStatsApiGame(game, matchEspnEventForMlbGame(game, espnRawEvents)));
}

const DEFAULT_RACING_PARTICIPANTS = {
  F1: ["Kimi Antonelli", "Lewis Hamilton", "George Russell", "Charles Leclerc", "Oscar Piastri", "Lando Norris", "Max Verstappen", "Carlos Sainz", "Fernando Alonso", "Yuki Tsunoda", "Alexander Albon", "Pierre Gasly", "Esteban Ocon", "Nico Hulkenberg", "Lance Stroll", "Liam Lawson", "Isack Hadjar", "Oliver Bearman", "Gabriel Bortoleto", "Franco Colapinto"],
  NASCAR: ["Kyle Larson", "Denny Hamlin", "William Byron", "Chase Elliott", "Ryan Blaney", "Christopher Bell", "Tyler Reddick", "Joey Logano", "Ross Chastain", "Bubba Wallace", "Brad Keselowski", "Ty Gibbs"],
  IndyCar: ["Alex Palou", "Pato O'Ward", "Scott Dixon", "Josef Newgarden", "Scott McLaughlin", "Will Power", "Colton Herta", "Marcus Ericsson", "Kyle Kirkwood", "Rinus VeeKay"],
  MotoGP: ["Marc Marquez", "Alex Marquez", "Francesco Bagnaia", "Pedro Acosta", "Fabio Quartararo", "Marco Bezzecchi", "Franco Morbidelli", "Brad Binder", "Maverick Vinales", "Enea Bastianini"]
};

function ymd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function cleanCode(value, fallback = "TBD") {
  const raw = String(value || fallback).trim();
  return raw.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase() || fallback;
}

function fullTeamName(team = {}, fallback = "Team") {
  const location = String(team.location || "").trim();
  const name = String(team.name || "").trim();
  const combinedLocationName = location && name && !name.toLowerCase().startsWith(location.toLowerCase())
    ? `${location} ${name}`
    : name;
  return String(
    team.displayName
    || team.fullName
    || combinedLocationName
    || team.shortDisplayName
    || fallback
  ).trim();
}

function getCompetitor(competition, homeAway) {
  return competition?.competitors?.find(item => item.homeAway === homeAway) || null;
}

function getStatus(event) {
  const competition = event?.competitions?.[0] || {};
  const types = [event?.status?.type || {}, competition?.status?.type || {}];
  const text = types
    .flatMap(type => [type.name, type.description, type.detail, type.shortDetail, type.state])
    .concat([
      event?.status?.displayClock,
      competition?.status?.displayClock,
      competition?.status?.type?.detail,
      competition?.status?.type?.shortDetail
    ])
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const statusIds = new Set(types.map(type => Number(type.id)).filter(Number.isFinite));
  // 3 is ESPN's common final state; soccer uses 28 for full time. Other
  // completion variants are still recognized through completed/state/text,
  // avoiding guesses that could classify postponed or cancelled games as final.
  const finalStatusIds = new Set([3, 28]);
  const liveStatusIds = new Set([2]);

  if (
    types.some(type => type.completed === true || String(type.state || "").toLowerCase() === "post")
    || [...statusIds].some(id => finalStatusIds.has(id))
    || /(^|\b)(final|full time|full-time|ft|completed|complete)(\b|$)/i.test(text)
  ) return "final";

  if (
    types.some(type => String(type.state || "").toLowerCase() === "in")
    || [...statusIds].some(id => liveStatusIds.has(id))
    || /in progress|halftime|half-time|extra time|penalties|live/i.test(text)
  ) return "live";

  return "pregame";
}

function raceName(item) {
  return item?.athlete?.displayName
    || item?.driver?.displayName
    || item?.team?.displayName
    || item?.displayName
    || item?.name
    || item?.athlete?.shortName
    || item?.driver?.shortName
    || "";
}

function raceRank(item, fallback) {
  const candidates = [
    item?.curatedRank?.current,
    item?.rank,
    item?.order,
    item?.place,
    item?.position,
    item?.score,
    item?.linescores?.[0]?.value
  ];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

function extractRaceLeaderboard(event, config) {
  const byName = new Map();
  let fallbackRank = 1;

  for (const competition of event?.competitions || []) {
    for (const item of competition?.competitors || []) {
      const name = raceName(item);
      if (!name || byName.has(name)) continue;
      const position = raceRank(item, fallbackRank++);
      const detail = item?.status?.displayName
        || item?.result?.displayName
        || item?.statistics?.find?.(stat => /laps|time|behind|points/i.test(stat?.name || ""))?.displayValue
        || "";
      byName.set(name, { position, name, detail });
    }
  }

  if (!byName.size) {
    for (const name of DEFAULT_RACING_PARTICIPANTS[config.league] || []) {
      byName.set(name, { position: fallbackRank++, name, detail: "Entry" });
    }
  }

  return Array.from(byName.values())
    .sort((a, b) => Number(a.position || 999) - Number(b.position || 999))
    .slice(0, 30);
}

function extractRaceParticipants(event, config) {
  return extractRaceLeaderboard(event, config).map(row => row.name);
}

function extractRaceResultOrder(event, config) {
  return extractRaceLeaderboard(event, config).map(row => row.name);
}

function mapRacingEvent(event, config) {
  const competition = event.competitions?.[0] || {};
  const status = getStatus(event);
  const startTime = event.date || competition.date || new Date().toISOString();
  const leaderboard = extractRaceLeaderboard(event, config);
  const participants = leaderboard.map(row => row.name);
  const resultOrder = status === "final" ? leaderboard.map(row => row.name) : [];

  return {
    apiSource: "espn",
    apiEventId: String(event.id),
    sport: config.appSport,
    league: config.league,
    type: "RANKED_FINISH",
    title: event.shortName || event.name || `${config.league} race`,
    startTime,
    status,
    participants,
    leaderboard,
    leaderboardSource: "ESPN event data",
    leaderboardVerified: false,
    liveStats: [
      { label: "Source", value: "ESPN schedule" },
      { label: "Status", value: labelStatus(status) },
      { label: "Entries", value: String(participants.length) }
    ],
    resultOrder,
    score: null,
    odds: "API schedule import",
    externalIds: {
      source: "espn",
      espnEventId: String(event.id),
      espnUid: event.uid || "",
      espnGuid: event.guid || ""
    },
    intel: `${config.league} race imported from ESPN schedule data. Participant lists for racing may need admin verification before users bet.`
  };
}

function mapTeamEvent(event, config) {
  const competition = event.competitions?.[0] || {};
  const away = getCompetitor(competition, "away") || competition.competitors?.[1] || {};
  const home = getCompetitor(competition, "home") || competition.competitors?.[0] || {};
  const awayTeam = away.team || {};
  const homeTeam = home.team || {};
  const awayCode = cleanCode(awayTeam.abbreviation || awayTeam.shortDisplayName || awayTeam.displayName, "AWAY");
  const homeCode = cleanCode(homeTeam.abbreviation || homeTeam.shortDisplayName || homeTeam.displayName, "HOME");
  const awayName = fullTeamName(awayTeam, awayCode);
  const homeName = fullTeamName(homeTeam, homeCode);
  const status = getStatus(event);
  const odds = competition.odds?.[0]?.details || competition.odds?.[0]?.overUnder || "API schedule import";
  const startTime = event.date || competition.date || new Date().toISOString();
  const score = status === "pregame" ? null : {
    away: Number(away.score ?? 0),
    home: Number(home.score ?? 0)
  };
  const clock = event?.status?.displayClock || competition?.status?.displayClock || competition?.situation?.clock || "";
  const period = event?.status?.period || competition?.status?.period || "";
  const venue = competition?.venue?.fullName || event?.venue?.fullName || "";
  const weather = competition?.weather?.displayValue || competition?.weather?.conditionId || "";
  const liveContext = status === "live" && period
    ? `Period ${period}${clock ? ` · ${clock}` : ""}`
    : status === "final"
      ? "Final"
      : "";
  const liveStats = [
    { label: "Status", value: liveContext || labelStatus(status) },
    { label: "Odds", value: typeof odds === "number" ? `O/U ${odds}` : String(odds || "Unavailable") },
    { label: "Weather", value: weather || "Weather unavailable" },
    { label: "Stats", value: status === "pregame" ? "Pregame" : "Scoreboard active" }
  ];

  return {
    apiSource: "espn",
    apiEventId: String(event.id),
    sport: config.appSport,
    league: config.league,
    type: "TEAM_HEAD_TO_HEAD",
    title: `${awayName} ${config.appSport === "soccer" ? "vs" : "at"} ${homeName}`,
    away: {
      code: awayCode,
      name: awayName
    },
    home: {
      code: homeCode,
      name: homeName
    },
    startTime,
    status,
    score,
    liveContext,
    liveStats,
    weather: weather ? { summary: String(weather) } : null,
    odds: typeof odds === "number" ? `O/U ${odds}` : String(odds),
    externalIds: {
      source: "espn",
      espnEventId: String(event.id),
      espnUid: event.uid || "",
      espnGuid: event.guid || ""
    },
    intel: `${config.league} event imported from ESPN scoreboard data. Verify teams, time, status, score, and odds before settling.`
  };
}


function normalizeFightId(value, fallback = "fight") {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || fallback;
}


// Verified one-off card corrections are only used when ESPN's live feeds return
// an incomplete card. Dynamic ESPN data always wins when the same fight exists.
// UFC Freedom 250 was a seven-fight, no-prelims card, while ESPN's scoreboard
// intermittently exposed only five bouts.
const UFC_CARD_OVERRIDES = {
  "600058854": {
    minimumFightCount: 7,
    noPrelims: true,
    fights: [
      { fighterA: "Diego Lopes", fighterB: "Steve Garcia", winner: "Diego Lopes", verifiedFinal: true },
      { fighterA: "Bo Nickal", fighterB: "Kyle Daukaus", winner: "Bo Nickal", verifiedFinal: true },
      { fighterA: "Mauricio Ruffy", fighterB: "Michael Chandler", winner: "Mauricio Ruffy", verifiedFinal: true },
      { fighterA: "Josh Hokit", fighterB: "Derrick Lewis", winner: "Josh Hokit", verifiedFinal: true },
      { fighterA: "Sean O'Malley", fighterB: "Aiemann Zahabi", winner: "Sean O'Malley", verifiedFinal: true },
      { fighterA: "Alex Pereira", fighterB: "Ciryl Gane", winner: "Ciryl Gane", verifiedFinal: true, cardRole: "co-main" },
      { fighterA: "Ilia Topuria", fighterB: "Justin Gaethje", winner: "", verifiedFinal: false, cardRole: "main-event" }
    ]
  }
};

function numericIdFromValue(value) {
  const text = String(value || "");
  const matches = text.match(/\d{7,}/g);
  return matches?.length ? matches[matches.length - 1] : "";
}

function ufcEventIdCandidates(event = {}) {
  const values = [event.id, event.uid, event.guid, event?.externalIds?.espnEventId];
  for (const link of event.links || []) values.push(link?.href, link?.url);
  for (const competition of event.competitions || []) {
    values.push(competition?.eventId, competition?.event?.id, competition?.uid, competition?.guid);
    for (const link of competition?.links || []) values.push(link?.href, link?.url);
  }

  const ids = [];
  for (const value of values) {
    const direct = String(value || "").trim();
    const parsed = numericIdFromValue(direct);
    for (const candidate of [direct, parsed]) {
      if (/^\d{7,}$/.test(candidate) && !ids.includes(candidate)) ids.push(candidate);
    }
  }
  return ids;
}

function normalizedFightPairKey(fighterA, fighterB) {
  return [fighterA, fighterB]
    .map(value => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim())
    .filter(Boolean)
    .sort()
    .join("::");
}

function applyUfcCardOverride(event = {}, fights = []) {
  const eventId = ufcEventIdCandidates(event).find(id => UFC_CARD_OVERRIDES[id]);
  const override = eventId ? UFC_CARD_OVERRIDES[eventId] : null;
  if (!override) {
    return { fights, overrideApplied: false, overrideEventId: eventId || "" };
  }

  const eventStatus = getUfcCardStatus(event);
  const dynamicByPair = new Map(fights.map(fight => [normalizedFightPairKey(fight.fighterA, fight.fighterB), fight]));
  const merged = override.fights.map((known, index) => {
    const pair = normalizedFightPairKey(known.fighterA, known.fighterB);
    const dynamic = dynamicByPair.get(pair) || null;
    if (dynamic) dynamicByPair.delete(pair);
    const role = known.cardRole || (index === override.fights.length - 2 ? "co-main" : index === override.fights.length - 1 ? "main-event" : "main-card");
    return {
      ...(dynamic || {}),
      id: dynamic?.id || normalizeFightId(`${eventId}-${known.fighterA}-${known.fighterB}`, `fight-${index + 1}`),
      order: index + 1,
      sourceOrder: dynamic?.sourceOrder || index + 1,
      fighterA: known.fighterA,
      fighterB: known.fighterB,
      label: `${known.fighterA} vs ${known.fighterB}`,
      status: dynamic?.winner || known.verifiedFinal
        ? "final"
        : dynamic?.status || (eventStatus === "final" ? "final" : "pregame"),
      winner: dynamic?.winner || (known.verifiedFinal ? known.winner || "" : eventStatus === "final" ? known.winner || "" : ""),
      detail: dynamic?.detail || "",
      cardSection: dynamic?.cardSection || "main-card",
      cardRole: dynamic?.cardRole || role
    };
  });

  for (const fight of dynamicByPair.values()) {
    merged.push({ ...fight, order: merged.length + 1 });
  }

  return { fights: merged, overrideApplied: true, overrideEventId: eventId };
}

function ufcFighterName(competitor) {
  return competitor?.athlete?.displayName
    || competitor?.athlete?.shortName
    || competitor?.team?.displayName
    || competitor?.displayName
    || competitor?.name
    || competitor?.displayName
    || "";
}

function ufcWinnerFromCompetition(competition = {}) {
  const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
  const winner = competitors.find(item => {
    const resultText = [
      item?.result?.type,
      item?.result?.name,
      item?.result?.displayName,
      item?.result,
      item?.outcome,
      item?.status
    ].filter(Boolean).join(" ").toLowerCase();
    return item?.winner === true || item?.isWinner === true || /(^|\s)(win|winner|w)(\s|$)/.test(resultText);
  });
  if (winner) return ufcFighterName(winner);

  const directWinner = competition?.winner
    || competition?.result?.winner
    || competition?.status?.winner
    || competition?.winnerAthlete;
  if (typeof directWinner === "string") return directWinner;
  if (directWinner && typeof directWinner === "object") return ufcFighterName(directWinner) || ufcFighterName(directWinner?.competitor);

  const winnerId = String(competition?.winnerId || competition?.result?.winnerId || "");
  if (winnerId) {
    const byId = competitors.find(item => [item?.id, item?.athlete?.id, item?.uid].map(String).includes(winnerId));
    if (byId) return ufcFighterName(byId);
  }
  return "";
}

function ufcFightStatus(competition = {}, event = {}) {
  if (ufcWinnerFromCompetition(competition)) return "final";

  const type = competition?.status?.type || {};
  const statusText = [
    type?.name,
    type?.description,
    type?.detail,
    type?.shortDetail,
    type?.state,
    competition?.status?.name,
    competition?.status?.description,
    competition?.status?.detail,
    competition?.status?.shortDetail,
    competition?.state,
    competition?.statusText,
    competition?.result?.status
  ].filter(Boolean).join(" ").toLowerCase();

  if (type?.completed === true || competition?.completed === true || /(^|\s)(final|complete|completed|ended|closed)(\s|$)/.test(statusText)) return "final";
  if (type?.state === "in" || competition?.state === "in" || /live|in[ -]?progress|active/.test(statusText)) return "live";

  const eventType = event?.status?.type || {};
  if (eventType?.completed === true && competition?.status?.type?.state !== "pre") return "final";
  return "pregame";
}

function getUfcCardStatus(event = {}) {
  const type = event?.status?.type || {};
  const text = [type.name, type.description, type.detail, type.shortDetail, type.state]
    .filter(Boolean).join(" ").toLowerCase();
  if (type.completed === true || String(type.state || "").toLowerCase() === "post" || /(^|\s)(final|complete|completed)(\s|$)/.test(text)) return "final";
  if (String(type.state || "").toLowerCase() === "in" || /live|in[ -]?progress|active/.test(text)) return "live";

  const fightStatuses = (event.competitions || []).map(competition => ufcFightStatus(competition, {}));
  if (fightStatuses.includes("live")) return "live";
  if (fightStatuses.length && fightStatuses.every(status => status === "final")) return "final";
  return "pregame";
}

function ufcCardSection(competition = {}) {
  const text = [
    competition?.__cardSection,
    competition?.type?.text,
    competition?.type?.name,
    competition?.note,
    competition?.headline,
    competition?.cardSection,
    competition?.group?.name,
    competition?.group?.displayName
  ].filter(Boolean).join(" ").toLowerCase();

  if (/early\s+prelim|prelim/.test(text)) return "prelims";
  if (/co[- ]?main/.test(text)) return "co-main";
  if (/main\s+event/.test(text)) return "main-event";
  if (/main[-\s]+card/.test(text)) return "main-card";
  return "";
}

function extractUfcFightsFromEvent(event) {
  const fights = [];
  const rawCompetitions = Array.isArray(event?.competitions) ? event.competitions.filter(Boolean) : [];
  const firstRole = rawCompetitions.length ? ufcCardSection(rawCompetitions[0]) : "";
  const lastRole = rawCompetitions.length ? ufcCardSection(rawCompetitions[rawCompetitions.length - 1]) : "";
  // ESPN fight-center normally lists the headline bout first. The app displays
  // fights in broadcast order, ending with co-main and main event.
  const competitions = firstRole === "main-event" && lastRole !== "main-event"
    ? [...rawCompetitions].reverse()
    : rawCompetitions;

  competitions.forEach((competition, index) => {
    const competitors = Array.isArray(competition?.competitors) ? competition.competitors.filter(Boolean) : [];
    if (competitors.length < 2) return;

    const fighterA = ufcFighterName(competitors[0]);
    const fighterB = ufcFighterName(competitors[1]);
    if (!fighterA || !fighterB || fighterA === fighterB) return;

    const fightId = normalizeFightId(competition.id || `${event.id || "ufc"}-${index + 1}-${fighterA}-${fighterB}`, `fight-${index + 1}`);
    const detailBits = [competition?.type?.text, competition?.note, competition?.weightClass?.text || competition?.weightClass?.displayName]
      .filter(Boolean);

    fights.push({
      id: fightId,
      order: fights.length + 1,
      sourceOrder: index + 1,
      fighterA,
      fighterB,
      label: `${fighterA} vs ${fighterB}`,
      status: ufcFightStatus(competition, event),
      winner: ufcWinnerFromCompetition(competition),
      detail: detailBits.join(" · "),
      cardSection: ufcCardSection(competition)
    });
  });

  // ESPN sometimes labels prelim fights explicitly and sometimes exposes only the
  // main card without section labels. Exclude explicitly labeled prelims, but never
  // assume that a main card contains exactly five fights.
  const hasPrelimLabels = fights.some(fight => fight.cardSection === "prelims");
  const cardFights = hasPrelimLabels
    ? fights.filter(fight => fight.cardSection !== "prelims")
    : fights;

  const normalized = cardFights.map((fight, index, list) => {
    let cardRole = fight.cardSection;
    if ((!cardRole || cardRole === "main-card") && list.length >= 2 && index === list.length - 2) cardRole = "co-main";
    if ((!cardRole || cardRole === "main-card") && index === list.length - 1) cardRole = "main-event";
    return { ...fight, order: index + 1, cardRole };
  });

  const overridden = applyUfcCardOverride(event, normalized);
  event.__ufcOverrideApplied = overridden.overrideApplied;
  event.__ufcOverrideEventId = overridden.overrideEventId;
  return overridden.fights;
}

function mapUfcFightCards(rawEvents, config, date) {
  const events = Array.isArray(rawEvents) ? rawEvents : [];
  const cards = [];

  for (const event of events) {
    const fights = extractUfcFightsFromEvent(event);
    if (!fights.length) continue;

    const mainCard = fights.map((fight, index) => ({ ...fight, order: index + 1 }));
    const startTime = event.date || event.competitions?.[0]?.date || new Date().toISOString();
    const statuses = mainCard.map(fight => fight.status);
    const status = statuses.includes("live") ? "live" : statuses.length && statuses.every(item => item === "final") ? "final" : getUfcCardStatus(event);
    const fightResults = Object.fromEntries(mainCard.filter(fight => fight.winner).map(fight => [fight.id, fight.winner]));
    const venue = event.competitions?.[0]?.venue?.fullName || event.venue?.fullName || "";

    cards.push({
      apiSource: "espn",
      apiEventId: String(event.id || `ufc-${date}-${cards.length + 1}`),
      sport: config.appSport,
      league: config.league,
      type: "FIGHT_CARD",
      title: event.shortName || event.name || `UFC Fight Card ${date || ""}`.trim(),
      startTime,
      status,
      fights: mainCard,
      fightResults,
      score: null,
      odds: event.competitions?.[0]?.odds?.[0]?.details || "API schedule import",
      venue,
      liveStats: [
        { label: "Status", value: labelStatus(status) },
        { label: "Fights", value: String(mainCard.length) },
        { label: "Main event", value: (mainCard.find(fight => fight.cardRole === "main-event") || mainCard[mainCard.length - 1])?.label || "TBD" },
        { label: "Venue", value: venue || "Venue pending" }
      ],
      externalIds: {
        source: event.__ufcSource || (event.__fightCenterMainCount ? "espn-fightcenter" : "espn"),
        espnEventId: String(event.id || ""),
        espnUid: event.uid || "",
        espnGuid: event.guid || "",
        espnFightCenterEventId: event.__fightCenterEventId || String(event.id || ""),
        espnFightCenterUrl: event.__fightCenterUrl || "",
        ufcOverrideApplied: Boolean(event.__ufcOverrideApplied),
        ufcOverrideEventId: event.__ufcOverrideEventId || "",
        ufcSourceDiagnostics: event.__ufcSourceDiagnostics || null
      },
      intel: event.__ufcOverrideApplied
        ? `UFC main card repaired to ${mainCard.length} verified fights after ESPN returned an incomplete card. Existing fight IDs and bets remain protected during sync.`
        : event.__fightCenterMainCount
          ? `UFC main card imported from ${event.__ufcSource === "espn-core-event" ? "ESPN Core Event" : "ESPN FightCenter"} (${event.__fightCenterMainCount} fights), with independent bets inside each fight.`
          : "UFC fight card imported from ESPN MMA scoreboard data. Main card is treated as one card, with independent bets inside each fight."
    });
  }

  if (cards.length) return cards;

  return [];
}

function mapEvent(event, config) {
  if (config.eventType === "RANKED_FINISH") return mapRacingEvent(event, config);
  if (config.eventType === "FIGHT_CARD") return mapUfcFightCards([event], config, "")[0] || mapTeamEvent(event, config);
  return mapTeamEvent(event, config);
}

function collectEvents(data) {
  if (Array.isArray(data?.events)) return data.events;

  const candidates = [];
  for (const sport of data?.sports || []) {
    for (const league of sport?.leagues || []) {
      if (Array.isArray(league?.events)) candidates.push(...league.events);
    }
  }

  if (Array.isArray(data?.content?.sbData?.events)) candidates.push(...data.content.sbData.events);
  if (Array.isArray(data?.scoreboard?.events)) candidates.push(...data.scoreboard.events);
  return candidates;
}

async function fetchEspnJson(url) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "accept": "application/json",
      "cache-control": "no-cache, no-store, max-age=0",
      "pragma": "no-cache",
      "user-agent": "Everyone-Loses/1.0"
    }
  });

  if (!response.ok) {
    const error = new Error(`ESPN request failed with ${response.status}`);
    error.status = response.status;
    error.url = url;
    throw error;
  }

  return response.json();
}

function cardLabelText(card = {}, key = "") {
  return [
    key,
    card?.name,
    card?.displayName,
    card?.shortName,
    card?.label,
    card?.title,
    card?.type?.text,
    card?.type?.name,
    card?.section
  ].filter(Boolean).join(" ").toLowerCase();
}

function collectCompetitionArrays(node, path = "root", depth = 0, seen = new Set(), out = []) {
  if (!node || typeof node !== "object" || depth > 7 || seen.has(node)) return out;
  seen.add(node);

  if (Array.isArray(node.competitions) && node.competitions.length) {
    out.push({
      path,
      label: cardLabelText(node, path),
      competitions: node.competitions
    });
  }

  if (Array.isArray(node)) {
    node.forEach((item, index) => collectCompetitionArrays(item, `${path}[${index}]`, depth + 1, seen, out));
    return out;
  }

  for (const [key, value] of Object.entries(node)) {
    if (!value || typeof value !== "object") continue;
    if (["competitors", "athletes", "statistics", "links", "images"].includes(key)) continue;
    collectCompetitionArrays(value, `${path}.${key}`, depth + 1, seen, out);
  }
  return out;
}

function ufcFightCenterMainCompetitions(payload = {}) {
  const candidates = collectCompetitionArrays(payload);
  const explicitMain = candidates
    .filter(candidate => /(^|[^a-z])main([^a-z]|$)/.test(candidate.label) && !/prelim/.test(candidate.label))
    .sort((a, b) => b.competitions.length - a.competitions.length);
  if (explicitMain.length) return explicitMain[0].competitions;

  const cards = payload?.cards;
  if (cards && typeof cards === "object") {
    const entries = Array.isArray(cards) ? cards.map((card, index) => [String(index), card]) : Object.entries(cards);
    for (const [key, card] of entries) {
      const label = cardLabelText(card, key);
      if (/main/.test(label) && !/prelim/.test(label) && Array.isArray(card?.competitions) && card.competitions.length) {
        return card.competitions;
      }
    }
  }

  return [];
}

async function fetchJsonRef(ref) {
  const url = String(ref || "").replace(/^http:/, "https:");
  if (!url) return null;
  try {
    return await fetchEspnJson(url);
  } catch {
    return null;
  }
}

async function expandCoreUfcCompetition(item = {}) {
  const competition = item?.$ref ? await fetchJsonRef(item.$ref) : item;
  if (!competition || typeof competition !== "object") return null;

  const competitors = [];
  for (const raw of competition.competitors || []) {
    const competitor = raw?.$ref ? await fetchJsonRef(raw.$ref) : raw;
    if (!competitor || typeof competitor !== "object") continue;
    const athlete = competitor?.athlete?.$ref ? await fetchJsonRef(competitor.athlete.$ref) : competitor.athlete;
    competitors.push({ ...competitor, athlete: athlete || competitor.athlete || null });
  }

  return { ...competition, competitors: competitors.length ? competitors : competition.competitors || [] };
}

async function fetchCoreUfcEvent(eventId) {
  const url = `https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/events/${encodeURIComponent(eventId)}?lang=en&region=us`;
  try {
    const payload = await fetchEspnJson(url);
    const rawCompetitions = Array.isArray(payload?.competitions) ? payload.competitions : [];
    if (!rawCompetitions.length) return null;
    const competitions = (await Promise.all(rawCompetitions.map(expandCoreUfcCompetition))).filter(Boolean);
    if (!competitions.length) return null;
    return { payload, competitions, url };
  } catch {
    return null;
  }
}

function competitionPairCount(competitions = []) {
  return competitions.filter(competition => {
    const names = (competition?.competitors || []).map(ufcFighterName).filter(Boolean);
    return names.length >= 2;
  }).length;
}

async function enrichUfcEventWithFightCenter(event = {}) {
  const eventIds = ufcEventIdCandidates(event);
  if (!eventIds.length) return event;

  let best = null;
  const diagnostics = {
    scoreboardCount: competitionPairCount(event.competitions || []),
    fightCenterCount: 0,
    coreCount: 0,
    attemptedEventIds: eventIds
  };

  for (const eventId of eventIds) {
    const fightCenterUrl = `https://site.web.api.espn.com/apis/common/v3/sports/mma/ufc/fightcenter/${encodeURIComponent(eventId)}?region=us&lang=en&contentorigin=espn&showAirings=buy%2Clive%2Creplay&buyWindow=1m`;
    try {
      const payload = await fetchEspnJson(fightCenterUrl);
      const mainCompetitions = ufcFightCenterMainCompetitions(payload);
      const count = competitionPairCount(mainCompetitions);
      diagnostics.fightCenterCount = Math.max(diagnostics.fightCenterCount, count);
      if (count && (!best || count > best.count)) {
        best = {
          count,
          source: "espn-fightcenter",
          eventId,
          url: fightCenterUrl,
          payload,
          detailEvent: payload?.event && typeof payload.event === "object" ? payload.event : {},
          competitions: mainCompetitions
        };
      }
    } catch {
      // Continue to the core event endpoint and any alternate event IDs.
    }

    const core = await fetchCoreUfcEvent(eventId);
    if (core) {
      const explicitMain = core.competitions.filter(competition => {
        const section = ufcCardSection(competition);
        return section && section !== "prelims";
      });
      const coreCompetitions = explicitMain.length ? explicitMain : core.competitions;
      const count = competitionPairCount(coreCompetitions);
      diagnostics.coreCount = Math.max(diagnostics.coreCount, count);
      // Only replace a labeled FightCenter main card with core data when core is
      // clearly more complete. Otherwise core may include prelims as well.
      if (count && (!best || (count > best.count && (explicitMain.length || best.source !== "espn-fightcenter")))) {
        best = {
          count,
          source: "espn-core-event",
          eventId,
          url: core.url,
          payload: core.payload,
          detailEvent: core.payload,
          competitions: coreCompetitions
        };
      }
    }
  }

  if (!best) {
    return {
      ...event,
      __ufcSourceDiagnostics: diagnostics
    };
  }

  const detailEvent = best.detailEvent || {};
  return {
    ...event,
    ...detailEvent,
    id: event.id || detailEvent.id || best.eventId,
    uid: event.uid || detailEvent.uid || "",
    guid: event.guid || detailEvent.guid || "",
    name: detailEvent.name || event.name,
    shortName: detailEvent.shortName || event.shortName,
    date: detailEvent.date || event.date,
    status: detailEvent.status || event.status,
    competitions: best.competitions.map(competition => ({
      ...competition,
      __cardSection: ufcCardSection(competition) || "main-card",
      __fightCenterEventId: best.eventId
    })),
    __fightCenterEventId: best.eventId,
    __fightCenterUrl: best.url,
    __fightCenterMainCount: best.count,
    __ufcSource: best.source,
    __ufcSourceDiagnostics: diagnostics
  };
}

async function enrichUfcEventsWithFightCenter(rawEvents = []) {
  const events = Array.isArray(rawEvents) ? rawEvents : [];
  return Promise.all(events.map(event => enrichUfcEventWithFightCenter(event)));
}



async function fetchTextUrl(url, label = "request") {
  const response = await fetch(url, {
    headers: {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,text/plain,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      "pragma": "no-cache",
      "origin": "https://leaderboard.indycar.com",
      "referer": "https://leaderboard.indycar.com/",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
    }
  });

  if (!response.ok) {
    const error = new Error(`${label} failed with ${response.status}`);
    error.status = response.status;
    error.url = url;
    throw error;
  }

  return response.text();
}

async function fetchJsonUrl(url, label = "request") {
  const response = await fetch(url, {
    headers: {
      "accept": "application/json,text/plain,*/*",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      "pragma": "no-cache",
      "origin": "https://leaderboard.indycar.com",
      "referer": "https://leaderboard.indycar.com/",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
    }
  });

  if (!response.ok) {
    const error = new Error(`${label} failed with ${response.status}`);
    error.status = response.status;
    error.url = url;
    throw error;
  }

  return response.json();
}

function parseNascarDriverName(vehicle) {
  const driver = vehicle?.driver || vehicle?.Driver || {};
  return driver.full_name
    || driver.fullName
    || driver.display_name
    || driver.name
    || [driver.first_name || driver.firstName, driver.last_name || driver.lastName].filter(Boolean).join(" ")
    || vehicle?.driver_name
    || vehicle?.driverName
    || vehicle?.full_name
    || vehicle?.name
    || "";
}

function parseNascarPosition(vehicle, fallback) {
  const candidates = [
    vehicle?.running_position,
    vehicle?.runningPosition,
    vehicle?.position,
    vehicle?.Pos,
    vehicle?.rank,
    vehicle?.order
  ];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

function nascarDetail(vehicle) {
  const bits = [];
  const lap = vehicle?.laps_completed ?? vehicle?.lapsCompleted ?? vehicle?.lap ?? vehicle?.current_lap;
  const delta = vehicle?.delta ?? vehicle?.delta_leader ?? vehicle?.deltaLeader ?? vehicle?.behind_leader;
  const status = vehicle?.status ?? vehicle?.vehicle_status ?? vehicle?.running_status;
  const car = vehicle?.vehicle_number ?? vehicle?.car_number ?? vehicle?.number;
  if (car) bits.push(`#${car}`);
  if (lap !== undefined && lap !== null && String(lap) !== "") bits.push(`Lap ${lap}`);
  if (delta !== undefined && delta !== null && String(delta) !== "") bits.push(String(delta));
  if (status && !/active/i.test(String(status))) bits.push(String(status));
  return bits.join(" · ");
}

async function fetchNascarOfficialLeaderboard() {
  const url = "https://cf.nascar.com/live/feeds/live-feed.json";
  const data = await fetchJsonUrl(url, "NASCAR live feed");
  const vehicles = data?.vehicles || data?.Vehicles || data?.live_feed?.vehicles || [];
  if (!Array.isArray(vehicles) || !vehicles.length) return null;

  const rows = vehicles
    .map((vehicle, index) => {
      const name = parseNascarDriverName(vehicle);
      if (!name) return null;
      return {
        position: parseNascarPosition(vehicle, index + 1),
        name,
        detail: nascarDetail(vehicle),
        carNumber: vehicle?.vehicle_number || vehicle?.car_number || vehicle?.number || ""
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.position || 999) - Number(b.position || 999));

  if (!rows.length) return null;
  return {
    source: "NASCAR official live feed",
    sourceUrl: url,
    rows,
    stats: [
      { label: "Source", value: "NASCAR.com live feed" },
      { label: "Cars", value: String(rows.length) },
      { label: "Leader", value: rows[0]?.name || "Pending" }
    ]
  };
}


function indyCarNameFromRow(row) {
  return row?.driver?.fullName
    || row?.driver?.displayName
    || row?.driver?.name
    || row?.entrant?.driverName
    || row?.competitor?.name
    || row?.fullName
    || row?.displayName
    || row?.driverName
    || row?.name
    || [row?.firstName, row?.lastName].filter(Boolean).join(" ")
    || "";
}

function indyCarPositionFromRow(row, fallback) {
  const candidates = [
    row?.liveRank,
    row?.overallRank,
    row?.runningPosition,
    row?.running_position,
    row?.position,
    row?.rank,
    row?.pos,
    row?.order,
    row?.place,
    row?.p
  ];
  for (const value of candidates) {
    const n = Number(String(value || "").replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

function indyCarDetailFromRow(row) {
  const bits = [];
  const car = row?.carNumber || row?.car_number || row?.number || row?.no || row?.car;
  const lap = row?.lapsCompleted ?? row?.laps_completed ?? row?.lap ?? row?.currentLap ?? row?.laps;
  const speed = row?.LastSpeed ?? row?.BestSpeed ?? row?.AverageSpeed ?? row?.speed ?? row?.lastLapSpeed ?? row?.bestLapSpeed;
  const gap = row?.liveGap ?? row?.gap ?? row?.interval ?? row?.behind ?? row?.diff ?? row?.delta ?? row?.timeBehindLeader;
  const status = row?.status || row?.trackStatus || row?.runningStatus || row?.state;
  if (car) bits.push(`#${car}`);
  if (lap !== undefined && lap !== null && String(lap) !== "") bits.push(`Lap ${lap}`);
  if (gap !== undefined && gap !== null && String(gap) !== "") bits.push(String(gap));
  if (speed !== undefined && speed !== null && String(speed) !== "") bits.push(`${speed} mph`);
  if (status && !/active|running/i.test(String(status))) bits.push(String(status));
  return bits.join(" · ");
}

function looksLikeIndyCarRow(row) {
  if (!row || typeof row !== "object") return false;
  const name = indyCarNameFromRow(row);
  if (!name || String(name).length < 3) return false;
  return ["liveRank", "overallRank", "position", "rank", "pos", "runningPosition", "running_position", "carNumber", "car_number", "DriverID", "resultID", "firstName", "lastName", "lap", "laps", "gap", "liveGap", "interval"].some(key => row[key] !== undefined)
    || row.driver
    || row.competitor
    || row.entrant;
}

function collectIndyCarArrays(node, arrays = []) {
  if (!node || typeof node !== "object") return arrays;
  if (Array.isArray(node)) {
    const rows = node.filter(looksLikeIndyCarRow);
    if (rows.length >= 3) arrays.push(rows);
    node.forEach(item => collectIndyCarArrays(item, arrays));
    return arrays;
  }
  Object.values(node).forEach(value => collectIndyCarArrays(value, arrays));
  return arrays;
}

function extractJsonScriptObjects(html) {
  const objects = [];
  const scriptMatches = String(html || "").matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scriptMatches) {
    const body = match[1] || "";
    const nextMatch = body.match(/self\.__next_f\.push\(\[[^,]+,"([\s\S]*?)"\]\)/);
    const candidates = [];
    const jsonOnly = body.trim();
    if (jsonOnly.startsWith("{") || jsonOnly.startsWith("[")) candidates.push(jsonOnly);
    const nextData = body.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
    if (nextData?.[1]) candidates.push(nextData[1]);
    const stateMatches = body.matchAll(/(?:__INITIAL_STATE__|__APOLLO_STATE__|__PRELOADED_STATE__)\s*=\s*({[\s\S]*?});/g);
    for (const state of stateMatches) candidates.push(state[1]);
    if (nextMatch?.[1]) candidates.push(nextMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n"));

    for (const candidate of candidates) {
      try { objects.push(JSON.parse(candidate)); } catch { /* ignore */ }
    }
  }

  const next = String(html || "").match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (next?.[1]) {
    try { objects.push(JSON.parse(next[1])); } catch { /* ignore */ }
  }
  return objects;
}

function rowsFromIndyCarHtml(html) {
  const objects = extractJsonScriptObjects(html);
  const arrays = [];
  for (const object of objects) collectIndyCarArrays(object, arrays);
  const best = arrays.sort((a, b) => b.length - a.length)[0] || [];
  const seen = new Set();
  const rows = best
    .map((row, index) => {
      const name = indyCarNameFromRow(row).trim();
      if (!name || seen.has(name.toLowerCase())) return null;
      seen.add(name.toLowerCase());
      return {
        position: indyCarPositionFromRow(row, index + 1),
        name,
        detail: indyCarDetailFromRow(row)
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.position || 999) - Number(b.position || 999));

  return rows.length >= 3 ? rows : rowsFromIndyCarText(html);
}

function stripHtmlToLines(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(tr|div|li|p|span|td|th|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .split(/\n+/)
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function rowsFromIndyCarText(html) {
  const text = stripHtmlToLines(html).join("\n");
  if (/no track activity|browser not compatible/i.test(text) && !/\b1\b.+\b(Palou|Dixon|O'Ward|Newgarden|McLaughlin|Herta|Kirkwood|Ericsson|Power|Rosenqvist)\b/i.test(text)) return [];

  const lines = stripHtmlToLines(html);
  const rows = [];
  const seen = new Set();
  const driverNamePattern = "([A-Z][A-Za-z.'’\-]+(?:\s+[A-Z][A-Za-z.'’\-]+){0,3})";
  const detailPattern = "((?:#?\d{1,2}|Lap\s*\d+|Laps?\s*\d+|[+\-]?\d+(?:\.\d+)?s?|Pits?\s*\d+|Running|Out|Pit|Stopped|Retired|[A-Z]{2,})[^\n]*)?";
  const patterns = [
    new RegExp(`^\s*(\d{1,2})\s+(?:#\s*\d{1,2}\s+)?${driverNamePattern}\s*${detailPattern}$`, "i"),
    new RegExp(`^\s*(?:P|Pos|Position)\s*(\d{1,2})\s+${driverNamePattern}\s*${detailPattern}$`, "i"),
    new RegExp(`^\s*${driverNamePattern}\s+(?:P|Pos|Position)?\s*(\d{1,2})\s*${detailPattern}$`, "i")
  ];

  for (const line of lines) {
    if (/^(pos|position|driver|car|lap|time|gap|interval|rank|leaderboard|live timing|privacy|terms|schedule|results|standings)$/i.test(line)) continue;
    if (line.length > 160) continue;

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match) continue;

      let position;
      let name;
      let detail;
      if (/^[A-Z]/.test(match[1]) && match[2]) {
        name = match[1];
        position = Number(match[2]);
        detail = match[3] || "";
      } else {
        position = Number(match[1]);
        name = match[2];
        detail = match[3] || "";
      }

      if (!Number.isFinite(position) || position < 1 || position > 40 || !name) continue;
      name = name.replace(/\s+(Running|Out|Pit|Stopped|Retired).*$/i, "").trim();
      if (name.split(/\s+/).length < 2) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ position, name, detail: String(detail || "").trim() });
      break;
    }
  }

  return rows
    .sort((a, b) => Number(a.position || 999) - Number(b.position || 999))
    .slice(0, 35);
}

function rowsFromIndyCarPayload(payload) {
  const arrays = [];
  collectIndyCarArrays(payload, arrays);
  const best = arrays.sort((a, b) => b.length - a.length)[0] || [];
  const seen = new Set();
  return best
    .map((row, index) => {
      const name = indyCarNameFromRow(row).trim();
      if (!name || seen.has(name.toLowerCase())) return null;
      seen.add(name.toLowerCase());
      return {
        position: indyCarPositionFromRow(row, index + 1),
        name,
        detail: indyCarDetailFromRow(row)
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.position || 999) - Number(b.position || 999));
}

async function tryIndyCarJsonEndpoint(url) {
  try {
    const payload = await fetchJsonUrl(url, "INDYCAR live data");
    const rows = rowsFromIndyCarPayload(payload);
    if (rows.length >= 3) return { rows, url };
  } catch {
    // Some candidate URLs are intentionally speculative and may 404 outside live sessions.
  }
  return null;
}

async function fetchIndyCarOfficialLeaderboard() {
  const cacheBust = Date.now();
  const jsonCandidates = [
    `https://indycar.blob.core.windows.net/racecontrol/timingscoring-ris.json?${cacheBust}`,
    `https://indycar.blob.core.windows.net/racecontrol/timingscoring.json?${cacheBust}`,
    `https://indycar.blob.core.windows.net/racecontrol/driversfeed.json?${cacheBust}`,
    `https://leaderboard.indycar.com/api/leaderboard?t=${cacheBust}`,
    `https://leaderboard.indycar.com/api/live?t=${cacheBust}`,
    `https://leaderboard.indycar.com/api/timing?t=${cacheBust}`,
    `https://leaderboard.indycar.com/api/session?t=${cacheBust}`,
    `https://leaderboard.indycar.com/api/scoring?t=${cacheBust}`,
    `https://www.indycar.com/api/leaderboard?t=${cacheBust}`,
    `https://www.indycar.com/api/live/leaderboard?t=${cacheBust}`
  ];

  for (const url of jsonCandidates) {
    const result = await tryIndyCarJsonEndpoint(url);
    if (result?.rows?.length >= 3) {
      return {
        source: "INDYCAR official live leaderboard",
        sourceUrl: result.url,
        rows: result.rows,
        stats: [
          { label: "Source", value: "INDYCAR Race Control" },
          { label: "Cars", value: String(result.rows.length) },
          { label: "Leader", value: result.rows[0]?.name || "Pending" }
        ]
      };
    }
  }

  const urls = [
    `https://leaderboard.indycar.com/?t=${cacheBust}`,
    `https://www.indycar.com/leaderboard?type=false&t=${cacheBust}`,
    `https://www.indycar.com/leaderboard?t=${cacheBust}`
  ];

  for (const url of urls) {
    try {
      const html = await fetchTextUrl(url, "INDYCAR live leaderboard");
      const rows = rowsFromIndyCarHtml(html);
      if (rows.length >= 3) {
        return {
          source: "INDYCAR official live leaderboard",
          sourceUrl: url,
          rows,
          stats: [
            { label: "Source", value: "INDYCAR Race Control" },
            { label: "Cars", value: String(rows.length) },
            { label: "Leader", value: rows[0]?.name || "Pending" }
          ]
        };
      }
    } catch {
      // Try the next official leaderboard surface.
    }
  }

  return null;
}

function motoGpDateFromHead(head) {
  const raw = String(head?.datet || head?.datst || "");
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}T12:00:00Z`;
  return new Date().toISOString();
}

function motoGpStatus(head) {
  const status = String(head?.session_status_name || head?.session_status_id || "").toUpperCase();
  if (["F", "FINISHED", "FINAL"].includes(status)) return "final";
  if (["L", "LIVE", "A", "ACTIVE", "R", "RUNNING"].includes(status)) return "live";
  return "pregame";
}

async function fetchMotoGpPulseLiveEvents(date) {
  const url = "https://api.motogp.pulselive.com/motogp/v1/timing-gateway/livetiming-lite";
  const data = await fetchJsonUrl(url, "MotoGP PulseLive timing");
  const head = data?.head || {};
  const ridersObj = data?.rider || data?.riders || {};
  const rows = Object.values(ridersObj)
    .map((rider, index) => {
      const surname = rider?.rider_surname ? String(rider.rider_surname).toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : "";
      const first = rider?.rider_name || "";
      const short = rider?.rider_shortname || "";
      const name = [first, surname].filter(Boolean).join(" ") || short;
      if (!name) return null;
      const position = Number(rider?.pos || rider?.order || index + 1);
      const detailBits = [];
      if (rider?.gap_first) detailBits.push(`Gap ${rider.gap_first}`);
      if (rider?.last_lap_time) detailBits.push(`Last ${rider.last_lap_time}`);
      if (rider?.team_name) detailBits.push(rider.team_name);
      return { position: Number.isFinite(position) && position > 0 ? position : index + 1, name, detail: detailBits.join(" · ") };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.position || 999) - Number(b.position || 999));

  if (!rows.length) {
    return [];
  }

  const startTime = motoGpDateFromHead(head);
  const eventDate = startTime.slice(0, 10).replace(/-/g, "");
  if (date && eventDate !== date) {
    return [];
  }

  const status = motoGpStatus(head);
  return [{
    apiSource: "motogp-pulselive",
    apiEventId: `motogp-${head?.event_id || eventDate}-${head?.session_id || "live"}`,
    sport: "racing",
    league: "MotoGP",
    type: "RANKED_FINISH",
    title: head?.event_tv_name || head?.session_name || "MotoGP live timing",
    startTime,
    status,
    participants: rows.map(row => row.name),
    leaderboard: rows,
    leaderboardSource: "MotoGP PulseLive timing",
    leaderboardVerified: true,
    liveStats: [
      { label: "Source", value: "MotoGP PulseLive" },
      { label: "Session", value: head?.session_name || head?.session_shortname || "Live timing" },
      { label: "Leader", value: rows[0]?.name || "Pending" }
    ],
    resultOrder: status === "final" ? rows.map(row => row.name) : [],
    score: null,
    odds: "API timing import",
    externalIds: {
      source: "motogp-pulselive",
      eventId: String(head?.event_id || ""),
      sessionId: String(head?.session_id || ""),
      sourceUrl: url
    },
    intel: "MotoGP event imported from MotoGP PulseLive timing data. Verify the session before users bet."
  }];
}

function applyOfficialRacingFallback(events, config) {
  if (!Array.isArray(events)) return [];
  if (!["NASCAR", "IndyCar"].includes(config.league)) return events;

  const sourceName = config.league === "IndyCar" ? "INDYCAR live timing" : "NASCAR.com feed";
  const sourceLabel = config.league === "IndyCar" ? "INDYCAR official leaderboard pending" : "NASCAR official live feed pending";

  // ESPN racing event objects are useful for schedule/import, but their competitor ordering can be standings/start/grid-like.
  // Do not show those rows as a live leaderboard unless a league-specific live source verifies positions.
  return events.map(event => ({
    ...event,
    leaderboard: [],
    leaderboardSource: sourceLabel,
    leaderboardVerified: false,
    liveStats: [
      { label: "Source", value: `${sourceName} pending` },
      { label: "Status", value: labelStatus(event.status) },
      { label: "Leaderboard", value: "Not verified yet" }
    ],
    intel: `${config.league} schedule imported from ESPN. Live running order is only shown after ${sourceName} verifies positions.`
  }));
}

function labelStatus(status) {
  if (status === "final") return "Final";
  if (status === "live") return "Live";
  return "Pregame";
}


function ymdToIsoDate(yyyymmdd) {
  const clean = String(yyyymmdd || "").replace(/[^0-9]/g, "").slice(0, 8);
  if (clean.length !== 8) return ymd();
  return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
}

function combineF1DateTime(date, time) {
  if (date && time) return `${date}T${String(time).replace(/^T/, "")}`;
  if (date) return `${date}T12:00:00Z`;
  return new Date().toISOString();
}

function f1DriverName(result) {
  const driver = result?.Driver || {};
  return [driver.givenName, driver.familyName].filter(Boolean).join(" ")
    || driver.code
    || driver.driverId
    || result?.driver
    || "Driver";
}

function f1ResultDetail(result) {
  const constructorName = result?.Constructor?.name || "";
  const status = result?.status || "";
  const time = result?.Time?.time || "";
  const grid = result?.grid && String(result.grid) !== "0" ? `Grid ${result.grid}` : "";
  return [constructorName, time, status, grid].filter(Boolean).join(" · ");
}

function addDaysIso(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoDateToMs(isoDate) {
  return new Date(`${isoDate}T12:00:00Z`).getTime();
}

function f1RaceMatchesRequestedWindow(race, requestedIso) {
  const raceMs = isoDateToMs(race?.date);
  const requestedMs = isoDateToMs(requestedIso);
  if (!Number.isFinite(raceMs) || !Number.isFinite(requestedMs)) return false;

  // Import the actual Grand Prix race when the app syncs any date from the
  // race-weekend lead-in through race day. This prevents ESPN practice/session
  // dates from creating a fake Friday-ranked event for a Sunday race.
  return raceMs >= requestedMs && raceMs <= isoDateToMs(addDaysIso(requestedIso, 3));
}

function f1StandingDriverName(standing) {
  const driver = standing?.Driver || {};
  return [driver.givenName, driver.familyName].filter(Boolean).join(" ")
    || driver.code
    || driver.driverId
    || "Driver";
}

function f1StandingDetail(standing) {
  const constructors = Array.isArray(standing?.Constructors) ? standing.Constructors.map(item => item.name).filter(Boolean).join(" / ") : "";
  const points = standing?.points ? `${standing.points} pts` : "";
  return [constructors, points, "Season entry"].filter(Boolean).join(" · ");
}

async function fetchJolpicaF1DriverEntries() {
  try {
    const standingsUrl = `https://api.jolpi.ca/ergast/f1/current/driverStandings.json`;
    const standingsData = await fetchJsonUrl(standingsUrl, "F1 driver standings");
    const standings = standingsData?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
    const rows = standings.map((standing, index) => ({
      position: Number(standing.position) || index + 1,
      name: f1StandingDriverName(standing),
      detail: f1StandingDetail(standing),
      constructorName: standing?.Constructors?.[0]?.name || "",
      points: standing?.points || ""
    })).filter(row => row.name);
    if (rows.length) return rows;
  } catch {
    // Fall back to a full-season starter list rather than ESPN's partial top-10 ordering.
  }

  return DEFAULT_RACING_PARTICIPANTS.F1.map((name, index) => ({
    position: index + 1,
    name,
    detail: "Season entry"
  }));
}

async function fetchJolpicaF1ForDate(date) {
  const isoDate = ymdToIsoDate(date);
  const scheduleUrl = `https://api.jolpi.ca/ergast/f1/current.json`;
  const scheduleData = await fetchJsonUrl(scheduleUrl, "F1 schedule");
  const races = scheduleData?.MRData?.RaceTable?.Races || [];

  const matching = races
    .filter(race => f1RaceMatchesRequestedWindow(race, isoDate))
    .sort((a, b) => isoDateToMs(a.date) - isoDateToMs(b.date))[0];

  if (!matching) {
    return null;
  }

  const round = matching.round;
  const resultsUrl = `https://api.jolpi.ca/ergast/f1/current/${round}/results.json`;
  const resultsData = await fetchJsonUrl(resultsUrl, "F1 results");
  const resultRace = resultsData?.MRData?.RaceTable?.Races?.[0];
  const results = resultRace?.Results || [];

  const startTime = combineF1DateTime(matching.date, matching.time);
  const baseEvent = {
    apiSource: "jolpica-f1",
    apiEventId: `f1-${matching.season || "current"}-${round}`,
    sport: "racing",
    league: "F1",
    type: "RANKED_FINISH",
    title: matching.raceName || "F1 Grand Prix",
    startTime,
    status: results.length ? "final" : "pregame",
    participants: [],
    leaderboard: [],
    leaderboardSource: "Jolpica Ergast F1 results",
    leaderboardVerified: !!results.length,
    liveStats: [
      { label: "Source", value: results.length ? "Jolpica F1 results" : "Jolpica F1 schedule + driver standings" },
      { label: "Round", value: String(round || "TBD") },
      { label: "Race date", value: matching.date || "TBD" },
      { label: "Circuit", value: matching.Circuit?.circuitName || "TBD" }
    ],
    resultOrder: [],
    score: null,
    odds: "API schedule import",
    externalIds: {
      source: "jolpica-f1",
      f1Season: String(matching.season || "current"),
      f1Round: String(round || ""),
      f1RaceName: matching.raceName || ""
    },
    intel: results.length
      ? "F1 final leaderboard imported from Jolpica/Ergast results, not ESPN ordering."
      : "F1 Grand Prix imported from Jolpica/Ergast schedule with a full driver-standings entry list. Final results will appear after the race results endpoint updates."
  };

  if (results.length) {
    const rows = results.map((result, index) => ({
      position: Number(result.position) || index + 1,
      name: f1DriverName(result),
      detail: f1ResultDetail(result),
      constructorName: result?.Constructor?.name || "",
      points: result?.points || ""
    }));

    baseEvent.participants = rows.map(row => row.name);
    baseEvent.leaderboard = rows;
    baseEvent.resultOrder = rows.map(row => row.name);
    baseEvent.liveStats = [
      { label: "Source", value: "Jolpica F1 results" },
      { label: "Winner", value: rows[0]?.name || "TBD" },
      { label: "Classified", value: String(rows.length) },
      { label: "Circuit", value: matching.Circuit?.circuitName || "TBD" }
    ];
  } else {
    const rows = await fetchJolpicaF1DriverEntries();
    baseEvent.participants = rows.map(row => row.name);
    baseEvent.leaderboard = rows;
    baseEvent.leaderboardSource = "Jolpica Ergast F1 driver standings entry list";
    baseEvent.liveStats = [
      { label: "Source", value: "Jolpica F1 schedule + driver standings" },
      { label: "Round", value: String(round || "TBD") },
      { label: "Entries", value: String(rows.length) },
      { label: "Race date", value: matching.date || "TBD" },
      { label: "Circuit", value: matching.Circuit?.circuitName || "TBD" }
    ];
  }

  return baseEvent;
}


function statValue(stat) {
  if (stat?.displayValue !== undefined && stat.displayValue !== null) return String(stat.displayValue);
  if (stat?.value !== undefined && stat.value !== null) return String(stat.value);
  return "";
}

function addStatRow(rows, label, value, max = 12, meta = {}) {
  const cleanLabel = String(label || "").trim();
  const cleanValue = String(value ?? "").trim();
  if (!cleanLabel || !cleanValue || rows.length >= max) return false;
  if (/^(source|venue|status|odds|weather|away scoring|home scoring)$/i.test(cleanLabel)) return false;
  if (/\bby period\b|^\d+(?:-\d+)+$/i.test(cleanValue)) return false;
  if (/^(scoreboard active|detailed boxscore unavailable|unavailable)$/i.test(cleanValue)) return false;
  if (rows.some(row => row.label === cleanLabel && row.value === cleanValue)) return false;
  rows.push({ label: cleanLabel, value: cleanValue, ...meta });
  return true;
}

function formatPeriodLine(teamCode, competitor) {
  const lines = competitor?.linescores || [];
  if (!teamCode || !Array.isArray(lines) || !lines.length) return "";
  const values = lines.map(item => item?.displayValue ?? item?.value).filter(value => value !== undefined && value !== null && value !== "");
  return values.length ? `${teamCode} by period: ${values.join("-")}` : "";
}

function teamCodeFromBlock(teamBlock) {
  return cleanCode(teamBlock?.team?.abbreviation || teamBlock?.team?.shortDisplayName || teamBlock?.team?.displayName || "", "");
}

function statLabel(stat) {
  return String(stat?.label || stat?.displayName || stat?.name || "").trim();
}

function statKey(label) {
  return String(label || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function statMeaningScore(label, value, league = "") {
  const key = statKey(label);
  const val = String(value || "").trim();
  if (!key || !val) return -999;

  // Prefer team-level, game-shaping stats. These vary by sport, but this order keeps
  // baseball from devolving into only hitter rows while also working for soccer, NBA, NFL, NHL.
  const priorities = [
    [/^(runs?|r)$/i, 120],
    [/^(hits?|h)$/i, 115],
    [/^(errors?|e)$/i, 110],
    [/left on base|lob/i, 92],
    [/earned runs?|era|whip|strikeouts?|walks?|pitch(es|ing)?|k\/?bb/i, 88],
    [/field goal|fg|three|3pt|free throw|rebounds?|assists?|turnovers?|steals?|blocks?/i, 86],
    [/shots? on goal|sog|shots?|saves?|corners?|fouls?|possession|yellow|red/i, 84],
    [/yards?|first downs?|third down|red zone|sacks?|interceptions?|fumbles?|penalties/i, 82],
    [/power play|faceoffs?|hits?|blocked shots?|giveaways?|takeaways?/i, 80],
    [/score|total/i, 70]
  ];

  for (const [regex, score] of priorities) {
    if (regex.test(key)) return score;
  }
  return 25;
}

function getTeamStatCandidates(summary, mappedEvent, rawEvent) {
  const boxscoreTeams = summary?.boxscore?.teams || [];
  const desiredCodes = [mappedEvent?.away?.code, mappedEvent?.home?.code].map(code => cleanCode(code, "")).filter(Boolean);
  const blocksByCode = new Map();

  for (const block of boxscoreTeams) {
    const code = teamCodeFromBlock(block);
    if (code) blocksByCode.set(code, block);
  }

  const orderedBlocks = desiredCodes.map(code => blocksByCode.get(code)).filter(Boolean);
  for (const block of boxscoreTeams) {
    if (!orderedBlocks.includes(block)) orderedBlocks.push(block);
  }

  const result = new Map();

  for (const block of orderedBlocks.slice(0, 2)) {
    const code = teamCodeFromBlock(block);
    if (!code) continue;
    const rows = [];
    for (const stat of block?.statistics || []) {
      const label = statLabel(stat);
      const value = statValue(stat);
      if (!label || !value) continue;
      rows.push({
        label: `${code} ${label}`,
        value,
        teamCode: code,
        score: statMeaningScore(label, value, mappedEvent?.league)
      });
    }
    result.set(code, rows.sort((a, b) => b.score - a.score));
  }


  return { result, teamCodes: desiredCodes.length >= 2 ? desiredCodes : Array.from(result.keys()).slice(0, 2) };
}


function recordSummaryFromCompetitor(competitor) {
  const candidates = [];
  for (const record of competitor?.records || []) {
    candidates.push(record?.summary, record?.displayValue, record?.value, record?.record);
  }
  candidates.push(
    competitor?.record,
    competitor?.summary,
    competitor?.team?.recordSummary,
    competitor?.team?.record,
    competitor?.team?.records?.[0]?.summary,
    competitor?.team?.records?.[0]?.displayValue
  );

  return candidates
    .map(value => String(value || "").trim())
    .find(value => /^\d+\s*[-–]\s*\d+/.test(value) || /^\d+\s*[-–]\s*\d+\s*[-–]\s*\d+/.test(value)) || "";
}

function getCompetitorRecordCandidates(rawEvent, mappedEvent) {
  const competition = rawEvent?.competitions?.[0] || {};
  const desired = [
    { side: "away", code: mappedEvent?.away?.code },
    { side: "home", code: mappedEvent?.home?.code }
  ];
  const result = new Map(desired.map(item => [cleanCode(item.code, ""), []]).filter(([code]) => code));

  for (const item of desired) {
    const code = cleanCode(item.code, "");
    if (!code) continue;
    const competitor = getCompetitor(competition, item.side)
      || competition?.competitors?.find(comp => cleanCode(comp?.team?.abbreviation || comp?.team?.shortDisplayName || comp?.team?.displayName || "", "") === code);
    const summary = recordSummaryFromCompetitor(competitor);
    if (summary) {
      result.set(code, [{
        label: `${code} Record`,
        value: summary,
        teamCode: code,
        score: 60
      }]);
    }
  }

  return result;
}

function getPlayerOrLeaderCandidates(summary, mappedEvent) {
  const desiredCodes = [mappedEvent?.away?.code, mappedEvent?.home?.code].map(code => cleanCode(code, "")).filter(Boolean);
  const result = new Map(desiredCodes.map(code => [code, []]));
  const playerTeams = summary?.boxscore?.players || [];

  const wantedPlayerStats = ["IP", "H", "R", "ER", "BB", "SO", "K", "HR", "RBI", "AVG", "OPS", "PTS", "REB", "AST", "YDS", "TD", "SOG", "SV"];

  for (const teamBlock of playerTeams) {
    const code = cleanCode(teamBlock?.team?.abbreviation || teamBlock?.team?.shortDisplayName || teamBlock?.team?.displayName || "", "");
    if (!code) continue;
    const rows = result.get(code) || [];

    for (const category of teamBlock?.statistics || []) {
      const labels = category?.labels || category?.names || [];
      const athletes = category?.athletes || [];
      if (!Array.isArray(athletes) || !athletes.length) continue;

      const indexes = wantedPlayerStats
        .map(key => labels.findIndex(label => String(label).toUpperCase() === key))
        .filter(index => index >= 0);

      const categoryName = String(category?.name || category?.displayName || "").toLowerCase();
      const categoryBoost = /pitch/i.test(categoryName) ? 8 : 0;

      for (const athleteRow of athletes.slice(0, 8)) {
        const athlete = athleteRow?.athlete?.displayName || athleteRow?.athlete?.shortName || athleteRow?.displayName || "";
        const stats = athleteRow?.stats || [];
        if (!athlete || !Array.isArray(stats) || !stats.length) continue;
        const parts = indexes.slice(0, 4).map(index => `${stats[index]} ${labels[index]}`).filter(part => !/^undefined/i.test(part));
        if (!parts.length) continue;
        rows.push({
          label: `${code} ${athlete}`,
          value: parts.join(" · "),
          teamCode: code,
          score: 45 + categoryBoost
        });
      }
    }

    result.set(code, rows);
  }

  return result;
}


function mlbTeamIdForCode(code) {
  return MLB_TEAM_IDS[String(code || "").toUpperCase()] || null;
}

function seasonFromEvent(event) {
  const d = new Date(event?.startTime || Date.now());
  return Number.isFinite(d.getTime()) ? d.getUTCFullYear() : new Date().getUTCFullYear();
}

function formatMlbDecimal(value) {
  const str = String(value ?? "").trim();
  if (!str || str === "-.--" || /^nan$/i.test(str)) return "";
  const num = Number(str);
  if (!Number.isFinite(num)) return str;
  if (num > 1) return num.toFixed(3).replace(/^0/, "");
  return num.toFixed(3).replace(/^0/, "");
}

function formatMlbRate(value) {
  const str = String(value ?? "").trim();
  if (!str || str === "-.--" || /^nan$/i.test(str)) return "";
  const num = Number(str);
  return Number.isFinite(num) ? num.toFixed(2) : str;
}

function findMlbStatSplit(data) {
  const splits = data?.stats?.[0]?.splits || data?.stats?.[0]?.splits || [];
  return Array.isArray(splits) && splits.length ? splits[0]?.stat || {} : {};
}

async function fetchMlbTeamSeasonBlock(teamId, season, group) {
  if (!teamId) return {};
  const url = `https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&group=${encodeURIComponent(group)}&season=${encodeURIComponent(String(season))}`;
  try {
    const data = await fetchJsonUrl(url, `MLB ${group} stats`);
    return findMlbStatSplit(data);
  } catch {
    return {};
  }
}

function makeMlbTeamRows(code, hitting, pitching) {
  const rows = [];
  const avg = formatMlbDecimal(hitting.avg);
  const ops = formatMlbDecimal(hitting.ops);
  const runs = hitting.runs;
  const games = Number(hitting.gamesPlayed || hitting.games || 0);
  const runsPerGame = games && Number.isFinite(Number(runs)) ? (Number(runs) / games).toFixed(1) : "";
  const hr = hitting.homeRuns;
  const era = formatMlbRate(pitching.era);
  const whip = formatMlbRate(pitching.whip);
  const so = pitching.strikeOuts;
  const bb = pitching.baseOnBalls || pitching.walks;

  const hittingParts = [
    avg ? `${avg} AVG` : "",
    ops ? `${ops} OPS` : "",
    runsPerGame ? `${runsPerGame} R/G` : "",
    hr ? `${hr} HR` : ""
  ].filter(Boolean).slice(0, 3);

  const pitchingParts = [
    era ? `${era} ERA` : "",
    whip ? `${whip} WHIP` : "",
    so ? `${so} K` : "",
    bb ? `${bb} BB` : ""
  ].filter(Boolean).slice(0, 3);

  if (hittingParts.length) rows.push({ label: `${code} Hitting`, value: hittingParts.join(" · "), teamCode: code, source: "mlb-statsapi" });
  if (pitchingParts.length) rows.push({ label: `${code} Pitching`, value: pitchingParts.join(" · "), teamCode: code, source: "mlb-statsapi" });
  return rows;
}

async function fetchMlbPregameTeamStats(mappedEvent) {
  if (!mappedEvent || mappedEvent.league !== "MLB") return [];
  const season = seasonFromEvent(mappedEvent);
  const teams = [
    { code: mappedEvent.away?.code || "", id: mlbTeamIdForCode(mappedEvent.away?.code) },
    { code: mappedEvent.home?.code || "", id: mlbTeamIdForCode(mappedEvent.home?.code) }
  ].filter(team => team.code && team.id);

  if (teams.length < 2) return [];

  const rows = [];
  for (const team of teams) {
    const [hitting, pitching] = await Promise.all([
      fetchMlbTeamSeasonBlock(team.id, season, "hitting"),
      fetchMlbTeamSeasonBlock(team.id, season, "pitching")
    ]);
    rows.push(...makeMlbTeamRows(team.code, hitting, pitching));
  }

  // Order as away hitting, home hitting, away pitching, home pitching so both teams
  // appear before one side can fill the grid.
  const awayCode = teams[0]?.code;
  const homeCode = teams[1]?.code;
  const ordered = [
    rows.find(row => row.teamCode === awayCode && /hitting/i.test(row.label)),
    rows.find(row => row.teamCode === homeCode && /hitting/i.test(row.label)),
    rows.find(row => row.teamCode === awayCode && /pitching/i.test(row.label)),
    rows.find(row => row.teamCode === homeCode && /pitching/i.test(row.label))
  ].filter(Boolean);

  return ordered;
}

function mergeStatRows(primary = [], secondary = [], max = 4) {
  const rows = [];
  for (const row of [...primary, ...secondary]) {
    addStatRow(rows, row?.label, row?.value, max, { teamCode: row?.teamCode || "", source: row?.source || "" });
  }
  return rows.slice(0, max);
}

function pickUsefulTeamStats(summary, mappedEvent, rawEvent) {
  const rows = [];
  const { result: teamStats, teamCodes } = getTeamStatCandidates(summary, mappedEvent, rawEvent);
  const recordStats = getCompetitorRecordCandidates(rawEvent, mappedEvent);
  const playerStats = getPlayerOrLeaderCandidates(summary, mappedEvent);
  const maxRows = 4;
  const maxPerTeam = 2;
  const teamCounts = new Map(teamCodes.map(code => [code, 0]));

  function addBalanced(candidate) {
    if (!candidate || rows.length >= maxRows) return false;
    const code = candidate.teamCode || "";
    if (code && (teamCounts.get(code) || 0) >= maxPerTeam) return false;
    const added = addStatRow(rows, candidate.label, candidate.value, maxRows, { teamCode: code });
    if (added && code) teamCounts.set(code, (teamCounts.get(code) || 0) + 1);
    return added;
  }

  // Team-level rows come first. These are better than raw player dumps because they
  // describe the whole game, not just whichever athletes ESPN returns first.
  for (let round = 0; round < 4 && rows.length < maxRows; round += 1) {
    for (const code of teamCodes.slice(0, 2)) {
      addBalanced((teamStats.get(code) || [])[round]);
    }
  }

  // Pregame MLB often has no boxscore/player blocks yet, but ESPN usually still
  // exposes real team records on the event competitors. Use those before player rows
  // so tomorrow baseball cards are not blank just because lineups are not live yet.
  for (let round = 0; round < 2 && rows.length < maxRows; round += 1) {
    for (const code of teamCodes.slice(0, 2)) {
      addBalanced((recordStats.get(code) || [])[round]);
    }
  }

  // If ESPN does not expose enough team-level stats, fall back to the best player /
  // leader rows, still capped per side so one team cannot fill the whole box.
  for (let round = 0; round < 4 && rows.length < maxRows; round += 1) {
    for (const code of teamCodes.slice(0, 2)) {
      addBalanced((playerStats.get(code) || [])[round]);
    }
  }

  return rows.slice(0, maxRows);
}

function summaryWeather(summary) {
  const weather = summary?.gameInfo?.weather || summary?.header?.competitions?.[0]?.weather || null;
  if (!weather) return "";
  const parts = [
    weather.displayValue || "",
    weather.temperature ? `${weather.temperature}°` : "",
    weather.highTemperature ? `High ${weather.highTemperature}°` : ""
  ].filter(Boolean);
  return parts.join(" · ");
}

function venueCityStateFromSummary(summary, competition, mappedEvent = null) {
  const venue = summary?.gameInfo?.venue || competition?.venue || {};
  const address = venue.address || competition?.venue?.address || {};
  const homeCode = mappedEvent?.home?.code || "";
  const fallback = TEAM_LOCATION_FALLBACKS[homeCode] || [];

  let city = String(address.city || venue.city || fallback[0] || "").trim();
  let state = String(address.state || address.stateAbbreviation || address.region || venue.state || fallback[1] || "").trim();

  // ESPN soccer venues often put both values in address.city (for example
  // "Arlington, Texas") and leave address.state empty. Open-Meteo expects the
  // city name separately, so split that representation before geocoding.
  if (!state && city.includes(",")) {
    const pieces = city.split(",").map(value => value.trim()).filter(Boolean);
    if (pieces.length > 1) {
      state = pieces.pop() || "";
      city = pieces.join(", ");
    }
  }

  return {
    venueName: venue.fullName || competition?.venue?.fullName || "",
    city,
    state,
    country: String(address.country || venue.country || "").trim()
  };
}

async function fetchWeatherForCity(city, state, country = "") {
  if (!city) return "";

  const cityName = String(city || "").trim();
  const stateName = String(state || "").trim();
  const stateUpper = stateName.toUpperCase();
  const countryName = String(country || "").trim();
  const countryUpper = countryName.toUpperCase();

  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=10&language=en&format=json`;
    const geo = await fetchJsonUrl(geoUrl, "Weather geocoding");
    const candidates = Array.isArray(geo?.results) ? geo.results : [];
    const matchingCountry = candidates.filter(item => {
      if (!countryUpper) return true;
      const candidateCountry = String(item.country || "").toUpperCase();
      const candidateCode = String(item.country_code || "").toUpperCase();
      return candidateCountry === countryUpper
        || candidateCountry.includes(countryUpper)
        || countryUpper.includes(candidateCountry)
        || candidateCode === countryUpper;
    });
    const pool = matchingCountry.length ? matchingCountry : candidates;
    const result = pool.find(item => {
      const admin1 = String(item.admin1 || "").toUpperCase();
      const admin1Code = String(item.admin1_code || "").toUpperCase();
      return !stateUpper || admin1 === stateUpper || admin1Code === stateUpper || admin1.includes(stateUpper);
    }) || pool[0];

    if (!result?.latitude || !result?.longitude) return "";

    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${result.latitude}&longitude=${result.longitude}&current=temperature_2m,precipitation,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph`;
    const forecast = await fetchJsonUrl(forecastUrl, "Weather forecast");
    const current = forecast?.current;
    if (!current) return "";

    const temp = current.temperature_2m !== undefined ? `${Math.round(Number(current.temperature_2m))}°F` : "";
    const wind = current.wind_speed_10m !== undefined ? `Wind ${Math.round(Number(current.wind_speed_10m))} mph` : "";
    const precipValue = Number(current.precipitation);
    const precip = Number.isFinite(precipValue) && precipValue > 0 ? `Precip ${precipValue}` : "";
    return [temp, wind, precip].filter(Boolean).join(" · ");
  } catch {
    return "";
  }
}

async function enrichTeamEvent(mappedEvent, rawEvent, config) {
  if (mappedEvent.type !== "TEAM_HEAD_TO_HEAD") return mappedEvent;

  const competition = rawEvent.competitions?.[0] || {};
  let summary = null;

  try {
    if (rawEvent?.apiSource !== "mlb-statsapi") {
      const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/${config.espnPath}/summary?event=${encodeURIComponent(String(rawEvent.id))}`;
      summary = await fetchEspnJson(summaryUrl);
    }
  } catch {
    summary = null;
  }

  const venueParts = venueCityStateFromSummary(summary, competition, mappedEvent);
  const espnWeather = summaryWeather(summary);
  const weatherText = espnWeather || await fetchWeatherForCity(venueParts.city, venueParts.state, venueParts.country);
  const espnUsefulStats = pickUsefulTeamStats(summary, mappedEvent, rawEvent);
  const mlbPregameStats = config.league === "MLB" ? await fetchMlbPregameTeamStats(mappedEvent) : [];
  const usefulStats = config.league === "MLB"
    ? mergeStatRows(mlbPregameStats, espnUsefulStats, 4)
    : espnUsefulStats;
  const statusText = mappedEvent.liveStats?.find(stat => stat.label === "Status")?.value || labelStatus(mappedEvent.status);

  const liveStats = [
    { label: "Status", value: statusText },
    { label: "Weather", value: weatherText || "Weather unavailable" },
    ...usefulStats
  ].slice(0, 6);

  if (!usefulStats.length && mappedEvent.status !== "pregame") {
    const scoreText = mappedEvent.score ? `${mappedEvent.away.code} ${mappedEvent.score.away} · ${mappedEvent.home.code} ${mappedEvent.score.home}` : "Score active";
    liveStats.push({ label: "Score", value: scoreText });
  }

  return {
    ...mappedEvent,
    liveStats,
    weather: weatherText ? { summary: weatherText, city: venueParts.city, state: venueParts.state, country: venueParts.country } : null,
    venue: venueParts.venueName || mappedEvent.venue || ""
  };
}

async function mapEventsWithEnrichment(rawEvents, config, date = "") {
  if (config.eventType === "FIGHT_CARD") {
    const detailedEvents = await enrichUfcEventsWithFightCenter(rawEvents);
    return mapUfcFightCards(detailedEvents, config, date);
  }
  const alreadyMapped = config.league === "MLB" && Array.isArray(rawEvents) && rawEvents.every(event => event?.apiSource === "mlb-statsapi");
  const mapped = Array.isArray(rawEvents)
    ? alreadyMapped
      ? rawEvents
      : rawEvents.map(event => mapEvent(event, config)).filter(Boolean)
    : [];
  if (config.eventType !== "TEAM_HEAD_TO_HEAD") return mapped;

  const enriched = [];
  for (let i = 0; i < mapped.length; i += 1) {
    enriched.push(await enrichTeamEvent(mapped[i], rawEvents[i], config));
  }
  return enriched;
}

async function fetchLeagueData(config, date, params) {
  const urls = [];

  if (config.espnPath) {
    urls.push(`https://site.api.espn.com/apis/site/v2/sports/${config.espnPath}/scoreboard?${params.toString()}`);
  }

  if (config.sport === "racing" && config.leagueKey) {
    const racingLeague = encodeURIComponent(config.leagueKey);
    urls.push(`https://site.api.espn.com/apis/site/v2/sports/racing/${racingLeague}/scoreboard?dates=${date}&limit=200`);
    urls.push(`https://site.api.espn.com/apis/v2/scoreboard/header?sport=racing&league=${racingLeague}&dates=${date}`);
  }

  let lastError = null;
  for (const url of urls) {
    try {
      const data = await fetchEspnJson(url);
      const events = collectEvents(data);
      return { data, events, url };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("ESPN request failed");
}

function requestQuery(req = {}) {
  if (req.query && typeof req.query === "object") return req.query;
  try {
    const host = String(req.headers?.host || "localhost");
    const parsed = new URL(String(req.url || "/"), `http://${host}`);
    return Object.fromEntries(parsed.searchParams.entries());
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const query = requestQuery(req);
    const league = String(query.league || "NBA");
    const date = String(query.date || ymd()).replace(/[^0-9]/g, "").slice(0, 8);
    const config = LEAGUE_MAP[league];

    if (!config) {
      return res.status(400).json({ error: "Unsupported league", supportedLeagues: Object.keys(LEAGUE_MAP) });
    }

    const requestedEventId = String(query.eventId || "").replace(/[^0-9]/g, "");
    if (config.league === "UFC" && requestedEventId) {
      const seed = { id: requestedEventId, competitions: [] };
      const events = await mapEventsWithEnrichment([seed], config, date);
      return res.status(200).json({
        source: events[0]?.externalIds?.source || "espn-ufc-direct",
        league: config.league,
        date,
        count: events.length,
        eventId: requestedEventId,
        note: "Targeted UFC repair fetch. This bypasses date-window discovery and is used to repair an already imported incomplete card without changing existing fight IDs or bets.",
        events
      });
    }

    if (config.league === "MLB") {
      let espnRawEvents = [];
      let espnUrl = "";
      try {
        const params = new URLSearchParams({ dates: date, limit: "200" });
        const fetched = await fetchLeagueData(config, date, params);
        espnRawEvents = fetched.events || [];
        espnUrl = fetched.url || "";
      } catch {
        espnRawEvents = [];
      }

      const events = await mapEventsWithEnrichment(await fetchMlbStatsApiEvents(date, espnRawEvents), config, date);
      return res.status(200).json({
        source: "mlb-statsapi",
        league: config.league,
        date,
        count: events.length,
        url: "https://statsapi.mlb.com/api/v1/schedule",
        espnUrl,
        note: "MLB uses MLB Stats API as source of truth for live score/status. ESPN is used only to attach available schedule odds/weather.",
        events
      });
    }

    if (config.useMotoGpPulseLive) {
      const events = await fetchMotoGpPulseLiveEvents(date);
      return res.status(200).json({
        source: "motogp-pulselive",
        league: config.league,
        date,
        count: events.length,
        url: "https://api.motogp.pulselive.com/motogp/v1/timing-gateway/livetiming-lite",
        note: events.length
          ? "MotoGP imported from MotoGP PulseLive timing data. Verify the session before betting."
          : "No MotoGP live timing session matched this date. The MotoGP PulseLive fallback is live/session-focused, not a full season scheduler yet.",
        events
      });
    }

    let events = [];
    let url = "";

    if (config.useJolpicaF1) {
      try {
        const f1Event = await fetchJolpicaF1ForDate(date);
        if (f1Event) events = [f1Event];
        url = "https://api.jolpi.ca/ergast/f1/current.json";
      } catch (error) {
        events = [];
        url = "https://api.jolpi.ca/ergast/f1/current.json";
      }

      return res.status(200).json({
        source: "jolpica-f1",
        league: config.league,
        date,
        count: events.length,
        url,
        note: events.length
          ? "F1 imports use Jolpica/Ergast schedule/results and driver standings. ESPN F1 fallback is disabled because it can import practice/session dates and partial top-10 ordering."
          : "No Jolpica F1 Grand Prix matched this date or the next three days.",
        events
      });
    }

    if (!events.length) {
      const params = new URLSearchParams({ dates: date, limit: "200" });
      if (config.groups) params.set("groups", String(config.groups));

      const fetched = await fetchLeagueData(config, date, params);
      const rawEvents = fetched.events;
      url = fetched.url;
      events = await mapEventsWithEnrichment(rawEvents, config, date);
    }

    if (config.useOfficialLive || config.useIndyCarOfficialLive) {
      events = applyOfficialRacingFallback(events, config);
      try {
        const official = config.useIndyCarOfficialLive
          ? await fetchIndyCarOfficialLeaderboard()
          : await fetchNascarOfficialLeaderboard();
        if (official?.rows?.length) {
          events = events.map(event => ({
            ...event,
            leaderboard: official.rows,
            participants: official.rows.map(row => row.name),
            resultOrder: event.status === "final" ? official.rows.map(row => row.name) : [],
            leaderboardSource: official.source,
            leaderboardVerified: true,
            liveStats: official.stats,
            externalIds: {
              ...event.externalIds,
              [config.useIndyCarOfficialLive ? "indyCarLiveFeed" : "nascarLiveFeed"]: official.sourceUrl
            },
            intel: `${config.league} event imported from ESPN schedule data with live running order from ${official.source}.`
          }));
        }
      } catch (error) {
        // Keep schedule imports, but do not present unverified racing driver ordering as a live leaderboard.
      }
    }

    return res.status(200).json({
      source: "espn",
      league: config.league,
      date,
      count: events.length,
      url,
      note: config.sport === "racing" ? "Racing imports use verified league-specific result sources when available. F1 uses Jolpica/Ergast when available; NASCAR uses NASCAR.com when available; IndyCar attempts INDYCAR official live timing when available; ESPN is mainly schedule fallback." : config.league === "World Cup" ? "World Cup uses ESPN soccer league key fifa.world. This endpoint returns games only for dates ESPN has scheduled/scoreboard data available." : config.league === "UFC" ? "UFC uses ESPN scoreboard discovery, then compares FightCenter and Core Event competition data and keeps the most complete labeled main card. A narrowly scoped verified override repairs known incomplete ESPN cards without replacing existing fight IDs or bets." : "",
      events
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unknown API error" });
  }
}
