import test from "node:test";
import assert from "node:assert/strict";
import { settleFinalEvents } from "../api/_settlement.js";
import { FakeFirestore, FakeFieldValue } from "./helpers/fake-firestore.js";

function teamEvent(overrides = {}) {
  return {
    firestoreId: "event-1",
    id: "event-1",
    type: "TEAM_HEAD_TO_HEAD",
    league: "World Cup",
    title: "United States vs Australia",
    status: "final",
    score: { away: 1, home: 3 },
    away: { code: "USA", name: "United States" },
    home: { code: "AUS", name: "Australia" },
    ...overrides
  };
}

function teamBets() {
  return [
    { firestoreId: "bet-a", id: "bet-a", eventId: "event-1", userId: "cole", side: "away", amount: 4, status: "matched" },
    { firestoreId: "bet-b", id: "bet-b", eventId: "event-1", userId: "jamie", side: "home", amount: 4, status: "matched" }
  ];
}

test("settles a final team matchup and creates one deterministic ledger entry", async () => {
  const db = new FakeFirestore();
  const bets = teamBets();
  const matches = [{
    firestoreId: "match-1",
    id: "match-1",
    eventId: "event-1",
    betA: "bet-a",
    betB: "bet-b",
    userA: "cole",
    userB: "jamie",
    sideA: "away",
    sideB: "home",
    amount: 4,
    status: "matched"
  }];

  const summary = await settleFinalEvents(db, FakeFieldValue, [teamEvent()], bets, matches, []);

  assert.equal(summary.matches, 1);
  assert.equal(summary.ledgerWrites, 1);
  assert.equal(db.get("matches", "match-1").winner, "jamie");
  assert.equal(db.get("matches", "match-1").loser, "cole");
  assert.equal(db.get("bets", "bet-a").status, "settled");
  assert.equal(db.get("bets", "bet-b").status, "settled");
  assert.equal(db.entries("ledgerEntries").length, 1);
  assert.equal(db.entries("ledgerEntries")[0].amount, 4);
  assert.equal(db.get("events", "event-1").settlementStatus, "complete");
});

test("repairs legacy team match fields from linked bets before settling", async () => {
  const db = new FakeFirestore();
  const bets = teamBets();
  const matches = [{
    firestoreId: "match-legacy",
    id: "match-legacy",
    eventId: "event-1",
    betA: "bet-a",
    betB: "bet-b",
    status: "matched"
  }];

  const summary = await settleFinalEvents(db, FakeFieldValue, [teamEvent()], bets, matches, []);

  assert.equal(summary.repairedLegacyMatches, 1);
  const saved = db.get("matches", "match-legacy");
  assert.equal(saved.userA, "cole");
  assert.equal(saved.userB, "jamie");
  assert.equal(saved.sideA, "away");
  assert.equal(saved.sideB, "home");
  assert.equal(saved.amount, 4);
  assert.equal(saved.status, "settled");
});

test("voids a drawn team matchup without creating debt", async () => {
  const db = new FakeFirestore({ ledgerEntries: { stale: { matchId: "match-1", eventId: "event-1", amount: 4 } } });
  const bets = teamBets();
  const matches = [{
    firestoreId: "match-1",
    id: "match-1",
    eventId: "event-1",
    betA: "bet-a",
    betB: "bet-b",
    userA: "cole",
    userB: "jamie",
    sideA: "away",
    sideB: "home",
    amount: 4,
    status: "matched"
  }];
  const ledger = [{ firestoreId: "stale", id: "stale", matchId: "match-1", eventId: "event-1", amount: 4 }];

  const summary = await settleFinalEvents(db, FakeFieldValue, [teamEvent({ score: { away: 2, home: 2 } })], bets, matches, ledger);

  assert.equal(summary.tiesVoided, 1);
  assert.equal(summary.ledgerWrites, 0);
  assert.equal(db.entries("ledgerEntries").length, 0);
  assert.equal(db.get("matches", "match-1").status, "void");
  assert.equal(db.get("bets", "bet-a").status, "void");
  assert.equal(db.get("bets", "bet-b").status, "void");
});

test("settles only a completed UFC fight while the card remains live", async () => {
  const db = new FakeFirestore();
  const event = {
    firestoreId: "ufc-1",
    id: "ufc-1",
    type: "FIGHT_CARD",
    league: "UFC",
    title: "UFC Test",
    status: "live",
    fights: [
      { id: "fight-1", fighterA: "Alpha", fighterB: "Beta", status: "final", winner: "Alpha" },
      { id: "fight-2", fighterA: "Gamma", fighterB: "Delta", status: "live", winner: "" }
    ],
    fightResults: { "fight-1": "Alpha" }
  };
  const bets = [
    { firestoreId: "ufc-bet-a", id: "ufc-bet-a", eventId: "ufc-1", fightId: "fight-1", userId: "cole", side: "fighterA", amount: 3, status: "matched" },
    { firestoreId: "ufc-bet-b", id: "ufc-bet-b", eventId: "ufc-1", fightId: "fight-1", userId: "chris", side: "fighterB", amount: 3, status: "matched" },
    { firestoreId: "ufc-open", id: "ufc-open", eventId: "ufc-1", fightId: "fight-2", userId: "jamie", side: "fighterA", amount: 2, status: "open" }
  ];
  const matches = [{
    firestoreId: "ufc-match",
    id: "ufc-match",
    eventId: "ufc-1",
    fightId: "fight-1",
    betA: "ufc-bet-a",
    betB: "ufc-bet-b",
    userA: "cole",
    userB: "chris",
    sideA: "fighterA",
    sideB: "fighterB",
    amount: 3,
    status: "matched"
  }];

  const summary = await settleFinalEvents(db, FakeFieldValue, [event], bets, matches, []);

  assert.equal(summary.matches, 1);
  assert.equal(db.get("matches", "ufc-match").winner, "cole");
  assert.equal(db.get("bets", "ufc-bet-a").status, "settled");
  assert.equal(db.get("bets", "ufc-bet-b").status, "settled");
  assert.equal(db.get("bets", "ufc-open"), undefined, "open later-fight bet must not be touched");
  assert.equal(db.get("events", "ufc-1").settlementStatus, "in-progress");
  assert.equal(db.get("events", "ufc-1").hiddenFromNow, undefined);
});

test("does not duplicate an already settled ledger entry", async () => {
  const db = new FakeFirestore();
  const bets = teamBets().map(bet => ({ ...bet, status: "settled" }));
  const matches = [{
    firestoreId: "match-1",
    id: "match-1",
    eventId: "event-1",
    betA: "bet-a",
    betB: "bet-b",
    userA: "cole",
    userB: "jamie",
    sideA: "away",
    sideB: "home",
    amount: 4,
    winner: "jamie",
    loser: "cole",
    status: "settled"
  }];
  const ledger = [{ firestoreId: "ledger-1", id: "ledger-1", eventId: "event-1", matchId: "match-1", fromUser: "cole", toUser: "jamie", amount: 4 }];

  const summary = await settleFinalEvents(db, FakeFieldValue, [teamEvent()], bets, matches, ledger);

  assert.equal(summary.ledgerWrites, 0);
  assert.equal(summary.matches, 0);
  assert.equal(db.commits, 0);
});

test("settles multiple matched bets on the same final event", async () => {
  const db = new FakeFirestore();
  const bets = [
    { firestoreId: "a1", id: "a1", eventId: "event-1", userId: "cole", side: "away", amount: 2, status: "matched" },
    { firestoreId: "b1", id: "b1", eventId: "event-1", userId: "jamie", side: "home", amount: 2, status: "matched" },
    { firestoreId: "a2", id: "a2", eventId: "event-1", userId: "cole", side: "away", amount: 5, status: "matched" },
    { firestoreId: "b2", id: "b2", eventId: "event-1", userId: "chris", side: "home", amount: 5, status: "matched" }
  ];
  const matches = [
    { firestoreId: "m1", id: "m1", eventId: "event-1", betA: "a1", betB: "b1", userA: "cole", userB: "jamie", sideA: "away", sideB: "home", amount: 2, status: "matched" },
    { firestoreId: "m2", id: "m2", eventId: "event-1", betA: "a2", betB: "b2", userA: "cole", userB: "chris", sideA: "away", sideB: "home", amount: 5, status: "matched" }
  ];

  const summary = await settleFinalEvents(db, FakeFieldValue, [teamEvent()], bets, matches, []);

  assert.equal(summary.matches, 2);
  assert.equal(summary.ledgerWrites, 2);
  assert.equal(db.entries("ledgerEntries").length, 2);
  assert.deepEqual(db.entries("ledgerEntries").map(entry => entry.amount).sort((a, b) => a - b), [2, 5]);
});

test("legacy UFC match can recover users, sides, and amount from its linked bets", async () => {
  const db = new FakeFirestore();
  const event = {
    firestoreId: "ufc-legacy",
    id: "ufc-legacy",
    type: "FIGHT_CARD",
    league: "UFC",
    status: "live",
    fights: [{ id: "f1", fighterA: "Alpha", fighterB: "Beta", status: "final", winner: "Alpha" }],
    fightResults: { f1: "Alpha" }
  };
  const bets = [
    { firestoreId: "ua", id: "ua", eventId: "ufc-legacy", fightId: "f1", userId: "cole", side: "fighterA", amount: 6, status: "matched" },
    { firestoreId: "ub", id: "ub", eventId: "ufc-legacy", fightId: "f1", userId: "jamie", side: "fighterB", amount: 6, status: "matched" }
  ];
  const matches = [{ firestoreId: "um", id: "um", eventId: "ufc-legacy", fightId: "f1", betA: "ua", betB: "ub", status: "matched" }];

  const summary = await settleFinalEvents(db, FakeFieldValue, [event], bets, matches, []);

  assert.equal(summary.matches, 1);
  assert.equal(db.get("matches", "um").winner, "cole");
  assert.equal(db.entries("ledgerEntries")[0].amount, 6);
});

test("UFC settlement defers rather than writing a zero-dollar ledger entry", async () => {
  const db = new FakeFirestore();
  const event = {
    firestoreId: "ufc-zero",
    id: "ufc-zero",
    type: "FIGHT_CARD",
    league: "UFC",
    status: "live",
    fights: [{ id: "f1", fighterA: "Alpha", fighterB: "Beta", status: "final", winner: "Alpha" }]
  };
  const matches = [{
    firestoreId: "zero-match",
    id: "zero-match",
    eventId: "ufc-zero",
    fightId: "f1",
    userA: "cole",
    userB: "jamie",
    sideA: "fighterA",
    sideB: "fighterB",
    status: "matched"
  }];

  const summary = await settleFinalEvents(db, FakeFieldValue, [event], [], matches, []);

  assert.equal(summary.deferred, 1);
  assert.equal(summary.ledgerWrites, 0);
  assert.equal(db.entries("ledgerEntries").length, 0);
});
