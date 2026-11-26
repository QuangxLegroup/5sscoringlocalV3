"use strict";

const { Pool } = require("pg");
const fs = require("node:fs");
const path = require("node:path");

const RECORD_COLLECTIONS = new Set([
  "scores",
  "safetyRecords",
  "fiveSFindings",
  "deletedSafetyRecords",
  "history",
]);
const PAGED_COLLECTIONS = new Set(["scores", "safetyRecords", "fiveSFindings"]);
const DOMAIN_SCHEMA_MIGRATION = "20261022_domain_tables_v1";
const FIVE_S_PATROL_REMOVAL_MIGRATION = "20261022_remove_unused_five_s_patrols_v1";
const STRUCTURED_COLLECTIONS = Object.freeze({
  periods: { table: "periods", fields: [
    ["year", (row) => safeInteger(row.year)], ["month", (row) => safeInteger(row.month)],
    ["period_type", (row) => row.type], ["label", (row) => row.label], ["archived", (row) => safeBoolean(row.archived)],
    ["created_at", (row) => safeTimestamp(row.createdAt), "timestamptz"], ["updated_at", (row) => safeTimestamp(row.updatedAt), "timestamptz"],
    ["settings_snapshot", (row) => row.settingsSnapshot, "jsonb"],
  ] },
  accounts: { table: "accounts", fields: [
    ["username", (row) => row.username], ["display_name", (row) => row.name], ["role", (row) => row.role],
    ["active", (row) => safeBoolean(row.active)], ["password_hash", (row) => row.passwordHash],
    ["access_types", (row) => row.accessTypes, "jsonb"], ["roles_by_type", (row) => row.rolesByType, "jsonb"],
  ] },
  areas: { table: "areas", fields: [
    ["code", (row) => row.code], ["template_code", (row) => row.templateCode], ["area_order", (row) => safeNumber(row.order)],
    ["department_head", (row) => row.departmentHead], ["department_head_employee_code", (row) => row.departmentHeadEmployeeCode],
    ["summary_group", (row) => row.summaryGroup], ["scorer_id", (row) => row.scorerId], ["assessor_id", (row) => row.assessorId],
    ["assessor_ids", (row) => row.assessorIds, "jsonb"],
  ] },
  safetyAreas: { table: "safety_areas", fields: [
    ["code", (row) => row.code], ["template_code", (row) => row.templateCode], ["area_order", (row) => safeNumber(row.order)],
    ["department_head", (row) => row.departmentHead], ["department_head_employee_code", (row) => row.departmentHeadEmployeeCode],
    ["summary_group", (row) => row.summaryGroup], ["scorer_id", (row) => row.scorerId], ["assessor_id", (row) => row.assessorId],
    ["assessor_ids", (row) => row.assessorIds, "jsonb"],
  ] },
  managers: { table: "managers", fields: [["name", (row) => row.name], ["employee_code", (row) => row.employeeCode], ["emails", (row) => row.emails, "jsonb"]] },
  assessors: { table: "assessors", fields: [["name", (row) => row.name], ["employee_code", (row) => row.employeeCode], ["emails", (row) => row.emails, "jsonb"]] },
  safetyManagers: { table: "safety_managers", fields: [["name", (row) => row.name], ["employee_code", (row) => row.employeeCode], ["emails", (row) => row.emails, "jsonb"]] },
  safetyAssessors: { table: "safety_assessors", fields: [["name", (row) => row.name], ["employee_code", (row) => row.employeeCode], ["emails", (row) => row.emails, "jsonb"]] },
  departmentHeadContacts: { table: "department_head_contacts", fields: [["name", (row) => row.name], ["employee_code", (row) => row.employeeCode], ["emails", (row) => row.emails, "jsonb"]] },
  safetyDepartmentHeadContacts: { table: "safety_department_head_contacts", fields: [["name", (row) => row.name], ["employee_code", (row) => row.employeeCode], ["emails", (row) => row.emails, "jsonb"]] },
  safetyDepartmentGroups: { table: "safety_department_groups", fields: [["name", (row) => row.name], ["employee_code", (row) => row.employeeCode], ["emails", (row) => row.emails, "jsonb"]] },
  at5sMembers: { table: "at5s_members", fields: [["name", (row) => row.name], ["employee_code", (row) => row.employeeCode], ["emails", (row) => row.emails, "jsonb"]] },
  scores: { table: "scores", fields: [
    ["period_id", (row) => row.periodId], ["area_id", (row) => row.areaId], ["item_id", (row) => row.itemId],
    ["criterion_id", (row) => row.criterionId], ["score_source", (row) => row.scoreSource], ["score", (row) => safeNumber(row.score)],
    ["scorer_name", (row) => row.scorerName], ["account_username", (row) => row.accountUsername], ["record_status", (row) => row.status],
    ["occurred_at", (row) => safeDate(row.scoreDate || row.updatedAt), "date"], ["updated_at", (row) => safeTimestamp(row.updatedAt), "timestamptz"],
  ], periodAware: true },
  safetyRecords: { table: "safety_records", fields: [
    ["period_id", (row) => row.periodId], ["area_id", (row) => row.areaId], ["issue_date", (row) => safeDate(row.issueDate || row.date || (row.issueDay && row.issueMonth ? `${row.periodYear || 2026}-${String(row.issueMonth).padStart(2, "0")}-${String(row.issueDay).padStart(2, "0")}` : null) || row.occurred_at || row.createdAt), "date"],
    ["issue_level", (row) => row.issueLevel], ["issue_type", (row) => row.issueType], ["record_status", (row) => row.issueStatus],
    ["note", (row) => row.note], ["improvement_content", (row) => row.improvementContent], ["action_owner", (row) => row.actionOwner],
    ["completion_date", (row) => safeDate(row.completionDate), "date"], ["issue_found_by", (row) => row.issueFoundBy],
    ["account_username", (row) => row.accountUsername], ["occurred_at", (row) => safeDate(row.issueDate || row.createdAt), "date"],
    ["created_at", (row) => safeTimestamp(row.createdAt), "timestamptz"], ["updated_at", (row) => safeTimestamp(row.updatedAt), "timestamptz"],
  ], periodAware: true },
  fiveSFindings: { table: "five_s_findings", fields: [
    ["period_id", (row) => row.periodId], ["area_id", (row) => row.areaId], ["zone_label", (row) => row.area],
    ["inspector", (row) => row.inspector], ["inspection_date", (row) => safeDate(row.inspectionDate), "date"],
    ["record_status", (row) => row.status], ["row_count", (row) => collectionEntries(row.rows).length],
    ["rows_shape", (row) => Array.isArray(row.rows) ? "array" : "object"], ["occurred_at", (row) => safeDate(row.inspectionDate), "date"],
    ["created_at", (row) => safeTimestamp(row.createdAt), "timestamptz"], ["updated_at", (row) => safeTimestamp(row.updatedAt), "timestamptz"],
    ["updated_by", (row) => row.updatedBy],
  ], periodAware: true, hasItems: true },
  deletedSafetyRecords: { table: "deleted_safety_records", fields: [
    ["original_id", (row) => row.recordId || row.originalId], ["period_id", (row) => row.periodId], ["area_id", (row) => row.areaId],
    ["deleted_at", (row) => safeTimestamp(row.deletedAt), "timestamptz"], ["deleted_by", (row) => row.deletedBy], ["reason", (row) => row.reason],
  ] },
  history: { table: "score_history", fields: [
    ["changed_at", (row) => safeTimestamp(row.timestamp), "timestamptz"], ["period_id", (row) => row.periodId],
    ["area_id", (row) => row.areaId], ["username", (row) => row.username], ["employee_code", (row) => row.employeeCode],
    ["display_name", (row) => row.userName || row.displayName], ["item_id", (row) => row.itemId],
    ["criterion_id", (row) => row.criterionId], ["score_source", (row) => row.scoreSource || row.source],
    ["change_count", (row) => safeInteger(row.changeCount)],
  ] },
});

function clone(value) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function collectionEntries(value) {
  if (Array.isArray(value)) {
    return value.map((item, index) => ({ key: String(item?.id || index), position: index, payload: item }));
  }
  if (isPlainObject(value)) {
    return Object.entries(value).map(([key, payload], position) => ({ key, position, payload }));
  }
  return [];
}

function collectionEntryForKey(value, key) {
  const id = String(key);
  if (Array.isArray(value)) {
    const position = value.findIndex((record, index) => String(record?.id || index) === id || String(index) === id);
    return position < 0 ? null : { key: String(value[position]?.id || position), position, payload: value[position] };
  }
  if (!isPlainObject(value)) return null;
  if (Object.prototype.hasOwnProperty.call(value, id)) return { key: id, position: null, payload: value[id] };
  const entries = Object.entries(value);
  const position = entries.findIndex(([entryKey, payload]) => entryKey === id || String(payload?.id || "") === id);
  return position < 0 ? null : { key: entries[position][0], position: null, payload: entries[position][1] };
}

function pathParts(input) {
  return String(input || "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

function valueAtPath(record, targetPath) {
  let cursor = record;
  for (const part of pathParts(targetPath)) {
    if (Array.isArray(cursor)) {
      cursor = cursor.find((item, index) => String(item?.id || index) === part || String(index) === part);
    } else if (cursor && typeof cursor === "object" && Object.prototype.hasOwnProperty.call(cursor, part)) {
      cursor = cursor[part];
    } else {
      return undefined;
    }
  }
  return cursor;
}

function rootMatchesTouchedKeys(currentRoot, nextRoot, touchedRootKeys, touchedRecords, touchedRecordFields = null) {
  if (!touchedRootKeys) return stableJson(currentRoot) === stableJson(nextRoot);
  for (const key of touchedRootKeys) {
    const currentValue = currentRoot?.[key];
    const nextValue = nextRoot?.[key];
    const recordIds = touchedRecords?.[key];
    if (Array.isArray(recordIds)
      && Array.isArray(currentValue) === Array.isArray(nextValue)
      && isPlainObject(currentValue) === isPlainObject(nextValue)) {
      for (const id of recordIds) {
        const previous = collectionEntryForKey(currentValue, id);
        const next = collectionEntryForKey(nextValue, id);
        if (Boolean(previous) !== Boolean(next)) return false;
        if (previous) {
          if ((previous.position !== null && next.position !== null && previous.position !== next.position)) return false;
          const fields = touchedRecordFields?.[key]?.[String(id)];
          if (Array.isArray(fields) && fields.length && !fields.includes("*")) {
            if (fields.some((field) => stableJson(valueAtPath(previous.payload, field)) !== stableJson(valueAtPath(next.payload, field)))) return false;
          } else if (stableJson(previous.payload) !== stableJson(next.payload)) {
            return false;
          }
        }
      }
    } else if (stableJson(currentValue) !== stableJson(nextValue)) {
      return false;
    }
  }
  return true;
}

function safeDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (iso) return `${iso[1]}-${String(Number(iso[2])).padStart(2, "0")}-${String(Number(iso[3])).padStart(2, "0")}`;
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (local) return `${local[3]}-${String(Number(local[2])).padStart(2, "0")}-${String(Number(local[1])).padStart(2, "0")}`;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
}

function safeTimestamp(value) {
  if (!value) return null;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function safeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function safeInteger(value) {
  const result = safeNumber(value);
  return result === null || !Number.isInteger(result) ? null : result;
}

function safeBoolean(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") return !["false", "0", "no", "inactive"].includes(value.toLowerCase());
  return Boolean(value);
}

function asObject(value) {
  return isPlainObject(value) ? value : {};
}

function periodIndexes(root) {
  return new Map(collectionEntries(root?.periods).map(({ key, payload }) => [String(payload?.id || key), payload]));
}

function encodedStructuredPayload(collection, payload) {
  const record = clone(payload);
  if (collection === "fiveSFindings" && isPlainObject(record)) delete record.rows;
  return JSON.stringify(record);
}

function rootCounts(root) {
  const counts = {};
  for (const collection of RECORD_COLLECTIONS) {
    const value = root?.[collection];
    counts[collection] = Array.isArray(value) ? value.length : isPlainObject(value) ? Object.keys(value).length : 0;
  }
  return counts;
}

function isTransientPgConnectionError(error) {
  if (!error) return false;
  const code = String(error.code || "").toUpperCase();
  if ([
    "ECONNRESET",
    "EPIPE",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "ENOTFOUND",
    "57P01",
    "57P02",
    "57P03",
    "08000",
    "08003",
    "08006",
  ].includes(code)) {
    return true;
  }
  const message = String(error.message || "");
  return /Connection terminated|Client has encountered a connection error|server closed the connection unexpectedly|socket hang up/i.test(message);
}

class PostgresRepository {
  constructor({ pool, poolConfig }) {
    this.pool = pool || new Pool(poolConfig);
    if (typeof this.pool.on === "function") {
      this.pool.on("error", (err) => {
        console.warn("[pg-pool] Idle PostgreSQL client error (recovered):", err?.code || err?.message || err);
      });
    }
    this.rootCache = null;
    this.rootRevision = null;
    this.writeQueue = Promise.resolve();
    this.initialized = false;
    this.structuredEnabled = false;
  }

  async initialize() {
    if (this.initialized) return;
    await this.pool.query("SELECT 1");
    const schemaSql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    await this.pool.query(schemaSql);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(593842, 1)");
      const migration = await client.query("SELECT migration_id FROM app_schema_migrations WHERE migration_id = $1", [DOMAIN_SCHEMA_MIGRATION]);
      if (migration.rows[0]) {
        this.structuredEnabled = true;
        await client.query("COMMIT");
      } else {
        const legacyTable = await client.query("SELECT to_regclass('public.app_records') IS NOT NULL AS present");
        const legacyRoot = await this.readLegacyRootWithClient(client, Boolean(legacyTable.rows[0]?.present));
        await this.persistRootWithClient(client, {}, legacyRoot);
        const structuredRoot = await this.readStructuredRootWithClient(client);
        if (stableJson(structuredRoot) !== stableJson(legacyRoot)) {
          throw new Error("Đối chiếu cấu trúc bảng PostgreSQL thất bại; thay đổi đã được rollback.");
        }
        if (legacyTable.rows[0]?.present) {
          const archiveTable = await client.query("SELECT to_regclass('public.app_records_legacy_archive') IS NOT NULL AS present");
          if (!archiveTable.rows[0]?.present) {
            await client.query("ALTER TABLE app_records RENAME TO app_records_legacy_archive");
          }
        }
        await client.query("INSERT INTO app_schema_migrations (migration_id) VALUES ($1)", [DOMAIN_SCHEMA_MIGRATION]);
        await client.query("COMMIT");
        this.structuredEnabled = true;
      }

      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(593842, 1)");
      const patrolRemoval = await client.query(
        "SELECT migration_id FROM app_schema_migrations WHERE migration_id = $1",
        [FIVE_S_PATROL_REMOVAL_MIGRATION],
      );
      if (!patrolRemoval.rows[0]) {
        await client.query("DROP TABLE IF EXISTS public.five_s_patrols");
        await client.query("DELETE FROM app_root_values WHERE root_key = 'fiveSPatrols'");
        await client.query("DELETE FROM app_collection_shapes WHERE collection = 'fiveSPatrols'");
        await client.query("INSERT INTO app_schema_migrations (migration_id) VALUES ($1)", [FIVE_S_PATROL_REMOVAL_MIGRATION]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    this.initialized = true;
  }

  async readRootSnapshot({ cloneRoot = true } = {}) {
    if (!this.initialized) throw new Error("PostgreSQL repository chưa được khởi tạo.");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const client = await this.pool.connect();
      let brokenClient = false;
      try {
        await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        const revisionResult = await client.query("SELECT revision FROM app_revision WHERE singleton = true");
        const revision = Number(revisionResult.rows[0]?.revision || 0);
        if (this.rootCache && this.rootRevision === revision) {
          await client.query("COMMIT");
          return { root: cloneRoot ? clone(this.rootCache) : this.rootCache, revision };
        }
        const root = await this.readRootWithClient(client);
        await client.query("COMMIT");
        this.rootCache = clone(root);
        this.rootRevision = revision;
        return { root: cloneRoot ? root : this.rootCache, revision };
      } catch (error) {
        brokenClient = isTransientPgConnectionError(error);
        if (!brokenClient) {
          await client.query("ROLLBACK").catch(() => {});
        }
        if (brokenClient && attempt === 0) {
          continue;
        }
        throw error;
      } finally {
        client.release(brokenClient);
      }
    }
  }

  async readRoot() {
    return (await this.readRootSnapshot()).root;
  }

  async getRevision() {
    if (!this.initialized) throw new Error("PostgreSQL repository chưa được khởi tạo.");
    try {
      const result = await this.pool.query("SELECT revision FROM app_revision WHERE singleton = true");
      return Number(result.rows[0]?.revision || 0);
    } catch (error) {
      if (isTransientPgConnectionError(error)) {
        const result = await this.pool.query("SELECT revision FROM app_revision WHERE singleton = true");
        return Number(result.rows[0]?.revision || 0);
      }
      throw error;
    }
  }

  async readRootWithClient(client) {
    if (this.structuredEnabled) return this.readStructuredRootWithClient(client);
    return this.readLegacyRootWithClient(client, true);
  }

  async readLegacyRootWithClient(client, hasRecordsTable) {
    const valuesResult = await client.query("SELECT root_key, value FROM app_root_values");
    const shapesResult = await client.query("SELECT collection, shape FROM app_collection_shapes");
    const recordsResult = hasRecordsTable
      ? await client.query("SELECT collection, record_key, position, payload FROM app_records ORDER BY collection, position, record_key")
      : { rows: [] };
    const root = Object.fromEntries(valuesResult.rows.map((row) => [row.root_key, row.value]));
    const shapes = new Map(shapesResult.rows.map((row) => [row.collection, row.shape]));
    const grouped = new Map();
    for (const row of recordsResult.rows) {
      if (!grouped.has(row.collection)) grouped.set(row.collection, []);
      grouped.get(row.collection).push(row);
    }
    for (const [collection, shape] of shapes) {
      const rows = grouped.get(collection) || [];
      root[collection] = shape === "array"
        ? rows.map((row) => row.payload)
        : Object.fromEntries(rows.map((row) => [row.record_key, row.payload]));
    }
    return root;
  }

  async readStructuredRootWithClient(client) {
    const valuesResult = await client.query("SELECT root_key, value FROM app_root_values");
    const shapesResult = await client.query("SELECT collection, shape FROM app_collection_shapes");
    const root = Object.fromEntries(valuesResult.rows.map((row) => [row.root_key, row.value]));
    const shapes = new Map(shapesResult.rows.map((row) => [row.collection, row.shape]));
    for (const [collection, spec] of Object.entries(STRUCTURED_COLLECTIONS)) {
      if (!shapes.has(collection)) continue;
      const records = await client.query(`SELECT id, position, data${spec.hasItems ? ", rows_shape" : ""} FROM ${spec.table} ORDER BY position, id`);
      let entries = records.rows.map((row) => ({ key: row.id, position: row.position, payload: row.data }));
      if (spec.hasItems && entries.length) {
        const ids = entries.map((entry) => entry.key);
        const itemsResult = await client.query("SELECT finding_id, item_key, position, data FROM five_s_finding_items WHERE finding_id = ANY($1::text[]) ORDER BY finding_id, position, item_key", [ids]);
        const groupedItems = new Map();
        for (const row of itemsResult.rows) {
          if (!groupedItems.has(row.finding_id)) groupedItems.set(row.finding_id, []);
          groupedItems.get(row.finding_id).push({ key: row.item_key, payload: row.data });
        }
        const rowsShapeById = new Map(records.rows.map((row) => [row.id, row.rows_shape]));
        entries = entries.map((entry) => {
          const children = groupedItems.get(entry.key) || [];
          const rows = rowsShapeById.get(entry.key) === "object"
            ? Object.fromEntries(children.map((item) => [item.key, item.payload]))
            : children.map((item) => item.payload);
          return { ...entry, payload: { ...entry.payload, rows } };
        });
      }
      root[collection] = shapes.get(collection) === "array"
        ? entries.map((entry) => entry.payload)
        : Object.fromEntries(entries.map((entry) => [entry.key, entry.payload]));
    }
    const legacyTable = await client.query("SELECT to_regclass('public.app_records') IS NOT NULL AS present");
    const legacyCollections = legacyTable.rows[0]?.present
      ? await client.query("SELECT collection, record_key, position, payload FROM app_records ORDER BY collection, position, record_key")
      : { rows: [] };
    const groupedLegacy = new Map();
    for (const row of legacyCollections.rows) {
      if (STRUCTURED_COLLECTIONS[row.collection] || !shapes.has(row.collection)) continue;
      if (!groupedLegacy.has(row.collection)) groupedLegacy.set(row.collection, []);
      groupedLegacy.get(row.collection).push(row);
    }
    for (const [collection, rows] of groupedLegacy) {
      root[collection] = shapes.get(collection) === "array"
        ? rows.map((row) => row.payload)
        : Object.fromEntries(rows.map((row) => [row.record_key, row.payload]));
    }
    return root;
  }

  async updateRoot(mutator, options = {}) {
    const run = this.writeQueue.then(() => this.updateRootTransaction(mutator, options), () => this.updateRootTransaction(mutator, options));
    this.writeQueue = run.catch(() => {});
    return run;
  }

  async updateRootTransaction(mutator, options = {}) {
    const { touchedRootKeys = null, touchedRecords = null, touchedRecordFields = null, immutableMutator = false } = options;
    if (!this.initialized) throw new Error("PostgreSQL repository chưa được khởi tạo.");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const client = await this.pool.connect();
      let brokenClient = false;
      let commitAttempted = false;
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(593842, 1)");
        const revisionResult = await client.query("SELECT revision FROM app_revision WHERE singleton = true");
        const currentRevision = Number(revisionResult.rows[0]?.revision || 0);
        const cacheIsCurrent = this.rootCache && this.rootRevision === currentRevision;
        const currentRoot = cacheIsCurrent
          ? (immutableMutator ? this.rootCache : clone(this.rootCache))
          : await this.readRootWithClient(client);
        if (!cacheIsCurrent) {
          this.rootCache = clone(currentRoot);
          this.rootRevision = currentRevision;
        }
        const nextRoot = await mutator(currentRoot);
        if (!isPlainObject(nextRoot)) throw new Error("Dữ liệu gốc phải là một đối tượng.");
        if (rootMatchesTouchedKeys(currentRoot, nextRoot, touchedRootKeys, touchedRecords, touchedRecordFields)) {
          commitAttempted = true;
          await client.query("COMMIT");
          this.rootCache = immutableMutator ? currentRoot : clone(currentRoot);
          this.rootRevision = currentRevision;
          if (options.compactResult) return { revision: currentRevision };
          const root = clone(currentRoot);
          return options.includeRevision ? { root, revision: currentRevision } : root;
        }

        await this.persistRootWithClient(client, currentRoot, nextRoot, touchedRootKeys, touchedRecords, touchedRecordFields);
        const updatedRevisionResult = await client.query("UPDATE app_revision SET revision = revision + 1 WHERE singleton = true RETURNING revision");
        const revision = Number(updatedRevisionResult.rows[0]?.revision || 0);
        commitAttempted = true;
        await client.query("COMMIT");
        this.rootCache = nextRoot;
        this.rootRevision = revision;
        if (options.compactResult) return { revision };
        const root = clone(nextRoot);
        return options.includeRevision ? { root, revision } : root;
      } catch (error) {
        brokenClient = isTransientPgConnectionError(error);
        if (!brokenClient) {
          await client.query("ROLLBACK").catch(() => {});
        }
        if (brokenClient && !commitAttempted && attempt === 0) {
          continue;
        }
        throw error;
      } finally {
        client.release(brokenClient);
      }
    }
  }

  async persistRootWithClient(client, previousRoot, nextRoot, touchedRootKeys = null, touchedRecords = null, touchedRecordFields = null) {
    const keysToPersist = touchedRootKeys ? new Set(touchedRootKeys) : null;
    if (keysToPersist?.has("periods")) {
      keysToPersist.add("scores");
      keysToPersist.add("safetyRecords");
      keysToPersist.add("fiveSFindings");
    }
    const previousKeys = new Set(Object.keys(previousRoot || {}).filter((key) => !keysToPersist || keysToPersist.has(key)));
    const nextKeys = new Set(Object.keys(nextRoot || {}).filter((key) => !keysToPersist || keysToPersist.has(key)));
    const periodsChanged = stableJson(previousRoot?.periods) !== stableJson(nextRoot?.periods);
    const periodsById = periodIndexes(nextRoot);

    for (const key of previousKeys) {
      if (nextKeys.has(key)) continue;
      await client.query("DELETE FROM app_root_values WHERE root_key = $1", [key]);
      if (STRUCTURED_COLLECTIONS[key]) {
        await client.query(`DELETE FROM ${STRUCTURED_COLLECTIONS[key].table}`);
        await client.query("DELETE FROM app_collection_shapes WHERE collection = $1", [key]);
      }
    }

    for (const key of nextKeys) {
      const value = nextRoot[key];
      const structuredSpec = STRUCTURED_COLLECTIONS[key];
      const canStoreStructured = structuredSpec && (Array.isArray(value) || isPlainObject(value));
      if (canStoreStructured) {
        await client.query("DELETE FROM app_root_values WHERE root_key = $1", [key]);
        const shape = Array.isArray(value) ? "array" : "object";
        await client.query(
          "INSERT INTO app_collection_shapes (collection, shape) VALUES ($1, $2) ON CONFLICT (collection) DO UPDATE SET shape = EXCLUDED.shape",
          [key, shape],
        );
        await this.persistStructuredCollectionWithClient(
          client,
          key,
          previousRoot?.[key],
          value,
          periodsChanged,
          periodsById,
          periodsChanged ? null : touchedRecords?.[key],
          periodsChanged ? null : touchedRecordFields?.[key],
        );
        continue;
      }
      if (structuredSpec) await client.query(`DELETE FROM ${structuredSpec.table}`);
      await client.query("DELETE FROM app_collection_shapes WHERE collection = $1", [key]);
      await client.query(
        "INSERT INTO app_root_values (root_key, value) VALUES ($1, $2::jsonb) ON CONFLICT (root_key) DO UPDATE SET value = EXCLUDED.value WHERE app_root_values.value IS DISTINCT FROM EXCLUDED.value",
        [key, JSON.stringify(value)],
      );
    }
  }

  async persistStructuredCollectionWithClient(client, collection, previousValue, nextValue, periodsChanged = false, periodsById = new Map(), touchedRecordIds = null, touchedRecordFields = null) {
    const spec = STRUCTURED_COLLECTIONS[collection];
    if (Array.isArray(touchedRecordIds) && !periodsChanged) {
      const entries = touchedRecordIds.map((id) => collectionEntryForKey(nextValue, id)).filter(Boolean);
      const existingIds = new Set(entries.map((entry) => entry.key));
      for (const id of touchedRecordIds) {
        const previousEntry = collectionEntryForKey(previousValue, id);
        if (previousEntry && !existingIds.has(previousEntry.key)) {
          await client.query(`DELETE FROM ${spec.table} WHERE id = $1`, [previousEntry.key]);
        }
      }
      for (const entry of entries) {
        const previous = collectionEntryForKey(previousValue, entry.key);
        await this.persistStructuredEntryWithClient(client, collection, entry, periodsById, touchedRecordFields?.[entry.key], previous?.payload || null);
      }
      return;
    }

    const oldEntries = new Map(collectionEntries(previousValue).map((entry) => [entry.key, entry]));
    const nextEntries = collectionEntries(nextValue);
    const nextKeys = new Set(nextEntries.map((entry) => entry.key));
    for (const oldKey of oldEntries.keys()) {
      if (!nextKeys.has(oldKey)) {
        await client.query(`DELETE FROM ${spec.table} WHERE id = $1`, [oldKey]);
      }
    }

    for (const entry of nextEntries) {
      const previous = oldEntries.get(entry.key);
      if (!periodsChanged && previous && stableJson(previous.payload) === stableJson(entry.payload) && previous.position === entry.position) continue;
      await this.persistStructuredEntryWithClient(client, collection, entry, periodsById, touchedRecordFields?.[entry.key], previous?.payload || null);
    }
  }

  async persistStructuredEntryWithClient(client, collection, entry, periodsById = new Map(), changedFields = null, previousPayload = null) {
    const spec = STRUCTURED_COLLECTIONS[collection];
    const record = asObject(entry.payload);
    const fieldSet = Array.isArray(changedFields) ? new Set(changedFields) : null;
    if (previousPayload && fieldSet?.size && collection === "safetyRecords"
      && [...fieldSet].every((field) => ["photoAnnotations", "afterPhotoAnnotations", "updatedAt"].includes(field))) {
      const removedFields = [...fieldSet].filter((field) => !Object.prototype.hasOwnProperty.call(record, field) || record[field] === undefined);
      const dataPatch = Object.fromEntries([...fieldSet].filter((field) => !removedFields.includes(field)).map((field) => [field, record[field]]));
      await client.query(
        "UPDATE safety_records SET updated_at = $2, data = (data - $3::text[]) || $4::jsonb WHERE id = $1",
        [entry.key, safeTimestamp(record.updatedAt), removedFields, JSON.stringify(dataPatch)],
      );
      return;
    }
    if (previousPayload && fieldSet?.size && collection === "fiveSFindings"
      && [...fieldSet].every((field) => ["photoAnnotationsByRow", "updatedAt", "updatedBy"].includes(field))) {
      const removedFields = [...fieldSet].filter((field) => !Object.prototype.hasOwnProperty.call(record, field) || record[field] === undefined);
      const dataPatch = encodedStructuredPayload(collection, Object.fromEntries([...fieldSet].filter((field) => !removedFields.includes(field)).map((field) => [field, record[field]])));
      await client.query(
        "UPDATE five_s_findings SET updated_at = $2, updated_by = $3, data = (data - $4::text[]) || $5::jsonb WHERE id = $1",
        [entry.key, safeTimestamp(record.updatedAt), record.updatedBy || null, removedFields, dataPatch],
      );
      return;
    }
    const period = periodsById.get(String(record.periodId || ""));
    let position = entry.position;
    if (!Number.isInteger(position)) {
      const existingPosition = await client.query(`SELECT position FROM ${spec.table} WHERE id = $1`, [entry.key]);
      if (existingPosition.rows[0]) {
        position = Number(existingPosition.rows[0].position);
      } else {
        const nextPosition = await client.query(`SELECT COALESCE(MAX(position), -1) + 1 AS position FROM ${spec.table}`);
        position = Number(nextPosition.rows[0]?.position || 0);
      }
    }
    const fields = spec.fields.map(([, getter, type]) => {
      const value = getter(record);
      return type === "jsonb" ? (value === undefined || value === null ? null : JSON.stringify(value)) : (value === undefined ? null : value);
    });
    const derived = spec.periodAware
      ? [safeInteger(period?.year), safeInteger(period?.month)]
      : [];
    const payload = encodedStructuredPayload(collection, entry.payload);
    const columns = ["id", "position", ...spec.fields.map(([name]) => name), ...(spec.periodAware ? ["period_year", "period_month"] : []), "data"];
    const placeholders = columns.map((column, index) => {
      if (column === "data" || spec.fields.some(([name, , type]) => name === column && type === "jsonb")) return `$${index + 1}::jsonb`;
      return `$${index + 1}`;
    });
    const values = [entry.key, position, ...fields, ...derived, payload];
    const updates = columns.slice(1).map((column) => `${column} = EXCLUDED.${column}`).join(", ");
    await client.query(`
      INSERT INTO ${spec.table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})
      ON CONFLICT (id) DO UPDATE SET ${updates}
    `, values);
    const findingRowsChanged = !Array.isArray(changedFields)
      || changedFields.some((field) => field === "*" || field === "rows" || field.startsWith("rows/"));
    if (spec.hasItems && findingRowsChanged) await this.persistFindingItemsWithClient(client, entry.key, record.rows);
  }

  async persistFindingItemsWithClient(client, findingId, rowsValue) {
    await client.query("DELETE FROM five_s_finding_items WHERE finding_id = $1", [findingId]);
    for (const entry of collectionEntries(rowsValue)) {
      const row = asObject(entry.payload);
      await client.query(`
        INSERT INTO five_s_finding_items (
          finding_id, item_key, position, location, problem, category, shift,
          countermeasure, owner, due_date, progress, data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date, $11, $12::jsonb)
      `, [
        findingId,
        entry.key,
        entry.position,
        row.location ?? null,
        row.problem ?? null,
        row.fiveS ?? null,
        row.shift ?? null,
        row.countermeasure ?? null,
        row.owner ?? null,
        safeDate(row.dueDate),
        safeInteger(row.progress),
        JSON.stringify(entry.payload),
      ]);
    }
  }

  async readCollectionPage(collection, filters = {}) {
    if (!PAGED_COLLECTIONS.has(collection)) {
      const error = new Error("Danh sách này chưa hỗ trợ phân trang.");
      error.statusCode = 400;
      throw error;
    }
    const page = Math.max(1, Math.trunc(Number(filters.page) || 1));
    const pageSize = Math.min(100, Math.max(1, Math.trunc(Number(filters.pageSize) || 50)));
    const yearFilter = filters.year === null || filters.year === undefined ? "" : String(filters.year).trim();
    const monthFilter = filters.month === null || filters.month === undefined ? "" : String(filters.month).trim();
    if (yearFilter !== "" && (!Number.isInteger(Number(yearFilter)) || Number(yearFilter) < 2020 || Number(yearFilter) > 2100)) {
      const error = new Error("Năm lọc không hợp lệ.");
      error.statusCode = 400;
      throw error;
    }
    if (monthFilter !== "" && (!Number.isInteger(Number(monthFilter)) || Number(monthFilter) < 1 || Number(monthFilter) > 12)) {
      const error = new Error("Tháng lọc không hợp lệ.");
      error.statusCode = 400;
      throw error;
    }
    const spec = STRUCTURED_COLLECTIONS[collection];
    const conditions = [];
    const values = [];
    const addFilter = (column, value) => {
      if (value === undefined || value === null || String(value).trim() === "") return;
      values.push(String(value).trim());
      conditions.push(`${column} = $${values.length}`);
    };
    if (!spec) throw new Error("Bảng nghiệp vụ chưa được cấu hình cho phân trang.");
    addFilter("period_id", filters.periodId);
    addFilter("area_id", filters.areaId);
    addFilter("record_status", filters.status);
    if (collection === "safetyRecords") {
      const addSafetyDatePartFilter = (datePart, value) => {
        if (value === undefined || value === null || value === "") return;
        values.push(Number(value));
        const parameter = `$${values.length}`;
        const resolvedPart = datePart === "year"
          ? "COALESCE(EXTRACT(YEAR FROM issue_date)::int, EXTRACT(YEAR FROM occurred_at)::int, CASE WHEN data->>'issueDate' ~ '^\\d{4}-\\d{2}' THEN substring(data->>'issueDate' from 1 for 4)::int WHEN data->>'issueDate' ~ '^\\d{1,2}/\\d{1,2}/\\d{4}' THEN split_part(data->>'issueDate', '/', 3)::int WHEN data->>'date' ~ '^\\d{4}-\\d{2}' THEN substring(data->>'date' from 1 for 4)::int WHEN data->>'date' ~ '^\\d{1,2}/\\d{1,2}/\\d{4}' THEN split_part(data->>'date', '/', 3)::int END, EXTRACT(YEAR FROM created_at)::int, period_year)"
          : "COALESCE(EXTRACT(MONTH FROM issue_date)::int, EXTRACT(MONTH FROM occurred_at)::int, CASE WHEN data->>'issueMonth' ~ '^[0-9]{1,2}$' THEN (data->>'issueMonth')::int WHEN data->>'issueDate' ~ '^\\d{4}-\\d{2}' THEN substring(data->>'issueDate' from 6 for 2)::int WHEN data->>'issueDate' ~ '^\\d{1,2}/\\d{1,2}/\\d{4}' THEN split_part(data->>'issueDate', '/', 2)::int WHEN data->>'date' ~ '^\\d{4}-\\d{2}' THEN substring(data->>'date' from 6 for 2)::int WHEN data->>'date' ~ '^\\d{1,2}/\\d{1,2}/\\d{4}' THEN split_part(data->>'date', '/', 2)::int WHEN data->>'createdAt' ~ '^\\d{4}-\\d{2}' THEN substring(data->>'createdAt' from 6 for 2)::int END, EXTRACT(MONTH FROM created_at)::int, period_month)";
        conditions.push(`${resolvedPart} = ${parameter}`);
      };
      addSafetyDatePartFilter("year", yearFilter);
      addSafetyDatePartFilter("month", monthFilter);
    } else if (collection === "fiveSFindings") {
      const addFindingDatePartFilter = (datePart, value) => {
        if (value === undefined || value === null || value === "") return;
        values.push(Number(value));
        const parameter = `$${values.length}`;
        const resolvedPart = datePart === "year"
          ? "COALESCE(EXTRACT(YEAR FROM occurred_at)::int, CASE WHEN data->>'inspectionDate' ~ '^\\d{4}-\\d{2}' THEN substring(data->>'inspectionDate' from 1 for 4)::int WHEN data->>'inspectionDate' ~ '^\\d{1,2}/\\d{1,2}/\\d{4}' THEN split_part(data->>'inspectionDate', '/', 3)::int END, EXTRACT(YEAR FROM created_at)::int, period_year)"
          : "COALESCE(EXTRACT(MONTH FROM occurred_at)::int, CASE WHEN data->>'inspectionDate' ~ '^\\d{4}-\\d{2}' THEN substring(data->>'inspectionDate' from 6 for 2)::int WHEN data->>'inspectionDate' ~ '^\\d{1,2}/\\d{1,2}/\\d{4}' THEN split_part(data->>'inspectionDate', '/', 2)::int END, EXTRACT(MONTH FROM created_at)::int, period_month)";
        conditions.push(`${resolvedPart} = ${parameter}`);
      };
      addFindingDatePartFilter("year", yearFilter);
      addFindingDatePartFilter("month", monthFilter);
    } else {
      if (yearFilter !== "") addFilter("period_year", Number(yearFilter));
      if (monthFilter !== "") addFilter("period_month", Number(monthFilter));
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const count = await this.pool.query(`SELECT count(*)::int AS total FROM ${spec.table} ${where}`, values);
    const pageValues = [...values, pageSize, (page - 1) * pageSize];
    const rows = await this.pool.query(`
      SELECT id, data${spec.hasItems ? ", rows_shape" : ""} FROM ${spec.table}
      ${where}
      ORDER BY occurred_at DESC NULLS LAST, updated_at DESC NULLS LAST, id ASC
      LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}
    `, pageValues);
    let items = rows.rows.map((row) => ({ id: row.id, payload: row.data }));
    if (spec.hasItems && items.length) {
      const ids = items.map((item) => item.id);
      const childRows = await this.pool.query("SELECT finding_id, item_key, position, data FROM five_s_finding_items WHERE finding_id = ANY($1::text[]) ORDER BY finding_id, position, item_key", [ids]);
      const grouped = new Map();
      for (const child of childRows.rows) {
        if (!grouped.has(child.finding_id)) grouped.set(child.finding_id, []);
        grouped.get(child.finding_id).push(child);
      }
      const shapes = new Map(rows.rows.map((row) => [row.id, row.rows_shape]));
      items = items.map((item) => {
        const children = grouped.get(item.id) || [];
        const nested = shapes.get(item.id) === "object"
          ? Object.fromEntries(children.map((child) => [child.item_key, child.data]))
          : children.map((child) => child.data);
        return { ...item, payload: { ...item.payload, rows: nested } };
      });
    }
    return {
      items: items.map((item) => item.payload),
      page,
      pageSize,
      total: Number(count.rows[0]?.total || 0),
      totalPages: Math.ceil(Number(count.rows[0]?.total || 0) / pageSize),
    };
  }

  async importRoot(root, metadata = {}, verifySource = async () => true) {
    if (!this.initialized) throw new Error("PostgreSQL repository chưa được khởi tạo.");
    if (!isPlainObject(root)) throw new Error("Tệp dữ liệu nguồn không chứa đối tượng hợp lệ.");
    const importableRoot = clone(root);
    delete importableRoot.fiveSPatrols;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(593842, 1)");
      const marker = await client.query("SELECT value FROM app_meta WHERE meta_key = 'legacy_json_import'");
      if (marker.rows[0]) {
        if (marker.rows[0].value?.sourceSha256 === metadata.sourceSha256) {
          await client.query("COMMIT");
          return { imported: false, alreadyImported: true, counts: marker.rows[0].value?.counts || {} };
        }
        throw new Error("Cơ sở dữ liệu đã có dấu mốc nhập dữ liệu JSON. Không ghi đè dữ liệu PostgreSQL hiện tại.");
      }
      const existingRoot = await this.readRootWithClient(client);
      if (Object.keys(existingRoot).length) throw new Error("PostgreSQL không trống; đã dừng để tránh ghi đè dữ liệu.");

      await this.persistRootWithClient(client, {}, importableRoot);
      const importedRoot = await this.readRootWithClient(client);
      if (stableJson(importedRoot) !== stableJson(importableRoot)) {
        throw new Error("Đối chiếu dữ liệu sau nhập thất bại; PostgreSQL đã được rollback.");
      }
      if (!(await verifySource())) {
        throw new Error("Tệp JSON nguồn đã thay đổi trong lúc nhập; PostgreSQL đã được rollback. Hãy dừng ứng dụng cũ rồi chạy lại.");
      }
      const counts = rootCounts(importableRoot);
      const source = {
        sourceSha256: String(metadata.sourceSha256 || ""),
        sourceFile: String(metadata.sourceFile || ""),
        importedAt: new Date().toISOString(),
        counts,
      };
      await client.query("INSERT INTO app_meta (meta_key, value) VALUES ('legacy_json_import', $1::jsonb)", [JSON.stringify(source)]);
      const revisionResult = await client.query("UPDATE app_revision SET revision = 1 WHERE singleton = true RETURNING revision");
      await client.query("COMMIT");
      this.rootCache = clone(importedRoot);
      this.rootRevision = Number(revisionResult.rows[0]?.revision || 1);
      return { imported: true, alreadyImported: false, counts };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = {
  PostgresRepository,
  RECORD_COLLECTIONS,
  PAGED_COLLECTIONS,
  rootCounts,
};
