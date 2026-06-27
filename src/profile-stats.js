const PLACEHOLDER_ODDS_PATTERN = /^(unavailable|api schedule import|odds unavailable|live odds unavailable|espn odds pending|odds pending|manual event|ufc card|custom bet)$/i;

function asArray(collection) {
  if (!collection) return [];
  return Array.isArray(collection) ? collection : Object.values(collection);
}

function asId(value) {
  return String(value || "").trim();
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function unique(values) {
  return [...new Set(values.map(asId).filter(Boolean))];
}

function byIds(items) {
  const map = new Map();
  for (const item of items) {
    for (const id of unique([item?.firestoreId, item?.id])) map.set(id, item);
  }
  return map;
}

function eventTitle(event = {}) {
  if (event.type === "TEAM_HEAD_TO_HEAD" || (event.away && event.home)) {
    const away = teamName(event, "away");
    const home = teamName(event, "home");
    const separator = event.sport === "soccer" ? "vs" : "at";
    return `${away} ${separator} ${home}`;
  }
  return event.title || event.shortCode || event.id || "Unknown event";
}

function teamName(event = {}, side) {
  const team = event[side] || {};
  const name = asId(team.name);
  const code = asId(team.code);
  if (name && name.toUpperCase() !== code.toUpperCase()) return name;
  return name || code || (side === "away" ? "Away" : "Home");
}

function fightById(event = {}, fightId) {
  const wanted = asId(fightId);
  return (event.fights || []).find(fight => asId(fight.id) === wanted || asId(fight.order) === wanted) || null;
}

function fightPickName(fight = {}, side) {
  if (side === "fighterA") return fight.fighterA || "Fighter A";
  if (side === "fighterB") return fight.fighterB || "Fighter B";
  return side || "Unknown fighter";
}

function pickLabel(event = {}, bet = {}, match = {}, side = "") {
  const resolvedSide = side || bet.side || match.side || bet.pick || bet.participant || "";
  if (event.type === "TEAM_HEAD_TO_HEAD" || (event.away && event.home)) {
    if (resolvedSide === "home") return teamName(event, "home");
    if (resolvedSide === "away") return teamName(event, "away");
  }
  if (event.type === "FIGHT_CARD" || Array.isArray(event.fights)) {
    const fight = fightById(event, bet.fightId || match.fightId);
    const fightName = fight?.label || (fight ? `${fight.fighterA} vs ${fight.fighterB}` : "Fight");
    return `${fightName} · ${fightPickName(fight, resolvedSide)}`;
  }
  return bet.participant || bet.pick || resolvedSide || "Unknown pick";
}

function eventKey(record = {}) {
  return asId(record.eventId || record.gameId || record.eventID || record.eventCode);
}

function recordMatchesEvent(record = {}, event = {}) {
  const recordValues = unique([record.eventId, record.gameId, record.eventID, record.shortCode, record.sourceEventId]);
  const eventValues = unique([
    event.firestoreId,
    event.id,
    event.shortCode,
    event.gameId,
    event.externalIds?.espnEventId,
    event.externalIds?.apiEventId,
    event.externalIds?.eventId
  ]);
  return recordValues.some(value => eventValues.includes(value));
}

function findEvent(events, record = {}) {
  const key = eventKey(record);
  return events.find(event => recordMatchesEvent(record, event) || asId(event.firestoreId) === key || asId(event.id) === key) || null;
}

function idsForBet(bet = {}) {
  return unique([bet.firestoreId, bet.id, bet.betId]);
}

function findBetById(betsById, id) {
  return betsById.get(asId(id)) || null;
}

function userBetForMatch(userId, match = {}, event = {}, bets = [], betsById = new Map()) {
  const directBetId = asId(match.userA) === asId(userId)
    ? match.betA || match.betIdA || match.bet1Id
    : asId(match.userB) === asId(userId)
      ? match.betB || match.betIdB || match.bet2Id
      : "";
  const direct = findBetById(betsById, directBetId);
  if (direct) return direct;

  const matchBetIds = unique([match.betA, match.betB, match.betIdA, match.betIdB, match.bet1Id, match.bet2Id]);
  const byLinkedId = bets.find(bet => bet.userId === userId && idsForBet(bet).some(id => matchBetIds.includes(id)));
  if (byLinkedId) return byLinkedId;

  return bets.find(bet => {
    if (asId(bet.userId) !== asId(userId)) return false;
    if (!recordMatchesEvent(bet, event)) return false;
    if (match.fightId && asId(bet.fightId) !== asId(match.fightId)) return false;
    return true;
  }) || null;
}

function sideForUser(userId, match = {}, bet = {}) {
  if (asId(match.userA) === asId(userId)) return match.sideA || bet.side || bet.participant || bet.pick || "";
  if (asId(match.userB) === asId(userId)) return match.sideB || bet.side || bet.participant || bet.pick || "";
  return bet.side || bet.participant || bet.pick || "";
}

function opponentForUser(userId, match = {}, ledger = {}) {
  if (asId(ledger.toUser) === asId(userId)) return asId(ledger.fromUser);
  if (asId(ledger.fromUser) === asId(userId)) return asId(ledger.toUser);
  if (asId(match.userA) === asId(userId)) return asId(match.userB);
  if (asId(match.userB) === asId(userId)) return asId(match.userA);
  return "";
}

function matchAmount(match = {}, bet = {}, ledger = {}) {
  const candidates = [
    match.settledAmount,
    match.amount,
    match.doubleUp?.amount,
    match.doubleUp?.originalAmount,
    bet.amount,
    ledger.originalAmount,
    ledger.amount
  ];
  return candidates.map(number).find(value => value > 0) || 0;
}

function cleanOdds(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    return [value.summary, value.moneyline, value.details, value.price, value.odds]
      .map(cleanOdds)
      .find(Boolean) || "";
  }
  return "";
}

function reliableOddsText(...values) {
  const text = values.map(cleanOdds).find(value => value && !PLACEHOLDER_ODDS_PATTERN.test(value));
  if (!text) return "";
  return /\d/.test(text) ? text : "";
}

function americanOddsFromText(text) {
  const match = String(text || "").match(/(?:^|\s)([+-]\d{2,5})(?:\s|$)/);
  return match ? Number(match[1]) : null;
}

function expectedProfitForAmericanOdds(amount, odds) {
  if (!Number.isFinite(odds) || odds === 0) return null;
  if (odds > 0) return amount * (odds / 100);
  return amount * (100 / Math.abs(odds));
}

function addSplit(map, key, decision) {
  const name = key || "Unknown";
  if (!map.has(name)) {
    map.set(name, { name, wins: 0, losses: 0, voids: 0, count: 0, amountRisked: 0, net: 0 });
  }
  const row = map.get(name);
  row.count += 1;
  row.amountRisked += decision.amount;
  row.net += decision.net;
  if (decision.result === "win") row.wins += 1;
  if (decision.result === "loss") row.losses += 1;
  if (decision.result === "void") row.voids += 1;
}

function finalizeSplitRows(rows) {
  return rows
    .map(row => {
      const decisions = row.wins + row.losses;
      return {
        ...row,
        decisions,
        winRate: decisions ? Math.round((row.wins / decisions) * 100) : null
      };
    })
    .sort((a, b) => (b.decisions - a.decisions) || (b.net - a.net) || a.name.localeCompare(b.name));
}

function linkedMatchForLedger(entry = {}, matchesById, matches, events) {
  const direct = matchesById.get(asId(entry.matchId));
  if (direct) return direct;
  const event = findEvent(events, entry);
  return matches.find(match => {
    if (!event || !recordMatchesEvent(match, event)) return false;
    const users = [match.userA, match.userB].map(asId);
    return users.includes(asId(entry.fromUser)) && users.includes(asId(entry.toUser));
  }) || null;
}

export function computeProfileAnalytics(input = {}) {
  const userId = asId(input.userId);
  const events = asArray(input.events);
  const bets = asArray(input.bets);
  const matches = asArray(input.matches);
  const ledgerEntries = asArray(input.ledgerEntries);
  const betsById = byIds(bets);
  const matchesById = byIds(matches);
  const decisions = [];
  const seenLedger = new Set();

  for (const entry of ledgerEntries) {
    if (asId(entry.fromUser) !== userId && asId(entry.toUser) !== userId) continue;
    const entryId = asId(entry.firestoreId || entry.id || `${entry.eventId}:${entry.matchId}:${entry.fromUser}:${entry.toUser}:${entry.amount}`);
    if (seenLedger.has(entryId)) continue;
    seenLedger.add(entryId);

    const event = findEvent(events, entry) || {};
    const match = linkedMatchForLedger(entry, matchesById, matches, events) || {};
    const bet = userBetForMatch(userId, match, event, bets, betsById) || {};
    const amount = matchAmount(match, bet, entry);
    const result = asId(entry.toUser) === userId ? "win" : "loss";
    const net = result === "win" ? number(entry.amount) : -number(entry.amount);
    const oddsText = reliableOddsText(
      bet.oddsSnapshot,
      bet.odds,
      bet.oddsText,
      match.oddsSnapshot,
      match.odds,
      entry.oddsSnapshot,
      entry.odds,
      event.oddsLive,
      event.odds
    );
    const americanOdds = americanOddsFromText(oddsText);
    const expectedProfit = expectedProfitForAmericanOdds(amount, americanOdds);

    decisions.push({
      id: entryId,
      eventId: asId(entry.eventId || match.eventId || event.firestoreId || event.id),
      matchId: asId(entry.matchId || match.firestoreId || match.id),
      result,
      net,
      amount,
      ledgerAmount: number(entry.amount),
      eventTitle: eventTitle(event),
      sport: event.sport || "unknown",
      league: event.league || "Unknown league",
      opponentId: opponentForUser(userId, match, entry),
      pick: pickLabel(event, bet, match, sideForUser(userId, match, bet)),
      oddsText,
      americanOdds,
      expectedProfit,
      hasReliableOdds: Boolean(oddsText),
      createdAt: entry.createdAt || entry.updatedAt || match.settledAt || match.updatedAt || bet.updatedAt || bet.createdAt || ""
    });
  }

  const ledgerMatchIds = new Set(decisions.map(decision => decision.matchId).filter(Boolean));
  const voids = [];
  for (const match of matches) {
    const status = asId(match.status).toLowerCase();
    if (!["void", "voided"].includes(status)) continue;
    const matchId = asId(match.firestoreId || match.id);
    if (matchId && ledgerMatchIds.has(matchId)) continue;
    const event = findEvent(events, match) || {};
    const bet = userBetForMatch(userId, match, event, bets, betsById) || {};
    const userIsInMatch = [match.userA, match.userB, bet.userId].map(asId).includes(userId);
    if (!userIsInMatch) continue;
    voids.push({
      id: matchId || `${match.eventId}:${match.userA}:${match.userB}:void`,
      eventId: asId(match.eventId || event.firestoreId || event.id),
      matchId,
      result: "void",
      net: 0,
      amount: matchAmount(match, bet, {}),
      ledgerAmount: 0,
      eventTitle: eventTitle(event),
      sport: event.sport || "unknown",
      league: event.league || "Unknown league",
      opponentId: opponentForUser(userId, match, {}),
      pick: pickLabel(event, bet, match, sideForUser(userId, match, bet)),
      oddsText: reliableOddsText(bet.oddsSnapshot, bet.odds, match.oddsSnapshot, match.odds, event.oddsLive, event.odds),
      americanOdds: null,
      expectedProfit: null,
      hasReliableOdds: false,
      createdAt: match.settledAt || match.updatedAt || bet.updatedAt || bet.createdAt || ""
    });
  }

  const allDecisions = [...decisions, ...voids];
  const wins = allDecisions.filter(decision => decision.result === "win");
  const losses = allDecisions.filter(decision => decision.result === "loss");
  const decided = wins.length + losses.length;
  const amountRisked = allDecisions.reduce((sum, decision) => sum + number(decision.amount), 0);
  const net = allDecisions.reduce((sum, decision) => sum + number(decision.net), 0);
  const grossWon = wins.reduce((sum, decision) => sum + number(decision.ledgerAmount), 0);
  const grossLost = losses.reduce((sum, decision) => sum + number(decision.ledgerAmount), 0);

  const sportMap = new Map();
  const leagueMap = new Map();
  const pickMap = new Map();
  for (const decision of allDecisions) {
    addSplit(sportMap, decision.sport === "unknown" ? "Unknown sport" : decision.sport, decision);
    addSplit(leagueMap, decision.league, decision);
    addSplit(pickMap, decision.pick, decision);
  }

  const oddsDecisions = allDecisions.filter(decision => decision.hasReliableOdds && decision.result !== "void");
  const oddsWins = oddsDecisions.filter(decision => decision.result === "win");
  const oddsLosses = oddsDecisions.filter(decision => decision.result === "loss");
  const potentialProfit = oddsWins.reduce((sum, decision) => sum + (decision.expectedProfit ?? decision.ledgerAmount), 0);

  return {
    decisions: allDecisions,
    totals: {
      decisions: decided,
      totalRows: allDecisions.length,
      wins: wins.length,
      losses: losses.length,
      voids: voids.length,
      winRate: decided ? Math.round((wins.length / decided) * 100) : 0,
      net,
      grossWon,
      grossLost,
      amountRisked,
      averageStake: allDecisions.length ? amountRisked / allDecisions.length : 0
    },
    odds: {
      count: oddsDecisions.length,
      wins: oddsWins.length,
      losses: oddsLosses.length,
      missing: decided - oddsDecisions.length,
      winRate: oddsDecisions.length ? Math.round((oddsWins.length / oddsDecisions.length) * 100) : null,
      net: oddsDecisions.reduce((sum, decision) => sum + decision.net, 0),
      potentialProfit
    },
    sportSplits: finalizeSplitRows([...sportMap.values()]),
    leagueSplits: finalizeSplitRows([...leagueMap.values()]),
    pickSplits: finalizeSplitRows([...pickMap.values()]),
    recentDecisions: [...allDecisions].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5)
  };
}
