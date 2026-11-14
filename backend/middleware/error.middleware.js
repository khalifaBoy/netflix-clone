import multer from "multer";
import ApiError from "../utils/ApiError.js";
import { redactPlaybackSessionUrl } from "../utils/security-log.js";

const normalizeError = (error) => {
  if (error instanceof ApiError) {
    return {
      status: Number.isInteger(error.statusCode) ? error.statusCode : 500,
      code: error.statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : (error.code || "INVALID_REQUEST"),
      message: error.statusCode >= 500 ? "Internal server error" : error.message,
    };
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE" || error.code === "LIMIT_FIELD_VALUE") {
      return { status: 413, code: "UPLOAD_TOO_LARGE", message: "Uploaded file exceeds the allowed size" };
    }
    return { status: 400, code: "INVALID_UPLOAD", message: "Invalid multipart upload" };
  }

  if (error?.type === "entity.too.large") {
    return { status: 413, code: "REQUEST_TOO_LARGE", message: "Request body exceeds the allowed size" };
  }

  if (error?.type === "parameters.too.many" || error?.status === 413 || error?.statusCode === 413) {
    return { status: 413, code: "REQUEST_TOO_LARGE", message: "Request body exceeds the allowed limits" };
  }

  if (error?.type === "entity.parse.failed") {
    return { status: 400, code: "INVALID_JSON", message: "Request body contains invalid JSON" };
  }

  if (error?.status === 415 || error?.statusCode === 415) {
    return { status: 415, code: "UNSUPPORTED_MEDIA_TYPE", message: "Request media type is not supported" };
  }

  if (error?.name === "ValidationError") {
    return { status: 400, code: "VALIDATION_ERROR", message: "Request data is invalid" };
  }

  if (error?.name === "CastError") {
    return { status: 400, code: "INVALID_ID", message: "A supplied identifier is invalid" };
  }

  if (error?.code === 11000 || error?.code === "11000") {
    const field = Object.keys(error.keyPattern || {})[0];
    const message = field === "email"
      ? "An account with this email already exists"
      : "A record with these values already exists";
    return { status: 409, code: field === "email" ? "EMAIL_ALREADY_EXISTS" : "CONFLICT", message };
  }

  if (error?.status === 400 && error?.type === "entity.verify.failed") {
    return { status: 400, code: "INVALID_REQUEST_BODY", message: "Request body could not be processed" };
  }

  if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 500) {
    return { status: error.status, code: "INVALID_REQUEST", message: "Request could not be processed" };
  }

  return { status: 500, code: "INTERNAL_SERVER_ERROR", message: "Internal server error" };
};

const codeForStatus = (status) => ({
  400: "INVALID_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "REQUEST_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
}[status] || (status >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_FAILED"));

// Existing controllers return { success: false, message } directly. Add a
// stable machine-readable code without changing their established payloads.
export const errorResponseContract = (req, res, next) => {
  const sendJson = res.json.bind(res);
  res.json = (body) => {
    if (body && body.success === false && !body.code) {
      body.code = codeForStatus(res.statusCode);
    }
    return sendJson(body);
  };
  next();
};

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  const normalized = normalizeError(error);
  if (normalized.status >= 500) {
    // Do not write stacks, query values, or error messages to production logs.
    if (process.env.NODE_ENV === "production") {
      console.error("Unhandled request error", { name: error?.name, code: error?.code });
    } else {
      console.error("Unhandled request error", {
        name: error?.name,
        code: error?.code,
        message: redactPlaybackSessionUrl(error?.message || ""),
        stack: redactPlaybackSessionUrl(error?.stack || ""),
      });
    }
  }

  return res.status(normalized.status).json({
    success: false,
    message: normalized.message,
    code: normalized.code,
  });
};

export { normalizeError };
