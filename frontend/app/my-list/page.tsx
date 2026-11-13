"use client";

import Footer from "@/components/Footer";
import MovieCard from "@/components/MovieCard";
import MovieDetailModal from "@/components/MovieDetailModal";
import Navbar from "@/components/Navbar";
import { useWatchlist } from "@/context/WatchlistContext";
import type { Movie as DisplayMovie } from "@/lib/movie";
import type { Movie as ApiMovie } from "@/lib/types";
import { useAuth } from "@/context/Authcontext";
import { useRouter } from "next/navigation";
import { useState } from "react";

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

export default function MyListPage() {
  const router = useRouter();
  const { selectedProfile } = useAuth();
  const {
    profileId: watchlistProfileId,
    items,
    loading,
    loaded,
    error,
    refresh,
  } = useWatchlist();
  const [selectedMovie, setSelectedMovie] = useState<DisplayMovie | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const profileId = selectedProfile?._id || null;
  const profileReady = Boolean(profileId && profileId === watchlistProfileId);

  const handleSelectMovie = (movie: DisplayMovie) => {
    setSelectedMovie(movie);
    setModalOpen(true);
  };

  const showLoading = Boolean(profileId && (!profileReady || loading || !loaded));
  const movies = profileReady
    ? items.flatMap((item) => item.movie && typeof item.movie !== "string" ? [toDisplayMovie(item.movie)] : [])
    : [];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#141414]">
      <Navbar />
      <main className="min-h-[70vh] px-4 pb-12 pt-24 md:px-12">
        <h1 className="mb-7 text-2xl font-bold text-white md:text-3xl">My List</h1>

        {!profileId ? (
          <section className="rounded-md bg-white/5 px-6 py-12 text-center">
            <h2 className="mb-2 text-xl font-semibold text-white">Choose a profile</h2>
            <p className="mb-5 text-white/60">Select a profile to view its saved movies.</p>
            <button
              type="button"
              onClick={() => router.push("/profiles")}
              className="rounded bg-white px-5 py-2 font-semibold text-black hover:bg-white/80"
            >
              Select profile
            </button>
          </section>
        ) : showLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="aspect-video animate-pulse rounded-md bg-white/10" />
            ))}
          </div>
        ) : error ? (
          <section className="rounded-md bg-white/5 px-6 py-12 text-center" role="alert">
            <h2 className="mb-2 text-xl font-semibold text-white">My List is unavailable</h2>
            <p className="mb-5 text-white/60">{error}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded bg-white px-5 py-2 font-semibold text-black hover:bg-white/80"
            >
              Retry
            </button>
          </section>
        ) : movies.length === 0 ? (
          <section className="rounded-md bg-white/5 px-6 py-12 text-center">
            <h2 className="mb-2 text-xl font-semibold text-white">Your list is empty</h2>
            <p className="mb-5 text-white/60">Save movies you want to watch and they’ll appear here.</p>
            <button
              type="button"
              onClick={() => router.push("/browse")}
              className="rounded bg-white px-5 py-2 font-semibold text-black hover:bg-white/80"
            >
              Browse movies
            </button>
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {movies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} onSelect={handleSelectMovie} />
            ))}
          </div>
        )}
      </main>
      <Footer />
      <MovieDetailModal movie={selectedMovie} open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
