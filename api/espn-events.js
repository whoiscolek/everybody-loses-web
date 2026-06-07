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
  F1: { sport: "racing", league: "F1", espnPath: "racing/f1", appSport: "racing", eventType: "RANKED_FINISH", leagueKey: "f1", useJolpicaF1: true },
  NASCAR: { sport: "racing", league: "NASCAR", espnPath: "racing/nascar-premier", appSport: "racing", eventType: "RANKED_FINISH", leagueKey: "nascar-premier", useOfficialLive: true },
  IndyCar: { sport: "racing", league: "IndyCar", espnPath: "racing/irl", appSport: "racing", eventType: "RANKED_FINISH", leagueKey: "irl" },
  MotoGP: { sport: "racing", league: "MotoGP", espnPath: "", appSport: "racing", eventType: "RANKED_FINISH", leagueKey: "motogp", useMotoGpPulseLive: true }
};

const DEFAULT_RACING_PARTICIPANTS = {
  F1: ["Verstappen", "Norris", "Piastri", "Leclerc", "Hamilton", "Russell", "Antonelli", "Sainz", "Alonso", "Tsunoda"],
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
  const liveStats = [
    { label: "Status", value: status === "live" && period ? `Period ${period}${clock ? ` · ${clock}` : ""}` : labelStatus(status) },
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


async function fetchJsonUrl(url, label = "request") {
  const response = await fetch(url, {
    headers: {
      "accept": "application/json,text/plain,*/*",
      "user-agent": "Everyone-Loses/1.0"
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
  if (config.league !== "NASCAR") return events;

  // ESPN's NASCAR event object is useful for schedule/import, but its competitor ordering can be standings/start/grid-like.
  // Do not show those rows as a live leaderboard unless NASCAR.com's official live feed replaces them.
  return events.map(event => ({
    ...event,
    leaderboard: [],
    leaderboardSource: "NASCAR official live feed pending",
    leaderboardVerified: false,
    liveStats: [
      { label: "Source", value: "NASCAR.com feed pending" },
      { label: "Status", value: labelStatus(event.status) },
      { label: "Leaderboard", value: "Not verified yet" }
    ],
    intel: "NASCAR schedule imported from ESPN. Live running order is only shown after the NASCAR.com live feed verifies positions."
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

async function fetchJolpicaF1ForDate(date) {
  const isoDate = ymdToIsoDate(date);
  const scheduleUrl = `https://api.jolpi.ca/ergast/f1/current.json`;
  const scheduleData = await fetchJsonUrl(scheduleUrl, "F1 schedule");
  const races = scheduleData?.MRData?.RaceTable?.Races || [];

  const matching = races.find(race => race.date === isoDate);
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
      { label: "Source", value: results.length ? "Jolpica F1 results" : "Jolpica F1 schedule" },
      { label: "Round", value: String(round || "TBD") },
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
      : "F1 event imported from Jolpica/Ergast schedule. Final results will appear after the race results endpoint updates."
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
    baseEvent.participants = DEFAULT_RACING_PARTICIPANTS.F1;
    baseEvent.leaderboard = DEFAULT_RACING_PARTICIPANTS.F1.map((name, index) => ({
      position: index + 1,
      name,
      detail: "Entry"
    }));
  }

  return baseEvent;
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
        if (f1Event) {
          events = [f1Event];
          url = "https://api.jolpi.ca/ergast/f1/current.json";
        }
      } catch (error) {
        // Fall back to ESPN schedule if the verified F1 source is unavailable.
      }
    }

    if (!events.length) {
      const params = new URLSearchParams({ dates: date, limit: "200" });
      if (config.groups) params.set("groups", String(config.groups));

      const fetched = await fetchLeagueData(config, date, params);
      const rawEvents = fetched.events;
      url = fetched.url;
      events = Array.isArray(rawEvents) ? rawEvents.map(event => mapEvent(event, config)) : [];
    }

    if (config.useOfficialLive) {
      events = applyOfficialRacingFallback(events, config);
      try {
        const official = await fetchNascarOfficialLeaderboard();
        if (official?.rows?.length) {
          events = events.map(event => ({
            ...event,
            leaderboard: official.rows,
            participants: official.rows.map(row => row.name),
            resultOrder: event.status === "final" ? official.rows.map(row => row.name) : [],
            leaderboardSource: official.source,
            leaderboardVerified: true,
            liveStats: official.stats,
            externalIds: { ...event.externalIds, nascarLiveFeed: official.sourceUrl },
            intel: "NASCAR event imported from ESPN schedule data with live running order from NASCAR.com's official live feed."
          }));
        }
      } catch (error) {
        // Keep schedule imports, but do not present unverified ESPN driver ordering as a live leaderboard.
      }
    }

    return res.status(200).json({
      source: "espn",
      league: config.league,
      date,
      count: events.length,
      url,
      note: config.sport === "racing" ? "Racing imports use verified league-specific result sources when available. F1 results use Jolpica/Ergast when available; NASCAR positions use NASCAR.com official live feed when available; ESPN is mainly schedule fallback." : "",
      events
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unknown API error" });
  }
}
