/**
 * Coordinates profile-scoped optimistic feedback mutations. The API and state
 * listener are injected so tests exercise the same async orchestration used by
 * the React provider.
 */
export class RecommendationFeedbackCoordinator {
  constructor(api) {
    this.api = api;
    this.listener = () => {};
    this.generation = 0;
    this.pendingKeys = new Set();
    this.state = emptyState(null);
  }

  setListener(listener) {
    this.listener = listener;
    listener(this.state);
  }

  setProfile(profileId) {
    if (this.state.profileId === profileId) return;
    this.generation += 1;
    this.state = emptyState(profileId);
    this.emit();
  }

  submit(movieId, type, expectedProfileId = this.state.profileId) {
    return this.mutate(movieId, type, expectedProfileId);
  }

  remove(movieId, expectedProfileId = this.state.profileId) {
    return this.mutate(movieId, null, expectedProfileId);
  }

  async mutate(movieId, type, expectedProfileId) {
    const profileId = this.state.profileId;
    if (!profileId || profileId !== expectedProfileId || !movieId) return;
    const key = `${profileId}:${movieId}`;
    if (this.pendingKeys.has(key)) return;

    const priorType = this.state.feedback[movieId] || null;
    if (priorType === type) type = null;
    const nextType = type;
    const requestGeneration = this.generation;
    this.pendingKeys.add(key);
    this.state = {
      ...optimisticFeedbackState(this.state, movieId, nextType),
      pending: add(this.state.pending, movieId),
      errors: omit(this.state.errors, movieId),
    };
    this.emit();

    try {
      if (nextType) await this.api.setFeedback(movieId, profileId, nextType);
      else await this.api.removeFeedback(movieId, profileId);
      if (!this.isCurrent(profileId, requestGeneration)) return;
      this.state = {
        ...this.state,
        refreshVersion: this.state.refreshVersion + (nextType === "MORE_LIKE_THIS" ? 1 : 0),
      };
      this.emit();
    } catch {
      if (!this.isCurrent(profileId, requestGeneration)) return;
      this.state = {
        ...rollbackFeedbackState(this.state, movieId, priorType),
        errors: { ...this.state.errors, [movieId]: "Could not update your recommendation feedback. Please try again." },
      };
      this.emit();
    } finally {
      this.pendingKeys.delete(key);
      if (this.isCurrent(profileId, requestGeneration)) {
        this.state = { ...this.state, pending: this.state.pending.filter((id) => id !== movieId) };
        this.emit();
      }
    }
  }

  isCurrent(profileId, generation) {
    return this.state.profileId === profileId && this.generation === generation;
  }

  emit() {
    this.listener(this.state);
  }
}

export const optimisticFeedbackState = (state, movieId, type) => {
  const feedback = { ...state.feedback };
  if (type) feedback[movieId] = type;
  else delete feedback[movieId];
  const excluded = type === "NOT_INTERESTED" || type === "ALREADY_WATCHED"
    ? add(state.excluded, movieId)
    : state.excluded.filter((id) => id !== movieId);
  return { ...state, feedback, excluded };
};

export const rollbackFeedbackState = (state, movieId, priorType) => {
  const feedback = { ...state.feedback };
  if (priorType) feedback[movieId] = priorType;
  else delete feedback[movieId];
  const excluded = priorType === "NOT_INTERESTED" || priorType === "ALREADY_WATCHED"
    ? add(state.excluded, movieId)
    : state.excluded.filter((id) => id !== movieId);
  return { ...state, feedback, excluded };
};

const emptyState = (profileId) => ({
  profileId, feedback: {}, excluded: [], pending: [], errors: {}, refreshVersion: 0,
});
const add = (values, value) => values.includes(value) ? values : [...values, value];
const omit = (record, key) => { const next = { ...record }; delete next[key]; return next; };
