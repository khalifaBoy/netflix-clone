"use client";

import Footer from "@/components/Footer";
import MovieCard from "@/components/MovieCard";
import MovieDetailModal from "@/components/MovieDetailModal";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/context/Authcontext";
import { api, isRequestCancelled } from "@/lib/api";
import type { Movie as DisplayMovie } from "@/lib/movie";
import type { Movie as ApiMovie, WatchHistoryRecord } from "@/lib/types";
import { useRouter } from "next/navigation";
import { getMovieWatchPath } from "@/lib/movie-navigation.mjs";
import { useCallback, useEffect, useRef, useState } from "react";

const PAGE_SIZE = 20;

type HistoryState = {
  profileId: string | null;
  records: WatchHistoryRecord[];
  nextCursor: string | null;
  loading: boolean;
  loaded: boolean;
  loadingMore: boolean;
  error: string | null;
  loadMoreError: string | null;
};

const emptyHistory = (profileId: string | null): HistoryState => ({
  profileId,
  records: [],
  nextCursor: null,
  loading: Boolean(profileId),
  loaded: false,
  loadingMore: false,
  error: null,
  loadMoreError: null,
});

const toDisplayMovie = (movie: ApiMovie): DisplayMovie => ({
  id: movie._id,
  title: movie.title,
  description: movie.description,
  longDescription: movie.longDescription || movie.description,
  backdrop: movie.backdrop || "",
  poster: movie.poster || "",
  year: movie.year,
  rating: movie.rating,
  duration: movie.duration,
  genres: movie.genres || [],
  cast: movie.cast || [],
  match: movie.match || 0,
  isNew: movie.isNewRelease || false,
  isTop10: movie.isTop10 || false,
  videoUrl: movie.videoUrl || "",
});

const movieIdOf = (record: WatchHistoryRecord) =>
  typeof record.movie === "string" ? record.movie : record.movie?._id;

const dedupeRecords = (records: WatchHistoryRecord[]) => {
  const seen = new Set<string>();
  return records.filter((record) => {
    const id = movieIdOf(record) || record._id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const formatLastWatched = (value: string) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Last watched recently";
  return `Last watched ${new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)}`;
};

export default function HistoryPage() {
  const router = useRouter();
  const { selectedProfile } = useAuth();
  const profileId = selectedProfile?._id || null;
  const [state, setState] = useState<HistoryState>(() => emptyHistory(profileId));
  const [retryKey, setRetryKey] = useState(0);
  const [selectedMovie, setSelectedMovie] = useState<DisplayMovie | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const activeProfileRef = useRef(profileId);
  const profileEpochRef = useRef(0);
  const pageRequestRef = useRef<string | null>(null);

  activeProfileRef.current = profileId;

  useEffect(() => {
    setSelectedMovie(null);
    setModalOpen(false);
  }, [profileId]);

  useEffect(() => {
    const epoch = ++profileEpochRef.current;
    let current = true;
    pageRequestRef.current = null;
    setState(emptyHistory(profileId));

    if (!profileId) {
      return () => {
        current = false;
        profileEpochRef.current += 1;
      };
    }

    const loadFirstPage = async () => {
      try {
        const response = await api.watchHistory.history(profileId, PAGE_SIZE);
        if (!current || profileEpochRef.current !== epoch || activeProfileRef.current !== profileId) return;
        setState({
          profileId,
          records: dedupeRecords(response.data.history),
          nextCursor: response.data.nextCursor || null,
          loading: false,
          loaded: true,
          loadingMore: false,
          error: null,
          loadMoreError: null,
        });
      } catch (error) {
        if (!current || profileEpochRef.current !== epoch || isRequestCancelled(error)) return;
        setState({ ...emptyHistory(profileId), loading: false, loaded: true, error: "Watch history could not be loaded. Please try again." });
      }
    };

    void loadFirstPage();
    return () => {
      current = false;
      profileEpochRef.current += 1;
    };
  }, [profileId, retryKey]);

  const loadMore = useCallback(async () => {
    const requestProfileId = profileId;
    const cursor = state.profileId === requestProfileId ? state.nextCursor : null;
    if (!requestProfileId || !cursor || state.loadingMore) return;
    const epoch = profileEpochRef.current;
    const requestKey = `${epoch}:${requestProfileId}:${cursor}`;
    if (pageRequestRef.current) return;
    pageRequestRef.current = requestKey;
    setState((previous) => previous.profileId === requestProfileId
      ? { ...previous, loadingMore: true, loadMoreError: null }
      : previous);

    try {
      const response = await api.watchHistory.history(requestProfileId, PAGE_SIZE, cursor);
      if (activeProfileRef.current !== requestProfileId || profileEpochRef.current !== epoch) return;
      setState((previous) => {
        if (previous.profileId !== requestProfileId) return previous;
        const existingIds = new Set(previous.records.map((record) => movieIdOf(record) || record._id));
        const newRecords = dedupeRecords(response.data.history).filter((record) => {
          const id = movieIdOf(record) || record._id;
          return Boolean(id) && !existingIds.has(id);
        });
        const nextCursor = response.data.nextCursor || null;
        return {
          ...previous,
          records: [...previous.records, ...newRecords],
          nextCursor: nextCursor === cursor ? null : nextCursor,
          loadingMore: false,
          loadMoreError: null,
        };
      });
    } catch (error) {
      if (activeProfileRef.current !== requestProfileId || profileEpochRef.current !== epoch || isRequestCancelled(error)) return;
      setState((previous) => previous.profileId === requestProfileId
        ? { ...previous, loadingMore: false, loadMoreError: "More history could not be loaded. Please try again." }
        : previous);
    } finally {
      if (pageRequestRef.current === requestKey) pageRequestRef.current = null;
    }
  }, [profileId, state.loadingMore, state.nextCursor, state.profileId]);

  const handleSelectMovie = (movie: DisplayMovie) => {
    setSelectedMovie(movie);
    setModalOpen(true);
  };
  const handlePlayMovie = (movie: DisplayMovie) => {
    const watchPath = getMovieWatchPath(movie.id);
    if (watchPath) router.push(watchPath);
  };

  const pageMatchesProfile = Boolean(profileId && state.profileId === profileId);
  const showLoading = Boolean(profileId && (!pageMatchesProfile || state.loading || !state.loaded));
  const records = pageMatchesProfile ? state.records : [];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#141414]">
      <Navbar />
      <main className="min-h-[70vh] px-4 pb-12 pt-24 md:px-12">
        <h1 className="mb-7 text-2xl font-bold text-white md:text-3xl">Watch History</h1>

        {!profileId ? (
          <section className="rounded-md bg-white/5 px-6 py-12 text-center">
            <h2 className="mb-2 text-xl font-semibold text-white">Choose a profile</h2>
            <p className="mb-5 text-white/60">Select a profile to view its watch history.</p>
            <button
              type="button"
              onClick={() => router.push("/profiles")}
              className="rounded bg-white px-5 py-2 font-semibold text-black hover:bg-white/80"
            >
              Select profile
            </button>
          </section>
        ) : showLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="aspect-video animate-pulse rounded-md bg-white/10" />
            ))}
          </div>
        ) : state.error ? (
          <section className="rounded-md bg-white/5 px-6 py-12 text-center" role="alert">
            <h2 className="mb-2 text-xl font-semibold text-white">Watch history is unavailable</h2>
            <p className="mb-5 text-white/60">{state.error}</p>
            <button
              type="button"
              onClick={() => setRetryKey((key) => key + 1)}
              className="rounded bg-white px-5 py-2 font-semibold text-black hover:bg-white/80"
            >
              Retry
            </button>
          </section>
        ) : records.length === 0 ? (
          <section className="rounded-md bg-white/5 px-6 py-12 text-center">
            <h2 className="mb-2 text-xl font-semibold text-white">No watch history yet</h2>
            <p className="mb-5 text-white/60">Movies you watch will appear here.</p>
            <button
              type="button"
              onClick={() => router.push("/browse")}
              className="rounded bg-white px-5 py-2 font-semibold text-black hover:bg-white/80"
            >
              Browse movies
            </button>
          </section>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {records.map((record) => {
                const movie = record.movie;
                if (!movie || typeof movie === "string" || !movie._id) return null;
                const displayMovie = toDisplayMovie(movie);
                const completed = Boolean(record.completedAt);
                const duration = record.durationSeconds;
                const progressSeconds = Number.isFinite(record.progressSeconds)
                  ? Math.max(0, record.progressSeconds)
                  : 0;
                const progressPercent = typeof duration === "number" && Number.isFinite(duration) && duration > 0
                  ? Math.min(100, (progressSeconds / duration) * 100)
                  : null;

                return (
                  <article key={record._id}>
                    <MovieCard movie={displayMovie} onSelect={handleSelectMovie} onPlay={handlePlayMovie} />
                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{completed ? "Completed" : "Partially watched"}</p>
                        <p className="mt-1 text-xs text-white/55">{formatLastWatched(record.lastWatchedAt)}</p>
                        {progressPercent !== null && !completed && (
                          <div className="mt-2 h-1 w-40 max-w-full bg-white/20" aria-label="Playback progress">
                            <div className="h-full bg-red-600" style={{ width: `${progressPercent}%` }} />
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const watchPath = getMovieWatchPath(movie._id);
                          if (watchPath) router.push(watchPath);
                        }}
                        className="shrink-0 rounded bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-white/80"
                      >
                        {completed ? "Watch again" : "Resume"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {state.loadMoreError && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-white/70" role="alert">
                <p>{state.loadMoreError}</p>
                <button type="button" onClick={() => void loadMore()} className="font-semibold text-white underline">
                  Retry
                </button>
              </div>
            )}

            {state.nextCursor && !state.loadMoreError && (
              <div className="mt-10 flex justify-center">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={state.loadingMore}
                  className="rounded border border-white/40 px-6 py-2 font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                >
                  {state.loadingMore ? "Loading…" : "Load More"}
                </button>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
      <MovieDetailModal movie={selectedMovie} open={modalOpen} onOpenChange={setModalOpen} onSelectMovie={handleSelectMovie} />
    </div>
  );
}
