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
  assert.equal(opened, 3);
  assert.equal(denied, 1);
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

test("mobile fixed save bar stays viewport-anchored and leaves scroll clearance", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
  const fadeIn = css.match(/@keyframes mobileOverlayFadeIn\s*\{([\s\S]*?)\n\}/);
  const fadeOut = css.match(/@keyframes mobileOverlayFadeOut\s*\{([\s\S]*?)\n\}/);

  assert.ok(fadeIn);
  assert.ok(fadeOut);
  assert.doesNotMatch(fadeIn[1], /transform\s*:/);
  assert.doesNotMatch(fadeOut[1], /transform\s*:/);
  assert.match(css, /#mobileProtoOverlay:has\(\.mobile-fixed-save\)\s*\{\s*padding-bottom:\s*calc\(100px/);
  assert.doesNotMatch(css, /\.mobile-screen-pane:has\(\.mobile-fixed-save\)\s*\{\s*padding-bottom:/);
});
