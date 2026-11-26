"use strict";

const fs = require("node:fs");
const path = require("node:path");

function loadDotEnv(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match || Object.prototype.hasOwnProperty.call(process.env, match[1])) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    process.env[match[1]] = value;
  }
}

function createPoolConfig(env = process.env) {
  let connectionString = String(env.DATABASE_URL || "").trim();
  const hostOverride = String(env.POSTGRES_HOST || "").trim();
  const portOverride = String(env.POSTGRES_PORT || "").trim();
  const database = String(env.POSTGRES_DB || "").trim();
  const user = String(env.POSTGRES_USER || "").trim();
  const password = String(env.POSTGRES_PASSWORD || "");
  const hasDiscreteConfig = Boolean(hostOverride && database && user && password);

  if (hasDiscreteConfig) {
    const url = new URL(`postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${hostOverride}:${portOverride || "5432"}/${encodeURIComponent(database)}`);
    connectionString = url.toString();
  } else if (connectionString) {
    let url;
    try {
      url = new URL(connectionString);
    } catch (_) {
      throw new Error("DATABASE_URL không đúng định dạng PostgreSQL.");
    }
    if (!/^postgres(?:ql)?:$/.test(url.protocol)) {
      throw new Error("DATABASE_URL phải dùng giao thức postgres:// hoặc postgresql://.");
    }
    if (hostOverride) url.hostname = hostOverride;
    if (portOverride) url.port = portOverride;
    // node-postgres uses PostgreSQL's default schema unless search_path is specified.
    url.searchParams.delete("schema");
    connectionString = url.toString();
  } else {
    if (!hostOverride || !database || !user || !password) {
      throw new Error("Thiếu cấu hình PostgreSQL: cần DATABASE_URL hoặc POSTGRES_HOST, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD.");
    }
    const url = new URL(`postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${hostOverride}:${portOverride || "5432"}/${encodeURIComponent(database)}`);
    connectionString = url.toString();
  }

  const poolConfig = {
    connectionString,
    max: Math.max(1, Math.min(30, Number(env.PGPOOL_MAX) || 10)),
    idleTimeoutMillis: Math.max(1000, Number(env.PGPOOL_IDLE_TIMEOUT_MS) || 30000),
    connectionTimeoutMillis: Math.max(1000, Number(env.PG_CONNECT_TIMEOUT_MS) || 5000),
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    application_name: String(env.PGAPPNAME || "legroup-5s"),
  };
  if (String(env.PGSSLMODE || "").toLowerCase() === "require") {
    poolConfig.ssl = { rejectUnauthorized: String(env.PGSSL_REJECT_UNAUTHORIZED || "true").toLowerCase() !== "false" };
  }
  return poolConfig;
}

module.exports = {
  loadDotEnv,
  createPoolConfig,
};
