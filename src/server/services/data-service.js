"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const SafetyTimeline = require("../../../modules/core/safety-timeline");

const SEED_ACCOUNTS_FILE = path.resolve(__dirname, "..", "..", "..", "data", "seed-accounts.json");

function writeSeedAccounts(accounts) {
  const seedAccounts = {};
  const entries = Array.isArray(accounts)
    ? accounts.map((a) => [a?.id, a]).filter(([id]) => id)
    : typeof accounts === "object" && accounts
      ? Object.entries(accounts)
      : [];

  for (const [id, account] of entries) {
    if (!account?.username) continue;
    const { activeSessionId, activeSessionAt, activeSessionExpiresAt, activeSessionStartedAt, password, passwordSalt, ...safeAccount } = account;
    seedAccounts[id] = safeAccount;
  }

  const content = JSON.stringify({ accounts: seedAccounts }, null, 2) + "\n";
  return fs.writeFile(SEED_ACCOUNTS_FILE, content, "utf8").catch((error) => {
    console.warn("Không ghi được seed-accounts.json:", error.message);
  });
}

const PHOTO_MAX_BYTES = 12 * 1024 * 1024;
const PHOTO_CONTENT_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function clone(value) {
  if (value === undefined) {
    return null;
  }
  return JSON.parse(JSON.stringify(value));
}

function pathParts(input) {
  return String(input || "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function ensureObjectRoot(root) {
  return isPlainObject(root) ? clone(root) : {};
}

function walkToParent(root, parts) {
  let cursor = root;
  for (const part of parts.slice(0, -1)) {
    if (Array.isArray(cursor[part])) {
      const map = {};
      for (const item of cursor[part]) {
        if (item?.id) {
          map[item.id] = item;
        }
      }
      cursor[part] = map;
    }
    if (!isPlainObject(cursor[part])) {
      cursor[part] = {};
    }
    cursor = cursor[part];
  }
  return cursor;
}

function setAtPath(root, targetPath, value) {
  const parts = pathParts(targetPath);
  if (!parts.length) {
    return clone(value);
  }

  const nextRoot = ensureObjectRoot(root);
  const parent = walkToParent(nextRoot, parts);
  parent[parts[parts.length - 1]] = clone(value);
  return nextRoot;
}

function removeAtPath(root, targetPath) {
  const parts = pathParts(targetPath);
  if (!parts.length) {
    return null;
  }

  const nextRoot = ensureObjectRoot(root);
  let parent = nextRoot;
  for (const part of parts.slice(0, -1)) {
    if (!isPlainObject(parent[part])) {
      return nextRoot;
    }
    parent = parent[part];
  }

  delete parent[parts[parts.length - 1]];
  return nextRoot;
}

function updateAtPath(root, targetPath, updates) {
  if (!isPlainObject(updates)) {
    const error = new Error("Dữ liệu update phải là object.");
    error.statusCode = 400;
    throw error;
  }

  let nextRoot = ensureObjectRoot(root);
  for (const [key, value] of Object.entries(updates)) {
    const fullPath = [...pathParts(targetPath), ...pathParts(key)].join("/");
    nextRoot = value === null ? removeAtPath(nextRoot, fullPath) : setAtPath(nextRoot, fullPath, value);
  }
  return nextRoot;
}

const SCORE_COMPARE_FIELDS = [
  "id", "periodId", "areaId", "itemId", "criterionId", "scoreSource", "score", "status",
  "note", "photoDataUrl", "photoName", "issueType", "issueLevel", "issueStatus", "issueLocation",
  "issueDay", "issueMonth", "issueCount", "issueFoundBy", "employeeCode", "issueItemLabel",
  "foundChannel", "improvementContent", "afterPhotoDataUrl", "afterPhotoName", "actionOwner",
  "actionPlan", "completionDate", "completionLevelConfirm", "completionStop6Confirm", "scorerName",
  "accountUsername", "createdAt", "updatedAt",
];

function scoreForComparison(score) {
  if (!isPlainObject(score)) return null;
  const normalized = {};
  SCORE_COMPARE_FIELDS.forEach((field) => {
    let value = score[field];
    if (field === "scoreSource") value = value === "self" ? "self" : "assessor";
    else if (field === "score") value = value === null || value === undefined || value === "" ? null : Number(value);
    else if (field === "status") value = value === "crossed" ? "crossed" : "";
    else if (field === "issueCount") {
      const count = Number(value);
      value = Number.isInteger(count) && count >= 1 ? count : "";
    } else if (field === "issueStatus") {
      const normalizedStatus = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
      value = ["closed", "done", "da_xu_ly", "đã_xử_lý"].includes(normalizedStatus)
        ? "closed"
        : ["in_progress", "processing", "dang_xu_ly", "đang_xử_lý"].includes(normalizedStatus)
          ? "in_progress"
          : ["overdue", "qua_han", "quá_hạn"].includes(normalizedStatus)
            ? "overdue"
            : normalizedStatus || (score.note || score.photoDataUrl ? "open" : "");
    } else if (field === "foundChannel") {
      const channel = String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
      value = ["worker", "member", "cong-nhan", "công-nhân"].includes(channel)
        ? "worker"
        : ["department-head", "internal-audit", "audit", "truong-bo-phan", "trưởng-bộ-phận", "to-truong", "tổ-trưởng"].includes(channel)
          ? "department-head"
          : ["assessor", "lean", "(lean)"].includes(channel) ? "assessor" : "";
    } else {
      value = value ?? "";
    }
    normalized[field] = value;
  });
  return normalized;
}

function sameScoreValue(left, right) {
  return JSON.stringify(scoreForComparison(left)) === JSON.stringify(scoreForComparison(right));
}

function findScoreForSlot(root, slot = {}) {
  return Object.values(root?.scores || {}).find((score) => (
    score &&
    String(score.periodId || "") === String(slot.periodId || "") &&
    String(score.areaId || "") === String(slot.areaId || "") &&
    String(score.itemId || "") === String(slot.itemId || "") &&
    String(score.criterionId || "") === String(slot.criterionId || "") &&
    (score.scoreSource === "self" ? "self" : "assessor") === (slot.scoreSource === "self" ? "self" : "assessor")
  )) || null;
}

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertZoneManagersNotReplaced(previousRoot, nextRoot, allowZoneManagerReassignment = false) {
  const values = (collection) => Object.values(collection || {}).filter(Boolean);
  const managerIds = (collection) => new Set(values(collection).map((manager) => manager.id).filter(Boolean));
  const check = (before, after, managers) => {
    const previous = new Map(values(before).map((area) => [area.id, area]));
    const permittedManagerIds = allowZoneManagerReassignment ? managerIds(managers) : new Set();
    for (const area of values(after)) {
      const old = previous.get(area.id);
      if (old?.scorerId && area.scorerId && old.scorerId !== area.scorerId && !permittedManagerIds.has(area.scorerId)) {
        throw createHttpError(`Zone ${area.code || old.code || area.id} đã có người quản lý. Không thể thêm hoặc thay thế người quản lý của Zone này.`, 409);
      }
    }
  };
  check(previousRoot?.areas, nextRoot?.areas, nextRoot?.managers);
  check(previousRoot?.safetyAreas, nextRoot?.safetyAreas, nextRoot?.safetyManagers || nextRoot?.managers);
  const previousPeriods = new Map(values(previousRoot?.periods).map((period) => [period.id, period]));
  for (const period of values(nextRoot?.periods)) {
    const previous = previousPeriods.get(period.id)?.settingsSnapshot || {};
    const next = period.settingsSnapshot || {};
    check(previous.areas, next.areas, next.managers);
    check(previous.safetyAreas, next.safetyAreas, next.safetyManagers || next.managers);
  }
}

function isInsideRoot(rootDir, filePath) {
  const relativePath = path.relative(rootDir, filePath);
  return Boolean(relativePath) && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function normalizePhotoPeriodFolder(month, year) {
  const now = new Date();
  const numericMonth = Number(month);
  const numericYear = Number(year);
  const safeMonth = Number.isInteger(numericMonth) && numericMonth >= 1 && numericMonth <= 12
    ? numericMonth
    : now.getMonth() + 1;
  const safeYear = Number.isInteger(numericYear) && numericYear >= 2020 && numericYear <= 2100
    ? numericYear
    : now.getFullYear();
  return `${String(safeMonth).padStart(2, "0")}-${safeYear}`;
}

function sanitizePhotoBaseName(value) {
  return String(value || "anh-minh-hoa")
    .replace(/\.[a-z0-9]+$/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .toLowerCase() || "anh-minh-hoa";
}

function decodeImageDataUrl(dataUrl) {
  const match = /^data:image\/(png|jpe?g|webp);base64,([a-z0-9+/=\s]+)$/i.exec(String(dataUrl || ""));
  if (!match) {
    throw createHttpError("Ảnh gửi lên không hợp lệ.", 400);
  }

  const extension = match[1].toLowerCase().startsWith("jp") ? "jpg" : match[1].toLowerCase();
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buffer.length) {
    throw createHttpError("Ảnh gửi lên không có dữ liệu.", 400);
  }
  if (buffer.length > PHOTO_MAX_BYTES) {
    throw createHttpError("Ảnh sau nén vẫn quá lớn.", 413);
  }

  return {
    buffer,
    extension,
    contentType: PHOTO_CONTENT_TYPES[extension] || "application/octet-stream",
  };
}

function getPhotoContentType(filePath) {
  const extension = path.extname(filePath).slice(1).toLowerCase();
  return PHOTO_CONTENT_TYPES[extension] || "application/octet-stream";
}

class DataService {
  constructor({ repository, photoDir, authService }) {
    this.repository = repository;
    this.photoDir = photoDir || path.join(repository.dataDir, "photos");
    this.authService = authService;
  }

  getHealth() {
    return { ok: true };
  }

  async readData(authContext = null) {
    const root = authContext?.root || await this.repository.readRoot();
    return this.authService ? this.authService.sanitizeRoot(root) : root;
  }

  async savePhoto(photo = {}, authContext = null) {
    this.authService?.assertPhotoAllowed(authContext);
    const { buffer, extension, contentType } = decodeImageDataUrl(photo.dataUrl);
    const periodFolder = normalizePhotoPeriodFolder(photo.month, photo.year);
    const baseName = sanitizePhotoBaseName(photo.fileName);
    const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const fileName = `${uniquePart}-${baseName}.${extension}`;
    const targetDir = path.join(this.photoDir, periodFolder);
    const filePath = path.join(targetDir, fileName);

    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(filePath, buffer);

    return {
      url: `/api/photos/${encodeURIComponent(periodFolder)}/${encodeURIComponent(fileName)}`,
      fileName,
      periodFolder,
      contentType,
      size: buffer.length,
    };
  }

  async deletePhoto(photo = {}, authContext = null) {
    this.authService?.assertPhotoAllowed(authContext);
    const rawPath = String(photo.path || photo.url || "");
    const marker = "/api/photos/";
    const photoPath = rawPath.includes(marker) ? rawPath.slice(rawPath.indexOf(marker) + marker.length) : rawPath;
    const parts = pathParts(decodeURIComponent(photoPath));
    if (parts.length !== 2) {
      throw createHttpError("Đường dẫn ảnh không hợp lệ.", 400);
    }

    const filePath = path.resolve(this.photoDir, ...parts);
    if (!isInsideRoot(this.photoDir, filePath)) {
      throw createHttpError("Đường dẫn ảnh không hợp lệ.", 403);
    }

    await fs.rm(filePath, { force: true });
    try {
      await fs.rmdir(path.dirname(filePath));
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY") {
        throw error;
      }
    }
    return { ok: true };
  }

  async readPhoto(photoPath) {
    const parts = pathParts(decodeURIComponent(String(photoPath || "")));
    if (parts.length !== 2) {
      throw createHttpError("Không tìm thấy ảnh.", 404);
    }

    const filePath = path.resolve(this.photoDir, ...parts);
    if (!isInsideRoot(this.photoDir, filePath)) {
      throw createHttpError("Đường dẫn ảnh không hợp lệ.", 403);
    }

    try {
      return {
        body: await fs.readFile(filePath),
        contentType: getPhotoContentType(filePath),
      };
    } catch (error) {
      if (error.code === "ENOENT") {
        throw createHttpError("Không tìm thấy ảnh.", 404);
      }
      throw error;
    }
  }

  writeData(command = {}, authContext = null) {
    const operation = String(command.operation || "");
    const targetPath = String(command.path || "");

    return this.repository.updateRoot((currentRoot) => {
      this.authService?.assertDataWriteAllowed(command, authContext, currentRoot);
      const scoreConflict = command.scoreConflict;
      if (scoreConflict) {
        const slotFields = ["periodId", "areaId", "itemId", "criterionId", "scoreSource"];
        const validSlot = slotFields.every((field) => typeof scoreConflict.slot?.[field] === "string" && Boolean(scoreConflict.slot[field]));
        if (!targetPath.startsWith("scores/") || !validSlot || !["self", "assessor"].includes(scoreConflict.slot.scoreSource)) {
          throw createHttpError("Yêu cầu kiểm tra xung đột điểm không hợp lệ.", 400);
        }
        const currentScore = findScoreForSlot(currentRoot, scoreConflict.slot);
        const desiredScore = operation === "remove" ? null : command.value;
        if (sameScoreValue(currentScore, desiredScore)) {
          return currentRoot;
        }
        if (!sameScoreValue(currentScore, scoreConflict.expectedValue)) {
          const error = createHttpError("Ô điểm đã được người khác thay đổi.", 409);
          error.scoreConflict = { currentValue: currentScore };
          throw error;
        }
      }
      let nextRoot;
      if (operation === "set") {
        nextRoot = setAtPath(currentRoot, targetPath, command.value);
      } else if (operation === "update") {
        nextRoot = updateAtPath(currentRoot, targetPath, command.value);
      } else if (operation === "remove") {
        nextRoot = removeAtPath(currentRoot, targetPath);
      } else {
        const error = new Error(`Không hỗ trợ thao tác dữ liệu "${operation}".`);
        error.statusCode = 400;
        throw error;
      }

      assertZoneManagersNotReplaced(currentRoot, nextRoot, command.allowZoneManagerReassignment === true);
      const previousRecords = new Map(Object.entries(currentRoot?.safetyRecords || {}).map(([key, record]) => [record?.id || key, record]));
      // Full collection imports may contain historical records without actual dates.
      // Keep them intact; reports explicitly flag missing dates instead of inferring them.
      const legacyImport = targetPath === "safetyRecords" || (targetPath === "" && Object.prototype.hasOwnProperty.call(command.value || {}, "safetyRecords"));
      for (const [key, record] of Object.entries(nextRoot?.safetyRecords || {})) {
        const previous = previousRecords.get(record?.id || key);
        if (!record || legacyImport || JSON.stringify(record) === JSON.stringify(previous)) continue;
        const period = Object.values(nextRoot?.periods || {}).find((item) => item?.id === record.periodId);
        const error = SafetyTimeline.validate(record, previous, period?.year);
        if (error) throw createHttpError(error, 400);
      }
      return this.authService ? this.authService.prepareRootForStorage(nextRoot, currentRoot) : nextRoot;
    }).then((root) => {
      if (targetPath.startsWith("accounts")) {
        writeSeedAccounts(root.accounts);
      }
      return this.authService ? this.authService.sanitizeRoot(root) : root;
    });
  }
}

module.exports = {
  DataService,
  sameScoreValue,
};
