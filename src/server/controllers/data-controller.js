"use strict";

const { readJsonBody } = require("../http/request");
const { sendJson } = require("../http/response");

class DataController {
  constructor({ dataService, authService = null }) {
    this.dataService = dataService;
    this.authService = authService;
    this.streamClients = new Set();
  }

  handleHealth(request, response) {
    sendJson(response, 200, this.dataService.getHealth());
  }

  async handleRead(request, response, authContext) {
    sendJson(response, 200, await this.dataService.readData(authContext));
  }

  async handleWrite(request, response, authContext) {
    const command = await readJsonBody(request);
    const root = await this.dataService.writeData(command, authContext);
    sendJson(response, 200, root);
    this.notifyDataChanged();
  }

  handleStream(request, response) {
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });
    response.write(`event: ready\ndata: ${Date.now()}\n\n`);

    const client = { response };
    this.streamClients.add(client);
    let authCheckBusy = false;
    let closed = false;
    const closeClient = () => {
      if (closed) return;
      closed = true;
      clearInterval(keepAlive);
      clearInterval(authCheck);
      this.streamClients.delete(client);
    };
    const keepAlive = setInterval(() => {
      response.write(`event: ping\ndata: ${Date.now()}\n\n`);
    }, 25000);
    const authCheck = setInterval(() => {
      if (!this.authService || authCheckBusy || closed || response.writableEnded) {
        return;
      }
      authCheckBusy = true;
      this.authService.authenticateRequest(request)
        .catch((error) => {
          const status = Number(error?.statusCode || error?.status || 0);
          if (status !== 401 && status !== 403) {
            return;
          }
          try {
            const message = error?.message || "Phiên đăng nhập đã bị thay thế.";
            response.write(`event: session-revoked\ndata: ${JSON.stringify({ message })}\n\n`);
            response.end();
          } catch (writeError) {
            // The client is already gone.
          } finally {
            closeClient();
          }
        })
        .finally(() => {
          authCheckBusy = false;
        });
    }, 2000);

    request.on("close", () => {
      closeClient();
    });
  }

  notifyDataChanged() {
    const data = String(Date.now());
    for (const client of this.streamClients) {
      try {
        client.response.write(`event: data-changed\ndata: ${data}\n\n`);
      } catch (error) {
        this.streamClients.delete(client);
      }
    }
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
