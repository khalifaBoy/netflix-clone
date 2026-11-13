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
import Watchlist from "../models/Watchlist.js";
import { connectRecommendationTestDatabase, disconnectRecommendationTestDatabase } from "./helpers/recommendation-test-db.js";

const TEST_JWT_SECRET = "watch-history-integration-test-secret-not-for-production";
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
      WatchHistory.deleteMany({ profile: { $in: fixture.profileIds } }),
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

const createIdentity = async (created, { ownerId, active = true, isKids = false, maturityLevel = "All" } = {}) => {
  let userId = ownerId;
  if (!userId) {
    const user = await User.create({
      name: "Watch History Test User",
      email: `watch-history-${new mongoose.Types.ObjectId()}@example.test`,
      password: "test-password-only",
      role: "user",
      isActive: true,
    });
    created.userIds.push(user._id);
    userId = user._id;
  }
  const profile = await Profile.create({
    user: userId,
    name: "Watch Test Profile",
    isActive: active,
    isKids,
    maturityLevel,
  });
  created.profileIds.push(profile._id);
  const token = jwt.sign({ userId: String(userId) }, TEST_JWT_SECRET, { expiresIn: "5m" });
  return { userId, profile, token };
};

const createMovie = async (created, options = {}) => {
  const title = options.title || `History Movie ${new mongoose.Types.ObjectId()}`;
  const movie = await Movie.create({
    title,
    description: `${title} description`,
    backdrop: "/test-backdrop.jpg",
    poster: "/test-poster.jpg",
    year: 2025,
    rating: "PG",
    duration: "90 min",
    durationSeconds: 100,
    genres: ["Drama"],
    videoUrl: "/test-video.mp4",
    maturityRating: "All",
    isPublished: true,
    ...options,
  });
  created.movieIds.push(movie._id);
  return movie;
};

const api = (path, token, options = {}) => fetch(`${baseUrl}/api/watch-history${path}`, {
  ...options,
  headers: {
    ...(options.body ? { "content-type": "application/json" } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  },
});

const progress = (profileId, progressSeconds, extras = {}) => JSON.stringify({ profileId: String(profileId), progressSeconds, ...extras });

test("requires authentication and rejects invalid IDs, inactive and foreign profiles", async () => {
  const created = fixture();
  const owner = await createIdentity(created);
  const other = await createIdentity(created);
  const inactive = await createIdentity(created, { active: false });
  const movie = await createMovie(created);

  assert.equal((await api(`/${movie._id}/progress`, null, { method: "PUT", body: progress(owner.profile._id, 1) })).status, 401);
  assert.equal((await api(`/not-an-id/progress`, owner.token, { method: "PUT", body: progress(owner.profile._id, 1) })).status, 400);
  assert.equal((await api(`/${movie._id}/progress`, other.token, { method: "PUT", body: progress(owner.profile._id, 1) })).status, 404);
  assert.equal((await api(`/${movie._id}/progress`, owner.token, { method: "PUT", body: progress(inactive.profile._id, 1) })).status, 404);
});

test("progress writes use published eligible catalog movies and reject forged completion/duration", async () => {
  const created = fixture();
  const identity = await createIdentity(created, { isKids: true, maturityLevel: "18+" });
  const eligible = await createMovie(created, { maturityRating: "7+" });
  const mature = await createMovie(created, { maturityRating: "13+" });
  const unknown = await createMovie(created, { maturityRating: "TV-14" });
  const unpublished = await createMovie(created, { isPublished: false });

  for (const movie of [mature, unknown, unpublished]) {
    const response = await api(`/${movie._id}/progress`, identity.token, { method: "PUT", body: progress(identity.profile._id, 5) });
    assert.equal(response.status, 404);
  }
  for (const fields of [{ durationSeconds: 100 }, { completed: true }, { completedAt: new Date().toISOString() }]) {
    const response = await api(`/${eligible._id}/progress`, identity.token, { method: "PUT", body: progress(identity.profile._id, 5, fields) });
    assert.equal(response.status, 400);
  }
  assert.equal((await api(`/${eligible._id}/progress`, identity.token, { method: "PUT", body: progress(identity.profile._id, -1) })).status, 400);
  assert.equal((await api(`/${eligible._id}/progress`, identity.token, { method: "PUT", body: JSON.stringify({ profileId: identity.profile._id }) })).status, 400);
});

test("creates and updates progress, derives sticky completion, and does not inflate watchCount", async () => {
  const created = fixture();
  const identity = await createIdentity(created);
  const movie = await createMovie(created, { durationSeconds: 100 });

  const first = await api(`/${movie._id}/progress`, identity.token, { method: "PUT", body: progress(identity.profile._id, 89) });
  assert.equal(first.status, 200);
  const firstBody = await first.json();
  assert.equal(firstBody.success, true);
  assert.equal(firstBody.history.progressSeconds, 89);
  assert.equal(firstBody.history.completedAt, null);
  assert.equal(firstBody.history.movie.durationSeconds, 100);

  assert.equal((await api(`/${movie._id}/progress`, identity.token, { method: "PUT", body: progress(identity.profile._id, 101) })).status, 400);
  await api(`/${movie._id}/progress`, identity.token, { method: "PUT", body: progress(identity.profile._id, 90) });
  const completed = await WatchHistory.findOne({ profile: identity.profile._id, movie: movie._id });
  assert.ok(completed.completedAt);
  const completedAt = completed.completedAt.getTime();
  await api(`/${movie._id}/progress`, identity.token, { method: "PUT", body: progress(identity.profile._id, 20) });
  const replay = await WatchHistory.findOne({ profile: identity.profile._id, movie: movie._id });
  assert.equal(replay.completedAt.getTime(), completedAt);
  assert.equal(replay.watchCount, 0);
});

test("unknown catalog duration accepts progress without automatic completion", async () => {
  const created = fixture();
  const identity = await createIdentity(created);
  const movie = await createMovie(created, { durationSeconds: null });
  const response = await api(`/${movie._id}/progress`, identity.token, { method: "PUT", body: progress(identity.profile._id, 500) });
  assert.equal(response.status, 200);
  const record = await WatchHistory.findOne({ profile: identity.profile._id, movie: movie._id });
  assert.equal(record.durationSeconds, null);
  assert.equal(record.completedAt, null);
});

test("continue watching and cursor history are profile-scoped, filtered, and stable", async () => {
  const created = fixture();
  const identity = await createIdentity(created);
  const other = await createIdentity(created);
  const newest = await createMovie(created, { title: "Newest history" });
  const older = await createMovie(created, { title: "Older history" });
  const completed = await createMovie(created, { title: "Completed history" });
  const inaccessible = await createMovie(created, { title: "Unpublished history", isPublished: false });
  const base = new Date("2025-01-01T00:00:00.000Z");
  await WatchHistory.create([
    { profile: identity.profile._id, movie: newest._id, progressSeconds: 20, durationSeconds: 100, lastWatchedAt: new Date(base.getTime() + 3000) },
    { profile: identity.profile._id, movie: older._id, progressSeconds: 30, durationSeconds: 100, lastWatchedAt: new Date(base.getTime() + 2000) },
    { profile: identity.profile._id, movie: completed._id, progressSeconds: 100, durationSeconds: 100, completedAt: base, lastWatchedAt: new Date(base.getTime() + 1000) },
    { profile: identity.profile._id, movie: inaccessible._id, progressSeconds: 40, durationSeconds: 100, lastWatchedAt: base },
    { profile: other.profile._id, movie: newest._id, progressSeconds: 10, durationSeconds: 100, lastWatchedAt: new Date(base.getTime() + 4000) },
  ]);

  const continueResponse = await api(`/continue?profileId=${identity.profile._id}&limit=10`, identity.token);
  const continueBody = await continueResponse.json();
  assert.equal(continueResponse.status, 200);
  assert.deepEqual(continueBody.history.map((record) => record.movie.title), ["Newest history", "Older history"]);

  const firstResponse = await api(`?profileId=${identity.profile._id}&limit=1`, identity.token);
  const firstBody = await firstResponse.json();
  assert.equal(firstBody.history.length, 1);
  assert.equal(firstBody.history[0].movie.title, "Newest history");
  assert.ok(firstBody.nextCursor);
  const secondResponse = await api(`?profileId=${identity.profile._id}&limit=1&cursor=${encodeURIComponent(firstBody.nextCursor)}`, identity.token);
  const secondBody = await secondResponse.json();
  assert.equal(secondBody.history[0].movie.title, "Older history");
  assert.notEqual(String(firstBody.history[0]._id), String(secondBody.history[0]._id));
  assert.equal(secondBody.history.some((record) => record.movie.title === "Unpublished history"), false);
  assert.equal((await api(`?profileId=${identity.profile._id}&cursor=bad`, identity.token)).status, 400);
  const foreign = await api(`?profileId=${identity.profile._id}`, other.token);
  assert.equal(foreign.status, 404);
});
