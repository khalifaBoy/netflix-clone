"use client";
import { AuthProvider } from "./Authcontext";
import { WatchlistProvider } from "./WatchlistContext";

export default function Providers({ children }) {
  return (
    <AuthProvider>
      <WatchlistProvider>{children}</WatchlistProvider>
    </AuthProvider>
  );
}
