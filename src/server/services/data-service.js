"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const sharp = require("sharp");
const SafetyTimeline = require("../../../modules/core/safety-timeline");

const PHOTO_MAX_BYTES = 12 * 1024 * 1024;
const PHOTO_CONTENT_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
const PHOTO_FILE_EXTENSIONS = new Set(Object.keys(PHOTO_CONTENT_TYPES).map((extension) => `.${extension}`));
const HISTORY_RETENTION_MONTHS = 12;
const AUDIT_EXCLUDED_ROOT_KEYS = new Set(["history", "version"]);
const AUDIT_CATEGORY_BY_COLLECTION = new Map([
  ["safetyRecords", "safety"], ["deletedSafetyRecords", "safety"],
  ["fiveSFindings", "fiveSFindings"], ["scores", "fiveSScoring"], ["accounts", "accounts"],
]);
const AUDIT_FIELD_LABELS = {
  accessTypes: "Phạm vi quyền", actionOwner: "Người phụ trách", active: "Trạng thái tài khoản", afterPhotoDataUrl: "Ảnh sau xử lý",
  activeFiveSPeriodId: "Kỳ 5S đang mở", activeSafetyPeriodId: "Kỳ an toàn đang mở", activePeriodId: "Kỳ đang mở",
  areaId: "Zone", areaIds: "Zone được phân công", areaCode: "Mã Zone", scorerId: "Quản lý Zone", scorerName: "Quản lý Zone", assessorId: "Assessor",
  assessorName: "Assessor", assessors: "Assessor", at5sMemberId: "Thành viên Ban AT - 5S",
  completionDate: "Ngày hoàn thành", countermeasure: "Biện pháp khắc phục", departmentHead: "Trưởng phòng",
  departmentHeadEmployeeCode: "Mã nhân viên trưởng phòng", dueDate: "Hạn xử lý", employeeCode: "Mã nhân viên",
  issueDate: "Ngày phát hiện", issueLocation: "Zone", managerId: "Quản lý Zone", managerName: "Quản lý Zone",
  managers: "Quản lý Zone", name: "Tên", note: "Nội dung", permissions: "Quyền tài khoản", progress: "Tiến độ",
  role: "Vai trò", rolesByType: "Vai trò theo mục", safetyManagers: "Quản lý Zone an toàn",
  safetyAssessors: "Assessor an toàn", score: "Điểm", scoreSource: "Loại phiếu", status: "Trạng thái",
  fiveS: "Hạng mục 5S", problem: "Vấn đề phát hiện", location: "Vị trí", photoDataUrl: "Ảnh hiện trường",
  afterPhotoName: "Tên ảnh sau xử lý", photoName: "Tên ảnh hiện trường", zoneId: "Zone",
};
const AUDIT_IGNORED_FIELDS = new Set([
  "updatedAt", "createdAt", "lastUpdatedAt", "passwordHash", "passwordSalt", "password", "token",
  "activeSessionId", "sessionId", "sessionStartedAt", "sessionLastChangedAt", "thumbnailDataUrl",
]);

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
  const sessionId = String(authContext?.payload?.sid || "");
  if (!account || !sessionId) return nextRoot;

  const historyIds = [...new Set((commandPaths(command) || [])
    .filter((parts) => parts[0] === "history" && parts.length >= 2)
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

function mergeServerAuditEntriesIntoSession(currentRoot, nextRoot, command, authContext) {
  const sessionId = String(authContext?.payload?.sid || "");
  if (!sessionId) return nextRoot;
  const historyPaths = [...new Set((commandPaths(command) || [])
    .filter((parts) => parts[0] === "history" && parts.length >= 2)
    .map((parts) => parts[1]))];
  if (!historyPaths.length) return nextRoot;

  let result = nextRoot;
  for (const id of historyPaths) {
    const incoming = recordById(result?.history, id);
    if (!incoming || incoming.sessionId !== sessionId || incoming.serverGeneratedAudit) continue;
    const generated = recordEntries(currentRoot?.history)
      .filter(([, entry]) => entry?.serverGeneratedAudit && String(entry.sessionId || "") === sessionId);
    if (!generated.length) continue;

    const changes = [];
    const seen = new Set();
    const incomingChanges = Array.isArray(incoming.changes) ? incoming.changes : [];
    const generatedChanges = generated.flatMap(([, entry]) => Array.isArray(entry.changes) ? entry.changes : [])
      .filter((generatedChange) => !incomingChanges.some((detail) => auditChangesAreEquivalent(detail, generatedChange)));
    [...generatedChanges, ...incomingChanges]
      .forEach((change) => {
        const key = JSON.stringify(change);
        if (seen.has(key)) return;
        seen.add(key);
        changes.push(change);
      });
    const scopes = [...new Set([
      ...(Array.isArray(incoming.scopes) ? incoming.scopes : incoming.scope ? [incoming.scope] : []),
      ...changes.map((change) => change.scope).filter(Boolean),
    ])];
    result = setAtPath(result, `history/${id}`, {
      ...incoming,
      timestamp: incoming.timestamp || generated[0]?.[1]?.timestamp || new Date().toISOString(),
      sessionStartedAt: incoming.sessionStartedAt || generated[0]?.[1]?.sessionStartedAt || incoming.timestamp || new Date().toISOString(),
      sessionLastChangedAt: incoming.sessionLastChangedAt || generated[generated.length - 1]?.[1]?.sessionLastChangedAt || incoming.timestamp || new Date().toISOString(),
      changes,
      scopes,
      changeCount: changes.length,
      changeLabel: `Phiên đăng nhập có ${changes.length} thay đổi`,
      latestChange: incoming.latestChange || generated[generated.length - 1]?.[1]?.latestChange || "",
    });
    for (const [generatedId] of generated) result = removeAtPath(result, `history/${generatedId}`);
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
  if (operation === "set" && !target.length && isPlainObject(command.value)) {
    return Object.keys(command.value).map((key) => ({ path: pathParts(key).join("/"), removed: command.value[key] === null }));
  }
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
  cutoff.setMonth(cutoff.getMonth() - HISTORY_RETENTION_MONTHS);
  const cutoffMs = cutoff.getTime();
  const entries = Array.isArray(history) ? history : isPlainObject(history) ? Object.values(history) : [];
  return entries.some((entry) => {
    const timestamp = Date.parse(entry?.timestamp || entry?.sessionStartedAt || entry?.sessionLastChangedAt || "");
    return !Number.isFinite(timestamp) || timestamp < cutoffMs;
  });
}

function normalizeAuditPathPart(part) {
  return String(part || "").replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
}

function auditPathLabel(path) {
  const parts = pathParts(path).filter((part) => !/^\d+$/.test(part));
  const roleIndex = parts.lastIndexOf("rolesByType");
  if (roleIndex >= 0 && parts[roleIndex + 1]) return `Vai trò ${parts[roleIndex + 1] === "safety" ? "AT" : "5S"}`;
  const permissionIndex = parts.lastIndexOf("permissions");
  if (permissionIndex >= 0 && parts[permissionIndex + 1]) return `Quyền ${parts[permissionIndex + 1] === "safety" ? "AT" : "5S"}`;
  const field = parts[parts.length - 1] || "Dữ liệu";
  return AUDIT_FIELD_LABELS[field] || normalizeAuditPathPart(field) || "Dữ liệu";
}

function auditScopeForPath(root, collection, record, path = "") {
  if (["safetyRecords", "safetyAreas", "safetyManagers", "safetyAssessors", "safetyMonthlyTargets", "safetyIdentificationOverrides", "safetyDepartmentGroups", "safetyDepartmentHeadContacts", "safetyReport", "activeSafetyPeriodId"].includes(collection)) return "safety";
  if (["scores", "fiveSFindings"].includes(collection)) return "5s";
  if (collection === "activeFiveSPeriodId") return "5s";
  const parts = pathParts(path);
  if (parts.some((part) => ["safetyRecords", "safetyAreas", "safetyManagers", "safetyAssessors"].includes(part))) return "safety";
  if (collection === "accounts") {
    const roleTypeIndex = parts.findIndex((part) => part === "rolesByType" || part === "permissions");
    if (roleTypeIndex >= 0 && parts[roleTypeIndex + 1]) return parts[roleTypeIndex + 1] === "safety" ? "safety" : "5s";
  }
  if (collection === "periods" && record?.type) return String(record.type).toLowerCase().includes("safety") || String(record.type).toLowerCase().includes("at") ? "safety" : "5s";
  const periodId = String(record?.periodId || "");
  const period = recordEntries(root?.periods).map(([, item]) => item).find((item) => String(item?.id || "") === periodId);
  return String(period?.type || "").toLowerCase().includes("safety") || String(period?.type || "").toLowerCase().includes("at") ? "safety" : "5s";
}

function auditSectionForPath(collection, path) {
  if (["areas", "safetyAreas", "managers", "safetyManagers", "assessors", "safetyAssessors", "at5sMembers"].includes(collection)) return "Phân công và Zone";
  if (collection === "accounts") return "Tài khoản và quyền";
  if (collection === "periods") return "Kỳ đánh giá và thiết lập";
  if (collection === "scores") return "Chấm điểm 5S";
  if (collection === "safetyRecords" || collection === "deletedSafetyRecords") return "Đánh giá an toàn";
  if (collection === "fiveSFindings") return "Vấn đề 5S";
  if (["fiveSChartTargets", "safetyMonthlyTargets", "benchmark"].includes(collection)) return "Mục tiêu đánh giá";
  if (["safetyDepartmentGroups", "departmentHeadContacts", "safetyDepartmentHeadContacts"].includes(collection)) return "Cấu hình phòng ban";
  if (collection === "safetyIdentificationOverrides") return "Nhận diện nguy cơ";
  if (collection === "safetyReport") return "Thiết lập báo cáo an toàn";
  return auditPathLabel(path);
}

function auditDisplayValue(value, field, root) {
  if (value === null || value === undefined || value === "") return "(trống)";
  if (field === "photoDataUrl" || field === "afterPhotoDataUrl" || field === "photoName" || field === "afterPhotoName") return "Có ảnh";
  if (field === "photoAnnotations" || field === "afterPhotoAnnotations") return `${Array.isArray(value) ? value.length : 0} nét khoanh`;
  const areas = [
    ...recordEntries(root?.areas),
    ...recordEntries(root?.safetyAreas),
    ...recordEntries(root?.periods).flatMap(([, period]) => [
      ...recordEntries(period?.settingsSnapshot?.areas),
      ...recordEntries(period?.settingsSnapshot?.safetyAreas),
    ]),
  ].map(([, area]) => area);
  if (["areaId", "zoneId"].includes(field)) {
    const match = areas.find((area) => String(area?.id || "") === String(value));
    if (match?.code) return `Zone ${match.code}${match.name ? ` · ${match.name}` : ""}`;
  }
  if (["managerId", "scorerId", "assessorId", "at5sMemberId"].includes(field)) {
    const people = [
      ...recordEntries(root?.managers), ...recordEntries(root?.safetyManagers), ...recordEntries(root?.assessors),
      ...recordEntries(root?.safetyAssessors), ...recordEntries(root?.at5sMembers),
      ...recordEntries(root?.periods).flatMap(([, period]) => [
        ...recordEntries(period?.settingsSnapshot?.managers), ...recordEntries(period?.settingsSnapshot?.safetyManagers),
        ...recordEntries(period?.settingsSnapshot?.assessors), ...recordEntries(period?.settingsSnapshot?.safetyAssessors),
        ...recordEntries(period?.settingsSnapshot?.at5sMembers),
      ]),
    ].map(([, person]) => person);
    const person = people.find((item) => String(item?.id || "") === String(value));
    if (person?.name) return `${person.name}${person.employeeCode ? ` · ${person.employeeCode}` : ""}`;
  }
  if (field === "areaIds" || field === "safetyAreaIds" || field === "fiveSAreaIds") {
    const ids = Array.isArray(value) ? value : [value];
    const labels = ids.map((id) => {
      const match = areas.find((area) => String(area?.id || "") === String(id));
      return match?.code ? `Zone ${match.code}` : String(id || "");
    }).filter(Boolean);
    return labels.join(", ") || "(trống)";
  }
  if (field === "accessTypes") {
    const types = Array.isArray(value) ? value : [value];
    return types.map((type) => String(type) === "safety" ? "AT" : String(type) === "5s" ? "5S" : String(type)).join(", ");
  }
  if (field === "role") {
    const labels = { admin: "Admin", zoneOwner: "Quản lý Zone", manager: "Quản lý", assessor: "Assessor", assessor5s: "Assessor 5S", assessorSafety: "Assessor AT", at5s: "Ban AT - 5S", departmentHead: "Trưởng phòng", viewer: "Người xem" };
    return labels[String(value)] || String(value);
  }
  if (field === "rolesByType" && isPlainObject(value)) {
    return Object.entries(value).map(([type, role]) => `${type === "safety" ? "AT" : "5S"}: ${auditDisplayValue(role, "role", root)}`).join("; ");
  }
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (Array.isArray(value)) {
    const names = value.map((item) => item && typeof item === "object" ? (item.name || item.code || item.label || item.id || "") : item).filter(Boolean);
    return (names.length ? names.join(", ") : `${value.length} mục`).slice(0, 240);
  }
  if (typeof value === "object") {
    const safe = Object.fromEntries(Object.entries(value).filter(([key]) => !AUDIT_IGNORED_FIELDS.has(key) && !/password|token|secret|base64/i.test(key)));
    return JSON.stringify(safe).slice(0, 240) || "(trống)";
  }
  const text = String(value);
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

function auditRecordTarget(root, collection, record, recordId) {
  const zoneId = String(record?.areaId || record?.zoneId || record?.area?.id || "");
  const areas = [...recordEntries(root?.areas), ...recordEntries(root?.safetyAreas)].map(([, area]) => area);
  const zone = areas.find((area) => String(area?.id || "") === zoneId || String(area?.code || "") === String(record?.areaCode || ""));
  const zoneLabel = zone?.code ? `Zone ${zone.code}` : record?.areaCode ? `Zone ${record.areaCode}` : "";
  const subject = String(record?.problem || record?.note || record?.name || record?.employeeCode || record?.username || record?.code || recordId || "").trim();
  if (zoneLabel && subject) return `${zoneLabel} · ${subject.slice(0, 120)}`;
  if (zoneLabel) return zoneLabel;
  return subject || collection;
}

function auditObjectEntries(value) {
  if (Array.isArray(value)) return value.map((item, index) => [String(item?.id || item?.employeeCode || item?.name || index), item]);
  return isPlainObject(value) ? Object.entries(value) : [];
}

function buildAuditFieldChanges(before, after, context, result, output, depth = 0) {
  if (output.length >= 250 || depth > 8 || JSON.stringify(before) === JSON.stringify(after)) return;
  const beforeIsObject = isPlainObject(before) || Array.isArray(before);
  const afterIsObject = isPlainObject(after) || Array.isArray(after);
  if (beforeIsObject || afterIsObject) {
    const left = new Map(auditObjectEntries(beforeIsObject ? before : {}));
    const right = new Map(auditObjectEntries(afterIsObject ? after : {}));
    const keys = new Set([...left.keys(), ...right.keys()]);
    const isCollectionRoot = pathParts(context.path).length === 1;
    const collectionFields = new Set(["areas", "safetyAreas", "managers", "safetyManagers", "assessors", "safetyAssessors", "at5sMembers", "scores", "safetyRecords", "fiveSFindings"]);
    const nestedCollection = collectionFields.has(pathParts(context.path).at(-1));
    const entriesAreRecords = Array.isArray(before) || Array.isArray(after) || isCollectionRoot || nestedCollection;
    for (const key of keys) {
      if (output.length >= 250) break;
      const nextBefore = left.get(key);
      const nextAfter = right.get(key);
      const nextPath = [...pathParts(context.path), key].join("/");
      let childRecord = context.record;
      if (entriesAreRecords) {
        const candidate = nextAfter || nextBefore;
        if (isPlainObject(candidate)) {
          childRecord = {
            ...(context.record || {}),
            ...candidate,
            periodId: candidate.periodId || context.periodId || context.record?.periodId || (context.collection === "periods" ? context.record?.id : "") || "",
          };
          const parentCollection = pathParts(context.path).at(-1);
          if (["areas", "safetyAreas"].includes(parentCollection)) childRecord.areaId = childRecord.areaId || candidate.id || key;
        }
      }
      buildAuditFieldChanges(nextBefore, nextAfter, {
        ...context,
        path: nextPath,
        recordId: entriesAreRecords ? key : context.recordId,
        record: childRecord,
      }, result, output, depth + 1);
    }
    return;
  }

  const parts = pathParts(context.path);
  const field = parts[parts.length - 1] || context.collection;
  const isCredential = /password|token|secret|base64/i.test(field);
  if (AUDIT_IGNORED_FIELDS.has(field) && !isCredential) return;
  const parentRecord = context.record || (parts.length > 1 ? recordById(result?.[context.collection], context.recordId) : null);
  const action = before === null || before === undefined ? "Thêm" : after === null || after === undefined ? "Xóa" : "Sửa";
  const scope = auditScopeForPath(result, context.collection, parentRecord, context.path);
  const target = auditRecordTarget(result, context.collection, parentRecord, context.recordId);
  const displayField = parts.includes("rolesByType") ? "role"
    : parts.includes("areaIds") || parts.includes("safetyAreaIds") || parts.includes("fiveSAreaIds") ? "areaIds"
      : parts.includes("accessTypes") ? "accessTypes" : field;
  const beforeValue = isCredential ? (before ? "Đã thiết lập" : "Chưa thiết lập") : auditDisplayValue(before, displayField, result);
  const afterValue = isCredential ? (after ? "Đã cập nhật" : "Đã xóa") : auditDisplayValue(after, displayField, result);
  const beforePhoto = ["photoDataUrl", "afterPhotoDataUrl", "photoName", "afterPhotoName"].includes(field);
  const beforeDisplay = beforePhoto ? (before ? "Ảnh hiện tại" : "Không có ảnh") : beforeValue;
  const afterDisplay = beforePhoto ? (after ? "Ảnh sau cập nhật" : "Không có ảnh") : afterValue;
  const appliedPeriodId = String(context.periodId || parentRecord?.periodId
    || (context.collection === "periods" ? parentRecord?.id : "")
    || (scope === "safety" ? result?.activeSafetyPeriodId : result?.activeFiveSPeriodId)
    || "");
  output.push({
    category: context.category || AUDIT_CATEGORY_BY_COLLECTION.get(context.collection) || "catalog",
    section: auditSectionForPath(context.collection, context.path),
    action,
    label: isCredential ? "Thông tin xác thực" : auditPathLabel(context.path),
    target,
    before: before === null || before === undefined ? "" : beforeDisplay,
    after: after === null || after === undefined ? "" : afterDisplay,
    scope,
    periodId: appliedPeriodId,
    timestamp: new Date().toISOString(),
  });
}

function buildServerAuditChanges(currentRoot, nextRoot, command) {
  const changes = [];
  for (const write of writeChanges(command)) {
    const parts = pathParts(write.path);
    const collection = parts[0];
    if (!collection || AUDIT_EXCLUDED_ROOT_KEYS.has(collection)) continue;
    const before = valueAtPath(currentRoot, write.path);
    const after = write.removed ? null : valueAtPath(nextRoot, write.path);
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    const record = parts.length > 1 ? recordById(after === null ? currentRoot?.[collection] : nextRoot?.[collection], parts[1]) : null;
    const periodId = String(record?.periodId || (collection === "periods" ? parts[1] : ""));
    buildAuditFieldChanges(before, after, {
      path: write.path,
      collection,
      recordId: parts[1] || "",
      record,
      periodId,
      category: AUDIT_CATEGORY_BY_COLLECTION.get(collection) || "catalog",
    }, nextRoot, changes);
  }
  if (changes.length > 250) changes.length = 250;
  return changes;
}

function commandContainsMeaningfulHistory(command, currentRoot, nextRoot) {
  return writeChanges(command).some((write) => {
    const parts = pathParts(write.path);
    if (parts[0] !== "history" || parts.length < 2 || write.removed) return false;
    const entry = recordById(nextRoot?.history, parts[1]);
    const previous = recordById(currentRoot?.history, parts[1]);
    if (!entry || JSON.stringify(entry) === JSON.stringify(previous)) return false;
    return Boolean(entry.action || entry.changeLabel || entry.subjectLabel
      || (Array.isArray(entry.changes) && entry.changes.length)
      || (Array.isArray(entry.auditChanges) && entry.auditChanges.length));
  });
}

function auditChangesAreEquivalent(left, right) {
  return String(left?.action || "") === String(right?.action || "")
    && String(left?.scope || "") === String(right?.scope || "")
    && String(left?.periodId || "") === String(right?.periodId || "")
    && String(left?.section || "").trim().toLowerCase() === String(right?.section || "").trim().toLowerCase()
    && String(left?.target || "").trim() === String(right?.target || "").trim()
    && String(left?.before || "") === String(right?.before || "")
    && String(left?.after || "") === String(right?.after || "")
    && Boolean(left?.target || String(left?.label || "").toLowerCase() === String(right?.label || "").toLowerCase());
}

function appendServerAuditEntry(root, changes, authContext) {
  if (!changes.length) return { root, id: "" };
  const account = authContext?.rawAccount || authContext?.account || {};
  const timestamp = new Date().toISOString();
  const scopes = [...new Set(changes.map((change) => change.scope).filter(Boolean))];
  const periodIds = [...new Set(changes.map((change) => change.periodId).filter(Boolean))];
  const sessionId = String(authContext?.payload?.sid || "");
  const sessionEntries = sessionId
    ? recordEntries(root?.history).filter(([, entry]) => String(entry?.sessionId || "") === sessionId)
    : [];
  const existingSession = sessionEntries.filter(([, entry]) => !entry?.serverGeneratedAudit).at(-1) || sessionEntries.at(-1) || null;
  if (existingSession) {
    const [existingId, existing] = existingSession;
    const combined = [...(Array.isArray(existing.changes) ? existing.changes : [])];
    changes.forEach((change) => {
      if (combined.some((item) => auditChangesAreEquivalent(item, change))) return;
      combined.push(change);
    });
    const combinedScopes = [...new Set([
      ...(Array.isArray(existing.scopes) ? existing.scopes : existing.scope ? [existing.scope] : []),
      ...combined.map((change) => change.scope).filter(Boolean),
    ])];
    const latestChange = changes[changes.length - 1]?.label || existing.latestChange || "Cập nhật dữ liệu";
    return {
      id: existingId,
      root: setAtPath(root, `history/${existingId}`, {
        ...existing,
        sessionId,
        sessionLastChangedAt: timestamp,
        changeCount: combined.length,
        changeLabel: `Phiên đăng nhập có ${combined.length} thay đổi`,
        latestChange,
        note: `Thay đổi gần nhất: ${latestChange}`,
        changes: combined,
        scopes: combinedScopes,
      }),
    };
  }

  const id = `server-audit-${crypto.randomUUID()}`;
  const entry = {
    id,
    timestamp,
    sessionStartedAt: timestamp,
    sessionLastChangedAt: timestamp,
    sessionId,
    accountId: String(account.id || ""),
    username: String(account.username || ""),
    userName: String(account.displayName || account.name || account.username || "Không rõ"),
    employeeCode: String(account.employeeCode || ""),
    source: "server",
    serverGeneratedAudit: true,
    subjectLabel: "Phiên đăng nhập",
    changeLabel: `Phiên đăng nhập có ${changes.length} thay đổi`,
    changeCount: changes.length,
    latestChange: changes[changes.length - 1]?.label || "Cập nhật dữ liệu",
    note: "Tự động ghi cùng giao dịch dữ liệu",
    scope: scopes.length === 1 ? scopes[0] : "",
    scopes,
    periodId: periodIds.length === 1 ? periodIds[0] : "",
    changes,
  };
  return { root: setAtPath(root, `history/${id}`, entry), id };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function ensureObjectRoot(root) {
  return isPlainObject(root) ? { ...root } : {};
}

function walkToParent(root, parts) {
  let cursor = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    if (Array.isArray(cursor[part])) {
      const isIndexAccess = /^\d+$/.test(nextPart) && !cursor[part].some((item) => String(item?.id || "") === nextPart);
      if (isIndexAccess) {
        cursor[part] = [...cursor[part]];
      } else {
        const map = {};
        cursor[part].forEach((item, index) => {
          const itemKey = item?.id !== undefined && item?.id !== null && String(item.id) !== ""
            ? String(item.id)
            : String(index);
          map[itemKey] = item;
        });
        cursor[part] = map;
      }
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
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    if (Array.isArray(parent[part])) {
      const isIndexAccess = /^\d+$/.test(nextPart) && !parent[part].some((item) => String(item?.id || "") === nextPart);
      if (isIndexAccess) {
        parent[part] = [...parent[part]];
      } else {
        const map = {};
        parent[part].forEach((item, index) => {
          const itemKey = item?.id !== undefined && item?.id !== null && String(item.id) !== ""
            ? String(item.id)
            : String(index);
          map[itemKey] = item;
        });
        parent[part] = map;
      }
    } else if (isPlainObject(parent[part])) {
      parent[part] = { ...parent[part] };
    } else {
      return nextRoot;
    }
    parent = parent[part];
  }

  const lastPart = parts[parts.length - 1];
  if (Array.isArray(parent) && /^\d+$/.test(lastPart)) {
    parent.splice(Number(lastPart), 1);
  } else {
    delete parent[lastPart];
  }
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
const PHOTO_PHASES = Object.freeze(["anh-truoc-xu-ly", "anh-sau-xu-ly"]);

function collectionValues(collection) {
  return Array.isArray(collection) ? collection : Object.values(collection || {}).filter(Boolean);
}

function normalizePhotoPhase(value) {
  return String(value || "").trim().toLowerCase() === "anh-sau-xu-ly"
    ? "anh-sau-xu-ly"
    : "anh-truoc-xu-ly";
}

function parsePhotoRoute(parts) {
  if (!Array.isArray(parts) || parts.some((part) => !part || part === "." || part === "..")) return null;
  if (parts.length === 2 && /^\d{2}-\d{4}$/.test(parts[0])) {
    return { category: "", phase: "", periodFolder: parts[0], fileName: parts[1] };
  }
  if (parts.length === 3 && PHOTO_CATEGORIES.includes(parts[0]) && /^\d{2}-\d{4}$/.test(parts[1])) {
    return { category: parts[0], phase: "", periodFolder: parts[1], fileName: parts[2] };
  }
  if (parts.length === 4
    && PHOTO_CATEGORIES.includes(parts[0])
    && parts[0] !== "huong-dan"
    && PHOTO_PHASES.includes(parts[1])
    && /^\d{2}-\d{4}$/.test(parts[2])) {
    return { category: parts[0], phase: parts[1], periodFolder: parts[2], fileName: parts[3] };
  }
  return null;
}

function photoStorageSegments(category, phase, periodFolder, fileName) {
  return [category, ...(category === "huong-dan" ? [] : [normalizePhotoPhase(phase)]), periodFolder, fileName];
}

function buildPhotoUrl(category, phase, periodFolder, fileName) {
  return `/api/photos/${photoStorageSegments(category, phase, periodFolder, fileName).map(encodeURIComponent).join("/")}`;
}

function photoFileCandidates(photoDir, route) {
  const candidates = [];
  const add = (...segments) => {
    const candidate = path.resolve(photoDir, ...segments);
    if (isInsideRoot(photoDir, candidate) && !candidates.includes(candidate)) candidates.push(candidate);
  };
  if (!route.category) {
    add(route.periodFolder, route.fileName);
    for (const category of PHOTO_CATEGORIES) {
      if (category === "huong-dan") add(category, route.periodFolder, route.fileName);
      else for (const phase of PHOTO_PHASES) add(category, phase, route.periodFolder, route.fileName);
      add(category, route.periodFolder, route.fileName);
    }
    return candidates;
  }

  if (route.phase) {
    add(route.category, route.phase, route.periodFolder, route.fileName);
    return candidates;
  }

  add(route.category, route.periodFolder, route.fileName);
  if (route.category !== "huong-dan") {
    for (const phase of PHOTO_PHASES) add(route.category, phase, route.periodFolder, route.fileName);
  }
  return candidates;
}

function photoThumbnailPath(photoDir, filePath) {
  const relative = path.relative(photoDir, filePath).split(path.sep);
  const fileName = relative.pop();
  return path.resolve(photoDir, ".thumbs", ...relative, `${fileName}.webp`);
}

function decodePhotoPath(rawPath, statusCode = 400, message = "Đường dẫn ảnh không hợp lệ.") {
  try {
    return decodeURIComponent(String(rawPath || ""));
  } catch (_) {
    throw createHttpError(message, statusCode);
  }
}

function isPhotoReferencedInRoot(root, photoDir, route, filePath) {
  if (!root || typeof root !== "object" || !route?.fileName || !filePath) {
    return false;
  }
  const fileName = route.fileName;
  const encodedFileName = encodeURIComponent(fileName);
  const marker = "/api/photos/";
  const matchesUrl = (url) => {
    if (typeof url !== "string" || !url.includes(marker)) return false;
    if (!url.includes(fileName) && !url.includes(encodedFileName)) return false;
    const rawPath = url.slice(url.indexOf(marker) + marker.length).split("?")[0];
    let parsedRoute;
    try {
      parsedRoute = parsePhotoRoute(pathParts(decodeURIComponent(rawPath)));
    } catch (_) {
      return false;
    }
    if (!parsedRoute || parsedRoute.fileName !== fileName || parsedRoute.periodFolder !== route.periodFolder) {
      return false;
    }
    return photoFileCandidates(photoDir, parsedRoute).includes(filePath);
  };

  for (const record of collectionValues(root.scores)) {
    if (matchesUrl(record?.photoDataUrl) || matchesUrl(record?.afterPhotoDataUrl)) return true;
  }
  for (const record of collectionValues(root.safetyRecords)) {
    if (matchesUrl(record?.photoDataUrl) || matchesUrl(record?.afterPhotoDataUrl)) return true;
  }
  for (const sheet of collectionValues(root.fiveSFindings)) {
    for (const row of collectionValues(sheet?.rows)) {
      if (matchesUrl(row?.photoDataUrl) || matchesUrl(row?.afterPhotoDataUrl)) return true;
    }
  }
  for (const guide of Object.values(root.userGuides || {})) {
    for (const step of guide?.steps || []) {
      if (matchesUrl(step?.imageUrl)) return true;
      for (const image of step?.images || []) {
        if (matchesUrl(image?.imageUrl)) return true;
      }
    }
  }
  return false;
}

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
    this.photoHashIndexes = new Map();
    this.photoHashIndexLoads = new Map();
    this.photoSaveLocks = new Map();
  }

  async getPhotoHashIndex(targetDir) {
    const normalizedDir = path.resolve(targetDir);
    const cached = this.photoHashIndexes.get(normalizedDir);
    if (cached) return cached;
    const pending = this.photoHashIndexLoads.get(normalizedDir);
    if (pending) return pending;

    const loadPromise = (async () => {
      const index = { bySize: new Map() };
      let entries = [];
      try {
        entries = await fs.readdir(normalizedDir, { withFileTypes: true });
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      entries.sort((left, right) => left.name.localeCompare(right.name));
      for (const entry of entries) {
        if (!entry.isFile() || !PHOTO_FILE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
        const filePath = path.join(normalizedDir, entry.name);
        try {
          const { size } = await fs.stat(filePath);
          const sameSize = index.bySize.get(size) || [];
          sameSize.push({ path: filePath, hash: "" });
          index.bySize.set(size, sameSize);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
      this.photoHashIndexes.set(normalizedDir, index);
      return index;
    })();
    this.photoHashIndexLoads.set(normalizedDir, loadPromise);
    try {
      return await loadPromise;
    } finally {
      if (this.photoHashIndexLoads.get(normalizedDir) === loadPromise) {
        this.photoHashIndexLoads.delete(normalizedDir);
      }
    }
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
    const categoryFolder = normalizePhotoCategory(photo.category || photo.folder || photo.type);
    this.authService?.assertPhotoAllowed(authContext, categoryFolder);
    const { buffer, extension, contentType } = decodeImageDataUrl(photo.dataUrl);
    const phaseFolder = categoryFolder === "huong-dan" ? "" : normalizePhotoPhase(photo.phase);
    const periodFolder = normalizePhotoPeriodFolder(photo.month, photo.year);
    const baseName = sanitizePhotoBaseName(photo.fileName);
    const targetDir = path.join(this.photoDir, categoryFolder, ...(phaseFolder ? [phaseFolder] : []), periodFolder);
    const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");
    const lockKey = `${path.resolve(targetDir)}\u0000${contentHash}`;
    const previousLock = this.photoSaveLocks.get(lockKey) || Promise.resolve();
    let releaseLock;
    const currentLock = new Promise((resolve) => { releaseLock = resolve; });
    this.photoSaveLocks.set(lockKey, currentLock);
    await previousLock;

    try {
      const index = await this.getPhotoHashIndex(targetDir);
      for (const entry of index.bySize.get(buffer.length) || []) {
        const existingPath = entry.path;
        try {
          if (!entry.hash) {
            const existingBuffer = await fs.readFile(existingPath);
            entry.hash = crypto.createHash("sha256").update(existingBuffer).digest("hex");
          }
          const existingHash = entry.hash;
          if (existingHash !== contentHash) continue;
          await fs.access(existingPath);
          const fileName = path.basename(existingPath);
          return {
            url: buildPhotoUrl(categoryFolder, phaseFolder, periodFolder, fileName),
            fileName,
            categoryFolder,
            phaseFolder,
            periodFolder,
            contentType: getPhotoContentType(existingPath) || contentType,
            size: buffer.length,
            deduplicated: true,
          };
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }

      const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const fileName = `${uniquePart}-${baseName}.${extension}`;
      const filePath = path.join(targetDir, fileName);
      await fs.mkdir(targetDir, { recursive: true });
      await fs.writeFile(filePath, buffer);
      const sameSize = index.bySize.get(buffer.length) || [];
      sameSize.push({ path: filePath, hash: contentHash });
      index.bySize.set(buffer.length, sameSize);

      return {
        url: buildPhotoUrl(categoryFolder, phaseFolder, periodFolder, fileName),
        fileName,
        categoryFolder,
        phaseFolder,
        periodFolder,
        contentType,
        size: buffer.length,
        deduplicated: false,
      };
    } finally {
      releaseLock();
      if (this.photoSaveLocks.get(lockKey) === currentLock) this.photoSaveLocks.delete(lockKey);
    }
  }

  async deletePhoto(photo = {}, authContext = null) {
    const rawPath = String(photo.path || photo.url || "");
    const marker = "/api/photos/";
    const photoPath = rawPath.includes(marker) ? rawPath.slice(rawPath.indexOf(marker) + marker.length) : rawPath;
    const parts = pathParts(decodePhotoPath(photoPath, 400, "Đường dẫn ảnh không hợp lệ."));
    const route = parsePhotoRoute(parts);
    if (!route) {
      throw createHttpError("Đường dẫn ảnh không hợp lệ.", 400);
    }
    this.authService?.assertPhotoAllowed(authContext, route.category);

    const candidates = photoFileCandidates(this.photoDir, route);
    let filePath = candidates[0];
    for (const candidate of candidates) {
      try {
        await fs.access(candidate);
        filePath = candidate;
        break;
      } catch (_) {}
    }
    const thumbnailPath = photoThumbnailPath(this.photoDir, filePath);

    if (!isInsideRoot(this.photoDir, filePath)) {
      throw createHttpError("Đường dẫn ảnh không hợp lệ.", 403);
    }

    const root = authContext?.root || (typeof this.repository?.readRoot === "function" ? await this.repository.readRoot() : null);
    if (isPhotoReferencedInRoot(root, this.photoDir, route, filePath)) {
      return { ok: true, skipped: true };
    }

    await fs.rm(filePath, { force: true });
    if (isInsideRoot(this.photoDir, thumbnailPath)) {
      await fs.rm(thumbnailPath, { force: true });
    }
    const cachedIndex = this.photoHashIndexes.get(path.resolve(path.dirname(filePath)));
    if (cachedIndex) {
      for (const [size, entries] of cachedIndex.bySize.entries()) {
        const filtered = entries.filter((entry) => entry.path !== filePath);
        if (filtered.length) cachedIndex.bySize.set(size, filtered);
        else cachedIndex.bySize.delete(size);
      }
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
    const parts = pathParts(decodePhotoPath(photoPath, 400, "Đường dẫn ảnh không hợp lệ."));
    const route = parsePhotoRoute(parts);
    if (!route) {
      throw createHttpError("Không tìm thấy ảnh.", 404);
    }

    const candidates = photoFileCandidates(this.photoDir, route);
    let filePath = candidates[candidates.length - 1];
    for (const candidate of candidates) {
      try {
        await fs.access(candidate);
        filePath = candidate;
        break;
      } catch (_) {}
    }
    const thumbnailPath = photoThumbnailPath(this.photoDir, filePath);

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

    const references = new Map();
    const classifications = new Map();
    const urlTransforms = new Map();
    const imageEvidence = [];
    const transformKey = (url, category, phase) => `${url}\u0000${category}\u0000${phase}`;
    const destinationKey = (category, phase) => `${category}\u0000${phase}`;
    const periodFileKey = (periodFolder, fileName) => `${periodFolder}\u0000${fileName}`;
    const classifyReference = (url, category, phase) => {
      if (typeof url !== "string" || !url.includes("/api/photos/")) return;
      const marker = "/api/photos/";
      const rawPath = url.slice(url.indexOf(marker) + marker.length).split("?")[0];
      let route;
      try {
        route = parsePhotoRoute(pathParts(decodeURIComponent(rawPath)));
      } catch (_) {
        return;
      }
      if (!route) return;
      const normalizedPhase = category === "huong-dan" ? "" : normalizePhotoPhase(phase);
      const newUrl = buildPhotoUrl(category, normalizedPhase, route.periodFolder, route.fileName);
      const target = { category, phase: normalizedPhase, periodFolder: route.periodFolder, fileName: route.fileName, newUrl };
      const byDestination = references.get(url) || new Map();
      byDestination.set(destinationKey(category, normalizedPhase), target);
      references.set(url, byDestination);
      const fileKey = periodFileKey(route.periodFolder, route.fileName);
      const destinations = classifications.get(fileKey) || new Map();
      destinations.set(destinationKey(category, normalizedPhase), target);
      classifications.set(fileKey, destinations);
    };

    for (const record of collectionValues(root.safetyRecords)) {
      classifyReference(record?.photoDataUrl, "an-toan", "anh-truoc-xu-ly");
      classifyReference(record?.afterPhotoDataUrl, "an-toan", "anh-sau-xu-ly");
      if (record?.photoDataUrl || record?.afterPhotoDataUrl) {
        imageEvidence.push({
          category: "an-toan",
          phase: record?.afterPhotoDataUrl && !record?.photoDataUrl ? "anh-sau-xu-ly" : "anh-truoc-xu-ly",
          time: Date.parse(record.createdAt || record.updatedAt || record.issueDate || record.date || ""),
        });
      }
    }
    for (const score of collectionValues(root.scores)) {
      classifyReference(score?.photoDataUrl, "van-de-5s", "anh-truoc-xu-ly");
      classifyReference(score?.afterPhotoDataUrl, "van-de-5s", "anh-sau-xu-ly");
      if (score?.photoDataUrl || score?.afterPhotoDataUrl) {
        imageEvidence.push({
          category: "van-de-5s",
          phase: score?.afterPhotoDataUrl && !score?.photoDataUrl ? "anh-sau-xu-ly" : "anh-truoc-xu-ly",
          time: Date.parse(score.createdAt || score.updatedAt || ""),
        });
      }
    }
    for (const sheet of collectionValues(root.fiveSFindings)) {
      for (const row of collectionValues(sheet?.rows)) {
        classifyReference(row?.photoDataUrl, "van-de-5s", "anh-truoc-xu-ly");
        classifyReference(row?.afterPhotoDataUrl, "van-de-5s", "anh-sau-xu-ly");
        if (row?.photoDataUrl || row?.afterPhotoDataUrl) {
          imageEvidence.push({
            category: "van-de-5s",
            phase: row?.afterPhotoDataUrl && !row?.photoDataUrl ? "anh-sau-xu-ly" : "anh-truoc-xu-ly",
            time: Date.parse(row.createdAt || sheet?.createdAt || sheet?.updatedAt || sheet?.inspectionDate || ""),
          });
        }
      }
    }
    for (const guide of Object.values(root.userGuides || {})) {
      for (const step of guide?.steps || []) {
        classifyReference(step?.imageUrl, "huong-dan", "");
        for (const image of step?.images || []) classifyReference(image?.imageUrl, "huong-dan", "");
      }
    }

    const exists = async (filePath) => {
      try { await fs.access(filePath); return true; } catch (_) { return false; }
    };
    const firstExisting = async (paths) => {
      for (const filePath of paths) if (await exists(filePath)) return filePath;
      return "";
    };
    const targetFilePath = (target) => path.resolve(
      this.photoDir,
      ...photoStorageSegments(target.category, target.phase, target.periodFolder, target.fileName),
    );
    const copyIfNeeded = async (sourcePath, targetPath) => {
      if (sourcePath === targetPath || await exists(targetPath)) return await exists(targetPath);
      if (!sourcePath || !(await exists(sourcePath))) return false;
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      try {
        await fs.copyFile(sourcePath, targetPath);
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
      return exists(targetPath);
    };
    let migratedCount = 0;

    for (const [oldUrl, targetsByKey] of references) {
      const marker = "/api/photos/";
      let route;
      try {
        route = parsePhotoRoute(pathParts(decodeURIComponent(oldUrl.slice(oldUrl.indexOf(marker) + marker.length).split("?")[0])));
      } catch (_) { continue; }
      if (!route) continue;
      const sourceCandidates = photoFileCandidates(this.photoDir, route);
      const sourceFile = await firstExisting(sourceCandidates);
      const sourceThumb = await firstExisting(sourceCandidates.map((candidate) => photoThumbnailPath(this.photoDir, candidate)));
      const completedTargets = [];
      for (const target of targetsByKey.values()) {
        const filePath = targetFilePath(target);
        const moved = await copyIfNeeded(sourceFile, filePath);
        const ready = moved || await exists(filePath);
        if (!ready) continue;
        const thumbPath = photoThumbnailPath(this.photoDir, filePath);
        await copyIfNeeded(sourceThumb, thumbPath);
        completedTargets.push({ target, filePath, thumbPath });
        if (oldUrl !== target.newUrl) {
          urlTransforms.set(transformKey(oldUrl, target.category, target.phase), target.newUrl);
        }
        if (sourceFile && sourceFile !== filePath) migratedCount++;
      }
      const completedFilePaths = new Set(completedTargets.map((entry) => entry.filePath));
      if (sourceFile && !completedFilePaths.has(sourceFile)) await fs.rm(sourceFile, { force: true });
      const completedThumbPaths = new Set(completedTargets.map((entry) => entry.thumbPath));
      if (sourceThumb && !completedThumbPaths.has(sourceThumb)) await fs.rm(sourceThumb, { force: true });
    }

    const chooseOrphanTarget = (periodFolder, fileName) => {
      const existing = classifications.get(periodFileKey(periodFolder, fileName));
      if (existing?.size) return [...existing.values()];
      const timestamp = Number(/^\d{13}/.exec(fileName)?.[0] || 0);
      const nearest = imageEvidence
        .filter((item) => Number.isFinite(item.time))
        .map((item) => ({ ...item, delta: Math.abs(item.time - timestamp) }))
        .sort((left, right) => left.delta - right.delta)[0];
      if (nearest && nearest.delta <= 30 * 60 * 1000) {
        return [{ category: nearest.category, phase: nearest.phase, periodFolder, fileName }];
      }
      if (/screenshot|anh-huong-dan/i.test(fileName)) {
        return [{ category: "huong-dan", phase: "", periodFolder, fileName }];
      }
      return [{ category: "van-de-5s", phase: "anh-truoc-xu-ly", periodFolder, fileName }];
    };
    const migratePhysicalFile = async (sourceFile, sourceThumb, periodFolder, fileName, targets) => {
      if (!sourceFile && !sourceThumb) return;
      const targetFiles = new Set();
      const targetThumbs = new Set();
      for (const target of targets) {
        const filePath = targetFilePath({ ...target, periodFolder, fileName });
        const ready = sourceFile ? await copyIfNeeded(sourceFile, filePath) : await exists(filePath);
        if (ready) targetFiles.add(filePath);
        if (sourceThumb) {
          const thumbPath = photoThumbnailPath(this.photoDir, filePath);
          if (await copyIfNeeded(sourceThumb, thumbPath)) targetThumbs.add(thumbPath);
        }
      }
      if (sourceFile && !targetFiles.has(sourceFile)) {
        await fs.rm(sourceFile, { force: true });
        if (targetFiles.size) migratedCount++;
      }
      if (sourceThumb && !targetThumbs.has(sourceThumb)) await fs.rm(sourceThumb, { force: true });
    };

    const periodsToMigrate = new Set(["09-2026", "10-2026"]);
    const photoEntries = await fs.readdir(this.photoDir, { withFileTypes: true }).catch(() => []);
    photoEntries.filter((entry) => entry.isDirectory() && /^\d{2}-\d{4}$/.test(entry.name)).forEach((entry) => periodsToMigrate.add(entry.name));
    for (const periodFolder of periodsToMigrate) {
      for (const category of ["", "an-toan", "van-de-5s"]) {
        const sourceDir = category ? path.join(this.photoDir, category, periodFolder) : path.join(this.photoDir, periodFolder);
        const entries = await fs.readdir(sourceDir, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
          if (!entry.isFile()) continue;
          const fileName = entry.name;
          const targets = chooseOrphanTarget(periodFolder, fileName);
          const sourceFile = path.join(sourceDir, fileName);
          const sourceThumb = photoThumbnailPath(this.photoDir, sourceFile);
          await migratePhysicalFile(sourceFile, await exists(sourceThumb) ? sourceThumb : "", periodFolder, fileName, targets);
          const destinations = classifications.get(periodFileKey(periodFolder, fileName)) || new Map();
          for (const target of targets) destinations.set(destinationKey(target.category, target.phase), target);
          classifications.set(periodFileKey(periodFolder, fileName), destinations);
        }
        await fs.rmdir(sourceDir).catch(() => {});
      }

      const thumbSources = [
        path.join(this.photoDir, ".thumbs", periodFolder),
        ...["an-toan", "van-de-5s"].map((category) => path.join(this.photoDir, ".thumbs", category, periodFolder)),
      ];
      for (const thumbDir of thumbSources) {
        const entries = await fs.readdir(thumbDir, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
          if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".webp")) continue;
          const fileName = entry.name.slice(0, -5);
          const key = periodFileKey(periodFolder, fileName);
          const targets = classifications.get(key)?.size
            ? [...classifications.get(key).values()]
            : chooseOrphanTarget(periodFolder, fileName);
          await migratePhysicalFile("", path.join(thumbDir, entry.name), periodFolder, fileName, targets);
        }
        await fs.rmdir(thumbDir).catch(() => {});
      }

      for (const category of ["an-toan", "van-de-5s"]) {
        for (const phase of PHOTO_PHASES) {
          await fs.mkdir(path.join(this.photoDir, category, phase, periodFolder), { recursive: true });
          await fs.mkdir(path.join(this.photoDir, ".thumbs", category, phase, periodFolder), { recursive: true });
        }
      }
      await fs.rmdir(path.join(this.photoDir, ".thumbs", periodFolder)).catch(() => {});
    }

    if (urlTransforms.size > 0 && typeof repository.updateRoot === "function") {
      await repository.updateRoot((current) => {
        const next = clone(current);
        const replaceUrl = (url, category, phase) => urlTransforms.get(transformKey(url, category, phase)) || url;
        for (const item of collectionValues(next.scores)) {
          if (item.photoDataUrl) item.photoDataUrl = replaceUrl(item.photoDataUrl, "van-de-5s", "anh-truoc-xu-ly");
          if (item.afterPhotoDataUrl) item.afterPhotoDataUrl = replaceUrl(item.afterPhotoDataUrl, "van-de-5s", "anh-sau-xu-ly");
        }
        for (const item of collectionValues(next.safetyRecords)) {
          if (item.photoDataUrl) item.photoDataUrl = replaceUrl(item.photoDataUrl, "an-toan", "anh-truoc-xu-ly");
          if (item.afterPhotoDataUrl) item.afterPhotoDataUrl = replaceUrl(item.afterPhotoDataUrl, "an-toan", "anh-sau-xu-ly");
        }
        for (const sheet of collectionValues(next.fiveSFindings)) {
          for (const row of collectionValues(sheet?.rows)) {
            if (row.photoDataUrl) row.photoDataUrl = replaceUrl(row.photoDataUrl, "van-de-5s", "anh-truoc-xu-ly");
            if (row.afterPhotoDataUrl) row.afterPhotoDataUrl = replaceUrl(row.afterPhotoDataUrl, "van-de-5s", "anh-sau-xu-ly");
          }
        }
        for (const guide of Object.values(next.userGuides || {})) {
          for (const step of guide?.steps || []) {
            if (step.imageUrl) step.imageUrl = replaceUrl(step.imageUrl, "huong-dan", "");
            for (const image of step.images || []) {
              if (image.imageUrl) image.imageUrl = replaceUrl(image.imageUrl, "huong-dan", "");
            }
          }
        }
        return next;
      }, { touchedRootKeys: ["scores", "safetyRecords", "fiveSFindings", "userGuides"] });
    }

    if (migratedCount > 0 || urlTransforms.size > 0) {
      console.log(`[Photo Migration] Đã chuyển ${migratedCount} tệp ảnh và cập nhật ${urlTransforms.size} đường dẫn ảnh theo loại hồ sơ, ảnh trước/sau xử lý.`);
    }
    return { migrated: migratedCount, updatedRefs: urlTransforms.size };
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
      const requestedWrites = writeChanges(command);
      const hasNonHistoryWrite = requestedWrites.some((change) => pathParts(change.path)[0] && pathParts(change.path)[0] !== "history");
      if (!hasNonHistoryWrite) {
        resultingRoot = currentRoot;
        return currentRoot;
      }
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
      if (requestedWrites.some((change) => pathParts(change.path)[0] === "history")) {
        nextRoot = { ...nextRoot, history: clone(currentRoot?.history) || {} };
      }

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
      const serverAuditChanges = buildServerAuditChanges(currentRoot, nextRoot, command);
      if (serverAuditChanges.length) {
        nextRoot = appendServerAuditEntry(nextRoot, serverAuditChanges, authContext).root;
      }
      const historyChanged = JSON.stringify(currentRoot?.history || {}) !== JSON.stringify(nextRoot?.history || {});
      if (historyChanged && changedRootKeys) {
        changedRootKeys.add("history");
        if (changedRecords) changedRecords.history = null;
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
