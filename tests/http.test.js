import test from "node:test";
import assert from "node:assert/strict";
import { bearerToken, requestBody, requestQuery } from "../api/_http.js";

test("requestQuery parses a raw serverless URL when req.query is absent", () => {
  const query = requestQuery({ url: "/api/maintenance?mode=discover&offset=2", headers: { host: "example.test" } });
  assert.deepEqual(query, { mode: "discover", offset: "2" });
});

test("requestQuery prefers the platform-provided query object", () => {
  assert.deepEqual(requestQuery({ query: { mode: "settle" }, url: "/?mode=refresh" }), { mode: "settle" });
});

test("requestBody parses JSON strings and rejects malformed JSON with a structured error", () => {
  assert.deepEqual(requestBody({ body: '{"eventId":"abc"}' }), { eventId: "abc" });
  assert.throws(() => requestBody({ body: "{" }), error => error.code === "INVALID_JSON" && error.status === 400);
});

test("bearerToken is case-insensitive and trims whitespace", () => {
  assert.equal(bearerToken({ headers: { authorization: "bearer   token-value  " } }), "token-value");
  assert.equal(bearerToken({ headers: {} }), "");
});
