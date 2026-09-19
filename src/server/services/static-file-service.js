"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};
const PUBLIC_ROOT_FILES = new Set(["404.html", "app.js", "index.html", "manifest.json", "service-worker.js", "standards.js", "styles.css"]);
const PUBLIC_DIRECTORIES = new Set(["images", "modules"]);
const APP_ROUTES = new Set([
  "/",
  "/login",
  "/home",
  "/assessor",
  "/summary",
  "/safety",
  "/issue-stats",
  "/catalog",
  "/accounts",
  "/data",
]);

function normalizeRoutePath(requestPath) {
  return String(requestPath || "/").replace(/\/+$/, "") || "/";
}

function isAppRoute(routePath) {
  return APP_ROUTES.has(routePath) || !path.posix.extname(routePath);
}

function toPublicPath(requestPath) {
  const routePath = normalizeRoutePath(requestPath);
  return isAppRoute(routePath) ? "/index.html" : requestPath;
}

function isInsideRoot(rootDir, filePath) {
  const relativePath = path.relative(rootDir, filePath);
  return Boolean(relativePath) && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function isPublicAsset(rootDir, filePath) {
  const relativePath = path.relative(rootDir, filePath).split(path.sep).join("/");
  const [firstSegment] = relativePath.split("/");
  return PUBLIC_ROOT_FILES.has(relativePath) || PUBLIC_DIRECTORIES.has(firstSegment);
}

class StaticFileService {
  constructor({ rootDir }) {
    this.rootDir = rootDir;
  }

  async getFile(requestPath) {
    const publicPath = toPublicPath(requestPath);
    const decodedPath = decodeURIComponent(publicPath);
    const filePath = path.resolve(this.rootDir, `.${decodedPath}`);

    if (!isInsideRoot(this.rootDir, filePath) || !isPublicAsset(this.rootDir, filePath)) {
      return { statusCode: 403 };
    }

    try {
      const stat = await fs.stat(filePath);
      const targetPath = stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
      const extname = path.extname(targetPath).toLowerCase();
      const body = await fs.readFile(targetPath);

      return {
        statusCode: 200,
        contentType: MIME_TYPES[extname] || "application/octet-stream",
        body,
      };
    } catch (error) {
      if (error.code === "ENOENT") {
        return { statusCode: 404 };
      }
      throw error;
    }
  }
}

module.exports = {
  StaticFileService,
};