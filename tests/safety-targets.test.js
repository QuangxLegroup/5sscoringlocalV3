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
  const auditEntries = [];
  const context = vm.createContext({
    currentUser: { role: "viewer" }, isAdminAccount: user => user.role === "admin", state,
    SAFETY_PERIOD_TYPE: "safety",
    getSafetyMonthlyTarget: (year, month) => Number(state.safetyMonthlyTargets?.[year]?.[month] ?? 100),
    getPeriodsByType: () => [{ id: "safety-2026-09", year: 2026, month: 9 }],
    logDetailedHistoryChange: async entry => { auditEntries.push(entry); },
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
  assert.equal(auditEntries.length, 1);
  assert.equal(auditEntries[0].before, "100%");
  assert.equal(auditEntries[0].after, "85%");
  assert.equal(auditEntries[0].periodId, "safety-2026-09");
  context.dbRef = () => ({ set: async () => { throw new Error("Save failed"); } });
  await assert.rejects(context.updateSafetyMonthlyTarget(2026, 9, 10), /Save failed/);
  assert.equal(state.safetyMonthlyTargets[2026][9], 85);
  assert.equal(writes, 2);
  assert.equal(auditEntries.length, 1, "failed saves must not create an audit entry");
});

test("admin changes to a Zone safety target are included in audit history", async () => {
  const period = {
    id: "safety-2026-10",
    settingsSnapshot: { areas: [{ id: "zone-2", code: "2", safetyTarget: 75 }] },
  };
  const auditEntries = [];
  const savedSnapshots = [];
  const context = vm.createContext({
    currentUser: { role: "admin" },
    SAFETY_PERIOD_TYPE: "safety",
    SAFETY_ZONE_TARGETS: { "2": 80 },
    isAdminAccount: user => user.role === "admin",
    getPeriod: () => period,
    getActivePeriodId: () => period.id,
    ensurePeriodSnapshotLocal: () => period.settingsSnapshot,
    shouldEditPeriodSnapshot: () => true,
    getSafetyZoneTarget: area => Number(area.safetyTarget || 0),
    savePeriodSnapshot: async targetPeriod => { savedSnapshots.push(structuredClone(targetPeriod.settingsSnapshot)); },
    logDetailedHistoryChange: async entry => { auditEntries.push(entry); },
    pushUndoAction() {}, showToast() {}, renderActiveTab() {},
  });
  vm.runInContext(readFunction("app.js", "updateSafetyZoneTarget"), context);

  await context.updateSafetyZoneTarget(period.id, "zone-2", 90);

  assert.equal(period.settingsSnapshot.areas[0].safetyTarget, 90);
  assert.equal(savedSnapshots.length, 1);
  assert.equal(auditEntries.length, 1);
  assert.equal(auditEntries[0].periodId, period.id);
  assert.equal(auditEntries[0].areaCode, "2");
  assert.equal(auditEntries[0].details[0].before, "75%");
  assert.equal(auditEntries[0].details[0].after, "90%");
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
