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

class AuthController {
  constructor({ authService }) {
    this.authService = authService;
  }

  async handleLogin(request, response) {
    const credentials = await readJsonBody(request);
    const payload = await this.authService.login(credentials.username, credentials.password);
    response.setHeader("Set-Cookie", sessionCookie(payload.token, request));
    sendJson(response, 200, payload);
  }

  async handleSession(request, response) {
    const payload = await this.authService.touchSession(request, { includeRoot: true });
    response.setHeader("Set-Cookie", sessionCookie(payload.token, request));
    sendJson(response, 200, payload);
  }

  async handleTouchSession(request, response) {
    const payload = await this.authService.touchSession(request, { includeRoot: false });
    response.setHeader("Set-Cookie", sessionCookie(payload.token, request));
    sendJson(response, 200, payload);
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
