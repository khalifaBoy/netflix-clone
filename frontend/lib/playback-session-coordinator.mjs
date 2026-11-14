const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{40,60}$/;
export const PLAYBACK_MEDIA_ERROR_MESSAGE =
  "Playback was interrupted. Your session may have expired or the connection may have been lost.";

export const validatePlaybackSessionResponse = (payload, expectedMovieId, now = Date.now()) => {
  const session = payload?.success === true ? payload.session : null;
  if (!session || typeof session !== "object"
    || typeof session.sessionId !== "string"
    || !SESSION_ID_PATTERN.test(session.sessionId)
    || String(session.movieId) !== String(expectedMovieId)
    || typeof session.expiresAt !== "string"
    || !Number.isFinite(Date.parse(session.expiresAt))
    || Date.parse(session.expiresAt) <= now
    || session.mediaUrl !== `/api/playback/sessions/${session.sessionId}/media`) {
    throw Object.assign(new Error("Playback session response was invalid"), {
      code: "INVALID_PLAYBACK_SESSION_RESPONSE",
    });
  }
  return {
    sessionId: session.sessionId,
    movieId: String(session.movieId),
    expiresAt: session.expiresAt,
    mediaUrl: session.mediaUrl,
  };
};

export const getPlaybackSessionErrorMessage = (error) => {
  if (error?.status === 401) return "Your sign-in has expired. Please sign in again.";
  if (error?.status === 403 || error?.status === 404) {
    return "This movie is no longer available for the selected profile.";
  }
  return "Playback could not be started. Check your connection and try again.";
};

export class PlaybackSessionCoordinator {
  constructor({ createSession, revokeSession }) {
    this.createSessionRequest = createSession;
    this.revokeSessionRequest = revokeSession;
    this.attempts = new Map();
    this.revocations = new Map();
    this.revoked = new Set();
    this.cleanupTimers = new Map();
  }

  create(attemptId, profileId, movieId) {
    if (this.attempts.has(attemptId)) return this.attempts.get(attemptId);
    const request = Promise.resolve()
      .then(() => this.createSessionRequest(profileId, movieId))
      .then((response) => validatePlaybackSessionResponse(response, movieId))
      .finally(() => {
        if (this.attempts.get(attemptId) === request) this.attempts.delete(attemptId);
      });
    this.attempts.set(attemptId, request);
    return request;
  }

  revoke(sessionId, token) {
    if (!sessionId || this.revoked.has(sessionId)) return Promise.resolve();
    if (this.revocations.has(sessionId)) return this.revocations.get(sessionId);
    const revocation = Promise.resolve()
      .then(() => this.revokeSessionRequest(sessionId, token))
      .then(() => { this.revoked.add(sessionId); })
      .finally(() => this.revocations.delete(sessionId));
    this.revocations.set(sessionId, revocation);
    return revocation;
  }

  retain(sessionId) {
    const timer = this.cleanupTimers.get(sessionId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.cleanupTimers.delete(sessionId);
    }
  }

  scheduleRevocation(sessionId) {
    if (!sessionId || this.revoked.has(sessionId)) return;
    this.retain(sessionId);
    const timer = setTimeout(() => {
      this.cleanupTimers.delete(sessionId);
      this.revoke(sessionId).catch(() => {});
    }, 0);
    this.cleanupTimers.set(sessionId, timer);
  }
}

const logoutRevokers = new Map();

export const registerPlaybackSessionForLogout = (sessionId, revoke) => {
  if (!sessionId || typeof revoke !== "function") return () => {};
  logoutRevokers.set(sessionId, revoke);
  return () => {
    if (logoutRevokers.get(sessionId) === revoke) logoutRevokers.delete(sessionId);
  };
};

export const revokeRegisteredPlaybackSessions = (token) => Promise.allSettled(
  [...logoutRevokers.values()].map((revoke) => Promise.resolve().then(() => revoke(token))),
);

/** Listen for this origin's token removal so other tabs can revoke their media sessions. */
export const registerCrossTabLogoutListener = (handler, target = globalThis.window) => {
  if (!target?.addEventListener || typeof handler !== "function") return () => {};
  const onStorage = (event) => {
    if (event.key === "token" && event.newValue === null
      && target.localStorage?.getItem("token") == null) handler();
  };
  target.addEventListener("storage", onStorage);
  return () => target.removeEventListener("storage", onStorage);
};
