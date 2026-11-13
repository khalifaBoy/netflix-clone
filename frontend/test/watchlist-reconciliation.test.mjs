import test from "node:test";
import assert from "node:assert/strict";
import { WatchlistReconciliationCoordinator } from "../context/watchlist-reconciliation.mjs";

test("a mutation invalidates the initial fetch and requires a fresh snapshot after it settles", () => {
  const coordinator = new WatchlistReconciliationCoordinator();
  const initialFetch = coordinator.beginRequest("profile-a");
  coordinator.beginMutation("profile-a");

  assert.equal(coordinator.canApplyRequest("profile-a", initialFetch), false);
  assert.equal(coordinator.endMutation("profile-a"), true);

  const reconciliation = coordinator.beginRequest("profile-a");
  assert.equal(coordinator.markSnapshotComplete("profile-a", reconciliation), true);
  assert.equal(coordinator.hasCompleteSnapshot("profile-a"), true);
  assert.equal(coordinator.needsReconciliation("profile-a"), false);
});

test("multiple concurrent mutations schedule one reconciliation after all settle", () => {
  const coordinator = new WatchlistReconciliationCoordinator();
  coordinator.beginMutation("profile-a");
  coordinator.beginMutation("profile-a");

  assert.equal(coordinator.endMutation("profile-a"), false);
  assert.equal(coordinator.needsReconciliation("profile-a"), true);
  assert.equal(coordinator.endMutation("profile-a"), true);
  assert.equal(coordinator.hasMutations("profile-a"), false);
});

test("a new mutation invalidates an in-flight reconciliation response", () => {
  const coordinator = new WatchlistReconciliationCoordinator();
  const reconciliation = coordinator.beginRequest("profile-a");
  coordinator.beginMutation("profile-a");

  assert.equal(coordinator.markSnapshotComplete("profile-a", reconciliation), false);
  assert.equal(coordinator.hasCompleteSnapshot("profile-a"), false);
  assert.equal(coordinator.endMutation("profile-a"), true);
});

test("profile switching invalidates the previous profile request", () => {
  const coordinator = new WatchlistReconciliationCoordinator();
  const oldProfileRequest = coordinator.beginRequest("profile-a");
  coordinator.resetProfile("profile-a");
  const newProfileRequest = coordinator.beginRequest("profile-b");

  assert.equal(coordinator.canApplyRequest("profile-a", oldProfileRequest), false);
  assert.equal(coordinator.markSnapshotComplete("profile-b", newProfileRequest), true);
  assert.equal(coordinator.hasCompleteSnapshot("profile-a"), false);
  assert.equal(coordinator.hasCompleteSnapshot("profile-b"), true);
});

test("failed reconciliation remains incomplete until a later successful snapshot", () => {
  const coordinator = new WatchlistReconciliationCoordinator();
  coordinator.beginMutation("profile-a");
  assert.equal(coordinator.endMutation("profile-a"), true);
  const failedRequest = coordinator.beginRequest("profile-a");

  // A failed request does not mark a complete snapshot or clear the retry need.
  assert.equal(coordinator.hasCompleteSnapshot("profile-a"), false);
  assert.equal(coordinator.needsReconciliation("profile-a"), true);
  assert.equal(coordinator.markSnapshotComplete("profile-a", failedRequest), true);
  assert.equal(coordinator.hasCompleteSnapshot("profile-a"), true);
  assert.equal(coordinator.needsReconciliation("profile-a"), false);
});
