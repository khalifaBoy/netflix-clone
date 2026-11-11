"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Film,
  Upload,
  Trash2,
  Loader2,
  X,
  CheckCircle,
  ArrowLeft,
  Play,
  Database,
  Search,
} from "lucide-react";

import axiosInstance from "@/lib/axios";

import { allMovies, type Movie } from "@/lib/movie";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/Authcontext";

/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

type BackendMovie = {
  _id: string;
  title: string;
  description: string;
  longDescription?: string;
  backdrop?: string;
  poster?: string;
  year: number;
  rating: string;
  duration: string;
  genres: string[];
  cast: string[];
  match?: number;
  isNewRelease?: boolean;

  isTop10?: boolean;

  videoUrl: string;

  trailerUrl?: string;
  director?: string;
  language?: string;
  maturityRating?: string;
  views?: number;
  isPublished?: boolean;

  createdAt?: string;
  updatedAt?: string;
};

/*
|--------------------------------------------------------------------------
| API URL
|--------------------------------------------------------------------------
|
| Example:
| NEXT_PUBLIC_API_URL=http://localhost:5000/api
|
*/

const API_ORIGIN = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
).replace(/\/api\/?$/, "");

/*
|--------------------------------------------------------------------------
| Video URL Helper
|--------------------------------------------------------------------------
*/

const getVideoUrl = (videoUrl?: string) => {
  if (!videoUrl) {
    return "";
  }

  if (videoUrl.startsWith("http://") || videoUrl.startsWith("https://")) {
    return videoUrl;
  }

  return `${API_ORIGIN}${videoUrl.startsWith("/") ? "" : "/"}${videoUrl}`;
};

/*
|--------------------------------------------------------------------------
| Empty Form
|--------------------------------------------------------------------------
*/

const emptyForm = {
  title: "",
  description: "",
  longDescription: "",
  backdrop: "",
  poster: "",
  year: "",
  rating: "",
  duration: "",
  genres: "",
  cast: "",
  match: "0",
  isNewRelease: false,
  isTop10: false,
  trailerUrl: "",
  director: "",
  language: "English",
  maturityRating: "13+",
};

/*
|--------------------------------------------------------------------------
| Page
|--------------------------------------------------------------------------
*/

const UploadPage = () => {
  const router = useRouter();

  const { user, loading: authLoading } = useAuth();

  const [selectedStaticMovie, setSelectedStaticMovie] = useState<Movie | null>(
    null,
  );

  const [movies, setMovies] = useState<BackendMovie[]>([]);

  const [searchStaticMovie, setSearchStaticMovie] = useState("");

  const [loadingMovies, setLoadingMovies] = useState(true);

  const [uploading, setUploading] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [videoFile, setVideoFile] = useState<File | null>(null);

  const [videoPreview, setVideoPreview] = useState("");

  const [form, setForm] = useState(emptyForm);

  const filteredStaticMovies = useMemo(() => {
    const query = searchStaticMovie.trim().toLowerCase();

    if (!query) {
      return allMovies;
    }

    return allMovies.filter((movie) => {
      return (
        movie.title.toLowerCase().includes(query) ||
        movie.genres.some((genre) => genre.toLowerCase().includes(query))
      );
    });
  }, [searchStaticMovie]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role !== "admin") {
      router.replace("/browse");
    }
  }, [user, authLoading, router]);

  const fetchMovies = async () => {
    try {
      setLoadingMovies(true);
      setError("");

      const response = await axiosInstance.get("/movies");

      const fetchedMovies = response.data?.movies || response.data?.data || [];

      setMovies(fetchedMovies);
    } catch (error: any) {
      console.error("Fetch movies error:", error);

      setError(error?.response?.data?.message || "Failed to load movies.");
    } finally {
      setLoadingMovies(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user?.role === "admin") {
      fetchMovies();
    }
  }, [authLoading, user]);

  const handleSelectStaticMovie = (movie: Movie | null) => {
    setSelectedStaticMovie(movie);

    setError("");
    setSuccess("");

    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }

    setVideoFile(null);
    setVideoPreview("");

    if (!movie) {
      setForm(emptyForm);
      return;
    }
    setForm({
      title: movie.title,

      description: movie.description,

      longDescription: movie.longDescription,

      backdrop: movie.backdrop,

      poster: movie.poster,

      year: String(movie.year),

      rating: movie.rating,

      duration: movie.duration,

      genres: movie.genres.join(", "),

      cast: movie.cast.join(", "),

      match: String(movie.match),

      isNewRelease: movie.isNew ?? false,

      isTop10: movie.isTop10 ?? false,

      trailerUrl: "",

      director: "",

      language: "English",

      maturityRating: movie.rating || "13+",
    });
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: checked,
    }));
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    const allowedTypes = [
      "video/mp4",
      "video/mpeg",
      "video/webm",
      "video/quicktime",
      "video/x-matroska",
    ];
    if (!allowedTypes.includes(file.type)) {
      setError("Invalid video format. Use MP4, MPEG, WebM, MOV or MKV.");
      e.target.value = "";
      return;
    }
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }
    const preview = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoPreview(preview);
    setError("");
  };

  const clearVideo = () => {
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }

    setVideoFile(null);
    setVideoPreview("");

    const input = document.getElementById("video") as HTMLInputElement | null;

    if (input) {
      input.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!selectedStaticMovie) {
      setError("Please select a movie from the static movie list.");

      return;
    }

    if (!videoFile) {
      setError("Please select the movie video.");

      return;
    }

    if (!form.title.trim()) {
      setError("Movie title is required.");

      return;
    }

    if (!form.description.trim()) {
      setError("Movie description is required.");

      return;
    }

    const formData = new FormData();

    /*
    | Basic information
    */

    formData.append("title", form.title.trim());

    formData.append("description", form.description.trim());

    formData.append("longDescription", form.longDescription.trim());

    /*
    | Images
    */

    formData.append("backdrop", form.backdrop.trim());

    formData.append("poster", form.poster.trim());

    formData.append("year", form.year);

    formData.append("rating", form.rating.trim());

    formData.append("duration", form.duration.trim());

    const genres = form.genres
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const cast = form.cast
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    formData.append("genres", JSON.stringify(genres));

    formData.append("cast", JSON.stringify(cast));

    formData.append("match", form.match || "0");

    formData.append("isNewRelease", String(form.isNewRelease));

    formData.append("isTop10", String(form.isTop10));

    formData.append("trailerUrl", form.trailerUrl.trim());

    formData.append("director", form.director.trim());

    formData.append("language", form.language);

    formData.append("maturityRating", form.maturityRating);

    if (videoFile) {
      formData.append("video", videoFile);
    }

    try {
      setUploading(true);

      const response = await axiosInstance.post("/movies", formData);

      const createdMovie = response.data?.movie || response.data?.data;

      /*
      |--------------------------------------------------------------------------
      | Add newly uploaded movie
      |--------------------------------------------------------------------------
      */

      if (createdMovie) {
        setMovies((previous) => [createdMovie, ...previous]);
      } else {
        await fetchMovies();
      }

      setSuccess(`${form.title} uploaded successfully.`);

      /*
      |--------------------------------------------------------------------------
      | Reset
      |--------------------------------------------------------------------------
      */

      setSelectedStaticMovie(null);

      setForm(emptyForm);

      clearVideo();

      /*
      | Reset static search
      */

      setSearchStaticMovie("");
    } catch (error: any) {
      console.error("Upload movie error:", error);

      setError(error?.response?.data?.message || "Failed to upload movie.");
    } finally {
      setUploading(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Delete Movie
  |--------------------------------------------------------------------------
  */

  const handleDelete = async (movieId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this movie?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(movieId);

      setError("");
      setSuccess("");

      await axiosInstance.delete(`/movies/${movieId}`);

      setMovies((previous) =>
        previous.filter((movie) => movie._id !== movieId),
      );

      setSuccess("Movie deleted successfully.");
    } catch (error: any) {
      console.error("Delete movie error:", error);

      setError(error?.response?.data?.message || "Failed to delete movie.");
    } finally {
      setDeletingId(null);
    }
  };


  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }



  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-[#141414] text-white">
      {/* ================================================================ */}
      {/* HEADER */}
      {/* ================================================================ */}

      <header className="sticky top-0 z-50 bg-[#141414]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center">
              <Film className="w-5 h-5" />
            </div>

            <div>
              <h1 className="text-xl font-bold">Netflix Admin</h1>

              <p className="text-xs text-white/40">Upload & Manage Movies</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/browse")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Netflix
          </button>
        </div>
      </header>

      {/* ================================================================ */}
      {/* MAIN */}
      {/* ================================================================ */}

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {/* ============================================================ */}
        {/* MESSAGES */}
        {/* ============================================================ */}

        {error && (
          <div className="mb-6 flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
            <X className="w-5 h-5 shrink-0" />

            <p className="text-sm">{error}</p>

            <button
              type="button"
              onClick={() => setError("")}
              className="ml-auto"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-center gap-3 bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg">
            <CheckCircle className="w-5 h-5 shrink-0" />

            <p className="text-sm">{success}</p>

            <button
              type="button"
              onClick={() => setSuccess("")}
              className="ml-auto"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* UPLOAD SECTION */}
        {/* ============================================================ */}

        <section className="bg-[#1f1f1f] border border-white/10 rounded-2xl overflow-hidden">
          {/* Section Header */}

          <div className="px-5 md:px-8 py-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Database className="w-6 h-6 text-red-500" />

              <div>
                <h2 className="text-2xl font-bold">Add Movie</h2>

                <p className="text-sm text-white/40 mt-1">
                  Select a movie from your static catalog and upload its video.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 md:p-8">
            {/* ======================================================== */}
            {/* STATIC MOVIE SELECTOR */}
            {/* ======================================================== */}

            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <label className="block text-sm font-medium text-white/80">
                    Select Movie
                  </label>

                  <p className="text-xs text-white/30 mt-1">
                    Choose from {allMovies.length} static movies.
                  </p>
                </div>

                {selectedStaticMovie && (
                  <button
                    type="button"
                    onClick={() => handleSelectStaticMovie(null)}
                    className="text-xs text-white/40 hover:text-white"
                  >
                    Clear selection
                  </button>
                )}
              </div>

              {/* Search */}

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />

                <input
                  type="text"
                  value={searchStaticMovie}
                  onChange={(e) => setSearchStaticMovie(e.target.value)}
                  placeholder="Search static movies..."
                  className="admin-input pl-10"
                />
              </div>

              {/* Select */}

              <select
                value={selectedStaticMovie?.id || ""}
                onChange={(e) => {
                  const movie = allMovies.find(
                    (item) => item.id === e.target.value,
                  );

                  handleSelectStaticMovie(movie || null);
                }}
                className="admin-input"
              >
                <option value="">Select a movie</option>

                {filteredStaticMovies.map((movie) => (
                  <option key={movie.id} value={movie.id}>
                    {movie.title} — {movie.year}
                  </option>
                ))}
              </select>
            </div>

            {/* ======================================================== */}
            {/* SELECTED MOVIE PREVIEW */}
            {/* ======================================================== */}

            {selectedStaticMovie && (
              <div className="mb-8 rounded-xl bg-black/40 border border-white/10 p-4 md:p-5">
                <div className="flex flex-col md:flex-row gap-5">
                  {/* Poster */}

                  <img
                    src={selectedStaticMovie.poster}
                    alt={selectedStaticMovie.title}
                    className="w-32 h-48 md:w-36 md:h-52 object-cover rounded-lg"
                  />

                  {/* Info */}

                  <div className="flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-2xl font-bold">
                          {selectedStaticMovie.title}
                        </h3>

                        <p className="text-sm text-white/50 mt-1">
                          {selectedStaticMovie.year} •{" "}
                          {selectedStaticMovie.duration} •{" "}
                          {selectedStaticMovie.rating}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        {selectedStaticMovie.isNew && (
                          <span className="px-2 py-1 rounded bg-red-600 text-[10px] font-bold">
                            NEW
                          </span>
                        )}

                        {selectedStaticMovie.isTop10 && (
                          <span className="px-2 py-1 rounded bg-white text-black text-[10px] font-bold">
                            TOP 10
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Genres */}

                    <div className="flex flex-wrap gap-2 mt-4">
                      {selectedStaticMovie.genres.map((genre) => (
                        <span
                          key={genre}
                          className="px-2.5 py-1 rounded-full bg-white/10 text-white/60 text-xs"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>

                    {/* Description */}

                    <p className="text-sm text-white/50 mt-4 leading-6">
                      {selectedStaticMovie.description}
                    </p>

                    {/* Cast */}

                    <p className="text-xs text-white/30 mt-3">
                      Cast:{" "}
                      <span className="text-white/50">
                        {selectedStaticMovie.cast.join(", ")}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* FORM */}
            {/* ======================================================== */}

            <form onSubmit={handleSubmit} className="space-y-7">
              {/* ==================================================== */}
              {/* MOVIE INFORMATION */}
              {/* ==================================================== */}

              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Movie Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Title */}

                  <div>
                    <label className="admin-label">Title</label>

                    <input
                      name="title"
                      value={form.title}
                      onChange={handleChange}
                      readOnly={!!selectedStaticMovie}
                      placeholder="Movie title"
                      className={cn(
                        "admin-input",
                        selectedStaticMovie && "opacity-70",
                      )}
                    />
                  </div>

                  {/* Year */}

                  <div>
                    <label className="admin-label">Year</label>

                    <input
                      name="year"
                      type="number"
                      value={form.year}
                      onChange={handleChange}
                      readOnly={!!selectedStaticMovie}
                      className={cn(
                        "admin-input",
                        selectedStaticMovie && "opacity-70",
                      )}
                    />
                  </div>

                  {/* Rating */}

                  <div>
                    <label className="admin-label">Rating</label>

                    <input
                      name="rating"
                      value={form.rating}
                      onChange={handleChange}
                      readOnly={!!selectedStaticMovie}
                      className={cn(
                        "admin-input",
                        selectedStaticMovie && "opacity-70",
                      )}
                    />
                  </div>

                  {/* Duration */}

                  <div>
                    <label className="admin-label">Duration</label>

                    <input
                      name="duration"
                      value={form.duration}
                      onChange={handleChange}
                      readOnly={!!selectedStaticMovie}
                      className={cn(
                        "admin-input",
                        selectedStaticMovie && "opacity-70",
                      )}
                    />
                  </div>

                  {/* Language */}

                  <div>
                    <label className="admin-label">Language</label>

                    <select
                      name="language"
                      value={form.language}
                      onChange={handleChange}
                      className="admin-input"
                    >
                      <option value="English">English</option>

                      <option value="Hindi">Hindi</option>

                      <option value="Tamil">Tamil</option>

                      <option value="Telugu">Telugu</option>

                      <option value="Kannada">Kannada</option>

                      <option value="Malayalam">Malayalam</option>
                    </select>
                  </div>

                  {/* Maturity */}

                  <div>
                    <label className="admin-label">Maturity Rating</label>

                    <select
                      name="maturityRating"
                      value={form.maturityRating}
                      onChange={handleChange}
                      className="admin-input"
                    >
                      <option value="All">All</option>

                      <option value="7+">7+</option>

                      <option value="13+">13+</option>

                      <option value="16+">16+</option>

                      <option value="18+">18+</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ==================================================== */}
              {/* DESCRIPTION */}
              {/* ==================================================== */}

              <div>
                <h3 className="text-lg font-semibold mb-4">Description</h3>

                <div className="space-y-5">
                  <div>
                    <label className="admin-label">Short Description</label>

                    <textarea
                      name="description"
                      value={form.description}
                      onChange={handleChange}
                      readOnly={!!selectedStaticMovie}
                      rows={3}
                      className={cn(
                        "admin-input resize-none",
                        selectedStaticMovie && "opacity-70",
                      )}
                    />
                  </div>

                  <div>
                    <label className="admin-label">Long Description</label>

                    <textarea
                      name="longDescription"
                      value={form.longDescription}
                      onChange={handleChange}
                      readOnly={!!selectedStaticMovie}
                      rows={5}
                      className={cn(
                        "admin-input resize-none",
                        selectedStaticMovie && "opacity-70",
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* ==================================================== */}
              {/* GENRES / CAST */}
              {/* ==================================================== */}

              <div>
                <h3 className="text-lg font-semibold mb-4">Categories</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="admin-label">Genres</label>

                    <input
                      name="genres"
                      value={form.genres}
                      onChange={handleChange}
                      readOnly={!!selectedStaticMovie}
                      className={cn(
                        "admin-input",
                        selectedStaticMovie && "opacity-70",
                      )}
                    />
                  </div>

                  <div>
                    <label className="admin-label">Cast</label>

                    <input
                      name="cast"
                      value={form.cast}
                      onChange={handleChange}
                      readOnly={!!selectedStaticMovie}
                      className={cn(
                        "admin-input",
                        selectedStaticMovie && "opacity-70",
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* ==================================================== */}
              {/* IMAGES */}
              {/* ==================================================== */}

              <div>
                <h3 className="text-lg font-semibold mb-4">Images</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Poster */}

                  <div>
                    <label className="admin-label">Poster URL</label>

                    <input
                      name="poster"
                      value={form.poster}
                      onChange={handleChange}
                      readOnly={!!selectedStaticMovie}
                      className={cn(
                        "admin-input",
                        selectedStaticMovie && "opacity-70",
                      )}
                    />

                    {form.poster && (
                      <img
                        src={form.poster}
                        alt="Poster"
                        className="mt-3 w-32 h-48 object-cover rounded-lg"
                      />
                    )}
                  </div>

                  {/* Backdrop */}

                  <div>
                    <label className="admin-label">Backdrop URL</label>

                    <input
                      name="backdrop"
                      value={form.backdrop}
                      onChange={handleChange}
                      readOnly={!!selectedStaticMovie}
                      className={cn(
                        "admin-input",
                        selectedStaticMovie && "opacity-70",
                      )}
                    />

                    {form.backdrop && (
                      <img
                        src={form.backdrop}
                        alt="Backdrop"
                        className="mt-3 w-full h-48 object-cover rounded-lg"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* ==================================================== */}
              {/* OTHER */}
              {/* ==================================================== */}

              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Additional Details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="admin-label">Match %</label>

                    <input
                      name="match"
                      type="number"
                      min="0"
                      max="100"
                      value={form.match}
                      onChange={handleChange}
                      readOnly={!!selectedStaticMovie}
                      className={cn(
                        "admin-input",
                        selectedStaticMovie && "opacity-70",
                      )}
                    />
                  </div>

                  <div>
                    <label className="admin-label">Director</label>

                    <input
                      name="director"
                      value={form.director}
                      onChange={handleChange}
                      placeholder="Director"
                      className="admin-input"
                    />
                  </div>

                  <div>
                    <label className="admin-label">Trailer URL</label>

                    <input
                      name="trailerUrl"
                      value={form.trailerUrl}
                      onChange={handleChange}
                      placeholder="https://..."
                      className="admin-input"
                    />
                  </div>
                </div>

                {/* Flags */}

                <div className="flex flex-wrap gap-6 mt-5">
                  <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                    <input
                      type="checkbox"
                      name="isNewRelease"
                      checked={form.isNewRelease}
                      onChange={handleCheckboxChange}
                      className="accent-red-600"
                    />
                    New Release
                  </label>

                  <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                    <input
                      type="checkbox"
                      name="isTop10"
                      checked={form.isTop10}
                      onChange={handleCheckboxChange}
                      className="accent-red-600"
                    />
                    Top 10
                  </label>
                </div>
              </div>

              {/* ==================================================== */}
              {/* VIDEO */}
              {/* ==================================================== */}

              <div>
                <h3 className="text-lg font-semibold mb-4">Movie Video</h3>

                <label
                  htmlFor="video"
                  className="flex flex-col items-center justify-center min-h-44 border-2 border-dashed border-white/20 hover:border-red-500/60 rounded-xl cursor-pointer bg-black/20 transition-colors"
                >
                  <Upload className="w-10 h-10 text-white/30 mb-3" />

                  <span className="text-sm text-white/70">
                    {videoFile ? videoFile.name : "Click to select movie video"}
                  </span>

                  <span className="text-xs text-white/30 mt-2">
                    MP4, MPEG, WebM, MOV, MKV
                  </span>

                  <input
                    id="video"
                    type="file"
                    accept="video/mp4,video/mpeg,video/webm,video/quicktime,video/x-matroska"
                    onChange={handleVideoChange}
                    className="hidden"
                  />
                </label>

                {/* Video Preview */}

                {videoPreview && (
                  <div className="relative mt-5">
                    <video
                      src={videoPreview}
                      controls
                      className="w-full max-h-[500px] rounded-xl bg-black"
                    />

                    <button
                      type="button"
                      onClick={clearVideo}
                      className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/80 hover:bg-black flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* ==================================================== */}
              {/* SUBMIT */}
              {/* ==================================================== */}

              <div className="pt-3 border-t border-white/10">
                <button
                  type="submit"
                  disabled={uploading || !selectedStaticMovie || !videoFile}
                  className="w-full md:w-auto px-8 py-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Upload Movie
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* ============================================================ */}
        {/* MOVIE LIBRARY */}
        {/* ============================================================ */}

        <section className="mt-10">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">Movie Library</h2>

              <p className="text-sm text-white/40 mt-1">
                Movies currently stored in MongoDB.
              </p>
            </div>

            <span className="text-sm text-white/40">
              {movies.length} movies
            </span>
          </div>

          {loadingMovies ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
            </div>
          ) : movies.length === 0 ? (
            <div className="py-20 rounded-xl border border-white/10 text-center">
              <Film className="w-12 h-12 mx-auto text-white/20 mb-4" />

              <p className="text-white/40">No movies uploaded yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {movies.map((movie) => (
                <div
                  key={movie._id}
                  className="bg-[#1f1f1f] border border-white/10 rounded-xl overflow-hidden"
                >
                  {/* Poster */}

                  <div className="relative aspect-[2/3] bg-black">
                    {movie.poster ? (
                      <img
                        src={movie.poster}
                        alt={movie.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-12 h-12 text-white/20" />
                      </div>
                    )}

                    {/* Badges */}

                    <div className="absolute top-3 left-3 flex gap-2">
                      {movie.isNewRelease && (
                        <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded">
                          NEW
                        </span>
                      )}

                      {movie.isTop10 && (
                        <span className="bg-white text-black text-[10px] font-bold px-2 py-1 rounded">
                          TOP 10
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Video */}

                  {movie.videoUrl && (
                    <video
                      src={getVideoUrl(movie.videoUrl)}
                      controls
                      preload="metadata"
                      className="w-full bg-black"
                    />
                  )}

                  {/* Details */}

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold truncate">{movie.title}</h3>

                      {movie.rating && (
                        <span className="text-yellow-400 text-xs whitespace-nowrap">
                          ⭐ {movie.rating}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-white/40 mt-2">
                      {movie.year} • {movie.duration}
                    </p>

                    <div className="flex flex-wrap gap-1 mt-3">
                      {movie.genres?.slice(0, 3).map((genre) => (
                        <span
                          key={genre}
                          className="text-[10px] bg-white/10 text-white/50 px-2 py-1 rounded"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(movie._id)}
                      disabled={deletingId === movie._id}
                      className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white text-sm transition-colors disabled:opacity-50"
                    >
                      {deletingId === movie._id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Delete Movie
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ================================================================ */}
      {/* STYLES */}
      {/* ================================================================ */}

      <style jsx>{`
        .admin-input {
          width: 100%;
          background: #111111;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 12px 14px;
          color: white;
          outline: none;
          transition:
            border-color 0.2s ease,
            background 0.2s ease;
        }

        .admin-input:focus {
          border-color: rgba(239, 68, 68, 0.8);
        }

        .admin-input::placeholder {
          color: rgba(255, 255, 255, 0.25);
        }

        .admin-input:read-only {
          cursor: default;
        }

        select.admin-input {
          color-scheme: dark;
        }

        .admin-label {
          display: block;
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 0.5rem;
        }
      `}</style>
    </div>
  );
};

export default UploadPage;
