import test from "node:test";
import assert from "node:assert/strict";
import maintenanceHandler from "../api/maintenance.js";
import espnHandler from "../api/espn-events.js";
import repairHandler from "../api/repair-matchup.js";
import settleHandler from "../api/settle-event.js";
import healthHandler from "../api/health.js";
import adminHealthHandler from "../api/admin-health.js";

class MockResponse {
  constructor() {
    this.statusCode = 200;
    this.headers = {};
    this.body = "";
    this.finished = false;
  }
  setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; }
  status(code) { this.statusCode = code; return this; }
  json(value) { this.body = JSON.stringify(value); this.finished = true; return this; }
  end(value = "") { this.body = String(value); this.finished = true; return this; }
  parsed() { return this.body ? JSON.parse(this.body) : null; }
}

function withoutFirebaseAdminCredentials(run) {
  const keys = ["FIREBASE_SERVICE_ACCOUNT_JSON", "FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  return Promise.resolve(run()).finally(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });
}

test("maintenance rejects unsupported mode before initializing Firebase Admin", async () => {
  const res = new MockResponse();
  await maintenanceHandler({ method: "POST", url: "/api/maintenance?mode=not-real", headers: { host: "localhost" } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.parsed().error, "Unsupported maintenance mode");
});

test("maintenance returns structured configuration error instead of crashing when req.query is absent", async () => {
  await withoutFirebaseAdminCredentials(async () => {
    const res = new MockResponse();
    await maintenanceHandler({ method: "POST", url: "/api/maintenance?mode=refresh", headers: { host: "localhost" } }, res);
    assert.equal(res.statusCode, 500);
    assert.equal(res.parsed().code, "ADMIN_CREDENTIALS_MISSING");
    assert.equal(typeof res.parsed().version, "string");
  });
});

test("ESPN endpoint parses league from raw URL and returns structured unsupported-league response", async () => {
  const res = new MockResponse();
  await espnHandler({ method: "GET", url: "/api/espn-events?league=Nope", headers: { host: "localhost" } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.parsed().error, "Unsupported league");
  assert.ok(Array.isArray(res.parsed().supportedLeagues));
});

test("admin write endpoints reject wrong methods without touching Firebase", async () => {
  const repairRes = new MockResponse();
  await repairHandler({ method: "GET", headers: {} }, repairRes);
  assert.equal(repairRes.statusCode, 405);

  const settleRes = new MockResponse();
  await settleHandler({ method: "GET", headers: {} }, settleRes);
  assert.equal(settleRes.statusCode, 405);
});


test("admin backend health returns a structured Firebase configuration error instead of crashing", async () => {
  await withoutFirebaseAdminCredentials(async () => {
    const res = new MockResponse();
    await adminHealthHandler({ method: "GET", headers: {}, url: "/api/admin-health" }, res);
    assert.equal(res.statusCode, 500);
    assert.equal(res.parsed().ok, false);
    assert.equal(res.parsed().code, "ADMIN_CREDENTIALS_MISSING");
    assert.equal(res.parsed().stage, "loading Firebase Admin SDK");
  });
});

test("health endpoint reports the deployed application and Node runtime versions", async () => {
  const res = new MockResponse();
  await healthHandler({ method: "GET", headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.parsed().ok, true);
  assert.equal(res.parsed().version, "10.84");
  assert.match(res.parsed().runtime, /^v22\./);
});
