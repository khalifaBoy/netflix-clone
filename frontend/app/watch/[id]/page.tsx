"use client";

import VideoPlayer from "@/components/VideoPlayer";
import { useAuth } from "@/context/Authcontext";
import { api, isRequestCancelled } from "@/lib/api";
import { ApiError, getMediaUrl } from "@/lib/axios";
import type { Movie } from "@/lib/types";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type ResumeState = {
  profileId: string | null;
  progressSeconds: number;
  loading: boolean;
  error: boolean;
};

type PlaybackStart = {
  profileId: string;
  progressSeconds: number;
};

type MovieLoadState = {
  movieId: string | null;
  status: "loading" | "success" | "not-found" | "error";
};

const formatTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const WatchPage = () => {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { selectedProfile } = useAuth();
  const profileId = selectedProfile?._id || null;
  const [movie, setMovie] = useState<Movie | null>(null);
  const [movieLoadState, setMovieLoadState] = useState<MovieLoadState>({
    movieId: null,
    status: "loading",
  });
  const [movieRetryKey, setMovieRetryKey] = useState(0);
  const [resumeState, setResumeState] = useState<ResumeState>({
    profileId: null,
    progressSeconds: 0,
    loading: true,
    error: false,
  });
  const [playbackStart, setPlaybackStart] = useState<PlaybackStart | null>(null);

  useEffect(() => {
    if (!id) return;
    let current = true;

    const loadMovie = async () => {
      setMovieLoadState({ movieId: id, status: "loading" });
      setMovie(null);
      try {
        const response = await api.movies.get(id);
        if (current) {
          const loadedMovie = response.data.movie || null;
          setMovie(loadedMovie);
          setMovieLoadState({ movieId: id, status: loadedMovie ? "success" : "not-found" });
        }
      } catch (error) {
        if (!current || isRequestCancelled(error)) return;
        setMovie(null);
        setMovieLoadState({
          movieId: id,
          status: error instanceof ApiError && error.status === 404 ? "not-found" : "error",
        });
      }
    };

    loadMovie();
    return () => {
      current = false;
    };
  }, [id, movieRetryKey]);

  useEffect(() => {
    let current = true;
    setPlaybackStart(null);

    if (!id || !profileId) {
      setResumeState({ profileId: null, progressSeconds: 0, loading: false, error: false });
      return () => {
        current = false;
      };
    }

    setResumeState({ profileId: null, progressSeconds: 0, loading: true, error: false });
    const loadResumePosition = async () => {
      try {
        // Continue Watching is the available profile-scoped endpoint for saved,
        // incomplete playback. Its limit is bounded by the backend at 50.
        const response = await api.watchHistory.continueWatching(profileId, 50);
        if (!current) return;
        const record = response.data.history.find((entry) => {
          const movieId = typeof entry.movie === "string" ? entry.movie : entry.movie?._id;
          return movieId === id;
        });
        const progressSeconds = record?.progressSeconds;
        const durationSeconds = record?.durationSeconds;
        const validProgress = typeof progressSeconds === "number"
          && Number.isFinite(progressSeconds)
          && progressSeconds > 0
          && (typeof durationSeconds !== "number"
            || !Number.isFinite(durationSeconds)
            || durationSeconds <= 0
            || progressSeconds < durationSeconds);

        setResumeState({
          profileId,
          progressSeconds: validProgress ? progressSeconds : 0,
          loading: false,
          error: false,
        });
      } catch (error) {
        if (!current || isRequestCancelled(error)) return;
        setResumeState({ profileId, progressSeconds: 0, loading: false, error: true });
      }
    };

    loadResumePosition();
    return () => {
      current = false;
    };
  }, [id, profileId]);

  const saveProgress = useCallback((progressSeconds: number) => {
    if (!profileId) return Promise.resolve();
    return api.watchHistory.updateProgress(id, profileId, progressSeconds);
  }, [id, profileId]);

  if (movieLoadState.movieId !== id || movieLoadState.status === "loading" || resumeState.loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60">Loading movie...</p>
        </div>
      </div>
    );
  }

  if (movieLoadState.status === "not-found" || !movie) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl mb-4">Movie not found</p>
          <button
            onClick={() => router.push("/browse")}
            className="text-red-500 hover:text-red-400 transition-colors font-medium"
          >
            Back to Browse
          </button>
        </div>
      </div>
    );
  }

  if (movieLoadState.status === "error") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-white text-xl mb-2">Movie could not be loaded.</p>
          <p className="text-white/60 mb-6">Check your connection and try again.</p>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() => setMovieRetryKey((key) => key + 1)}
              className="rounded bg-red-600 px-5 py-2 font-semibold text-white hover:bg-red-700"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => router.push("/browse")}
              className="text-white/70 hover:text-white"
            >
              Back to Browse
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!profileId || resumeState.profileId !== profileId) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl mb-4">Select a profile to play this movie.</p>
          <button
            onClick={() => router.push("/profiles")}
            className="text-red-500 hover:text-red-400 transition-colors font-medium"
          >
            Choose Profile
          </button>
        </div>
      </div>
    );
  }

  const resumeAvailable = resumeState.progressSeconds > 0;
  const startForCurrentProfile = playbackStart?.profileId === profileId ? playbackStart : null;

  if (resumeAvailable && !startForCurrentProfile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center max-w-lg">
          <h1 className="text-white text-2xl md:text-3xl font-bold mb-3">Continue watching?</h1>
          <p className="text-white/60 mb-7">
            Resume {movie.title} from {formatTime(resumeState.progressSeconds)} or start from the beginning.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setPlaybackStart({ profileId, progressSeconds: resumeState.progressSeconds })}
              className="rounded bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700"
            >
              Resume
            </button>
            <button
              onClick={() => setPlaybackStart({ profileId, progressSeconds: 0 })}
              className="rounded border border-white/40 px-6 py-3 font-semibold text-white hover:bg-white/10"
            >
              Start from beginning
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {resumeState.error && (
        <div className="absolute top-4 left-1/2 z-50 -translate-x-1/2 rounded bg-black/80 px-4 py-2 text-sm text-white/80">
          Resume position unavailable. Starting from the beginning.
        </div>
      )}
      <VideoPlayer
        key={`${id}:${profileId}`}
        src={getMediaUrl(movie.videoUrl)}
        poster={movie.backdrop || movie.poster || ""}
        title={movie.title}
        initialProgressSeconds={startForCurrentProfile?.progressSeconds ?? 0}
        onProgressUpdate={saveProgress}
        onExit={() => router.push("/browse")}
      />
    </>
  );
};

export default WatchPage;
