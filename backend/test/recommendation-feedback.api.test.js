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
import { getEligibleCandidates } from "../services/recommendation/candidate.service.js";
import { extractProfilePreferences } from "../services/recommendation/preference.service.js";
import { getProfileMaturityPolicy } from "../services/maturity-policy.service.js";
import { connectRecommendationTestDatabase, disconnectRecommendationTestDatabase } from "./helpers/recommendation-test-db.js";

const TEST_JWT_SECRET = "recommendation-feedback-integration-test-secret-not-for-production";
process.env.JWT_SECRET = TEST_JWT_SECRET;

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
  for (const fixture of fixtures.splice(0)) {
    await Promise.all([
      RecommendationFeedback.deleteMany({ profile: { $in: fixture.profileIds } }),
      WatchHistory.deleteMany({ profile: { $in: fixture.profileIds } }),
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

const createIdentity = async (created, { active = true, isKids = false, maturityLevel = "All" } = {}) => {
  const user = await User.create({
    name: "Feedback Test User",
    email: `feedback-${new mongoose.Types.ObjectId()}@example.test`,
    password: "test-password-only",
    role: "user",
    isActive: true,
  });
  created.userIds.push(user._id);
  const profile = await Profile.create({
    user: user._id,
    name: "Feedback Test Profile",
    isActive: active,
    isKids,
    maturityLevel,
    language: "English",
  });
  created.profileIds.push(profile._id);
  const token = jwt.sign({ userId: String(user._id) }, TEST_JWT_SECRET, { expiresIn: "5m" });
  return { user, profile, token };
};

const createMovie = async (created, options = {}) => {
  const title = options.title || `Feedback Movie ${new mongoose.Types.ObjectId()}`;
  const movie = await Movie.create({
    title,
    description: `${title} description`,
    backdrop: "/test-backdrop.jpg",
    poster: "/test-poster.jpg",
    year: 2025,
    rating: "PG",
    duration: "90 min",
    genres: ["Mystery"],
    cast: ["Feedback Actor"],
    director: "Feedback Director",
    language: "English",
    maturityRating: "All",
    isPublished: true,
    videoUrl: "/test-video.mp4",
    ...options,
  });
  created.movieIds.push(movie._id);
  return movie;
};

const request = (path, token, { method = "GET", body } = {}) => fetch(`${baseUrl}/api/recommendations${path}`, {
  method,
  headers: {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(body !== undefined ? { "content-type": "application/json" } : {}),
  },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

const putFeedback = (movieId, token, profileId, type) => request(`/${movieId}/feedback`, token, {
  method: "PUT",
  body: { profileId: String(profileId), type },
});

const deleteFeedback = (movieId, token, profileId) => request(
  `/${movieId}/feedback?profileId=${profileId}`,
  token,
  { method: "DELETE" },
);

test("requires authentication, validates IDs, and enforces active profile ownership", async () => {
  const created = fixture();
  const owner = await createIdentity(created);
  const other = await createIdentity(created);
  const inactive = await createIdentity(created, { active: false });
  const movie = await createMovie(created);

  assert.equal((await putFeedback(movie._id, null, owner.profile._id, "MORE_LIKE_THIS")).status, 401);
  assert.equal((await putFeedback("invalid-id", owner.token, owner.profile._id, "MORE_LIKE_THIS")).status, 400);
  const foreign = await putFeedback(movie._id, other.token, owner.profile._id, "MORE_LIKE_THIS");
  assert.equal(foreign.status, 404);
  assert.equal((await putFeedback(movie._id, owner.token, inactive.profile._id, "MORE_LIKE_THIS")).status, 404);
});

test("rejects unsupported feedback and missing, unpublished, or maturity-ineligible movies", async () => {
  const created = fixture();
  const identity = await createIdentity(created, { isKids: true, maturityLevel: "18+" });
  const mature = await createMovie(created, { maturityRating: "13+" });
  const unknown = await createMovie(created, { maturityRating: "TV-14" });
  const unpublished = await createMovie(created, { isPublished: false });
  const missingId = new mongoose.Types.ObjectId();

  assert.equal((await putFeedback(mature._id, identity.token, identity.profile._id, "MORE_LIKE_THIS")).status, 404);
  assert.equal((await putFeedback(unknown._id, identity.token, identity.profile._id, "MORE_LIKE_THIS")).status, 404);
  assert.equal((await putFeedback(unpublished._id, identity.token, identity.profile._id, "MORE_LIKE_THIS")).status, 404);
  assert.equal((await putFeedback(missingId, identity.token, identity.profile._id, "MORE_LIKE_THIS")).status, 404);
  const invalidType = await putFeedback(mature._id, identity.token, identity.profile._id, "LIKE");
  assert.equal(invalidType.status, 400);
  assert.equal((await invalidType.json()).code, "VALIDATION_ERROR");
});

test("feedback upsert is idempotent, replaces the previous type, and remains profile-scoped", async () => {
  const created = fixture();
  const owner = await createIdentity(created);
  const otherProfile = await createIdentity(created);
  const movie = await createMovie(created);

  const first = await putFeedback(movie._id, owner.token, owner.profile._id, "MORE_LIKE_THIS");
  assert.equal(first.status, 200);
  const firstBody = await first.json();
  assert.equal(firstBody.success, true);
  assert.equal(firstBody.feedback.type, "MORE_LIKE_THIS");
  const repeated = await putFeedback(movie._id, owner.token, owner.profile._id, "MORE_LIKE_THIS");
  assert.equal(repeated.status, 200);
  await putFeedback(movie._id, owner.token, owner.profile._id, "NOT_INTERESTED");
  await putFeedback(movie._id, owner.token, owner.profile._id, "ALREADY_WATCHED");

  assert.equal(await RecommendationFeedback.countDocuments({ profile: owner.profile._id, movie: movie._id }), 1);
  assert.equal((await RecommendationFeedback.findOne({ profile: owner.profile._id, movie: movie._id })).type, "ALREADY_WATCHED");
  assert.equal(await RecommendationFeedback.countDocuments({ profile: otherProfile.profile._id, movie: movie._id }), 0);
  assert.equal(await WatchHistory.countDocuments({ profile: owner.profile._id, movie: movie._id }), 0);
  assert.equal(await WatchHistory.countDocuments({ movie: movie._id }), 0);
});

test("delete is idempotent and removes only the matching profile feedback", async () => {
  const created = fixture();
  const owner = await createIdentity(created);
  const otherProfile = await createIdentity(created);
  const movie = await createMovie(created);
  await putFeedback(movie._id, owner.token, owner.profile._id, "MORE_LIKE_THIS");
  await putFeedback(movie._id, otherProfile.token, otherProfile.profile._id, "NOT_INTERESTED");

  assert.equal((await deleteFeedback(movie._id, owner.token, owner.profile._id)).status, 204);
  assert.equal((await deleteFeedback(movie._id, owner.token, owner.profile._id)).status, 204);
  assert.equal(await RecommendationFeedback.countDocuments({ profile: owner.profile._id, movie: movie._id }), 0);
  assert.equal(await RecommendationFeedback.countDocuments({ profile: otherProfile.profile._id, movie: movie._id }), 1);
  assert.equal((await request(`/${movie._id}/feedback`, owner.token, { method: "DELETE" })).status, 400);
});

test("persisted feedback updates deterministic preferences, exclusions, and deletion behavior only", async () => {
  const created = fixture();
  const identity = await createIdentity(created);
  const target = await createMovie(created, { title: "Target Feedback", genres: ["Mystery"] });
  const policy = await getProfileMaturityPolicy(identity.profile._id, identity.user._id);
  const candidates = async () => getEligibleCandidates({ profileId: identity.profile._id, maturityPolicy: policy, limit: 100 });

  await putFeedback(target._id, identity.token, identity.profile._id, "MORE_LIKE_THIS");
  let preferences = await extractProfilePreferences({ profileId: identity.profile._id, userId: identity.user._id });
  assert.ok(preferences.genres.mystery > 0);
  assert.equal((await candidates()).some((movie) => String(movie._id) === String(target._id)), true);
  assert.equal(await WatchHistory.countDocuments({ profile: identity.profile._id, movie: target._id }), 0);

  await putFeedback(target._id, identity.token, identity.profile._id, "NOT_INTERESTED");
  preferences = await extractProfilePreferences({ profileId: identity.profile._id, userId: identity.user._id });
  assert.equal(preferences.dislikedSeeds.length, 1);
  assert.equal((await candidates()).some((movie) => String(movie._id) === String(target._id)), false);

  await deleteFeedback(target._id, identity.token, identity.profile._id);
  preferences = await extractProfilePreferences({ profileId: identity.profile._id, userId: identity.user._id });
  assert.equal(preferences.dislikedSeeds.length, 0);
  assert.equal((await candidates()).some((movie) => String(movie._id) === String(target._id)), true);

  await putFeedback(target._id, identity.token, identity.profile._id, "ALREADY_WATCHED");
  assert.equal((await candidates()).some((movie) => String(movie._id) === String(target._id)), false);
  assert.equal(await WatchHistory.countDocuments({ profile: identity.profile._id }), 0);
});
