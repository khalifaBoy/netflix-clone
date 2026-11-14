"use client";

import VideoPlayer from "@/components/VideoPlayer";
import { useAuth } from "@/context/Authcontext";
import { api, getMediaUrl, isRequestCancelled } from "@/lib/api";
import { ApiError } from "@/lib/axios";
import { canPlayVerifiedMovie } from "@/lib/profile-maturity.mjs";
import { getResumeProgressSeconds } from "@/lib/watch-progress.mjs";
import {
  getPlaybackSessionErrorMessage,
  PlaybackSessionCoordinator,
  registerPlaybackSessionForLogout,
} from "@/lib/playback-session-coordinator.mjs";
import type { Movie, PlaybackSession } from "@/lib/types";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type ResumeState = {
  profileId: string | null;
  progressSeconds: number;
  loading: boolean;
  error: boolean;
};

type PlaybackAttempt = {
  attemptId: number;
  profileId: string;
  movieId: string;
  progressSeconds: number;
};

type PlaybackSessionState = {
  attemptId: number | null;
  profileId: string | null;
  movieId: string | null;
  status: "idle" | "loading" | "ready" | "error";
  session: PlaybackSession | null;
  errorMessage: string;
};

type MovieLoadState = {
  movieId: string | null;
  profileId: string | null;
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
    profileId: null,
    status: "loading",
  });
  const [movieRetryKey, setMovieRetryKey] = useState(0);
  const [resumeState, setResumeState] = useState<ResumeState>({
    profileId: null,
    progressSeconds: 0,
    loading: true,
    error: false,
  });
  const [playbackAttempt, setPlaybackAttempt] = useState<PlaybackAttempt | null>(null);
  const [playbackSessionState, setPlaybackSessionState] = useState<PlaybackSessionState>({
    attemptId: null,
    profileId: null,
    movieId: null,
    status: "idle",
    session: null,
    errorMessage: "",
  });
  const playbackAttemptSequence = useRef(0);
  const autoStartKeyRef = useRef<string | null>(null);
  const autoStartProfileRef = useRef(profileId);
  const latestProfileIdRef = useRef(profileId);
  latestProfileIdRef.current = profileId;
  const playbackCoordinatorRef = useRef<PlaybackSessionCoordinator | null>(null);
  if (!playbackCoordinatorRef.current) {
    playbackCoordinatorRef.current = new PlaybackSessionCoordinator({
      createSession: async (requestProfileId: string, movieId: string) =>
        (await api.playback.createSession(requestProfileId, movieId)).data,
      revokeSession: (sessionId: string, token?: string) => api.playback.revokeSession(sessionId, token),
    });
  }
  const playbackCoordinator = playbackCoordinatorRef.current;

  const startPlayback = useCallback((progressSeconds: number) => {
    if (!profileId || !movie || movieLoadState.status !== "success"
      || movieLoadState.profileId !== profileId || movieLoadState.movieId !== id) return;
    const attemptId = ++playbackAttemptSequence.current;
    setPlaybackAttempt({ attemptId, profileId, movieId: id, progressSeconds });
    setPlaybackSessionState({
      attemptId,
      profileId,
      movieId: id,
      status: "loading",
      session: null,
      errorMessage: "",
    });
  }, [id, movie, movieLoadState.status, profileId]);

  useEffect(() => {
    let current = true;

    const loadMovie = async () => {
      setMovieLoadState({ movieId: id || null, profileId, status: "loading" });
      setMovie(null);
      setPlaybackAttempt(null);
      setPlaybackSessionState({
        attemptId: null,
        profileId,
        movieId: id || null,
        status: "idle",
        session: null,
        errorMessage: "",
      });
      if (!id || !profileId || !selectedProfile) return;
      try {
        const response = await api.movies.get(id, profileId);
        if (current) {
          const loadedMovie = response.data.movie || null;
          const allowed = loadedMovie && canPlayVerifiedMovie(loadedMovie, selectedProfile);
          setMovie(allowed ? loadedMovie : null);
          setMovieLoadState({ movieId: id, profileId, status: allowed ? "success" : "not-found" });
        }
      } catch (error) {
        if (!current || isRequestCancelled(error)) return;
        setMovie(null);
        setMovieLoadState({
          movieId: id,
          profileId,
          status: error instanceof ApiError && [403, 404].includes(error.status) ? "not-found" : "error",
        });
      }
    };

    loadMovie();
    return () => {
      current = false;
    };
  }, [id, profileId, selectedProfile?.isKids, selectedProfile?.maturityLevel, movieRetryKey]);

  useEffect(() => {
    let current = true;

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
        const progressSeconds = getResumeProgressSeconds(response.data.history, id);

        setResumeState({
          profileId,
          progressSeconds,
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

  useEffect(() => {
    if (autoStartProfileRef.current !== profileId) {
      autoStartProfileRef.current = profileId;
      autoStartKeyRef.current = null;
    }
  }, [profileId]);

  useEffect(() => {
    if (!profileId || !movie || movieLoadState.status !== "success"
      || movieLoadState.profileId !== profileId || movieLoadState.movieId !== id
      || resumeState.loading || resumeState.profileId !== profileId
      || resumeState.progressSeconds > 0) return;

    const key = `${profileId}:${id}`;
    if (autoStartKeyRef.current === key) return;
    autoStartKeyRef.current = key;
    startPlayback(0);
  }, [id, movie, movieLoadState.status, profileId, resumeState, startPlayback]);

  useEffect(() => {
    const attempt = playbackAttempt;
    if (!attempt || attempt.profileId !== profileId || attempt.movieId !== id
      || !movie || movieLoadState.status !== "success"
      || movieLoadState.profileId !== profileId || movieLoadState.movieId !== id) return;

    let current = true;
    const request = playbackCoordinator.create(attempt.attemptId, profileId, id);
    request.then((session: PlaybackSession) => {
      if (!current || latestProfileIdRef.current !== profileId) {
        void playbackCoordinator.revoke(session.sessionId).catch(() => {});
        return;
      }
      setPlaybackSessionState({
        attemptId: attempt.attemptId,
        profileId,
        movieId: id,
        status: "ready",
        session,
        errorMessage: "",
      });
    }).catch((error: unknown) => {
      if (!current || latestProfileIdRef.current !== profileId || isRequestCancelled(error)) return;
      setPlaybackSessionState({
        attemptId: attempt.attemptId,
        profileId,
        movieId: id,
        status: "error",
        session: null,
        errorMessage: getPlaybackSessionErrorMessage(error),
      });
    });

    return () => {
      current = false;
    };
  }, [id, movie, movieLoadState.status, playbackAttempt, playbackCoordinator, profileId]);

  const sessionMatchesAttempt = Boolean(playbackAttempt
    && playbackSessionState.attemptId === playbackAttempt.attemptId
    && playbackSessionState.profileId === profileId
    && playbackSessionState.movieId === id);
  const activePlaybackSession = sessionMatchesAttempt && playbackSessionState.status === "ready"
    ? playbackSessionState.session
    : null;

  useEffect(() => {
    if (!activePlaybackSession) return;
    const sessionId = activePlaybackSession.sessionId;
    playbackCoordinator.retain(sessionId);
    return () => playbackCoordinator.scheduleRevocation(sessionId);
  }, [activePlaybackSession?.sessionId, playbackCoordinator]);

  useEffect(() => {
    if (!activePlaybackSession) return;
    const sessionId = activePlaybackSession.sessionId;
    return registerPlaybackSessionForLogout(sessionId, (token?: string) =>
      playbackCoordinator.revoke(sessionId, token));
  }, [activePlaybackSession?.sessionId, playbackCoordinator]);

  const saveProgress = useCallback((progressSeconds: number) => {
    if (!profileId) return Promise.resolve();
    return api.watchHistory.updateProgress(id, profileId, progressSeconds).then((response) => {
      window.dispatchEvent(new Event("watch-history:progress-saved"));
      return response;
    });
  }, [id, profileId]);

  if (!profileId) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl mb-4">Select a profile to play this movie.</p>
          <button onClick={() => router.push("/profiles")} className="text-red-500 hover:text-red-400 transition-colors font-medium">Choose Profile</button>
        </div>
      </div>
    );
  }

  if (movieLoadState.movieId !== id || movieLoadState.profileId !== profileId || movieLoadState.status === "loading" || resumeState.loading) {
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

  if (resumeState.profileId !== profileId) {
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
  const attemptForCurrentProfile = playbackAttempt && playbackAttempt.profileId === profileId
    && playbackAttempt.movieId === id
    ? playbackAttempt
    : null;

  if (resumeAvailable && !attemptForCurrentProfile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center max-w-lg">
          <h1 className="text-white text-2xl md:text-3xl font-bold mb-3">Continue watching?</h1>
          <p className="text-white/60 mb-7">
            Resume {movie.title} from {formatTime(resumeState.progressSeconds)} or start from the beginning.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => startPlayback(resumeState.progressSeconds)}
              className="rounded bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700"
            >
              Resume
            </button>
            <button
              onClick={() => startPlayback(0)}
              className="rounded border border-white/40 px-6 py-3 font-semibold text-white hover:bg-white/10"
            >
              Start from beginning
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!attemptForCurrentProfile || !sessionMatchesAttempt || playbackSessionState.status === "loading") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60">Preparing secure playback...</p>
        </div>
      </div>
    );
  }

  if (playbackSessionState.status === "error") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center max-w-lg">
          <h1 className="text-white text-xl md:text-2xl font-bold mb-3">Unable to start playback</h1>
          <p className="text-white/60 mb-6">{playbackSessionState.errorMessage}</p>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() => startPlayback(attemptForCurrentProfile.progressSeconds)}
              className="rounded bg-red-600 px-5 py-2 font-semibold text-white hover:bg-red-700"
            >
              Try again
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

  if (!activePlaybackSession) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/60">Playback session unavailable. Please try again.</p>
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
        key={`${id}:${profileId}:${attemptForCurrentProfile.attemptId}`}
        src={getMediaUrl(activePlaybackSession.mediaUrl)}
        poster={movie.backdrop || movie.poster || ""}
        title={movie.title}
        initialProgressSeconds={attemptForCurrentProfile.progressSeconds}
        onProgressUpdate={saveProgress}
        onRetryPlayback={(progressSeconds) => startPlayback(progressSeconds)}
        onExit={() => {
          void playbackCoordinator.revoke(activePlaybackSession.sessionId).catch(() => {});
          router.push("/browse");
        }}
      />
    </>
  );
};

export default WatchPage;
