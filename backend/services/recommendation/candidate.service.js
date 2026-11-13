import ApiError from "../../utils/ApiError.js";
import Movie from "../../models/Movie.js";
import RecommendationFeedback from "../../models/RecommendationFeedback.js";
import WatchHistory from "../../models/WatchHistory.js";
import Watchlist from "../../models/Watchlist.js";
import {
  filterMoviesByMaturity,
  getAllowedMovieMaturityRatings,
} from "../maturity-policy.service.js";

export const CANDIDATE_CONFIG = Object.freeze({
  defaultLimit: 500,
  maxLimit: 1000,
  feedbackExclusions: ["NOT_INTERESTED", "ALREADY_WATCHED"],
});

const CANDIDATE_FIELDS = [
  "_id", "title", "description", "longDescription", "genres", "cast", "director",
  "language", "maturityRating", "views", "isTop10", "isNewRelease", "match",
  "year", "rating", "duration", "backdrop", "poster", "videoUrl", "trailerUrl", "releaseDate",
].join(" ");

const boundedLimit = (limit) => {
  const parsed = Number(limit);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return CANDIDATE_CONFIG.defaultLimit;
  return Math.min(parsed, CANDIDATE_CONFIG.maxLimit);
};

const uniqueIds = (...idGroups) => {
  const ids = new Map();
  for (const group of idGroups) {
    for (const id of group || []) ids.set(String(id), id);
  }
  return [...ids.values()];
};

export const getEligibleCandidates = async ({ profileId, maturityPolicy, limit }) => {
  if (!profileId || !maturityPolicy || String(maturityPolicy.profileId) !== String(profileId)) {
    throw new ApiError(403, "PROFILE_POLICY_MISMATCH", "Profile policy is unavailable");
  }

  const allowedRatings = getAllowedMovieMaturityRatings(maturityPolicy);
  if (allowedRatings && allowedRatings.length === 0) return [];

  const [completedMovieIds, watchlistMovieIds, feedbackMovieIds] = await Promise.all([
    WatchHistory.distinct("movie", { profile: profileId, completedAt: { $ne: null } }),
    Watchlist.distinct("movie", { profile: profileId }),
    RecommendationFeedback.distinct("movie", {
      profile: profileId,
      type: { $in: CANDIDATE_CONFIG.feedbackExclusions },
    }),
  ]);

  const excludedIds = uniqueIds(completedMovieIds, watchlistMovieIds, feedbackMovieIds);
  const query = { isPublished: true };
  if (excludedIds.length) query._id = { $nin: excludedIds };
  if (allowedRatings) query.maturityRating = { $in: allowedRatings };

  const movies = await Movie.find(query)
    .select(CANDIDATE_FIELDS)
    .sort({ views: -1, _id: 1 })
    .limit(boundedLimit(limit))
    .lean();

  // Keep the policy as a post-query guard if query construction changes later.
  return filterMoviesByMaturity(maturityPolicy, movies);
};
