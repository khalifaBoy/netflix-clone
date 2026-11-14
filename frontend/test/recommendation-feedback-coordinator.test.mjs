import test from "node:test";
import assert from "node:assert/strict";
import { RecommendationFeedbackCoordinator } from "../context/recommendation-feedback-coordinator.mjs";

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const setup = () => {
  const requests = [];
  const coordinator = new RecommendationFeedbackCoordinator({
    setFeedback: (...args) => {
      const request = deferred();
      requests.push({ method: "put", args, ...request });
      return request.promise;
    },
    removeFeedback: (...args) => {
      const request = deferred();
      requests.push({ method: "delete", args, ...request });
      return request.promise;
    },
  });
  const updates = [];
  coordinator.setListener((state) => updates.push(state));
  return { coordinator, requests, updates };
};

test("late Profile A success cannot alter Profile B state after switching", async () => {
  const { coordinator, requests } = setup();
  coordinator.setProfile("profile-a");
  const requestA = coordinator.submit("movie-a", "NOT_INTERESTED");
  assert.deepEqual(coordinator.state.excluded, ["movie-a"]);

  coordinator.setProfile("profile-b");
  const profileBState = coordinator.state;
  assert.deepEqual(profileBState.feedback, {});
  requests[0].resolve({ success: true });
  await requestA;

  assert.equal(coordinator.state, profileBState);
  assert.equal(coordinator.state.profileId, "profile-b");
  assert.deepEqual(coordinator.state.feedback, {});
  assert.deepEqual(coordinator.state.excluded, []);
});

test("a stale response stays invalid after switching away and back to the same profile", async () => {
  const { coordinator, requests } = setup();
  coordinator.setProfile("profile-a");
  const requestA = coordinator.submit("movie-a", "MORE_LIKE_THIS");
  coordinator.setProfile("profile-b");
  coordinator.setProfile("profile-a");
  const activeState = coordinator.state;

  requests[0].resolve({ success: true });
  await requestA;
  assert.equal(coordinator.state, activeState);
  assert.equal(coordinator.state.refreshVersion, 0);
  assert.deepEqual(coordinator.state.feedback, {});
});

test("simultaneous submissions for the same profile and movie issue one request", async () => {
  const { coordinator, requests } = setup();
  coordinator.setProfile("profile-a");
  const first = coordinator.submit("movie-a", "MORE_LIKE_THIS");
  const duplicate = coordinator.submit("movie-a", "NOT_INTERESTED");

  assert.equal(requests.length, 1);
  assert.deepEqual(coordinator.state.pending, ["movie-a"]);
  assert.equal(coordinator.state.feedback["movie-a"], "MORE_LIKE_THIS");
  requests[0].resolve({ success: true });
  await Promise.all([first, duplicate]);
  assert.equal(coordinator.state.pending.length, 0);
});

test("different movies can be updated concurrently and independently", async () => {
  const { coordinator, requests } = setup();
  coordinator.setProfile("profile-a");
  const first = coordinator.submit("movie-a", "NOT_INTERESTED");
  const second = coordinator.submit("movie-b", "ALREADY_WATCHED");

  assert.equal(requests.length, 2);
  assert.deepEqual(coordinator.state.excluded.sort(), ["movie-a", "movie-b"]);
  requests[0].resolve({ success: true });
  requests[1].resolve({ success: true });
  await Promise.all([first, second]);
  assert.deepEqual(coordinator.state.pending, []);
});

test("failed request rolls its optimistic selection and exclusion back", async () => {
  const { coordinator, requests } = setup();
  coordinator.setProfile("profile-a");
  const operation = coordinator.submit("movie-a", "NOT_INTERESTED");
  assert.deepEqual(coordinator.state.excluded, ["movie-a"]);
  requests[0].reject(new Error("offline"));
  await operation;

  assert.equal(coordinator.state.feedback["movie-a"], undefined);
  assert.deepEqual(coordinator.state.excluded, []);
  assert.match(coordinator.state.errors["movie-a"], /Could not update/);
  assert.deepEqual(coordinator.state.pending, []);
});

test("removing feedback calls DELETE and clears selected feedback after success", async () => {
  const { coordinator, requests } = setup();
  coordinator.setProfile("profile-a");
  const save = coordinator.submit("movie-a", "ALREADY_WATCHED");
  requests[0].resolve({ success: true });
  await save;

  const remove = coordinator.remove("movie-a");
  assert.equal(requests[1].method, "delete");
  assert.deepEqual(coordinator.state.excluded, []);
  requests[1].resolve(undefined);
  await remove;
  assert.equal(coordinator.state.feedback["movie-a"], undefined);
  assert.deepEqual(coordinator.state.excluded, []);
});

test("failed removal restores the previous selected feedback and exclusion", async () => {
  const { coordinator, requests } = setup();
  coordinator.setProfile("profile-a");
  const save = coordinator.submit("movie-a", "NOT_INTERESTED");
  requests[0].resolve({ success: true });
  await save;

  const remove = coordinator.remove("movie-a");
  assert.deepEqual(coordinator.state.excluded, []);
  requests[1].reject(new Error("offline"));
  await remove;
  assert.equal(coordinator.state.feedback["movie-a"], "NOT_INTERESTED");
  assert.deepEqual(coordinator.state.excluded, ["movie-a"]);
});

test("late failures from an old profile cannot overwrite active profile errors", async () => {
  const { coordinator, requests } = setup();
  coordinator.setProfile("profile-a");
  const oldRequest = coordinator.submit("movie-a", "MORE_LIKE_THIS");
  coordinator.setProfile("profile-b");
  const currentRequest = coordinator.submit("movie-b", "MORE_LIKE_THIS");
  requests[0].reject(new Error("old failure"));
  await oldRequest;

  assert.equal(coordinator.state.errors["movie-a"], undefined);
  assert.deepEqual(coordinator.state.feedback, { "movie-b": "MORE_LIKE_THIS" });
  requests[1].reject(new Error("current failure"));
  await currentRequest;
  assert.match(coordinator.state.errors["movie-b"], /Could not update/);
  assert.equal(coordinator.state.feedback["movie-b"], undefined);
});

test("consumer listeners receive synchronized state snapshots", async () => {
  const { coordinator, requests, updates } = setup();
  coordinator.setProfile("profile-a");
  const operation = coordinator.submit("movie-a", "MORE_LIKE_THIS");
  const optimisticSnapshot = updates.at(-1);
  assert.equal(optimisticSnapshot.feedback["movie-a"], "MORE_LIKE_THIS");
  requests[0].resolve({ success: true });
  await operation;
  assert.equal(updates.at(-1).refreshVersion, 1);
});
