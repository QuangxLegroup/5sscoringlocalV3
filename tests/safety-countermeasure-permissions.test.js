"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { AuthService } = require("../src/server/services/auth-service");
const { DataService } = require("../src/server/services/data-service");

const periodId = "safety-october";
const areas = [
  { id: "zone10", code: "10", scorerId: "manager10", departmentHead: "Mr Cuong", departmentHeadEmployeeCode: "100", assessorId: "assessorOther", assessorIds: ["assessorOther", "assessorNga"] },
  { id: "zone16", code: "16", scorerId: "manager16", departmentHead: "Mrs Nga", departmentHeadEmployeeCode: "865", assessorId: "assessorOther", assessorIds: ["assessorOther", "assessorNga"] },
  { id: "zone17", code: "17", scorerId: "manager17", departmentHead: "Mrs Nga", departmentHeadEmployeeCode: "865", assessorId: "assessorOther", assessorIds: ["assessorOther", "assessorNga"] },
];

function fixture() {
  const manager10 = {
    id: "manager10-account", username: "manager10", role: "zoneOwner", accessTypes: ["safety"],
    rolesByType: { safety: "zoneOwner" }, safetyScorerId: "manager10", safetyAreaIds: ["zone10"], employeeCode: "100",
  };
  const managerNga = {
    id: "ngattt-account", username: "ngattt", role: "zoneOwner", accessTypes: ["safety"],
    rolesByType: { safety: "zoneOwner" }, safetyScorerId: "manager17", safetyAreaIds: ["zone17"], employeeCode: "865", name: "Mrs Nga",
  };
  const head10 = {
    id: "head10-account", username: "head10", role: "departmentHead", accessTypes: ["safety"],
    rolesByType: { safety: "departmentHead" }, employeeCode: "100", name: "Mr Cuong",
  };
  const assessorNga = {
    id: "assessorNga-account", username: "assessorNga", role: "assessorSafety", accessTypes: ["safety"],
    rolesByType: { safety: "assessorSafety" }, safetyAssessorId: "assessorNga", employeeCode: "865", name: "Mrs Nga",
  };
  const records = Object.fromEntries(["zone10", "zone16", "zone17"].map((areaId) => [`record-${areaId}`, {
    id: `record-${areaId}`, periodId, areaId, note: "Hazard", issueStatus: "open", issueCount: 1,
    accountUsername: "assessorNga", createdAt: "2026-10-14T08:00:00.000Z", improvementContent: "",
    improvementResponseBy: "", improvementResponseAt: "", afterPhotoDataUrl: "", afterPhotoName: "",
    afterPhotoAnnotations: [], actionOwner: "", actionPlan: "", completionDate: "", countermeasureDate: "", completedDate: "",
  }]));
  let root = {
    activeSafetyPeriodId: periodId,
    periods: { [periodId]: { id: periodId, type: "safety", archived: false, settingsSnapshot: {
      areas,
      managers: [
        { id: "manager10", name: "Mr Cuong", employeeCode: "100" },
        { id: "manager16", name: "Other manager" },
        { id: "manager17", name: "Mrs Nga", employeeCode: "865" },
      ],
      assessors: [{ id: "assessorNga", name: "Mrs Nga", employeeCode: "865" }, { id: "assessorOther", name: "Other assessor" }],
    } } },
    safetyRecords: records,
    accounts: [manager10, managerNga, head10, assessorNga],
  };
  const repository = {
    dataDir: __dirname,
    async readRoot() { return structuredClone(root); },
    async updateRoot(update) { root = await update(structuredClone(root)); return structuredClone(root); },
  };
  const authService = new AuthService({ repository, secret: "test-only" });
  return {
    service: new DataService({ repository, authService }),
    accounts: { manager10, managerNga, head10, assessorNga },
    record(areaId) { return root.safetyRecords[`record-${areaId}`]; },
  };
}

function responsePatch(account) {
  return {
    improvementContent: "Đã xử lý",
    improvementResponseBy: account.id,
    improvementResponseAt: "2026-10-21T03:00:00.000Z",
    improvementResponsePreviousStatus: "open",
    issueStatus: "closed",
    updatedAt: "2026-10-21T03:00:00.000Z",
  };
}

async function reply(service, account, areaId) {
  return service.writeData({
    operation: "update",
    path: `safetyRecords/record-${areaId}`,
    value: responsePatch(account),
  }, { account, rawAccount: account });
}

test("countermeasure replies are limited to the record Zone's manager or department head", async () => {
  // Mrs Nga is the manager of Zone 17 and department head for Zones 16–17.
  // Her assessor assignment spans all Zones, which must not grant Zone 10 reply rights.
  let context = fixture();
  await assert.rejects(reply(context.service, context.accounts.managerNga, "zone10"), { statusCode: 403 });
  context = fixture();
  await reply(context.service, context.accounts.managerNga, "zone16");
  context = fixture();
  await reply(context.service, context.accounts.managerNga, "zone17");

  context = fixture();
  await reply(context.service, context.accounts.manager10, "zone10");
  context = fixture();
  await assert.rejects(reply(context.service, context.accounts.manager10, "zone17"), { statusCode: 403 });
  context = fixture();
  await reply(context.service, context.accounts.head10, "zone10");
  context = fixture();
  await assert.rejects(reply(context.service, context.accounts.head10, "zone16"), { statusCode: 403 });
});

test("an assessor who owns the report can edit issue details but cannot change its countermeasure", async () => {
  const { service, accounts } = fixture();
  const account = accounts.assessorNga;

  await assert.rejects(reply(service, account, "zone10"), { statusCode: 403 });
  await service.writeData({
    operation: "update",
    path: "safetyRecords/record-zone10",
    value: { note: "Updated issue description" },
  }, { account, rawAccount: account });
});

test("non-admin cannot fill countermeasure fields when creating a new safety evaluation, while Zone manager can reply after creation", async () => {
  const { service, accounts } = fixture();
  const assessor = accounts.assessorNga;
  const manager10 = accounts.manager10;

  // 1. Assessor creating new safety record WITH countermeasure fields -> REJECTED (403)
  await assert.rejects(
    service.writeData({
      operation: "set",
      path: "safetyRecords/new-with-cm",
      value: {
        id: "new-with-cm",
        periodId,
        areaId: "zone10",
        note: "Dầu tràn sàn",
        issueStatus: "open",
        issueCount: 1,
        accountUsername: assessor.username,
        improvementContent: "Tự điền đối sách khi tạo",
        actionOwner: "PIC A",
        actionPlan: "Lau ngay",
        completionDate: "2026-10-25",
      },
    }, { account: assessor, rawAccount: assessor }),
    { statusCode: 403 }
  );

  // 2. Assessor creating new safety record WITHOUT countermeasure fields -> ALLOWED
  await service.writeData({
    operation: "set",
    path: "safetyRecords/new-clean",
    value: {
      id: "new-clean",
      periodId,
      areaId: "zone10",
      note: "Dầu tràn sàn",
      issueStatus: "open",
      issueCount: 1,
      accountUsername: assessor.username,
      improvementContent: "",
      afterPhotoDataUrl: "",
      actionOwner: "",
      actionPlan: "",
      completionDate: "",
    },
  }, { account: assessor, rawAccount: assessor });

  // 3. Zone 10 Manager can now answer all 5 countermeasure fields on that record
  await service.writeData({
    operation: "update",
    path: "safetyRecords/new-clean",
    value: {
      improvementContent: "Đã vệ sinh sạch và đặt khay hứng dầu",
      improvementResponseBy: manager10.id,
      improvementResponseAt: "2026-10-22T09:00:00.000Z",
      improvementResponsePreviousStatus: "open",
      issueStatus: "closed",
      afterPhotoDataUrl: "data:image/png;base64,after",
      afterPhotoName: "after.png",
      actionOwner: "Mr Cuong",
      actionPlan: "Kiểm tra hàng ngày",
      completionDate: "2026-10-23",
      updatedAt: "2026-10-22T09:00:00.000Z",
    },
  }, { account: manager10, rawAccount: manager10 });
});
