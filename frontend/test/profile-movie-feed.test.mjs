import test from "node:test";
import assert from "node:assert/strict";
import { ProfileMovieFeedCoordinator } from "../lib/profile-movie-feed.mjs";
import { canPlayVerifiedMovie, canShowStaticCatalog, effectiveMaturityLimit, filterMoviesForProfile, isMovieAllowedForProfile } from "../lib/profile-maturity.mjs";

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const movie = (id, maturityRating) => ({ _id: id, title: id, maturityRating });
const response = (movies) => ({ data: { success: true, movies } });
const profile = (_id, maturityLevel = "All", isKids = false) => ({ _id, maturityLevel, isKids });

test("Kids profiles are capped at 7+ and unknown ratings are denied", () => {
  const kids = profile("kids", "18+", true);
  assert.equal(effectiveMaturityLimit(kids), 7);
  assert.deepEqual(filterMoviesForProfile([
    movie("all", "All"), movie("seven", "7+"), movie("teen", "13+"), movie("legacy", "TV-MA"),
  ], kids).map((item) => item._id), ["all", "seven"]);
  assert.equal(isMovieAllowedForProfile(movie("missing"), profile("adult")), false);
  assert.equal(isMovieAllowedForProfile(movie("ambiguous", "R"), profile("adult")), false);
});

test("configured canonical levels filter API movies without affecting All profiles", () => {
  const content = ["All", "7+", "13+", "16+", "18+"].map((level) => movie(level, level));
  assert.deepEqual(filterMoviesForProfile(content, profile("p13", "13+")).map((item) => item._id), ["All", "7+", "13+"]);
  assert.deepEqual(filterMoviesForProfile(content, profile("all", "All")).map((item) => item._id), ["All", "7+", "13+", "16+", "18+"]);
  assert.deepEqual(filterMoviesForProfile(content, profile("invalid", "TV-MA")).map((item) => item._id), []);
});

test("static catalog stays hidden for Kids and playback rejects restricted or unmapped details", () => {
  const kids = profile("kids", "7+", true);
  const adult = profile("adult", "All");
  const restrictedAdult = profile("restricted-adult", "13+");
  assert.equal(canShowStaticCatalog(kids), false);
  assert.equal(canShowStaticCatalog(adult), true);
  assert.equal(canShowStaticCatalog(restrictedAdult), false);
  assert.equal(canPlayVerifiedMovie(movie("restricted", "13+"), kids), false);
  assert.equal(canPlayVerifiedMovie(movie("unmapped", "TV-MA"), adult), false);
  assert.equal(canPlayVerifiedMovie(movie("permitted", "7+"), kids), true);
});

test("coordinator passes the active profile to the request and ignores stale A to B to A responses", async () => {
  const calls = [];
  const coordinator = new ProfileMovieFeedCoordinator((profileId) => {
    const request = deferred();
    calls.push({ profileId, ...request });
    return request.promise;
  });
  const profileA = profile("profile-a");
  const profileB = profile("profile-b");
  const oldA = coordinator.load(profileA);
  const requestB = coordinator.load(profileB);
  const newA = coordinator.load(profileA);

  assert.deepEqual(calls.map((call) => call.profileId), ["profile-a", "profile-b", "profile-a"]);
  calls[0].resolve(response([movie("stale-a", "All")]));
  await oldA;
  assert.equal(coordinator.state.profileId, "profile-a");
  assert.equal(coordinator.state.status, "loading");
  assert.deepEqual(coordinator.state.movies, []);

  calls[2].resolve(response([movie("new-a", "All")]));
  await newA;
  calls[1].resolve(response([movie("old-b", "All")]));
  await requestB;
  assert.deepEqual(coordinator.state.movies.map((item) => item._id), ["new-a"]);
});

test("a stale request failure cannot overwrite the selected profile feed or its error state", async () => {
  const calls = [];
  const coordinator = new ProfileMovieFeedCoordinator((profileId) => {
    const request = deferred();
    calls.push({ profileId, ...request });
    return request.promise;
  });
  const requestA = coordinator.load(profile("profile-a"));
  const requestB = coordinator.load(profile("profile-b"));
  calls[1].resolve(response([movie("b-movie", "All")]));
  await requestB;
  const successfulB = coordinator.state;
  calls[0].reject(new Error("late A failure"));
  await requestA;
  assert.equal(coordinator.state, successfulB);
  assert.equal(coordinator.state.status, "success");
  assert.equal(coordinator.state.error, null);
  assert.deepEqual(coordinator.state.movies.map((item) => item._id), ["b-movie"]);
});

test("retry makes a fresh profile-scoped request and logout invalidates pending work", async () => {
  let calls = 0;
  const pending = deferred();
  const coordinator = new ProfileMovieFeedCoordinator((profileId) => {
    calls += 1;
    assert.equal(profileId, "profile-a");
    return calls === 1 ? Promise.reject(new Error("offline")) : pending.promise;
  });
  await coordinator.load(profile("profile-a"));
  assert.equal(coordinator.state.status, "error");
  const retry = coordinator.retry();
  await coordinator.load(null);
  pending.resolve(response([movie("late", "All")]));
  await retry;
  assert.equal(coordinator.state.status, "idle");
  assert.deepEqual(coordinator.state.movies, []);
  assert.equal(calls, 2);
});

test("malformed recommendation profile metadata is rejected", async () => {
  const coordinator = new ProfileMovieFeedCoordinator(async () => ({
    data: { success: true, profile: { id: "different-profile" }, movies: [movie("unsafe", "All")] },
  }));
  await coordinator.load(profile("profile-a"), "query");
  assert.equal(coordinator.state.status, "error");
  assert.deepEqual(coordinator.state.movies, []);
});
