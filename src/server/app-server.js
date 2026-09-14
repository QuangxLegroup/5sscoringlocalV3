"use strict";

const http = require("node:http");
const { URL } = require("node:url");
const { sendError, sendJson } = require("./http/response");

function normalizeAllowedOrigins(corsOrigin) {
  return String(corsOrigin || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getAllowedOrigin(request, allowedOrigins) {
  if (!allowedOrigins.length) {
    return "";
  }

  if (allowedOrigins.includes("*")) {
    return "*";
  }

  const requestOrigin = request.headers.origin || "";
  return allowedOrigins.includes(requestOrigin) ? requestOrigin : "";
}

function applyCorsHeaders(request, response, allowedOrigins) {
  const allowedOrigin = getAllowedOrigin(request, allowedOrigins);
  if (!allowedOrigin) {
    return;
  }

  response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (allowedOrigin !== "*") {
    response.setHeader("Access-Control-Allow-Credentials", "true");
  }
}

function createAppServer({ authController, authService, dataController, staticFileController, mailController, corsOrigin = "" }) {
  const allowedOrigins = normalizeAllowedOrigins(corsOrigin);

  return http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
      const isApiRequest = requestUrl.pathname.startsWith("/api/");

      if (isApiRequest) {
        applyCorsHeaders(request, response, allowedOrigins);
      }

      if (isApiRequest && request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }

      if (requestUrl.pathname === "/api/health" && request.method === "GET") {
        dataController.handleHealth(request, response);
        return;
      }

      if (requestUrl.pathname === "/api/auth/login" && request.method === "POST") {
        await authController.handleLogin(request, response);
        return;
      }

      if (requestUrl.pathname === "/api/auth/session" && request.method === "GET") {
        await authController.handleSession(request, response);
        return;
      }

      if (requestUrl.pathname === "/api/auth/session/touch" && request.method === "POST") {
        await authController.handleTouchSession(request, response);
        return;
      }

      if (requestUrl.pathname === "/api/auth/logout" && request.method === "POST") {
        await authController.handleLogout(request, response);
        return;
      }

      if (requestUrl.pathname === "/api/data" && request.method === "GET") {
        const authContext = await authService.authenticateRequest(request);
        await dataController.handleRead(request, response, authContext);
        return;
      }

      if (requestUrl.pathname === "/api/data/write" && request.method === "POST") {
        const authContext = await authService.authenticateRequest(request);
        await dataController.handleWrite(request, response, authContext);
        return;
      }

      if (requestUrl.pathname === "/api/photos" && request.method === "POST") {
        const authContext = await authService.authenticateRequest(request);
        await dataController.handleSavePhoto(request, response, authContext);
        return;
      }

      if (requestUrl.pathname.startsWith("/api/photos/") && request.method === "GET") {
        await authService.authenticateRequest(request);
        await dataController.handleReadPhoto(request, response, requestUrl);
        return;
      }

      if (requestUrl.pathname === "/api/send-safety-report" && request.method === "POST") {
        const authContext = await authService.authenticateRequest(request);
        authService.assertSafetyMailAllowed(authContext);
        await mailController.handleSendSafetyReport(request, response);
        return;
      }

      if (requestUrl.pathname.startsWith("/api/")) {
        sendJson(response, 404, { error: "API not found" });
        return;
      }

      await staticFileController.handle(request, response, requestUrl);
    } catch (error) {
      if (!error.statusCode || error.statusCode >= 500) {
        console.error(error);
      }
      sendError(response, error);
    }
  });
}

module.exports = {
  createAppServer,
};
