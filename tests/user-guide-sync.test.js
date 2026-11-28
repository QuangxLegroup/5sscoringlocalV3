const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("UserGuideContent normalization is deterministic across repeated calls", () => {
  const code = fs.readFileSync("modules/pages/user-guide-content.js", "utf8");
  const mockWindow = {
    crypto: {
      randomUUID: () => "mock-uuid",
    },
  };
  const context = vm.createContext({
    window: mockWindow,
    globalThis: mockWindow,
  });
  vm.runInContext(code, context);

  const guideApi = mockWindow.UserGuideContent;
  const inputGuides = {
    safety: {
      title: "Hướng dẫn đánh giá an toàn",
      steps: [
        {
          title: "Bước 1",
          body: "Chụp ảnh hiện trường",
          imageUrl: "/api/photos/view?path=huong-dan/10-2026/img1.jpg",
          images: [
            { imageUrl: "/api/photos/view?path=huong-dan/10-2026/img1.jpg", annotations: [{ type: "circle", x: 0.5, y: 0.5, radius: 0.2 }] }
          ]
        }
      ]
    }
  };

  const norm1 = guideApi.normalize(inputGuides);
  const norm2 = guideApi.normalize(inputGuides);

  // Must produce identical JSON (deterministic, no random UUIDs generated)
  assert.equal(JSON.stringify(norm1), JSON.stringify(norm2), "Normalization must be deterministic");
  assert.equal(norm1.safety.steps[0].id, "safety-1", "Step ID should be deterministic");
  assert.equal(norm1.safety.steps[0].images[0].id, "img-1", "Image ID should be deterministic");
});

test("app.js renders guide draft banner and provides clear draft action", () => {
  const appJs = fs.readFileSync("app.js", "utf8");
  assert.ok(appJs.includes("guide-draft-banner"), "app.js must render .guide-draft-banner");
  assert.ok(appJs.includes("data-guide-clear-draft"), "app.js must wire data-guide-clear-draft");
  assert.ok(appJs.includes("openUserGuideViewerModal"), "app.js must implement openUserGuideViewerModal");
  assert.ok(!appJs.includes("data-guide-preview"), "guide setup must remove preview button as requested");
  assert.ok(appJs.includes("header-guide-btn"), "app.js must wire header-guide-btn");
  assert.ok(appJs.includes("flushOfflineQueue"), "app.js must flush offline queue upon saving user guides");
});

test("index.html exposes user guide buttons for desktop users", () => {
  const html = fs.readFileSync("index.html", "utf8");
  assert.ok(html.includes("header-guide-btn"), "index.html must have header-guide-btn");
  assert.ok(!html.includes("guide-view-menu-item"), "index.html must remove guide-view-menu-item as requested");
  assert.ok(html.includes('data-action="view-user-guide"'), "index.html must have data-action='view-user-guide'");
});

test("styles.css includes styling for header-guide-btn and user-guide-viewer", () => {
  const css = fs.readFileSync("styles.css", "utf8");
  assert.ok(css.includes(".header-guide-btn"), "styles.css must have .header-guide-btn");
  assert.ok(css.includes(".user-guide-viewer-card"), "styles.css must have .user-guide-viewer-card");
  assert.ok(css.includes(".guide-draft-banner"), "styles.css must have .guide-draft-banner");
  assert.ok(css.includes(".guide-viewer-tabs"), "styles.css must have .guide-viewer-tabs");
  assert.match(css, /\.guide-viewer-tabs\s*\{[^}]*flex-shrink:\s*0/, ".guide-viewer-tabs must have flex-shrink: 0 to prevent vertical squishing");
  assert.match(css, /\.guide-viewer-tabs\s*\{[^}]*min-height:/, ".guide-viewer-tabs must have min-height to ensure tab buttons remain fully visible");
  assert.match(css, /\.user-guide-viewer-body\s*\{[^}]*min-height:\s*0/, ".user-guide-viewer-body must have min-height: 0 so flexbox allows internal scrolling");
});

test("admin-home-page.js opens desktop user guide viewer modal directly from home so closing returns to home", () => {
  const homeJs = fs.readFileSync("modules/pages/admin-home-page.js", "utf8");
  const guideBlock = homeJs.slice(homeJs.indexOf("#cyberHomeGuideBtn"), homeJs.indexOf("#cyberNavLinks"));
  assert.ok(guideBlock.includes("openUserGuideViewerModal"), "Home guide button must call openUserGuideViewerModal");
  assert.ok(!guideBlock.includes("openMobilePrototype"), "Home guide button must NOT launch Mobile Prototype");
});
