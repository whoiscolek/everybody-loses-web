import test from "node:test";
import assert from "node:assert/strict";
import { createRepairMatchupHandler } from "../api/repair-matchup.js";
import { FakeFieldValue, FakeFirestore } from "./helpers/fake-firestore.js";

class MockResponse {
  constructor() {
    this.statusCode = 200;
    this.headers = {};
    this.body = "";
  }
  setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; }
  end(value = "") { this.body = String(value); return this; }
  parsed() { return this.body ? JSON.parse(this.body) : null; }
}

function servicesFor(db) {
  return {
    db,
    FieldValue: FakeFieldValue,
    auth: {
      async verifyIdToken(token) {
        assert.equal(token, "admin-token");
        return { uid: "admin" };
      }
    }
  };
}

function post(body) {
  return {
    method: "POST",
    headers: { authorization: "Bearer admin-token" },
    body
  };
}

test("repair endpoint creates a complete team match when both users have no existing bet", async () => {
  const db = new FakeFirestore({
    users: {
      admin: { approved: true, isAdmin: true },
      cole: { approved: true, isAdmin: false },
      jamie: { approved: true, isAdmin: false }
    },
    events: {
      "event-1": { id: "event-1", shortCode: "NBA0619-1", type: "TEAM_HEAD_TO_HEAD", status: "live" }
    }
  });
  const handler = createRepairMatchupHandler(() => servicesFor(db));
  const res = new MockResponse();

  await handler(post({
    eventId: "NBA0619-1",
    userA: "cole",
    userB: "jamie",
    pickA: "away",
    pickB: "home",
    amount: 4
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.parsed().ok, true);
  assert.equal(res.parsed().version, "10.83");
  assert.equal(db.entries("bets").length, 2);
  assert.equal(db.entries("matches").length, 1);

  const match = db.entries("matches")[0];
  assert.equal(match.eventId, "event-1");
  assert.equal(match.userA, "cole");
  assert.equal(match.userB, "jamie");
  assert.equal(match.sideA, "away");
  assert.equal(match.sideB, "home");
  assert.equal(match.amount, 4);
  assert.equal(match.status, "matched");
  assert.equal(db.entries("bets").every(bet => bet.status === "matched"), true);
});

test("repair endpoint preserves existing bet IDs and replaces conflicting unsettled match", async () => {
  const db = new FakeFirestore({
    users: {
      admin: { approved: true, isAdmin: true },
      cole: { approved: true },
      chris: { approved: true },
      jamie: { approved: true }
    },
    events: {
      "ufc-1": {
        id: "ufc-1",
        type: "FIGHT_CARD",
        league: "UFC",
        fights: [{ id: "fight-6", order: 6, fighterA: "Alpha", fighterB: "Beta" }]
      }
    },
    bets: {
      "cole-bet": { id: "cole-bet", eventId: "ufc-1", fightId: "fight-6", userId: "cole", side: "fighterA", amount: 3, status: "matched" },
      "chris-bet": { id: "chris-bet", eventId: "ufc-1", fightId: "fight-6", userId: "chris", side: "fighterB", amount: 3, status: "matched" },
      "jamie-old": { id: "jamie-old", eventId: "ufc-1", fightId: "fight-6", userId: "jamie", side: "fighterB", amount: 3, status: "matched" }
    },
    matches: {
      conflict: {
        id: "conflict",
        eventId: "ufc-1",
        fightId: "fight-6",
        betA: "cole-bet",
        betB: "jamie-old",
        userA: "cole",
        userB: "jamie",
        status: "matched"
      }
    }
  });
  const handler = createRepairMatchupHandler(() => servicesFor(db));
  const res = new MockResponse();

  await handler(post({
    eventId: "ufc-1",
    fightId: "6",
    userA: "cole",
    userB: "chris",
    pickA: "fighterA",
    pickB: "fighterB",
    amount: 3
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(db.get("matches", "conflict"), undefined);
  assert.equal(db.get("bets", "cole-bet").status, "matched");
  assert.equal(db.get("bets", "chris-bet").status, "matched");
  assert.equal(db.get("bets", "jamie-old").status, "open");

  const [match] = db.entries("matches");
  assert.equal(match.betA, "cole-bet");
  assert.equal(match.betB, "chris-bet");
  assert.equal(match.fightId, "fight-6");
});
