import Profile from "../models/Profile.js";
import ApiError from "../utils/ApiError.js";

// These are the exact maturity labels already used by Profile and the movie
// upload form. No equivalences are inferred for legacy content labels such as
// PG-13, R, TV-14, or TV-MA.
const MOVIE_MATURITY_AGE = Object.freeze({
  All: 0,
  "7+": 7,
  "13+": 13,
  "16+": 16,
  "18+": 18,
});
const PROFILE_MATURITY_LIMIT = Object.freeze({
  All: Infinity,
  "7+": 7,
  "13+": 13,
  "16+": 16,
  "18+": 18,
});

const hasOwnCanonicalValue = (values, value) =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(values, value);

const createPolicyFromStoredProfile = (profile) => {
  if (!profile || typeof profile.isKids !== "boolean") return null;

  const profileLimit = hasOwnCanonicalValue(PROFILE_MATURITY_LIMIT, profile.maturityLevel)
    ? PROFILE_MATURITY_LIMIT[profile.maturityLevel]
    : undefined;
  // Invalid legacy profile settings fail closed instead of becoming unrestricted.
  if (profileLimit === undefined) {
    return Object.freeze({
      profileId: String(profile._id),
      maxAge: -1,
      isKids: profile.isKids,
      language: profile.language,
      profileName: profile.name,
    });
  }

  return Object.freeze({
    profileId: String(profile._id),
    maxAge: profile.isKids ? Math.min(profileLimit, PROFILE_MATURITY_LIMIT["7+"]) : profileLimit,
    isKids: profile.isKids,
    language: profile.language,
    profileName: profile.name,
  });
};

/** Load maturity settings from an active profile owned by the authenticated user. */
export const getProfileMaturityPolicy = async (profileId, userId) => {
  if (!profileId || !userId) return null;

  const profile = await Profile.findOne({
    _id: profileId,
    user: userId,
    isActive: true,
  }).lean();

  return createPolicyFromStoredProfile(profile);
};

/** Load an active profile's policy and reject missing or foreign profiles consistently. */
export const requireProfileMaturityPolicy = async (profileId, userId) => {
  if (!profileId) throw new ApiError(400, "PROFILE_REQUIRED", "profileId is required");
  if (!userId) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required");
  const policy = await getProfileMaturityPolicy(profileId, userId);
  if (!policy) throw new ApiError(404, "PROFILE_NOT_FOUND", "Profile not found");
  return policy;
};

/** Use only with a policy returned by getProfileMaturityPolicy. */
export const isMovieAllowedByMaturity = (policy, maturityRating) => {
  if (!policy || !hasOwnCanonicalValue(MOVIE_MATURITY_AGE, maturityRating)) return false;
  const movieAge = MOVIE_MATURITY_AGE[maturityRating];
  // Restricted profiles never receive titles with missing or unsupported ratings.
  if (movieAge === undefined || policy.maxAge < 0) return false;
  if (policy.maxAge === Infinity) return true;
  return movieAge <= policy.maxAge;
};

export const filterMoviesByMaturity = (policy, movies) =>
  movies.filter((movie) => isMovieAllowedByMaturity(policy, movie.maturityRating));

export const getAllowedMovieMaturityRatings = (policy) => {
  if (!policy || policy.maxAge < 0) return [];

  return Object.entries(MOVIE_MATURITY_AGE)
    .filter(([, age]) => age <= policy.maxAge)
    .map(([rating]) => rating);
};

export const MATURITY_RATINGS = Object.freeze(Object.keys(MOVIE_MATURITY_AGE));
