import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { APP_VERSION } from "../api/_version.js";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");

test("package, API, and maintenance release versions stay aligned", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  assert.equal(packageJson.version, `${APP_VERSION}.0`);

  const maintenance = await read("api/maintenance.js");
  assert.match(maintenance, /const MAINTENANCE_VERSION = APP_VERSION/);
});

test("package lock contains only public npm registry URLs", async () => {
  const lockfile = await read("package-lock.json");
  assert.doesNotMatch(lockfile, /applied-caas-gateway|internal\.api\.openai\.org|artifactory\/api\/npm/i);
});

test("settlement endpoint remains isolated from the maintenance bundle", async () => {
  const settleEndpoint = await read("api/settle-event.js");
  assert.doesNotMatch(settleEndpoint, /from ["']\.\/maintenance\.js["']/);
  assert.match(settleEndpoint, /from ["']\.\/_settlement\.js["']/);
});

test("browser bundle has no client-side admin unlock or embedded owner credentials", async () => {
  const client = await read("src/main.js");
  assert.doesNotMatch(client, /ADMIN_UNLOCK|adminUnlock|admin-unlock/i);
  assert.doesNotMatch(client, /client-side owner unlock/i);
});

test("history is retained by default and browser maintenance never deletes it", async () => {
  const client = await read("src/main.js");
  assert.doesNotMatch(client, /cleanupOldHistoryEvents/);
  assert.doesNotMatch(client, /HISTORY_RETENTION_MS/);
  assert.match(client, /function eventIsWithinHistoryWindow\(event\) \{\s*return event\?\.status === ["']final["'];\s*\}/s);
});

test("Firestore rules block users from self-approving or self-promoting", async () => {
  const rules = await read("firestore.rules");
  assert.match(rules, /request\.resource\.data\.approved == false/);
  assert.match(rules, /request\.resource\.data\.isAdmin == false/);
  assert.match(rules, /diff\(resource\.data\)\.affectedKeys\(\)\.hasOnly/);

  const ownProfileUpdate = rules.match(/allow update: if admin\(\) \|\| \((.*?)\n\s*\);/s)?.[1] || "";
  assert.doesNotMatch(ownProfileUpdate, /["']approved["']/);
  assert.doesNotMatch(ownProfileUpdate, /["']isAdmin["']/);
});


test("CI runs the same release verification command used locally", async () => {
  const workflow = await read(".github/workflows/quality.yml");
  assert.match(workflow, /npm ci --no-audit --no-fund/);
  assert.match(workflow, /npm run verify/);
  assert.match(workflow, /node-version:\s*22/);
});

test("UFC repair metadata has a single shared source of truth", async () => {
  const client = await read("src/main.js");
  const espn = await read("api/espn-events.js");
  const shared = await read("shared/ufc-repairs.js");
  assert.match(client, /from ["']\.\.\/shared\/ufc-repairs\.js["']/);
  assert.match(espn, /from ["']\.\.\/shared\/ufc-repairs\.js["']/);
  assert.equal((shared.match(/600058854/g) || []).length, 1);
  assert.doesNotMatch(client, /const UFC_CARD_REPAIRS\s*=/);
  assert.doesNotMatch(espn, /const UFC_CARD_REPAIRS\s*=/);
});


test("Firestore rules prevent approved users from rewriting bet ownership or unrelated matches", async () => {
  const rules = await read("firestore.rules");
  assert.match(rules, /affectedKeys\(\)\.hasOnly\(\["status", "updatedAt"\]\)/);
  assert.match(rules, /resource\.data\.userId == request\.auth\.uid/);
  assert.match(rules, /resource\.data\.userA == request\.auth\.uid \|\| resource\.data\.userB == request\.auth\.uid/);
  assert.doesNotMatch(rules, /allow update, delete: if approved\(\) \|\| admin\(\)/);
});


test("administrator view includes a complete read-only betting ledger", async () => {
  const client = await read("src/main.js");
  assert.match(client, /function renderAdminFullBetLedger\(\)/);
  assert.match(client, /Complete betting ledger/);
  assert.match(client, /\$\{renderAdminFullBetLedger\(\)\}/);
});

test("Firebase Admin loads lazily so serverless startup failures can be reported", async () => {
  const admin = await read("api/_admin.js");
  assert.doesNotMatch(admin, /^import .*firebase-admin/m);
  assert.match(admin, /await Promise\.all\(\[/);
  assert.match(admin, /import\("firebase-admin\/app"\)/);
  const packageJson = JSON.parse(await read("package.json"));
  assert.equal(packageJson.dependencies["firebase-admin"], "13.10.0");
});
