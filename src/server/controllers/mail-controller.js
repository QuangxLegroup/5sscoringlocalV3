"use strict";

const { readJsonBody } = require("../http/request");
const { sendJson } = require("../http/response");

class MailController {
  constructor({ mailService }) {
    this.mailService = mailService;
  }

  async handleSendSafetyReport(request, response) {
    const payload = await readJsonBody(request);
    sendJson(response, 200, await this.mailService.sendSafetyReport(payload));
  }
}

module.exports = {
  MailController,
};