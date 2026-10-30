"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { loadDotEnv, createPoolConfig } = require("../src/server/config/database-config");
const { PostgresRepository, rootCounts } = require("../src/server/repositories/postgres-repository");

const projectDir = path.resolve(__dirname, "..");
loadDotEnv(path.join(projectDir, ".env"));

function resolveSourcePath() {
  const dataDir = path.resolve(process.env.DATA_DIR || path.join(projectDir, "data"));
  const fileName = process.env.DATA_FILE || "runtime/main-data.json";
  const filePath = path.resolve(dataDir, fileName);
  const relativePath = path.relative(dataDir, filePath);
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("DATA_FILE phải nằm bên trong DATA_DIR.");
  }
  return filePath;
}

function checksum(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

async function main() {
  const sourcePath = resolveSourcePath();
  const sourceText = await fs.readFile(sourcePath, "utf8");
  let sourceRoot;
  try {
    sourceRoot = JSON.parse(sourceText);
  } catch (_) {
    throw new Error("Tệp dữ liệu nguồn không phải JSON hợp lệ; chưa ghi dữ liệu vào PostgreSQL.");
  }
  if (!sourceRoot || typeof sourceRoot !== "object" || Array.isArray(sourceRoot)) {
    throw new Error("Tệp dữ liệu nguồn không có cấu trúc đối tượng; chưa ghi dữ liệu vào PostgreSQL.");
  }

  const sourceSha256 = checksum(sourceText);
  const repository = new PostgresRepository({ poolConfig: createPoolConfig() });
  try {
    await repository.initialize();
    const result = await repository.importRoot(sourceRoot, {
      sourceSha256,
      sourceFile: path.relative(projectDir, sourcePath),
    }, async () => {
      const currentText = await fs.readFile(sourcePath, "utf8");
      return checksum(currentText) === sourceSha256;
    });
    console.log(result.alreadyImported
      ? "PostgreSQL đã nhập đúng bản JSON này trước đó; không có dữ liệu nào bị ghi đè."
      : "Đã nhập và đối chiếu dữ liệu thành công trong PostgreSQL.");
    console.log(JSON.stringify({ counts: result.counts || rootCounts(sourceRoot), sourceFile: path.relative(projectDir, sourcePath) }, null, 2));
    console.log("Tệp JSON nguồn được giữ nguyên làm bản lưu; ứng dụng sẽ dùng PostgreSQL sau khi chuyển cấu hình.");
  } finally {
    await repository.close();
  }
}

function collectErrorCodes(error, seen = new Set()) {
  if (!error || seen.has(error)) return [];
  seen.add(error);
  return [error.code, ...(error.errors || []).flatMap((item) => collectErrorCodes(item, seen)), ...collectErrorCodes(error.cause, seen)]
    .filter((code) => typeof code === "string");
}

function safeDatabaseError(error) {
  const codes = collectErrorCodes(error);
  if (codes.includes("ECONNREFUSED")) return "Không kết nối được PostgreSQL tại localhost:5432 (ECONNREFUSED). Hãy bật dịch vụ PostgreSQL rồi chạy lại lệnh.";
  if (codes.includes("EACCES")) return "Môi trường hiện tại không được phép truy cập cổng PostgreSQL. Hãy chạy lại lệnh trong PowerShell trên máy chủ ứng dụng.";
  if (codes.includes("ENOTFOUND")) return "Không tìm thấy máy chủ PostgreSQL theo tên host đã cấu hình.";
  if (codes.includes("28P01")) return "PostgreSQL từ chối thông tin xác thực. Kiểm tra POSTGRES_USER và POSTGRES_PASSWORD trong .env.";
  if (codes.includes("3D000")) return "Database trong .env chưa tồn tại trên PostgreSQL.";
  return error.message || codes[0] || "Lỗi PostgreSQL chưa xác định.";
}

main().catch((error) => {
  console.error(`Chuyển dữ liệu thất bại: ${safeDatabaseError(error)}`);
  console.error("Tệp JSON nguồn vẫn được giữ nguyên. Không có thao tác xóa dữ liệu nguồn.");
  process.exitCode = 1;
});
