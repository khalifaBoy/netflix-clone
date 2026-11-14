import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getPlaybackSessionErrorMessage,
  PLAYBACK_MEDIA_ERROR_MESSAGE,
  PlaybackSessionCoordinator,
  registerCrossTabLogoutListener,
  registerPlaybackSessionForLogout,
  revokeRegisteredPlaybackSessions,
  validatePlaybackSessionResponse,
} from "../lib/playback-session-coordinator.mjs";

const movieId = "movie-123";
const sessionId = "r".repeat(43);
const validResponse = (overrides = {}) => ({
  success: true,
  session: {
    sessionId,
    movieId,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    mediaUrl: `/api/playback/sessions/${sessionId}/media`,
    ...overrides,
  },
});

test("validates the backend session shape and protected media URL", () => {
  const session = validatePlaybackSessionResponse(validResponse(), movieId);
  assert.equal(session.sessionId, sessionId);
  assert.equal(session.movieId, movieId);
  assert.equal(session.mediaUrl, `/api/playback/sessions/${sessionId}/media`);
  assert.throws(() => validatePlaybackSessionResponse(validResponse({ movieId: "other-movie" }), movieId), {
    code: "INVALID_PLAYBACK_SESSION_RESPONSE",
  });
  assert.throws(() => validatePlaybackSessionResponse(validResponse({ mediaUrl: "https://evil.test/video" }), movieId), {
    code: "INVALID_PLAYBACK_SESSION_RESPONSE",
  });
  assert.throws(() => validatePlaybackSessionResponse(validResponse({
    expiresAt: new Date(Date.now() - 1).toISOString(),
  }), movieId), { code: "INVALID_PLAYBACK_SESSION_RESPONSE" });
});

test("coalesces duplicate session creation for the same playback attempt", async () => {
  let callCount = 0;
  const coordinator = new PlaybackSessionCoordinator({
    createSession: async () => {
      callCount += 1;
      await Promise.resolve();
      return validResponse();
    },
    revokeSession: async () => {},
  });

  const first = coordinator.create("attempt-1", "profile-a", movieId);
  const duplicate = coordinator.create("attempt-1", "profile-a", movieId);
  assert.equal(first, duplicate);
  const [firstResult, duplicateResult] = await Promise.all([first, duplicate]);
  assert.equal(callCount, 1);
  assert.equal(firstResult.sessionId, duplicateResult.sessionId);
});

test("allows independent movies and suppresses repeated revocation", async () => {
  const createdMovies = [];
  const revoked = [];
  const coordinator = new PlaybackSessionCoordinator({
    createSession: async (profileId, requestedMovieId) => {
      createdMovies.push([profileId, requestedMovieId]);
      return validResponse({ movieId: requestedMovieId });
    },
    revokeSession: async (id) => { revoked.push(id); },
  });

  await Promise.all([
    coordinator.create("attempt-a", "profile-a", movieId),
    coordinator.create("attempt-b", "profile-a", "movie-456"),
  ]);
  await Promise.all([coordinator.revoke(sessionId), coordinator.revoke(sessionId)]);
  assert.deepEqual(createdMovies, [["profile-a", movieId], ["profile-a", "movie-456"]]);
  assert.deepEqual(revoked, [sessionId]);
});

test("delayed cleanup is cancelled when Strict Mode immediately retains the session", async () => {
  const revoked = [];
  const coordinator = new PlaybackSessionCoordinator({
    createSession: async () => validResponse(),
    revokeSession: async (id) => { revoked.push(id); },
  });

  coordinator.scheduleRevocation(sessionId);
  coordinator.retain(sessionId);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(revoked, []);

  coordinator.scheduleRevocation(sessionId);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(revoked, [sessionId]);
});

test("registered playback sessions can be revoked before logout clears credentials", async () => {
  let request;
  const unregister = registerPlaybackSessionForLogout(sessionId, async (token) => {
    request = { sessionId, token };
  });

  await revokeRegisteredPlaybackSessions("access-token");
  unregister();
  assert.deepEqual(request, { sessionId, token: "access-token" });
});

test("cross-tab logout listener reacts only when the shared token is removed", () => {
  const listeners = new Set();
  let storedToken = null;
  const target = {
    addEventListener: (type, listener) => { if (type === "storage") listeners.add(listener); },
    removeEventListener: (type, listener) => { if (type === "storage") listeners.delete(listener); },
    localStorage: { getItem: () => storedToken },
  };
  let logoutCount = 0;
  const unregister = registerCrossTabLogoutListener(() => { logoutCount += 1; }, target);
  const dispatch = (event) => listeners.forEach((listener) => listener(event));

  dispatch({ key: "user", newValue: null });
  dispatch({ key: "token", newValue: "replacement-token" });
  assert.equal(logoutCount, 0);
  storedToken = "new-login-token";
  dispatch({ key: "token", newValue: null });
  assert.equal(logoutCount, 0);
  storedToken = null;
  dispatch({ key: "token", newValue: null });
  assert.equal(logoutCount, 1);

  unregister();
  dispatch({ key: "token", newValue: null });
  assert.equal(logoutCount, 1);
});

test("maps authorization and availability failures to user-friendly messages", () => {
  assert.match(getPlaybackSessionErrorMessage({ status: 401 }), /sign-in has expired/i);
  assert.match(getPlaybackSessionErrorMessage({ status: 403 }), /selected profile/i);
  assert.match(getPlaybackSessionErrorMessage({ status: 404 }), /selected profile/i);
  assert.match(getPlaybackSessionErrorMessage(new Error("backend stack trace")), /connection/i);
  assert.match(PLAYBACK_MEDIA_ERROR_MESSAGE, /session may have expired/i);
});

test("surfaces session initialization failures without leaking backend details", async () => {
  const coordinator = new PlaybackSessionCoordinator({
    createSession: async () => {
      throw Object.assign(new Error("private database internals"), { status: 401 });
    },
    revokeSession: async () => {},
  });
  await assert.rejects(coordinator.create("failed-attempt", "profile-a", movieId), (error) => {
    assert.equal(error.message, "private database internals");
    assert.equal(getPlaybackSessionErrorMessage(error), "Your sign-in has expired. Please sign in again.");
    return true;
  });
});
