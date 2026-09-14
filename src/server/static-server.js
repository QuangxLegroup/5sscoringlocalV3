"use strict";

const { createAppServer } = require("./app-server");

module.exports = {
  createAppServer,
  createStaticServer: createAppServer,
};