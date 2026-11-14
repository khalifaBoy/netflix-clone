import "dotenv/config";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
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
import { connectRecommendationTestDatabase, disconnectRecommendationTestDatabase } from "./helpers/recommendation-test-db.js";

const TEST_JWT_SECRET = "kids-restrictions-test-secret-not-for-production";
process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.GROQ_RERANKING_ENABLED = "false";

const fixtures = [];
let server;
let baseUrl;

before(async () => {
  await connectRecommendationTestDatabase();
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 1) return;
  for (const item of fixtures.splice(0)) {
    await Promise.all([
      WatchHistory.deleteMany({ profile: { $in: item.profileIds } }),
      RecommendationFeedback.deleteMany({ profile: { $in: item.profileIds } }),
      RecommendationInteraction.deleteMany({ profile: { $in: item.profileIds } }),
      Watchlist.deleteMany({ profile: { $in: item.profileIds } }),
      Profile.deleteMany({ _id: { $in: item.profileIds } }),
      Movie.deleteMany({ _id: { $in: item.movieIds } }),
      User.deleteMany({ _id: { $in: item.userIds } }),
    ]);
  }
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await disconnectRecommendationTestDatabase();
});

const fixture = () => {
  const item = { userIds: [], profileIds: [], movieIds: [] };
  fixtures.push(item);
  return item;
};

const createIdentity = async (item, name = "Kids restrictions") => {
  const user = await User.create({
    name,
    email: `${name.replaceAll(" ", "-").toLowerCase()}-${new mongoose.Types.ObjectId()}@example.test`,
    password: "test-password-only",
    role: "user",
    isActive: true,
  });
  item.userIds.push(user._id);
  const token = jwt.sign({ userId: String(user._id) }, TEST_JWT_SECRET, { expiresIn: "5m" });
  const profiles = {};
  for (const maturityLevel of ["All", "7+", "13+", "16+", "18+"]) {
    const profile = await Profile.create({ user: user._id, name: `${name} ${maturityLevel}`, maturityLevel, isKids: false, isActive: true });
    item.profileIds.push(profile._id);
    profiles[maturityLevel] = profile;
  }
  profiles.kids = await Profile.create({ user: user._id, name: `${name} Kids`, maturityLevel: "18+", isKids: true, isActive: true });
  item.profileIds.push(profiles.kids._id);
  return { user, token, profiles };
};

const createMovie = async (item, maturityRating, title = `Maturity ${maturityRating}`) => {
  const movie = await Movie.create({
    title: `${title} ${new mongoose.Types.ObjectId()}`,
    description: `${title} searchable safety description`,
    longDescription: `${title} long description`,
    backdrop: "/test-backdrop.jpg",
    poster: "/test-poster.jpg",
    year: 2025,
    rating: "PG",
    duration: "90 min",
    durationSeconds: 5400,
    genres: ["SafetyCanary"],
    cast: ["Safety Actor"],
    maturityRating,
    isPublished: true,
    videoUrl: "/uploads/videos/unavailable-test-video.mp4",
  });
  item.movieIds.push(movie._id);
  return movie;
};

const request = (path, token, options = {}) => fetch(`${baseUrl}${path}`, {
  ...options,
  headers: {
    ...(options.body ? { "content-type": "application/json" } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  },
});

const allowedAt = (level) => ({
  All: ["All", "7+", "13+", "16+", "18+"],
  "7+": ["All", "7+"],
  "13+": ["All", "7+", "13+"],
  "16+": ["All", "7+", "13+", "16+"],
  "18+": ["All", "7+", "13+", "16+", "18+"],
}[level]);

const withGroqIds = async (movieIds, callback) => {
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = "test-only-fake-groq-key";
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    if (!url.startsWith("https://api.groq.com/")) return originalFetch(input, init);
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ movieIds: movieIds.map(String) }) } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousKey;
  }
};

test("movie list, details, and search enforce profile ownership and each canonical maturity cap", async () => {
  const item = fixture();
  const owner = await createIdentity(item);
  const other = await createIdentity(item, "Other owner");
  const titles = {};
  for (const rating of ["All", "7+", "13+", "16+", "18+", "R", "TV-MA", "PG-13"]) {
    titles[rating] = await createMovie(item, rating, "SafetyCanary");
  }

  const missingProfile = await request("/api/movies", owner.token);
  assert.equal(missingProfile.status, 400);
  assert.equal((await request("/api/movies?profileId=invalid", owner.token)).status, 400);
  assert.equal((await request("/api/movies", null)).status, 401);
  assert.equal((await request(`/api/movies/${titles["7+"]._id}?profileId=${owner.profiles["7+"]._id}`, other.token)).status, 404);

  for (const level of ["All", "7+", "13+", "16+", "18+"]) {
    const response = await request(`/api/movies?profileId=${owner.profiles[level]._id}&search=SafetyCanary`, owner.token);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(new Set(body.movies.map((movie) => movie.maturityRating)), new Set(allowedAt(level)));
  }

  const kidsResponse = await request(`/api/movies?profileId=${owner.profiles.kids._id}&search=SafetyCanary&maturityLevel=18%2B`, owner.token);
  const kidsBody = await kidsResponse.json();
  assert.deepEqual(new Set(kidsBody.movies.map((movie) => movie.maturityRating)), new Set(["All", "7+"]));
  assert.equal((await request(`/api/movies/${titles["7+"]._id}`, owner.token)).status, 400);
  assert.equal((await request(`/api/movies/${titles["13+"]._id}?profileId=${owner.profiles.kids._id}`, owner.token)).status, 404);
  assert.equal((await request(`/api/movies/${titles["7+"]._id}?profileId=${owner.profiles.kids._id}`, owner.token)).status, 200);

  for (const profileId of [owner.profiles.kids._id, owner.profiles["13+"]._id]) {
    const response = await withGroqIds(Object.values(titles).map((movie) => movie._id), () =>
      request(`/api/recommendations/search?q=SafetyCanary&profileId=${profileId}`, owner.token));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.movies.some((movie) => ["16+", "18+", "R", "TV-MA", "PG-13"].includes(movie.maturityRating)), false);
  }
  const allSearch = await withGroqIds(Object.values(titles).map((movie) => movie._id), () =>
    request(`/api/recommendations/search?q=SafetyCanary&profileId=${owner.profiles.All._id}`, owner.token));
  const allSearchBody = await allSearch.json();
  assert.equal(allSearchBody.movies.some((movie) => ["R", "TV-MA", "PG-13"].includes(movie.maturityRating)), false);

  const kidsRecommendations = await request(`/api/recommendations?profileId=${owner.profiles.kids._id}`, owner.token);
  assert.equal(kidsRecommendations.status, 200);
  const recommendationBody = await kidsRecommendations.json();
  assert.equal(recommendationBody.movies.some((movie) => !["All", "7+"].includes(movie.maturityRating)), false);
});

test("watchlist retrieval filters movies made ineligible and add rejects restricted movies", async () => {
  const item = fixture();
  const owner = await createIdentity(item, "Watchlist owner");
  const other = await createIdentity(item, "Watchlist other");
  const allowed = await createMovie(item, "7+", "Watchlist safe");
  const restricted = await createMovie(item, "13+", "Watchlist restricted");
  const unknown = await createMovie(item, "TV-14", "Watchlist unknown");
  await Watchlist.create([
    { profile: owner.profiles.kids._id, movie: allowed._id },
    { profile: owner.profiles.kids._id, movie: restricted._id },
    { profile: owner.profiles.kids._id, movie: unknown._id },
  ]);

  const response = await request(`/api/watchlist?profileId=${owner.profiles.kids._id}`, owner.token);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.watchlist.map((record) => String(record.movie._id)), [String(allowed._id)]);
  assert.equal((await request(`/api/watchlist?profileId=${owner.profiles.kids._id}`, other.token)).status, 404);
  assert.equal((await request("/api/watchlist", owner.token)).status, 400);
  assert.equal((await request(`/api/watchlist/${restricted._id}`, null, {
    method: "POST", body: JSON.stringify({ profileId: String(owner.profiles.kids._id) }),
  })).status, 401);
  assert.equal((await request(`/api/watchlist/${restricted._id}`, owner.token, {
    method: "POST", body: JSON.stringify({ profileId: String(owner.profiles.kids._id) }),
  })).status, 404);
  const newSafeMovie = await createMovie(item, "7+", "Watchlist addition safe");
  assert.equal((await request(`/api/watchlist/${newSafeMovie._id}`, owner.token, {
    method: "POST", body: JSON.stringify({ profileId: String(owner.profiles.kids._id) }),
  })).status, 201);
  assert.equal((await request(`/api/watchlist/${newSafeMovie._id}`, owner.token, {
    method: "DELETE", body: JSON.stringify({ profileId: String(owner.profiles.kids._id) }),
  })).status, 200);
});

test("movie view and history progress APIs reject unauthorized or over-limit playback metadata access", async () => {
  const item = fixture();
  const owner = await createIdentity(item, "Playback owner");
  const other = await createIdentity(item, "Playback other");
  const safe = await createMovie(item, "7+", "Playback safe");
  const restricted = await createMovie(item, "13+", "Playback restricted");

  assert.equal((await request(`/api/movies/${restricted._id}/views?profileId=${owner.profiles.kids._id}`, owner.token, { method: "POST" })).status, 404);
  assert.equal((await request(`/api/movies/${safe._id}/views?profileId=${owner.profiles.kids._id}`, null, { method: "POST" })).status, 401);
  assert.equal((await request(`/api/movies/${safe._id}/views?profileId=${other.profiles.All._id}`, owner.token, { method: "POST" })).status, 404);
  assert.equal((await request(`/api/movies/${safe._id}/views?profileId=${owner.profiles.kids._id}`, owner.token, { method: "POST" })).status, 200);
  assert.equal((await request(`/api/watch-history/${restricted._id}/progress`, owner.token, {
    method: "PUT", body: JSON.stringify({ profileId: String(owner.profiles.kids._id), progressSeconds: 10 }),
  })).status, 404);

  const uploadNames = await readdir(new URL("../uploads/videos/", import.meta.url));
  if (uploadNames.length) {
    const publicAsset = await request(`/uploads/videos/${encodeURIComponent(uploadNames[0])}`, null);
    assert.equal(publicAsset.status, 404, "video files are not exposed by public static serving");
  }
});
