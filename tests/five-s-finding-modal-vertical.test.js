const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("5S Finding modal: vertical layout and field order requirements", () => {
  const code = fs.readFileSync(path.join(__dirname, "..", "modules", "pages", "five-s-findings-page.js"), "utf8");

  const modalCode = code.slice(code.indexOf("function openIssueModal("));

  // 1. Kiểm tra layout dạng hàng dọc: .findings-vertical-form
  assert.ok(
    modalCode.includes('class="findings-vertical-form"'),
    "five-s-findings-page.js must use .findings-vertical-form instead of horizontal table"
  );
  assert.ok(
    !modalCode.includes('class="safety-record-entry-table findings-issue-entry-table"'),
    "Horizontal scrollable entry table must be removed from finding modal"
  );

  // 2. Kiểm tra thứ tự các trường:
  // - Đầu tiên là Zone (có dấu * màu đỏ)
  // - Tiếp theo là Vấn đề (có dấu * màu đỏ)
  // - Ảnh sau xử lý đặt ngay sau Biện pháp khắc phục

  const zoneIdx = modalCode.indexOf('Zone <span class="required-star">*</span>');
  const problemIdx = modalCode.indexOf('Vấn đề <span class="required-star">*</span>');
  const beforePhotoIdx = modalCode.indexOf('Ảnh vấn đề');
  const locationIdx = modalCode.indexOf('Vị trí');
  const inspectionDateIdx = modalCode.indexOf('Ngày kiểm tra');
  const countermeasureIdx = modalCode.indexOf('Biện pháp khắc phục');
  const afterPhotoIdx = modalCode.indexOf('Ảnh sau xử lý');
  const dueDateIdx = modalCode.indexOf('Hạn hoàn thành');
  const progressIdx = modalCode.indexOf('Tiến độ');

  assert.ok(zoneIdx > 0, "Zone label with red * required indicator must exist");
  assert.ok(problemIdx > 0, "Problem (Vấn đề) label with red * required indicator must exist");
  assert.ok(zoneIdx < problemIdx, "Zone must come BEFORE Vấn đề");
  assert.ok(problemIdx < beforePhotoIdx, "Vấn đề must come BEFORE Ảnh vấn đề");
  assert.ok(beforePhotoIdx < locationIdx, "Ảnh vấn đề must come BEFORE Vị trí");
  assert.ok(locationIdx < inspectionDateIdx, "Vị trí must come BEFORE Ngày kiểm tra");
  assert.ok(inspectionDateIdx < countermeasureIdx, "Ngày kiểm tra must come BEFORE Biện pháp khắc phục");
  assert.ok(countermeasureIdx < afterPhotoIdx, "Biện pháp khắc phục must come directly BEFORE Ảnh sau xử lý");
  assert.ok(afterPhotoIdx < dueDateIdx, "Ảnh sau xử lý must come BEFORE Hạn hoàn thành");
  assert.ok(dueDateIdx < progressIdx, "Hạn hoàn thành must come BEFORE Tiến độ");

  // 3. Kiểm tra CSS cho vertical form và modal width
  const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
  assert.ok(css.includes(".findings-vertical-form"), "styles.css must style .findings-vertical-form");
  assert.ok(css.includes(".modal-card.findings-issue-modal"), "styles.css must define .modal-card.findings-issue-modal");
  assert.ok(css.includes(".required-star"), "styles.css must style .required-star with red color");

  // 4. Kiểm tra form Vấn đề 5S trên Mobile (renderMobile):
  // - Đổi "Hình ảnh minh họa hiện trường" thành "Ảnh vấn đề" và đặt ngay dưới "Vấn đề 5S *" (key === "problem")
  // - Thêm "Ảnh sau cải tiến, xử lý" ngay dưới "Biện pháp khắc phục" (key === "countermeasure")
  const mobileCode = code.slice(code.indexOf("function renderMobile("), code.indexOf("function openIssueModal("));
  assert.ok(
    !mobileCode.includes("Hình ảnh minh họa hiện trường"),
    "renderMobile must not use old label 'Hình ảnh minh họa hiện trường'"
  );
  const mobileProblemBranchIdx = mobileCode.indexOf('if (key === "problem")');
  const mobileBeforePhotoIdx = mobileCode.indexOf("<span>Ảnh vấn đề</span>");
  const mobileCountermeasureBranchIdx = mobileCode.indexOf('if (key === "countermeasure")');
  const mobileAfterPhotoIdx = mobileCode.indexOf("<span>Ảnh sau cải tiến, xử lý</span>");
  assert.ok(mobileProblemBranchIdx > 0 && mobileBeforePhotoIdx > mobileProblemBranchIdx, "Ảnh vấn đề must be rendered right under Vấn đề 5S *");
  assert.ok(mobileCountermeasureBranchIdx > mobileBeforePhotoIdx && mobileAfterPhotoIdx > mobileCountermeasureBranchIdx, "Ảnh sau cải tiến, xử lý must be rendered right under Biện pháp khắc phục");
  assert.ok(mobileCode.includes('photoField: "afterPhotoDataUrl"'), "renderMobile must bind afterPhotoDataUrl editor");

  // 5. Kiểm tra tô xám các mục không có quyền nhập & ẩn hoàn toàn native file input khi disabled
  assert.ok(
    code.includes('${editing ? "is-editable" : "is-disabled"}'),
    "photoEditorWidget must mark disabled photo boxes with .is-disabled"
  );
  assert.match(
    css,
    /\.photo-file-input:disabled[\s\S]*?opacity:\s*0\s*!important/,
    "styles.css must keep .photo-file-input:disabled hidden with opacity: 0 !important"
  );
  assert.match(
    css,
    /background-color:\s*#e8eef5\s*!important/,
    "styles.css must gray out disabled inputs/textareas/selects in light mode to match Tiến độ"
  );
  assert.match(
    css,
    /\.photo-upload-box\.is-disabled[\s\S]*?background:\s*#e8eef5\s*!important/,
    "styles.css must gray out disabled photo upload boxes in light mode"
  );

  const mobileProtoCode = fs.readFileSync(path.join(__dirname, "..", "modules", "pages", "mobile-prototype.js"), "utf8");
  assert.ok(
    mobileProtoCode.includes("safetyCountermeasureLockedAttr"),
    "mobile-prototype.js must lock safety countermeasure fields when user lacks countermeasure permission"
  );

  const appCode = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  assert.ok(
    appCode.includes("const canEditCountermeasure ="),
    "app.js openSafetyRecordForm must check canEditCountermeasure and disable countermeasure fields accordingly"
  );
});
