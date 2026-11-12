"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function readFunction(name) {
  const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const match = source.match(new RegExp(`  (?:async )?function ${name}\\([^]*?\\n  }`));
  assert.ok(match, `Function ${name} should exist in app.js`);
  return match[0];
}

function createContext() {
  const context = vm.createContext({
    SAFETY_PERIOD_TYPE: "safety",
    FIVE_S_PERIOD_TYPE: "5s",
    AUDIT_LOG_SCOPE_OPTIONS: [
      { value: "safety", label: "Đánh giá an toàn", sheet: "Đánh giá AT" },
      { value: "fiveSFindings", label: "Vấn đề 5S", sheet: "Vấn đề 5S" },
      { value: "fiveSScoring", label: "Bảng điểm 5S", sheet: "Bảng điểm 5S" },
      { value: "catalog", label: "Danh mục", sheet: "Danh mục" },
      { value: "accounts", label: "Tài khoản", sheet: "Tài khoản" },
    ],
    normalizeCatalogType: (val) => (val === "safety" ? "safety" : "5s"),
    normalizeAuditLogScope: (val) => {
      const v = String(val || "").trim().toLowerCase();
      if (["catalog", "accounts", "fivesfindings", "fivesscoring"].includes(v)) {
        return v === "fivesfindings" ? "fiveSFindings" : v === "fivesscoring" ? "fiveSScoring" : v;
      }
      if (v === "5s") return "fiveSFindings";
      return "safety";
    },
    getHistoryEntryScope: (entry) => entry?.scope || "5s",
    getAuditAction: (entry) => entry?.action || "Sửa",
    getHistoryChangeText: (entry) => entry?.changeLabel || "Cập nhật dữ liệu",
    isMeaningfulAuditItem: () => true,
  });

  vm.runInContext(readFunction("getAuditChangeCategory"), context);
  vm.runInContext(readFunction("getAuditChanges"), context);
  vm.runInContext(readFunction("getHistoryChangesForScope"), context);
  return context;
}

test("session entry with mixed changes isolates accounts from safety and 5s score changes", () => {
  const context = createContext();

  const mixedSessionEntry = {
    id: "session-123",
    timestamp: "2026-10-31T14:38:58.000Z",
    subjectLabel: "Phiên đăng nhập",
    changeLabel: "Phiên đăng nhập có 6 thay đổi",
    latestChange: "Thêm tài khoản Ban AT - 5S laivt cho Mr Lai",
    note: "Thay đổi gần nhất: Thêm tài khoản Ban AT - 5S laivt cho Mr Lai",
    changes: [
      { section: "Đánh giá an toàn", label: "Báo cáo đánh giá an toàn", target: "28/10/2026 · Zone 18.1", action: "Thêm", before: "", after: "aas" },
      { section: "Đánh giá an toàn", label: "Báo cáo đánh giá an toàn", target: "28/10/2026 · Zone 18.1", action: "Xóa", before: "aas", after: "Đã xóa" },
      { section: "Chấm điểm 5S", label: "Điểm chấm", target: "Tháng 10/2026 · Zone 1 · [A1] - Phân loại", action: "Sửa", before: "3", after: "4" },
      { section: "Chấm điểm 5S", label: "Điểm chấm", target: "Tháng 10/2026 · Zone 1 · [A1] - Phân loại", action: "Sửa", before: "4", after: "3" },
      { section: "Ban AT - 5S", label: "Thêm thành viên Ban AT - 5S: Mr Lai", target: "Tháng 10/2026 · -", action: "Thêm", before: "", after: "1 - Mr Lai" },
      { section: "Tài khoản Ban AT - 5S", label: "Thêm tài khoản Ban AT - 5S laivt cho Mr Lai", target: "Tháng 10/2026 · -", action: "Thêm", before: "", after: "laivt" },
    ],
  };

  const accountChanges = context.getHistoryChangesForScope(mixedSessionEntry, "accounts");
  assert.equal(accountChanges.length, 1, "Only account change should match 'accounts' filter");
  assert.equal(accountChanges[0].section, "Tài khoản Ban AT - 5S");
  assert.equal(accountChanges[0].label, "Thêm tài khoản Ban AT - 5S laivt cho Mr Lai");

  const safetyChanges = context.getHistoryChangesForScope(mixedSessionEntry, "safety");
  assert.equal(safetyChanges.length, 2, "Safety changes should match 'safety' filter");
  assert.ok(safetyChanges.every((c) => c.section === "Đánh giá an toàn"));

  const scoringChanges = context.getHistoryChangesForScope(mixedSessionEntry, "fiveSScoring");
  assert.equal(scoringChanges.length, 2, "5S score changes should match 'fiveSScoring' filter");
  assert.ok(scoringChanges.every((c) => c.section === "Chấm điểm 5S"));

  const catalogChanges = context.getHistoryChangesForScope(mixedSessionEntry, "catalog");
  assert.equal(catalogChanges.length, 1, "Ban AT - 5S member changes should match 'catalog' filter");
  assert.equal(catalogChanges[0].section, "Ban AT - 5S");
  assert.equal(catalogChanges[0].label, "Thêm thành viên Ban AT - 5S: Mr Lai");
});
