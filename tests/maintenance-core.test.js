import test from "node:test";
import assert from "node:assert/strict";
import { cleanForFirestore, cleanupHistory } from "../api/maintenance.js";
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
