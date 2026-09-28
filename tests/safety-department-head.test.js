"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { AuthService } = require("../src/server/services/auth-service");
const { DataService } = require("../src/server/services/data-service");

const own = { id: "own", periodId: "p", areaId: "z1", note: "Hazard", accountUsername: "another-assessor" };
const foreign = { ...own, id: "foreign", areaId: "z2" };
const admin = { account: { role: "admin" } };

function fixture(role = "departmentHead", snapshot = null) {
  let root = {
    periods: { p: { id: "p", type: "safety", ...(snapshot ? { settingsSnapshot: { areas: snapshot } } : {}) }, five: { id: "five", type: "5s" } },
    safetyAreas: { z1: { id: "z1", departmentHead: "Head" }, z2: { id: "z2", departmentHead: "Other" } },
    safetyRecords: { own: structuredClone(own), foreign: structuredClone(foreign) },
    scores: {}, deletedSafetyRecords: {},
  };
  const repository = {
    dataDir: __dirname,
    async readRoot() { return structuredClone(root); },
    async updateRoot(update) { root = await update(structuredClone(root)); return structuredClone(root); },
  };
  const authService = new AuthService({ repository, secret: "test-only" });
  return {
    service: new DataService({ repository, authService }),
    auth: { account: { role, username: "head", departmentHeadName: "Head", accessTypes: ["5s"] } },
  };
}

for (const role of ["departmentHead", "deptHead"]) {
  test(`${role} can create, edit another assessor's report, and delete within managed Zones`, async () => {
    const { service, auth } = fixture(role);
    const added = { ...own, id: "new", accountUsername: "head" };
    await service.writeData({ operation: "set", path: "safetyRecords/new", value: added }, auth);
    await service.writeData({ operation: "update", path: "safetyRecords/own", value: { note: "Corrected", issueType: "A", photoDataUrl: "photo" } }, auth);
    const stored = (await service.readData()).safetyRecords;
    assert.equal(stored.own.note, "Corrected");
    assert.equal(stored.own.accountUsername, "another-assessor");
    assert.deepEqual(stored.new, added);
    await service.writeData({ operation: "remove", path: "safetyRecords/own" }, auth);
    assert.equal((await service.readData()).safetyRecords.own, undefined);
  });
}

test("department head cannot change foreign Zones, take over reports, move reports outside scope, or bypass through batches", async () => {
  const { service, auth } = fixture();
  const before = await service.readData();
  for (const command of [
    { operation: "set", path: "safetyRecords/new", value: foreign },
    { operation: "update", path: "safetyRecords/foreign", value: { note: "Changed" } },
    { operation: "update", path: "safetyRecords/foreign", value: { improvementContent: "Changed" } },
    { operation: "remove", path: "safetyRecords/foreign" },
    { operation: "set", path: "safetyRecords/foreign", value: { ...own, id: "foreign" } },
    { operation: "update", path: "safetyRecords/own", value: { areaId: "z2" } },
    { operation: "update", path: "safetyRecords/own", value: { periodId: "five" } },
    { operation: "set", path: "safetyRecords/foreign/note", value: "Changed" },
    { operation: "update", path: "safetyRecords/own", value: { "areaId/x": "z2" } },
    { operation: "set", path: "safetyRecords", value: {} },
    { operation: "remove", path: "safetyRecords" },
    { operation: "update", path: "", value: { "safetyRecords/own": null, "safetyRecords/foreign": null } },
  ]) {
    await assert.rejects(service.writeData(command, auth), { statusCode: 403 });
    assert.deepEqual(await service.readData(), before);
  }
});

test("department head permissions follow the Safety period's Zone assignments", async () => {
  const { service, auth } = fixture("departmentHead", [{ id: "z1", departmentHead: "Other" }, { id: "z2", departmentHead: "Head" }]);
  await assert.rejects(service.writeData({ operation: "remove", path: "safetyRecords/own" }, auth), { statusCode: 403 });
  await service.writeData({ operation: "update", path: "safetyRecords/foreign", value: { note: "Updated by current head" } }, auth);
});

test("department head can delete legacy reports atomically with a marker, but cannot mark foreign reports deleted", async () => {
  const { service, auth } = fixture();
  await service.writeData({ operation: "set", path: "scores/legacy", value: { ...own, id: "legacy" } }, admin);
  await service.writeData({ operation: "set", path: "safetyRecords/safety-legacy", value: { ...own, id: "safety-legacy" } }, admin);
  const marker = { id: "safety-legacy", sourceScoreId: "legacy", periodId: "p", areaId: "z1", deletedBy: "head" };
  await service.writeData({ operation: "update", path: "", value: { "safetyRecords/safety-legacy": null, "deletedSafetyRecords/safety-legacy": marker } }, auth);
  const root = await service.readData();
  assert.equal(root.safetyRecords[marker.id], undefined);
  assert.deepEqual(root.deletedSafetyRecords[marker.id], marker);
  await assert.rejects(service.writeData({ operation: "set", path: "deletedSafetyRecords/foreign", value: { ...marker, id: "foreign", sourceScoreId: "" } }, auth), { statusCode: 403 });
  await service.writeData({ operation: "remove", path: "deletedSafetyRecords/safety-legacy" }, auth);
});

test("viewer and ordinary assessor do not gain department head permissions", async () => {
  const { service } = fixture();
  for (const role of ["viewer", "assessorSafety"]) {
    const auth = { account: { role, username: "head", departmentHeadName: "Head", accessTypes: ["safety"], areaIds: ["z1"] } };
    await assert.rejects(service.writeData({ operation: "remove", path: "safetyRecords/own" }, auth), { statusCode: 403 });
  }
});

test("locked or inactive Safety periods reject writes even when the Zone is managed", async () => {
  const { service, auth } = fixture();
  await service.writeData({ operation: "update", path: "periods/p", value: { archived: true } }, admin);
  await assert.rejects(service.writeData({ operation: "update", path: "safetyRecords/own", value: { note: "Bypass" } }, auth), { statusCode: 403 });
  await service.writeData({ operation: "update", path: "periods/p", value: { archived: false } }, admin);
  await service.writeData({ operation: "set", path: "activeSafetyPeriodId", value: "next" }, admin);
  await assert.rejects(service.writeData({ operation: "remove", path: "safetyRecords/own" }, auth), { statusCode: 403 });
});
