"use strict";

const BODY_LIMIT_BYTES = 100 * 1024 * 1024;

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > BODY_LIMIT_BYTES) {
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
};