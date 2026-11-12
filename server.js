"use strict";

const path = require("node:path");
const { AuthController } = require("./src/server/controllers/auth-controller");
const { DataController } = require("./src/server/controllers/data-controller");
const { MailController } = require("./src/server/controllers/mail-controller");
const { StaticFileController } = require("./src/server/controllers/static-file-controller");
const { PostgresRepository } = require("./src/server/repositories/postgres-repository");
const { loadDotEnv, createPoolConfig } = require("./src/server/config/database-config");
const { createAppServer } = require("./src/server/app-server");
const { AuthService } = require("./src/server/services/auth-service");
const { DataService } = require("./src/server/services/data-service");
const { SmtpMailService } = require("./src/server/services/smtp-mail-service");
const { StaticFileService } = require("./src/server/services/static-file-service");

loadDotEnv(path.join(__dirname, ".env"));

const HOST = process.env.HOST || "127.0.0.1";
const START_PORT = Number(process.env.PORT) || 5501;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, "data");
const PHOTO_DIR = process.env.PHOTO_DIR ? path.resolve(process.env.PHOTO_DIR) : path.join(DATA_DIR, "photos");
const CORS_ORIGIN = process.env.CORS_ORIGIN || "";

function createServer({ repository } = {}) {
  const dataRepository = repository || new PostgresRepository({ poolConfig: createPoolConfig() });
  const authService = new AuthService({ repository: dataRepository, secret: process.env.JWT_SECRET || "" });
  const dataService = new DataService({ repository: dataRepository, photoDir: PHOTO_DIR, authService });
  const dataController = new DataController({ dataService, authService });
  const authController = new AuthController({
    authService,
    onSessionReplaced: (sessionId) => dataController.revokeSession(sessionId),
  });

  const staticFileService = new StaticFileService({ rootDir: __dirname });
  const staticFileController = new StaticFileController({ staticFileService });
  const mailService = new SmtpMailService();
  const mailController = new MailController({ mailService });

  return {
    dataRepository,
    dataService,
    photoDir: PHOTO_DIR,
    server: createAppServer({
      authController,
      authService,
      dataController,
      staticFileController,
      mailController,
      corsOrigin: CORS_ORIGIN,
    }),
  };
}

async function listen(port) {
  const { dataRepository, dataService, photoDir, server } = createServer();
  await dataRepository.initialize();
  const initialRoot = await dataRepository.readRoot();
  if (!initialRoot || !Object.keys(initialRoot).length) {
    await dataRepository.close();
    throw new Error("PostgreSQL chưa có dữ liệu. Hãy chạy npm run migrate:postgres để nhập dữ liệu hiện có trước khi khởi động ứng dụng.");
  }

  // Tự động phân loại ảnh vào thư mục van-de-5s, an-toan và huong-dan nếu còn ảnh cũ
  if (dataService?.migrateLegacyPhotos) {
    try {
      await dataService.migrateLegacyPhotos(dataRepository);
    } catch (error) {
      console.warn("Cảnh báo khi kiểm tra/phân loại thư mục ảnh:", error.message);
    }
  }

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Cổng ${port} đang bị chiếm dụng. Vui lòng kiểm tra lại tiến trình đang chạy.`);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  });

  server.listen(port, HOST, () => {
    console.log(`LeGroup 5S đang chạy tại http://${HOST}:${port}`);
    console.log("Kho dữ liệu ứng dụng: PostgreSQL; dữ liệu JSON không được dùng khi chạy.");
    console.log(`Ảnh nén: ${photoDir}`);
  });

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(() => {
      dataRepository.close().finally(() => { process.exitCode = 0; });
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

async function seedAccounts(repository, seedData = {}) {
  if (!repository || typeof repository.updateRoot !== "function") return;
  return repository.updateRoot((currentRoot) => {
    const root = currentRoot && typeof currentRoot === "object" ? currentRoot : {};
    const existingAccounts = root.accounts && typeof root.accounts === "object" ? Object.keys(root.accounts) : [];
    if (existingAccounts.length > 0) return root;
    return {
      ...root,
      accounts: { ...seedData },
    };
  }, { touchedRootKeys: ["accounts"] });
}

if (require.main === module) {
  listen(START_PORT).catch((error) => { console.error(error); process.exitCode = 1; });
}

module.exports = { createServer, seedAccounts };
