const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("Zone comparison correctly sorts zones numerically ascending including decimal codes", () => {
  const code = fs.readFileSync("modules/core/custom-dropdown.js", "utf8");

  const mockWindow = {};
  const context = vm.createContext({
    window: mockWindow,
    globalThis: mockWindow,
  });

  vm.runInContext(code, context);

  const customDropdown = mockWindow.CustomDropdown;
  assert.ok(customDropdown, "CustomDropdown registered on window");
  assert.equal(typeof customDropdown.compareZoneCodesByOrder, "function");

  const rawZones = [
    { code: "25 · PMV" },
    { code: "19 · PMV" },
    { code: "18.1 · PMV" },
    { code: "18.2 · PMV" },
    { code: "5 · Cơ khí" },
    { code: "1 · Cơ khí" },
    { code: "6 · Cơ khí" },
    { code: "7 · Cơ khí" },
    { code: "26 · Cơ khí" },
    { code: "4 · Cơ khí" },
    { code: "15 · Hàn" },
    { code: "12.1 · Hàn" },
    { code: "12.2 · Hàn" },
    { code: "13 · Hàn" },
    { code: "14 · Hàn" },
    { code: "10 · KTCT" },
    { code: "8 · KTCT" },
    { code: "9 · KTCT" },
    { code: "16 · KLK" },
    { code: "17 · Kho xuất" },
    { code: "2 · Kho VT" },
    { code: "3 · Kho VT" },
    { code: "11 · Cơ điện" },
    { code: "20 · Quản lý sản xuất" },
    { code: "21 · HC" },
    { code: "22 · QC" },
    { code: "23 · sxCNC" },
    { code: "24 · New Model" },
    { code: "Nhà sắt" },
    { code: "Kế toán" },
  ];

  rawZones.sort(customDropdown.compareZoneCodesByOrder);

  const sortedNames = rawZones.map((z) => z.code.split("·")[0].trim());
  assert.equal(sortedNames[0], "1");
  assert.equal(sortedNames[1], "2");
  assert.equal(sortedNames[2], "3");
  assert.equal(sortedNames[3], "4");
  assert.equal(sortedNames[4], "5");
  assert.equal(sortedNames[5], "6");
  assert.equal(sortedNames[6], "7");
  assert.equal(sortedNames[7], "8");
  assert.equal(sortedNames[8], "9");
  assert.equal(sortedNames[9], "10");
  assert.equal(sortedNames[10], "11");
  assert.equal(sortedNames[11], "12.1");
  assert.equal(sortedNames[12], "12.2");
  assert.equal(sortedNames[13], "13");
  assert.equal(sortedNames[14], "14");
  assert.equal(sortedNames[15], "15");
  assert.equal(sortedNames[16], "16");
  assert.equal(sortedNames[17], "17");
  assert.equal(sortedNames[18], "18.1");
  assert.equal(sortedNames[19], "18.2");
  assert.equal(sortedNames[20], "19");
  assert.equal(sortedNames[21], "20");
  assert.equal(sortedNames[22], "21");
  assert.equal(sortedNames[23], "22");
  assert.equal(sortedNames[24], "23");
  assert.equal(sortedNames[25], "24");
  assert.equal(sortedNames[26], "25");
  assert.equal(sortedNames[27], "26");
  // Non-numeric at the end
  assert.equal(sortedNames[28], "Kế toán");
  assert.equal(sortedNames[29], "Nhà sắt");
});

test("app.js sorts areas by departmentHead group order and ascending zone code within each group", () => {
  const appJs = fs.readFileSync("app.js", "utf8");
  assert.ok(
    appJs.includes("function sortAreasByDepartmentHeadAndCode("),
    "app.js must define sortAreasByDepartmentHeadAndCode"
  );
  assert.ok(
    appJs.includes("return sortAreasByDepartmentHeadAndCode(areas);"),
    "getAreasForPeriod must use sortAreasByDepartmentHeadAndCode"
  );
  assert.ok(
    appJs.includes("getAreasForPeriod(periodId).sort(compareZoneCodesByOrder)"),
    "populateAdminScoreSheetAreas must sort areas by compareZoneCodesByOrder"
  );
  assert.ok(
    appJs.includes("window.CustomDropdown?.enhanceAll?.(elements.modalBody)"),
    "openFormModal must call CustomDropdown.enhanceAll"
  );
});

test("five-s-findings-page.js and mobile-prototype.js sort zones with compareZoneCodesByOrder", () => {
  const findingsJs = fs.readFileSync("modules/pages/five-s-findings-page.js", "utf8");
  assert.ok(
    findingsJs.includes("compareZoneCodesByOrder"),
    "five-s-findings-page.js must use compareZoneCodesByOrder"
  );

  const mobileJs = fs.readFileSync("modules/pages/mobile-prototype.js", "utf8");
  assert.ok(
    mobileJs.includes("CustomDropdown?.compareZoneCodesByOrder"),
    "mobile-prototype.js must use CustomDropdown.compareZoneCodesByOrder"
  );
});

test("custom-dropdown.js always renders dropdown menu downward below trigger", () => {
  const js = fs.readFileSync("modules/core/custom-dropdown.js", "utf8");
  assert.ok(
    js.includes("menu.style.top = `${rect.bottom}px`"),
    "Dropdown must position strictly downwards below the trigger rect.bottom"
  );
  assert.ok(
    js.includes("menu.style.position = \"fixed\""),
    "Dropdown must use fixed positioning to escape overflow: auto containers"
  );
});

test("styles.css defines seamless dropdown styles attaching downwards and aligns toolbar zone triggers with native selects", () => {
  const css = fs.readFileSync("styles.css", "utf8");
  assert.ok(css.includes(".custom-dropdown-wrap"), "Has custom-dropdown-wrap");
  assert.ok(css.includes(".custom-dropdown-trigger.is-open"), "Has custom-dropdown-trigger.is-open");
  assert.ok(css.includes("border-bottom-left-radius: 0 !important"), "Flattens bottom corners on open");
  assert.ok(css.includes(".custom-dropdown-menu"), "Has custom-dropdown-menu");
  assert.ok(css.includes("border-top: none"), "Seamlessly connects to trigger without top border");
  assert.ok(css.includes(".custom-dropdown-menu.is-dark"), "Has dark theme custom-dropdown-menu");
  assert.ok(!css.includes(".toolbar label span {"), "Toolbar label span selector must not leak styles onto .custom-dropdown-label");
  assert.ok(css.includes(".toolbar label > span:not(.custom-dropdown-label)"), "Toolbar label span targets only direct field title span");
  assert.ok(css.includes(".findings-page button:not(.custom-dropdown-trigger)"), "Findings page button rule excludes custom-dropdown-trigger");
  assert.ok(css.includes(".safety-toolbar .custom-dropdown-trigger"), "Safety toolbar custom dropdown trigger matches dark toolbar select style");
  assert.ok(css.includes(".findings-desktop-toolbar .custom-dropdown-trigger"), "Findings desktop toolbar custom dropdown trigger matches dark toolbar select style");
});
