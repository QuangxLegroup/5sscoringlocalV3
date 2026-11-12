"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("Safety issues sync: Desktop and Mobile correctly filter and display Month 11/2026 hazard", () => {
  const appJs = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
  const safetyPageJs = fs.readFileSync(path.join(__dirname, "../modules/pages/safety-page.js"), "utf8");
  const mobileJs = fs.readFileSync(path.join(__dirname, "../modules/pages/mobile-prototype.js"), "utf8");

  // 1. Test parseSafetyIssueDateInput in mobile-prototype.js
  const mobileParseMatch = mobileJs.match(/function parseSafetyIssueDateInput\(dateStr, safetyPeriod\)[\s\S]*?\n  \}/);
  assert.ok(mobileParseMatch, "parseSafetyIssueDateInput found in mobile-prototype.js");

  const mobileNormMatch = mobileJs.match(/function getNormalizedSafetyIssueDate\(item, safetyPeriod\)[\s\S]*?\n  \}/);
  assert.ok(mobileNormMatch, "getNormalizedSafetyIssueDate found in mobile-prototype.js");

  const mobileVm = vm.createContext({
    window: { SafetyTimeline: { date: (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "") } },
  });
  vm.runInContext(mobileNormMatch[0], mobileVm);
  vm.runInContext(mobileParseMatch[0], mobileVm);

  const parsedVn = vm.runInContext('parseSafetyIssueDateInput("03/11/2026", { year: 2026, month: 11 })', mobileVm);
  assert.equal(parsedVn.date, "2026-11-03", "Mobile parseSafetyIssueDateInput parses VN date to ISO date");
  assert.equal(parsedVn.day, "3", "Day is 3");
  assert.equal(parsedVn.month, "11", "Month is 11");
  assert.equal(parsedVn.year, "2026", "Year is 2026");

  const parsedIso = vm.runInContext('parseSafetyIssueDateInput("2026-11-03", { year: 2026, month: 11 })', mobileVm);
  assert.equal(parsedIso.date, "2026-11-03", "Mobile parseSafetyIssueDateInput parses ISO date");

  // 2. Test Desktop filtering logic with snapshot drift
  const state = {
    periods: [
      {
        id: "period-safety-10-2026",
        type: "safety",
        year: 2026,
        month: 10,
        settingsSnapshot: {
          areas: [
            { id: "area-oct-10", code: "10", templateCode: "10", departmentHead: "KTCT" },
            { id: "area-oct-1", code: "1", templateCode: "1", departmentHead: "CK" },
          ],
        },
      },
      {
        id: "period-safety-11-2026",
        type: "safety",
        year: 2026,
        month: 11,
        settingsSnapshot: {
          areas: [
            { id: "area-nov-10", code: "10", templateCode: "10", departmentHead: "KTCT" },
            { id: "area-nov-1", code: "1", templateCode: "1", departmentHead: "CK" },
          ],
        },
      },
    ],
    safetyAreas: [
      { id: "area-cat-10", code: "10", templateCode: "10", departmentHead: "KTCT" },
    ],
    safetyRecords: [
      {
        id: "safety-rec-nov-112121",
        periodId: "period-safety-10-2026", // Saved during October session
        areaId: "area-oct-10",
        issueLocation: "Zone 10 · KTCT",
        issueDate: "2026-11-03",
        issueDay: 3,
        issueMonth: 11,
        note: "112121",
        issueStatus: "open",
        issueCount: 1,
        createdAt: "2026-11-03T10:00:00.000Z",
      },
    ],
  };

  const desktopVm = vm.createContext({
    state,
    SAFETY_PERIOD_TYPE: "safety",
    FIVE_S_PERIOD_TYPE: "5s",
    HIDDEN_SAFETY_ZONE_CODES: new Set(["27"]),
    isReportableSafetyArea: (area) => area && String(area.code) !== "27",
    getItem: () => null,
    formatDateParts: (d) => ({ year: "2026", month: "11", day: "03" }),
    todayIsoDate: () => "2026-11-04",
    sortAreasByDepartmentHeadAndCode: (a) => a,
    getCatalogArrays: (type) => ({ areas: state.safetyAreas }),
    window: { SafetyTimeline: { aggregate: () => ({ implemented: [], completed: [] }), date: (d) => d } },
    console,
  });

  // Extract functions from app.js
  const fnNames = [
    "toIsoDate", "isValidIsoDate", "normalizePeriodType", "normalizeCatalogType",
    "getPeriods", "getPeriod", "getPeriodsByType", "shouldUsePeriodSnapshot", "getPeriodSnapshot",
    "getAreas", "getAreasForPeriod", "getCatalogTypeForPeriod", "getAreaForPeriod",
    "getNormalizedSafetyIssueDate", "getSafetyRecordIssueDate", "getSafetyRecordIssueYear",
    "getSafetyIssueMonth", "getIssueMonth", "getSafetyRowsForYear", "getSafetyFilterYears", "getSafetyFilterMonths",
  ];

  for (const fn of fnNames) {
    const regex = new RegExp(`function ${fn}\\s*\\([\\s\\S]*?\\n  \\}`);
    const match = appJs.match(regex);
    assert.ok(match, `Function ${fn} found in app.js`);
    vm.runInContext(match[0], desktopVm);
  }

  // Extract functions from safety-page.js
  const pageFns = ["monthOf", "filterRowsByMonth", "getAllReportableAreas", "getMonthPeriod"];
  for (const fn of pageFns) {
    const regex = new RegExp(`function ${fn}\\s*\\([\\s\\S]*?\\n  \\}`);
    const match = safetyPageJs.match(regex);
    assert.ok(match, `Function ${fn} found in safety-page.js`);
    vm.runInContext(match[0], desktopVm);
  }

  // Test getAreaForPeriod fallback
  const areaResolved = vm.runInContext('getAreaForPeriod("period-safety-11-2026", "area-oct-10", "Zone 10 · KTCT")', desktopVm);
  assert.ok(areaResolved, "getAreaForPeriod resolves area even across different period snapshots");
  assert.equal(areaResolved.code, "10", "Resolved area code is 10");

  // Test getSafetyRowsForYear includes the record
  const yearRows = vm.runInContext("getSafetyRowsForYear(2026, {})", desktopVm);
  assert.equal(yearRows.length, 1, "getSafetyRowsForYear(2026) includes the November record");
  assert.equal(yearRows[0].score.note, "112121");

  // Test Desktop filter by month 11 with period snapshot matching
  vm.runInContext(`
    const ctx = {
      SAFETY_PERIOD_TYPE,
      getPeriodsByType,
      getAreasForPeriod,
      getAreas,
      getIssueMonth,
      getSafetyRecordIssueDate,
      getPeriod,
    };
    const reportPeriod = getMonthPeriod(ctx, 2026, 11, getPeriod("period-safety-10-2026"));
    const visibleAreas = getAllReportableAreas(ctx, reportPeriod.id, "");
    const visibleAreaIds = new Set(visibleAreas.map((area) => area.id));
    const visibleAreaCodes = new Set(visibleAreas.map((area) => String(area.code || area.templateCode || "").trim()));
    const rawYearRows = getSafetyRowsForYear(2026, {})
      .filter((row) => visibleAreaIds.has(row.area?.id) || visibleAreaCodes.has(String(row.area?.code || row.area?.templateCode || "").trim()));
    const monthRows = filterRowsByMonth(rawYearRows, 11, ctx);
  `, desktopVm);

  const monthRows = vm.runInContext("monthRows", desktopVm);
  assert.equal(monthRows.length, 1, "Month 11 rows on Desktop is 1 and contains the hazard 112121");
  assert.equal(monthRows[0].score.note, "112121");
});
