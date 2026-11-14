"use client";

import Footer from "@/components/Footer";
import MovieDetailModal from "@/components/MovieDetailModal";
import Navbar from "@/components/Navbar";

import { Movie } from "@/lib/movie";
import { api } from "@/lib/api";
import { ProfileMovieFeedCoordinator } from "@/lib/profile-movie-feed.mjs";
import { normalizeRecommendationMovie } from "@/lib/recommendation-feed.mjs";
import { getMovieWatchPath } from "@/lib/movie-navigation.mjs";

import { SearchIcon, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/Authcontext";

const page = () => {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#141414]" />}>
      <SearchPage />
    </Suspense>
  );
};

function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { selectedProfile, user } = useAuth();
  const [query, setQuery] = useState(searchParams.get("q") || "");

  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

  const [modalOpen, setModalOpen] = useState(false);

  // API results
  const profileId = user ? selectedProfile?._id || null : null;
  const [feedState, setFeedState] = useState({ profileId: null as string | null, requestKey: "", status: "idle" as string, movies: [] as Movie[], error: null as unknown });
  const coordinator = useRef<ProfileMovieFeedCoordinator | null>(null);
  if (!coordinator.current) coordinator.current = new ProfileMovieFeedCoordinator(
    (id: string, q: string) => api.recommendations.search(q, id),
    normalizeRecommendationMovie,
  );
  const loading = Boolean(query.trim() && profileId && (feedState.profileId !== profileId || feedState.requestKey !== query.trim() || feedState.status === "loading"));
  const searchError = feedState.status === "error" && feedState.profileId === profileId && feedState.requestKey === query.trim()
    ? (feedState.error as Error)?.message || "Failed to search movies."
    : "";

  useEffect(() => {
    const q = searchParams.get("q") || "";

    setQuery(q);
  }, [searchParams]);

  useEffect(() => coordinator.current?.setListener(setFeedState), []);
  useEffect(() => {
    setSelectedMovie(null);
    setModalOpen(false);
  }, [profileId]);
  useEffect(() => {
    const searchQuery = query.trim();
    if (!searchQuery || !profileId || !selectedProfile) {
      coordinator.current?.clear();
      return;
    }
    const timer = setTimeout(() => {
      void coordinator.current?.load(selectedProfile, searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [query, profileId, selectedProfile?.isKids, selectedProfile?.maturityLevel]);

  const currentProfileResults = feedState.profileId === profileId && feedState.requestKey === query.trim()
    ? feedState.movies
    : [];
  const results = currentProfileResults.filter((movie) => Boolean(getMovieWatchPath(movie.id)));

  const handleSelectMovie = (movie: Movie) => {
    if (!profileId || !getMovieWatchPath(movie.id)) return;
    setSelectedMovie(movie);
    setModalOpen(true);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const value = query.trim();
    if (!value) {
      router.push("/search");
      return;
    }
    router.push(`/search?q=${encodeURIComponent(value)}`);
  };

  return (
    <div className="min-h-screen bg-[#141414] overflow-x-hidden">
      <Navbar />
      <div className="pt-20 px-4 md:px-12 pb-12">
        <form onSubmit={handleSearch} className="max-w-2xl mb-8">
          <div className="flex items-center gap-3 bg-white/10 border border-white/20 rounded-md px-4 py-3">
            <SearchIcon className="w-5 h-5 text-white/60" />

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for movies, shows, genres, actors..."
              className="bg-transparent text-white text-lg placeholder-white/40 focus:outline-none flex-1"
              autoFocus
            />

            {loading && (
              <Loader2 className="w-5 h-5 text-white/50 animate-spin" />
            )}
          </div>
        </form>

        {query.trim() === "" ? (
          <div className="text-center py-20">
            <SearchIcon className="w-16 h-16 text-white/20 mx-auto mb-4" />

            <p className="text-white/60 text-lg">
              Search for movies, shows, genres, or cast members
            </p>
          </div>
        ) : loading ? (
          <div className="py-20 flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-white/50 animate-spin mb-4" />

            <p className="text-white/50">Finding movies for you...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-white/60 text-xl mb-2">
              No results for "{query}"
            </p>

            <p className="text-white/40 text-sm">
              Try searching for a different title, genre, or actor.
            </p>

            {searchError && (
              <p className="text-red-400 text-xs mt-4">{searchError}</p>
            )}
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-white text-xl font-bold">
                {results.length} {results.length === 1 ? "result" : "results"}{" "}
                for "{query}"
              </h2>

              {currentProfileResults.length > 0 && (
                <p className="text-white/40 text-xs mt-2">
                  Personalized results based on your search and viewing
                  preferences.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
              {results.map((movie) => (
                <div
                  key={movie.id}
                  onClick={() => handleSelectMovie(movie)}
                  className="group cursor-pointer rounded-md overflow-hidden bg-[#1a1a1a] transition-all duration-300 hover:scale-105 hover:z-10 hover:ring-2 hover:ring-white/20"
                >
                  {/* IMAGE */}

                  <div className="aspect-video relative overflow-hidden">
                    <img
                      src={movie.backdrop || movie.poster}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    {movie.isNew && (
                      <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        NEW
                      </div>
                    )}
                  </div>

                  {/* DETAILS */}

                  <div className="p-2 md:p-3">
                    <div className="flex items-center gap-2 mb-1">
                      {movie.match !== undefined && <span className="text-green-500 text-xs font-bold">{movie.match}% Match</span>}

                      <span className="text-white/40 text-xs">
                        {movie.year}
                      </span>

                      <span className="border border-white/30 text-white/60 text-[10px] px-1">
                        {movie.rating}
                      </span>
                    </div>

                    <p className="text-white text-sm font-medium truncate">
                      {movie.title}
                    </p>

                    <p className="text-white/50 text-xs mt-1 line-clamp-1">
                      {movie.genres.join(" - ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <Footer />

      <MovieDetailModal
        movie={selectedMovie}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSelectMovie={handleSelectMovie}
      />
    </div>
  );
}

export default page;
