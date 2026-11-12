"use strict";

const { readJsonBody, PHOTO_BODY_LIMIT_BYTES } = require("../http/request");
const { sendJson } = require("../http/response");

class MailController {
  constructor({ mailService }) {
    this.mailService = mailService;
  }

  async handleSendSafetyReport(request, response) {
    const payload = await readJsonBody(request, PHOTO_BODY_LIMIT_BYTES);
    sendJson(response, 200, await this.mailService.sendSafetyReport(payload));
  }
}

module.exports = {
  MailController,
};