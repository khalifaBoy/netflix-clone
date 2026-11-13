export default class ApiError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace?.(this, ApiError);
  }
}
