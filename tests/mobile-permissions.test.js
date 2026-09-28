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
