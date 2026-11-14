import { filterMoviesForProfile } from "./profile-maturity.mjs";

export class ProfileMovieFeedCoordinator {
  constructor(request, normalize = (movie) => movie) {
    this.request = request;
    this.normalize = normalize;
    this.generation = 0;
    this.profileId = null;
    this.requestKey = null;
    this.state = emptyState(null, "");
    this.listener = () => {};
  }

  setListener(listener) {
    this.listener = listener;
    listener(this.state);
  }

  async load(profile, requestKey = "", force = false) {
    this.currentProfile = profile || null;
    const profileId = profile?._id || null;
    if (!profileId) {
      this.generation += 1;
      this.profileId = null;
      this.requestKey = null;
      this.state = emptyState(null, "");
      this.emit();
      return;
    }

    if (!force && this.profileId === profileId && this.requestKey === requestKey) return;
    this.profileId = profileId;
    this.requestKey = requestKey;
    const generation = ++this.generation;
    this.state = { profileId, requestKey, status: "loading", movies: [], error: null };
    this.emit();

    try {
      const response = await this.request(profileId, requestKey);
      if (!this.isCurrent(profileId, requestKey, generation)) return;
      const data = response?.data;
      if (!data?.success || !Array.isArray(data.movies) || (data.profile?.id && data.profile.id !== profileId)) {
        throw new Error("The movie response was invalid.");
      }
      const movies = filterMoviesForProfile(data.movies, profile).map(this.normalize);
      this.state = { profileId, requestKey, status: movies.length ? "success" : "empty", movies, error: null };
      this.emit();
    } catch (error) {
      if (!this.isCurrent(profileId, requestKey, generation) || isCancellation(error)) return;
      this.state = { profileId, requestKey, status: "error", movies: [], error };
      this.emit();
    }
  }

  clear() {
    this.generation += 1;
    this.profileId = null;
    this.requestKey = null;
    this.currentProfile = null;
    this.state = emptyState(null, "");
    this.emit();
  }

  retry() {
    if (!this.profileId) return Promise.resolve();
    return this.load(this.currentProfile, this.requestKey, true);
  }

  setCurrentProfile(profile) {
    this.currentProfile = profile;
  }

  isCurrent(profileId, requestKey, generation) {
    return this.profileId === profileId && this.requestKey === requestKey && this.generation === generation;
  }

  emit() { this.listener(this.state); }
}

const emptyState = (profileId, requestKey) => ({
  profileId,
  requestKey,
  status: profileId ? "loading" : "idle",
  movies: [],
  error: null,
});

const isCancellation = (error) => error && typeof error === "object" && "code" in error
  && ["REQUEST_CANCELLED", "PROFILE_CONTEXT_CHANGED"].includes(String(error.code));
