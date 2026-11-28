"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("5S Findings Table: includes 'Ảnh sau xử lý' after 'Biện pháp khắc phục / CM'", () => {
  const pageCode = fs.readFileSync(path.resolve("modules/pages/five-s-findings-page.js"), "utf8");

  // 1. colgroup has 12 columns with sum 1545
  assert.ok(
    pageCode.includes("[65, 85, 105, 100, 250, 130, 170, 65, 235, 130, 120, 90]"),
    "Table colgroup width array must have exactly 12 columns"
  );
  assert.ok(
    pageCode.includes("width / 1545 * 100"),
    "Colgroup percentage divider must be 1545"
  );

  // 2. thead has 'Ảnh sau xử lý' right after col 4 (Biện pháp khắc phục / CM)
  assert.match(
    pageCode,
    /\$\{col === 4 \? '<th scope="col">Ảnh sau xử lý<\/th>' : ""\}/,
    "thead must render 'Ảnh sau xử lý' header right after 'Biện pháp khắc phục / CM' (col 4)"
  );

  // 3. tbody has photoPreview for after photo right after key === 'countermeasure'
  assert.match(
    pageCode,
    /\$\{key === "countermeasure" \? `<td class="findings-photo-cell">\$\{photoPreview\(row, esc, afterPhotoMetadata\)\}<\/td>` : ""\}/,
    "tbody must render 'Ảnh sau xử lý' cell right after 'countermeasure'"
  );

  // 4. Empty row colspan is 12
  assert.match(
    pageCode,
    /colspan="12" class="findings-empty-row"/,
    "Empty row must span across all 12 columns"
  );

  // 5. photoPreview supports afterPhotoDataUrl
  assert.match(
    pageCode,
    /const isAfterPhoto = photoField === "afterPhotoDataUrl"/,
    "photoPreview must detect afterPhotoDataUrl"
  );
  assert.match(
    pageCode,
    /const alt = isAfterPhoto \? "Ảnh sau xử lý" : "Ảnh vấn đề 5S"/,
    "photoPreview must set appropriate alt text"
  );
});

test("5S Excel Export: includes 'Ảnh sau xử lý' column directly after 'Biện pháp khắc phục / CM'", () => {
  const appCode = fs.readFileSync(path.resolve("app.js"), "utf8");

  // 1. headers in exportFiveSFindings
  assert.match(
    appCode,
    /"Biện pháp khắc phục \/ CM",\s*"Ảnh sau xử lý",\s*"Hạn \/ Due date",\s*"Tiến độ \/ Progress"/,
    "Excel export headers must place 'Ảnh sau xử lý' directly after 'Biện pháp khắc phục / CM'"
  );

  // 2. widths array
  assert.match(
    appCode,
    /const widths = \[6, 12, 16, 18, 42, 22, 28, 11, 42, 22, 16, 14\];/,
    "Excel widths must match 12 columns with afterPhoto having width 22 at column 10"
  );

  // 3. excelColumnByField has dueDate: 11, progress: 12
  assert.match(
    appCode,
    /countermeasure:\s*9,\s*dueDate:\s*11,\s*progress:\s*12/,
    "excelColumnByField must have countermeasure at 9, dueDate at 11, progress at 12"
  );

  // 4. photo.toColumnNumber = 10 for afterPhoto
  assert.match(
    appCode,
    /photoSourceToImage\(row\.afterPhotoDataUrl,\s*\+\+imageIndex,\s*excelRow,\s*10/,
    "afterPhoto must be placed at column 10"
  );
  assert.match(
    appCode,
    /photo\.toColumnNumber = 10;/,
    "afterPhoto drawing column must be 10"
  );
});

test("5S Permissions: only Zone manager and Admin can manage countermeasure fields, and non-admin cannot fill them on create", () => {
  const pageCode = fs.readFileSync(path.resolve("modules/pages/five-s-findings-page.js"), "utf8");

  // 1. canManageCountermeasure logic
  assert.ok(
    pageCode.includes("const isAdmin = Boolean(ctx.isAdminAccount?.(ctx.currentUser));"),
    "Modal must check isAdminAccount"
  );
  assert.ok(
    pageCode.includes("const canManageCountermeasure = editing ? (isAdmin || responseWritable) : isAdmin;"),
    "Only admin can manage countermeasure on create; only admin or zone manager on edit"
  );

  // 2. afterPhotoEditable follows canManageCountermeasure
  assert.ok(
    pageCode.includes("const afterPhotoEditable = canManageCountermeasure;"),
    "afterPhotoEditable must follow canManageCountermeasure"
  );

  // 3. countermeasureFields follow canManageCountermeasure
  assert.match(
    pageCode,
    /if \(countermeasureFields\.has\(k\)\) \{\s*return canManageCountermeasure;\s*\}/,
    "countermeasureFields must be editable only when canManageCountermeasure is true"
  );

  // 4. onSubmit strips/defaults countermeasure fields when canManageCountermeasure is false
  assert.match(
    pageCode,
    /if \(!canManageCountermeasure\) \{\s*if \(!editing\) \{\s*issue\.countermeasure = "";\s*issue\.dueDate = "";\s*issue\.progress = "0";\s*issue\.afterPhotoDataUrl = "";/s,
    "onSubmit must reset countermeasure fields to empty/default when non-admin creates new issue"
  );
  assert.match(
    pageCode,
    /issue\.countermeasure = originalRow\?\.countermeasure \|\| "";/s,
    "onSubmit must preserve original countermeasure fields when non-zone-manager edits issue"
  );
});

test("5S Server Authorization: enforces countermeasure permissions on backend", () => {
  const { AuthService } = require("../src/server/services/auth-service");

  const repository = {
    dataDir: __dirname,
    async readRoot() { return {}; },
    async updateRoot(fn) { return fn({}); },
  };
  const authService = new AuthService({ repository, secret: "test-secret" });

  const root = {
    activeFiveSPeriodId: "p1",
    periods: {
      p1: { id: "p1", type: "5s", year: 2026, month: 11, archived: false },
    },
    areas: {
      z1: { id: "z1", code: "01", name: "Zone 1", scorerId: "mgr-z1" },
      z2: { id: "z2", code: "02", name: "Zone 2", scorerId: "mgr-z2" },
    },
    fiveSFindings: {
      "sheet-1": {
        id: "sheet-1",
        periodId: "p1",
        areaId: "z1",
        area: "Zone 01",
        inspectionDate: "2026-11-03",
        inspector: "Tester",
        rows: [
          {
            problem: "Bụi bẩn",
            location: "Bàn",
            fiveS: "S1",
            shift: "1",
            countermeasure: "Lau dọn",
            countermeasureUpdatedBy: "mgr-z1",
            countermeasureUpdatedAt: "2026-11-03T10:00:00.000Z",
            dueDate: "2026-11-10",
            progress: "25",
            photoDataUrl: "data:image/png;base64,aaa",
            afterPhotoDataUrl: "",
          }
        ],
      },
    },
  };

  // 1. Assessor creating new finding with countermeasure fields -> REJECTED (403)
  const assessorAccount = {
    id: "assessor-1",
    role: "assessor5s",
    accessTypes: ["5s"],
    fiveSAreaIds: ["z1", "z2"],
  };
  assert.throws(
    () => {
      authService.assertFiveSFindingWriteAllowed(
        root,
        assessorAccount,
        {
          operation: "set",
          path: "fiveSFindings/new-sheet",
          value: {
            id: "new-sheet",
            periodId: "p1",
            areaId: "z1",
            inspectionDate: "2026-11-03",
            inspector: "Assessor",
            rows: [
              { problem: "Mới phát hiện", countermeasure: "Tự đề xuất", progress: "50" }
            ],
          },
        }
      );
    },
    (err) => err.statusCode === 403 && err.message.includes("Chỉ admin mới được thêm biện pháp khắc phục"),
    "Non-admin cannot provide countermeasure fields when creating new finding"
  );

  // 2. Assessor creating new finding WITHOUT countermeasure fields -> ALLOWED
  assert.doesNotThrow(() => {
    authService.assertFiveSFindingWriteAllowed(
      root,
      assessorAccount,
      {
        operation: "set",
        path: "fiveSFindings/new-sheet",
        value: {
          id: "new-sheet",
          periodId: "p1",
          areaId: "z1",
          inspectionDate: "2026-11-03",
          inspector: "Assessor",
          rows: [
            { problem: "Mới phát hiện", countermeasure: "", progress: "0", dueDate: "" }
          ],
        },
      }
    );
  }, "Assessor can create finding without countermeasure fields");

  // 3. Assessor editing existing finding and modifying countermeasure -> REJECTED (403)
  assert.throws(
    () => {
      authService.assertFiveSFindingWriteAllowed(
        root,
        assessorAccount,
        {
          operation: "update",
          path: "fiveSFindings/sheet-1",
          value: {
            ...root.fiveSFindings["sheet-1"],
            rows: [
              { ...root.fiveSFindings["sheet-1"].rows[0], countermeasure: "Sửa đối sách trái phép" }
            ],
          },
        }
      );
    },
    (err) => err.statusCode === 403 && err.message.includes("Chỉ người quản lý ở Zone đó và admin"),
    "Assessor cannot modify countermeasure fields of existing finding"
  );

  // 4. Assessor editing existing finding without touching countermeasure fields -> ALLOWED
  assert.doesNotThrow(() => {
    authService.assertFiveSFindingWriteAllowed(
      root,
      assessorAccount,
      {
        operation: "update",
        path: "fiveSFindings/sheet-1",
        value: {
          ...root.fiveSFindings["sheet-1"],
          rows: [
            { ...root.fiveSFindings["sheet-1"].rows[0], problem: "Mô tả vấn đề sửa lại cho rõ" }
          ],
        },
      }
    );
  }, "Assessor can modify issue problem/description without touching countermeasure");

  // 5. Zone manager of Zone 1 updating countermeasure in Zone 1 -> ALLOWED
  const zone1ManagerAccount = {
    id: "mgr-z1",
    role: "zoneOwner",
    accessTypes: ["5s"],
    scorerId: "mgr-z1",
    fiveSAreaIds: ["z1"],
  };
  assert.doesNotThrow(() => {
    authService.assertFiveSFindingWriteAllowed(
      root,
      zone1ManagerAccount,
      {
        operation: "update",
        path: "fiveSFindings/sheet-1",
        value: {
          ...root.fiveSFindings["sheet-1"],
          rows: [
            {
              ...root.fiveSFindings["sheet-1"].rows[0],
              countermeasure: "Đã làm vách ngăn",
              countermeasureUpdatedBy: "mgr-z1",
              countermeasureUpdatedAt: "2026-11-03T11:00:00.000Z",
              progress: "100",
            }
          ],
        },
      }
    );
  }, "Zone manager of Zone 1 can update countermeasure and progress in Zone 1");

  // 6. Admin can create new finding WITH countermeasure fields -> ALLOWED
  const adminAccount = {
    id: "admin-1",
    role: "admin",
  };
  assert.doesNotThrow(() => {
    authService.assertFiveSFindingWriteAllowed(
      root,
      adminAccount,
      {
        operation: "set",
        path: "fiveSFindings/admin-sheet",
        value: {
          id: "admin-sheet",
          periodId: "p1",
          areaId: "z1",
          inspectionDate: "2026-11-03",
          inspector: "Admin",
          rows: [
            { problem: "Vấn đề", countermeasure: "Đối sách", progress: "100", dueDate: "2026-11-10" }
          ],
        },
      }
    );
  }, "Admin can create new finding with countermeasure fields directly");

  // 7. Dual-role user (Zone 1 manager + AT5S) must ONLY edit countermeasures on Zone 1, NOT Zone 2
  const dualRoleRoot = {
    ...root,
    periods: {
      p0: { id: "p0", type: "5s", year: 2026, month: 10, archived: false },
      p1: { id: "p1", type: "5s", year: 2026, month: 11, archived: false },
    },
    managers: {
      "mgr-z1": { id: "mgr-z1", name: "Mr An", employeeCode: "101" },
      "mgr-z2": { id: "mgr-z2", name: "Mr Binh", employeeCode: "202" },
    },
    at5sMembers: {
      "at5s-an": { id: "at5s-an", name: "Mr An", employeeCode: "101" },
    },
    fiveSFindings: {
      ...root.fiveSFindings,
      "sheet-z2": {
        id: "sheet-z2",
        periodId: "p1",
        areaId: "z2",
        area: "Zone 02",
        inspectionDate: "2026-11-03",
        inspector: "Tester",
        rows: [
          {
            problem: "Dây điện bừa bộn",
            location: "Kệ",
            fiveS: "S2",
            shift: "1",
            countermeasure: "",
            countermeasureUpdatedBy: "",
            countermeasureUpdatedAt: "",
            dueDate: "",
            progress: "0",
            photoDataUrl: "",
            afterPhotoDataUrl: "",
          },
        ],
      },
      "sheet-p0-z1": {
        id: "sheet-p0-z1",
        periodId: "p0",
        areaId: "z1",
        area: "Zone 01",
        inspectionDate: "2026-10-15",
        inspector: "Tester",
        rows: [
          {
            problem: "Tồn đọng tháng trước",
            location: "Xưởng",
            fiveS: "S1",
            shift: "1",
            countermeasure: "",
            countermeasureUpdatedBy: "",
            countermeasureUpdatedAt: "",
            dueDate: "",
            progress: "0",
            photoDataUrl: "",
            afterPhotoDataUrl: "",
          },
        ],
      },
    },
  };
  const dualRoleAccount = {
    id: "dual-an",
    name: "Mr An",
    employeeCode: "101",
    role: "at5s",
    at5sMemberId: "at5s-an",
    accessTypes: ["5s", "safety"],
    fiveSAreaIds: ["z1", "z2"],
  };

  // Dual-role CAN update countermeasure in Zone 1 (their managed zone)
  assert.doesNotThrow(() => {
    authService.assertFiveSFindingWriteAllowed(
      dualRoleRoot,
      dualRoleAccount,
      {
        operation: "update",
        path: "fiveSFindings/sheet-1",
        value: {
          ...dualRoleRoot.fiveSFindings["sheet-1"],
          rows: [
            {
              ...dualRoleRoot.fiveSFindings["sheet-1"].rows[0],
              countermeasure: "Quản lý Zone 1 tự cập nhật đối sách",
              countermeasureUpdatedBy: "dual-an",
              countermeasureUpdatedAt: "2026-11-04T08:00:00.000Z",
              progress: "75",
            },
          ],
        },
      }
    );
  }, "Dual-role AT5S + Zone 1 manager can update countermeasure in Zone 1");

  // Dual-role CANNOT update countermeasure in Zone 2 (managed by someone else) -> REJECTED (403)
  assert.throws(
    () => {
      authService.assertFiveSFindingWriteAllowed(
        dualRoleRoot,
        dualRoleAccount,
        {
          operation: "update",
          path: "fiveSFindings/sheet-z2",
          value: {
            ...dualRoleRoot.fiveSFindings["sheet-z2"],
            rows: [
              {
                ...dualRoleRoot.fiveSFindings["sheet-z2"].rows[0],
                countermeasure: "Sửa đối sách Zone 2 trái phép",
                countermeasureUpdatedBy: "dual-an",
                countermeasureUpdatedAt: "2026-11-04T08:00:00.000Z",
                progress: "100",
              },
            ],
          },
        }
      );
    },
    (err) => err.statusCode === 403 && err.message.includes("Chỉ người quản lý ở Zone đó và admin"),
    "Dual-role AT5S + Zone 1 manager MUST NOT update countermeasure in Zone 2"
  );

  // Dual-role CAN still edit issue details in Zone 2 (because they are AT5S)
  assert.doesNotThrow(() => {
    authService.assertFiveSFindingWriteAllowed(
      dualRoleRoot,
      dualRoleAccount,
      {
        operation: "update",
        path: "fiveSFindings/sheet-z2",
        value: {
          ...dualRoleRoot.fiveSFindings["sheet-z2"],
          rows: [
            {
              ...dualRoleRoot.fiveSFindings["sheet-z2"].rows[0],
              problem: "Cập nhật mô tả vấn đề Zone 2",
            },
          ],
        },
      }
    );
  }, "Dual-role AT5S + Zone 1 manager can edit issue description in Zone 2");

  // Dual-role CAN reply countermeasure on past unarchived period for Zone 1, but CANNOT change issue problem
  assert.doesNotThrow(() => {
    authService.assertFiveSFindingWriteAllowed(
      dualRoleRoot,
      dualRoleAccount,
      {
        operation: "update",
        path: "fiveSFindings/sheet-p0-z1",
        value: {
          ...dualRoleRoot.fiveSFindings["sheet-p0-z1"],
          rows: [
            {
              ...dualRoleRoot.fiveSFindings["sheet-p0-z1"].rows[0],
              countermeasure: "Đã khắc phục tồn đọng tháng 10",
              countermeasureUpdatedBy: "dual-an",
              countermeasureUpdatedAt: "2026-11-04T08:00:00.000Z",
              progress: "100",
            },
          ],
        },
      }
    );
  }, "Dual-role Zone 1 manager can update countermeasure on past unarchived period in Zone 1");

  assert.throws(
    () => {
      authService.assertFiveSFindingWriteAllowed(
        dualRoleRoot,
        dualRoleAccount,
        {
          operation: "update",
          path: "fiveSFindings/sheet-p0-z1",
          value: {
            ...dualRoleRoot.fiveSFindings["sheet-p0-z1"],
            rows: [
              {
                ...dualRoleRoot.fiveSFindings["sheet-p0-z1"].rows[0],
                problem: "Sửa đề mục kỳ cũ trái phép",
              },
            ],
          },
        }
      );
    },
    (err) => err.statusCode === 403,
    "Dual-role user cannot edit issue description on past unarchived period"
  );
});

test("5S Frontend Permissions: canManageFiveSFindingCountermeasure does not over-grant via getAllowedAreaIds and dual-role canEditSheet stays writable", () => {
  const appCode = fs.readFileSync(path.resolve("app.js"), "utf8");
  const pageCode = fs.readFileSync(path.resolve("modules/pages/five-s-findings-page.js"), "utf8");

  const funcMatch = /function canManageFiveSFindingCountermeasure\(sheet, account = currentUser\) \{([\s\S]*?)\n {2}\}/.exec(appCode);
  assert.ok(funcMatch, "canManageFiveSFindingCountermeasure must exist in app.js");
  assert.ok(
    !funcMatch[1].includes("getAllowedAreaIds("),
    "canManageFiveSFindingCountermeasure must NOT shortcut via getAllowedAreaIds (which grants assessor/at5s all zones)"
  );

  assert.match(
    pageCode,
    /if \(canManageFindingCountermeasure\(ctx, sheet\) && !isAssessorOrAt5s\) return false;/,
    "canEditSheet must allow dual-role AT5S/Assessor + Zone manager to edit issue details while keeping pure Zone managers countermeasure-only"
  );
});
