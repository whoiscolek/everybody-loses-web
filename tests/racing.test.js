import test from "node:test";
import assert from "node:assert/strict";
import { rowsFromIndyCarText } from "../api/espn-events.js";

test("IndyCar text parser recognizes positions and multi-word driver names", () => {
  const html = `
    <div>Position</div>
    <div>1 Alex Palou Running</div>
    <div>2 Pato O'Ward +1.245s</div>
    <div>3 Scott McLaughlin Lap 45</div>
  `;

  const rows = rowsFromIndyCarText(html);

  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(row => row.position), [1, 2, 3]);
  assert.deepEqual(rows.map(row => row.name), ["Alex Palou", "Pato O'Ward", "Scott McLaughlin"]);
});
