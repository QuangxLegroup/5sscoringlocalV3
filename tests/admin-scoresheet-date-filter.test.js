const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

test('Admin score sheet date filter defaults to "Trung bình tháng" and disabled for assessor & self', () => {
  const appJs = fs.readFileSync('app.js', 'utf8');
  const indexHtml = fs.readFileSync('index.html', 'utf8');
  const stylesCss = fs.readFileSync('styles.css', 'utf8');

  // Verify app.js logic
  assert.ok(
    appJs.includes('elements.adminScoreSheetDate.disabled = true;'),
    'Disables date select when not multi-day (assessor & self)'
  );
  assert.ok(
    appJs.includes('elements.adminScoreSheetDate.innerHTML = \'<option value="" selected>Trung bình tháng</option>\';'),
    'Sets default option to "Trung bình tháng" when not multi-day'
  );
  assert.ok(
    appJs.includes('elements.adminScoreSheetDate.disabled = false;'),
    'Enables date select when multi-day (at5s & departmentHead)'
  );

  // Verify index.html
  assert.ok(
    indexHtml.includes('<label id="admin-score-sheet-date-field">'),
    'admin-score-sheet-date-field is present without hidden attribute'
  );
  assert.ok(
    indexHtml.includes('<option value="" selected>Trung bình tháng</option>'),
    'Default selected option is Trung bình tháng in HTML'
  );

  // Verify styles.css
  assert.ok(
    stylesCss.includes('#admin-score-sheet-date:disabled'),
    'Has dedicated disabled styles for #admin-score-sheet-date'
  );
  assert.ok(
    stylesCss.includes('align-items: start !important;'),
    'Mobile multiday bar aligns to start to prevent vertical misalignment'
  );
});
