(() => {
  "use strict";

  const API_ROOT = window.LOCAL_DATA_API_ROOT || "";
  const POLL_INTERVAL_MS = 5000;
  const DEMO_STORAGE_KEY = "legroup-5s-demo-data";
  const OFFLINE_DB_NAME = "legroup-5s-offline";
  const OFFLINE_DB_VERSION = 1;
  const OFFLINE_QUEUE_STORE = "queue";
  const OFFLINE_META_STORE = "meta";
  const OFFLINE_PHOTO_STORE = "photoMap";
  const OFFLINE_ROOT_KEY = "root";
  const OFFLINE_SYNC_INTERVAL_MS = 12000;
  const VOLATILE_ACCOUNT_FIELDS = new Set([
    "activeSessionId",
    "activeSessionAt",
    "activeSessionExpiresAt",
    "activeSessionStartedAt",
  ]);

  let rootCache = null;
  let rootSignature = "";
  let lastResponseSignature = "";
  let pollTimer = 0;
  let stream = null;
  let streamRetryTimer = 0;
  let polling = false;
  let offlineSyncing = false;
  let offlineSyncTimer = 0;
  let lastOfflineStatus = null;
  let offlineDbPromise = null;
  let demoMode = window.location.protocol === "file:";
  let authToken = "";
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
      console.warn("Không đọc được dữ liệu demo trong trình duyệt:", error);
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
    } catch (error) {
      console.warn("Không lưu được dữ liệu demo trong trình duyệt:", error);
    }
  }

  function loadDemoRoot() {
    rememberRoot(readDemoRoot());
    return rootCache;
  }

  function enterDemoMode(error) {
    if (window.location.protocol !== "file:") {
      console.warn("Không kết nối được API nội bộ; không chuyển sang demo để tránh tách dữ liệu:", error);
      const apiError = new Error("Không kết nối được dữ liệu nội bộ. Vui lòng kiểm tra server/Docker đang chạy và mở đúng địa chỉ web.");
      apiError.cause = error;
      apiError.status = error?.status;
      throw apiError;
    }

    if (!demoMode) {
      console.warn("Không có API nội bộ, chuyển sang chế độ demo trong trình duyệt:", error);
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

  async function applyOfflineWrite(operation, path, value) {
    const currentRoot = clone(rootCache) || await readOfflineRoot() || {};
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
    await persistOfflineRoot(rootCache);
    await enqueueOfflineCommand({
      type: "data-write",
      operation,
      path: path || "",
      value: clone(value),
    });
    notifyAll();
    return rootCache;
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

  function signatureForRoot(root) {
    return signatureForText(JSON.stringify(root && typeof root === "object" ? root : null, (key, value) => (
      VOLATILE_ACCOUNT_FIELDS.has(key) ? undefined : value
    )));
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
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Không mở được bộ nhớ offline."));
        request.onblocked = () => reject(new Error("Bộ nhớ offline đang bị khóa bởi tab khác."));
      }).catch((error) => {
        offlineDbPromise = null;
        console.warn("Không mở được IndexedDB để lưu offline:", error);
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
      store.put({ key: OFFLINE_ROOT_KEY, value: clone(root), savedAt: new Date().toISOString() });
    });
  }

  async function readOfflineRoot() {
    const entry = await withOfflineStore(OFFLINE_META_STORE, "readonly", (store) => idbRequest(store.get(OFFLINE_ROOT_KEY)));
    return isPlainObject(entry?.value) ? entry.value : null;
  }

  async function getQueuedCommands() {
    const entries = await withOfflineStore(OFFLINE_QUEUE_STORE, "readonly", (store) => idbRequest(store.getAll()));
    return (Array.isArray(entries) ? entries : []).sort((a, b) => {
      const left = String(a?.createdAt || "");
      const right = String(b?.createdAt || "");
      return left.localeCompare(right) || String(a?.id || "").localeCompare(String(b?.id || ""));
    });
  }

  async function getOfflineQueueCount() {
    const entries = await getQueuedCommands();
    return entries.length;
  }

  async function enqueueOfflineCommand(command) {
    const entry = {
      ...command,
      id: command.id || `offline-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: command.createdAt || new Date().toISOString(),
    };
    const stored = await withOfflineStore(OFFLINE_QUEUE_STORE, "readwrite", (store) => {
      store.put(entry);
    });
    if (stored === null) {
      throw new Error("Trình duyệt không hỗ trợ bộ nhớ offline. Vui lòng dùng Chrome/Edge và thử lại.");
    }
    await dispatchOfflineStatus({ pending: await getOfflineQueueCount(), online: false });
    scheduleOfflineSync();
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
    if (!navigator.onLine) {
      return true;
    }
    if (!error.status) {
      return true;
    }
    return [502, 503, 504].includes(Number(error.status));
  }

  async function dispatchOfflineStatus(overrides = {}) {
    const pending = Number.isFinite(overrides.pending) ? overrides.pending : await getOfflineQueueCount();
    const detail = {
      pending,
      syncing: offlineSyncing,
      online: navigator.onLine,
      lastError: "",
      ...(lastOfflineStatus || {}),
      ...overrides,
      pending,
      syncing: overrides.syncing ?? offlineSyncing,
    };
    lastOfflineStatus = detail;
    try {
      window.dispatchEvent(new CustomEvent("local-data-sync-status", { detail }));
    } catch (error) {
      console.warn("Không phát được trạng thái đồng bộ offline:", error);
    }
    return detail;
  }

  function scheduleOfflineSync(delayMs = 0) {
    if (demoMode || offlineSyncing || !authToken) {
      return;
    }
    if (offlineSyncTimer) {
      window.clearTimeout(offlineSyncTimer);
    }
    offlineSyncTimer = window.setTimeout(() => {
      offlineSyncTimer = 0;
      flushOfflineQueue().catch((error) => {
        console.warn("Không đồng bộ được dữ liệu lưu tạm:", error);
      });
    }, delayMs);
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
    Object.entries(value).forEach(([key, itemValue]) => {
      if (key === "photoDataUrl" && mappedPhoto?.url) {
        next[key] = mappedPhoto.url;
      } else if (key === "photoName" && mappedPhoto?.fileName) {
        next[key] = mappedPhoto.fileName;
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

    return JSON.parse(text);
  }

  async function request(path, options = {}) {
    if (window.location.protocol === "file:") {
      throw new Error("Ứng dụng đang mở bằng file nên sẽ chạy chế độ demo trong trình duyệt.");
    }

    const response = await fetch(buildUrl(path), {
      ...options,
      credentials: options.credentials || "include",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(options.headers || {}),
      },
    });

    const payload = await readJsonResponse(response);
    if (!response.ok) {
      const error = new Error(payload?.error || `Lỗi dữ liệu nội bộ (${response.status})`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  function isAuthError(error) {
    return error?.status === 401 || error?.status === 403;
  }

  function readTokenPayload(token = authToken) {
    const encodedPayload = String(token || "").split(".")[0] || "";
    if (!encodedPayload) {
      return {};
    }

    try {
      const padded = encodedPayload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
      return JSON.parse(window.atob(padded));
    } catch (error) {
      console.warn("Không đọc được payload phiên đăng nhập offline:", error);
      return {};
    }
  }

  function buildOfflineAuthPayload(root) {
    const payload = readTokenPayload();
    return {
      token: authToken,
      root,
      offline: true,
      accountId: payload.sub || "",
      username: payload.username || "",
      sessionId: payload.sid || "",
    };
  }

  async function flushOfflineQueue() {
    if (demoMode || offlineSyncing || !authToken) {
      return false;
    }

    let entries = await getQueuedCommands();
    if (!entries.length) {
      await dispatchOfflineStatus({ pending: 0, online: navigator.onLine, syncing: false });
      return true;
    }

    offlineSyncing = true;
    await dispatchOfflineStatus({ pending: entries.length, syncing: true, online: navigator.onLine, lastError: "" });

    try {
      await request("/api/health");
      let photoMap = await getPhotoMappings();

      for (const entry of entries) {
        if (entry.type === "photo-save") {
          const signature = entry.localSignature || signatureForText(entry.photo?.dataUrl || "");
          if (!photoMap.has(signature)) {
            const savedPhoto = await request("/api/photos", {
              method: "POST",
              body: JSON.stringify(entry.photo || {}),
            });
            await savePhotoMapping(signature, savedPhoto);
            photoMap = await getPhotoMappings();
          }
        } else if (entry.type === "photo-delete") {
          await request("/api/photos/delete", {
            method: "POST",
            body: JSON.stringify(entry.photo || {}),
          });
        } else if (entry.type === "data-write") {
          const value = transformOfflinePhotoRefs(entry.value, photoMap);
          const root = await request("/api/data/write", {
            method: "POST",
            body: JSON.stringify({
              operation: entry.operation,
              path: entry.path || "",
              value,
            }),
          });
          rememberRoot(root);
        }

        await deleteQueuedCommand(entry.id);
        await dispatchOfflineStatus({ pending: await getOfflineQueueCount(), syncing: true, online: true, lastError: "" });
      }

      entries = await getQueuedCommands();
      if (!entries.length) {
        try {
          const root = await request("/api/data");
          rememberRoot(root);
          notifyAll();
        } catch (error) {
          if (isAuthError(error)) {
            throw error;
          }
          console.warn("Không tải lại được dữ liệu sau khi đồng bộ offline:", error);
        }
      }

      return true;
    } catch (error) {
      if (isAuthError(error)) {
        clearAuthToken();
        notifyAuthRevoked(error.message);
      }
      await dispatchOfflineStatus({
        pending: await getOfflineQueueCount(),
        syncing: false,
        online: false,
        lastError: error?.message || "Không đồng bộ được dữ liệu lưu tạm.",
      });
      return false;
    } finally {
      offlineSyncing = false;
      const pending = await getOfflineQueueCount();
      await dispatchOfflineStatus({ pending, syncing: false, online: navigator.onLine });
      if (pending && authToken && !demoMode) {
        scheduleOfflineSync(OFFLINE_SYNC_INTERVAL_MS);
      }
    }
  }

  function setAuthToken(token = "") {
    authToken = String(token || "");
    scheduleOfflineSync(500);
  }

  function clearAuthToken() {
    authToken = "";
    stopDataStream();
  }

  function notifyAuthRevoked(message = "") {
    try {
      window.dispatchEvent(new CustomEvent("local-data-auth-revoked", {
        detail: { message: message || "Phiên đăng nhập đã bị thay thế." },
      }));
    } catch (error) {
      console.warn("Không phát được sự kiện phiên đăng nhập bị thay thế:", error);
    }
  }

  function applyAuthPayload(payload) {
    setAuthToken(payload?.token || authToken);
    if (payload?.root) {
      rememberRoot(payload.root, lastResponseSignature);
      notifyAll();
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
        token: "demo",
        sessionId: `demo-${Date.now()}`,
        sessionStartedAt: new Date().toISOString(),
        account,
        root,
      };
      return applyAuthPayload(payload);
    }

    try {
      return applyAuthPayload(await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }));
    } catch (error) {
      if (isAuthError(error) || error.status === 409) {
        throw error;
      }
      enterDemoMode(error);
      return login(username, password);
    }
  }

  async function restoreSession(token = "") {
    setAuthToken(token);
    if (demoMode) {
      return {
        token: authToken,
        root: loadDemoRoot(),
      };
    }

    try {
      return applyAuthPayload(await request("/api/auth/session"));
    } catch (error) {
      if (!isAuthError(error) && isNetworkLikeError(error)) {
        const root = await readOfflineRoot();
        if (root) {
          rememberRoot(root);
          await dispatchOfflineStatus({ pending: await getOfflineQueueCount(), online: false, lastError: error?.message || "" });
          return buildOfflineAuthPayload(root);
        }
      }
      clearAuthToken();
      throw error;
    }
  }

  async function touchSession() {
    if (demoMode) {
      return {
        token: authToken,
        root: rootCache || loadDemoRoot(),
      };
    }

    try {
      return applyAuthPayload(await request("/api/auth/session/touch", { method: "POST" }));
    } catch (error) {
      if (!isAuthError(error) && isNetworkLikeError(error)) {
        const root = rootCache || await readOfflineRoot();
        await dispatchOfflineStatus({ pending: await getOfflineQueueCount(), online: false, lastError: error?.message || "" });
        return buildOfflineAuthPayload(root);
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
      clearAuthToken();
    }
  }

  function rememberRoot(root) {
    rootCache = root && typeof root === "object" ? root : null;
    rootSignature = signatureForRoot(rootCache);
    persistOfflineRoot(rootCache).catch((error) => {
      console.warn("Không lưu được cache offline:", error);
    });
  }

  async function loadRoot() {
    if (demoMode) {
      return loadDemoRoot();
    }

    try {
      if (authToken && await getOfflineQueueCount()) {
        await flushOfflineQueue();
      }
      if (authToken && await getOfflineQueueCount()) {
        const cachedRoot = rootCache || await readOfflineRoot();
        if (cachedRoot) {
          rememberRoot(cachedRoot);
          return rootCache;
        }
      }
      const root = await request("/api/data");
      rememberRoot(root);
    } catch (error) {
      if (isAuthError(error)) {
        throw error;
      }
      if (isNetworkLikeError(error)) {
        const cachedRoot = await readOfflineRoot();
        if (cachedRoot) {
          rememberRoot(cachedRoot);
          await dispatchOfflineStatus({ pending: await getOfflineQueueCount(), online: false, lastError: error?.message || "" });
          scheduleOfflineSync(OFFLINE_SYNC_INTERVAL_MS);
          return rootCache;
        }
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

  async function pollRoot() {
    if (polling || !listeners.size) {
      return;
    }

    polling = true;
    try {
      if (!demoMode && authToken && await getOfflineQueueCount()) {
        await flushOfflineQueue();
        if (await getOfflineQueueCount()) {
          return;
        }
      }
      const root = demoMode ? readDemoRoot() : await request("/api/data");
      const signature = signatureForRoot(root);
      if (signature !== rootSignature) {
        rememberRoot(root);
        notifyAll();
      }
      scheduleOfflineSync(500);
    } catch (error) {
      if (isAuthError(error)) {
        clearAuthToken();
        notifyAuthRevoked(error.message);
      } else if (isNetworkLikeError(error)) {
        await dispatchOfflineStatus({ pending: await getOfflineQueueCount(), online: false, lastError: error?.message || "" });
      }
      console.warn("Không đồng bộ được dữ liệu nội bộ:", error);
    } finally {
      polling = false;
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
    if (streamRetryTimer || demoMode || !listeners.size || !authToken || typeof EventSource === "undefined") {
      return;
    }

    streamRetryTimer = window.setTimeout(() => {
      streamRetryTimer = 0;
      startDataStream();
    }, 5000);
  }

  function startDataStream() {
    if (stream || demoMode || !listeners.size || !authToken || typeof EventSource === "undefined") {
      return;
    }

    try {
      stream = new EventSource(buildUrl("/api/data/stream"), { withCredentials: true });
      stream.addEventListener("data-changed", () => {
        pollRoot();
      });
      stream.addEventListener("session-revoked", (event) => {
        let message = "";
        try {
          message = JSON.parse(event.data || "{}")?.message || "";
        } catch (error) {
          message = String(event.data || "");
        }
        clearAuthToken();
        notifyAuthRevoked(message);
      });
      stream.onerror = () => {
        stopDataStream();
        scheduleDataStreamReconnect();
      };
    } catch (error) {
      console.warn("Không mở được kênh đồng bộ tức thời:", error);
      scheduleDataStreamReconnect();
    }
  }

  async function write(operation, path, value) {
    if (demoMode) {
      return applyDemoWrite(operation, path, value);
    }

    try {
      const root = await request("/api/data/write", {
        method: "POST",
        body: JSON.stringify({ operation, path: path || "", value }),
      });
      rememberRoot(root);
    } catch (error) {
      if (isAuthError(error)) {
        throw error;
      }
      if (isNetworkLikeError(error)) {
        return applyOfflineWrite(operation, path, value);
      }
      enterDemoMode(error);
      return applyDemoWrite(operation, path, value);
    }

    notifyAll();
    return rootCache;
  }

  async function savePhoto(photo) {
    if (demoMode) {
      return saveDemoPhoto(photo);
    }

    try {
      return await request("/api/photos", {
        method: "POST",
        body: JSON.stringify(photo || {}),
      });
    } catch (error) {
      if (isAuthError(error)) {
        throw error;
      }
      if (isNetworkLikeError(error)) {
        const savedPhoto = saveDemoPhoto(photo);
        await enqueueOfflineCommand({
          type: "photo-save",
          photo: clone(photo || {}),
          localSignature: signatureForText(savedPhoto.url || ""),
        });
        return {
          ...savedPhoto,
          offline: true,
        };
      }
      enterDemoMode(error);
      return saveDemoPhoto(photo);
    }
  }

  async function deletePhoto(photo) {
    if (demoMode) {
      return { ok: true };
    }

    try {
      return await request("/api/photos/delete", {
        method: "POST",
        body: JSON.stringify(photo || {}),
      });
    } catch (error) {
      if (isAuthError(error)) {
        throw error;
      }
      if (isNetworkLikeError(error)) {
        const rawPath = String(photo?.path || photo?.url || "");
        if (rawPath.startsWith("/api/photos/") || rawPath.includes("/api/photos/")) {
          await enqueueOfflineCommand({
            type: "photo-delete",
            photo: clone(photo || {}),
          });
        }
        return { ok: true, offline: true };
      }
      enterDemoMode(error);
      return { ok: true };
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

      set(value) {
        return write("set", path, value);
      },

      update(value) {
        return write("update", path, value);
      },

      remove() {
        return write("remove", path);
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
            .catch((error) => console.warn("Không đọc được dữ liệu nội bộ:", error));
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
    window.addEventListener("online", () => {
      scheduleOfflineSync(500);
    });
    window.addEventListener("focus", () => {
      scheduleOfflineSync(500);
    });
    window.setInterval(() => {
      scheduleOfflineSync();
    }, OFFLINE_SYNC_INTERVAL_MS);
    getOfflineQueueCount()
      .then((pending) => dispatchOfflineStatus({ pending, syncing: false, online: navigator.onLine }))
      .catch((error) => console.warn("Không đọc được số lệnh offline:", error));
  }

  startOfflineSyncWatch();

  window.LocalDataStore = {
    ref,
    loadRoot,
    login,
    logout,
    restoreSession,
    touchSession,
    setAuthToken,
    clearAuthToken,
    savePhoto,
    deletePhoto,
    flushOfflineQueue,
    getOfflineQueueCount,
    isDemoMode() {
      return demoMode;
    },
  };
})();
