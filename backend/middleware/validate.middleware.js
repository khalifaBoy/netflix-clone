import { unlink } from "node:fs/promises";
import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import { MAX_MOVIE_DURATION_SECONDS } from "../services/movie-duration.service.js";
import { RECOMMENDATION_FEEDBACK_TYPES } from "../models/RecommendationFeedback.js";

const fail = (message, code = "VALIDATION_ERROR") => {
  throw new ApiError(400, code, message);
};

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const requireRecord = (value, name = "Request body") => {
  if (!isRecord(value)) fail(`${name} must be an object`);
};

const requireString = (value, name, { required = false, min = 0, max = 5000, email = false } = {}) => {
  if (value === undefined) {
    if (required) fail(`${name} is required`);
    return;
  }
  if (typeof value !== "string") fail(`${name} must be a string`);
  const normalized = value.trim();
  if (required && normalized.length === 0) fail(`${name} is required`);
  if (normalized.length < min) fail(`${name} must be at least ${min} characters`);
  if (normalized.length > max) fail(`${name} cannot exceed ${max} characters`);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) fail("Email address is invalid");
};

const requireBoolean = (value, name) => {
  if (value !== undefined && value !== true && value !== false && value !== "true" && value !== "false") {
    fail(`${name} must be a boolean`);
  }
};

const requireObjectId = (value, name) => {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value) || !mongoose.Types.ObjectId.isValid(value)) {
    fail(`${name} is invalid`, "INVALID_ID");
  }
};

const requireNumber = (value, name, { required = false, min = -Infinity, max = Infinity, integer = false } = {}) => {
  if (value === undefined) {
    if (required) fail(`${name} is required`);
    return;
  }
  if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "") fail(`${name} must be a number`);
  const number = Number(value);
  if (!Number.isFinite(number) || (integer && !Number.isInteger(number)) || number < min || number > max) {
    fail(`${name} is out of range`);
  }
};

export const validate = (validator, { cleanupUpload = false } = {}) => async (req, res, next) => {
  try {
    validator(req);
    return next();
  } catch (error) {
    if (cleanupUpload && req.file?.path) {
      await unlink(req.file.path).catch(() => {});
    }
    return next(error);
  }
};

export const objectIdParam = (paramName) => validate((req) => requireObjectId(req.params[paramName], paramName));

export const validateLogin = validate((req) => {
  requireRecord(req.body);
  requireString(req.body.email, "Email", { required: true, max: 254, email: true });
  requireString(req.body.password, "Password", { required: true, min: 1, max: 72 });
});

export const validateRegistration = validate((req) => {
  requireRecord(req.body);
  requireString(req.body.name, "Name", { required: true, min: 2, max: 50 });
  requireString(req.body.email, "Email", { required: true, max: 254, email: true });
  requireString(req.body.password, "Password", { required: true, min: 6, max: 72 });
});

const validateProfileFields = (body, partial) => {
  requireRecord(body);
  requireString(body.name, "Profile name", { required: !partial, min: 1, max: 30 });
  requireString(body.avatar, "Avatar", { max: 2048 });
  requireBoolean(body.isKids, "isKids");
  requireString(body.language, "Language", { max: 64 });
  if (body.maturityLevel !== undefined && !["All", "7+", "13+", "16+", "18+"].includes(body.maturityLevel)) {
    fail("maturityLevel is invalid");
  }
  if (partial && !["name", "avatar", "isKids", "language", "maturityLevel"].some((key) => body[key] !== undefined)) {
    fail("At least one profile field must be provided");
  }
};

export const validateCreateProfile = validate((req) => validateProfileFields(req.body, false));
export const validateUpdateProfile = validate((req) => validateProfileFields(req.body, true));

export const validateProfileIdQuery = validate((req) => {
  requireObjectId(req.query.profileId, "profileId");
});

export const validateProfileIdBody = validate((req) => {
  requireRecord(req.body);
  requireObjectId(req.body.profileId, "profileId");
});

export const validateWatchHistoryProgress = validate((req) => {
  requireRecord(req.body);
  requireObjectId(req.body.profileId, "profileId");
  if (Object.hasOwn(req.body, "durationSeconds")
    || Object.hasOwn(req.body, "completedAt")
    || Object.hasOwn(req.body, "completed")) {
    fail("durationSeconds and completion fields are server-controlled");
  }
  if (typeof req.body.progressSeconds !== "number"
    || !Number.isFinite(req.body.progressSeconds)
    || req.body.progressSeconds < 0) {
    fail("progressSeconds must be a finite nonnegative number");
  }
});

const validateWatchHistoryQueryFields = (req) => {
  requireObjectId(req.query.profileId, "profileId");
  if (req.query.limit !== undefined) {
    if (typeof req.query.limit !== "string" || !/^\d+$/.test(req.query.limit)) {
      fail("limit must be a positive integer");
    }
    const limit = Number(req.query.limit);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) fail("limit must be between 1 and 50");
  }
};

export const validateWatchHistoryQuery = validate(validateWatchHistoryQueryFields);
export const validateContinueWatchingQuery = validate(validateWatchHistoryQueryFields);
export const validateWatchHistoryCursor = validate((req) => {
  validateWatchHistoryQueryFields(req);
  if (req.query.cursor !== undefined
    && (typeof req.query.cursor !== "string" || req.query.cursor.length > 256 || !/^[A-Za-z\d_-]+$/.test(req.query.cursor))) {
    fail("cursor is invalid", "INVALID_CURSOR");
  }
});

export const validateMovieListQuery = validate((req) => {
  const { page = "1", limit = "20", search, genre, isNewRelease, isTop10 } = req.query;
  for (const [key, value] of [["page", page], ["limit", limit]]) {
    if (typeof value !== "string" || !/^\d+$/.test(value)) fail(`${key} must be a positive integer`);
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 1 || (key === "limit" && number > 100)) fail(`${key} is out of range`);
  }
  requireString(search, "search", { max: 200 });
  requireString(genre, "genre", { max: 80 });
  for (const [key, value] of [["isNewRelease", isNewRelease], ["isTop10", isTop10]]) {
    if (value !== undefined && value !== "true" && value !== "false") fail(`${key} must be true or false`);
  }
});

const normalizeListField = (value, name) => {
  if (value === undefined || value === "") return;
  let list = value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) list = parsed;
      else list = value.split(",");
    } catch {
      list = value.split(",");
    }
  }
  if (!Array.isArray(list) || list.length > 100 || list.some((item) => typeof item !== "string" || item.trim().length > 120)) {
    fail(`${name} must be a list of strings`);
  }
};

const movieFields = ["title", "description", "longDescription", "backdrop", "poster", "year", "rating", "duration", "durationSeconds", "genres", "cast", "match", "isNewRelease", "isTop10", "trailerUrl", "director", "language", "maturityRating", "isPublished", "releaseDate"];

const validateMovieFields = (req, partial) => {
  requireRecord(req.body);
  const body = req.body;
  const stringOptions = {
    title: { required: !partial, min: 1, max: 200 },
    description: { required: !partial, min: 1, max: 2000 },
    longDescription: { max: 10000 },
    backdrop: { required: !partial, max: 2048 },
    poster: { required: !partial, max: 2048 },
    rating: { required: !partial, min: 1, max: 32 },
    duration: { required: !partial, min: 1, max: 32 },
    trailerUrl: { max: 2048 },
    director: { max: 120 },
    language: { max: 64 },
  maturityRating: { max: 16 },
  };
  for (const [field, options] of Object.entries(stringOptions)) requireString(body[field], field, options);
  if (body.maturityRating !== undefined && !["All", "7+", "13+", "16+", "18+"].includes(body.maturityRating)) {
    fail("maturityRating is invalid");
  }
  requireNumber(body.year, "year", { required: !partial, min: 1888, max: 2200, integer: true });
  requireNumber(body.match, "match", { min: 0, max: 100 });
  if (body.durationSeconds !== undefined && body.durationSeconds !== null) {
    if (typeof body.durationSeconds === "string" && !/^\d+$/.test(body.durationSeconds.trim())) {
      fail("durationSeconds must be a positive integer");
    }
    requireNumber(body.durationSeconds, "durationSeconds", {
      min: 1,
      max: MAX_MOVIE_DURATION_SECONDS,
      integer: true,
    });
  }
  for (const field of ["isNewRelease", "isTop10", "isPublished"]) requireBoolean(body[field], field);
  normalizeListField(body.genres, "genres");
  normalizeListField(body.cast, "cast");
  if (body.releaseDate !== undefined && body.releaseDate !== "" && Number.isNaN(Date.parse(body.releaseDate))) {
    fail("releaseDate must be a valid date");
  }
  if (!partial && !req.file) fail("Movie video is required");
  if (partial && !req.file && !movieFields.some((field) => body[field] !== undefined)) {
    fail("At least one movie field or video must be provided");
  }
};

export const validateCreateMovie = validate((req) => validateMovieFields(req, false), { cleanupUpload: true });
export const validateUpdateMovie = validate((req) => validateMovieFields(req, true), { cleanupUpload: true });

export const validateRecommendationQuery = validate((req) => {
  requireObjectId(req.query.profileId, "profileId");
});

export const validateRecommendationSearchQuery = validate((req) => {
  requireObjectId(req.query.profileId, "profileId");
  requireString(req.query.q, "q", { required: true, min: 1, max: 200 });
});

export const validateRecommendationFeedbackBody = validate((req) => {
  requireRecord(req.body);
  requireObjectId(req.body.profileId, "profileId");
  if (!RECOMMENDATION_FEEDBACK_TYPES.includes(req.body.type)) {
    fail("type must be a supported recommendation feedback value");
  }
});

export const validateRecommendationFeedbackQuery = validate((req) => {
  requireObjectId(req.query.profileId, "profileId");
});

export const validatePlaybackSessionBody = validate((req) => {
  requireRecord(req.body);
  requireObjectId(req.body.profileId, "profileId");
  requireObjectId(req.body.movieId, "movieId");
});

export const validatePlaybackSessionId = validate((req) => {
  if (typeof req.params.sessionId !== "string"
    || !/^[A-Za-z0-9_-]{40,60}$/.test(req.params.sessionId)) {
    fail("sessionId is invalid", "INVALID_ID");
  }
});
