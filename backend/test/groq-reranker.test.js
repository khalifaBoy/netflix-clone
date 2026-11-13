import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import path from "node:path";
import mongoose from "mongoose";
import Movie from "../models/Movie.js";
import Profile from "../models/Profile.js";
import RecommendationFeedback from "../models/RecommendationFeedback.js";
import WatchHistory from "../models/WatchHistory.js";
import Watchlist from "../models/Watchlist.js";
import { getRecommendations } from "../controllers/recommendation.controller.js";
import { getGroqClient, getGroqRerankingConfig } from "../config/groq.js";
import { rerankCandidates } from "../services/recommendation/groq-reranker.service.js";

const candidate = (id, score, additions = {}) => ({
  movie: {
    _id: id,
    title: `Movie ${id}`,
    description: "A short description",
    longDescription: "Long description should not be sent",
    genres: ["Drama"],
    cast: ["Actor One"],
    director: "Director One",
    language: "English",
    views: 50,
    ...additions,
  },
  score,
  components: { genre: 0.7 },
});

const preferenceContext = {
  profileId: "private-profile-id",
  ownerId: "private-owner-id",
  profileName: "Private Name",
  genres: { drama: 1.5, comedy: 0.5 },
  actors: { "actor one": 1 },
  directors: { "director one": 1 },
  languages: { english: 1 },
  positiveSeeds: [{ movie: { title: "private raw history" } }],
  dislikedSeeds: [{ movie: { title: "private raw feedback" } }],
};

const makeClient = (completionOrFunction, capture = {}) => ({
  chat: {
    completions: {
      create: async (request, options) => {
        capture.request = request;
        capture.options = options;
        return typeof completionOrFunction === "function"
          ? completionOrFunction(request, options)
          : completionOrFunction;
      },
    },
  },
});

const withEnv = async (updates, callback) => {
  const previous = new Map();
  for (const [key, value] of Object.entries(updates)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = String(value);
  }
  try {
    return await callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

const patchMethods = async (stubs, callback) => {
  const originals = stubs.map(([target, key]) => [target, key, target[key]]);
  for (const [target, key, replacement] of stubs) target[key] = replacement;
  try {
    return await callback();
  } finally {
    for (const [target, key, original] of originals) target[key] = original;
  }
};

const modelQuery = (value) => ({
  select() { return this; },
  sort() { return this; },
  limit() { return this; },
  populate() { return this; },
  lean() { return Promise.resolve(value); },
});

const completion = (movieIds) => ({
  choices: [{ message: { content: JSON.stringify({ movieIds }) } }],
});

test("reranks only top 30 IDs and blends normalized deterministic/Groq rank signals", async () => {
  const candidates = [
    candidate("a", 0.9),
    candidate("b", 0.899),
    candidate("c", 0.1),
    ...Array.from({ length: 28 }, (_, index) => candidate(`extra-${index}`, 0.05)),
    candidate("outside-top-30", 0.01),
  ];
  const capture = {};
  const topIds = candidates.slice(0, 30).map((item) => String(item.movie._id));
  const result = await rerankCandidates(candidates, preferenceContext, {
    enabled: true,
    client: makeClient(completion(["b", "a", ...topIds.filter((id) => !["a", "b"].includes(id))]), capture),
  });

  assert.equal(capture.request.messages[1].content.length > 0, true);
  const payload = JSON.parse(capture.request.messages[1].content);
  assert.equal(payload.candidates.length, 30);
  assert.equal(payload.candidates.some((item) => item.id === "outside-top-30"), false);
  assert.equal(capture.options.maxRetries, 0);
  assert.equal(capture.options.timeout, getGroqRerankingConfig().timeoutMs);
  assert.equal(payload.candidates[0].description.length <= 320, true);
  assert.equal(JSON.stringify(capture.request).includes("private-profile-id"), false);
  assert.equal(JSON.stringify(capture.request).includes("private-owner-id"), false);
  assert.equal(JSON.stringify(capture.request).includes("Private Name"), false);
  assert.equal(JSON.stringify(capture.request).includes("private raw history"), false);
  assert.equal(JSON.stringify(capture.request).includes("private raw feedback"), false);
  assert.deepEqual(result.map((item) => item.movie._id), ["b", "a", ...topIds.filter((id) => !["a", "b"].includes(id))]);

  const scores = new Map(result.map((item) => [item.movie._id, item]));
  assert.ok(Math.abs(scores.get("b").normalizedDeterministicScore - ((0.899 - 0.05) / (0.9 - 0.05))) < 1e-12);
  assert.equal(scores.get("b").normalizedGroqRankScore, 1);
  assert.ok(Math.abs(scores.get("b").finalScore - (0.8 * ((0.899 - 0.05) / (0.9 - 0.05)) + 0.2)) < 1e-12);
  assert.equal(scores.get("a").normalizedDeterministicScore, 1);
  assert.equal(scores.get("a").normalizedGroqRankScore, 1 - 1 / 29);
  assert.ok(result.every((item) => Number.isFinite(item.finalScore) && item.finalScore >= 0 && item.finalScore <= 1));
});

test("disabled reranking preserves deterministic order and does not call the provider", async () => {
  let called = false;
  const candidates = [candidate("first", 0.5), candidate("second", 0.4)];
  await withEnv({ GROQ_RERANKING_ENABLED: "false" }, async () => {
    const result = await rerankCandidates(candidates, {}, {
      client: makeClient(() => { called = true; return completion(["second", "first"]); }),
    });
    assert.equal(called, false);
    assert.deepEqual(result, candidates);
  });
});

test("missing API key falls back without initializing a client", async () => {
  await withEnv({ GROQ_API_KEY: undefined, GROQ_RERANKING_ENABLED: "true" }, async () => {
    assert.equal(getGroqRerankingConfig().hasApiKey, false);
    assert.equal(getGroqClient({ reranking: true }), null);
    const candidates = [candidate("first", 0.8), candidate("second", 0.2)];
    const result = await rerankCandidates(candidates, {});
    assert.deepEqual(result, candidates);
  });
});

test("timeout, rate limit and network errors fall back with safe error categories", async () => {
  const candidates = [candidate("first", 0.8), candidate("second", 0.2)];
  const cases = [
    [Object.assign(new Error("timeout details"), { name: "APIConnectionTimeoutError" }), "timeout"],
    [Object.assign(new Error("rate limit details"), { status: 429 }), "rate_limit"],
    [Object.assign(new Error("network detail with private values"), { name: "APIConnectionError" }), "network"],
  ];

  for (const [error, expectedCategory] of cases) {
    const categories = [];
    const result = await rerankCandidates(candidates, {}, {
      enabled: true,
      client: makeClient(() => { throw error; }),
      logger: (category) => categories.push(category),
    });
    assert.deepEqual(result, candidates);
    assert.deepEqual(categories, [expectedCategory]);
  }
});

test("invalid JSON, invalid schema and empty usable IDs use deterministic fallback", async () => {
  const candidates = [candidate("first", 0.8), candidate("second", 0.2)];
  for (const content of ["not-json", JSON.stringify({ ids: ["first"] }), JSON.stringify({ movieIds: [] })]) {
    const result = await rerankCandidates(candidates, {}, {
      enabled: true,
      client: makeClient({ choices: [{ message: { content } }] }),
    });
    assert.deepEqual(result, candidates);
  }
});

test("partial responses blend valid Groq ranks with omitted candidates and keep all eligible IDs", async () => {
  const candidates = [candidate("a", 0.9), candidate("b", 0.09), candidate("c", 0)];
  const result = await rerankCandidates(candidates, {}, {
    enabled: true,
    client: makeClient(completion(["c", "unknown-id", "c"])),
  });
  assert.deepEqual(result.map((item) => item.movie._id), ["a", "c", "b"]);
  assert.deepEqual(result.map((item) => item.normalizedGroqRankScore), [0, 1, 0]);
  assert.deepEqual(result.map((item) => item.finalScore), [0.8, 0.2, 0.08]);
  assert.equal(result.some((item) => item.movie._id === "unknown-id"), false);
});

test("partial response score ties use deterministic rank as the stable tie-breaker", async () => {
  const candidates = [candidate("first", 1), candidate("second", 0.75), candidate("third", 0)];
  const result = await rerankCandidates(candidates, {}, {
    enabled: true,
    client: makeClient(completion(["second", "first"])),
  });
  assert.deepEqual(result.map((item) => item.movie._id), ["first", "second", "third"]);
  assert.equal(result[0].finalScore, result[1].finalScore);
  assert.ok(result.every((item) => Number.isFinite(item.finalScore)
    && item.finalScore >= 0 && item.finalScore <= 1));
});

test("empty candidates do not invoke Groq", async () => {
  let called = false;
  const result = await rerankCandidates([], {}, {
    enabled: true,
    client: makeClient(() => { called = true; return completion([]); }),
  });
  assert.deepEqual(result, []);
  assert.equal(called, false);
});

test("a single candidate does not make an unnecessary rerank call", async () => {
  let called = false;
  const only = candidate("only", 0.8);
  const result = await rerankCandidates([only], {}, {
    enabled: true,
    client: makeClient(() => { called = true; return completion(["only"]); }),
  });
  assert.equal(called, false);
  assert.deepEqual(result, [only]);
});

test("reranker cannot restore excluded or maturity-ineligible IDs", async () => {
  const eligible = [candidate("eligible", 0.8, { maturityRating: "7+" })];
  const result = await rerankCandidates(eligible, {}, {
    enabled: true,
    client: makeClient(completion(["excluded", "too-mature", "eligible"])),
  });
  assert.deepEqual(result.map((item) => item.movie._id), ["eligible"]);
});

test("fallback ordering is deterministic across repeated calls", async () => {
  const candidates = [candidate("a", 0.8), candidate("b", 0.4), candidate("c", 0.1)];
  const first = await rerankCandidates(candidates, {}, { enabled: false });
  const second = await rerankCandidates(candidates, {}, { enabled: false });
  assert.deepEqual(first.map((item) => item.movie._id), second.map((item) => item.movie._id));
});

test("main endpoint preserves response contract and returns Movie objects", async () => {
  const id = new mongoose.Types.ObjectId();
  const owner = new mongoose.Types.ObjectId();
  const movies = [
    {
      _id: new mongoose.Types.ObjectId(), title: "First", description: "First desc", longDescription: "",
      genres: ["Drama"], cast: ["Actor"], year: 2025, rating: "PG-13", duration: "1h",
      backdrop: "/backdrop", poster: "/poster", videoUrl: "/video", trailerUrl: "",
      isNewRelease: false, isTop10: false, language: "English", maturityRating: "13+",
      director: "Director", releaseDate: null, views: 0, match: 50,
    },
    {
      _id: new mongoose.Types.ObjectId(), title: "Second", description: "Second desc", longDescription: "",
      genres: ["Drama"], cast: ["Actor"], year: 2024, rating: "PG-13", duration: "1h",
      backdrop: "/backdrop2", poster: "/poster2", videoUrl: "/video2", trailerUrl: "",
      isNewRelease: false, isTop10: false, language: "English", maturityRating: "13+",
      director: "Director", releaseDate: null, views: 0, match: 40,
    },
  ];
  const res = {
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  const stubs = [
    [Profile, "findOne", () => ({ lean: async () => ({
      _id: id, name: "Family", user: owner, isActive: true, isKids: false, maturityLevel: "All", language: "English",
    }) })],
    [WatchHistory, "find", () => modelQuery([])],
    [Watchlist, "find", () => modelQuery([])],
    [RecommendationFeedback, "find", () => modelQuery([])],
    [WatchHistory, "distinct", async () => []],
    [Watchlist, "distinct", async () => []],
    [RecommendationFeedback, "distinct", async () => []],
    [Movie, "find", () => modelQuery(movies)],
  ];

  await withEnv({ GROQ_API_KEY: undefined, GROQ_RERANKING_ENABLED: "false" }, () =>
    patchMethods(stubs, () => getRecommendations({
      query: { profileId: String(id) },
      user: { _id: owner },
    }, res, (error) => { throw error; })));

  assert.equal(res.statusCode, 200);
  assert.deepEqual(Object.keys(res.body), ["success", "profile", "count", "movies"]);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.profile, { id: String(id), name: "Family" });
  assert.equal(res.body.count, 2);
  assert.deepEqual(res.body.movies, movies.map(({ views, match, ...movie }) => movie));
  assert.equal(res.body.movies.some((item) => Object.hasOwn(item, "score")), false);
});

test("backend app imports without GROQ_API_KEY", () => {
  const appPath = path.resolve("src/app.js");
  const script = `await import(${JSON.stringify(pathToFileURL(appPath).href)});`;
  const env = { ...process.env, DOTENV_CONFIG_PATH: "/dev/null" };
  delete env.GROQ_API_KEY;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: "/tmp",
    env,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
