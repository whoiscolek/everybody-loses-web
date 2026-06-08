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
  IndyCar: { sport: "racing", league: "IndyCar", espnPath: "racing/irl", appSport: "racing", eventType: "RANKED_FINISH", leagueKey: "irl" },
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
  NO: ["New Orleans", "LA"], PIT: ["Pittsburgh", "PA"], SEA: ["Seattle", "WA"], SF: ["Santa Clara", "CA"], TB: ["Tampa", "FL"], TEN: ["Nashville", "TN"]
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


function normalizeFightId(value, fallback = "fight") {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || fallback;
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

function ufcFightStatus(competition, event) {
  const type = competition?.status?.type || event?.status?.type || {};
  if (type.completed) return "final";
  if (type.state === "in") return "live";
  return "pregame";
}

function ufcWinnerFromCompetition(competition) {
  const winner = (competition?.competitors || []).find(item => item.winner === true || item.result?.type === "win");
  return ufcFighterName(winner);
}

function extractUfcFightsFromEvent(event) {
  const fights = [];
  const competitions = Array.isArray(event?.competitions) ? event.competitions : [];

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
      fighterA,
      fighterB,
      label: `${fighterA} vs ${fighterB}`,
      status: ufcFightStatus(competition, event),
      winner: ufcWinnerFromCompetition(competition),
      detail: detailBits.join(" · ")
    });
  });

  return fights;
}

function mapUfcFightCards(rawEvents, config, date) {
  const events = Array.isArray(rawEvents) ? rawEvents : [];
  const cards = [];

  for (const event of events) {
    const fights = extractUfcFightsFromEvent(event);
    if (!fights.length) continue;

    const mainCard = fights.slice(0, 5).map((fight, index) => ({ ...fight, order: index + 1 }));
    const startTime = event.date || event.competitions?.[0]?.date || new Date().toISOString();
    const statuses = mainCard.map(fight => fight.status);
    const status = statuses.includes("live") ? "live" : statuses.length && statuses.every(item => item === "final") ? "final" : getStatus(event);
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
        { label: "Main event", value: mainCard[0]?.label || "TBD" },
        { label: "Venue", value: venue || "Venue pending" }
      ],
      externalIds: {
        source: "espn",
        espnEventId: String(event.id || ""),
        espnUid: event.uid || "",
        espnGuid: event.guid || ""
      },
      intel: "UFC fight card imported from ESPN MMA scoreboard data. Main card is treated as one card, with independent bets inside each fight."
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


function statValue(stat) {
  if (stat?.displayValue !== undefined && stat.displayValue !== null) return String(stat.displayValue);
  if (stat?.value !== undefined && stat.value !== null) return String(stat.value);
  return "";
}

function addStatRow(rows, label, value, max = 12, meta = {}) {
  const cleanLabel = String(label || "").trim();
  const cleanValue = String(value ?? "").trim();
  if (!cleanLabel || !cleanValue || rows.length >= max) return false;
  if (/^(source|venue|status|odds|weather)$/i.test(cleanLabel)) return false;
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

  const competition = rawEvent?.competitions?.[0] || {};
  const away = getCompetitor(competition, "away") || competition.competitors?.[1] || {};
  const home = getCompetitor(competition, "home") || competition.competitors?.[0] || {};
  const fallbackPairs = [
    [cleanCode(mappedEvent?.away?.code, ""), formatPeriodLine(mappedEvent?.away?.code, away)],
    [cleanCode(mappedEvent?.home?.code, ""), formatPeriodLine(mappedEvent?.home?.code, home)]
  ];

  for (const [code, line] of fallbackPairs) {
    if (!code || !line) continue;
    const arr = result.get(code) || [];
    arr.push({ label: `${code} scoring`, value: line.replace(/^.*?:\s*/, ""), teamCode: code, score: 75 });
    result.set(code, arr);
  }

  return { result, teamCodes: desiredCodes.length >= 2 ? desiredCodes : Array.from(result.keys()).slice(0, 2) };
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

function pickUsefulTeamStats(summary, mappedEvent, rawEvent) {
  const rows = [];
  const { result: teamStats, teamCodes } = getTeamStatCandidates(summary, mappedEvent, rawEvent);
  const playerStats = getPlayerOrLeaderCandidates(summary, mappedEvent);
  const maxRows = 9;

  // Show meaningful team-level stats first, paired by side. This prevents ESPN's first
  // returned player/team block from filling the whole card.
  for (let round = 0; round < 3 && rows.length < 6; round += 1) {
    for (const code of teamCodes.slice(0, 2)) {
      const candidate = (teamStats.get(code) || [])[round];
      if (candidate) addStatRow(rows, candidate.label, candidate.value, maxRows, { teamCode: code });
    }
  }

  // If team-level data is thin, add the most useful player/leader rows, still balanced by side.
  for (let round = 0; round < 3 && rows.length < maxRows; round += 1) {
    for (const code of teamCodes.slice(0, 2)) {
      const candidate = (playerStats.get(code) || [])[round];
      if (candidate) addStatRow(rows, candidate.label, candidate.value, maxRows, { teamCode: code });
    }
  }

  const leaders = summary?.leaders || [];
  for (const leaderGroup of leaders) {
    if (rows.length >= maxRows) break;
    const label = leaderGroup?.name || leaderGroup?.displayName || "Leader";
    const first = leaderGroup?.leaders?.[0];
    const athlete = first?.athlete?.displayName || first?.displayName || "";
    const value = first?.displayValue || first?.value || "";
    addStatRow(rows, label, athlete ? `${athlete}${value ? ` · ${value}` : ""}` : value, maxRows);
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
  const address = venue.address || {};
  const homeCode = mappedEvent?.home?.code || "";
  const fallback = TEAM_LOCATION_FALLBACKS[homeCode] || [];
  return {
    venueName: venue.fullName || competition?.venue?.fullName || "",
    city: address.city || venue.city || fallback[0] || "",
    state: address.state || address.stateAbbreviation || venue.state || fallback[1] || ""
  };
}

async function fetchWeatherForCity(city, state) {
  if (!city) return "";

  const cityName = String(city || "").trim();
  const stateName = String(state || "").trim();
  const stateUpper = stateName.toUpperCase();

  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=10&language=en&format=json`;
    const geo = await fetchJsonUrl(geoUrl, "Weather geocoding");
    const candidates = Array.isArray(geo?.results) ? geo.results : [];
    const result = candidates.find(item => {
      const admin1 = String(item.admin1 || "").toUpperCase();
      const admin1Code = String(item.admin1_code || "").toUpperCase();
      return !stateUpper || admin1 === stateUpper || admin1Code === stateUpper || admin1.includes(stateUpper);
    }) || candidates[0];

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
    const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/${config.espnPath}/summary?event=${encodeURIComponent(String(rawEvent.id))}`;
    summary = await fetchEspnJson(summaryUrl);
  } catch {
    summary = null;
  }

  const venueParts = venueCityStateFromSummary(summary, competition, mappedEvent);
  const espnWeather = summaryWeather(summary);
  const weatherText = espnWeather || await fetchWeatherForCity(venueParts.city, venueParts.state);
  const usefulStats = pickUsefulTeamStats(summary, mappedEvent, rawEvent);
  const statusText = mappedEvent.liveStats?.find(stat => stat.label === "Status")?.value || labelStatus(mappedEvent.status);

  const liveStats = [
    { label: "Status", value: statusText },
    { label: "Odds", value: mappedEvent.odds || "Unavailable" },
    { label: "Weather", value: weatherText || "Weather unavailable" },
    ...usefulStats
  ].slice(0, 12);

  if (!usefulStats.length && mappedEvent.status !== "pregame") {
    const scoreText = mappedEvent.score ? `${mappedEvent.away.code} ${mappedEvent.score.away} · ${mappedEvent.home.code} ${mappedEvent.score.home}` : "Score active";
    liveStats.push({ label: "Score", value: scoreText });
  }

  return {
    ...mappedEvent,
    liveStats,
    weather: weatherText ? { summary: weatherText, city: venueParts.city, state: venueParts.state } : null,
    venue: venueParts.venueName || mappedEvent.venue || ""
  };
}

async function mapEventsWithEnrichment(rawEvents, config, date = "") {
  if (config.eventType === "FIGHT_CARD") return mapUfcFightCards(rawEvents, config, date);
  const mapped = Array.isArray(rawEvents) ? rawEvents.map(event => mapEvent(event, config)).filter(Boolean) : [];
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
      events = await mapEventsWithEnrichment(rawEvents, config, date);
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
      note: config.sport === "racing" ? "Racing imports use verified league-specific result sources when available. F1 results use Jolpica/Ergast when available; NASCAR positions use NASCAR.com official live feed when available; ESPN is mainly schedule fallback." : config.league === "World Cup" ? "World Cup uses ESPN soccer league key fifa.world. This endpoint returns games only for dates ESPN has scheduled/scoreboard data available." : config.league === "UFC" ? "UFC uses ESPN MMA league key ufc and imports one fight-card event with main-card fights inside it when ESPN exposes fights for the selected date." : "",
      events
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unknown API error" });
  }
}
