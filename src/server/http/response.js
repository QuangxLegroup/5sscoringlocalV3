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

function sendError(response, error, referenceId = "") {
  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  const safeMessages = {
    400: "Dữ liệu gửi lên không hợp lệ. Vui lòng kiểm tra lại.",
    401: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
    403: "Bạn không có quyền thực hiện thao tác này.",
    404: "Không tìm thấy nội dung yêu cầu.",
    405: "Thao tác này không được hỗ trợ.",
    409: "Dữ liệu đã thay đổi hoặc bị xung đột. Vui lòng thử lại.",
    413: "Dữ liệu gửi lên vượt quá giới hạn cho phép.",
    429: "Có quá nhiều yêu cầu. Vui lòng thử lại sau.",
  };
  const payload = {
    error: statusCode >= 500
      ? "Hệ thống đang gặp sự cố. Vui lòng thử lại sau."
      : safeMessages[statusCode] || "Không thể thực hiện yêu cầu.",
  };
  if (statusCode === 409 && error.scoreConflict) {
    payload.scoreConflict = error.scoreConflict;
  }
  if (statusCode >= 500 && referenceId) {
    payload.referenceId = referenceId;
  }
  sendJson(response, statusCode, payload);
}

module.exports = {
  sendEmpty,
  sendError,
  sendJson,
};
