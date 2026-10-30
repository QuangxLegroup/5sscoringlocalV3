const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("UserGuideContent PDF export functionality matches user guide view", async () => {
  const code = fs.readFileSync("modules/pages/user-guide-content.js", "utf8");

  const mockWindow = {
    crypto: {
      randomUUID: () => "test-uuid-1234",
    },
  };

  const context = vm.createContext({
    window: mockWindow,
    globalThis: mockWindow,
    URL: {
      createObjectURL: () => "blob:mock",
      revokeObjectURL: () => {},
    },
  });

  vm.runInContext(code, context);

  const guideApi = mockWindow.UserGuideContent;
  assert.ok(guideApi, "UserGuideContent is registered on window");
  assert.equal(typeof guideApi.getEffectiveGuides, "function", "getEffectiveGuides exists");
  assert.equal(typeof guideApi.normalize, "function", "normalize exists");
  assert.equal(typeof guideApi.buildGuidePdfHtml, "function", "buildGuidePdfHtml exists");
  assert.equal(typeof guideApi.exportPdf, "function", "exportPdf exists");
  assert.equal(typeof guideApi.normalizeAnnotations, "function", "normalizeAnnotations exists");

  // Test normalizeAnnotations
  const rawAnnotations = [
    { type: "circle", x: 0.5, y: 0.5, radius: 0.2 },
    { type: "rect", x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    { type: "arrow", x1: 0.1, y1: 0.1, x2: 0.8, y2: 0.8 },
  ];
  const normalized = guideApi.normalizeAnnotations(rawAnnotations);
  assert.equal(normalized.length, 3, "All 3 annotation types normalized");
  assert.equal(normalized[0].type, "circle");
  assert.equal(normalized[1].type, "rect");
  assert.equal(normalized[2].type, "arrow");

  // Test buildGuidePdfHtml matches mobile-user-guide exactly
  const section = { id: "safety", label: "Báo cáo an toàn" };
  const guide = {
    title: "Thêm vấn đề an toàn",
    intro: "Ghi nhận mối nguy, biện pháp xử lý và theo dõi báo cáo an toàn.",
    hint: "Kiểm tra kỳ đang chọn trước khi lưu.",
    adminNote: "Admin chọn kỳ An toàn đang mở.",
    steps: [
      {
        id: "step-1",
        title: "Chọn khu vực",
        body: "Chọn tab Báo cáo An toàn, sau đó chọn Khu vực (Zone).",
        renderedImageDataUrl: "data:image/jpeg;base64,mockdata",
      },
    ],
  };

  const html = guideApi.buildGuidePdfHtml({ section, guide });

  assert.ok(html.includes("<!doctype html>"), "Contains doctype");
  assert.ok(html.includes('<article class="mobile-user-guide">'), "Contains mobile-user-guide article");
  assert.ok(html.includes('<p class="mobile-user-guide-eyebrow">Báo cáo an toàn</p>'), "Contains eyebrow");
  assert.ok(html.includes("<h3>Thêm vấn đề an toàn</h3>"), "Contains guide title");
  assert.ok(html.includes('<p class="mobile-user-guide-intro">Ghi nhận mối nguy, biện pháp xử lý và theo dõi báo cáo an toàn.</p>'), "Contains intro");
  assert.ok(html.includes('<ol class="mobile-user-guide-steps">'), "Contains steps list");
  assert.ok(html.includes('<li class="mobile-user-guide-step">'), "Contains step item");
  assert.ok(html.includes("<h3>Chọn khu vực</h3>"), "Contains step title");
  assert.ok(html.includes("<p>Chọn tab Báo cáo An toàn, sau đó chọn Khu vực (Zone).</p>"), "Contains step body");
  assert.ok(html.includes('<img class="mobile-user-guide-image" src="data:image/jpeg;base64,mockdata"'), "Contains mobile-user-guide-image");
  assert.ok(html.includes('<aside class="mobile-user-guide-note"><strong>Lưu ý</strong><p>Kiểm tra kỳ đang chọn trước khi lưu.</p></aside>'), "Contains note");
  assert.ok(html.includes('<aside class="mobile-user-guide-admin"><strong>Thao tác quyền Admin</strong><p>Admin chọn kỳ An toàn đang mở.</p></aside>'), "Contains admin note");
  assert.ok(html.includes("window.print()"), "Contains auto print call");
  assert.ok(html.includes("@page"), "Contains print page setup");
});

test("UserGuideContent step editor supports reordering with drag handle and move buttons", () => {
  const code = fs.readFileSync("modules/pages/user-guide-content.js", "utf8");

  const mockWindow = {
    crypto: {
      randomUUID: () => "test-uuid-5678",
    },
  };

  const context = vm.createContext({
    window: mockWindow,
    globalThis: mockWindow,
  });

  vm.runInContext(code, context);

  const guideApi = mockWindow.UserGuideContent;
  assert.ok(guideApi, "UserGuideContent registered");

  // Step 1 of 3: isFirst = true, isLast = false
  const step0 = guideApi.renderStepEditor("safety", { id: "s1", title: "Bước 1" }, 0, 3);
  assert.ok(step0.includes('class="guide-step-drag-handle" draggable="true"'), "Step 0 has drag handle");
  assert.ok(step0.includes('data-guide-move-step="up" title="Di chuyển bước này lên trên" aria-label="Di chuyển lên trên" disabled'), "Step 0 up button is disabled");
  assert.ok(step0.includes('data-guide-move-step="down" title="Di chuyển bước này xuống dưới" aria-label="Di chuyển xuống dưới" >') || step0.includes('data-guide-move-step="down" title="Di chuyển bước này xuống dưới" aria-label="Di chuyển xuống dưới" '), "Step 0 down button exists");
  assert.ok(!step0.includes('data-guide-move-step="down" title="Di chuyển bước này xuống dưới" aria-label="Di chuyển xuống dưới" disabled'), "Step 0 down button is NOT disabled");

  // Step 2 of 3: isFirst = false, isLast = false
  const step1 = guideApi.renderStepEditor("safety", { id: "s2", title: "Bước 2" }, 1, 3);
  assert.ok(!step1.includes('data-guide-move-step="up" title="Di chuyển bước này lên trên" aria-label="Di chuyển lên trên" disabled'), "Step 1 up button is NOT disabled");
  assert.ok(!step1.includes('data-guide-move-step="down" title="Di chuyển bước này xuống dưới" aria-label="Di chuyển xuống dưới" disabled'), "Step 1 down button is NOT disabled");

  // Step 3 of 3: isFirst = false, isLast = true
  const step2 = guideApi.renderStepEditor("safety", { id: "s3", title: "Bước 3" }, 2, 3);
  assert.ok(!step2.includes('data-guide-move-step="up" title="Di chuyển bước này lên trên" aria-label="Di chuyển lên trên" disabled'), "Step 2 up button is NOT disabled");
  assert.ok(step2.includes('data-guide-move-step="down" title="Di chuyển bước này xuống dưới" aria-label="Di chuyển xuống dưới" disabled'), "Step 2 down button is disabled");
});

test("UserGuideContent normalizes text annotations with red, white, black and sizes", () => {
  const code = fs.readFileSync("modules/pages/user-guide-content.js", "utf8");

  const mockWindow = {
    crypto: { randomUUID: () => "test-uuid-999" },
  };

  const context = vm.createContext({
    window: mockWindow,
    globalThis: mockWindow,
  });

  vm.runInContext(code, context);
  const guideApi = mockWindow.UserGuideContent;

  const raw = [
    { type: "text", text: "Chữ màu đỏ", x: 0.1, y: 0.2, color: "red", size: "small" },
    { type: "text", text: "Chữ màu trắng", x: 0.3, y: 0.4, color: "white", size: "medium" },
    { type: "text", text: "Chữ màu đen", x: 0.5, y: 0.6, color: "black", size: "large" },
    { type: "text", text: "  Cần cắt khoảng trắng  ", x: 0.7, y: 0.8 },
    { type: "text", text: "" }, // empty text should be dropped
  ];

  const normalized = guideApi.normalizeAnnotations(raw);
  assert.equal(normalized.length, 4, "4 valid text annotations preserved");
  assert.equal(normalized[0].color, "red");
  assert.equal(normalized[0].size, "small");
  assert.equal(normalized[1].color, "white");
  assert.equal(normalized[1].size, "medium");
  assert.equal(normalized[2].color, "black");
  assert.equal(normalized[2].size, "large");
  assert.equal(normalized[3].text, "Cần cắt khoảng trắng");
  assert.equal(normalized[3].color, "red", "defaults to red");
  assert.equal(normalized[3].size, "medium", "defaults to medium");
});

test("UserGuideContent supports up to 3 images per step in editor and viewer", () => {
  const code = fs.readFileSync("modules/pages/user-guide-content.js", "utf8");

  const mockWindow = {
    crypto: { randomUUID: () => "test-uuid-multi" },
  };

  const context = vm.createContext({
    window: mockWindow,
    globalThis: mockWindow,
  });

  vm.runInContext(code, context);
  const guideApi = mockWindow.UserGuideContent;

  // Normalize step with 4 images -> should cap to 3
  const inputGuides = {
    safety: {
      steps: [
        {
          id: "step-multi",
          title: "Bước có 3 ảnh",
          body: "Hướng dẫn thực hiện",
          images: [
            { id: "img-1", imageUrl: "/api/photos/1.jpg", annotations: [{ type: "circle", x: 0.1, y: 0.1, radius: 0.05 }] },
            { id: "img-2", imageUrl: "/api/photos/2.jpg", annotations: [] },
            { id: "img-3", imageUrl: "/api/photos/3.jpg", annotations: [] },
            { id: "img-4", imageUrl: "/api/photos/4.jpg", annotations: [] },
          ],
        },
      ],
    },
  };

  const normalized = guideApi.normalize(inputGuides);
  const step = normalized.safety.steps[0];
  assert.equal(step.images.length, 3, "Images capped to maximum 3");
  assert.equal(step.imageUrl, "/api/photos/1.jpg", "Primary imageUrl set to first image");
  assert.equal(step.images[0].imageUrl, "/api/photos/1.jpg");
  assert.equal(step.images[1].imageUrl, "/api/photos/2.jpg");
  assert.equal(step.images[2].imageUrl, "/api/photos/3.jpg");

  // Editor renders counter and images
  const editorHtml = guideApi.renderStepEditor("safety", step, 0, 1);
  assert.ok(editorHtml.includes("3/3 ảnh"), "Counter shows 3/3 ảnh");
  assert.ok(editorHtml.includes('data-guide-add-image-wrap hidden'), "Add image wrap is hidden when 3 images");
  assert.ok(editorHtml.includes("Ảnh 1"), "Contains Ảnh 1 badge");
  assert.ok(editorHtml.includes("Ảnh 2"), "Contains Ảnh 2 badge");
  assert.ok(editorHtml.includes("Ảnh 3"), "Contains Ảnh 3 badge");

  // Viewer renders images grid
  const guideHtml = guideApi.renderGuide("safety", normalized);
  assert.ok(guideHtml.includes('class="mobile-user-guide-images-grid" data-count="3"'), "Viewer renders images grid with count 3");
  assert.ok(guideHtml.includes('/api/photos/1.jpg'), "Viewer has img 1");
  assert.ok(guideHtml.includes('/api/photos/2.jpg'), "Viewer has img 2");
  assert.ok(guideHtml.includes('/api/photos/3.jpg'), "Viewer has img 3");
});

test("app.js guide setup form save does not reference undeclared isGuideDirty", () => {
  const appJs = fs.readFileSync("app.js", "utf8");
  assert.equal(appJs.includes("isGuideDirty"), false, "isGuideDirty should not exist anywhere in app.js");
});

test("CSS and annotator allow text tool clicks and show popover on top", () => {
  const css = fs.readFileSync("styles.css", "utf8");
  assert.ok(
    css.includes(".image-annotation-overlay.is-text-mode") &&
    css.includes("pointer-events: auto"),
    "is-text-mode must have pointer-events: auto"
  );
  assert.ok(
    css.includes(".image-annotation-text-popover") &&
    css.includes("z-index: 210000 !important"),
    "Text popover must have z-index above modal backdrop"
  );
  const annotatorJs = fs.readFileSync("modules/core/image-circle-annotator.js", "utf8");
  assert.ok(
    annotatorJs.includes('activeOverlay?.classList.contains("is-text-mode")'),
    "mountImageViewerInteractions bypasses gesture during text mode"
  );
});




