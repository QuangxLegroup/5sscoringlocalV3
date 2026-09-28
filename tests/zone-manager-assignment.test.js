"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { DataService } = require("../src/server/services/data-service");
const { AuthService } = require("../src/server/services/auth-service");

test("occupied Zones reject the whole manager creation/edit before any frontend write", async () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8")
    .match(/  async function saveManagerWithAreas\([^]*?\n  }/)[0];
  const areas = [{ id: "owned", code: "1", scorerId: "old" }, { id: "free", code: "2", scorerId: "" }];
  let writes = 0;
  const context = vm.createContext({
    currentUser: { role: "admin" }, isAdminAccount: () => true,
    getPeriod: () => ({ id: "p" }), cloneValue: structuredClone,
    getMutableCatalogSnapshot: () => ({ areas }), getAreasForPeriod: () => areas,
    normalizeCatalogType: value => value, SAFETY_PERIOD_TYPE: "safety", isReportableSafetyArea: () => true,
    getAreaResponsibleNameForPeriod: () => "Old owner", dbRef: () => ({ update: () => { writes++; } }),
  });
  vm.runInContext(source, context);
  for (const type of ["5s", "safety"]) {
    await assert.rejects(context.saveManagerWithAreas({ id: "new", name: "New owner" }, ["free", "owned"], type, "p"), /Zone 1.*Old owner.*đã có người quản lý/);
  }
  assert.equal(writes, 0);
  assert.equal(areas[0].scorerId, "old");
  assert.equal(areas[1].scorerId, "");
});

test("API atomically rejects taking occupied Zones and permits own/free Zone updates", async () => {
  for (const areaPath of ["areas", "safetyAreas", "periods/p/settingsSnapshot/areas", "periods/p/settingsSnapshot/safetyAreas"]) {
    let root = { areas: [], safetyAreas: [], periods: { p: { id: "p", settingsSnapshot: {} } }, managers: [{ id: "old", name: "Old owner" }] };
    const parts = areaPath.split("/");
    let parent = root;
    for (const part of parts.slice(0, -1)) parent = parent[part];
    const areas = [{ id: "owned", code: "1", scorerId: "old" }, { id: "free", code: "2", scorerId: "" }];
    parent[parts.at(-1)] = areas;
    const repository = { dataDir: __dirname, async readRoot() { return structuredClone(root); }, async updateRoot(update) { root = await update(structuredClone(root)); return structuredClone(root); } };
    const service = new DataService({ repository, authService: new AuthService({ repository, secret: "test-only" }) });
    const before = structuredClone(root);
    const auth = { account: { role: "admin" } };
    await assert.rejects(service.writeData({ operation: "update", path: "", value: {
      "managers/new": { id: "new", name: "New owner" },
      [areaPath]: areas.map(area => ({ ...area, scorerId: "new" })),
    } }, auth), { statusCode: 409 });
    assert.deepEqual(root, before);
    await service.writeData({ operation: "set", path: areaPath, value: [
      { ...areas[0], responsibleName: "Renamed owner" }, { ...areas[1], scorerId: "new" },
    ] }, auth);
  }
});
