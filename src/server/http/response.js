"use strict";

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function sendEmpty(response, statusCode) {
  response.writeHead(statusCode);
  response.end();
}

function sendError(response, error) {
  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  sendJson(response, statusCode, { error: error.message || "Lỗi server dữ liệu nội bộ." });
}

module.exports = {
  sendEmpty,
  sendError,
  sendJson,
};