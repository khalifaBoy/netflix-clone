import RecommendationFeedback from "../../models/RecommendationFeedback.js";
import WatchHistory from "../../models/WatchHistory.js";
import Watchlist from "../../models/Watchlist.js";
import { requireProfileMaturityPolicy } from "../maturity-policy.service.js";

export const PREFERENCE_CONFIG = Object.freeze({
  halfLifeDays: 90,
  completedViewingWeight: 3,
  partialViewingWeight: 1,
  watchlistWeight: 0.75,
  moreLikeThisWeight: 2,
  notInterestedWeight: 1,
  profileLanguageWeight: 0.5,
  maxRewatchMultiplier: 1.5,
  rewatchMultiplierPerLogCount: 0.15,
  maxHistorySignals: 500,
  maxWatchlistSignals: 500,
  maxFeedbackSignals: 500,
});

const MOVIE_FIELDS = "title description longDescription genres cast director language maturityRating views isTop10";

const normalizeDate = (value, now) => {
  const time = new Date(value ?? now).getTime();
  return Number.isFinite(time) ? Math.min(time, now) : now;
};

export const recencyWeight = (date, { now = Date.now(), halfLifeDays = PREFERENCE_CONFIG.halfLifeDays } = {}) => {
  if (!Number.isFinite(halfLifeDays) || halfLifeDays <= 0) return 0;
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(nowMs)) return 0;
  const ageDays = Math.max(0, (nowMs - normalizeDate(date, nowMs)) / 86_400_000);
  const value = 2 ** (-ageDays / halfLifeDays);
  return Number.isFinite(value) ? value : 0;
};

const bounded = (value, min = 0, max = 1) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;

const viewingStrength = (record) => {
  const count = Number.isFinite(record.watchCount) ? Math.max(0, record.watchCount) : 0;
  const rewatchMultiplier = Math.min(
    PREFERENCE_CONFIG.maxRewatchMultiplier,
    1 + PREFERENCE_CONFIG.rewatchMultiplierPerLogCount * Math.log1p(Math.max(0, count - 1)),
  );

  // completedAt is the explicit completion signal. A full progress ratio alone
  // never converts a partial/abandoned record into completed viewing.
  if (record.completedAt) return PREFERENCE_CONFIG.completedViewingWeight * rewatchMultiplier;

  const progress = Number.isFinite(record.progressSeconds) ? Math.max(0, record.progressSeconds) : 0;
  const duration = Number.isFinite(record.durationSeconds) ? Math.max(0, record.durationSeconds) : 0;
  const viewedFraction = duration > 0 ? bounded(progress / duration) : 0;
  return PREFERENCE_CONFIG.partialViewingWeight * viewedFraction * rewatchMultiplier;
};

const addPreference = (target, key, weight) => {
  if (typeof key !== "string" || !Number.isFinite(weight) || weight <= 0) return;
  const normalized = key.trim().normalize("NFKC").toLowerCase();
  if (!normalized) return;
  target[normalized] = (target[normalized] || 0) + weight;
};

const addMovieFeatures = (preferences, movie, weight) => {
  if (!movie || weight <= 0) return;
  for (const genre of movie.genres || []) addPreference(preferences.genres, genre, weight);
  for (const actor of movie.cast || []) addPreference(preferences.actors, actor, weight);
  addPreference(preferences.directors, movie.director, weight);
  addPreference(preferences.languages, movie.language, weight);
};

const makeSeed = (movie, weight, date) => movie ? ({
  movie,
  weight: Number.isFinite(weight) ? Math.max(0, weight) : 0,
  date,
}) : null;

const populatedHistoryQuery = (profileId) => WatchHistory.find({ profile: profileId })
  .select("movie progressSeconds durationSeconds lastWatchedAt completedAt watchCount")
  .sort({ lastWatchedAt: -1 })
  .limit(PREFERENCE_CONFIG.maxHistorySignals)
  .populate({ path: "movie", select: MOVIE_FIELDS })
  .lean();

const populatedWatchlistQuery = (profileId) => Watchlist.find({ profile: profileId })
  .select("movie addedAt")
  .sort({ addedAt: -1 })
  .limit(PREFERENCE_CONFIG.maxWatchlistSignals)
  .populate({ path: "movie", select: MOVIE_FIELDS })
  .lean();

const populatedFeedbackQuery = (profileId) => RecommendationFeedback.find({
  profile: profileId,
  type: { $in: ["MORE_LIKE_THIS", "NOT_INTERESTED"] },
})
  .select("movie type createdAt updatedAt")
  .sort({ updatedAt: -1 })
  .limit(PREFERENCE_CONFIG.maxFeedbackSignals)
  .populate({ path: "movie", select: MOVIE_FIELDS })
  .lean();

export const extractProfilePreferences = async ({ profileId, userId, now = Date.now() }) => {
  const maturityPolicy = await requireProfileMaturityPolicy(profileId, userId);

  const [history, watchlist, feedback] = await Promise.all([
    populatedHistoryQuery(profileId),
    populatedWatchlistQuery(profileId),
    populatedFeedbackQuery(profileId),
  ]);

  const preferences = {
    profileId: String(profileId),
    maturityPolicy,
    genres: {},
    actors: {},
    directors: {},
    languages: {},
    positiveSeeds: [],
    moreLikeSeeds: [],
    dislikedSeeds: [],
    completedMovieIds: [],
  };
  // The saved profile language is a low-strength prior, not a request value.
  addPreference(preferences.languages, maturityPolicy.language, PREFERENCE_CONFIG.profileLanguageWeight);

  for (const record of history) {
    const movie = record.movie;
    if (!movie) continue;
    const movieId = String(movie._id);
    const completed = Boolean(record.completedAt);
    if (completed) preferences.completedMovieIds.push(movieId);

    const weight = viewingStrength(record) * recencyWeight(record.lastWatchedAt, { now });
    addMovieFeatures(preferences, movie, weight);
    if (weight > 0) preferences.positiveSeeds.push(makeSeed(movie, weight, record.lastWatchedAt));
  }

  for (const item of watchlist) {
    const movie = item.movie;
    if (!movie) continue;
    const weight = PREFERENCE_CONFIG.watchlistWeight * recencyWeight(item.addedAt, { now });
    addMovieFeatures(preferences, movie, weight);
    if (weight > 0) preferences.positiveSeeds.push(makeSeed(movie, weight, item.addedAt));
  }

  for (const item of feedback) {
    const movie = item.movie;
    if (!movie) continue;
    const date = item.updatedAt || item.createdAt;
    const recency = recencyWeight(date, { now });
    if (item.type === "MORE_LIKE_THIS") {
      const weight = PREFERENCE_CONFIG.moreLikeThisWeight * recency;
      addMovieFeatures(preferences, movie, weight);
      if (weight > 0) {
        const seed = makeSeed(movie, weight, date);
        preferences.positiveSeeds.push(seed);
        preferences.moreLikeSeeds.push(seed);
      }
    } else if (item.type === "NOT_INTERESTED") {
      const weight = PREFERENCE_CONFIG.notInterestedWeight * recency;
      if (weight > 0) preferences.dislikedSeeds.push(makeSeed(movie, weight, date));
    }
  }

  return preferences;
};
