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
  F1: { sport: "racing", league: "F1", espnPath: "racing/f1", appSport: "racing", eventType: "RANKED_FINISH", leagueKey: "f1" },
  NASCAR: { sport: "racing", league: "NASCAR", espnPath: "racing/nascar", appSport: "racing", eventType: "RANKED_FINISH", leagueKey: "nascar" },
  MotoGP: { sport: "racing", league: "MotoGP", espnPath: "racing/motogp", appSport: "racing", eventType: "RANKED_FINISH", leagueKey: "motogp" }
};

const DEFAULT_RACING_PARTICIPANTS = {
  F1: ["Verstappen", "Norris", "Piastri", "Leclerc", "Hamilton", "Russell", "Antonelli", "Sainz", "Alonso", "Tsunoda"],
  NASCAR: ["Kyle Larson", "Denny Hamlin", "William Byron", "Chase Elliott", "Ryan Blaney", "Christopher Bell", "Tyler Reddick", "Joey Logano", "Ross Chastain", "Bubba Wallace", "Brad Keselowski", "Ty Gibbs"],
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

function getCompetitor(competition, homeAway) {
  return competition?.competitors?.find(item => item.homeAway === homeAway) || null;
}

function getStatus(event) {
  const type = event?.status?.type || {};
  if (type.completed) return "final";
  if (type.state === "in") return "live";
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
  const status = getStatus(event);
  const odds = competition.odds?.[0]?.details || competition.odds?.[0]?.overUnder || "API schedule import";
  const startTime = event.date || competition.date || new Date().toISOString();
  const score = status === "pregame" ? null : {
    away: Number(away.score ?? 0),
    home: Number(home.score ?? 0)
  };

  return {
    apiSource: "espn",
    apiEventId: String(event.id),
    sport: config.appSport,
    league: config.league,
    type: "TEAM_HEAD_TO_HEAD",
    title: event.shortName || event.name || `${awayCode} at ${homeCode}`,
    away: {
      code: awayCode,
      name: awayTeam.displayName || awayTeam.name || awayCode
    },
    home: {
      code: homeCode,
      name: homeTeam.displayName || homeTeam.name || homeCode
    },
    startTime,
    status,
    score,
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

function mapEvent(event, config) {
  if (config.eventType === "RANKED_FINISH") return mapRacingEvent(event, config);
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
    headers: {
      "accept": "application/json",
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

async function fetchLeagueData(config, date, params) {
  const urls = [
    `https://site.api.espn.com/apis/site/v2/sports/${config.espnPath}/scoreboard?${params.toString()}`
  ];

  if (config.sport === "racing") {
    urls.push(`https://site.web.api.espn.com/apis/personalized/v2/scoreboard/header?sport=racing&league=${encodeURIComponent(config.leagueKey || config.league.toLowerCase())}&dates=${date}`);
    urls.push(`https://site.api.espn.com/apis/site/v2/sports/racing/${encodeURIComponent(config.leagueKey || config.league.toLowerCase())}/scoreboard?dates=${date}&limit=200`);
    urls.push(`https://sports.core.api.espn.com/v2/sports/racing/leagues/${encodeURIComponent(config.leagueKey || config.league.toLowerCase())}/events?dates=${date}`);
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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const league = String(req.query.league || "NBA");
    const date = String(req.query.date || ymd()).replace(/[^0-9]/g, "").slice(0, 8);
    const config = LEAGUE_MAP[league];

    if (!config) {
      return res.status(400).json({ error: "Unsupported league", supportedLeagues: Object.keys(LEAGUE_MAP) });
    }

    const params = new URLSearchParams({ dates: date, limit: "200" });
    if (config.groups) params.set("groups", String(config.groups));

    const { events: rawEvents, url } = await fetchLeagueData(config, date, params);
    const events = Array.isArray(rawEvents) ? rawEvents.map(event => mapEvent(event, config)) : [];

    return res.status(200).json({
      source: "espn",
      league: config.league,
      date,
      count: events.length,
      url,
      note: config.sport === "racing" ? "Racing imports use ESPN schedule data when available; verify participants before betting." : "",
      events
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unknown API error" });
  }
}
