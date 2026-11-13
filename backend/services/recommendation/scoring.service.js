import {
  castSimilarity,
  contentSimilarity,
  directorSimilarity,
  feedbackSimilarity,
  genreSimilarity,
  languageMatching,
  negativePreferenceSimilarity,
  popularityScores,
} from "./similarity.service.js";

export const DEFAULT_RECOMMENDATION_WEIGHTS = Object.freeze({
  genre: 0.25,
  cast: 0.20,
  content: 0.12,
  director: 0.08,
  language: 0.10,
  popularity: 0.15,
  feedback: 0.10,
});

export const DEFAULT_NEGATIVE_PENALTY_MAX = 0.25;

export const normalizeWeights = (overrides = {}) => {
  const weights = {};
  for (const [key, defaultWeight] of Object.entries(DEFAULT_RECOMMENDATION_WEIGHTS)) {
    const value = Object.hasOwn(overrides, key) ? Number(overrides[key]) : defaultWeight;
    weights[key] = Number.isFinite(value) && value >= 0 ? value : defaultWeight;
  }
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) return { ...DEFAULT_RECOMMENDATION_WEIGHTS };
  return Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, value / total]));
};

const bounded = (value) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
const movieId = (movie) => String(movie?._id ?? movie?.id ?? "");

const compareIds = (left, right) => {
  const a = movieId(left);
  const b = movieId(right);
  return a < b ? -1 : a > b ? 1 : 0;
};

export const scoreMovie = (movie, preferences, popularityById, {
  weights: weightOverrides,
  negativePenaltyMax = DEFAULT_NEGATIVE_PENALTY_MAX,
} = {}) => {
  const weights = normalizeWeights(weightOverrides);
  const components = {
    genre: bounded(genreSimilarity(movie, preferences)),
    cast: bounded(castSimilarity(movie, preferences)),
    content: bounded(contentSimilarity(movie, preferences)),
    director: bounded(directorSimilarity(movie, preferences)),
    language: bounded(languageMatching(movie, preferences)),
    popularity: bounded(popularityById.get(movieId(movie)) || 0),
    feedback: bounded(feedbackSimilarity(movie, preferences)),
  };
  const negativeSimilarity = bounded(negativePreferenceSimilarity(movie, preferences));
  const maxPenalty = Number.isFinite(negativePenaltyMax)
    ? Math.min(1, Math.max(0, negativePenaltyMax))
    : DEFAULT_NEGATIVE_PENALTY_MAX;
  const negativePenalty = maxPenalty * negativeSimilarity;
  const weightedScore = Object.entries(weights).reduce(
    (sum, [key, weight]) => sum + components[key] * weight,
    0,
  );

  return {
    movie,
    score: bounded(Math.max(0, weightedScore - negativePenalty)),
    components,
    negativeSimilarity,
    negativePenalty,
  };
};

export const rankMovies = (movies, preferences, options = {}) => {
  const unique = new Map();
  for (const movie of movies || []) {
    const id = movieId(movie);
    if (id && !unique.has(id)) unique.set(id, movie);
  }
  const candidates = [...unique.values()];
  const popularityById = popularityScores(candidates);

  return candidates
    .map((movie) => scoreMovie(movie, preferences, popularityById, options))
    .sort((left, right) => right.score - left.score || compareIds(left.movie, right.movie));
};
