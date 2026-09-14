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
const START_PORT = Number(process.env.PORT) || 5600;
const MAX_PORT = START_PORT + 20;
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

async function seedAccounts(repository) {
  const seedMap = loadSeedAccounts();
  const seedEntries = Object.entries(seedMap);
  if (!seedEntries.length) {
    return;
  }

  await repository.updateRoot((currentRoot) => {
    const root = currentRoot || {};
    if (!root.accounts || typeof root.accounts !== "object") {
      root.accounts = {};
    }

    const existingByUsername = new Map();
    for (const [id, account] of Object.entries(root.accounts)) {
      if (account?.username) {
        existingByUsername.set(account.username, id);
      }
    }

    let changed = false;
    for (const [seedId, seedAccount] of seedEntries) {
      if (!seedAccount?.username) continue;

      const existingId = existingByUsername.get(seedAccount.username);
      if (existingId) {
        const existing = root.accounts[existingId];
        const updated = { ...existing };
        if (seedAccount.role) updated.role = seedAccount.role;
        if (seedAccount.name) updated.name = seedAccount.name;
        if (seedAccount.passwordHash) updated.passwordHash = seedAccount.passwordHash;
        if (seedAccount.accessTypes) updated.accessTypes = seedAccount.accessTypes;
        if (seedAccount.rolesByType) updated.rolesByType = seedAccount.rolesByType;
        if (seedAccount.areaIds) updated.areaIds = seedAccount.areaIds;
        if (seedAccount.fiveSAreaIds) updated.fiveSAreaIds = seedAccount.fiveSAreaIds;
        if (seedAccount.safetyAreaIds) updated.safetyAreaIds = seedAccount.safetyAreaIds;
        if (seedAccount.assessorId) updated.assessorId = seedAccount.assessorId;
        if (seedAccount.fiveSAssessorId) updated.fiveSAssessorId = seedAccount.fiveSAssessorId;
        if (seedAccount.safetyAssessorId) updated.safetyAssessorId = seedAccount.safetyAssessorId;
        if (seedAccount.scorerId) updated.scorerId = seedAccount.scorerId;
        if (seedAccount.fiveSScorerId) updated.fiveSScorerId = seedAccount.fiveSScorerId;
        if (seedAccount.safetyScorerId) updated.safetyScorerId = seedAccount.safetyScorerId;
        root.accounts[existingId] = updated;
        changed = true;
      } else {
        root.accounts[seedId] = { ...seedAccount, id: seedId };
        changed = true;
      }
    }

    if (changed) {
      console.log(`Đã đồng bộ ${seedEntries.length} tài khoản từ seed-accounts.json.`);
    }
    return root;
  });
}

const SAMPLES_DIR = path.join(__dirname, "data", "samples", "2024");

function loadSamplePayloads() {
  try {
    const files = fs.readdirSync(SAMPLES_DIR).filter((f) => f.endsWith(".json"));
    const payloads = [];
    for (const file of files) {
      try {
        const text = fs.readFileSync(path.join(SAMPLES_DIR, file), "utf8");
        const data = JSON.parse(text);
        if (data?.payload) {
          payloads.push(data.payload);
        }
      } catch (err) {
        console.warn(`Lỗi đọc file mẫu ${file}:`, err.message);
      }
    }
    return payloads;
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("Không đọc được thư mục samples:", error.message);
    }
    return [];
  }
}

function toArrayHelper(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    return Object.entries(value).map(([k, v]) => {
      if (v && typeof v === "object") {
        return { id: v.id || k, ...v };
      }
      return v;
    });
  }
  return [];
}

function mergeArrayByIdHelper(existing, incoming) {
  const map = new Map();
  for (const item of toArrayHelper(existing)) {
    if (item?.id) map.set(item.id, item);
  }
  for (const item of toArrayHelper(incoming)) {
    if (item?.id) {
      const prev = map.get(item.id);
      if (prev) {
        map.set(item.id, { ...item, ...prev, settingsSnapshot: prev.settingsSnapshot || item.settingsSnapshot });
      } else {
        map.set(item.id, item);
      }
    }
  }
  return [...map.values()];
}

async function seedSampleData(repository) {
  const payloads = loadSamplePayloads();
  if (!payloads.length) return;

  await repository.updateRoot((currentRoot) => {
    const root = currentRoot || {};

    const arrayKeys = [
      "periods", "managers", "assessors", "areas", "scores",
      "departmentHeadContacts",
      "safetyManagers", "safetyAssessors", "safetyAreas",
      "safetyDepartmentHeadContacts", "safetyDepartmentGroups",
      "safetyRecords",
    ];

    const objectKeys = [
      "fiveSChartTargets", "safetyReport", "safetyIdentificationOverrides",
    ];

    for (const payload of payloads) {
      for (const key of arrayKeys) {
        if (Array.isArray(payload[key]) && payload[key].length) {
          root[key] = mergeArrayByIdHelper(root[key] || [], payload[key]);
        }
      }

      for (const key of objectKeys) {
        if (payload[key] && typeof payload[key] === "object") {
          root[key] = { ...(root[key] || {}), ...payload[key] };
        }
      }
    }

    return root;
  });
}

function createServer() {
  const dataRepository = new JsonFileRepository({ dataDir: DATA_DIR, fileName: DATA_FILE });
  const authService = new AuthService({ repository: dataRepository, secret: process.env.JWT_SECRET || "" });
  const authController = new AuthController({ authService });
  const dataService = new DataService({ repository: dataRepository, photoDir: PHOTO_DIR, authService });
  const dataController = new DataController({ dataService });

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
  await seedSampleData(dataRepository);

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

listen(START_PORT);
