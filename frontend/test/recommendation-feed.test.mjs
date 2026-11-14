import test from "node:test";
import assert from "node:assert/strict";
import { filterRecommendationMovies, RecommendationFeedCoordinator } from "../lib/recommendation-feed.mjs";

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const response = (movies, profileId = "profile-a") => ({
  data: {
    success: true,
    profile: { id: profileId, name: profileId },
    count: movies.length,
    movies,
  },
});

test("loads the backend recommendations contract and normalizes returned movie fields", async () => {
  let requestedProfile;
  const coordinator = new RecommendationFeedCoordinator(async (profileId) => {
    requestedProfile = profileId;
    return response([{
      _id: "movie-1", title: "Title", description: "Summary", longDescription: "Details",
      backdrop: "/backdrop.jpg", poster: "/poster.jpg", year: 2025, rating: "PG-13",
      duration: "1h 40m", genres: ["Drama"], cast: ["Actor"], videoUrl: "/watch.mp4",
    }]);
  });
  await coordinator.load("profile-a");

  assert.equal(requestedProfile, "profile-a");
  assert.equal(coordinator.state.status, "success");
  assert.equal(coordinator.state.movies[0].id, "movie-1");
  assert.equal(coordinator.state.movies[0].backdrop, "/backdrop.jpg");
  assert.equal(coordinator.state.movies[0].match, undefined);
});

test("reports loading, success, and empty response states", async () => {
  const pending = deferred();
  const coordinator = new RecommendationFeedCoordinator(() => pending.promise);
  const states = [];
  coordinator.setListener((state) => states.push(state.status));
  const load = coordinator.load("profile-a");
  assert.equal(coordinator.state.status, "loading");
  pending.resolve(response([{ _id: "movie-1", title: "Title" }]));
  await load;
  assert.equal(coordinator.state.status, "success");
  assert.ok(states.includes("loading"));

  const emptyFeed = new RecommendationFeedCoordinator(async () => response([]));
  await emptyFeed.load("profile-a");
  assert.equal(emptyFeed.state.status, "empty");
  assert.deepEqual(emptyFeed.state.movies, []);
});

test("handles request errors and malformed API responses as error state", async () => {
  const failed = new RecommendationFeedCoordinator(async () => { throw new Error("offline"); });
  await failed.load("profile-a");
  assert.equal(failed.state.status, "error");
  assert.match(failed.state.error, /couldn’t load/i);

  const invalid = new RecommendationFeedCoordinator(async () => ({ data: { success: true } }));
  await invalid.load("profile-a");
  assert.equal(invalid.state.status, "error");
});

test("profile A to B switching hides A immediately and ignores its late response", async () => {
  const calls = [];
  const coordinator = new RecommendationFeedCoordinator((profileId) => {
    const request = deferred();
    calls.push({ profileId, ...request });
    return request.promise;
  });
  const loadA = coordinator.load("profile-a");
  const loadB = coordinator.load("profile-b");
  assert.equal(coordinator.state.profileId, "profile-b");
  assert.equal(coordinator.state.status, "loading");

  calls[1].resolve(response([{ _id: "b-movie", title: "B movie" }], "profile-b"));
  await loadB;
  calls[0].resolve(response([{ _id: "a-movie", title: "A movie" }], "profile-a"));
  await loadA;
  assert.equal(coordinator.state.profileId, "profile-b");
  assert.deepEqual(coordinator.state.movies.map((movie) => movie.id), ["b-movie"]);
});

test("A to B to A switching rejects the original A request and accepts only the newest A request", async () => {
  const calls = [];
  const coordinator = new RecommendationFeedCoordinator((profileId) => {
    const request = deferred();
    calls.push({ profileId, ...request });
    return request.promise;
  });
  const originalA = coordinator.load("profile-a");
  const requestB = coordinator.load("profile-b");
  const newestA = coordinator.load("profile-a");
  const newestAState = coordinator.state;

  calls[0].resolve(response([{ _id: "old-a", title: "Old A" }], "profile-a"));
  await originalA;
  assert.equal(coordinator.state, newestAState);
  assert.equal(coordinator.state.status, "loading");
  assert.deepEqual(coordinator.state.movies, []);

  calls[2].resolve(response([{ _id: "new-a", title: "New A" }], "profile-a"));
  await newestA;
  calls[1].resolve(response([{ _id: "old-b", title: "Old B" }], "profile-b"));
  await requestB;
  assert.equal(coordinator.state.profileId, "profile-a");
  assert.deepEqual(coordinator.state.movies.map((movie) => movie.id), ["new-a"]);
});

test("failure from Profile A cannot replace successful Profile B feed or add an error", async () => {
  const calls = [];
  const coordinator = new RecommendationFeedCoordinator((profileId) => {
    const request = deferred();
    calls.push({ profileId, ...request });
    return request.promise;
  });
  const requestA = coordinator.load("profile-a");
  const requestB = coordinator.load("profile-b");
  calls[1].resolve(response([{ _id: "b-movie", title: "B movie" }], "profile-b"));
  await requestB;
  const successfulBState = coordinator.state;

  calls[0].reject(new Error("stale Profile A failure"));
  await requestA;
  assert.equal(coordinator.state, successfulBState);
  assert.equal(coordinator.state.profileId, "profile-b");
  assert.equal(coordinator.state.status, "success");
  assert.equal(coordinator.state.error, null);
  assert.deepEqual(coordinator.state.movies.map((movie) => movie.id), ["b-movie"]);
});

test("feedback exclusions filter only the recommendation collection", () => {
  const recommended = [{ id: "one" }, { id: "two" }, { id: "three" }];
  assert.deepEqual(filterRecommendationMovies(recommended, ["two"]).map((movie) => movie.id), ["one", "three"]);
  assert.equal(recommended.length, 3);
});

test("MORE_LIKE_THIS refresh version triggers a fresh API request", async () => {
  let calls = 0;
  const coordinator = new RecommendationFeedCoordinator(async () => {
    calls += 1;
    return response([{ _id: `movie-${calls}`, title: "Title" }]);
  });
  await coordinator.load("profile-a", 0);
  await coordinator.load("profile-a", 0);
  assert.equal(calls, 1);
  await coordinator.load("profile-a", 1);
  assert.equal(calls, 2);
  assert.equal(coordinator.state.movies[0].id, "movie-2");
});

test("retry issues a new request after an error", async () => {
  let calls = 0;
  const coordinator = new RecommendationFeedCoordinator(async () => {
    calls += 1;
    if (calls === 1) throw new Error("offline");
    return response([{ _id: "movie-1", title: "Title" }]);
  });
  await coordinator.load("profile-a");
  assert.equal(coordinator.state.status, "error");
  await coordinator.retry();
  assert.equal(calls, 2);
  assert.equal(coordinator.state.status, "success");
});

test("logout or missing profile clears the feed and invalidates pending responses", async () => {
  const pending = deferred();
  const coordinator = new RecommendationFeedCoordinator(() => pending.promise);
  const load = coordinator.load("profile-a");
  await coordinator.load(null);
  assert.equal(coordinator.state.status, "idle");
  assert.equal(coordinator.state.profileId, null);
  pending.resolve(response([{ _id: "a-movie", title: "A movie" }]));
  await load;
  assert.equal(coordinator.state.status, "idle");
  assert.deepEqual(coordinator.state.movies, []);
});
