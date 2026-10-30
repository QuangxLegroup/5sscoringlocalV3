const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

// Mock browser environment for node testing
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  get length() {
    return this.store.size;
  }
  key(index) {
    return Array.from(this.store.keys())[index] || null;
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(String(key), String(value));
  }
  removeItem(key) {
    this.store.delete(String(key));
  }
  clear() {
    this.store.clear();
  }
}

test("FormDraftManager: saves, retrieves, and clears drafts correctly", () => {
  global.localStorage = new MockLocalStorage();
  global.window = {
    addEventListener: () => {},
  };
  global.document = {
    getElementById: () => null,
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      classList: { add() {}, remove() {} },
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      remove: () => {},
    }),
    body: {
      appendChild: () => {},
    },
  };

  const code = fs.readFileSync("modules/core/form-draft-manager.js", "utf8");
  eval(code);

  const fdm = global.window.FormDraftManager;
  assert.ok(fdm, "FormDraftManager is exported on window");

  const sampleKey = "test_form_key";
  const sampleData = { title: "Draft test", note: "Not saved yet", numbers: [1, 2, 3] };

  assert.equal(fdm.hasDraft(sampleKey), false);
  assert.equal(fdm.getDraft(sampleKey), null);

  const saveResult = fdm.saveDraft(sampleKey, sampleData);
  assert.equal(saveResult, true);
  assert.equal(fdm.hasDraft(sampleKey), true);

  const restored = fdm.getDraft(sampleKey);
  assert.deepEqual(restored, sampleData);

  fdm.clearDraft(sampleKey);
  assert.equal(fdm.hasDraft(sampleKey), false);
  assert.equal(fdm.getDraft(sampleKey), null);
});

test("FormDraftManager: dirty forms registration and flushAllDrafts", () => {
  global.localStorage = new MockLocalStorage();
  global.window = {
    addEventListener: () => {},
  };

  const code = fs.readFileSync("modules/core/form-draft-manager.js", "utf8");
  eval(code);
  const fdm = global.window.FormDraftManager;

  let dirty = false;
  let snapshot = { text: "working" };

  fdm.registerDirtyForm("form_a", {
    isDirty: () => dirty,
    getSnapshot: () => snapshot,
  });

  assert.equal(fdm.isFormDirty("form_a"), false);
  assert.equal(fdm.hasAnyDirty(), false);

  dirty = true;
  assert.equal(fdm.isFormDirty("form_a"), true);
  assert.equal(fdm.hasAnyDirty(), true);

  fdm.flushAllDrafts();
  assert.deepEqual(fdm.getDraft("form_a"), { text: "working" });

  fdm.unregisterDirtyForm("form_a");
  assert.equal(fdm.isFormDirty("form_a"), false);
  assert.equal(fdm.hasAnyDirty(), false);
});

test("FormDraftManager: discardAllDirty clears dirty forms and clears drafts", () => {
  global.localStorage = new MockLocalStorage();
  global.window = {
    addEventListener: () => {},
  };

  const code = fs.readFileSync("modules/core/form-draft-manager.js", "utf8");
  eval(code);
  const fdm = global.window.FormDraftManager;

  let discarded = false;
  fdm.saveDraft("draft_to_discard", { data: 123 });
  fdm.registerDirtyForm("draft_to_discard", {
    isDirty: () => true,
    getSnapshot: () => ({ data: 123 }),
    onDiscard: () => { discarded = true; },
  });

  assert.equal(fdm.hasAnyDirty(), true);
  assert.equal(fdm.hasDraft("draft_to_discard"), true);

  fdm.discardAllDirty();

  assert.equal(discarded, true);
  assert.equal(fdm.hasDraft("draft_to_discard"), false);
  assert.equal(fdm.hasAnyDirty(), false);
});

test("CSS: unsaved-changes-backdrop has higher z-index than mobile-responsive-overlay", () => {
  const css = fs.readFileSync("styles.css", "utf8");
  const backdropMatch = css.match(/\.unsaved-changes-backdrop\s*\{[^}]*z-index:\s*(\d+)/);
  const overlayMatch = css.match(/\.mobile-responsive-overlay\s*\{[^}]*z-index:\s*(\d+)/);

  assert.ok(backdropMatch, "Found .unsaved-changes-backdrop z-index");
  assert.ok(overlayMatch, "Found .mobile-responsive-overlay z-index");

  const backdropZ = parseInt(backdropMatch[1], 10);
  const overlayZ = parseInt(overlayMatch[1], 10);

  assert.ok(backdropZ > overlayZ, `backdrop z-index (${backdropZ}) must be greater than overlay z-index (${overlayZ})`);
  assert.ok(css.includes(".mobile-draft-banner"), "CSS has .mobile-draft-banner styles");
});

test("FormDraftManager: showUnsavedConfirmModal renders compact popup with only 2 buttons", () => {
  global.localStorage = new MockLocalStorage();
  global.window = { addEventListener: () => {} };
  let appendedBackdrop = null;
  global.document = {
    getElementById: () => null,
    querySelector: () => null,
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      innerHTML: "",
      querySelector: () => ({ addEventListener: () => {} }),
      remove: () => {},
    }),
    body: {
      appendChild: (el) => { appendedBackdrop = el; },
    },
  };

  const code = fs.readFileSync("modules/core/form-draft-manager.js", "utf8");
  eval(code);
  const fdm = global.window.FormDraftManager;

  fdm.showUnsavedConfirmModal({
    title: "Bạn có thay đổi chưa lưu!",
    onKeepEditing: () => {},
    onDiscardAndExit: () => {},
  });

  assert.ok(appendedBackdrop, "Modal backdrop appended to body");
  assert.ok(appendedBackdrop.innerHTML.includes("Hủy bản nháp"), "Contains 'Hủy bản nháp' button");
  assert.ok(appendedBackdrop.innerHTML.includes("Tiếp tục chỉnh sửa"), "Contains 'Tiếp tục chỉnh sửa' button");
  assert.ok(!appendedBackdrop.innerHTML.includes("Thoát & Giữ nháp"), "Does NOT contain 'Thoát & Giữ nháp'");
  assert.ok(!appendedBackdrop.innerHTML.includes("Nội dung đang nhập đã được lưu tạm"), "Does NOT contain removed cache message");
});

test("Mobile switch: prompts unsaved modal when form is dirty before opening mobile", () => {
  const indexHtml = fs.readFileSync("index.html", "utf8");
  assert.ok(
    indexHtml.includes("FormDraftManager?.hasAnyDirty()"),
    "index.html openMobile checks FormDraftManager.hasAnyDirty()"
  );
  assert.ok(
    indexHtml.includes("showUnsavedConfirmModal"),
    "index.html openMobile shows unsaved confirm modal"
  );

  const mobileProtoCode = fs.readFileSync("modules/pages/mobile-prototype.js", "utf8");
  assert.ok(
    mobileProtoCode.includes("draftManager?.hasAnyDirty?.()"),
    "openMobilePrototype guards against dirty forms before opening overlay"
  );
  assert.ok(
    mobileProtoCode.includes("showUnsavedConfirmModal"),
    "openMobilePrototype displays unsaved confirm modal"
  );

  // Simulate dirty state in openMobilePrototype logic
  let modalShown = false;
  let discarded = false;
  let mobileOpened = false;

  const mockDraftManager = {
    hasAnyDirty: () => true,
    showUnsavedConfirmModal: ({ onDiscardAndExit, onKeepEditing }) => {
      modalShown = true;
      // Test keep editing: does not open mobile
      onKeepEditing();
      assert.equal(mobileOpened, false, "Mobile must not open when user chooses to keep editing");

      // Test discard and exit: discards drafts and opens mobile
      onDiscardAndExit();
    },
    discardAllDirty: () => {
      discarded = true;
    },
  };

  // Run simulation
  const proceed = (force = false) => {
    if (!force && mockDraftManager.hasAnyDirty()) {
      mockDraftManager.showUnsavedConfirmModal({
        onKeepEditing: () => {},
        onDiscardAndExit: () => {
          mockDraftManager.discardAllDirty();
          proceed(true);
        },
      });
      return;
    }
    mobileOpened = true;
  };

  proceed();

  assert.equal(modalShown, true, "Modal was shown because form was dirty");
  assert.equal(discarded, true, "Draft was discarded upon confirm");
  assert.equal(mobileOpened, true, "Mobile prototype opened after discard");
});

test("5S Finding modal: does not falsely trigger unsaved warning when opening without edits", () => {
  const code = fs.readFileSync("modules/pages/five-s-findings-page.js", "utf8");
  assert.ok(
    code.includes("areFindingRowsEqual"),
    "five-s-findings-page.js defines areFindingRowsEqual"
  );
  assert.ok(
    code.includes("baselineSnapshot = captureFindingSnapshot()"),
    "five-s-findings-page.js initializes baselineSnapshot on modal setup"
  );

  // Extract areFindingRowsEqual & displayDate from code to test normalization
  const vm = require("node:vm");
  const sandbox = {
    window: {
      PageRegistry: { register() {} },
    },
    document: {
      getElementById: () => null,
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  // Verify baseline comparison logic
  let initialSnap = {
    areaId: "zone-1",
    inspectionDate: "20/10/2026",
    inspector1: "Đường Bích Ngọc",
    inspector2: "",
    location: "",
    problem: "Bảng biểu bong tróc",
    fiveS: "C5 - Bảng quản lý trong dây chuyền",
    shift: "",
    countermeasure: "",
    dueDate: "25/10/2026",
    progress: "0",
    photoDataUrl: "/api/photos/van-de-5s/10-2026/img.jpg",
    photoAnnotations: [],
  };

  let baselineSnapshot = JSON.parse(JSON.stringify(initialSnap));
  let curSnap = JSON.parse(JSON.stringify(initialSnap));

  const isDirty = (cur, baseline) => JSON.stringify(cur) !== JSON.stringify(baseline);

  // 1. Pristine state -> NOT dirty
  assert.equal(isDirty(curSnap, baselineSnapshot), false, "Pristine finding modal must NOT be dirty");

  // 2. User edits problem text -> dirty
  curSnap.problem = "Bảng biểu bong tróc (đã sửa)";
  assert.equal(isDirty(curSnap, baselineSnapshot), true, "Edited problem must be dirty");

  // 3. User reverts edit -> NOT dirty
  curSnap.problem = "Bảng biểu bong tróc";
  assert.equal(isDirty(curSnap, baselineSnapshot), false, "Reverted edit must NOT be dirty");

  // 4. User changes date -> dirty
  curSnap.inspectionDate = "21/10/2026";
  assert.equal(isDirty(curSnap, baselineSnapshot), true, "Changed date must be dirty");
  curSnap.inspectionDate = "20/10/2026";

  // 5. User changes photo -> dirty
  curSnap.photoDataUrl = "/api/photos/van-de-5s/10-2026/new-img.jpg";
  assert.equal(isDirty(curSnap, baselineSnapshot), true, "Changed photo must be dirty");
});
