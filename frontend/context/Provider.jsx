"use client";
import { AuthProvider } from "./Authcontext";
import { WatchlistProvider } from "./WatchlistContext";
import { RecommendationFeedbackProvider } from "./RecommendationFeedbackContext";

export default function Providers({ children }) {
  return (
    <AuthProvider>
      <WatchlistProvider>
        <RecommendationFeedbackProvider>{children}</RecommendationFeedbackProvider>
      </WatchlistProvider>
    </AuthProvider>
  );
}
