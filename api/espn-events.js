const LEAGUE_MAP = {
  NBA: { sport: "basketball", league: "NBA", espnPath: "basketball/nba", appSport: "basketball" },
  NFL: { sport: "football", league: "NFL", espnPath: "football/nfl", appSport: "football" },
  MLB: { sport: "baseball", league: "MLB", espnPath: "baseball/mlb", appSport: "baseball" },
  NHL: { sport: "hockey", league: "NHL", espnPath: "hockey/nhl", appSport: "hockey" },
  "NCAA Basketball": { sport: "basketball", league: "NCAA Basketball", espnPath: "basketball/mens-college-basketball", appSport: "basketball", groups: 100 },
  "NCAA Football": { sport: "football", league: "NCAA Football", espnPath: "football/college-football", appSport: "football", groups: 100 },
  "Premier League": { sport: "soccer", league: "Premier League", espnPath: "soccer/eng.1", appSport: "soccer" },
  MLS: { sport: "soccer", league: "MLS", espnPath: "soccer/usa.1", appSport: "soccer" },
  "Champions League": { sport: "soccer", league: "Champions League", espnPath: "soccer/uefa.champions", appSport: "soccer" }
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

function mapEvent(event, config) {
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

    const url = `https://site.api.espn.com/apis/site/v2/sports/${config.espnPath}/scoreboard?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        "accept": "application/json",
        "user-agent": "Everyone-Loses/1.0"
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `ESPN request failed with ${response.status}`, url });
    }

    const data = await response.json();
    const events = Array.isArray(data.events) ? data.events.map(event => mapEvent(event, config)) : [];

    return res.status(200).json({
      source: "espn",
      league: config.league,
      date,
      count: events.length,
      events
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unknown API error" });
  }
}
