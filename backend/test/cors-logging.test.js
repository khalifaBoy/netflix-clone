import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { getAllowedFrontendOrigins } from "../config/cors.js";
import { errorHandler } from "../middleware/error.middleware.js";

process.env.NODE_ENV = "test";
process.env.FRONTEND_URL = "http://localhost:3000,https://netflix.example.test";
const { default: app } = await import("../src/app.js");

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test("CORS config requires an explicit production origin and rejects wildcard configuration", () => {
  assert.throws(() => getAllowedFrontendOrigins({ NODE_ENV: "production" }), /FRONTEND_URL/);
  assert.throws(() => getAllowedFrontendOrigins({ FRONTEND_URL: "*" }), /wildcard/);
  assert.deepEqual(
    [...getAllowedFrontendOrigins({ FRONTEND_URL: "http://localhost:3000, https://netflix.example.test" })],
    ["http://localhost:3000", "https://netflix.example.test"],
  );
  assert.deepEqual(
    [...getAllowedFrontendOrigins({ NODE_ENV: "development" })],
    ["http://localhost:3000"],
  );
});

test("CORS allows configured origins with credentials and rejects unapproved origins", async () => {
  const local = await fetch(`${baseUrl}/`, { headers: { Origin: "http://localhost:3000" } });
  assert.equal(local.status, 200);
  assert.equal(local.headers.get("access-control-allow-origin"), "http://localhost:3000");
  assert.equal(local.headers.get("access-control-allow-credentials"), "true");

  const production = await fetch(`${baseUrl}/`, { headers: { Origin: "https://netflix.example.test" } });
  assert.equal(production.status, 200);
  assert.equal(production.headers.get("access-control-allow-origin"), "https://netflix.example.test");

  const preflight = await fetch(`${baseUrl}/api/playback/sessions`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,content-type",
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-credentials"), "true");

  const rejected = await fetch(`${baseUrl}/`, { headers: { Origin: "https://attacker.example" } });
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get("access-control-allow-origin"), null);

  const rejectedPreflight = await fetch(`${baseUrl}/api/playback/sessions`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://attacker.example",
      "Access-Control-Request-Method": "POST",
    },
  });
  assert.equal(rejectedPreflight.status, 403);

  const noOrigin = await fetch(`${baseUrl}/`);
  assert.equal(noOrigin.status, 200);
  assert.equal(noOrigin.headers.get("access-control-allow-origin"), null);
});

test("application request logs redact playback and revocation credentials and omit authorization headers", async () => {
  const logs = [];
  const originalInfo = console.info;
  console.info = (message) => logs.push(String(message));
  const credential = "sensitive-playback-credential-value";
  const authorization = "Bearer sensitive-authorization-value";
  try {
    const response = await fetch(`${baseUrl}/api/playback/sessions/${credential}/media?secret=query-secret`, {
      headers: { Authorization: authorization },
    });
    assert.equal(response.status, 404);
    await response.text();
  } finally {
    console.info = originalInfo;
  }

  assert.equal(logs.length, 1);
  assert.equal(logs[0].includes(credential), false);
  assert.equal(logs[0].includes(authorization), false);
  assert.equal(logs[0].includes("query-secret"), false);
  const record = JSON.parse(logs[0]);
  assert.equal(record.method, "GET");
  assert.equal(record.path, "/api/playback/sessions/:sessionId/media");
  assert.equal(record.status, 404);
  assert.equal(typeof record.durationMs, "number");
  assert.ok(record.responseBytes > 0);
});

test("application request logs redact session identifiers on revocation paths too", async () => {
  const logs = [];
  const originalInfo = console.info;
  console.info = (message) => logs.push(String(message));
  const credential = "another-sensitive-playback-value";
  try {
    const response = await fetch(`${baseUrl}/api/playback/sessions/${credential}`, { method: "DELETE" });
    assert.equal(response.status, 401);
    await response.text();
  } finally {
    console.info = originalInfo;
  }

  assert.equal(logs.length, 1);
  assert.equal(logs[0].includes(credential), false);
  assert.equal(JSON.parse(logs[0]).path, "/api/playback/sessions/:sessionId");
});

test("development error logs redact playback URLs included in error messages and stacks", () => {
  const logs = [];
  const originalError = console.error;
  console.error = (...args) => logs.push(JSON.stringify(args));
  const credential = "error-log-playback-secret";
  try {
    errorHandler(new Error(`failed request at https://api.example.test/api/playback/sessions/${credential}/media`), {}, {
      status() { return this; },
      json() { return this; },
    }, () => {});
  } finally {
    console.error = originalError;
  }
  assert.equal(logs.length, 1);
  assert.equal(logs[0].includes(credential), false);
  assert.match(logs[0], /\/api\/playback\/sessions\/:sessionId\/media/);
});
