"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/Authcontext";
import { api } from "@/lib/api";
import type { RecommendationFeedbackType } from "@/lib/types";
import { RecommendationFeedbackCoordinator } from "./recommendation-feedback-coordinator.mjs";

type State = { profileId: string | null; feedback: Record<string, RecommendationFeedbackType>; excluded: string[]; pending: string[]; errors: Record<string, string>; refreshVersion: number };
type Value = State & { selected: (movieId: string) => RecommendationFeedbackType | null; isPending: (movieId: string) => boolean; submit: (movieId: string, type: RecommendationFeedbackType) => Promise<void>; remove: (movieId: string) => Promise<void> };
const empty = (profileId: string | null): State => ({ profileId, feedback: {}, excluded: [], pending: [], errors: {}, refreshVersion: 0 });
const FeedbackContext = createContext<Value | null>(null);

export function RecommendationFeedbackProvider({ children }: { children: React.ReactNode }) {
  const { selectedProfile, user } = useAuth();
  const profileId = user ? selectedProfile?._id || null : null;
  const [state, setState] = useState<State>(() => empty(profileId));
  const coordinatorRef = useRef<RecommendationFeedbackCoordinator | null>(null);
  if (!coordinatorRef.current) {
    coordinatorRef.current = new RecommendationFeedbackCoordinator({
      setFeedback: (movieId: string, targetProfileId: string, type: RecommendationFeedbackType) =>
        api.recommendations.setFeedback(movieId, targetProfileId, type),
      removeFeedback: (movieId: string, targetProfileId: string) =>
        api.recommendations.removeFeedback(movieId, targetProfileId),
    });
  }

  useEffect(() => {
    coordinatorRef.current?.setListener(setState);
    coordinatorRef.current?.setProfile(profileId);
  }, [profileId, user]);

  const current = state.profileId === profileId ? state : empty(profileId);
  const value: Value = {
    ...current,
    selected: (id) => current.feedback[id] || null,
    isPending: (id) => current.pending.includes(id),
    submit: (id, type) => coordinatorRef.current?.submit(id, type, profileId) || Promise.resolve(),
    remove: (id) => coordinatorRef.current?.remove(id, profileId) || Promise.resolve(),
  };
  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>;
}

export const useRecommendationFeedback = () => {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error("useRecommendationFeedback must be used within its provider");
  return value;
};
