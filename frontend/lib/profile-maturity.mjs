const ORDER = Object.freeze({ All: 0, "7+": 7, "13+": 13, "16+": 16, "18+": 18 });
const PROFILE_LIMIT = Object.freeze({ All: Infinity, "7+": 7, "13+": 13, "16+": 16, "18+": 18 });

export const effectiveMaturityLimit = (profile) => {
  if (!profile || typeof profile.maturityLevel !== "string" || !(profile.maturityLevel in PROFILE_LIMIT)) return -1;
  const configured = PROFILE_LIMIT[profile.maturityLevel];
  return profile.isKids ? Math.min(configured, PROFILE_LIMIT["7+"]) : configured;
};

export const isMovieAllowedForProfile = (movie, profile) => {
  if (!profile || !movie || typeof movie.maturityRating !== "string" || !(movie.maturityRating in ORDER)) return false;
  const limit = effectiveMaturityLimit(profile);
  return limit >= 0 && ORDER[movie.maturityRating] <= limit;
};

export const canShowStaticCatalog = (profile) => Boolean(profile && !profile.isKids && profile.maturityLevel === "All");

export const canPlayVerifiedMovie = (movie, profile) => isMovieAllowedForProfile(movie, profile);

export const filterMoviesForProfile = (movies, profile) =>
  movies.filter((movie) => isMovieAllowedForProfile(movie, profile));
