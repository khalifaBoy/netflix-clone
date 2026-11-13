import ApiError from "../utils/ApiError.js";
import Movie from "../models/Movie.js";
import RecommendationFeedback from "../models/RecommendationFeedback.js";
import { getProfileMaturityPolicy, isMovieAllowedByMaturity } from "./maturity-policy.service.js";

const getOwnedActiveProfilePolicy = async (profileId, userId) => {
  const policy = await getProfileMaturityPolicy(profileId, userId);
  if (!policy) throw new ApiError(404, "PROFILE_NOT_FOUND", "Profile not found");
  return policy;
};

const getEligibleMovie = async (movieId, policy) => {
  const movie = await Movie.findOne({ _id: movieId, isPublished: true })
    .select("_id maturityRating")
    .lean();
  if (!movie || !isMovieAllowedByMaturity(policy, movie.maturityRating)) {
    throw new ApiError(404, "MOVIE_NOT_FOUND", "Movie not found");
  }
  return movie;
};

export const saveRecommendationFeedback = async ({ profileId, userId, movieId, type }) => {
  const policy = await getOwnedActiveProfilePolicy(profileId, userId);
  const movie = await getEligibleMovie(movieId, policy);
  return RecommendationFeedback.upsertForProfile({
    profile: profileId,
    movie: movie._id,
    type,
  });
};

export const deleteRecommendationFeedback = async ({ profileId, userId, movieId }) => {
  await getOwnedActiveProfilePolicy(profileId, userId);
  await RecommendationFeedback.findOneAndDelete({ profile: profileId, movie: movieId });
};
