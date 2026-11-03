"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { AuthService } = require("../src/server/services/auth-service");
const { DataService } = require("../src/server/services/data-service");

function createMockRoot() {
  return {
    periods: {
      p1: {
        id: "p1",
        type: "5s",
        month: 10,
        year: 2026,
        settingsSnapshot: {
          areas: {
            z1: { id: "z1", code: "1", departmentHead: "Trưởng phòng A" },
            z2: { id: "z2", code: "2", departmentHead: "Trưởng phòng B" },
          },
          at5sMembers: {
            m1: { id: "m1", name: "Thành viên AT1", employeeCode: "AT01" },
          },
        },
      },
      ps1: {
        id: "ps1",
        type: "safety",
        month: 10,
        year: 2026,
      },
    },
    activeFiveSPeriodId: "p1",
    activeSafetyPeriodId: "ps1",
    areas: {
      z1: { id: "z1", code: "1", departmentHead: "Trưởng phòng A" },
      z2: { id: "z2", code: "2", departmentHead: "Trưởng phòng B" },
    },
    safetyAreas: {
      z1: { id: "z1", code: "1", departmentHead: "Trưởng phòng A" },
      z2: { id: "z2", code: "2", departmentHead: "Trưởng phòng B" },
    },
    at5sMembers: {
      m1: { id: "m1", name: "Thành viên AT1", employeeCode: "AT01" },
    },
    accounts: {
      acc_at5s: {
        id: "acc_at5s",
        username: "at5s_user",
        name: "Thành viên AT1",
        role: "at5s",
        accessTypes: ["5s", "safety"],
      },
      acc_dept_head: {
        id: "acc_dept_head",
        username: "dept_head_a",
        name: "Trưởng phòng A",
        role: "departmentHead",
        departmentHeadName: "Trưởng phòng A",
        accessTypes: ["5s", "safety"],
      },
      acc_assessor: {
        id: "acc_assessor",
        username: "assessor1",
        name: "Assessor 1",
        role: "assessor5s",
        accessTypes: ["5s"],
        areaIds: ["z1"],
      },
    },
    scores: {},
    safetyRecords: {
      sr_other: {
        id: "sr_other",
        periodId: "ps1",
        areaId: "z1",
        note: "Other hazard",
        accountUsername: "other_user",
      },
    },
    fiveSFindings: {},
  };
}

function fixture() {
  let root = createMockRoot();
  const repository = {
    dataDir: __dirname,
    async readRoot() { return structuredClone(root); },
    async updateRoot(update) {
      root = await update(structuredClone(root));
      return structuredClone(root);
    },
  };
  const authService = new AuthService({ repository, secret: "test-secret" });
  const dataService = new DataService({ repository, authService });
  return { repository, authService, dataService, getRoot: () => root };
}

test("1. Ban AT - 5S role and zone permissions", async () => {
  const { authService, getRoot } = fixture();
  const root = getRoot();
  const at5sAccount = root.accounts.acc_at5s;
  const deptHeadAccount = root.accounts.acc_dept_head;

  // Ban AT - 5S has access to all zones
  const at5sZones = authService.getAllowedAreaIds(root, at5sAccount, "p1", "5s");
  assert.ok(at5sZones.has("z1"));
  assert.ok(at5sZones.has("z2"));

  // Trưởng phòng A only has access to managed zone z1
  const deptHeadZones = authService.getAllowedAreaIds(root, deptHeadAccount, "p1", "5s");
  assert.ok(deptHeadZones.has("z1"));
  assert.ok(!deptHeadZones.has("z2"), "Trưởng phòng A không được có quyền zone z2");
});

test("2. Multi-day 5S scoring and monthly aggregation in backend", async () => {
  const { dataService, getRoot } = fixture();
  const root = getRoot();
  const at5sAuth = { account: root.accounts.acc_at5s };

  // Score day 1: 2026-10-05, zone z1, score = 4
  await dataService.writeData({
    operation: "set",
    path: "scores/s_at5s_day1",
    value: {
      id: "s_at5s_day1",
      periodId: "p1",
      areaId: "z1",
      itemId: "1s",
      criterionId: "c1",
      scoreSource: "at5s",
      scoreDate: "2026-10-05",
      score: 4,
    },
  }, at5sAuth);

  // Score day 2: 2026-10-20, zone z1, score = 2
  await dataService.writeData({
    operation: "set",
    path: "scores/s_at5s_day2",
    value: {
      id: "s_at5s_day2",
      periodId: "p1",
      areaId: "z1",
      itemId: "1s",
      criterionId: "c1",
      scoreSource: "at5s",
      scoreDate: "2026-10-20",
      score: 2,
    },
  }, at5sAuth);

  const stored = (await dataService.readData()).scores;
  assert.equal(stored.s_at5s_day1.score, 4);
  assert.equal(stored.s_at5s_day1.scoreDate, "2026-10-05");
  assert.equal(stored.s_at5s_day2.score, 2);
  assert.equal(stored.s_at5s_day2.scoreDate, "2026-10-20");

  // In the month, average across the 2 scored days is (4 + 2) / 2 = 3.0
  const dailyRecords = [stored.s_at5s_day1, stored.s_at5s_day2];
  const avg = dailyRecords.reduce((sum, r) => sum + r.score, 0) / dailyRecords.length;
  assert.equal(avg, 3.0);
});

test("3. Safety record ownership: Ban AT - 5S can add across all zones but edit/delete only own", async () => {
  const { dataService, getRoot } = fixture();
  const root = getRoot();
  const at5sAuth = { account: root.accounts.acc_at5s };

  // Add safety record in z2 (allowed even though z2 is outside any specific department)
  await dataService.writeData({
    operation: "set",
    path: "safetyRecords/sr_at5s_1",
    value: {
      id: "sr_at5s_1",
      periodId: "ps1",
      areaId: "z2",
      note: "Nguy cơ trượt ngã",
      foundChannel: "at5s",
      accountUsername: "at5s_user",
    },
  }, at5sAuth);

  const stored = (await dataService.readData()).safetyRecords;
  assert.equal(stored.sr_at5s_1.note, "Nguy cơ trượt ngã");
  assert.equal(stored.sr_at5s_1.foundChannel, "at5s");

  // Edit own record -> SUCCESS
  await dataService.writeData({
    operation: "update",
    path: "safetyRecords/sr_at5s_1",
    value: { note: "Nguy cơ trượt ngã đã chỉnh sửa" },
  }, at5sAuth);
  assert.equal((await dataService.readData()).safetyRecords.sr_at5s_1.note, "Nguy cơ trượt ngã đã chỉnh sửa");

  // Attempt to edit someone else's record -> FAILS with 403
  await assert.rejects(
    dataService.writeData({
      operation: "update",
      path: "safetyRecords/sr_other",
      value: { note: "Tampering" },
    }, at5sAuth),
    (err) => err.statusCode === 403
  );

  // Attempt to delete someone else's record -> FAILS with 403
  await assert.rejects(
    dataService.writeData({
      operation: "remove",
      path: "safetyRecords/sr_other",
    }, at5sAuth),
    (err) => err.statusCode === 403
  );

  // Delete own record -> SUCCESS
  await dataService.writeData({
    operation: "remove",
    path: "safetyRecords/sr_at5s_1",
  }, at5sAuth);
  assert.equal((await dataService.readData()).safetyRecords.sr_at5s_1, undefined);
});

test("4. 5S Findings: Ban AT - 5S has write access across zones", async () => {
  const { dataService, getRoot } = fixture();
  const root = getRoot();
  const at5sAuth = { account: root.accounts.acc_at5s };

  await dataService.writeData({
    operation: "set",
    path: "fiveSFindings/finding_1",
    value: {
      id: "finding_1",
      periodId: "p1",
      areaId: "z2",
      inspector: "Thành viên AT1",
      inspectionDate: "2026-10-31",
      rows: [
        { location: "Khu A", problem: "Bừa bộn", fiveS: "1S", progress: "0" },
      ],
    },
  }, at5sAuth);

  const stored = (await dataService.readData()).fiveSFindings;
  assert.equal(stored.finding_1.inspector, "Thành viên AT1");
  assert.equal(stored.finding_1.areaId, "z2");
});

test("5. Multi-day score sources and getFiveSScoreSourceAreaIds", () => {
  const { authService, getRoot } = fixture();
  const root = getRoot();
  const at5sAccount = root.accounts.acc_at5s;
  const deptHeadAccount = root.accounts.acc_dept_head;

  const at5sAreaIds = authService.getFiveSScoreSourceAreaIds(root, at5sAccount, "p1", "at5s");
  assert.ok(at5sAreaIds.has("z1"));
  assert.ok(at5sAreaIds.has("z2"));

  const deptHeadAreaIds = authService.getFiveSScoreSourceAreaIds(root, deptHeadAccount, "p1", "departmentHead");
  assert.ok(deptHeadAreaIds.has("z1"));
  assert.ok(!deptHeadAreaIds.has("z2"));
});
