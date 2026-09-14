"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DATA_DIR = path.join(__dirname, "..", "data");
const SAMPLES_DIR = path.join(DATA_DIR, "samples", "2024");
const DATA_FILE = path.join(DATA_DIR, "runtime", "main-data.json");

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function toArray(value) {
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

function mergeArrayById(existing, incoming) {
  const map = new Map();
  for (const item of toArray(existing)) {
    if (item?.id) map.set(item.id, item);
  }
  for (const item of toArray(incoming)) {
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

function loadSamplePayloads() {
  const files = fs.readdirSync(SAMPLES_DIR).filter((f) => f.endsWith(".json"));
  const payloads = [];

  for (const file of files) {
    const data = readJson(path.join(SAMPLES_DIR, file));
    if (data?.payload) {
      console.log(`  Đọc: ${file} (page: ${data.page || "?"})`);
      payloads.push(data.payload);
    }
  }

  return payloads;
}

function mergeSampleData() {
  console.log("Nạp dữ liệu mẫu vào main-data.json...\n");

  const root = readJson(DATA_FILE) || {};
  const payloads = loadSamplePayloads();

  if (!payloads.length) {
    console.log("\nKhông tìm thấy file mẫu trong", SAMPLES_DIR);
    return;
  }

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
        root[key] = mergeArrayById(root[key] || [], payload[key]);
      }
    }

    for (const key of objectKeys) {
      if (payload[key] && typeof payload[key] === "object") {
        root[key] = { ...(root[key] || {}), ...payload[key] };
      }
    }
  }

  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(root) + "\n", "utf8");

  console.log("\nĐã nạp xong! Tóm tắt:");
  for (const key of arrayKeys) {
    if (Array.isArray(root[key]) && root[key].length) {
      console.log(`  ${key}: ${root[key].length} bản ghi`);
    }
  }
  console.log(`\nFile: ${DATA_FILE}`);
}

mergeSampleData();
