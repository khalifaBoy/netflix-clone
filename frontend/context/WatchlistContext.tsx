"use client";

import { useAuth } from "@/context/Authcontext";
import { api, isRequestCancelled } from "@/lib/api";
import { ApiError } from "@/lib/axios";
import type { WatchlistItem } from "@/lib/types";
import { WatchlistReconciliationCoordinator } from "./watchlist-reconciliation.mjs";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type WatchlistState = {
  profileId: string | null;
  items: WatchlistItem[];
  overrides: Record<string, boolean>;
  pendingIds: string[];
  operationErrors: Record<string, string>;
  snapshotComplete: boolean;
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

type WatchlistContextValue = WatchlistState & {
  isInWatchlist: (movieId: string) => boolean;
  isPending: (movieId: string) => boolean;
  toggleMovie: (movieId: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const emptyState = (profileId: string | null): WatchlistState => ({
  profileId,
  items: [],
  overrides: {},
  pendingIds: [],
  operationErrors: {},
  snapshotComplete: false,
  loading: Boolean(profileId),
  loaded: false,
  error: null,
});

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export const WatchlistProvider = ({ children }: { children: React.ReactNode }) => {
  const { selectedProfile } = useAuth();
  const profileId = selectedProfile?._id || null;
  const [state, setState] = useState<WatchlistState>(() => emptyState(profileId));
  const stateRef = useRef(state);
  const activeProfileRef = useRef(profileId);
  const coordinatorRef = useRef(new WatchlistReconciliationCoordinator());
  const pendingOperationsRef = useRef(new Set<string>());

  stateRef.current = state;
  activeProfileRef.current = profileId;

  const loadWatchlist = useCallback(async (requestedProfileId: string, showLoading: boolean) => {
    const coordinator = coordinatorRef.current;
    if (coordinator.hasMutations(requestedProfileId)) {
      coordinator.requireReconciliation(requestedProfileId);
      return;
    }
    const generation = coordinator.beginRequest(requestedProfileId);
    if (showLoading) {
      setState((previous) => previous.profileId === requestedProfileId
        ? { ...previous, loading: true, error: null }
        : emptyState(requestedProfileId));
    }
    try {
      const response = await api.watchlist.list(requestedProfileId);
      if (activeProfileRef.current !== requestedProfileId || !coordinator.markSnapshotComplete(requestedProfileId, generation)) return;
      setState((previous) => ({
        ...previous,
        profileId: requestedProfileId,
        items: response.data.watchlist,
        overrides: {},
        snapshotComplete: true,
        loading: false,
        loaded: true,
        error: null,
      }));
    } catch (error) {
      if (activeProfileRef.current !== requestedProfileId || !coordinator.canApplyRequest(requestedProfileId, generation) || isRequestCancelled(error)) return;
      setState((previous) => ({
        ...previous,
        profileId: requestedProfileId,
        snapshotComplete: coordinator.hasCompleteSnapshot(requestedProfileId),
        loading: false,
        loaded: true,
        error: "My List could not be loaded. Please try again.",
      }));
    }
  }, []);

  useEffect(() => {
    coordinatorRef.current.resetProfile(profileId);
    setState(emptyState(profileId));
    if (profileId) void loadWatchlist(profileId, false);
    return () => {
      if (profileId) coordinatorRef.current.invalidate(profileId);
    };
  }, [profileId, loadWatchlist]);

  const refresh = useCallback(async () => {
    const currentProfileId = activeProfileRef.current;
    if (!currentProfileId) return;
    await loadWatchlist(currentProfileId, true);
  }, [loadWatchlist]);

  const isInWatchlist = useCallback((movieId: string) => {
    const current = stateRef.current;
    if (!activeProfileRef.current || current.profileId !== activeProfileRef.current) return false;
    if (Object.hasOwn(current.overrides, movieId)) return current.overrides[movieId];
    return current.items.some((item) => getMovieId(item) === movieId);
  }, []);

  const isPending = useCallback((movieId: string) =>
    stateRef.current.profileId === activeProfileRef.current && stateRef.current.pendingIds.includes(movieId), []);

  const toggleMovie = useCallback(async (movieId: string) => {
    const currentProfileId = activeProfileRef.current;
    if (!currentProfileId || !movieId) return;
    const operationKey = `${currentProfileId}:${movieId}`;
    if (pendingOperationsRef.current.has(operationKey)) return;

    const existingState = stateRef.current;
    if (existingState.profileId !== currentProfileId) return;
    const currentlySaved = Object.hasOwn(existingState.overrides, movieId)
      ? existingState.overrides[movieId]
      : existingState.items.some((item) => getMovieId(item) === movieId);
    const nextSaved = !currentlySaved;
    pendingOperationsRef.current.add(operationKey);
    coordinatorRef.current.beginMutation(currentProfileId);
    setState((previous) => previous.profileId === currentProfileId ? {
      ...previous,
      overrides: { ...previous.overrides, [movieId]: nextSaved },
      pendingIds: previous.pendingIds.includes(movieId) ? previous.pendingIds : [...previous.pendingIds, movieId],
      operationErrors: { ...previous.operationErrors, [movieId]: "" },
      loading: previous.snapshotComplete ? false : previous.loading,
    } : previous);

    try {
      if (nextSaved) {
        const response = await api.watchlist.add(movieId, currentProfileId);
        if (activeProfileRef.current !== currentProfileId) return;
        setState((previous) => previous.profileId === currentProfileId ? {
          ...previous,
          items: [...previous.items.filter((item) => getMovieId(item) !== movieId), response.data.watchlistItem],
          overrides: omitKey(previous.overrides, movieId),
        } : previous);
      } else {
        await api.watchlist.remove(movieId, currentProfileId);
        if (activeProfileRef.current !== currentProfileId) return;
        setState((previous) => previous.profileId === currentProfileId ? {
          ...previous,
          items: previous.items.filter((item) => getMovieId(item) !== movieId),
          overrides: omitKey(previous.overrides, movieId),
        } : previous);
      }
    } catch (error) {
      if (activeProfileRef.current !== currentProfileId) return;
      if (nextSaved && error instanceof ApiError && error.status === 409) {
        coordinatorRef.current.requireReconciliation(currentProfileId);
        setState((previous) => previous.profileId === currentProfileId ? {
          ...previous,
          overrides: { ...previous.overrides, [movieId]: true },
        } : previous);
      } else if (!isRequestCancelled(error)) {
        setState((previous) => previous.profileId === currentProfileId ? {
          ...previous,
          overrides: omitKey(previous.overrides, movieId),
          operationErrors: {
            ...previous.operationErrors,
            [movieId]: "Could not update My List. Please try again.",
          },
        } : previous);
      }
    } finally {
      pendingOperationsRef.current.delete(operationKey);
      const reconcileAfterMutations = coordinatorRef.current.endMutation(currentProfileId);
      if (activeProfileRef.current === currentProfileId) {
        setState((previous) => previous.profileId === currentProfileId ? {
          ...previous,
          pendingIds: previous.pendingIds.filter((id) => id !== movieId),
        } : previous);
      }
      if (reconcileAfterMutations && activeProfileRef.current === currentProfileId) {
        await loadWatchlist(currentProfileId, false);
      }
    }
  }, [loadWatchlist]);

  const visibleState = state.profileId === profileId ? state : emptyState(profileId);
  const value: WatchlistContextValue = {
    ...visibleState,
    isInWatchlist,
    isPending,
    toggleMovie,
    refresh,
  };

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
};

export const useWatchlist = () => {
  const context = useContext(WatchlistContext);
  if (!context) throw new Error("useWatchlist must be used within a WatchlistProvider");
  return context;
};

const getMovieId = (item: WatchlistItem) =>
  typeof item.movie === "string" ? item.movie : item.movie?._id;

const omitKey = <T extends Record<string, unknown>>(record: T, key: string): T => {
  const next = { ...record };
  delete next[key];
  return next;
};
