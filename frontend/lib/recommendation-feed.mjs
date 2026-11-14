export const normalizeRecommendationMovie = (movie) => ({
  id: typeof movie?._id === "string" ? movie._id : "",
  title: movie.title,
  description: movie.description || "",
  longDescription: movie.longDescription || movie.description || "",
  backdrop: movie.backdrop || "",
  poster: movie.poster || "",
  year: movie.year,
  rating: movie.rating || "",
  duration: movie.duration || "",
  genres: Array.isArray(movie.genres) ? movie.genres : [],
  cast: Array.isArray(movie.cast) ? movie.cast : [],
  ...(typeof movie.match === "number" ? { match: movie.match } : {}),
  isNew: movie.isNew ?? movie.isNewRelease ?? false,
  isTop10: movie.isTop10 ?? false,
  ...(typeof movie.views === "number" ? { views: movie.views } : {}),
  ...(typeof movie.createdAt === "string" ? { createdAt: movie.createdAt } : {}),
  ...(typeof movie.releaseDate === "string" ? { releaseDate: movie.releaseDate } : {}),
  videoUrl: movie.videoUrl || "",
  ...(typeof movie.maturityRating === "string" ? { maturityRating: movie.maturityRating } : {}),
});

export const filterRecommendationMovies = (movies, excludedIds) =>
  movies.filter((movie) => !excludedIds.includes(movie.id));

export class RecommendationFeedCoordinator {
  constructor(requestRecommendations) {
    this.requestRecommendations = requestRecommendations;
    this.listener = () => {};
    this.profileId = null;
    this.key = null;
    this.generation = 0;
    this.retryNumber = 0;
    this.state = { profileId: null, status: "idle", movies: [], error: null };
  }

  setListener(listener) {
    this.listener = listener;
    listener(this.state);
  }

  async load(profileId, refreshVersion = 0, force = false) {
    if (!profileId) {
      this.profileId = null;
      this.key = null;
      this.generation += 1;
      this.state = { profileId: null, status: "idle", movies: [], error: null };
      this.emit();
      return;
    }

    const key = `${profileId}:${refreshVersion}:${force ? ++this.retryNumber : 0}`;
    if (this.profileId === profileId && this.key === key) return;
    this.profileId = profileId;
    this.key = key;
    const generation = ++this.generation;
    this.state = { profileId, status: "loading", movies: [], error: null };
    this.emit();

    try {
      const response = await this.requestRecommendations(profileId);
      if (!this.isCurrent(profileId, key, generation)) return;
      const data = response?.data;
      if (!data?.success || data.profile?.id !== profileId || !Array.isArray(data.movies)) {
        throw new Error("The recommendations response was invalid.");
      }
      this.state = {
        profileId,
        status: data.movies.length > 0 ? "success" : "empty",
        movies: data.movies.map(normalizeRecommendationMovie),
        error: null,
      };
      this.emit();
    } catch (error) {
      if (!this.isCurrent(profileId, key, generation) || isCancellation(error)) return;
      this.state = {
        profileId,
        status: "error",
        movies: [],
        error: "We couldn’t load your recommendations. Please try again.",
      };
      this.emit();
    }
  }

  retry() {
    if (!this.profileId) return Promise.resolve();
    const refreshVersion = this.key?.split(":")[1] || "0";
    return this.load(this.profileId, refreshVersion, true);
  }

  isCurrent(profileId, key, generation) {
    return this.profileId === profileId && this.key === key && this.generation === generation;
  }

  emit() {
    this.listener(this.state);
  }
}

const isCancellation = (error) =>
  error && typeof error === "object" && "code" in error &&
  ["REQUEST_CANCELLED", "PROFILE_CONTEXT_CHANGED"].includes(String(error.code));
