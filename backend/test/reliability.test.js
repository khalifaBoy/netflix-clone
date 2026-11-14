import assert from "node:assert/strict";
import { test } from "node:test";
import multer from "multer";
import { errorHandler, errorResponseContract, normalizeError } from "../middleware/error.middleware.js";
import {
  objectIdParam,
  validateCreateMovie,
  validateMovieListQuery,
  validateRegistration,
  validateUpdateMovie,
} from "../middleware/validate.middleware.js";
import ApiError from "../utils/ApiError.js";
import movieRoutes from "../routes/movie.routes.js";
import Movie from "../models/Movie.js";
import { createMovie } from "../controllers/movie.controller.js";
import { MAX_VIDEO_UPLOAD_BYTES } from "../middleware/upload.middleware.js";

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

test("validates optional admin durationSeconds as a positive bounded integer", async () => {
  const valid = await runMiddleware(validateUpdateMovie, { body: { durationSeconds: "5400" } });
  assert.equal(valid.nextCalled, true);

  for (const durationSeconds of [0, -1, 1.5, "1.5", "1e3", 86401]) {
    const invalid = await runMiddleware(validateUpdateMovie, { body: { durationSeconds } });
    assert.equal(invalid.passedError.statusCode, 400, String(durationSeconds));
  }

  const cleared = await runMiddleware(validateUpdateMovie, { body: { durationSeconds: null } });
  assert.equal(cleared.nextCalled, true);
});

test("caps uploaded movie files at 100 MiB", () => {
  assert.equal(MAX_VIDEO_UPLOAD_BYTES, 100 * 1024 * 1024);
});

test("accepts canonical maturity labels and rejects rating labels on movie uploads", async () => {
  const uploadBody = {
    title: "Test Movie",
    description: "A test movie",
    backdrop: "https://example.test/backdrop.jpg",
    poster: "https://example.test/poster.jpg",
    year: "2025",
    rating: "PG-13",
    duration: "1h 30m",
  };

  for (const maturityRating of ["All", "7+", "13+", "16+", "18+"]) {
    const result = await runMiddleware(validateCreateMovie, {
      body: { ...uploadBody, maturityRating },
      file: { path: "/tmp/test-movie-upload.mp4" },
    });
    assert.equal(result.nextCalled, true, maturityRating);
  }

  for (const maturityRating of ["PG-13", "R", "TV-14", "TV-MA", "unrated"]) {
    const invalid = await runMiddleware(validateCreateMovie, {
      body: { ...uploadBody, maturityRating },
      file: { path: "/tmp/test-movie-upload.mp4" },
    });
    assert.equal(invalid.passedError.statusCode, 400, maturityRating);
  }
});

test("defaults omitted upload maturity rating to 13+ in the movie creation controller", async () => {
  const result = await runMiddleware(validateCreateMovie, {
    body: {
      title: "Test Movie",
      description: "A test movie",
      backdrop: "https://example.test/backdrop.jpg",
      poster: "https://example.test/poster.jpg",
      year: "2025",
      rating: "PG-13",
      duration: "1h 30m",
    },
    file: { path: "/tmp/test-movie-upload.mp4" },
  });
  assert.equal(result.nextCalled, true);
  assert.equal(result.passedError, undefined);

  const originalCreate = Movie.create;
  let createdMovie;
  Movie.create = async (fields) => {
    createdMovie = fields;
    return fields;
  };
  const res = response();
  res.status = function status(code) {
    this.statusCode = code;
    return this;
  };
  try {
    await createMovie({
      body: {
        title: "Test Movie",
        description: "A test movie",
        year: "2025",
        rating: "PG-13",
        duration: "1h 30m",
      },
      file: { filename: "video-test.mp4" },
    }, res, (error) => { throw error; });
  } finally {
    Movie.create = originalCreate;
  }
  assert.equal(createdMovie.maturityRating, "13+");
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
  assert.deepEqual(res.body, {
    success: false,
    message: "Internal server error",
    code: "INTERNAL_SERVER_ERROR",
  });
  assert.equal(JSON.stringify(res.body).includes("database password"), false);

  const clientError = new ApiError(422, "BAD_INPUT", "Safe validation message");
  const clientRes = response();
  errorHandler(clientError, {}, clientRes, () => {});
  assert.equal(clientRes.statusCode, 422);
  assert.deepEqual(clientRes.body, {
    success: false,
    message: "Safe validation message",
    code: "BAD_INPUT",
  });
});

test("adds stable codes to existing direct controller error responses", () => {
  const res = response();
  res.status(404);
  errorResponseContract({}, res, () => {});
  res.json({ success: false, message: "Movie not found" });
  assert.deepEqual(res.body, {
    success: false,
    message: "Movie not found",
    code: "NOT_FOUND",
  });
});

test("requires an owned profile for movie reads and guards every catalog write route", () => {
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

  for (const [path, method] of [["/", "get"], ["/:movieId", "get"], ["/:movieId/views", "post"]]) {
    const names = middlewareNames(findRoute(path, method));
    assert.ok(names.includes("protect"), `${method.toUpperCase()} ${path} requires authentication`);
    assert.ok(names.includes("requireProfilePolicy"), `${method.toUpperCase()} ${path} resolves an owned profile policy`);
  }
});
