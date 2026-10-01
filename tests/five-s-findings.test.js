"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { AuthService } = require("../src/server/services/auth-service");
const { DataService } = require("../src/server/services/data-service");
const { JsonFileRepository } = require("../src/server/repositories/json-file-repository");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

function fixture(extra = {}) {
  let root = { activeFiveSPeriodId: "p", fiveSFindings: {}, areas: { protected: { id: "protected" }, z26: { id: "z26", code: "26", departmentHead: "Head", scorerId: "owner" }, other: { id: "other", code: "19", departmentHead: "Other", scorerId: "other-owner" } }, periods: { p: { id: "p", month: 9, year: 2026, type: "5s" } }, ...extra };
  const repository = {
    dataDir: __dirname,
    async readRoot() { return structuredClone(root); },
    async updateRoot(update) { root = await update(structuredClone(root)); return structuredClone(root); },
  };
  const authService = new AuthService({ repository, secret: "test-only" });
  return { service: new DataService({ repository, authService }), repository };
}

const sheet = { id: "sheet-1", periodId: "p", areaId: "z26", area: "Zone 26", inspector: "Người kiểm tra", inspectionDate: "2026-09-28", rows: [{ problem: "Vật thừa", stop6: "A", fiveS: "S1", location: "Bàn", shift: "1", countermeasure: "Dọn dẹp", owner: "Người xử lý", dueDate: "2026-09-30", progress: "25" }] };

test("linked zone-owner accounts follow catalog assignments even with stale account Zone lists", () => {
  const auth = new AuthService({ repository: {} });
  for (const type of ["5s", "safety"]) {
    const account = { role: "zoneOwner", accessTypes: [type], scorerId: "new", fiveSAreaIds: ["z1"], safetyAreaIds: ["z1"] };
    const root = { periods: { p: { id: "p", type, settingsSnapshot: { areas: [{ id: "z1", scorerId: "old" }, { id: "z2", scorerId: "new" }] } }, history: { id: "history", type, settingsSnapshot: { areas: [{ id: "z1", scorerId: "new" }] } } } };
    assert.deepEqual([...auth.getAllowedAreaIds(root, account, "p", type)], ["z2"]);
    assert.deepEqual([...auth.getAllowedAreaIds(root, account, "history", type)], ["z1"]);
    root.periods.p.settingsSnapshot.areas[1].scorerId = "old";
    assert.equal(auth.getAllowedAreaIds(root, account, "p", type).size, 0);
  }
});

test("editing one issue's inspection details preserves sibling issues in an atomic scoped batch", async () => {
  const { service } = fixture();
  const auth = { account: { role: "zoneOwner", scorerId: "owner" } };
  const original = { ...sheet, rows: [...sheet.rows, { ...sheet.rows[0], problem: "Other issue" }] };
  await service.writeData({ operation: "set", path: "fiveSFindings/sheet-1", value: original }, auth);
  const remaining = { ...original, rows: [original.rows[1]] };
  const edited = { ...sheet, id: "edited", inspector: "Updated inspector", inspectionDate: "2026-09-29" };
  const batch = { "fiveSFindings/sheet-1": remaining, "fiveSFindings/edited": edited };
  await assert.rejects(service.writeData({ operation: "update", path: "", value: { ...batch, "fiveSFindings/edited": { ...edited, areaId: "other", area: "Zone 19" } } }, auth), { statusCode: 403 });
  assert.deepEqual((await service.readData()).fiveSFindings, { "sheet-1": original });
  await service.writeData({ operation: "update", path: "", value: batch }, auth);
  assert.deepEqual((await service.readData()).fiveSFindings, { "sheet-1": remaining, edited });
});

for (const role of ["admin", "departmentHead", "deptHead", "zoneOwner", "manager"]) {
  test(`${role} can create, update, read, and delete findings`, async () => {
    const { service } = fixture();
    const auth = { account: { id: role, role, name: "Head", scorerId: "owner" } };
    await service.writeData({ operation: "set", path: "fiveSFindings/sheet-1", value: sheet }, auth);
    assert.deepEqual((await service.readData()).fiveSFindings["sheet-1"], sheet);
    await service.writeData({ operation: "update", path: "fiveSFindings/sheet-1", value: { inspector: "Updated" } }, auth);
    assert.equal((await service.readData()).fiveSFindings["sheet-1"].inspector, "Updated");
    await service.writeData({ operation: "remove", path: "fiveSFindings/sheet-1" }, auth);
    assert.deepEqual((await service.readData()).fiveSFindings, {});
  });
}

for (const role of ["viewer", "assessorSafety"]) {
  test(`${role} can read but cannot write through any data command shape`, async () => {
    const { service } = fixture();
    await service.writeData({ operation: "set", path: "fiveSFindings/sheet-1", value: sheet }, { account: { role: "admin" } });
    const auth = { account: { id: role, role } };
    for (const command of [
      { operation: "set", path: "fiveSFindings/sheet-2", value: sheet },
      { operation: "update", path: "fiveSFindings/sheet-1", value: { area: "Changed" } },
      { operation: "remove", path: "fiveSFindings/sheet-1" },
      { operation: "set", path: "fiveSFindings", value: {} },
      { operation: "update", path: "", value: { "fiveSFindings/sheet-1": null } },
      { operation: "set", path: "", value: { fiveSFindings: {} } },
    ]) await assert.rejects(service.writeData(command, auth), { statusCode: 403 });
    assert.deepEqual((await service.readData(auth)).fiveSFindings["sheet-1"], sheet);
  });
}

test("5S assessors can manage findings only in Zones assigned for 5S", async () => {
  const { service } = fixture();
  const auth = { account: { id: "assessor", role: "assessor5s", accessTypes: ["5s"], fiveSAreaIds: ["z26"] } };
  const other = { ...sheet, id: "foreign", areaId: "other", area: "Zone 19" };

  await service.writeData({ operation: "set", path: "fiveSFindings/sheet-1", value: sheet }, auth);
  await service.writeData({ operation: "update", path: "fiveSFindings/sheet-1", value: { inspector: "Updated" } }, auth);
  assert.equal((await service.readData()).fiveSFindings["sheet-1"].inspector, "Updated");

  for (const command of [
    { operation: "set", path: "fiveSFindings/foreign", value: other },
    { operation: "update", path: "fiveSFindings/sheet-1", value: { areaId: "other" } },
  ]) {
    await assert.rejects(service.writeData(command, auth), { statusCode: 403 });
  }

  assert.deepEqual(Object.keys((await service.readData()).fiveSFindings), ["sheet-1"]);
  await service.writeData({ operation: "remove", path: "fiveSFindings/sheet-1" }, auth);
  assert.deepEqual((await service.readData()).fiveSFindings, {});
});

test("anonymous writes fail, and department heads cannot alter other collections in a batch", async () => {
  const { service } = fixture();
  await assert.rejects(service.writeData({ operation: "set", path: "fiveSFindings/sheet-1", value: sheet }), { statusCode: 401 });
  await assert.rejects(service.writeData({ operation: "update", path: "", value: { "fiveSFindings/sheet-1": sheet, areas: {} } }, { account: { role: "departmentHead" } }), { statusCode: 403 });
  assert.deepEqual((await service.readData()).fiveSFindings, {});
  assert.deepEqual((await service.readData()).areas.protected, { id: "protected" });
});

for (const role of ["departmentHead", "zoneOwner"]) {
  test(`${role} cannot modify or take over another Zone through any command shape`, async () => {
    const { service } = fixture();
    const auth = { account: { role, name: "Head", scorerId: "owner" } };
    const other = { ...sheet, id: "foreign", areaId: "other", area: "Zone 19" };
    const admin = { account: { role: "admin" } };
    await service.writeData({ operation: "set", path: "fiveSFindings/sheet-1", value: sheet }, admin);
    await service.writeData({ operation: "set", path: "fiveSFindings/foreign", value: other }, admin);
    const before = await service.readData();
    for (const command of [
      { operation: "set", path: "fiveSFindings/new", value: other },
      { operation: "set", path: "fiveSFindings/foreign", value: sheet },
      { operation: "update", path: "fiveSFindings/foreign", value: { areaId: "z26" } },
      { operation: "remove", path: "fiveSFindings/foreign" },
      { operation: "set", path: "fiveSFindings/foreign", value: null },
      { operation: "update", path: "fiveSFindings/sheet-1", value: { areaId: "other" } },
      { operation: "update", path: "fiveSFindings/sheet-1", value: { periodId: "missing" } },
      { operation: "set", path: "fiveSFindings/foreign/rows/0/problem", value: "attack" },
      { operation: "set", path: "fiveSFindings", value: {} },
      { operation: "remove", path: "fiveSFindings" },
      { operation: "update", path: "", value: { "fiveSFindings/sheet-1": sheet, "fiveSFindings/foreign": null } },
      { operation: "update", path: "fiveSFindings/sheet-1", value: { "areaId/x": "other" } },
    ]) await assert.rejects(service.writeData(command, auth), { statusCode: 403 });
    assert.deepEqual(await service.readData(), before);
  });
}

test("Zone permissions follow period snapshots, explicit assignments, and scoped roles", async () => {
  const { service } = fixture({ periods: { p: { id: "p", type: "5s", settingsSnapshot: { areas: [{ id: "z26", code: "26", departmentHead: "New head", scorerId: "new-owner" }] } } } });
  for (const account of [{ role: "departmentHead", name: "Head" }, { role: "zoneOwner", scorerId: "owner" }, { role: "zoneOwner" }, { role: "zoneOwner", accessTypes: ["safety"], areaIds: ["z26"] }]) {
    await assert.rejects(service.writeData({ operation: "set", path: "fiveSFindings/sheet-1", value: sheet }, { account }), { statusCode: 403 });
  }
  for (const account of [{ role: "departmentHead", name: "New head" }, { role: "zoneOwner", scorerId: "new-owner" }, { role: "zoneOwner", fiveSAreaIds: ["z26"] }]) {
    await service.writeData({ operation: "set", path: "fiveSFindings/sheet-1", value: sheet }, { account });
  }
});

test("legacy sheets resolve their period and Zone before checking write access", async () => {
  const { service } = fixture();
  const legacy = { ...sheet };
  delete legacy.periodId;
  delete legacy.areaId;
  await service.writeData({ operation: "set", path: "fiveSFindings/sheet-1", value: legacy }, { account: { role: "admin" } });
  await service.writeData({ operation: "set", path: "fiveSFindings/sheet-1", value: sheet }, { account: { role: "zoneOwner", scorerId: "owner" } });
});

test("findings survive a repository restart and appear in the organized data copy", async () => {
  const tempRoot = path.resolve(os.tmpdir());
  const dataDir = await fs.mkdtemp(path.join(tempRoot, "five-s-findings-test-"));
  const repository = new JsonFileRepository({ dataDir, fileName: "runtime/main-data.json" });
  try {
    const authService = new AuthService({ repository });
    const service = new DataService({ repository, authService });
    await service.writeData({ operation: "set", path: "fiveSFindings/sheet-1", value: sheet }, { account: { role: "admin" } });
    clearTimeout(repository.organizedTimer);
    const restarted = new JsonFileRepository({ dataDir, fileName: "runtime/main-data.json" });
    const stored = await restarted.readRoot();
    assert.deepEqual(stored.fiveSFindings["sheet-1"], sheet);
    await repository.persistOrganizedRoot(stored);
    const organized = JSON.parse(await fs.readFile(path.join(dataDir, "organized/cham-5s/phat-hien.json"), "utf8"));
    assert.deepEqual(organized.fiveSFindings["sheet-1"], sheet);
  } finally {
    clearTimeout(repository.organizedTimer);
    const relative = path.relative(tempRoot, path.resolve(dataDir));
    assert.ok(relative.startsWith("five-s-findings-test-") && !relative.includes(path.sep));
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

for (const role of ["departmentHead", "zoneOwner"]) {
  test(role + " can write only the admin-opened period, including batches and period moves", async () => {
    const periods = { p: { id: "p", type: "5s", month: 9, year: 2026 }, q: { id: "q", type: "5s", month: 10, year: 2026 } };
    const { service } = fixture({ periods });
    const admin = { account: { role: "admin" } };
    const user = { account: { role, name: "Head", scorerId: "owner" } };
    const next = { ...sheet, id: "next", periodId: "q" };
    await service.writeData({ operation: "set", path: "fiveSFindings/sheet-1", value: sheet }, user);
    await service.writeData({ operation: "set", path: "fiveSFindings/next", value: next }, admin);
    for (const command of [
      { operation: "set", path: "fiveSFindings/new", value: next },
      { operation: "update", path: "fiveSFindings/next", value: { inspector: "Changed" } },
      { operation: "remove", path: "fiveSFindings/next" },
      { operation: "update", path: "fiveSFindings/next", value: { periodId: "p" } },
      { operation: "update", path: "fiveSFindings/sheet-1", value: { periodId: "q" } },
      { operation: "update", path: "", value: { "fiveSFindings/sheet-1": { ...sheet, inspector: "Changed" }, "fiveSFindings/next": null } },
    ]) await assert.rejects(service.writeData(command, user), { statusCode: 403 });
    assert.equal((await service.readData()).fiveSFindings["sheet-1"].inspector, sheet.inspector);
    await service.writeData({ operation: "set", path: "activeFiveSPeriodId", value: "q" }, admin);
    await assert.rejects(service.writeData({ operation: "update", path: "fiveSFindings/sheet-1", value: { inspector: "Stale form" } }, user), { statusCode: 403 });
    await service.writeData({ operation: "update", path: "fiveSFindings/next", value: { inspector: "Allowed" } }, user);
    await service.writeData({ operation: "update", path: "periods/q", value: { archived: true } }, admin);
    await assert.rejects(service.writeData({ operation: "remove", path: "fiveSFindings/next" }, user), { statusCode: 403 });
    await service.writeData({ operation: "remove", path: "fiveSFindings/next" }, admin);
  });
}

test("findings require an open period, with support for the legacy active-period setting", async () => {
  const user = { account: { role: "zoneOwner", scorerId: "owner" } };
  const { service } = fixture({ activeFiveSPeriodId: "" });
  const command = { operation: "set", path: "fiveSFindings/sheet-1", value: sheet };
  await assert.rejects(service.writeData(command, user), { statusCode: 403 });
  await service.writeData({ operation: "set", path: "activePeriodId", value: "p" }, { account: { role: "admin" } });
  await service.writeData(command, user);
});
