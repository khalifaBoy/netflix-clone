import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import Movie from "../models/Movie.js";
import WatchHistory from "../models/WatchHistory.js";
import {
  MAX_MOVIE_DURATION_SECONDS,
  normalizeDurationSeconds,
  parseLegacyDurationSeconds,
  resolveMovieDurationSecondsOnCreate,
  resolveMovieDurationSecondsOnUpdate,
} from "../services/movie-duration.service.js";
import {
  DEFAULT_WATCH_HISTORY_COMPLETION_THRESHOLD,
  getWatchHistoryCompletionThreshold,
  isWatchHistoryComplete,
} from "../services/watch-history-policy.service.js";

const profileId = new mongoose.Types.ObjectId();
const movieId = new mongoose.Types.ObjectId();

const validMovieData = () => ({
  title: "Test Movie",
  description: "Description",
  backdrop: "/backdrop.jpg",
  poster: "/poster.jpg",
  year: 2025,
  rating: "PG",
  duration: "1h 38m",
  videoUrl: "/video.mp4",
});

const withWatchHistoryUpsert = async (initialState, callback) => {
  const originalFindOne = WatchHistory.findOne;
  const originalFindOneAndUpdate = WatchHistory.findOneAndUpdate;
  const state = initialState ? { ...initialState } : null;
  const updates = [];

  WatchHistory.findOne = () => ({
    select() { return this; },
    lean: async () => state && {
      durationSeconds: state.durationSeconds,
      completedAt: state.completedAt,
    },
  });
  WatchHistory.findOneAndUpdate = async (_filter, update) => {
    updates.push(update);
    if (!state) {
      Object.assign(state || {}, {});
      return update;
    }
    Object.assign(state, update.$set);
    return { ...state };
  };

  try {
    return await callback({ state: () => state, updates });
  } finally {
    WatchHistory.findOne = originalFindOne;
    WatchHistory.findOneAndUpdate = originalFindOneAndUpdate;
  }
};

test("parses only explicitly supported legacy duration formats", () => {
  assert.equal(parseLegacyDurationSeconds("1h 38m"), 5880);
  assert.equal(parseLegacyDurationSeconds("2h 01m"), 7260);
  assert.equal(parseLegacyDurationSeconds("1h"), 3600);
  assert.equal(parseLegacyDurationSeconds("90 min"), 5400);
  assert.equal(parseLegacyDurationSeconds(" 90 MIN "), 5400);

  for (const unsupported of ["90", "1.5h", "1h 5m", "1h 60m", "90 minutes", "1 h", "0h", "25h"]) {
    assert.equal(parseLegacyDurationSeconds(unsupported), null, unsupported);
  }
  assert.equal(parseLegacyDurationSeconds(undefined), null);
});

test("numeric durations must be positive, integral, finite, and within the sensible limit", () => {
  assert.equal(normalizeDurationSeconds(3600), 3600);
  assert.equal(normalizeDurationSeconds("5400"), 5400);
  assert.equal(normalizeDurationSeconds(0), null);
  assert.equal(normalizeDurationSeconds(-1), null);
  assert.equal(normalizeDurationSeconds(1.5), null);
  assert.equal(normalizeDurationSeconds("1.0"), null);
  assert.equal(normalizeDurationSeconds(Number.NaN), null);
  assert.equal(normalizeDurationSeconds(Number.POSITIVE_INFINITY), null);
  assert.equal(normalizeDurationSeconds(MAX_MOVIE_DURATION_SECONDS + 1), null);
});

test("movie duration updates parse supported values and clear stale numeric metadata", () => {
  assert.equal(resolveMovieDurationSecondsOnCreate("1h 38m"), 5880);
  assert.equal(resolveMovieDurationSecondsOnCreate("custom runtime"), null);
  assert.equal(resolveMovieDurationSecondsOnCreate("custom runtime", 1234), 1234);
  assert.equal(resolveMovieDurationSecondsOnCreate("1h", null), null);

  assert.equal(resolveMovieDurationSecondsOnUpdate({
    currentDisplayDuration: "1h 38m",
    currentDurationSeconds: 5880,
    nextDisplayDuration: "custom runtime",
  }), null);
  assert.equal(resolveMovieDurationSecondsOnUpdate({
    currentDisplayDuration: "1h 38m",
    currentDurationSeconds: 5880,
    nextDisplayDuration: "2h 01m",
  }), 7260);
  assert.equal(resolveMovieDurationSecondsOnUpdate({
    currentDisplayDuration: "1h 38m",
    currentDurationSeconds: 5880,
    nextDisplayDuration: "1h 38m",
  }), 5880);
  assert.equal(resolveMovieDurationSecondsOnUpdate({
    currentDisplayDuration: "1h 38m",
    currentDurationSeconds: 5880,
    suppliedDurationSeconds: 7200,
  }), 7200);
});

test("legacy Movie documents without durationSeconds remain valid", async () => {
  const movie = new Movie(validMovieData());
  await assert.doesNotReject(movie.validate());
  assert.equal(movie.duration, "1h 38m");
  assert.equal(movie.durationSeconds, null);

  for (const invalid of [0, -1, 1.5, MAX_MOVIE_DURATION_SECONDS + 1]) {
    const invalidMovie = new Movie({ ...validMovieData(), durationSeconds: invalid });
    await assert.rejects(invalidMovie.validate(), (error) => Boolean(error.errors.durationSeconds));
  }
});

test("completion threshold defaults to 90 percent and can be configured", () => {
  const previous = process.env.WATCH_HISTORY_COMPLETION_THRESHOLD;
  delete process.env.WATCH_HISTORY_COMPLETION_THRESHOLD;
  try {
    assert.equal(getWatchHistoryCompletionThreshold(), DEFAULT_WATCH_HISTORY_COMPLETION_THRESHOLD);
    assert.equal(isWatchHistoryComplete(89, 100), false);
    assert.equal(isWatchHistoryComplete(90, 100), true);
    assert.equal(isWatchHistoryComplete(99, null), false);
    assert.equal(isWatchHistoryComplete(-1, 100), false);
    assert.equal(isWatchHistoryComplete(101, 100), false);

    process.env.WATCH_HISTORY_COMPLETION_THRESHOLD = "0.95";
    assert.equal(isWatchHistoryComplete(94, 100), false);
    assert.equal(isWatchHistoryComplete(95, 100), true);
    process.env.WATCH_HISTORY_COMPLETION_THRESHOLD = "invalid";
    assert.equal(getWatchHistoryCompletionThreshold(), DEFAULT_WATCH_HISTORY_COMPLETION_THRESHOLD);
  } finally {
    if (previous === undefined) delete process.env.WATCH_HISTORY_COMPLETION_THRESHOLD;
    else process.env.WATCH_HISTORY_COMPLETION_THRESHOLD = previous;
  }
});

test("WatchHistory allows progress without duration and rejects progress beyond a known duration", async () => {
  await assert.doesNotReject(new WatchHistory({
    profile: profileId,
    movie: movieId,
    progressSeconds: 200,
    durationSeconds: null,
  }).validate());

  await assert.rejects(new WatchHistory({
    profile: profileId,
    movie: movieId,
    progressSeconds: 101,
    durationSeconds: 100,
  }).validate(), (error) => Boolean(error.errors.progressSeconds));
});

test("progress upserts use server timestamps, derive completion, and never increment watchCount", async () => {
  await withWatchHistoryUpsert(null, async ({ state, updates }) => {
    await WatchHistory.upsertProgress({
      profile: profileId,
      movie: movieId,
      progressSeconds: 89,
      durationSeconds: 100,
      completedAt: new Date(0),
      lastWatchedAt: new Date(0),
      watchCountIncrement: 12,
    });
    assert.equal(Object.hasOwn(updates[0].$set, "completedAt"), false);
    assert.equal(updates[0].$set.lastWatchedAt instanceof Date, true);
    assert.notEqual(updates[0].$set.lastWatchedAt.getTime(), 0);
    assert.equal(Object.hasOwn(updates[0], "$inc"), false);
    assert.equal(Object.hasOwn(updates[0].$set, "watchCount"), false);
    assert.equal(Object.hasOwn(updates[0].$set, "durationSeconds"), true);
    assert.equal(state(), null);
  });

  await withWatchHistoryUpsert(null, async ({ updates }) => {
    await WatchHistory.upsertProgress({
      profile: profileId,
      movie: movieId,
      progressSeconds: 90,
      durationSeconds: 100,
    });
    assert.equal(updates[0].$set.completedAt instanceof Date, true);
  });

  await withWatchHistoryUpsert(null, async ({ updates }) => {
    await WatchHistory.upsertProgress({ profile: profileId, movie: movieId, progressSeconds: 99 });
    assert.equal(Object.hasOwn(updates[0].$set, "durationSeconds"), false);
    assert.equal(Object.hasOwn(updates[0].$set, "completedAt"), false);
  });
});

test("completion remains sticky after ordinary updates and replay", async () => {
  const completedAt = new Date("2025-01-01T00:00:00.000Z");
  await withWatchHistoryUpsert({
    durationSeconds: 100,
    completedAt,
    watchCount: 0,
  }, async ({ state, updates }) => {
    await WatchHistory.upsertProgress({ profile: profileId, movie: movieId, progressSeconds: 95, durationSeconds: 100 });
    await WatchHistory.upsertProgress({ profile: profileId, movie: movieId, progressSeconds: 0, durationSeconds: 100 });
    assert.equal(state().completedAt, completedAt);
    assert.equal(state().watchCount, 0);
    assert.equal(Object.hasOwn(updates[0].$set, "completedAt"), false);
    assert.equal(Object.hasOwn(updates[1].$set, "completedAt"), false);
    assert.equal(Object.hasOwn(updates[0], "$inc"), false);
  });
});

test("missing current duration preserves prior trusted duration for bounds and completion", async () => {
  await withWatchHistoryUpsert({ durationSeconds: 100, completedAt: null, watchCount: 0 }, async ({ updates }) => {
    await WatchHistory.upsertProgress({ profile: profileId, movie: movieId, progressSeconds: 90 });
    assert.equal(Object.hasOwn(updates[0].$set, "durationSeconds"), false);
    assert.equal(updates[0].$set.completedAt instanceof Date, true);
  });

  await withWatchHistoryUpsert({ durationSeconds: 100, completedAt: null, watchCount: 0 }, async ({ updates }) => {
    await assert.rejects(
      WatchHistory.upsertProgress({ profile: profileId, movie: movieId, progressSeconds: 101 }),
      (error) => Boolean(error.errors?.progressSeconds),
    );
    assert.equal(updates.length, 0);
  });
});

test("a concurrent first-write duplicate retries without a second upsert", async () => {
  const originalFindOne = WatchHistory.findOne;
  const originalFindOneAndUpdate = WatchHistory.findOneAndUpdate;
  const updates = [];
  WatchHistory.findOne = () => ({ select() { return this; }, lean: async () => null });
  WatchHistory.findOneAndUpdate = async (_filter, update, options) => {
    updates.push({ update, options });
    if (updates.length === 1) throw Object.assign(new Error("duplicate"), { code: 11000 });
    return { progressSeconds: update.$set.progressSeconds };
  };
  try {
    const saved = await WatchHistory.upsertProgress({
      profile: profileId,
      movie: movieId,
      progressSeconds: 12,
      durationSeconds: 100,
    });
    assert.equal(saved.progressSeconds, 12);
    assert.equal(updates[0].options.upsert, true);
    assert.equal(updates[1].options.upsert, undefined);
  } finally {
    WatchHistory.findOne = originalFindOne;
    WatchHistory.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
