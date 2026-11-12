"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function readFunction(name) {
  const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const match = source.match(new RegExp(`  (?:async )?function ${name}\\([^]*?\\n  }`));
  assert.ok(match, `Function ${name} should exist`);
  return match[0];
}

function helperContext(extra = {}) {
  const isEmpty = value => value === null || value === undefined || (typeof value === "string" && !value.trim()) || (Array.isArray(value) && value.length === 0);
  const context = vm.createContext({
    isAuditValueEmpty: isEmpty,
    formatAuditValue(value, field = "") {
      if (field === "photoDataUrl" || field === "afterPhotoDataUrl") return value ? "Có ảnh" : "Không có ảnh";
      if (field === "photoAnnotations" || field === "afterPhotoAnnotations") return `${Array.isArray(value) ? value.length : 0} nét khoanh`;
      if (isEmpty(value)) return "(trống)";
      return String(value);
    },
    ...extra,
  });
  return context;
}

test("AT report add and delete audit details retain the changed fields", () => {
  const context = helperContext({
    SAFETY_AUDIT_FIELDS: {
      issueDate: "Ngày phát hiện",
      issueLocation: "Zone",
      note: "Mối nguy hiểm",
      photoDataUrl: "Ảnh hiện trường",
      issueStatus: "Tình trạng",
    },
  });
  vm.runInContext(readFunction("buildSafetyAuditDetails"), context);

  const record = {
    issueDate: "2026-11-04",
    issueLocation: "z2",
    note: "Dây điện hở",
    photoDataUrl: "data:image/jpeg;base64,hidden",
    issueStatus: "open",
  };
  const added = context.buildSafetyAuditDetails(null, record, "2");
  const deleted = context.buildSafetyAuditDetails(record, null, "2");

  assert.deepEqual(Array.from(added, change => change.label), Object.values(context.SAFETY_AUDIT_FIELDS));
  assert.equal(added.find(change => change.label === "Ảnh hiện trường").after, "Có ảnh");
  assert.equal(added.find(change => change.label === "Ngày phát hiện").after, "2026-11-04");
  assert.ok(deleted.every(change => change.action === "Xóa" && change.after === "Đã xóa"));
  assert.equal(deleted.find(change => change.label === "Mối nguy hiểm").before, "Dây điện hở");
});

test("5S score edits retain score, note, and photo changes in one audit entry", () => {
  const context = helperContext({
    currentUser: { username: "admin", name: "Admin" },
    FIVE_S_PERIOD_TYPE: "5s",
    getPeriod: periodId => ({ id: periodId, month: 11, year: 2026 }),
    getAreaForPeriod: () => ({ code: "2" }),
    getItem: () => ({ code: "A1", name: "Đường đi bộ" }),
    getCriterion: () => ({ label: "Sắp xếp" }),
    periodLabel: () => "Tháng 11/2026",
    formatScoreRecord: score => score ? String(score.score) : "",
    normalizeScoreSource: source => source,
    getAccountDisplayName: () => "Admin",
    getHistoryEmployeeCode: () => "A01",
    makeId: () => "history-1",
  });
  vm.runInContext(readFunction("createScoreAuditHistoryEntry"), context);
  const entry = context.createScoreAuditHistoryEntry(
    { score: 4, note: "Đã sắp xếp", photoDataUrl: "data:image/jpeg;base64,hidden" },
    { score: 3, note: "", photoDataUrl: "" },
    { periodId: "p1", areaId: "z2", itemId: "item-a1", criterionId: "sort", scoreSource: "assessor", scoreDate: "" },
  );

  assert.equal(entry.action, "Sửa");
  assert.equal(entry.username, "admin");
  assert.ok(entry.auditChanges.some(change => change.label === "Điểm chấm" && change.before === "3" && change.after === "4"));
  assert.ok(entry.auditChanges.some(change => change.label === "Ghi chú" && change.after === "Đã sắp xếp"));
  assert.ok(entry.auditChanges.some(change => change.label === "Ảnh minh họa" && change.after === "Có ảnh"));
});

test("5S finding sheet create and delete audit details retain row fields", () => {
  const context = helperContext({
    FIVE_S_FINDING_AUDIT_FIELDS: {
      location: "Vị trí",
      problem: "Vấn đề phát hiện",
      fiveS: "Hạng mục 5S",
      photoDataUrl: "Ảnh vấn đề",
      afterPhotoDataUrl: "Ảnh sau xử lý",
      countermeasure: "Đối sách",
      owner: "Người phụ trách",
      dueDate: "Hạn hoàn thành",
      progress: "Tiến độ",
    },
  });
  vm.runInContext(readFunction("findingRowHasAuditContent"), context);
  vm.runInContext(readFunction("getFiveSFindingAuditDetails"), context);

  const sheet = {
    area: "Zone 2",
    inspector: "Mr Lai",
    inspectionDate: "2026-11-04",
    rows: [{
      location: "Lối đi",
      problem: "Vật cản lối đi",
      fiveS: "A1",
      photoDataUrl: "data:image/jpeg;base64,hidden",
      countermeasure: "Di chuyển vật cản",
      owner: "Mr Lai",
      dueDate: "2026-11-08",
      progress: "25",
    }],
  };
  const added = context.getFiveSFindingAuditDetails(null, sheet, "2");
  const deleted = context.getFiveSFindingAuditDetails(sheet, null, "2");

  assert.ok(added.some(change => change.label === "Ngày kiểm tra" && change.after === "2026-11-04"));
  assert.ok(added.some(change => change.label === "Ảnh vấn đề" && change.after === "Có ảnh"));
  assert.ok(added.some(change => change.label === "Đối sách" && change.after === "Di chuyển vật cản"));
  assert.ok(added.some(change => change.label === "Tiến độ" && change.after === "25"));
  assert.ok(deleted.every(change => change.action === "Xóa" && change.after === "Đã xóa"));
  assert.ok(deleted.some(change => change.label === "Vấn đề phát hiện" && change.before === "Vật cản lối đi"));
  assert.equal(context.findingRowHasAuditContent({ progress: "0" }), false);
});

test("audit filters narrow by date, operation, actor, Zone, and searchable change text", () => {
  const context = helperContext({
    activeHistoryScope: "5s",
    auditLogFilters: { search: "xe hàng", from: "2026-10-01", to: "2026-10-31", action: "Sửa", actor: "alice", zone: "Zone 2" },
    getHistoryChangesForScope: entry => entry.changes,
  });
  for (const name of ["auditEntryActorKey", "auditEntryChanges", "auditEntryZone", "filteredAuditChanges", "filterAuditEntries"]) {
    vm.runInContext(readFunction(name), context);
  }
  const entries = [
    {
      username: "alice", employeeCode: "E01", timestamp: "2026-10-20T09:00:00.000Z",
      changes: [{ scope: "5s", action: "Sửa", target: "Zone 2 · Xe hàng chắn lối đi", label: "Vấn đề", before: "Xe hàng", after: "Đã dọn" }],
    },
    {
      username: "bob", employeeCode: "E02", timestamp: "2026-10-20T09:00:00.000Z",
      changes: [{ scope: "5s", action: "Sửa", target: "Zone 2 · Xe hàng", label: "Vấn đề" }],
    },
    {
      username: "alice", employeeCode: "E01", timestamp: "2026-09-20T09:00:00.000Z",
      changes: [{ scope: "5s", action: "Sửa", target: "Zone 2 · Xe hàng", label: "Vấn đề" }],
    },
  ];
  assert.deepEqual(Array.from(context.filterAuditEntries(entries), entry => entry.username), ["alice"]);
});

test("audit entries are separated into the five requested categories", () => {
  const context = helperContext({
    SAFETY_PERIOD_TYPE: "safety",
    FIVE_S_PERIOD_TYPE: "5s",
    AUDIT_LOG_SCOPE_OPTIONS: [
      { value: "safety" }, { value: "fiveSFindings" }, { value: "fiveSScoring" },
      { value: "catalog" }, { value: "accounts" },
    ],
    normalizeCatalogType: value => value === "safety" ? "safety" : "5s",
    normalizeAuditLogScope: value => value === "5s" ? "fiveSFindings" : value,
    getHistoryEntryScope: entry => entry?.scope || "5s",
  });
  vm.runInContext(readFunction("getAuditChangeCategory"), context);

  const category = (change, entry = {}) => context.getAuditChangeCategory(change, entry);
  assert.equal(category({ category: "safety", section: "Phiên đăng nhập" }), "safety");
  assert.equal(category({ category: "fiveSFindings", section: "Phiên đăng nhập" }), "fiveSFindings");
  assert.equal(category({ category: "fiveSScoring", section: "Phiên đăng nhập" }), "fiveSScoring");
  assert.equal(category({ category: "catalog", section: "Chấm điểm 5S" }), "catalog");
  assert.equal(category({ category: "accounts", section: "Danh mục" }), "accounts");

  assert.equal(category({ section: "Phiên đăng nhập", label: "Điểm chấm", scope: "5s" }), "fiveSScoring");
  assert.equal(category({ section: "Vấn đề 5S", label: "Vấn đề phát hiện", scope: "5s" }), "fiveSFindings");
  assert.equal(category({ section: "Đánh giá an toàn", label: "Mối nguy hiểm phát hiện", scope: "safety" }), "safety");
  assert.equal(category({ section: "Tài khoản và quyền", label: "Vai trò 5S", scope: "5s" }), "accounts");
  assert.equal(category({ section: "Phiên đăng nhập", label: "Zone", target: "Zone 16 · Người phụ trách zone", scope: "5s" }), "catalog");
  assert.equal(category({ section: "Mục tiêu an toàn", label: "Mức tiêu chuẩn", scope: "safety" }), "catalog");
});

test("history scope filtering includes only changes for the selected audit category", () => {
  const context = helperContext({
    SAFETY_PERIOD_TYPE: "safety",
    FIVE_S_PERIOD_TYPE: "5s",
    AUDIT_LOG_SCOPE_OPTIONS: [
      { value: "safety" }, { value: "fiveSFindings" }, { value: "fiveSScoring" },
      { value: "catalog" }, { value: "accounts" },
    ],
    normalizeCatalogType: value => value === "safety" ? "safety" : "5s",
    normalizeAuditLogScope: value => value === "5s" ? "fiveSFindings" : value,
    getHistoryEntryScope: entry => entry?.scope || "5s",
    getAuditChanges: entry => entry.changes,
  });
  vm.runInContext(readFunction("getAuditChangeCategory"), context);
  vm.runInContext(readFunction("getHistoryChangesForScope"), context);

  const entry = { changes: [
    { category: "safety", section: "Đánh giá an toàn", label: "Mối nguy" },
    { category: "fiveSFindings", section: "Vấn đề 5S", label: "Vấn đề phát hiện" },
    { category: "fiveSScoring", section: "Chấm điểm 5S", label: "Điểm chấm" },
    { category: "catalog", section: "Danh mục", label: "Zone" },
    { category: "accounts", section: "Tài khoản và quyền", label: "Vai trò" },
  ] };
  for (const scope of ["safety", "fiveSFindings", "fiveSScoring", "catalog", "accounts"]) {
    assert.deepEqual(Array.from(context.getHistoryChangesForScope(entry, scope), change => change.category), [scope]);
  }
});

test("a legacy mixed session does not apply its account category to every change", () => {
  const context = helperContext({
    SAFETY_PERIOD_TYPE: "safety",
    FIVE_S_PERIOD_TYPE: "5s",
    AUDIT_LOG_SCOPE_OPTIONS: [
      { value: "safety" }, { value: "fiveSFindings" }, { value: "fiveSScoring" },
      { value: "catalog" }, { value: "accounts" },
    ],
    normalizeCatalogType: value => value === "safety" ? "safety" : "5s",
    normalizeAuditLogScope: value => value,
    getHistoryEntryScope: entry => entry?.scope || "5s",
    getAuditAction: () => "Sửa",
    getHistoryChangeText: () => "Phiên đăng nhập có thay đổi",
    isMeaningfulAuditItem: () => true,
  });
  vm.runInContext(readFunction("getAuditChangeCategory"), context);
  vm.runInContext(readFunction("getAuditChanges"), context);
  vm.runInContext(readFunction("getHistoryChangesForScope"), context);

  const entry = {
    category: "accounts",
    sectionLabel: "Phiên đăng nhập",
    changes: [
      { section: "Đánh giá an toàn", label: "Báo cáo đánh giá an toàn", action: "Thêm" },
      { section: "Chấm điểm 5S", label: "Điểm chấm", action: "Sửa" },
      { section: "Tài khoản và quyền", label: "Vai trò", action: "Sửa" },
    ],
  };
  assert.deepEqual(Array.from(context.getHistoryChangesForScope(entry, "accounts"), change => change.label), ["Vai trò"]);
  assert.deepEqual(Array.from(context.getHistoryChangesForScope(entry, "safety"), change => change.label), ["Báo cáo đánh giá an toàn"]);
  assert.deepEqual(Array.from(context.getHistoryChangesForScope(entry, "fiveSScoring"), change => change.label), ["Điểm chấm"]);
});
