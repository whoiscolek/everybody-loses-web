import test from "node:test";
import assert from "node:assert/strict";
import { cleanForFirestore, cleanupHistory, expireStaleOpenBets, reconcileSettledLedgerRows } from "../api/maintenance.js";
import { FakeFirestore, FakeFieldValue } from "./helpers/fake-firestore.js";

test("cleanForFirestore removes undefined fields without corrupting Timestamp-like values", () => {
  class TimestampLike {
    constructor(seconds) { this.seconds = seconds; }
    toDate() { return new Date(this.seconds * 1000); }
  }
  const timestamp = new TimestampLike(123);
  const cleaned = cleanForFirestore({
    keep: "value",
    remove: undefined,
    nested: { keep: 1, remove: undefined },
    timestamp
  });

  assert.deepEqual(cleaned.nested, { keep: 1 });
  assert.equal("remove" in cleaned, false);
  assert.strictEqual(cleaned.timestamp, timestamp);
});

test("history cleanup is disabled by default", async () => {
  const previous = process.env.HISTORY_RETENTION_DAYS;
  delete process.env.HISTORY_RETENTION_DAYS;
  try {
    const db = new FakeFirestore({
      events: { old: { status: "final" } },
      bets: { bet: { eventId: "old" } },
      matches: { match: { eventId: "old", status: "settled" } }
    });
    const removed = await cleanupHistory(
      db,
      FakeFieldValue,
      [{ firestoreId: "old", id: "old", status: "final", startTime: "2020-01-01T00:00:00Z" }],
      [{ firestoreId: "bet", eventId: "old" }],
      [{ firestoreId: "match", eventId: "old", status: "settled" }]
    );
    assert.equal(removed, 0);
    assert.ok(db.get("events", "old"));
    assert.ok(db.get("bets", "bet"));
    assert.ok(db.get("matches", "match"));
  } finally {
    if (previous === undefined) delete process.env.HISTORY_RETENTION_DAYS;
    else process.env.HISTORY_RETENTION_DAYS = previous;
  }
});

test("history cleanup only runs when an administrator explicitly configures retention", async () => {
  const previous = process.env.HISTORY_RETENTION_DAYS;
  process.env.HISTORY_RETENTION_DAYS = "5";
  try {
    const db = new FakeFirestore({
      events: { old: { status: "final" } },
      bets: { bet: { eventId: "old" } },
      matches: { match: { eventId: "old", status: "settled" } }
    });
    const removed = await cleanupHistory(
      db,
      FakeFieldValue,
      [{ firestoreId: "old", id: "old", status: "final", startTime: "2020-01-01T00:00:00Z" }],
      [{ firestoreId: "bet", eventId: "old" }],
      [{ firestoreId: "match", eventId: "old", status: "settled" }]
    );
    assert.equal(removed, 1);
    assert.equal(db.get("events", "old"), undefined);
    assert.equal(db.get("bets", "bet"), undefined);
    assert.equal(db.get("matches", "match"), undefined);
  } finally {
    if (previous === undefined) delete process.env.HISTORY_RETENTION_DAYS;
    else process.env.HISTORY_RETENTION_DAYS = previous;
  }
});

test("history cleanup stamps surviving ledger rows with event identity before deleting event docs", async () => {
  const previous = process.env.HISTORY_RETENTION_DAYS;
  process.env.HISTORY_RETENTION_DAYS = "5";
  try {
    const db = new FakeFirestore({
      events: { old: { status: "final" } },
      bets: { bet: { eventId: "old" } },
      matches: { match: { eventId: "old", status: "settled" } },
      ledgerEntries: { ledger: { eventId: "old", fromUser: "jamie", toUser: "cole", amount: 5 } }
    });
    const removed = await cleanupHistory(
      db,
      FakeFieldValue,
      [{
        firestoreId: "old",
        id: "old",
        status: "final",
        startTime: "2020-01-01T00:00:00Z",
        type: "TEAM_HEAD_TO_HEAD",
        sport: "basketball",
        league: "NBA",
        shortCode: "NBA0601-1",
        away: { name: "Boston Celtics", code: "BOS" },
        home: { name: "New York Knicks", code: "NYK" }
      }],
      [{ firestoreId: "bet", eventId: "old" }],
      [{ firestoreId: "match", eventId: "old", status: "settled" }],
      [{ firestoreId: "ledger", eventId: "old", fromUser: "jamie", toUser: "cole", amount: 5 }]
    );

    assert.equal(removed, 1);
    assert.equal(db.get("events", "old"), undefined);
    const ledger = db.get("ledgerEntries", "ledger");
    assert.equal(ledger.eventSport, "basketball");
    assert.equal(ledger.eventLeague, "NBA");
    assert.equal(ledger.eventShortCode, "NBA0601-1");
    assert.equal(ledger.eventSnapshot.title, "Boston Celtics at New York Knicks");
  } finally {
    if (previous === undefined) delete process.env.HISTORY_RETENTION_DAYS;
    else process.env.HISTORY_RETENTION_DAYS = previous;
  }
});


test("maintenance expires open bets when their linked event is final", async () => {
  const db = new FakeFirestore({
    bets: { stale: { eventId: "event-1", status: "open", createdAt: "2026-06-01T00:00:00Z" } }
  });

  const changed = await expireStaleOpenBets(
    db,
    FakeFieldValue,
    [{ firestoreId: "event-1", id: "event-1", status: "final", startTime: "2026-06-01T00:00:00Z" }],
    [{ firestoreId: "stale", id: "stale", eventId: "event-1", status: "open", createdAt: "2026-06-01T00:00:00Z" }],
    Date.parse("2026-06-02T00:00:00Z")
  );

  assert.equal(changed, 1);
  assert.equal(db.get("bets", "stale").status, "expired");
  assert.match(db.get("bets", "stale").staleReason, /linked event is final/);
});

test("maintenance expires orphaned open bets only after the grace window", async () => {
  const oldDb = new FakeFirestore({
    bets: { old: { eventId: "missing", status: "open", createdAt: "2026-06-01T00:00:00Z" } }
  });
  const recentDb = new FakeFirestore({
    bets: { recent: { eventId: "missing", status: "open", createdAt: "2026-06-01T20:00:00Z" } }
  });

  const now = Date.parse("2026-06-03T00:00:00Z");
  const oldChanged = await expireStaleOpenBets(
    oldDb,
    FakeFieldValue,
    [],
    [{ firestoreId: "old", id: "old", eventId: "missing", status: "open", createdAt: "2026-06-01T00:00:00Z" }],
    now
  );
  const recentChanged = await expireStaleOpenBets(
    recentDb,
    FakeFieldValue,
    [],
    [{ firestoreId: "recent", id: "recent", eventId: "missing", status: "open", createdAt: "2026-06-01T20:00:00Z" }],
    now
  );

  assert.equal(oldChanged, 1);
  assert.equal(oldDb.get("bets", "old").status, "expired");
  assert.equal(recentChanged, 0);
  assert.equal(recentDb.get("bets", "recent").status, "open");
});

test("maintenance reconciles older open ledger rows covered by an existing net settlement", async () => {
  const db = new FakeFirestore({
    ledgerEntries: {
      won: {
        fromUser: "jamie",
        toUser: "cole",
        amount: 25,
        settled: true,
        createdAt: "2026-06-20T12:00:00Z",
        settlementId: "settle-1"
      },
      leftover: {
        fromUser: "cole",
        toUser: "jamie",
        amount: 3,
        settled: false,
        createdAt: "2026-06-20T12:05:00Z"
      },
      newer: {
        fromUser: "cole",
        toUser: "jamie",
        amount: 2,
        settled: false,
        createdAt: "2026-06-21T12:00:00Z"
      }
    },
    settlements: {
      "settle-1": {
        fromUser: "jamie",
        toUser: "cole",
        amount: 22,
        createdAt: "2026-06-20T12:10:00Z"
      }
    }
  });

  const changed = await reconcileSettledLedgerRows(
    db,
    FakeFieldValue,
    db.entries("ledgerEntries").map(row => ({ firestoreId: row.id, ...row })),
    db.entries("settlements").map(row => ({ firestoreId: row.id, ...row }))
  );

  assert.equal(changed, 1);
  assert.equal(db.get("ledgerEntries", "leftover").settled, true);
  assert.equal(db.get("ledgerEntries", "leftover").settlementId, "settle-1");
  assert.match(db.get("ledgerEntries", "leftover").settlementRepairReason, /settle-up covered/);
  assert.equal(db.get("ledgerEntries", "newer").settled, false);
});
