import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import Movie from "../models/Movie.js";
import Profile from "../models/Profile.js";
import RecommendationFeedback from "../models/RecommendationFeedback.js";
import RecommendationInteraction from "../models/RecommendationInteraction.js";
import WatchHistory from "../models/WatchHistory.js";
import Watchlist from "../models/Watchlist.js";
import { getEligibleCandidates } from "../services/recommendation/candidate.service.js";
import { extractProfilePreferences, recencyWeight } from "../services/recommendation/preference.service.js";
import {
  castSimilarity,
  contentSimilarity,
  directorSimilarity,
  feedbackSimilarity,
  genreSimilarity,
  languageMatching,
  negativePreferenceSimilarity,
  popularityScores,
} from "../services/recommendation/similarity.service.js";
import { rankMovies, scoreMovie } from "../services/recommendation/scoring.service.js";
import { generateDeterministicRecommendations } from "../services/recommendation/recommendation.service.js";

const profileId = new mongoose.Types.ObjectId();
const ownerId = new mongoose.Types.ObjectId();
const toId = (n) => new mongoose.Types.ObjectId(String(n).padStart(24, "0"));
const day = 86_400_000;
const fixedNow = new Date("2026-01-01T00:00:00.000Z");

const queryWith = (value) => ({
  select() { return this; },
  sort() { return this; },
  limit() { return this; },
  populate() { return this; },
  lean() { return Promise.resolve(value); },
});

const withMethodStubs = async (stubs, callback) => {
  const originals = stubs.map(([target, key]) => [target, key, target[key]]);
  for (const [target, key, replacement] of stubs) target[key] = replacement;
  try {
    return await callback();
  } finally {
    for (const [target, key, original] of originals) target[key] = original;
  }
};

const preferenceFixtures = (overrides = {}) => {
  const movie = (id, data) => ({ _id: toId(id), title: `Title ${id}`, ...data });
  return {
    history: [
      {
        movie: movie(1, { genres: ["Drama"], cast: ["Actor A"], director: "Director A", language: "English" }),
        progressSeconds: 20,
        durationSeconds: 100,
        lastWatchedAt: fixedNow,
        completedAt: fixedNow,
        watchCount: 2,
      },
      {
        movie: movie(2, { genres: ["Action"], cast: ["Actor B"], director: "Director B", language: "Hindi" }),
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: fixedNow,
        completedAt: null,
        watchCount: 1,
      },
    ],
    watchlist: [{
      movie: movie(3, { genres: ["Comedy"], cast: ["Actor C"], director: "Director C", language: "Tamil" }),
      addedAt: fixedNow,
    }],
    feedback: [
      {
        movie: movie(4, { genres: ["Thriller"], cast: ["Actor D"], director: "Director D", language: "English" }),
        type: "MORE_LIKE_THIS",
        updatedAt: fixedNow,
      },
      {
        movie: movie(5, { genres: ["Horror"], cast: ["Actor E"], director: "Director E", language: "French" }),
        type: "NOT_INTERESTED",
        updatedAt: fixedNow,
      },
    ],
    ...overrides,
  };
};

const preferenceServiceStubs = (fixtures, capture = {}) => [
  [Profile, "findOne", (query) => {
    capture.profileQuery = query;
    return { lean: async () => ({ _id: profileId, isKids: false, maturityLevel: "13+", language: "English" }) };
  }],
  [WatchHistory, "find", (query) => {
    capture.historyQuery = query;
    return queryWith(fixtures.history);
  }],
  [Watchlist, "find", (query) => {
    capture.watchlistQuery = query;
    return queryWith(fixtures.watchlist);
  }],
  [RecommendationFeedback, "find", (query) => {
    capture.feedbackQuery = query;
    return queryWith(fixtures.feedback);
  }],
  [RecommendationInteraction, "find", () => {
    throw new Error("Recommendation impressions must not affect preference extraction");
  }],
];

test("extracts profile preferences from history, list and feedback, but ignores impressions", async () => {
  const fixtures = preferenceFixtures();
  const capture = {};
  const preferences = await withMethodStubs(preferenceServiceStubs(fixtures, capture), () =>
    extractProfilePreferences({ profileId, userId: ownerId, now: fixedNow }));

  assert.ok(preferences.genres.drama > preferences.genres.action);
  assert.ok(preferences.genres.action > preferences.genres.comedy);
  assert.ok(preferences.genres.thriller > 0);
  assert.equal(preferences.genres.horror, undefined);
  assert.ok(preferences.actors["actor a"] > preferences.actors["actor b"]);
  assert.ok(preferences.directors["director a"] > 0);
  assert.ok(preferences.languages.english > 0);
  assert.equal(preferences.completedMovieIds.length, 1);
  assert.equal(preferences.moreLikeSeeds.length, 1);
  assert.equal(preferences.dislikedSeeds.length, 1);
  assert.deepEqual(capture.profileQuery, { _id: profileId, user: ownerId, isActive: true });
  assert.deepEqual(capture.historyQuery, { profile: profileId });
  assert.deepEqual(capture.watchlistQuery, { profile: profileId });
  assert.deepEqual(capture.feedbackQuery, {
    profile: profileId,
    type: { $in: ["MORE_LIKE_THIS", "NOT_INTERESTED"] },
  });
});

test("recency uses a bounded half-life and completed viewing outweighs partial viewing", async () => {
  assert.equal(recencyWeight(fixedNow, { now: fixedNow }), 1);
  assert.equal(recencyWeight(new Date(fixedNow.getTime() - 90 * day), { now: fixedNow }), 0.5);

  const fixtures = preferenceFixtures({
    history: [
      {
        movie: { _id: toId(10), genres: ["Drama"] },
        progressSeconds: 5,
        durationSeconds: 100,
        lastWatchedAt: fixedNow,
        completedAt: fixedNow,
        watchCount: 1,
      },
      {
        movie: { _id: toId(11), genres: ["Action"] },
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: fixedNow,
        completedAt: null,
        watchCount: 1,
      },
    ],
    watchlist: [],
    feedback: [],
  });
  const preferences = await withMethodStubs(preferenceServiceStubs(fixtures), () =>
    extractProfilePreferences({ profileId, userId: ownerId, now: fixedNow }));

  assert.ok(preferences.genres.drama > preferences.genres.action);
  assert.equal(preferences.completedMovieIds.includes(String(toId(11))), false);
});

test("genre, cast, director, content and language similarities are bounded", () => {
  const preferences = {
    genres: { drama: 2, comedy: 1 },
    actors: { "actor a": 2 },
    directors: { "director a": 1 },
    languages: { english: 1 },
    positiveSeeds: [{
      weight: 1,
      movie: { title: "Quiet River", description: "A family returns home", genres: ["Drama"] },
    }],
  };
  const movie = {
    title: "Quiet River Returns",
    description: "A family returns home",
    genres: ["Drama"],
    cast: ["Actor A"],
    director: "Director A",
    language: "English",
  };
  for (const score of [
    genreSimilarity(movie, preferences),
    castSimilarity(movie, preferences),
    directorSimilarity(movie, preferences),
    contentSimilarity(movie, preferences),
    languageMatching(movie, preferences),
  ]) assert.ok(score >= 0 && score <= 1);

  assert.equal(genreSimilarity({ genres: ["unknown"] }, preferences), 0);
  assert.equal(castSimilarity({}, preferences), 0);
  assert.equal(directorSimilarity({}, preferences), 0);
  assert.equal(languageMatching({}, preferences), 0);
});

test("feedback similarity rewards liked seeds and applies a bounded disliked-movie penalty", () => {
  const liked = { _id: toId(20), title: "Blue River", description: "A family drama", genres: ["Drama"], cast: ["Actor"] };
  const disliked = { _id: toId(21), title: "Dark River", description: "A family thriller", genres: ["Thriller"], cast: ["Actor X"] };
  const likeCandidate = { _id: toId(22), title: "River Family", description: "A family drama", genres: ["Drama"], cast: ["Actor"] };
  const dislikeCandidate = { _id: toId(23), title: "Dark River Returns", description: "A family thriller", genres: ["Thriller"], cast: ["Actor X"] };
  const preferences = {
    moreLikeSeeds: [{ movie: liked, weight: 2 }],
    dislikedSeeds: [{ movie: disliked, weight: 1 }],
  };
  assert.ok(feedbackSimilarity(likeCandidate, preferences) > 0);
  assert.ok(negativePreferenceSimilarity(dislikeCandidate, preferences) > 0);

  const popularity = popularityScores([likeCandidate, dislikeCandidate]);
  const base = scoreMovie(dislikeCandidate, { ...preferences, dislikedSeeds: [] }, popularity);
  const penalized = scoreMovie(dislikeCandidate, preferences, popularity);
  assert.ok(penalized.negativePenalty > 0);
  assert.ok(penalized.negativePenalty <= 0.25);
  assert.ok(penalized.score < base.score);

  const oldDislike = { ...preferences, dislikedSeeds: [{ movie: disliked, weight: 0.1 }] };
  const recentDislike = { ...preferences, dislikedSeeds: [{ movie: disliked, weight: 1 }] };
  assert.ok(negativePreferenceSimilarity(dislikeCandidate, recentDislike)
    > negativePreferenceSimilarity(dislikeCandidate, oldDislike));
});

test("popularity uses safe log1p normalization for zeros and equal view counts", () => {
  const zeroViews = [{ _id: "a", views: 0 }, { _id: "b", views: 0 }];
  const zeroScores = popularityScores(zeroViews);
  assert.equal(zeroScores.get("a"), 0);
  assert.equal(zeroScores.get("b"), 0);

  const equalViews = [{ _id: "a", views: 12 }, { _id: "b", views: 12 }];
  const equalScores = popularityScores(equalViews);
  assert.equal(equalScores.get("a"), equalScores.get("b"));
  for (const score of [...zeroScores.values(), ...equalScores.values()]) {
    assert.ok(Number.isFinite(score) && score >= 0 && score <= 1);
  }
});

test("candidate retrieval excludes completed, watchlisted and explicit feedback titles before maturity scoring", async () => {
  const completedId = toId(30);
  const watchlistId = toId(31);
  const rejectedId = toId(32);
  const candidateSafe = { _id: toId(33), maturityRating: "7+", views: 10 };
  const candidateUnknown = { _id: toId(34), maturityRating: "TV-14", views: 100 };
  const capture = {};
  const policy = { profileId: String(profileId), maxAge: 7, isKids: true };

  const stubs = [
    [WatchHistory, "distinct", async (field, query) => {
      capture.historyQuery = query;
      assert.equal(field, "movie");
      return [completedId];
    }],
    [Watchlist, "distinct", async (field, query) => {
      capture.watchlistQuery = query;
      return [watchlistId];
    }],
    [RecommendationFeedback, "distinct", async (field, query) => {
      capture.feedbackQuery = query;
      return [rejectedId];
    }],
    [Movie, "find", (query) => {
      capture.movieQuery = query;
      return queryWith([candidateSafe, candidateUnknown]);
    }],
  ];
  const candidates = await withMethodStubs(stubs, () =>
    getEligibleCandidates({ profileId, maturityPolicy: policy, limit: 2000 }));

  assert.deepEqual(capture.historyQuery, { profile: profileId, completedAt: { $ne: null } });
  assert.deepEqual(capture.watchlistQuery, { profile: profileId });
  assert.deepEqual(capture.feedbackQuery, {
    profile: profileId,
    type: { $in: ["NOT_INTERESTED", "ALREADY_WATCHED"] },
  });
  assert.deepEqual(capture.movieQuery._id.$nin, [completedId, watchlistId, rejectedId]);
  assert.deepEqual(capture.movieQuery.maturityRating.$in, ["All", "7+"]);
  assert.deepEqual(candidates, [candidateSafe]);
});

test("empty preference profiles receive deterministic popularity ranking with finite scores", async () => {
  const fixtures = { history: [], watchlist: [], feedback: [] };
  const movieA = { _id: toId(40), title: "A", views: 0, isTop10: false, maturityRating: "13+" };
  const movieB = { _id: toId(41), title: "B", views: 0, isTop10: true, maturityRating: "13+" };
  const candidates = [movieA, movieB];
  const capture = {};
  const stubs = [
    ...preferenceServiceStubs(fixtures, capture),
    [WatchHistory, "distinct", async () => []],
    [Watchlist, "distinct", async () => []],
    [RecommendationFeedback, "distinct", async () => []],
    [Movie, "find", () => queryWith(candidates)],
  ];
  const result = await withMethodStubs(stubs, () => generateDeterministicRecommendations({
    profileId,
    userId: ownerId,
    limit: 20,
    now: fixedNow,
  }));
  assert.equal(result.movies.length, 2);
  assert.equal(result.movies[0].movie._id, movieB._id);
  for (const item of result.movies) {
    assert.ok(Number.isFinite(item.score) && item.score >= 0 && item.score <= 1);
  }
});

test("missing metadata produces finite zero feature scores and deterministic ID ties", () => {
  const preferences = {
    genres: {}, actors: {}, directors: {}, languages: {},
    positiveSeeds: [], moreLikeSeeds: [], dislikedSeeds: [],
  };
  const movies = [{ _id: "b" }, { _id: "a" }];
  const first = rankMovies(movies, preferences);
  const second = rankMovies(movies, preferences);
  assert.deepEqual(first.map((item) => String(item.movie._id)), ["a", "b"]);
  assert.deepEqual(first.map((item) => item.score), second.map((item) => item.score));
  assert.ok(first.every((item) => Number.isFinite(item.score) && item.score >= 0 && item.score <= 1));
});
