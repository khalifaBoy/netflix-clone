import multer from "multer";
import ApiError from "../utils/ApiError.js";

const normalizeError = (error) => {
  if (error instanceof ApiError) {
    return { status: error.statusCode, code: error.code, message: error.message };
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

  if (error?.type === "parameters.too.many" || error?.status === 413) {
    return { status: 413, code: "REQUEST_TOO_LARGE", message: "Request body exceeds the allowed limits" };
  }

  if (error?.type === "entity.parse.failed") {
    return { status: 400, code: "INVALID_JSON", message: "Request body contains invalid JSON" };
  }

  if (error?.status === 415) {
    return { status: 415, code: "UNSUPPORTED_MEDIA_TYPE", message: "Request media type is not supported" };
  }

  if (error?.name === "ValidationError") {
    return { status: 400, code: "VALIDATION_ERROR", message: "Request data is invalid" };
  }

  if (error?.name === "CastError") {
    return { status: 400, code: "INVALID_ID", message: "A supplied identifier is invalid" };
  }

  if (error?.code === 11000) {
    return { status: 409, code: "CONFLICT", message: "A record with these values already exists" };
  }

  if (error?.status === 400 && error?.type === "entity.verify.failed") {
    return { status: 400, code: "INVALID_REQUEST_BODY", message: "Request body could not be processed" };
  }

  if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 500) {
    return { status: error.status, code: "INVALID_REQUEST", message: "Request could not be processed" };
  }

  return { status: 500, code: "INTERNAL_SERVER_ERROR", message: "Internal server error" };
};

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  const normalized = normalizeError(error);
  if (normalized.status >= 500) {
    console.error("Unhandled request error:", error);
  }

  return res.status(normalized.status).json({
    success: false,
    message: normalized.message,
  });
};

export { normalizeError };
