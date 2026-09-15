"use strict";

const { readJsonBody } = require("../http/request");
const { sendJson } = require("../http/response");

class DataController {
  constructor({ dataService }) {
    this.dataService = dataService;
  }

  handleHealth(request, response) {
    sendJson(response, 200, this.dataService.getHealth());
  }

  async handleRead(request, response, authContext) {
    sendJson(response, 200, await this.dataService.readData(authContext));
  }

  async handleWrite(request, response, authContext) {
    const command = await readJsonBody(request);
    sendJson(response, 200, await this.dataService.writeData(command, authContext));
  }

  async handleSavePhoto(request, response, authContext) {
    const photo = await readJsonBody(request);
    sendJson(response, 200, await this.dataService.savePhoto(photo, authContext));
  }

  async handleDeletePhoto(request, response, authContext) {
    const photo = await readJsonBody(request);
    sendJson(response, 200, await this.dataService.deletePhoto(photo, authContext));
  }

  async handleReadPhoto(request, response, requestUrl) {
    const photoPath = requestUrl.pathname.slice("/api/photos/".length);
    const photo = await this.dataService.readPhoto(photoPath);
    response.writeHead(200, {
      "Content-Type": photo.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    });
    response.end(photo.body);
  }
}

module.exports = {
  DataController,
};
