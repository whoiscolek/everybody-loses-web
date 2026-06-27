import test from "node:test";
import assert from "node:assert/strict";
import { computeProfileAnalytics } from "../src/profile-stats.js";

const events = {
  ufc: {
    id: "ufc",
    firestoreId: "ufc",
    type: "FIGHT_CARD",
    sport: "combat",
    league: "UFC",
    title: "UFC Test Card",
    odds: "UFC card",
    fights: [
      { id: "f1", label: "Alpha vs Beta", fighterA: "Alpha", fighterB: "Beta" },
      { id: "f2", label: "Gamma vs Delta", fighterA: "Gamma", fighterB: "Delta" },
      { id: "f3", label: "Epsilon vs Zeta", fighterA: "Epsilon", fighterB: "Zeta" }
    ]
  },
  nba: {
    id: "nba",
    firestoreId: "nba",
    type: "TEAM_HEAD_TO_HEAD",
    sport: "basketball",
    league: "NBA",
    away: { name: "Milwaukee Bucks", code: "MIL" },
    home: { name: "Boston Celtics", code: "BOS" },
    odds: "MIL +120 / BOS -140"
  }
};

const bets = {
  b1: { id: "b1", eventId: "ufc", fightId: "f1", userId: "cole", side: "fighterA", amount: 2, status: "settled" },
  b2: { id: "b2", eventId: "ufc", fightId: "f1", userId: "jamie", side: "fighterB", amount: 2, status: "settled" },
  b3: { id: "b3", eventId: "ufc", fightId: "f2", userId: "cole", side: "fighterB", amount: 3, status: "settled" },
  b4: { id: "b4", eventId: "ufc", fightId: "f2", userId: "chris", side: "fighterA", amount: 3, status: "settled" },
  b5: { id: "b5", eventId: "ufc", fightId: "f3", userId: "cole", side: "fighterA", amount: 1, status: "void" },
  b6: { id: "b6", eventId: "ufc", fightId: "f3", userId: "jamie", side: "fighterB", amount: 1, status: "void" },
  b7: { id: "b7", eventId: "nba", userId: "cole", side: "away", amount: 4, status: "settled", odds: "+120" },
  b8: { id: "b8", eventId: "nba", userId: "jamie", side: "home", amount: 4, status: "settled" }
};

const matches = {
  m1: { id: "m1", eventId: "ufc", fightId: "f1", betA: "b1", betB: "b2", userA: "cole", userB: "jamie", sideA: "fighterA", sideB: "fighterB", amount: 2, status: "settled" },
  m2: { id: "m2", eventId: "ufc", fightId: "f2", betA: "b3", betB: "b4", userA: "cole", userB: "chris", sideA: "fighterB", sideB: "fighterA", amount: 3, status: "settled" },
  m3: { id: "m3", eventId: "ufc", fightId: "f3", betA: "b5", betB: "b6", userA: "cole", userB: "jamie", sideA: "fighterA", sideB: "fighterB", amount: 1, status: "void", result: "draw" },
  m4: { id: "m4", eventId: "nba", betA: "b7", betB: "b8", userA: "cole", userB: "jamie", sideA: "away", sideB: "home", amount: 4, status: "settled" }
};

const ledgerEntries = {
  l1: { id: "l1", eventId: "ufc", matchId: "m1", fromUser: "jamie", toUser: "cole", amount: 2, originalAmount: 2, createdAt: "2026-06-19T01:00:00Z" },
  l2: { id: "l2", eventId: "ufc", matchId: "m2", fromUser: "cole", toUser: "chris", amount: 3, originalAmount: 3, createdAt: "2026-06-19T02:00:00Z" },
  l4: { id: "l4", eventId: "nba", matchId: "m4", fromUser: "jamie", toUser: "cole", amount: 4, originalAmount: 4, createdAt: "2026-06-19T03:00:00Z" }
};

test("profile analytics computes real settled stats across UFC bouts and team events", () => {
  const stats = computeProfileAnalytics({ userId: "cole", events, bets, matches, ledgerEntries });

  assert.equal(stats.totals.decisions, 3);
  assert.equal(stats.totals.wins, 2);
  assert.equal(stats.totals.losses, 1);
  assert.equal(stats.totals.voids, 1);
  assert.equal(stats.totals.winRate, 67);
  assert.equal(stats.totals.net, 3);
  assert.equal(stats.totals.grossWon, 6);
  assert.equal(stats.totals.grossLost, 3);

  const combat = stats.sportSplits.find(row => row.name === "combat");
  assert.equal(combat.decisions, 2);
  assert.equal(combat.voids, 1);
  assert.equal(combat.net, -1);

  const ufc = stats.leagueSplits.find(row => row.name === "UFC");
  assert.equal(ufc.wins, 1);
  assert.equal(ufc.losses, 1);
  assert.equal(ufc.voids, 1);
});

test("profile analytics builds pick splits from linked bets and fight IDs", () => {
  const stats = computeProfileAnalytics({ userId: "cole", events, bets, matches, ledgerEntries });
  const picks = stats.pickSplits.map(row => row.name);

  assert.ok(picks.includes("Alpha vs Beta · Alpha"));
  assert.ok(picks.includes("Gamma vs Delta · Delta"));
  assert.ok(picks.includes("Milwaukee Bucks"));
});

test("profile analytics reports odds-tagged performance without blocking other stats", () => {
  const stats = computeProfileAnalytics({ userId: "cole", events, bets, matches, ledgerEntries });

  assert.equal(stats.odds.count, 1);
  assert.equal(stats.odds.wins, 1);
  assert.equal(stats.odds.winRate, 100);
  assert.equal(stats.odds.missing, 2);
});
