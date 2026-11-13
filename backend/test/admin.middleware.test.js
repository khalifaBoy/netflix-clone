import assert from "node:assert/strict";
import { test } from "node:test";
import requireAdmin from "../middleware/admin.middleware.js";

const createResponse = () => {
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  return response;
};

test("returns 401 when no authenticated user is present", () => {
  const req = { body: { role: "admin" } };
  let forwardedError;

  requireAdmin(req, createResponse(), (error) => {
    forwardedError = error;
  });

  assert.equal(forwardedError.statusCode, 401);
  assert.equal(forwardedError.code, "UNAUTHORIZED");
});

test("returns 403 for an authenticated non-admin user", () => {
  const req = { user: { role: "user" }, body: { role: "admin" } };
  let forwardedError;

  requireAdmin(req, createResponse(), (error) => {
    forwardedError = error;
  });

  assert.equal(forwardedError.statusCode, 403);
  assert.equal(forwardedError.code, "FORBIDDEN");
});

test("continues for an authenticated admin user", () => {
  const req = { user: { role: "admin" } };
  const res = createResponse();
  let nextCalled = false;

  requireAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, null);
  assert.equal(nextCalled, true);
});
