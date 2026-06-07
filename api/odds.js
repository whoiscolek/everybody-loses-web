const ODDS_SPORT_KEYS = {
  NBA: "basketball_nba",
  "NCAA Basketball": "basketball_ncaab",
  NFL: "americanfootball_nfl",
  "NCAA Football": "americanfootball_ncaaf",
  MLB: "baseball_mlb",
  NHL: "icehockey_nhl",
  "Premier League": "soccer_epl",
  MLS: "soccer_usa_mls",
  "Champions League": "soccer_uefa_champs_league"
};

function clean(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function namesMatch(a, b) {
  const aa = clean(a);
  const bb = clean(b);
  if (!aa || !bb) return false;
  return aa === bb || aa.includes(bb) || bb.includes(aa);
}

function eventMatchesOddsGame(event, oddsGame) {
  const homeNames = [event?.home?.name, event?.home?.code].filter(Boolean);
  const awayNames = [event?.away?.name, event?.away?.code].filter(Boolean);

  const homeOk = homeNames.some(name => namesMatch(name, oddsGame.home_team));
  const awayOk = awayNames.some(name => namesMatch(name, oddsGame.away_team));

  if (homeOk && awayOk) return true;

  const eventStart = new Date(event?.startTime || 0).getTime();
  const oddsStart = new Date(oddsGame?.commence_time || 0).getTime();
  const startsClose = Number.isFinite(eventStart) && Number.isFinite(oddsStart) && Math.abs(eventStart - oddsStart) < 12 * 60 * 60 * 1000;

  return startsClose && (
    homeNames.some(name => namesMatch(name, oddsGame.home_team) || namesMatch(name, oddsGame.away_team)) ||
    awayNames.some(name => namesMatch(name, oddsGame.home_team) || namesMatch(name, oddsGame.away_team))
  );
}

function formatPrice(price) {
  if (price === undefined || price === null || price === "") return "";
  const num = Number(price);
  if (!Number.isFinite(num)) return String(price);
  return num > 0 ? `+${num}` : String(num);
}

function oddsApiTimestamp(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function summarizeOdds(game, event) {
  const books = game.bookmakers || [];
  const firstBook = books[0] || {};
  const markets = firstBook.markets || [];
  const h2h = markets.find(market => market.key === "h2h");
  const spread = markets.find(market => market.key === "spreads");
  const total = markets.find(market => market.key === "totals");

  const h2hOutcomes = h2h?.outcomes || [];
  const homePrice = h2hOutcomes.find(outcome => namesMatch(outcome.name, game.home_team))?.price;
  const awayPrice = h2hOutcomes.find(outcome => namesMatch(outcome.name, game.away_team))?.price;

  const moneyline = homePrice !== undefined || awayPrice !== undefined
    ? `${event?.away?.code || game.away_team} ${formatPrice(awayPrice)} · ${event?.home?.code || game.home_team} ${formatPrice(homePrice)}`
    : "";

  const spreadOutcome = spread?.outcomes?.[0];
  const totalOutcome = total?.outcomes?.[0];

  const parts = [];
  if (moneyline) parts.push(moneyline);
  if (spreadOutcome?.point !== undefined) parts.push(`Spread ${spreadOutcome.point}`);
  if (totalOutcome?.point !== undefined) parts.push(`Total ${totalOutcome.point}`);

  return {
    source: "The Odds API",
    bookmaker: firstBook.title || firstBook.key || "bookmaker unavailable",
    marketCount: markets.length,
    moneyline,
    spread: spreadOutcome?.point !== undefined ? String(spreadOutcome.point) : "",
    total: totalOutcome?.point !== undefined ? String(totalOutcome.point) : "",
    summary: parts.join(" · ") || "Odds unavailable",
    oddsApiEventId: game.id || "",
    lastUpdate: firstBook.last_update || new Date().toISOString()
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const apiKey = process.env.ODDS_API_KEY || process.env.VITE_ODDS_API_KEY || "";
    if (!apiKey) {
      return res.status(200).json({
        odds: null,
        skipped: true,
        reason: "ODDS_API_KEY is not set in Vercel environment variables."
      });
    }

    const { event } = req.body || {};
    if (!event || event.type !== "TEAM_HEAD_TO_HEAD") {
      return res.status(200).json({ odds: null, skipped: true, reason: "Odds refresh only runs for team events." });
    }

    const sportKey = ODDS_SPORT_KEYS[event.league];
    if (!sportKey) {
      return res.status(200).json({ odds: null, skipped: true, reason: `No Odds API sport key mapped for ${event.league}.` });
    }

    const start = new Date(event.startTime || Date.now());
    const startMs = Number.isNaN(start.getTime()) ? Date.now() : start.getTime();
    const from = oddsApiTimestamp(startMs - 18 * 60 * 60 * 1000);
    const to = oddsApiTimestamp(startMs + 18 * 60 * 60 * 1000);

    const params = new URLSearchParams({
      apiKey,
      regions: "us",
      markets: "h2h,spreads,totals",
      oddsFormat: "american",
      dateFormat: "iso",
      commenceTimeFrom: from,
      commenceTimeTo: to
    });

    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "Everyone-Loses/1.0"
      }
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return res.status(200).json({
        odds: null,
        skipped: true,
        reason: data?.message || data?.error_code || `Odds API failed with ${response.status}`
      });
    }

    const game = Array.isArray(data) ? data.find(item => eventMatchesOddsGame(event, item)) : null;
    if (!game) {
      return res.status(200).json({ odds: null, skipped: true, reason: "No matching odds game found." });
    }

    return res.status(200).json({
      odds: summarizeOdds(game, event),
      usage: {
        remaining: response.headers.get("x-requests-remaining") || "",
        used: response.headers.get("x-requests-used") || "",
        last: response.headers.get("x-requests-last") || ""
      }
    });
  } catch (error) {
    return res.status(200).json({
      odds: null,
      skipped: true,
      reason: error.message || "Odds refresh failed."
    });
  }
}
