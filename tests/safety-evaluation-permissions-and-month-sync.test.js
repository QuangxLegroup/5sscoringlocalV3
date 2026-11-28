"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { AuthService } = require("../src/server/services/auth-service");
const { DataService } = require("../src/server/services/data-service");

const periodId = "safety-november-2026";
const areas = [
  { id: "zone10", code: "10", scorerId: "manager10", departmentHead: "Mr Cuong", departmentHeadEmployeeCode: "100" },
  { id: "zone12_2", code: "12.2", scorerId: "manager12_2", departmentHead: "Mr TruongBoPhan", departmentHeadEmployeeCode: "8888" },
];

function fixture() {
  const utnt = {
    id: "utnt-account",
    username: "utnt",
    role: "zoneOwner",
    accessTypes: ["safety"],
    rolesByType: { safety: "zoneOwner" },
    safetyScorerId: "manager12_2",
    safetyAreaIds: ["zone12_2"],
    employeeCode: "1502",
    name: "Mrs Út",
  };
  const assessor = {
    id: "assessor-account",
    username: "assessor1",
    role: "assessorSafety",
    accessTypes: ["safety"],
    rolesByType: { safety: "assessorSafety" },
    safetyAssessorId: "assessor1",
    employeeCode: "999",
    name: "Safety Assessor",
  };
  const admin = {
    id: "admin-account",
    username: "admin",
    role: "admin",
    accessTypes: ["fiveS", "safety"],
    rolesByType: { fiveS: "admin", safety: "admin" },
  };

  const existingRecordZone12 = {
    id: "rec-12",
    periodId,
    areaId: "zone12_2",
    note: "Dây điện hở",
    issueStatus: "open",
    issueCount: 1,
    accountUsername: "assessor1",
    createdAt: "2026-11-01T08:00:00.000Z",
    improvementContent: "",
    improvementResponseBy: "",
    improvementResponseAt: "",
    afterPhotoDataUrl: "",
    afterPhotoName: "",
    afterPhotoAnnotations: [],
    actionOwner: "",
    actionPlan: "",
    completionDate: "",
    countermeasureDate: "",
    completedDate: "",
  };

  let root = {
    activeSafetyPeriodId: periodId,
    periods: {
      [periodId]: {
        id: periodId,
        type: "safety",
        year: 2026,
        month: 11,
        archived: false,
        settingsSnapshot: {
          areas,
          managers: [
            { id: "manager10", name: "Mr Cuong", employeeCode: "100" },
            { id: "manager12_2", name: "Mrs Út", employeeCode: "1502" },
          ],
          assessors: [
            { id: "assessor1", name: "Safety Assessor", employeeCode: "999" },
          ],
        },
      },
    },
    safetyRecords: {
      "rec-12": existingRecordZone12,
    },
    accounts: [utnt, assessor, admin],
  };

  const repository = {
    dataDir: __dirname,
    async readRoot() { return structuredClone(root); },
    async updateRoot(update) {
      root = await update(structuredClone(root));
      return structuredClone(root);
    },
  };

  const authService = new AuthService({ repository, secret: "test-secret" });
  const dataService = new DataService({ repository, authService, photoDir: __dirname });

  return { root, authService, dataService, accounts: { utnt, assessor, admin }, getRecord: (id) => root.safetyRecords[id] };
}

test("Backend permission: utnt (zoneOwner) IS allowed to create a new safety record", async () => {
  const { authService, root, accounts } = fixture();

  const newSafetyRecord = {
    id: "new-rec-1",
    periodId,
    areaId: "zone12_2",
    note: "Mối nguy mới",
    issueStatus: "open",
    issueCount: 1,
    accountUsername: "utnt",
    createdAt: "2026-11-03T08:00:00.000Z",
  };

  const command = {
    operation: "set",
    path: "safetyRecords/new-rec-1",
    value: newSafetyRecord,
  };

  // utnt (Zone Owner) is allowed to create new safety records
  assert.doesNotThrow(() => {
    authService.assertSafetyRecordWriteAllowed(root, accounts.utnt, command);
  });

  // Safety Assessor is allowed to create new safety records
  const assessorRecord = { ...newSafetyRecord, accountUsername: "assessor1" };
  const assessorCommand = { ...command, value: assessorRecord };
  assert.doesNotThrow(() => {
    authService.assertSafetyRecordWriteAllowed(root, accounts.assessor, assessorCommand);
  });

  // Admin is allowed to create new safety records
  const adminRecord = { ...newSafetyRecord, accountUsername: "admin" };
  const adminCommand = { ...command, value: adminRecord };
  assert.doesNotThrow(() => {
    authService.assertSafetyRecordWriteAllowed(root, accounts.admin, adminCommand);
  });
});

test("Backend permission: utnt CAN update countermeasures for their assigned zone 12.2", async () => {
  const { dataService, accounts, getRecord } = fixture();

  const patch = {
    improvementContent: "Đã bọc lại dây điện an toàn",
    improvementResponseBy: accounts.utnt.id,
    improvementResponseAt: "2026-11-04T09:00:00.000Z",
    actionOwner: "Mrs Út",
    actionPlan: "Khắc phục triệt để",
    completionDate: "2026-11-10",
    countermeasureDate: "2026-11-04",
    issueStatus: "in_progress",
    updatedAt: "2026-11-04T09:00:00.000Z",
  };

  const authContext = { account: accounts.utnt };
  await dataService.writeData({
    operation: "update",
    path: "safetyRecords/rec-12",
    value: patch,
  }, authContext);

  const updated = getRecord("rec-12");
  assert.equal(updated.improvementContent, "Đã bọc lại dây điện an toàn");
  assert.equal(updated.actionOwner, "Mrs Út");
});

test("Desktop & Mobile permissions: canAddSafetyEvaluation and isSafetyAssessor logic", () => {
  const appJs = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");

  const utnt = { role: "zoneOwner", accessTypes: ["safety"] };
  const safetyAssessor = { role: "assessorSafety", accessTypes: ["safety"] };
  const admin = { role: "admin", accessTypes: ["fiveS", "safety"] };
  const at5s = { role: "banAt5s", accessTypes: ["safety"] };

  const context = {
    window: {},
    document: { getElementById: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: () => null, setItem: () => {} },
    state: {
      activeSafetyPeriodId: periodId,
      periods: [{ id: periodId, year: 2026, month: 11, type: "safety" }],
      safetyRecords: [],
      at5sMembers: [],
    },
    FIVE_S_PERIOD_TYPE: "fiveS",
    SAFETY_PERIOD_TYPE: "safety",
    ROLE_ADMIN: "admin",
    ROLE_VIEWER: "viewer",
    ROLE_ZONE_OWNER: "zoneOwner",
    ROLE_ASSESSOR_5S: "assessor5S",
    ROLE_ASSESSOR_SAFETY: "assessorSafety",
    ROLE_DEPARTMENT_HEAD: "departmentHead",
    ROLE_AT5S: "banAt5s",
    utnt,
    safetyAssessor,
    admin,
    at5s,
  };

  vm.createContext(context);

  vm.runInContext(`
    function isAdminAccount(account) { return account?.role === "admin"; }
    function isViewerAccount(account) { return account?.role === "viewer"; }
    function normalizeCatalogType(type) { return type; }
    function normalizeAccountRole(role) { return role; }
    function getActivePeriodId(type) { return "${periodId}"; }
    function hasAccountAccessType(account, type) { return Array.isArray(account?.accessTypes) && account.accessTypes.includes(type); }
    function hasAt5sRole(account) { return account?.role === "banAt5s"; }
    function hasDepartmentHeadRole(account) { return account?.role === "departmentHead"; }
    function getAccountRolesForType(account, type, pId) {
      if (account?.role === "assessorSafety") return ["assessorSafety"];
      if (account?.role === "zoneOwner") return ["zoneOwner"];
      if (account?.role === "banAt5s") return ["banAt5s"];
      if (account?.role === "departmentHead") return ["departmentHead"];
      return [];
    }
  `, context);

  const isSafetyAssessorMatch = appJs.match(/function isSafetyAssessor\(account\)\s*\{[\s\S]*?\n  \}/);
  assert.ok(isSafetyAssessorMatch, "isSafetyAssessor function found in app.js");
  vm.runInContext(isSafetyAssessorMatch[0], context);

  const canAddMatch = appJs.match(/function canAddSafetyEvaluation\(account[\s\S]*?\n  \}/);
  assert.ok(canAddMatch, "canAddSafetyEvaluation function found in app.js");
  vm.runInContext(canAddMatch[0], context);

  // utnt: Zone Owner -> CAN add safety evaluations, NOT safety assessor
  assert.equal(vm.runInContext("canAddSafetyEvaluation(utnt)", context), true, "utnt (zoneOwner) can add safety evaluation");
  assert.equal(vm.runInContext("isSafetyAssessor(utnt)", context), false, "utnt is not a safety assessor");

  // Assessor AT -> CAN add
  assert.equal(vm.runInContext("canAddSafetyEvaluation(safetyAssessor)", context), true, "safetyAssessor can add");
  assert.equal(vm.runInContext("isSafetyAssessor(safetyAssessor)", context), true, "safetyAssessor is safety assessor");

  // Admin -> CAN add
  assert.equal(vm.runInContext("canAddSafetyEvaluation(admin)", context), true, "admin can add");

  // Ban AT-5S -> CAN add
  assert.equal(vm.runInContext("canAddSafetyEvaluation(at5s)", context), true, "at5s can add");
});

test("Desktop Month Filter: syncSafetyFilters includes active period month 11 even when records are only from months 10 and 9", () => {
  const safetyPageJs = fs.readFileSync(path.join(__dirname, "../modules/pages/safety-page.js"), "utf8");

  const syncMatch = safetyPageJs.match(/function syncSafetyFilters\(context, period\)\s*\{[\s\S]*?\n  \}/);
  assert.ok(syncMatch, "syncSafetyFilters function found in safety-page.js");

  const yearOptions = [];
  const monthOptions = [];
  const elements = {
    safetyYearFilter: {
      value: "2026",
      set innerHTML(html) {
        yearOptions.length = 0;
        const matches = html.matchAll(/value="([^"]+)"/g);
        for (const m of matches) yearOptions.push(m[1]);
      },
    },
    safetyMonthFilter: {
      value: "10",
      set innerHTML(html) {
        monthOptions.length = 0;
        const matches = html.matchAll(/value="([^"]+)"/g);
        for (const m of matches) monthOptions.push(m[1]);
      },
    },
    safetyAreaFilter: { value: "" },
  };

  const contextObj = {
    elements,
    escapeHtml: (s) => String(s),
    getSafetyFilterYears: () => [2026],
    getSafetyFilterMonths: () => [10, 9], // Historical records from October and September
    isAdminAccount: () => true,
    currentUser: { role: "admin" },
    activeSafetyReport: "assessment",
    SAFETY_PERIOD_TYPE: "safety",
    getActivePeriodId: () => "period-nov-2026",
    getPeriod: () => ({ id: "period-nov-2026", year: 2026, month: 11 }),
  };

  const vmContext = vm.createContext({
    context: contextObj,
    elements,
    escapeHtml: contextObj.escapeHtml,
    getSafetyFilterYears: contextObj.getSafetyFilterYears,
    getSafetyFilterMonths: contextObj.getSafetyFilterMonths,
    isAdminAccount: contextObj.isAdminAccount,
    currentUser: contextObj.currentUser,
  });

  vm.runInContext(syncMatch[0], vmContext);
  vm.runInContext("syncSafetyFilters(context, { year: 2026, month: 11 })", vmContext);

  // Month options must include 11, 10, 9
  assert.ok(monthOptions.includes("11"), "Month filter dropdown MUST include month 11 (current active period)");
  assert.ok(monthOptions.includes("10"), "Month filter dropdown includes month 10");
  assert.ok(monthOptions.includes("9"), "Month filter dropdown includes month 9");
});
