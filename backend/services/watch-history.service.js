import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import Movie from "../models/Movie.js";
import WatchHistory from "../models/WatchHistory.js";
import {
  getProfileMaturityPolicy,
  getAllowedMovieMaturityRatings,
  isMovieAllowedByMaturity,
} from "./maturity-policy.service.js";
import { MAX_MOVIE_DURATION_SECONDS } from "./movie-duration.service.js";

const MAX_LIMIT = 50;
const DEFAULT_CONTINUE_LIMIT = 10;
const DEFAULT_HISTORY_LIMIT = 20;
const MOVIE_FIELDS = "title description longDescription genres cast director language maturityRating year rating duration durationSeconds poster backdrop videoUrl trailerUrl releaseDate views isNewRelease isTop10 match isPublished";

const positiveLimit = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, MAX_LIMIT);
};

export const loadAuthorizedWatchProfile = async (profileId, userId) => {
  const policy = await getProfileMaturityPolicy(profileId, userId);
  if (!policy) throw new ApiError(404, "PROFILE_NOT_FOUND", "Profile not found");
  return policy;
};

const getEligiblePublishedMovie = async (movieId, policy) => {
  const movie = await Movie.findOne({ _id: movieId, isPublished: true }).select(MOVIE_FIELDS).lean();
  if (!movie) throw new ApiError(404, "MOVIE_NOT_FOUND", "Movie not found");
  if (!isMovieAllowedByMaturity(policy, movie.maturityRating)) {
    throw new ApiError(404, "MOVIE_NOT_FOUND", "Movie not found");
  }
  return movie;
};

const assertValidProgress = (progressSeconds, durationSeconds) => {
  if (typeof progressSeconds !== "number" || !Number.isFinite(progressSeconds) || progressSeconds < 0) {
    throw new ApiError(400, "INVALID_PROGRESS", "progressSeconds must be a finite nonnegative number");
  }
  if (durationSeconds != null && (!Number.isSafeInteger(durationSeconds)
    || durationSeconds < 1
    || durationSeconds > MAX_MOVIE_DURATION_SECONDS)) {
    throw new ApiError(400, "INVALID_MOVIE_DURATION", "Movie duration metadata is invalid");
  }
  if (durationSeconds != null && progressSeconds > durationSeconds) {
    throw new ApiError(400, "PROGRESS_EXCEEDS_DURATION", "Progress cannot exceed movie duration");
  }
};

export const updateMovieProgress = async ({ profileId, userId, movieId, progressSeconds }) => {
  const policy = await loadAuthorizedWatchProfile(profileId, userId);
  const movie = await getEligiblePublishedMovie(movieId, policy);
  const trustedDuration = movie.durationSeconds ?? null;
  assertValidProgress(progressSeconds, trustedDuration);

  const history = await WatchHistory.upsertProgress({
    profile: profileId,
    movie: movie._id,
    progressSeconds,
    durationSeconds: trustedDuration,
  });
  await history.populate({ path: "movie", select: MOVIE_FIELDS });
  return history;
};

const makeMovieLookup = (policy) => {
  const allowedRatings = getAllowedMovieMaturityRatings(policy);
  const movieMatch = { isPublished: true };
  if (allowedRatings) movieMatch.maturityRating = { $in: allowedRatings };
  return [
    { $lookup: { from: Movie.collection.name, localField: "movie", foreignField: "_id", as: "movie" } },
    { $unwind: "$movie" },
    { $match: Object.fromEntries(Object.entries(movieMatch).map(([key, value]) => [`movie.${key}`, value])) },
    { $project: { profile: 1, movie: { $mergeObjects: ["$movie", {}] }, progressSeconds: 1, durationSeconds: 1, lastWatchedAt: 1, completedAt: 1, watchCount: 1, createdAt: 1, updatedAt: 1 } },
  ];
};

const queryHistory = async ({ profileId, policy, limit, cursor, continueWatching = false }) => {
  const match = { profile: new mongoose.Types.ObjectId(profileId) };
  if (continueWatching) {
    match.completedAt = null;
    match.progressSeconds = { $gt: 0 };
  }
  if (cursor) {
    match.$or = [
      { lastWatchedAt: { $lt: cursor.lastWatchedAt } },
      { lastWatchedAt: cursor.lastWatchedAt, _id: { $lt: new mongoose.Types.ObjectId(cursor.id) } },
    ];
  }
  const rows = await WatchHistory.aggregate([
    { $match: match },
    { $sort: { lastWatchedAt: -1, _id: -1 } },
    ...makeMovieLookup(policy),
    { $limit: limit + 1 },
  ]);
  return rows;
};

export const getContinueWatching = async ({ profileId, userId, limit }) => {
  const policy = await loadAuthorizedWatchProfile(profileId, userId);
  const rows = await queryHistory({ profileId, policy, limit: positiveLimit(limit, DEFAULT_CONTINUE_LIMIT), continueWatching: true });
  return rows.map(({ _id, ...history }) => ({ _id, ...history }));
};

const encodeCursor = (record) => Buffer.from(JSON.stringify({
  lastWatchedAt: record.lastWatchedAt.toISOString(),
  id: String(record._id),
})).toString("base64url");

export const decodeHistoryCursor = (value) => {
  if (value === undefined) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const date = new Date(parsed.lastWatchedAt);
    if (!Number.isFinite(date.getTime())
      || date.toISOString() !== parsed.lastWatchedAt
      || typeof parsed.id !== "string"
      || !mongoose.isValidObjectId(parsed.id)) throw new Error("invalid cursor");
    return { lastWatchedAt: date, id: parsed.id };
  } catch {
    throw new ApiError(400, "INVALID_CURSOR", "History cursor is invalid");
  }
};

export const getViewingHistory = async ({ profileId, userId, limit, cursor: cursorValue }) => {
  const policy = await loadAuthorizedWatchProfile(profileId, userId);
  const safeLimit = positiveLimit(limit, DEFAULT_HISTORY_LIMIT);
  const cursor = decodeHistoryCursor(cursorValue);
  const rows = await queryHistory({ profileId, policy, limit: safeLimit, cursor });
  const hasMore = rows.length > safeLimit;
  const history = rows.slice(0, safeLimit);
  return {
    history,
    nextCursor: hasMore && history.length ? encodeCursor(history.at(-1)) : null,
  };
};
