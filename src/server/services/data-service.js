"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");
const SafetyTimeline = require("../../../modules/core/safety-timeline");

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

function commandPaths(command) {
  const target = pathParts(command?.path);
  if (command?.operation === "update" && isPlainObject(command.value)) {
    return Object.keys(command.value).map((key) => [...target, ...pathParts(key)]);
  }
  if (target.length) return [target];
  return null;
}

function touchedRootKeys(command) {
  const paths = commandPaths(command);
  if (!paths) return null;
  const keys = new Set();
  paths.forEach((parts) => {
    if (!parts.length) return;
    keys.add(parts[0]);
  });
  if (keys.has("periods")) {
    keys.add("scores");
    keys.add("safetyRecords");
    keys.add("fiveSFindings");
  }
  return [...keys];
}

function touchedRecordIds(command) {
  const paths = commandPaths(command);
  if (!paths) return null;
  const records = {};
  paths.forEach((parts) => {
    const collection = parts[0];
    if (!collection) return;
    if (parts.length < 2) {
      records[collection] = null;
      return;
    }
    if (Object.prototype.hasOwnProperty.call(records, collection) && records[collection] === null) return;
    if (!Array.isArray(records[collection])) records[collection] = [];
    records[collection].push(parts[1]);
  });
  Object.keys(records).forEach((collection) => {
    if (Array.isArray(records[collection])) records[collection] = [...new Set(records[collection])];
  });
  if (paths.some((parts) => parts[0] === "periods")) {
    for (const collection of ["scores", "safetyRecords", "fiveSFindings"]) {
      if (!Object.prototype.hasOwnProperty.call(records, collection)) records[collection] = [];
    }
  }
  return records;
}

function safetyRecordIdsToValidate(command) {
  const paths = commandPaths(command);
  if (!paths) return null;
  const safetyPaths = paths.filter((parts) => parts[0] === "safetyRecords");
  if (!safetyPaths.length) return [];
  if (safetyPaths.some((parts) => parts.length < 2)) return null;
  return [...new Set(safetyPaths.map((parts) => parts[1]))];
}

function isSafetyPhotoAnnotationPatch(command) {
  const target = pathParts(command?.path);
  if (String(command?.operation || "") !== "update"
    || target[0] !== "safetyRecords"
    || target.length !== 2
    || !isPlainObject(command.value)) return false;
  const allowedFields = new Set(["photoAnnotations", "afterPhotoAnnotations", "updatedAt"]);
  const fields = Object.keys(command.value);
  return fields.length > 0 && fields.every((field) => allowedFields.has(field));
}

function touchedRecordFields(command) {
  const target = pathParts(command?.path);
  if (String(command?.operation || "") !== "update" || target.length < 2 || !isPlainObject(command.value)) return null;
  const result = {};
  for (const key of Object.keys(command.value)) {
    const child = pathParts(key);
    if (!child.length) continue;
    const collection = target[0];
    const id = target[1];
    result[collection] ||= {};
    result[collection][id] ||= [];
    result[collection][id].push([...target.slice(2), ...child].join("/"));
  }
  return result;
}

function recordById(collection, id) {
  if (Array.isArray(collection)) {
    return collection.find((record) => String(record?.id || "") === String(id)) || null;
  }
  if (!isPlainObject(collection)) return null;
  if (collection[id]) return collection[id];
  return Object.values(collection).find((record) => String(record?.id || "") === String(id)) || null;
}

function mergeCurrentSessionHistory(currentRoot, nextRoot, command, authContext) {
  const account = authContext?.rawAccount || authContext?.account;
  const isAdmin = String(account?.role || "").trim().toLowerCase() === "admin";
  const sessionId = String(authContext?.payload?.sid || "");
  if (!account || isAdmin || !sessionId) return nextRoot;

  const historyIds = [...new Set((commandPaths(command) || [])
    .filter((parts) => parts[0] === "history" && parts.length === 2)
    .map((parts) => parts[1]))];
  let result = nextRoot;
  for (const id of historyIds) {
    const previous = recordById(currentRoot?.history, id);
    const incoming = recordById(result?.history, id);
    if (!previous || !incoming
      || String(previous.sessionId || "") !== sessionId
      || String(incoming.sessionId || "") !== sessionId) continue;

    const changes = [];
    const seen = new Set();
    [...(Array.isArray(previous.changes) ? previous.changes : []), ...(Array.isArray(incoming.changes) ? incoming.changes : [])]
      .forEach((change) => {
        const key = JSON.stringify(change);
        if (seen.has(key)) return;
        seen.add(key);
        changes.push(change);
      });
    const scopes = [...new Set([
      ...(Array.isArray(previous.scopes) ? previous.scopes : previous.scope ? [previous.scope] : []),
      ...(Array.isArray(incoming.scopes) ? incoming.scopes : incoming.scope ? [incoming.scope] : []),
      ...changes.map((change) => change.scope).filter(Boolean),
    ])];
    const merged = {
      ...previous,
      ...incoming,
      accountId: String(account.id || previous.accountId || ""),
      username: String(account.username || previous.username || ""),
      employeeCode: String(account.employeeCode || previous.employeeCode || incoming.employeeCode || ""),
      userName: String(previous.userName || account.name || account.displayName || incoming.userName || account.username || ""),
      changes,
      scopes,
      changeCount: changes.length,
      changeLabel: `Phiên đăng nhập có ${changes.length} thay đổi`,
      latestChange: String(incoming.latestChange || previous.latestChange || ""),
      note: String(incoming.note || previous.note || ""),
    };
    result = setAtPath(result, `history/${id}`, merged);
  }
  return result;
}

function recordEntries(collection) {
  if (Array.isArray(collection)) return collection.map((record, index) => [String(record?.id || index), record]);
  return isPlainObject(collection) ? Object.entries(collection) : [];
}

function writeChanges(command) {
  const operation = String(command?.operation || "");
  const target = pathParts(command?.path);
  if (operation === "update" && isPlainObject(command.value)) {
    return Object.entries(command.value).map(([childPath, value]) => ({
      path: [...target, ...pathParts(childPath)].join("/"),
      removed: value === null,
    }));
  }
  if (!target.length) return [];
  return [{ path: target.join("/"), removed: operation === "remove" }];
}

function valueAtPath(root, path) {
  let value = root;
  for (const part of pathParts(path)) {
    if (Array.isArray(value)) value = value.find((record) => String(record?.id || "") === part);
    else value = value && typeof value === "object" ? value[part] : undefined;
    if (value === undefined || value === null) return value ?? null;
  }
  return value;
}

function writeAcknowledgement(command, root, authService, authContext = null) {
  const changes = writeChanges(command).map((change) => {
    const parts = pathParts(change.path);
    return parts[0] === "accounts" && parts.length > 2
      ? { ...change, path: parts.slice(0, 2).join("/") }
      : change;
  });
  const account = authContext?.rawAccount || authContext?.account;
  const isAdmin = String(account?.role || "").trim().toLowerCase() === "admin";
  if (!isAdmin && changes.some((change) => pathParts(change.path)[0] === "history")) {
    return { applied: [], reloadRequired: true };
  }
  const recordChanges = changes.filter((change) => pathParts(change.path).length > 1);
  if (!recordChanges.length || recordChanges.length > 100) {
    return { applied: [], reloadRequired: true };
  }
  const applied = recordChanges.map((change) => {
    let value = change.removed ? undefined : valueAtPath(root, change.path);
    if (!change.removed && authService && pathParts(change.path)[0] === "accounts") {
      value = authService.sanitizeAccount(value);
    }
    const removed = change.removed || value === null;
    return { ...change, removed, ...(!removed ? { value } : {}) };
  });
  const reloadRequired = changes.some((change) => pathParts(change.path).length < 2)
    || changes.length !== applied.length
    || Buffer.byteLength(JSON.stringify(applied), "utf8") > 65536;
  return reloadRequired ? { applied: [], reloadRequired: true } : { applied, reloadRequired: false };
}

function hasLegacyAccountSecrets(collection) {
  return recordEntries(collection).some(([, account]) => account && (
    Object.prototype.hasOwnProperty.call(account, "password")
    || Object.prototype.hasOwnProperty.call(account, "passwordSalt")
  ));
}

function hasExpiredHistoryEntries(history) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 3);
  const cutoffMs = cutoff.getTime();
  const entries = Array.isArray(history) ? history : isPlainObject(history) ? Object.values(history) : [];
  return entries.some((entry) => {
    const timestamp = Date.parse(entry?.timestamp || entry?.sessionStartedAt || entry?.sessionLastChangedAt || "");
    return !Number.isFinite(timestamp) || timestamp < cutoffMs;
  });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function ensureObjectRoot(root) {
  return isPlainObject(root) ? { ...root } : {};
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
    } else if (isPlainObject(cursor[part])) {
      cursor[part] = { ...cursor[part] };
    } else {
      cursor[part] = {};
    }
    cursor = cursor[part];
  }
  return cursor;
}

function setAtPath(root, targetPath, value) {
  if (!pathParts(targetPath).length) return clone(value);
  const nextRoot = ensureObjectRoot(root);
  return setAtPathOnRoot(nextRoot, targetPath, value);
}

function setAtPathOnRoot(root, targetPath, value) {
  const parts = pathParts(targetPath);
  if (!parts.length) {
    return clone(value);
  }

  const nextRoot = isPlainObject(root) ? root : {};
  const parent = walkToParent(nextRoot, parts);
  parent[parts[parts.length - 1]] = clone(value);
  return nextRoot;
}

function removeAtPath(root, targetPath) {
  if (!pathParts(targetPath).length) return null;
  const nextRoot = ensureObjectRoot(root);
  return removeAtPathOnRoot(nextRoot, targetPath);
}

function removeAtPathOnRoot(root, targetPath) {
  const parts = pathParts(targetPath);
  if (!parts.length) {
    return null;
  }

  const nextRoot = isPlainObject(root) ? root : {};
  let parent = nextRoot;
  for (const part of parts.slice(0, -1)) {
    if (Array.isArray(parent[part])) {
      const map = {};
      for (const item of parent[part]) {
        if (item?.id) map[item.id] = item;
      }
      parent[part] = map;
    } else if (isPlainObject(parent[part])) {
      parent[part] = { ...parent[part] };
    } else {
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
    nextRoot = value === null ? removeAtPathOnRoot(nextRoot, fullPath) : setAtPathOnRoot(nextRoot, fullPath, value);
  }
  return nextRoot;
}

const SCORE_COMPARE_FIELDS = [
  "id", "periodId", "areaId", "itemId", "criterionId", "scoreSource", "scoreDate", "score", "status",
  "note", "photoDataUrl", "photoName", "issueType", "issueLevel", "issueStatus", "issueLocation", "issueDate",
  "issueDay", "issueMonth", "issueCount", "issueFoundBy", "employeeCode", "issueItemLabel",
  "foundChannel", "improvementContent", "afterPhotoDataUrl", "afterPhotoName", "actionOwner",
  "actionPlan", "completionDate", "completionLevelConfirm", "completionStop6Confirm", "scorerName",
  "accountUsername", "createdAt", "updatedAt",
];

const MULTI_DAY_SCORE_SOURCES = new Set(["at5s", "departmentHead"]);

function normalizeScoreSource(source) {
  const value = String(source || "").trim();
  if (value === "self") return "self";
  if (["at5s", "banAt5s", "committee5s", "ban-at-5s"].includes(value)) return "at5s";
  if (["departmentHead", "deptHead", "department-head"].includes(value)) return "departmentHead";
  return "assessor";
}

function normalizeScoreDateForSource(scoreDate, scoreSource) {
  const normalizedSource = normalizeScoreSource(scoreSource);
  if (!MULTI_DAY_SCORE_SOURCES.has(normalizedSource)) return "";
  const text = String(scoreDate || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function scoreForComparison(score) {
  if (!isPlainObject(score)) return null;
  const normalized = {};
  const normalizedSource = normalizeScoreSource(score.scoreSource);
  SCORE_COMPARE_FIELDS.forEach((field) => {
    let value = score[field];
    if (field === "scoreSource") value = normalizedSource;
    else if (field === "scoreDate") value = normalizeScoreDateForSource(value, normalizedSource);
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
        : ["department-head", "head", "internal-audit", "audit", "truong-bo-phan", "trưởng-bộ-phận", "to-truong", "tổ-trưởng"].includes(channel)
          ? "department-head"
          : ["at5s", "ban-at-5s", "ban-at5s", "an-toan-5s", "an-toàn-5s"].includes(channel)
            ? "at5s"
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
  const targetSource = normalizeScoreSource(slot.scoreSource);
  const targetDate = normalizeScoreDateForSource(slot.scoreDate, targetSource);
  return Object.values(root?.scores || {}).find((score) => (
    score &&
    String(score.periodId || "") === String(slot.periodId || "") &&
    String(score.areaId || "") === String(slot.areaId || "") &&
    String(score.itemId || "") === String(slot.itemId || "") &&
    String(score.criterionId || "") === String(slot.criterionId || "") &&
    normalizeScoreSource(score.scoreSource) === targetSource &&
    normalizeScoreDateForSource(score.scoreDate, score.scoreSource) === targetDate
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

const PHOTO_CATEGORIES = Object.freeze(["van-de-5s", "an-toan", "huong-dan"]);

function normalizePhotoCategory(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "huong-dan" || normalized === "huong_dan" || normalized === "guide" || normalized === "guides" || normalized === "user-guide" || normalized === "user_guide" || normalized === "huongdan") {
    return "huong-dan";
  }
  if (normalized === "an-toan" || normalized === "safety" || normalized === "at" || normalized === "an_toan") {
    return "an-toan";
  }
  return "van-de-5s";
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
    return this.authService ? this.authService.sanitizeRoot(root, authContext?.rawAccount || authContext?.account) : root;
  }

  async getDataRevision() {
    return typeof this.repository.getRevision === "function" ? this.repository.getRevision() : null;
  }

  async readCollectionPage(filters = {}) {
    if (typeof this.repository.readCollectionPage !== "function") {
      throw createHttpError("Kho dữ liệu chưa hỗ trợ phân trang.", 501);
    }
    return this.repository.readCollectionPage(filters.collection, filters);
  }

  async savePhoto(photo = {}, authContext = null) {
    this.authService?.assertPhotoAllowed(authContext);
    const { buffer, extension, contentType } = decodeImageDataUrl(photo.dataUrl);
    const categoryFolder = normalizePhotoCategory(photo.category || photo.folder || photo.type);
    const periodFolder = normalizePhotoPeriodFolder(photo.month, photo.year);
    const baseName = sanitizePhotoBaseName(photo.fileName);
    const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const fileName = `${uniquePart}-${baseName}.${extension}`;
    const targetDir = path.join(this.photoDir, categoryFolder, periodFolder);
    const filePath = path.join(targetDir, fileName);

    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(filePath, buffer);

    return {
      url: `/api/photos/${encodeURIComponent(categoryFolder)}/${encodeURIComponent(periodFolder)}/${encodeURIComponent(fileName)}`,
      fileName,
      categoryFolder,
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
    if (parts.length < 2 || parts.length > 3) {
      throw createHttpError("Đường dẫn ảnh không hợp lệ.", 400);
    }

    let filePath;
    let thumbnailPath;
    if (parts.length === 3) {
      filePath = path.resolve(this.photoDir, parts[0], parts[1], parts[2]);
      thumbnailPath = path.join(this.photoDir, ".thumbs", parts[0], parts[1], `${parts[2]}.webp`);
    } else {
      const candidates = [
        path.resolve(this.photoDir, "van-de-5s", parts[0], parts[1]),
        path.resolve(this.photoDir, "an-toan", parts[0], parts[1]),
        path.resolve(this.photoDir, "huong-dan", parts[0], parts[1]),
        path.resolve(this.photoDir, parts[0], parts[1]),
      ];
      filePath = candidates[0];
      for (const candidate of candidates) {
        try {
          await fs.access(candidate);
          filePath = candidate;
          break;
        } catch (_) {}
      }
      const thumbCandidates = [
        path.join(this.photoDir, ".thumbs", "van-de-5s", parts[0], `${parts[1]}.webp`),
        path.join(this.photoDir, ".thumbs", "an-toan", parts[0], `${parts[1]}.webp`),
        path.join(this.photoDir, ".thumbs", "huong-dan", parts[0], `${parts[1]}.webp`),
        path.join(this.photoDir, ".thumbs", parts[0], `${parts[1]}.webp`),
      ];
      thumbnailPath = thumbCandidates[0];
      for (const candidate of thumbCandidates) {
        try {
          await fs.access(candidate);
          thumbnailPath = candidate;
          break;
        } catch (_) {}
      }
    }

    if (!isInsideRoot(this.photoDir, filePath)) {
      throw createHttpError("Đường dẫn ảnh không hợp lệ.", 403);
    }

    await fs.rm(filePath, { force: true });
    if (isInsideRoot(this.photoDir, thumbnailPath)) {
      await fs.rm(thumbnailPath, { force: true });
    }
    try {
      const parentDir = path.dirname(filePath);
      if (parentDir !== this.photoDir && !PHOTO_CATEGORIES.some((cat) => path.resolve(this.photoDir, cat) === parentDir)) {
        await fs.rmdir(parentDir);
      }
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY") {
        throw error;
      }
    }
    return { ok: true };
  }

  async readPhoto(photoPath, size = "full") {
    const parts = pathParts(decodeURIComponent(String(photoPath || "")));
    if (parts.length < 2 || parts.length > 3) {
      throw createHttpError("Không tìm thấy ảnh.", 404);
    }

    let filePath;
    let thumbnailPath;
    if (parts.length === 3) {
      filePath = path.resolve(this.photoDir, parts[0], parts[1], parts[2]);
      thumbnailPath = path.resolve(this.photoDir, ".thumbs", parts[0], parts[1], `${parts[2]}.webp`);
    } else {
      const candidates = [
        path.resolve(this.photoDir, "van-de-5s", parts[0], parts[1]),
        path.resolve(this.photoDir, "an-toan", parts[0], parts[1]),
        path.resolve(this.photoDir, "huong-dan", parts[0], parts[1]),
        path.resolve(this.photoDir, parts[0], parts[1]),
      ];
      filePath = candidates[candidates.length - 1];
      for (const candidate of candidates) {
        try {
          await fs.access(candidate);
          filePath = candidate;
          break;
        } catch (_) {}
      }
      const thumbCandidates = [
        path.resolve(this.photoDir, ".thumbs", "van-de-5s", parts[0], `${parts[1]}.webp`),
        path.resolve(this.photoDir, ".thumbs", "an-toan", parts[0], `${parts[1]}.webp`),
        path.resolve(this.photoDir, ".thumbs", "huong-dan", parts[0], `${parts[1]}.webp`),
        path.resolve(this.photoDir, ".thumbs", parts[0], `${parts[1]}.webp`),
      ];
      thumbnailPath = thumbCandidates[thumbCandidates.length - 1];
      for (const candidate of thumbCandidates) {
        try {
          await fs.access(candidate);
          thumbnailPath = candidate;
          break;
        } catch (_) {}
      }
    }

    if (!isInsideRoot(this.photoDir, filePath)) {
      throw createHttpError("Đường dẫn ảnh không hợp lệ.", 403);
    }

    try {
      if (String(size).toLowerCase() === "thumb") {
        if (!isInsideRoot(this.photoDir, thumbnailPath)) {
          throw createHttpError("Đường dẫn ảnh không hợp lệ.", 403);
        }
        let thumbnail;
        try {
          thumbnail = await fs.readFile(thumbnailPath);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
          const original = await fs.readFile(filePath);
          thumbnail = await sharp(original)
            .rotate()
            .resize({ width: 360, height: 270, fit: "inside", withoutEnlargement: true })
            .webp({ quality: 72 })
            .toBuffer();
          await fs.mkdir(path.dirname(thumbnailPath), { recursive: true });
          const tempPath = `${thumbnailPath}.${process.pid}.${Date.now()}.tmp`;
          await fs.writeFile(tempPath, thumbnail);
          try {
            await fs.rename(tempPath, thumbnailPath);
          } catch (error) {
            await fs.rm(tempPath, { force: true }).catch(() => {});
            if (error.code !== "EEXIST" && error.code !== "EPERM") throw error;
            thumbnail = await fs.readFile(thumbnailPath);
          }
        }
        return { body: thumbnail, contentType: "image/webp", isThumbnail: true };
      }
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

  async migrateLegacyPhotos(repository = this.repository) {
    if (!repository || typeof repository.readRoot !== "function") return { migrated: 0, updatedRefs: 0 };
    const root = await repository.readRoot();
    if (!root) return { migrated: 0, updatedRefs: 0 };

    const safetyUrls = new Set();
    for (const record of root.safetyRecords || []) {
      if (record?.photoDataUrl) safetyUrls.add(record.photoDataUrl);
      if (record?.afterPhotoDataUrl) safetyUrls.add(record.afterPhotoDataUrl);
    }

    const fiveSUrls = new Set();
    const guideUrls = new Set();
    for (const score of root.scores || []) {
      if (score?.photoDataUrl) fiveSUrls.add(score.photoDataUrl);
      if (score?.afterPhotoDataUrl) fiveSUrls.add(score.afterPhotoDataUrl);
    }
    for (const sheet of root.fiveSFindings || []) {
      for (const row of sheet?.rows || []) {
        if (row?.photoDataUrl) fiveSUrls.add(row.photoDataUrl);
        if (row?.afterPhotoDataUrl) fiveSUrls.add(row.afterPhotoDataUrl);
      }
    }
    for (const guide of Object.values(root.userGuides || {})) {
      for (const step of guide?.steps || []) {
        if (step?.imageUrl) guideUrls.add(step.imageUrl);
        if (Array.isArray(step?.images)) {
          for (const img of step.images) {
            if (img?.imageUrl) guideUrls.add(img.imageUrl);
          }
        }
      }
    }

    const urlMap = new Map();
    let migratedCount = 0;
    const marker = "/api/photos/";

    const checkAndMigrate = async (oldUrl, category) => {
      if (!oldUrl || !oldUrl.includes(marker)) return;
      const subPath = oldUrl.slice(oldUrl.indexOf(marker) + marker.length);
      const parts = pathParts(decodeURIComponent(subPath));
      if (parts.length < 2 || parts.length > 3) return;
      let periodFolder, fileName, oldFilePath, oldThumbPath;
      if (parts.length === 3) {
        if (parts[0] === category) return;
        periodFolder = parts[1];
        fileName = parts[2];
        oldFilePath = path.join(this.photoDir, parts[0], periodFolder, fileName);
        oldThumbPath = path.join(this.photoDir, ".thumbs", parts[0], periodFolder, `${fileName}.webp`);
      } else {
        if (parts[0] === "van-de-5s" || parts[0] === "an-toan" || parts[0] === "huong-dan") return;
        periodFolder = parts[0];
        fileName = parts[1];
        oldFilePath = path.join(this.photoDir, periodFolder, fileName);
        oldThumbPath = path.join(this.photoDir, ".thumbs", periodFolder, `${fileName}.webp`);
      }



      const newUrl = `/api/photos/${category}/${encodeURIComponent(periodFolder)}/${encodeURIComponent(fileName)}`;
      urlMap.set(oldUrl, newUrl);


      const newTargetDir = path.join(this.photoDir, category, periodFolder);
      const newFilePath = path.join(newTargetDir, fileName);

      try {
        await fs.access(oldFilePath);
        await fs.mkdir(newTargetDir, { recursive: true });
        await fs.rename(oldFilePath, newFilePath).catch(async () => {
          await fs.copyFile(oldFilePath, newFilePath);
          await fs.unlink(oldFilePath);
        });
        migratedCount++;
      } catch (_) {}


      const newThumbDir = path.join(this.photoDir, ".thumbs", category, periodFolder);
      const newThumbPath = path.join(newThumbDir, `${fileName}.webp`);
      try {
        await fs.access(oldThumbPath);
        await fs.mkdir(newThumbDir, { recursive: true });
        await fs.rename(oldThumbPath, newThumbPath).catch(async () => {
          await fs.copyFile(oldThumbPath, newThumbPath);
          await fs.unlink(oldThumbPath);
        });
      } catch (_) {}
    };

    for (const url of guideUrls) {
      await checkAndMigrate(url, "huong-dan");
    }
    for (const url of safetyUrls) {
      await checkAndMigrate(url, "an-toan");
    }
    for (const url of fiveSUrls) {
      if (!guideUrls.has(url) && !safetyUrls.has(url)) {
        await checkAndMigrate(url, "van-de-5s");
      }
    }

    try {
      const topEntries = await fs.readdir(this.photoDir, { withFileTypes: true });
      for (const entry of topEntries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === "van-de-5s" || entry.name === "an-toan" || entry.name === "huong-dan" || entry.name === ".thumbs") continue;
        const periodFolder = entry.name;
        const periodDirPath = path.join(this.photoDir, periodFolder);
        const files = await fs.readdir(periodDirPath, { withFileTypes: true });
        for (const file of files) {
          if (!file.isFile()) continue;
          const oldUrl = `/api/photos/${encodeURIComponent(periodFolder)}/${encodeURIComponent(file.name)}`;
          const category = safetyUrls.has(oldUrl) ? "an-toan" : "van-de-5s";
          await checkAndMigrate(oldUrl, category);
        }
        await fs.rmdir(periodDirPath).catch(() => {});
      }
    } catch (_) {}

    try {
      const thumbDir = path.join(this.photoDir, ".thumbs");
      const thumbEntries = await fs.readdir(thumbDir, { withFileTypes: true });
      for (const entry of thumbEntries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === "van-de-5s" || entry.name === "an-toan" || entry.name === "huong-dan") continue;
        const periodFolder = entry.name;
        const periodDirPath = path.join(thumbDir, periodFolder);
        const files = await fs.readdir(periodDirPath, { withFileTypes: true });
        for (const file of files) {
          if (!file.isFile()) continue;
          const fileName = file.name.replace(/\.webp$/, "");
          const oldUrl = `/api/photos/${encodeURIComponent(periodFolder)}/${encodeURIComponent(fileName)}`;
          const category = safetyUrls.has(oldUrl) ? "an-toan" : "van-de-5s";
          const newThumbDir = path.join(thumbDir, category, periodFolder);
          const oldThumbPath = path.join(periodDirPath, file.name);
          const newThumbPath = path.join(newThumbDir, file.name);
          await fs.mkdir(newThumbDir, { recursive: true });
          await fs.rename(oldThumbPath, newThumbPath).catch(async () => {
            await fs.copyFile(oldThumbPath, newThumbPath);
            await fs.unlink(oldThumbPath);
          });
        }
        await fs.rmdir(periodDirPath).catch(() => {});
      }
    } catch (_) {}

    if (urlMap.size > 0 && typeof repository.updateRoot === "function") {
      await repository.updateRoot((current) => {
        const replaceUrl = (url) => urlMap.get(url) || url;
        if (Array.isArray(current.scores)) {
          for (const item of current.scores) {
            if (item.photoDataUrl) item.photoDataUrl = replaceUrl(item.photoDataUrl);
            if (item.afterPhotoDataUrl) item.afterPhotoDataUrl = replaceUrl(item.afterPhotoDataUrl);
          }
        }
        if (Array.isArray(current.safetyRecords)) {
          for (const item of current.safetyRecords) {
            if (item.photoDataUrl) item.photoDataUrl = replaceUrl(item.photoDataUrl);
            if (item.afterPhotoDataUrl) item.afterPhotoDataUrl = replaceUrl(item.afterPhotoDataUrl);
          }
        }
        if (Array.isArray(current.fiveSFindings)) {
          for (const sheet of current.fiveSFindings) {
            for (const row of sheet?.rows || []) {
              if (row.photoDataUrl) row.photoDataUrl = replaceUrl(row.photoDataUrl);
              if (row.afterPhotoDataUrl) row.afterPhotoDataUrl = replaceUrl(row.afterPhotoDataUrl);
            }
          }
        }
        if (current.userGuides && typeof current.userGuides === "object") {
          for (const guide of Object.values(current.userGuides)) {
            for (const step of guide?.steps || []) {
              if (step.imageUrl) step.imageUrl = replaceUrl(step.imageUrl);
              if (Array.isArray(step.images)) {
                for (const img of step.images) {
                  if (img.imageUrl) img.imageUrl = replaceUrl(img.imageUrl);
                }
              }
            }
          }
        }
      }, {
        touchedRootKeys: ["scores", "safetyRecords", "fiveSFindings", "userGuides"],
      });
      console.log(`[Photo Migration] Đã chuyển đổi ${urlMap.size} liên kết ảnh và phân loại vào data/photos/van-de-5s, data/photos/an-toan và data/photos/huong-dan.`);
    }

    return { migrated: migratedCount, updatedRefs: urlMap.size };
  }
  writeData(command = {}, authContext = null, { includeRevision = false } = {}) {
    const operation = String(command.operation || "");
    const targetPath = String(command.path || "");
    const rootKeys = touchedRootKeys(command);
    const changedRootKeys = rootKeys === null ? null : new Set(rootKeys);
    const changedRecords = touchedRecordIds(command);
    const changedRecordFields = touchedRecordFields(command);
    const safetyIdsToValidate = isSafetyPhotoAnnotationPatch(command) ? [] : safetyRecordIdsToValidate(command);
    let resultingRoot = null;

    return this.repository.updateRoot((currentRoot) => {
      this.authService?.assertDataWriteAllowed(command, authContext, currentRoot);
      const scoreConflict = command.scoreConflict;
      if (scoreConflict) {
        const slotFields = ["periodId", "areaId", "itemId", "criterionId", "scoreSource"];
        const slotSource = normalizeScoreSource(scoreConflict.slot?.scoreSource);
        const validSlot = slotFields.every((field) => typeof scoreConflict.slot?.[field] === "string" && Boolean(scoreConflict.slot[field]))
          && (!MULTI_DAY_SCORE_SOURCES.has(slotSource) || /^\d{4}-\d{2}-\d{2}$/.test(String(scoreConflict.slot?.scoreDate || "").trim()));
        if (!targetPath.startsWith("scores/") || !validSlot || !["self", "assessor", "at5s", "departmentHead"].includes(slotSource)) {
          throw createHttpError("Yêu cầu kiểm tra xung đột điểm không hợp lệ.", 400);
        }
        const currentScore = findScoreForSlot(currentRoot, scoreConflict.slot);
        const desiredScore = operation === "remove" ? null : command.value;
        if (sameScoreValue(currentScore, desiredScore)) {
          resultingRoot = currentRoot;
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
      nextRoot = mergeCurrentSessionHistory(currentRoot, nextRoot, command, authContext);

      if (!changedRootKeys || ["areas", "safetyAreas", "periods", "managers", "safetyManagers"].some((key) => changedRootKeys.has(key))) {
        assertZoneManagersNotReplaced(currentRoot, nextRoot, command.allowZoneManagerReassignment === true);
      }
      // Full collection imports may contain historical records without actual dates.
      // Keep them intact; reports explicitly flag missing dates instead of inferring them.
      const legacyImport = targetPath === "safetyRecords" || (targetPath === "" && Object.prototype.hasOwnProperty.call(command.value || {}, "safetyRecords"));
      const recordsToCheck = safetyIdsToValidate === null
        ? recordEntries(nextRoot?.safetyRecords)
        : safetyIdsToValidate.map((id) => [id, recordById(nextRoot?.safetyRecords, id)]).filter(([, record]) => record);
      const legacyScores = safetyIdsToValidate?.some((id) => String(id).startsWith("safety-"))
        ? (Array.isArray(currentRoot?.scores) ? currentRoot.scores : Object.values(currentRoot?.scores || {}))
        : [];
      for (const [key, record] of recordsToCheck) {
        const recordId = String(record?.id || key);
        let previous = recordById(currentRoot?.safetyRecords, recordId);
        if (!previous && recordId.startsWith("safety-")) {
          const legacyScoreId = recordId.slice("safety-".length);
          const legacyScore = legacyScores.find((score) => String(score?.id || "") === legacyScoreId);
          if (legacyScore) {
            previous = {
              ...legacyScore,
              id: recordId,
              issueStatus: legacyScore.issueStatus || (legacyScore.note || legacyScore.photoDataUrl ? "open" : ""),
            };
          }
        }
        if (!record || legacyImport || JSON.stringify(record) === JSON.stringify(previous)) continue;
        const period = Object.values(nextRoot?.periods || {}).find((item) => item?.id === record.periodId);
        const allowMissingDates = SafetyTimeline.autoClosedForImprovementResponse(record, previous);
        const error = SafetyTimeline.validate(record, previous, period?.year, { allowMissingDates });
        if (error) throw createHttpError(error, 400);
      }
      const collectionsToPrepare = changedRootKeys
        ? new Set(["accounts", "history"].filter((key) => changedRootKeys.has(key)))
        : null;
      const preparedRoot = this.authService && (!collectionsToPrepare || collectionsToPrepare.size)
        ? this.authService.prepareRootForStorage(nextRoot, currentRoot, { mutate: true, collections: collectionsToPrepare })
        : nextRoot;
      if (changedRootKeys) {
        if (this.authService && (!collectionsToPrepare || collectionsToPrepare.has("history")) && hasExpiredHistoryEntries(currentRoot?.history)) {
          changedRootKeys.add("history");
          if (changedRecords) changedRecords.history = null;
        }
        if ((!collectionsToPrepare || collectionsToPrepare.has("accounts")) && hasLegacyAccountSecrets(currentRoot?.accounts)) {
          changedRootKeys.add("accounts");
          if (changedRecords) changedRecords.accounts = null;
        }
      }
      resultingRoot = preparedRoot;
      return preparedRoot;
    }, {
      touchedRootKeys: changedRootKeys,
      touchedRecords: changedRecords,
      touchedRecordFields: changedRecordFields,
      immutableMutator: true,
      ...(includeRevision ? { includeRevision: true, compactResult: true } : {}),
    }).then((result) => {
      if (includeRevision && !Object.prototype.hasOwnProperty.call(result || {}, "root")) {
        return {
          revision: result?.revision ?? null,
          ...writeAcknowledgement(command, resultingRoot, this.authService, authContext),
        };
      }
      const hasRevision = isPlainObject(result) && Object.prototype.hasOwnProperty.call(result, "root");
      const root = hasRevision ? result.root : result;
      const safeRoot = this.authService ? this.authService.sanitizeRoot(root, authContext?.rawAccount || authContext?.account) : root;
      return includeRevision ? { root: safeRoot, revision: hasRevision ? result.revision : null } : safeRoot;
    });
  }
}

module.exports = {
  DataService,
  sameScoreValue,
};
