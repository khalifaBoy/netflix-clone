export interface ApiSuccess {
  success: true;
  message?: string;
}

export interface ApiFailure {
  success: false;
  message: string;
  code: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt?: string;
}

export interface Profile {
  _id: string;
  user: string;
  name: string;
  avatar?: string;
  isKids: boolean;
  language: string;
  maturityLevel: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Movie {
  _id: string;
  title: string;
  description: string;
  longDescription?: string;
  genres: string[];
  cast: string[];
  year: number;
  rating: string;
  duration: string;
  durationSeconds?: number | null;
  match?: number;
  backdrop?: string;
  poster?: string;
  videoUrl?: string;
  trailerUrl?: string;
  isNewRelease?: boolean;
  isTop10?: boolean;
  language?: string;
  maturityRating?: string;
  director?: string;
  releaseDate?: string | null;
  views?: number;
  isPublished?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface WatchlistItem {
  _id: string;
  profile: string;
  movie: Movie;
  addedAt: string;
}

export interface WatchHistoryRecord {
  _id: string;
  profile: string;
  movie: Movie;
  progressSeconds: number;
  durationSeconds?: number | null;
  lastWatchedAt: string;
  completedAt: string | null;
  watchCount: number;
}

export type RecommendationFeedbackType =
  | "NOT_INTERESTED"
  | "MORE_LIKE_THIS"
  | "ALREADY_WATCHED";

export interface RecommendationFeedback {
  _id: string;
  profile: string;
  movie: string;
  type: RecommendationFeedbackType;
  createdAt: string;
  updatedAt: string;
}

export interface ApiMessageResponse extends ApiSuccess {
  message: string;
}

export interface AuthResponse extends ApiMessageResponse {
  token: string;
  user: User;
  profiles: Profile[];
}

export interface MeResponse extends ApiMessageResponse {
  user: User;
  profiles: Profile[];
}

export interface ProfilesResponse extends ApiSuccess {
  profiles: Profile[];
}

export interface ProfileResponse extends ApiSuccess {
  profile: Profile;
}

export interface ProfileMutationResponse extends ApiMessageResponse {
  profile: Profile;
}

export interface MoviesResponse extends ApiSuccess {
  movies: Movie[];
  pagination: Pagination;
}

export interface MovieResponse extends ApiSuccess {
  movie: Movie;
}

export interface MovieMutationResponse extends ApiMessageResponse {
  movie: Movie;
}

export interface RecommendationsResponse extends ApiSuccess {
  profile: { id: string; name: string };
  count: number;
  movies: Movie[];
}

export interface RecommendationSearchResponse extends ApiSuccess {
  query: string;
  profile: { id: string; name: string };
  count: number;
  movies: Movie[];
}

export interface WatchlistResponse extends ApiSuccess {
  watchlist: WatchlistItem[];
}

export interface WatchlistItemResponse extends ApiMessageResponse {
  watchlistItem: WatchlistItem;
}

export interface WatchHistoryResponse extends ApiSuccess {
  history: WatchHistoryRecord[];
  nextCursor?: string | null;
}

export interface WatchHistoryItemResponse extends ApiSuccess {
  history: WatchHistoryRecord;
}

export interface FeedbackResponse extends ApiSuccess {
  feedback: RecommendationFeedback;
}

export interface MovieListParams {
  page?: number;
  limit?: number;
  search?: string;
  genre?: string;
  isNewRelease?: boolean;
  isTop10?: boolean;
}

export interface ProfileInput {
  name: string;
  avatar?: string;
  isKids?: boolean;
  language?: string;
  maturityLevel?: string;
}
