import ApiError from "../utils/ApiError.js";

const DEVELOPMENT_ORIGINS = ["http://localhost:3000"];

export const getAllowedFrontendOrigins = (env = process.env) => {
  const configuredOrigins = env.FRONTEND_URL?.split(",").map((origin) => origin.trim()).filter(Boolean) || [];
  if (configuredOrigins.length === 0) {
    if (env.NODE_ENV === "production") {
      throw new Error("FRONTEND_URL must be configured in production");
    }
    return new Set(DEVELOPMENT_ORIGINS);
  }

  const origins = configuredOrigins.map((value) => {
    if (value === "*") throw new Error("FRONTEND_URL must contain explicit origins, not a wildcard");
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`FRONTEND_URL contains an invalid origin: ${value}`);
    }
    if (!(["http:", "https:"].includes(parsed.protocol))
      || parsed.username || parsed.password || parsed.pathname !== "/"
      || parsed.search || parsed.hash) {
      throw new Error(`FRONTEND_URL must contain origins without credentials, paths, queries, or fragments: ${value}`);
    }
    return parsed.origin;
  });
  return new Set(origins);
};

export const createCorsOptions = (env = process.env) => {
  const allowedOrigins = getAllowedFrontendOrigins(env);
  return {
    origin(origin, callback) {
      // Requests without an Origin header are non-browser/server-to-server
      // requests and receive no CORS permission headers.
      if (!origin) return callback(null, false);
      if (allowedOrigins.has(origin)) return callback(null, origin);
      return callback(new ApiError(403, "CORS_ORIGIN_DENIED", "Origin is not allowed"));
    },
    credentials: true,
    optionsSuccessStatus: 204,
  };
};
