import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import WatchHistory from "../models/WatchHistory.js";
import RecommendationFeedback from "../models/RecommendationFeedback.js";
import RecommendationInteraction from "../models/RecommendationInteraction.js";
import Profile from "../models/Profile.js";
import {
  getProfileMaturityPolicy,
  isMovieAllowedByMaturity,
} from "../services/maturity-policy.service.js";

const profileA = new mongoose.Types.ObjectId();
const profileB = new mongoose.Types.ObjectId();
const movieId = new mongoose.Types.ObjectId();

const hasUniqueProfileMovieIndex = (schema) => schema.indexes().some(([keys, options]) =>
  keys.profile === 1 && keys.movie === 1 && options.unique === true);

test("watch history validates progress and references", async () => {
  const valid = new WatchHistory({
    profile: profileA,
    movie: movieId,
    progressSeconds: 80,
    durationSeconds: 100,
  });
  await assert.doesNotReject(valid.validate());

  const invalid = new WatchHistory({
    profile: profileA,
    movie: movieId,
    progressSeconds: 101,
    durationSeconds: 100,
  });
  await assert.rejects(invalid.validate(), (error) => Boolean(error.errors.progressSeconds));
  assert.equal(hasUniqueProfileMovieIndex(WatchHistory.schema), true);
});

test("watch history upsert scopes updates to the profile and movie", async () => {
  const originalFindOne = WatchHistory.findOne;
  const original = WatchHistory.findOneAndUpdate;
  let captured;
  WatchHistory.findOne = () => ({
    select() { return this; },
    lean: async () => null,
  });
  WatchHistory.findOneAndUpdate = (...args) => {
    captured = args;
    return Promise.resolve({});
  };
  try {
    await WatchHistory.upsertProgress({
      profile: profileA,
      movie: movieId,
      progressSeconds: 30,
      durationSeconds: 100,
    });
  } finally {
    WatchHistory.findOne = originalFindOne;
    WatchHistory.findOneAndUpdate = original;
  }

  assert.equal(String(captured[0].profile), String(profileA));
  assert.equal(String(captured[0].movie), String(movieId));
  assert.equal(captured[2].upsert, true);
  assert.equal(captured[2].runValidators, true);
  assert.equal(Object.hasOwn(captured[1], "$inc"), false);
  assert.equal(Object.hasOwn(captured[1].$set, "completedAt"), false);
});

test("feedback accepts only supported types and upserts per profile/movie", async () => {
  for (const type of ["NOT_INTERESTED", "MORE_LIKE_THIS", "ALREADY_WATCHED"]) {
    await assert.doesNotReject(new RecommendationFeedback({ profile: profileA, movie: movieId, type }).validate());
  }
  await assert.rejects(
    new RecommendationFeedback({ profile: profileA, movie: movieId, type: "LIKED" }).validate(),
  );
  assert.equal(hasUniqueProfileMovieIndex(RecommendationFeedback.schema), true);

  const original = RecommendationFeedback.findOneAndUpdate;
  let captured;
  RecommendationFeedback.findOneAndUpdate = (...args) => {
    captured = args;
    return Promise.resolve({});
  };
  try {
    await RecommendationFeedback.upsertForProfile({
      profile: profileB,
      movie: movieId,
      type: "MORE_LIKE_THIS",
    });
  } finally {
    RecommendationFeedback.findOneAndUpdate = original;
  }

  assert.equal(String(captured[0].profile), String(profileB));
  assert.equal(String(captured[0].movie), String(movieId));
  assert.equal(captured[1].$set.type, "MORE_LIKE_THIS");
  assert.equal(captured[2].upsert, true);
});

test("interaction events validate type/position and index profile timelines", async () => {
  const valid = new RecommendationInteraction({
    profile: profileA,
    movie: movieId,
    eventType: "IMPRESSION",
    position: 1,
  });
  await assert.doesNotReject(valid.validate());
  await assert.rejects(new RecommendationInteraction({
    profile: profileA,
    movie: movieId,
    eventType: "SHARE",
    position: 0,
  }).validate());
  assert.ok(RecommendationInteraction.schema.indexes().some(([keys]) =>
    keys.profile === 1 && keys.createdAt === -1));
});

test("maturity policy reads profile settings from the owner-scoped database query", async () => {
  const original = Profile.findOne;
  let captured;
  Profile.findOne = (query) => {
    captured = query;
    return { lean: async () => ({ _id: profileA, isKids: false, maturityLevel: "13+" }) };
  };
  try {
    const policy = await getProfileMaturityPolicy(profileA, new mongoose.Types.ObjectId());
    assert.equal(policy.maxAge, 13);
    assert.equal(captured._id, profileA);
    assert.ok(captured.user);
    assert.equal(captured.isActive, true);
  } finally {
    Profile.findOne = original;
  }
});

test("kids and non-kids maturity limits reject unknown movie ratings", async () => {
  const original = Profile.findOne;
  let storedProfile = { _id: profileA, isKids: true, maturityLevel: "18+" };
  Profile.findOne = () => ({ lean: async () => storedProfile });
  try {
    const kids = await getProfileMaturityPolicy(profileA, profileA);
    assert.equal(isMovieAllowedByMaturity(kids, "All"), true);
    assert.equal(isMovieAllowedByMaturity(kids, "7+"), true);
    assert.equal(isMovieAllowedByMaturity(kids, "13+"), false);
    assert.equal(isMovieAllowedByMaturity(kids, "TV-14"), false);

    storedProfile = { _id: profileA, isKids: false, maturityLevel: "13+" };
    const teen = await getProfileMaturityPolicy(profileA, profileA);
    assert.equal(isMovieAllowedByMaturity(teen, "13+"), true);
    assert.equal(isMovieAllowedByMaturity(teen, "16+"), false);
    assert.equal(isMovieAllowedByMaturity(teen, "PG-13"), false);

    storedProfile = { _id: profileA, isKids: false, maturityLevel: "All" };
    const unrestricted = await getProfileMaturityPolicy(profileA, profileA);
    assert.equal(isMovieAllowedByMaturity(unrestricted, "TV-MA"), true);
  } finally {
    Profile.findOne = original;
  }
});
