import assert from "node:assert/strict";
import { after, test } from "node:test";
import express from "express";
import multer from "multer";
import authRoutes from "../routes/auth.routes.js";
import { errorHandler } from "../middleware/error.middleware.js";
import { objectIdParam } from "../middleware/validate.middleware.js";
import protect from "../middleware/auth.middleware.js";
import upload from "../middleware/upload.middleware.js";

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use("/auth", authRoutes);
app.get("/ids/:id", objectIdParam("id"), (req, res) => res.json({ success: true }));
app.post("/duplicate", (req, res, next) => next({ code: 11000, keyPattern: { email: 1 } }));
app.get("/unexpected", (req, res, next) => next(new Error("private database detail")));
app.get("/upload-size", (req, res, next) => next(new multer.MulterError("LIMIT_FILE_SIZE")));
app.post("/upload-type", upload.single("video"), (req, res) => res.json({ success: true }));
app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));
app.use(errorHandler);

let server;
let baseUrl;
test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server?.close(resolve)));

const send = (path, init) => fetch(`${baseUrl}${path}`, init);
const json = (body) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

test("HTTP pipeline rejects invalid bodies and missing required fields", async () => {
  const invalid = await send("/auth/register", json({ name: {}, email: "bad", password: "x" }));
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).success, false);

  const missing = await send("/auth/register", json({ name: "A User", email: "user@example.com" }));
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).code, "VALIDATION_ERROR");
});

test("HTTP pipeline rejects invalid IDs, invalid JWTs, and duplicate emails", async () => {
  const id = await send("/ids/not-an-object-id");
  assert.equal(id.status, 400);
  assert.equal((await id.json()).code, "INVALID_ID");

  const jwt = await send("/auth/me", { headers: { authorization: "Bearer invalid-token" } });
  assert.equal(jwt.status, 401);
  assert.equal((await jwt.json()).code, "INVALID_TOKEN");

  const duplicate = await send("/duplicate", { method: "POST" });
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).code, "EMAIL_ALREADY_EXISTS");
});

test("HTTP pipeline normalizes upload and unexpected errors without leaking details", async () => {
  const tooLarge = await send("/upload-size");
  assert.equal(tooLarge.status, 413);
  assert.equal((await tooLarge.json()).code, "UPLOAD_TOO_LARGE");

  const unsupported = await send("/upload-type", {
    method: "POST",
    body: (() => { const data = new FormData(); data.append("video", new Blob(["plain text"], { type: "text/plain" }), "bad.txt"); return data; })(),
  });
  assert.equal(unsupported.status, 415);
  assert.equal((await unsupported.json()).code, "UNSUPPORTED_MEDIA_TYPE");

  const original = console.error;
  console.error = () => {};
  try {
    const unexpected = await send("/unexpected");
    const response = await unexpected.json();
    assert.equal(unexpected.status, 500);
    assert.equal(response.code, "INTERNAL_SERVER_ERROR");
    assert.equal(JSON.stringify(response).includes("private database detail"), false);
  } finally {
    console.error = original;
  }
});
