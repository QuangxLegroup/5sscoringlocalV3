const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

test("Safety Month Filter in mobile-prototype.js", async (t) => {
  const fileContent = fs.readFileSync(path.resolve(__dirname, "../modules/pages/mobile-prototype.js"), "utf8");

  await t.test("contains monthKey helper functions and currentSafetyMonthKey state", () => {
    assert.ok(fileContent.includes("let currentSafetyMonthKey = \"\";"), "Must declare currentSafetyMonthKey state");
    assert.ok(fileContent.includes("function monthKeyFromDate(value)"), "Must define monthKeyFromDate helper");
    assert.ok(fileContent.includes("function monthKeyFromPeriod(period)"), "Must define monthKeyFromPeriod helper");
    assert.ok(fileContent.includes("function monthKeyForSafetyRecord(item, context)"), "Must define monthKeyForSafetyRecord helper");
  });

  await t.test("renders #mobileSafetyMonthFilter dropdown in .history-heading-filter", () => {
    assert.ok(fileContent.includes('id="mobileSafetyMonthFilter"'), "Must render mobileSafetyMonthFilter select");
    assert.ok(fileContent.includes('class="history-heading-filter"'), "Must be inside history-heading-filter");
    assert.ok(fileContent.includes('class="history-period-filter"'), "Must be wrapped with history-period-filter");
  });

  await t.test("wireSafetyHistory binds change listener to #mobileSafetyMonthFilter", () => {
    assert.ok(fileContent.includes('screen.querySelector("#mobileSafetyMonthFilter")'), "Must query mobileSafetyMonthFilter");
    assert.ok(fileContent.includes('currentSafetyMonthKey = event.target.value'), "Must update currentSafetyMonthKey on change");
    assert.ok(fileContent.includes('renderSafetyHistory(screen, context, "", dateStr)'), "Must re-render safety history on month change");
  });

  await t.test("renderSafetyHistory filters records by currentSafetyMonthKey and updates count", () => {
    assert.ok(fileContent.includes('monthKeyForSafetyRecord(rec, context) === currentSafetyMonthKey'), "Must filter allMonthRecords by currentSafetyMonthKey");
    assert.ok(fileContent.includes('pageFilters.year = selYear;'), "Must pass year filter to loadCollectionPage");
    assert.ok(fileContent.includes('pageFilters.month = selMonth;'), "Must pass month filter to loadCollectionPage");
  });
});
