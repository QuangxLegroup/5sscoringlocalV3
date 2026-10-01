"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { Readable } = require("node:stream");
const { AuthController } = require("../src/server/controllers/auth-controller");
const { DataController } = require("../src/server/controllers/data-controller");
const { sendError } = require("../src/server/http/response");
const { StaticFileService } = require("../src/server/services/static-file-service");
const { AuthService, TOKEN_COOKIE_NAME } = require("../src/server/services/auth-service");

const rootDir = path.join(__dirname, "..");

function makeResponse() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    writeHead(statusCode) { this.statusCode = statusCode; },
    end(body) { this.body = body; },
  };
}

test("auth responses keep the session token only in the HttpOnly cookie", async () => {
  const token = "test-session-secret-token";
  let replacedSessionId = "";
  const authService = {
    async login() {
      return { token, sessionId: "session-id", replacedSessionId: "old-session", account: { id: "account-id", username: "tester" } };
    },
    async touchSession() {
      return { token, sessionId: "session-id", account: { id: "account-id", username: "tester" } };
    },
  };
  const controller = new AuthController({ authService, onSessionReplaced: (sessionId) => { replacedSessionId = sessionId; } });
  const request = Readable.from([Buffer.from(JSON.stringify({ username: "tester", password: "private" }))]);
  request.headers = {};
  request.socket = {};

  for (const action of [
    (response) => controller.handleLogin(request, response),
    (response) => controller.handleSession(request, response),
    (response) => controller.handleTouchSession(request, response),
  ]) {
    const response = makeResponse();
    await action(response);
    assert.match(response.headers["Set-Cookie"], /HttpOnly/);
    assert.match(response.headers["Set-Cookie"], new RegExp(encodeURIComponent(token)));
    assert.doesNotMatch(response.body, new RegExp(token));
    assert.doesNotMatch(response.body, /"token"\s*:/);
    assert.doesNotMatch(response.body, /replacedSessionId/);
  }
  assert.equal(replacedSessionId, "old-session");
});

test("logging in on a second device replaces the previous session and accepts the new one", async () => {
  let root = { accounts: [{ id: "account-id", username: "tester", password: "password" }] };
  const repository = {
    async updateRoot(mutator) {
      root = await mutator(root);
      return root;
    },
    async readRoot() { return root; },
  };
  const service = new AuthService({ repository, secret: "test-only-secret" });
  const first = await service.login("tester", "password");
  const second = await service.login("tester", "password");
  const requestFor = (token) => ({ headers: { cookie: `${TOKEN_COOKIE_NAME}=${encodeURIComponent(token)}` } });

  assert.equal(second.replacedSessionId, first.sessionId);
  await assert.rejects(service.authenticateRequest(requestFor(first.token)), (error) => error.statusCode === 401);
  const activeSession = await service.authenticateRequest(requestFor(second.token));
  assert.equal(activeSession.payload.sid, second.sessionId);
});

test("session replacement immediately closes only the previous device stream", () => {
  const controller = new DataController({ dataService: {} });
  const makeStream = (sessionId) => {
    const request = new EventEmitter();
    const response = {
      chunks: [],
      writableEnded: false,
      writeHead() {},
      write(chunk) { this.chunks.push(chunk); },
      end() { this.writableEnded = true; },
    };
    controller.handleStream(request, response, { payload: { sid: sessionId } });
    return { request, response };
  };
  const previous = makeStream("previous-session");
  const active = makeStream("active-session");

  controller.revokeSession("previous-session");

  assert.equal(previous.response.writableEnded, true);
  assert.match(previous.response.chunks.join(""), /event: session-revoked/);
  assert.equal(active.response.writableEnded, false);
  assert.equal(controller.streamClients.size, 1);
  active.request.emit("close");
});

test("public API errors hide internal details and expose only a reference ID", () => {
  const response = makeResponse();
  const error = new Error("private database password and stack details");
  sendError(response, error, "request-reference-123");

  assert.equal(response.statusCode, 500);
  assert.deepEqual(JSON.parse(response.body), {
    error: "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.",
    referenceId: "request-reference-123",
  });
  assert.doesNotMatch(response.body, /private database password|stack details/);
});

test("health responses do not expose internal filesystem paths", () => {
  const { DataService } = require("../src/server/services/data-service");
  const service = new DataService({ repository: { filePath: "private/data/root.json", dataDir: "private/data" } });
  assert.deepEqual(service.getHealth(), { ok: true });
});

test("static hosting does not expose environment, account, or server files", async () => {
  const service = new StaticFileService({ rootDir });
  for (const filePath of ["/.env", "/data/seed-accounts.json", "/src/server/services/auth-service.js"]) {
    const result = await service.getFile(filePath);
    assert.equal(result.statusCode, 403, `${filePath} must not be public`);
  }
});

test("sanitized account data never includes passwords or password hashes", () => {
  const service = new AuthService({ repository: {}, secret: "test-only-secret" });
  const root = service.sanitizeRoot({ accounts: {
    one: { id: "one", username: "user", password: "plain", passwordHash: "hash", passwordSalt: "salt" },
  } });
  assert.deepEqual(root.accounts.one, { id: "one", username: "user" });
});

test("authentication reads the session from cookies, not bearer headers", () => {
  const service = new AuthService({ repository: {}, secret: "test-only-secret" });
  assert.equal(service.extractToken({ headers: { authorization: "Bearer exposed-token", cookie: "" } }), "");
  assert.equal(service.extractToken({ headers: { cookie: `${TOKEN_COOKIE_NAME}=cookie-token` } }), "cookie-token");
});

test("browser code uses cookie sessions and does not emit debug logs", () => {
  const clientFiles = [
    "app.js",
    "modules/local-data-api.js",
    "modules/pages/mobile-prototype.js",
    "modules/pages/five-s-findings-page.js",
  ];
  const clientSource = clientFiles
    .map((file) => fs.readFileSync(path.join(rootDir, file), "utf8"))
    .join("\n");

  assert.doesNotMatch(clientSource, /Authorization\s*:\s*`Bearer\s/);
  assert.doesNotMatch(clientSource, /currentAuthToken|setAuthToken|clearAuthToken/);
  assert.doesNotMatch(clientSource, /console\.(?:log|debug|info|warn|error)\s*\(/);
  assert.match(clientSource, /delete session\.authToken/);
});
