(() => {
  "use strict";

  const API_ROOT = window.LOCAL_DATA_API_ROOT || "";
  const POLL_INTERVAL_MS = 5000;
  const DEMO_STORAGE_KEY = "legroup-5s-demo-data";
  const OFFLINE_DB_NAME = "legroup-5s-offline";
  const OFFLINE_DB_VERSION = 2;
  const OFFLINE_QUEUE_STORE = "queue";
  const OFFLINE_META_STORE = "meta";
  const OFFLINE_PHOTO_STORE = "photoMap";
  const OFFLINE_SCORE_DRAFT_STORE = "scoreDrafts";
  const OFFLINE_ROOT_KEY = "root";
  const OFFLINE_SYNC_INTERVAL_MS = 12000;
  const CONNECTION_LOST_MESSAGE = "Mất kết nối máy chủ. Dữ liệu đã lưu trên thiết bị và sẽ tự đồng bộ khi có mạng.";

  let rootCache = null;
  let rootSignature = "";
  let lastResponseSignature = "";
  let lastDataEtag = "";
  let lastDataRevision = null;
  let pollTimer = 0;
  let stream = null;
  let streamRetryTimer = 0;
  let polling = false;
  let pollAgainRequested = false;
  let consecutivePollFailures = 0;
  let activePollController = null;
  let lastPollAt = 0;
  let lastRootFetchedAt = 0;
  let streamHadError = false;
  let serverReachable = true;
  let hiddenSince = 0;
  let resumeSettleTimer = 0;
  let offlineSyncing = false;
  let onlineWriteInProgress = false;
  const recentOwnDataWriteIds = new Map();
  let offlineSyncTimer = 0;
  let lastOfflineStatus = null;
  let offlineDbPromise = null;
  let offlineRootPersistTimer = 0;
  let lastOfflineCommandTimestamp = 0;
  let demoMode = window.location.protocol === "file:";
  let authSession = null;
  const listeners = new Set();

  function clone(value) {
    if (value === undefined) {
      return null;
    }
    return JSON.parse(JSON.stringify(value));
  }

  function toPathParts(path) {
    return String(path || "")
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function valueAtPath(root, path) {
    let cursor = root;
    for (const part of toPathParts(path)) {
      if (!cursor || typeof cursor !== "object" || !Object.prototype.hasOwnProperty.call(cursor, part)) {
        return null;
      }
      cursor = cursor[part];
    }

    return cursor ?? null;
  }

  function isPlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function readDemoRoot() {
    try {
      const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      return isPlainObject(parsed) ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function writeDemoRoot(root) {
    try {
      if (root === null) {
        window.localStorage.removeItem(DEMO_STORAGE_KEY);
      } else {
        window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(root));
      }
    } catch (error) {}
  }

  function loadDemoRoot() {
    rememberRoot(readDemoRoot());
    return rootCache;
  }

  function enterDemoMode(error) {
    if (window.location.protocol !== "file:") {
      const apiError = new Error("Không kết nối được dữ liệu nội bộ. Vui lòng kiểm tra server/Docker đang chạy và mở đúng địa chỉ web.");
      apiError.status = error?.status;
      throw apiError;
    }

    if (!demoMode) {
      if (!readDemoRoot() && rootCache) {
        writeDemoRoot(rootCache);
      }
    }

    demoMode = true;
  }

  function ensureRootObject(root) {
    return isPlainObject(root) ? root : {};
  }

  function walkToParent(root, parts, createMissing) {
    let cursor = root;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index];
      if (Array.isArray(cursor[part])) {
        const map = {};
        cursor[part].forEach((item) => {
          if (item?.id) map[item.id] = item;
        });
        cursor[part] = map;
      }
      if (!isPlainObject(cursor[part])) {
        if (!createMissing) {
          return null;
        }

        cursor[part] = {};
      }

      cursor = cursor[part];
    }

    return cursor;
  }

  function setAtPath(root, path, value) {
    const parts = toPathParts(path);
    if (!parts.length) {
      return clone(value);
    }

    const next = ensureRootObject(root);
    const parent = walkToParent(next, parts, true);
    parent[parts[parts.length - 1]] = clone(value);
    return next;
  }

  function updateAtPath(root, path, value) {
    const patch = isPlainObject(value) ? clone(value) : {};
    let next = ensureRootObject(root);

    Object.entries(patch).forEach(([key, patchValue]) => {
      const fullPath = [...toPathParts(path), ...toPathParts(key)].join("/");
      next = patchValue === null ? removeAtPath(next, fullPath) : setAtPath(next, fullPath, patchValue);
    });

    return next;
  }

  function removeAtPath(root, path) {
    const parts = toPathParts(path);
    if (!parts.length) {
      return null;
    }

    const next = ensureRootObject(root);
    const parent = walkToParent(next, parts, false);
    if (parent) {
      delete parent[parts[parts.length - 1]];
    }

    return next;
  }

  function applyDemoWrite(operation, path, value) {
    const currentRoot = clone(rootCache) || readDemoRoot() || {};
    let nextRoot;

    if (operation === "set") {
      nextRoot = setAtPath(currentRoot, path, value);
    } else if (operation === "update") {
      nextRoot = updateAtPath(currentRoot, path, value);
    } else if (operation === "remove") {
      nextRoot = removeAtPath(currentRoot, path);
    } else {
      throw new Error(`LocalDataStore không hỗ trợ thao tác "${operation}".`);
    }

    rememberRoot(nextRoot);
    writeDemoRoot(rootCache);
    notifyAll();
    return rootCache;
  }

  async function applyOfflineWrite(operation, path, value, writeOptions = {}) {
    if (!["set", "update", "remove"].includes(operation)) {
      throw new Error(`LocalDataStore không hỗ trợ thao tác "${operation}".`);
    }

    await enqueueOfflineCommand({
      type: "data-write",
      operation,
      path: path || "",
      value: clone(value),
      allowZoneManagerReassignment: writeOptions.allowZoneManagerReassignment === true,
      ...(writeOptions.scoreConflict ? { scoreConflict: clone(writeOptions.scoreConflict) } : {}),
    }, { scheduleSync: writeOptions.scheduleSync !== false });
    const currentRoot = rootCache || await readOfflineRoot() || {};
    const nextRoot = applyQueuedWritesToRoot(currentRoot, await getQueuedCommands());
    rememberRoot(nextRoot, { signature: false, persist: false });
    if (writeOptions.suppressLocalNotification !== true) notifyAll();
    return rootCache;
  }

  async function stageOptimisticWrite(operation, path, value, writeOptions = {}) {
    const entry = await enqueueOfflineCommand({
      type: "data-write",
      operation,
      path: path || "",
      value: clone(value),
      allowZoneManagerReassignment: writeOptions.allowZoneManagerReassignment === true,
      ...(writeOptions.scoreConflict ? { scoreConflict: clone(writeOptions.scoreConflict) } : {}),
    }, { scheduleSync: false });
    const currentRoot = rootCache || await readOfflineRoot() || {};
    rememberRoot(applyQueuedWritesToRoot(currentRoot, await getQueuedCommands()), { signature: false, persist: false });
    if (writeOptions.suppressLocalNotification !== true) notifyAll();
    return entry;
  }

  function applyQueuedWritesToRoot(root, entries) {
    let nextRoot = isPlainObject(root) ? root : {};
    for (const entry of entries) {
      if (!isQueuedCommandForCurrentAccount(entry)) continue;
      if (entry.type === "data-write") {
        if (entry.operation === "set") {
          nextRoot = setAtPath(nextRoot, entry.path, entry.value);
        } else if (entry.operation === "update") {
          nextRoot = updateAtPath(nextRoot, entry.path, entry.value);
        } else if (entry.operation === "remove") {
          nextRoot = removeAtPath(nextRoot, entry.path);
        }
      }
    }
    return nextRoot;
  }

  function isQueuedCommandForCurrentAccount(entry) {
    if (!authSession) return true;
    if (entry?.accountId && authSession.accountId) return entry.accountId === authSession.accountId;
    if (entry?.username && authSession.username) return entry.username === authSession.username;
    return true;
  }

  function queuedCommandsForCurrentAccount(entries) {
    return (Array.isArray(entries) ? entries : []).filter(isQueuedCommandForCurrentAccount);
  }

  function applyAcknowledgedWritesToRoot(root, acknowledgement) {
    let nextRoot = isPlainObject(root) ? root : {};
    (Array.isArray(acknowledgement?.applied) ? acknowledgement.applied : []).forEach((change) => {
      if (!change?.path) return;
      nextRoot = change.removed
        ? removeAtPath(nextRoot, change.path)
        : setAtPath(nextRoot, change.path, change.value);
    });
    return nextRoot;
  }

  function queuedWritePaths(entry) {
    if (entry?.type !== "data-write") return [];
    const baseParts = toPathParts(entry.path);
    if (entry.operation === "update" && baseParts.length < 2 && isPlainObject(entry.value)) {
      return Object.keys(entry.value).map((path) => [...baseParts, ...toPathParts(path)].join("/"));
    }
    return baseParts.length ? [baseParts.join("/")] : [];
  }

  function pathValueSignature(root, path) {
    try {
      return JSON.stringify(valueAtPath(root, path));
    } catch (_) {
      return "";
    }
  }

  async function acceptWriteAcknowledgement(acknowledgement) {
    const currentRoot = rootCache;
    const currentPaths = (Array.isArray(acknowledgement?.applied) ? acknowledgement.applied : []).map((change) => change.path);
    const pendingCommands = (await getQueuedCommands()).filter((entry) => entry.id !== acknowledgement?.commandId);
    const affectedPaths = [...new Set([...currentPaths, ...pendingCommands.flatMap(queuedWritePaths)])];
    const previousValues = affectedPaths.map((path) => pathValueSignature(currentRoot, path));
    let acknowledgedRoot;
    if (acknowledgement?.reloadRequired) {
      acknowledgedRoot = await request("/api/data");
    } else {
      acknowledgedRoot = applyAcknowledgedWritesToRoot(rootCache, acknowledgement);
    }
    const finalRoot = applyQueuedWritesToRoot(acknowledgedRoot, pendingCommands);
    const shouldNotify = Boolean(acknowledgement?.reloadRequired)
      || affectedPaths.some((path, index) => previousValues[index] !== pathValueSignature(finalRoot, path));
    rememberRoot(finalRoot, {
      signature: Boolean(acknowledgement?.reloadRequired),
      persist: !pendingCommands.length,
    });
    if (shouldNotify) notifyAll();
  }

  async function restoreLocalRoot(fallbackRoot) {
    const pendingCommands = await getQueuedCommands().catch(() => []);
    rememberRoot(applyQueuedWritesToRoot(fallbackRoot || {}, pendingCommands), {
      signature: false,
      persist: !pendingCommands.length,
    });
    notifyAll();
  }

  async function restoreAfterRejectedWrite(fallbackRoot) {
    const pendingCommands = await getQueuedCommands();
    try {
      const serverRoot = await request("/api/data");
      rememberRoot(applyQueuedWritesToRoot(serverRoot, pendingCommands), {
        signature: !pendingCommands.length,
        persist: !pendingCommands.length,
      });
    } catch (error) {
      if (isAuthError(error)) clearAuthSession();
      rememberRoot(applyQueuedWritesToRoot(fallbackRoot || {}, pendingCommands), {
        signature: false,
        persist: !pendingCommands.length,
      });
    }
    notifyAll();
  }

  function getPhotoPeriodFolder(photo) {
    const month = Number(photo?.month);
    const year = Number(photo?.year);
    if (Number.isInteger(month) && month >= 1 && month <= 12 && Number.isInteger(year) && year >= 2000) {
      return `${String(month).padStart(2, "0")}-${year}`;
    }

    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
  }

  function saveDemoPhoto(photo) {
    const dataUrl = typeof photo?.dataUrl === "string" ? photo.dataUrl : "";
    return {
      url: dataUrl,
      fileName: photo?.fileName || "anh-minh-hoa.jpg",
      periodFolder: getPhotoPeriodFolder(photo),
      contentType: dataUrl.match(/^data:([^;]+);base64,/)?.[1] || "image/jpeg",
      size: dataUrl.length,
    };
  }

  function createSnapshot(value) {
    return {
      val() {
        return clone(value);
      },
    };
  }

  function buildUrl(path) {
    return `${API_ROOT}${path}`;
  }

  function signatureForText(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return String(text.length) + ":" + (hash >>> 0).toString(36);
  }

  function stripVolatileAccountFields(account) {
    if (!account || typeof account !== "object") {
      return account;
    }
    const {
      activeSessionId,
      activeSessionAt,
      activeSessionExpiresAt,
      activeSessionStartedAt,
      ...stableAccount
    } = account;
    return stableAccount;
  }

  function signatureForRoot(root) {
    if (!root || typeof root !== "object") {
      return signatureForText("null");
    }
    let normalized = root;
    if (Array.isArray(root.accounts)) {
      normalized = { ...root, accounts: root.accounts.map(stripVolatileAccountFields) };
    } else if (isPlainObject(root.accounts)) {
      const accounts = {};
      Object.entries(root.accounts).forEach(([id, account]) => {
        accounts[id] = stripVolatileAccountFields(account);
      });
      normalized = { ...root, accounts };
    }
    return signatureForText(JSON.stringify(normalized));
  }

  function rememberDataRevision(revision) {
    if (revision === null || revision === undefined || revision === "") return;
    const value = Number(revision);
    if (!Number.isSafeInteger(value) || value < 0) return;
    if (lastDataRevision !== null && value < lastDataRevision) return;
    lastDataRevision = value;
    lastDataEtag = `"root-${value}"`;
  }

  function rememberDataEtag(etag) {
    const match = /^"root-(\d+)"$/.exec(String(etag || "").trim());
    if (match) rememberDataRevision(Number(match[1]));
  }

  function isIndexedDbAvailable() {
    return typeof window.indexedDB !== "undefined";
  }

  function openOfflineDb() {
    if (!isIndexedDbAvailable()) {
      return Promise.resolve(null);
    }

    if (!offlineDbPromise) {
      offlineDbPromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
            db.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains(OFFLINE_META_STORE)) {
            db.createObjectStore(OFFLINE_META_STORE, { keyPath: "key" });
          }
          if (!db.objectStoreNames.contains(OFFLINE_PHOTO_STORE)) {
            db.createObjectStore(OFFLINE_PHOTO_STORE, { keyPath: "signature" });
          }
          if (!db.objectStoreNames.contains(OFFLINE_SCORE_DRAFT_STORE)) {
            db.createObjectStore(OFFLINE_SCORE_DRAFT_STORE, { keyPath: "id" });
          }
        };
        request.onsuccess = () => {
          request.result.onversionchange = () => request.result.close();
          resolve(request.result);
        };
        request.onerror = () => reject(request.error || new Error("Không mở được bộ nhớ offline."));
        request.onblocked = () => reject(new Error("Bộ nhớ offline đang bị khóa bởi tab khác."));
      }).catch((error) => {
        offlineDbPromise = null;
        return null;
      });
    }

    return offlineDbPromise;
  }

  async function withOfflineStore(storeName, mode, callback) {
    const db = await openOfflineDb();
    if (!db) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      let result;
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error || new Error("Không truy cập được bộ nhớ offline."));
      transaction.onabort = () => reject(transaction.error || new Error("Thao tác bộ nhớ offline bị hủy."));
      try {
        result = callback(store);
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    });
  }

  function idbRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Thao tác IndexedDB thất bại."));
    });
  }

  async function persistOfflineRoot(root) {
    if (!isPlainObject(root)) {
      return;
    }

    await withOfflineStore(OFFLINE_META_STORE, "readwrite", (store) => {
      store.put({ key: OFFLINE_ROOT_KEY, value: root, savedAt: new Date().toISOString() });
    });
  }

  async function readOfflineRoot() {
    const entry = await withOfflineStore(OFFLINE_META_STORE, "readonly", (store) => idbRequest(store.get(OFFLINE_ROOT_KEY)));
    return isPlainObject(entry?.value) ? entry.value : null;
  }

  async function getQueuedCommands() {
    const entries = await withOfflineStore(OFFLINE_QUEUE_STORE, "readonly", (store) => idbRequest(store.getAll()));
    return (Array.isArray(entries) ? entries : []).sort((a, b) => {
      const sequenceA = Number(a?.sequence);
      const sequenceB = Number(b?.sequence);
      if (Number.isFinite(sequenceA) && Number.isFinite(sequenceB) && sequenceA !== sequenceB) {
        return sequenceA - sequenceB;
      }
      const left = String(a?.createdAt || "");
      const right = String(b?.createdAt || "");
      return left.localeCompare(right) || String(a?.id || "").localeCompare(String(b?.id || ""));
    });
  }

  async function getOfflineQueueCount() {
    const entries = await getQueuedCommands();
    const scoreDraftCount = await withOfflineStore(OFFLINE_SCORE_DRAFT_STORE, "readonly", (store) => idbRequest(store.count()));
    return entries.length + Number(scoreDraftCount || 0);
  }

  async function savePendingScoreDraft(draft = {}) {
    if (!draft.id) {
      throw new Error("Thiếu mã bản nháp điểm.");
    }
    const existing = await withOfflineStore(OFFLINE_SCORE_DRAFT_STORE, "readonly", (store) => idbRequest(store.get(draft.id)));
    const historyEntries = new Map((existing?.historyEntries || []).map((entry) => [entry.id, entry]));
    (draft.historyEntries || []).forEach((entry) => historyEntries.set(entry.id, entry));
    const nextDraft = {
      ...existing,
      ...draft,
      expectedValue: draft.rebaseExpected ? draft.expectedValue : existing ? existing.expectedValue : draft.expectedValue,
      historyEntries: [...historyEntries.values()],
      createdAt: existing?.createdAt || draft.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    delete nextDraft.rebaseExpected;
    const stored = await withOfflineStore(OFFLINE_SCORE_DRAFT_STORE, "readwrite", (store) => store.put(nextDraft));
    if (stored === null) {
      throw new Error("Không thể lưu bản nháp điểm trên thiết bị này.");
    }
    await dispatchOfflineStatus({ pending: await getOfflineQueueCount(), lastError: "" });
    return nextDraft;
  }

  async function getPendingScoreDrafts() {
    const drafts = await withOfflineStore(OFFLINE_SCORE_DRAFT_STORE, "readonly", (store) => idbRequest(store.getAll()));
    return (Array.isArray(drafts) ? drafts : []).sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  }

  async function removePendingScoreDraft(id) {
    await withOfflineStore(OFFLINE_SCORE_DRAFT_STORE, "readwrite", (store) => store.delete(id));
    await dispatchOfflineStatus({ pending: await getOfflineQueueCount(), lastError: "" });
  }

  async function enqueueOfflineCommand(command, { scheduleSync = true } = {}) {
    let entry = null;
    const stored = await withOfflineStore(OFFLINE_QUEUE_STORE, "readwrite", (store) => {
      const getRequest = store.getAll();
      getRequest.onsuccess = () => {
        const queuedCommands = Array.isArray(getRequest.result) ? getRequest.result : [];
        const lastQueuedSequence = queuedCommands.reduce((latest, queued) => {
          const sequence = Number(queued?.sequence);
          const createdAt = Date.parse(queued?.createdAt || "");
          return Math.max(latest, Number.isFinite(sequence) ? sequence : Number.isFinite(createdAt) ? createdAt : 0);
        }, 0);
        const timestamp = Math.max(Date.now(), lastOfflineCommandTimestamp + 1, lastQueuedSequence + 1);
        lastOfflineCommandTimestamp = timestamp;
        entry = {
          ...command,
          id: command.id || `offline-${timestamp.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          sequence: command.sequence || timestamp,
          createdAt: command.createdAt || new Date(timestamp).toISOString(),
          accountId: command.accountId || authSession?.accountId || "",
          username: command.username || authSession?.username || "",
        };
        store.put(entry);
      };
    });
    if (stored === null || !entry) {
      throw new Error("Trình duyệt không hỗ trợ bộ nhớ offline. Vui lòng dùng Chrome/Edge và thử lại.");
    }
    await dispatchOfflineStatus({ pending: await getOfflineQueueCount(), online: serverReachable });
    if (scheduleSync) scheduleOfflineSync();
    return entry;
  }

  async function deleteQueuedCommand(id) {
    await withOfflineStore(OFFLINE_QUEUE_STORE, "readwrite", (store) => {
      store.delete(id);
    });
  }

  async function getPhotoMappings() {
    const entries = await withOfflineStore(OFFLINE_PHOTO_STORE, "readonly", (store) => idbRequest(store.getAll()));
    const map = new Map();
    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      if (entry?.signature && entry?.remote?.url) {
        map.set(entry.signature, entry.remote);
      }
    });
    return map;
  }

  async function savePhotoMapping(signature, remote) {
    if (!signature || !remote?.url) {
      return;
    }
    await withOfflineStore(OFFLINE_PHOTO_STORE, "readwrite", (store) => {
      store.put({ signature, remote, savedAt: new Date().toISOString() });
    });
  }

  function isNetworkLikeError(error) {
    if (!error) {
      return true;
    }
    const status = Number(error.status);
    if (Number.isFinite(status) && status > 0) {
      return [502, 503, 504].includes(status);
    }
    return true;
  }

  async function requestWithNetworkRetry(path, options = {}, maxAttempts = 5) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        return await request(path, options);
      } catch (error) {
        if (!isNetworkLikeError(error) || attempt + 1 >= maxAttempts) {
          throw error;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    throw new Error("Không thể kết nối máy chủ.");
  }

  async function dispatchOfflineStatus(overrides = {}) {
    const pending = Number.isFinite(overrides.pending) ? overrides.pending : await getOfflineQueueCount();
    const scoreDrafts = Number.isFinite(overrides.scoreDrafts)
      ? overrides.scoreDrafts
      : await withOfflineStore(OFFLINE_SCORE_DRAFT_STORE, "readonly", (store) => idbRequest(store.count())).catch(() => 0);
    const detail = {
      pending,
      scoreDrafts: Number(scoreDrafts || 0),
      syncing: offlineSyncing,
      online: serverReachable,
      lastError: "",
      ...(lastOfflineStatus || {}),
      ...overrides,
      pending,
      syncing: overrides.syncing ?? offlineSyncing,
    };
    lastOfflineStatus = detail;
    try {
      window.dispatchEvent(new CustomEvent("local-data-sync-status", { detail }));
    } catch (error) {}
    return detail;
  }

  function scheduleOfflineSync(delayMs = 0) {
    if (offlineSyncTimer) {
      window.clearTimeout(offlineSyncTimer);
      offlineSyncTimer = 0;
    }
    offlineSyncTimer = window.setTimeout(() => {
      offlineSyncTimer = 0;
      flushOfflineQueue().catch(() => {});
    }, Math.max(0, delayMs));
  }

  function transformOfflinePhotoRefs(value, photoMap) {
    if (!photoMap?.size) {
      return value;
    }

    if (typeof value === "string") {
      const mapped = value.startsWith("data:image/") ? photoMap.get(signatureForText(value)) : null;
      return mapped?.url || value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => transformOfflinePhotoRefs(item, photoMap));
    }

    if (!isPlainObject(value)) {
      return value;
    }

    const next = {};
    const photoSignature = typeof value.photoDataUrl === "string" && value.photoDataUrl.startsWith("data:image/")
      ? signatureForText(value.photoDataUrl)
      : "";
    const mappedPhoto = photoSignature ? photoMap.get(photoSignature) : null;
    const afterPhotoSignature = typeof value.afterPhotoDataUrl === "string" && value.afterPhotoDataUrl.startsWith("data:image/")
      ? signatureForText(value.afterPhotoDataUrl)
      : "";
    const mappedAfterPhoto = afterPhotoSignature ? photoMap.get(afterPhotoSignature) : null;
    Object.entries(value).forEach(([key, itemValue]) => {
      if (key === "photoDataUrl" && mappedPhoto?.url) {
        next[key] = mappedPhoto.url;
      } else if (key === "photoName" && mappedPhoto?.fileName) {
        next[key] = mappedPhoto.fileName;
      } else if (key === "afterPhotoDataUrl" && mappedAfterPhoto?.url) {
        next[key] = mappedAfterPhoto.url;
      } else if (key === "afterPhotoName" && mappedAfterPhoto?.fileName) {
        next[key] = mappedAfterPhoto.fileName;
      } else {
        next[key] = transformOfflinePhotoRefs(itemValue, photoMap);
      }
    });
    return next;
  }

  async function readJsonResponse(response) {
    const text = await response.text();
    lastResponseSignature = signatureForText(text);
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (_) {
      const error = new Error("Không thể xử lý phản hồi dữ liệu. Vui lòng thử lại.");
      error.status = 502;
      throw error;
    }
  }

  function publicApiErrorMessage(status, payload = null) {
    const detail = String(payload?.error || "").trim();
    if (status === 400) return detail ? detail.slice(0, 240) : "Dữ liệu gửi lên không hợp lệ. Vui lòng kiểm tra lại.";
    if (status === 401) return "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.";
    if (status === 403) {
      return detail ? detail.slice(0, 240) : "Bạn không có quyền thực hiện thao tác này.";
    }
    if (status === 404) return "Không tìm thấy nội dung yêu cầu.";
    if (status === 405) return "Thao tác này không được hỗ trợ.";
    if (status === 409) return detail ? detail.slice(0, 240) : "Dữ liệu đã thay đổi hoặc bị xung đột. Vui lòng tải lại rồi thử lại.";
    if (status === 413) return "Dữ liệu gửi lên vượt quá giới hạn cho phép.";
    if (status === 429) return "Có quá nhiều yêu cầu. Vui lòng thử lại sau.";
    return "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.";
  }

  async function request(path, options = {}) {
    if (window.location.protocol === "file:") {
      throw new Error("Ứng dụng đang mở bằng file nên sẽ chạy chế độ demo trong trình duyệt.");
    }

    const { allowNotModified = false, timeoutMs = 0, ...fetchOptions } = options;
    const effectiveTimeoutMs = Number(timeoutMs) > 0
      ? Number(timeoutMs)
      : (fetchOptions.method && fetchOptions.method.toUpperCase() !== "GET" ? 30000 : 12000);
    const useInternalTimeout = !fetchOptions.signal && typeof AbortController !== "undefined" && effectiveTimeoutMs > 0;
    const timeoutController = useInternalTimeout ? new AbortController() : null;
    const timeoutId = timeoutController
      ? window.setTimeout(() => timeoutController.abort(), effectiveTimeoutMs)
      : 0;

    let response;
    try {
      response = await fetch(buildUrl(path), {
        ...fetchOptions,
        signal: fetchOptions.signal || timeoutController?.signal,
        credentials: fetchOptions.credentials || "include",
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });
      serverReachable = ![502, 503, 504].includes(response.status);
    } catch (fetchError) {
      serverReachable = false;
      throw fetchError;
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
    }

    if (allowNotModified && response.status === 304) {
      rememberDataEtag(response.headers.get("etag"));
      return { notModified: true };
    }

    const payload = await readJsonResponse(response);
    if (!response.ok) {
      const error = new Error(publicApiErrorMessage(response.status, payload));
      error.status = response.status;
      error.payload = payload;
      error.referenceId = /^[a-zA-Z0-9-]{1,64}$/.test(String(payload?.referenceId || ""))
        ? payload.referenceId
        : "";
      if (error.referenceId) {
        error.message += ` Mã tham chiếu: ${error.referenceId}.`;
      }
      throw error;
    }

    const responseEtag = response.headers.get("etag");
    if (responseEtag) rememberDataEtag(responseEtag);
    if (path === "/api/data/write") rememberDataRevision(payload?.revision);

    return payload;
  }

  function isAuthError(error) {
    return error?.status === 401;
  }

  function dataWriteRequest(entry, value = entry.value) {
    rememberOwnDataWrite(entry.id);
    const body = JSON.stringify({
      commandId: entry.id,
      operation: entry.operation,
      path: entry.path || "",
      value,
      allowZoneManagerReassignment: entry.allowZoneManagerReassignment === true,
      ...(entry.scoreConflict ? { scoreConflict: entry.scoreConflict } : {}),
    });
    const isLargePayload = body.length > 32768 || body.includes("data:image/");
    const requestOptions = {
      method: "POST",
      timeoutMs: isLargePayload ? 45000 : 10000,
      body,
    };
    if (entry.scoreConflict) {
      return request("/api/data/write", requestOptions);
    }
    return requestWithNetworkRetry("/api/data/write", requestOptions, 3);
  }

  function rememberOwnDataWrite(commandId) {
    const id = String(commandId || "");
    if (!id) return;
    if (recentOwnDataWriteIds.has(id)) {
      window.clearTimeout(recentOwnDataWriteIds.get(id));
      recentOwnDataWriteIds.delete(id);
    }
    const timer = window.setTimeout(() => recentOwnDataWriteIds.delete(id), 30000);
    recentOwnDataWriteIds.set(id, timer);
    while (recentOwnDataWriteIds.size > 256) {
      const oldestId = recentOwnDataWriteIds.keys().next().value;
      window.clearTimeout(recentOwnDataWriteIds.get(oldestId));
      recentOwnDataWriteIds.delete(oldestId);
    }
  }

  function dataChangedEventDetails(event) {
    try {
      return JSON.parse(event?.data || "");
    } catch (_) {
      return {};
    }
  }

  function consumeOwnDataWriteEvent(detail) {
    const commandId = String(detail?.commandId || "");
    if (!commandId || !recentOwnDataWriteIds.has(commandId)) return false;
    window.clearTimeout(recentOwnDataWriteIds.get(commandId));
    recentOwnDataWriteIds.delete(commandId);
    return true;
  }

  async function flushOfflineQueue() {
    const initialEntries = await getQueuedCommands();
    if (offlineSyncing || onlineWriteInProgress) {
      return true;
    }
    if (!initialEntries.length) {
      await dispatchOfflineStatus({ pending: 0, syncing: false, online: serverReachable, lastError: "" });
      return true;
    }
    if (demoMode) {
      return false;
    }
    if (!authSession) {
      await dispatchOfflineStatus({
        pending: initialEntries.length,
        online: serverReachable,
        syncing: false,
        lastError: "Phiên đăng nhập chưa được xác nhận. Vui lòng đăng nhập lại để đồng bộ các thay đổi đang chờ.",
      });
      return false;
    }

    const allEntries = initialEntries;
    const entries = queuedCommandsForCurrentAccount(allEntries);
    if (!entries.length) {
      await dispatchOfflineStatus({
        pending: allEntries.length,
        online: serverReachable,
        syncing: false,
        lastError: allEntries.length
          ? "Một số dữ liệu chờ đồng bộ thuộc tài khoản khác. Đăng nhập tài khoản đã tạo dữ liệu đó để tiếp tục đồng bộ."
          : "",
      });
      return true;
    }

    offlineSyncing = true;
    let activeEntry = null;
    try {
      await dispatchOfflineStatus({ pending: entries.length, syncing: true, online: true, lastError: "" });
      await requestWithNetworkRetry("/api/health", { timeoutMs: 8000 }, 2);
      let photoMap = await getPhotoMappings();

      for (const entry of entries) {
        activeEntry = entry;
        if (entry.type === "photo-save") {
          const signature = entry.localSignature || signatureForText(entry.photo?.dataUrl || "");
          if (!photoMap.has(signature)) {
            const savedPhoto = await requestWithNetworkRetry("/api/photos", {
              method: "POST",
              timeoutMs: 45000,
              body: JSON.stringify(entry.photo || {}),
            }, 3);
            await savePhotoMapping(signature, savedPhoto);
            photoMap = await getPhotoMappings();
          }
        } else if (entry.type === "photo-delete") {
          const photo = transformOfflinePhotoRefs(entry.photo, photoMap);
          await requestWithNetworkRetry("/api/photos/delete", {
            method: "POST",
            timeoutMs: 12000,
            body: JSON.stringify(photo || {}),
          }, 2);
        } else if (entry.type === "data-write") {
          const value = transformOfflinePhotoRefs(entry.value, photoMap);
          const acknowledgement = await dataWriteRequest(entry, value);
          await acceptWriteAcknowledgement(acknowledgement);
          await deleteQueuedCommand(entry.id);
          await dispatchOfflineStatus({ pending: await getOfflineQueueCount(), syncing: true, online: true, lastError: "" });
          activeEntry = null;
          continue;
        }

        await deleteQueuedCommand(entry.id);
        await dispatchOfflineStatus({ pending: await getOfflineQueueCount(), syncing: true, online: true, lastError: "" });
        activeEntry = null;
      }

      return true;
    } catch (error) {
      if (isAuthError(error)) {
        clearAuthSession();
        notifyAuthRevoked();
      } else if ([400, 403, 409].includes(Number(error?.status))) {
        if (activeEntry?.type === "data-write") {
          await deleteQueuedCommand(activeEntry.id);
          await restoreAfterRejectedWrite(rootCache);
        }
        await dispatchOfflineStatus({
          pending: await getOfflineQueueCount(),
          syncing: false,
          online: serverReachable,
          lastError: error.message || "Máy chủ từ chối một thay đổi đang chờ đồng bộ.",
        });
        return false;
      }
      await dispatchOfflineStatus({
        pending: await getOfflineQueueCount(),
        syncing: false,
        online: serverReachable,
        lastError: isNetworkLikeError(error) ? CONNECTION_LOST_MESSAGE : "Không đồng bộ được dữ liệu lưu tạm. Vui lòng thử lại.",
      });
      return false;
    } finally {
      offlineSyncing = false;
      const finalEntries = await getQueuedCommands();
      const pending = finalEntries.length;
      const currentAccountPending = queuedCommandsForCurrentAccount(finalEntries).length;
      await dispatchOfflineStatus({
        pending,
        syncing: false,
        online: serverReachable,
        lastError: currentAccountPending
          ? lastOfflineStatus?.lastError || ""
          : pending
            ? "Một số dữ liệu chờ đồng bộ thuộc tài khoản khác. Đăng nhập tài khoản đã tạo dữ liệu đó để tiếp tục đồng bộ."
            : "",
      });
      if (currentAccountPending && authSession && !demoMode) {
        scheduleOfflineSync(OFFLINE_SYNC_INTERVAL_MS);
      }
    }
  }

  async function waitForQueuedWritesToDrain() {
    let transientSyncRetries = 0;
    while (true) {
      if (onlineWriteInProgress || offlineSyncing) {
        await new Promise((resolve) => window.setTimeout(resolve, 30));
        continue;
      }
      const pending = queuedCommandsForCurrentAccount(await getQueuedCommands());
      if (!pending.length) return;
      const synced = await flushOfflineQueue();
      const remaining = queuedCommandsForCurrentAccount(await getQueuedCommands());
      if (!synced && remaining.length) {
        if (offlineSyncing || onlineWriteInProgress) continue;
        if (lastOfflineStatus?.lastError) {
          throw new Error(lastOfflineStatus.lastError);
        }
        if (serverReachable && authSession && transientSyncRetries < 10) {
          transientSyncRetries += 1;
          await new Promise((resolve) => window.setTimeout(resolve, 50));
          continue;
        }
        throw new Error("Một số thay đổi trước đó chưa đồng bộ được. Vui lòng thử lại sau khi đồng bộ hoàn tất.");
      }
      if (synced) transientSyncRetries = 0;
    }
  }

  function setAuthSession(payload = {}) {
    const account = payload.account || {};
    const accountId = payload.accountId || account.id || "";
    const username = payload.username || account.username || "";
    const sessionId = payload.sessionId || account.activeSessionId || "";
    const previousAccountId = authSession?.accountId || "";
    const previousUsername = authSession?.username || "";
    if ((accountId && accountId !== previousAccountId) || (username && username !== previousUsername)) {
      lastDataEtag = "";
      lastDataRevision = null;
    }
    authSession = accountId || username || sessionId
      ? { accountId, username, sessionId, sessionStartedAt: payload.sessionStartedAt || "" }
      : null;
    scheduleOfflineSync(500);
  }

  function clearAuthSession() {
    authSession = null;
    lastDataEtag = "";
    lastDataRevision = null;
    stopDataStream();
  }

  function notifyAuthRevoked() {
    try {
      window.dispatchEvent(new CustomEvent("local-data-auth-revoked", {
        detail: { message: "Phiên đăng nhập đã hết hạn hoặc bị thay đổi. Vui lòng đăng nhập lại." },
      }));
    } catch (_) {}
  }

  async function notifyConnectionLost() {
    serverReachable = false;
    await dispatchOfflineStatus({
      pending: await getOfflineQueueCount().catch(() => 0),
      syncing: false,
      online: false,
      lastError: CONNECTION_LOST_MESSAGE,
    });
  }

  async function notifyConnectionRestored({ retryPending = false } = {}) {
    serverReachable = true;
    const wasOffline = lastOfflineStatus?.online === false || Boolean(lastOfflineStatus?.lastError);
    const detail = await dispatchOfflineStatus({
      pending: await getOfflineQueueCount().catch(() => 0),
      online: true,
      lastError: "",
    });
    if (retryPending && (wasOffline || detail.scoreDrafts > 0)) {
      window.dispatchEvent(new CustomEvent("local-data-network-restored"));
    }
    if (retryPending) {
      scheduleOfflineSync(500);
    }
  }

  function applyAuthPayload(payload) {
    setAuthSession(payload);
    if (payload?.revision !== undefined && payload?.revision !== null) {
      rememberDataRevision(payload.revision);
    }
    if (payload?.root) {
      lastRootFetchedAt = Date.now();
      rememberRoot(payload.root);
      notifyAll();
      getQueuedCommands().then((queuedCommands) => {
        if (!queuedCommandsForCurrentAccount(queuedCommands).length || !rootCache) {
          return;
        }
        rememberRoot(applyQueuedWritesToRoot(rootCache, queuedCommands));
        notifyAll();
      }).catch(() => {});
    }
    return payload;
  }

  function findDemoAccount(root, username, password) {
    const cleanUser = String(username || "").trim();
    const rawPass = String(password || "");
    const trimmedPass = rawPass.trim();
    const accounts = Array.isArray(root?.accounts)
      ? root.accounts
      : root?.accounts && typeof root.accounts === "object"
        ? Object.values(root.accounts)
        : [];
    return accounts.find((account) => {
      if (account?.username !== cleanUser) return false;
      if (account?.password && (account.password === rawPass || account.password === trimmedPass)) return true;
      return false;
    }) || null;
  }

  async function login(username, password) {
    if (demoMode) {
      const root = loadDemoRoot();
      const account = findDemoAccount(root, username, password);
      if (!account) {
        const error = new Error("Sai tài khoản hoặc mật khẩu.");
        error.status = 401;
        throw error;
      }
      const payload = {
        sessionId: `demo-${Date.now()}`,
        sessionStartedAt: new Date().toISOString(),
        account,
        root,
      };
      return applyAuthPayload(payload);
    }

    try {
      return applyAuthPayload(await requestWithNetworkRetry("/api/auth/login", {
        method: "POST",
        timeoutMs: 15000,
        body: JSON.stringify({ username, password }),
      }, 2));
    } catch (error) {
      if (isAuthError(error) || error.status === 409) {
        throw error;
      }
      enterDemoMode(error);
      return login(username, password);
    }
  }

  async function restoreSession(sessionInfo = {}) {
    setAuthSession(sessionInfo);
    if (demoMode) {
      const root = loadDemoRoot();
      const accounts = Array.isArray(root?.accounts) ? root.accounts : Object.values(root?.accounts || {});
      const account = accounts.find((item) => item?.id === sessionInfo.accountId)
        || accounts.find((item) => item?.username === sessionInfo.username)
        || null;
      return {
        account,
        accountId: account?.id || sessionInfo.accountId || "",
        username: account?.username || sessionInfo.username || "",
        sessionId: sessionInfo.sessionId || "",
        sessionStartedAt: sessionInfo.sessionStartedAt || "",
        root,
      };
    }

    try {
      return applyAuthPayload(await requestWithNetworkRetry("/api/auth/session", { timeoutMs: 8000 }, 3));
    } catch (error) {
      if (!isAuthError(error) && isNetworkLikeError(error)) {
        await notifyConnectionLost(error);
      }
      clearAuthSession();
      throw error;
    }
  }

  async function touchSession() {
    if (demoMode) {
      const root = rootCache || loadDemoRoot();
      const accounts = Array.isArray(root?.accounts) ? root.accounts : Object.values(root?.accounts || {});
      const account = accounts.find((item) => item?.id === authSession?.accountId)
        || accounts.find((item) => item?.username === authSession?.username)
        || null;
      return {
        ...authSession,
        account,
        root,
      };
    }

    try {
      return applyAuthPayload(await requestWithNetworkRetry("/api/auth/session/touch", { method: "POST" }));
    } catch (error) {
      if (!isAuthError(error) && isNetworkLikeError(error)) {
        await notifyConnectionLost(error);
      }
      throw error;
    }
  }

  async function logout() {
    try {
      if (!demoMode) {
        await request("/api/auth/logout", { method: "POST" });
      }
    } finally {
      clearAuthSession();
    }
  }

  function rememberRoot(root, { signature = true, persist = true } = {}) {
    rootCache = root && typeof root === "object" ? root : null;
    if (signature) rootSignature = signatureForRoot(rootCache);
    else if (!rootSignature) rootSignature = "pending-local-updates";
    if (persist) scheduleOfflineRootPersist();
  }

  function scheduleOfflineRootPersist() {
    if (offlineRootPersistTimer) return;
    offlineRootPersistTimer = window.setTimeout(() => {
      offlineRootPersistTimer = 0;
      const runPersist = () => persistOfflineRoot(rootCache).catch(() => {});
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(runPersist, { timeout: 2500 });
      } else {
        runPersist();
      }
    }, 1500);
  }

  async function loadRoot() {
    if (demoMode) {
      return loadDemoRoot();
    }

    try {
      const root = await request("/api/data");
      lastRootFetchedAt = Date.now();
      const queuedCommands = await getQueuedCommands();
      const currentAccountCommands = queuedCommandsForCurrentAccount(queuedCommands);
      if (currentAccountCommands.length) {
        scheduleOfflineRootPersist();
        rememberRoot(applyQueuedWritesToRoot(root, currentAccountCommands), { signature: false, persist: false });
        scheduleOfflineSync(500);
      } else {
        rememberRoot(root);
      }
      await notifyConnectionRestored({ retryPending: true });
    } catch (error) {
      if (isAuthError(error)) {
        throw error;
      }
      if (isNetworkLikeError(error)) {
        await notifyConnectionLost(error);
        const cachedRoot = rootCache || await readOfflineRoot().catch(() => null);
        if (cachedRoot) {
          const queuedCommands = queuedCommandsForCurrentAccount(await getQueuedCommands().catch(() => []));
          rememberRoot(applyQueuedWritesToRoot(cachedRoot, queuedCommands));
          return rootCache;
        }
        throw error;
      }
      enterDemoMode(error);
      return loadDemoRoot();
    }

    return rootCache;
  }

  function notifyOne(listener) {
    listener.callback(createSnapshot(valueAtPath(rootCache, listener.path)));
  }

  function notifyAll() {
    listeners.forEach((listener) => notifyOne(listener));
  }

  async function pollRoot({ retryIfBusy = false } = {}) {
    if (!listeners.size) {
      return;
    }
    if (typeof document !== "undefined" && document.hidden && !retryIfBusy) {
      return;
    }
    if (!retryIfBusy && (onlineWriteInProgress || offlineSyncing)) {
      return;
    }
    if (!retryIfBusy && stream && typeof EventSource !== "undefined" && stream.readyState === EventSource.OPEN && (Date.now() - lastPollAt) < 15000) {
      return;
    }
    if (polling) {
      pollAgainRequested = pollAgainRequested || retryIfBusy;
      return;
    }

    lastPollAt = Date.now();
    polling = true;
    const pollController = new AbortController();
    activePollController = pollController;
    const pollTimeout = window.setTimeout(() => pollController.abort(), 15000);
    try {
      const queuedCommands = queuedCommandsForCurrentAccount(await getQueuedCommands());
      if (queuedCommands.length) {
        if (authSession) {
          await flushOfflineQueue();
        }
        if (queuedCommandsForCurrentAccount(await getQueuedCommands()).length) {
          return;
        }
      }
      const root = demoMode ? readDemoRoot() : await request("/api/data", {
        signal: pollController.signal,
        headers: lastDataEtag ? { "If-None-Match": lastDataEtag } : {},
        allowNotModified: true,
      });
      if (root?.notModified) {
        consecutivePollFailures = 0;
        lastRootFetchedAt = Date.now();
        const pendingScoreDrafts = await withOfflineStore(OFFLINE_SCORE_DRAFT_STORE, "readonly", (store) => idbRequest(store.count())).catch(() => 0);
        if (lastOfflineStatus?.online === false || pendingScoreDrafts > 0) {
          await notifyConnectionRestored({ retryPending: true });
        }
        return;
      }
      consecutivePollFailures = 0;
      lastRootFetchedAt = Date.now();
      const latestQueuedCommands = queuedCommandsForCurrentAccount(await getQueuedCommands());
      const mergedRoot = applyQueuedWritesToRoot(root, latestQueuedCommands);
      const signature = signatureForRoot(mergedRoot);
      if (signature !== rootSignature) {
        rememberRoot(mergedRoot);
        notifyAll();
      }
      await notifyConnectionRestored({ retryPending: true });
      scheduleOfflineSync(500);
    } catch (error) {
      if (isAuthError(error)) {
        consecutivePollFailures = 0;
        clearAuthSession();
        notifyAuthRevoked();
      } else if (isNetworkLikeError(error)) {
        if (typeof document !== "undefined" && document.hidden) {
          return;
        }
        consecutivePollFailures += 1;
        if (consecutivePollFailures >= 3) {
          await notifyConnectionLost(error);
        } else {
          const retryDelayMs = consecutivePollFailures === 1 ? 1000 : 1800;
          window.setTimeout(() => {
            if (typeof document !== "undefined" && document.hidden) return;
            pollRoot({ retryIfBusy: true });
          }, retryDelayMs);
        }
      }
    } finally {
      window.clearTimeout(pollTimeout);
      if (activePollController === pollController) {
        activePollController = null;
      }
      polling = false;
      if (pollAgainRequested && listeners.size) {
        pollAgainRequested = false;
        window.setTimeout(() => pollRoot({ retryIfBusy: true }), 0);
      }
    }
  }

  function startPolling() {
    if (!pollTimer) {
      pollTimer = window.setInterval(pollRoot, POLL_INTERVAL_MS);
    }
  }

  function stopDataStream() {
    if (stream) {
      stream.close();
      stream = null;
    }
    if (streamRetryTimer) {
      window.clearTimeout(streamRetryTimer);
      streamRetryTimer = 0;
    }
  }

  function scheduleDataStreamReconnect() {
    if (streamRetryTimer || demoMode || !listeners.size || !authSession || typeof EventSource === "undefined") {
      return;
    }

    streamRetryTimer = window.setTimeout(() => {
      streamRetryTimer = 0;
      startDataStream();
    }, 5000);
  }

  function startDataStream() {
    if (stream || demoMode || !listeners.size || !authSession || typeof EventSource === "undefined") {
      return;
    }

    try {
      stream = new EventSource(buildUrl("/api/data/stream"), { withCredentials: true });
      stream.addEventListener("data-changed", (event) => {
        const detail = dataChangedEventDetails(event);
        const revision = Number(detail?.revision);
        if (consumeOwnDataWriteEvent(detail)) {
          rememberDataRevision(revision);
          return;
        }
        if (detail?.revision !== null && detail?.revision !== undefined
          && Number.isSafeInteger(revision) && lastDataRevision !== null && revision <= lastDataRevision) return;
        pollRoot({ retryIfBusy: true });
      });
      stream.addEventListener("session-revoked", () => {
        clearAuthSession();
        notifyAuthRevoked();
      });
      stream.onopen = () => {
        const shouldSkipInitialPoll = !streamHadError
          && Boolean(rootCache)
          && lastDataRevision !== null
          && (Date.now() - lastRootFetchedAt) < 5000;
        streamHadError = false;
        if (!shouldSkipInitialPoll) {
          pollRoot({ retryIfBusy: true });
        }
      };
      stream.onerror = () => {
        streamHadError = true;
        if (stream && typeof EventSource !== "undefined" && stream.readyState === EventSource.CLOSED) {
          stream.close();
          stream = null;
          scheduleDataStreamReconnect();
        }
        pollRoot({ retryIfBusy: true });
      };
    } catch (error) {
      scheduleDataStreamReconnect();
    }
  }

  async function write(operation, path, value, writeOptions = {}) {
    if (demoMode) {
      if (writeOptions.requireServerAcknowledgement === true) {
        throw new Error("Không thể xác nhận thao tác với máy chủ khi đang ở chế độ ngoại tuyến.");
      }
      return applyDemoWrite(operation, path, value);
    }

    const requiresServerAcknowledgement = writeOptions.requireServerAcknowledgement === true;
    let queuedCommands = queuedCommandsForCurrentAccount(await getQueuedCommands().catch(() => []));
    while ((writeOptions.scoreConflict || requiresServerAcknowledgement)
      && (offlineSyncing || onlineWriteInProgress || queuedCommands.length)) {
      try {
        await waitForQueuedWritesToDrain();
      } catch (waitError) {
        waitError.offlineDraftSaved = true;
        throw waitError;
      }
      queuedCommands = queuedCommandsForCurrentAccount(await getQueuedCommands().catch(() => []));
    }
    if (offlineSyncing || onlineWriteInProgress || queuedCommands.length) {
      if (requiresServerAcknowledgement) {
        throw new Error("Máy chủ chưa xác nhận thao tác. Hãy chờ đồng bộ hoàn tất hoặc kiểm tra kết nối rồi thử lại.");
      }
      return applyOfflineWrite(operation, path, value, writeOptions);
    }

    onlineWriteInProgress = true;
    let fallbackRoot = clone(rootCache);
    let entry = null;
    let ephemeralEntry = false;
    try {
      fallbackRoot = fallbackRoot || await readOfflineRoot() || {};
      try {
        entry = await stageOptimisticWrite(operation, path, value, writeOptions);
      } catch (storageError) {
        entry = {
          type: "data-write",
          id: `online-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          operation,
          path: path || "",
          value: clone(value),
          allowZoneManagerReassignment: writeOptions.allowZoneManagerReassignment === true,
          ...(writeOptions.scoreConflict ? { scoreConflict: clone(writeOptions.scoreConflict) } : {}),
        };
        ephemeralEntry = true;
        const localRoot = rootCache || clone(fallbackRoot) || {};
        rememberRoot(applyQueuedWritesToRoot(localRoot, [entry]), { signature: false, persist: false });
        if (writeOptions.suppressLocalNotification !== true) notifyAll();
      }
      await dispatchOfflineStatus({
        pending: await getOfflineQueueCount(),
        syncing: true,
        online: true,
        lastError: "",
      });
      const photoMap = await getPhotoMappings();
      const acknowledgement = await dataWriteRequest(entry, transformOfflinePhotoRefs(entry.value, photoMap));
      await acceptWriteAcknowledgement(acknowledgement);
      if (!ephemeralEntry) await deleteQueuedCommand(entry.id);
      await notifyConnectionRestored({ retryPending: true });
    } catch (error) {
      if (isAuthError(error)) {
        if (entry && !ephemeralEntry) await deleteQueuedCommand(entry.id);
        const pendingCommands = await getQueuedCommands();
        rememberRoot(applyQueuedWritesToRoot(fallbackRoot, pendingCommands));
        notifyAll();
        clearAuthSession();
        notifyAuthRevoked();
        await dispatchOfflineStatus({
          pending: await getOfflineQueueCount(),
          syncing: false,
          online: serverReachable,
          lastError: error.message,
        });
        throw error;
      }
      if (requiresServerAcknowledgement && isNetworkLikeError(error)) {
        if (entry && !ephemeralEntry) await deleteQueuedCommand(entry.id);
        if (entry) await restoreLocalRoot(fallbackRoot);
        await dispatchOfflineStatus({
          pending: await getOfflineQueueCount(),
          syncing: false,
          online: serverReachable,
          lastError: "Máy chủ chưa xác nhận thao tác.",
        });
        throw new Error("Máy chủ chưa xác nhận thao tác. Hãy tải lại danh sách và thử lại.", { cause: error });
      }
      if (!entry) {
        await dispatchOfflineStatus({
          pending: await getOfflineQueueCount(),
          syncing: false,
          online: serverReachable,
          lastError: error.message || "Không lưu được thay đổi trên thiết bị.",
        });
        throw error;
      }
      if (isNetworkLikeError(error)) {
        if (entry.scoreConflict) {
          if (!ephemeralEntry) await deleteQueuedCommand(entry.id);
          await restoreLocalRoot(fallbackRoot);
          error.offlineDraftSaved = true;
          throw error;
        }
        if (ephemeralEntry) {
          await restoreLocalRoot(fallbackRoot);
          await dispatchOfflineStatus({
            pending: await getOfflineQueueCount(),
            syncing: false,
            online: serverReachable,
            lastError: error.message || "Không thể lưu thay đổi khi máy chủ mất kết nối.",
          });
          throw error;
        }
        await notifyConnectionLost(error);
        return rootCache;
      }
      if (Number.isFinite(Number(error?.status))) {
        if (entry && !ephemeralEntry) await deleteQueuedCommand(entry.id);
        await restoreAfterRejectedWrite(fallbackRoot);
        await dispatchOfflineStatus({
          pending: await getOfflineQueueCount(),
          syncing: false,
          online: serverReachable,
          lastError: error.message,
        });
        throw error;
      }
      if (requiresServerAcknowledgement) {
        if (entry && !ephemeralEntry) await deleteQueuedCommand(entry.id);
        if (entry) await restoreAfterRejectedWrite(fallbackRoot);
        await dispatchOfflineStatus({
          pending: await getOfflineQueueCount(),
          syncing: false,
          online: serverReachable,
          lastError: "Máy chủ chưa xác nhận thao tác.",
        });
        throw new Error("Máy chủ chưa xác nhận thao tác. Hãy tải lại danh sách và thử lại.", { cause: error });
      }
      await notifyConnectionLost(error);
      return rootCache;
    } finally {
      onlineWriteInProgress = false;
      const pending = queuedCommandsForCurrentAccount(await getQueuedCommands().catch(() => [])).length;
      if (pending && authSession && !demoMode) scheduleOfflineSync(0);
    }

    return rootCache;
  }

  async function queuePhotoSave(photo) {
    const dataUrl = typeof photo?.dataUrl === "string" ? photo.dataUrl : "";
    await enqueueOfflineCommand({
      type: "photo-save",
      photo: clone(photo || {}),
      localSignature: signatureForText(dataUrl),
    });
    return { ...saveDemoPhoto(photo), queued: true };
  }

  async function queuePhotoDelete(photo) {
    await enqueueOfflineCommand({ type: "photo-delete", photo: clone(photo || {}) });
    return { ok: true, queued: true };
  }

  async function savePhoto(photo) {
    if (demoMode) {
      return saveDemoPhoto(photo);
    }
    return queuePhotoSave(photo);
  }

  async function deletePhoto(photo) {
    if (demoMode) {
      return { ok: true };
    }
    return queuePhotoDelete(photo);
  }

  function loadLocalCollectionPage(filters = {}) {
    const sourceRoot = rootCache || readDemoRoot() || {};
    let items = valueAtPath(sourceRoot, filters.collection);
    items = Array.isArray(items) ? [...items] : isPlainObject(items)
      ? Object.entries(items).map(([id, value]) => value && typeof value === "object" ? { id: value.id || id, ...value } : value)
      : [];
    const periods = valueAtPath(sourceRoot, "periods");
    const periodValues = Array.isArray(periods) ? periods : isPlainObject(periods) ? Object.values(periods) : [];
    const periodById = new Map(periodValues.map((period) => [String(period?.id || ""), period]));
    if (filters.periodId) items = items.filter((item) => String(item?.periodId || "") === String(filters.periodId));
    if (filters.areaId) items = items.filter((item) => String(item?.areaId || "") === String(filters.areaId));
    if (filters.status) items = items.filter((item) => String(item?.issueStatus || item?.status || "") === String(filters.status));
    if (filters.year || filters.month) {
      items = items.filter((item) => {
        const period = periodById.get(String(item?.periodId || ""));
        const rawDate = String(item?.inspectionDate || item?.issueDate || item?.date || item?.createdAt || "");
        const isoMatch = /^(\d{4})-(\d{1,2})/.exec(rawDate);
        const localMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(rawDate);
        let year = Number(isoMatch?.[1] || localMatch?.[3] || period?.year || 0);
        let month = Number(isoMatch?.[2] || localMatch?.[2] || period?.month || 0);
        if (filters.collection === "safetyRecords") {
          const explicitIssueDate = String(item?.issueDate || item?.date || "").trim();
          const isoIssueMatch = /^(\d{4})-(\d{1,2})/.exec(explicitIssueDate);
          const localIssueMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(explicitIssueDate);
          if (isoIssueMatch) {
            year = Number(isoIssueMatch[1]);
            month = Number(isoIssueMatch[2]);
          } else if (localIssueMatch) {
            year = Number(localIssueMatch[3]);
            month = Number(localIssueMatch[2]);
          } else if (Number.isInteger(Number(item?.issueMonth)) && Number(item.issueMonth) >= 1 && Number(item.issueMonth) <= 12) {
            month = Number(item.issueMonth);
            year = Number(item?.issueYear || period?.year || isoMatch?.[1] || localMatch?.[3] || 2026);
          }
        }
        return (!filters.year || year === Number(filters.year)) && (!filters.month || month === Number(filters.month));
      });
    }
    items.sort((left, right) => String(right?.inspectionDate || right?.issueDate || right?.date || right?.createdAt || right?.updatedAt || "")
      .localeCompare(String(left?.inspectionDate || left?.issueDate || left?.date || left?.createdAt || left?.updatedAt || "")));
    const page = Math.max(1, Math.trunc(Number(filters.page) || 1));
    const pageSize = Math.min(100, Math.max(1, Math.trunc(Number(filters.pageSize) || 50)));
    const total = items.length;
    return {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async function loadCollectionPage(filters = {}) {
    if (demoMode) return loadLocalCollectionPage(filters);
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== "") params.set(key, String(value));
    });
    const suffix = params.toString();
    try {
      return await request(`/api/data/page${suffix ? `?${suffix}` : ""}`);
    } catch (error) {
      if (isNetworkLikeError(error)) return loadLocalCollectionPage(filters);
      throw error;
    }
  }

  function ref(path = "") {
    return {
      async once(eventName) {
        if (eventName !== "value") {
          throw new Error(`LocalDataStore không hỗ trợ event "${eventName}".`);
        }

        const root = await loadRoot();
        return createSnapshot(valueAtPath(root, path));
      },

      set(value, options) {
        return write("set", path, value, options);
      },

      update(value, options) {
        return write("update", path, value, options);
      },

      remove(options) {
        return write("remove", path, null, options);
      },

      on(eventName, callback) {
        if (eventName !== "value") {
          throw new Error(`LocalDataStore không hỗ trợ event "${eventName}".`);
        }

        const listener = { path, callback };
        listeners.add(listener);
        startPolling();
        startDataStream();

        if (!rootSignature) {
          loadRoot()
            .then(() => notifyOne(listener))
            .catch(() => {});
        }

        return () => {
          listeners.delete(listener);
          if (!listeners.size) {
            stopDataStream();
          }
        };
      },
    };
  }

  function startOfflineSyncWatch() {
    const persistBeforePageLeave = () => {
      if (offlineRootPersistTimer) {
        window.clearTimeout(offlineRootPersistTimer);
        offlineRootPersistTimer = 0;
      }
      persistOfflineRoot(rootCache).catch(() => {});
    };
    window.addEventListener("offline", () => {
      // On internal factory Wi-Fi without Internet, Android may fire 'offline' while the LAN server is still reachable.
      // Verify actual LAN server reachability via pollRoot instead of falsely blocking writes.
      window.setTimeout(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        pollRoot({ retryIfBusy: true });
      }, 400);
    });
    window.addEventListener("pagehide", persistBeforePageLeave);
    window.addEventListener("online", () => {
      scheduleOfflineSync(0);
      pollRoot({ retryIfBusy: true });
    });
    const scheduleResumeReconnect = (forceRestartStream = false) => {
      if (resumeSettleTimer) {
        window.clearTimeout(resumeSettleTimer);
        resumeSettleTimer = 0;
      }
      consecutivePollFailures = 0;
      resumeSettleTimer = window.setTimeout(() => {
        resumeSettleTimer = 0;
        if (typeof document !== "undefined" && document.hidden) return;
        if (forceRestartStream) stopDataStream();
        startDataStream();
        scheduleOfflineSync(200);
        pollRoot({ retryIfBusy: true });
      }, 450);
    };
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        hiddenSince = Date.now();
        activePollController?.abort();
        persistBeforePageLeave();
        return;
      }
      const wasHiddenMs = hiddenSince ? (Date.now() - hiddenSince) : 0;
      hiddenSince = 0;
      scheduleResumeReconnect(wasHiddenMs >= 30000);
    });
    window.addEventListener("pageshow", (event) => {
      if (event?.persisted) {
        scheduleResumeReconnect(true);
      }
    });
    getOfflineQueueCount()
      .then((pending) => dispatchOfflineStatus({ pending, syncing: false, online: serverReachable }))
      .catch(() => {});
  }

  startOfflineSyncWatch();

  window.LocalDataStore = {
    ref,
    loadRoot,
    loadCollectionPage,
    login,
    logout,
    restoreSession,
    touchSession,
    setAuthSession,
    clearAuthSession,
    savePhoto,
    deletePhoto,
    flushOfflineQueue,
    getOfflineQueueCount,
    savePendingScoreDraft,
    getPendingScoreDrafts,
    removePendingScoreDraft,
    isDemoMode() {
      return demoMode;
    },
  };
})();
