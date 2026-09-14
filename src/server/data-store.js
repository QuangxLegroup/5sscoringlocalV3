"use strict";

const { JsonFileRepository } = require("./repositories/json-file-repository");

module.exports = {
  JsonFileDataStore: JsonFileRepository,
  JsonFileRepository,
};