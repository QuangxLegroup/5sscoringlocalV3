"use strict";

const { sendEmpty, sendJson } = require("../http/response");

class StaticFileController {
  constructor({ staticFileService }) {
    this.staticFileService = staticFileService;
  }

  async handle(request, response, requestUrl) {
    if (!["GET", "HEAD"].includes(request.method)) {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    const fileResult = await this.staticFileService.getFile(requestUrl.pathname);
    if (fileResult.statusCode !== 200) {
      sendEmpty(response, fileResult.statusCode);
      return;
    }

    response.writeHead(200, {
      "Content-Type": fileResult.contentType,
      "Cache-Control": "no-store",
    });

    response.end(request.method === "HEAD" ? undefined : fileResult.body);
  }
}

module.exports = {
  StaticFileController,
};