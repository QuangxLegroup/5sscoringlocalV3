const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Safety modal: vertical layout and field order requirements", () => {
  const code = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const modalCode = code.slice(code.indexOf('title: isNew ? "Thêm báo cáo đánh giá an toàn"'));

  // 1. Kiểm tra layout dạng hàng dọc: .safety-vertical-form
  assert.ok(
    modalCode.includes('class=\\"safety-vertical-form\\"'),
    "app.js must use .safety-vertical-form instead of horizontal table"
  );
  assert.ok(
    !modalCode.includes('class=\\"safety-record-entry-table\\"'),
    "Horizontal scrollable entry table must be removed from safety record modal"
  );

  // 2. Kiểm tra thứ tự các trường:
  // - Đầu tiên là Zone (có dấu * màu đỏ)
  // - Tiếp theo là Mối nguy hiểm phát hiện được (có dấu * màu đỏ)
  // - Ảnh minh họa (Hiện trường)
  // - Ngày phát hiện (có dấu * màu đỏ)
  // - Nội dung cải tiến, xử lý
  // - Ảnh sau cải tiến, xử lý (đặt ngay sau nội dung cải tiến)

  const zoneIdx = modalCode.indexOf('Zone <span class=\\"required-star\\">*</span>');
  const noteIdx = modalCode.indexOf('Mối nguy hiểm phát hiện được <span class=\\"required-star\\">*</span>');
  const photoIdx = modalCode.indexOf('Ảnh minh họa (Hiện trường)');
  const issueDateIdx = modalCode.indexOf('Ngày phát hiện <span class=\\"required-star\\">*</span>');
  const countIdx = modalCode.indexOf('Số lần phát hiện');
  const stop6Idx = modalCode.indexOf('STOP 6');
  const improvementIdx = modalCode.indexOf('Nội dung cải tiến, xử lý');
  const afterPhotoIdx = modalCode.indexOf('Ảnh sau cải tiến, xử lý');
  const completionDateIdx = modalCode.indexOf('Ngày dự kiến hoàn thành');

  assert.ok(zoneIdx > 0, "Zone label with red * required indicator must exist");
  assert.ok(noteIdx > 0, "Mối nguy hiểm label with red * required indicator must exist");
  assert.ok(issueDateIdx > 0, "Ngày phát hiện label with red * required indicator must exist");

  assert.ok(zoneIdx < noteIdx, "Zone must come BEFORE Mối nguy hiểm");
  assert.ok(noteIdx < photoIdx, "Mối nguy hiểm must come BEFORE Ảnh minh họa");
  assert.ok(photoIdx < issueDateIdx, "Ảnh minh họa must come BEFORE Ngày phát hiện");
  assert.ok(issueDateIdx < countIdx, "Ngày phát hiện must come BEFORE Số lần phát hiện");
  assert.ok(countIdx < stop6Idx, "Số lần phát hiện must come BEFORE STOP 6");
  assert.ok(stop6Idx < improvementIdx, "STOP 6 must come BEFORE Nội dung cải tiến, xử lý");
  assert.ok(improvementIdx < afterPhotoIdx, "Nội dung cải tiến must come directly BEFORE Ảnh sau cải tiến, xử lý");
  assert.ok(afterPhotoIdx < completionDateIdx, "Ảnh sau cải tiến must come BEFORE Ngày dự kiến hoàn thành");

  // 3. Kiểm tra CSS cho safety vertical form và modal width
  const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
  assert.ok(css.includes(".safety-vertical-form"), "styles.css must style .safety-vertical-form");
  assert.ok(css.includes(".modal-card.safety-record-modal"), "styles.css must define .modal-card.safety-record-modal");
});
