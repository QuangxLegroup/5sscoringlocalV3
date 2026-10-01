"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { AuthController } = require("./src/server/controllers/auth-controller");
const { DataController } = require("./src/server/controllers/data-controller");
const { MailController } = require("./src/server/controllers/mail-controller");
const { StaticFileController } = require("./src/server/controllers/static-file-controller");
const { JsonFileRepository } = require("./src/server/repositories/json-file-repository");
const { createAppServer } = require("./src/server/app-server");
const { AuthService } = require("./src/server/services/auth-service");
const { DataService } = require("./src/server/services/data-service");
const { SmtpMailService } = require("./src/server/services/smtp-mail-service");
const { StaticFileService } = require("./src/server/services/static-file-service");

const HOST = process.env.HOST || "127.0.0.1";
const START_PORT = Number(process.env.PORT) || 5555;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, "data");
const DATA_FILE = process.env.DATA_FILE || "runtime/main-data.json";
const PHOTO_DIR = process.env.PHOTO_DIR ? path.resolve(process.env.PHOTO_DIR) : path.join(DATA_DIR, "photos");
const CORS_ORIGIN = process.env.CORS_ORIGIN || "";
const SEED_ACCOUNTS_FILE = path.join(__dirname, "data", "seed-accounts.json");

function loadSeedAccounts() {
  try {
    const text = fs.readFileSync(SEED_ACCOUNTS_FILE, "utf8");
    const data = JSON.parse(text);
    if (!data || !data.accounts || typeof data.accounts !== "object") {
      return {};
    }
    return data.accounts;
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("Không đọc được file seed-accounts.json:", error.message);
    }
    return {};
  }
}

async function seedAccounts(repository, seedMap = loadSeedAccounts()) {
  const seedEntries = Object.entries(seedMap);
  if (!seedEntries.length) {
    return;
  }

  await repository.updateRoot((currentRoot) => {
    const root = currentRoot || {};
    if (!root.accounts || typeof root.accounts !== "object") {
      root.accounts = {};
    }

    // Seeds bootstrap an empty installation only. Runtime accounts are authoritative.
    if (Object.values(root.accounts).some((account) => account?.username)) return root;

    let changed = false;
    for (const [seedId, seedAccount] of seedEntries) {
      if (!seedAccount?.username) continue;

      root.accounts[seedId] = { ...seedAccount, id: seedId };
      changed = true;
    }

    if (changed) {
      console.log(`Đã khởi tạo tài khoản từ seed-accounts.json cho dữ liệu mới.`);
    }
    return root;
  });
}

function createServer() {
  const dataRepository = new JsonFileRepository({ dataDir: DATA_DIR, fileName: DATA_FILE });
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
    dataFile: dataRepository.filePath,
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
  const { dataRepository, dataFile, photoDir, server } = createServer();

  await seedAccounts(dataRepository);

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
    console.log(`Dữ liệu nội bộ: ${dataFile}`);
    console.log(`Ảnh nén: ${photoDir}`);
  });
}

if (require.main === module) {
  listen(START_PORT).catch((error) => { console.error(error); process.exitCode = 1; });
}

module.exports = { createServer, seedAccounts };
