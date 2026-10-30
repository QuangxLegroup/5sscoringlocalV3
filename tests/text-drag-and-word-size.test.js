const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("Image annotator and user guide support Word numeric font sizes", () => {
  const code = fs.readFileSync("modules/core/image-circle-annotator.js", "utf8");

  const mockWindow = {
    crypto: { randomUUID: () => "test-uuid" },
    document: {
      createElementNS: () => ({ setAttribute: () => {}, classList: { add: () => {} } }),
      querySelectorAll: () => [],
    },
  };

  const context = vm.createContext({
    window: mockWindow,
    globalThis: mockWindow,
    document: mockWindow.document,
  });

  vm.runInContext(code, context);

  const normalize = mockWindow.normalizeAnnotations;
  assert.equal(typeof normalize, "function", "normalizeAnnotations exists");

  // Numeric sizes like Word
  const items = [
    { type: "text", text: "Size 14", x: 0.1, y: 0.2, size: 14 },
    { type: "text", text: "Size 24", x: 0.3, y: 0.4, size: 24 },
    { type: "text", text: "Size 36", x: 0.5, y: 0.6, size: 36 },
    { type: "text", text: "Legacy Small", x: 0.7, y: 0.8, size: "small" },
  ];

  const norm = normalize(items);
  assert.equal(norm.length, 4, "4 items normalized");
  assert.equal(norm[0].size, 14, "Numeric size 14 preserved");
  assert.equal(norm[1].size, 24, "Numeric size 24 preserved");
  assert.equal(norm[2].size, 36, "Numeric size 36 preserved");
  assert.equal(norm[3].size, "small", "Legacy size preserved");
});

test("Image annotator HTML contains Word numeric font size controls instead of words", () => {
  const code = fs.readFileSync("modules/core/image-circle-annotator.js", "utf8");

  // Secondary toolbar has Word font sizes
  assert.ok(code.includes("data-toolbar-size-select"), "Toolbar has size select dropdown");
  assert.ok(code.includes("data-toolbar-size-step"), "Toolbar has font size stepper buttons");
  assert.ok(code.includes('data-toolbar-size="14"'), "Toolbar has numeric quick button 14");
  assert.ok(code.includes('data-toolbar-size="18"'), "Toolbar has numeric quick button 18");
  assert.ok(code.includes('data-toolbar-size="24"'), "Toolbar has numeric quick button 24");
  assert.ok(code.includes('data-toolbar-size="32"'), "Toolbar has numeric quick button 32");

  // Popover has Word font sizes
  assert.ok(code.includes("popover-size-select"), "Popover has Word font size select");
  assert.ok(code.includes("data-popover-step"), "Popover has font size stepper");

  // Hitbox and dragging
  assert.ok(code.includes("text-drag-hitbox"), "SVG text element has drag hitbox");
  assert.ok(code.includes("is-text-dragging"), "Overlay has is-text-dragging state");
});

test("CSS contains styles for text drag and Word numeric font size controls", () => {
  const css = fs.readFileSync("styles.css", "utf8");

  assert.ok(css.includes(".image-annotation-overlay.is-text-dragging"), "CSS handles dragging overlay");
  assert.ok(css.includes(".image-annotation-text-group .text-drag-hitbox"), "CSS styles hitbox");
  assert.ok(css.includes(".image-annotation-size-stepper"), "CSS styles toolbar size stepper");
  assert.ok(css.includes(".image-annotation-size-select"), "CSS styles toolbar size select");
  assert.ok(css.includes(".popover-size-stepper"), "CSS styles popover stepper");
});
