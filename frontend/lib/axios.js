import axios from "axios";

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;

if (!configuredApiUrl) {
  throw new Error(
    "Backend URL is not configured. Set NEXT_PUBLIC_API_URL (preferred) or API_URL.",
  );
}

const normalizeApiUrl = (value) => {
  const trimmedValue = value.trim();
  if (trimmedValue.startsWith("/") && !trimmedValue.startsWith("//")) {
    const pathname = trimmedValue.replace(/\/+$/, "");
    return /(?:^|\/)api$/.test(pathname) ? pathname : `${pathname}/api`;
  }

  let parsed;
  try {
    parsed = new URL(trimmedValue);
  } catch {
    throw new Error("Backend URL must be a valid absolute HTTP(S) URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("Backend URL must use HTTP(S) and must not contain credentials.");
  }
  if (parsed.search || parsed.hash) {
    throw new Error("Backend URL must not contain a query string or fragment.");
  }

  const pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.pathname = /(?:^|\/)api$/.test(pathname) ? pathname : `${pathname}/api`;
  return parsed.toString().replace(/\/+$/, "");
};

const normalizedApiUrl = normalizeApiUrl(configuredApiUrl);

// NEXT_PUBLIC_API_URL is the API root (including /api). The same origin is
// used for media paths returned by the backend.
export const API_BASE_URL = normalizedApiUrl;
export const MEDIA_BASE_URL = API_BASE_URL.replace(/\/api$/, "");

export const getMediaUrl = (mediaPath) => {
  if (!mediaPath) return "";
  if (/^https?:\/\//i.test(mediaPath)) return mediaPath;
  return `${MEDIA_BASE_URL}${mediaPath.startsWith("/") ? "" : "/"}${mediaPath}`;
};

export class ApiError extends Error {
  constructor({ message, status = 0, code = "NETWORK_ERROR", data = null, cause }) {
    super(message || "The request could not be completed", { cause });
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

let unauthorizedHandler = null;
let activeProfileId = null;
let profileRequestController = new AbortController();

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

export const setActiveProfileScope = (profileId) => {
  const nextProfileId = profileId || null;
  if (nextProfileId === activeProfileId) return;

  profileRequestController.abort();
  profileRequestController = new AbortController();
  activeProfileId = nextProfileId;
};

export const getProfileRequestConfig = (profileId) => {
  if (!profileId || profileId !== activeProfileId) {
    throw new ApiError({
      message: "The selected profile changed before this request could be sent",
      code: "PROFILE_CONTEXT_CHANGED",
    });
  }
  return { signal: profileRequestController.signal };
};

export const normalizeApiError = (error) => {
  if (error instanceof ApiError) return error;
  if (axios.isCancel(error) || error?.code === "ERR_CANCELED") {
    return new ApiError({
      message: "The request was cancelled because the active profile changed",
      code: "REQUEST_CANCELLED",
      cause: error,
    });
  }

  const data = error?.response?.data;
  return new ApiError({
    message: data?.message || error?.message || "The request could not be completed",
    status: error?.response?.status || 0,
    code: data?.code || (error?.response ? "REQUEST_FAILED" : "NETWORK_ERROR"),
    data: data || null,
    cause: error,
  });
};

const axiosInstance = axios.create({ baseURL: API_BASE_URL });

axiosInstance.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      if (token) config.headers.set("Authorization", `Bearer ${token}`);
    }
    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      config.headers.delete("Content-Type");
    }
    return config;
  },
  (error) => Promise.reject(normalizeApiError(error)),
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error?.config?.url || "";
    const isCredentialSubmission = /\/auth\/(login|register)\/?(?:\?|$)/.test(requestUrl);
    if (error?.response?.status === 401 && !isCredentialSubmission) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("profiles");
        localStorage.removeItem("selectedProfile");
        setActiveProfileScope(null);
        if (unauthorizedHandler) unauthorizedHandler();
        if (window.location.pathname !== "/login") window.location.assign("/login");
      }
    }
    return Promise.reject(normalizeApiError(error));
  },
);

export default axiosInstance;
