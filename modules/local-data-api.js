(() => {
  "use strict";

  const API_ROOT = window.LOCAL_DATA_API_ROOT || "";
  const POLL_INTERVAL_MS = 60000;
  const DEMO_STORAGE_KEY = "legroup-5s-demo-data";
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
  let polling = false;
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

  function setAuthToken(token = "") {
    authToken = String(token || "");
  }

  function clearAuthToken() {
    authToken = "";
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

    return applyAuthPayload(await request("/api/auth/session/touch", { method: "POST" }));
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
  }

  async function loadRoot() {
    if (demoMode) {
      return loadDemoRoot();
    }

    try {
      const root = await request("/api/data");
      rememberRoot(root);
    } catch (error) {
      if (isAuthError(error)) {
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

  async function pollRoot() {
    if (polling || !listeners.size) {
      return;
    }

    polling = true;
    try {
      const root = demoMode ? readDemoRoot() : await request("/api/data");
      const signature = signatureForRoot(root);
      if (signature !== rootSignature) {
        rememberRoot(root);
        notifyAll();
      }
    } catch (error) {
      if (isAuthError(error)) {
        clearAuthToken();
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

        if (!rootSignature) {
          loadRoot()
            .then(() => notifyOne(listener))
            .catch((error) => console.warn("Không đọc được dữ liệu nội bộ:", error));
        }

        return () => listeners.delete(listener);
      },
    };
  }

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
    isDemoMode() {
      return demoMode;
    },
  };
})();
