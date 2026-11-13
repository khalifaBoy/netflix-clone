export class WatchlistReconciliationCoordinator {
  generations = new Map();
  mutationCounts = new Map();
  completeSnapshots = new Set();
  reconciliationRequired = new Set();

  generation(profileId) {
    return this.generations.get(profileId) || 0;
  }

  invalidate(profileId) {
    this.generations.set(profileId, this.generation(profileId) + 1);
  }

  resetProfile(profileId) {
    this.invalidate(profileId);
    this.completeSnapshots.delete(profileId);
    this.reconciliationRequired.delete(profileId);
    if ((this.mutationCounts.get(profileId) || 0) > 0) {
      this.reconciliationRequired.add(profileId);
    }
  }

  beginRequest(profileId) {
    this.invalidate(profileId);
    return this.generation(profileId);
  }

  beginMutation(profileId) {
    this.invalidate(profileId);
    this.mutationCounts.set(profileId, (this.mutationCounts.get(profileId) || 0) + 1);
    if (!this.hasCompleteSnapshot(profileId)) {
      this.reconciliationRequired.add(profileId);
    }
  }

  requireReconciliation(profileId) {
    this.reconciliationRequired.add(profileId);
  }

  endMutation(profileId) {
    const count = Math.max(0, (this.mutationCounts.get(profileId) || 0) - 1);
    if (count === 0) this.mutationCounts.delete(profileId);
    else this.mutationCounts.set(profileId, count);
    return count === 0 && this.reconciliationRequired.has(profileId);
  }

  isCurrentRequest(profileId, generation) {
    return this.generation(profileId) === generation;
  }

  canApplyRequest(profileId, generation) {
    return this.isCurrentRequest(profileId, generation)
      && (this.mutationCounts.get(profileId) || 0) === 0;
  }

  markSnapshotComplete(profileId, generation) {
    if (!this.canApplyRequest(profileId, generation)) return false;
    this.completeSnapshots.add(profileId);
    this.reconciliationRequired.delete(profileId);
    return true;
  }

  hasCompleteSnapshot(profileId) {
    return this.completeSnapshots.has(profileId);
  }

  needsReconciliation(profileId) {
    return this.reconciliationRequired.has(profileId);
  }

  hasMutations(profileId) {
    return (this.mutationCounts.get(profileId) || 0) > 0;
  }
}
