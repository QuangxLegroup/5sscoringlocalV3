"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { AuthService } = require("../src/server/services/auth-service");

function readFunction(file, name) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  return source.match(new RegExp(`  (?:async )?function ${name}\\([^]*?\\n  }`))[0];
}

test("viewers see monthly targets as text; admins retain editable inputs", () => {
  const context = vm.createContext({ MONTHS: Array.from({ length: 12 }, (_, i) => i + 1), formatPercent: () => "0%", numberCell: value => value || "" });
  vm.runInContext(readFunction("modules/pages/safety-page.js", "renderProgressTable"), context);
  for (const role of ["viewer", "admin"]) {
    const html = context.renderProgressTable([], [], 2026, { currentUser: { role }, isAdminAccount: user => user.role === "admin", getSafetyMonthlyTarget: () => 85 });
    assert.equal((html.match(/data-progress-target-input/g) || []).length, role === "admin" ? 12 : 0);
    if (role === "viewer") assert.match(html, /<span>85<\/span>/);
  }
});

test("viewer cannot mutate targets, local storage, or database through the update handler", async () => {
  const state = { safetyMonthlyTargets: { 2026: { 9: 100 } } };
  let writes = 0;
  const context = vm.createContext({
    currentUser: { role: "viewer" }, isAdminAccount: user => user.role === "admin", state,
    window: { localStorage: { setItem: () => { writes++; } } }, dbRef: () => ({ set: async () => { writes++; } }),
    showToast() {}, renderActiveTab() {},
  });
  vm.runInContext(readFunction("app.js", "updateSafetyMonthlyTarget"), context);
  assert.equal(await context.updateSafetyMonthlyTarget(2026, 9, 25), false);
  assert.equal(state.safetyMonthlyTargets[2026][9], 100);
  assert.equal(writes, 0);
  context.currentUser.role = "admin";
  assert.equal(await context.updateSafetyMonthlyTarget(2026, 9, 85), 85);
  assert.equal(state.safetyMonthlyTargets[2026][9], 85);
  assert.equal(writes, 2);
  context.dbRef = () => ({ set: async () => { throw new Error("Save failed"); } });
  await assert.rejects(context.updateSafetyMonthlyTarget(2026, 9, 10), /Save failed/);
  assert.equal(state.safetyMonthlyTargets[2026][9], 85);
  assert.equal(writes, 2);
});

test("server rejects viewer target writes including root batches", () => {
  const auth = new AuthService({ repository: {}, secret: "test-only" });
  for (const command of [
    { operation: "set", path: "safetyMonthlyTargets/2026/9", value: 25 },
    { operation: "update", path: "safetyMonthlyTargets/2026", value: { 9: 25 } },
    { operation: "update", path: "", value: { "safetyMonthlyTargets/2026/9": 25 } },
    { operation: "remove", path: "safetyMonthlyTargets" },
  ]) assert.throws(() => auth.assertDataWriteAllowed(command, { account: { role: "viewer" } }, {}), { statusCode: 403 });
});
