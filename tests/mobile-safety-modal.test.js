const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("mobile safety edit modal aligns in position and form design with 5S findings modal", () => {
  const css = fs.readFileSync("styles.css", "utf8");
  const mobileJs = fs.readFileSync("modules/pages/mobile-prototype.js", "utf8");

  // 1. Centered position and card shape
  assert.match(
    css,
    /\.mobile-safety-detail-modal\s*\{[^}]*align-items:\s*center/,
    "modal must be centered vertically like 5S modal"
  );
  assert.match(
    css,
    /\.mobile-safety-detail-modal\s*\{[^}]*justify-content:\s*center/,
    "modal must be centered horizontally like 5S modal"
  );
  assert.match(
    css,
    /\.detail-modal-content\s*\{[^}]*width:\s*min\(520px/,
    "detail-modal-content must use 520px max width like 5S modal"
  );
  assert.match(
    css,
    /\.detail-modal-content\s*\{[^}]*border-radius:\s*14px/,
    "detail-modal-content must have rounded corners on all 4 sides"
  );

  // 2. Header and close button
  assert.match(
    css,
    /\.btn-close-modal\s*\{[^}]*background:\s*#ffffff/,
    "close button must have white background like 5S modal"
  );
  assert.match(
    css,
    /\.btn-close-modal\s*\{[^}]*border-radius:\s*8px/,
    "close button must have 8px border radius"
  );

  // 3. Form fields and labels
  assert.match(
    css,
    /\.modal-form-label\s*\{[^}]*text-transform:\s*none/,
    "modal-form-label must not be uppercase"
  );
  assert.match(
    css,
    /\.modal-form-input,\s*\.modal-form-select,\s*\.modal-form-textarea\s*\{[^}]*background:\s*#020617/,
    "input fields must have dark slate background matching 5S form"
  );

  // 4. Footer action buttons
  assert.match(
    css,
    /\.detail-modal-footer\s*\{[^}]*display:\s*flex/,
    "detail-modal-footer must use flex row layout"
  );
  assert.match(
    css,
    /\.btn-detail-delete\s*\{[^}]*background:\s*#dc2626/,
    "delete button must be red #dc2626"
  );
  assert.match(
    css,
    /\.btn-detail-save\s*\{[^}]*background:\s*#0284c7/,
    "save button must be vibrant blue #0284c7"
  );

  // 5. HTML template in mobile-prototype.js
  assert.ok(
    mobileJs.includes('class="btn-detail-delete" id="btnDetailDelete">\r\n            XÓA BÁO CÁO') ||
    mobileJs.includes('class="btn-detail-delete" id="btnDetailDelete">\n            XÓA BÁO CÁO'),
    "delete button text must be clean uppercase XÓA BÁO CÁO"
  );
  assert.ok(
    mobileJs.includes('class="btn-detail-save" id="btnDetailSave">\r\n            LƯU THAY ĐỔI') ||
    mobileJs.includes('class="btn-detail-save" id="btnDetailSave">\n            LƯU THAY ĐỔI'),
    "save button text must be clean uppercase LƯU THAY ĐỔI"
  );
});
