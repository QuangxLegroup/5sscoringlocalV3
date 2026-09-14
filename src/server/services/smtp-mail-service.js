"use strict";

const net = require("node:net");
const os = require("node:os");
const tls = require("node:tls");

const DEFAULT_TIMEOUT_MS = 30000;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "y", "on"].includes(String(value).trim().toLowerCase());
}

function getNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function sanitizeHeader(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

function sanitizeFilename(value) {
  return sanitizeHeader(value || "danh-gia-an-toan.xlsx").replace(/[\\/:*?"<>|]+/g, "-") || "danh-gia-an-toan.xlsx";
}

function encodeHeader(value) {
  const cleanValue = sanitizeHeader(value);
  if (!cleanValue) {
    return "";
  }

  return `=?UTF-8?B?${Buffer.from(cleanValue, "utf8").toString("base64")}?=`;
}

function normalizeEmail(value) {
  return sanitizeHeader(value).replace(/^mailto:/i, "");
}

function collectEmails(values) {
  const rawValues = Array.isArray(values) ? values : String(values || "").split(/[;,\s]+/);
  const emails = [];
  const seen = new Set();

  rawValues.forEach((value) => {
    const email = normalizeEmail(typeof value === "object" && value ? value.email : value);
    if (!email) {
      return;
    }

    if (!EMAIL_PATTERN.test(email)) {
      throw createHttpError(`Email không hợp lệ: ${email}`);
    }

    const key = email.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      emails.push(email);
    }
  });

  return emails;
}

function normalizeBase64(value) {
  const base64 = String(value || "").replace(/^data:[^;]+;base64,/i, "").replace(/\s+/g, "");
  if (!base64) {
    throw createHttpError("Thiếu file Excel đính kèm.");
  }

  if (!/^[a-z0-9+/]+={0,2}$/i.test(base64)) {
    throw createHttpError("File Excel đính kèm không hợp lệ.");
  }

  return base64;
}

function normalizeMailMessages(payload) {
  const defaultSubject = sanitizeHeader(payload.subject || "Báo cáo đánh giá an toàn");
  const defaultBody = String(payload.body || "File Excel báo cáo đánh giá an toàn được đính kèm trong email này.").trim();
  const defaultFilename = sanitizeFilename(payload.filename || "danh-gia-an-toan.xlsx");
  const defaultMimeType = sanitizeHeader(payload.attachmentMime || XLSX_MIME) || XLSX_MIME;
  const rawMessages = Array.isArray(payload.messages) && payload.messages.length
    ? payload.messages
    : [{
        recipients: payload.recipients,
        subject: defaultSubject,
        body: defaultBody,
        filename: defaultFilename,
        attachmentMime: defaultMimeType,
        attachmentBase64: payload.attachmentBase64,
      }];

  return rawMessages.map((message, index) => {
    const recipients = collectEmails(message.recipients || message.to || message.recipient || message.email);
    if (!recipients.length) {
      throw createHttpError(`Email báo cáo thứ ${index + 1} chưa có người nhận.`);
    }

    return {
      recipients,
      subject: sanitizeHeader(message.subject || defaultSubject),
      text: String(message.body || message.text || defaultBody).trim(),
      attachment: {
        filename: sanitizeFilename(message.filename || defaultFilename),
        mimeType: sanitizeHeader(message.attachmentMime || message.mimeType || defaultMimeType) || XLSX_MIME,
        base64: normalizeBase64(message.attachmentBase64 || message.attachment),
      },
    };
  });
}
function foldBase64(value) {
  return String(value || "").match(/.{1,76}/g)?.join("\r\n") || "";
}

function dotStuff(message) {
  return message.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}

function buildLocalName() {
  return sanitizeHeader(os.hostname()) || "localhost";
}

function buildMessageId() {
  const randomPart = Math.random().toString(36).slice(2);
  return `<${Date.now()}.${randomPart}@${buildLocalName()}>`;
}

function buildMimeMessage(config, mail) {
  const boundary = `----=_LeGroup5S_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const filename = sanitizeFilename(mail.attachment.filename);
  const encodedFilename = encodeURIComponent(filename).replace(/'/g, "%27");
  const textBody = String(mail.text || "").replace(/\r?\n/g, "\r\n");
  const fromName = sanitizeHeader(config.fromName);
  const fromHeader = fromName ? `${encodeHeader(fromName)} <${config.from}>` : `<${config.from}>`;

  return [
    `From: ${fromHeader}`,
    `To: ${mail.to.map((email) => `<${email}>`).join(", ")}`,
    `Subject: ${encodeHeader(mail.subject)}`,
    "MIME-Version: 1.0",
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${buildMessageId()}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    foldBase64(Buffer.from(textBody, "utf8").toString("base64")),
    "",
    `--${boundary}`,
    `Content-Type: ${mail.attachment.mimeType}; name="${filename}"`,
    `Content-Disposition: attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
    "Content-Transfer-Encoding: base64",
    "",
    foldBase64(mail.attachment.base64),
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

function isExpectedCode(code, expectedCodes) {
  const codes = Array.isArray(expectedCodes) ? expectedCodes : [expectedCodes];
  return codes.includes(code);
}

function connectSocket(config) {
  return new Promise((resolve, reject) => {
    const options = {
      host: config.host,
      port: config.port,
      servername: config.host,
      timeout: config.timeoutMs,
    };
    const socket = config.secure ? tls.connect(options) : net.createConnection(options);

    const cleanup = () => {
      socket.removeListener("connect", onConnect);
      socket.removeListener("secureConnect", onConnect);
      socket.removeListener("error", onError);
      socket.removeListener("timeout", onTimeout);
    };
    const onConnect = () => {
      cleanup();
      resolve(socket);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const onTimeout = () => {
      cleanup();
      socket.destroy();
      reject(createHttpError("Kết nối SMTP bị quá thời gian.", 504));
    };

    socket.once(config.secure ? "secureConnect" : "connect", onConnect);
    socket.once("error", onError);
    socket.once("timeout", onTimeout);
  });
}

class SmtpSession {
  constructor(socket, config) {
    this.config = config;
    this.buffer = "";
    this.lines = [];
    this.waiter = null;
    this.onData = (chunk) => this.handleData(chunk);
    this.onError = (error) => this.fail(error);
    this.onTimeout = () => this.fail(createHttpError("Kết nối SMTP bị quá thời gian.", 504));
    this.onClose = () => this.fail(createHttpError("Kết nối SMTP đã đóng trước khi gửi xong.", 502));
    this.attach(socket);
  }

  attach(socket) {
    this.socket = socket;
    this.socket.setEncoding("utf8");
    this.socket.setTimeout(this.config.timeoutMs);
    this.socket.on("data", this.onData);
    this.socket.on("error", this.onError);
    this.socket.on("timeout", this.onTimeout);
    this.socket.on("close", this.onClose);
  }

  detach() {
    this.socket.removeListener("data", this.onData);
    this.socket.removeListener("error", this.onError);
    this.socket.removeListener("timeout", this.onTimeout);
    this.socket.removeListener("close", this.onClose);
  }

  handleData(chunk) {
    this.buffer += chunk;
    let lineEnd = this.buffer.indexOf("\n");
    while (lineEnd >= 0) {
      const line = this.buffer.slice(0, lineEnd).replace(/\r$/, "");
      this.buffer = this.buffer.slice(lineEnd + 1);
      this.lines.push(line);
      lineEnd = this.buffer.indexOf("\n");
    }
    this.flush();
  }

  hasCompleteResponse() {
    if (!this.lines.length) {
      return false;
    }

    const firstCode = this.lines[0].slice(0, 3);
    const lastLine = this.lines[this.lines.length - 1];
    return /^\d{3} /.test(lastLine) && lastLine.slice(0, 3) === firstCode;
  }

  flush() {
    if (!this.waiter || !this.hasCompleteResponse()) {
      return;
    }

    const lines = this.lines.splice(0);
    const code = Number(lines[lines.length - 1].slice(0, 3));
    const message = lines.join("\n");
    const waiter = this.waiter;
    this.waiter = null;

    if (!isExpectedCode(code, waiter.expectedCodes)) {
      waiter.reject(createHttpError(`SMTP trả về lỗi ${code}: ${message}`, 502));
      return;
    }

    waiter.resolve({ code, message });
  }

  fail(error) {
    if (!this.waiter) {
      return;
    }

    const waiter = this.waiter;
    this.waiter = null;
    waiter.reject(error);
  }

  readResponse(expectedCodes) {
    if (this.waiter) {
      return Promise.reject(createHttpError("SMTP đang chờ phản hồi trước đó.", 500));
    }

    return new Promise((resolve, reject) => {
      this.waiter = { expectedCodes, resolve, reject };
      this.flush();
    });
  }

  sendLine(command, expectedCodes) {
    this.socket.write(`${command}\r\n`);
    return this.readResponse(expectedCodes);
  }

  sendData(message) {
    this.socket.write(`${dotStuff(message)}\r\n.\r\n`);
    return this.readResponse(250);
  }

  upgradeToTls() {
    this.detach();
    this.buffer = "";
    this.lines = [];

    return new Promise((resolve, reject) => {
      const secureSocket = tls.connect({ socket: this.socket, servername: this.config.host });
      const cleanup = () => {
        secureSocket.removeListener("secureConnect", onSecureConnect);
        secureSocket.removeListener("error", onError);
      };
      const onSecureConnect = () => {
        cleanup();
        this.attach(secureSocket);
        resolve();
      };
      const onError = (error) => {
        cleanup();
        reject(error);
      };

      secureSocket.once("secureConnect", onSecureConnect);
      secureSocket.once("error", onError);
    });
  }

  close() {
    this.detach();
    this.socket.end();
  }
}

class SmtpMailService {
  constructor({ env = process.env } = {}) {
    this.env = env;
  }

  getConfig() {
    const explicitPort = Number(this.env.SMTP_PORT);
    const secure = this.env.SMTP_SECURE === undefined || this.env.SMTP_SECURE === ""
      ? explicitPort === 465
      : getBoolean(this.env.SMTP_SECURE, false);

    return {
      host: sanitizeHeader(this.env.SMTP_HOST),
      port: getNumber(this.env.SMTP_PORT, secure ? 465 : 587),
      secure,
      requireTls: getBoolean(this.env.SMTP_REQUIRE_TLS, !secure),
      user: sanitizeHeader(this.env.SMTP_USER),
      pass: String(this.env.SMTP_PASS || ""),
      from: normalizeEmail(this.env.SMTP_FROM || this.env.MAIL_FROM || this.env.SMTP_USER),
      fromName: sanitizeHeader(this.env.SMTP_FROM_NAME || "LeGroup 5S"),
      timeoutMs: getNumber(this.env.SMTP_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    };
  }

  ensureConfigured(config) {
    if (!config.host || !config.from) {
      throw createHttpError("Chưa cấu hình SMTP để gửi mail. Hãy thiết lập SMTP_HOST, SMTP_PORT, SMTP_FROM và thông tin đăng nhập nếu server mail yêu cầu.");
    }

    if (!EMAIL_PATTERN.test(config.from)) {
      throw createHttpError(`SMTP_FROM không hợp lệ: ${config.from}`);
    }

    if ((config.user && !config.pass) || (!config.user && config.pass)) {
      throw createHttpError("SMTP_USER và SMTP_PASS cần được cấu hình cùng nhau.");
    }
  }

  async sendSafetyReport(payload) {
    const config = this.getConfig();
    this.ensureConfigured(config);

    const messages = normalizeMailMessages(payload);
    const sentRecipients = [];

    for (const message of messages) {
      for (const recipient of message.recipients) {
        await this.sendMail(config, {
          to: [recipient],
          subject: message.subject,
          text: message.text,
          attachment: message.attachment,
        });
        sentRecipients.push(recipient);
      }
    }

    return {
      sent: true,
      deliveryMode: "individual",
      recipients: sentRecipients,
      recipientCount: sentRecipients.length,
      messageCount: sentRecipients.length,
    };
  }

  async sendMail(config, mail) {
    const socket = await connectSocket(config);
    const session = new SmtpSession(socket, config);

    try {
      await session.readResponse(220);
      let ehlo = await session.sendLine(`EHLO ${buildLocalName()}`, 250);

      if (!config.secure && config.requireTls) {
        if (!/STARTTLS/i.test(ehlo.message)) {
          throw createHttpError("SMTP server không hỗ trợ STARTTLS. Có thể đặt SMTP_REQUIRE_TLS=false nếu server nội bộ cho phép gửi không mã hóa.", 502);
        }
        await session.sendLine("STARTTLS", 220);
        await session.upgradeToTls();
        ehlo = await session.sendLine(`EHLO ${buildLocalName()}`, 250);
      }

      if (config.user) {
        const authLine = ehlo.message;
        if (/AUTH[^\n]*PLAIN/i.test(authLine)) {
          const token = Buffer.from(`\0${config.user}\0${config.pass}`, "utf8").toString("base64");
          await session.sendLine(`AUTH PLAIN ${token}`, 235);
        } else {
          await session.sendLine("AUTH LOGIN", 334);
          await session.sendLine(Buffer.from(config.user, "utf8").toString("base64"), 334);
          await session.sendLine(Buffer.from(config.pass, "utf8").toString("base64"), 235);
        }
      }

      await session.sendLine(`MAIL FROM:<${config.from}>`, 250);
      for (const email of mail.to) {
        await session.sendLine(`RCPT TO:<${email}>`, [250, 251]);
      }
      await session.sendLine("DATA", 354);
      await session.sendData(buildMimeMessage(config, mail));
      await session.sendLine("QUIT", 221).catch(() => {});
    } finally {
      session.close();
    }
  }
}

module.exports = {
  SmtpMailService,
};