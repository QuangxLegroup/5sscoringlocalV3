"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("5S Findings: validateFiveSFindingSave handles admin saves and deletes without 'findingArea is not defined'", () => {
  const appCode = fs.readFileSync(path.resolve("app.js"), "utf8");

  // Verify findingArea is safely scoped before any access
  assert.match(
    appCode,
    /const periodAreas = sheet\.periodId \? getAreasForPeriod\(sheet\.periodId\) : \[\];\s*const findingArea = periodAreas\.find\(\(area\) => area\.id === sheet\.areaId\);/,
    "validateFiveSFindingSave must declare findingArea before checking isAdminAccount"
  );

  assert.match(
    appCode,
    /if \(!responseOnly && findingArea\) sheet\.area = `Zone \$\{findingArea\.code\}`;/,
    "sheet.area assignment must guard that findingArea exists"
  );
});

test("5S Findings: canManageFiveSFindingCountermeasure allows zone managers to update countermeasures on past unarchived periods", () => {
  const appCode = fs.readFileSync(path.resolve("app.js"), "utf8");

  // Verify it does NOT require isPeriodOpen or block on non-active periods
  const funcMatch = /function canManageFiveSFindingCountermeasure\(sheet, account = currentUser\) \{([\s\S]*?)\n {2}\}/.exec(appCode);
  assert.ok(funcMatch, "canManageFiveSFindingCountermeasure function must exist in app.js");
  const funcBody = funcMatch[1];

  assert.ok(
    !funcBody.includes("!isPeriodOpen("),
    "canManageFiveSFindingCountermeasure must NOT require isPeriodOpen (findings can be responded across periods)"
  );

  assert.ok(
    funcBody.includes("if (period?.archived) return false;"),
    "canManageFiveSFindingCountermeasure must only block if the period was explicitly archived"
  );

  assert.ok(
    appCode.includes("function personNameMatches"),
    "app.js must define personNameMatches to recognize titles like Mr Quyết"
  );

  assert.ok(
    funcBody.includes("accountMatchesCatalogPerson"),
    "canManageFiveSFindingCountermeasure must check catalog managers with accountMatchesCatalogPerson"
  );
});

test("5S Findings: resolvePeriodId and resolveAreaId support both date formats and area representations", () => {
  const pageCode = fs.readFileSync(path.resolve("modules/pages/five-s-findings-page.js"), "utf8");

  // 1. resolvePeriodId regex supports display format dd/mm/yyyy
  assert.ok(
    pageCode.includes("const displayMatch = /^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})/.exec(text);"),
    "resolvePeriodId must support dd/mm/yyyy inspectionDate"
  );

  // 2. resolveAreaId checks by code and by id
  assert.match(
    pageCode,
    /const byCode = areas\.find\(\(area\) => String\(area\.code\)\.trim\(\) === raw\);/,
    "resolveAreaId must check by area.code"
  );

  // 3. modal areas for countermeasureOnly
  assert.match(
    pageCode,
    /const areas = fullWritable \? editableAreas\(ctx, periodId\) : sortedAreas\(ctx, periodId\);/,
    "openIssueModal must use sortedAreas when not fullWritable so non-active periods have areas available"
  );
});

test("5S Server Authorization: allows Zone managers to save countermeasure updates for existing findings in unarchived periods", () => {
  const authCode = fs.readFileSync(path.resolve("src/server/services/auth-service.js"), "utf8");

  // 1. assertFiveSFindingWriteAllowed allows countermeasureOnly for past unarchived periods
  assert.match(
    authCode,
    /if \(!countermeasureOnly && period\.id !== activeId\)/,
    "assertScope must only require activeId when NOT countermeasureOnly"
  );

  // 2. personNameMatches in auth-service
  assert.match(
    authCode,
    /function personNameMatches\(accountName, catalogName\)/,
    "auth-service.js must define personNameMatches for Vietnamese titles"
  );
});
