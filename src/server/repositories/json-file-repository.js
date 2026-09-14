"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const ORGANIZED_DIR_NAME = "organized";
const LEGACY_DATA_FILE_NAME = "legroup-5s.json";
const FIVE_S_PERIOD_TYPE = "5s";
const SAFETY_PERIOD_TYPE = "safety";
const COLLECTION_FILE_MAP = [
  { file: "danh-muc/ky-danh-gia.json", keys: ["periods", "activePeriodId", "activeFiveSPeriodId", "activeSafetyPeriodId"] },
  { file: "danh-muc/5s-zone.json", keys: ["areas", "managers", "assessors", "departmentHeadContacts", "fiveSChartTargets"] },
  { file: "danh-muc/at-zone.json", keys: ["safetyAreas", "safetyManagers", "safetyAssessors", "safetyDepartmentGroups", "safetyDepartmentHeadContacts", "safetyReport", "safetyIdentificationOverrides"] },
  { file: "tai-khoan/accounts.json", keys: ["accounts", "history"] },
  { file: "he-thong/settings.json", keys: ["schemaVersion", "updatedAt", "createdAt"] },
];

function clone(value) {
  if (value === undefined) {
    return null;
  }
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeMonth(month) {
  const value = Number(month);
  return Number.isInteger(value) && value >= 1 && value <= 12 ? String(value).padStart(2, "0") : "khong-ro-thang";
}

function safeYear(year) {
  const value = Number(year);
  return Number.isInteger(value) && value >= 2020 && value <= 2100 ? String(value) : "khong-ro-nam";
}

function periodKey(period) {
  return `${safeYear(period?.year)}/${safeMonth(period?.month)}.json`;
}

function pickKeys(root, keys) {
  return keys.reduce((result, key) => {
    if (Object.prototype.hasOwnProperty.call(root, key)) {
      result[key] = clone(root[key]);
    }
    return result;
  }, {});
}

function groupPeriodsByType(periods = []) {
  const periodById = new Map();
  periods.forEach((period) => {
    if (period?.id) {
      periodById.set(period.id, period);
    }
  });
  return periodById;
}

function groupRowsByPeriod(rows = [], periodById) {
  return rows.reduce((groups, row) => {
    const period = periodById.get(row?.periodId);
    const key = periodKey(period);
    if (!groups.has(key)) {
      groups.set(key, { period: period ? clone(period) : null, rows: [] });
    }
    groups.get(key).rows.push(clone(row));
    return groups;
  }, new Map());
}

async function writeJsonFile(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
}

function isInsideRoot(rootDir, filePath) {
  const relativePath = path.relative(rootDir, filePath);
  return Boolean(relativePath) && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function isInsideOrSameRoot(rootDir, filePath) {
  const relativePath = path.relative(rootDir, filePath);
  return !relativePath || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

class JsonFileRepository {
  constructor({ dataDir, fileName, organizedDirName = ORGANIZED_DIR_NAME }) {
    this.dataDir = path.resolve(dataDir);
    this.filePath = path.resolve(this.dataDir, fileName);
    this.legacyFilePath = path.resolve(this.dataDir, LEGACY_DATA_FILE_NAME);
    this.organizedDir = path.resolve(this.dataDir, organizedDirName);
    if (!isInsideOrSameRoot(this.dataDir, this.filePath)) {
      throw new Error("Duong dan DATA_FILE khong hop le.");
    }
    this.writeQueue = Promise.resolve();
    this.readCache = null;
    this.organizedTimer = null;
    this.latestOrganizedRoot = null;
  }

  async readRoot() {
    try {
      const stat = await fs.stat(this.filePath);
      if (this.readCache && this.readCache.size === stat.size && this.readCache.mtimeMs === stat.mtimeMs) {
        return clone(this.readCache.root);
      }

      const text = await fs.readFile(this.filePath, "utf8");
      if (!text.trim()) {
        this.readCache = { size: stat.size, mtimeMs: stat.mtimeMs, root: null };
        return null;
      }
      const root = JSON.parse(text);
      this.readCache = { size: stat.size, mtimeMs: stat.mtimeMs, root: clone(root) };
      return root;
    } catch (error) {
      if (error.code === "ENOENT") {
        const migratedRoot = await this.readLegacyRoot();
        if (migratedRoot) {
          await this.persistRoot(migratedRoot);
          return clone(migratedRoot);
        }
        this.readCache = null;
        return null;
      }
      throw error;
    }
  }

  async readLegacyRoot() {
    if (this.filePath === this.legacyFilePath) {
      return null;
    }
    try {
      const text = await fs.readFile(this.legacyFilePath, "utf8");
      return text.trim() ? JSON.parse(text) : null;
    } catch (error) {
      if (error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async updateRoot(mutator) {
    return this.enqueue(async () => {
      const currentRoot = await this.readRoot();
      const nextRoot = await mutator(clone(currentRoot));
      await this.persistRoot(nextRoot);
      return nextRoot;
    });
  }

  enqueue(task) {
    const run = this.writeQueue.then(task, task);
    this.writeQueue = run.catch(() => {});
    return run;
  }

  async persistRoot(root) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    const text = root === null ? "null\n" : `${JSON.stringify(root)}\n`;
    await fs.writeFile(tempPath, text, "utf8");
    await fs.rename(tempPath, this.filePath);
    const stat = await fs.stat(this.filePath);
    this.readCache = { size: stat.size, mtimeMs: stat.mtimeMs, root: clone(root) };
    this.schedulePersistOrganizedRoot(root);
  }

  schedulePersistOrganizedRoot(root) {
    if (!isPlainObject(root)) {
      return;
    }
    this.latestOrganizedRoot = root;
    if (this.organizedTimer) {
      clearTimeout(this.organizedTimer);
    }
    this.organizedTimer = setTimeout(async () => {
      this.organizedTimer = null;
      const rootToPersist = this.latestOrganizedRoot;
      if (rootToPersist) {
        try {
          await this.persistOrganizedRoot(rootToPersist);
        } catch (err) {
          console.warn("Lỗi khi ghi thư mục organized:", err);
        }
      }
    }, 1200);
  }

  async persistOrganizedRoot(root) {
    if (!isPlainObject(root)) {
      return;
    }

    if (path.basename(this.organizedDir) !== ORGANIZED_DIR_NAME || !isInsideRoot(this.dataDir, this.organizedDir)) {
      throw new Error("Thu muc organized khong hop le.");
    }
    await fs.rm(this.organizedDir, { recursive: true, force: true });
    await fs.mkdir(this.organizedDir, { recursive: true });
    await Promise.all(COLLECTION_FILE_MAP.map((entry) => {
      return writeJsonFile(path.join(this.organizedDir, entry.file), pickKeys(root, entry.keys));
    }));

    const periods = Array.isArray(root.periods) ? root.periods : [];
    const periodById = groupPeriodsByType(periods);
    const fiveSPeriods = periods.filter((period) => period?.type === FIVE_S_PERIOD_TYPE);
    const safetyPeriods = periods.filter((period) => period?.type === SAFETY_PERIOD_TYPE);
    await writeJsonFile(path.join(this.organizedDir, "cham-5s/periods.json"), fiveSPeriods);
    await writeJsonFile(path.join(this.organizedDir, "danh-gia-an-toan/periods.json"), safetyPeriods);

    const scoreGroups = groupRowsByPeriod(Array.isArray(root.scores) ? root.scores : [], periodById);
    await Promise.all([...scoreGroups.entries()].map(([key, group]) => {
      return writeJsonFile(path.join(this.organizedDir, "cham-5s", key), {
        period: group.period,
        scores: group.rows,
      });
    }));

    const safetyGroups = groupRowsByPeriod(Array.isArray(root.safetyRecords) ? root.safetyRecords : [], periodById);
    await Promise.all([...safetyGroups.entries()].map(([key, group]) => {
      return writeJsonFile(path.join(this.organizedDir, "danh-gia-an-toan", key), {
        period: group.period,
        safetyRecords: group.rows,
      });
    }));

    await writeJsonFile(path.join(this.organizedDir, "README.json"), {
      note: "Thu muc nay duoc tao tu dong tu file data chinh. Khong sua tay khi ung dung dang chay.",
      sourceFile: path.basename(this.filePath),
      generatedAt: new Date().toISOString(),
      folders: {
        "cham-5s": "Diem 5S tach theo nam/thang.",
        "danh-gia-an-toan": "Ban ghi danh gia an toan tach theo nam/thang.",
        "danh-muc": "Danh muc ky danh gia, zone, nguoi cham, target.",
        "tai-khoan": "Danh sach tai khoan va lich su phien.",
        "he-thong": "Thong tin he thong."
      }
    });
  }
}

module.exports = {
  JsonFileRepository,
};
