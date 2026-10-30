"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { DataService } = require("../src/server/services/data-service");

// Small 1x1 png dataUrl for testing
const TINY_PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function createMockRepository(initialRoot = {}) {
  let root = JSON.parse(JSON.stringify(initialRoot));
  return {
    async readRoot() {
      return JSON.parse(JSON.stringify(root));
    },
    async updateRoot(mutator) {
      const next = JSON.parse(JSON.stringify(root));
      await mutator(next);
      root = next;
      return { root };
    },
    getRoot() {
      return root;
    },
  };
}

test("DataService: savePhoto separates 5S, Safety, and User Guides into van-de-5s, an-toan, and huong-dan folders", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "photo-test-"));
  const photoDir = path.join(tempDir, "photos");

  try {
    const repository = createMockRepository();
    const dataService = new DataService({ repository, photoDir });

    // 1. Save 5S photo
    const fiveSResult = await dataService.savePhoto({
      dataUrl: TINY_PNG_DATA_URL,
      fileName: "test-5s.png",
      month: 10,
      year: 2026,
      category: "van-de-5s",
    });

    assert.equal(fiveSResult.categoryFolder, "van-de-5s");
    assert.equal(fiveSResult.periodFolder, "10-2026");
    assert.match(fiveSResult.url, /^\/api\/photos\/van-de-5s\/10-2026\/.+\.png$/);

    const fiveSFilePath = path.join(photoDir, "van-de-5s", "10-2026", fiveSResult.fileName);
    const fiveSExists = await fs.access(fiveSFilePath).then(() => true).catch(() => false);
    assert.ok(fiveSExists, "5S photo file should exist in van-de-5s/10-2026");

    // 2. Save Safety photo
    const safetyResult = await dataService.savePhoto({
      dataUrl: TINY_PNG_DATA_URL,
      fileName: "test-safety.png",
      month: 10,
      year: 2026,
      category: "an-toan",
    });

    assert.equal(safetyResult.categoryFolder, "an-toan");
    assert.equal(safetyResult.periodFolder, "10-2026");
    assert.match(safetyResult.url, /^\/api\/photos\/an-toan\/10-2026\/.+\.png$/);

    const safetyFilePath = path.join(photoDir, "an-toan", "10-2026", safetyResult.fileName);
    const safetyExists = await fs.access(safetyFilePath).then(() => true).catch(() => false);
    assert.ok(safetyExists, "Safety photo file should exist in an-toan/10-2026");

    // 3. Save User Guide photo
    const guideResult = await dataService.savePhoto({
      dataUrl: TINY_PNG_DATA_URL,
      fileName: "test-guide.png",
      month: 10,
      year: 2026,
      category: "huong-dan",
    });

    assert.equal(guideResult.categoryFolder, "huong-dan");
    assert.equal(guideResult.periodFolder, "10-2026");
    assert.match(guideResult.url, /^\/api\/photos\/huong-dan\/10-2026\/.+\.png$/);

    const guideFilePath = path.join(photoDir, "huong-dan", "10-2026", guideResult.fileName);
    const guideExists = await fs.access(guideFilePath).then(() => true).catch(() => false);
    assert.ok(guideExists, "Guide photo file should exist in huong-dan/10-2026");

    // 4. Read photos
    const readFiveS = await dataService.readPhoto(`van-de-5s/10-2026/${fiveSResult.fileName}`);
    assert.ok(readFiveS.body.length > 0);
    assert.equal(readFiveS.contentType, "image/png");

    const readSafety = await dataService.readPhoto(`an-toan/10-2026/${safetyResult.fileName}`);
    assert.ok(readSafety.body.length > 0);
    assert.equal(readSafety.contentType, "image/png");

    const readGuide = await dataService.readPhoto(`huong-dan/10-2026/${guideResult.fileName}`);
    assert.ok(readGuide.body.length > 0);
    assert.equal(readGuide.contentType, "image/png");

    // 5. Delete photos
    await dataService.deletePhoto({ url: fiveSResult.url });
    const fiveSDeleted = await fs.access(fiveSFilePath).then(() => true).catch(() => false);
    assert.equal(fiveSDeleted, false, "5S photo file should be deleted");

    await dataService.deletePhoto({ url: safetyResult.url });
    const safetyDeleted = await fs.access(safetyFilePath).then(() => true).catch(() => false);
    assert.equal(safetyDeleted, false, "Safety photo file should be deleted");

    await dataService.deletePhoto({ url: guideResult.url });
    const guideDeleted = await fs.access(guideFilePath).then(() => true).catch(() => false);
    assert.equal(guideDeleted, false, "Guide photo file should be deleted");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("DataService: readPhoto fallback supports legacy 2-part URLs from categorized folders", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "photo-legacy-test-"));
  const photoDir = path.join(tempDir, "photos");

  try {
    const repository = createMockRepository();
    const dataService = new DataService({ repository, photoDir });

    // Manually place a file in van-de-5s/10-2026/legacy.png
    const targetDir = path.join(photoDir, "van-de-5s", "10-2026");
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(path.join(targetDir, "legacy.png"), Buffer.from("test-content"));

    // Read using legacy 2-part path: "10-2026/legacy.png"
    const readResult = await dataService.readPhoto("10-2026/legacy.png");
    assert.equal(readResult.body.toString(), "test-content");

    // Delete using legacy 2-part URL
    await dataService.deletePhoto({ url: "/api/photos/10-2026/legacy.png" });
    const exists = await fs.access(path.join(targetDir, "legacy.png")).then(() => true).catch(() => false);
    assert.equal(exists, false, "Legacy file should be successfully deleted");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("DataService: migrateLegacyPhotos migrates on-disk files and updates DB root", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "photo-migration-test-"));
  const photoDir = path.join(tempDir, "photos");

  try {
    // 1. Create legacy file structure: photos/10-2026/five-s-item.png and photos/10-2026/safety-item.png
    const legacyDir = path.join(photoDir, "10-2026");
    await fs.mkdir(legacyDir, { recursive: true });
    await fs.writeFile(path.join(legacyDir, "five-s-item.png"), Buffer.from("5s-bytes"));
    await fs.writeFile(path.join(legacyDir, "safety-item.png"), Buffer.from("safety-bytes"));
    await fs.writeFile(path.join(legacyDir, "guide-item.png"), Buffer.from("guide-bytes"));

    // Legacy thumbs
    const legacyThumbDir = path.join(photoDir, ".thumbs", "10-2026");
    await fs.mkdir(legacyThumbDir, { recursive: true });
    await fs.writeFile(path.join(legacyThumbDir, "five-s-item.png.webp"), Buffer.from("5s-thumb-bytes"));
    await fs.writeFile(path.join(legacyThumbDir, "safety-item.png.webp"), Buffer.from("safety-thumb-bytes"));
    await fs.writeFile(path.join(legacyThumbDir, "guide-item.png.webp"), Buffer.from("guide-thumb-bytes"));

    // Mock initial root
    const repository = createMockRepository({
      scores: [
        { id: "score-1", photoDataUrl: "/api/photos/10-2026/five-s-item.png" },
      ],
      safetyRecords: [
        { id: "safety-1", photoDataUrl: "/api/photos/10-2026/safety-item.png" },
      ],
      fiveSFindings: [],
      userGuides: {
        safety: {
          steps: [
            { id: "step-1", imageUrl: "/api/photos/10-2026/guide-item.png", images: [{ id: "img-1", imageUrl: "/api/photos/10-2026/guide-item.png" }] },
          ],
        },
      },
    });

    const dataService = new DataService({ repository, photoDir });
    const result = await dataService.migrateLegacyPhotos(repository);

    assert.equal(result.migrated, 3);
    assert.equal(result.updatedRefs, 3);

    // Verify files on disk moved to new directories
    const new5SPath = path.join(photoDir, "van-de-5s", "10-2026", "five-s-item.png");
    const newSafetyPath = path.join(photoDir, "an-toan", "10-2026", "safety-item.png");
    const newGuidePath = path.join(photoDir, "huong-dan", "10-2026", "guide-item.png");
    assert.ok(await fs.access(new5SPath).then(() => true).catch(() => false), "5S photo should be moved to van-de-5s");
    assert.ok(await fs.access(newSafetyPath).then(() => true).catch(() => false), "Safety photo should be moved to an-toan");
    assert.ok(await fs.access(newGuidePath).then(() => true).catch(() => false), "Guide photo should be moved to huong-dan");

    // Verify thumbs moved
    const new5SThumb = path.join(photoDir, ".thumbs", "van-de-5s", "10-2026", "five-s-item.png.webp");
    const newSafetyThumb = path.join(photoDir, ".thumbs", "an-toan", "10-2026", "safety-item.png.webp");
    const newGuideThumb = path.join(photoDir, ".thumbs", "huong-dan", "10-2026", "guide-item.png.webp");
    assert.ok(await fs.access(new5SThumb).then(() => true).catch(() => false), "5S thumb moved");
    assert.ok(await fs.access(newSafetyThumb).then(() => true).catch(() => false), "Safety thumb moved");
    assert.ok(await fs.access(newGuideThumb).then(() => true).catch(() => false), "Guide thumb moved");

    // Verify DB root updated
    const updatedRoot = repository.getRoot();
    assert.equal(updatedRoot.scores[0].photoDataUrl, "/api/photos/van-de-5s/10-2026/five-s-item.png");
    assert.equal(updatedRoot.safetyRecords[0].photoDataUrl, "/api/photos/an-toan/10-2026/safety-item.png");
    assert.equal(updatedRoot.userGuides.safety.steps[0].imageUrl, "/api/photos/huong-dan/10-2026/guide-item.png");
    assert.equal(updatedRoot.userGuides.safety.steps[0].images[0].imageUrl, "/api/photos/huong-dan/10-2026/guide-item.png");

    // Verify legacy period dir removed
    const legacyExists = await fs.access(legacyDir).then(() => true).catch(() => false);
    assert.equal(legacyExists, false, "Legacy 10-2026 dir should be removed when empty");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
