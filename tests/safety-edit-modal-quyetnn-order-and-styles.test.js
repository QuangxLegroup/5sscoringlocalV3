const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Safety Edit Modal: field order must strictly match Add Form sequence", () => {
  const code = fs.readFileSync(path.join(__dirname, "..", "modules/pages/mobile-prototype.js"), "utf8");
  const modalStart = code.indexOf('id = "mobileSafetyDetailModal";');
  const modalEnd = code.indexOf('document.body.appendChild(modal);', modalStart);
  assert.ok(modalStart > 0 && modalEnd > modalStart, "mobileSafetyDetailModal HTML block must exist");
  const modalHtml = code.slice(modalStart, modalEnd);

  // Field order verification:
  const zoneIdx = modalHtml.indexOf('id="modalDetailZone"');
  const issueDateIdx = modalHtml.indexOf('id="modalDetailIssueDateDisplay"');
  const noteIdx = modalHtml.indexOf('id="modalDetailNote"');
  const photo1Idx = modalHtml.indexOf('id="modalPhotoBox1"');
  const countIdx = modalHtml.indexOf('id="modalDetailIssueCount"');
  const stop6Idx = modalHtml.indexOf('id="modalDetailStop6"');
  const levelIdx = modalHtml.indexOf('id="modalDetailLevel"');
  const channelIdx = modalHtml.indexOf('id="modalDetailFoundChannel"');
  const statusIdx = modalHtml.indexOf('id="modalDetailStatus"');
  const foundByIdx = modalHtml.indexOf('id="modalDetailFoundBy"');
  const employeeCodeIdx = modalHtml.indexOf('id="modalDetailEmployeeCode"');
  const itemLabelIdx = modalHtml.indexOf('id="modalDetailIssueItemLabel"');
  const improvementIdx = modalHtml.indexOf('id="modalDetailImprovement"');
  const photo2Idx = modalHtml.indexOf('id="modalPhotoBox2"');
  const actionOwnerIdx = modalHtml.indexOf('id="modalDetailActionOwner"');
  const actionPlanIdx = modalHtml.indexOf('id="modalDetailActionPlan"');
  const completionDateIdx = modalHtml.indexOf('id="modalDetailCompletionDateDisplay"');

  // Verify all 12 rows are present
  assert.ok(zoneIdx > 0, "Zone field must exist");
  assert.ok(issueDateIdx > 0, "Issue Date field must exist");
  assert.ok(noteIdx > 0, "Hazard description field must exist");
  assert.ok(photo1Idx > 0, "Photo 1 box must exist");
  assert.ok(countIdx > 0, "Issue count field must exist");
  assert.ok(stop6Idx > 0, "STOP 6 field must exist");
  assert.ok(levelIdx > 0, "Level field must exist");
  assert.ok(channelIdx > 0, "Channel field must exist");
  assert.ok(statusIdx > 0, "Status field must exist");
  assert.ok(foundByIdx > 0, "Found by field must exist");
  assert.ok(employeeCodeIdx > 0, "Employee code field must exist");
  assert.ok(itemLabelIdx > 0, "Issue item label field must exist");
  assert.ok(improvementIdx > 0, "Improvement countermeasure field must exist");
  assert.ok(photo2Idx > 0, "Photo 2 box must exist");
  assert.ok(actionOwnerIdx > 0, "Action owner (PIC) field must exist");
  assert.ok(actionPlanIdx > 0, "Action plan field must exist");
  assert.ok(completionDateIdx > 0, "Completion date field must exist");

  // Verify strict ordering (Row 1 -> Row 12)
  assert.ok(zoneIdx < noteIdx, "Row 1 (Zone) must come before Row 2 (Mối nguy hiểm)");
  assert.ok(issueDateIdx < noteIdx, "Row 1 (Ngày phát hiện) must come before Row 2 (Mối nguy hiểm)");
  assert.ok(noteIdx < photo1Idx, "Row 2 (Mối nguy hiểm) must come before Row 3 (Ảnh hiện trường)");
  assert.ok(photo1Idx < countIdx, "Row 3 (Ảnh hiện trường) must come before Row 4 (Số lần phát hiện)");
  assert.ok(countIdx < stop6Idx, "Row 4 (Số lần) must come before Row 5 (STOP 6 & Cấp bậc)");
  assert.ok(stop6Idx < channelIdx, "Row 5 (STOP 6 & Cấp bậc) must come before Row 6 (Kênh & Tình trạng)");
  assert.ok(channelIdx < foundByIdx, "Row 6 (Kênh & Tình trạng) must come before Row 7 (Tên người phát hiện & Mã NV)");
  assert.ok(foundByIdx < itemLabelIdx, "Row 7 (Tên người & Mã NV) must come before Row 8 (Hạng mục)");
  assert.ok(itemLabelIdx < improvementIdx, "Row 8 (Hạng mục) must come before Row 9 (Đối sách cải tiến)");
  assert.ok(improvementIdx < photo2Idx, "Row 9 (Đối sách) must come before Row 10 (Ảnh sau cải tiến)");
  assert.ok(photo2Idx < actionOwnerIdx, "Row 10 (Ảnh sau cải tiến) must come before Row 11 (PIC & Kế hoạch)");
  assert.ok(actionOwnerIdx < completionDateIdx, "Row 11 (PIC & Kế hoạch) must come before Row 12 (Ngày dự kiến hoàn thành)");
});

test("Safety Edit Modal: calendar picker in light theme is never white on white", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
  
  // Calendar trigger icon in light theme must be dark slate (#475569)
  assert.match(
    css,
    /\.mobile-safety-detail-modal\.is-light-theme\s+[^}]*\.btn-calendar-trigger\s+i\s*\{[^}]*color:\s*#475569\s*!important/,
    "Calendar trigger icon must be #475569 in light theme"
  );
  
  // Modal form inputs in light theme must use color-scheme: light
  assert.match(
    css,
    /\.mobile-safety-detail-modal\.is-light-theme\s+[^}]*color-scheme:\s*light\s*!important/,
    "Inputs must specify color-scheme: light !important to avoid browser rendering white calendar indicators"
  );
});

test("Safety Edit Modal: editable fields have pure white background, disabled fields have gray background", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");

  // Editable fields have white background
  assert.match(
    css,
    /\.mobile-safety-detail-modal\.is-light-theme\s+\.modal-form-input:not\(:disabled\)[^{]*\{[^}]*background:\s*#ffffff\s*!important/,
    "Editable inputs in light mode must have background #ffffff !important"
  );
  assert.match(
    css,
    /\.mobile-safety-detail-modal\.is-light-theme\s+\.modal-form-textarea:not\(:disabled\)[^{]*\{[^}]*background:\s*#ffffff\s*!important/,
    "Editable textarea in light mode must have background #ffffff !important"
  );
  assert.match(
    css,
    /\.mobile-safety-detail-modal\.is-light-theme\s+\.modal-photo-upload-box\.is-editable\s*\{[^}]*background:\s*#ffffff\s*!important/,
    "Editable photo upload box in light mode must have background #ffffff !important"
  );

  // Disabled fields have soft gray background
  assert.match(
    css,
    /\.mobile-safety-detail-modal\.is-light-theme\s+\.modal-form-input:disabled[^{]*\{[^}]*background:\s*#f1f5f9\s*!important/,
    "Disabled inputs in light mode must have background #f1f5f9 !important"
  );
  assert.match(
    css,
    /\.mobile-safety-detail-modal\.is-light-theme\s+\.modal-photo-upload-box:not\(\.is-editable\)\s*\{[^}]*background:\s*#f1f5f9\s*!important/,
    "Non-editable photo upload box in light mode must have background #f1f5f9 !important"
  );
});
