import { getMovieWatchPath } from "./movie-navigation.mjs";

export class ContinueWatchingFeedCoordinator {
  constructor(request) {
    this.request = request;
    this.generation = 0;
    this.profileId = null;
    this.state = emptyState(null, "idle");
    this.listener = () => {};
  }

  setListener(listener) {
    this.listener = listener;
    listener(this.state);
  }

  async load(profileId, force = false) {
    if (!profileId) {
      this.clear();
      return;
    }
    if (this.profileId === profileId && this.state.status === "loading") return;
    if (!force && this.profileId === profileId && this.state.status !== "error") return;

    this.profileId = profileId;
    const generation = ++this.generation;
    this.state = { profileId, status: "loading", history: [], error: null };
    this.emit();

    try {
      const response = await this.request(profileId);
      if (!this.isCurrent(profileId, generation)) return;
      const data = response?.data;
      if (!data?.success || !Array.isArray(data.history)) {
        throw new Error("The Continue Watching response was invalid.");
      }
      const history = data.history.filter((record) => {
        const movieId = typeof record?.movie === "string" ? record.movie : record?.movie?._id;
        return Boolean(getMovieWatchPath(movieId))
          && !record.completedAt
          && typeof record.progressSeconds === "number"
          && Number.isFinite(record.progressSeconds)
          && record.progressSeconds > 0;
      });
      this.state = { profileId, status: history.length ? "success" : "empty", history, error: null };
      this.emit();
    } catch (error) {
      if (!this.isCurrent(profileId, generation) || isCancellation(error)) return;
      this.state = { profileId, status: "error", history: [], error: "Continue Watching could not be loaded." };
      this.emit();
    }
  }

  retry() {
    return this.profileId ? this.load(this.profileId, true) : Promise.resolve();
  }

  clear() {
    this.generation += 1;
    this.profileId = null;
    this.state = emptyState(null, "idle");
    this.emit();
  }

  isCurrent(profileId, generation) {
    return this.profileId === profileId && this.generation === generation;
  }

  emit() {
    this.listener(this.state);
  }
}

const emptyState = (profileId, status) => ({ profileId, status, history: [], error: null });
const isCancellation = (error) => error && typeof error === "object" && "code" in error
  && ["REQUEST_CANCELLED", "PROFILE_CONTEXT_CHANGED"].includes(String(error.code));
