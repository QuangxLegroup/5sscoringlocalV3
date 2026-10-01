"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { seedAccounts } = require("../server");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const readFunction = name => source.match(new RegExp(`  (?:async )?function ${name}\\([^]*?\\n  }`))[0];

test("restart keeps runtime account credentials, scope and deleted accounts unchanged", async () => {
  const original = { accounts: { live: { id: "live", username: "head", role: "departmentHead", passwordHash: "current", safetyAreaIds: ["new-zone"] } } };
  let root = structuredClone(original);
  const repository = { async updateRoot(update) { root = update(structuredClone(root)); } };
  const seeds = { live: { username: "head", role: "admin", passwordHash: "outdated" }, deleted: { username: "deleted-user" } };
  await seedAccounts(repository, seeds);
  assert.deepEqual(root, original);
  root = null;
  await seedAccounts(repository, { bootstrap: { username: "initial-admin", role: "admin" } });
  assert.equal(root.accounts.bootstrap.username, "initial-admin");
});

test("failed safety deletion leaves visible records and deletion markers unchanged", async () => {
  const record = { id: "r", periodId: "p", areaId: "z" };
  const state = { safetyRecords: [record], deletedSafetyRecords: [] };
  let writes = 0;
  const context = vm.createContext({
    state, canManageSafetyRecord: () => true,
    getDeletedSafetyRecordMarker: () => ({ id: "r", periodId: "p", areaId: "z" }),
    shouldKeepDeletedSafetyRecordMarker: () => true,
    updateRootWithOptionalRenderSuppression: async () => { throw new Error("Network failed"); },
  });
  vm.runInContext(readFunction("deleteSafetyRecordDirect"), context);
  await assert.rejects(context.deleteSafetyRecordDirect("r"), /Network failed/);
  assert.deepEqual(state, { safetyRecords: [record], deletedSafetyRecords: [] });
  context.updateRootWithOptionalRenderSuppression = async () => { writes++; };
  assert.equal(await context.deleteSafetyRecordDirect("r"), true);
  assert.equal(state.safetyRecords.length, 0);
  assert.equal(state.deletedSafetyRecords.length, 1);
  assert.equal(writes, 1);
});

test("Excel cumulative lines disable smoothing and expose markers and numeric labels", () => {
  const context = vm.createContext({ escapeXml: String, chartStringRefXml: () => "", chartNumberRefXml: () => "", chartTextPropertiesXml: () => "" });
  vm.runInContext(readFunction("chartDataLabelsXml") + readFunction("buildReportChartSeriesXml"), context);
  const xml = context.buildReportChartSeriesXml({ name: "Cumulative", values: [0, 5, 5], type: "line", marker: "circle", showDataLabels: true, labelFormat: "0", dataLabelPosition: "t" }, 2, "", [], true);
  assert.match(xml, /<c:smooth val="0"\/>/);
  assert.match(xml, /<c:symbol val="circle"\/>/);
  assert.match(xml, /<c:showVal val="1"\/>/);
  assert.match(xml, /<c:dLblPos val="t"\/>/);
});

test("frontend Docker port and allowed origins default to 5500", () => {
  const compose = fs.readFileSync(path.join(__dirname, "..", "docker-compose.yml"), "utf8");
  const env = fs.readFileSync(path.join(__dirname, "..", ".env.example"), "utf8");
  assert.match(compose, /FRONTEND_PORT:-5500/);
  assert.match(compose, /CORS_ORIGIN:.*localhost:5500,http:\/\/127\.0\.0\.1:5500/);
  assert.match(compose, /JWT_SECRET:\s*\$\{JWT_SECRET:\?/);
  assert.match(env, /FRONTEND_PORT=5500/);
  assert.doesNotMatch(compose + env, /8080/);
});

test("LAN Docker deployment terminates HTTPS at Caddy and preserves the secure scheme", () => {
  const compose = fs.readFileSync(path.join(__dirname, "..", "docker-compose.yml"), "utf8");
  const caddyfile = fs.readFileSync(path.join(__dirname, "..", "docker", "caddy", "Caddyfile"), "utf8");
  const nginx = fs.readFileSync(path.join(__dirname, "..", "docker", "nginx", "default.conf"), "utf8");

  assert.match(compose, /APP_HOST:\s*\$\{APP_HOST:-192\.168\.2\.61\}/);
  assert.match(compose, /\$\{HTTPS_PORT:-443\}:443/);
  assert.match(caddyfile, /tls internal/);
  assert.match(caddyfile, /reverse_proxy frontend:80/);
  assert.match(nginx, /proxy_set_header X-Forwarded-Proto \$http_x_forwarded_proto;/);
});

test("new 5S issues reuse only records with matching inspection details", () => {
  const moduleSource = fs.readFileSync(path.join(__dirname, "..", "modules/pages/five-s-findings-page.js"), "utf8");
  const record = { periodId: "p", areaId: "z", inspector: "First inspector", inspectionDate: "2026-09-28" };
  const context = vm.createContext({ sheets: () => [record], resolvePeriodId: row => row.periodId, resolveAreaId: row => row.areaId });
  vm.runInContext(moduleSource.match(/  function findMatchingSheet\([^]*?\n  }/)[0], context);
  const ctx = { getPeriodsByType: () => [], getAreasForPeriod: () => [] };
  assert.equal(context.findMatchingSheet(ctx, "p", "z", "First inspector", "2026-09-28"), record);
  assert.equal(context.findMatchingSheet(ctx, "p", "z", "New inspector", "2026-09-28"), undefined);
  assert.equal(context.findMatchingSheet(ctx, "p", "z", "First inspector", "2026-09-29"), undefined);
});
