import assert from "node:assert/strict";
import { test } from "node:test";
import { validateTestDatabaseUri } from "./helpers/recommendation-test-db.js";

test("allows the dedicated local test database", () => {
  const result = validateTestDatabaseUri({
    MONGO_URI: "mongodb+srv://user:pass@production.example.mongodb.net",
    MONGO_TEST_URI: "mongodb://127.0.0.1:27018/netflix_clone_test",
  });
  assert.equal(result.target.databaseName, "netflix_clone_test");
});

test("rejects remote Atlas test databases so integration tests cannot use them", () => {
  assert.throws(
    () => validateTestDatabaseUri({
      MONGO_URI: "mongodb+srv://user:pass@production.example.mongodb.net/netflix_clone",
      MONGO_TEST_URI: "mongodb+srv://user:pass@test-project.example.mongodb.net/netflix_clone_test",
    }),
    /dedicated local MongoDB test service; remote databases are not allowed/,
  );
});

test("rejects a test database name that matches the production database", () => {
  assert.throws(
    () => validateTestDatabaseUri({
      MONGO_URI: "mongodb+srv://user:pass@cluster.example.mongodb.net/netflix_clone_test",
      MONGO_TEST_URI: "mongodb+srv://user:pass@cluster.example.mongodb.net/netflix_clone_test",
    }),
    /matches the effective production database/,
  );
});

test("rejects a missing MONGO_TEST_URI", () => {
  assert.throws(
    () => validateTestDatabaseUri({ MONGO_URI: "mongodb+srv://user:pass@production.example.mongodb.net/netflix_clone" }),
    /MONGO_TEST_URI is required; integration tests never fall back/,
  );
});

test("rejects a test URI without an explicit database name", () => {
  assert.throws(
    () => validateTestDatabaseUri({ MONGO_TEST_URI: "mongodb+srv://user:pass@cluster.example.mongodb.net" }),
    /must include an explicit database name/,
  );
});

test("rejects a test database name that does not contain test", () => {
  assert.throws(
    () => validateTestDatabaseUri({
      MONGO_URI: "mongodb+srv://user:pass@production.example.mongodb.net/netflix_clone",
      MONGO_TEST_URI: "mongodb+srv://user:pass@test-project.example.mongodb.net/netflix_clone_ci",
    }),
    /must explicitly contain 'test'/,
  );
});

test("uses the MongoDB driver default database when the production URI has no path", () => {
  assert.throws(
    () => validateTestDatabaseUri({
      MONGO_URI: "mongodb+srv://user:pass@production.example.mongodb.net",
      MONGO_TEST_URI: "mongodb+srv://user:pass@test-project.example.mongodb.net/test",
    }),
    /matches the effective production database/,
  );
});

test("uses an explicitly configured production database name for collision checks", () => {
  assert.throws(
    () => validateTestDatabaseUri({
      MONGO_URI: "mongodb+srv://user:pass@production.example.mongodb.net",
      MONGO_DATABASE_NAME: "netflix_clone_test",
      MONGO_TEST_URI: "mongodb+srv://user:pass@test-project.example.mongodb.net/netflix_clone_test",
    }),
    /matches the effective production database/,
  );
});

test("fails closed when the production database name cannot be determined", () => {
  assert.throws(
    () => validateTestDatabaseUri({
      MONGO_TEST_URI: "mongodb+srv://user:pass@test-project.example/netflix_clone_test",
    }),
    /Cannot verify database isolation: set MONGO_DATABASE_NAME or configure MONGO_URI/,
  );
});
