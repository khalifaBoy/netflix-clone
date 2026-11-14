import axiosInstance, { getMediaUrl, getProfileRequestConfig } from "@/lib/axios";
import type {
  AuthResponse,
  FeedbackResponse,
  MeResponse,
  MovieListParams,
  MovieMutationResponse,
  MovieResponse,
  MoviesResponse,
  PlaybackSessionResponse,
  Profile,
  ProfileInput,
  ProfileMutationResponse,
  ProfileResponse,
  ProfilesResponse,
  RecommendationFeedbackType,
  RecommendationSearchResponse,
  RecommendationsResponse,
  WatchHistoryItemResponse,
  WatchHistoryResponse,
  WatchlistItemResponse,
  WatchlistResponse,
} from "@/lib/types";

export { getMediaUrl };

export const isRequestCancelled = (error: unknown) =>
  typeof error === "object" && error !== null &&
  "code" in error && ["REQUEST_CANCELLED", "PROFILE_CONTEXT_CHANGED"].includes(String(error.code));

const profileConfig = (profileId: string) => getProfileRequestConfig(profileId);

export const api = {
  auth: {
    login: (email: string, password: string) =>
      axiosInstance.post<AuthResponse>("/auth/login", { email, password }),
    register: (name: string, email: string, password: string) =>
      axiosInstance.post<AuthResponse>("/auth/register", { name, email, password }),
    me: () => axiosInstance.get<MeResponse>("/auth/me"),
  },

  profiles: {
    list: () => axiosInstance.get<ProfilesResponse>("/profiles"),
    get: (profileId: string) => axiosInstance.get<ProfileResponse>(`/profiles/${profileId}`),
    create: (input: ProfileInput) => axiosInstance.post<ProfileMutationResponse>("/profiles", input),
    update: (profileId: string, input: Partial<ProfileInput>) =>
      axiosInstance.patch<ProfileMutationResponse>(`/profiles/${profileId}`, input),
    remove: (profileId: string) => axiosInstance.delete<{ success: true; message: string }>(`/profiles/${profileId}`),
    select: (profileId: string) =>
      axiosInstance.post<ProfileMutationResponse>(`/profiles/${profileId}/select`),
  },

  movies: {
    list: (profileId: string, params: MovieListParams = {}) =>
      axiosInstance.get<MoviesResponse>("/movies", { params: { ...params, profileId }, ...profileConfig(profileId) }),
    get: (movieId: string, profileId: string) =>
      axiosInstance.get<MovieResponse>(`/movies/${movieId}`, { params: { profileId }, ...profileConfig(profileId) }),
    create: (data: FormData) => axiosInstance.post<MovieMutationResponse>("/movies", data),
    update: (movieId: string, data: FormData) =>
      axiosInstance.patch<MovieMutationResponse>(`/movies/${movieId}`, data),
    remove: (movieId: string) => axiosInstance.delete<{ success: true; message: string }>(`/movies/${movieId}`),
    incrementViews: (movieId: string, profileId: string) =>
      axiosInstance.post<{ success: true; views: number }>(`/movies/${movieId}/views`, null, {
        params: { profileId },
        ...profileConfig(profileId),
      }),
  },

  recommendations: {
    list: (profileId: string) =>
      axiosInstance.get<RecommendationsResponse>("/recommendations", {
        params: { profileId },
        ...profileConfig(profileId),
      }),
    search: (query: string, profileId: string) =>
      axiosInstance.get<RecommendationSearchResponse>("/recommendations/search", {
        params: { q: query, profileId },
        ...profileConfig(profileId),
      }),
    setFeedback: (movieId: string, profileId: string, type: RecommendationFeedbackType) =>
      axiosInstance.put<FeedbackResponse>(`/recommendations/${movieId}/feedback`, {
        profileId,
        type,
      }, profileConfig(profileId)),
    removeFeedback: (movieId: string, profileId: string) =>
      axiosInstance.delete<void>(`/recommendations/${movieId}/feedback`, {
        params: { profileId },
        ...profileConfig(profileId),
      }),
  },

  playback: {
    createSession: (profileId: string, movieId: string) =>
      axiosInstance.post<PlaybackSessionResponse>("/playback/sessions", { profileId, movieId }, profileConfig(profileId)),
    revokeSession: (sessionId: string, token?: string) =>
      axiosInstance.delete<{ success: true; message: string }>(`/playback/sessions/${encodeURIComponent(sessionId)}`, {
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      }),
  },

  watchlist: {
    list: (profileId: string) =>
      axiosInstance.get<WatchlistResponse>("/watchlist", {
        params: { profileId },
        ...profileConfig(profileId),
      }),
    add: (movieId: string, profileId: string) =>
      axiosInstance.post<WatchlistItemResponse>(`/watchlist/${movieId}`, { profileId }, profileConfig(profileId)),
    remove: (movieId: string, profileId: string) =>
      axiosInstance.delete<{ success: true; message: string }>(`/watchlist/${movieId}`, {
        data: { profileId },
        ...profileConfig(profileId),
      }),
  },

  watchHistory: {
    updateProgress: (movieId: string, profileId: string, progressSeconds: number) =>
      axiosInstance.put<WatchHistoryItemResponse>(`/watch-history/${movieId}/progress`, {
        profileId,
        progressSeconds,
      }, profileConfig(profileId)),
    continueWatching: (profileId: string, limit?: number) =>
      axiosInstance.get<WatchHistoryResponse>("/watch-history/continue", {
        params: { profileId, limit },
        ...profileConfig(profileId),
      }),
    history: (profileId: string, limit?: number, cursor?: string) =>
      axiosInstance.get<WatchHistoryResponse>("/watch-history", {
        params: { profileId, limit, cursor },
        ...profileConfig(profileId),
      }),
  },
};

export type { Profile };
