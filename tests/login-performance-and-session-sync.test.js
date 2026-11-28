"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { Readable } = require("node:stream");
const { AuthController } = require("../src/server/controllers/auth-controller");
const { AuthService, TOKEN_COOKIE_NAME } = require("../src/server/services/auth-service");
const { PostgresRepository } = require("../src/server/repositories/postgres-repository");

const rootDir = path.join(__dirname, "..");

function makeResponse() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = { ...this.headers, ...headers };
    },
    end(body) { this.body = body; },
  };
}

test("login verifies password outside updateRoot, returns revision/ETag, and uses targeted immutable account patch", async () => {
  const helperService = new AuthService({ repository: {}, secret: "test-secret" });
  const preparedAccount = helperService.prepareAccountForStorage({
    id: "acc-1",
    username: "tester",
    role: "assessor5s",
    active: true,
    password: "secret-password",
  });
  let root = {
    accounts: { "acc-1": preparedAccount },
    periods: { "p-1": { id: "p-1", year: 2026, month: 11, type: "5s" } },
    scores: { "s-1": { id: "s-1", score: 5 } },
    history: { "h-1": { id: "h-1", note: "admin-only" } },
  };
  let revision = 10;
  let readSnapshotCalls = 0;
  const updateCalls = [];
  const repository = {
    async readRootSnapshot(options = {}) {
      readSnapshotCalls += 1;
      assert.equal(options.cloneRoot, false);
      return { root, revision };
    },
    async updateRoot(mutator, options = {}) {
      updateCalls.push(options);
      root = await mutator(root);
      revision += 1;
      return options.includeRevision ? { root, revision } : root;
    },
  };

  const authService = new AuthService({ repository, secret: "test-secret" });

  // Wrong password must reject before acquiring updateRoot write lock.
  await assert.rejects(
    authService.login("tester", "wrong-password"),
    (error) => error.statusCode === 401,
  );
  assert.equal(readSnapshotCalls, 1);
  assert.equal(updateCalls.length, 0);

  const controller = new AuthController({ authService });
  const request = Readable.from([Buffer.from(JSON.stringify({ username: "tester", password: "secret-password" }))]);
  request.headers = {};
  request.socket = {};
  const response = makeResponse();

  await controller.handleLogin(request, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers.ETag, '"root-11"');
  assert.equal(updateCalls.length, 1);
  assert.equal(updateCalls[0].immutableMutator, true);
  assert.equal(updateCalls[0].includeRevision, true);
  assert.equal(updateCalls[0].cloneResult, false);
  assert.deepEqual(updateCalls[0].touchedRootKeys, ["accounts"]);
  assert.deepEqual(updateCalls[0].touchedRecords, { accounts: ["acc-1"] });
  assert.deepEqual(updateCalls[0].touchedRecordFields, {
    accounts: {
      "acc-1": ["activeSessionId", "activeSessionAt", "activeSessionExpiresAt", "activeSessionStartedAt"],
    },
  });

  const body = JSON.parse(response.body);
  assert.equal(body.revision, 11);
  assert.deepEqual(body.root.history, {});
  assert.equal(body.account.passwordHash, undefined);
});

test("touchSession skips database writes while session touch is fresh and patches only session fields when stale", async () => {
  const helperService = new AuthService({ repository: {}, secret: "test-secret" });
  const preparedAccount = helperService.prepareAccountForStorage({
    id: "acc-1",
    username: "admin",
    role: "admin",
    active: true,
    password: "admin-password",
  });
  let root = { accounts: { "acc-1": preparedAccount }, scores: { "s-1": { id: "s-1" } } };
  let revision = 5;
  let updateCount = 0;
  const updateOptions = [];
  const repository = {
    async readRootSnapshot() {
      return { root, revision };
    },
    async updateRoot(mutator, options = {}) {
      updateCount += 1;
      updateOptions.push(options);
      root = await mutator(root);
      revision += 1;
      if (options.compactResult) return { revision };
      return options.includeRevision ? { root, revision } : root;
    },
  };

  const authService = new AuthService({ repository, secret: "test-secret" });
  const loggedIn = await authService.login("admin", "admin-password");
  assert.equal(updateCount, 1);

  const authRequest = {
    headers: { cookie: `${TOKEN_COOKIE_NAME}=${encodeURIComponent(loggedIn.token)}` },
  };

  // Fresh touch (both with and without root) must NOT acquire updateRoot or bump revision.
  const freshWithRoot = await authService.touchSession(authRequest, { includeRoot: true });
  assert.equal(updateCount, 1);
  assert.equal(freshWithRoot.revision, 6);
  assert.ok(freshWithRoot.root);

  const freshCompact = await authService.touchSession(authRequest, { includeRoot: false });
  assert.equal(updateCount, 1);
  assert.equal(freshCompact.root, undefined);
  assert.equal(freshCompact.revision, 6);

  // Stale touch (> 5 minutes old) updates only the single account's session fields.
  root = {
    ...root,
    accounts: {
      "acc-1": {
        ...root.accounts["acc-1"],
        activeSessionAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      },
    },
  };
  const staleCompact = await authService.touchSession(authRequest, { includeRoot: false });
  assert.equal(updateCount, 2);
  assert.equal(staleCompact.revision, 7);
  assert.equal(staleCompact.root, undefined);
  assert.equal(updateOptions[1].compactResult, true);
  assert.equal(updateOptions[1].immutableMutator, true);
  assert.deepEqual(updateOptions[1].touchedRecords, { accounts: ["acc-1"] });
});

test("PostgresRepository.persistRootWithClient runs a single targeted UPDATE accounts for session-only updates", async () => {
  const repo = new PostgresRepository({ pool: { query: async () => ({ rows: [] }), on() {} } });
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push({ sql: String(sql).trim(), params });
      return { rows: [] };
    },
  };
  const previousRoot = {
    periods: { "p-1": { id: "p-1", settingsSnapshot: { areas: [{ id: "a1" }] } } },
    accounts: {
      "acc-1": { id: "acc-1", username: "tester", activeSessionId: "old" },
      "acc-2": { id: "acc-2", username: "other", activeSessionId: "other-sid" },
    },
  };
  const nextRoot = {
    ...previousRoot,
    accounts: {
      ...previousRoot.accounts,
      "acc-1": {
        ...previousRoot.accounts["acc-1"],
        activeSessionId: "new-sid",
        activeSessionAt: "2026-11-28T09:00:00.000Z",
        activeSessionExpiresAt: "2026-12-28T09:00:00.000Z",
        activeSessionStartedAt: "2026-11-28T09:00:00.000Z",
      },
    },
  };

  await repo.persistRootWithClient(
    client,
    previousRoot,
    nextRoot,
    ["accounts"],
    { accounts: ["acc-1"] },
    { accounts: { "acc-1": ["activeSessionId", "activeSessionAt", "activeSessionExpiresAt", "activeSessionStartedAt"] } },
  );

  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /^UPDATE accounts SET data = \(data - \$2::text\[\]\) \|\| \$3::jsonb WHERE id = \$1$/);
  assert.equal(queries[0].params[0], "acc-1");
  assert.deepEqual(JSON.parse(queries[0].params[2]), {
    activeSessionId: "new-sid",
    activeSessionAt: "2026-11-28T09:00:00.000Z",
    activeSessionExpiresAt: "2026-12-28T09:00:00.000Z",
    activeSessionStartedAt: "2026-11-28T09:00:00.000Z",
  });
});

test("sanitizeRoot avoids deep-cloning unrelated collections while stripping secrets and non-admin history", () => {
  const service = new AuthService({ repository: {}, secret: "test-secret" });
  const scores = { s1: { id: "s1", score: 4 } };
  const history = { h1: { id: "h1", note: "audit" } };
  const originalRoot = {
    scores,
    history,
    accounts: {
      one: { id: "one", username: "user", role: "assessor5s", passwordHash: "hash", password: "plain" },
    },
  };

  const nonAdminRoot = service.sanitizeRoot(originalRoot, { role: "assessor5s" });
  assert.equal(nonAdminRoot.scores, scores);
  assert.deepEqual(nonAdminRoot.history, {});
  assert.deepEqual(nonAdminRoot.accounts.one, { id: "one", username: "user", role: "assessor5s" });

  const adminRoot = service.sanitizeRoot(originalRoot, { role: "admin" });
  assert.equal(adminRoot.history, history);
  assert.equal(originalRoot.accounts.one.passwordHash, "hash");
});

test("local-data-api skips duplicate GET /api/data right after login and uses ETag after stream reconnect", async () => {
  const source = fs.readFileSync(path.join(rootDir, "modules", "local-data-api.js"), "utf8");
  const fetchCalls = [];
  const createdStreams = [];

  class FakeEventSource {
    constructor(url) {
      this.url = url;
      this.readyState = 1;
      this.listeners = new Map();
      createdStreams.push(this);
    }
    addEventListener(name, cb) {
      this.listeners.set(name, cb);
    }
    close() {
      this.readyState = 2;
    }
  }
  FakeEventSource.OPEN = 1;
  FakeEventSource.CLOSED = 2;

  const windowObj = {
    location: { protocol: "http:" },
    addEventListener() {},
    dispatchEvent() {},
    setTimeout,
    clearTimeout,
    setInterval: () => 1,
    clearInterval() {},
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    EventSource: FakeEventSource,
    fetch: async (url, options = {}) => {
      fetchCalls.push({ url, options });
      if (url === "/api/auth/login") {
        const body = JSON.stringify({
          sessionId: "sid-1",
          sessionStartedAt: "2026-11-28T09:00:00.000Z",
          revision: 42,
          account: { id: "acc-1", username: "tester", role: "admin" },
          root: { accounts: { "acc-1": { id: "acc-1", username: "tester", role: "admin", activeSessionId: "sid-1" } }, scores: {} },
        });
        return {
          ok: true,
          status: 200,
          headers: new Map([["etag", '"root-42"']]),
          async text() { return body; },
        };
      }
      if (url === "/api/data") {
        return {
          ok: true,
          status: 304,
          headers: new Map([["etag", '"root-42"']]),
          async text() { return ""; },
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    },
  };
  const context = vm.createContext({
    window: windowObj,
    document: { hidden: false, addEventListener() {} },
    fetch: windowObj.fetch,
    EventSource: FakeEventSource,
    AbortController,
    URLSearchParams,
    CustomEvent: windowObj.CustomEvent,
  });
  vm.runInContext(source, context);

  await windowObj.LocalDataStore.login("tester", "secret");
  const unsubscribe = windowObj.LocalDataStore.ref("").on("value", () => {});
  assert.equal(createdStreams.length, 1);

  // Initial stream.onopen right after login must NOT trigger a redundant GET /api/data.
  createdStreams[0].onopen();
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.deepEqual(fetchCalls.map((call) => call.url), ["/api/auth/login"]);

  // After a stream error + reconnect, stream.onopen polls with If-None-Match ETag.
  createdStreams[0].onerror();
  await new Promise((resolve) => setTimeout(resolve, 25));
  const dataCall = fetchCalls.find((call) => call.url === "/api/data");
  assert.ok(dataCall);
  assert.equal(dataCall.options.headers["If-None-Match"], '"root-42"');

  unsubscribe();
});

test("nginx enables gzip_proxied for API JSON and service worker skips cross-origin CDN requests", () => {
  const nginx = fs.readFileSync(path.join(rootDir, "docker", "nginx", "default.conf"), "utf8");
  const sw = fs.readFileSync(path.join(rootDir, "service-worker.js"), "utf8");
  assert.match(nginx, /gzip_proxied\s+any;/);
  assert.match(nginx, /location\s*=\s*\/api\/data\/stream/);
  assert.match(sw, /url\.origin !== self\.location\.origin/);
});
