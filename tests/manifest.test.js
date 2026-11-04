"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "manifest.json"), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));

test("uses Manifest V3 with a narrowly scoped content script", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.content_scripts[0].matches, ["https://chatgpt.com/*"]);
  assert.deepEqual(manifest.permissions, ["storage"]);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.background.service_worker, "src/background.js");
  assert.equal(manifest.version, packageJson.version);
});

test("every declared extension resource exists", () => {
  const resources = [
    manifest.background.service_worker,
    ...manifest.content_scripts[0].css,
    ...manifest.content_scripts[0].js
  ];
  for (const resource of resources) {
    assert.equal(fs.existsSync(path.join(projectRoot, resource)), true, resource);
  }
});

test("production code does not call network APIs or private endpoints", () => {
  const files = [manifest.background.service_worker, ...manifest.content_scripts[0].js].map((file) =>
    fs.readFileSync(path.join(projectRoot, file), "utf8")
  ).join("\n");

  assert.doesNotMatch(files, /\bfetch\s*\(/);
  assert.doesNotMatch(files, /XMLHttpRequest/);
  assert.doesNotMatch(files, /\/backend-api\//);
});
