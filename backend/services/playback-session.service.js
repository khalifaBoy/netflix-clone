import { createHash, randomBytes } from "node:crypto";
import { access, constants, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import Movie from "../models/Movie.js";
import PlaybackSession from "../models/PlaybackSession.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import {
  isMovieAllowedByMaturity,
  requireProfileMaturityPolicy,
} from "./maturity-policy.service.js";

const DEFAULT_LIFETIME_SECONDS = 15 * 60;
const configuredLifetime = Number(process.env.PLAYBACK_SESSION_TTL_SECONDS);
// Operators may shorten the default, but cannot configure a session longer
// than fifteen minutes. Invalid settings fall back to the safe default.
export const PLAYBACK_SESSION_LIFETIME_SECONDS = Number.isInteger(configuredLifetime)
  && configuredLifetime >= 60
  && configuredLifetime <= DEFAULT_LIFETIME_SECONDS
  ? configuredLifetime
  : DEFAULT_LIFETIME_SECONDS;

const storageDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../uploads/videos",
);
const storedVideoReference = /^\/uploads\/videos\/(video-\d+\.(?:mp4|mkv|avi|mov|mpeg|mpg))$/i;
const credentialPattern = /^[A-Za-z0-9_-]{40,60}$/;

const hashCredential = (credential) => createHash("sha256").update(credential).digest("hex");

const sessionError = () => new ApiError(404, "PLAYBACK_SESSION_NOT_FOUND", "Playback session is unavailable");

const loadSessionByCredential = async (sessionId) => {
  if (typeof sessionId !== "string" || !credentialPattern.test(sessionId)) throw sessionError();
  const session = await PlaybackSession.findOne({ credentialHash: hashCredential(sessionId) }).lean();
  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) throw sessionError();
  return session;
};

const resolveStoredVideoFile = async (videoUrl) => {
  if (typeof videoUrl !== "string") return null;
  const match = storedVideoReference.exec(videoUrl);
  if (!match) return null;

  const filePath = path.resolve(storageDirectory, match[1]);
  if (!filePath.startsWith(`${storageDirectory}${path.sep}`)) return null;
  try {
    const [canonicalStorageDirectory, canonicalFilePath] = await Promise.all([
      realpath(storageDirectory),
      realpath(filePath),
    ]);
    const canonicalExpectedPath = path.join(canonicalStorageDirectory, match[1]);
    // Require the expected direct child, not merely any target inside the
    // directory. This rejects symlinks to another movie's media file too.
    if (canonicalFilePath !== canonicalExpectedPath) return null;
    await access(canonicalFilePath, constants.R_OK);
    const fileStat = await stat(canonicalFilePath);
    return fileStat.isFile() ? canonicalFilePath : null;
  } catch {
    return null;
  }
};

const findPlayableMovie = async ({ movieId, policy }) => {
  const movie = await Movie.findById(movieId).lean();
  if (!movie || movie.isPublished !== true || !isMovieAllowedByMaturity(policy, movie.maturityRating)) {
    throw new ApiError(404, "MOVIE_NOT_PLAYABLE", "Movie is not available for playback");
  }
  const filePath = await resolveStoredVideoFile(movie.videoUrl);
  if (!filePath) {
    throw new ApiError(404, "MOVIE_NOT_PLAYABLE", "Movie is not available for playback");
  }
  return { movie, filePath };
};

export const createPlaybackSession = async ({ userId, profileId, movieId }) => {
  if (![userId, profileId, movieId].every((id) => mongoose.isValidObjectId(id))) {
    throw new ApiError(400, "INVALID_ID", "A supplied identifier is invalid");
  }
  const policy = await requireProfileMaturityPolicy(profileId, userId);
  const { movie } = await findPlayableMovie({ movieId, policy });

  const credential = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + PLAYBACK_SESSION_LIFETIME_SECONDS * 1000);
  await PlaybackSession.create({
    credentialHash: hashCredential(credential),
    user: userId,
    profile: profileId,
    movie: movie._id,
    expiresAt,
  });

  return {
    sessionId: credential,
    movieId: String(movie._id),
    expiresAt: expiresAt.toISOString(),
    mediaUrl: `/api/playback/sessions/${credential}/media`,
  };
};

const authorizeSessionRecord = async ({ session, userId, profileId, movieId }) => {
  if (String(session.user) !== String(userId)
    || String(session.profile) !== String(profileId)
    || String(session.movie) !== String(movieId)) {
    throw sessionError();
  }

  const activeUser = await User.findOne({ _id: userId, isActive: true }).select("_id").lean();
  if (!activeUser) throw sessionError();
  const policy = await requireProfileMaturityPolicy(profileId, userId);
  const { movie, filePath } = await findPlayableMovie({ movieId, policy });
  return { session, movie, filePath };
};

/** Revalidate caller-supplied session bindings and current profile/movie authorization. */
export const validatePlaybackSession = async ({ sessionId, userId, profileId, movieId }) => {
  if (![userId, profileId, movieId].every((id) => mongoose.isValidObjectId(id))) throw sessionError();
  const session = await loadSessionByCredential(sessionId);
  return authorizeSessionRecord({ session, userId, profileId, movieId });
};

/** The opaque credential is the media request's bearer authorization. */
export const validatePlaybackCredential = async ({ sessionId }) => {
  const session = await loadSessionByCredential(sessionId);
  return authorizeSessionRecord({
    session,
    userId: session.user,
    profileId: session.profile,
    movieId: session.movie,
  });
};

/** Revoke only a session owned by the authenticated user; idempotent by design. */
export const revokePlaybackSession = async ({ sessionId, userId }) => {
  if (typeof sessionId !== "string" || !credentialPattern.test(sessionId)
    || !mongoose.isValidObjectId(userId)) {
    return false;
  }
  const result = await PlaybackSession.updateOne(
    { credentialHash: hashCredential(sessionId), user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
  return result.matchedCount > 0;
};

export const playbackStorageReferenceIsValid = async (videoUrl) => Boolean(await resolveStoredVideoFile(videoUrl));
