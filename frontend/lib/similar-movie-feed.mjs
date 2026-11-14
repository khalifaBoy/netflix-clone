import { normalizeRecommendationMovie } from "./recommendation-feed.mjs";
import { filterMoviesForProfile } from "./profile-maturity.mjs";
import { getMovieWatchPath } from "./movie-navigation.mjs";

export class SimilarMovieFeedCoordinator {
  constructor(request) {
    this.request = request;
    this.listener = () => {};
    this.generation = 0;
    this.profileId = null;
    this.movieId = null;
    this.profile = null;
    this.movie = null;
    this.state = emptyState(null, null, "idle");
  }

  setListener(listener) {
    this.listener = listener;
    listener(this.state);
  }

  async load(profile, movie, force = false) {
    const profileId = profile?._id || null;
    const movieId = movie?.id || null;
    const genres = Array.isArray(movie?.genres) ? [...new Set(movie.genres.filter((genre) => typeof genre === "string" && genre.trim()))] : [];
    if (!profileId || !getMovieWatchPath(movieId) || !genres.length) {
      this.generation += 1;
      this.profileId = profileId;
      this.movieId = movieId;
      this.profile = profile || null;
      this.movie = movie || null;
      this.state = emptyState(profileId, movieId, "empty");
      this.emit();
      return;
    }
    if (!force && this.profileId === profileId && this.movieId === movieId && this.state.status !== "error") return;

    this.profileId = profileId;
    this.movieId = movieId;
    this.profile = profile;
    this.movie = movie;
    const generation = ++this.generation;
    this.state = emptyState(profileId, movieId, "loading");
    this.emit();

    try {
      const movies = await this.request(profileId, genres);
      if (!this.isCurrent(profileId, movieId, generation)) return;
      if (!Array.isArray(movies)) throw new Error("The similar movies response was invalid.");
      const seedGenres = new Set(genres.map((genre) => genre.trim().toLocaleLowerCase()));
      const seen = new Set([movieId]);
      const normalized = filterMoviesForProfile(movies, profile)
        .map(normalizeRecommendationMovie)
        .filter((candidate) => {
          if (!getMovieWatchPath(candidate.id) || seen.has(candidate.id)) return false;
          seen.add(candidate.id);
          return true;
        })
        .map((candidate, index) => ({
          candidate,
          index,
          overlap: candidate.genres.reduce((count, genre) => count + (seedGenres.has(genre.toLocaleLowerCase()) ? 1 : 0), 0),
        }))
        .sort((left, right) => right.overlap - left.overlap || left.index - right.index)
        .slice(0, 12)
        .map(({ candidate }) => candidate);
      this.state = { profileId, movieId, status: normalized.length ? "success" : "empty", movies: normalized, error: null };
      this.emit();
    } catch (error) {
      if (!this.isCurrent(profileId, movieId, generation) || this.isCancellation(error)) return;
      this.state = { profileId, movieId, status: "error", movies: [], error: "Similar movies could not be loaded." };
      this.emit();
    }
  }

  retry() {
    return this.profile && this.movie ? this.load(this.profile, this.movie, true) : Promise.resolve();
  }

  clear() {
    this.generation += 1;
    this.profileId = null;
    this.movieId = null;
    this.profile = null;
    this.movie = null;
    this.state = emptyState(null, null, "idle");
    this.emit();
  }

  isCurrent(profileId, movieId, generation) {
    return this.profileId === profileId && this.movieId === movieId && this.generation === generation;
  }

  isCancellation(error) {
    return error && typeof error === "object" && "code" in error
      && ["REQUEST_CANCELLED", "PROFILE_CONTEXT_CHANGED"].includes(String(error.code));
  }

  emit() { this.listener(this.state); }
}

const emptyState = (profileId, movieId, status) => ({ profileId, movieId, status, movies: [], error: null });
