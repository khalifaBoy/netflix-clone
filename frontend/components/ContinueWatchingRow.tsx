"use client";

import { useAuth } from "@/context/Authcontext";
import { api, isRequestCancelled } from "@/lib/api";
import type { WatchHistoryRecord } from "@/lib/types";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type ContinueState = {
  profileId: string | null;
  history: WatchHistoryRecord[];
  loading: boolean;
  error: boolean;
};

const ContinueWatchingRow = () => {
  const router = useRouter();
  const { selectedProfile } = useAuth();
  const profileId = selectedProfile?._id || null;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [state, setState] = useState<ContinueState>({
    profileId: null,
    history: [],
    loading: false,
    error: false,
  });

  useEffect(() => {
    let current = true;
    if (!profileId) {
      setState({ profileId: null, history: [], loading: false, error: false });
      return () => {
        current = false;
      };
    }

    setState({ profileId, history: [], loading: true, error: false });
    Promise.resolve()
      .then(() => api.watchHistory.continueWatching(profileId, 10))
      .then((response) => {
        if (!current) return;
        setState({
          profileId,
          history: response.data.history.slice(0, 10),
          loading: false,
          error: false,
        });
      })
      .catch((error: unknown) => {
        if (!current) return;
        if (isRequestCancelled(error)) {
          setState({ profileId, history: [], loading: false, error: false });
          return;
        }
        setState({ profileId, history: [], loading: false, error: true });
      });

    return () => {
      current = false;
    };
  }, [profileId, retryKey]);

  const scroll = (direction: "left" | "right") => {
    const row = scrollRef.current;
    if (!row) return;
    row.scrollBy({
      left: (direction === "left" ? -1 : 1) * row.clientWidth * 0.85,
      behavior: "smooth",
    });
  };

  if (!profileId) return null;
  if (state.profileId !== profileId || state.loading) {
    return (
      <section aria-label="Continue Watching" className="mb-8 md:mb-12">
        <h2 className="text-white text-lg md:text-xl lg:text-2xl font-bold mb-3 px-4 md:px-12">
          Continue Watching
        </h2>
        <div className="flex gap-3 overflow-hidden px-4 md:px-12" aria-busy="true">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-32 w-52 shrink-0 animate-pulse rounded bg-white/10 md:w-64" />
          ))}
        </div>
      </section>
    );
  }

  if (state.error) {
    return (
      <section className="mb-8 px-4 md:px-12" role="alert">
        <div className="flex items-center gap-3 text-white/70">
          <p>Continue Watching could not be loaded.</p>
          <button
            type="button"
            onClick={() => setRetryKey((key) => key + 1)}
            className="inline-flex items-center gap-1 text-white hover:text-white/70"
          >
            <RotateCw className="h-4 w-4" /> Retry
          </button>
        </div>
      </section>
    );
  }

  if (state.history.length === 0) return null;

  return (
    <section className="group/continue relative mb-8 md:mb-12" aria-label="Continue Watching">
      <h2 className="text-white text-lg md:text-xl lg:text-2xl font-bold mb-3 px-4 md:px-12">
        Continue Watching
      </h2>
      <div className="relative">
        <button
          type="button"
          onClick={() => scroll("left")}
          aria-label="Scroll Continue Watching left"
          className="absolute left-0 top-0 bottom-0 z-10 flex w-10 items-center justify-center bg-black/60 text-white opacity-0 transition-opacity group-hover/continue:opacity-100"
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto px-4 md:px-12 scrollbar-hide scroll-smooth"
        >
          {state.history.map((record) => {
            const movie = record.movie;
            if (!movie?._id) return null;
            const duration = record.durationSeconds;
            const progress = Number.isFinite(record.progressSeconds)
              ? Math.max(0, record.progressSeconds)
              : 0;
            const progressPercent = typeof duration === "number" && Number.isFinite(duration) && duration > 0
              ? Math.min(100, (progress / duration) * 100)
              : null;

            return (
              <button
                key={record._id}
                type="button"
                onClick={() => router.push(`/watch/${movie._id}`)}
                className="group/card relative w-52 shrink-0 overflow-hidden rounded-md bg-[#1a1a1a] text-left transition-transform hover:z-10 hover:scale-105 md:w-64"
                aria-label={`Continue watching ${movie.title}`}
              >
                <div className="aspect-video overflow-hidden">
                  <img
                    src={movie.backdrop || movie.poster || ""}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-semibold text-white">{movie.title}</p>
                  <p className="mt-1 text-xs text-white/55">{movie.duration}</p>
                </div>
                {progressPercent !== null && (
                  <div
                    className="h-1 w-full bg-white/25"
                    role="progressbar"
                    aria-label={`${movie.title} playback progress`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progressPercent)}
                  >
                    <div className="h-full bg-red-600" style={{ width: `${progressPercent}%` }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => scroll("right")}
          aria-label="Scroll Continue Watching right"
          className="absolute right-0 top-0 bottom-0 z-10 flex w-10 items-center justify-center bg-black/60 text-white opacity-0 transition-opacity group-hover/continue:opacity-100"
        >
          <ChevronRight className="h-7 w-7" />
        </button>
      </div>
    </section>
  );
};

export default ContinueWatchingRow;
