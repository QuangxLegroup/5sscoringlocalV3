"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function readFunction(file, name) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8")
    .match(new RegExp(`  function ${name}\\([^]*?\\n  }`))[0];
}

test("admin controls recover after switching accounts without unlocking business-disabled fields", () => {
  const context = vm.createContext({});
  vm.runInContext(readFunction("app.js", "syncPermissionControl"), context);
  for (const property of ["disabled", "hidden"]) {
    for (const original of [false, true]) {
      const element = { dataset: {}, [property]: original };
      context.syncPermissionControl(element, property, true);
      context.syncPermissionControl(element, property, true);
      assert.equal(element[property], true);
      context.syncPermissionControl(element, property, false);
      assert.equal(element[property], original);
      assert.deepEqual(element.dataset, {});
      context.syncPermissionControl(element, property, false);
      assert.equal(element[property], original);
    }
  }
});

test("all authenticated roles can navigate to every mobile page", () => {
  const context = vm.createContext({ currentUser: null });
  vm.runInContext(readFunction("app.js", "isTabAllowed"), context);
  for (const tab of ["mobile-5s", "mobile-safety", "mobile-findings"]) {
    assert.equal(context.isTabAllowed(tab), false);
    for (const role of ["viewer", "departmentHead", "zoneOwner", "assessor5s", "assessorSafety", "admin"]) {
      context.currentUser = { role };
      assert.equal(context.isTabAllowed(tab), true, role + ": " + tab);
    }
    context.currentUser = null;
  }
});

test("mobile viewing does not require write permission and still requires login", () => {
  const overlay = {};
  let opened = 0;
  let denied = 0;
  const context = vm.createContext({
    currentAppContext: null, activeTab: "",
    mobileAccountKey: null, currentFiveSZoneId: "", currentSafetyZoneId: "",
    currentFiveSScoreSource: "", currentFiveSScoreSourceUserKey: null,
    getAppContext: () => context.currentAppContext,
    showMobileToast: () => { denied++; },
    showMobilePane: () => { opened++; },
    document: { getElementById: () => overlay, body: { contains: () => true } },
  });
  vm.runInContext(readFunction("modules/pages/mobile-prototype.js", "openMobilePrototype"), context);
  context.openMobilePrototype("safety", { currentUser: null });
  assert.equal(denied, 1);
  assert.equal(opened, 0);
  for (const tab of ["5s", "safety", "findings"]) {
    context.openMobilePrototype(tab, { currentUser: { role: "viewer" }, isFiveSAssessor: () => false, canUseSafety: () => false });
    assert.equal(context.activeTab, tab);
  }
  context.currentFiveSZoneId = "zone-from-previous-account";
  context.openMobilePrototype("5s", { currentUser: { id: "assessor-2", role: "assessor5s" } });
  assert.equal(context.currentFiveSZoneId, "");
  assert.equal(opened, 4);
  assert.equal(denied, 1);
});

test("mobile Zone options and defaults follow the signed-in account's permissions", () => {
  const context = vm.createContext({});
  for (const name of ["filterMobileAreasByPermission", "resolveMobileAreaId", "getDefaultMobileFiveSScoreSource"]) {
    vm.runInContext(readFunction("modules/pages/mobile-prototype.js", name), context);
  }

  const areas = [{ id: "zone-1" }, { id: "zone-2" }, { id: "zone-3" }];
  const allowed = new Set(["zone-2", "zone-3"]);
  const assigned = Array.from(context.filterMobileAreasByPermission(areas, allowed));
  assert.equal(assigned.map((area) => area.id).join(","), "zone-2,zone-3");
  assert.equal(context.resolveMobileAreaId("zone-1", assigned), "zone-2");
  assert.equal(context.resolveMobileAreaId("zone-3", assigned), "zone-3");
  assert.equal(context.resolveMobileAreaId("zone-1", []), "");
  assert.equal(context.filterMobileAreasByPermission(areas, null).length, 3);
  assert.equal(context.getDefaultMobileFiveSScoreSource({ getScoreSourceForAccount: () => "self" }, { role: "zoneOwner" }), "self");
  assert.equal(context.getDefaultMobileFiveSScoreSource({ SCORE_SOURCE_ASSESSOR: "assessor" }, { role: "assessor5s" }), "assessor");
});

test("mobile 5S shows source filtering to admins and defaults each role to its own source and Zones", () => {
  const screen = { innerHTML: "", querySelectorAll: () => [] };
  const overlay = { querySelector: () => screen };
  const vmContext = vm.createContext({
    SECTION_FILTERS: [{ id: "all", label: "Tất cả" }],
    activeSectionFilter: "all",
    currentFiveSZoneId: "zone-1",
    currentFiveSScoreSource: "",
    currentFiveSScoreSourceUserKey: null,
    checkFiveSPermission: () => true,
    buildFlattened5SCriteria: () => [],
    calculateArea5SScoreStat: () => ({ completed: 0, total: 44, avgText: "--", pct: 0 }),
    render5SItemCards: () => "cards",
    wireFiveSEvents() {},
    escapeHtml: (value) => String(value),
    window: {},
  });
  for (const name of ["filterMobileAreasByPermission", "resolveMobileAreaId", "getDefaultMobileFiveSScoreSource", "renderFiveSScreen"]) {
    vm.runInContext(readFunction("modules/pages/mobile-prototype.js", name), vmContext);
  }

  let user = { id: "admin-1", role: "admin" };
  let areas = [{ id: "zone-1", code: "1" }, { id: "zone-2", code: "2" }];
  let allowedAreaIds = null;
  const appContext = {
    currentUser: user,
    FIVE_S_PERIOD_TYPE: "5s",
    SCORE_SOURCE_ASSESSOR: "assessor",
    SCORE_SOURCE_SELF: "self",
    isAdminAccount: (account) => account.role === "admin",
    getActivePeriodId: () => "period-1",
    isPeriodOpen: () => true,
    getAreasForPeriod: () => areas,
    getAllowedAreaIds: () => allowedAreaIds,
    getScoreSourceForAccount: (account) => account.role === "zoneOwner" ? "self" : "assessor",
    canEditFiveSScoreSource: (account, source) => account.role === "admin" || source === (account.role === "zoneOwner" ? "self" : "assessor"),
    getAreaResponsibleNameForPeriod: () => "Người phụ trách",
  };
  vmContext.renderFiveSScreen(overlay, appContext);
  assert.match(screen.innerHTML, /data-mobile-score-source="assessor"/);
  assert.match(screen.innerHTML, /data-mobile-score-source="self"/);
  assert.match(screen.innerHTML, /value="zone-1" selected/);

  user = appContext.currentUser = { id: "owner-1", role: "zoneOwner" };
  allowedAreaIds = new Set(["zone-2"]);
  vmContext.currentFiveSZoneId = "zone-1";
  vmContext.renderFiveSScreen(overlay, appContext);
  assert.doesNotMatch(screen.innerHTML, /data-mobile-score-source=/);
  assert.doesNotMatch(screen.innerHTML, /value="zone-1"/);
  assert.match(screen.innerHTML, /value="zone-2" selected/);
  assert.match(screen.innerHTML, /Quản lý Zone tự đánh giá/);
});

test("mobile safety submit saves a new report", async () => {
  let submitHandler;
  let savedRecord;
  const messages = [];
  const fields = new Map([
    ["#mobileSafetyZoneSelect", { value: "zone-1" }],
    ["#mobileSafetyDescription", { value: "Hazard found" }],
    ["#mobileSafetyIssueDate", { value: "2026-10-01" }],
    ["#mobileSafetyStop6", { value: "" }],
    ["#mobileSafetyLevel", { value: "" }],
    ["#mobileSafetyFoundChannel", { value: "worker" }],
    ["#mobileSafetyIssueStatus", { value: "open" }],
  ]);
  const form = {
    addEventListener(type, handler) {
      if (type === "submit") submitHandler = handler;
    },
  };
  const screen = {
    querySelector(selector) {
      if (selector === "#mobileSafetyForm") return form;
      return fields.get(selector) || null;
    },
    querySelectorAll() { return []; },
  };
  const area = { id: "zone-1", code: "1" };
  const appContext = {
    currentUser: { username: "admin", name: "Admin", role: "admin" },
    SAFETY_PERIOD_TYPE: "safety",
    state: { safetyRecords: [] },
    canUseSafety: () => true,
    isPeriodArchived: () => false,
    isPeriodOpen: () => true,
    isAdminAccount: () => true,
    getAreasForPeriod: () => [area],
    makeId: () => "safety-new",
    getAccountDisplayName: () => "Admin",
    getSafetyLevelConfirm: () => "",
    getSafetyStop6Confirm: () => "",
    async saveSafetyRecord(record) { savedRecord = record; },
  };
  const sandbox = vm.createContext({
    editingSafetyRecordId: "",
    uploadedSafetyPhotoData: "",
    uploadedSafetyAfterPhotoData: "",
    showMobileToast: (message) => messages.push(message),
    renderSafetyScreen() {},
  });
  vm.runInContext(readFunction("modules/pages/mobile-prototype.js", "checkSafetyPermission"), sandbox);
  vm.runInContext(readFunction("modules/pages/mobile-prototype.js", "wireSafetyEvents"), sandbox);
  sandbox.wireSafetyEvents(screen, appContext, "period-1", {}, new Set(["zone-1"]));

  await submitHandler({ preventDefault() {} });

  assert.equal(savedRecord?.id, "safety-new");
  assert.equal(savedRecord?.note, "Hazard found");
  assert.equal(savedRecord?.actionOwner, "");
  assert.equal(appContext.state.safetyRecords.length, 1);
  assert.equal(messages.at(-1), "Đã lưu báo cáo an toàn thành công!");
});

test("mobile save button stays in the form flow directly after the entered content", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
  const fadeIn = css.match(/@keyframes mobileOverlayFadeIn\s*\{([\s\S]*?)\n\}/);
  const fadeOut = css.match(/@keyframes mobileOverlayFadeOut\s*\{([\s\S]*?)\n\}/);
  const saveRule = css.match(/#mobileProtoOverlay \.mobile-fixed-save\s*\{([^}]+)\}/);

  assert.ok(fadeIn);
  assert.ok(fadeOut);
  assert.ok(saveRule);
  assert.doesNotMatch(fadeIn[1], /transform\s*:/);
  assert.doesNotMatch(fadeOut[1], /transform\s*:/);
  assert.match(saveRule[1], /position:\s*static/);
  assert.match(saveRule[1], /width:\s*100%/);
  assert.doesNotMatch(css, /\.mobile-screen-pane:has\(\.mobile-fixed-save\)\s*\{\s*padding-bottom:/);
});
