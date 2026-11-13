import "dotenv/config";
import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import app from "../src/app.js";
import User from "../models/User.js";
import Profile from "../models/Profile.js";
import Movie from "../models/Movie.js";
import WatchHistory from "../models/WatchHistory.js";
import RecommendationFeedback from "../models/RecommendationFeedback.js";
import RecommendationInteraction from "../models/RecommendationInteraction.js";
import Watchlist from "../models/Watchlist.js";
import { getEligibleCandidates } from "../services/recommendation/candidate.service.js";
import { extractProfilePreferences } from "../services/recommendation/preference.service.js";
import { getProfileMaturityPolicy } from "../services/maturity-policy.service.js";
import {
  connectRecommendationTestDatabase,
  disconnectRecommendationTestDatabase,
  inspectRecommendationIndexes,
  validateTestDatabaseUri,
} from "./helpers/recommendation-test-db.js";

// This is a test-only signing key, never a production credential.
const TEST_JWT_SECRET = "recommendation-integration-test-secret-not-for-production";
process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.GROQ_RERANK_TIMEOUT_MS = "1000";

const fixtures = [];
let server;
let baseUrl;

const waitForListening = (httpServer) => new Promise((resolve, reject) => {
  httpServer.once("listening", resolve);
  httpServer.once("error", reject);
});

before(async () => {
  await connectRecommendationTestDatabase();
  server = app.listen(0);
  await waitForListening(server);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 1) return;
  for (const fixture of fixtures.splice(0)) {
    await Promise.all([
      WatchHistory.deleteMany({ profile: { $in: fixture.profileIds } }),
      RecommendationFeedback.deleteMany({ profile: { $in: fixture.profileIds } }),
      RecommendationInteraction.deleteMany({ profile: { $in: fixture.profileIds } }),
      Watchlist.deleteMany({ profile: { $in: fixture.profileIds } }),
      Profile.deleteMany({ _id: { $in: fixture.profileIds } }),
      Movie.deleteMany({ _id: { $in: fixture.movieIds } }),
      User.deleteMany({ _id: { $in: fixture.userIds } }),
    ]);
  }
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await disconnectRecommendationTestDatabase();
});

const fixture = () => {
  const created = { userIds: [], profileIds: [], movieIds: [] };
  fixtures.push(created);
  return created;
};

const createUserAndProfile = async (created, {
  isKids = false,
  maturityLevel = "All",
  name = "Test Profile",
  active = true,
} = {}) => {
  const user = await User.create({
    name: "Recommendation Test User",
    email: `recommendation-${new mongoose.Types.ObjectId()}@example.test`,
    password: "test-password-only",
    role: "user",
    isActive: true,
  });
  created.userIds.push(user._id);
  const profile = await Profile.create({
    user: user._id,
    name,
    isKids,
    maturityLevel,
    isActive: active,
    language: "English",
  });
  created.profileIds.push(profile._id);
  const token = jwt.sign({ userId: String(user._id) }, TEST_JWT_SECRET, { expiresIn: "5m" });
  return { user, profile, token };
};

const createMovie = async (created, {
  title = `Test Movie ${new mongoose.Types.ObjectId()}`,
  genres = ["Drama"],
  views = 0,
  maturityRating = "All",
  published = true,
  ...overrides
} = {}) => {
  const movie = await Movie.create({
    title,
    description: `${title} description`,
    longDescription: `${title} longer description`,
    backdrop: "/test-backdrop.jpg",
    poster: "/test-poster.jpg",
    year: 2025,
    rating: "PG",
    duration: "90 min",
    genres,
    cast: ["Test Actor"],
    director: "Test Director",
    language: "English",
    maturityRating,
    views,
    isPublished: published,
    videoUrl: "/test-video.mp4",
    trailerUrl: "/test-trailer.mp4",
    ...overrides,
  });
  created.movieIds.push(movie._id);
  return movie;
};

const requestRecommendations = (profileId, token) => fetch(
  `${baseUrl}/api/recommendations?profileId=${profileId}`,
  token ? { headers: { authorization: `Bearer ${token}` } } : {},
);

const withGroqResponse = async (handler, callback) => {
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.GROQ_API_KEY;
  const previousEnabled = process.env.GROQ_RERANKING_ENABLED;
  process.env.GROQ_API_KEY = "test-only-fake-groq-key";
  process.env.GROQ_RERANKING_ENABLED = "true";
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    if (!url.startsWith("https://api.groq.com/")) return originalFetch(input, init);
    return handler({ url, init });
  };
  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousKey;
    if (previousEnabled === undefined) delete process.env.GROQ_RERANKING_ENABLED;
    else process.env.GROQ_RERANKING_ENABLED = previousEnabled;
  }
};

const groqJson = (movieIds, status = 200) => new Response(
  JSON.stringify(status === 200
    ? { choices: [{ message: { content: JSON.stringify({ movieIds }) } }] }
    : { error: { message: "test provider failure" } }),
  { status, headers: { "content-type": "application/json" } },
);

test("enforces a separately named test database without requiring a separate MongoDB cluster", async () => {
  // This test checks only configuration parsing; it never opens a connection.
  assert.throws(() => validateTestDatabaseUri({ MONGO_URI: "mongodb://localhost/netflix" }), /MONGO_TEST_URI is required/);
  assert.equal(validateTestDatabaseUri({
    MONGO_URI: "mongodb+srv://user:pass@same-cluster.example/netflix_clone",
    MONGO_TEST_URI: "mongodb+srv://user:pass@same-cluster.example/netflix_clone_test",
  }).target.databaseName, "netflix_clone_test");
  assert.throws(() => validateTestDatabaseUri({
    MONGO_URI: "mongodb+srv://user:pass@same-cluster.example/netflix_clone_test",
    MONGO_TEST_URI: "mongodb+srv://user:pass@same-cluster.example/netflix_clone_test",
  }), /matches the effective production database/);
  assert.equal(validateTestDatabaseUri({
    MONGO_URI: "mongodb+srv://user:pass@prod-cluster.example/netflix_clone",
    MONGO_TEST_URI: "mongodb+srv://user:pass@test-cluster.example/netflix_clone_test",
  }).target.databaseName, "netflix_clone_test");
  assert.throws(() => validateTestDatabaseUri({ MONGO_TEST_URI: "mongodb+srv://user:pass@same-cluster.example" }), /explicit database name/);
  assert.throws(() => validateTestDatabaseUri({
    MONGO_URI: "mongodb+srv://user:pass@same-cluster.example",
    MONGO_TEST_URI: "mongodb+srv://user:pass@test-project.example/test",
  }), /matches the effective production database/);
});

test("creates and verifies real unique and compound recommendation indexes", async () => {
  const indexes = await inspectRecommendationIndexes();
  const hasIndex = (model, fields, unique = false) => indexes.get(model).some((index) =>
    fields.every(([key, direction]) => index.key[key] === direction)
    && (!unique || index.unique === true));

  assert.equal(hasIndex("WatchHistory", [["profile", 1], ["movie", 1]], true), true);
  assert.equal(hasIndex("WatchHistory", [["profile", 1], ["lastWatchedAt", -1]]), true);
  assert.equal(hasIndex("RecommendationFeedback", [["profile", 1], ["movie", 1]], true), true);
  assert.equal(hasIndex("RecommendationFeedback", [["profile", 1], ["type", 1], ["updatedAt", -1]]), true);
  assert.equal(hasIndex("RecommendationInteraction", [["profile", 1], ["createdAt", -1]]), true);
  assert.equal(hasIndex("RecommendationInteraction", [["profile", 1], ["eventType", 1], ["createdAt", -1]]), true);
  assert.equal(hasIndex("RecommendationInteraction", [["profile", 1], ["movie", 1], ["createdAt", -1]]), true);
  assert.equal(hasIndex("Watchlist", [["profile", 1], ["movie", 1]], true), true);

  const created = fixture();
  const { profile } = await createUserAndProfile(created);
  const movie = await createMovie(created);
  await WatchHistory.create({ profile: profile._id, movie: movie._id, durationSeconds: 100 });
  await RecommendationFeedback.create({ profile: profile._id, movie: movie._id, type: "MORE_LIKE_THIS" });
  await Watchlist.create({ profile: profile._id, movie: movie._id });

  await assert.rejects(WatchHistory.create({ profile: profile._id, movie: movie._id, durationSeconds: 100 }), (error) => error.code === 11000);
  await assert.rejects(RecommendationFeedback.create({ profile: profile._id, movie: movie._id, type: "NOT_INTERESTED" }), (error) => error.code === 11000);
  await assert.rejects(Watchlist.create({ profile: profile._id, movie: movie._id }), (error) => error.code === 11000);
});

test("authenticated workflow enforces ownership, inactive status, and auth failures", async () => {
  const created = fixture();
  const owner = await createUserAndProfile(created);
  const otherOwner = await createUserAndProfile(created);
  const inactive = await createUserAndProfile(created, { active: false });
  await createMovie(created);

  const valid = await requestRecommendations(owner.profile._id, owner.token);
  assert.equal(valid.status, 200);
  assert.equal((await valid.json()).success, true);

  const missingToken = await requestRecommendations(owner.profile._id);
  assert.equal(missingToken.status, 401);
  const invalidToken = await fetch(`${baseUrl}/api/recommendations?profileId=${owner.profile._id}`, {
    headers: { authorization: "Bearer invalid-token" },
  });
  assert.equal(invalidToken.status, 401);

  const foreign = await requestRecommendations(owner.profile._id, otherOwner.token);
  assert.equal(foreign.status, 404);
  assert.equal((await foreign.json()).code, "PROFILE_NOT_FOUND");
  const inactiveResponse = await requestRecommendations(inactive.profile._id, inactive.token);
  assert.equal(inactiveResponse.status, 404);
});

test("end-to-end maturity and personalization exclusions preserve partial history as a signal", async () => {
  const created = fixture();
  const { profile, token } = await createUserAndProfile(created, { isKids: true, maturityLevel: "18+" });
  const completed = await createMovie(created, { title: "Completed Safe Drama", maturityRating: "7+", genres: ["Drama"] });
  const partial = await createMovie(created, { title: "Partial Safe Drama", maturityRating: "All", genres: ["Drama"] });
  const watchlisted = await createMovie(created, { title: "Watchlisted", maturityRating: "7+" });
  const disliked = await createMovie(created, { title: "Disliked", maturityRating: "7+" });
  const alreadyWatched = await createMovie(created, { title: "Already Watched Feedback", maturityRating: "7+" });
  const tooMature = await createMovie(created, { title: "Too Mature", maturityRating: "13+", views: 999 });
  const unknownRating = await createMovie(created, { title: "Unknown Rating", maturityRating: "TV-14", views: 999 });
  const unpublished = await createMovie(created, { title: "Unpublished", maturityRating: "7+", published: false });
  for (let index = 0; index < 20; index += 1) {
    await createMovie(created, { title: `Eligible ${index}`, maturityRating: index % 2 ? "All" : "7+", genres: ["Drama"], views: index });
  }
  await WatchHistory.create([
    { profile: profile._id, movie: completed._id, progressSeconds: 40, durationSeconds: 100, completedAt: new Date() },
    { profile: profile._id, movie: partial._id, progressSeconds: 30, durationSeconds: 100, completedAt: null },
  ]);
  await Watchlist.create({ profile: profile._id, movie: watchlisted._id });
  await RecommendationFeedback.create([
    { profile: profile._id, movie: disliked._id, type: "NOT_INTERESTED" },
    { profile: profile._id, movie: alreadyWatched._id, type: "ALREADY_WATCHED" },
  ]);

  const response = await requestRecommendations(profile._id, token);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body), ["success", "profile", "count", "movies"]);
  assert.equal(body.count, 15);
  assert.equal(body.movies.length, 15);
  assert.equal(new Set(body.movies.map((movie) => String(movie._id))).size, 15);
  const resultIds = new Set(body.movies.map((movie) => String(movie._id)));
  for (const excluded of [completed, watchlisted, disliked, alreadyWatched, tooMature, unknownRating, unpublished]) {
    assert.equal(resultIds.has(String(excluded._id)), false, `${excluded.title} must be excluded`);
  }
  const preferences = await extractProfilePreferences({ profileId: profile._id, userId: profile.user });
  assert.ok(preferences.genres.drama > 0, "partial viewing contributes a Drama preference signal");
  const maturityPolicy = await getProfileMaturityPolicy(profile._id, profile.user);
  const eligibleCandidates = await getEligibleCandidates({ profileId: profile._id, maturityPolicy, limit: 1000 });
  assert.equal(
    eligibleCandidates.some((movie) => String(movie._id) === String(partial._id)),
    true,
    "partial watch history must not automatically exclude the movie from eligible candidates",
  );
  const expectedFields = ["_id", "title", "description", "genres", "cast", "year", "rating", "duration", "poster", "backdrop", "videoUrl", "language", "maturityRating"];
  for (const movie of body.movies) for (const field of expectedFields) assert.ok(Object.hasOwn(movie, field), `${field} must be present`);
  const idsInDatabase = await Movie.find({ _id: { $in: [...resultIds] }, isPublished: true, maturityRating: { $in: ["All", "7+"] } }).distinct("_id");
  assert.equal(idsInDatabase.length, 15);
});

test("non-kids profiles use the stored maturity setting and empty profiles still rank", async () => {
  const created = fixture();
  const teen = await createUserAndProfile(created, { maturityLevel: "13+" });
  const allowed = await createMovie(created, { title: "Teen Allowed", maturityRating: "13+" });
  const tooMature = await createMovie(created, { title: "Teen Disallowed", maturityRating: "16+", views: 1000 });
  const unknown = await createMovie(created, { title: "Teen Unknown", maturityRating: "R" });
  const teenResponse = await requestRecommendations(teen.profile._id, teen.token);
  const teenBody = await teenResponse.json();
  const teenIds = new Set(teenBody.movies.map((movie) => String(movie._id)));
  assert.equal(teenIds.has(String(allowed._id)), true);
  assert.equal(teenIds.has(String(tooMature._id)), false);
  assert.equal(teenIds.has(String(unknown._id)), false);

  const empty = await createUserAndProfile(created);
  for (let index = 0; index < 3; index += 1) await createMovie(created, { title: `Empty Pref ${index}`, maturityRating: "All", views: index });
  const emptyResponse = await requestRecommendations(empty.profile._id, empty.token);
  const emptyBody = await emptyResponse.json();
  assert.equal(emptyResponse.status, 200);
  assert.ok(emptyBody.movies.length > 0);
  assert.equal(new Set(emptyBody.movies.map((movie) => String(movie._id))).size, emptyBody.movies.length);
});

test("Groq success reranks eligible candidates; partial, duplicate, and unknown IDs stay safe", async () => {
  const created = fixture();
  const { profile, token } = await createUserAndProfile(created);
  const movies = [];
  for (let index = 0; index < 4; index += 1) movies.push(await createMovie(created, {
    title: `Groq Candidate ${index}`,
    views: index,
    maturityRating: "All",
  }));
  let requestBody;
  const success = await withGroqResponse(({ init }) => {
    requestBody = JSON.parse(init.body);
    const ids = movies.map((movie) => String(movie._id));
    return groqJson(ids.slice().reverse());
  }, () => requestRecommendations(profile._id, token));
  assert.equal(success.status, 200);
  const successBody = await success.json();
  assert.equal(requestBody.messages.length, 2);
  assert.equal(successBody.movies.length, 4);
  assert.deepEqual(
    new Set(successBody.movies.map((movie) => String(movie._id))),
    new Set(movies.map((movie) => String(movie._id))),
  );

  const partial = await withGroqResponse(() => groqJson([String(movies[2]._id), "unknown-id", String(movies[2]._id)]),
    () => requestRecommendations(profile._id, token));
  const partialBody = await partial.json();
  assert.equal(partialBody.movies.length, 4);
  assert.equal(new Set(partialBody.movies.map((movie) => String(movie._id))).size, 4);
  assert.equal(partialBody.movies.some((movie) => String(movie._id) === "unknown-id"), false);
});

test("provider failure and missing API key preserve stable deterministic fallback", async () => {
  const created = fixture();
  const { profile, token } = await createUserAndProfile(created, { maturityLevel: "13+" });
  const eligibleMovies = [];
  for (let index = 0; index < 4; index += 1) {
    eligibleMovies.push(await createMovie(created, { title: `Fallback ${index}`, views: 4 - index, maturityRating: "All" }));
  }
  const disliked = await createMovie(created, { title: "Fallback Disliked", maturityRating: "All" });
  const overLimit = await createMovie(created, { title: "Fallback Over Limit", maturityRating: "16+", views: 999 });
  await RecommendationFeedback.create({ profile: profile._id, movie: disliked._id, type: "NOT_INTERESTED" });
  const expectedCandidateIds = new Set(eligibleMovies.map((movie) => String(movie._id)));

  const beforeKey = process.env.GROQ_API_KEY;
  const beforeFlag = process.env.GROQ_RERANKING_ENABLED;
  process.env.GROQ_RERANKING_ENABLED = "true";
  delete process.env.GROQ_API_KEY;
  let firstIds;
  try {
    const first = await requestRecommendations(profile._id, token);
    assert.equal(first.status, 200);
    firstIds = (await first.json()).movies.map((movie) => String(movie._id));
    const second = await requestRecommendations(profile._id, token);
    const secondIds = (await second.json()).movies.map((movie) => String(movie._id));
    assert.deepEqual(firstIds, secondIds);
  } finally {
    if (beforeKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = beforeKey;
    if (beforeFlag === undefined) delete process.env.GROQ_RERANKING_ENABLED;
    else process.env.GROQ_RERANKING_ENABLED = beforeFlag;
  }

  let providerCalls = 0;
  const failed = await withGroqResponse(() => {
    providerCalls += 1;
    return groqJson([], 429);
  }, () => requestRecommendations(profile._id, token));
  assert.equal(failed.status, 200);
  const failedIds = (await failed.json()).movies.map((movie) => String(movie._id));
  assert.ok(providerCalls > 0, "the fake Groq provider must receive the simulated HTTP 429 request");
  assert.deepEqual(failedIds, firstIds);
  assert.equal(new Set(failedIds).size, failedIds.length, "fallback results must not contain duplicates");
  assert.equal(failedIds.every((id) => expectedCandidateIds.has(id)), true, "fallback must contain only eligible candidate IDs");
  assert.deepEqual(new Set(failedIds), expectedCandidateIds, "fallback must retain every eligible candidate");
  assert.equal(failedIds.includes(String(disliked._id)), false, "NOT_INTERESTED movies stay excluded during fallback");
  assert.equal(failedIds.includes(String(overLimit._id)), false, "maturity-ineligible movies stay excluded during fallback");
});

test("recommendation query path has bounded batched reads and no per-movie populate queries", async () => {
  const created = fixture();
  const { profile, token } = await createUserAndProfile(created);
  for (let index = 0; index < 3; index += 1) await createMovie(created, { title: `Query Count ${index}` });
  const historySeed = await createMovie(created, { title: "Query Count History Seed" });
  const watchlistSeed = await createMovie(created, { title: "Query Count Watchlist Seed" });
  const feedbackSeed = await createMovie(created, { title: "Query Count Feedback Seed" });
  await WatchHistory.create({ profile: profile._id, movie: historySeed._id, progressSeconds: 10, durationSeconds: 100 });
  await Watchlist.create({ profile: profile._id, movie: watchlistSeed._id });
  await RecommendationFeedback.create({ profile: profile._id, movie: feedbackSeed._id, type: "MORE_LIKE_THIS" });

  const previousDebug = mongoose.get("debug");
  const operations = [];
  mongoose.set("debug", (collection, method, ...args) => operations.push({ collection, method, args }));
  try {
    const response = await requestRecommendations(profile._id, token);
    assert.equal(response.status, 200);
  } finally {
    mongoose.set("debug", previousDebug);
  }

  const reads = operations.filter(({ method }) => ["find", "findOne", "distinct"].includes(method));
  const movieReads = reads.filter(({ collection }) => collection === "movies");
  assert.equal(movieReads.length, 4, "three batched populated preference reads and one candidate read; no per-movie queries");
  assert.ok(reads.some(({ collection, method }) => collection === "watchhistories" && method === "find"));
  assert.ok(reads.length <= 13, `expected a bounded set of profile-scoped reads, got ${reads.length}`);
  assert.ok(operations.some(({ collection, method }) => collection === "movies" && method === "find"));
  console.info(`Recommendation integration read operations: ${reads.length}`);
});
