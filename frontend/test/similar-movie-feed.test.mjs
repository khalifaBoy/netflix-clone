import test from "node:test";
import assert from "node:assert/strict";
import { SimilarMovieFeedCoordinator } from "../lib/similar-movie-feed.mjs";
import { getMovieWatchPath } from "../lib/movie-navigation.mjs";

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const seed = { id: "0123456789abcdef01234567", genres: ["Drama", "Mystery"] };
const profile = { _id: "profile-a", maturityLevel: "All", isKids: false };
const movie = (id, genres = ["Drama"], maturityRating = "All") => ({
  _id: id, title: id, description: "", year: 2025, rating: "", duration: "", genres,
  cast: [], maturityRating, poster: "/poster.jpg", backdrop: "/backdrop.jpg",
});

test("loads profile-scoped similar movies, excludes the seed and duplicate IDs, and ranks shared genres first", async () => {
  let request;
  const coordinator = new SimilarMovieFeedCoordinator(async (profileId, genres) => {
    request = { profileId, genres };
    return [
      movie(seed.id),
      movie("1123456789abcdef01234567", ["Mystery", "Drama"]),
      movie("1123456789abcdef01234567", ["Drama"]),
      movie("2123456789abcdef01234567", ["Drama"]),
    ];
  });
  await coordinator.load(profile, seed);
  assert.deepEqual(request, { profileId: "profile-a", genres: ["Drama", "Mystery"] });
  assert.deepEqual(coordinator.state.movies.map((item) => item.id), [
    "1123456789abcdef01234567", "2123456789abcdef01234567",
  ]);
  assert.equal(getMovieWatchPath(coordinator.state.movies[0].id), "/watch/1123456789abcdef01234567");
  assert.equal(coordinator.state.status, "success");
});

test("profile changes invalidate pending movie results and expose empty/error states with retry", async () => {
  const calls = [];
  const coordinator = new SimilarMovieFeedCoordinator((profileId) => {
    const request = deferred();
    calls.push({ profileId, ...request });
    return request.promise;
  });
  const requestA = coordinator.load(profile, seed);
  const profileB = { ...profile, _id: "profile-b" };
  const requestB = coordinator.load(profileB, seed);
  calls[1].resolve([movie("3123456789abcdef01234567")]);
  await requestB;
  calls[0].resolve([movie("4123456789abcdef01234567")]);
  await requestA;
  assert.equal(coordinator.state.profileId, "profile-b");
  assert.deepEqual(coordinator.state.movies.map((item) => item.id), ["3123456789abcdef01234567"]);

  const empty = new SimilarMovieFeedCoordinator(async () => []);
  await empty.load(profile, seed);
  assert.equal(empty.state.status, "empty");

  let retries = 0;
  const failing = new SimilarMovieFeedCoordinator(async () => {
    retries += 1;
    if (retries === 1) throw new Error("offline");
    return [movie("5123456789abcdef01234567")];
  });
  await failing.load(profile, seed);
  assert.equal(failing.state.status, "error");
  await failing.retry();
  assert.equal(failing.state.status, "success");
});

test("invalid seed IDs and movies restricted for the active profile are not returned", async () => {
  let calls = 0;
  const coordinator = new SimilarMovieFeedCoordinator(async () => {
    calls += 1;
    return [movie("6123456789abcdef01234567", ["Drama"], "13+")];
  });
  await coordinator.load(profile, { ...seed, id: "external-id" });
  assert.equal(calls, 0);
  const kidsProfile = { _id: "kids", maturityLevel: "18+", isKids: true };
  await coordinator.load(kidsProfile, seed);
  assert.equal(coordinator.state.status, "empty");
});
