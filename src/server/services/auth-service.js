"use strict";

const crypto = require("node:crypto");

const ROLE_ADMIN = "admin";
const ROLE_ASSESSOR_5S = "assessor5s";
const ROLE_ASSESSOR_SAFETY = "assessorSafety";
const ROLE_ZONE_OWNER = "zoneOwner";
const FIVE_S_PERIOD_TYPE = "5s";
const SAFETY_PERIOD_TYPE = "safety";
const LEGACY_PERIOD_TYPE = "both";
const TOKEN_COOKIE_NAME = "legroup_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_HASH_VERSION = "pbkdf2-sha256";
const PASSWORD_ITERATIONS = 210000;
const PASSWORD_KEY_BYTES = 32;

function clone(value) {
  if (value === undefined) {
    return null;
  }
  return JSON.parse(JSON.stringify(value));
}

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlJson(value) {
  return base64Url(JSON.stringify(value));
}

function signPayload(encodedPayload, secret) {
  return crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function safeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.pbkdf2Sync(String(password || ""), salt, PASSWORD_ITERATIONS, PASSWORD_KEY_BYTES, "sha256").toString("base64url");
  return `${PASSWORD_HASH_VERSION}$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

function verifyPasswordHash(password, storedHash) {
  const [version, iterationsText, salt, hash] = String(storedHash || "").split("$");
  const iterations = Number(iterationsText);
  if (version !== PASSWORD_HASH_VERSION || !Number.isInteger(iterations) || !salt || !hash) {
    return false;
  }

  const candidate = crypto.pbkdf2Sync(String(password || ""), salt, iterations, PASSWORD_KEY_BYTES, "sha256").toString("base64url");
  return safeEqualText(candidate, hash);
}

function pathParts(input) {
  return String(input || "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectionValues(collection) {
  if (Array.isArray(collection)) {
    return collection.filter(Boolean);
  }
  if (isPlainObject(collection)) {
    return Object.values(collection).filter(Boolean);
  }
  return [];
}

function collectionEntries(collection) {
  if (Array.isArray(collection)) {
    return collection.map((value, index) => [index, value]).filter(([, value]) => Boolean(value));
  }
  if (isPlainObject(collection)) {
    return Object.entries(collection).filter(([, value]) => Boolean(value));
  }
  return [];
}

function valueAtPath(root, targetPath) {
  let cursor = root;
  for (const part of pathParts(targetPath)) {
    if (!cursor || typeof cursor !== "object" || !Object.prototype.hasOwnProperty.call(cursor, part)) {
      return null;
    }
    cursor = cursor[part];
  }
  return cursor ?? null;
}

function normalizeAccountRole(role) {
  const value = String(role || "").trim();
  if (value === ROLE_ADMIN) return ROLE_ADMIN;
  if (["safetyAssessor", ROLE_ASSESSOR_SAFETY].includes(value)) return ROLE_ASSESSOR_SAFETY;
  if (["manager", "scorer", ROLE_ZONE_OWNER].includes(value)) return ROLE_ZONE_OWNER;
  return ROLE_ASSESSOR_5S;
}

function normalizeCatalogType(type) {
  return type === SAFETY_PERIOD_TYPE ? SAFETY_PERIOD_TYPE : FIVE_S_PERIOD_TYPE;
}

function normalizePeriodType(type) {
  if (type === SAFETY_PERIOD_TYPE) return SAFETY_PERIOD_TYPE;
  if (type === FIVE_S_PERIOD_TYPE) return FIVE_S_PERIOD_TYPE;
  return LEGACY_PERIOD_TYPE;
}

function normalizeScoreSource(source) {
  return source === "self" ? "self" : "assessor";
}

function normalizeAccountAccessTypes(accessTypes, role = "") {
  const normalizedRole = normalizeAccountRole(role);
  if (normalizedRole === ROLE_ADMIN) {
    return [FIVE_S_PERIOD_TYPE, SAFETY_PERIOD_TYPE];
  }

  const rawValues = Array.isArray(accessTypes)
    ? accessTypes
    : String(accessTypes || "").split(/[\s,|]+/g);
  const values = rawValues
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .map((value) => normalizeCatalogType(value));

  if (!values.length) {
    values.push(normalizedRole === ROLE_ASSESSOR_SAFETY ? SAFETY_PERIOD_TYPE : FIVE_S_PERIOD_TYPE);
  }

  return [...new Set(values)];
}

function normalizeScopedAccountRole(role, type = FIVE_S_PERIOD_TYPE) {
  const normalizedRole = normalizeAccountRole(role);
  if (normalizedRole === ROLE_ZONE_OWNER) {
    return ROLE_ZONE_OWNER;
  }
  return normalizeCatalogType(type) === SAFETY_PERIOD_TYPE ? ROLE_ASSESSOR_SAFETY : ROLE_ASSESSOR_5S;
}

function normalizeAccountRolesByType(account) {
  const accessTypes = normalizeAccountAccessTypes(account?.accessTypes, account?.role);
  const rawRoles = account?.rolesByType || account?.accessRoles || {};
  return accessTypes.reduce((roles, type) => {
    roles[type] = normalizeScopedAccountRole(rawRoles[type] || account?.role, type);
    return roles;
  }, {});
}

function hasAccountAccessType(account, type = FIVE_S_PERIOD_TYPE) {
  if (!account) {
    return false;
  }
  if (normalizeAccountRole(account.role) === ROLE_ADMIN) {
    return true;
  }
  return normalizeAccountAccessTypes(account.accessTypes, account.role).includes(normalizeCatalogType(type));
}

function getAccountRoleForType(account, type = FIVE_S_PERIOD_TYPE) {
  if (!account) {
    return "";
  }
  if (normalizeAccountRole(account.role) === ROLE_ADMIN) {
    return ROLE_ADMIN;
  }
  return normalizeAccountRolesByType(account)[normalizeCatalogType(type)] || "";
}

function getAccountAreaIds(account, type = FIVE_S_PERIOD_TYPE) {
  if (!account) {
    return [];
  }
  const normalizedType = normalizeCatalogType(type);
  const typedKey = normalizedType === SAFETY_PERIOD_TYPE ? "safetyAreaIds" : "fiveSAreaIds";
  if (Array.isArray(account[typedKey])) {
    return [...new Set(account[typedKey].filter(Boolean))];
  }

  const legacyIds = Array.isArray(account.areaIds) ? account.areaIds.filter(Boolean) : [];
  if (normalizedType === FIVE_S_PERIOD_TYPE || normalizeAccountRole(account.role) === ROLE_ASSESSOR_SAFETY) {
    return [...new Set(legacyIds)];
  }
  return [];
}

function getAccountPersonId(account, type = FIVE_S_PERIOD_TYPE) {
  const normalizedType = normalizeCatalogType(type);
  const role = getAccountRoleForType(account, normalizedType);
  if (role === ROLE_ZONE_OWNER) {
    return normalizedType === SAFETY_PERIOD_TYPE ? account?.safetyScorerId || account?.scorerId || "" : account?.fiveSScorerId || account?.scorerId || "";
  }
  return normalizedType === SAFETY_PERIOD_TYPE ? account?.safetyAssessorId || account?.assessorId || "" : account?.fiveSAssessorId || account?.assessorId || "";
}

function isAdminAccount(account) {
  return normalizeAccountRole(account?.role) === ROLE_ADMIN;
}

function sameNormalizedText(left, right) {
  return String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
}

function safetyRecordTextMatchesName(value, name) {
  const cleanName = String(name || "").trim();
  const cleanValue = String(value || "").trim();
  if (!cleanName || !cleanValue) {
    return false;
  }
  return sameNormalizedText(cleanValue, cleanName) || cleanValue
    .split(/[,;\n]+/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => sameNormalizedText(part, cleanName));
}

function accountHasAnyAccess(account) {
  return isAdminAccount(account) || hasAccountAccessType(account, FIVE_S_PERIOD_TYPE) || hasAccountAccessType(account, SAFETY_PERIOD_TYPE);
}

class AuthService {
  constructor({ repository, secret = "" }) {
    this.repository = repository;
    this.secret = String(secret || crypto.randomBytes(32).toString("base64url"));
  }

  sanitizeAccount(account) {
    if (!account || typeof account !== "object") {
      return null;
    }

    const { password, passwordHash, passwordSalt, ...safeAccount } = account;
    return clone(safeAccount);
  }

  sanitizeRoot(root) {
    const safeRoot = clone(root);
    if (!safeRoot || typeof safeRoot !== "object") {
      return safeRoot;
    }

    if (Array.isArray(safeRoot.accounts)) {
      safeRoot.accounts = safeRoot.accounts.map((account) => this.sanitizeAccount(account)).filter(Boolean);
    } else if (isPlainObject(safeRoot.accounts)) {
      safeRoot.accounts = Object.fromEntries(
        Object.entries(safeRoot.accounts)
          .map(([id, account]) => [id, this.sanitizeAccount(account)])
          .filter(([, account]) => Boolean(account)),
      );
    }

    return safeRoot;
  }

  prepareAccountForStorage(account, existingAccount = null) {
    const nextAccount = clone(account) || {};
    const nextPassword = typeof nextAccount.password === "string" ? nextAccount.password : "";
    if (nextPassword) {
      nextAccount.passwordHash = hashPassword(nextPassword);
    } else if (!nextAccount.passwordHash && existingAccount?.passwordHash) {
      nextAccount.passwordHash = existingAccount.passwordHash;
    } else if (!nextAccount.passwordHash && existingAccount?.password) {
      nextAccount.passwordHash = hashPassword(existingAccount.password);
    }

    delete nextAccount.password;
    delete nextAccount.passwordSalt;
    return nextAccount;
  }

  prepareRootForStorage(nextRoot, previousRoot = null) {
    const root = clone(nextRoot);
    if (!root || typeof root !== "object") {
      return root;
    }

    if (root.history) {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 3);
      const cutoffMs = cutoff.getTime();

      const isFreshHistory = (entry) => {
        const time = Date.parse(entry?.timestamp || entry?.sessionStartedAt || entry?.sessionLastChangedAt || "");
        return Number.isFinite(time) && time >= cutoffMs;
      };

      if (Array.isArray(root.history)) {
        root.history = root.history.filter(isFreshHistory);
      } else if (isPlainObject(root.history)) {
        root.history = Object.fromEntries(
          Object.entries(root.history).filter(([, entry]) => isFreshHistory(entry))
        );
      }
    }

    if (!root.accounts) {
      return root;
    }

    const previousAccounts = collectionValues(previousRoot?.accounts);
    const existingById = new Map(previousAccounts.map((account) => [account.id, account]));
    const existingByUsername = new Map(previousAccounts.map((account) => [account.username, account]));

    if (Array.isArray(root.accounts)) {
      root.accounts = root.accounts.map((account) => {
        const existing = existingById.get(account?.id) || existingByUsername.get(account?.username) || null;
        return this.prepareAccountForStorage(account, existing);
      });
    } else if (isPlainObject(root.accounts)) {
      root.accounts = Object.fromEntries(collectionEntries(root.accounts).map(([id, account]) => {
        const existing = existingById.get(account?.id) || existingByUsername.get(account?.username) || null;
        return [id, this.prepareAccountForStorage(account, existing)];
      }));
    }

    return root;
  }

  findAccount(root, predicate) {
    return collectionValues(root?.accounts).find(predicate) || null;
  }

  isSessionFresh(account) {
    const expiresAt = Date.parse(account?.activeSessionExpiresAt || "");
    return Number.isFinite(expiresAt) && expiresAt > Date.now();
  }

  hasOtherActiveSession(account, sessionId) {
    const activeSessionId = String(account?.activeSessionId || "");
    if (!activeSessionId || activeSessionId === String(sessionId || "")) {
      return false;
    }
    return this.isSessionFresh(account);
  }

  verifyAccountPassword(account, password) {
    const rawCandidate = String(password || "");
    const trimmedCandidate = rawCandidate.trim();
    if (account?.passwordHash) {
      if (verifyPasswordHash(rawCandidate, account.passwordHash)) {
        return true;
      }
      if (trimmedCandidate && trimmedCandidate !== rawCandidate && verifyPasswordHash(trimmedCandidate, account.passwordHash)) {
        return true;
      }
      return false;
    }
    return typeof account?.password === "string" && (
      safeEqualText(account.password, rawCandidate) ||
      (trimmedCandidate ? safeEqualText(account.password, trimmedCandidate) : false)
    );
  }

  createToken(account, sessionId, expiresAt) {
    const payload = {
      sub: account.id || "",
      username: account.username || "",
      role: normalizeAccountRole(account.role),
      sid: sessionId,
      iat: Date.now(),
      exp: Date.parse(expiresAt),
    };
    const encodedPayload = base64UrlJson(payload);
    return `${encodedPayload}.${signPayload(encodedPayload, this.secret)}`;
  }

  verifyToken(token) {
    const [encodedPayload, signature] = String(token || "").split(".");
    if (!encodedPayload || !signature) {
      throw createHttpError("Phiên đăng nhập không hợp lệ.", 401);
    }

    const expectedSignature = signPayload(encodedPayload, this.secret);
    if (!safeEqualText(signature, expectedSignature)) {
      throw createHttpError("Phiên đăng nhập không hợp lệ.", 401);
    }

    let payload;
    try {
      payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    } catch (error) {
      throw createHttpError("Phiên đăng nhập không hợp lệ.", 401);
    }

    if (!payload?.sub || !payload?.sid || !Number.isFinite(Number(payload.exp)) || Number(payload.exp) <= Date.now()) {
      throw createHttpError("Phiên đăng nhập đã hết hạn.", 401);
    }

    return payload;
  }

  extractToken(request) {
    const authorization = String(request.headers.authorization || "");
    const bearerMatch = /^Bearer\s+(.+)$/i.exec(authorization);
    if (bearerMatch) {
      return bearerMatch[1].trim();
    }

    const cookies = Object.fromEntries(
      String(request.headers.cookie || "")
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const separator = part.indexOf("=");
          return separator >= 0 ? [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))] : [part, ""];
        }),
    );
    return cookies[TOKEN_COOKIE_NAME] || "";
  }

  async login(username, password) {
    const cleanUsername = String(username || "").trim();
    const candidatePassword = String(password || "");
    if (!cleanUsername || !candidatePassword) {
      throw createHttpError("Vui lòng nhập tài khoản và mật khẩu.", 400);
    }

    let result = null;
    const nextRoot = await this.repository.updateRoot((currentRoot) => {
      const preparedRoot = this.prepareRootForStorage(currentRoot || {}, currentRoot || {});
      const account = this.findAccount(preparedRoot, (item) => item.username === cleanUsername);
      if (!account || !this.verifyAccountPassword(account, candidatePassword)) {
        throw createHttpError("Sai tài khoản hoặc mật khẩu.", 401);
      }

      const sessionId = crypto.randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
      account.activeSessionId = sessionId;
      account.activeSessionAt = now.toISOString();
      account.activeSessionExpiresAt = expiresAt;
      account.activeSessionStartedAt = now.toISOString();
      const token = this.createToken(account, sessionId, expiresAt);
      result = {
        token,
        sessionId,
        sessionStartedAt: account.activeSessionStartedAt,
        expiresAt,
        accountId: account.id || "",
        username: account.username || "",
      };
      return preparedRoot;
    });

    const account = this.findAccount(nextRoot, (item) => item.id === result.accountId)
      || this.findAccount(nextRoot, (item) => item.username === result.username);
    return {
      ...result,
      account: this.sanitizeAccount(account),
      root: this.sanitizeRoot(nextRoot),
    };
  }

  async authenticateRequest(request) {
    const token = this.extractToken(request);
    const payload = this.verifyToken(token);
    const root = await this.repository.readRoot();
    const account = this.findAccount(root, (item) => item.id === payload.sub)
      || this.findAccount(root, (item) => item.username === payload.username);
    if (!account) {
      throw createHttpError("Tài khoản không còn tồn tại.", 401);
    }
    if (String(account.activeSessionId || "") !== String(payload.sid || "")) {
      throw createHttpError("Phiên đăng nhập đã bị thay thế.", 401);
    }

    return {
      account: this.sanitizeAccount(account),
      rawAccount: account,
      payload,
      token,
      root,
    };
  }

  async touchSession(request, options = {}) {
    const includeRoot = options.includeRoot !== false;
    const token = this.extractToken(request);
    const payload = this.verifyToken(token);
    let result = null;
    const nextRoot = await this.repository.updateRoot((currentRoot) => {
      const root = this.prepareRootForStorage(currentRoot || {}, currentRoot || {});
      const account = this.findAccount(root, (item) => item.id === payload.sub)
        || this.findAccount(root, (item) => item.username === payload.username);
      if (!account || String(account.activeSessionId || "") !== String(payload.sid || "")) {
        throw createHttpError("Phiên đăng nhập đã bị thay thế.", 401);
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
      const sessionStartedAt = account.activeSessionStartedAt || account.activeSessionAt || now.toISOString();
      account.activeSessionAt = now.toISOString();
      account.activeSessionExpiresAt = expiresAt;
      account.activeSessionStartedAt = sessionStartedAt;

      result = {
        token: this.createToken(account, payload.sid, expiresAt),
        sessionId: payload.sid,
        sessionStartedAt,
        expiresAt,
        accountId: account.id || "",
        username: account.username || "",
        account: this.sanitizeAccount(account),
      };
      return root;
    });

    return {
      ...result,
      ...(includeRoot ? { root: this.sanitizeRoot(nextRoot) } : {}),
    };
  }

  async logout(request) {
    const token = this.extractToken(request);
    if (!token) {
      return { ok: true };
    }

    let payload = null;
    try {
      payload = this.verifyToken(token);
    } catch (error) {
      return { ok: true };
    }

    await this.repository.updateRoot((currentRoot) => {
      const account = this.findAccount(currentRoot, (item) => item.id === payload.sub)
        || this.findAccount(currentRoot, (item) => item.username === payload.username);
      if (account && String(account.activeSessionId || "") === String(payload.sid || "")) {
        account.activeSessionId = "";
        account.activeSessionAt = "";
        account.activeSessionExpiresAt = "";
        account.activeSessionStartedAt = "";
      }
      return this.prepareRootForStorage(currentRoot || {}, currentRoot || {});
    });

    return { ok: true };
  }

  getPeriodType(root, periodId) {
    const period = collectionValues(root?.periods).find((item) => item.id === periodId);
    const type = normalizePeriodType(period?.type);
    return type === SAFETY_PERIOD_TYPE ? SAFETY_PERIOD_TYPE : FIVE_S_PERIOD_TYPE;
  }

  getAreasForPeriod(root, periodId, type = FIVE_S_PERIOD_TYPE) {
    const period = collectionValues(root?.periods).find((item) => item.id === periodId);
    const snapshotAreas = collectionValues(period?.settingsSnapshot?.areas);
    if (snapshotAreas.length) {
      return snapshotAreas;
    }
    return collectionValues(type === SAFETY_PERIOD_TYPE ? root?.safetyAreas : root?.areas);
  }

  getAllowedAreaIds(root, account, periodId, explicitType = "") {
    const type = explicitType ? normalizeCatalogType(explicitType) : this.getPeriodType(root, periodId);
    const areas = this.getAreasForPeriod(root, periodId, type);
    if (isAdminAccount(account)) {
      return new Set(areas.map((area) => area.id).filter(Boolean));
    }
    if (!hasAccountAccessType(account, type)) {
      return new Set();
    }

    const role = getAccountRoleForType(account, type);
    const personId = getAccountPersonId(account, type);
    const explicitIds = getAccountAreaIds(account, type);
    const byPerson = areas
      .filter((area) => role === ROLE_ZONE_OWNER
        ? personId && area.scorerId === personId
        : personId && (area.assessorId === personId || (Array.isArray(area.assessorIds) && area.assessorIds.includes(personId)))
      )
      .map((area) => area.id)
      .filter(Boolean);
    return new Set([...explicitIds, ...byPerson]);
  }

  getAccountDisplayNameCandidates(root, account, periodId, type = FIVE_S_PERIOD_TYPE) {
    const normalizedType = normalizeCatalogType(type);
    const period = collectionValues(root?.periods).find((item) => item.id === periodId);
    const snapshot = period?.settingsSnapshot || {};
    const role = getAccountRoleForType(account, normalizedType);
    const personId = getAccountPersonId(account, normalizedType);
    const rootCollection = normalizedType === SAFETY_PERIOD_TYPE
      ? role === ROLE_ZONE_OWNER ? root?.safetyManagers : root?.safetyAssessors
      : role === ROLE_ZONE_OWNER ? root?.managers : root?.assessors;
    const snapshotCollection = normalizedType === SAFETY_PERIOD_TYPE
      ? role === ROLE_ZONE_OWNER ? snapshot.safetyManagers || snapshot.managers : snapshot.safetyAssessors || snapshot.assessors
      : role === ROLE_ZONE_OWNER ? snapshot.managers : snapshot.assessors;
    const people = [...collectionValues(snapshotCollection), ...collectionValues(rootCollection)];
    const person = people.find((item) => item?.id && item.id === personId);
    return [
      account?.username,
      account?.name,
      person?.name,
    ].map((value) => String(value || "").trim()).filter(Boolean);
  }

  isRecordOwnedByAccount(root, record, account, type = SAFETY_PERIOD_TYPE) {
    if (!record || !account) {
      return false;
    }
    if (isAdminAccount(account)) {
      return true;
    }
    const accountUsername = String(account?.username || "").trim();
    const recordUsername = String(record?.accountUsername || record?.createdBy || "").trim();
    if (recordUsername) {
      return sameNormalizedText(recordUsername, accountUsername);
    }
    const names = this.getAccountDisplayNameCandidates(root, account, record?.periodId || "", type);
    if (record?.scorerName) {
      return names.some((name) => sameNormalizedText(record.scorerName, name));
    }
    return names.some((name) => safetyRecordTextMatchesName(record?.issueFoundBy, name));
  }

  assertScoreWriteAllowed(root, account, command) {
    const existingRecord = valueAtPath(root, command.path);
    const operation = String(command.operation || "");
    const record = operation === "remove"
      ? existingRecord
      : operation === "update"
        ? { ...(isPlainObject(existingRecord) ? existingRecord : {}), ...(isPlainObject(command.value) ? command.value : {}) }
        : command.value;
    if (!isPlainObject(record)) {
      throw createHttpError("Dữ liệu điểm không hợp lệ.", 400);
    }

    const recordsToCheck = [record];
    if (isPlainObject(existingRecord) && existingRecord !== record) {
      recordsToCheck.push(existingRecord);
    }

    recordsToCheck.forEach((candidate) => {
      const periodId = String(candidate.periodId || "");
      const areaId = String(candidate.areaId || "");
      if (!periodId || !areaId || !hasAccountAccessType(account, FIVE_S_PERIOD_TYPE)) {
        throw createHttpError("Bạn không có quyền ghi điểm 5S.", 403);
      }

      const allowedAreaIds = this.getAllowedAreaIds(root, account, periodId, FIVE_S_PERIOD_TYPE);
      const source = normalizeScoreSource(candidate.scoreSource);
      const role = getAccountRoleForType(account, FIVE_S_PERIOD_TYPE);
      const allowedSource = role === ROLE_ZONE_OWNER ? "self" : "assessor";
      if (!allowedAreaIds.has(areaId) || source !== allowedSource) {
        throw createHttpError("Bạn không có quyền ghi điểm 5S cho ô này.", 403);
      }
    });
  }

  assertSafetyRecordWriteAllowed(root, account, command) {
    const existingRecord = valueAtPath(root, command.path);
    const operation = String(command.operation || "");
    const record = operation === "remove"
      ? existingRecord
      : operation === "update"
        ? { ...(isPlainObject(existingRecord) ? existingRecord : {}), ...(isPlainObject(command.value) ? command.value : {}) }
        : command.value;
    if (operation === "remove" && !existingRecord) {
      return;
    }
    if (!isPlainObject(record)) {
      throw createHttpError("Dữ liệu đánh giá an toàn không hợp lệ.", 400);
    }

    if (isPlainObject(existingRecord) && !this.isRecordOwnedByAccount(root, existingRecord, account, SAFETY_PERIOD_TYPE)) {
      throw createHttpError("Bạn chỉ được sửa hoặc xóa đánh giá an toàn của mình.", 403);
    }
    const accountUsername = String(account.username || "").trim();
    const nextOwner = String(record.accountUsername || "").trim();
    if (operation !== "remove" && (!nextOwner || nextOwner !== accountUsername)) {
      throw createHttpError("Bạn không có quyền ghi đánh giá an toàn cho tài khoản khác.", 403);
    }

    const recordsToCheck = [record];
    if (isPlainObject(existingRecord) && existingRecord !== record) {
      recordsToCheck.push(existingRecord);
    }

    recordsToCheck.forEach((candidate) => {
      const periodId = String(candidate.periodId || "");
      const areaId = String(candidate.areaId || "");
      if (!periodId || !areaId || !hasAccountAccessType(account, SAFETY_PERIOD_TYPE)) {
        throw createHttpError("Bạn không có quyền ghi đánh giá an toàn.", 403);
      }

      const allowedAreaIds = this.getAllowedAreaIds(root, account, periodId, SAFETY_PERIOD_TYPE);
      if (!allowedAreaIds.has(areaId)) {
        throw createHttpError("Bạn không có quyền ghi đánh giá an toàn cho zone này.", 403);
      }
    });
  }

  assertHistoryWriteAllowed(account, command) {
    const operation = String(command.operation || "");
    if (operation === "remove") {
      throw createHttpError("Bạn không có quyền xóa lịch sử.", 403);
    }

    const entry = isPlainObject(command.value) ? command.value : {};
    const username = String(entry.username || "");
    if (username && username !== String(account.username || "")) {
      throw createHttpError("Bạn không có quyền ghi lịch sử cho tài khoản khác.", 403);
    }
  }

  findCollectionRecordById(collection, id) {
    const cleanId = String(id || "");
    if (!cleanId) {
      return null;
    }
    return collectionValues(collection).find((item) => item?.id === cleanId) || null;
  }

  assertDeletedSafetyRecordWriteAllowed(root, account, command) {
    const operation = String(command.operation || "");
    const [, recordIdFromPath] = pathParts(command.path);
    if (operation === "remove") {
      const marker = valueAtPath(root, command.path);
      if (!isPlainObject(marker)) {
        return;
      }
      if (marker.deletedBy && !sameNormalizedText(marker.deletedBy, account?.username)) {
        throw createHttpError("Bạn không có quyền khôi phục đánh dấu xóa này.", 403);
      }
      const allowedAreaIds = this.getAllowedAreaIds(root, account, marker.periodId, SAFETY_PERIOD_TYPE);
      if (!marker.periodId || !marker.areaId || !allowedAreaIds.has(marker.areaId)) {
        throw createHttpError("Bạn không có quyền khôi phục đánh dấu xóa này.", 403);
      }
      return;
    }
    if (!["set", "update"].includes(operation)) {
      throw createHttpError("Thao tác xóa đánh giá an toàn không hợp lệ.", 400);
    }

    const marker = operation === "update"
      ? { ...(isPlainObject(valueAtPath(root, command.path)) ? valueAtPath(root, command.path) : {}), ...(isPlainObject(command.value) ? command.value : {}) }
      : command.value;
    if (!isPlainObject(marker)) {
      throw createHttpError("Dữ liệu đánh dấu xóa không hợp lệ.", 400);
    }

    const recordId = String(marker.id || recordIdFromPath || "");
    const sourceScoreId = String(marker.sourceScoreId || (recordId.startsWith("safety-") ? recordId.slice("safety-".length) : ""));
    const existingRecord = this.findCollectionRecordById(root?.safetyRecords, recordId);
    const legacyRecord = sourceScoreId ? this.findCollectionRecordById(root?.scores, sourceScoreId) : null;
    const record = existingRecord || legacyRecord || marker;
    if (!record?.periodId || !record?.areaId || !hasAccountAccessType(account, SAFETY_PERIOD_TYPE)) {
      throw createHttpError("Bạn không có quyền xóa đánh giá an toàn.", 403);
    }

    if ((existingRecord || legacyRecord) && !this.isRecordOwnedByAccount(root, record, account, SAFETY_PERIOD_TYPE)) {
      throw createHttpError("Bạn chỉ được xóa đánh giá an toàn của mình.", 403);
    }

    const allowedAreaIds = this.getAllowedAreaIds(root, account, record.periodId, SAFETY_PERIOD_TYPE);
    if (!allowedAreaIds.has(record.areaId)) {
      throw createHttpError("Bạn không có quyền xóa đánh giá an toàn cho zone này.", 403);
    }
  }

  assertDataWriteAllowed(command, authContext, root) {
    const account = authContext?.rawAccount || authContext?.account;
    if (!account) {
      throw createHttpError("Bạn cần đăng nhập.", 401);
    }
    if (isAdminAccount(account)) {
      return;
    }

    const parts = pathParts(command.path);
    if (!parts.length && String(command.operation || "") === "update") {
      if (!isPlainObject(command.value)) {
        throw createHttpError("Dữ liệu update phải là object.", 400);
      }
      Object.entries(command.value).forEach(([childPath, value]) => {
        this.assertDataWriteAllowed({
          operation: value === null ? "remove" : "set",
          path: childPath,
          value,
        }, authContext, root);
      });
      return;
    }

    const [rootKey] = parts;
    if (rootKey === "scores") {
      this.assertScoreWriteAllowed(root, account, command);
      return;
    }
    if (rootKey === "safetyRecords") {
      this.assertSafetyRecordWriteAllowed(root, account, command);
      return;
    }
    if (rootKey === "deletedSafetyRecords") {
      this.assertDeletedSafetyRecordWriteAllowed(root, account, command);
      return;
    }
    if (rootKey === "history") {
      this.assertHistoryWriteAllowed(account, command);
      return;
    }

    throw createHttpError("Bạn không có quyền thay đổi dữ liệu quản trị.", 403);
  }

  assertPhotoAllowed(authContext) {
    const account = authContext?.rawAccount || authContext?.account;
    if (!account || !accountHasAnyAccess(account)) {
      throw createHttpError("Bạn không có quyền tải ảnh.", 403);
    }
  }

  assertSafetyMailAllowed(authContext) {
    const account = authContext?.rawAccount || authContext?.account;
    if (!isAdminAccount(account)) {
      throw createHttpError("Chỉ admin được gửi báo cáo an toàn.", 403);
    }
  }
}

module.exports = {
  AuthService,
  TOKEN_COOKIE_NAME,
  SESSION_TTL_MS,
};
