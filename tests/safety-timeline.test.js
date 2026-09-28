"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const Timeline = require("../modules/core/safety-timeline");
const { DataService } = require("../src/server/services/data-service");
const { AuthService } = require("../src/server/services/auth-service");

const issue = { id: "one", periodId: "p", areaId: "z", issueMonth: "9", issueDay: "20", issueCount: 2, issueStatus: "closed", countermeasureDate: "2026-10-03", completedDate: "2026-11-07" };

test("detection, implementation and completion count in separate actual months", () => {
  const totals = Timeline.aggregate([issue], 2026, () => 2026);
  assert.equal(totals.detected[8], 2);
  assert.equal(totals.implemented[8], 0);
  assert.equal(totals.implemented[9], 2);
  assert.equal(totals.completed[9], 0);
  assert.equal(totals.completed[10], 2);
});

test("prior-year issues appear in the year of implementation/completion with opening balances", () => {
  const record = { ...issue, issueMonth: "12", countermeasureDate: "2027-01-10", completedDate: "2027-02-01" };
  const oldYear = Timeline.aggregate([record], 2026, () => 2026);
  const newYear = Timeline.aggregate([record], 2027, () => 2026);
  assert.equal(oldYear.detected[11], 2);
  assert.equal(oldYear.implemented.reduce((a, b) => a + b), 0);
  assert.equal(newYear.detected.reduce((a, b) => a + b), 0);
  assert.equal(newYear.implemented[0], 2);
  assert.equal(newYear.completed[1], 2);
  assert.equal(newYear.carryImplementation, 2);
  assert.equal(newYear.carryCompletion, 2);
  assert.equal(newYear.implemented[0] / newYear.carryImplementation, 1);
});

test("legacy/default planned dates never become actual activity dates", () => {
  const record = { ...issue, countermeasureDate: "", completedDate: "", completionDate: "2026-09-20", updatedAt: "2026-09-20" };
  const totals = Timeline.aggregate([record], 2026, () => 2026);
  assert.equal(totals.missingDates, 2);
  assert.equal(totals.implemented.reduce((a, b) => a + b), 0);
  assert.equal(totals.completed.reduce((a, b) => a + b), 0);
  assert.equal(Timeline.validate({ ...record, note: "Edit unrelated text" }, record), "");
});

test("in-progress issues count as implemented but not completed", () => {
  const totals = Timeline.aggregate([{ ...issue, issueStatus: "in_progress" }], 2026, () => 2026);
  assert.equal(totals.implemented[9], 2);
  assert.equal(totals.completed[10], 0);
});

test("new status transitions require actual dates and enforce chronological order", () => {
  const previous = { ...issue, issueStatus: "open", countermeasureDate: "", completedDate: "" };
  assert.match(Timeline.validate({ ...previous, issueStatus: "in_progress" }, previous), /ngày thực tế/);
  assert.match(Timeline.validate({ ...issue, completedDate: "" }, previous), /hoàn thành/);
  assert.match(Timeline.validate({ ...issue, completedDate: "2026-10-01" }, previous), /trở đi/);
  assert.match(Timeline.validate({ ...issue, countermeasureDate: "2026-09-19" }, previous, 2026), /trước ngày phát hiện/);
  assert.equal(Timeline.validate(issue, previous, 2026), "");
});

test("date validation handles invalid dates and leap years", () => {
  assert.equal(Timeline.date("2026-02-29"), "");
  assert.equal(Timeline.date("2026-04-31"), "");
  assert.equal(Timeline.date("2028-02-29"), "2028-02-29");
  assert.match(Timeline.validate({ ...issue, countermeasureDate: "2026-02-30" }), /không hợp lệ/);
});

test("server validates actual dates before persisting, including atomic batches", async () => {
  let root = { periods: { p: { id: "p", type: "safety", year: 2026 } }, safetyRecords: {} };
  const repository = { dataDir: __dirname, async readRoot() { return structuredClone(root); }, async updateRoot(update) { root = update(structuredClone(root)); return structuredClone(root); } };
  const service = new DataService({ repository, authService: new AuthService({ repository }) });
  const auth = { account: { role: "admin" } };
  await assert.rejects(service.writeData({ operation: "update", path: "", value: { "safetyRecords/one": issue, "safetyRecords/bad": { ...issue, id: "bad", completedDate: "" } } }, auth), { statusCode: 400 });
  assert.deepEqual(root.safetyRecords, {});
  await service.writeData({ operation: "set", path: "safetyRecords/one", value: issue }, auth);
  assert.equal(root.safetyRecords.one.countermeasureDate, "2026-10-03");
  assert.equal(root.safetyRecords.one.completedDate, "2026-11-07");
  const legacy = { ...issue, id: "legacy", countermeasureDate: "", completedDate: "", completionDate: "2026-09-20" };
  await service.writeData({ operation: "set", path: "safetyRecords", value: { one: issue, legacy } }, auth);
  await service.writeData({ operation: "update", path: "safetyRecords/legacy", value: { note: "Keep historical information" } }, auth);
  assert.equal(root.safetyRecords.legacy.completedDate, "");
  assert.equal(Timeline.aggregate([root.safetyRecords.legacy], 2026, () => 2026).missingDates, 2);
});
