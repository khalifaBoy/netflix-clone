"use client";

import { Movie } from "@/lib/movie";
import { useRouter } from "next/navigation";
import { Dialog, DialogClose, DialogContent } from "./ui/dialog";
import { useWatchlist } from "@/context/WatchlistContext";
import { useRecommendationFeedback } from "@/context/RecommendationFeedbackContext";
import { useAuth } from "@/context/Authcontext";
import { api, isRequestCancelled } from "@/lib/api";
import { normalizeRecommendationMovie } from "@/lib/recommendation-feed.mjs";
import { SimilarMovieFeedCoordinator } from "@/lib/similar-movie-feed.mjs";
import { canPlayVerifiedMovie, canShowStaticCatalog } from "@/lib/profile-maturity.mjs";
import { getMovieWatchPath } from "@/lib/movie-navigation.mjs";
import { Check, LoaderCircle, Play, Plus, RotateCw, Volume2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const isBackendMovieId = (id: string) => /^[a-f\d]{24}$/i.test(id);

type MovieDetailModalProps = {
  movie: Movie | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMovie: (movie: Movie) => void;
};

const MovieDetailModal = ({
  movie,
  open,
  onOpenChange,
  onSelectMovie,
}: MovieDetailModalProps) => {
  const router = useRouter();
  const { selectedProfile } = useAuth();
  const { isInWatchlist, isPending, toggleMovie, operationErrors } = useWatchlist();
  const feedback = useRecommendationFeedback();
  const profileId = selectedProfile?._id || null;
  const currentProfileId = useRef<string | null>(profileId);
  currentProfileId.current = profileId;
  const [playError, setPlayError] = useState(false);
  const [detail, setDetail] = useState<{ profileId: string | null; movieId: string | null; status: "idle" | "loading" | "success" | "unavailable"; movie: Movie | null }>({ profileId: null, movieId: null, status: "idle", movie: null });
  const similarCoordinator = useRef<SimilarMovieFeedCoordinator | null>(null);
  if (!similarCoordinator.current) {
    similarCoordinator.current = new SimilarMovieFeedCoordinator(async (requestProfileId: string, genres: string[]) => {
      const responses = await Promise.allSettled(genres.slice(0, 3).map((genre) =>
        api.movies.list(requestProfileId, { genre, limit: 30 })));
      const successful = responses.flatMap((result) => {
        if (result.status !== "fulfilled") return [];
        const data = result.value.data;
        return data?.success && Array.isArray(data.movies) ? [data.movies] : [];
      });
      if (!successful.length) throw new Error("Similar movie requests failed.");
      return successful.flat();
    });
  }
  const [similarState, setSimilarState] = useState({
    profileId: null as string | null,
    movieId: null as string | null,
    status: "idle" as "idle" | "loading" | "success" | "empty" | "error",
    movies: [] as Movie[],
    error: null as string | null,
  });

  useEffect(() => {
    let current = true;
    setPlayError(false);
    if (!open || !movie || !profileId || !isBackendMovieId(movie.id)) {
      setDetail({ profileId, movieId: movie?.id || null, status: "idle", movie: null });
      return () => { current = false; };
    }
    const requestedMovieId = movie.id;
    setDetail({ profileId, movieId: requestedMovieId, status: "loading", movie: null });
    api.movies.get(requestedMovieId, profileId).then(({ data }) => {
      const confirmed = normalizeRecommendationMovie(data.movie) as Movie;
      if (!current) return;
      setDetail({
        profileId,
        movieId: requestedMovieId,
        status: canPlayVerifiedMovie(data.movie, selectedProfile) ? "success" : "unavailable",
        movie: confirmed,
      });
    }).catch((error) => {
      if (!current || isRequestCancelled(error)) return;
      setDetail({ profileId, movieId: requestedMovieId, status: "unavailable", movie: null });
    });
    return () => { current = false; };
  }, [open, movie?.id, profileId, selectedProfile?.isKids, selectedProfile?.maturityLevel]);

  useEffect(() => {
    similarCoordinator.current?.setListener((next: typeof similarState) => setSimilarState(next));
  }, []);

  useEffect(() => {
    if (!open || !profileId || !selectedProfile || !movie || !isBackendMovieId(movie.id)) {
      similarCoordinator.current?.clear();
      return;
    }
    void similarCoordinator.current?.load(selectedProfile, movie);
  }, [open, profileId, movie?.id, movie?.genres?.join("|"), selectedProfile?.isKids, selectedProfile?.maturityLevel]);

  const detailIsCurrent = Boolean(movie && detail.profileId === profileId && detail.movieId === movie.id);
  const backendMovie = movie && isBackendMovieId(movie.id);
  const displayMovie = !movie || !profileId ? null
    : backendMovie
      ? detailIsCurrent && detail.status === "success" ? detail.movie : null
      : canShowStaticCatalog(selectedProfile) ? movie : null;
  const similarMoviesAreCurrent = Boolean(movie && similarState.profileId === profileId && similarState.movieId === movie.id);
  const similarStatus = similarMoviesAreCurrent ? similarState.status : open && movie && isBackendMovieId(movie.id) ? "loading" : "empty";
  if (!movie || !profileId) return null;
  const inWatchlist = isInWatchlist(movie.id);
  const pending = isPending(movie.id);
  const handlePlay = async () => {
    const requestedMovieId = movie && typeof movie.id === "string" ? movie.id : null;
    const watchPath = getMovieWatchPath(requestedMovieId || "");
    if (!displayMovie || !profileId || !requestedMovieId || !watchPath) {
      if (currentProfileId.current === profileId) setPlayError(true);
      return;
    }
    setPlayError(false);
    if (!backendMovie) {
      try {
        const { data } = await api.movies.get(requestedMovieId, profileId);
        if (currentProfileId.current !== profileId || !canPlayVerifiedMovie(data.movie, selectedProfile)) return;
      } catch {
        if (currentProfileId.current === profileId) setPlayError(true);
        return;
      }
    }
    onOpenChange(false);
    router.push(watchPath);
  };
  if (!displayMovie) {
    return open ? (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!w-[min(90vw,520px)] !p-8 bg-[#181818] border-none text-center text-white">
          <p role={detailIsCurrent && detail.status === "unavailable" ? "alert" : "status"}>
            {detailIsCurrent && detail.status === "unavailable" ? "This title is unavailable for the selected profile." : "Verifying title access…"}
          </p>
        </DialogContent>
      </Dialog>
    ) : null;
  }
  movie = displayMovie;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
       className="
        !w-[95vw]
        !max-w-[1100px]
        sm:!max-w-[1100px]
        lg:!max-w-[1100px]

        !p-0
        !overflow-y-auto
        !overflow-x-hidden

        bg-[#181818]
        border-none
        rounded-lg

        !max-h-[90vh]

        scrollbar-hide
        [&>button:last-child]:hidden
    "
      >
        <div className="relative w-full">
          <div className="relative h-[300px] md:h-[500px] w-full">
            <img
              src={movie.backdrop}
              alt={movie.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/40 to-transparent" />

            <DialogClose className="absolute top-4 right-4 w-9 h-9 bg-black/70 rounded-full flex items-center justify-center text-white hover:bg-black transition-colors z-10">
              <X className="w-5 h-5" />
            </DialogClose>

            <div className="absolute bottom-8 left-8 right-8 md:left-12 md:right-12">
              <h2 className="text-2xl md:text-4xl font-black text-white mb-4 text-shadow-lg">
                {movie.title}
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePlay}
                  className="flex items-center gap-2 bg-white text-black px-6 py-2 rounded-md font-bold hover:bg-white/80 transition-colors"
                >
                  <Play className="w-5 h-5 fill-black" />
                  Play
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void toggleMovie(movie.id)}
                  className="w-10 h-10 border-2 border-white/60 rounded-full flex items-center justify-center text-white hover:border-white hover:bg-white/10 transition-colors disabled:opacity-50"
                  aria-label={inWatchlist ? "Remove from My List" : "Add to My List"}
                  aria-pressed={inWatchlist}
                  title={operationErrors[movie.id] || (inWatchlist ? "Remove from My List" : "Add to My List")}
                >
                  {pending ? <LoaderCircle className="w-5 h-5 animate-spin" /> : inWatchlist ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </button>
                {([
                  ["MORE_LIKE_THIS", "More Like This"],
                  ["NOT_INTERESTED", "Not Interested"],
                  ["ALREADY_WATCHED", "Already Watched"],
                ] as const).map(([type, label]) => (
                  <button key={type} type="button" disabled={feedback.isPending(movie.id)} onClick={() => void feedback.submit(movie.id, type)} className={`h-10 rounded-full border-2 px-3 text-xs font-semibold text-white transition-colors disabled:opacity-50 ${feedback.selected(movie.id) === type ? "border-red-500 bg-red-900/60" : "border-white/60 hover:border-white hover:bg-white/10"}`} aria-label={label} aria-pressed={feedback.selected(movie.id) === type} title={feedback.errors[movie.id] || label}>
                    {label}
                  </button>
                ))}
                {feedback.selected(movie.id) && <button type="button" disabled={feedback.isPending(movie.id)} onClick={() => void feedback.remove(movie.id)} className="h-10 rounded-full border-2 border-white/30 px-3 text-xs text-white/80 hover:border-white disabled:opacity-50">Remove feedback</button>}
                <button
                  className="w-10 h-10 border-2 border-white/60 rounded-full flex items-center justify-center text-white hover:border-white hover:bg-white/10 transition-colors ml-auto"
                  aria-label="Mute"
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>
              {playError && <p role="alert" className="mt-3 text-sm text-red-300">This title could not be verified for the selected profile.</p>}
            </div>
          </div>

          <div className="px-8 md:px-12 py-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                {movie.match !== undefined && <span className="text-green-500 font-bold">{movie.match}% Match</span>}
                <span className="text-white/70 text-sm">{movie.year}</span>
                <span className="border border-white/40 text-white/70 px-1.5 text-xs">
                  {movie.rating}
                </span>
                <span className="text-white/70 text-sm">{movie.duration}</span>
                <span className="border border-white/40 text-white/70 px-2 text-xs uppercase tracking-wider">
                  HD
                </span>
                {movie.isNew && (
                  <span className="text-red-500 font-bold text-xs uppercase tracking-wider">
                    New
                  </span>
                )}
              </div>
              <p className="text-white/90 text-sm md:text-base leading-relaxed">
                {movie.longDescription}
              </p>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <span className="text-white/50">Cast: </span>
                <span className="text-white/90">{movie.cast.join(", ")}</span>
              </div>
              <div>
                <span className="text-white/50">Genres: </span>
                <span className="text-white/90">{movie.genres.join(", ")}</span>
              </div>
              <div>
                <span className="text-white/50">This is: </span>
                <span className="text-white/90">
                  Suspenseful, Gritty, Intense
                </span>
              </div>
            </div>
          </div>

          <div className="px-8 md:px-12 pb-8">
            {operationErrors[movie.id] && (
              <p role="alert" className="mb-4 text-sm text-red-300">{operationErrors[movie.id]}</p>
            )}
            {feedback.isPending(movie.id) && <p role="status" className="mb-2 text-sm text-white/60">Saving feedback…</p>}
            {feedback.errors[movie.id] && <p role="alert" className="mb-4 text-sm text-red-300">{feedback.errors[movie.id]}</p>}
            <h3 className="text-white text-xl font-bold mb-4">
              More Like This
            </h3>
            {similarStatus === "loading" ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3" aria-label="Loading similar movies" aria-busy="true">
                {Array.from({ length: 6 }, (_, index) => <div key={index} className="aspect-video animate-pulse rounded-md bg-white/10" />)}
              </div>
            ) : similarStatus === "error" ? (
              <div className="flex items-center gap-3 text-sm text-white/65" role="alert">
                <span>{similarState.error || "Similar movies could not be loaded."}</span>
                <button type="button" onClick={() => { void similarCoordinator.current?.retry(); }} className="inline-flex items-center gap-1 text-white hover:text-white/70">
                  <RotateCw className="h-4 w-4" /> Retry
                </button>
              </div>
            ) : similarStatus === "empty" ? (
              <p className="rounded-md bg-white/5 px-4 py-5 text-sm text-white/55">
                No similar movies are available for this title yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {similarState.movies.map((similarMovie) => (
                  <button
                    key={similarMovie.id}
                    type="button"
                    onClick={() => onSelectMovie(similarMovie)}
                    className="overflow-hidden rounded-md bg-[#2a2a2a] text-left transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                    aria-label={`View ${similarMovie.title}`}
                  >
                    <div className="aspect-video overflow-hidden bg-black/30">
                      <img src={similarMovie.backdrop || similarMovie.poster || ""} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-medium text-white">{similarMovie.title}</p>
                      <p className="mt-1 truncate text-xs text-white/50">{similarMovie.genres.join(" · ")}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MovieDetailModal;
