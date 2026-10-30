"use strict";

const { readJsonBody } = require("../http/request");
const { sendJson } = require("../http/response");

function pathParts(path) {
  return String(path || "").split("/").map((part) => part.trim()).filter(Boolean);
}

function valueAtPath(root, path) {
  let value = root;
  for (const part of pathParts(path)) {
    if (Array.isArray(value)) value = value.find((item) => String(item?.id || "") === part);
    else value = value && typeof value === "object" ? value[part] : undefined;
    if (value === undefined || value === null) return value ?? null;
  }
  return value;
}

function writeChanges(command) {
  const operation = String(command?.operation || "");
  const baseParts = pathParts(command?.path);
  if (operation === "update" && baseParts.length < 2 && command.value && typeof command.value === "object" && !Array.isArray(command.value)) {
    return Object.entries(command.value).map(([childPath, value]) => ({
      path: [...baseParts, ...pathParts(childPath)].join("/"),
      removed: value === null,
    }));
  }
  if (!baseParts.length) return [];
  return [{ path: baseParts.join("/"), removed: operation === "remove" }];
}

function collectAppliedChanges(command, root) {
  const recordPaths = writeChanges(command).filter((change) => pathParts(change.path).length > 1);
  if (!recordPaths.length || recordPaths.length > 100) return [];

  const applied = recordPaths.map((change) => ({
    ...change,
    ...(!change.removed ? { value: valueAtPath(root, change.path) } : {}),
  }));
  return Buffer.byteLength(JSON.stringify(applied), "utf8") <= 65536 ? applied : [];
}

function requiresRootReload(command, applied) {
  const changes = writeChanges(command);
  return !changes.length
    || changes.some((change) => pathParts(change.path).length < 2)
    || changes.length > 100
    || applied.length !== changes.length;
}

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
    const revision = authContext?.revision ?? await this.dataService.getDataRevision();
    const etag = revision === null || revision === undefined ? "" : `"root-${revision}"`;
    const requestedTags = String(request.headers["if-none-match"] || "").split(",").map((tag) => tag.trim());
    if (etag && requestedTags.includes(etag)) {
      response.writeHead(304, { "Cache-Control": "no-store", ETag: etag });
      response.end();
      return;
    }
    sendJson(response, 200, await this.dataService.readData(authContext), etag ? { ETag: etag } : {});
  }

  async handleReadPage(request, response, authContext, requestUrl) {
    const page = await this.dataService.readCollectionPage({
      collection: requestUrl.searchParams.get("collection"),
      page: requestUrl.searchParams.get("page"),
      pageSize: requestUrl.searchParams.get("pageSize"),
      periodId: requestUrl.searchParams.get("periodId"),
      year: requestUrl.searchParams.get("year"),
      month: requestUrl.searchParams.get("month"),
      areaId: requestUrl.searchParams.get("areaId"),
      status: requestUrl.searchParams.get("status"),
    }, authContext);
    sendJson(response, 200, page);
  }

  async handleWrite(request, response, authContext) {
    const command = await readJsonBody(request);
    const result = await this.dataService.writeData(command, authContext, { includeRevision: true });
    const hasRoot = result && Object.prototype.hasOwnProperty.call(result, "root");
    const root = hasRoot ? result.root : null;
    const revision = result && Object.prototype.hasOwnProperty.call(result, "revision")
      ? result.revision
      : await this.dataService.getDataRevision();
    const applied = Array.isArray(result?.applied) ? result.applied : collectAppliedChanges(command, root);
    const reloadRequired = typeof result?.reloadRequired === "boolean"
      ? result.reloadRequired
      : requiresRootReload(command, applied);
    sendJson(response, 200, {
      ok: true,
      commandId: String(command.commandId || ""),
      revision,
      applied,
      reloadRequired,
    });
    this.notifyDataChanged(command.commandId, revision);
  }

  handleStream(request, response, authContext = null) {
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });
    response.write(`event: ready\ndata: ${Date.now()}\n\n`);

    const client = { response, sessionId: String(authContext?.payload?.sid || "") };
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
    client.revoke = () => {
      if (closed) return;
      try {
        const message = "Phiên đăng nhập đã hết hạn hoặc bị thay đổi. Vui lòng đăng nhập lại.";
        response.write(`event: session-revoked\ndata: ${JSON.stringify({ message })}\n\n`);
        response.end();
      } catch (_) {
        // The client is already gone.
      } finally {
        closeClient();
      }
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
          if (status !== 401) {
            return;
          }
          try {
            const message = "Phiên đăng nhập đã hết hạn hoặc bị thay đổi. Vui lòng đăng nhập lại.";
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

  revokeSession(sessionId) {
    const targetSessionId = String(sessionId || "");
    if (!targetSessionId) return;
    for (const client of this.streamClients) {
      if (client.sessionId === targetSessionId) {
        client.revoke?.();
      }
    }
  }

  notifyDataChanged(commandId = "", revision = null) {
    const data = JSON.stringify({ timestamp: Date.now(), commandId: String(commandId || ""), revision });
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
    const photo = await this.dataService.readPhoto(photoPath, requestUrl.searchParams.get("size"));
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
