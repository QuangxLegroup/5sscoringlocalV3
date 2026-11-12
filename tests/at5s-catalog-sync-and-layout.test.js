"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("CSS: In 5S catalog grid, assessor is moved up to row 2 and at5s is moved down below heads", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");

  // Verify .catalog-at5s-panel has grid-area: at5s
  assert.match(css, /\.catalog-at5s-panel\s*\{\s*grid-area:\s*at5s;/, "catalog-at5s-panel must have grid-area: at5s");

  // Verify in 5S desktop grid:
  // Row 2: "employee assessor" (assessor moved up!)
  // Row 3: "people area"
  // Row 4: "heads area"
  // Row 5: "at5s area" (at5s moved down below heads!)
  assert.match(
    css,
    /#tab-catalog \.catalog-grid\s*\{[^}]*"period person"\s*"employee assessor"\s*"people area"\s*"heads area"\s*"at5s area"\s*"email safety"/,
    "In 5S catalog grid, assessor is on row 2 (up) and at5s is below heads (down)"
  );

  // Verify in is-safety-scope grid, at5s is directly below heads
  assert.match(
    css,
    /#tab-catalog \.catalog-grid\.is-safety-scope\s*\{[^}]*"heads area"\s*"at5s area"\s*"email safety"/,
    "In Safety catalog grid, at5s area must be directly below heads area"
  );

  // Verify mobile view has assessor up right after employee, and at5s down below heads
  assert.match(
    css,
    /"employee"\s*"assessor"\s*"people"\s*"heads"\s*"at5s"\s*"area"/,
    "In mobile catalog grid, assessor is moved up and at5s is down below heads"
  );
});

test("App: Ban AT - 5S logic and synchronization", () => {
  const appJs = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

  // Verify getCatalogArrays includes at5sMembers
  assert.match(appJs, /at5sMembers:\s*source\?\.at5sMembers\s*\|\|\s*state\?\.at5sMembers\s*\|\|\s*\[\]/, "getCatalogArrays must include at5sMembers");

  // Verify getAt5sMembers function exists
  assert.match(appJs, /function getAt5sMembers\(\)/, "getAt5sMembers function must exist");

  // Verify syncAt5sMemberToSnapshots function exists
  assert.match(appJs, /function syncAt5sMemberToSnapshots\(/, "syncAt5sMemberToSnapshots function must exist");

  // Verify renderAt5sMemberList uses getAt5sMembers()
  assert.match(appJs, /const members = getAt5sMembers\(\);/, "renderAt5sMemberList must retrieve synced getAt5sMembers()");

  // Verify deleteAt5sMember syncs snapshots
  assert.match(appJs, /syncAt5sMemberToSnapshots\(member,\s*true\);/, "deleteAt5sMember must sync removal to snapshots");

  // Verify updateCatalogPersonIdentity updates at5sMembers
  assert.match(appJs, /updates\[`at5sMembers\/\$\{member\.id\}`\] = member;/, "updateCatalogPersonIdentity must update at5sMembers");
});
