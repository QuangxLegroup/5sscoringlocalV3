"use strict";

const { readJsonBody } = require("../http/request");
const { sendJson } = require("../http/response");
const { TOKEN_COOKIE_NAME, SESSION_TTL_MS } = require("../services/auth-service");

function shouldUseSecureCookie(request) {
  return request.socket?.encrypted || String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";
}

function sessionCookie(token, request) {
  const secure = shouldUseSecureCookie(request) ? "; Secure" : "";
  return `${TOKEN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.ceil(SESSION_TTL_MS / 1000)}${secure}`;
}

function clearSessionCookie(request) {
  const secure = shouldUseSecureCookie(request) ? "; Secure" : "";
  return `${TOKEN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function sendSession(response, payload, request) {
  const { token, ...publicPayload } = payload;
  response.setHeader("Set-Cookie", sessionCookie(token, request));
  sendJson(response, 200, publicPayload);
}

class AuthController {
  constructor({ authService, onSessionReplaced = null }) {
    this.authService = authService;
    this.onSessionReplaced = onSessionReplaced;
  }

  async handleLogin(request, response) {
    const credentials = await readJsonBody(request);
    const payload = await this.authService.login(credentials.username, credentials.password);
    const { replacedSessionId, ...sessionPayload } = payload;
    if (replacedSessionId) {
      try {
        this.onSessionReplaced?.(replacedSessionId);
      } catch (_) {}
    }
    sendSession(response, sessionPayload, request);
  }

  async handleSession(request, response) {
    const payload = await this.authService.touchSession(request, { includeRoot: true });
    sendSession(response, payload, request);
  }

  async handleTouchSession(request, response) {
    const payload = await this.authService.touchSession(request, { includeRoot: false });
    sendSession(response, payload, request);
  }

  async handleLogout(request, response) {
    const payload = await this.authService.logout(request);
    response.setHeader("Set-Cookie", clearSessionCookie(request));
    sendJson(response, 200, payload);
  }
}

module.exports = {
  AuthController,
};
