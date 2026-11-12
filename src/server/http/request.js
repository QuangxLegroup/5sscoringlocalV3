"use strict";

const BODY_LIMIT_BYTES = 100 * 1024 * 1024;
const PHOTO_BODY_LIMIT_BYTES = 20 * 1024 * 1024;
const SMALL_BODY_LIMIT_BYTES = 64 * 1024;

async function readJsonBody(request, maxBytes = BODY_LIMIT_BYTES) {
  const limitBytes = Number.isFinite(Number(maxBytes)) && Number(maxBytes) > 0
    ? Number(maxBytes)
    : BODY_LIMIT_BYTES;
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > limitBytes) {
      const error = new Error("Dữ liệu gửi lên quá lớn.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (parseError) {
    const error = new Error("JSON không hợp lệ.");
    error.statusCode = 400;
    throw error;
  }
}

module.exports = {
  readJsonBody,
  BODY_LIMIT_BYTES,
  PHOTO_BODY_LIMIT_BYTES,
  SMALL_BODY_LIMIT_BYTES,
};