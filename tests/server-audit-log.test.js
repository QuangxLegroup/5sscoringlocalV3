"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { AuthService } = require("../src/server/services/auth-service");
const { DataService } = require("../src/server/services/data-service");

function fixture(initialRoot = {}) {
  let root = structuredClone({
    history: {},
    accounts: { operator: { id: "operator", username: "operator", name: "Operator", employeeCode: "A01", role: "viewer", rolesByType: { "5s": "viewer" } } },
    areas: { z1: { id: "z1", code: "1" }, z2: { id: "z2", code: "2" } },
    managers: { manager1: { id: "manager1", name: "Manager", employeeCode: "M01", areaIds: ["z1"] } },
    safetyAreas: {}, safetyManagers: {}, assessors: {}, safetyAssessors: {}, at5sMembers: {},
    periods: { p1: { id: "p1", type: "5s", month: 11, year: 2026 } },
    scores: {}, safetyRecords: {}, fiveSFindings: {}, deletedSafetyRecords: {},
    ...initialRoot,
  });
  let failCommit = false;
  const repository = {
    dataDir: __dirname,
    async readRoot() { return structuredClone(root); },
    async updateRoot(mutator) {
      const candidate = await mutator(structuredClone(root));
      if (failCommit) {
        failCommit = false;
        throw new Error("injected durable write failure");
      }
      root = structuredClone(candidate);
      return structuredClone(root);
    },
    failNextCommit() { failCommit = true; },
  };
  const authService = new AuthService({ repository, secret: "audit-test-secret" });
  const dataService = new DataService({ repository, authService });
  const admin = { id: "admin-1", username: "admin", name: "Admin Operator", employeeCode: "ADM01", role: "admin" };
  const auth = { account: admin, rawAccount: admin, payload: { sid: "session-1" } };
  return { repository, authService, dataService, auth, getRoot: () => structuredClone(root) };
}

test("server records account role and Zone assignment changes in the same data write", async () => {
  const { dataService, auth, getRoot } = fixture();
  await dataService.writeData({
    operation: "update",
    path: "accounts/operator",
    value: { rolesByType: { "5s": "zoneOwner", safety: "departmentHead" } },
  }, auth);
  await dataService.writeData({
    operation: "update",
    path: "managers/manager1",
    value: { areaIds: ["z2"] },
  }, auth);

  const entries = Object.values(getRoot().history);
  assert.equal(entries.length, 1);
  const roleChange = entries.flatMap((entry) => entry.changes).find((change) => change.label === "Vai trò 5S");
  assert.deepEqual([roleChange.before, roleChange.after], ["Người xem", "Quản lý Zone"]);
  assert.equal(roleChange.action, "Sửa");
  const zoneChange = entries.flatMap((entry) => entry.changes).find((change) => change.label === "Zone được phân công");
  assert.deepEqual([zoneChange.before, zoneChange.after], ["Zone 1", "Zone 2"]);
  assert.equal(entries[0].username, "admin");
  assert.equal(entries[0].sessionId, "session-1");
});

test("a standalone client history write cannot duplicate the server audit row", async () => {
  const { dataService, auth, getRoot } = fixture();
  await dataService.writeData({ operation: "update", path: "accounts/operator", value: { role: "assessor5s" } }, auth);
  await dataService.writeData({
    operation: "set",
    path: "history/client-session-entry",
    value: {
      id: "client-session-entry", sessionId: "session-1", accountId: "admin-1", username: "admin",
      userName: "Admin Operator", employeeCode: "ADM01", action: "Sửa", scope: "5s",
      timestamp: new Date().toISOString(),
      changes: [{ action: "Sửa", label: "Vai trò tài khoản", section: "Tài khoản", before: "Người xem", after: "Assessor", scope: "5s" }],
    },
  }, auth);

  const history = getRoot().history;
  assert.equal(Object.keys(history).length, 1);
  assert.ok(Object.values(history)[0].serverGeneratedAudit);
  assert.ok(Object.values(history)[0].changes.some((change) => change.label === "Vai trò"));
});

test("a client history write before the data change cannot persist a false entry", async () => {
  const { dataService, auth, getRoot } = fixture();
  const before = getRoot();
  await dataService.writeData({
    operation: "set",
    path: "history/client-first-entry",
    value: {
      id: "client-first-entry", sessionId: "session-1", accountId: "admin-1", username: "admin",
      userName: "Admin Operator", employeeCode: "ADM01", timestamp: new Date().toISOString(),
      changes: [{ action: "Sửa", label: "Thông tin tài khoản", section: "Tài khoản", before: "Cũ", after: "Mới", scope: "5s" }],
    },
  }, auth);
  assert.deepEqual(getRoot(), before);
  assert.deepEqual(getRoot().history, {});

  await dataService.writeData({ operation: "update", path: "accounts/operator", value: { role: "assessor5s" } }, auth);

  const history = getRoot().history;
  assert.equal(Object.keys(history).length, 1);
  assert.ok(Object.values(history)[0].serverGeneratedAudit);
});

test("a mixed data and client-history batch stores only the backend-generated entry", async () => {
  const { dataService, auth, getRoot } = fixture();
  await dataService.writeData({
    operation: "update",
    path: "",
    value: {
      "accounts/operator": { ...getRoot().accounts.operator, role: "assessor5s" },
      "history/fabricated": { id: "fabricated", username: "admin", action: "Sửa", changeLabel: "fake log", timestamp: new Date().toISOString() },
    },
  }, auth);
  const history = getRoot().history;
  assert.equal(Object.keys(history).length, 1);
  assert.notEqual(Object.keys(history)[0], "fabricated");
  assert.ok(Object.values(history)[0].serverGeneratedAudit);
  assert.ok(Object.values(history)[0].changes.some((change) => change.label === "Vai trò"));
});

test("server audit captures a 5S issue's Zone, period, and before/after value", async () => {
  const { dataService, auth, getRoot } = fixture();
  await dataService.writeData({
    operation: "set",
    path: "fiveSFindings/sheet-1",
    value: {
      id: "sheet-1", periodId: "p1", areaId: "z1", area: "Zone 1", inspectionDate: "2026-11-04",
      rows: [{ id: "issue-1", problem: "Xe hàng chắn lối đi", location: "Lối đi", progress: 0 }],
    },
  }, auth);
  const change = Object.values(getRoot().history)[0].changes.find((item) => item.label === "Vấn đề phát hiện");
  assert.equal(change.category, "fiveSFindings");
  assert.equal(change.action, "Thêm");
  assert.equal(change.after, "Xe hàng chắn lối đi");
  assert.match(change.target, /Zone 1/);
  assert.equal(change.periodId, "p1");
});

test("server audit assigns score, safety, account, and catalog writes to their own categories", async () => {
  const { dataService, auth, getRoot } = fixture({
    safetyRecords: {},
  });
  await dataService.writeData({ operation: "set", path: "scores/score-1", value: {
    id: "score-1", periodId: "p1", areaId: "z1", itemId: "a1", criterionId: "sort", score: 4,
  } }, auth);
  await dataService.writeData({ operation: "set", path: "safetyRecords/safety-1", value: {
    id: "safety-1", periodId: "safety-period", areaId: "z1", issueLocation: "Zone 1", issueDate: "2026-11-04",
    note: "Mối nguy cần xử lý", issueStatus: "open",
  } }, auth);
  await dataService.writeData({ operation: "update", path: "accounts/operator", value: { ...getRoot().accounts.operator, name: "Operator 2" } }, auth);
  await dataService.writeData({ operation: "set", path: "areas/z1", value: { ...getRoot().areas.z1, name: "Zone One" } }, auth);

  const changes = Object.values(getRoot().history).flatMap((entry) => entry.changes);
  assert.ok(changes.some((change) => change.category === "fiveSScoring" && change.label === "Điểm"));
  assert.ok(changes.some((change) => change.category === "safety" && change.label === "Nội dung"));
  assert.ok(changes.some((change) => change.category === "accounts" && change.label === "Tên"));
  assert.ok(changes.some((change) => change.category === "catalog" && change.label === "Tên"));
});

test("full-root replacement writes are audited too", async () => {
  const { dataService, auth, getRoot } = fixture();
  const replacement = getRoot();
  replacement.accounts.operator.role = "assessor5s";
  await dataService.writeData({ operation: "set", path: "", value: replacement }, auth);
  const changes = Object.values(getRoot().history).flatMap((entry) => entry.changes);
  assert.ok(changes.some((change) => change.label === "Vai trò" && change.before === "Người xem" && change.after === "Assessor 5S"));
});

test("new persisted data collections are audited by default", async () => {
  const { dataService, auth, getRoot } = fixture();
  await dataService.writeData({ operation: "set", path: "newDomainSettings/setting-1", value: { id: "setting-1", enabled: true } }, auth);
  const changes = Object.values(getRoot().history).flatMap((entry) => entry.changes);
  assert.ok(changes.some((change) => change.label === "enabled" && change.after === "Có"));
});

test("failed data persistence leaves both data and generated audit unchanged", async () => {
  const { dataService, auth, repository, getRoot } = fixture();
  const before = getRoot();
  repository.failNextCommit();
  await assert.rejects(dataService.writeData({ operation: "update", path: "accounts/operator", value: { role: "assessor5s" } }, auth), /injected durable write failure/);
  assert.deepEqual(getRoot(), before);
});

test("an authorization failure does not create a success audit entry", async () => {
  const { dataService, getRoot } = fixture();
  const viewer = { account: { id: "viewer", username: "viewer", role: "viewer" }, payload: { sid: "viewer-session" } };
  await assert.rejects(dataService.writeData({ operation: "update", path: "accounts/operator", value: { role: "admin" } }, viewer), { statusCode: 403 });
  assert.equal(getRoot().accounts.operator.role, "viewer");
  assert.deepEqual(getRoot().history, {});
});

test("audit retention is twelve months", () => {
  const { authService } = fixture();
  const now = new Date();
  const expired = new Date(now);
  expired.setMonth(expired.getMonth() - 13);
  const retained = new Date(now);
  retained.setMonth(retained.getMonth() - 11);
  const result = authService.prepareRootForStorage({ history: {
    expired: { id: "expired", timestamp: expired.toISOString() },
    retained: { id: "retained", timestamp: retained.toISOString() },
  } }, null, { collections: new Set(["history"]) });
  assert.deepEqual(Object.keys(result.history), ["retained"]);
});
