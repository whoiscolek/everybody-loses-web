import {
  EVENT_TYPES,
  hasScore,
  normalizeToken,
  recordBelongs,
  sanitizeId,
  ufcFightHasResult
} from "./_event-utils.js";


function teamName(event = {}, side) {
  const team = event[side] || {};
  return team.name || team.displayName || team.shortDisplayName || team.code || team.abbreviation || (side === "away" ? "Away" : "Home");
}

function eventTitle(event = {}, eventId = "") {
  if (event.type === EVENT_TYPES.TEAM || (event.away && event.home)) {
    const separator = event.sport === "soccer" ? "vs" : "at";
    return `${teamName(event, "away")} ${separator} ${teamName(event, "home")}`;
  }
  return event.title || event.shortCode || event.id || eventId || "Unknown event";
}

function eventLedgerFields(event = {}, eventId = "") {
  const id = event.firestoreId || event.id || eventId || "";
  const title = eventTitle(event, id);
  return {
    eventTitle: title,
    eventSport: event.sport || "",
    eventLeague: event.league || "",
    eventShortCode: event.shortCode || "",
    eventSnapshot: {
      id,
      firestoreId: event.firestoreId || "",
      eventId: id,
      shortCode: event.shortCode || "",
      title,
      sport: event.sport || "",
      league: event.league || "",
      type: event.type || "",
      startTime: event.startTime || "",
      away: event.away ? { name: event.away.name || event.away.displayName || "", code: event.away.code || event.away.abbreviation || "" } : null,
      home: event.home ? { name: event.home.name || event.home.displayName || "", code: event.home.code || event.home.abbreviation || "" } : null,
      externalIds: event.externalIds || null
    }
  };
}

function effectiveAmount(match = {}, betA = null, betB = null) {
  const doubled = Boolean(match.doubleUp?.applied || match.doubledUp);
  const explicitDouble = Number(match.doubleUpAmount || match.doubledAmount);
  if (doubled && Number.isFinite(explicitDouble) && explicitDouble > 0) return explicitDouble;

  const matchAmounts = [
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

  let amount = matchAmounts[0] || (betAmounts.length ? Math.min(...betAmounts) : 0);
  if (doubled && !match.amount && !match.exposure && match.doubleUp?.originalAmount && !explicitDouble) amount *= 2;
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
  ].map(normalizeToken).filter(Boolean));
}

function normalizeTeamSide(value, event = {}) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (["home", "h", "host"].includes(raw)) return "home";
  if (["away", "a", "visitor", "road"].includes(raw)) return "away";

  const token = normalizeToken(value);
  if (!token) return "";
  if (teamSelectionAliases(event.home).has(token)) return "home";
  if (teamSelectionAliases(event.away).has(token)) return "away";
  return "";
}

function normalizeFightSide(value, fight = {}) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (["fightera", "fighter_a", "a", "left"].includes(raw)) return "fighterA";
  if (["fighterb", "fighter_b", "b", "right"].includes(raw)) return "fighterB";

  const token = normalizeToken(value);
  if (!token) return "";
  if (token === normalizeToken(fight.fighterA)) return "fighterA";
  if (token === normalizeToken(fight.fighterB)) return "fighterB";
  return "";
}

function candidateBets(eventBets, match, slot) {
  const userId = String(slot === "A"
    ? (match.userA || match.bettorA || match.playerA || "")
    : (match.userB || match.bettorB || match.playerB || ""));
  if (!userId) return [];

  let candidates = eventBets.filter(bet => String(bet.userId || bet.user || bet.bettorId || "") === userId);
  if (match.fightId) {
    const fightCandidates = candidates.filter(bet => String(bet.fightId || "") === String(match.fightId));
    if (fightCandidates.length) candidates = fightCandidates;
  }
  return candidates;
}

function matchBet(betsById, eventBets, match, slot) {
  const betId = String(slot === "A" ? (match.betA || match.bet1 || "") : (match.betB || match.bet2 || ""));
  if (betId && betsById.has(betId)) return betsById.get(betId);

  const candidates = candidateBets(eventBets, match, slot);
  if (candidates.length <= 1) return candidates[0] || null;

  const rawSide = slot === "A"
    ? (match.sideA || match.pickA || match.selectionA || match.teamA)
    : (match.sideB || match.pickB || match.selectionB || match.teamB);
  const sideToken = normalizeToken(rawSide);
  if (sideToken) {
    const sideMatches = candidates.filter(bet => normalizeToken(bet.side || bet.pick || bet.selection || bet.team) === sideToken);
    if (sideMatches.length === 1) return sideMatches[0];
    if (sideMatches.length > 1) return sideMatches.find(bet => String(bet.status || "").toLowerCase() === "matched") || sideMatches[0];
  }

  return candidates.find(bet => String(bet.status || "").toLowerCase() === "matched") || candidates[0];
}

function resolvedTeamMatchFields(match, event, eventBets, betsById) {
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
  return {
    betA,
    betB,
    betAId: String(match.betA || match.bet1 || betA?.firestoreId || betA?.id || ""),
    betBId: String(match.betB || match.bet2 || betB?.firestoreId || betB?.id || ""),
    sideA,
    sideB,
    userA: String(match.userA || match.bettorA || match.playerA || betA?.userId || betA?.user || betA?.bettorId || ""),
    userB: String(match.userB || match.bettorB || match.playerB || betB?.userId || betB?.user || betB?.bettorId || ""),
    amount: effectiveAmount(match, betA, betB)
  };
}

function resolvedFightMatchFields(match, fight, eventBets, betsById) {
  const betA = matchBet(betsById, eventBets, match, "A");
  const betB = matchBet(betsById, eventBets, match, "B");
  const sideA = normalizeFightSide(
    match.sideA || match.pickA || match.selectionA || betA?.side || betA?.pick || betA?.selection,
    fight
  );
  const sideB = normalizeFightSide(
    match.sideB || match.pickB || match.selectionB || betB?.side || betB?.pick || betB?.selection,
    fight
  );
  return {
    betA,
    betB,
    betAId: String(match.betA || match.bet1 || betA?.firestoreId || betA?.id || ""),
    betBId: String(match.betB || match.bet2 || betB?.firestoreId || betB?.id || ""),
    sideA,
    sideB,
    userA: String(match.userA || match.bettorA || match.playerA || betA?.userId || betA?.user || betA?.bettorId || ""),
    userB: String(match.userB || match.bettorB || match.playerB || betB?.userId || betB?.user || betB?.bettorId || ""),
    amount: effectiveAmount(match, betA, betB)
  };
}

function ledgerId(eventId, matchId) {
  return sanitizeId(`LEDGER-${eventId}-${matchId}`).toUpperCase();
}

function pairLedgerId(eventId, a, b) {
  return sanitizeId(`LEDGER-RANKED-${eventId}-${[a, b].sort().join("-")}`).toUpperCase();
}

function completeFightStatus(fight = {}) {
  return ["final", "complete", "completed", "closed", "settled", "cancelled", "canceled", "void"]
    .includes(String(fight.status || "").toLowerCase());
}

function fightIsVoid(fight = {}) {
  const text = [fight.status, fight.result, fight.outcome, fight.method, fight.detail]
    .map(value => String(value || "").toLowerCase())
    .join(" ");
  return /\b(draw|no contest|cancelled|canceled|void)\b/.test(text);
}

function addUnresolved(summary, eventId, matchId, issues) {
  const issue = issues.join(", ");
  summary.deferred += 1;
  summary.unresolved.push({ eventId: String(eventId), matchId: String(matchId), issue });
  return issue;
}

function closeBets(batch, db, FieldValue, eventId, betIds, status, summary) {
  for (const betId of betIds.filter(Boolean)) {
    batch.set(db.collection("bets").doc(String(betId)), {
      eventId,
      status,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    summary.betsClosed += 1;
  }
}

export async function settleFinalEvents(db, FieldValue, events, bets, matches, ledgerEntries) {
  const summary = {
    events: 0,
    matches: 0,
    ledgerWrites: 0,
    betsClosed: 0,
    tiesVoided: 0,
    deferred: 0,
    repairedLegacyMatches: 0,
    unresolved: []
  };
  const ledgerByMatch = new Map();
  const betsById = new Map();

  for (const bet of bets) {
    for (const id of [bet.firestoreId, bet.id].map(value => String(value || "")).filter(Boolean)) betsById.set(id, bet);
  }
  for (const entry of ledgerEntries) {
    if (entry.matchId) ledgerByMatch.set(String(entry.matchId), entry);
  }

  const settlementReadyEvents = events.filter(event => {
    if (event.status === "final") return true;
    const eventType = event.type || (Array.isArray(event.fights) ? EVENT_TYPES.FIGHT_CARD : "");
    return eventType === EVENT_TYPES.FIGHT_CARD
      && (event.fights || []).some(fight => ufcFightHasResult(event, fight) || completeFightStatus(fight));
  });

  for (const event of settlementReadyEvents) {
    const eventId = event.firestoreId || event.id;
    const eventType = event.type || (event.away && event.home
      ? EVENT_TYPES.TEAM
      : (Array.isArray(event.fights) ? EVENT_TYPES.FIGHT_CARD : ""));
    const eventIsFinal = event.status === "final";
    if (!eventId) continue;

    const eventMatches = matches.filter(match => recordBelongs(match, event));
    const eventBets = bets.filter(bet => recordBelongs(bet, event));
    let changed = false;
    let eventDeferred = 0;
    const batch = db.batch();

    if (eventType === EVENT_TYPES.TEAM) {
      if (!hasScore(event.score)) {
        summary.deferred += eventMatches.filter(match => String(match.status || "").toLowerCase() === "matched").length;
        continue;
      }

      const away = Number(event.score.away);
      const home = Number(event.score.home);
      const winningSide = home > away ? "home" : away > home ? "away" : null;

      for (const match of eventMatches) {
        const matchStatus = String(match.status || "").toLowerCase();
        if (["cancelled", "canceled", "void"].includes(matchStatus)) continue;
        const matchId = match.firestoreId || match.id;
        if (!matchId) continue;

        const resolved = resolvedTeamMatchFields(match, event, eventBets, betsById);
        const existingMatchLedger = ledgerByMatch.get(String(matchId));
        if (matchStatus === "settled" && existingMatchLedger && match.winner && match.loser && resolved.amount > 0) continue;
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
          const staleLedger = ledgerByMatch.get(String(matchId)) || ledgerEntries.find(entry =>
            recordBelongs(entry, event) && String(entry.matchId || "") === String(matchId)
          );
          if (staleLedger) batch.delete(db.collection("ledgerEntries").doc(staleLedger.firestoreId || staleLedger.id));
          closeBets(batch, db, FieldValue, eventId, [betAId, betBId], "void", summary);
          summary.tiesVoided += 1;
          summary.matches += 1;
          changed = true;
          continue;
        }

        const winner = sideA === winningSide ? userA : sideB === winningSide ? userB : String(match.winner || "");
        const loser = winner === userA ? userB : winner === userB ? userA : String(match.loser || "");
        const unresolved = [];
        if (!userA || !userB) unresolved.push("missing users");
        if (!winner || !loser) {
          if (!sideA || !sideB || (sideA !== winningSide && sideB !== winningSide)) unresolved.push("missing or unrecognized winning pick");
          unresolved.push("winner could not be mapped to a bettor");
        }
        if (!Number.isFinite(amount) || amount <= 0) unresolved.push("missing wager amount");

        if (unresolved.length) {
          const issue = addUnresolved(summary, eventId, matchId, unresolved);
          eventDeferred += 1;
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
          changed = true;
          continue;
        }

        const legacyRepaired = sideA !== match.sideA
          || sideB !== match.sideB
          || userA !== match.userA
          || userB !== match.userB
          || betAId !== String(match.betA || "")
          || betBId !== String(match.betB || "")
          || Number(match.amount || 0) !== amount;
        if (legacyRepaired) summary.repairedLegacyMatches += 1;

        const existingLedger = ledgerByMatch.get(String(matchId)) || ledgerEntries.find(entry =>
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
          note: `Auto-settled: ${eventTitle(event, eventId)}${match.doubleUp?.applied || match.doubledUp ? " · doubled up" : ""}`,
          ...eventLedgerFields(event, eventId),
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
        closeBets(batch, db, FieldValue, eventId, [betAId, betBId], "settled", summary);
        summary.matches += 1;
        summary.ledgerWrites += 1;
        changed = true;
      }
    } else if (eventType === EVENT_TYPES.FIGHT_CARD) {
      const resultMap = event.fightResults || Object.fromEntries(
        (event.fights || []).map(fight => [fight.id, fight.winner]).filter(([, winner]) => winner)
      );

      for (const match of eventMatches) {
        const matchStatus = String(match.status || "").toLowerCase();
        if (["cancelled", "canceled", "void"].includes(matchStatus)) continue;
        const matchId = match.firestoreId || match.id;
        if (!matchId) continue;
        if (matchStatus === "settled" && ledgerByMatch.has(String(matchId))) continue;

        const fight = (event.fights || []).find(candidate => String(candidate.id) === String(match.fightId));
        if (!fight) {
          const issue = addUnresolved(summary, eventId, matchId, ["fight could not be found on the event"]);
          eventDeferred += 1;
          batch.set(db.collection("matches").doc(matchId), {
            settlementIssue: issue,
            settlementCheckedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
          changed = true;
          continue;
        }

        const resolved = resolvedFightMatchFields(match, fight, eventBets, betsById);
        const { sideA, sideB, userA, userB, betAId, betBId, amount } = resolved;
        const winnerName = String(resultMap[match.fightId] || fight.winner || "");
        const winnerToken = normalizeToken(winnerName);

        if (!winnerToken) {
          if (!completeFightStatus(fight)) continue;
          if (fightIsVoid(fight)) {
            batch.set(db.collection("matches").doc(matchId), {
              eventId,
              betA: betAId || match.betA || null,
              betB: betBId || match.betB || null,
              userA: userA || match.userA || null,
              userB: userB || match.userB || null,
              sideA: sideA || match.sideA || null,
              sideB: sideB || match.sideB || null,
              amount: Number.isFinite(amount) && amount > 0 ? amount : Number(match.amount || 0),
              status: "void",
              result: "void",
              settlementIssue: null,
              settledAmount: 0,
              winner: null,
              loser: null,
              settledAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });
            closeBets(batch, db, FieldValue, eventId, [betAId, betBId], "void", summary);
            summary.matches += 1;
            summary.tiesVoided += 1;
            changed = true;
            continue;
          }

          const issue = addUnresolved(summary, eventId, matchId, ["completed fight has no recognized winner"]);
          eventDeferred += 1;
          batch.set(db.collection("matches").doc(matchId), {
            eventId,
            settlementIssue: issue,
            settlementCheckedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
          changed = true;
          continue;
        }

        const fighterAToken = normalizeToken(fight.fighterA);
        const fighterBToken = normalizeToken(fight.fighterB);
        const winningSide = winnerToken === fighterAToken ? "fighterA" : winnerToken === fighterBToken ? "fighterB" : "";
        const winner = sideA === winningSide ? userA : sideB === winningSide ? userB : "";
        const loser = winner === userA ? userB : winner === userB ? userA : "";
        const unresolved = [];
        if (!userA || !userB) unresolved.push("missing users");
        if (!sideA || !sideB) unresolved.push("missing or unrecognized fighter picks");
        if (!winningSide) unresolved.push("winner did not match either fighter");
        if (!winner || !loser) unresolved.push("winner could not be mapped to a bettor");
        if (!Number.isFinite(amount) || amount <= 0) unresolved.push("missing wager amount");

        if (unresolved.length) {
          const issue = addUnresolved(summary, eventId, matchId, unresolved);
          eventDeferred += 1;
          batch.set(db.collection("matches").doc(matchId), {
            eventId,
            betA: betAId || match.betA || null,
            betB: betBId || match.betB || null,
            userA: userA || match.userA || null,
            userB: userB || match.userB || null,
            sideA: sideA || match.sideA || null,
            sideB: sideB || match.sideB || null,
            amount: Number.isFinite(amount) && amount > 0 ? amount : Number(match.amount || 0),
            settlementIssue: issue,
            settlementCheckedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
          changed = true;
          continue;
        }

        const legacyRepaired = sideA !== match.sideA
          || sideB !== match.sideB
          || userA !== match.userA
          || userB !== match.userB
          || betAId !== String(match.betA || "")
          || betBId !== String(match.betB || "")
          || Number(match.amount || 0) !== amount;
        if (legacyRepaired) summary.repairedLegacyMatches += 1;

        const existingLedger = ledgerByMatch.get(String(matchId)) || ledgerEntries.find(entry =>
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
          note: `UFC settled: ${eventTitle(event, eventId)} · ${fight.label || match.fightId}`,
          ...eventLedgerFields(event, eventId),
          settled: Boolean(existingLedger?.settled || false),
          createdAt: existingLedger?.createdAt || FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        batch.set(db.collection("matches").doc(matchId), {
          eventId,
          fightId: String(match.fightId || fight.id),
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
        closeBets(batch, db, FieldValue, eventId, [betAId, betBId], "settled", summary);
        summary.matches += 1;
        summary.ledgerWrites += 1;
        changed = true;
      }
    } else if (eventType === EVENT_TYPES.RANKED && Array.isArray(event.resultOrder) && event.resultOrder.length) {
      const rank = new Map(event.resultOrder.map((name, index) => [normalizeToken(name), index + 1]));
      const unsettledBets = eventBets.filter(bet => !["settled", "expired", "cancelled", "canceled", "void"].includes(String(bet.status || "").toLowerCase()));
      for (let i = 0; i < unsettledBets.length; i += 1) {
        for (let j = i + 1; j < unsettledBets.length; j += 1) {
          const a = unsettledBets[i];
          const b = unsettledBets[j];
          if (a.userId === b.userId) continue;
          const rankA = rank.get(normalizeToken(a.participant)) ?? Number.POSITIVE_INFINITY;
          const rankB = rank.get(normalizeToken(b.participant)) ?? Number.POSITIVE_INFINITY;
          if (rankA === rankB) continue;
          const winner = rankA < rankB ? a.userId : b.userId;
          const loser = winner === a.userId ? b.userId : a.userId;
          const amount = Math.min(Number(a.amount || 0), Number(b.amount || 0));
          if (!Number.isFinite(amount) || amount <= 0) continue;
          const aId = a.firestoreId || a.id;
          const bId = b.firestoreId || b.id;
          const ref = db.collection("ledgerEntries").doc(pairLedgerId(eventId, aId, bId));
          batch.set(ref, {
            id: ref.id,
            eventId,
            fromUser: loser,
            toUser: winner,
            amount,
            note: `Ranked finish: ${eventTitle(event, eventId)}`,
            ...eventLedgerFields(event, eventId),
            settled: false,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
          summary.ledgerWrites += 1;
          changed = true;
        }
      }
      for (const bet of unsettledBets) {
        const betId = bet.firestoreId || bet.id;
        if (!betId) continue;
        batch.set(db.collection("bets").doc(betId), {
          eventId,
          status: "settled",
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        summary.betsClosed += 1;
      }
    }

    const matchedBetIds = new Set(eventMatches.flatMap(match => [match.betA, match.betB]).filter(Boolean).map(String));
    const completedFightIds = new Set(
      eventType === EVENT_TYPES.FIGHT_CARD
        ? (event.fights || [])
          .filter(fight => ufcFightHasResult(event, fight) || completeFightStatus(fight))
          .map(fight => String(fight.id || ""))
          .filter(Boolean)
        : []
    );
    for (const bet of eventBets) {
      const betId = String(bet.firestoreId || bet.id || "");
      const status = String(bet.status || "").toLowerCase();
      if (!betId || matchedBetIds.has(betId) || ["settled", "expired", "void", "cancelled", "canceled"].includes(status)) continue;
      if (eventType === EVENT_TYPES.FIGHT_CARD && !eventIsFinal && !completedFightIds.has(String(bet.fightId || ""))) continue;
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
      const eventPatch = eventIsFinal
        ? {
            boardState: "history",
            hiddenFromNow: true,
            settlementStatus: eventDeferred ? "partial" : "complete",
            settlementIssue: eventDeferred ? eventIssues.map(item => item.issue).join(" | ") : null,
            settlementCheckedAt: FieldValue.serverTimestamp(),
            ...(eventDeferred ? {} : { settledAt: FieldValue.serverTimestamp() })
          }
        : {
            settlementStatus: eventDeferred ? "in-progress-with-issues" : "in-progress",
            settlementIssue: eventDeferred ? eventIssues.map(item => item.issue).join(" | ") : null,
            settlementCheckedAt: FieldValue.serverTimestamp()
          };
      batch.set(db.collection("events").doc(eventId), {
        ...eventPatch,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      await batch.commit();
      summary.events += 1;
    }
  }

  return summary;
}
