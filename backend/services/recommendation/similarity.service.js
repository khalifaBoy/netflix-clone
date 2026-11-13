const clamp01 = (value) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
const finiteNonNegative = (value) => Number.isFinite(value) ? Math.max(0, value) : 0;
const normalize = (value) => typeof value === "string"
  ? value.trim().normalize("NFKC").toLowerCase()
  : "";

const uniqueNormalized = (values) => [...new Set((values || []).map(normalize).filter(Boolean))];

const weightedFeatureMatch = (candidateValues, preferenceWeights = {}) => {
  const features = uniqueNormalized(candidateValues);
  const entries = Object.entries(preferenceWeights)
    .map(([key, weight]) => [normalize(key), finiteNonNegative(weight)])
    .filter(([key, weight]) => key && weight > 0);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (!total || !features.length) return 0;

  const weights = new Map(entries);
  const matched = features.reduce((sum, feature) => sum + (weights.get(feature) || 0), 0);
  return clamp01(matched / total);
};

export const genreSimilarity = (movie, preferences) =>
  weightedFeatureMatch(movie?.genres, preferences?.genres);

export const castSimilarity = (movie, preferences) =>
  weightedFeatureMatch(movie?.cast, preferences?.actors);

export const directorSimilarity = (movie, preferences) => {
  const director = normalize(movie?.director);
  return director ? weightedFeatureMatch([director], preferences?.directors) : 0;
};

export const languageMatching = (movie, preferences) => {
  const language = normalize(movie?.language);
  return language ? weightedFeatureMatch([language], preferences?.languages) : 0;
};

const contentTokens = (movie) => {
  const text = [movie?.title, movie?.description, movie?.longDescription]
    .filter((part) => typeof part === "string")
    .join(" ")
    .normalize("NFKC")
    .toLowerCase();
  return new Set(text.match(/[\p{L}\p{N}]+/gu) || []);
};

const jaccard = (left, right) => {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  const union = left.size + right.size - intersection;
  return union ? clamp01(intersection / union) : 0;
};

const weightedSeedSimilarity = (movie, seeds, similarity) => {
  const validSeeds = (seeds || []).filter((seed) => seed?.movie && finiteNonNegative(seed.weight) > 0);
  const total = validSeeds.reduce((sum, seed) => sum + finiteNonNegative(seed.weight), 0);
  if (!total) return 0;
  const score = validSeeds.reduce((sum, seed) =>
    sum + clamp01(similarity(movie, seed.movie)) * finiteNonNegative(seed.weight), 0) / total;
  return clamp01(score);
};

export const contentSimilarity = (movie, preferences) => {
  const candidateTokens = contentTokens(movie);
  return weightedSeedSimilarity(movie, preferences?.positiveSeeds, (candidate, seed) =>
    jaccard(candidateTokens, contentTokens(seed)));
};

const arraySimilarity = (left, right) => {
  const a = new Set(uniqueNormalized(left));
  const b = new Set(uniqueNormalized(right));
  return jaccard(a, b);
};

export const similarityBetweenMovies = (candidate, seed) => {
  if (!candidate || !seed) return 0;
  const features = [
    arraySimilarity(candidate.genres, seed.genres),
    arraySimilarity(candidate.cast, seed.cast),
    normalize(candidate.director) && normalize(seed.director)
      ? Number(normalize(candidate.director) === normalize(seed.director)) : 0,
    jaccard(contentTokens(candidate), contentTokens(seed)),
    normalize(candidate.language) && normalize(seed.language)
      ? Number(normalize(candidate.language) === normalize(seed.language)) : 0,
  ];
  const weights = [0.30, 0.25, 0.15, 0.20, 0.10];
  return clamp01(features.reduce((sum, score, index) => sum + score * weights[index], 0));
};

export const feedbackSimilarity = (movie, preferences) =>
  weightedSeedSimilarity(movie, preferences?.moreLikeSeeds, similarityBetweenMovies);

export const negativePreferenceSimilarity = (movie, preferences) => {
  const maxSimilarity = (preferences?.dislikedSeeds || []).reduce((max, seed) => {
    if (!seed?.movie) return max;
    const recencyStrength = clamp01(finiteNonNegative(seed.weight));
    return Math.max(max, similarityBetweenMovies(movie, seed.movie) * recencyStrength);
  }, 0);
  return clamp01(maxSimilarity);
};

export const popularityScores = (movies) => {
  const valid = movies.map((movie) => {
    const views = finiteNonNegative(movie?.views);
    return { movie, logViews: Math.log1p(views) };
  });
  const maxLogViews = valid.reduce((max, item) =>
    Number.isFinite(item.logViews) ? Math.max(max, item.logViews) : max, 0);

  return new Map(valid.map(({ movie, logViews }) => {
    // View normalization is relative to this bounded candidate set. Adding a
    // higher-view candidate can lower peers' normalized view components.
    const viewScore = maxLogViews > 0 ? clamp01(logViews / maxLogViews) : 0;
    const topTenSignal = movie?.isTop10 === true ? 1 : 0;
    const score = clamp01(0.9 * viewScore + 0.1 * topTenSignal);
    return [String(movie?._id ?? movie?.id ?? ""), score];
  }));
};

export { clamp01, normalize };
