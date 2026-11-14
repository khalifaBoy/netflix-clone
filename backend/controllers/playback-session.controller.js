import { constants as fsConstants } from "node:fs";
import { open } from "node:fs/promises";
import path from "node:path";
import ApiError from "../utils/ApiError.js";
import {
  createPlaybackSession,
  revokePlaybackSession,
  validatePlaybackCredential,
} from "../services/playback-session.service.js";

const VIDEO_CONTENT_TYPES = Object.freeze({
  ".mp4": "video/mp4",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",
  ".mpeg": "video/mpeg",
  ".mpg": "video/mpeg",
});

const setPlaybackSecurityHeaders = (res) => {
  res.set({
    "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  });
};

const parseSingleByteRange = (header, size) => {
  if (header === undefined) return { partial: false, start: 0, end: size - 1 };
  if (typeof header !== "string") return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match || (!match[1] && !match[2]) || size === 0) return null;

  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    return { partial: true, start: Math.max(0, size - suffixLength), end: size - 1 };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd)
    || start >= size || requestedEnd < start) return null;
  return { partial: true, start, end: Math.min(requestedEnd, size - 1) };
};

const unavailableResponse = (res) => res.status(404).json({
  success: false,
  code: "PLAYBACK_SESSION_NOT_FOUND",
  message: "Playback session is unavailable",
});

export const streamMedia = async (req, res, next) => {
  setPlaybackSecurityHeaders(res);
  let fileHandle;

  try {
    // The random session credential is the bearer authorization for native
    // media requests; validation rechecks profile ownership and maturity.
    const { movie, filePath } = await validatePlaybackCredential({ sessionId: req.params.sessionId });
    const contentType = VIDEO_CONTENT_TYPES[pathExtension(movie.videoUrl)];
    if (!contentType) return unavailableResponse(res);

    try {
      fileHandle = await open(filePath, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
    } catch (error) {
      if (["ENOENT", "EACCES", "ELOOP"].includes(error?.code)) return unavailableResponse(res);
      return next(new ApiError(500, "VIDEO_STREAM_UNAVAILABLE", "Video could not be streamed"));
    }

    const fileStat = await fileHandle.stat();
    if (!fileStat.isFile()) {
      await fileHandle.close().catch(() => {});
      fileHandle = null;
      return unavailableResponse(res);
    }

    res.set("Content-Type", contentType);
    const range = parseSingleByteRange(req.headers.range, fileStat.size);
    if (!range) {
      res.status(416).set({
        "Content-Range": `bytes */${fileStat.size}`,
        "Content-Length": "0",
      });
      await fileHandle.close().catch(() => {});
      fileHandle = null;
      return res.end();
    }

    const length = fileStat.size === 0 ? 0 : range.end - range.start + 1;
    res.status(range.partial ? 206 : 200);
    res.set("Content-Length", String(length));
    if (range.partial) {
      res.set("Content-Range", `bytes ${range.start}-${range.end}/${fileStat.size}`);
    }

    if (req.method === "HEAD" || length === 0) {
      await fileHandle.close();
      fileHandle = null;
      return res.end();
    }

    const stream = fileHandle.createReadStream({
      start: range.start,
      end: range.end,
      autoClose: true,
    });
    fileHandle = null;
    req.once("aborted", () => stream.destroy());
    res.once("close", () => {
      if (!res.writableFinished) stream.destroy();
    });
    stream.once("error", (error) => {
      if (res.headersSent) {
        res.destroy();
      } else if (["ENOENT", "EACCES", "ELOOP"].includes(error?.code)) {
        res.removeHeader("Content-Length");
        res.removeHeader("Content-Range");
        unavailableResponse(res);
      } else {
        res.removeHeader("Content-Length");
        res.removeHeader("Content-Range");
        res.status(500).json({ success: false, message: "Video could not be streamed" });
      }
    });
    stream.pipe(res);
  } catch (error) {
    if (fileHandle) await fileHandle.close().catch(() => {});
    return next(error);
  }
};

const pathExtension = (videoUrl) => {
  if (typeof videoUrl !== "string") return "";
  return path.extname(videoUrl).toLowerCase();
};

export const createSession = async (req, res, next) => {
  try {
    const session = await createPlaybackSession({
      userId: req.user._id,
      profileId: req.body.profileId,
      movieId: req.body.movieId,
    });
    res.set("Cache-Control", "no-store");
    return res.status(201).json({ success: true, session });
  } catch (error) {
    return next(error);
  }
};

export const revokeSession = async (req, res, next) => {
  try {
    await revokePlaybackSession({ sessionId: req.params.sessionId, userId: req.user._id });
    return res.status(200).json({ success: true, message: "Playback session revoked" });
  } catch (error) {
    return next(error);
  }
};
