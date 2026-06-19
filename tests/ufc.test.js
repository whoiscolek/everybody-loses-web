import test from "node:test";
import assert from "node:assert/strict";
import { mergeUfcFights } from "../api/maintenance.js";
import {
  extractUfcFightsFromEvent,
  mapUfcFightCards,
  ufcFightStatus,
  ufcWinnerFromCompetition
} from "../api/espn-events.js";

function competition(id, fighterA, fighterB, options = {}) {
  return {
    id,
    type: { text: options.typeText || "Main Card" },
    status: {
      type: {
        state: options.state || "pre",
        completed: Boolean(options.completed),
        description: options.statusText || "Scheduled"
      }
    },
    competitors: [
      { athlete: { displayName: fighterA }, winner: options.winner === fighterA },
      { athlete: { displayName: fighterB }, winner: options.winner === fighterB }
    ]
  };
}

test("UFC merge expands five stored fights to seven without changing existing fight IDs", () => {
  const existing = Array.from({ length: 5 }, (_, index) => ({
    id: `stored-${index + 1}`,
    fighterA: `A${index + 1}`,
    fighterB: `B${index + 1}`,
    status: "pregame"
  }));
  const incoming = Array.from({ length: 7 }, (_, index) => ({
    id: `source-${index + 1}`,
    fighterA: `A${index + 1}`,
    fighterB: `B${index + 1}`,
    status: index < 6 ? "final" : "live",
    winner: index < 6 ? `A${index + 1}` : ""
  }));

  const merged = mergeUfcFights(existing, incoming);

  assert.equal(merged.length, 7);
  assert.deepEqual(merged.slice(0, 5).map(fight => fight.id), existing.map(fight => fight.id));
  assert.equal(merged[5].id, "source-6");
  assert.equal(merged[6].id, "source-7");
  assert.equal(merged[4].status, "final");
});

test("partial UFC refresh cannot shrink a previously complete card", () => {
  const existing = Array.from({ length: 7 }, (_, index) => ({
    id: `fight-${index + 1}`,
    fighterA: `A${index + 1}`,
    fighterB: `B${index + 1}`,
    status: "pregame"
  }));
  const incoming = existing.slice(0, 5).map((fight, index) => ({ ...fight, status: index < 4 ? "final" : "live" }));

  const merged = mergeUfcFights(existing, incoming);

  assert.equal(merged.length, 7);
  assert.equal(merged[0].status, "final");
  assert.equal(merged[5].id, "fight-6");
  assert.equal(merged[6].id, "fight-7");
});

test("winner and status parsing handles ESPN competitor winner flags", () => {
  const bout = competition("c1", "Alpha", "Beta", { winner: "Beta", completed: true, state: "post", statusText: "Final" });
  assert.equal(ufcWinnerFromCompetition(bout), "Beta");
  assert.equal(ufcFightStatus(bout, {}), "final");
});

test("UFC extraction excludes labeled prelims but preserves every main-card fight", () => {
  const event = {
    id: "test-event",
    competitions: [
      competition("p1", "Prelim A", "Prelim B", { typeText: "Prelims" }),
      ...Array.from({ length: 7 }, (_, index) => competition(`m${index + 1}`, `Main A${index + 1}`, `Main B${index + 1}`, {
        typeText: index === 6 ? "Main Event" : index === 5 ? "Co-Main" : "Main Card"
      }))
    ]
  };

  const fights = extractUfcFightsFromEvent(event);

  assert.equal(fights.length, 7);
  assert.equal(fights.at(-1).cardRole, "main-event");
  assert.equal(fights.at(-2).cardRole, "co-main");
  assert.equal(fights.some(fight => fight.fighterA === "Prelim A"), false);
});

test("card status stays live until every fight is final", () => {
  const event = {
    id: "card-live",
    name: "UFC Test",
    date: "2026-06-19T00:00:00Z",
    competitions: [
      competition("f1", "Alpha", "Beta", { winner: "Alpha", completed: true, state: "post", statusText: "Final" }),
      competition("f2", "Gamma", "Delta", { state: "in", statusText: "In Progress" })
    ]
  };
  const [card] = mapUfcFightCards([event], { appSport: "combat", league: "UFC" }, "20260619");
  assert.equal(card.status, "live");
  assert.equal(card.fights[0].status, "final");
  assert.equal(card.fights[1].status, "live");
});
