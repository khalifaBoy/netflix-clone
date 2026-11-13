import assert from "node:assert/strict";
import { test } from "node:test";
import multer from "multer";
import { errorHandler, normalizeError } from "../middleware/error.middleware.js";
import {
  objectIdParam,
  validateCreateMovie,
  validateMovieListQuery,
  validateRegistration,
} from "../middleware/validate.middleware.js";
import ApiError from "../utils/ApiError.js";
import movieRoutes from "../routes/movie.routes.js";

const response = () => ({
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
});

const runMiddleware = async (middleware, req) => {
  const res = response();
  let passedError;
  let nextCalled = false;
  await middleware(req, res, (error) => {
    passedError = error;
    nextCalled = !error;
  });
  return { res, passedError, nextCalled };
};

test("validates registration body and rejects malformed fields", async () => {
  const valid = await runMiddleware(validateRegistration, {
    body: { name: "A User", email: "user@example.com", password: "password123" },
  });
  assert.equal(valid.nextCalled, true);
  assert.equal(valid.passedError, undefined);

  const invalid = await runMiddleware(validateRegistration, {
    body: { name: {}, email: "bad-address", password: "short" },
  });
  assert.equal(invalid.passedError.statusCode, 400);
  assert.match(invalid.passedError.message, /Name must be a string/);
});

test("validates ObjectId route parameters", async () => {
  const valid = await runMiddleware(objectIdParam("movieId"), {
    params: { movieId: "507f1f77bcf86cd799439011" },
  });
  assert.equal(valid.nextCalled, true);

  const invalid = await runMiddleware(objectIdParam("movieId"), {
    params: { movieId: "not-an-object-id" },
  });
  assert.equal(invalid.passedError.code, "INVALID_ID");
  assert.equal(invalid.passedError.statusCode, 400);
});

test("validates pagination and multipart movie metadata", async () => {
  const validQuery = await runMiddleware(validateMovieListQuery, {
    query: { page: "1", limit: "20", isTop10: "false" },
  });
  assert.equal(validQuery.nextCalled, true);

  const invalidQuery = await runMiddleware(validateMovieListQuery, {
    query: { page: "NaN", limit: "0" },
  });
  assert.equal(invalidQuery.passedError.statusCode, 400);

  const invalidMovie = await runMiddleware(validateCreateMovie, {
    body: { title: "Test", description: "Test", year: "not-a-year" },
    file: { path: "/tmp/nonexistent-upload" },
  });
  assert.equal(invalidMovie.passedError.statusCode, 400);
});

test("maps parser and Multer errors and hides unexpected details", () => {
  assert.equal(normalizeError({ type: "entity.too.large" }).status, 413);
  assert.equal(normalizeError({ type: "entity.parse.failed" }).status, 400);
  assert.equal(normalizeError(new multer.MulterError("LIMIT_FILE_SIZE")).status, 413);

  const res = response();
  const internal = new Error("database password or stack detail");
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    errorHandler(internal, {}, res, (error) => {
      throw error;
    });
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { success: false, message: "Internal server error" });
  assert.equal(JSON.stringify(res.body).includes("database password"), false);

  const clientError = new ApiError(422, "BAD_INPUT", "Safe validation message");
  const clientRes = response();
  errorHandler(clientError, {}, clientRes, () => {});
  assert.equal(clientRes.statusCode, 422);
  assert.deepEqual(clientRes.body, { success: false, message: "Safe validation message" });
});

test("keeps movie read routes public and guards every catalog write route", () => {
  const findRoute = (path, method) => movieRoutes.stack
    .map((layer) => layer.route)
    .find((route) => route?.path === path && route.methods[method]);
  const middlewareNames = (route) => route.stack.map((layer) => layer.handle.name);

  for (const [path, method] of [["/", "post"], ["/:movieId", "patch"], ["/:movieId", "delete"]]) {
    const names = middlewareNames(findRoute(path, method));
    assert.ok(names.includes("protect"), `${method.toUpperCase()} ${path} requires authentication`);
    assert.ok(names.includes("requireAdmin"), `${method.toUpperCase()} ${path} requires admin role`);
    assert.ok(names.indexOf("protect") < names.indexOf("requireAdmin"));
  }

  for (const [path, method] of [["/", "get"], ["/:movieId", "get"]]) {
    assert.ok(!middlewareNames(findRoute(path, method)).includes("protect"));
  }
});
