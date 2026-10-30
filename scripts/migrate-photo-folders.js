"use strict";

const path = require("node:path");
const { loadDotEnv, createPoolConfig } = require("../src/server/config/database-config");
const { PostgresRepository } = require("../src/server/repositories/postgres-repository");
const { DataService } = require("../src/server/services/data-service");

const projectDir = path.resolve(__dirname, "..");
loadDotEnv(path.join(projectDir, ".env"));

async function main() {
  const photoDir = process.env.PHOTO_DIR ? path.resolve(process.env.PHOTO_DIR) : path.join(projectDir, "data", "photos");
  const repository = new PostgresRepository({ poolConfig: createPoolConfig() });
  try {
    await repository.initialize();
    const dataService = new DataService({ repository, photoDir });
    console.log(`Bắt đầu phân loại ảnh trong: ${photoDir}`);
    const result = await dataService.migrateLegacyPhotos(repository);
    console.log(`Hoàn thành! Đã di chuyển ${result.migrated} tệp ảnh và cập nhật ${result.updatedRefs} đường dẫn liên kết.`);
  } finally {
    await repository.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Lỗi khi phân loại ảnh:", error);
    process.exitCode = 1;
  });
}

module.exports = { main };
