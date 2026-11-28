"use strict";

const crypto = require("node:crypto");

const ROLE_ADMIN = "admin";
const ROLE_ASSESSOR_5S = "assessor5s";
const ROLE_ASSESSOR_SAFETY = "assessorSafety";
const ROLE_ZONE_OWNER = "zoneOwner";
const ROLE_VIEWER = "viewer";
const ROLE_DEPARTMENT_HEAD = "departmentHead";
const ROLE_AT5S = "at5s";
const SCORE_SOURCE_ASSESSOR = "assessor";
const SCORE_SOURCE_SELF = "self";
const SCORE_SOURCE_AT5S = "at5s";
const SCORE_SOURCE_DEPARTMENT_HEAD = "departmentHead";
const MULTI_DAY_SCORE_SOURCES = new Set([SCORE_SOURCE_AT5S, SCORE_SOURCE_DEPARTMENT_HEAD]);
const FIVE_S_PERIOD_TYPE = "5s";
const SAFETY_PERIOD_TYPE = "safety";
const LEGACY_PERIOD_TYPE = "both";
const HIDDEN_SAFETY_ZONE_CODES = new Set(["27"]);
const TOKEN_COOKIE_NAME = "legroup_session";
// Sliding session window: keep users signed in between workdays while the active-session ID
// still lets a new device or explicit logout revoke the previous session immediately.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_TOUCH_MIN_INTERVAL_MS = 5 * 60 * 1000;
const SESSION_FIELDS = Object.freeze([
  "activeSessionId",
  "activeSessionAt",
  "activeSessionExpiresAt",
  "activeSessionStartedAt",
]);
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

function verifyPasswordHashAsync(password, storedHash) {
  const [version, iterationsText, salt, hash] = String(storedHash || "").split("$");
  const iterations = Number(iterationsText);
  if (version !== PASSWORD_HASH_VERSION || !Number.isInteger(iterations) || !salt || !hash) {
    return Promise.resolve(false);
  }

  return new Promise((resolve, reject) => {
    crypto.pbkdf2(String(password || ""), salt, iterations, PASSWORD_KEY_BYTES, "sha256", (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(safeEqualText(derivedKey.toString("base64url"), hash));
    });
  });
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
  if (["viewer", ROLE_VIEWER].includes(value)) return ROLE_VIEWER;
  if (["at5s", "banAt5s", "committee5s", "ban-at-5s", ROLE_AT5S].includes(value)) return ROLE_AT5S;
  if (["departmentHead", "deptHead", ROLE_DEPARTMENT_HEAD].includes(value)) return ROLE_DEPARTMENT_HEAD;
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
  const value = String(source || "").trim();
  if (value === SCORE_SOURCE_SELF) return SCORE_SOURCE_SELF;
  if (["at5s", "banAt5s", "committee5s", "ban-at-5s", SCORE_SOURCE_AT5S].includes(value)) return SCORE_SOURCE_AT5S;
  if (["departmentHead", "deptHead", "department-head", SCORE_SOURCE_DEPARTMENT_HEAD].includes(value)) return SCORE_SOURCE_DEPARTMENT_HEAD;
  return SCORE_SOURCE_ASSESSOR;
}

function normalizeAccountAccessTypes(accessTypes, role = "") {
  const normalizedRole = normalizeAccountRole(role);
  if (normalizedRole === ROLE_ADMIN || normalizedRole === ROLE_VIEWER) {
    return [FIVE_S_PERIOD_TYPE, SAFETY_PERIOD_TYPE];
  }

  const rawValues = Array.isArray(accessTypes)
    ? accessTypes
    : String(accessTypes || "").split(/[\s,|]+/g);
  const values = rawValues
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .map((value) => normalizeCatalogType(value));

  if (!values.length && Array.isArray(accessTypes)) return [];
  if (!values.length) {
    if (normalizedRole === ROLE_DEPARTMENT_HEAD || normalizedRole === ROLE_AT5S) {
      return [FIVE_S_PERIOD_TYPE, SAFETY_PERIOD_TYPE];
    }
    values.push(normalizedRole === ROLE_ASSESSOR_SAFETY ? SAFETY_PERIOD_TYPE : FIVE_S_PERIOD_TYPE);
  }

  return [...new Set(values)];
}

function normalizeScopedAccountRole(role, type = FIVE_S_PERIOD_TYPE) {
  const normalizedRole = normalizeAccountRole(role);
  if (normalizedRole === ROLE_VIEWER) {
    return ROLE_VIEWER;
  }
  if (normalizedRole === ROLE_AT5S) {
    return ROLE_AT5S;
  }
  if (normalizedRole === ROLE_DEPARTMENT_HEAD) {
    return ROLE_DEPARTMENT_HEAD;
  }
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

function hasAccountAccessType(account, type = FIVE_S_PERIOD_TYPE, root = null, periodId = "") {
  if (!account) {
    return false;
  }
  if (normalizeAccountRole(account.role) === ROLE_ADMIN) {
    return true;
  }
  const catalogType = normalizeCatalogType(type);
  if (normalizeAccountAccessTypes(account.accessTypes, account.role).includes(catalogType)) return true;
  if (!root) return false;
  const activePeriodId = periodId || (catalogType === SAFETY_PERIOD_TYPE
    ? root.activeSafetyPeriodId || ""
    : root.activeFiveSPeriodId || root.activePeriodId || "");
  return getAccountRoleAssignments(root, account, activePeriodId, catalogType).roles
    .some((role) => [ROLE_ZONE_OWNER, ROLE_DEPARTMENT_HEAD, ROLE_AT5S, catalogType === SAFETY_PERIOD_TYPE ? ROLE_ASSESSOR_SAFETY : ROLE_ASSESSOR_5S].includes(role));
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

function isViewerAccount(account) {
  return normalizeAccountRole(account?.role) === ROLE_VIEWER;
}

function isDepartmentHeadAccount(account) {
  return normalizeAccountRole(account?.role) === ROLE_DEPARTMENT_HEAD;
}

function isAt5sAccount(account) {
  return normalizeAccountRole(account?.role) === ROLE_AT5S;
}

function getDepartmentHeadAccountName(account) {
  return String(account?.departmentHeadName || account?.name || account?.displayName || account?.username || "").trim();
}

function employeeCodeKey(value) {
  return String(value || "").trim().replace(/\s+/g, "").toLocaleUpperCase("vi");
}

function isAreaManagedByDepartmentHead(area, account) {
  const accountCode = employeeCodeKey(account?.employeeCode);
  const areaCode = employeeCodeKey(area?.departmentHeadEmployeeCode);
  if (accountCode && areaCode) return accountCode === areaCode;
  const headName = getDepartmentHeadAccountName(account);
  return Boolean(headName && sameNormalizedText(area?.departmentHead, headName));
}

function normalizePersonNameKey(name) {
  return String(name || "")
    .replace(/^(mrs\b\.?|ms\b\.?|mr\b\.?)\s*/i, "")
    .trim();
}

function personNameMatches(accountName, catalogName) {
  if (!accountName || !catalogName) return false;
  if (sameNormalizedText(accountName, catalogName)) return true;
  const k1 = normalizePersonNameKey(accountName).toLowerCase();
  const k2 = normalizePersonNameKey(catalogName).toLowerCase();
  if (!k1 || !k2) return false;
  if (k1 === k2) return true;
  if (k1.endsWith(" " + k2) || k2.endsWith(" " + k1)) return true;
  return false;
}

function accountIdentityNames(account) {
  return [...new Set([account?.name, account?.displayName, isDepartmentHeadAccount(account) ? account?.departmentHeadName : ""]
    .map((value) => String(value || "").trim())
    .filter(Boolean))];
}

function getAccountRoleAssignments(root, account, periodId, type = FIVE_S_PERIOD_TYPE) {
  const catalogType = normalizeCatalogType(type);
  const period = collectionValues(root?.periods).find((item) => item?.id === periodId);
  const snapshot = period?.settingsSnapshot || {};
  const managers = [
    ...collectionValues(catalogType === SAFETY_PERIOD_TYPE ? snapshot.safetyManagers || snapshot.managers : snapshot.managers),
    ...collectionValues(catalogType === SAFETY_PERIOD_TYPE ? root?.safetyManagers || root?.managers : root?.managers),
  ];
  const assessors = [
    ...collectionValues(catalogType === SAFETY_PERIOD_TYPE ? snapshot.safetyAssessors || snapshot.assessors : snapshot.assessors),
    ...collectionValues(catalogType === SAFETY_PERIOD_TYPE ? root?.safetyAssessors || root?.assessors : root?.assessors),
  ];
  const at5sMembers = [
    ...collectionValues(snapshot.at5sMembers),
    ...collectionValues(root?.at5sMembers),
  ];
  const areas = collectionValues(snapshot.areas).length
    ? collectionValues(snapshot.areas)
    : collectionValues(catalogType === SAFETY_PERIOD_TYPE ? root?.safetyAreas : root?.areas);
  const names = accountIdentityNames(account);
  const departmentHeadNames = [...new Set([...names, account?.departmentHeadName]
    .map((value) => String(value || "").trim())
    .filter(Boolean))];
  const accountCode = employeeCodeKey(account?.employeeCode);
  const codesByName = new Map();
  [...managers, ...assessors, ...at5sMembers, ...areas.map((area) => ({ name: area?.departmentHead, employeeCode: area?.departmentHeadEmployeeCode }))]
    .forEach((person) => {
      const name = String(person?.name || "").trim().toLowerCase();
      const code = employeeCodeKey(person?.employeeCode);
      if (!name || !code) return;
      codesByName.set(name, (codesByName.get(name) || new Set()).add(code));
    });
  const isNameAmbiguous = (name) => (codesByName.get(String(name || "").trim().toLowerCase())?.size || 0) > 1;
  const matchesPerson = (person) => {
    const personCode = employeeCodeKey(person?.employeeCode);
    if (accountCode && personCode) return accountCode === personCode;
    return !isNameAmbiguous(person?.name) && names.some((name) => personNameMatches(name, person?.name));
  };
  const matchesDepartmentHeadArea = (area) => {
    const areaCode = employeeCodeKey(area?.departmentHeadEmployeeCode);
    if (accountCode && areaCode) return accountCode === areaCode;
    return !isNameAmbiguous(area?.departmentHead) && departmentHeadNames.some((name) => sameNormalizedText(name, area?.departmentHead));
  };
  const roles = new Set();
  const primaryRole = getAccountRoleForType(account, catalogType);
  if (primaryRole) roles.add(primaryRole);
  if (isAt5sAccount(account) || Object.values(account?.rolesByType || {}).some((r) => normalizeAccountRole(r) === ROLE_AT5S) || Boolean(account?.at5sMemberId)) {
    roles.add(ROLE_AT5S);
  }
  if (at5sMembers.some((member) => (account?.at5sMemberId && member?.id === account.at5sMemberId) || matchesPerson(member))) {
    roles.add(ROLE_AT5S);
  }
  if (managers.some(matchesPerson)) roles.add(ROLE_ZONE_OWNER);
  const assessorRole = catalogType === SAFETY_PERIOD_TYPE ? ROLE_ASSESSOR_SAFETY : ROLE_ASSESSOR_5S;
  if (assessors.some(matchesPerson)) roles.add(assessorRole);
  if (areas.some(matchesDepartmentHeadArea)) roles.add(ROLE_DEPARTMENT_HEAD);
  if (isDepartmentHeadAccount(account)
    && hasAccountAccessType(account, catalogType)
    && getAccountRoleForType(account, catalogType) === ROLE_DEPARTMENT_HEAD) {
    roles.add(ROLE_DEPARTMENT_HEAD);
  }
  return {
    roles: [...roles],
    managerIds: managers.filter((manager) => manager?.id && matchesPerson(manager)).map((manager) => manager.id),
    assessorIds: assessors.filter((assessor) => assessor?.id && matchesPerson(assessor)).map((assessor) => assessor.id),
    at5sMemberIds: at5sMembers.filter((member) => member?.id && ((account?.at5sMemberId && member.id === account.at5sMemberId) || matchesPerson(member))).map((member) => member.id),
    areas,
    hasDepartmentHead: roles.has(ROLE_DEPARTMENT_HEAD),
    hasAt5s: roles.has(ROLE_AT5S),
  };
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

  sanitizeRoot(root, viewerAccount = null) {
    if (root === undefined) {
      return null;
    }
    if (!root || typeof root !== "object") {
      return root;
    }

    const safeRoot = { ...root };

    // Audit history is an admin-only view. Keep it out of every non-admin
    // response (including login, polling and write acknowledgements).
    if (!isAdminAccount(viewerAccount)) {
      safeRoot.history = {};
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

  prepareRootForStorage(nextRoot, previousRoot = null, { mutate = false, collections = null } = {}) {
    const root = mutate && isPlainObject(nextRoot) ? nextRoot : clone(nextRoot);
    if (!root || typeof root !== "object") {
      return root;
    }

    const shouldPrepare = (collection) => !collections || collections.has(collection);

    if (shouldPrepare("history") && root.history) {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 12);
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

    if (!shouldPrepare("accounts") || !root.accounts) {
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

  findAccountEntry(root, predicate) {
    const accounts = root?.accounts;
    if (Array.isArray(accounts)) {
      for (let index = 0; index < accounts.length; index += 1) {
        const item = accounts[index];
        if (item && predicate(item)) {
          return { key: String(item.id || index), index, account: item, containerType: "array" };
        }
      }
      return null;
    }
    if (isPlainObject(accounts)) {
      for (const [key, item] of Object.entries(accounts)) {
        if (item && predicate(item)) {
          return { key, index: -1, account: item, containerType: "object" };
        }
      }
    }
    return null;
  }

  replaceAccountEntry(root, entry, nextAccount) {
    const baseRoot = isPlainObject(root) ? root : {};
    if (entry.containerType === "array" && Array.isArray(baseRoot.accounts)) {
      const nextAccounts = baseRoot.accounts.slice();
      nextAccounts[entry.index] = nextAccount;
      return { ...baseRoot, accounts: nextAccounts };
    }
    const nextAccounts = isPlainObject(baseRoot.accounts) ? { ...baseRoot.accounts } : {};
    nextAccounts[entry.key] = nextAccount;
    return { ...baseRoot, accounts: nextAccounts };
  }

  isAccountInactive(account) {
    return account?.active === false
      || (typeof account?.active === "string"
        && ["false", "0", "no", "inactive"].includes(account.active.trim().toLowerCase()));
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

  async verifyAccountPasswordAsync(account, password) {
    const rawCandidate = String(password || "");
    const trimmedCandidate = rawCandidate.trim();
    if (account?.passwordHash) {
      if (await verifyPasswordHashAsync(rawCandidate, account.passwordHash)) {
        return true;
      }
      if (trimmedCandidate && trimmedCandidate !== rawCandidate && await verifyPasswordHashAsync(trimmedCandidate, account.passwordHash)) {
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
    const cookies = Object.fromEntries(
      String(request.headers.cookie || "")
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const separator = part.indexOf("=");
          if (separator < 0) return [part, ""];
          const rawValue = part.slice(separator + 1);
          try {
            return [part.slice(0, separator), decodeURIComponent(rawValue)];
          } catch (_) {
            return [part.slice(0, separator), rawValue];
          }
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

    const initialSnapshot = typeof this.repository.readRootSnapshot === "function"
      ? await this.repository.readRootSnapshot({ cloneRoot: false })
      : { root: await this.repository.readRoot(), revision: null };
    const initialEntry = this.findAccountEntry(initialSnapshot?.root || {}, (item) => item.username === cleanUsername);
    if (!initialEntry?.account || !(await this.verifyAccountPasswordAsync(initialEntry.account, candidatePassword))) {
      throw createHttpError("Sai tài khoản hoặc mật khẩu.", 401);
    }
    if (this.isAccountInactive(initialEntry.account)) {
      throw createHttpError("Tài khoản đã bị khóa hoặc ngừng kích hoạt.", 403);
    }

    const initialAccount = initialEntry.account;
    const initialPasswordHash = initialAccount.passwordHash || "";
    const initialPlainPassword = typeof initialAccount.password === "string" ? initialAccount.password : "";
    const hasLegacySecrets = typeof initialAccount.password === "string"
      || Object.prototype.hasOwnProperty.call(initialAccount, "passwordSalt");
    const touchedRecords = { accounts: [initialEntry.key] };
    const touchedRecordFields = hasLegacySecrets
      ? null
      : { accounts: { [initialEntry.key]: SESSION_FIELDS } };

    let result = null;
    let updatedAccount = null;
    const updateResult = await this.repository.updateRoot((currentRoot) => {
      const entry = this.findAccountEntry(currentRoot || {}, (item) => item.username === cleanUsername);
      if (!entry?.account) {
        throw createHttpError("Sai tài khoản hoặc mật khẩu.", 401);
      }
      const currentAccount = entry.account;
      const credentialsChanged = (currentAccount.passwordHash || "") !== initialPasswordHash
        || (typeof currentAccount.password === "string" ? currentAccount.password : "") !== initialPlainPassword;
      if (credentialsChanged && !this.verifyAccountPassword(currentAccount, candidatePassword)) {
        throw createHttpError("Sai tài khoản hoặc mật khẩu.", 401);
      }
      if (this.isAccountInactive(currentAccount)) {
        throw createHttpError("Tài khoản đã bị khóa hoặc ngừng kích hoạt.", 403);
      }

      const currentHasLegacySecrets = typeof currentAccount.password === "string"
        || Object.prototype.hasOwnProperty.call(currentAccount, "passwordSalt");
      const preparedAccount = currentHasLegacySecrets
        ? this.prepareAccountForStorage(currentAccount, currentAccount)
        : { ...currentAccount };

      const previousSessionId = String(preparedAccount.activeSessionId || "");
      const replacedSessionId = previousSessionId && this.isSessionFresh(preparedAccount) ? previousSessionId : "";
      const sessionId = crypto.randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
      preparedAccount.activeSessionId = sessionId;
      preparedAccount.activeSessionAt = now.toISOString();
      preparedAccount.activeSessionExpiresAt = expiresAt;
      preparedAccount.activeSessionStartedAt = now.toISOString();
      const token = this.createToken(preparedAccount, sessionId, expiresAt);
      updatedAccount = preparedAccount;
      result = {
        token,
        sessionId,
        replacedSessionId,
        sessionStartedAt: preparedAccount.activeSessionStartedAt,
        expiresAt,
        accountId: preparedAccount.id || "",
        username: preparedAccount.username || "",
      };
      if (entry.key !== initialEntry.key) {
        touchedRecords.accounts = [entry.key];
        if (touchedRecordFields) {
          delete touchedRecordFields.accounts[initialEntry.key];
          if (!currentHasLegacySecrets) {
            touchedRecordFields.accounts[entry.key] = SESSION_FIELDS;
          }
        }
      } else if (currentHasLegacySecrets && touchedRecordFields) {
        delete touchedRecordFields.accounts[entry.key];
      }
      return this.replaceAccountEntry(currentRoot || {}, entry, preparedAccount);
    }, {
      touchedRootKeys: ["accounts"],
      touchedRecords,
      touchedRecordFields,
      immutableMutator: true,
      includeRevision: true,
      cloneResult: false,
    });

    const hasRevisionResult = isPlainObject(updateResult) && Object.prototype.hasOwnProperty.call(updateResult, "root");
    const nextRoot = hasRevisionResult ? updateResult.root : updateResult;
    const revision = hasRevisionResult && Number.isSafeInteger(updateResult.revision) ? updateResult.revision : null;
    const account = updatedAccount
      || this.findAccount(nextRoot, (item) => item.id === result.accountId)
      || this.findAccount(nextRoot, (item) => item.username === result.username);
    return {
      ...result,
      ...(revision !== null ? { revision } : {}),
      account: this.sanitizeAccount(account),
      root: this.sanitizeRoot(nextRoot, account),
    };
  }

  async authenticateRequest(request, options = {}) {
    const cloneRoot = options.cloneRoot !== false;
    const token = this.extractToken(request);
    const payload = this.verifyToken(token);
    const snapshot = typeof this.repository.readRootSnapshot === "function"
      ? await this.repository.readRootSnapshot({ cloneRoot })
      : null;
    const root = snapshot?.root ?? await this.repository.readRoot();
    const account = this.findAccount(root, (item) => item.id === payload.sub)
      || this.findAccount(root, (item) => item.username === payload.username);
    if (!account) {
      throw createHttpError("Tài khoản không còn tồn tại.", 401);
    }
    if (this.isAccountInactive(account)) {
      throw createHttpError("Tài khoản đã bị khóa hoặc ngừng kích hoạt.", 403);
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
      revision: snapshot?.revision ?? null,
    };
  }

  async touchSession(request, options = {}) {
    const includeRoot = options.includeRoot !== false;
    const token = this.extractToken(request);
    const payload = this.verifyToken(token);
    const initialSnapshot = typeof this.repository.readRootSnapshot === "function"
      ? await this.repository.readRootSnapshot({ cloneRoot: false })
      : { root: await this.repository.readRoot(), revision: null };
    const initialRoot = initialSnapshot?.root || {};
    const initialEntry = this.findAccountEntry(initialRoot, (item) => item.id === payload.sub)
      || this.findAccountEntry(initialRoot, (item) => item.username === payload.username);
    const initialAccount = initialEntry?.account || null;
    if (!initialAccount || String(initialAccount.activeSessionId || "") !== String(payload.sid || "")) {
      throw createHttpError("Phiên đăng nhập đã bị thay thế.", 401);
    }
    if (this.isAccountInactive(initialAccount)) {
      throw createHttpError("Tài khoản đã bị khóa hoặc ngừng kích hoạt.", 403);
    }

    const nowMs = Date.now();
    const lastTouchMs = Date.parse(initialAccount.activeSessionAt || "");
    const currentExpiresMs = Date.parse(initialAccount.activeSessionExpiresAt || "");
    const hasLegacySecrets = typeof initialAccount.password === "string"
      || Object.prototype.hasOwnProperty.call(initialAccount, "passwordSalt");
    const sessionTouchIsFresh = !hasLegacySecrets
      && Boolean(initialAccount.activeSessionStartedAt)
      && Number.isFinite(lastTouchMs) && (nowMs - lastTouchMs) < SESSION_TOUCH_MIN_INTERVAL_MS
      && Number.isFinite(currentExpiresMs) && (currentExpiresMs - nowMs) > (SESSION_TTL_MS - 24 * 60 * 60 * 1000);

    if (sessionTouchIsFresh) {
      const expiresAt = initialAccount.activeSessionExpiresAt;
      const sessionStartedAt = initialAccount.activeSessionStartedAt;
      const safeAccount = this.sanitizeAccount(initialAccount);
      const revision = Number.isSafeInteger(initialSnapshot?.revision) ? initialSnapshot.revision : null;
      return {
        token: this.createToken(initialAccount, payload.sid, expiresAt),
        sessionId: payload.sid,
        sessionStartedAt,
        expiresAt,
        accountId: initialAccount.id || "",
        username: initialAccount.username || "",
        account: safeAccount,
        ...(revision !== null ? { revision } : {}),
        ...(includeRoot ? { root: this.sanitizeRoot(initialRoot, initialAccount) } : {}),
      };
    }

    const touchedRecords = { accounts: [initialEntry.key] };
    const touchedRecordFields = hasLegacySecrets
      ? null
      : { accounts: { [initialEntry.key]: SESSION_FIELDS } };
    let result = null;
    const updateResult = await this.repository.updateRoot((currentRoot) => {
      const entry = this.findAccountEntry(currentRoot || {}, (item) => item.id === payload.sub)
        || this.findAccountEntry(currentRoot || {}, (item) => item.username === payload.username);
      const currentAccount = entry?.account || null;
      if (!currentAccount || String(currentAccount.activeSessionId || "") !== String(payload.sid || "")) {
        throw createHttpError("Phiên đăng nhập đã bị thay thế.", 401);
      }
      if (this.isAccountInactive(currentAccount)) {
        throw createHttpError("Tài khoản đã bị khóa hoặc ngừng kích hoạt.", 403);
      }

      const currentHasLegacySecrets = typeof currentAccount.password === "string"
        || Object.prototype.hasOwnProperty.call(currentAccount, "passwordSalt");
      const preparedAccount = currentHasLegacySecrets
        ? this.prepareAccountForStorage(currentAccount, currentAccount)
        : { ...currentAccount };

      const now = new Date();
      const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
      const sessionStartedAt = preparedAccount.activeSessionStartedAt || preparedAccount.activeSessionAt || now.toISOString();
      preparedAccount.activeSessionAt = now.toISOString();
      preparedAccount.activeSessionExpiresAt = expiresAt;
      preparedAccount.activeSessionStartedAt = sessionStartedAt;

      result = {
        token: this.createToken(preparedAccount, payload.sid, expiresAt),
        sessionId: payload.sid,
        sessionStartedAt,
        expiresAt,
        accountId: preparedAccount.id || "",
        username: preparedAccount.username || "",
        account: this.sanitizeAccount(preparedAccount),
      };
      if (entry.key !== initialEntry.key) {
        touchedRecords.accounts = [entry.key];
        if (touchedRecordFields) {
          delete touchedRecordFields.accounts[initialEntry.key];
          if (!currentHasLegacySecrets) {
            touchedRecordFields.accounts[entry.key] = SESSION_FIELDS;
          }
        }
      } else if (currentHasLegacySecrets && touchedRecordFields) {
        delete touchedRecordFields.accounts[entry.key];
      }
      return this.replaceAccountEntry(currentRoot || {}, entry, preparedAccount);
    }, {
      touchedRootKeys: ["accounts"],
      touchedRecords,
      touchedRecordFields,
      immutableMutator: true,
      includeRevision: true,
      compactResult: !includeRoot,
      cloneResult: false,
    });

    const hasRevisionResult = isPlainObject(updateResult) && Object.prototype.hasOwnProperty.call(updateResult, "root");
    const nextRoot = hasRevisionResult ? updateResult.root : updateResult;
    const revision = Number.isSafeInteger(updateResult?.revision) ? updateResult.revision : null;
    return {
      ...result,
      ...(revision !== null ? { revision } : {}),
      ...(includeRoot ? { root: this.sanitizeRoot(nextRoot, result?.account) } : {}),
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

    const initialSnapshot = typeof this.repository.readRootSnapshot === "function"
      ? await this.repository.readRootSnapshot({ cloneRoot: false })
      : { root: await this.repository.readRoot(), revision: null };
    const initialEntry = this.findAccountEntry(initialSnapshot?.root || {}, (item) => item.id === payload.sub)
      || this.findAccountEntry(initialSnapshot?.root || {}, (item) => item.username === payload.username);
    if (!initialEntry?.account || String(initialEntry.account.activeSessionId || "") !== String(payload.sid || "")) {
      return { ok: true };
    }

    const hasLegacySecrets = typeof initialEntry.account.password === "string"
      || Object.prototype.hasOwnProperty.call(initialEntry.account, "passwordSalt");
    const touchedRecords = { accounts: [initialEntry.key] };
    const touchedRecordFields = hasLegacySecrets
      ? null
      : { accounts: { [initialEntry.key]: SESSION_FIELDS } };

    await this.repository.updateRoot((currentRoot) => {
      const entry = this.findAccountEntry(currentRoot || {}, (item) => item.id === payload.sub)
        || this.findAccountEntry(currentRoot || {}, (item) => item.username === payload.username);
      if (!entry?.account || String(entry.account.activeSessionId || "") !== String(payload.sid || "")) {
        return currentRoot;
      }
      const currentHasLegacySecrets = typeof entry.account.password === "string"
        || Object.prototype.hasOwnProperty.call(entry.account, "passwordSalt");
      const preparedAccount = currentHasLegacySecrets
        ? this.prepareAccountForStorage(entry.account, entry.account)
        : { ...entry.account };
      preparedAccount.activeSessionId = "";
      preparedAccount.activeSessionAt = "";
      preparedAccount.activeSessionExpiresAt = "";
      preparedAccount.activeSessionStartedAt = "";
      if (entry.key !== initialEntry.key) {
        touchedRecords.accounts = [entry.key];
        if (touchedRecordFields) {
          delete touchedRecordFields.accounts[initialEntry.key];
          if (!currentHasLegacySecrets) {
            touchedRecordFields.accounts[entry.key] = SESSION_FIELDS;
          }
        }
      } else if (currentHasLegacySecrets && touchedRecordFields) {
        delete touchedRecordFields.accounts[entry.key];
      }
      return this.replaceAccountEntry(currentRoot || {}, entry, preparedAccount);
    }, {
      touchedRootKeys: ["accounts"],
      touchedRecords,
      touchedRecordFields,
      immutableMutator: true,
      compactResult: true,
    });

    return { ok: true };
  }

  getPeriodType(root, periodId) {
    const period = collectionValues(root?.periods).find((item) => item.id === periodId);
    const type = normalizePeriodType(period?.type);
    return type === SAFETY_PERIOD_TYPE ? SAFETY_PERIOD_TYPE : FIVE_S_PERIOD_TYPE;
  }

  getFiveSPeriodForSafetyPeriod(root, safetyPeriodId, issueDate = "") {
    const periods = collectionValues(root?.periods);
    const safetyPeriod = periods.find((period) => period?.id === safetyPeriodId);
    const dateParts = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(issueDate || ""));
    const targetYear = dateParts ? Number(dateParts[1]) : Number(safetyPeriod?.year);
    const targetMonth = dateParts ? Number(dateParts[2]) : Number(safetyPeriod?.month);
    const candidates = targetMonth && targetYear
      ? periods.filter((period) => normalizePeriodType(period?.type) !== SAFETY_PERIOD_TYPE
        && Number(period?.month) === targetMonth
        && Number(period?.year) === targetYear)
      : [];
    const activeFiveSPeriodId = String(root?.activeFiveSPeriodId || "");
    const sameMonthPeriod = candidates.find((period) => period?.id === activeFiveSPeriodId) || candidates[0];
    if (sameMonthPeriod) return sameMonthPeriod.id;
    if (activeFiveSPeriodId && periods.some((period) => period?.id === activeFiveSPeriodId)) return activeFiveSPeriodId;

    const legacyActivePeriod = periods.find((period) => period?.id === root?.activePeriodId);
    return legacyActivePeriod && normalizePeriodType(legacyActivePeriod.type) !== SAFETY_PERIOD_TYPE
      ? legacyActivePeriod.id
      : "";
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
    if (isAdminAccount(account) || isViewerAccount(account)) {
      return new Set(areas.map((area) => area.id).filter(Boolean));
    }
    const assignments = getAccountRoleAssignments(root, account, periodId, type);
    if (assignments.hasAt5s) {
      return new Set(areas.map((area) => area.id).filter(Boolean));
    }
    if (!hasAccountAccessType(account, type, root, periodId) && !assignments.hasDepartmentHead) {
      return new Set();
    }
    const allowedIds = new Set();
    if (assignments.hasDepartmentHead) {
      areas.filter((area) => isAreaManagedByDepartmentHead(area, account)).forEach((area) => allowedIds.add(area.id));
    }
    if (assignments.roles.includes(ROLE_ZONE_OWNER)) {
      const managerIds = new Set(assignments.managerIds);
      const primaryPersonId = getAccountRoleForType(account, type) === ROLE_ZONE_OWNER ? getAccountPersonId(account, type) : "";
      if (primaryPersonId) managerIds.add(primaryPersonId);
      areas.filter((area) => managerIds.has(area.scorerId)).forEach((area) => allowedIds.add(area.id));
      if (!managerIds.size) {
        const assignedAreaIds = new Set(getAccountAreaIds(account, type));
        areas.filter((area) => assignedAreaIds.has(area.id) || assignedAreaIds.has(String(area.code)) || assignedAreaIds.has(`Zone ${area.code}`)).forEach((area) => allowedIds.add(area.id));
      }
    }
    const assessorRole = type === SAFETY_PERIOD_TYPE ? ROLE_ASSESSOR_SAFETY : ROLE_ASSESSOR_5S;
    if (assignments.roles.includes(assessorRole)) {
      const assessorIds = new Set(assignments.assessorIds);
      const primaryPersonId = getAccountRoleForType(account, type) === assessorRole ? getAccountPersonId(account, type) : "";
      if (primaryPersonId) assessorIds.add(primaryPersonId);
      areas
        .filter((area) => assessorIds.has(area.assessorId) || (Array.isArray(area.assessorIds) && area.assessorIds.some((id) => assessorIds.has(id))))
        .forEach((area) => allowedIds.add(area.id));
      if (getAccountRoleForType(account, type) === assessorRole) {
        getAccountAreaIds(account, type).forEach((areaId) => allowedIds.add(areaId));
      }
    }
    return allowedIds;
  }

  getFiveSScoreSourceAreaIds(root, account, periodId, source) {
    const areas = this.getAreasForPeriod(root, periodId, FIVE_S_PERIOD_TYPE);
    if (isAdminAccount(account)) return new Set(areas.map((area) => area.id).filter(Boolean));
    const assignments = getAccountRoleAssignments(root, account, periodId, FIVE_S_PERIOD_TYPE);
    const normalizedSource = normalizeScoreSource(source);
    if (normalizedSource === SCORE_SOURCE_AT5S) {
      if (!assignments.hasAt5s) return new Set();
      return new Set(areas.map((area) => area.id).filter(Boolean));
    }
    if (normalizedSource === SCORE_SOURCE_DEPARTMENT_HEAD) {
      if (!assignments.hasDepartmentHead) return new Set();
      return new Set(areas.filter((area) => isAreaManagedByDepartmentHead(area, account)).map((area) => area.id).filter(Boolean));
    }
    if (normalizedSource === SCORE_SOURCE_SELF) {
      if (!assignments.roles.includes(ROLE_ZONE_OWNER)) return new Set();
      const managerIds = new Set(assignments.managerIds);
      if (getAccountRoleForType(account, FIVE_S_PERIOD_TYPE) === ROLE_ZONE_OWNER) {
        const personId = getAccountPersonId(account, FIVE_S_PERIOD_TYPE);
        if (personId) managerIds.add(personId);
      }
      return new Set(areas.filter((area) => managerIds.has(area.scorerId)).map((area) => area.id));
    }

    if (!assignments.roles.includes(ROLE_ASSESSOR_5S)) return new Set();
    const assessorIds = new Set(assignments.assessorIds);
    if (getAccountRoleForType(account, FIVE_S_PERIOD_TYPE) === ROLE_ASSESSOR_5S) {
      const personId = getAccountPersonId(account, FIVE_S_PERIOD_TYPE);
      if (personId) assessorIds.add(personId);
    }
    const allowedIds = new Set(areas
      .filter((area) => assessorIds.has(area.assessorId) || (Array.isArray(area.assessorIds) && area.assessorIds.some((id) => assessorIds.has(id))))
      .map((area) => area.id));
    if (getAccountRoleForType(account, FIVE_S_PERIOD_TYPE) === ROLE_ASSESSOR_5S) {
      getAccountAreaIds(account, FIVE_S_PERIOD_TYPE).forEach((areaId) => allowedIds.add(areaId));
    }
    return allowedIds;
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
    const people = [
      ...collectionValues(snapshotCollection),
      ...collectionValues(rootCollection),
      ...collectionValues(snapshot.at5sMembers),
      ...collectionValues(root?.at5sMembers),
    ];
    const at5sId = String(account?.at5sMemberId || "");
    const accountCode = employeeCodeKey(account?.employeeCode);
    const person = people.find((item) => item?.id && (item.id === personId || (at5sId && item.id === at5sId)))
      || (accountCode ? people.find((item) => employeeCodeKey(item?.employeeCode) === accountCode) : null);
    const accountNames = [account?.username, account?.name, account?.displayName]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    const at5sNames = [
      ...collectionValues(snapshot.at5sMembers),
      ...collectionValues(root?.at5sMembers),
    ].filter((member) => (
      (at5sId && String(member?.id || "") === at5sId)
      || (accountCode && employeeCodeKey(member?.employeeCode) === accountCode)
      || (!accountCode && accountNames.some((name) => sameNormalizedText(name, member?.name)))
    )).map((member) => member?.name);
    return [
      account?.username,
      account?.name,
      account?.displayName,
      person?.name,
      ...at5sNames,
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
    if (record?.createdByAccountId && String(record.createdByAccountId) === String(account?.id || "")) return true;
    const recordUsername = String(record?.accountUsername || "").trim();
    if (recordUsername && sameNormalizedText(recordUsername, accountUsername)) return true;
    const recordOwnerAccount = recordUsername
      ? collectionValues(root?.accounts).find((item) => sameNormalizedText(item?.username, recordUsername))
      : null;
    if (recordOwnerAccount) return String(recordOwnerAccount.id || "") === String(account?.id || "");
    const legacyCreatedBy = String(record?.createdBy || "").trim();
    if (legacyCreatedBy && sameNormalizedText(legacyCreatedBy, accountUsername)) return true;
    const legacyCreatorAccount = legacyCreatedBy
      ? collectionValues(root?.accounts).find((item) => sameNormalizedText(item?.username, legacyCreatedBy))
      : null;
    if (legacyCreatorAccount) return String(legacyCreatorAccount.id || "") === String(account?.id || "");
    const names = this.getAccountDisplayNameCandidates(root, account, record?.periodId || "", type);
    if (legacyCreatedBy && names.some((name) => sameNormalizedText(legacyCreatedBy, name))) return true;
    return names.some((name) => sameNormalizedText(record?.scorerName, name))
      || names.some((name) => safetyRecordTextMatchesName(record?.issueFoundBy, name));
  }

  isCountermeasureOnlySafetyUpdate(existingRecord, nextRecord) {
    if (!isPlainObject(existingRecord) || !isPlainObject(nextRecord)) {
      return false;
    }
    const countermeasureFields = new Set([
      "improvementContent",
      "improvementResponseBy",
      "improvementResponseAt",
      "improvementResponsePreviousStatus",
      "issueStatus",
      "afterPhotoDataUrl",
      "afterPhotoName",
      "afterPhotoAnnotations",
      "actionOwner",
      "actionPlan",
      "completionDate",
      "countermeasureDate",
      "completedDate",
      "createdAt",
      "updatedAt",
    ]);
    const immutableFields = new Set([
      "id", "periodId", "areaId", "issueDate", "issueLocation", "issueDay", "issueMonth", "note",
      "photoDataUrl", "photoName", "photoAnnotations", "issueCount", "issueType", "issueLevel",
      "issueFoundBy", "employeeCode", "issueItemLabel", "foundChannel", "scorerName", "accountUsername", "createdByAccountId",
    ]);
    const isEmptyDefault = (value) => value === null || value === undefined || value === ""
      || (Array.isArray(value) && value.length === 0);
    const canonicalValue = (record, field) => {
      if (field === "note") return String(record.note || record.issueDescription || "").trim();
      if (field === "employeeCode") return String(record.employeeCode || record.foundEmployeeCode || "").trim();
      if (field === "foundChannel") {
        const value = String(record.foundChannel || record.issueFoundChannel || "")
          .trim().toLocaleLowerCase("vi").replace(/[\s_]+/g, "-");
        if (["worker", "member", "cong-nhan", "công-nhân"].includes(value)) return "worker";
        if (["department-head", "head", "internal-audit", "audit", "truong-bo-phan", "trưởng-bộ-phận", "to-truong", "tổ-trưởng"].includes(value)) return "department-head";
        if (["at5s", "ban-at-5s", "ban-at5s", "an-toan-5s", "an-toàn-5s"].includes(value)) return "at5s";
        if (["assessor", "lean", "(lean)"].includes(value)) return "assessor";
        return "";
      }
      if (field === "issueCount") {
        if (isEmptyDefault(record.issueCount)) return "";
        const count = Number(record.issueCount);
        return Number.isInteger(count) && count >= 1 ? count : String(record.issueCount);
      }
      if (field === "photoAnnotations") return Array.isArray(record.photoAnnotations) ? record.photoAnnotations : [];
      return record[field] === undefined ? null : record[field];
    };

    for (const field of immutableFields) {
      const beforeValue = canonicalValue(existingRecord, field);
      const afterValue = canonicalValue(nextRecord, field);
      if (isEmptyDefault(beforeValue) && isEmptyDefault(afterValue)) continue;
      if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) return false;
    }

    const aliases = new Map([
      ["issueDescription", "note"],
      ["foundEmployeeCode", "employeeCode"],
      ["issueFoundChannel", "foundChannel"],
    ]);
    const keys = new Set([...Object.keys(existingRecord), ...Object.keys(nextRecord)]);
    for (const key of keys) {
      if (countermeasureFields.has(key) || immutableFields.has(key)) continue;
      if (aliases.has(key) && nextRecord[key] === undefined) {
        const canonicalField = aliases.get(key);
        if (JSON.stringify(canonicalValue(existingRecord, canonicalField)) === JSON.stringify(canonicalValue(nextRecord, canonicalField))) continue;
      }
      const beforeValue = existingRecord[key] === undefined ? null : existingRecord[key];
      const afterValue = nextRecord[key] === undefined ? null : nextRecord[key];
      if (isEmptyDefault(beforeValue) && isEmptyDefault(afterValue)) continue;
      if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) return false;
    }

    const previousCreatedAt = String(existingRecord.createdAt || existingRecord.updatedAt || "");
    const nextCreatedAt = String(nextRecord.createdAt || nextRecord.updatedAt || "");
    if (previousCreatedAt && previousCreatedAt !== nextCreatedAt) return false;
    return true;
  }

  assertSafetyResponseAuthor(existingRecord, nextRecord, account) {
    const previousContent = String(existingRecord?.improvementContent || "").trim();
    const nextContent = String(nextRecord?.improvementContent || "").trim();
    const previousAuthor = String(existingRecord?.improvementResponseBy || "");
    const nextAuthor = String(nextRecord?.improvementResponseBy || "");
    const previousAt = String(existingRecord?.improvementResponseAt || "");
    const nextAt = String(nextRecord?.improvementResponseAt || "");
    if (previousContent !== nextContent) {
      if (nextContent && (nextAuthor !== String(account?.id || "") || !nextAt)) {
        throw createHttpError("Thông tin người trả lời đối sách không hợp lệ.", 403);
      }
      if (!nextContent && (nextAuthor || nextAt)) {
        throw createHttpError("Không thể giữ thông tin người trả lời khi đã xóa nội dung đối sách.", 403);
      }
      return;
    }
    if (previousAuthor !== nextAuthor || previousAt !== nextAt) {
      throw createHttpError("Không thể thay đổi người trả lời nếu nội dung đối sách không đổi.", 403);
    }
  }

  isSafetyCountermeasureRoleAssigned(root, account, record) {
    if (isAdminAccount(account)) return true;
    const periodId = String(record?.periodId || "");
    const areaId = String(record?.areaId || "");
    if (!periodId || !areaId) return false;

    const assignments = getAccountRoleAssignments(root, account, periodId, SAFETY_PERIOD_TYPE);
    const area = assignments.areas.find((item) => item?.id === areaId)
      || this.getAreasForPeriod(root, periodId, SAFETY_PERIOD_TYPE).find((item) => item?.id === areaId);
    if (!area) return false;

    // A person's assessor assignment may cover many Zones. Countermeasure replies
    // are limited to Zones they manage, even when their assessor role covers more.
    if (assignments.roles.includes(ROLE_ZONE_OWNER)) {
      const managerIds = new Set(assignments.managerIds);
      if (getAccountRoleForType(account, SAFETY_PERIOD_TYPE) === ROLE_ZONE_OWNER) {
        const primaryManagerId = getAccountPersonId(account, SAFETY_PERIOD_TYPE);
        if (primaryManagerId) managerIds.add(primaryManagerId);
      }
      if (area.scorerId && managerIds.has(area.scorerId)) return true;
      if (!managerIds.size && getAccountAreaIds(account, SAFETY_PERIOD_TYPE).includes(areaId)) return true;
    }

    // In the factory, 5S and Safety ownership belong to the same zone leaders.
    // Match by zone code so separate catalog IDs and stale Safety role links do not
    // prevent the assigned 5S manager/head from replying to this Safety Zone.
    const safetyZoneCode = String(area.templateCode || area.code || "").trim().toLocaleLowerCase("vi");
    const fiveSPeriodId = this.getFiveSPeriodForSafetyPeriod(root, periodId, record?.issueDate);
    if (safetyZoneCode && fiveSPeriodId) {
      const fiveSAssignments = getAccountRoleAssignments(root, account, fiveSPeriodId, FIVE_S_PERIOD_TYPE);
      const fiveSArea = fiveSAssignments.areas.find((item) => (
        item?.id === area.id
        || String(item?.templateCode || item?.code || "").trim().toLocaleLowerCase("vi") === safetyZoneCode
      ));
      if (fiveSArea) {
        if (isAreaManagedByDepartmentHead(fiveSArea, account)) return true;
        if (fiveSAssignments.roles.includes(ROLE_ZONE_OWNER)) {
          const managerIds = new Set(fiveSAssignments.managerIds);
          if (getAccountRoleForType(account, FIVE_S_PERIOD_TYPE) === ROLE_ZONE_OWNER) {
            const primaryManagerId = getAccountPersonId(account, FIVE_S_PERIOD_TYPE);
            if (primaryManagerId) managerIds.add(primaryManagerId);
          }
          if (fiveSArea.scorerId && managerIds.has(fiveSArea.scorerId)) return true;
          if (!managerIds.size
            && getAccountRoleForType(account, FIVE_S_PERIOD_TYPE) === ROLE_ZONE_OWNER
            && getAccountAreaIds(account, FIVE_S_PERIOD_TYPE).includes(fiveSArea.id)) return true;
        }
      }
    }

    return isAreaManagedByDepartmentHead(area, account);
  }

  hasSafetyCountermeasureChanges(existingRecord, nextRecord) {
    const fields = [
      "improvementContent",
      "improvementResponseBy",
      "improvementResponseAt",
      "improvementResponsePreviousStatus",
      "issueStatus",
      "afterPhotoDataUrl",
      "afterPhotoName",
      "afterPhotoAnnotations",
      "actionOwner",
      "actionPlan",
      "completionDate",
      "countermeasureDate",
      "completedDate",
    ];
    const canonicalValue = (record, field) => {
      if (field === "afterPhotoAnnotations") return Array.isArray(record?.[field]) ? record[field] : [];
      if (field === "issueStatus") {
        const status = String(record?.[field] || "").trim();
        return status || (record?.note || record?.issueItemLabel || record?.photoDataUrl ? "open" : "");
      }
      return record?.[field] ?? "";
    };
    return fields.some((field) => JSON.stringify(canonicalValue(existingRecord, field))
      !== JSON.stringify(canonicalValue(nextRecord, field)));
  }

  isSafetyCountermeasureWriteAllowed(root, account, existingRecord, nextRecord, comparisonRecord = existingRecord) {
    if (!this.isCountermeasureOnlySafetyUpdate(comparisonRecord, nextRecord)) {
      return false;
    }
    return this.isSafetyCountermeasureRoleAssigned(root, account, existingRecord || nextRecord);
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
      const assignments = getAccountRoleAssignments(root, account, periodId, FIVE_S_PERIOD_TYPE);
      const isAdmin = isAdminAccount(account);
      if (!periodId || !areaId || (!isAdmin && !hasAccountAccessType(account, FIVE_S_PERIOD_TYPE, root, periodId) && !assignments.hasDepartmentHead && !assignments.hasAt5s)) {
        throw createHttpError("Bạn không có quyền ghi điểm 5S.", 403);
      }

      const source = normalizeScoreSource(candidate.scoreSource);
      if (MULTI_DAY_SCORE_SOURCES.has(source) && candidate === record && operation !== "remove") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(candidate.scoreDate || "").trim())) {
          throw createHttpError("Vui lòng chọn ngày chấm hợp lệ.", 400);
        }
      }
      if (isAdmin) return;

      const canWriteSource = source === SCORE_SOURCE_SELF
        ? assignments.roles.includes(ROLE_ZONE_OWNER)
        : source === SCORE_SOURCE_AT5S
          ? assignments.hasAt5s
          : source === SCORE_SOURCE_DEPARTMENT_HEAD
            ? assignments.hasDepartmentHead
            : assignments.roles.includes(ROLE_ASSESSOR_5S);
      const sourceAreaIds = this.getFiveSScoreSourceAreaIds(root, account, periodId, source);
      if (!canWriteSource || !sourceAreaIds.has(areaId)) {
        throw createHttpError("Bạn không có quyền ghi điểm 5S cho ô này.", 403);
      }
    });
  }

  assertSafetyPeriodWritable(root, record) {
    const periods = collectionValues(root?.periods);
    const period = periods.find((item) => item.id === record?.periodId);
    const legacyActive = periods.find((item) => item.id === root?.activePeriodId);
    const activeId = root?.activeSafetyPeriodId || (legacyActive && normalizePeriodType(legacyActive.type) !== FIVE_S_PERIOD_TYPE ? legacyActive.id : "");
    if (!period || normalizePeriodType(period.type) === FIVE_S_PERIOD_TYPE || period.archived || (activeId && period.id !== activeId)) {
      throw createHttpError("Kỳ đánh giá an toàn này đã khóa hoặc không còn mở.", 403);
    }
  }

  assertDepartmentHeadSafetyScope(root, account, record) {
    const period = collectionValues(root?.periods).find((item) => item.id === record?.periodId);
    if (!isPlainObject(record) || !period || normalizePeriodType(period.type) !== SAFETY_PERIOD_TYPE
      || !this.getAllowedAreaIds(root, account, period.id, SAFETY_PERIOD_TYPE).has(record.areaId)) {
      throw createHttpError("Bạn chỉ được thêm, sửa, xóa đánh giá an toàn trong Zone mình quản lý.", 403);
    }
  }

  assertSafetyRecordWriteAllowed(root, account, command) {
    if (pathParts(command.path).length !== 2
      || (command.operation === "update" && Object.keys(command.value || {}).some((key) => key.includes("/")))) {
      throw createHttpError("Vui lòng cập nhật từng báo cáo an toàn đầy đủ.", 403);
    }
    const operation = String(command.operation || "");
    const storedRecord = valueAtPath(root, command.path);
    const [, recordIdFromPath] = pathParts(command.path);
    const legacyScoreId = operation !== "remove" && !storedRecord && String(recordIdFromPath || "").startsWith("safety-")
      ? String(recordIdFromPath).slice("safety-".length)
      : "";
    const legacyScore = legacyScoreId ? this.findCollectionRecordById(root?.scores, legacyScoreId) : null;
    const legacyRecord = legacyScore ? {
      ...legacyScore,
      id: String(recordIdFromPath),
      issueStatus: legacyScore.issueStatus || (legacyScore.note || legacyScore.photoDataUrl ? "open" : ""),
    } : null;
    const legacyCountermeasureRecord = legacyScore ? {
      id: String(recordIdFromPath),
      periodId: legacyScore.periodId || "",
      areaId: legacyScore.areaId || "",
      issueLocation: legacyScore.issueLocation || command.value?.issueLocation || "",
      issueDay: legacyScore.issueDay || "",
      issueMonth: legacyScore.issueMonth || "",
      issueDate: legacyScore.issueDate || "",
      note: legacyScore.note || legacyScore.issueDescription || legacyScore.issueItemLabel || command.value?.note || "",
      photoDataUrl: legacyScore.photoDataUrl || "",
      photoName: legacyScore.photoName || "",
      photoAnnotations: legacyScore.photoAnnotations || [],
      issueCount: Number.isInteger(Number(legacyScore.issueCount)) && Number(legacyScore.issueCount) >= 1 ? Number(legacyScore.issueCount) : "",
      issueType: legacyScore.issueType || "",
      issueLevel: legacyScore.issueLevel || "",
      issueStatus: legacyRecord.issueStatus || "open",
      improvementResponsePreviousStatus: "",
      issueFoundBy: legacyScore.issueFoundBy || "",
      employeeCode: legacyScore.employeeCode || legacyScore.foundEmployeeCode || "",
      issueItemLabel: legacyScore.issueItemLabel || command.value?.issueItemLabel || "",
      foundChannel: legacyScore.foundChannel || legacyScore.issueFoundChannel || "",
      improvementContent: legacyScore.improvementContent || "",
      improvementResponseBy: legacyScore.improvementResponseBy || "",
      improvementResponseAt: legacyScore.improvementResponseAt || "",
      afterPhotoDataUrl: legacyScore.afterPhotoDataUrl || "",
      afterPhotoName: legacyScore.afterPhotoName || "",
      afterPhotoAnnotations: legacyScore.afterPhotoAnnotations || [],
      actionOwner: legacyScore.actionOwner || "",
      actionPlan: legacyScore.actionPlan || "",
      completionDate: legacyScore.completionDate || "",
      countermeasureDate: legacyScore.countermeasureDate || "",
      completedDate: legacyScore.completedDate || "",
      completionLevelConfirm: legacyScore.completionLevelConfirm || "",
      completionStop6Confirm: legacyScore.completionStop6Confirm || "",
      scorerName: legacyScore.scorerName || command.value?.scorerName || "",
      accountUsername: legacyScore.accountUsername || command.value?.accountUsername || "",
      createdBy: legacyScore.createdBy || command.value?.createdBy || "",
      createdByAccountId: legacyScore.createdByAccountId || command.value?.createdByAccountId || "",
      createdAt: legacyScore.createdAt || legacyScore.updatedAt || command.value?.createdAt || "",
      updatedAt: legacyScore.updatedAt || command.value?.updatedAt || "",
    } : null;
    const existingRecord = storedRecord || legacyRecord;
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
    if (operation !== "remove") {
      const previousCreatorId = String(existingRecord?.createdByAccountId || "");
      const nextCreatorId = String(record.createdByAccountId || "");
      if ((previousCreatorId && previousCreatorId !== nextCreatorId)
        || (!previousCreatorId && nextCreatorId && nextCreatorId !== String(account?.id || "") && !isAdminAccount(account))) {
        throw createHttpError("Không thể thay đổi người tạo báo cáo an toàn.", 403);
      }
      this.assertSafetyResponseAuthor(existingRecord || {}, record, account);
      if (!existingRecord && !isAdminAccount(account)) {
        const hasInitialCountermeasure = Boolean(
          String(record.improvementContent || "").trim()
          || String(record.afterPhotoDataUrl || "").trim()
          || String(record.actionOwner || "").trim()
          || String(record.actionPlan || "").trim()
          || String(record.completionDate || "").trim()
        );
        if (hasInitialCountermeasure) {
          throw createHttpError("Chỉ admin mới được thêm đối sách, ảnh sau cải tiến, PIC, kế hoạch và ngày dự kiến hoàn thành khi tạo mới đánh giá an toàn.", 403);
        }
      }
      if (existingRecord
        && this.hasSafetyCountermeasureChanges(existingRecord, record)
        && !this.isSafetyCountermeasureRoleAssigned(root, account, existingRecord)) {
        throw createHttpError("Bạn chỉ có quyền thêm các đối sách liên quan đến Zone của mình.", 403);
      }
    }
    if (existingRecord) this.assertSafetyPeriodWritable(root, existingRecord);
    this.assertSafetyPeriodWritable(root, record);

    const safetyAssignments = getAccountRoleAssignments(root, account, record?.periodId || existingRecord?.periodId, SAFETY_PERIOD_TYPE);
    const isDepartmentHeadOnlyScope = safetyAssignments.hasDepartmentHead
      && !safetyAssignments.hasAt5s
      && !safetyAssignments.roles.includes(ROLE_ASSESSOR_SAFETY);
    if (isDepartmentHeadOnlyScope) {
      if (existingRecord) this.assertDepartmentHeadSafetyScope(root, account, existingRecord);
      this.assertDepartmentHeadSafetyScope(root, account, record);
      return;
    }

    if (operation === "set" && !existingRecord) {
      const recordId = String(recordIdFromPath || "");
      if (String(record.id || "") !== recordId) {
        throw createHttpError("Dữ liệu đánh giá an toàn không hợp lệ.", 400);
      }
      const fiveSPeriodId = this.getFiveSPeriodForSafetyPeriod(root, record.periodId, record.issueDate);
      const fiveSAssignments = fiveSPeriodId
        ? getAccountRoleAssignments(root, account, fiveSPeriodId, FIVE_S_PERIOD_TYPE)
        : null;
      const hasZoneOwnerSafetyCreate = (hasAccountAccessType(account, SAFETY_PERIOD_TYPE, root, record.periodId)
        && safetyAssignments.roles.includes(ROLE_ZONE_OWNER))
        || Boolean(fiveSAssignments
          && (hasAccountAccessType(account, FIVE_S_PERIOD_TYPE, root, fiveSPeriodId)
            || getAccountRoleForType(account, FIVE_S_PERIOD_TYPE) === ROLE_ZONE_OWNER)
          && fiveSAssignments.roles.includes(ROLE_ZONE_OWNER));
      const canCreateSafety = isAdminAccount(account)
        || safetyAssignments.hasAt5s
        || safetyAssignments.roles.includes(ROLE_ASSESSOR_SAFETY)
        || safetyAssignments.hasDepartmentHead
        || hasZoneOwnerSafetyCreate;
      if (!canCreateSafety) {
        throw createHttpError("Bạn không có quyền tạo mới báo cáo đánh giá an toàn.", 403);
      }
      const reportableArea = this.getAreasForPeriod(root, record.periodId, SAFETY_PERIOD_TYPE).find((area) => (
        area?.id === record.areaId
        && !HIDDEN_SAFETY_ZONE_CODES.has(String(area.templateCode || area.code || "").trim())
      ));
      if (!reportableArea) {
        throw createHttpError("Vui lòng chọn Zone hợp lệ.", 400);
      }
      const ownerUsername = String(record.accountUsername || "").trim();
      if (!ownerUsername || !sameNormalizedText(ownerUsername, account.username)) {
        throw createHttpError("Bạn không có quyền ghi đánh giá an toàn cho tài khoản khác.", 403);
      }
      return;
    }

    const countermeasureComparisonRecord = legacyCountermeasureRecord || existingRecord;
    const countermeasureNextRecord = legacyCountermeasureRecord
      ? Object.fromEntries(Object.keys(legacyCountermeasureRecord).map((field) => [
        field,
        Object.prototype.hasOwnProperty.call(record, field) ? record[field] : legacyCountermeasureRecord[field],
      ]))
      : record;
    if (
      operation !== "remove" &&
      isPlainObject(existingRecord) &&
      this.isSafetyCountermeasureWriteAllowed(
        root,
        account,
        existingRecord,
        countermeasureNextRecord,
        countermeasureComparisonRecord,
      )
    ) {
      return;
    }

    if (isPlainObject(existingRecord) && !this.isRecordOwnedByAccount(root, existingRecord, account, SAFETY_PERIOD_TYPE)) {
      throw createHttpError("Bạn chỉ được sửa hoặc xóa đánh giá an toàn của mình.", 403);
    }
    const accountUsername = String(account.username || "").trim();
    const nextOwner = String(record.accountUsername || "").trim();
    if (operation !== "remove" && (!nextOwner || !sameNormalizedText(nextOwner, accountUsername))) {
      throw createHttpError("Bạn không có quyền ghi đánh giá an toàn cho tài khoản khác.", 403);
    }

    const recordsToCheck = [record];
    if (isPlainObject(existingRecord) && existingRecord !== record) {
      recordsToCheck.push(existingRecord);
    }

    recordsToCheck.forEach((candidate) => {
      const periodId = String(candidate.periodId || "");
      const areaId = String(candidate.areaId || "");
      const candidateAssignments = getAccountRoleAssignments(root, account, periodId, SAFETY_PERIOD_TYPE);
      if (candidateAssignments.hasDepartmentHead && !candidateAssignments.hasAt5s && !candidateAssignments.roles.includes(ROLE_ASSESSOR_SAFETY)) {
        this.assertDepartmentHeadSafetyScope(root, account, candidate);
        return;
      }
      if (this.isSafetyCountermeasureRoleAssigned(root, account, candidate)) {
        return;
      }
      if (!periodId || !areaId || !hasAccountAccessType(account, SAFETY_PERIOD_TYPE, root, periodId)) {
        throw createHttpError("Bạn không có quyền ghi đánh giá an toàn.", 403);
      }

      const allowedAreaIds = this.getAllowedAreaIds(root, account, periodId, SAFETY_PERIOD_TYPE);
      if (!allowedAreaIds.has(areaId)) {
        throw createHttpError("Bạn không có quyền ghi đánh giá an toàn cho zone này.", 403);
      }
    });
  }

  assertHistoryWriteAllowed(account, command, authContext = null) {
    const operation = String(command.operation || "");
    if (operation === "remove") {
      throw createHttpError("Bạn không có quyền xóa lịch sử.", 403);
    }

    const entry = isPlainObject(command.value) ? command.value : {};
    const username = String(entry.username || "");
    if (!isAdminAccount(account)) {
      const parts = pathParts(command.path);
      const sessionId = String(authContext?.payload?.sid || "");
      if (username !== String(account.username || "")
        || String(entry.accountId || "") !== String(account.id || "")
        || parts.length !== 2
        || !sessionId
        || String(entry.id || "") !== parts[1]
        || String(entry.sessionId || "") !== sessionId) {
        throw createHttpError("Bạn chỉ được ghi nhật ký cho phiên đăng nhập hiện tại.", 403);
      }
      const employeeCode = String(entry.employeeCode || "").trim();
      const accountEmployeeCode = String(account.employeeCode || "").trim();
      if (accountEmployeeCode && employeeCode !== accountEmployeeCode) {
        throw createHttpError("Mã nhân viên trong nhật ký không khớp tài khoản.", 403);
      }
    } else if (username && username !== String(account.username || "")) {
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
    if (isDepartmentHeadAccount(account) && (pathParts(command.path).length !== 2
      || (operation === "update" && Object.keys(command.value || {}).some((key) => key.includes("/"))))) {
      throw createHttpError("Vui lòng cập nhật từng đánh dấu xóa đầy đủ.", 403);
    }
    if (operation === "remove") {
      const marker = valueAtPath(root, command.path);
      if (!isPlainObject(marker)) {
        return;
      }
      this.assertSafetyPeriodWritable(root, marker);
      const removeAssignments = getAccountRoleAssignments(root, account, marker.periodId, SAFETY_PERIOD_TYPE);
      if (removeAssignments.hasDepartmentHead && !removeAssignments.hasAt5s && !removeAssignments.roles.includes(ROLE_ASSESSOR_SAFETY)) {
        this.assertDepartmentHeadSafetyScope(root, account, marker);
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
    this.assertSafetyPeriodWritable(root, record);
    const deleteAssignments = getAccountRoleAssignments(root, account, record?.periodId || marker.periodId, SAFETY_PERIOD_TYPE);
    if (deleteAssignments.hasDepartmentHead && !deleteAssignments.hasAt5s && !deleteAssignments.roles.includes(ROLE_ASSESSOR_SAFETY)) {
      const existingMarker = valueAtPath(root, command.path);
      if (existingMarker) this.assertDepartmentHeadSafetyScope(root, account, existingMarker);
      this.assertDepartmentHeadSafetyScope(root, account, record);
      this.assertDepartmentHeadSafetyScope(root, account, marker);
      return;
    }
    if (!record?.periodId || !record?.areaId || !hasAccountAccessType(account, SAFETY_PERIOD_TYPE, root, record.periodId)) {
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

  fiveSFindingResponseIdentity(row) {
    return [row?.location, row?.problem, row?.fiveS, row?.shift]
      .map((value) => String(value || "").trim().toLocaleLowerCase("vi"))
      .join("|");
  }

  assertFiveSFindingCountermeasureAuthors(existingSheet, nextSheet, account) {
    const previousRows = Array.isArray(existingSheet?.rows) ? existingSheet.rows : [];
    const nextRows = Array.isArray(nextSheet?.rows) ? nextSheet.rows : [];
    const rowsByIdentity = new Map();
    previousRows.forEach((row, index) => {
      const key = this.fiveSFindingResponseIdentity(row);
      if (!rowsByIdentity.has(key)) rowsByIdentity.set(key, []);
      rowsByIdentity.get(key).push({ row, index });
    });
    const claimed = new Set();
    nextRows.forEach((row, index) => {
      const key = this.fiveSFindingResponseIdentity(row);
      const match = rowsByIdentity.get(key)?.find((entry) => !claimed.has(entry.index))
        || (previousRows[index] && !claimed.has(index) ? { row: previousRows[index], index } : null);
      if (match) claimed.add(match.index);
      const previousContent = String(match?.row?.countermeasure || "").trim();
      const nextContent = String(row?.countermeasure || "").trim();
      const previousAuthor = String(match?.row?.countermeasureUpdatedBy || "");
      const nextAuthor = String(row?.countermeasureUpdatedBy || "");
      const previousAt = String(match?.row?.countermeasureUpdatedAt || "");
      const nextAt = String(row?.countermeasureUpdatedAt || "");
      if (previousContent !== nextContent) {
        if (nextContent && (nextAuthor !== String(account?.id || "") || !nextAt)) {
          throw createHttpError("Thông tin người trả lời đối sách 5S không hợp lệ.", 403);
        }
        if (!nextContent && (nextAuthor || nextAt)) {
          throw createHttpError("Không thể giữ thông tin người trả lời khi đã xóa đối sách 5S.", 403);
        }
        return;
      }
      if (previousAuthor !== nextAuthor || previousAt !== nextAt) {
        throw createHttpError("Không thể thay đổi người trả lời nếu nội dung đối sách 5S không đổi.", 403);
      }
    });
  }

  assertFiveSFindingCountermeasureOnly(existingSheet, nextSheet) {
    if (!existingSheet || !nextSheet) {
      throw createHttpError("Quản lý Zone chỉ được cập nhật đối sách của vấn đề 5S đã có.", 403);
    }
    // A legacy finding may not have persisted its period ID or area ID. Its active period
    // and area are checked against the issue date and area label in assertScope before this comparison.
    const allowedSheetKeys = new Set([
      "rows",
      "periodId",
      "updatedAt",
      "updatedBy",
      ...(!existingSheet.areaId ? ["areaId"] : []),
      ...(!existingSheet.area ? ["area"] : []),
    ]);
    const sheetKeys = new Set([...Object.keys(existingSheet), ...Object.keys(nextSheet)]);
    for (const key of sheetKeys) {
      if (allowedSheetKeys.has(key)) continue;
      if (JSON.stringify(existingSheet[key]) !== JSON.stringify(nextSheet[key])) {
        throw createHttpError("Quản lý Zone chỉ được sửa biện pháp, ảnh sau xử lý, hạn và tiến độ.", 403);
      }
    }

    const rowsAsEntries = (rows) => Array.isArray(rows)
      ? rows.map((row, index) => [String(index), row])
      : Object.entries(isPlainObject(rows) ? rows : {}).sort(([left], [right]) => left.localeCompare(right, "vi", { numeric: true }));
    const previousRows = rowsAsEntries(existingSheet.rows);
    const nextRows = rowsAsEntries(nextSheet.rows);
    if (previousRows.length !== nextRows.length || previousRows.some(([key], index) => key !== nextRows[index]?.[0])) {
      throw createHttpError("Quản lý Zone không được thêm hoặc xóa dòng vấn đề 5S.", 403);
    }

    const allowedRowKeys = new Set([
      "countermeasure", "dueDate", "progress", "afterPhotoDataUrl", "afterPhotoName", "afterPhotoAnnotations",
      "countermeasureUpdatedBy", "countermeasureUpdatedAt",
    ]);
    for (let index = 0; index < previousRows.length; index += 1) {
      const previousRow = isPlainObject(previousRows[index][1]) ? previousRows[index][1] : {};
      const nextRow = isPlainObject(nextRows[index][1]) ? nextRows[index][1] : {};
      const rowKeys = new Set([...Object.keys(previousRow), ...Object.keys(nextRow)]);
      for (const key of rowKeys) {
        if (allowedRowKeys.has(key)) continue;
        if (JSON.stringify(previousRow[key]) !== JSON.stringify(nextRow[key])) {
          throw createHttpError("Quản lý Zone chỉ được sửa biện pháp, ảnh sau xử lý, hạn và tiến độ.", 403);
        }
      }
    }
  }

  isFiveSZoneManagerForArea(root, account, periodId, area, precomputedAssignments = null) {
    if (!account || !area) return false;
    if (isAdminAccount(account)) return true;
    const assignments = precomputedAssignments || getAccountRoleAssignments(root, account, periodId, FIVE_S_PERIOD_TYPE);
    if (assignments.hasDepartmentHead && isAreaManagedByDepartmentHead(area, account)) {
      return true;
    }
    const hasZoneOwnerAccess = (hasAccountAccessType(account, FIVE_S_PERIOD_TYPE, root, periodId)
      || getAccountRoleForType(account, FIVE_S_PERIOD_TYPE) === ROLE_ZONE_OWNER)
      && assignments.roles.includes(ROLE_ZONE_OWNER);
    if (!hasZoneOwnerAccess) return false;
    const managerIds = new Set(assignments.managerIds);
    if (getAccountRoleForType(account, FIVE_S_PERIOD_TYPE) === ROLE_ZONE_OWNER) {
      const primaryManagerId = getAccountPersonId(account, FIVE_S_PERIOD_TYPE);
      if (primaryManagerId) managerIds.add(primaryManagerId);
    }
    if (area.scorerId && managerIds.has(area.scorerId)) return true;
    if (!managerIds.size && getAccountRoleForType(account, FIVE_S_PERIOD_TYPE) === ROLE_ZONE_OWNER) {
      const assignedAreaIds = new Set(getAccountAreaIds(account, FIVE_S_PERIOD_TYPE));
      if (assignedAreaIds.has(area.id)
        || assignedAreaIds.has(String(area.code))
        || assignedAreaIds.has(`Zone ${area.code}`)) {
        return true;
      }
    }
    return false;
  }

  assertFiveSFindingWriteAllowed(root, account, command) {
    if (isAdminAccount(account)) return;
    const activePeriodId = String(root?.activeFiveSPeriodId || root?.activePeriodId || "");
    const parts = pathParts(command.path);
    // Scope checks require a complete record, never a collection or nested patch.
    if (parts.length !== 2 || !["set", "update", "remove"].includes(command.operation)) {
      throw createHttpError("Vui lòng cập nhật từng phiếu 5S.", 403);
    }
    const existing = valueAtPath(root, command.path);
    const existingPeriodId = existing?.periodId || "";
    const targetPeriodId = existingPeriodId || activePeriodId;
    const assignments = getAccountRoleAssignments(root, account, targetPeriodId, FIVE_S_PERIOD_TYPE);
    const hasFiveSAssessorAccess = hasAccountAccessType(account, FIVE_S_PERIOD_TYPE, root, targetPeriodId)
      && assignments.roles.includes(ROLE_ASSESSOR_5S);
    const hasAt5sAccess = assignments.hasAt5s;
    const hasZoneOwnerAccess = (hasAccountAccessType(account, FIVE_S_PERIOD_TYPE, root, targetPeriodId) || getAccountRoleForType(account, FIVE_S_PERIOD_TYPE) === ROLE_ZONE_OWNER)
      && assignments.roles.includes(ROLE_ZONE_OWNER);
    const countermeasureOnly = !hasAt5sAccess && !hasFiveSAssessorAccess
      && (assignments.hasDepartmentHead || hasZoneOwnerAccess);
    if (!assignments.hasDepartmentHead && !hasZoneOwnerAccess && !hasFiveSAssessorAccess && !hasAt5sAccess) {
      throw createHttpError("Chỉ assessor 5S, Ban AT - 5S, quản lý Zone, Trưởng bộ phận và admin được thay đổi phiếu 5S.", 403);
    }
    const isDelete = command.operation === "remove" || command.value === null;
    const assertScope = (record, { allowPastManagerReply = false } = {}) => {
      const periods = collectionValues(root?.periods).filter((period) => normalizePeriodType(period.type) !== SAFETY_PERIOD_TYPE);
      const text = String(record?.inspectionDate || "").trim();
      const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
      const displayMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
      const year = isoMatch ? Number(isoMatch[1]) : displayMatch ? Number(displayMatch[3]) : null;
      const month = isoMatch ? Number(isoMatch[2]) : displayMatch ? Number(displayMatch[2]) : null;
      const period = record?.periodId ? periods.find((item) => item.id === record.periodId) : (year && month ? periods.find((item) => Number(item.year) === year && Number(item.month) === month) : null);
      const activeId = root?.activeFiveSPeriodId || periods.find((item) => item.id === root?.activePeriodId)?.id || "";
      if (!period || period.archived) {
        throw createHttpError("Kỳ đánh giá này đã được lưu trữ hoặc không tồn tại.", 403);
      }
      const areas = period ? this.getAreasForPeriod(root, period.id, FIVE_S_PERIOD_TYPE) : [];
      const code = String(record?.area || "").replace(/^zone\s*/i, "").split("·")[0].trim();
      const area = record?.areaId ? areas.find((item) => item.id === record.areaId) : areas.find((item) => String(item.code).trim() === code);
      const scopeAssignments = period.id === targetPeriodId
        ? assignments
        : getAccountRoleAssignments(root, account, period.id, FIVE_S_PERIOD_TYPE);
      const isManagerForArea = Boolean(area && this.isFiveSZoneManagerForArea(root, account, period.id, area, scopeAssignments));
      if (!countermeasureOnly && period.id !== activeId) {
        if (!allowPastManagerReply || !isManagerForArea) {
          throw createHttpError("Chỉ được thay đổi vấn đề 5S trong kỳ đánh giá admin đang mở.", 403);
        }
      }
      if (!period || !area || (!isManagerForArea && !this.getAllowedAreaIds(root, account, period.id, FIVE_S_PERIOD_TYPE).has(area.id))) {
        throw createHttpError("Bạn chỉ được đánh giá Zone được phân công trong kỳ này.", 403);
      }
      return { period, area, isManagerForArea, activeId };
    };
    const existingScope = existing ? assertScope(existing, { allowPastManagerReply: !isDelete }) : null;
    if (isDelete) {
      if (countermeasureOnly || (existingScope && existingScope.period.id !== existingScope.activeId)) {
        throw createHttpError("Quản lý Zone chỉ được cập nhật đối sách của vấn đề 5S đã có.", 403);
      }
      return;
    }
    if (!isPlainObject(command.value) || Object.keys(command.value).some((key) => key.includes("/") || ["__proto__", "constructor", "prototype"].includes(key))) {
      throw createHttpError("Dữ liệu phiếu 5S không hợp lệ.", 403);
    }
    const next = command.operation === "update" ? { ...existing, ...command.value } : command.value;
    const nextScope = assertScope(next, { allowPastManagerReply: Boolean(existing) });
    const enforceCountermeasureOnly = countermeasureOnly || Boolean(existingScope && existingScope.period.id !== existingScope.activeId);
    if (enforceCountermeasureOnly && existingScope && (existingScope.period.id !== nextScope.period.id || existingScope.area.id !== nextScope.area.id)) {
      throw createHttpError("Quản lý Zone chỉ được sửa biện pháp, ảnh sau xử lý, hạn và tiến độ.", 403);
    }
    if (!existing && !isAdminAccount(account)) {
      const rows = Array.isArray(next.rows) ? next.rows : Object.values(next.rows || {});
      const hasResponseContent = rows.some((row) => (
        Boolean(row?.countermeasure && String(row.countermeasure).trim())
        || Boolean(row?.afterPhotoDataUrl && String(row.afterPhotoDataUrl).trim())
        || Boolean(row?.dueDate && String(row.dueDate).trim())
        || (Number(row?.progress) || 0) > 0
      ));
      if (hasResponseContent) {
        throw createHttpError("Chỉ admin mới được thêm biện pháp khắc phục, ảnh sau xử lý, hạn và tiến độ khi tạo mới vấn đề 5S.", 403);
      }
    }
    if (existing && !isAdminAccount(account)) {
      const isZoneManager = Boolean(existingScope?.isManagerForArea && nextScope?.isManagerForArea);
      if (!isZoneManager) {
        const rowsAsEntries = (rows) => Array.isArray(rows)
          ? rows.map((row, index) => [String(index), row])
          : Object.entries(isPlainObject(rows) ? rows : {}).sort(([left], [right]) => left.localeCompare(right, "vi", { numeric: true }));
        const previousRows = rowsAsEntries(existing.rows);
        const nextRows = rowsAsEntries(next.rows);
        const responseKeys = ["countermeasure", "dueDate", "progress", "afterPhotoDataUrl", "afterPhotoName", "afterPhotoAnnotations"];
        for (let i = 0; i < nextRows.length; i += 1) {
          const prevRow = previousRows[i]?.[1] || {};
          const nextRow = nextRows[i]?.[1] || {};
          for (const key of responseKeys) {
            const prevVal = String(prevRow[key] ?? "");
            const nextVal = String(nextRow[key] ?? "");
            if (key === "progress") {
              if ((Number(prevRow.progress) || 0) !== (Number(nextRow.progress) || 0)) {
                throw createHttpError("Chỉ người quản lý ở Zone đó và admin mới được sửa biện pháp khắc phục, ảnh sau xử lý, hạn và tiến độ.", 403);
              }
            } else if (key === "afterPhotoAnnotations") {
              if (JSON.stringify(prevRow.afterPhotoAnnotations || []) !== JSON.stringify(nextRow.afterPhotoAnnotations || [])) {
                throw createHttpError("Chỉ người quản lý ở Zone đó và admin mới được sửa biện pháp khắc phục, ảnh sau xử lý, hạn và tiến độ.", 403);
              }
            } else if (prevVal.trim() !== nextVal.trim()) {
              throw createHttpError("Chỉ người quản lý ở Zone đó và admin mới được sửa biện pháp khắc phục, ảnh sau xử lý, hạn và tiến độ.", 403);
            }
          }
        }
      }
    }
    if (enforceCountermeasureOnly) {
      if (existing) this.assertFiveSFindingCountermeasureOnly(existing, next);
      else if (command.operation !== "set") throw createHttpError("Quản lý Zone chỉ được tạo vấn đề 5S mới trong Zone được phân công.", 403);
      else if (nextScope.period.id !== activePeriodId) throw createHttpError("Chỉ được thay đổi vấn đề 5S trong kỳ đánh giá admin đang mở.", 403);
    }
    this.assertFiveSFindingCountermeasureAuthors(existing, next, account);
  }

  assertDataWriteAllowed(command, authContext, root) {
    const account = authContext?.rawAccount || authContext?.account;
    if (!account) {
      throw createHttpError("Bạn cần đăng nhập.", 401);
    }
    if (isAdminAccount(account)) {
      return;
    }
    if (isViewerAccount(account)) {
      throw createHttpError("Tài khoản người xem không có quyền thay đổi dữ liệu.", 403);
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
    if (rootKey === "fiveSFindings") {
      this.assertFiveSFindingWriteAllowed(root, account, command);
      return;
    }
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
      this.assertHistoryWriteAllowed(account, command, authContext);
      return;
    }

    throw createHttpError("Bạn không có quyền thay đổi dữ liệu quản trị.", 403);
  }

  assertPhotoAllowed(authContext, categoryFolder = "") {
    const account = authContext?.rawAccount || authContext?.account;
    if (!account || isViewerAccount(account)) {
      throw createHttpError("Bạn không có quyền tải ảnh.", 403);
    }
    if (categoryFolder === "huong-dan" && !isAdminAccount(account)) {
      throw createHttpError("Chỉ admin được phép thay đổi ảnh hướng dẫn sử dụng.", 403);
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
