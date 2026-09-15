"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

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

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
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
    return {
      ok: true,
      dataFile: this.repository.filePath,
      photoDir: this.photoDir,
    };
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
};
