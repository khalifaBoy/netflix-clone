import test from "node:test";
import assert from "node:assert/strict";
import { ContinueWatchingFeedCoordinator } from "../lib/continue-watching-feed.mjs";
import { getResumeProgressSeconds } from "../lib/watch-progress.mjs";

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const record = (id, completedAt = null) => ({
  _id: `history-${id}`,
  movie: { _id: id, title: id },
  progressSeconds: 20,
  completedAt,
});
const response = (history) => ({ data: { success: true, history } });

test("loads saved progress for the active profile and leaves an explicit empty state", async () => {
  const id = "0123456789abcdef01234567";
  const coordinator = new ContinueWatchingFeedCoordinator(async (profileId) => {
    assert.equal(profileId, "profile-a");
    return response([record(id)]);
  });
  await coordinator.load("profile-a");
  assert.equal(coordinator.state.status, "success");
  assert.equal(coordinator.state.history[0].movie._id, id);

  const empty = new ContinueWatchingFeedCoordinator(async () => response([]));
  await empty.load("profile-a");
  assert.equal(empty.state.status, "empty");
  assert.deepEqual(empty.state.history, []);
});

test("profile switching immediately clears old progress and ignores stale responses", async () => {
  const calls = [];
  const coordinator = new ContinueWatchingFeedCoordinator((profileId) => {
    const request = deferred();
    calls.push({ profileId, ...request });
    return request.promise;
  });
  const requestA = coordinator.load("profile-a");
  const requestB = coordinator.load("profile-b");
  assert.equal(coordinator.state.profileId, "profile-b");
  assert.equal(coordinator.state.status, "loading");
  calls[1].resolve(response([record("1123456789abcdef01234567")]));
  await requestB;
  calls[0].resolve(response([record("0123456789abcdef01234567")]));
  await requestA;
  assert.equal(coordinator.state.profileId, "profile-b");
  assert.equal(coordinator.state.history[0].movie._id, "1123456789abcdef01234567");
});

test("completed and invalid movie records are omitted and retry performs a fresh request", async () => {
  let calls = 0;
  const coordinator = new ContinueWatchingFeedCoordinator(async () => {
    calls += 1;
    if (calls === 1) return response([record("0123456789abcdef01234567", "2025-01-01")]);
    if (calls === 2) throw new Error("offline");
    return response([record("not-an-object-id")]);
  });
  await coordinator.load("profile-a");
  assert.equal(coordinator.state.status, "empty");
  await coordinator.load("profile-a", true);
  assert.equal(coordinator.state.status, "error");
  await coordinator.retry();
  assert.equal(coordinator.state.status, "empty");
  assert.equal(calls, 3);
});

test("resume position uses the matching incomplete movie record and ignores completed progress", () => {
  const firstId = "0123456789abcdef01234567";
  const secondId = "1123456789abcdef01234567";
  const history = [
    { movie: { _id: firstId }, progressSeconds: 37, durationSeconds: 120, completedAt: null },
    { movie: { _id: secondId }, progressSeconds: 120, durationSeconds: 120, completedAt: "2025-01-01" },
  ];
  assert.equal(getResumeProgressSeconds(history, firstId), 37);
  assert.equal(getResumeProgressSeconds(history, secondId), 0);
  assert.equal(getResumeProgressSeconds(history, "2123456789abcdef01234567"), 0);
});
