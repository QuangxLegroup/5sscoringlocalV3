"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const safetyLive = require("../modules/pages/safety-live-page");

test("SafetyLive: normalizeIssueStatus handles all status values and aliases", () => {
  assert.equal(safetyLive.normalizeIssueStatus("open"), "open");
  assert.equal(safetyLive.normalizeIssueStatus("chưa xử lý"), "open");
  assert.equal(safetyLive.normalizeIssueStatus("chua_xu_ly"), "open");

  assert.equal(safetyLive.normalizeIssueStatus("closed"), "closed");
  assert.equal(safetyLive.normalizeIssueStatus("đã xử lý"), "closed");
  assert.equal(safetyLive.normalizeIssueStatus("done"), "closed");

  assert.equal(safetyLive.normalizeIssueStatus("in_progress"), "in_progress");
  assert.equal(safetyLive.normalizeIssueStatus("đang xử lý"), "in_progress");
  assert.equal(safetyLive.normalizeIssueStatus("processing"), "in_progress");

  assert.equal(safetyLive.normalizeIssueStatus("overdue"), "overdue");
  assert.equal(safetyLive.normalizeIssueStatus("quá hạn"), "overdue");
  assert.equal(safetyLive.normalizeIssueStatus("qua_han"), "overdue");
});

test("SafetyLive: filterIssues NEVER displays closed issues and respects date/month/year/zone", () => {
  const dummyAreas = [
    { id: "area-1", code: "18.1", name: "Khu vực hàn PMV", departmentName: "Hàn" },
    { id: "area-2", code: "1", name: "Xưởng cơ khí", departmentName: "Cơ khí" },
    { id: "area-hidden", code: "27", name: "Khu vực phụ", departmentName: "Phụ" },
  ];

  const dummyPeriods = [
    { id: "p-2026-11", name: "Tháng 11/2026", year: 2026 },
    { id: "p-2026-10", name: "Tháng 10/2026", year: 2026 },
  ];

  const context = {
    getPeriod: (id) => dummyPeriods.find((p) => p.id === id),
    getAreaForPeriod: (pid, aid) => dummyAreas.find((a) => a.id === aid),
    getSafetyDepartmentForArea: (area) => area?.departmentName || "Chưa phân bộ phận",
    getSafetyRecordIssueDate: (r) => r.issueDate || "2026-11-03",
    formatDateDisplay: (d) => d,
    getIssueStatusLabel: (s) => s,
  };

  const sampleRecords = [
    { id: "rec-1", periodId: "p-2026-11", areaId: "area-1", issueDate: "2026-11-01", issueStatus: "open", issueLevel: "A", note: "Rò rỉ khí" },
    { id: "rec-2", periodId: "p-2026-11", areaId: "area-1", issueDate: "2026-11-02", issueStatus: "in_progress", issueLevel: "B", note: "Thiếu chắn bảo vệ" },
    { id: "rec-3", periodId: "p-2026-11", areaId: "area-2", issueDate: "2026-11-03", issueStatus: "overdue", issueLevel: "A", note: "Dây điện trần" },
    { id: "rec-4", periodId: "p-2026-11", areaId: "area-2", issueDate: "2026-11-04", issueStatus: "closed", issueLevel: "C", note: "Đã sửa công tắc (đã xử lý)" },
    { id: "rec-5", periodId: "p-2026-10", areaId: "area-1", issueDate: "2026-10-15", issueStatus: "open", issueLevel: "B", note: "Dầu loang sàn" },
    { id: "rec-hidden", periodId: "p-2026-11", areaId: "area-hidden", issueDate: "2026-11-01", issueStatus: "open", note: "Bỏ qua zone 27" },
  ];

  // 1. Mặc định: Vấn đề đã xử lý (rec-4) và zone 27 (rec-hidden) TUYỆT ĐỐI không xuất hiện
  const defaultFiltered = safetyLive.filterIssues(sampleRecords, safetyLive.DEFAULT_SETTINGS, context);
  const ids = defaultFiltered.map((r) => r.id);
  assert.equal(ids.includes("rec-1"), true);
  assert.equal(ids.includes("rec-2"), true);
  assert.equal(ids.includes("rec-3"), true);
  assert.equal(ids.includes("rec-5"), true);
  assert.equal(ids.includes("rec-4"), false, "rec-4 (closed) must not be shown");
  assert.equal(ids.includes("rec-hidden"), false, "rec-hidden (zone 27) must not be shown");

  // 2. Lọc theo năm 2026
  const yearFiltered = safetyLive.filterIssues(sampleRecords, { ...safetyLive.DEFAULT_SETTINGS, year: "2026" }, context);
  assert.equal(yearFiltered.length, 4);

  // 3. Lọc theo tháng 10
  const monthFiltered = safetyLive.filterIssues(sampleRecords, { ...safetyLive.DEFAULT_SETTINGS, month: "10" }, context);
  assert.equal(monthFiltered.length, 1);
  assert.equal(monthFiltered[0].id, "rec-5");

  // 4. Lọc theo ngày cụ thể 2026-11-03
  const dateFiltered = safetyLive.filterIssues(sampleRecords, { ...safetyLive.DEFAULT_SETTINGS, date: "2026-11-03" }, context);
  assert.equal(dateFiltered.length, 1);
  assert.equal(dateFiltered[0].id, "rec-3");

  // 5. Lọc theo Zone: area-2
  const zoneFiltered = safetyLive.filterIssues(sampleRecords, { ...safetyLive.DEFAULT_SETTINGS, areaId: "area-2" }, context);
  assert.equal(zoneFiltered.length, 1);
  assert.equal(zoneFiltered[0].id, "rec-3");
});

test("SafetyLive: getAvailableFilterOptions extracts only years, months, dates, and zones with unresolved issues", () => {
  const dummyAreas = [
    { id: "area-1", code: "18.1", name: "PMV" },
    { id: "area-2", code: "1", name: "Cơ khí" },
    { id: "area-3", code: "5", name: "Kho" }, // Không có vấn đề nào
  ];

  const context = {
    getPeriod: () => ({ year: 2026 }),
    getAreaForPeriod: (pid, aid) => dummyAreas.find((a) => a.id === aid),
    getSafetyRecordIssueDate: (r) => r.issueDate,
  };

  const sampleRecords = [
    { id: "rec-1", areaId: "area-1", issueDate: "2026-10-14", issueStatus: "open" },
    { id: "rec-2", areaId: "area-1", issueDate: "2026-10-14", issueStatus: "in_progress" },
    { id: "rec-3", areaId: "area-2", issueDate: "2026-11-02", issueStatus: "overdue" },
    { id: "rec-4", areaId: "area-3", issueDate: "2026-09-01", issueStatus: "closed" }, // closed -> không xuất hiện
  ];

  const options = safetyLive.getAvailableFilterOptions(sampleRecords, context, {});

  // Năm có vấn đề: chỉ có 2026
  assert.deepEqual(options.years, ["2026"]);

  // Tháng có vấn đề: chỉ có tháng 11 và tháng 10 (tháng 9 đã closed nên không có, xếp giảm dần)
  assert.deepEqual(options.months, [11, 10]);

  // Ngày có vấn đề: 2026-11-02 và 2026-10-14
  assert.deepEqual(options.dates.map((d) => d.date), ["2026-11-02", "2026-10-14"]);
  assert.equal(options.dates.find((d) => d.date === "2026-10-14").count, 2);

  // Zone có vấn đề: chỉ có area-1 (code 18.1) và area-2 (code 1) (area-3 đã closed)
  assert.equal(options.zones.some((z) => z.id === "5" || z.areaIds?.includes("area-3")), false);
  assert.equal(options.zones.some((z) => z.id === "18.1" && z.areaIds?.includes("area-1")), true);
  assert.equal(options.zones.some((z) => z.id === "1" && z.areaIds?.includes("area-2")), true);
});

test("SafetyLive: sortIssues puts overdue and open first, then in_progress, with rank and date priorities", () => {
  const issues = [
    { id: "inprogress-1", status: "in_progress", rank: "A", issueDate: "2026-11-04" },
    { id: "open-low-rank", status: "open", rank: "C", issueDate: "2026-11-03" },
    { id: "open-high-rank", status: "open", rank: "A", issueDate: "2026-11-02" },
    { id: "overdue-1", status: "overdue", rank: "B", issueDate: "2026-11-01" },
  ];

  const sorted = safetyLive.sortIssues(issues);
  assert.equal(sorted[0].id, "overdue-1"); // Quá hạn ưu tiên số 1
  assert.equal(sorted[1].id, "open-high-rank"); // Chưa xử lý Rank A
  assert.equal(sorted[2].id, "open-low-rank"); // Chưa xử lý Rank C
  assert.equal(sorted[3].id, "inprogress-1"); // Đang xử lý
});

test("SafetyLive: permissions allow all authenticated accounts and block unauthenticated access", () => {
  const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const readFunction = (name) => appSource.match(new RegExp(`  (?:async )?function ${name}\\([^]*?\\n  }`))[0];

  const context = vm.createContext({
    currentUser: { role: "viewer" },
    isViewerAccount: (u) => u?.role === "viewer",
    isAdminAccount: (u) => u?.role === "admin",
    isDepartmentHeadAccount: (u) => u?.role === "departmentHead",
    hasAccountAccessType: () => false,
    hasDepartmentHeadRole: () => false,
    hasAt5sRole: () => false,
    getActivePeriodId: () => "p-1",
    FIVE_S_PERIOD_TYPE: "5s",
  });

  vm.runInContext(readFunction("isTabAllowed"), context);

  // 1. Authenticated accounts are allowed
  for (const role of ["viewer", "admin", "assessor5s", "departmentHead"]) {
    context.currentUser = { role };
    assert.equal(context.isTabAllowed("safety-live"), true);
  }

  // 2. Unauthenticated user is not allowed
  context.currentUser = null;
  assert.equal(context.isTabAllowed("safety-live"), false);
});
